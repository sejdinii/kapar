import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import type { CreateVenueRequest, VenueDto } from '@kapar/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createVenueSchema } from './venues.schemas';
import { VenuesService } from './venues.service';

/**
 * Venue onboarding + listing (M1 contract §4).
 * POST /v1/venues needs only a signed-in user (that's how someone BECOMES an owner);
 * GET /v1/business/venues lists the venues the caller is a member of — the membership
 * filter is the WHERE clause itself, so no VenueMemberGuard is involved here.
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post('venues')
  @HttpCode(HttpStatus.CREATED)
  createVenue(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createVenueSchema)) body: CreateVenueRequest,
  ): Promise<VenueDto> {
    return this.venuesService.createVenue(user.userId, body);
  }

  @Get('business/venues')
  listMyVenues(@CurrentUser() user: AuthenticatedUser): Promise<VenueDto[]> {
    return this.venuesService.listMyVenues(user.userId);
  }
}
