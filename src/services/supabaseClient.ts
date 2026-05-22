import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger'

interface ImportMeta {
  readonly env: {
	readonly VITE_SUPABASE_URL: string;
	readonly VITE_SUPABASE_ANON_KEY: string;
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Debug logging to ensure environment variables are loaded
logger.debug('Supabase URL:', supabaseUrl ? 'Loaded' : 'NOT LOADED')
logger.debug('Supabase Anon Key:', supabaseAnonKey ? 'Loaded (length: ' + supabaseAnonKey.length + ')' : 'NOT LOADED')

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Create a mock Supabase client that does nothing when not configured
const createMockSupabaseClient = () => ({
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => {
      // Simulate network delay then reject
      await new Promise(resolve => setTimeout(resolve, 100));
      return { data: null, error: { message: 'Supabase no está configurado. Usa el modo offline.' } };
    },
    signUp: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { data: null, error: { message: 'Supabase no está configurado. Usa el modo offline.' } };
    },
    resetPasswordForEmail: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { error: { message: 'Supabase no está configurado.' } };
    },
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: { code: 'PGRST116' } }),
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      }),
    }),
    update: () => ({
      eq: () => ({
        select: () => ({
          single: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
        }),
      }),
    }),
    delete: () => ({
      eq: () => ({
        select: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      }),
    }),
  }),
  functions: {
    invoke: async () => ({
      data: null,
      error: { message: 'Supabase no está configurado. Las funciones Edge no están disponibles.' }
    })
  },
  rpc: async () => ({
    data: null,
    error: { message: 'Supabase no está configurado. Las funciones RPC no están disponibles.' }
  })
});

// IMPORTANT: Only use the anon public key in the frontend
// Never expose service_role or other secret keys in client-side code
// Type assertion to SupabaseClient to avoid TypeScript errors with mock methods
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storageKey: 'stoqly-supabase-auth',
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : createMockSupabaseClient() as unknown as SupabaseClient;

// ─────────────────────────────────────────────────────────────────────────────
// Cold-start retry utility
//
// Supabase free plan pauses the database after ~1 week of inactivity.
// The first few queries after a cold start fail with network or JWT errors
// while the DB wakes up (typically takes 1-5 s).  This helper retries those
// transient failures automatically with exponential back-off so the app
// recovers without the user having to manually refresh the page.
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true for errors that are likely caused by a cold Supabase start. */
function isColdStartError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  const code = String(error.code ?? '');
  const status = Number(error.status ?? error.statusCode ?? 0);
  // Never retry permission / auth errors — those are permanent, not transient
  if (status === 401 || status === 403 || status === 404) return false;
  if (code === '42501' && !msg.includes('cold') && !msg.includes('wak')) return false;

  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror')    ||
    msg.includes('network request failed') ||
    msg.includes('connection')      ||
    msg.includes('timeout')         ||
    code === 'PGRST301'             || // PostgREST: JWT expired / not ready (cold start only)
    status === 0                    || // offline / CORS pre-flight failed
    status === 503                  || // Supabase DB still waking up
    status === 500                     // internal error while DB wakes
  );
}

/**
 * Wraps a Supabase query with exponential-backoff retry for cold-start errors.
 *
 * Usage:
 *   const { data, error } = await retryOnColdStart(() =>
 *     supabase.from('table').select('*')
 *   );
 *
 * @param queryFn     Zero-arg function that executes and returns a Supabase query
 * @param maxAttempts Maximum number of attempts before giving up (default 5)
 */
export async function retryOnColdStart(
  queryFn: () => PromiseLike<{ data: any; error: any }>,
  maxAttempts = 5
): Promise<{ data: any; error: any }> {
  const BASE_DELAY_MS = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let result: { data: any; error: any };
    try {
      result = await queryFn();
    } catch (caughtErr: any) {
      result = { data: null, error: caughtErr };
    }

    if (!result.error) return result;

    if (!isColdStartError(result.error) || attempt === maxAttempts - 1) {
      return result; // permanent error or exhausted — surface to caller
    }

    const delayMs = Math.round(BASE_DELAY_MS * Math.pow(1.5, attempt)); // 2s → 3s → 4.5s → 6.75s
    logger.warn(
      `[coldStart] Transient error (attempt ${attempt + 1}/${maxAttempts}) — retrying in ${delayMs}ms`,
      { code: result.error.code, message: result.error.message, status: result.error.status }
    );
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }

  return { data: null, error: new Error('Cold-start: max retries exceeded') };
}