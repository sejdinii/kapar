import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from '../guards/jwt-auth.guard';

/**
 * Injects the authenticated principal set by JwtAuthGuard:
 *
 *   @Get() me(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * Throws 401 if used on a route that is not behind JwtAuthGuard (programmer error surfaced
 * safely rather than an undefined deref).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user === undefined) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }
    return request.user;
  },
);
