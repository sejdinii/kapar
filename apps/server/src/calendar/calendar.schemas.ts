import { z } from 'zod';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const REASON_MAX = 300;
/** Range blocking exists for renovations (SPEC B7); a year is the sane ceiling. */
const MAX_RANGE_DAYS = 366;
const MS_PER_DAY = 86_400_000;

export const monthQuerySchema = z.object({ month: z.string().regex(MONTH_PATTERN, 'Expected YYYY-MM') });
export const dateQuerySchema = z.object({ date: z.string().regex(DATE_PATTERN, 'Expected YYYY-MM-DD') });

/** POST /v1/business/venues/:venueId/blocks (B7). Single day = dateFrom === dateTo. */
export const createBlockSchema = z
  .object({
    hallId: z.string().uuid(),
    dateFrom: z.string().regex(DATE_PATTERN, 'Expected YYYY-MM-DD'),
    dateTo: z.string().regex(DATE_PATTERN, 'Expected YYYY-MM-DD'),
    slot: z.string().min(1).max(40).optional(),
    reason: z.string().trim().max(REASON_MAX).optional(),
  })
  .strict()
  .refine((b) => b.dateFrom <= b.dateTo, { message: 'dateFrom must not be after dateTo' })
  .refine(
    (b) =>
      (new Date(`${b.dateTo}T12:00:00Z`).getTime() - new Date(`${b.dateFrom}T12:00:00Z`).getTime()) /
        MS_PER_DAY <
      MAX_RANGE_DAYS,
    { message: `Range cannot exceed ${MAX_RANGE_DAYS} days` },
  );

export type CreateBlockBody = z.infer<typeof createBlockSchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
export type DateQuery = z.infer<typeof dateQuerySchema>;
