import { z } from 'zod';
import { BookingSource, EventType, KaparPaidState } from '@kapar/shared-types';

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const NAME_MAX = 120;
const PHONE_MAX = 32;
const NOTES_MAX = 2000;
const SEARCH_MAX = 80;
const GUESTS_MAX = 5000;
/** Money guard: minor units, integer, non-negative, bounded to something sane (EUR 1M). */
const AMOUNT_MINOR_MAX = 100_000_000;

const moneySchema = z
  .object({
    minor: z.number().int().min(0).max(AMOUNT_MINOR_MAX),
    currency: z.string().length(3),
  })
  .strict();

/** POST /v1/business/venues/:venueId/bookings — B3 Add Reservation (the 15-second rule). */
export const createBookingSchema = z
  .object({
    hallId: z.string().uuid(),
    eventDate: z.string().regex(DATE_PATTERN, 'Expected YYYY-MM-DD'),
    slot: z.string().min(1).max(40).optional(),
    customerName: z.string().trim().min(1).max(NAME_MAX),
    customerPhone: z.string().trim().min(1).max(PHONE_MAX),
    source: z.nativeEnum(BookingSource),
    guests: z.number().int().min(1).max(GUESTS_MAX).optional(),
    eventType: z.nativeEnum(EventType).optional(),
    startTime: z.string().regex(TIME_PATTERN, 'Expected HH:MM').optional(),
    endTime: z.string().regex(TIME_PATTERN, 'Expected HH:MM').optional(),
    kaparAmount: moneySchema.optional(),
    kaparReceived: moneySchema.optional(),
    kaparPaidState: z.nativeEnum(KaparPaidState).optional(),
    notes: z.string().max(NOTES_MAX).optional(),
    clientRequestId: z.string().uuid(),
  })
  .strict();

/** PATCH /v1/business/bookings/:bookingId — editable fields only (no date/hall in M1). */
export const updateBookingSchema = z
  .object({
    guests: z.number().int().min(1).max(GUESTS_MAX).optional(),
    startTime: z.string().regex(TIME_PATTERN).optional(),
    endTime: z.string().regex(TIME_PATTERN).optional(),
    kaparAmount: moneySchema.optional(),
    kaparReceived: moneySchema.optional(),
    kaparPaidState: z.nativeEnum(KaparPaidState).optional(),
    notes: z.string().max(NOTES_MAX).optional(),
    customerName: z.string().trim().min(1).max(NAME_MAX).optional(),
    customerPhone: z.string().trim().min(1).max(PHONE_MAX).optional(),
  })
  .strict();

/** GET /v1/business/venues/:venueId/bookings?tab=&q=&source= */
export const listBookingsQuerySchema = z
  .object({
    tab: z.enum(['upcoming', 'completed', 'cancelled']).default('upcoming'),
    q: z.string().trim().max(SEARCH_MAX).optional(),
    source: z.nativeEnum(BookingSource).optional(),
  })
  .strict();

export type CreateBookingBody = z.infer<typeof createBookingSchema>;
export type UpdateBookingBody = z.infer<typeof updateBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
