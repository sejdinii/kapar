import { PaymentState } from '@kapar/shared-types';
import { InMemoryPaymentProvider } from './in-memory-payment-provider';

describe('InMemoryPaymentProvider (mock)', () => {
  const provider = new InMemoryPaymentProvider();

  it('advertises the conservative default capabilities (KAPAR-BLOCKER §7)', () => {
    expect(provider.capabilities.authThenCapture).toBe(true);
    expect(provider.capabilities.tokenization).toBe(false);
    expect(provider.capabilities.splitPayouts).toBe(false);
    expect(provider.capabilities.wallets).toHaveLength(0);
  });

  it('authorizes an intent, then captures it', async () => {
    const intent = await provider.createIntent({
      quoteId: 'q1',
      bookingId: 'b1',
      amount: { minor: 50000, currency: 'EUR' },
      idempotencyKey: 'idem-1',
    });
    expect(intent.state).toBe(PaymentState.Authorized);
    expect(intent.clientSecret).toContain('mock_secret_');

    const captured = await provider.capture(intent.intentRef, 'idem-1');
    expect(captured.state).toBe(PaymentState.Captured);
  });

  it('refunds a captured intent', async () => {
    const intent = await provider.createIntent({
      quoteId: 'q2',
      bookingId: 'b2',
      amount: { minor: 50000, currency: 'EUR' },
      idempotencyKey: 'idem-2',
    });
    const refunded = await provider.refund(intent.intentRef, 'idem-2');
    expect(refunded.state).toBe(PaymentState.Refunded);
  });

  it('refuses gated capabilities that no NM PSP has been verified to support', async () => {
    await expect(
      provider.tokenizeCard({ userId: 'u1', providerCardHandle: 'h1' }),
    ).rejects.toThrow('KAPAR-BLOCKER');
    await expect(
      provider.schedulePayout({
        venueId: 'v1',
        amount: { minor: 100, currency: 'EUR' },
        commission: { minor: 10, currency: 'EUR' },
        payoutIban: 'MK07...',
        idempotencyKey: 'idem-3',
      }),
    ).rejects.toThrow('KAPAR-BLOCKER');
  });
});
