import { Injectable } from '@nestjs/common';
import type { VenueMemberRole } from '@kapar/shared-types';
import { pgPool, withTransaction } from '../pool';
import { AuditRepository } from './audit.repository';
import { HallRow, mapHallRow, mapVenueRow, VenueRow } from '../rows';

export interface CreateVenueInput {
  slug: string;
  name: string;
  city: string;
  halls: Array<{ name: string; capacityMin: number; capacityMax: number }>;
}

const VENUE_COLUMNS = 'id, slug, name, city, status, created_at';
const HALL_COLUMNS = 'id, venue_id, name, capacity_min, capacity_max, archived_at';

@Injectable()
export class VenuesRepository {
  constructor(private readonly audit: AuditRepository) {}

  /**
   * Venue + owner membership + halls + owner role + audit row — ONE transaction.
   * A venue can never exist without an owner member (SPEC §2 onboarding).
   */
  async create(input: CreateVenueInput, ownerUserId: string): Promise<VenueRow> {
    return withTransaction(async (client) => {
      const venueRes = await client.query(
        `INSERT INTO venues (slug, name, city) VALUES ($1, $2, $3) RETURNING ${VENUE_COLUMNS}`,
        [input.slug, input.name, input.city],
      );
      const venue = mapVenueRow(venueRes.rows[0]);

      await client.query(
        `INSERT INTO venue_members (venue_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [venue.id, ownerUserId],
      );
      await client.query(
        `UPDATE users SET roles = array_append(roles, 'owner'), updated_at = now()
         WHERE id = $1 AND NOT ('owner' = ANY(roles))`,
        [ownerUserId],
      );
      for (const hall of input.halls) {
        await client.query(
          `INSERT INTO halls (venue_id, name, capacity_min, capacity_max) VALUES ($1, $2, $3, $4)`,
          [venue.id, hall.name, hall.capacityMin, hall.capacityMax],
        );
      }
      await this.audit.append(
        {
          actorUserId: ownerUserId,
          action: 'venue.create',
          entityType: 'venue',
          entityId: venue.id,
          after: { name: input.name, city: input.city, halls: input.halls.length },
        },
        client,
      );
      return venue;
    });
  }

  async findById(id: string): Promise<VenueRow | null> {
    const res = await pgPool.query(`SELECT ${VENUE_COLUMNS} FROM venues WHERE id = $1`, [id]);
    return res.rows[0] === undefined ? null : mapVenueRow(res.rows[0]);
  }

  async listForUser(userId: string): Promise<Array<VenueRow & { myRole: VenueMemberRole }>> {
    const res = await pgPool.query(
      `SELECT v.id, v.slug, v.name, v.city, v.status, v.created_at, m.role AS my_role
       FROM venues v JOIN venue_members m ON m.venue_id = v.id
       WHERE m.user_id = $1
       ORDER BY v.created_at ASC`,
      [userId],
    );
    return res.rows.map((r) => ({ ...mapVenueRow(r), myRole: r.my_role as VenueMemberRole }));
  }

  /** THE RBAC lookup (CLAUDE.md §4) — null means "not a member": always 403. */
  async getMemberRole(venueId: string, userId: string): Promise<VenueMemberRole | null> {
    const res = await pgPool.query<{ role: VenueMemberRole }>(
      `SELECT role FROM venue_members WHERE venue_id = $1 AND user_id = $2`,
      [venueId, userId],
    );
    return res.rows[0]?.role ?? null;
  }

  async listHalls(venueId: string): Promise<HallRow[]> {
    const res = await pgPool.query(
      `SELECT ${HALL_COLUMNS} FROM halls WHERE venue_id = $1 AND archived_at IS NULL ORDER BY created_at ASC`,
      [venueId],
    );
    return res.rows.map(mapHallRow);
  }
}
