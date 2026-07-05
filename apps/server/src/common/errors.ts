/**
 * Domain errors thrown by the data layer and services (M1-CONTRACT §3).
 *
 * These are transport-agnostic: repositories/services throw them, and the global HTTP
 * exception filter (common/http-exception.filter.ts, owned by another workstream) maps them
 * to the `{ error: { code, message } }` envelope:
 *   SlotTakenError → 409 SLOT_TAKEN (with `holder` payload, see ApiError in @kapar/shared-types)
 *   NotFoundError  → 404 NOT_FOUND
 *   ForbiddenError → 403 FORBIDDEN
 */

/** Error codes are SCREAMING_SNAKE per M1-CONTRACT §1. */
export const SLOT_TAKEN_CODE = 'SLOT_TAKEN';
export const NOT_FOUND_CODE = 'NOT_FOUND';
export const FORBIDDEN_CODE = 'FORBIDDEN';

/**
 * Base class for all domain errors. `code` is the wire-level SCREAMING_SNAKE error code
 * the HTTP filter serializes into the ApiError envelope.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Who currently holds a contested slot. Shape mirrors `ApiError['holder']` in
 * @kapar/shared-types so the filter can pass it through verbatim.
 */
export interface SlotHolder {
  kind: 'booking' | 'block';
  /** Human label, e.g. 'Booking KPR-2026-10001 — Elena & Stefan' or 'Blocked: renovation'. */
  label: string;
}

/**
 * The slot `(hall_id, event_date, slot)` is already claimed by a booking or a block.
 * Thrown by BookingsRepository.createWithClaim and BlocksRepository.createRange when the
 * `slot_claims` unique constraint reports a conflict (SPEC §5, CLAUDE.md §5).
 */
export class SlotTakenError extends DomainError {
  constructor(
    readonly holder: SlotHolder,
    message?: string,
  ) {
    super(SLOT_TAKEN_CODE, message ?? `Slot already taken: ${holder.label}`);
  }
}

/** Requested entity does not exist (or is soft-deleted). Maps to HTTP 404. */
export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found') {
    super(NOT_FOUND_CODE, message);
  }
}

/** Caller is authenticated but not allowed to perform this action. Maps to HTTP 403. */
export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have permission to perform this action') {
    super(FORBIDDEN_CODE, message);
  }
}
