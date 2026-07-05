import { z } from 'zod';
import { Locale } from '@kapar/shared-types';

/** Display names are short human names, not documents. */
const NAME_MAX_LENGTH = 120;

/** PATCH /v1/me — both fields optional; unknown keys rejected. */
export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(NAME_MAX_LENGTH).optional(),
    locale: z.nativeEnum(Locale).optional(),
  })
  .strict();

export type UpdateMeBody = z.infer<typeof updateMeSchema>;
