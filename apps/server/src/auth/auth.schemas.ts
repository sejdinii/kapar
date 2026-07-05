import { z } from 'zod';
import { OTP_LENGTH } from './otp.service';

/** Pre-normalization free-form phone input: '+', digits, spaces, dashes, parens. */
const PHONE_MIN_LENGTH = 6;
const PHONE_MAX_LENGTH = 32;
/** Opaque refresh tokens are 48 random bytes base64url (~64 chars); allow headroom, bound abuse. */
const REFRESH_TOKEN_MAX_LENGTH = 512;

const OTP_CODE_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

const phoneField = z.string().trim().min(PHONE_MIN_LENGTH).max(PHONE_MAX_LENGTH);

const refreshTokenBody = z
  .object({
    refreshToken: z.string().min(1).max(REFRESH_TOKEN_MAX_LENGTH),
  })
  .strict();

/** POST /v1/auth/otp/send */
export const otpSendSchema = z.object({ phone: phoneField }).strict();

/** POST /v1/auth/otp/verify */
export const otpVerifySchema = z
  .object({
    phone: phoneField,
    code: z.string().trim().regex(OTP_CODE_PATTERN, `Code must be exactly ${OTP_LENGTH} digits`),
  })
  .strict();

/** POST /v1/auth/refresh */
export const refreshSchema = refreshTokenBody;

/** POST /v1/auth/logout */
export const logoutSchema = refreshTokenBody;

export type OtpSendBody = z.infer<typeof otpSendSchema>;
export type OtpVerifyBody = z.infer<typeof otpVerifySchema>;
export type RefreshBody = z.infer<typeof refreshSchema>;
export type LogoutBody = z.infer<typeof logoutSchema>;
