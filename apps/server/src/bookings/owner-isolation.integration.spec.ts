/**
 * Owner isolation (CLAUDE.md §4): owner A must not be able to read or mutate owner B's
 * venue — explicitly tested, as the constitution demands. Exercises the same repository +
 * service paths the guards and controllers use.
 *
 * Requires DATABASE_URL (see race.integration.spec.ts); skips visibly otherwise.
 */
import { randomUUID } from 'node:crypto';
import { ForbiddenError } from '../common/errors';
import { pgPool } from '../db/pool';
import { AuditRepository } from '../db/repositories/audit.repository';
import { BookingsRepository } from '../db/repositories/bookings.repository';
import { HallsRepository } from '../db/repositories/halls.repository';
import { VenuesRepository } from '../db/repositories/venues.repository';
import { BookingsService } from './bookings.service';
import { BookingStatus, EventType, KaparPaidState } from '@kapar/shared-types';

const hasDb = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;
const describeDb = hasDb ? describe : describe.skip;

if (!hasDb) {
  // eslint-disable-next-line no-console
  console.warn('[owner-isolation.integration] DATABASE_URL not set — RBAC isolation test SKIPPED.');
}

describeDb('CLAUDE.md §4 — owner isolation', () => {
  const audit = new AuditRepository();
  const bookingsRepo = new BookingsRepository(audit);
  const venuesRepo = new VenuesRepository(audit);
  const hallsRepo = new HallsRepository();
  const service = new BookingsService(bookingsRepo, hallsRepo, venuesRepo);

  let ownerA: string;
  let ownerB: string;
  let venueA: string;
  let hallA: string;
  let bookingA: string;

  beforeAll(async () => {
    const users = await pgPool.query<{ id: string }>(
      `INSERT INTO users (phone_e164, name, roles)
       VALUES ($1, 'Owner A', '{couple,owner}'), ($2, 'Owner B', '{couple,owner}') RETURNING id`,
      [`+3897A${Date.now() % 1_000_000}`.replace('A', '1'), `+3897B${Date.now() % 1_000_000}`.replace('B', '2')],
    );
    ownerA = users.rows[0]!.id;
    ownerB = users.rows[1]!.id;

    const venue = await venuesRepo.create(
      {
        slug: `venue-a-${randomUUID().slice(0, 8)}`,
        name: 'Venue A',
        city: 'Skopje',
        halls: [{ name: 'Hall A', capacityMin: 0, capacityMax: 300 }],
      },
      ownerA,
    );
    venueA = venue.id;
    const halls = await hallsRepo.listByVenue(venueA);
    hallA = halls[0]!.id;

    const booking = await bookingsRepo.createWithClaim(
      {
        venueId: venueA,
        hallId: hallA,
        eventDate: '2031-11-15',
        slot: 'full_day',
        status: BookingStatus.Confirmed,
        source: 'phone',
        customerName: 'Couple A',
        customerPhone: '+38970999888',
        guests: null,
        eventType: EventType.Wedding,
        startTime: null,
        endTime: null,
        kaparAmountMinor: null,
        kaparReceivedMinor: null,
        kaparCurrency: 'EUR',
        kaparPaidState: KaparPaidState.No,
        notes: '',
        clientRequestId: null,
      },
      ownerA,
    );
    bookingA = booking.id;
  });

  afterAll(async () => {
    await pgPool.query(`DELETE FROM bookings WHERE venue_id = $1`, [venueA]);
    await pgPool.query(`DELETE FROM venues WHERE id = $1`, [venueA]);
    await pgPool.query(`DELETE FROM users WHERE id = ANY($1)`, [[ownerA, ownerB]]);
    await pgPool.end();
  });

  it('owner B has NO role in venue A (the venue_members lookup every guard uses)', async () => {
    expect(await venuesRepo.getMemberRole(venueA, ownerB)).toBeNull();
    expect(await venuesRepo.getMemberRole(venueA, ownerA)).toBe('owner');
  });

  it('owner B cannot READ owner A\'s booking → 403', async () => {
    await expect(service.get(bookingA, ownerB)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('owner B cannot EDIT owner A\'s booking → 403', async () => {
    await expect(service.update(bookingA, ownerB, { notes: 'hijacked' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('owner B cannot CANCEL owner A\'s booking → 403 (and the booking survives)', async () => {
    await expect(service.cancel(bookingA, ownerB)).rejects.toBeInstanceOf(ForbiddenError);
    const survived = await bookingsRepo.findById(bookingA);
    expect(survived?.status).toBe(BookingStatus.Confirmed);
  });

  it('owner B does not see venue A in their venue list', async () => {
    const venuesOfB = await venuesRepo.listForUser(ownerB);
    expect(venuesOfB.find((v) => v.id === venueA)).toBeUndefined();
  });
});
