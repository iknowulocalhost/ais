const DEFAULT_TTL_MS = 5 * 60_000;

interface CacheEntry<T> {
  data: T;
  at: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function readDashboardCache<T>(key: string): T | null {
  const entry = store.get(key);
  return entry ? (entry.data as T) : null;
}

export function writeDashboardCache<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}

/** true, если кэш устарел и стоит обновить фоном. */
export function isDashboardCacheStale(key: string, ttlMs = DEFAULT_TTL_MS): boolean {
  const entry = store.get(key);
  if (!entry) return true;
  return Date.now() - entry.at > ttlMs;
}

export function dashboardCacheAge(key: string): number | null {
  const entry = store.get(key);
  return entry ? Date.now() - entry.at : null;
}

export function clearDashboardCache(): void {
  store.clear();
}
