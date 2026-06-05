import { useSyncExternalStore } from "react";

/* A tiny localStorage-backed store with the cached-snapshot pattern required by
   useSyncExternalStore (getSnapshot must return a stable reference until the
   persisted value actually changes, or React infinite-loops). */
export function createPersistentStore<T extends object>(key: string, defaults: T) {
  let cachedRaw: string | null = null;
  let cached: T = defaults;
  const listeners = new Set<() => void>();

  function get(): T {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      /* ignore */
    }
    if (raw === cachedRaw) return cached;
    cachedRaw = raw;
    try {
      cached = raw ? { ...defaults, ...(JSON.parse(raw) as Partial<T>) } : defaults;
    } catch {
      cached = defaults;
    }
    return cached;
  }

  function set(patch: Partial<T>) {
    const next = { ...get(), ...patch };
    const raw = JSON.stringify(next);
    try {
      localStorage.setItem(key, raw);
    } catch {
      /* ignore */
    }
    cachedRaw = raw;
    cached = next;
    listeners.forEach((l) => l());
  }

  function use(): T {
    return useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      get,
      get,
    );
  }

  return { get, set, use };
}
