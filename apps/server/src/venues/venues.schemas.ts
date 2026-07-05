import { z } from 'zod';

const VENUE_NAME_MAX = 120;
const CITY_MAX = 80;
const HALL_NAME_MAX = 80;
const HALLS_MAX = 20;
const CAPACITY_MAX = 5000;

const hallSchema = z
  .object({
    name: z.string().trim().min(1).max(HALL_NAME_MAX),
    capacityMin: z.number().int().min(0).max(CAPACITY_MAX).optional(),
    capacityMax: z.number().int().min(1).max(CAPACITY_MAX),
  })
  .strict()
  .refine((h) => (h.capacityMin ?? 0) <= h.capacityMax, {
    message: 'capacityMin cannot exceed capacityMax',
  });

/** POST /v1/venues — business onboarding, M1 scope (SPEC §2). */
export const createVenueSchema = z
  .object({
    name: z.string().trim().min(1).max(VENUE_NAME_MAX),
    city: z.string().trim().min(1).max(CITY_MAX),
    halls: z.array(hallSchema).min(1).max(HALLS_MAX),
  })
  .strict();

export type CreateVenueBody = z.infer<typeof createVenueSchema>;
