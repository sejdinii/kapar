# Business Mode

Tab bar: **Dashboard · Calendar · [+] · Bookings · More** with a raised purple center [+] FAB
opening Add Reservation (SPEC §2, §7). **Lazy-loaded** on first entry.

Screens B1–B11 (SPEC §7). **M1 builds the core** (B2, B3, B5, B7 + onboarding); the rest follow.

| ID | Screen | Mockup | Milestone |
|---|---|---|---|
| B1 | Dashboard | `01_dashboard_home.png` | M2 |
| B2 | Calendar (+ day sheet) | `02_calendar.png` | **M1** |
| B3 | Add Reservation (15s rule) | `04_add_reservation.png` | **M1** |
| B4 | Booking Requests | `03_booking_requests.png` | M3 |
| B5 | My Bookings | `05_my_bookings.png` | **M1** |
| B6 | Booking Detail | `06_booking_detail.png` | M2/M3 |
| B7 | Block Date | `dcrop_block_date.png` | **M1** |
| B8 | Analytics | `dcrop_analytics.png` | M2 |
| B9 | Payments | `b9_payments.png` | M3 (PSP-gated) |
| B10 | Customers | `b10_customers.png` | M2 |
| B11 | Settings | `b11_settings.png` | M2 |

**The two laws this mode lives or dies by:**
- **The calendar is the single source of truth** — B2 edits the same object Couple Mode C4 reads.
- **The 15-second rule** — B3 Add Reservation must beat a paper notebook, one-handed. If a change
  makes it slower, it's wrong.
