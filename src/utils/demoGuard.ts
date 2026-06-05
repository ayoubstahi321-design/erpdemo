/**
 * Demo Mode Guard
 *
 * Intercepts all Supabase write operations (insert, update, delete, upsert, rpc, functions.invoke)
 * and replaces them with fake successful responses that never reach the database.
 *
 * This allows multiple clients to use the demo simultaneously without corrupting shared data.
 * Reads always pass through to Supabase so all clients see the same clean demo data.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const WRITE_METHODS = new Set(['insert', 'update', 'delete', 'upsert']);

/**
 * Creates a fake thenable chain that resolves to { data, error: null }.
 * Supports all Supabase query builder chaining patterns:
 *   .insert([...]).select().single()
 *   .update({}).eq('id', x).select().single()
 *   .delete().eq('id', x)
 *   .upsert({})
 */
function createFakeChain(inputData?: any): any {
  const data = Array.isArray(inputData) ? (inputData[0] ?? null) : (inputData ?? null);
  const resolved = Promise.resolve({ data, error: null });

  const chain: any = new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (prop === 'then') return resolved.then.bind(resolved);
        if (prop === 'catch') return resolved.catch.bind(resolved);
        if (prop === 'finally') return resolved.finally.bind(resolved);
        // Any other method call (select, eq, single, limit, etc.) returns the same chain
        if (typeof prop === 'string') return (..._args: any[]) => chain;
        return undefined;
      },
    }
  );

  return chain;
}

/**
 * Wraps a Supabase QueryBuilder so that write methods fire a demo event
 * and return a fake success chain instead of hitting the database.
 * Read methods (select, eq filters on reads, etc.) pass through normally.
 */
function wrapBuilderForDemo(realBuilder: any, table: string): any {
  return new Proxy(realBuilder, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === 'string' && WRITE_METHODS.has(prop)) {
        return (inputData?: any) => {
          window.dispatchEvent(
            new CustomEvent('stoqly:demo-write-blocked', {
              detail: { table, method: prop },
            })
          );
          return createFakeChain(inputData);
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });
}

/**
 * Applies demo mode protection to a live Supabase client.
 * Mutates the client in-place (safe — it's a module singleton).
 *
 * Protected surfaces:
 *  - supabase.from(table).insert/update/delete/upsert
 *  - supabase.rpc(fnName, ...)
 *  - supabase.functions.invoke(fnName, ...)
 */
export function applyDemoProtection(supabase: SupabaseClient): void {
  // ── from() ─────────────────────────────────────────────────────────────────
  const realFrom = supabase.from.bind(supabase);
  (supabase as any).from = (table: string) =>
    wrapBuilderForDemo(realFrom(table), table);

  // ── rpc() ──────────────────────────────────────────────────────────────────
  const realRpc = supabase.rpc.bind(supabase);
  (supabase as any).rpc = (fnName: string, params?: any, options?: any) => {
    // Allow read-only RPCs (naming convention: fn names starting with 'get_')
    if (fnName.startsWith('get_') || fnName.startsWith('fetch_')) {
      return realRpc(fnName, params, options);
    }
    window.dispatchEvent(
      new CustomEvent('stoqly:demo-write-blocked', {
        detail: { method: 'rpc', fn: fnName },
      })
    );
    return createFakeChain(null);
  };

  // ── functions.invoke() ────────────────────────────────────────────────────
  const realInvoke = supabase.functions.invoke.bind(supabase.functions);
  (supabase.functions as any).invoke = (fnName: string, options?: any) => {
    window.dispatchEvent(
      new CustomEvent('stoqly:demo-write-blocked', {
        detail: { method: 'functions.invoke', fn: fnName },
      })
    );
    return Promise.resolve({ data: { success: true }, error: null });
  };
}
