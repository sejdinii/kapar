import * as SecureStore from 'expo-secure-store';
import type { ApiError, AuthTokens } from '@kapar/shared-types';

/**
 * Typed HTTP client. The server issues every number the app shows (Law #3) — this layer
 * only moves JSON. 401s trigger ONE shared refresh; the request replays once.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const ACCESS_TOKEN_KEY = 'kapar.accessToken';
export const REFRESH_TOKEN_KEY = 'kapar.refreshToken';

/** Server rejected the request with an ApiError envelope. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly holder?: ApiError['holder'],
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Transport-level failure (offline, DNS, timeout) — the offline queue keys on this. */
export class NetworkError extends Error {
  constructor() {
    super('No connection. Check your internet and try again.');
    this.name = 'NetworkError';
  }
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

/** Set by the session provider so a dead refresh token signs the user out globally. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/** One in-flight refresh, shared by every 401 that races in at the same moment. */
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight === null) {
    refreshInFlight = (async (): Promise<boolean> => {
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (refreshToken === null) {
          return false;
        }
        const res = await fetch(`${BASE_URL}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          return false;
        }
        const tokens = (await res.json()) as AuthTokens;
        await saveTokens(tokens);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function parseError(res: Response): Promise<ApiRequestError> {
  let apiError: ApiError = { code: 'HTTP_ERROR', message: 'Something went wrong. Please try again.' };
  try {
    const body = (await res.json()) as { error?: ApiError };
    if (body.error !== undefined && typeof body.error.code === 'string') {
      apiError = body.error;
    }
  } catch {
    // Non-JSON error body — keep the generic message.
  }
  return new ApiRequestError(
    res.status,
    apiError.code,
    apiError.message,
    apiError.holder,
    apiError.retryAfterSeconds,
  );
}

export async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (token !== null) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    try {
      return await fetch(`${BASE_URL}/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new NetworkError();
    }
  };

  let res = await doFetch();
  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      onSessionExpired?.();
      throw await parseError(res);
    }
    res = await doFetch();
  }
  if (!res.ok) {
    throw await parseError(res);
  }
  // 204/empty bodies: only DELETE-ish endpoints; all M1 endpoints return JSON.
  return (await res.json()) as T;
}
