/**
 * Kapar domain enums — derived directly from SPEC.md §8 (data model) and §5 (kapar engine).
 * These are the shared contract between the mobile client and the server. Values are the
 * canonical strings persisted in Postgres; do not rename without a migration.
 */

/** Account roles. A single account accrues roles; `roles[]` on the user. (SPEC §2, §8) */
export const Role = {
  Couple: 'couple',
  Owner: 'owner',
  Staff: 'staff',
  Admin: 'admin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Staff-level roles inside a venue — the RBAC source of truth is `venue_members`. (SPEC §7 B11, §11) */
export const VenueMemberRole = {
  Owner: 'owner',
  Manager: 'manager',
  Staff: 'staff',
} as const;
export type VenueMemberRole = (typeof VenueMemberRole)[keyof typeof VenueMemberRole];

/** Supported locales — MK/SQ/EN from day one. (SPEC §4) */
export const Locale = {
  Macedonian: 'mk',
  Albanian: 'sq',
  English: 'en',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

/** Venue lifecycle. Draft venues are visible to their owner immediately, public after approval. (SPEC §2, §8) */
export const VenueStatus = {
  Draft: 'draft',
  PendingReview: 'pending_review',
  Live: 'live',
  Suspended: 'suspended',
} as const;
export type VenueStatus = (typeof VenueStatus)[keyof typeof VenueStatus];

/**
 * The kapar state machine — the backbone. (SPEC §5)
 * Transitions are enforced SERVER-SIDE; the client only renders state.
 *
 *  DRAFT ─pay→ PENDING_PAYMENT ─authorized→ PENDING_VENUE ─accept→ CONFIRMED
 *                                                 ├─decline→ DECLINED
 *                                                 └─window lapses→ EXPIRED
 *  CONFIRMED ─couple cancels→ CANCELLED_BY_COUPLE
 *  CONFIRMED ─venue/owner cancels→ CANCELLED_BY_VENUE (offline bookings in M1;
 *             app bookings are admin-mediated with full refund per SPEC C8)
 */
export const BookingStatus = {
  Draft: 'DRAFT',
  PendingPayment: 'PENDING_PAYMENT',
  PendingVenue: 'PENDING_VENUE',
  Confirmed: 'CONFIRMED',
  Declined: 'DECLINED',
  Expired: 'EXPIRED',
  CancelledByCouple: 'CANCELLED_BY_COUPLE',
  CancelledByVenue: 'CANCELLED_BY_VENUE',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/** Where a booking originated. Powers the B8 "Bookings by Source" analytics. (SPEC §7 B3, §8) */
export const BookingSource = {
  App: 'app',
  Phone: 'phone',
  Viber: 'viber',
  WhatsApp: 'whatsapp',
  Facebook: 'facebook',
  Instagram: 'instagram',
  WalkIn: 'walkin',
  Other: 'other',
} as const;
export type BookingSource = (typeof BookingSource)[keyof typeof BookingSource];

/** Offline kapar-paid state, recorded by the owner in B3 Add Reservation. (SPEC §7 B3) */
export const KaparPaidState = {
  Yes: 'yes',
  Partially: 'partially',
  No: 'no',
} as const;
export type KaparPaidState = (typeof KaparPaidState)[keyof typeof KaparPaidState];

/** Payment lifecycle — mirrors the payments.state enum exactly. B9 state chips read this. (SPEC §7 B9, §8) */
export const PaymentState = {
  Authorized: 'authorized',
  Captured: 'captured',
  Released: 'released',
  Refunded: 'refunded',
  Disputed: 'disputed',
  PaidOut: 'paid_out',
} as const;
export type PaymentState = (typeof PaymentState)[keyof typeof PaymentState];

/** Event types offered at booking. Localized in the MK/SQ catalogs (Sunet/Synet). (SPEC §7 B3, C4) */
export const EventType = {
  Wedding: 'wedding',
  Engagement: 'engagement',
  Birthday: 'birthday',
  SunetCelebration: 'sunet',
  Other: 'other',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

/** Price-rule kinds. (SPEC §8 price_rules) */
export const PriceRuleKind = {
  Base: 'base',
  Season: 'season',
  DayOfWeek: 'dow',
} as const;
export type PriceRuleKind = (typeof PriceRuleKind)[keyof typeof PriceRuleKind];
