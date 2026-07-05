import { Injectable } from '@nestjs/common';
import { pgPool } from '../pool';
import { HallRow, mapHallRow } from '../rows';

export interface CreateHallInput {
  name: string;
  capacityMin: number;
  capacityMax: number;
}

const HALL_COLUMNS = 'id, venue_id, name, capacity_min, capacity_max, archived_at';

@Injectable()
export class HallsRepository {
  async create(venueId: string, input: CreateHallInput): Promise<HallRow> {
    const res = await pgPool.query(
      `INSERT INTO halls (venue_id, name, capacity_min, capacity_max)
       VALUES ($1, $2, $3, $4) RETURNING ${HALL_COLUMNS}`,
      [venueId, input.name, input.capacityMin, input.capacityMax],
    );
    return mapHallRow(res.rows[0]);
  }

  async listByVenue(venueId: string): Promise<HallRow[]> {
    const res = await pgPool.query(
      `SELECT ${HALL_COLUMNS} FROM halls WHERE venue_id = $1 AND archived_at IS NULL ORDER BY created_at ASC`,
      [venueId],
    );
    return res.rows.map(mapHallRow);
  }

  async findById(id: string): Promise<HallRow | null> {
    const res = await pgPool.query(`SELECT ${HALL_COLUMNS} FROM halls WHERE id = $1`, [id]);
    return res.rows[0] === undefined ? null : mapHallRow(res.rows[0]);
  }
}
