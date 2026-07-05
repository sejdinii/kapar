# CLAUDE.md — Kapar Project Constitution

> This file is persistent context for Claude Code. Read it before every task.
> **Verify the CLAUDE.md mechanism itself** against current docs at https://docs.claude.com —
> the filename/behavior may have changed since this file was written (author's knowledge cutoff: Jan 2026).

---

## 0. What this project is

**Kapar** is a single mobile app (iOS + Android) with two modes — **Couple Mode** (find/book wedding venues) and **Business Mode** (venues manage bookings) — for the North Macedonia / Balkans market. Couples pay only the **kapar** (reservation deposit) in-app; the platform earns commission on it. The full specification is in `SPEC.md`; screen images are in `/design/`.

---

## 1. The four product laws (never violate)

1. **The calendar is the single source of truth.** The availability a couple sees is the *same* data object the venue edits. No sync jobs, no second calendar, no import/export.
2. **The 15-second rule.** Logging an offline booking (Business Mode "Add Reservation") must be faster than a paper notebook, one-handed, on a phone. If a change makes it slower, it's wrong.
3. **Money is never client-computed.** Every amount a user sees or pays comes from a server-issued quote. The client renders and consents; it never calculates price.
4. **Kapar-only payments, full-price transparency.** The couple never pays more than the kapar in-app, but always sees a truthful *estimated* total (guests × menu tier + hall fee), labeled "estimate" until a final guest count converts it to a final price both sides see identically.

---

## 2. Stack (build to this unless the human changes it)

- **Client:** React Native + **Expo**, **TypeScript strict mode**. One codebase → iOS + Android (the human's explicit requirement: both platforms flexible).
  - *If the human prefers Flutter/Dart instead, stop and confirm — do not assume.*
- **Backend:** Node.js (NestJS **or** Fastify) + **PostgreSQL**. Generate an OpenAPI spec.
- **Hosting:** EU region (data-residency prudence).
- **Verify before using:** exact Expo SDK version, RN version, and any library API — per the engineering rules below, do not invent library methods or versions. Check current docs.

---

## 3. Engineering standard (the human's explicit bar)

Build as a **Senior Full-Stack Engineer (15+ yrs)** and **Senior Security Engineer (15+ yrs)** would, with **Apple-level attention to user impact**. Concretely:

- Clean architecture, separation of concerns, no magic numbers, typed everywhere.
- Every feature ships with tests. The **booking race-condition test is mandatory** (see §5).
- Accessibility is a floor, not a nice-to-have: WCAG AA contrast, 44px targets, screen-reader labels, reduced-motion respected.
- Error/empty states are designed, not afterthoughts. Copy is honest (see §6).

---

## 4. Security requirements (non-negotiable)

- **RBAC is server-side on every endpoint**, keyed to `venue_members`. **Mode is a UI concept, never an authorization input.** Test owner isolation explicitly (owner A cannot touch owner B's venue).
- Phone-OTP auth: rate-limit (approx. 3 sends / 10 min / number — *tune with real abuse data*), exponential lockout, 6-digit codes, 5-min TTL, single-use. Access token ≤15 min + rotating refresh.
- **All input validated server-side** (schema validation). Parameterized SQL only. Output encoding.
- **Payments:** PSP-hosted card fields only (PCI-DSS SAQ-A) — the app/servers **never** hold a card number. Verify PSP webhook signatures. Idempotency keys on all payment mutations. Server computes kapar & commission from stored price rules; never trust client amounts.
- Secrets in a vault, never in the repo. Dependency scanning in CI. Append-only audit log for booking & payment mutations. PII minimized, encrypted at rest, excluded from logs. Account/venue deletion → anonymize (retain financial records) + PII-erasure job.
- **Change of payout IBAN or phone number → re-verification + security notification.** These are account-takeover targets; never silent.

---

## 5. The booking race condition (must-have test)

`(hall_id, event_date, slot)` is a **DB uniqueness constraint** under transactional row locking. N simultaneous requests for one slot must deterministically produce **exactly one** `PENDING_VENUE`. Write this as an automated integration test before considering the booking engine done.

---

## 6. Honesty in the product (matches the human's truth rules)

The spec contains several **copy corrections** flagged as "must change before ship" — the mockups contain claims the system must not make. Honor them:

- **Never** tell a user their card is "stored and encrypted" by us — it is tokenized by a certified PSP. We never store the card number.
- **Never** label kapar figures as "total revenue" / verified "total spent" — the platform only sees deposits. Label as "kapar tracked" / "recorded value."
- **Never** promise a support SLA ("reply within minutes") the team can't keep.
- **Delete account / Delete venue** must not claim to erase records that are legally retained; must be blocked while bookings are active; must require re-auth.

---

## 7. ⛔ DO-NOT-BUILD-YET blockers (unverified external facts)

Per the human's decision, **stub/mock these and build around them** — do **not** implement against a guessed payment integration. Leave a clear `// KAPAR-BLOCKER:` comment at each stub.

The whole payment + payout architecture depends on facts I could **not** verify (no verified source for the PSP's current capabilities):

- **PSP card tokenization / customer vault** — gates saved cards (C13b) and one-tap checkout.
- **PSP authorize-then-capture** — the preferred kapar flow; fallback is capture + auto-refund.
- **PSP marketplace split payouts / scheduled disbursement** — gates automatic payouts (B9).
- **3-D Secure / SCA support.**
- **Whether routing kapar makes the platform a licensed payment institution** under NM law — a lawyer question.
- **PayPal / Apple Pay / Google Pay** availability for NM merchants — hide any method the PSP can't actually charge.
- **Consumer price-display law:** EUR (shown in mockups) vs MKD (legal tender).
- **Data-retention periods** for anonymized financial records.
- **Confirmation-window length** (spec assumes 24h — may need 48–72h for this market).

**Rule for Claude Code:** where a task hits one of these, build the surrounding UI/logic against a well-typed **`PaymentProvider` interface** with an in-memory mock implementation, so the real PSP can be dropped in later without rework. Do not fabricate a real provider's method names or behavior.

---

## 8. Undefined-in-mockup items needing a decision (do not assume)

The spec flags these; if a task depends on one and it's unresolved, **ask the human** rather than guessing (their rule 7):

- Customer-row **status dot** colors (green/orange/red) have no defined meaning yet.
- Whether **profile-photo upload** ships in MVP (adds image-moderation surface) or defers to v1.1.
- Whether **reviews are creatable** in MVP or display-only (affects cold-start of ratings).
- **Cancellation & refund flow** is the biggest under-specified area — see SPEC §"gaps." Do not build a cancellation UI against an unspecified policy engine; flag it.

---

## 9. Build order (milestones)

Start at **M1**. Do not jump ahead.

- **M1 — Business core:** Auth (OTP), business onboarding, halls, Calendar + day sheet, Add Reservation (all sources, offline queue), Block Date, Bookings list. *Acceptance: real owner migrates a notebook <30 min; booking entry <15s; race test green.*
- **M2:** Dashboard KPIs, price rules (menu tiers), Customers, staff, MK/SQ localization, mode-switch shell.
- **M3:** Quotes, kapar state machine, `PaymentProvider` interface + mock, Requests inbox, notifications.
- **M4:** Couple Mode (A0, C1–C13d) + mode switch.
- **M5:** Admin console, analytics, support.

---

## 10. How to use the spec

`SPEC.md` is the detailed contract — screens (A0, C1–C13d, B1–B11), data model, API surface, state machine. Screen images referenced there live in `/design/` (filenames match the spec's image ledger). When a spec detail and this file conflict, **this file wins** for laws/security/stack; the spec wins for screen-level detail. When neither is clear, **ask** — don't assume.
