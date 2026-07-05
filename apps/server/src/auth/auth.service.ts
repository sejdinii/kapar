import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import type { AuthTokens, OtpSendResponse, OtpVerifyResponse } from '@kapar/shared-types';
import { UsersRepository } from '../db/repositories/users.repository';
import { RefreshTokensRepository } from '../db/repositories/refresh-tokens.repository';
import type { UserRow } from '../db/rows';
import { maskPhone, normalizeToE164 } from '../common/phone';
import { toMeDto } from '../me/me.service';
import { OtpService, sha256Hex } from './otp.service';

/** Opaque refresh token entropy (contract §1: rotating refresh, stored hashed). */
const REFRESH_TOKEN_BYTES = 48;
/** Refresh tokens live 30 days; every use rotates them (old revoked, new issued). */
const REFRESH_TTL_DAYS = 30;
const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;

/**
 * Phone-OTP auth orchestration (SPEC A0, CLAUDE.md §4).
 * OtpService owns code mechanics; this service owns normalization, the user lifecycle
 * (find-or-create on first verify), and the token pair.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly jwtService: JwtService,
  ) {}

  /** POST /auth/otp/send — normalize, rate-check, create + deliver. */
  async send(phone: string): Promise<OtpSendResponse> {
    const phoneE164 = AuthService.requireValidPhone(phone);
    const issued = await this.otpService.issue(phoneE164);
    if (issued.retryAfterSeconds !== undefined) {
      return { ok: true, retryAfterSeconds: issued.retryAfterSeconds };
    }
    return { ok: true };
  }

  /** POST /auth/otp/verify — validate code, find-or-create the user, issue the token pair. */
  async verify(phone: string, code: string): Promise<OtpVerifyResponse> {
    const phoneE164 = AuthService.requireValidPhone(phone);
    await this.otpService.verify(phoneE164, code);

    const existing = await this.usersRepository.findByPhone(phoneE164);
    const isNewUser = existing === null;
    const user = existing ?? (await this.usersRepository.createWithPhone(phoneE164));
    if (isNewUser) {
      this.logger.log(`New account created for ${maskPhone(phoneE164)}`);
    }

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: toMeDto(user), isNewUser };
  }

  /**
   * POST /auth/refresh — rotation with replay defense.
   * The presented token is revoked and a fresh pair is issued. If a token that was ALREADY
   * rotated out comes back (classic replay: someone replays a stolen old token), every session
   * for that user is revoked and the caller gets 401.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = sha256Hex(refreshToken);
    // findAny (not findValid): revoked rows must come back so a replayed rotated-out token
    // is DETECTABLE rather than indistinguishable from an unknown token.
    const row = await this.refreshTokensRepository.findAny(tokenHash);
    if (row === null) {
      throw AuthService.sessionExpired();
    }
    if (row.revokedAt !== null) {
      // Replay of a rotated-out token → the whole session family is burned.
      this.logger.warn(`Refresh token replay detected for user ${row.userId} — revoking all sessions`);
      await this.refreshTokensRepository.revokeAllForUser(row.userId);
      throw AuthService.sessionExpired();
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw AuthService.sessionExpired();
    }

    const user = await this.usersRepository.findById(row.userId);
    if (user === null) {
      throw AuthService.sessionExpired();
    }

    // Rotate: the old token dies in the same request that mints its successor.
    await this.refreshTokensRepository.revoke(tokenHash);
    return this.issueTokenPair(user);
  }

  /** POST /auth/logout — revoke the presented refresh token. Idempotent by design. */
  async logout(refreshToken: string): Promise<{ ok: true }> {
    await this.refreshTokensRepository.revoke(sha256Hex(refreshToken));
    return { ok: true };
  }

  /** Access JWT ({ sub, roles }, TTL from module config) + opaque rotating refresh token. */
  private async issueTokenPair(user: UserRow): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync({ sub: user.id, roles: user.roles });
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * MS_PER_DAY);
    // Only the sha256 of the token is stored — a DB leak alone cannot mint sessions.
    await this.refreshTokensRepository.create(user.id, sha256Hex(refreshToken), expiresAt);
    return { accessToken, refreshToken };
  }

  private static requireValidPhone(phone: string): string {
    const phoneE164 = normalizeToE164(phone);
    if (phoneE164 === null) {
      // Deliberately no echo of the raw input — nothing PII-shaped goes back or into logs.
      throw new BadRequestException({
        code: 'INVALID_PHONE',
        message: 'Please enter a valid phone number, including the country code if outside North Macedonia.',
      });
    }
    return phoneE164;
  }

  private static sessionExpired(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'UNAUTHENTICATED',
      message: 'Your session has expired. Please sign in again.',
    });
  }
}
