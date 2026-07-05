import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CalendarMonthResponse,
  CreateBlockRequest,
  CreateBlockResponse,
  DaySheetResponse,
} from '@kapar/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireVenueRole } from '../common/decorators/require-venue-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { VenueMemberGuard } from '../common/guards/venue-member.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createBlockSchema,
  dateQuerySchema,
  monthQuerySchema,
  type DateQuery,
  type MonthQuery,
} from './calendar.schemas';
import { CalendarService } from './calendar.service';

/**
 * B2 Calendar + B7 Block Date (M1 contract §4).
 * :venueId routes: JwtAuthGuard → VenueMemberGuard (server-side RBAC on every endpoint).
 * The blockId route has no :venueId — CalendarService resolves and checks membership itself.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('business/venues/:venueId/calendar')
  @UseGuards(VenueMemberGuard)
  monthView(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery,
  ): Promise<CalendarMonthResponse> {
    return this.calendarService.monthView(venueId, query.month);
  }

  @Get('business/venues/:venueId/calendar/day')
  @UseGuards(VenueMemberGuard)
  daySheet(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Query(new ZodValidationPipe(dateQuerySchema)) query: DateQuery,
  ): Promise<DaySheetResponse> {
    return this.calendarService.daySheet(venueId, query.date);
  }

  @Post('business/venues/:venueId/blocks')
  @UseGuards(VenueMemberGuard)
  @RequireVenueRole('owner', 'manager')
  @HttpCode(HttpStatus.CREATED)
  createBlocks(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBlockSchema)) body: CreateBlockRequest,
  ): Promise<CreateBlockResponse> {
    return this.calendarService.createBlocks(venueId, user.userId, body);
  }

  @Delete('business/blocks/:blockId')
  @HttpCode(HttpStatus.OK)
  async deleteBlock(
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.calendarService.deleteBlock(blockId, user.userId);
    return { ok: true };
  }
}
