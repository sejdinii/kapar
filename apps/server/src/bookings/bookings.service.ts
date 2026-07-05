import { BadRequestException, Injectable } from '@nestjs/common';
import type { BookingDto, BookingListResponse, BookingSummaryDto } from '@kapar/shared-types';
import { BookingStatus, EventType, FULL_DAY_SLOT, KaparPaidState } from '@kapar/shared-types';
import { ForbiddenError, NotFoundError } from '../common/errors';
import { normalizeToE164 } from '../common/phone';
import { BookingsRepository } from '../db/repositories/bookings.repository';
import { HallsRepository } from '../db/repositories/halls.repository';
import { VenuesRepository } from '../db/repositories/venues.repository';
import type { BookingRow, HallRow } from '../db/rows';
import type { CreateBookingBody, ListBookingsQuery, UpdateBookingBody } from './bookings.schemas';

/** Staff can create and view bookings but only owner/manager may cancel (contract §4). */
const CANCEL_ROLES = ['owner', 'manager'] as const;

// KAPAR-BLOCKER: EUR shown in mockups but MKD is legal tender — display currency law
// unresolved (SPEC §10). The default only labels owner-entered offline amounts.
const DEFAULT_KAPAR_CURRENCY = 'EUR';

export function toSummaryDto(row: BookingRow, hallName: string): BookingSummaryDto {
  return {
    id: row.id,
    bookingRef: row.bookingRef,
    customerName: row.customerName,
    eventDate: row.eventDate,
    slot: row.slot,
    status: row.status,
    source: row.source,
    hallId: row.hallId,
    hallName,
    guests: row.guests,
    kaparPaidState: row.kaparPaidState,
  };
}

