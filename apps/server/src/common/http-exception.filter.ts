import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@kapar/shared-types';
// Domain errors are owned by the data layer (M1 contract §3): SlotTakenError carries the
// holder payload for the B3 conflict card; NotFoundError/ForbiddenError are thrown by services.
import { ForbiddenError, NotFoundError, SlotTakenError } from './errors';

/** Default SCREAMING_SNAKE codes per HTTP status when the thrower did not set one. */
const STATUS_DEFAULT_CODES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL',
};
const FALLBACK_CODE = 'HTTP_ERROR';

/** What the client sees for unexpected failures — NEVER the underlying message/stack/SQL. */
const GENERIC_SERVER_ERROR_MESSAGE = 'Something went wrong on our side. Please try again.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHolder(value: unknown): value is NonNullable<ApiError['holder']> {
  return (
    isRecord(value) &&
    (value['kind'] === 'booking' || value['kind'] === 'block') &&
    typeof value['label'] === 'string'
  );
}

/** Copy only the whitelisted ApiError keys — no accidental leakage of extra fields. */
function pickApiError(source: Record<string, unknown>, fallbackMessage: string): ApiError {
  const code = typeof source['code'] === 'string' ? source['code'] : FALLBACK_CODE;
  const message = typeof source['message'] === 'string' ? source['message'] : fallbackMessage;
  const error: ApiError = { code, message };
  if (isHolder(source['holder'])) {
    error.holder = source['holder'];
  }
  if (typeof source['retryAfterSeconds'] === 'number' && Number.isFinite(source['retryAfterSeconds'])) {
    error.retryAfterSeconds = source['retryAfterSeconds'];
  }
  return error;
}

/**
 * Global exception filter — every non-2xx response body is `{ error: ApiError }` (shared-types).
 *
 * Maps, in order:
 *  1. Domain errors: SlotTakenError → 409 SLOT_TAKEN (+holder), NotFoundError → 404,
 *     ForbiddenError → 403.
 *  2. Nest HttpException — honoring `{ code, message, holder?, retryAfterSeconds? }` response
 *     bodies thrown by our own code, or deriving a default code from the status.
 *  3. Anything else → 500 INTERNAL with a generic message. The real error is logged
 *     server-side only; stack traces and SQL never reach the wire (CLAUDE.md §4).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter<unknown> {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, error } = this.toEnvelope(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Full detail stays server-side. (Messages we log may contain SQL/stack — that is fine
      // in server logs; it must never appear in the HTTP response.)
      const detail = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
      this.logger.error(`Unhandled exception (${status} ${error.code}): ${detail}`);
    }

    response.status(status).json({ error });
  }

  private toEnvelope(exception: unknown): { status: number; error: ApiError } {
    if (exception instanceof SlotTakenError) {
      const error: ApiError = {
        code: 'SLOT_TAKEN',
        message: exception.message.length > 0 ? exception.message : 'That date is already taken.',
      };
      if (isHolder(exception.holder)) {
        error.holder = exception.holder;
      }
      return { status: HttpStatus.CONFLICT, error };
    }

    if (exception instanceof NotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        error: { code: 'NOT_FOUND', message: exception.message.length > 0 ? exception.message : 'Not found.' },
      };
    }

    if (exception instanceof ForbiddenError) {
      return {
        status: HttpStatus.FORBIDDEN,
        error: {
          code: 'FORBIDDEN',
          message: exception.message.length > 0 ? exception.message : 'You do not have access to this resource.',
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const defaultCode = STATUS_DEFAULT_CODES[status] ?? FALLBACK_CODE;
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return { status, error: { code: defaultCode, message: body } };
      }
      if (isRecord(body)) {
        // Our convention: throw new HttpException({ code, message, ... }, status).
        if (typeof body['code'] === 'string') {
          return { status, error: pickApiError(body, exception.message) };
        }
        // Already-enveloped: { error: { code, ... } } — pass the inner error through.
        const inner = body['error'];
        if (isRecord(inner) && typeof inner['code'] === 'string') {
          return { status, error: pickApiError(inner, exception.message) };
        }
        // Nest's default shape: { statusCode, message, error } — message may be string[].
        const rawMessage = body['message'];
        const message = Array.isArray(rawMessage)
          ? rawMessage.filter((entry): entry is string => typeof entry === 'string').join('; ')
          : typeof rawMessage === 'string'
            ? rawMessage
            : exception.message;
        return { status, error: { code: defaultCode, message } };
      }
      return { status, error: { code: defaultCode, message: exception.message } };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: { code: 'INTERNAL', message: GENERIC_SERVER_ERROR_MESSAGE },
    };
  }
}
