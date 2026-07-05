import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  BookingDto,
  BookingListResponse,
  CreateBookingRequest,
  UpdateBookingRequest,
} from '@kapar/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { VenueMemberGuard } from '../common/guards/venue-member.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createBookingSchema,
  listBookingsQuerySchema,
  updateBookingSchema,
  type ListBookingsQuery,
} from './bookings.schemas';
import { BookingsService } from './bookings.service';

/**
 * B3 Add Reservation + B5 list + B6 detail subset (M1 contract §4).
 * :venueId routes: JwtAuthGuard → VenueMemberGuard. :bookingId routes: membership is
 * enforced inside BookingsService via the booking's own venue (owner isolation).
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('business/venues/:venueId/bookings')
  @UseGuards(VenueMemberGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBookingSchema)) body: CreateBookingRequest,
  ): Promise<BookingDto> {
    return this.bookingsService.create(venueId, user.userId, body);
  }

  @Get('business/venues/:venueId/bookings')
  @UseGuards(VenueMemberGuard)
  list(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Query(new ZodValidationPipe(listBookingsQuerySchema)) query: ListBookingsQuery,
  ): Promise<BookingListResponse> {
    return this.bookingsService.list(venueId, query);
  }

  @Get('business/bookings/:bookingId')
  get(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BookingDto> {
    return this.bookingsService.get(bookingId, user.userId);
  }

  @Patch('business/bookings/:bookingId')
  update(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateBookingSchema)) body: UpdateBookingRequest,
  ): Promise<BookingDto> {
    return this.bookingsService.update(bookingId, user.userId, body);
  }

  @Post('business/bookings/:bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BookingDto> {
    return this.bookingsService.cancel(bookingId, user.userId);
  }
}