export function toBookingDto(row: BookingRow, hallName: string): BookingDto {
  return {
    ...toSummaryDto(row, hallName),
    customerPhone: row.customerPhone,
    eventType: row.eventType,
    startTime: row.startTime,
    endTime: row.endTime,
    kaparAmount:
      row.kaparAmountMinor === null
        ? null
        : { minor: row.kaparAmountMinor, currency: row.kaparCurrency },
    kaparReceived:
      row.kaparReceivedMinor === null
        ? null
        : { minor: row.kaparReceivedMinor, currency: row.kaparCurrency },
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Today's date in the venue's calendar terms. M1: server clock date (single-market app). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly hallsRepository: HallsRepository,
    private readonly venuesRepository: VenuesRepository,
  ) {}

  /**
   * B3 Add Reservation. Owner-entered offline bookings are records of already-made
   * agreements → status CONFIRMED immediately. App-source bookings arrive via the couple
   * flow (M3/M4) and are rejected here in M1.
   * SlotTakenError propagates uncaught to the 409 filter — the race loser's path.
   */
  async create(venueId: string, actorUserId: string, body: CreateBookingBody): Promise<BookingDto> {
    if (body.source === 'app') {
      throw new BadRequestException({
        code: 'INVALID_SOURCE',
        message: 'App-source bookings are created through the couple booking flow.',
      });
    }
    const hall = await this.requireHallInVenue(venueId, body.hallId);
    if (body.eventDate < todayISO()) {
      throw new BadRequestException({
        code: 'DATE_IN_PAST',
        message: 'The event date cannot be in the past.',
      });
    }
    const customerPhone = normalizeToE164(body.customerPhone);
    if (customerPhone === null) {
      throw new BadRequestException({
        code: 'INVALID_PHONE',
        message: 'Enter a valid customer phone number.',
      });
    }

    const kaparPaidState = body.kaparPaidState ?? KaparPaidState.No;
    const row = await this.bookingsRepository.createWithClaim(
      {
        venueId,
        hallId: body.hallId,
        eventDate: body.eventDate,
        slot: body.slot ?? FULL_DAY_SLOT,
        status: BookingStatus.Confirmed,
        source: body.source,
        customerName: body.customerName,
        customerPhone,
        guests: body.guests ?? null,
        eventType: body.eventType ?? EventType.Wedding,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        kaparAmountMinor: body.kaparAmount?.minor ?? null,
        kaparReceivedMinor:
          // 'yes' with no explicit received amount means received-in-full.
          body.kaparReceived?.minor ??
          (kaparPaidState === KaparPaidState.Yes ? body.kaparAmount?.minor ?? null : null),
        kaparCurrency: body.kaparAmount?.currency ?? DEFAULT_KAPAR_CURRENCY,
        kaparPaidState,
        notes: body.notes ?? '',
        clientRequestId: body.clientRequestId,
      },
      actorUserId,
    );
    return toBookingDto(row, hall.name);
  }

  /** B5 list — tab/q/source filters. Guard already verified venue membership. */
  async list(venueId: string, query: ListBookingsQuery): Promise<BookingListResponse> {
    const [rows, halls] = await Promise.all([
      this.bookingsRepository.listByVenue(venueId, {
        tab: query.tab,
        q: query.q,
        source: query.source,
      }),
      this.hallsRepository.listByVenue(venueId),
    ]);
    const hallNames = new Map(halls.map((h) => [h.id, h.name]));
    return {
      bookings: rows.map((r) => toSummaryDto(r, hallNames.get(r.hallId) ?? 'Hall')),
    };
  }

  /** :bookingId routes carry no :venueId — membership is resolved via the booking row. */
  async get(bookingId: string, actorUserId: string): Promise<BookingDto> {
    const { row, hall } = await this.requireBookingAccess(bookingId, actorUserId);
    return toBookingDto(row, hall.name);
  }

  async update(bookingId: string, actorUserId: string, body: UpdateBookingBody): Promise<BookingDto> {
    const { row, hall } = await this.requireBookingAccess(bookingId, actorUserId);
    let customerPhone: string | undefined;
    if (body.customerPhone !== undefined) {
      const normalized = normalizeToE164(body.customerPhone);
      if (normalized === null) {
        throw new BadRequestException({
          code: 'INVALID_PHONE',
          message: 'Enter a valid customer phone number.',
        });
      }
      customerPhone = normalized;
    }
    const updated = await this.bookingsRepository.updateEditable(
      row.id,
      {
        guests: body.guests,
        startTime: body.startTime,
        endTime: body.endTime,
        kaparAmountMinor: body.kaparAmount?.minor,
        kaparReceivedMinor: body.kaparReceived?.minor,
        kaparPaidState: body.kaparPaidState,
        notes: body.notes,
        customerName: body.customerName,
        customerPhone,
      },
      actorUserId,
    );
    return toBookingDto(updated, hall.name);
  }

  /** Cancel (owner/manager only): frees the slot in the same transaction. */
  async cancel(bookingId: string, actorUserId: string): Promise<BookingDto> {
    const { row, hall, role } = await this.requireBookingAccess(bookingId, actorUserId);
    if (!CANCEL_ROLES.includes(role as (typeof CANCEL_ROLES)[number])) {
      throw new ForbiddenError('Only owners and managers can cancel bookings.');
    }
    const cancelled = await this.bookingsRepository.cancel(row.id, actorUserId);
    return toBookingDto(cancelled, hall.name);
  }

  private async requireHallInVenue(venueId: string, hallId: string): Promise<HallRow> {
    const hall = await this.hallsRepository.findById(hallId);
    if (hall === null || hall.venueId !== venueId) {
      throw new NotFoundError('Hall not found in this venue');
    }
    return hall;
  }

  /**
   * Owner isolation for booking-scoped routes: load the booking, then require the caller
   * to be a member of ITS venue. Non-members get 403 — proven in
   * owner-isolation.integration.spec.ts.
   */
  private async requireBookingAccess(
    bookingId: string,
    actorUserId: string,
  ): Promise<{ row: BookingRow; hall: HallRow; role: string }> {
    const row = await this.bookingsRepository.findById(bookingId);
    if (row === null) {
      throw new NotFoundError('Booking not found');
    }
    const role = await this.venuesRepository.getMemberRole(row.venueId, actorUserId);
    if (role === null) {
      throw new ForbiddenError('You do not have access to this venue.');
    }
    const hall = await this.hallsRepository.findById(row.hallId);
    return { row, hall: hall ?? ({ name: 'Hall' } as HallRow), role };
  }
}
