import { Module } from '@nestjs/common';
import { AuditRepository } from './repositories/audit.repository';
import { BlocksRepository } from './repositories/blocks.repository';
import { BookingsRepository } from './repositories/bookings.repository';
import { CalendarRepository } from './repositories/calendar.repository';
import { HallsRepository } from './repositories/halls.repository';
import { OtpRepository } from './repositories/otp.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { UsersRepository } from './repositories/users.repository';
import { VenuesRepository } from './repositories/venues.repository';

const REPOSITORIES = [
  AuditRepository,
  BlocksRepository,
  BookingsRepository,
  CalendarRepository,
  HallsRepository,
  OtpRepository,
  RefreshTokensRepository,
  UsersRepository,
  VenuesRepository,
];

/** The data layer — thin typed repositories over raw SQL (M1-CONTRACT §1). */
@Module({
  providers: REPOSITORIES,
  exports: REPOSITORIES,
})
export class DbModule {}
