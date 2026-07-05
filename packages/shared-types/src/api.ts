import type { BookingSource, BookingStatus, EventType, KaparPaidState, Locale, Role, VenueMemberRole, VenueStatus } from './enums';
import type { Money } from './money';

/**
 * API DTOs — the single wire contract between the mobile client and the server (M1 slice).
 * Server serializes EXACTLY these shapes; the client consumes them without recomputation.
 * Dates: `YYYY-MM-DD` strings (venue-local calendar dates — no timezone math, SPEC C4).
 * Times: `HH:MM` 24h strings. Timestamps: ISO 8601 UTC.
 */

/** M1 uses a single slot per hall per day. Slot model widens in later milestones. */
export const FULL_DAY_SLOT = 'full_day';

// ── Auth ────────────────────────────────────────────────────────────────────────────────────

export interface OtpSendRequest {
  /** Any-format phone; server normalizes to E.164 and validates. */
  phone: string;
}
export interface OtpSendResponse {
  ok: true;
  /** Present when rate-limited — seconds until another send is allowed. */
  retryAfterSeconds?: number;
}

export interface OtpVerifyRequest {
  phone: string;
  code: string;
}
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
export interface OtpVerifyResponse extends AuthTokens {
  user: MeDto;
  isNewUser: boolean;
}

export interface RefreshRequest {
  refreshToken: string;
}
export interface LogoutRequest {
  refreshToken: string;
}

// ── Me ──────────────────────────────────────────────────────────────────────────────────────

export interface MeDto {
  id: string;
  phone: string;
  name: string | null;
  roles: Role[];
  locale: Locale;
}
export interface UpdateMeRequest {
  name?: string;
  locale?: Locale;
}

// ── Venues & halls ──────────────────────────────────────────────────────────────────────────

export interface CreateVenueRequest {
  name: string;
  city: string;
  halls: CreateHallRequest[];
}
export interface CreateHallRequest {
  name: string;
  capacityMin?: number;
  capacityMax: number;
}
export interface VenueDto {
  id: string;
  slug: string;
  name: string;
  city: string;
  status: VenueStatus;
  /** The caller's role in this venue — drives which actions the client SHOWS
   *  (authorization itself is always server-side; CLAUDE.md §4). */
  myRole: VenueMemberRole;
  halls: HallDto[];
}
export interface HallDto {
  id: string;
  name: string;
  capacityMin: number;
  capacityMax: number;
}

// ── Calendar (B2) ───────────────────────────────────────────────────────────────────────────

export type DayHallState = 'available' | 'booked' | 'blocked';

export interface CalendarDayHall {
  hallId: string;
  state: DayHallState;
}
export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  halls: CalendarDayHall[];
}
export interface CalendarMonthResponse {
  month: string; // YYYY-MM
  days: CalendarDay[];
  halls: HallDto[];
}

export interface DaySheetEntry {
  hallId: string;
  hallName: string;
  slot: string;
  state: DayHallState;
  /** Present when state is 'booked' */
  booking?: BookingSummaryDto;
  /** Present when state is 'blocked' */
  block?: BlockDto;
}
export interface DaySheetResponse {
  date: string;
  entries: DaySheetEntry[];
}

// ── Bookings (B3 / B5 / B6 subset) ──────────────────────────────────────────────────────────

export interface CreateBookingRequest {
  hallId: string;
  eventDate: string; // YYYY-MM-DD
  slot?: string; // defaults to FULL_DAY_SLOT
  customerName: string;
  customerPhone: string;
  source: BookingSource;
  guests?: number;
  eventType?: EventType;
  startTime?: string; // HH:MM
  endTime?: string;
  kaparAmount?: Money;
  kaparReceived?: Money;
  kaparPaidState?: KaparPaidState;
  notes?: string;
  /** Client-generated UUID for offline-queue idempotency: replaying the same
   *  queued reservation twice must not create two bookings. */
  clientRequestId: string;
}

export interface BookingSummaryDto {
  id: string;
  bookingRef: string;
  customerName: string;
  eventDate: string;
  slot: string;
  status: BookingStatus;
  source: BookingSource;
  hallId: string;
  hallName: string;
  guests: number | null;
  kaparPaidState: KaparPaidState;
}

export interface BookingDto extends BookingSummaryDto {
  customerPhone: string;
  eventType: EventType;
  startTime: string | null;
  endTime: string | null;
  kaparAmount: Money | null;
  kaparReceived: Money | null;
  notes: string;
  createdAt: string; // ISO timestamp
}

export interface UpdateBookingRequest {
  guests?: number;
  startTime?: string;
  endTime?: string;
  kaparAmount?: Money;
  kaparReceived?: Money;
  kaparPaidState?: KaparPaidState;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
}

export type BookingListTab = 'upcoming' | 'completed' | 'cancelled';
export interface BookingListResponse {
  bookings: BookingSummaryDto[];
}

// ── Blocks (B7) ─────────────────────────────────────────────────────────────────────────────

export interface CreateBlockRequest {
  hallId: string;
  dateFrom: string; // YYYY-MM-DD (single day: dateFrom === dateTo)
  dateTo: string;
  slot?: string;
  reason?: string;
}
export interface BlockDto {
  id: string;
  hallId: string;
  eventDate: string;
  slot: string;
  reason: string;
}
export interface CreateBlockResponse {
  blocks: BlockDto[];
}

// ── Errors ──────────────────────────────────────────────────────────────────────────────────

/** Global error envelope: every non-2xx response body is { error: ApiError }. */
export interface ApiError {
  code: string; // SCREAMING_SNAKE, e.g. SLOT_TAKEN, OTP_RATE_LIMITED, FORBIDDEN
  message: string;
  /** SLOT_TAKEN carries who holds the slot so B3 can show the conflict card (SPEC B3). */
  holder?: { kind: 'booking' | 'block'; label: string };
  retryAfterSeconds?: number;
}
