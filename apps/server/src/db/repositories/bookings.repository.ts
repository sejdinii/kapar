import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type {
  BookingListTab,
  BookingSource,
  BookingStatus,
  EventType,
  KaparPaidState,
} from '@kapar/shared-types';
import { SlotTakenError, NotFoundError, SlotHolder } from '../../common/errors';
import { escapeLikePattern, pgPool, withTransaction } from '../pool';
import { AuditRepository } from './audit.repository';
import { BookingRow, mapBookingRow } from '../rows';

export interface CreateBookingInput {
  venueId: string;
  hallId: string;
  eventDate: string; // YYYY-MM-DD
  slot: string;
  status: BookingStatus;
  source: BookingSource;
  customerName: string;
  customerPhone: string;
  guests: number | null;
  eventType: EventType;
  startTime: string | null; // HH:MM
  endTime: string | null;
  kaparAmountMinor: number | null;
  kaparReceivedMinor: number | null;
  kaparCurrency: string;
  kaparPaidState: KaparPaidState;
  notes: string;
  clientRequestId: string | null;
}

export interface UpdateBookingPatch {
  guests?: number;
  startTime?: string;
  endTime?: string;
  kaparAmountMinor?: number;
  kaparReceivedMinor?: number;
  kaparPaidState?: KaparPaidState;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface BookingListFilter {
  tab: BookingListTab;
  q?: string;
  source?: BookingSource;
}

const BOOKING_COLUMNS = `id, booking_ref, venue_id, hall_id, couple_user_id, event_date, slot,
  status, source, guests, event_type, start_time, end_time, customer_name, customer_phone,
  kapar_amount_minor, kapar_received_minor, kapar_currency, kapar_paid_state, notes,
  client_request_id, created_at`;

/** Statuses that hold a slot claim. Cancelled/declined/expired bookings free their date. */
const ACTIVE_STATUSES = ['PENDING_PAYMENT', 'PENDING_VENUE', 'CONFIRMED'] as const;

@Injectable()
export class BookingsRepository {
  constructor(private readonly audit: AuditRepository) {}

  /**
   * THE race-safe insert (SPEC §5, proven in db-proof/). One transaction:
   *   1. clientRequestId replay? → return the existing booking (offline-queue idempotency).
   *   2. INSERT slot_claims ... ON CONFLICT DO NOTHING.
   *   3. 0 rows → someone holds the slot → look up the holder → SlotTakenError (409).
   *   4. INSERT bookings + audit_log, COMMIT.
   * N concurrent calls on one (hall, date, slot) yield exactly one winner — by the DB
   * uniqueness constraint, not by application luck.
   */
  async createWithClaim(input: CreateBookingInput, actorUserId: string): Promise<BookingRow> {
    if (input.clientRequestId !== null) {
      const replay = await pgPool.query(
        `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE client_request_id = $1`,
        [input.clientRequestId],
      );
      if (replay.rows[0] !== undefined) {
        return mapBookingRow(replay.rows[0]);
      }
    }

    return withTransaction(async (client) => {
      const claim = await client.query(
        `INSERT INTO slot_claims (hall_id, event_date, slot, venue_id, kind, ref_id)
         VALUES ($1, $2, $3, $4, 'booking', gen_random_uuid())
         ON CONFLICT (hall_id, event_date, slot) DO NOTHING
         RETURNING ref_id`,
        [input.hallId, input.eventDate, input.slot, input.venueId],
      );
      if (claim.rows[0] === undefined) {
        throw new SlotTakenError(
          await this.lookupHolder(client, input.hallId, input.eventDate, input.slot),
        );
      }
      const bookingId: string = claim.rows[0].ref_id;

      const inserted = await client.query(
        `INSERT INTO bookings (
           id, booking_ref, venue_id, hall_id, event_date, slot, status, source,
           guests, event_type, start_time, end_time, customer_name, customer_phone,
           kapar_amount_minor, kapar_received_minor, kapar_currency, kapar_paid_state,
           notes, client_request_id, created_by_user_id
         ) VALUES (
           $1, 'KPR-' || extract(year FROM now())::int || '-' || nextval('booking_ref_seq'),
           $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
         ) RETURNING ${BOOKING_COLUMNS}`,
        [
          bookingId,
          input.venueId,
          input.hallId,
          input.eventDate,
          input.slot,
          input.status,
          input.source,
          input.guests,
          input.eventType,
          input.startTime,
          input.endTime,
          input.customerName,
          input.customerPhone,
          input.kaparAmountMinor,
          input.kaparReceivedMinor,
          input.kaparCurrency,
          input.kaparPaidState,
          input.notes,
          input.clientRequestId,
          actorUserId,
        ],
      );
      const booking = mapBookingRow(inserted.rows[0]);

      await this.audit.append(
        {
          actorUserId,
          action: 'booking.create',
          entityType: 'booking',
          entityId: booking.id,
          after: {
            bookingRef: booking.bookingRef,
            hallId: booking.hallId,
            eventDate: booking.eventDate,
            source: booking.source,
          },
        },
        client,
      );
      return booking;
    });
  }

