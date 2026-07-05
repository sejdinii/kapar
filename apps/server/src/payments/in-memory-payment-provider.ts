import { Injectable, Logger } from '@nestjs/common';
import { PaymentState, type Money } from '@kapar/shared-types';
import type {
  CreateIntentInput,
  PaymentIntentResult,
  PaymentMutationResult,
  PaymentProvider,
  PayoutResult,
  ProviderCapabilities,
  PspWebhookEvent,
  SavedCardToken,
  SchedulePayoutInput,
  TokenizeCardInput,
} from './payment-provider.interface';

/**
 * In-memory mock PaymentProvider — the ONLY implementation until a real PSP is verified.
 *
 * KAPAR-BLOCKER (CLAUDE.md §7): every method here fakes a plausible result so that M1–M3 can
 * build and test the full booking/kapar flow end-to-end WITHOUT a real payment integration.
 * No money moves. Do not point this at production. Replace with a real provider only after the
 * §7/§10 [VERIFY] items are confirmed against that provider's current docs.
 *
 * The mock deliberately advertises a CONSERVATIVE capability set (auth/capture on; tokenization
 * and split payouts OFF) so callers exercise the fallback paths the real NM PSP may force on us.
 * Flip these in tests to exercise the optimistic paths.
 */
@Injectable()
export class InMemoryPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(InMemoryPaymentProvider.name);
  private seq = 0;

  /** intentRef → current state, so capture/refund/release behave like a tiny state machine. */
  private readonly intents = new Map<string, PaymentState>();

  readonly capabilities: ProviderCapabilities = {
    authThenCapture: true,
    tokenization: false, // KAPAR-BLOCKER: no verified NM PSP vault → saved cards (C13b) OFF by default
    splitPayouts: false, // KAPAR-BLOCKER: no verified split payout → B9 payouts are MANUAL by default
    threeDSecure: false, // KAPAR-BLOCKER: 3DS support unverified
    wallets: [], // never advertise a wallet the PSP can't actually charge
  };

  async createIntent(input: CreateIntentInput): Promise<PaymentIntentResult> {
    const intentRef = this.nextRef('pi');
    // Auth-then-capture mode: funds are "authorized", not yet captured.
    this.intents.set(intentRef, PaymentState.Authorized);
    this.logger.debug(
      `[MOCK] createIntent booking=${input.bookingId} quote=${input.quoteId} amount=${fmt(input.amount)}`,
    );
    return {
      intentRef,
      clientSecret: `mock_secret_${intentRef}`,
      state: PaymentState.Authorized,
    };
  }

  async capture(intentRef: string, _idempotencyKey: string): Promise<PaymentMutationResult> {
    this.intents.set(intentRef, PaymentState.Captured);
    return { intentRef, state: PaymentState.Captured };
  }

  async release(intentRef: string, _idempotencyKey: string): Promise<PaymentMutationResult> {
    this.intents.set(intentRef, PaymentState.Released);
    return { intentRef, state: PaymentState.Released };
  }

  async refund(
    intentRef: string,
    _idempotencyKey: string,
    _amount?: Money,
  ): Promise<PaymentMutationResult> {
    this.intents.set(intentRef, PaymentState.Refunded);
    return { intentRef, state: PaymentState.Refunded };
  }

  verifyAndParseWebhook(rawBody: Buffer, _signatureHeader: string): PspWebhookEvent {
    // KAPAR-BLOCKER: a real provider verifies an HMAC signature here and REJECTS forgeries.
    // The mock trusts its own emitted payload for local testing only.
    const parsed = JSON.parse(rawBody.toString('utf8')) as {
      type: string;
      intentRef: string;
      state: PaymentState;
    };
    return { type: parsed.type, intentRef: parsed.intentRef, state: parsed.state, raw: parsed };
  }

  // Capability-gated methods are present but guard on the (false) capability flags above.

  async tokenizeCard(_input: TokenizeCardInput): Promise<SavedCardToken> {
    // KAPAR-BLOCKER §7 (C13b): unreachable while capabilities.tokenization is false.
    throw new Error('KAPAR-BLOCKER: card tokenization is not available in the mock provider');
  }

  async schedulePayout(_input: SchedulePayoutInput): Promise<PayoutResult> {
    // KAPAR-BLOCKER §7 (B9): unreachable while capabilities.splitPayouts is false.
    throw new Error('KAPAR-BLOCKER: split payouts are not available in the mock provider');
  }

  private nextRef(prefix: string): string {
    this.seq += 1;
    return `${prefix}_mock_${this.seq}`;
  }
}

function fmt(m: Money): string {
  return `${(m.minor / 100).toFixed(2)} ${m.currency}`;
}
