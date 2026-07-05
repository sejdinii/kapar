/**
 * THE SPEC §5 CI TEST — the booking race condition.
 *
 * N simultaneous createWithClaim calls on one (hall_id, event_date, slot) must yield
 * EXACTLY one winner; every loser gets SlotTakenError. Also proves clientRequestId
 * idempotency: replaying the winner's request returns the SAME booking, not a duplicate.
 *
 * Requires a real Postgres with migrations applied:
 *   DATABASE_URL=postgresql://... npm run db:migrate --workspace @kapar/server
 *   DATABASE_URL=postgresql://... npm test --workspace @kapar/server
 * Skips (with a visible reason) when DATABASE_URL is unset — the race cannot be proven
 * against a mock, so this test never fakes a pass.
 */
import { randomUUID } from 'node:crypto';
import { BookingStatus, EventType, KaparPaidState } from '@kapar/shared-types';
import { SlotTakenError } from '../common/errors';
import { pgPool } from '../db/pool';
import { AuditRepository } from '../db/repositories/audit.repository';
import { BookingsRepository, CreateBookingInput } from '../db/repositories/bookings.repository';

const RACERS = 10;
const EVENT_DATE = '2031-08-16';
const SLOT = 'full_day';

const hasDb = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;
const describeDb = hasDb ? describe : describe.skip;

if (!hasDb) {
  // eslint-disable-next-line no-console
  console.warn('[race.integration] DATABASE_URL not set — SPEC §5 race test SKIPPED (not proven).');
}

describeDb('SPEC §5 — booking race condition', () => {
  const repo = new BookingsRepository(new AuditRepository());
  let venueId: string;
  let hallId: string;
  let ownerId: string;

  const input = (overrides: Partial<CreateBookingInput> = {}): CreateBookingInput => ({
    venueId,
    hallId,
    eventDate: EVENT_DATE,
    slot: SLOT,
    status: BookingStatus.Confirmed,
    source: 'phone',
    customerName: 'Race Test Couple',
    customerPhone: '+38970111222',
    guests: 250,
    eventType: EventType.Wedding,
    startTime: '17:00',
    endTime: '01:00',
    kaparAmountMinor: 50_000,
    kaparReceivedMinor: null,
    kaparCurrency: 'EUR',
    kaparPaidState: KaparPaidState.No,
    notes: '',
    clientRequestId: null,
    ...overrides,
  });

  beforeAll(async () => {
    const user = await pgPool.query<{ id: string }>(
      `INSERT INTO users (phone_e164, name, roles) VALUES ($1, 'Race Owner', '{couple,owner}') RETURNING id`,
      [`+3897${Date.now() % 10_000_000}`],
    );
    ownerId = user.rows[0]!.id;
    const venue = await pgPool.query<{ id: string }>(
      `INSERT INTO venues (slug, name, city) VALUES ($1, 'Race Venue', 'Skopje') RETURNING id`,
      [`race-venue-${randomUUID().slice(0, 8)}`],
    );
    venueId = venue.rows[0]!.id;
    await pgPool.query(`INSERT INTO venue_members (venue_id, user_id, role) VALUES ($1, $2, 'owner')`, [
      venueId,
      ownerId,
    ]);
    const hall = await pgPool.query<{ id: string }>(
      `INSERT INTO halls (venue_id, name, capacity_max) VALUES ($1, 'Race Hall', 400) RETURNING id`,
      [venueId],
    );
    hallId = hall.rows[0]!.id;
  });

  afterAll(async () => {
    // Venue cascade removes halls/members/claims; bookings carry no cascade → clean explicitly.
    await pgPool.query(`DELETE FROM bookings WHERE venue_id = $1`, [venueId]);
    await pgPool.query(`DELETE FROM venues WHERE id = $1`, [venueId]);
    await pgPool.query(`DELETE FROM users WHERE id = $1`, [ownerId]);
    await pgPool.end();
  });

  it(`${RACERS} concurrent requests on one slot → exactly one PENDING/CONFIRMED booking`, async () => {
    const results = await Promise.allSettled(
      Array.from({ length: RACERS }, (_, i) =>
        repo.createWithClaim(
          input({ customerName: `Racer ${i}`, clientRequestId: randomUUID() }),
          ownerId,
        ),
      ),
    );

    const winners = results.filter((r) => r.status === 'fulfilled');
    const losers = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(RACERS - 1);
    for (const loser of losers) {
      expect(loser.reason).toBeInstanceOf(SlotTakenError);
      // The conflict card payload names the current holder (SPEC B3).
      expect((loser.reason as SlotTakenError).holder.label.length).toBeGreaterThan(0);
    }

    const claims = await pgPool.query(
      `SELECT count(*)::int AS n FROM slot_claims WHERE hall_id = $1 AND event_date = $2 AND slot = $3`,
      [hallId, EVENT_DATE, SLOT],
    );
    expect(claims.rows[0].n).toBe(1);

    const bookings = await pgPool.query(
      `SELECT count(*)::int AS n FROM bookings WHERE hall_id = $1 AND event_date = $2 AND slot = $3
       AND status IN ('PENDING_PAYMENT','PENDING_VENUE','CONFIRMED')`,
      [hallId, EVENT_DATE, SLOT],
    );
    expect(bookings.rows[0].n).toBe(1);
  });

  it('replaying the same clientRequestId returns the SAME booking (offline-queue idempotency)', async () => {
    const clientRequestId = randomUUID();
    const first = await repo.createWithClaim(
      input({ eventDate: '2031-09-20', clientRequestId }),
      ownerId,
    );
    const replay = await repo.createWithClaim(
      input({ eventDate: '2031-09-20', clientRequestId }),
      ownerId,
    );
    expect(replay.id).toBe(first.id);
    expect(replay.bookingRef).toBe(first.bookingRef);

    const count = await pgPool.query(
      `SELECT count(*)::int AS n FROM bookings WHERE client_request_id = $1`,
      [clientRequestId],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('cancelling the winner frees the slot for a new booking', async () => {
    const cancelDate = '2031-10-25';
    const first = await repo.createWithClaim(
      input({ eventDate: cancelDate, clientRequestId: randomUUID() }),
      ownerId,
    );
    await repo.cancel(first.id, ownerId);
    const rebooked = await repo.createWithClaim(
      input({ eventDate: cancelDate, customerName: 'Second Couple', clientRequestId: randomUUID() }),
      ownerId,
    );
    expect(rebooked.id).not.toBe(first.id);
  });
});
