/**
 * Retry utility for transient network failures.
 * Wraps any async function with exponential-backoff retry logic.
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in ms (default: 500). Doubles each attempt. */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 8000) */
  maxDelayMs?: number;
  /** Return true to retry on this error; false to throw immediately */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

const DEFAULT_SHOULD_RETRY = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return true;
  const e = err as any;
  // Don't retry on auth / RLS / not-found errors
  const permanentCodes = ['PGRST116', '42501', 'JWT', '401', '403', '404'];
  if (permanentCodes.some(code => String(e?.code).includes(code))) return false;
  if (e?.status === 401 || e?.status === 403 || e?.status === 404) return false;
  return true;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    shouldRetry = DEFAULT_SHOULD_RETRY,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt === maxAttempts;
      if (isLast || !shouldRetry(err, attempt)) {
        throw err;
      }
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
