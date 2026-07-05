import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [VenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
