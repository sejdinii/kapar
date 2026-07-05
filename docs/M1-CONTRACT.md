# M1 Build Contract — Business Core

This document is the **binding contract** for all M1 code. It exists so parallel workstreams
produce one coherent system. When this file and a workstream's instinct disagree, this file wins.
When this file and CLAUDE.md/SPEC.md disagree, CLAUDE.md wins for laws/security, SPEC.md for
screen detail.

## 0. Hard rules (from CLAUDE.md — repeated because they are enforced in review)

1. TypeScript **strict**; no `any` unless commented with a reason; no magic numbers — named consts.
2. Money is integer minor units + currency (`Money` in `@kapar/shared-types`). No float math. The
   client NEVER computes money.
3. RBAC is server-side on every business endpoint, keyed to `venue_members`. Mode is never an
   authorization input.
4. All input schema-validated server-side. Parameterized SQL ONLY (`$1` placeholders — never
   string interpolation into SQL).
5. Every booking/calendar mutation writes an `audit_log` row in the SAME transaction.
6. `// KAPAR-BLOCKER:` comment at every stub that depends on an unverified external fact.
7. Dependencies could NOT be installed in the build environment (registry blocked). Use only
   well-established, stable APIs of the pinned libraries. No exotic imports.

## 1. Server stack decisions (locked)

- **NestJS 10** (already scaffolded), CommonJS build.
- **Data layer: raw SQL via `pg` (Pool)** + hand-written SQL migrations. No ORM — the M1
  invariants (unique slot claim, row locking, append-only audit) are SQL-level and must be
  explicit. Repositories are thin typed classes over `pool.query`.
- **Auth: `@nestjs/jwt`** for access tokens (15 min) + opaque rotating refresh tokens stored
  hashed (sha256) in `refresh_tokens`. OTP codes hashed sha256(code + per-row salt), 6 digits,
  5-min TTL, single-use. Send rate limit: max **3 sends / 10 min / phone** enforced by counting
  rows in `otp_codes`. Verify lockout: **5 wrong attempts → locked until `locked_until`**
  (exponential: 1, 2, 4… minutes, tracked on `otp_codes.attempt_count`).
- **SMS delivery: `SmsProvider` interface + `ConsoleSmsProvider` mock** (logs the code in dev).
  `// KAPAR-BLOCKER:` real SMS/Viber channel for NM is unverified (SPEC A0).
- Validation: **zod** schemas in each module's `*.schemas.ts`, applied by a shared `ZodValidationPipe`
  (`apps/server/src/common/zod-validation.pipe.ts`).
- Errors: throw Nest `HttpException` subclasses; global shape `{ error: { code, message } }` via
  `apps/server/src/common/http-exception.filter.ts`. Error `code` is SCREAMING_SNAKE.

## 2. Database schema (migration `001_init.sql` — already written, do not alter)

Tables (M1): `users`, `otp_codes`, `refresh_tokens`, `venues`, `venue_members`, `halls`,
`price_rules`, `menu_tiers` (schema only in M1), `bookings`, `calendar_blocks`, `slot_claims`,
`audit_log`, `schema_migrations`.

**The race lock:** `slot_claims (venue_id, hall_id, event_date, slot, kind, ref_id)` with
`UNIQUE (hall_id, event_date, slot)`. EVERY booking creation and EVERY block creation inserts a
claim row in the same transaction as its main row. Cancel/unblock deletes the claim. Bookings
additionally carry a partial unique index on active statuses (belt and suspenders, per SPEC §5).
N concurrent attempts on one slot → exactly one winner, by Postgres constraint, not application
hope. `slot` is a text key; M1 uses the single slot **`'full_day'`** (named const `FULL_DAY_SLOT`
in shared-types).

## 3. Repository layer — exact signatures (implementers: match these verbatim)

File: `apps/server/src/db/pool.ts` → `export const pgPool: Pool` configured from `DATABASE_URL`,
plus `export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>`
(BEGIN/COMMIT/ROLLBACK helper).

File: `apps/server/src/db/migrate.ts` → CLI script: applies `apps/server/migrations/*.sql` in
filename order, each in a transaction, recording into `schema_migrations(name, applied_at)`.
Run via `npm run db:migrate --workspace @kapar/server`.

Repositories (each `apps/server/src/db/repositories/<name>.repository.ts`, `@Injectable()`,
constructor takes no args — they import `pgPool`/`withTransaction`; methods accept an optional
`client?: PoolClient` last param to join an outer transaction):

