const CACHE_PREFIX = 'barri.readOnlySessions.';
const LEGACY_CACHE_KEY = 'barri.readOnlySessions';

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${encodeURIComponent(userId)}`;
}

/** Read-only snapshots are private browser data and must be account-scoped. */
export function loadUserSessionCache<T>(userId: string): T[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = window.sessionStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

export function writeUserSessionCache<T>(userId: string, entries: T[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try { window.sessionStorage.setItem(cacheKey(userId), JSON.stringify(entries)); } catch { /* ignore */ }
}

export function clearAllSessionCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key === LEGACY_CACHE_KEY || key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.sessionStorage.removeItem(key);
  } catch { /* ignore */ }
}
