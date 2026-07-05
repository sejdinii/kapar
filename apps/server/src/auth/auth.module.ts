import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DbModule } from '../db/db.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { ConsoleSmsProvider, SMS_PROVIDER } from './sms.provider';

/** Access tokens are short-lived (≤15 min, CLAUDE.md §4); overridable via ACCESS_TOKEN_TTL. */
const DEFAULT_ACCESS_TOKEN_TTL = '15m';

/**
 * AuthModule — phone-OTP auth (SPEC A0).
 *
 * JwtModule is configured here from env and RE-EXPORTED so any module that mounts JwtAuthGuard
 * (me, venues, calendar, bookings) can verify tokens by importing AuthModule.
 *
 * JWT_ACCESS_SECRET is required — the server refuses to boot without it rather than falling
 * back to a hardcoded secret (CLAUDE.md §4: secrets live in a vault, never in the repo).
 */
@Module({
  imports: [
    DbModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (secret === undefined || secret.length === 0) {
          throw new Error('JWT_ACCESS_SECRET is not set. Refusing to start with an insecure default.');
        }
        const accessTokenTtl = process.env.ACCESS_TOKEN_TTL ?? DEFAULT_ACCESS_TOKEN_TTL;
        return { secret, signOptions: { expiresIn: accessTokenTtl } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider }],
  exports: [JwtModule],
})
export class AuthModule {}