```ts
UsersRepository {
  findByPhone(phoneE164: string): Promise<UserRow | null>
  findById(id: string): Promise<UserRow | null>
  createWithPhone(phoneE164: string): Promise<UserRow>          // roles = ['couple']
  addRole(userId: string, role: Role, client?: PoolClient): Promise<void>
  updateProfile(userId: string, patch: { name?: string; locale?: Locale }): Promise<UserRow>
}
OtpRepository {
  countRecentSends(phoneE164: string, windowMinutes: number): Promise<number>
  create(phoneE164: string, codeHash: string, salt: string, expiresAt: Date): Promise<string> // id
  findActive(phoneE164: string): Promise<OtpRow | null>          // newest unconsumed, unexpired
  recordFailedAttempt(id: string, lockedUntil: Date | null): Promise<void>
  consume(id: string): Promise<void>
}
RefreshTokensRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>
  findValid(tokenHash: string): Promise<RefreshTokenRow | null>
  revoke(tokenHash: string): Promise<void>
  revokeAllForUser(userId: string): Promise<void>
}
VenuesRepository {
  create(input: CreateVenueInput, ownerUserId: string): Promise<VenueRow>  // + owner membership + audit, one tx
  findById(id: string): Promise<VenueRow | null>
  listForUser(userId: string): Promise<VenueRow[]>
  getMemberRole(venueId: string, userId: string): Promise<VenueMemberRole | null>
}
HallsRepository {
  create(venueId: string, input: CreateHallInput): Promise<HallRow>
  listByVenue(venueId: string): Promise<HallRow[]>
  findById(id: string): Promise<HallRow | null>
}
BookingsRepository {
  /** THE race-safe insert. In ONE transaction: insert slot_claims (ON CONFLICT DO NOTHING);
   *  if 0 rows → SELECT the holder, throw SlotTakenError(holder); else insert bookings row,
   *  insert audit_log row, return. */
  createWithClaim(input: CreateBookingInput, actorUserId: string): Promise<BookingRow>
  listByVenue(venueId: string, filter: BookingListFilter): Promise<BookingRow[]>
  findById(id: string): Promise<BookingRow | null>
  updateEditable(id: string, patch: UpdateBookingPatch, actorUserId: string): Promise<BookingRow> // + audit
  cancel(id: string, actorUserId: string): Promise<BookingRow>   // status→CANCELLED, delete claim, audit; one tx
}
BlocksRepository {
  /** Same claim pattern as bookings. Range blocking = one claim+row per date, all in one tx —
   *  if ANY date conflicts, the whole range fails with SlotTakenError for that date. */
  createRange(input: CreateBlockInput, actorUserId: string): Promise<BlockRow[]>
  delete(blockId: string, actorUserId: string): Promise<void>    // + delete claim + audit
  listByVenueMonth(venueId: string, monthISO: string): Promise<BlockRow[]>
}
CalendarRepository {
  /** Month view: per date, per hall → 'available' | 'booked' | 'blocked'. Derived from
   *  slot_claims joined to halls of the venue. monthISO = 'YYYY-MM'. */
  monthView(venueId: string, monthISO: string): Promise<CalendarDay[]>
  daySheet(venueId: string, dateISO: string): Promise<DaySheetEntry[]>
}
AuditRepository {
  append(entry: AuditEntry, client?: PoolClient): Promise<void>  // INSERT only. No update/delete methods exist.
}
```

Row types (`apps/server/src/db/rows.ts`): `UserRow`, `OtpRow`, `RefreshTokenRow`, `VenueRow`,
`VenueMemberRow`, `HallRow`, `BookingRow`, `BlockRow` — snake_case DB columns mapped to camelCase
fields at the repository boundary. Repositories are the ONLY code that sees snake_case.

`SlotTakenError` lives in `apps/server/src/common/errors.ts` and maps to HTTP 409
`SLOT_TAKEN` with `{ holder: { kind: 'booking'|'block', label: string } }` in the filter.

## 4. API endpoints (M1 slice of SPEC §9 — paths verbatim; global prefix `/v1` already set)

Auth (public):
- `POST /v1/auth/otp/send`    body `{ phone }` → `{ ok: true, retryAfterSeconds? }`
- `POST /v1/auth/otp/verify`  body `{ phone, code }` → `{ accessToken, refreshToken, user: MeDto, isNewUser }`
- `POST /v1/auth/refresh`     body `{ refreshToken }` → `{ accessToken, refreshToken }` (rotation: old revoked)
- `POST /v1/auth/logout`      body `{ refreshToken }` → `{ ok: true }`

Me (JwtAuthGuard):
- `GET /v1/me` → `MeDto`   ·   `PATCH /v1/me` body `{ name?, locale? }` → `MeDto`

Business (JwtAuthGuard + VenueMemberGuard; `:venueId` param drives membership lookup):
- `POST   /v1/venues`                                (JwtAuthGuard only) create draft venue + halls → adds `owner` role
- `GET    /v1/business/venues`                       list my venues
- `GET    /v1/business/venues/:venueId/calendar?month=YYYY-MM` → `{ days: CalendarDay[], halls: HallDto[] }`
- `GET    /v1/business/venues/:venueId/calendar/day?date=YYYY-MM-DD` → `{ entries: DaySheetEntry[] }`
- `POST   /v1/business/venues/:venueId/bookings`     Add Reservation (B3) → `BookingDto` (201) | 409 SLOT_TAKEN
- `GET    /v1/business/venues/:venueId/bookings?tab=upcoming|completed|cancelled&q=&source=` → `{ bookings: BookingDto[] }`
- `GET    /v1/business/bookings/:bookingId`          → `BookingDto` (guard resolves venue via booking)
- `PATCH  /v1/business/bookings/:bookingId`          edit notes/guests/times/kapar fields → `BookingDto`
- `POST   /v1/business/bookings/:bookingId/cancel`   → `BookingDto`
- `POST   /v1/business/venues/:venueId/blocks`       body incl. `dateFrom`,`dateTo` → `{ blocks: BlockDto[] }` | 409
- `DELETE /v1/business/blocks/:blockId`              → `{ ok: true }`

