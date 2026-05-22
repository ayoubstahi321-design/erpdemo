import { useState, useCallback } from 'react';

/**
 * Hook that persists state in localStorage.
 * Falls back to defaultValue if localStorage is unavailable or value is invalid.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === null) return defaultValue;
      return JSON.parse(saved) as T;
    } catch {
      return defaultValue;
    }
  });

  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch {
        // localStorage full or unavailable - continue with in-memory state
      }
      return newValue;
    });
  }, [key]);

  return [state, setPersistedState];
}

/**
 * Hook for persisting simple string values (no JSON parsing needed)
 */
export function usePersistedString(
  key: string,
  defaultValue: string = ''
): [string, (value: string) => void] {
  const [state, setState] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersistedState = useCallback((value: string) => {
    setState(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage full or unavailable
    }
  }, [key]);

  return [state, setPersistedState];
}
