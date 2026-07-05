# DB proof — executed against live PostgreSQL 16

`race-proof.sh` is the SQL-level demonstration of the SPEC §5 race rule, run during the M1 build
(2026-07-05) against a real PostgreSQL 16 instance with `migrations/001_init.sql` applied.
It is the same claim pattern `BookingsRepository.createWithClaim` implements in TypeScript;
the Jest integration test (`race.integration.spec.ts`) re-proves it through the application code.

## Executed results

| Proof | Result |
|---|---|
| 20 concurrent transactions claiming one `(hall, date, slot)` | **exactly 1 won** (19 clean losses); 1 `slot_claims` row, 1 `bookings` row, 1 `audit_log` row |
| Cancel booking → claim deleted → slot rebookable | rebook claim succeeded |
| Block attempt on an already-claimed slot | rejected by the same UNIQUE constraint (0 rows) — bookings and blocks can never silently coexist |
| `UPDATE`/`DELETE` on `audit_log` | no-ops (DB rules); rows intact |

Run it yourself against any Postgres with the schema applied:

```bash
DATABASE_URL=postgresql://kapar:kapar@localhost:5432/kapar_dev ./race-proof.sh
```
