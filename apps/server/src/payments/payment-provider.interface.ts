import type { Money, PaymentState } from '@kapar/shared-types';

/**
 * PaymentProvider — the seam between Kapar and whatever PSP ends up processing the kapar.
 *
 * WHY THIS EXISTS (CLAUDE.md §7, README):
 * The entire payment + payout architecture depends on facts that were NOT verifiable at spec
 * time — no confirmed source for any North-Macedonia-available PSP's real capabilities. So all
 * payment-dependent UI/logic is built against THIS interface with an in-memory mock, and the
 * real provider is dropped in later without reworking callers.
 *
 * Every method whose feasibility depends on an unverified PSP capability is marked
 * `// KAPAR-BLOCKER:` — do not implement against a real provider until that capability is
 * confirmed in that provider's CURRENT documentation. Do not fabricate provider method names.
 *
 * INVARIANTS (CLAUDE.md Laws #3, §4):
 *  - Money is server-computed from stored price rules. Amounts here come from a quote the
 *    server issued; the client never supplies an amount.
 *  - Raw card numbers NEVER reach our servers (PCI-DSS SAQ-A). The provider hosts card fields
 *    and returns a token; we persist only token + brand + last4 + expiry.
 *  - Every mutating call carries an idempotency key — network retries must never double-charge.
 */
export interface PaymentProvider {
  /**
   * Create a payment intent for a kapar from an already-issued server quote.
   * Returns a client secret the app hands to the provider's hosted sheet — nothing more.
   *
   * KAPAR-BLOCKER §5/§10: authorize-then-capture is the PREFERRED flow (funds authorized now,
   * captured only when the venue accepts). If the chosen PSP lacks auth/capture, the fallback is
   * immediate capture + automated refund on decline/expiry, and UX copy changes.
   * `capabilities.authThenCapture` below encodes which mode this provider actually supports.
   */
  createIntent(input: CreateIntentInput): Promise<PaymentIntentResult>;

  /**
   * Capture a previously authorized intent (venue accepted in time → CONFIRMED).
   * No-op-safe if the provider only does immediate capture (fallback mode).
   */
  capture(intentRef: string, idempotencyKey: string): Promise<PaymentMutationResult>;

  /**
   * Release/void an authorization without charging (venue declined or window lapsed, and the
   * provider supports auth/capture so nothing was captured yet).
   */
  release(intentRef: string, idempotencyKey: string): Promise<PaymentMutationResult>;

  /**
   * Refund a captured payment (couple cancels per policy, or fallback-mode decline/expiry).
   * `amount` omitted → full refund.
   */
  refund(intentRef: string, idempotencyKey: string, amount?: Money): Promise<PaymentMutationResult>;

  /**
   * Verify the signature of an inbound provider webhook. NEVER trust an unsigned/forged event.
   * (SPEC §11, CLAUDE.md §4.) Returns the parsed event only if the signature is valid.
   */
  verifyAndParseWebhook(rawBody: Buffer, signatureHeader: string): PspWebhookEvent;

  /** Human-readable capabilities of THIS provider. Callers branch on these instead of guessing. */
  readonly capabilities: ProviderCapabilities;

  // ── Capability-gated methods (present only when the real PSP supports them) ──────────────

  /**
   * KAPAR-BLOCKER §7 (C13b saved cards): tokenize a card into a reusable customer-vault token.
   * Requires the PSP to support tokenization / a customer vault — UNVERIFIED for any NM PSP.
   * If unsupported, `capabilities.tokenization` is false and saved cards do not ship.
   */
  tokenizeCard?(input: TokenizeCardInput): Promise<SavedCardToken>;

  /**
   * KAPAR-BLOCKER §7 (B9 automatic payouts): schedule a split payout to a venue's IBAN,
   * net of commission. Requires PSP marketplace split-payout / scheduled-disbursement support —
   * UNVERIFIED. If unsupported, `capabilities.splitPayouts` is false and payouts are MANUAL.
   */
  schedulePayout?(input: SchedulePayoutInput): Promise<PayoutResult>;
}

/** What a concrete provider can actually do. All default to the conservative `false`. */
export interface ProviderCapabilities {
  /** authorize-then-capture supported? If false, use capture+auto-refund fallback (§5). */
  readonly authThenCapture: boolean;
  /** card tokenization / customer vault (gates C13b saved cards). */
  readonly tokenization: boolean;
  /** marketplace split payouts / scheduled disbursement (gates B9 automatic payouts). */
  readonly splitPayouts: boolean;
  /** 3-D Secure / SCA supported in the hosted sheet. */
  readonly threeDSecure: boolean;
  /** wallet methods actually chargeable for NM merchants — never show a dead method. */
  readonly wallets: ReadonlyArray<'apple_pay' | 'google_pay' | 'paypal'>;
}

export interface CreateIntentInput {
  /** The server-issued quote this charge is bound to. Amount is derived from it, not the client. */
  readonly quoteId: string;
  readonly bookingId: string;
  readonly amount: Money;
  readonly idempotencyKey: string;
  /** Reuse a vaulted card (one-tap) — only valid when capabilities.tokenization is true. */
  readonly savedCardToken?: string;
}

export interface PaymentIntentResult {
  readonly intentRef: string;
  /** Opaque secret for the client's hosted sheet. The raw PAN never comes back to us. */
  readonly clientSecret: string;
  readonly state: PaymentState;
}

export interface PaymentMutationResult {
  readonly intentRef: string;
  readonly state: PaymentState;
}

export interface TokenizeCardInput {
  readonly userId: string;
  /** Opaque handle produced by the provider's hosted fields — NOT a card number. */
  readonly providerCardHandle: string;
}

export interface SavedCardToken {
  readonly token: string;
  readonly brand: string;
  readonly last4: string;
  readonly expMonth: number;
  readonly expYear: number;
}

export interface SchedulePayoutInput {
  readonly venueId: string;
  readonly amount: Money;
  readonly commission: Money;
  /** Masked in all UI; full IBAN lives encrypted at rest. */
  readonly payoutIban: string;
  readonly idempotencyKey: string;
}

export interface PayoutResult {
  readonly payoutRef: string;
  readonly scheduledFor: string; // ISO date
  readonly state: PaymentState;
}

/** Normalized shape of a verified provider webhook. */
export interface PspWebhookEvent {
  readonly type: string;
  readonly intentRef: string;
  readonly state: PaymentState;
  readonly raw: unknown;
}

/** DI token for injecting the active PaymentProvider. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
