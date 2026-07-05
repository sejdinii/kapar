import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

/**
 * MeModule — profile of the signed-in user.
 * AuthModule is imported for its exported JwtModule, which JwtAuthGuard needs to verify tokens.
 */
@Module({
  imports: [DbModule, AuthModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
