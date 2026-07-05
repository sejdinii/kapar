#!/usr/bin/env bash
# SQL-level proof of SPEC §5: N concurrent claims on one (hall_id, event_date, slot)
# must yield exactly one winner. Requires: schema applied, DATABASE_URL set, psql on PATH.
set -euo pipefail

DB="${DATABASE_URL:?set DATABASE_URL}"
RACERS="${RACERS:-20}"
HALL='00000000-0000-0000-0000-0000000000b1'
VENUE='00000000-0000-0000-0000-00000000000a'
OWNER='00000000-0000-0000-0000-000000000001'
DATE='2026-08-15'

psql "$DB" -qtA -v ON_ERROR_STOP=1 <<SQL
INSERT INTO users (id, phone_e164, name, roles) VALUES ('$OWNER','+38970123456','Race Proof Owner','{couple,owner}')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO venues (id, slug, name, city) VALUES ('$VENUE','race-proof-venue','Race Proof Venue','Skopje')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO venue_members (venue_id, user_id, role) VALUES ('$VENUE','$OWNER','owner')
  ON CONFLICT DO NOTHING;
INSERT INTO halls (id, venue_id, name, capacity_max) VALUES ('$HALL','$VENUE','Race Hall',400)
  ON CONFLICT (id) DO NOTHING;
DELETE FROM slot_claims WHERE hall_id='$HALL' AND event_date='$DATE';
UPDATE bookings SET status='CANCELLED_BY_VENUE' WHERE hall_id='$HALL' AND event_date='$DATE'
  AND status IN ('PENDING_PAYMENT','PENDING_VENUE','CONFIRMED');
SQL

for i in $(seq 1 "$RACERS"); do
  psql "$DB" -qtA <<SQL 2>/dev/null &
BEGIN;
WITH claim AS (
  INSERT INTO slot_claims (hall_id, event_date, slot, venue_id, kind, ref_id)
  VALUES ('$HALL','$DATE','full_day','$VENUE','booking',gen_random_uuid())
  ON CONFLICT (hall_id, event_date, slot) DO NOTHING
  RETURNING ref_id
), booked AS (
  INSERT INTO bookings (id, booking_ref, venue_id, hall_id, event_date, slot, status, source,
                        customer_name, customer_phone, created_by_user_id)
  SELECT ref_id, 'KPR-RACE-' || nextval('booking_ref_seq'), '$VENUE', '$HALL',
         '$DATE','full_day','CONFIRMED','phone','Racer $i','+3897000000$i','$OWNER'
  FROM claim RETURNING id
)
INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id)
SELECT '$OWNER','booking.create','booking',id::text FROM booked;
COMMIT;
SQL
done
wait

WINNERS=$(psql "$DB" -qtA -c "SELECT count(*) FROM slot_claims WHERE hall_id='$HALL' AND event_date='$DATE';")
echo "racers: $RACERS, winners: $WINNERS"
if [ "$WINNERS" = "1" ]; then
  echo "RACE PROOF PASSED — exactly one winner"
else
  echo "RACE PROOF FAILED — expected exactly 1 claim, got $WINNERS" >&2
  exit 1
fi
