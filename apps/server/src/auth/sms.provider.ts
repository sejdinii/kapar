import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../common/phone';

/**
 * Delivery seam for OTP codes (M1 contract §1). AuthModule binds SMS_PROVIDER to the console
 * mock; a real transport later replaces the binding without touching any caller.
 */
export interface SmsProvider {
  sendOtp(phoneE164: string, code: string): Promise<void>;
}

/** DI token — inject with `@Inject(SMS_PROVIDER)`. */
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/**
 * Dev-only provider: "delivers" the code to the server console.
 *
 * // KAPAR-BLOCKER: real SMS/Viber channel for NM unverified (SPEC A0)
 * Channel availability, sender-ID rules, and cost for North Macedonia (and Viber fallback)
 * were not verifiable at build time. Do not wire a real gateway until its current docs are
 * confirmed; then implement SmsProvider and swap the AuthModule binding.
 *
 * Logging rules (assignment + CLAUDE.md §4): the OTP code appears ONLY at debug level, and the
 * phone number is masked even there — full numbers are PII and stay out of logs.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async sendOtp(phoneE164: string, code: string): Promise<void> {
    // Debug level only — production log levels exclude this line entirely.
    this.logger.debug(`OTP for ${maskPhone(phoneE164)}: ${code}`);
  }
}
