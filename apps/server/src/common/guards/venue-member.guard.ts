import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { VenueMemberRole } from '@kapar/shared-types';
import { VenuesRepository } from '../../db/repositories/venues.repository';
import { VENUE_ROLES_KEY } from '../decorators/require-venue-role.decorator';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/** Request enriched with the caller's role in the venue being accessed. */
export type VenueScopedRequest = AuthenticatedRequest & { venueRole?: VenueMemberRole };

function forbidden(): ForbiddenException {
  // Uniform response whether the venue doesn't exist or the caller isn't a member —
  // membership checks must not become a venue-enumeration oracle.
  return new ForbiddenException({
    code: 'FORBIDDEN',
    message: 'You do not have access to this venue.',
  });
}

/**
 * Server-side venue RBAC (CLAUDE.md §4). Mount AFTER JwtAuthGuard on routes carrying a
 * :venueId param. Loads the caller's role from venue_members — the single source of truth —
 * and enforces @RequireVenueRole metadata when present (any member otherwise).
 *
 * Owner isolation follows directly: a non-member (owner A on owner B's venue) has no
 * venue_members row → always 403. Proven in owner-isolation.integration.spec.ts.
 */
@Injectable()
export class VenueMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly venuesRepository: VenuesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<VenueScopedRequest>();
    const user = request.user;
    if (user === undefined) {
      // Programmer error (guard order); fail closed.
      throw forbidden();
    }
    const venueId = request.params['venueId'];
    if (typeof venueId !== 'string' || venueId.length === 0) {
      throw forbidden();
    }

    const role = await this.venuesRepository.getMemberRole(venueId, user.userId);
    if (role === null) {
      throw forbidden();
    }

    const required = this.reflector.getAllAndOverride<VenueMemberRole[] | undefined>(
      VENUE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required !== undefined && required.length > 0 && !required.includes(role)) {
      throw forbidden();
    }

    request.venueRole = role;
    return true;
  }
}
