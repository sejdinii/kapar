import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CalendarMonthResponse, DaySheetResponse } from '@kapar/shared-types';
import { getCalendarMonth, getDaySheet } from '../../../shared/api/endpoints';

/** react-query wrappers over the calendar read model + pure date-grid helpers (B2). */

export function useCalendarMonth(
  venueId: string | undefined,
  month: string,
): UseQueryResult<CalendarMonthResponse> {
  return useQuery({
    queryKey: ['calendar', venueId, month],
    queryFn: () => getCalendarMonth(venueId as string, month),
    enabled: venueId !== undefined,
  });
}

export function useDaySheet(
  venueId: string | undefined,
  date: string | null,
): UseQueryResult<DaySheetResponse> {
  return useQuery({
    queryKey: ['daySheet', venueId, date],
    queryFn: () => getDaySheet(venueId as string, date as string),
    enabled: venueId !== undefined && date !== null,
  });
}

// ── pure calendar math (exported for tests) ─────────────────────────────────────────────────

const MONTHS_PER_YEAR = 12;
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** 'YYYY-MM' for a Date. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Add n months to a 'YYYY-MM' key. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const total = y * MONTHS_PER_YEAR + (m - 1) + n;
  const year = Math.floor(total / MONTHS_PER_YEAR);
  const mon = (total % MONTHS_PER_YEAR) + 1;
  return `${year}-${String(mon).padStart(2, '0')}`;
}

/** Human header, e.g. 'May 2026'. */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${names[m - 1]} ${y}`;
}

export interface GridCell {
  /** YYYY-MM-DD */
  date: string;
  inMonth: boolean;
}

/**
 * Monday-first 6×7 grid for a 'YYYY-MM' month (SPEC B2: Monday-first).
 * Pure calendar arithmetic on UTC-noon dates — DST can never shift a cell.
 */
export function buildMonthGrid(month: string): GridCell[][] {
  const first = new Date(`${month}-01T12:00:00Z`);
  // JS getUTCDay(): 0=Sun..6=Sat → Monday-first offset 0=Mon..6=Sun.
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - mondayOffset);

  const weeks: GridCell[][] = [];
  const cursor = new Date(start);
  const WEEKS_SHOWN = 6;
  for (let w = 0; w < WEEKS_SHOWN; w += 1) {
    const week: GridCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const iso = cursor.toISOString().slice(0, 10);
      week.push({ date: iso, inMonth: iso.slice(0, 7) === month });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Today as YYYY-MM-DD (device clock; used only for highlighting, never for money). */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}
