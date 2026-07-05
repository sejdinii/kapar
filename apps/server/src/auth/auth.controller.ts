import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type {
  AuthTokens,
  LogoutRequest,
  OtpSendRequest,
  OtpSendResponse,
  OtpVerifyRequest,
  OtpVerifyResponse,
  RefreshRequest,
} from '@kapar/shared-types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { logoutSchema, otpSendSchema, otpVerifySchema, refreshSchema } from './auth.schemas';

/**
 * Public auth endpoints (M1 contract §4; global prefix /v1 is set in main.ts):
 *   POST /v1/auth/otp/send · /v1/auth/otp/verify · /v1/auth/refresh · /v1/auth/logout
 * All bodies are zod-validated before they reach the service layer.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  send(@Body(new ZodValidationPipe(otpSendSchema)) body: OtpSendRequest): Promise<OtpSendResponse> {
    return this.authService.send(body.phone);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body(new ZodValidationPipe(otpVerifySchema)) body: OtpVerifyRequest): Promise<OtpVerifyResponse> {
    return this.authService.verify(body.phone, body.code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshRequest): Promise<AuthTokens> {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body(new ZodValidationPipe(logoutSchema)) body: LogoutRequest): Promise<{ ok: true }> {
    return this.authService.logout(body.refreshToken);
  }
}
