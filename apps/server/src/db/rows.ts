import type {
  BookingSource,
  BookingStatus,
  EventType,
  KaparPaidState,
  Locale,
  Role,
  VenueMemberRole,
  VenueStatus,
} from '@kapar/shared-types';

/**
 * Typed row shapes at the repository boundary (M1-CONTRACT §3).
 * Repositories are the ONLY code that sees snake_case Postgres columns; everything
 * above this layer works with these camelCase rows.
 *
 * pg type notes:
 *  - DATE columns are read as strings (YYYY-MM-DD) — venue-local calendar dates,
 *    deliberately NOT JS Dates (no timezone math on date-only values, SPEC C4).
 *  - bigint columns (money minor units) come back as strings from pg; mappers convert
 *    via Number() — safe far beyond any real kapar amount.
 */

export interface UserRow {
  id: string;
  phoneE164: string;
  name: string | null;
  roles: Role[];
  locale: Locale;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface OtpRow {
  id: string;
  phoneE164: string;
  codeHash: string;
  salt: string;
  attemptCount: number;
  lockedUntil: Date | null;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface RefreshTokenRow {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface VenueRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  status: VenueStatus;
  createdAt: Date;
}

export interface VenueMemberRow {
  venueId: string;
  userId: string;
  role: VenueMemberRole;
}

export interface HallRow {
  id: string;
  venueId: string;
  name: string;
  capacityMin: number;
  capacityMax: number;
  archivedAt: Date | null;
}

export interface BookingRow {
  id: string;
  bookingRef: string;
  venueId: string;
  hallId: string;
  coupleUserId: string | null;
  eventDate: string; // YYYY-MM-DD
  slot: string;
  status: BookingStatus;
  source: BookingSource;
  guests: number | null;
  eventType: EventType;
  startTime: string | null; // HH:MM
  endTime: string | null;
  customerName: string;
  customerPhone: string;
  kaparAmountMinor: number | null;
  kaparReceivedMinor: number | null;
  kaparCurrency: string;
  kaparPaidState: KaparPaidState;
  notes: string;
  clientRequestId: string | null;
  createdAt: Date;
}

export interface BlockRow {
  id: string;
  venueId: string;
  hallId: string;
  eventDate: string; // YYYY-MM-DD
  slot: string;
  reason: string;
  createdAt: Date;
}

// ── mappers ──────────────────────────────────────────────────────────────────────────────────

/** pg returns DATE as string already under our config; guard the Date case defensively. */
function toDateOnly(value: unknown): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    // Interpreted as a calendar date; pg parses DATE at UTC midnight.
    return value.toISOString().slice(0, 10);
  }
  throw new TypeError('Expected a date-only value');
}

/** bigint columns arrive as strings; NULL stays null. */
function toMinor(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

/** TIME columns arrive as 'HH:MM:SS'; the wire format is 'HH:MM'. */
function toHhMm(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value).slice(0, 5);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// reason: pg rows are untyped records; these mappers are the single narrow waist where
// runtime DB values become typed rows. Column names are static strings from our own SQL.

export function mapUserRow(r: any): UserRow {
  return {
    id: r.id,
    phoneE164: r.phone_e164,
    name: r.name,
    roles: r.roles,
    locale: r.locale,
    createdAt: r.created_at,
    deletedAt: r.deleted_at,
  };
}

export function mapOtpRow(r: any): OtpRow {
  return {
    id: r.id,
    phoneE164: r.phone_e164,
    codeHash: r.code_hash,
    salt: r.salt,
    attemptCount: r.attempt_count,
    lockedUntil: r.locked_until,
    consumedAt: r.consumed_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

export function mapRefreshTokenRow(r: any): RefreshTokenRow {
  return {
    tokenHash: r.token_hash,
    userId: r.user_id,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
  };
}

export function mapVenueRow(r: any): VenueRow {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function mapHallRow(r: any): HallRow {
  return {
    id: r.id,
    venueId: r.venue_id,
    name: r.name,
    capacityMin: r.capacity_min,
    capacityMax: r.capacity_max,
    archivedAt: r.archived_at,
  };
}

export function mapBookingRow(r: any): BookingRow {
  return {
    id: r.id,
    bookingRef: r.booking_ref,
    venueId: r.venue_id,
    hallId: r.hall_id,
    coupleUserId: r.couple_user_id,
    eventDate: toDateOnly(r.event_date),
    slot: r.slot,
    status: r.status,
    source: r.source,
    guests: r.guests,
    eventType: r.event_type,
    startTime: toHhMm(r.start_time),
    endTime: toHhMm(r.end_time),
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    kaparAmountMinor: toMinor(r.kapar_amount_minor),
    kaparReceivedMinor: toMinor(r.kapar_received_minor),
    kaparCurrency: r.kapar_currency,
    kaparPaidState: r.kapar_paid_state,
    notes: r.notes,
    clientRequestId: r.client_request_id,
    createdAt: r.created_at,
  };
}

export function mapBlockRow(r: any): BlockRow {
  return {
    id: r.id,
    venueId: r.venue_id,
    hallId: r.hall_id,
    eventDate: toDateOnly(r.event_date),
    slot: r.slot,
    reason: r.reason,
    createdAt: r.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
