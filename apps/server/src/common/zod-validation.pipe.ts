import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** Error code the mobile client keys on for form-level validation failures. */
const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';

/** Keep validation messages bounded — never echo arbitrarily large payloads back. */
const MAX_ISSUES_IN_MESSAGE = 5;

/**
 * Shared request-body validation pipe (M1 contract §1: all input schema-validated server-side).
 *
 * Usage: `@Body(new ZodValidationPipe(createBookingSchema)) body: CreateBookingRequest`.
 *
 * On failure it throws a BadRequestException carrying `{ code, message }`; the global
 * HttpExceptionFilter renders that as the `{ error: { code: 'VALIDATION_FAILED', message } }`
 * envelope. The parsed (and therefore stripped/coerced) value is what reaches the controller —
 * handlers never see unvalidated input.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, MAX_ISSUES_IN_MESSAGE)
        .map((issue) => {
          const path = issue.path.join('.');
          return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
        })
        .join('; ');
      throw new BadRequestException({
        code: VALIDATION_FAILED_CODE,
        message: issues.length > 0 ? issues : 'Invalid request body.',
      });
    }
    return result.data;
  }
}
