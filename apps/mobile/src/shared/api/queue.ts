import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { CreateBookingRequest } from '@kapar/shared-types';
import { ApiRequestError, NetworkError } from './client';
import { createBooking } from './endpoints';

/**
 * Offline Add Reservation queue (SPEC B3/B2 offline rules):
 *  - saving with no connection queues locally with a VISIBLE pending badge;
 *  - replay is idempotent server-side via clientRequestId;
 *  - a replay that loses the date (409 SLOT_TAKEN) becomes a surfaced CONFLICT —
 *    never silently dropped.
 */

const STORAGE_KEY = 'kapar.pendingReservations.v1';

export interface QueuedReservation {
  venueId: string;
  request: CreateBookingRequest;
  queuedAt: string; // ISO timestamp
}

export interface QueueConflict {
  reservation: QueuedReservation;
  holderLabel: string;
}

interface QueueState {
  pending: QueuedReservation[];
  conflicts: QueueConflict[];
}

const EMPTY: QueueState = { pending: [], conflicts: [] };

async function load(): Promise<QueueState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as QueueState;
    return {
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
    };
  } catch {
    return EMPTY;
  }
}

async function persist(state: QueueState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Module-level store with subscribers, so every screen sees one queue. */
let state: QueueState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

async function ensureLoaded(): Promise<void> {
  if (!loaded) {
    state = await load();
    loaded = true;
    emit();
  }
}

export async function enqueueReservation(
  venueId: string,
  request: CreateBookingRequest,
): Promise<void> {
  await ensureLoaded();
  state = {
    ...state,
    pending: [...state.pending, { venueId, request, queuedAt: new Date().toISOString() }],
  };
  await persist(state);
  emit();
}

/**
 * Replay queued reservations in order. NetworkError stops the flush (still offline);
 * SLOT_TAKEN moves the entry to conflicts; any other API error also stops (surfaced by
 * the caller on next manual retry). Returns how many synced.
 */
export async function flushQueue(): Promise<number> {
  await ensureLoaded();
  let synced = 0;
  while (state.pending.length > 0) {
    const next = state.pending[0]!;
    try {
      await createBooking(next.venueId, next.request);
      state = { ...state, pending: state.pending.slice(1) };
      synced += 1;
    } catch (err) {
      if (err instanceof NetworkError) {
        break;
      }
      if (err instanceof ApiRequestError && err.code === 'SLOT_TAKEN') {
        state = {
          pending: state.pending.slice(1),
          conflicts: [
            ...state.conflicts,
            { reservation: next, holderLabel: err.holder?.label ?? 'another reservation' },
          ],
        };
        continue;
      }
      break;
    }
  }
  await persist(state);
  emit();
  return synced;
}

export async function dismissConflict(index: number): Promise<void> {
  await ensureLoaded();
  state = { ...state, conflicts: state.conflicts.filter((_, i) => i !== index) };
  await persist(state);
  emit();
}

/** React hook over the shared queue. */
export function useOfflineQueue(): {
  pendingCount: number;
  conflicts: QueueConflict[];
  enqueue: typeof enqueueReservation;
  flush: () => Promise<number>;
  dismissConflict: (index: number) => Promise<void>;
} {
  const [, force] = useState(0);

  useEffect(() => {
    const listener = (): void => force((n) => n + 1);
    listeners.add(listener);
    void ensureLoaded();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const flush = useCallback(() => flushQueue(), []);
  const dismiss = useCallback((index: number) => dismissConflict(index), []);

  return {
    pendingCount: state.pending.length,
    conflicts: state.conflicts,
    enqueue: enqueueReservation,
    flush,
    dismissConflict: dismiss,
  };
}
