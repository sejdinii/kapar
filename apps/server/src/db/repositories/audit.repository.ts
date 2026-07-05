import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { getExecutor } from '../pool';

export interface AuditEntry {
  actorUserId: string | null;
  /** e.g. 'booking.create', 'booking.cancel', 'block.create', 'venue.create' */
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/**
 * Append-only audit log (CLAUDE.md §4). This class exposes INSERT only — no update or
 * delete methods exist, and the DB additionally turns UPDATE/DELETE into no-ops (see
 * 001_init.sql rules; behavior proven in db-proof/).
 *
 * Mutating flows MUST pass their transaction client so the audit row commits or rolls
 * back atomically with the change it records.
 */
@Injectable()
export class AuditRepository {
  async append(entry: AuditEntry, client?: PoolClient): Promise<void> {
    await getExecutor(client).query(
      `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, before, after, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.actorUserId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.before === undefined ? null : JSON.stringify(entry.before),
        entry.after === undefined ? null : JSON.stringify(entry.after),
        entry.ip ?? null,
      ],
    );
  }
}
