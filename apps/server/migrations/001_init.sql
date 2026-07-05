-- 001_init.sql — Kapar M1 schema (SPEC §8, CLAUDE.md §4/§5).
-- Conventions: uuid PKs, timestamptz, money in integer minor units + currency, snake_case.
-- Date-only values (event_date) are DATE — venue-local calendar dates, no timezone math (SPEC C4).

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ── users ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164    text NOT NULL UNIQUE,
  name          text,
  roles         text[] NOT NULL DEFAULT '{couple}'
                CHECK (roles <@ ARRAY['couple','owner','staff','admin']::text[]),
  locale        text NOT NULL DEFAULT 'en' CHECK (locale IN ('mk','sq','en')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz  -- soft delete; PII-erasure job anonymizes (SPEC §11)
);

-- ── auth: OTP + refresh tokens (CLAUDE.md §4) ────────────────────────────────────────────────
-- Codes are stored hashed (sha256(code || salt)); 6-digit, 5-min TTL, single-use.
-- Send rate limit (3 / 10 min / phone) = COUNT rows in window. Lockout via locked_until.
CREATE TABLE otp_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164    text NOT NULL,
  code_hash     text NOT NULL,
  salt          text NOT NULL,
  attempt_count int  NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  consumed_at   timestamptz,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_phone_created_idx ON otp_codes (phone_e164, created_at DESC);

-- Opaque refresh tokens, stored hashed, rotated on every use (old row revoked).
CREATE TABLE refresh_tokens (
  token_hash    text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- ── venues & membership (RBAC source of truth) ───────────────────────────────────────────────
CREATE TABLE venues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  city          text NOT NULL,
  geo_lat       double precision,
  geo_lng       double precision,
  about         text NOT NULL DEFAULT '',
  amenities     text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','pending_review','live','suspended')),
  payout_iban   text,  -- masked in ALL UI; change triggers re-verification + notification (M2)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE venue_members (
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('owner','manager','staff')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, user_id)
);
CREATE INDEX venue_members_user_idx ON venue_members (user_id);

CREATE TABLE halls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name          text NOT NULL,
  capacity_min  int NOT NULL DEFAULT 0 CHECK (capacity_min >= 0),
  capacity_max  int NOT NULL CHECK (capacity_max > 0 AND capacity_max >= capacity_min),
  photos        text[] NOT NULL DEFAULT '{}',
  slot_config   jsonb NOT NULL DEFAULT '{"slots": ["full_day"]}',
  archived_at   timestamptz,  -- halls with future bookings are archived, never deleted (SPEC B11)
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX halls_venue_idx ON halls (venue_id);