Roles: `owner|manager` can do everything above; `staff` can read + create bookings but NOT cancel
bookings, NOT create/delete blocks. Enforced via `@RequireVenueRole(...)` metadata + guard.

## 5. DTO shapes — single source: `packages/shared-types/src/api.ts` (already written; import,
do not redeclare). Includes `MeDto`, `VenueDto`, `HallDto`, `BookingDto`, `BlockDto`,
`CalendarDay`, `DaySheetEntry`, request bodies, and `FULL_DAY_SLOT`.

## 6. Module wiring

Each module folder: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`,
`<name>.schemas.ts` (zod). Modules: `auth`, `me`, `venues` (incl. halls), `calendar` (incl.
blocks), `bookings`. Cross-cutting: `common/` (pipes, filter, errors, guards, decorators),
`db/`. `AppModule` imports all — wired at integration time by the coordinator, not by module
authors. JWT secret/config read from env (`JWT_ACCESS_SECRET`, `ACCESS_TOKEN_TTL`).
`JwtAuthGuard` (Passport-free — verify via `JwtService` directly in a plain Nest guard,
attaches `req.user = { userId, roles }`). `VenueMemberGuard` loads membership and attaches
`req.venueRole`.

## 7. Mobile (Expo) — M1 surface

Deps (already pinned in package.json): `@react-navigation/native@^6`, `native-stack`,
`bottom-tabs`, `@tanstack/react-query@^5`, `@react-native-async-storage/async-storage`,
`expo-secure-store`, `react-native-screens`, `react-native-safe-area-context`.

Structure:
- `src/shared/api/` — `client.ts` (typed fetch wrapper: base URL from `EXPO_PUBLIC_API_URL`,
  attaches access token, ONE in-flight refresh on 401, replays request), `endpoints.ts` (typed
  functions per §4), `queue.ts` (offline mutation queue for Add Reservation: AsyncStorage-backed,
  visible pending badge, replay on reconnect/foreground; conflict on replay surfaces a
  notification card, never silently dropped).
- `src/shared/auth/` — `session.ts` (SecureStore token storage, auth state context).
- `src/shared/design-system/` — tokens (exists) + `components.tsx`: `Button`, `Card`,
  `TextField`, `StatusPill`, `Chip`, `Screen` (safe-area wrapper). 44px min targets,
  accessibilityLabel on every touchable.
- `src/navigation/` — `RootNavigator` (auth gate → onboarding check → BusinessTabs),
  `BusinessTabs` (Dashboard placeholder · Calendar · [+] center FAB → AddReservation modal ·
  Bookings · More).
- Screens under `src/modes/business/screens/` + `src/shared/auth/screens/`:
  `WelcomeScreen` (A0 phone entry), `OtpScreen` (6 boxes, resend cooldown, change number),
  `OnboardingScreen` (venue name/city/halls — minimal M1 wizard), `CalendarScreen` (B2 month
  grid + legend + day sheet bottom half), `AddReservationScreen` (B3 — the 15-second rule:
  couple name + phone required, date prefilled from calendar context, everything else optional,
  one screen, no nested navigation), `BlockDateSheet` (B7), `BookingsScreen` (B5 tabs +
  search), `BookingDetailScreen` (read-only M1 subset of B6), `MoreScreen` (venue name + logout).
- Language: EN strings via the i18n catalog keys (extend `en.json`/`mk.json`/`sq.json` with the
  keys you use; MK/SQ full pass is M2 — leave real EN copy, key-parity placeholder translations).
- **No money computation client-side.** Kapar amount fields are plain integer-minor inputs sent
  to the server.

## 8. Testing (written now, run on the developer's machine — registry blocked here)

- Unit: OTP hashing/lockout math, booking service conflict mapping, offline queue reducer.
- Integration (require `DATABASE_URL`, skip gracefully if absent):
  `race.integration.spec.ts` — **the §5 CI test**: 10 parallel `createWithClaim` on one slot →
  exactly 1 success, 9 `SlotTakenError`, exactly 1 `slot_claims` row.
  `owner-isolation.integration.spec.ts` — owner A token cannot read/mutate owner B's venue
  (403), including bookings and blocks.
- A pure-SQL race proof (`apps/server/db-proof/`) was executed against live Postgres 16 during
  the build — see its README for the transcript.
