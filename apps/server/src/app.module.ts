import { Module } from '@nestjs/common';
import { PaymentsModule } from './payments/payments.module';

/**
 * Root module. Feature modules are added here as milestones land.
 *
 * Build order (CLAUDE.md §9):
 *   M1 — Business core: AuthModule, VenuesModule, HallsModule, CalendarModule,
 *        BookingsModule (Add Reservation + offline queue + Block Date), RbacModule.
 *   M2 — DashboardModule, PriceRulesModule, CustomersModule, StaffModule, i18n.
 *   M3 — QuotesModule, kapar state machine, PaymentsModule (real provider), RequestsModule.
 *
 * PaymentsModule is wired now (behind the mock) so the payment seam exists from day one,
 * per the README's first-prompt instruction.
 */
@Module({
  imports: [PaymentsModule],
})
export class AppModule {}