  async listByVenue(venueId: string, filter: BookingListFilter): Promise<BookingRow[]> {
    const params: unknown[] = [venueId];
    let where: string;
    switch (filter.tab) {
      case 'upcoming':
        where = `venue_id = $1 AND event_date >= CURRENT_DATE AND status = ANY($2)`;
        params.push([...ACTIVE_STATUSES]);
        break;
      case 'completed':
        where = `venue_id = $1 AND event_date < CURRENT_DATE AND status = 'CONFIRMED'`;
        break;
      case 'cancelled':
        where = `venue_id = $1 AND status = ANY($2)`;
        params.push(['DECLINED', 'EXPIRED', 'CANCELLED_BY_COUPLE', 'CANCELLED_BY_VENUE']);
        break;
    }
    if (filter.q !== undefined && filter.q.length > 0) {
      params.push(`%${escapeLikePattern(filter.q)}%`);
      where += ` AND (customer_name ILIKE $${params.length} ESCAPE '\\' OR customer_phone ILIKE $${params.length} ESCAPE '\\')`;
    }
    if (filter.source !== undefined) {
      params.push(filter.source);
      where += ` AND source = $${params.length}`;
    }
    const res = await pgPool.query(
      `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE ${where} ORDER BY event_date ASC, created_at ASC`,
      params,
    );
    return res.rows.map(mapBookingRow);
  }

  async findById(id: string): Promise<BookingRow | null> {
    const res = await pgPool.query(`SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1`, [id]);
    return res.rows[0] === undefined ? null : mapBookingRow(res.rows[0]);
  }

  async updateEditable(
    id: string,
    patch: UpdateBookingPatch,
    actorUserId: string,
  ): Promise<BookingRow> {
    return withTransaction(async (client) => {
      const beforeRes = await client.query(
        `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (beforeRes.rows[0] === undefined) {
        throw new NotFoundError('Booking not found');
      }
      const before = mapBookingRow(beforeRes.rows[0]);

      const res = await client.query(
        `UPDATE bookings SET
           guests               = COALESCE($2, guests),
           start_time           = COALESCE($3, start_time),
           end_time             = COALESCE($4, end_time),
           kapar_amount_minor   = COALESCE($5, kapar_amount_minor),
           kapar_received_minor = COALESCE($6, kapar_received_minor),
           kapar_paid_state     = COALESCE($7, kapar_paid_state),
           notes                = COALESCE($8, notes),
           customer_name        = COALESCE($9, customer_name),
           customer_phone       = COALESCE($10, customer_phone),
           updated_at           = now()
         WHERE id = $1 RETURNING ${BOOKING_COLUMNS}`,
        [
          id,
          patch.guests ?? null,
          patch.startTime ?? null,
          patch.endTime ?? null,
          patch.kaparAmountMinor ?? null,
          patch.kaparReceivedMinor ?? null,
          patch.kaparPaidState ?? null,
          patch.notes ?? null,
          patch.customerName ?? null,
          patch.customerPhone ?? null,
        ],
      );
      const after = mapBookingRow(res.rows[0]);
      await this.audit.append(
        {
          actorUserId,
          action: 'booking.update',
          entityType: 'booking',
          entityId: id,
          before: { kaparPaidState: before.kaparPaidState, guests: before.guests, notes: before.notes },
          after: { kaparPaidState: after.kaparPaidState, guests: after.guests, notes: after.notes },
        },
        client,
      );
      return after;
    });
  }

  /** Cancel: status → CANCELLED_BY_VENUE, claim released, audited — one transaction. */
  async cancel(id: string, actorUserId: string): Promise<BookingRow> {
    return withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE bookings SET status = 'CANCELLED_BY_VENUE', updated_at = now()
         WHERE id = $1 AND status = ANY($2) RETURNING ${BOOKING_COLUMNS}`,
        [id, [...ACTIVE_STATUSES]],
      );
      if (res.rows[0] === undefined) {
        throw new NotFoundError('Active booking not found');
      }
      const booking = mapBookingRow(res.rows[0]);
      await client.query(
        `DELETE FROM slot_claims WHERE kind = 'booking' AND ref_id = $1`,
        [id],
      );
      await this.audit.append(
        {
          actorUserId,
          action: 'booking.cancel',
          entityType: 'booking',
          entityId: id,
          before: { status: 'CONFIRMED' },
          after: { status: booking.status },
        },
        client,
      );
      return booking;
    });
  }

  /** Who holds a contested slot — powers the B3 conflict card ("shows the existing holder"). */
  private async lookupHolder(
    client: PoolClient,
    hallId: string,
    eventDate: string,
    slot: string,
  ): Promise<SlotHolder> {
    const res = await client.query(
      `SELECT c.kind,
              b.booking_ref, b.customer_name,
              bl.reason
       FROM slot_claims c
       LEFT JOIN bookings b        ON c.kind = 'booking' AND b.id = c.ref_id
       LEFT JOIN calendar_blocks bl ON c.kind = 'block'  AND bl.id = c.ref_id
       WHERE c.hall_id = $1 AND c.event_date = $2 AND c.slot = $3`,
      [hallId, eventDate, slot],
    );
    const row = res.rows[0];
    if (row === undefined) {
      // Claim vanished between conflict and lookup (holder cancelled mid-flight).
      return { kind: 'booking', label: 'Another reservation (just released — try again)' };
    }
    if (row.kind === 'booking') {
      return {
        kind: 'booking',
        label: `Booking ${row.booking_ref ?? ''} — ${row.customer_name ?? 'existing reservation'}`.trim(),
      };
    }
    const reason: string = row.reason ?? '';
    return { kind: 'block', label: reason.length > 0 ? `Blocked: ${reason}` : 'Blocked date' };
  }
}
