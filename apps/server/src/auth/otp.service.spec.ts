import { HttpException, HttpStatus } from '@nestjs/common';
import type { OtpRepository } from '../db/repositories/otp.repository';
import type { SmsProvider } from './sms.provider';
import {
  generateOtpCode,
  hashOtpCode,
  isOtpExpired,
  lockoutMinutesAfterFailure,
  MAX_ATTEMPTS,
  MAX_LOCKOUT_MIN,
  MAX_SENDS_PER_WINDOW,
  otpHashMatches,
  OTP_LENGTH,
  OTP_TTL_MIN,
  OtpService,
  SEND_WINDOW_MIN,
  sha256Hex,
} from './otp.service';

const PHONE = '+38970123456';
const CODE = '123456';
const SALT = 'a1b2c3d4e5f60708';
const NOW_MS = new Date('2026-07-05T12:00:00.000Z').getTime();
const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1_000;

/**
 * Structural mirror of the fields OtpService reads from OtpRow (db/rows.ts). Kept local so the
 * pure-logic unit tests do not compile-couple to the repository workstream's row file.
 */
interface TestOtpRow {
  id: string;
  phoneE164: string;
  codeHash: string;
  salt: string;
  attemptCount: number;
  lockedUntil: Date | null;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

function otpRow(overrides: Partial<TestOtpRow> = {}): TestOtpRow {
  return {
    id: 'otp-row-1',
    phoneE164: PHONE,
    codeHash: hashOtpCode(CODE, SALT),
    salt: SALT,
    attemptCount: 0,
    lockedUntil: null,
    consumedAt: null,
    expiresAt: new Date(NOW_MS + OTP_TTL_MIN * MS_PER_MINUTE),
    createdAt: new Date(NOW_MS),
    ...overrides,
  };
}

function makeMocks() {
  const repository = {
    countRecentSends: jest.fn(),
    create: jest.fn(),
    findActive: jest.fn(),
    recordFailedAttempt: jest.fn(),
    consume: jest.fn(),
  };
  repository.countRecentSends.mockResolvedValue(0);
  repository.create.mockResolvedValue('otp-row-1');
  repository.findActive.mockResolvedValue(null);
  repository.recordFailedAttempt.mockResolvedValue(undefined);
  repository.consume.mockResolvedValue(undefined);

  const sms = { sendOtp: jest.fn().mockResolvedValue(undefined) };
  // reason: the mock is structurally complete for every method OtpService calls; the double
  // cast exists only because jest mocks do not carry the class's nominal type.
  const service = new OtpService(repository as unknown as OtpRepository, sms as SmsProvider);
  return { repository, sms, service };
}

async function expectHttpError(promise: Promise<unknown>, status: number, code: string): Promise<HttpException> {
  let caught: unknown = null;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(HttpException);
  const exception = caught as HttpException;
  expect(exception.getStatus()).toBe(status);
  const body = exception.getResponse() as Record<string, unknown>;
  expect(body['code']).toBe(code);
  return exception;
}

describe('OTP hashing', () => {
  it('roundtrips: the stored hash matches the original code + salt', () => {
    const hash = hashOtpCode(CODE, SALT);
    expect(otpHashMatches(CODE, SALT, hash)).toBe(true);
  });

  it('rejects a wrong code', () => {
    const hash = hashOtpCode(CODE, SALT);
    expect(otpHashMatches('654321', SALT, hash)).toBe(false);
  });

  it('is salt-sensitive: same code with a different salt produces a different hash', () => {
    expect(hashOtpCode(CODE, SALT)).not.toBe(hashOtpCode(CODE, 'differentsalt'));
  });

  it('rejects a tampered/truncated stored hash without throwing', () => {
    expect(otpHashMatches(CODE, SALT, 'deadbeef')).toBe(false);
  });

  it('sha256Hex is deterministic hex output', () => {
    expect(sha256Hex('kapar')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('kapar')).toBe(sha256Hex('kapar'));
  });
});

describe('generateOtpCode', () => {
  it('always yields exactly OTP_LENGTH digits (leading zeros preserved)', () => {
    const pattern = new RegExp(`^\\d{${OTP_LENGTH}}$`);
    const SAMPLES = 200;
    for (let i = 0; i < SAMPLES; i += 1) {
      expect(generateOtpCode()).toMatch(pattern);
    }
  });
});

describe('lockoutMinutesAfterFailure — exponential progression', () => {
  it('does not lock before the threshold', () => {
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      expect(lockoutMinutesAfterFailure(attempt)).toBe(0);
    }
  });

  it('locks 1, 2, 4, 8 minutes on the 5th, 6th, 7th, 8th failures', () => {
    expect(lockoutMinutesAfterFailure(MAX_ATTEMPTS)).toBe(1);
    expect(lockoutMinutesAfterFailure(MAX_ATTEMPTS + 1)).toBe(2);
    expect(lockoutMinutesAfterFailure(MAX_ATTEMPTS + 2)).toBe(4);
    expect(lockoutMinutesAfterFailure(MAX_ATTEMPTS + 3)).toBe(8);
  });

  it('caps at MAX_LOCKOUT_MIN instead of growing unbounded', () => {
    const FAR_PAST_THRESHOLD = MAX_ATTEMPTS + 20;
    expect(lockoutMinutesAfterFailure(FAR_PAST_THRESHOLD)).toBe(MAX_LOCKOUT_MIN);
  });
});

