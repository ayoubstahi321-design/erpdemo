/**
 * Transforms snake_case keys to camelCase
 * Used for Supabase Realtime payloads which arrive in snake_case
 */

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function transformKeys<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(transformKeys) as T;
  if (typeof obj !== 'object') return obj;

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    result[snakeToCamel(key)] = transformKeys(obj[key]);
  }
  return result as T;
}
