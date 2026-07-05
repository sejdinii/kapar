import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { HallDto, VenueDto } from '@kapar/shared-types';
import { VenueMemberRole } from '@kapar/shared-types';
import { isUniqueViolation } from '../db/pool';
import { VenuesRepository } from '../db/repositories/venues.repository';
import type { HallRow } from '../db/rows';
import type { CreateVenueBody } from './venues.schemas';

const SLUG_SUFFIX_BYTES = 3; // 6 hex chars
const SLUG_MAX_BASE_LENGTH = 60;
const SLUG_CREATE_MAX_RETRIES = 3;

/** 'Villa Elegance — Skopje!' → 'villa-elegance-skopje' */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    // reason: \p{Diacritic} strips combining accents after NFD (š→s, ë→e) for URL slugs.
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_BASE_LENGTH);
  return base.length > 0 ? base : 'venue';
}

export function toHallDto(row: HallRow): HallDto {
  return {
    id: row.id,
    name: row.name,
    capacityMin: row.capacityMin,
    capacityMax: row.capacityMax,
  };
}

@Injectable()
export class VenuesService {
  constructor(private readonly venuesRepository: VenuesRepository) {}

  /**
   * Business onboarding (SPEC §2): venue + halls + owner membership, one transaction.
   * Venue starts in 'draft' — visible to its owner immediately, public after admin
   * approval. // KAPAR-BLOCKER: the admin verification queue itself is M5; until then
   * venues remain draft and Couple Mode (M4) will not list them.
   */
  async createVenue(userId: string, body: CreateVenueBody): Promise<VenueDto> {
    const halls = body.halls.map((h) => ({
      name: h.name,
      capacityMin: h.capacityMin ?? 0,
      capacityMax: h.capacityMax,
    }));

    const baseSlug = slugify(body.name);
    let attempt = 0;
    // Slug collisions are resolved by a fresh random suffix; bounded retries.
    // First try the clean slug, then suffixed variants.
    for (;;) {
      const slug =
        attempt === 0
          ? baseSlug
          : `${baseSlug}-${randomBytes(SLUG_SUFFIX_BYTES).toString('hex')}`;
      try {
        const venue = await this.venuesRepository.create(
          { slug, name: body.name, city: body.city, halls },
          userId,
        );
        const hallRows = await this.venuesRepository.listHalls(venue.id);
        return {
          id: venue.id,
          slug: venue.slug,
          name: venue.name,
          city: venue.city,
          status: venue.status,
          myRole: VenueMemberRole.Owner,
          halls: hallRows.map(toHallDto),
        };
      } catch (err) {
        if (isUniqueViolation(err, 'venues_slug_key') && attempt < SLUG_CREATE_MAX_RETRIES) {
          attempt += 1;
          continue;
        }
        throw err;
      }
    }
  }

  /** GET /v1/business/venues — every venue the caller belongs to, with halls and role. */
  async listMyVenues(userId: string): Promise<VenueDto[]> {
    const venues = await this.venuesRepository.listForUser(userId);
    const result: VenueDto[] = [];
    for (const venue of venues) {
      const halls = await this.venuesRepository.listHalls(venue.id);
      result.push({
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        city: venue.city,
        status: venue.status,
        myRole: venue.myRole,
        halls: halls.map(toHallDto),
      });
    }
    return result;
  }
}
