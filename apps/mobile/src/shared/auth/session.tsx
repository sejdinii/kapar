import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthTokens, MeDto, VenueDto } from '@kapar/shared-types';
import {
  clearTokens,
  getRefreshToken,
  saveTokens,
  setSessionExpiredHandler,
} from '../api/client';
import { getMyVenues, logout as apiLogout } from '../api/endpoints';

/**
 * Session state machine: loading → signedOut | signedIn.
 * After sign-in the user's venues load; M1 is single-venue-first — activeVenue defaults
 * to the first venue and drives every Business Mode screen.
 */

type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionContextValue {
  status: SessionStatus;
  user: MeDto | null;
  venues: VenueDto[];
  activeVenue: VenueDto | null;
  setActiveVenue: (venue: VenueDto) => void;
  signIn: (tokens: AuthTokens, user: MeDto) => Promise<void>;
  refreshVenues: () => Promise<VenueDto[]>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider(props: { children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<MeDto | null>(null);
  const [venues, setVenues] = useState<VenueDto[]>([]);
  const [activeVenue, setActiveVenue] = useState<VenueDto | null>(null);

  const refreshVenues = useCallback(async (): Promise<VenueDto[]> => {
    const list = await getMyVenues();
    setVenues(list);
    setActiveVenue((current) => {
      if (current !== null) {
        return list.find((v) => v.id === current.id) ?? list[0] ?? null;
      }
      return list[0] ?? null;
    });
    return list;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await apiLogout(); // revoke server-side first (SPEC C13 log-out behavior)
    } catch {
      // Offline logout still clears the device — the refresh token dies at expiry.
    }
    await clearTokens();
    setUser(null);
    setVenues([]);
    setActiveVenue(null);
    setStatus('signedOut');
  }, []);

  const signIn = useCallback(
    async (tokens: AuthTokens, me: MeDto): Promise<void> => {
      await saveTokens(tokens);
      setUser(me);
      setStatus('signedIn');
      try {
        await refreshVenues();
      } catch {
        // Venue load failing must not block sign-in; RootNavigator retries via onboarding.
      }
    },
    [refreshVenues],
  );

  // Cold start: a stored refresh token means "try to resume" — the first authed request
  // rotates it via the client's 401→refresh path. /me doubles as the probe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const refreshToken = await getRefreshToken();
      if (refreshToken === null) {
        if (!cancelled) {
          setStatus('signedOut');
        }
        return;
      }
      try {
        const { request } = await import('../api/client');
        const me = await request<MeDto>('/me');
        if (cancelled) {
          return;
        }
        setUser(me);
        setStatus('signedIn');
        await refreshVenues();
      } catch {
        if (!cancelled) {
          await clearTokens();
          setStatus('signedOut');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshVenues]);

  // A failed token refresh anywhere in the app signs the user out coherently.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void clearTokens();
      setUser(null);
      setVenues([]);
      setActiveVenue(null);
      setStatus('signedOut');
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, venues, activeVenue, setActiveVenue, signIn, refreshVenues, signOut }),
    [status, user, venues, activeVenue, signIn, refreshVenues, signOut],
  );

  return <SessionContext.Provider value={value}>{props.children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return ctx;
}