-- ── pricing (schema now, endpoints M2 — bookings FK needs menu_tiers to exist) ───────────────
CREATE TABLE price_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  hall_id         uuid REFERENCES halls(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('base','season','dow')),
  date_from       date,
  date_to         date,
  base_fee_minor  bigint NOT NULL DEFAULT 0 CHECK (base_fee_minor >= 0),
  kapar_minor     bigint NOT NULL CHECK (kapar_minor >= 0),
  currency        text NOT NULL DEFAULT 'EUR',  -- KAPAR-BLOCKER: EUR vs MKD display law unresolved (SPEC §10)
  event_type      text CHECK (event_type IN ('wedding','engagement','birthday','sunet','other')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE menu_tiers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id                uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  hall_id                 uuid REFERENCES halls(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  price_per_person_minor  bigint NOT NULL CHECK (price_per_person_minor >= 0),
  currency                text NOT NULL DEFAULT 'EUR',
  includes_text           text NOT NULL DEFAULT '',
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── bookings (SPEC §8) ────────────────────────────────────────────────────────────────────────
CREATE TABLE bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref           text NOT NULL UNIQUE,   -- KPR-YYYY-NNNNN, from booking_ref_seq
  venue_id              uuid NOT NULL REFERENCES venues(id),
  hall_id               uuid NOT NULL REFERENCES halls(id),
  couple_user_id        uuid REFERENCES users(id),  -- NULL for offline bookings
  event_date            date NOT NULL,
  slot                  text NOT NULL DEFAULT 'full_day',
  status                text NOT NULL
                        CHECK (status IN ('DRAFT','PENDING_PAYMENT','PENDING_VENUE','CONFIRMED',
                                          'DECLINED','EXPIRED','CANCELLED_BY_COUPLE','CANCELLED_BY_VENUE')),
  source                text NOT NULL DEFAULT 'app'
                        CHECK (source IN ('app','phone','viber','whatsapp','facebook','instagram','walkin','other')),
  guests                int CHECK (guests IS NULL OR guests > 0),
  event_type            text NOT NULL DEFAULT 'wedding'
                        CHECK (event_type IN ('wedding','engagement','birthday','sunet','other')),
  start_time            time,
  end_time              time,
  customer_name         text NOT NULL,
  customer_phone        text NOT NULL,           -- E.164; multiple country codes accepted (SPEC B10)
  kapar_amount_minor    bigint CHECK (kapar_amount_minor IS NULL OR kapar_amount_minor >= 0),
  kapar_received_minor  bigint CHECK (kapar_received_minor IS NULL OR kapar_received_minor >= 0),
  kapar_currency        text NOT NULL DEFAULT 'EUR',
  kapar_paid_state      text NOT NULL DEFAULT 'no' CHECK (kapar_paid_state IN ('yes','partially','no')),
  menu_tier_id          uuid REFERENCES menu_tiers(id),
  estimated_total_minor bigint,
  final_guest_count     int,
  final_price_minor     bigint,
  notes                 text NOT NULL DEFAULT '',
  quote                 jsonb,
  expires_at            timestamptz,             -- PENDING_VENUE confirmation window (M3)
  -- Offline-queue idempotency (SPEC B3): replaying the same queued reservation twice
  -- must not create two bookings. Client-generated UUID, unique when present.
  client_request_id     uuid UNIQUE,
  created_by_user_id    uuid REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
-- SPEC §5 belt-and-suspenders: uniqueness among ACTIVE bookings (cancelled dates are rebookable).
CREATE UNIQUE INDEX bookings_active_slot_uq ON bookings (hall_id, event_date, slot)
  WHERE status IN ('PENDING_PAYMENT','PENDING_VENUE','CONFIRMED');
CREATE INDEX bookings_venue_date_idx ON bookings (venue_id, event_date);
CREATE INDEX bookings_venue_status_idx ON bookings (venue_id, status);

CREATE SEQUENCE booking_ref_seq START 10001;  -- booking_ref = 'KPR-' || year || '-' || nextval

-- ── calendar blocks (B7) ──────────────────────────────────────────────────────────────────────
CREATE TABLE calendar_blocks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  hall_id       uuid NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
  event_date    date NOT NULL,
  slot          text NOT NULL DEFAULT 'full_day',
  reason        text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_blocks_venue_date_idx ON calendar_blocks (venue_id, event_date);

-- ── THE RACE LOCK (SPEC §5, CLAUDE.md §5) ─────────────────────────────────────────────────────
-- Every booking AND every block claims its slot here, in the same transaction as its main row.
-- The UNIQUE constraint makes N concurrent claims yield exactly one winner — deterministically,
-- in the database, regardless of application concurrency. Cancel/unblock deletes the claim.
CREATE TABLE slot_claims (
  hall_id       uuid NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
  event_date    date NOT NULL,
  slot          text NOT NULL,
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('booking','block')),
  ref_id        uuid NOT NULL,   -- bookings.id or calendar_blocks.id
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hall_id, event_date, slot)
);
CREATE INDEX slot_claims_venue_date_idx ON slot_claims (venue_id, event_date);

-- ── audit log (append-only; CLAUDE.md §4) ─────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  action        text NOT NULL,          -- e.g. booking.create, booking.cancel, block.create
  entity_type   text NOT NULL,
  entity_id     text NOT NULL,
  before        jsonb,
  after         jsonb,
  ip            inet,
  at            timestamptz NOT NULL DEFAULT now()
);
-- Append-only is enforced in depth: no UPDATE/DELETE is ever issued by application code
-- (AuditRepository exposes INSERT only), and defense-in-depth at the DB layer:
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;
