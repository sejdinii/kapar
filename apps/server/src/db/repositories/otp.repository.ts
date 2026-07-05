import { Injectable } from '@nestjs/common';
import { pgPool } from '../pool';
import { mapOtpRow, OtpRow } from '../rows';

const OTP_COLUMNS =
  'id, phone_e164, code_hash, salt, attempt_count, locked_until, consumed_at, expires_at, created_at';

@Injectable()
export class OtpRepository {
  /** Sends within the rolling window — drives the 3 / 10 min / number rate limit. */
  async countRecentSends(phoneE164: string, windowMinutes: number): Promise<number> {
    const res = await pgPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM otp_codes
       WHERE phone_e164 = $1 AND created_at > now() - make_interval(mins => $2)`,
      [phoneE164, windowMinutes],
    );
    return Number(res.rows[0]?.count ?? '0');
  }

  /** Oldest send inside the window — lets the service compute an honest retryAfterSeconds. */
  async oldestSendInWindow(phoneE164: string, windowMinutes: number): Promise<Date | null> {
    const res = await pgPool.query<{ created_at: Date }>(
      `SELECT created_at FROM otp_codes
       WHERE phone_e164 = $1 AND created_at > now() - make_interval(mins => $2)
       ORDER BY created_at ASC LIMIT 1`,
      [phoneE164, windowMinutes],
    );
    return res.rows[0]?.created_at ?? null;
  }

  async create(
    phoneE164: string,
    codeHash: string,
    salt: string,
    expiresAt: Date,
  ): Promise<string> {
    const res = await pgPool.query<{ id: string }>(
      `INSERT INTO otp_codes (phone_e164, code_hash, salt, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [phoneE164, codeHash, salt, expiresAt],
    );
    // reason: INSERT ... RETURNING always yields exactly one row.
    return res.rows[0]!.id;
  }

  /** Newest unconsumed, unexpired code for the number (a resend supersedes older codes). */
  async findActive(phoneE164: string): Promise<OtpRow | null> {
    const res = await pgPool.query(
      `SELECT ${OTP_COLUMNS} FROM otp_codes
       WHERE phone_e164 = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [phoneE164],
    );
    return res.rows[0] === undefined ? null : mapOtpRow(res.rows[0]);
  }

  async recordFailedAttempt(id: string, lockedUntil: Date | null): Promise<void> {
    await pgPool.query(
      `UPDATE otp_codes SET attempt_count = attempt_count + 1, locked_until = $2 WHERE id = $1`,
      [id, lockedUntil],
    );
  }

  /** Single-use: consuming supersedes every other outstanding code for the number too. */
  async consume(id: string): Promise<void> {
    await pgPool.query(
      `UPDATE otp_codes SET consumed_at = now()
       WHERE id = $1
          OR (phone_e164 = (SELECT phone_e164 FROM otp_codes WHERE id = $1) AND consumed_at IS NULL)`,
      [id],
    );
  }
}
