import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { MeDto, UpdateMeRequest } from '@kapar/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MeService } from './me.service';
import { updateMeSchema } from './me.schemas';

/**
 * GET /v1/me · PATCH /v1/me (M1 contract §4) — the signed-in user's own profile.
 * No venue RBAC here: the resource IS the caller, scoped by the token's userId only.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeDto> {
    return this.meService.getMe(user.userId);
  }

  @Patch()
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeRequest,
  ): Promise<MeDto> {
    return this.meService.updateMe(user.userId, body);
  }
}
