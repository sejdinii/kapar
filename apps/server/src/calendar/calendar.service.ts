import { Injectable } from '@nestjs/common';
import type {
  BlockDto,
  CalendarMonthResponse,
  CreateBlockResponse,
  DaySheetResponse,
} from '@kapar/shared-types';
import { FULL_DAY_SLOT } from '@kapar/shared-types';
import { ForbiddenError, NotFoundError } from '../common/errors';
import { BlocksRepository } from '../db/repositories/blocks.repository';
import { CalendarRepository } from '../db/repositories/calendar.repository';
import { HallsRepository } from '../db/repositories/halls.repository';
import { VenuesRepository } from '../db/repositories/venues.repository';
import type { BlockRow } from '../db/rows';
import { toHallDto } from '../venues/venues.service';
import type { CreateBlockBody } from './calendar.schemas';

/** Roles allowed to take inventory off the market (contract §4: staff cannot block). */
const BLOCK_MANAGING_ROLES = ['owner', 'manager'] as const;

function toBlockDto(row: BlockRow): BlockDto {
  return {
    id: row.id,
    hallId: row.hallId,
    eventDate: row.eventDate,
    slot: row.slot,
    reason: row.reason,
  };
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly blocksRepository: BlocksRepository,
    private readonly hallsRepository: HallsRepository,
    private readonly venuesRepository: VenuesRepository,
  ) {}

  /** B2 month grid — the same slot_claims object every mutation writes (Law #1). */
  async monthView(venueId: string, month: string): Promise<CalendarMonthResponse> {
    const [days, halls] = await Promise.all([
      this.calendarRepository.monthView(venueId, month),
      this.hallsRepository.listByVenue(venueId),
    ]);
    return { month, days, halls: halls.map(toHallDto) };
  }

  /** B2 day sheet. */
  async daySheet(venueId: string, date: string): Promise<DaySheetResponse> {
    const entries = await this.calendarRepository.daySheet(venueId, date);
    return { date, entries };
  }

  /**
   * B7 Block Date — range = one claim per date, all-or-nothing (a partial block would
   * lie about what is off the market). Membership/role already enforced by
   * VenueMemberGuard + @RequireVenueRole on the route; hall ownership re-checked here.
   */
  async createBlocks(
    venueId: string,
    actorUserId: string,
    body: CreateBlockBody,
  ): Promise<CreateBlockResponse> {
    const hall = await this.hallsRepository.findById(body.hallId);
    if (hall === null || hall.venueId !== venueId) {
      throw new NotFoundError('Hall not found in this venue');
    }
    const blocks = await this.blocksRepository.createRange(
      {
        venueId,
        hallId: body.hallId,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        slot: body.slot ?? FULL_DAY_SLOT,
        reason: body.reason ?? '',
      },
      actorUserId,
    );
    return { blocks: blocks.map(toBlockDto) };
  }

  /**
   * DELETE /v1/business/blocks/:blockId — no :venueId in the route, so membership is
   * resolved from the block row itself and checked explicitly here (contract §4).
   */
  async deleteBlock(blockId: string, actorUserId: string): Promise<void> {
    const block = await this.blocksRepository.findById(blockId);
    if (block === null) {
      throw new NotFoundError('Block not found');
    }
    const role = await this.venuesRepository.getMemberRole(block.venueId, actorUserId);
    if (role === null || !BLOCK_MANAGING_ROLES.includes(role as (typeof BLOCK_MANAGING_ROLES)[number])) {
      throw new ForbiddenError('You do not have access to this venue.');
    }
    await this.blocksRepository.delete(blockId, actorUserId);
  }
}