describe('isOtpExpired — TTL boundary', () => {
  const expiresAt = new Date(NOW_MS);

  it('is live strictly before expiry', () => {
    expect(isOtpExpired(expiresAt, new Date(NOW_MS - 1))).toBe(false);
  });

  it('is dead exactly at expiry', () => {
    expect(isOtpExpired(expiresAt, new Date(NOW_MS))).toBe(true);
  });

  it('is dead after expiry', () => {
    expect(isOtpExpired(expiresAt, new Date(NOW_MS + 1))).toBe(true);
  });
});

describe('OtpService.issue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW_MS));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a hashed row with the 5-minute TTL and delivers the plaintext code once', async () => {
    const { repository, sms, service } = makeMocks();

    const result = await service.issue(PHONE);

    expect(result.retryAfterSeconds).toBeUndefined();
    expect(repository.create).toHaveBeenCalledTimes(1);
    const createCall = repository.create.mock.calls[0] as [string, string, string, Date];
    const [phoneArg, hashArg, saltArg, expiresArg] = createCall;
    expect(phoneArg).toBe(PHONE);
    expect(expiresArg.getTime()).toBe(NOW_MS + OTP_TTL_MIN * MS_PER_MINUTE);

    expect(sms.sendOtp).toHaveBeenCalledTimes(1);
    const sendCall = sms.sendOtp.mock.calls[0] as [string, string];
    const [smsPhone, plaintextCode] = sendCall;
    expect(smsPhone).toBe(PHONE);
    // The delivered code is exactly what was hashed into the row — and only its hash is stored.
    expect(hashOtpCode(plaintextCode, saltArg)).toBe(hashArg);
    expect(hashArg).not.toContain(plaintextCode);
  });

  it('rate-limits at MAX_SENDS_PER_WINDOW: no row, no SMS, retryAfterSeconds returned', async () => {
    const { repository, sms, service } = makeMocks();
    repository.countRecentSends.mockResolvedValue(MAX_SENDS_PER_WINDOW);
    const MINUTES_SINCE_NEWEST_SEND = 4;
    repository.findActive.mockResolvedValue(
      otpRow({ createdAt: new Date(NOW_MS - MINUTES_SINCE_NEWEST_SEND * MS_PER_MINUTE) }),
    );

    const result = await service.issue(PHONE);

    expect(repository.create).not.toHaveBeenCalled();
    expect(sms.sendOtp).not.toHaveBeenCalled();
    // Upper bound anchored on the newest send: (window − age) remaining.
    expect(result.retryAfterSeconds).toBe(
      ((SEND_WINDOW_MIN - MINUTES_SINCE_NEWEST_SEND) * MS_PER_MINUTE) / MS_PER_SECOND,
    );
  });

  it('rate-limited with no active row falls back to the worst-case wait (window − TTL)', async () => {
    const { repository, service } = makeMocks();
    repository.countRecentSends.mockResolvedValue(MAX_SENDS_PER_WINDOW);
    repository.findActive.mockResolvedValue(null);

    const result = await service.issue(PHONE);

    expect(result.retryAfterSeconds).toBe(((SEND_WINDOW_MIN - OTP_TTL_MIN) * MS_PER_MINUTE) / MS_PER_SECOND);
  });
});

