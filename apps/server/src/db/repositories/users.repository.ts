import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { Locale, Role } from '@kapar/shared-types';
import { getExecutor, pgPool } from '../pool';
import { mapUserRow, UserRow } from '../rows';

const USER_COLUMNS =
  'id, phone_e164, name, roles, locale, created_at, deleted_at';

@Injectable()
export class UsersRepository {
  async findByPhone(phoneE164: string): Promise<UserRow | null> {
    const res = await pgPool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE phone_e164 = $1 AND deleted_at IS NULL`,
      [phoneE164],
    );
    return res.rows[0] === undefined ? null : mapUserRow(res.rows[0]);
  }

  async findById(id: string): Promise<UserRow | null> {
    const res = await pgPool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return res.rows[0] === undefined ? null : mapUserRow(res.rows[0]);
  }

  async createWithPhone(phoneE164: string): Promise<UserRow> {
    const res = await pgPool.query(
      `INSERT INTO users (phone_e164) VALUES ($1) RETURNING ${USER_COLUMNS}`,
      [phoneE164],
    );
    return mapUserRow(res.rows[0]);
  }

  /** Idempotent: adding a role the user already has is a no-op. */
  async addRole(userId: string, role: Role, client?: PoolClient): Promise<void> {
    await getExecutor(client).query(
      `UPDATE users SET roles = array_append(roles, $2), updated_at = now()
       WHERE id = $1 AND NOT ($2 = ANY(roles))`,
      [userId, role],
    );
  }

  async updateProfile(
    userId: string,
    patch: { name?: string; locale?: Locale },
  ): Promise<UserRow> {
    const res = await pgPool.query(
      `UPDATE users
         SET name = COALESCE($2, name),
             locale = COALESCE($3, locale),
             updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING ${USER_COLUMNS}`,
      [userId, patch.name ?? null, patch.locale ?? null],
    );
    return mapUserRow(res.rows[0]);
  }
}
