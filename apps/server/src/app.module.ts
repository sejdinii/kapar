import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { VenuesModule } from './venues/venues.module';
import { CalendarModule } from './calendar/calendar.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

/**
 * Root module — M1 wiring (Business core).
 *
 * Milestone map (CLAUDE.md §9):
 *   M1 (this): DbModule, AuthModule, MeModule, VenuesModule, CalendarModule, BookingsModule.
 *   M2: dashboard KPIs, price rules, customers, staff invites, localization.
 *   M3: quotes, kapar state machine, PaymentsModule gains the real PSP behind the seam.
 *
 * PaymentsModule stays mock-backed (CLAUDE.md §7) — wired so the seam exists from day one.
 * The global HttpExceptionFilter renders every error as the { error: ApiError } envelope
 * (never a stack trace, never SQL).
 */
@Module({
  imports: [
    DbModule,
    AuthModule,
    MeModule,
    VenuesModule,
    CalendarModule,
    BookingsModule,
    PaymentsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
