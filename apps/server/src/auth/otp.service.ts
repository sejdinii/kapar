import { HttpException, HttpStatus, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { OtpRepository } from '../db/repositories/otp.repository';
import { maskPhone } from '../common/phone';
import { SMS_PROVIDER, SmsProvider } from './sms.provider';

// ── OTP policy constants (CLAUDE.md §4, M1 contract §1) ─────────────────────────────────────
export const OTP_LENGTH = 6;
export const OTP_TTL_MIN = 5;
export const MAX_SENDS_PER_WINDOW = 3;
export const SEND_WINDOW_MIN = 10;
export const MAX_ATTEMPTS = 5;
/** Lockout progression starts at 1 minute and doubles per further failure: 1, 2, 4, … */
export const LOCKOUT_BASE_MIN = 1;
/** Cap so the exponent never grows the lock beyond one hour. */
export const MAX_LOCKOUT_MIN = 60;

const SALT_BYTES = 16;
const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
/** Exclusive upper bound for crypto.randomInt → codes 000000..999999, uniformly. */
const OTP_CODE_UPPER_BOUND = 10 ** OTP_LENGTH;

// ── Pure helpers (unit-tested directly in otp.service.spec.ts) ──────────────────────────────

/** Uniform 6-digit code via CSPRNG (never Math.random), left-padded to keep leading zeros. */
export function generateOtpCode(): string {
  return randomInt(0, OTP_CODE_UPPER_BOUND).toString().padStart(OTP_LENGTH, '0');
}

/** sha256 hex digest of an arbitrary string. Shared with refresh-token hashing. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Codes are stored as sha256(code + per-row salt) — never plaintext (contract §1). */
export function hashOtpCode(code: string, salt: string): string {
  return sha256Hex(code + salt);
}

/** Constant-time comparison of a submitted code against the stored hash. */
export function otpHashMatches(code: string, salt: string, expectedHashHex: string): boolean {
  const actual = Buffer.from(hashOtpCode(code, salt), 'hex');
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

/**
 * Exponential lockout (contract §1: "5 wrong attempts → locked_until; 1, 2, 4… minutes").
 * `failedAttempts` is the count INCLUDING the failure being recorded.
 * Returns 0 (no lock) below the threshold; 1 min on the 5th failure, 2 on the 6th, 4 on the
 * 7th, … capped at MAX_LOCKOUT_MIN.
 */
export function lockoutMinutesAfterFailure(failedAttempts: number): number {
  if (failedAttempts < MAX_ATTEMPTS) {
    return 0;
  }
  const doublings = failedAttempts - MAX_ATTEMPTS;
  return Math.min(LOCKOUT_BASE_MIN * 2 ** doublings, MAX_LOCKOUT_MIN);
}

/** TTL check, exposed pure for tests. A code is dead the instant `now >= expiresAt`. */
export function isOtpExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/**
 * OTP mechanics: issue (rate-limited) and verify (lockout + single-use consume).
 * Phone numbers arriving here are ALREADY normalized E.164 (AuthService normalizes).
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly otpRepository: OtpRepository,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  /**
   * Create and send a fresh code, unless the phone is over the send limit
   * (MAX_SENDS_PER_WINDOW per SEND_WINDOW_MIN). When limited, nothing is created or sent and
   * `retryAfterSeconds` says how long to wait — the endpoint still answers `{ ok: true }`
   * (contract §4), which also avoids turning the limiter into a phone-enumeration oracle.
   */
  async issue(phoneE164: string): Promise<{ retryAfterSeconds?: number }> {
    const recentSends = await this.otpRepository.countRecentSends(phoneE164, SEND_WINDOW_MIN);
    if (recentSends >= MAX_SENDS_PER_WINDOW) {
      const retryAfterSeconds = await this.estimateRetryAfterSeconds(phoneE164);
      this.logger.warn(`OTP send rate-limited for ${maskPhone(phoneE164)}`);
      return { retryAfterSeconds };
    }

    const code = generateOtpCode();
    const salt = randomBytes(SALT_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * MS_PER_MINUTE);
    await this.otpRepository.create(phoneE164, hashOtpCode(code, salt), salt, expiresAt);
    await this.smsProvider.sendOtp(phoneE164, code);
    this.logger.log(`OTP issued for ${maskPhone(phoneE164)}`);
    return {};
  }

  /**
   * Validate a submitted code against the newest active row.
   *  - locked row → 429 OTP_LOCKED with retryAfterSeconds
   *  - wrong code → failed attempt recorded; from the 5th failure on, exponential lock
   *  - right code → consumed (single-use) — a second use of the same code fails
   * Throws on every non-success path; resolves silently on success.
   */
  async verify(phoneE164: string, code: string): Promise<void> {
    const row = await this.otpRepository.findActive(phoneE164);
    if (row === null) {
      throw OtpService.invalidCode();
    }

    const now = new Date();
    if (row.lockedUntil !== null && row.lockedUntil.getTime() > now.getTime()) {
      throw new HttpException(
        {
          code: 'OTP_LOCKED',
          message: 'Too many incorrect attempts. Please wait before trying again.',
          retryAfterSeconds: Math.max(1, Math.ceil((row.lockedUntil.getTime() - now.getTime()) / MS_PER_SECOND)),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // findActive already filters expired rows (contract §3); re-check defensively.
    if (isOtpExpired(row.expiresAt, now)) {
      throw OtpService.invalidCode();
    }

    if (!otpHashMatches(code, row.salt, row.codeHash)) {
      const failedAttempts = row.attemptCount + 1;
      const lockMinutes = lockoutMinutesAfterFailure(failedAttempts);
      const lockedUntil = lockMinutes > 0 ? new Date(now.getTime() + lockMinutes * MS_PER_MINUTE) : null;
      await this.otpRepository.recordFailedAttempt(row.id, lockedUntil);
      this.logger.warn(`OTP verify failed for ${maskPhone(phoneE164)} (attempt ${failedAttempts})`);
      throw OtpService.invalidCode();
    }

    await this.otpRepository.consume(row.id);
  }

  /**
   * Seconds until another send is allowed. The exact value is `oldest send in window + window −
   * now`, but the repository contract (§3) only exposes a count, so we compute a safe upper
   * bound: anchored on the newest active row's createdAt when one exists, else on the worst
   * case for a phone whose newest code has already expired (send was ≥ OTP_TTL_MIN ago).
   * Over-estimating is harmless — the limiter itself re-checks on every send.
   */
  private async estimateRetryAfterSeconds(phoneE164: string): Promise<number> {
    const newestActive = await this.otpRepository.findActive(phoneE164);
    const nowMs = Date.now();
    const anchorMs = newestActive !== null ? newestActive.createdAt.getTime() : nowMs - OTP_TTL_MIN * MS_PER_MINUTE;
    const remainingMs = anchorMs + SEND_WINDOW_MIN * MS_PER_MINUTE - nowMs;
    return Math.max(1, Math.ceil(remainingMs / MS_PER_SECOND));
  }

  /** One uniform failure — never reveal whether a code exists, expired, or simply mismatched. */
  private static invalidCode(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'OTP_INVALID',
      message: 'That code is not valid. Check it and try again, or request a new one.',
    });
  }
}
