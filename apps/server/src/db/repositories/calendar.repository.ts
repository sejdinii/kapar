import { Injectable } from '@nestjs/common';
import type { CalendarDay, DayHallState, DaySheetEntry } from '@kapar/shared-types';
import { FULL_DAY_SLOT } from '@kapar/shared-types';
import { pgPool } from '../pool';

/**
 * Read model over slot_claims — the same object every mutation writes, so what this
 * returns IS live availability (Law #1: the calendar is the single source of truth).
 */
@Injectable()
export class CalendarRepository {
  /** Month view: for each date of the month, the state of each active hall. */
  async monthView(venueId: string, monthISO: string): Promise<CalendarDay[]> {
    // monthISO validated upstream as YYYY-MM.
    const monthStart = `${monthISO}-01`;
    const res = await pgPool.query<{
      date: string;
      hall_id: string;
      kind: 'booking' | 'block' | null;
    }>(
      `WITH days AS (
         SELECT d::date AS date
         FROM generate_series($2::date, ($2::date + interval '1 month' - interval '1 day'), interval '1 day') d
       ),
       venue_halls AS (
         SELECT id FROM halls WHERE venue_id = $1 AND archived_at IS NULL
       )
       SELECT to_char(days.date, 'YYYY-MM-DD') AS date, venue_halls.id AS hall_id, c.kind
       FROM days
       CROSS JOIN venue_halls
       LEFT JOIN slot_claims c
         ON c.hall_id = venue_halls.id AND c.event_date = days.date AND c.slot = $3
       ORDER BY days.date ASC`,
      [venueId, monthStart, FULL_DAY_SLOT],
    );

    const byDate = new Map<string, CalendarDay>();
    for (const row of res.rows) {
      let day = byDate.get(row.date);
      if (day === undefined) {
        day = { date: row.date, halls: [] };
        byDate.set(row.date, day);
      }
      const state: DayHallState =
        row.kind === 'booking' ? 'booked' : row.kind === 'block' ? 'blocked' : 'available';
      day.halls.push({ hallId: row.hall_id, state });
    }
    return [...byDate.values()];
  }

  /** Day sheet (B2): per-hall rows with the booking/block behind each claimed slot. */
  async daySheet(venueId: string, dateISO: string): Promise<DaySheetEntry[]> {
    const res = await pgPool.query(
      `SELECT h.id AS hall_id, h.name AS hall_name,
              c.kind,
              b.id AS booking_id, b.booking_ref, b.customer_name, b.status AS booking_status,
              b.source, b.guests, b.kapar_paid_state, b.event_date AS booking_date, b.slot AS booking_slot,
              bl.id AS block_id, bl.reason AS block_reason
       FROM halls h
       LEFT JOIN slot_claims c
         ON c.hall_id = h.id AND c.event_date = $2 AND c.slot = $3
       LEFT JOIN bookings b         ON c.kind = 'booking' AND b.id = c.ref_id
       LEFT JOIN calendar_blocks bl ON c.kind = 'block'  AND bl.id = c.ref_id
       WHERE h.venue_id = $1 AND h.archived_at IS NULL
       ORDER BY h.created_at ASC`,
      [venueId, dateISO, FULL_DAY_SLOT],
    );

    return res.rows.map((row): DaySheetEntry => {
      const state: DayHallState =
        row.kind === 'booking' ? 'booked' : row.kind === 'block' ? 'blocked' : 'available';
      const entry: DaySheetEntry = {
        hallId: row.hall_id,
        hallName: row.hall_name,
        slot: FULL_DAY_SLOT,
        state,
      };
      if (state === 'booked' && row.booking_id !== null) {
        entry.booking = {
          id: row.booking_id,
          bookingRef: row.booking_ref,
          customerName: row.customer_name,
          eventDate: dateISO,
          slot: FULL_DAY_SLOT,
          status: row.booking_status,
          source: row.source,
          hallId: row.hall_id,
          hallName: row.hall_name,
          guests: row.guests,
          kaparPaidState: row.kapar_paid_state,
        };
      }
      if (state === 'blocked' && row.block_id !== null) {
        entry.block = {
          id: row.block_id,
          hallId: row.hall_id,
          eventDate: dateISO,
          slot: FULL_DAY_SLOT,
          reason: row.block_reason ?? '',
        };
      }
      return entry;
    });
  }
}
