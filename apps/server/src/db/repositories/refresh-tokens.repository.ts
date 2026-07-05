import { Injectable } from '@nestjs/common';
import { pgPool } from '../pool';
import { mapRefreshTokenRow, RefreshTokenRow } from '../rows';

@Injectable()
export class RefreshTokensRepository {
  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await pgPool.query(
      `INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
      [tokenHash, userId, expiresAt],
    );
  }

  /** Valid = exists, unexpired, unrevoked. */
  async findValid(tokenHash: string): Promise<RefreshTokenRow | null> {
    const res = await pgPool.query(
      `SELECT token_hash, user_id, expires_at, revoked_at FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    return res.rows[0] === undefined ? null : mapRefreshTokenRow(res.rows[0]);
  }

  /** Any row for this hash — revoked or expired included. Used for reuse (replay) detection. */
  async findAny(tokenHash: string): Promise<RefreshTokenRow | null> {
    const res = await pgPool.query(
      `SELECT token_hash, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    return res.rows[0] === undefined ? null : mapRefreshTokenRow(res.rows[0]);
  }

  async revoke(tokenHash: string): Promise<void> {
    await pgPool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  /** Nuclear option — token-reuse detected or explicit "log out everywhere". */
  async revokeAllForUser(userId: string): Promise<void> {
    await pgPool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }
}