describe('OtpService.verify', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW_MS));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('consumes the row on the correct code (single-use)', async () => {
    const { repository, service } = makeMocks();
    repository.findActive.mockResolvedValue(otpRow());

    await expect(service.verify(PHONE, CODE)).resolves.toBeUndefined();

    expect(repository.consume).toHaveBeenCalledWith('otp-row-1');
    expect(repository.recordFailedAttempt).not.toHaveBeenCalled();
  });

  it('rejects when no active row exists (never sent, expired, or already consumed)', async () => {
    const { repository, service } = makeMocks();
    repository.findActive.mockResolvedValue(null);

    await expectHttpError(service.verify(PHONE, CODE), HttpStatus.UNAUTHORIZED, 'OTP_INVALID');
    expect(repository.consume).not.toHaveBeenCalled();
  });

  it('records a wrong attempt without locking below the threshold', async () => {
    const { repository, service } = makeMocks();
    repository.findActive.mockResolvedValue(otpRow({ attemptCount: 0 }));

    await expectHttpError(service.verify(PHONE, '000000'), HttpStatus.UNAUTHORIZED, 'OTP_INVALID');

    expect(repository.recordFailedAttempt).toHaveBeenCalledWith('otp-row-1', null);
    expect(repository.consume).not.toHaveBeenCalled();
  });

  it('locks for 1 minute on the 5th wrong attempt', async () => {
    const { repository, service } = makeMocks();
    repository.findActive.mockResolvedValue(otpRow({ attemptCount: MAX_ATTEMPTS - 1 }));

    await expectHttpError(service.verify(PHONE, '000000'), HttpStatus.UNAUTHORIZED, 'OTP_INVALID');

    const call = repository.recordFailedAttempt.mock.calls[0] as [string, Date | null];
    const [, lockedUntil] = call;
    expect(lockedUntil).not.toBeNull();
    expect((lockedUntil as Date).getTime()).toBe(NOW_MS + 1 * MS_PER_MINUTE);
  });

  it('doubles the lock on subsequent failures (2 min on the 6th, 4 min on the 7th)', async () => {
    const { repository, service } = makeMocks();

    repository.findActive.mockResolvedValue(otpRow({ attemptCount: MAX_ATTEMPTS }));
    await expectHttpError(service.verify(PHONE, '000000'), HttpStatus.UNAUTHORIZED, 'OTP_INVALID');
    const sixthCall = repository.recordFailedAttempt.mock.calls[0] as [string, Date | null];
    expect((sixthCall[1] as Date).getTime()).toBe(NOW_MS + 2 * MS_PER_MINUTE);

    repository.recordFailedAttempt.mockClear();
    repository.findActive.mockResolvedValue(otpRow({ attemptCount: MAX_ATTEMPTS + 1 }));
    await expectHttpError(service.verify(PHONE, '000000'), HttpStatus.UNAUTHORIZED, 'OTP_INVALID');
    const seventhCall = repository.recordFailedAttempt.mock.calls[0] as [string, Date | null];
    expect((seventhCall[1] as Date).getTime()).toBe(NOW_MS + 4 * MS_PER_MINUTE);
  });

  it('refuses a locked row with 429 OTP_LOCKED and the remaining wait', async () => {
    const { repository, service } = makeMocks();
    const LOCK_REMAINING_SECONDS = 90;
    repository.findActive.mockResolvedValue(
      otpRow({
        attemptCount: MAX_ATTEMPTS,
        lockedUntil: new Date(NOW_MS + LOCK_REMAINING_SECONDS * MS_PER_SECOND),
      }),
    );

    const exception = await expectHttpError(
      service.verify(PHONE, CODE),
      HttpStatus.TOO_MANY_REQUESTS,
      'OTP_LOCKED',
    );
    const body = exception.getResponse() as Record<string, unknown>;
    expect(body['retryAfterSeconds']).toBe(LOCK_REMAINING_SECONDS);
    expect(repository.consume).not.toHaveBeenCalled();
    expect(repository.recordFailedAttempt).not.toHaveBeenCalled();
  });

  it('accepts the right code once the lock has passed', async () => {
    const { repository, service } = makeMocks();
    repository.findActive.mockResolvedValue(
      otpRow({ attemptCount: MAX_ATTEMPTS, lockedUntil: new Date(NOW_MS - MS_PER_SECOND) }),
    );

    await expect(service.verify(PHONE, CODE)).resolves.toBeUndefined();
    expect(repository.consume).toHaveBeenCalledWith('otp-row-1');
  });

  it('treats a row at its exact expiry instant as dead (defensive re-check)', async () => {
    const { repository, service } = makeMocks();
    repository.findActive.mockResolvedValue(otpRow({ expiresAt: new Date(NOW_MS) }));

    await expectHttpError(service.verify(PHONE, CODE), HttpStatus.UNAUTHORIZED, 'OTP_INVALID');
    expect(repository.consume).not.toHaveBeenCalled();
  });
});
