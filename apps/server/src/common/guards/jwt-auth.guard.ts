import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Role } from '@kapar/shared-types';

/** The authenticated principal attached to every guarded request. */
export interface AuthenticatedUser {
  userId: string;
  roles: Role[];
}

/** Express request enriched by JwtAuthGuard. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

const BEARER_SCHEME = 'bearer';
const VALID_ROLES: ReadonlySet<string> = new Set<string>(Object.values(Role));

function unauthenticated(): UnauthorizedException {
  // One uniform message — never hint whether the token was missing, malformed, or expired.
  return new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
}

/**
 * Passport-free JWT guard (M1 contract §6): verifies the `Authorization: Bearer <jwt>` access
 * token via JwtService.verifyAsync and attaches `req.user = { userId, roles }`.
 *
 * The guard only authenticates. Authorization (venue membership, roles) is a separate concern —
 * VenueMemberGuard — because RBAC is keyed to `venue_members`, never to the client's mode
 * (CLAUDE.md §4).
 *
 * Modules using this guard must import AuthModule (it exports the configured JwtModule).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const header = request.headers.authorization;
    if (typeof header !== 'string') {
      throw unauthenticated();
    }
    const [scheme, token, ...rest] = header.split(' ');
    if (scheme === undefined || token === undefined || token.length === 0 || rest.length > 0) {
      throw unauthenticated();
    }
    if (scheme.toLowerCase() !== BEARER_SCHEME) {
      throw unauthenticated();
    }

    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token);
    } catch {
      // Signature/expiry details stay server-side; the client just re-authenticates.
      throw unauthenticated();
    }

    const sub = payload['sub'];
    const rawRoles = payload['roles'];
    if (typeof sub !== 'string' || sub.length === 0 || !Array.isArray(rawRoles)) {
      throw unauthenticated();
    }
    const roles = rawRoles.filter((role): role is Role => typeof role === 'string' && VALID_ROLES.has(role));

    request.user = { userId: sub, roles };
    return true;
  }
}
