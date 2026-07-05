import { Module } from '@nestjs/common';
import { InMemoryPaymentProvider } from './in-memory-payment-provider';
import { PAYMENT_PROVIDER } from './payment-provider.interface';

/**
 * PaymentsModule wires the active PaymentProvider behind the PAYMENT_PROVIDER token.
 *
 * Today it always resolves to the in-memory mock (CLAUDE.md §7). When a real PSP is verified,
 * swap the `useClass` for the concrete provider — every consumer injects the token, so no caller
 * changes. The mock is exported so other modules (bookings, quotes) can depend on the seam.
 */
@Module({
  providers: [
    InMemoryPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: InMemoryPaymentProvider },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
