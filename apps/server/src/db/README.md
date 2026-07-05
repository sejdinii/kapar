# Database — PostgreSQL

Schema and migrations for the data model in **SPEC §8**. Tables:

`users` · `venue_members` · `venues` · `halls` · `price_rules` · `menu_tiers` · `bookings` ·
`payments` · `threads` / `messages` · `favorites` · `audit_log`.

**Hard constraints that carry product laws into the database:**

- `bookings`: **`UNIQUE(hall_id, event_date, slot)`** — the booking-race lock (SPEC §5).
  N simultaneous requests for one slot must yield exactly one `PENDING_VENUE`, under
  transactional row locking. This is a **mandatory CI integration test**, not a hope.
- `payments`: `idempotency_key UNIQUE` — network retries never double-charge.
- `audit_log`: **append-only** (actor, action, entity, before/after, ip, at) for every booking
  and payment mutation.
- All money stored in **integer minor units** + currency; never floats, never client-computed.
- PII encrypted at rest, excluded from logs; deletion anonymizes and retains financial records.

ORM/migration tool is chosen when M1 `db` work starts (candidates: Prisma, Drizzle, TypeORM,
Kysely). Empty until then.
