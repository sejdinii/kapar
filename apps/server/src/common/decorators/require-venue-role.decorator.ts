import { SetMetadata } from '@nestjs/common';
import type { VenueMemberRole } from '@kapar/shared-types';

export const VENUE_ROLES_KEY = 'venueRoles';

/**
 * Restrict a :venueId route to specific venue roles (evaluated by VenueMemberGuard):
 *
 *   @RequireVenueRole('owner', 'manager')   // staff gets 403
 *
 * Without this decorator, VenueMemberGuard admits ANY member of the venue.
 * RBAC is keyed to venue_members — mode is never an authorization input (CLAUDE.md §4).
 */
export const RequireVenueRole = (...roles: VenueMemberRole[]) =>
  SetMetadata(VENUE_ROLES_KEY, roles);
