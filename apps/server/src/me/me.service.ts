import { Injectable, NotFoundException } from '@nestjs/common';
import type { MeDto, UpdateMeRequest, Locale } from '@kapar/shared-types';
import { UsersRepository } from '../db/repositories/users.repository';
import type { UserRow } from '../db/rows';

/**
 * Single mapping from the users row to the wire shape (shared-types MeDto).
 * Exported because AuthService returns the same DTO from /auth/otp/verify.
 */
export function toMeDto(row: UserRow): MeDto {
  return {
    id: row.id,
    phone: row.phoneE164,
    name: row.name,
    roles: row.roles,
    locale: row.locale,
  };
}

@Injectable()
export class MeService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getMe(userId: string): Promise<MeDto> {
    const row = await this.usersRepository.findById(userId);
    if (row === null) {
      // Token is valid but the account is gone (deleted). Treated as not-found, not a 500.
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Account not found.' });
    }
    return toMeDto(row);
  }

  async updateMe(userId: string, body: UpdateMeRequest): Promise<MeDto> {
    const patch: { name?: string; locale?: Locale } = {};
    if (body.name !== undefined) {
      patch.name = body.name;
    }
    if (body.locale !== undefined) {
      patch.locale = body.locale;
    }
    // Nothing to change → just return the current profile (no pointless UPDATE).
    if (patch.name === undefined && patch.locale === undefined) {
      return this.getMe(userId);
    }
    const row = await this.usersRepository.updateProfile(userId, patch);
    return toMeDto(row);
  }
}
