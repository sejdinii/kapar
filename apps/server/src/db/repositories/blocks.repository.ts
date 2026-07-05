import { Injectable } from '@nestjs/common';
import { NotFoundError, SlotTakenError } from '../../common/errors';
import { pgPool, withTransaction } from '../pool';
import { AuditRepository } from './audit.repository';
import { BlockRow, mapBlockRow } from '../rows';

export interface CreateBlockInput {
  venueId: string;
  hallId: string;
  dateFrom: string; // YYYY-MM-DD inclusive
  dateTo: string;   // YYYY-MM-DD inclusive
  slot: string;
  reason: string;
}

const BLOCK_COLUMNS = 'id, venue_id, hall_id, event_date, slot, reason, created_at';

/** Enumerate calendar dates [from..to] inclusive, as YYYY-MM-DD strings — no TZ math. */
export function enumerateDates(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  // Parse at UTC noon so DST can never shift the calendar date.
  const cursor = new Date(`${dateFrom}T12:00:00Z`);
  const end = new Date(`${dateTo}T12:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

@Injectable()
export class BlocksRepository {
  constructor(private readonly audit: AuditRepository) {}

  /**
   * Range blocking (SPEC B7): one claim + one block row per date, ALL in one transaction.
   * Any conflicting date aborts the whole range with SlotTakenError naming that date —
   * a partial block would lie to the owner about what is off the market.
   */
  async createRange(input: CreateBlockInput, actorUserId: string): Promise<BlockRow[]> {
    const dates = enumerateDates(input.dateFrom, input.dateTo);
    return withTransaction(async (client) => {
      const blocks: BlockRow[] = [];
      for (const date of dates) {
        const claim = await client.query(
          `INSERT INTO slot_claims (hall_id, event_date, slot, venue_id, kind, ref_id)
           VALUES ($1, $2, $3, $4, 'block', gen_random_uuid())
           ON CONFLICT (hall_id, event_date, slot) DO NOTHING
           RETURNING ref_id`,
          [input.hallId, date, input.slot, input.venueId],
        );
        if (claim.rows[0] === undefined) {
          const holderRes = await client.query(
            `SELECT c.kind, b.booking_ref, b.customer_name, bl.reason
             FROM slot_claims c
             LEFT JOIN bookings b         ON c.kind = 'booking' AND b.id = c.ref_id
             LEFT JOIN calendar_blocks bl ON c.kind = 'block'  AND bl.id = c.ref_id
             WHERE c.hall_id = $1 AND c.event_date = $2 AND c.slot = $3`,
            [input.hallId, date, input.slot],
          );
          const row = holderRes.rows[0];
          const holder =
            row?.kind === 'booking'
              ? {
                  kind: 'booking' as const,
                  label: `Booking ${row.booking_ref ?? ''} — ${row.customer_name ?? ''}`.trim(),
                }
              : { kind: 'block' as const, label: row?.reason ? `Blocked: ${row.reason}` : 'Blocked date' };
          throw new SlotTakenError(holder, `${date} is already taken (${holder.label}).`);
        }
        const res = await client.query(
          `INSERT INTO calendar_blocks (id, venue_id, hall_id, event_date, slot, reason, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${BLOCK_COLUMNS}`,
          [claim.rows[0].ref_id, input.venueId, input.hallId, date, input.slot, input.reason, actorUserId],
        );
        blocks.push(mapBlockRow(res.rows[0]));
      }
      await this.audit.append(
        {
          actorUserId,
          action: 'block.create',
          entityType: 'block_range',
          entityId: blocks[0]?.id ?? 'none',
          after: {
            hallId: input.hallId,
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            days: blocks.length,
            reason: input.reason,
          },
        },
        client,
      );
      return blocks;
    });
  }

  async findById(blockId: string): Promise<BlockRow | null> {
    const res = await pgPool.query(
      `SELECT ${BLOCK_COLUMNS} FROM calendar_blocks WHERE id = $1`,
      [blockId],
    );
    return res.rows[0] === undefined ? null : mapBlockRow(res.rows[0]);
  }

  /** Unblock: delete block + its claim + audit — one transaction. */
  async delete(blockId: string, actorUserId: string): Promise<void> {
    await withTransaction(async (client) => {
      const res = await client.query(
        `DELETE FROM calendar_blocks WHERE id = $1 RETURNING ${BLOCK_COLUMNS}`,
        [blockId],
      );
      if (res.rows[0] === undefined) {
        throw new NotFoundError('Block not found');
      }
      const block = mapBlockRow(res.rows[0]);
      await client.query(`DELETE FROM slot_claims WHERE kind = 'block' AND ref_id = $1`, [blockId]);
      await this.audit.append(
        {
          actorUserId,
          action: 'block.delete',
          entityType: 'block',
          entityId: blockId,
          before: { hallId: block.hallId, eventDate: block.eventDate, reason: block.reason },
        },
        client,
      );
    });
  }
}
