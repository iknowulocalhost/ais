const ACCESS_KEY = 'ais.access';
const REFRESH_KEY = 'ais.refresh';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';

type Unauthorized = () => void;

let onAuthFailure: Unauthorized | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setAuthFailureHandler(cb: Unauthorized | null): void {
  onAuthFailure = cb;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly payload?: unknown,
  ) {
    super(message);
  }
}

async function refreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const refresh = getRefreshToken();
  if (!refresh) return false;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

function buildUrl(path: string, query?: ApiOptions['query']): string {
  const url = new URL((path.startsWith('http') ? '' : API_BASE) + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function doFetch(path: string, opts: ApiOptions): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers ?? {}),
  };
  if (opts.body !== undefined && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }
  if (!opts.skipAuth) {
    const access = getAccessToken();
    if (access) headers.Authorization = `Bearer ${access}`;
  }
  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body:
      opts.body === undefined
        ? undefined
        : typeof opts.body === 'string' || opts.body instanceof FormData
        ? (opts.body as BodyInit)
        : JSON.stringify(opts.body),
  });
}

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res = await doFetch(path, opts);

  if (res.status === 401 && !opts.skipAuth) {
    const ok = await refreshTokens();
    if (!ok) {
      onAuthFailure?.();
      throw new ApiError(401, 'Сессия истекла');
    }
    res = await doFetch(path, opts);
  }

  if (!res.ok) {
    let payload: unknown = null;
    try { payload = await res.json(); } catch { /* no-op */ }
    const message =
      (payload as { message?: string | string[] } | null)?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, Array.isArray(message) ? message.join('; ') : String(message), payload);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return (await res.text()) as unknown as T;
  return (await res.json()) as T;
}
