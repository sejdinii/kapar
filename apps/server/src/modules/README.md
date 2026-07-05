# Feature modules

One NestJS module per bounded context. Added as milestones land (CLAUDE.md §9) — this folder
is intentionally empty at scaffold time so no feature code ships ahead of its milestone.

**M1 — Business core** (build first):

| Module | Screens | Notes |
|---|---|---|
| `auth` | A0 | Phone-OTP send/verify, rate limits, JWT (≤15 min) + rotating refresh |
| `venues` | onboarding, B11 | Create/manage venue, `venue_members` (RBAC source of truth) |
| `halls` | B2, B11 | Name + capacity, slot config |
| `calendar` | B2, B7 | The single source of truth; day sheet; Block Date |
| `bookings` | B3, B5 | Add Reservation (all sources, offline queue); **race-condition test** (§5) |

**M2+:** `dashboard`, `price-rules`, `menu-tiers`, `quotes`, `customers`, `staff`, `analytics`,
`requests`, `payments` (real provider), `messaging`, `support`, `admin`.

Cross-cutting: `../rbac` (server-side authorization), `../payments` (the PaymentProvider seam),
`../db` (schema + migrations), an append-only `audit` log for booking & payment mutations.
