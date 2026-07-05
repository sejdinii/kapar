# KAPAR — Product & Engineering Master Specification

> Markdown mirror of `Kapar_Master_Specification.pdf` (38 pages, 29 verified screen images).
> Screen images referenced by filename live in `/design/`. All `[VERIFY]` tags are preserved verbatim —
> they mark facts that were NOT verifiable and must be confirmed before building against them.

KAPAR
Product & Engineering Master
Specification
One mobile app · Two modes · Zero desktop
Wedding venue marketplace for North Macedonia, built on the kapar deposit
Every embedded screen image is verified: OCR-matched to its on-screen title, or rendered
from the approved HTML replica. Facts that could not be verified are tagged [VERIFY],
never asserted.
July 2026 · Supersedes all previous spec versions

## 1. Product thesis
Kapar lets couples find a wedding venue, see its real availability, and lock their date by paying the kapar (the
reservation deposit every Balkan venue already uses) through the app. Venue owners run their entire booking
operation from the same app — including the bookings that arrive by phone, Viber, and walk-in. The platform earns a
commission on each kapar processed. Nothing else flows through the platform; the balance is the venue's business.
Four laws every feature must obey:
- The calendar is the single source of truth. The availability a couple sees is the same object the owner edits.
No sync jobs, no second calendar, no import/export.
- The 15-second rule. Logging an offline booking must be faster than the paper notebook, one-handed, on a
phone — or owners revert to paper and the marketplace dies of stale calendars.
- Money is never client-computed. Every amount a user sees or pays comes from a server-issued quote; the
client only renders and consents.
- Phone-only. There is no desktop product. The one internal admin web console is for the platform team alone.
- Kapar-only payments, full-price transparency. The couple never pays more than the kapar in-app — but from
the first screen they see a truthful estimated total for the whole wedding, computed from the venue's published
prices and their own guest count, labeled 'estimate' until the final guest count converts it into a final price both sides
see identically.

## 2. Architecture: one app, two modes
A single mobile app contains Couple Mode and Business Mode. This is the Airbnb pattern — one app, one account,
switched between traveling and hosting from the profile (source: Airbnb Help Center article 3546). Separate partner
apps (Booking.com Pulse, Uber Driver — to the best of my knowledge; verify if the comparison matters) trade
discoverability for focus; for a small team in a market where venue owners are also wedding guests, one app wins:
one codebase, shared auth/messaging/calendar modules, and a built-in growth loop — every couple is one tap from
listing a family venue.
- Account model: one account, roles[] — [couple] by default, +owner after business onboarding, +staff by
invitation. Server-side RBAC keys off roles and venue membership. Mode is a UI concept, never an
authorization input.
- Mode switch: 'Switch to Business' / 'Switch to Planning' in Profile; long-press shortcut on the profile tab after first
use. The two modes have different tab bars, so the current mode is always visually unmistakable.
- Tab bars: Couple Mode: Explore · Favorites · Bookings · Messages · Profile. Business Mode (per founder
mockups): Dashboard · Calendar · [+] · Bookings · More, with a raised purple center button opening Add
Reservation.
- Notifications: every push is mode-tagged and deep-links into the correct mode, then restores the previous
mode on exit.
- Business onboarding (in-app): 'I own a venue' then venue name, city, halls (name + capacity), photos from
camera roll, kapar price rules, payout IBAN, then admin verification queue. Draft venues are visible to their owner
immediately, public after approval.
- Lazy loading: Business Mode modules load on first entry so couple-only users pay no startup or download cost.

## 3. Verified image ledger
19 screen images are embedded in this document. Verification method per image:
Asset
Shows
Verification
Used at
welcome_entr
y.png
Welcome / phone verification
(mode-neutral entry)
Founder-provided final mockup; content visually
confirmed on receipt
A0
home_explore
_final.png
Home / Explore
Founder-provided final mockup (replaces
earlier HTML render); content visually
confirmed on receipt
C1

Asset
Shows
Verification
Used at
messages_thr
ead.png
Messages thread (Villa
Prestigio chat)
Founder-provided final mockup; content visually
confirmed on receipt
C11
favorites.png
Favorites (saved venues, date
context)
Founder-provided final mockup; content visually
confirmed on receipt
C12
profile_hub.pn
g
Profile hub
Founder-provided final mockup; content visually
confirmed on receipt
C13
profile_info.pn
g
Profile Information window
Founder-provided final mockup; content visually
confirmed on receipt
C13a
payment_met
hods.png
Payment Methods window
Founder-provided final mockup; content visually
confirmed on receipt
C13b
settings.png
Settings window
Founder-provided final mockup; content visually
confirmed on receipt
C13c
help_support.
png
Help & Support window
Founder-provided final mockup; content visually
confirmed on receipt
C13d
b9_payments.
png
Business Payments window
Founder-provided final mockup; content visually
confirmed on receipt
B9
b11_settings.
png
Business Settings window
Founder-provided final mockup; content visually
confirmed on receipt
B11
b10_customer
s.png
Business Customers window
Founder-provided final mockup; content visually
confirmed on receipt
B10
p10
Search Results
OCR: 'Search Results'
C2
p13
Venue Details
OCR: 'Villa Prestigio' + amenities
C3
p12
Availability
OCR: 'Availability May 2024'
C4
p07
Booking Summary
OCR: 'Booking Details / Villa Prestigio'
C5
p09
Payment
OCR: 'Payment / Secure Payment'
C6
p08
Request Sent
OCR: 'Request Sent'
C7
p05
Booking Confirmed
OCR: 'Booking Confirmed'
C8
p04
My Bookings
OCR: 'My Bookings / Upcoming Completed
Cancelled'
C9
p06
Booking Detail
OCR: 'Booking Detail'
C10
crops 01–06
Business: Dashboard,
Calendar, Requests, Add
Reservation, My Bookings,
Booking Detail
OCR-matched to each on-screen title
B1–B6
p03 (9 panels)
Desktop composite,
decomposed: sidebar,
dashboard, calendar, day view,
add booking, booking details,
bookings, Block Date, Analytics
Each panel OCR-identified individually
§7.7;
B7–B8
images

Asset
Shows
Verification
Used at
p02, p11
Duplicates of Request Sent /
Payment
OCR-confirmed duplicates
not used
Screens with no source image anywhere — the OTP code-entry step, the Messages INBOX list, the Profile
sub-windows C13b–C13d, and Business Customers (B10) — carry placeholder boxes with generation prompts
(embedded at each screen and listed in Appendix A).

## 4. Design system (from the founder mockups)
- Color: primary purple #4C1D95 (buttons, active tabs) with lighter #6D28D9/#7C3AED accents; success green
for Confirmed/Available/Paid; amber for Pending; red only for destructive and urgency; canvas near-white with
white cards separated by soft shadow.
- Type: Plus Jakarta Sans (closest verified match to the mockups — confirm the exact face if the original design
file exists); scale: 28–32 hero, 17 title, 14 body, 12 caption; bold weights carry hierarchy.
- Components: status pills (Confirmed green / Pending amber / New red), rating badges overlaid on photos,
amenity chips (green outline, e.g. Air Conditioning / Parking / Outdoor Area — one headline amenity per card, full
list on the venue page), 'From EUR X per person' price blocks (cheapest active tier), date blocks (MAY / 25 / SAT
with red month), kapar sub-status lines colored by state, segmented tabs with underline, rounded 12–16 px cards,
full-width purple primary buttons, raised center [+] FAB in Business Mode.
- Voice: kapar is always explained on first contact per screen: 'Kapar (Reservation Deposit)'. Money strings
always name who receives what: 'Pay directly to the venue'.
- Accessibility floor: WCAG AA contrast, 44 px targets, calendar days announce state to screen readers,
reduced motion respected. Locales: MK / SQ / EN from day one.

## 5. The kapar engine (backbone)
State
Trigger
Effect
DRAFT
Summary completed
Nothing persisted but analytics
PENDING_PAYMEN
T
Pay tapped
Server creates payment intent from quote_id; amounts
server-computed, never client-trusted
PENDING_VENUE
Payment authorized*
Slot locked; expires_at = now + window (default 24 h
[VERIFY founder]); venue notified
CONFIRMED
Venue accepts in time
Capture; commission deducted; payout scheduled;
booking_ref issued (KPR-YYYY-NNNNN)
DECLINED /
EXPIRED
Venue declines / window
lapses
Release or refund in full; slot freed; couple notified; expiry
decrements venue reliability
CANCELLED_BY_C
OUPLE
Couple cancels
Refund per policy engine (default: full within 48 h of
confirmation [VERIFY]); slot freed
*Preferred: authorize now, capture on confirm. If the chosen PSP lacks auth/capture [VERIFY §10], fall back to
immediate capture + automated refund on decline/expiry, with UX copy adjusted.
Race rule: (hall_id, event_date, slot) is a DB uniqueness constraint under transactional locking. N simultaneous
requests for one slot must yield exactly one PENDING_VENUE — this is a CI test, not a hope.

## 6. The journey — entry, then Couple Mode screen by
screen
The journey opens with A0, the app's welcome gate. A0 is deliberately mode-neutral: it belongs to neither Couple
Mode nor Business Mode — every user, couple or venue owner, enters here. After verification, routing decides the
mode. The remaining screens (C1–C13) are Couple Mode, ordered as the couple experiences them: discover,
decide, pay, wait, celebrate, manage.

### A0 — Welcome & phone verification (shared entry — both modes)
Founder-provided final mockup, visually
confirmed on receipt. This screen precedes
any mode.
Purpose. The first thing anyone sees. One job: get a verified phone
number with maximum trust and minimum friction — for couples AND
venue owners alike.

**UI elements**
- Brand block: heart-in-pin Kapar logo, wordmark, tagline 'Find the
perfect venue. Book with confidence.' on a soft lavender wash
- 'Welcome' heading + 'Let's get started with your phone number'
- Phone field: MK flag + '+389' country selector (dropdown for other
Balkan codes and diaspora numbers) + number input
- Primary 'Continue' with arrow
- Trust badge row: Secure & Private ('Your data is safe with us') ·
Trusted by Many · Quick & Easy ('Takes less than a minute')
- Explainer card: lock icon + 'We'll send you a 6-digit code to verify your
number' + phone illustration
- Footer: 'By continuing, you agree to our Terms & Conditions and
Privacy Policy' (tappable links)

**Behavior**
- Continue normalizes the number to E.164, then sends the OTP (SMS, Viber fallback [VERIFY channel
availability and cost in NM]) and advances to the code-entry step: 6 input boxes, OS auto-read where allowed,
resend with cooldown, 'change number' link (code-entry step has no mockup yet — prompt in Appendix A)
- Routing after verification — the mode-neutrality in practice: existing account opens its LAST-USED mode home
(C1 or B1); brand-new account gets name + language, then the branch question 'Planning an event' / 'I own a
venue'; a deep link (venue page, request notification) always wins over default routing
- Rate limits: 3 sends / 10 min / number with exponential lockout; codes 6-digit, 5-min TTL, single-use; session =
access token max 15 min + rotating refresh; wrong code x5 = timed lock; VoIP/virtual numbers flagged for fraud
review
- Legal consent is implicit via the footer per the mockup [VERIFY with the lawyer whether NM/GDPR-aligned law
requires an explicit checkbox for Terms/Privacy at signup]

**Edge cases & states**

- Three design corrections required before build (mockup issues, flagged honestly): (1) 'Trusted by Many —
thousands of happy users' is a fabricated claim at launch; replace with a truthful line ('Built for venues and couples
in North Macedonia') until real numbers exist — fake social proof is both an integrity and a consumer-law risk
[VERIFY exposure with lawyer]. (2) The 'or' divider dangles — nothing follows it; either remove it or,
recommended, follow it with 'Browse venues as guest' (guest browsing with an auth gate at favorites/booking
measurably lowers marketplace drop-off — recommendation from experience, not a sourced statistic). (3) The
illustration shows five asterisks while the copy says 6-digit code — regenerate the illustration with six.
- Offline: Continue disabled with a 'no connection' notice; number preserved

**API**
POST /v1/auth/otp/send · POST /v1/auth/otp/verify

### C1 — Home / Explore
Founder-provided final mockup (visually
confirmed: heading, search card, venue rails,
five-tab bar).
Purpose. Orient, start a search, merchandise venues.

**UI elements**
- Location selector 'Skopje, North Macedonia'; bell with unread dot
- Hero: 'Find your perfect wedding venue' (heart) + 'Book easily, pay
kapar, and secure your date.'
- Search card: side-by-side Date and Guests fields with dropdowns;
full-width 'Search Venues' primary
- 'Popular Venues' horizontal rail: photo cards with rating badge ON the
photo ('4.8 (128)'), heart top-right, name, city, chip row: price tier (EUR
symbols), capacity, hall name; 'From EUR X' price line (mockup
placeholder — production shows the venue's real minimum)
- 'Top Rated' vertical list rows: thumbnail, name, rating chip, city,
price-tier + capacity + hall chips, heart
- Tabs: Explore (active) · Favorites · Bookings · Messages · Profile

**Behavior**
- Location = GPS city or Skopje; persisted. Date picker blocks past; guests 50–1000 step 10; both carry into
search
- Rails ranked server-side: Popular = 90-day booking volume; Top Rated = rating desc with minimum review count
(seeded in MVP)
- Heart = optimistic favorite; pull-to-refresh; skeletons on first paint

**Edge cases & states**
- Empty city: notify-me CTA. Offline: cached rails + banner. Notification permission requested only after first
booking request

**API**

GET /v1/venues/rails · GET|PUT /v1/me/favorites

### C2 — Search Results
Source deck image — OCR-verified 'Search
Results'.
Purpose. Ranked matches with per-date availability honesty.

**UI elements**
- Context chips: Skopje · Sat, 25 May 2024 · 300 Guests (each
tappable); Filter button; '42 venues found'; Sort dropdown
- Cards: photo, optional 'Popular' badge, heart, name, rating(count),
hall, capacity, 'From EUR X', green 'Available' tag
- Map View pill visible in mockup — out of MVP scope, hide behind flag

**Behavior**
- Availability computed server-side against the shared calendar; unavailable venues shown down-ranked with
'Booked on this date' — never silently hidden
- Filter sheet: price, capacity, hall type, amenities; count badge. Infinite scroll 20/page

**Edge cases & states**
- No results: widen-search suggestions. Prices 'From EUR X' [VERIFY EUR vs MKD display law, §10]

**API**
GET /v1/venues/search

### C3 — Venue Details
Source deck image — OCR-verified 'Villa
Prestigio'.
Purpose. The conversion page.

**UI elements**
- Gallery with 1/18 counter (swipe, full-screen); heart, share
- Name, 4.9 (128 reviews), location; amenity chips: Grand Hall ·
300–500 Guests · Indoor · Parking
- 'About this venue' with Read more; 'What's included' checklist
- Sticky bar: 'From EUR 3,200' + 'Check Availability' + 'Kapar
(Reservation Deposit) required'

**Behavior**
- Share = OS sheet with deep link kapar.mk/v/{slug}. Multi-hall venues get a hall selector; price follows
- Reviews are display-only in MVP (seeded)

**Edge cases & states**
- Unpublished venue: friendly 410. Failed images: branded gradient, never a broken icon

**API**
GET /v1/venues/:id · GET /v1/venues/:id/halls

### C4 — Availability & Guests
Source deck image — OCR-verified
'Availability'.
Purpose. Live truth + kapar disclosure; where trust is won.

**UI elements**
- Month grid with legend: Available green · Limited amber · Booked
red/gray · Selected purple
- 'Selected Date' card; Guests stepper with capacity helper
- Event type chips: Wedding · Engagement · Birthday · Sunet
Celebration · Other (localized in the MK/SQ catalogs as Sunet / Synet
— Cyrillic form in the i18n files)
- Menu tier selector where the venue defines tiers (e.g. Standard EUR
13 · Classic EUR 15 · Premium EUR 18 per person, each expandable
to show what's included); single-price venues show one line: 'Menu:
EUR 15 / person'
- Live estimated total, recomputed on every guests/tier change:
'Estimated total: 300 guests x EUR 15 + hall fee = EUR 4,500', with a
sensitivity line so the couple understands the estimate's nature: 'every
10 guests changes this by about EUR 150'
- Kapar card: shield icon, 'required to send booking request… held until
the venue confirms' + EUR 500; Continue

**Behavior**
- Reads the same calendar object Business Mode edits — real time. Day states aggregate slots; Limited opens a
slot picker; Booked days are disabled and muted
- Kapar amount AND per-person menu price come from venue price rules for that date — server-side; the
on-screen estimate is computed as base hall fee (if any) + guests x per-person price, clearly labeled 'estimate' until
the quote in C5 locks it
- Event type can select a different price rule where the venue defines one (e.g. a lighter Sunet/birthday menu)
[VERIFY with pilot venues whether per-event-type pricing is common enough to surface in B11]
- Continue = 10-min soft hold [VERIFY product decision]

**Edge cases & states**
- Fully booked month: jump-to-next-available. Dates are venue-local calendar dates — no timezone math on
date-only values

**API**
GET /v1/venues/:id/availability · GET /v1/venues/:id/kapar-quote

### C5 — Booking Summary
Source deck image — OCR-verified 'Booking
Details'.
Purpose. Transparent recap before money is requested.

**UI elements**
- Venue mini-card; rows: Date, Guests, Event Type, Start 17:00, End
01:00
- Price Summary: Venue EUR 4,000 + Service Fee EUR 200 (info
sheet) = Total EUR 4,200
- Kapar card: EUR 500, 'the remaining amount is paid directly to the
venue'; Continue to Payment

**Behavior**
- Single server quote object (quote_id) later required by the payment call; TTL 15 min; silent re-quote with a visible
notice if the price changed
- Event type arrives selected from C4 (editable here); list: Wedding / Engagement / Birthday / Sunet Celebration /
Other
- Price Summary is itemized per the pricing model: base hall fee (if any) + guests x per-person menu price
(chosen tier) + service fee; the mockup's flat 'Venue Price EUR 4,000' is a placeholder for this computed line
- The three numbers are labeled by what they ARE: 'Estimated Total' (not 'Total'), 'You pay now: Kapar EUR 500'
(the only in-app charge, ever), and 'Remaining — estimate: EUR 3,700, settled directly with the venue based on
your final guest count'. The estimate's guest count and tier are shown next to it so the basis is never hidden

**Edge cases & states**
- Lost race: blocking 'This date was just booked' then back to C4 refreshed

**API**
POST /v1/quotes · POST /v1/bookings/draft

### C6 — Payment (kapar)
Source deck image — OCR-verified 'Payment
/ Secure Payment'.
Purpose. Collect the kapar with maximum trust signaling.

**UI elements**
- 4-step progress (Venue · Date & Guests · Details · Payment); venue
recap; kapar explainer EUR 500
- Methods: Visa/Mastercard default; PayPal / Apple Pay / Google Pay
ONLY if PSP-supported for NM merchants [VERIFY] — never ship
dead options
- Card fields via PSP-hosted fields/SDK (SAQ-A; raw PAN never
touches our servers); 'Pay EUR 500 Securely'

**Behavior**
- Intent from quote_id; client receives client-secret only. 3-D Secure in PSP sheet [VERIFY support]
- Authorize-then-capture preferred; capture+refund fallback per §5. Idempotency key per attempt; button locks
while processing

**Edge cases & states**
- Declines mapped to human copy; 3 failures suggest another method. Network drop after submit: reconcile by
intent status — never double-charge. No card data in logs or analytics

**API**
POST /v1/payments/intents · POST /v1/psp/events (signed webhook)

### C7 — Request Sent
Source deck image — OCR-verified 'Request
Sent'.
Purpose. Money is secured; the ball is with the venue.

**UI elements**
- Celebration illustration; 'Your booking request has been sent!'
- Summary card: Date · Guests · Kapar Paid EUR 500 · Status:
Pending (amber)
- 'View My Bookings' primary; 'Back to Home' secondary

**Behavior**
- Push permission prompt fires here — the first obviously-valuable moment
- Status pill live-updates; copy states the response window ('venues typically respond within 24 hours')

**Edge cases & states**
- Decline/expiry while viewing: pill flips + full-refund notice + 'Find similar venues' CTA

**API**
GET /v1/bookings/:id · WS /v1/bookings/:id/status

### C8 — Booking Confirmed
Source deck image — OCR-verified 'Booking
Confirmed'.
Purpose. Celebration + the financial recap.

**UI elements**
- Green check + confetti; 'Congratulations! Your booking is confirmed.'
- Card: Confirmed pill; Date · Guests · Total EUR 4,200 · Kapar Paid
EUR 500 · Remaining EUR 3,700 'Pay directly to the venue'
- 'View Booking Details' / 'Message Venue'

**Behavior**
- Booking_ref issued and shown on detail; receipt sent. 'Add to calendar' (ICS) flag default ON
- Total and Remaining keep the 'estimate' label here and everywhere until the final guest count is recorded — the
numbers never silently change; recording a final count produces a visible 'Estimate to Final price' transition with a
notification to the couple

**Edge cases & states**
- Amounts reconcile exactly from one server object (4,200 - 500 = 3,700). Venue-initiated cancellation is
admin-mediated with full refund

**API**
GET /v1/bookings/:id

### C9 — My Bookings
Source deck image — OCR-verified 'My
Bookings'.
Purpose. Track everything, past and future.

**UI elements**
- Tabs Upcoming / Completed / Cancelled; rows: date block, photo,
venue, hall, time, status pill

**Behavior**
- Soonest-first; pending rows show 'venue responding…'; badge on the tab when a status changed since last view

**Edge cases & states**
- Per-tab empty states; refunded rows gain a 'Refunded' caption once the refund settles

**API**
GET /v1/me/bookings

### C10 — Booking Detail
Source deck image — OCR-verified 'Booking
Detail'.
Purpose. One booking, complete, with the two actions that matter.

**UI elements**
- Hero photo; Confirmed pill; rows: Date · Time · Guests · Total · Kapar
Paid · Remaining · Booking ID
- 'Message Venue' + 'View Receipt' (server-rendered kapar receipt
PDF [VERIFY local fiscal requirements])

**Behavior**
- Cancellation in overflow: policy summary before confirm; refund via policy engine
- Price panel has two states: 'Estimated total / Remaining (estimate)' with guest count + tier shown, and — once
the venue records the final guest count about a week before the event — 'Final price / Remaining', identical to what
the venue sees in B6. The couple is notified of the transition and can see the arithmetic (final guests x tier price +
hall fee)

**Edge cases & states**
- Pending variant: amber + explainer instead of receipt. Cancelled variant: refund timeline

**API**
GET /v1/bookings/:id · GET /v1/bookings/:id/receipt.pdf · POST /v1/bookings/:id/cancel

### C11 — Messages (thread)
Founder-provided final mockup, visually
confirmed on receipt.
Purpose. Booking-scoped chat; negotiation stays on-platform with an
audit trail.

**UI elements**
- Thread header: back, venue name, phone icon (deep-links to the
venue's stored number — a good escape hatch for a market that lives
on calls)
- Bubbles: venue gray-left, couple purple-right with time + double-tick
read receipts (visible in the mockup, so read receipts are IN scope,
upgraded from the earlier 'optional flag')
- Status update rendered as a venue-side bubble in the mockup ('Your
booking is confirmed!'); composer: camera icon, text field, purple send
button
- Inbox screen (one thread per booking: venue avatar, name, preview,
timestamp, unread dot) still has no mockup — prompt in Appendix A

**Behavior**
- Threads auto-created at PENDING_VENUE; push both sides; the state machine injects status updates so the
thread is a complete timeline
- Reconciliations with the mockup, decided or flagged: (1) the confirmation message should render as a
centered SYSTEM message, not a venue bubble — venues must not appear to hand-type contractual statements;
the machine says it, styled distinctly. (2) The camera icon implies photo attachments, which the spec had excluded
from MVP — decision needed [VERIFY founder]: ship photos in MVP (adds upload pipeline, storage, moderation
surface) or hide the icon until v1.1; my recommendation is v1.1. (3) The tab bar shows Bookings active while inside
a Messages thread — mockup inconsistency; rule: threads opened from a booking keep Bookings active, threads
opened from the Messages tab show Messages active. (4) A booking chip under the venue name (date · hall,
linking to C10) is recommended so the thread's context is one tap away [addition]

**Edge cases & states**
- Report action in the overflow feeds admin moderation. Venue silent 48 h: nudge system message + support
contact

**API**
GET /v1/me/threads · GET|POST /v1/threads/:id/messages · WS /v1/threads/:id

### C12 — Favorites
Founder-provided final mockup (updated
version), visually confirmed on receipt.
Purpose. The shortlist for the comparison weeks — with a date context so
conflicts surface early.

**UI elements**
- Header: 'Favorites' + heart badge; calendar icon top-right (shortcut to
change the context date)
- Date context card: 'Showing availability for Sat, 25 May 2024' +
'Change date' action — tags below are for THIS date
- '4 venues saved' count + sort dropdown ('Recently added')
- Venue cards: photo with filled heart, name, star rating (reviews), city,
guest-capacity range; two chip rows: a green 'Available' status chip
AND an amenity chip (Air Conditioning / Outdoor Area / Parking / Valet
Parking); price block 'From EUR 85 per person', chevron
- Bottom help card: 'Love a venue but it's not available? Change the
date above to check other available dates.'
- Tab bar: Favorites active

**Behavior**
- Availability tags recompute against the shared calendar when the context date changes — where couples
discover a taken date, the screen's real job. Card tap opens C3 with the context date; heart unfavorites with a
5-second undo snackbar; sort: Recently added, Price, Rating, Capacity
- Pricing model RESOLVED. This updated mockup prices 'From EUR 85 per person', which matches the
per-person engine in C4/C5 — the earlier 'per event' version is superseded. Implementation: 'From EUR X per
person' renders the venue's CHEAPEST menu tier's per-person price (min over active menu_tiers for that
venue/date), server-computed and labeled 'from'. [VERIFY one detail with founder: whether 'from' should be the
bare cheapest tier price (my assumption) or also fold in an amortized hall base fee — the two give different
headline numbers.]
- Amenity chip shown per card: display ONE primary amenity (venue-flagged as its headline feature) to keep the
card scannable; the full amenity list lives on C3. This is a per-card single chip, not the full set [addition, consistent
with the mockup]

**Edge cases & states**
- Empty: heart illustration + 'Save venues you love to compare them here' + Explore CTA
- Unpublished favorite shows a muted 'No longer available' card rather than vanishing

**API**
GET /v1/me/favorites?date= · PUT|DELETE /v1/me/favorites/:venueId

### C13 — Profile (hub)
Founder-provided final mockup, visually
confirmed on receipt.
Purpose. The account hub: identity at the top, one row per destination
window, Log Out at the bottom.

**UI elements**
- Header: 'Profile' title, gear icon (opens C13c Settings — same
destination as the Settings row; keep both, the gear is a convention
users expect)
- Identity block: initials avatar (AS), name 'Arben Sejdini', email, phone
+389 70 123 456
- Rows with chevrons: My Bookings · Favorites · Messages · Payment
Methods · Profile Information · Settings · Help & Support · Log Out (red,
with exit icon)
- Tab bar: Profile active

**Behavior**
- Row destinations: My Bookings opens C9, Favorites opens C12, Messages opens the C11 inbox (convenience
duplicates of the tab bar — acceptable and common), Payment Methods opens C13b, Profile Information opens
C13a, Settings opens C13c, Help & Support opens C13d
- Log Out: confirmation dialog — title 'Log out?', body 'You'll need to verify your phone number to sign back in.',
destructive-styled confirm + Cancel; on confirm: revoke refresh token server-side, clear local session and cached
PII, keep non-sensitive caches (venue images), land on A0
- Required reconciliations with the mockup: (1) there is no 'Switch to Business' / 'List your venue' row — this is
the door to Business Mode and MUST be added: a visually distinct row (briefcase icon, purple tint) above Log Out;
label depends on role — 'Switch to Business' when the account has the owner role, 'List your venue' otherwise. (2)
No 'Delete account' entry anywhere — required; it lives inside C13c Settings (see below), not on the hub. (3) Email
is shown but auth is phone-OTP — email is an optional profile field, editable in C13a, used for receipts only

**Edge cases & states**
- Signed-out state impossible by design (A0 gates the app). Identity block updates live after C13a edits

**API**
GET /v1/me

### C13a — Profile Information (window)
Founder-provided final mockup, visually
confirmed on receipt. Replaces the earlier
placeholder.
Purpose. View and edit the person's own identity data, with the security
model made visible to the user.

**UI elements**
- Header: back, 'Profile Information' + 'Manage your personal details';
reassurance chip 'Your information is private and secure'
- Identity card: initials avatar (ES) with camera badge, name, 'Member
since May 2024'; 'Add a profile photo (optional) — Initials are shown by
default' + 'Upload Photo' button
- Personal Details: Full Name field; Email (optional) with helper 'Only
used for booking receipts and important updates.'; Phone Number field
with MK flag + 'Change Number' button and the note 'Your phone
number is your account identity. Changing it will require verification.'
- 'Change Number (secure)' card: 'We'll verify your new number with an
OTP code. Your old number will be re-verified to ensure security.'
- 'Save Changes' primary + 'You have unsaved changes' indicator;
'Changes are logged' card: 'Every change you make is recorded for
your security. You'll be notified about changes to your account.'

**Behavior**
- Save is enabled only when a field changed (the 'unsaved changes' line confirms this state); server-side validation
mirrors client rules; email format checked but never required
- Change Number opens the secure flow the card describes: verify the NEW number by OTP, then re-verify the
OLD number — this is correct and matches the security requirement (phone = account identity, so a number
change is an account-transfer risk). If the old number is unreachable, route to support-mediated recovery, never a
silent override
- Every change is audit-logged (the 'Changes are logged' card sets this expectation honestly); changing phone or
email sends a notification to the OLD value so a hijacker cannot change contact details silently
- Decision required [VERIFY founder]: this mockup includes profile-photo upload, which C13a's spec had
deferred to v1.1 to avoid an image-moderation surface. If shipping in MVP: user-uploaded avatars need a
moderation path (at minimum report-and-review; ideally automated screening) and image storage — a real scope
addition. If deferring: hide 'Upload Photo' and keep initials only. Recommend deferring unless photos are a founder
priority; do not ship the button wired to nothing.

**Edge cases & states**
- Unsaved-changes guard on back navigation. Name is shown to venues on bookings — a note under the field
should say so [addition; not in mockup]

**API**
GET|PATCH /v1/me · POST /v1/me/change-phone (OTP-gated, old-number re-verification)

### C13b — Payment Methods (window)
Founder-provided final mockup, visually
confirmed on receipt. Replaces the earlier
placeholder.
Purpose. Saved cards for faster kapar checkout, plus payment history —
built on a tokenization model, not card storage.

**UI elements**
- Header: back, 'Payment Methods' + 'Manage your saved cards and
view payment history'
- Saved Cards: rows with brand logo (Visa/Mastercard/Amex), masked
last-4, expiry MM/YY, overflow menu; first card badged 'Default'; 'Add
Card' action
- Security note (see correction below); 'Fast & Secure Payments'
explainer: 'Save your card for faster kapar payments when booking
venues.'
- Payment History: rows with venue thumbnail, name, date, 'Receipt
#KP-DDMMYY', amount, status pill (Paid green / Pending amber), 'Paid
on' date, download icon; 'View All'
- 'Kapar Receipts' helper: 'Tap the download icon to view your kapar
receipt (PDF) for any payment.'
- Empty-state card: 'No saved cards yet? Save a card now to pay your
kapar faster' + 'Add Your First Card'

**Behavior**
- CRITICAL copy correction — must change before ship. The mockup reads 'Your card details are securely
stored and encrypted. We never store your card number.' These two sentences contradict each other, and the
reassuring half is the wrong one. Under the correct architecture (PSP tokenization, PCI-DSS SAQ-A) the app and
our servers must NEVER hold the card number — a certified payment provider stores it and returns a token.
Replace with the truthful line: 'Your card is stored securely by our certified payment provider. Kapar never sees or
stores your full card number.' Shipping the original wording is a PCI-DSS and consumer-protection risk, not a style
nit.
- 'Add Card' opens the PSP-hosted card sheet (hosted fields / SDK); we store ONLY the returned token, brand,
last-4, expiry. The overflow menu offers Set as default / Remove. Default card preselects at C6; removing the
default promotes the next card
- [VERIFY — hard dependency, rule 7]: this entire Saved Cards feature requires the chosen PSP to support
card tokenization / a customer vault. I do not have that verified for CaSys/cPay or any NM-available processor. If
tokenization is NOT available, this screen ships as Payment History ONLY and C6 stays manual card entry each
time. Do not build saved cards until the PSP capability is confirmed in that PSP's current documentation.
- Payment History rows are a read model over the payments table; the download icon renders the kapar receipt
PDF server-side (same artifact as C10). Receipt numbering KP-DDMMYY is a display format — the stable
identifier is booking_ref

**Edge cases & states**
- Empty states for both sections (mockup shows the cards empty-state card). Removing a card never affects
completed payments; a card cannot be removed while it backs an in-flight PENDING_VENUE authorization —
blocked with an explanation
- Amex acceptance is PSP-dependent [VERIFY] — do not show brands the processor cannot actually charge

**API**
GET|POST|DELETE /v1/me/payment-methods [VERIFY PSP tokenization] · GET /v1/me/payments · GET
/v1/bookings/:id/receipt.pdf

### C13c — Settings (window)
Founder-provided final mockup, visually
confirmed on receipt. Replaces the earlier
placeholder.
Purpose. App-level preferences and the legally required account controls.

**UI elements**
- Header: back, 'Settings' + 'Manage your preferences and account
settings'
- Language card: globe icon, current value 'English' in a dropdown
(Makedonski / Shqip / English) — applies instantly app-wide, persists
server-side
- Notifications section, per-category rows with toggles: Booking
updates (ON) · Messages (ON) · Reminders (ON) · Marketing & offers
(OFF by default); helper row 'update notification preferences for each
channel individually (push, SMS)' opening a per-channel detail screen
- Legal section: Terms & Conditions, Privacy Policy (in-app web views)
- Danger Zone card (red): 'Delete Account' with consequences text;
footer 'Need help? Contact our support team.'

**Behavior**
- Notification prefs are enforced SERVER-SIDE at send time, not just hidden in the client; marketing consent is
separate and default OFF (correct — opt-in, not opt-out); transactional messages (booking confirmations, refunds,
security alerts) cannot be disabled and the UI must say so
- The per-channel helper row is a good pattern: category-level toggles here, granular push-vs-SMS control one
level deeper — keeps this screen simple while allowing precision
- Delete Account copy correction — must change before ship. The mockup says it will 'permanently delete…
all associated data… remove your bookings'. That is not what the system does or legally may do:
completed-booking financial records must be RETAINED in anonymized form [VERIFY retention period with
accountant/lawyer], and deletion must be BLOCKED while a confirmed or pending booking exists. Truthful copy:
'Deleting your account erases your profile, favorites, messages and saved cards. Records of completed bookings
are kept in anonymized form as required by law. You cannot delete your account while you have an upcoming
booking.'
- Delete flow: consequences screen (per corrected copy) then double-confirm; on confirm, soft-delete +
PII-erasure job; the erasure job must also revoke sessions and remove PII from logs/backups per policy [VERIFY
backup-retention handling with the data-protection requirement]

**Edge cases & states**

- Language change re-renders in place, no restart. Blocked-deletion state lists the specific upcoming booking(s)
so the reason is concrete, not abstract
- Missing controls a people-focused settings screen should add [recommendations, not in mockup]: (1)
'Download my data' (GDPR-style data portability is a legal companion to deletion and likely required alongside it
[VERIFY]); (2) an explicit session/'log out of all devices' control given phone-OTP auth; (3) currency/number-format
follows locale but a display note helps. These are recommendations — confirm scope before building.

**API**
GET|PATCH /v1/me/settings · DELETE /v1/me · GET /v1/me/data-export [if #1 adopted]

### C13d — Help & Support (window)
Founder-provided final mockup, visually
confirmed on receipt. Replaces the earlier
placeholder.
Purpose. Self-serve answers first, humans one tap away.

**UI elements**
- Header: back, 'Help & Support' + 'We're here to help. Get answers or
contact our team.'
- FAQ accordion with 'View all FAQs': rows with icon, question/topic +
one-line preview, expand chevron — 'What is kapar?', 'When is my
kapar refunded?', 'Bookings', 'Cancellations', 'For venue owners'
- Contact Support: prominent 'Message our support team — We
typically reply within a few minutes'; then 'Call us' (+389 number) and
'Email us' (support@kapar.mk) cards
- Footer: 'App version 1.2.3 (1234)' + 'Support ID: 8f3a2b1c'; 'Visit Help
Center' (external web link)

**Behavior**
- FAQ content served remotely (CMS/JSON) so answers update without an app release; localized MK/SQ/EN
- Support threads reuse the C11 messaging infrastructure with a 'Kapar Support' counterpart; the Support ID is
attached to the thread automatically so the user never has to read it aloud
- The kapar-refund and cancellation FAQ answers are generated from the SAME policy-engine config that drives
actual refunds — one source of truth, so the help text can never contradict what the system does
- Honesty correction — must change before ship. 'We typically reply within a few minutes' is a support-SLA
promise that will be false at launch with a small team. Replace with a claim you can keep (e.g. 'within 24 hours') or
make it dynamic from real support metrics. A broken response-time promise on a wedding-stakes purchase erodes
exactly the trust this screen exists to build. [You set the real SLA; I cannot verify your support capacity.]

**Edge cases & states**
- Offline: FAQ cached from last fetch with a staleness note; Contact actions that need network are disabled with a
reason

- The 'Cancellations' FAQ is only as good as the cancellation flow it documents — which the review below flags as
under-specified elsewhere in this document (see the standalone Cancellation & Refund gap). Do not let this FAQ
describe a flow that has not been fully specified.
- Phone/email are real support channels [VERIFY the number and support@kapar.mk exist and are monitored
before shipping them in-app — a dead support line is worse than none]

**API**
GET /v1/support/faq?locale= · POST /v1/support/threads · GET /v1/app/version-info

## 7. Business Mode — the venue's whole operation, on a
phone
All six screens below are founder mockups, each OCR-matched to its on-screen title. Demo venue 'Villa Elegance';
halls Grand 400 · Garden 200 · Crystal 150. Navigation: Dashboard · Calendar · [+] · Bookings · More.

### B1 — Dashboard
Founder mockup — OCR: 'Good morning,
Villa Elegance'.
Purpose. Today at a glance, money status, and what needs action.

**UI elements**
- Greeting; bell with badge; 'Today's Overview' KPIs: New Requests ·
Pending Confirmation (1) · Upcoming Weddings (3) · Kapar Unpaid
(EUR 1,250)
- Purple Calendar banner; 'Upcoming Weddings' list: date block,
couple, hall + guests, colored kapar sub-status, status pill
- Tabs: Dashboard (active) · Calendar · [+] · Bookings · More

**Behavior**
- KPIs deep-link (New Requests then B4; Kapar Unpaid then B5 filtered). Row tap opens B6. Venue switcher in
the menu for multi-venue accounts

**Edge cases & states**
- First run: setup checklist replaces the list (halls, prices, first booking)

**API**
GET /v1/business/venues/:id/overview

### B2 — Calendar
Founder mockup — OCR: 'Calendar'.
Purpose. The source of truth Couple Mode reads.

**UI elements**
- May 2024 grid, Monday-first; legend
Available/Pending/Booked/Blocked; day circles for today/selected
- 'Rooms / Halls' with Manage: Grand 400 · Garden 200 · Crystal 150

**Behavior**
- Day tap opens a day sheet: per-hall slot rows with quick actions — Add Reservation (prefilled), Block
(day/hall/slot + reason), open booking. Hall tap filters the grid. Every change hits Couple Mode availability instantly

**Edge cases & states**
- Offline: cached month; queued writes; conflicts surfaced, never silently dropped

**API**
GET /v1/business/venues/:id/calendar · POST /v1/business/venues/:id/blocks

### B3 — Add Reservation — the 15-second rule
Founder mockup — OCR: 'Add Reservation'.
Purpose. Faster than the notebook, or the strategy fails.

**UI elements**
- Wedding Details: Couple Names · Phone (+389) · Event Date · Hall ·
Guests · Start 17:00 · End 01:00 · Event Type (Wedding · Engagement ·
Birthday · Sunet Celebration · Other)
- Payment Details: Kapar Amount (EUR) · Kapar Paid: Yes / Partially /
No; Notes; 'Save Reservation'

**Behavior**
- Only name + phone required; date prefills from the calendar context; Partially reveals amount-received; unpaid
kapar feeds the Dashboard KPI. Conflict guard on hall+date+slot shows the existing holder. Source chips (Phone,
Viber, WhatsApp, Instagram, Walk-in, Other) added above the form [addition to mockup — powers source
analytics]

**Edge cases & states**
- Offline: local queue with visible pending-sync badge. Foreign numbers accepted (diaspora weddings).
Acceptance: real owner, one hand, under 15 seconds

**API**
POST /v1/business/venues/:id/bookings

### B4 — Booking Requests
Founder mockup — OCR: 'Booking Requests'.
Purpose. Where the kapar state machine meets the owner.

**UI elements**
- Tabs New (2) / Responded; cards: photo, couple, red 'New' badge,
date + hall, guests, 'Kapar: EUR 500', requested time
- Per card: 'Decline' (outlined red) / 'View & Respond' (primary)

**Behavior**
- View & Respond sheet: full info + expiry countdown [addition — the countdown is what makes the window work]
+ Accept (captures kapar, shows amount) / Decline with optional reason (couple sees generic copy). Expiry
auto-moves to Responded as 'Expired' and decrements reliability

**Edge cases & states**
- Empty New: 'No new requests. Your venue is visible to couples searching {city}.'

**API**
GET /v1/business/venues/:id/requests · POST /v1/bookings/:id/accept|decline

### B5 — My Bookings (business)
Founder mockup — OCR: 'My Bookings'.
Purpose. Every booking, every source, one list.

**UI elements**
- Tabs Upcoming (3) / Completed / Cancelled; rows: date block,
couple, hall + guests, colored kapar sub-status, pill, chevron

**Behavior**
- Search by name/phone and source filter [additions]; Cancelled includes declined/expired requests with reason;
CSV export via share sheet [addition — tax season]

**Edge cases & states**
- Unpaid-kapar rows carry an amber edge for scannability

**API**
GET /v1/business/venues/:id/bookings

### B6 — Booking Detail (business)
Founder mockup — OCR: 'Booking Detail'.
Purpose. Complete financials + edit and message.

**UI elements**
- Hero photo; couple + Confirmed pill; '25 May 2024 (Saturday) · 17:00'
· 'Grand Hall · 300 Guests'
- Kapar Amount EUR 500 · Kapar Paid EUR 500 (Paid pill) · Remaining
EUR 4,500 · Total EUR 5,000 · Created On · Notes
- 'Edit' / 'Message Couple'

**Behavior**
- Invariant rendered from one server object (5,000 - 500 = 4,500 — mockup checks out). Message Couple: app
bookings open the thread; offline bookings deep-link to dialer/SMS. Overflow: Set final guest count (converts the
couple's estimate into the final price, notifies the couple, and locks the number both sides see — editable until 48 h
before the event with a re-notification) · Mark kapar received · Add note · Cancel (app bookings trigger refund
policy). Edit prefills B3; date/hall edits on app bookings go through a reschedule flow [VERIFY founder decision]

**Edge cases & states**
- Offline variant shows source chip and Partially/No kapar states

**API**
GET|PATCH /v1/business/bookings/:id
7.7 Remaining modules — resolved from the decomposed desktop
composite
The desktop composite was decomposed into nine panels, each identified by OCR. Six confirm the mobile mockups
already specified (dashboard, calendar, day view, add booking, booking details, bookings list — cross-referenced
below). Three carry NEW content used here: the Block Date modal, the Analytics panel, and the sidebar navigation,
which is primary evidence for the full module list: Dashboard · Calendar · Bookings · Requests · Payments ·
Customers · Analytics · Settings.
Panel (OCR)
Shows
Disposition
'Dasma.mk / Villa Deluxe'
sidebar
Module navigation + venue switcher + Add
Booking button
Evidence for B7–B11 module
list
'Good morning, Arben!'
Dashboard overview, KPIs, upcoming events
Confirms B1

Panel (OCR)
Shows
Disposition
'Calendar July 2027' +
halls
Month grid, legend, Your Halls (Grand 500, Small
200, Garden 300, VIP 50)
Confirms B2
'Saturday, July 17, 2027'
Day view per hall with booking card
Confirms B2 day sheet
'Add Booking' + source
chips
Source chips (Your App, Phone, Viber, WhatsApp,
Facebook, Instagram, Walk-in, Other) + form
Confirms B3 incl. the
source-chip row
'Booking Details'
Single booking financials
Confirms B6
'Bookings' list
Tabs + search + rows
Confirms B5 (search confirmed,
not an addition)
'Block Date'
Blocking modal
NEW — B7 below
'Analytics (July 2027)'
Occupancy, totals, Bookings by Source
NEW — B8 below

### B7 — Block Date
Panel from the decomposed composite —
OCR: 'Block Date'. Desktop-styled reference;
build it as a phone bottom sheet in the B1–B6
visual language.
Purpose. Take inventory off the market instantly — renovation, private
events, holidays.

**UI elements**
- Opened from the Calendar day sheet or the [+] menu; fields: Date
(prefilled from context), scope selector: Entire Day / specific hall /
specific slot, Reason (optional free text)
- Primary 'Block' button; blocked slots render gray-hatched in B2 and
disappear from Couple Mode availability

**Behavior**
- Blocking is a first-class calendar mutation: hits the same availability object, propagates to C4 in real time
- Range blocking (from–to dates) for renovations [addition to mockup — blocking 30 days one-by-one fails the
15-second spirit]; recurring closure (e.g. every Monday) is v1.1
- Unblock from the day sheet; every block/unblock is audit-logged (actor, scope, reason)

**Edge cases & states**
- Blocking a slot that holds a booking is refused with the conflict card — cancel the booking first, explicitly
- Offline: queues like any calendar write; conflict on sync surfaces

**API**
POST /v1/business/venues/:id/blocks · DELETE /v1/business/blocks/:id

### B8 — Analytics
Panel from the decomposed composite —
OCR: 'Analytics (July 2027)'. Desktop-styled
reference; build as a phone screen under
More.
Purpose. Show the owner what the platform knows that the notebook
never could.

**UI elements**
- Month selector; KPI cards: Occupancy %, Total Bookings, Total
Revenue, Avg Guests
- 'Bookings by Source' donut with legend (sample data in the
composite: Phone, Viber, Your App, Instagram, Walk-in, Other)
- Highlight cards: Most Popular Month · Top Day · Top Hall

**Behavior**
- All aggregates computed server-side per venue and month; source data comes from the B3 source chips — this
chart is why those chips exist
- Revenue = kapar processed + recorded offline kapar amounts, labeled clearly as 'kapar tracked', never
presented as total venue revenue [honesty rule: we only see deposits]
- Occupancy = booked slots / available slots for the month, blocked slots excluded from the denominator

**Edge cases & states**
- Fewer than 5 bookings in a month: show 'Not enough data yet' instead of misleading percentages
- Export as image via share sheet (owners forward these to partners) [addition]

**API**
GET /v1/business/venues/:id/analytics?month=

### B9 — Payments
Founder-provided final mockup, visually
confirmed on receipt. Replaces the earlier
placeholder.
Purpose. Every euro of kapar, from authorization to payout, reconciled —
a read model, not a money-moving surface.

**UI elements**
- Header: back, 'Payments' + 'Every euro of kapar, from authorization
to payout', filter + export (download) icons
- Three summary cards: Total Payouts This Month (EUR 12,450),
Commission This Month (EUR 1,245, '10.0% of total'), Available for
Payout (EUR 3,230, 'Will be paid on 15 May 2024')
- Next Payout card: Date, Amount, Commission (shown as a negative
deduction), masked IBAN; helper 'Payouts are made automatically
every 15th and 30th of the month'
- Controls: date-range picker (01 Apr – 30 Apr), state dropdown (All
States), Filters
- Transactions list (count badge): per row TRX id, couple name,
booking ref (#BK-...), amount, 'Kapar'/'Refund' label, state chip
(Authorized / Captured / Paid Out / Refunded), date+time, chevron;
'Load more'
- 'About payments' expander: 'Commission is shown per transaction for
full transparency. Offline kapar is tracked outside Kapar and excluded
from payouts.'

**Behavior**
- This screen is READ-ONLY over the payments table — it never moves money; the only action is 'report a
problem' on a transaction. State chips mirror the payments.state enum exactly
(authorized|captured|paid_out|refunded|disputed)
- Commission shown per transaction and in the monthly card — correct: fee transparency prevents the single most
common marketplace support ticket ('why did I receive less?')
- Offline kapar (cash logged in B3) is excluded from payouts and labeled as tracked-outside — honest, since the
platform never touched that money
- [VERIFY — unconfirmed business + technical facts, rules 3 and 7]: (a) the 10% commission rate and the
'15th/30th automatic payout' schedule are shown in the mockup but I cannot confirm they are your actual chosen
terms — treat as placeholder until you set them; (b) AUTOMATIC payouts and per-transaction commission split
depend on the PSP supporting marketplace split payouts / scheduled disbursement. This is the same hard
dependency as saved cards (C13b) and is not verified for any NM-available processor. If the PSP cannot do
automatic split payouts, this screen becomes a reconciliation/reporting view with MANUAL payout processing
behind it, and the 'automatic' copy must change.

**Edge cases & states**
- Empty state (new venue, no transactions): explain that payouts appear here after the first confirmed booking
- Disputed/refunded rows link to the originating event in the audit trail; a disputed payment shows a support
banner
- Amounts and dates in this screenshot are sample data — not spec values

**API**

GET /v1/business/venues/:id/payments · GET /v1/business/venues/:id/payouts · POST
/v1/business/payments/:id/report

### B10 — Customers
Founder-provided final mockup, visually
confirmed on receipt. Replaces the earlier
placeholder.
Purpose. A CRM the owner never has to maintain — it builds itself from
bookings.

**UI elements**
- Header: menu, 'Customers' + 'Manage your customer relationships',
search icon, '+' add
- Four stat cards: Total Customers (1,248), Total Bookings (3,562),
Total Kapar Value (EUR 125,430), Last Event (Today); each with a
MoM trend arrow
- Search 'by name or phone number' + Filters (count badge); quick
filters: All Customers / All Time / All Halls / More Filters
- Customer rows: initials avatar with a colored status dot, name, phone
(tap to call), bookings count, per-customer kapar figure, Total Spent,
Last Booking date, overflow, chevron
- Pagination ('Showing 1–6 of 1,248', page numbers); 'Merge
suggestions available — We found 3 potential duplicates that you can
review.'

**Behavior**
- Every B3 save and every app booking upserts a customer by normalized (E.164) phone number — the CRM is a
byproduct of doing bookings, never manual data entry
- Merge suggestions detect same-phone/different-name (or near-duplicate) records; the owner reviews and
confirms — never an automatic silent merge, since a wrong merge corrupts two customers' histories
- The status dot needs a defined meaning before build — the mockup shows green/orange/red but does not say
what they encode. Do NOT ship an undefined signal. Proposed: green = has an upcoming confirmed booking,
orange = a pending/unpaid item, red = a past cancellation/no-show. [VERIFY this is the intended semantics with
the founder — rule 7, I will not assume it.]
- Correctness flag — 'Total Spent' vs what the platform actually knows. The platform only processes the
KAPAR, not the full wedding cost. A per-customer 'Total Spent' of EUR 4,650 can only mean total kapar, or a sum
that includes venue-entered offline amounts — it cannot mean verified total wedding spend, which never flows
through Kapar. Label this precisely ('Total kapar' or 'Recorded value') so the number is not read as revenue the
platform can vouch for. Same honesty rule as B8 Analytics.

**Edge cases & states**
- Customer detail (row tap): contact actions (call / SMS / open thread if app-sourced), booking history, private
notes
- GDPR-style deletion: deleting a customer ANONYMIZES their record but retains the underlying
booking/payment rows (financial records must survive) [VERIFY retention period with accountant/lawyer]

- Sample data in the screenshot uses +383 (Kosovo) numbers — fine, diaspora and cross-border customers are
expected; the app must accept multiple country codes, not only +389

**API**
GET /v1/business/venues/:id/customers · GET|PATCH /v1/business/customers/:id · POST
/v1/business/customers/merge (owner-confirmed)

### B11 — Settings
Founder-provided final mockup, visually
confirmed on receipt. Replaces the earlier
placeholder.
Purpose. Everything configurable, none of it daily.

**UI elements**
- Header: back, 'Settings' + 'Manage your venue and preferences';
venue card (photo, 'Villa Elegance', city, chevron)
- VENUE section: Venue Profile & Gallery ('Photos, ordering, capacity
and more') · Halls ('Manage halls, capacity and photos') · Price Rules
per Hall ('Manage menu tiers, prices and kapar rules')
- STAFF & ACCESS section: Staff ('Invite and manage team
members') · Notifications ('Choose notification channels') · Payout IBAN
('Manage payout IBAN and verification')
- SYSTEM section: Switch to Planning ('View planning tools and
timeline') — the mode switch back to Couple Mode · Business
Information ('Name, address, contact details')
- Danger zone: 'Delete Venue — This action cannot be undone.' (red)

**Behavior**
- Price Rules per Hall opens the menu-tier + kapar editor; changes affect FUTURE quotes only — issued quotes
and pending requests keep their locked amounts (prevents a venue from changing a price out from under a couple
mid-booking)
- Hall deletion is blocked while future bookings exist — archive instead; same principle for Delete Venue below
- IBAN change triggers re-verification AND a security notification to the owner — a changed payout account is a
classic account-takeover target, so this must never be silent
- Staff invite by phone with roles Owner/Manager/Staff; staff permissions enforced server-side (no payouts, no
settings, no venue deletion) — the RBAC source of truth is venue_members, never the client
- Delete Venue — correction, same class as the account-delete issue. 'This action cannot be undone' must
not mean destroying booking/payment records: those are RETAINED (anonymized where required) [VERIFY
retention period]. Delete Venue must be BLOCKED while any confirmed or pending booking exists, and should
require re-authentication (OTP) given its destructiveness. Truthful copy: 'Deleting your venue removes it from
Kapar and cancels future availability. Records of past bookings are retained as required by law. You cannot delete
a venue with upcoming bookings.'

**Edge cases & states**

- 'Switch to Planning' is the return half of the mode switch (A0/§2) — it must land in Couple Mode's last-used
screen, not reset the app
- People-focused gap [recommendation, not in mockup]: multi-owner venues (family businesses are common
in this market) need a clear 'who can do what' view under Staff, and an ownership-transfer path for when a venue
changes hands — confirm whether that's MVP or later before building

**API**
GET|PATCH /v1/business/venues/:id/settings · POST /v1/business/venues/:id/staff-invites · PATCH
/v1/business/venues/:id/payout-iban (re-verification) · POST /v1/business/venues/:id/delete
(OTP-gated, blocked if bookings)

## 8. Data model (PostgreSQL)
Table
Key fields
users
id, roles[](couple|owner|staff|admin), phone UNIQUE, name, locale; soft delete
venue_members
user_id, venue_id, role — the RBAC source of truth
venues
id, slug UNIQUE, name, city, geo, about, amenities[],
status(draft|pending_review|live|suspended)
halls
id, venue_id, name, capacity_min/max, photos[], slot_config JSONB
price_rules
venue_id, hall_id, kind(base|season|dow), date_range, base_fee_minor, kapar_minor,
currency, event_type NULL (optional per-event-type override)
menu_tiers
id, venue_id, hall_id NULL, name, price_per_person_minor, includes_text; 1–3 per
venue/hall
bookings
id, booking_ref UNIQUE, venue_id, hall_id, couple_user_id NULL for offline, event_date,
slot, status, source(app|phone|viber|whatsapp|facebook|instagram|walkin|other), guests,
event_type, times, customer_name, customer_phone, kapar_paid_state, menu_tier_id,
estimated_total_minor, final_guest_count NULL, final_price_minor NULL, notes, quote
JSONB, expires_at; UNIQUE(hall_id, event_date, slot)
payments
booking_id, psp_ref, amount_minor, commission_minor,
state(authorized|captured|released|refunded|disputed|paid_out), idempotency_key UNIQUE
threads/messages
thread per booking; messages(sender|system, body, created_at, read_at)
favorites / audit_log
user+venue PK / append-only actor, action, entity, before-after, ip, at

## 9. API surface (consolidated)
Area
Endpoints
Auth
POST /v1/auth/otp/send · POST /v1/auth/otp/verify
Me
GET|PATCH|DELETE /v1/me · GET /v1/me/bookings · GET|PUT /v1/me/favorites · GET
/v1/me/threads · POST /v1/me/push-tokens
Discovery
GET /v1/venues/rails · GET /v1/venues/search · GET /v1/venues/:id · /halls ·
/availability · /kapar-quote
Booking
POST /v1/quotes · POST /v1/bookings/draft · GET /v1/bookings/:id · POST
/v1/bookings/:id/cancel|accept|decline · GET /v1/bookings/:id/receipt.pdf · WS
/v1/bookings/:id/status
Payments
POST /v1/payments/intents · POST /v1/psp/events (signed webhook)
Business
POST /v1/venues · GET /v1/business/venues/:id/overview · /calendar · /bookings ·
/requests · POST /v1/business/venues/:id/blocks|bookings · GET|PATCH
/v1/business/bookings/:id · POST .../kapar-received|final-count
Messaging
GET|POST /v1/threads/:id/messages · WS /v1/threads/:id
All endpoint names above are this spec's contract to implement — they are definitions, not references to an existing
API.

## 10. Payments — verified constraints & open items

Verified (mid-2026; re-verify at build): Stripe does not support businesses incorporated in North Macedonia. SEPA
membership does not change merchant eligibility.
[VERIFY] before implementation:
- CaSys/cPay (domestic PSP): hosted fields or redirect, auth/capture, split payouts, 3-D Secure
- Payment-institution licensing question for routing kapar through the platform (Macedonian lawyer)
- PayPal / Apple Pay / Google Pay availability for NM merchants — remove from UI if unsupported
- Foreign-entity alternative (EE/UK + Stripe/Paddle): tax and invoicing implications
- Consumer price display: EUR in mockups vs MKD legal tender — what checkout must legally show
- Fiscal/receipt requirements for the kapar receipt PDF

## 11. Security & non-functional requirements
Security (non-negotiable)
- Server-side RBAC on every endpoint from venue_members; owner isolation explicitly tested; mode never
authorizes
- Schema-validated input, parameterized SQL, PSP-hosted card fields (SAQ-A), signed webhooks, idempotent
payment mutations, server-computed amounts
- OTP rate limits, JWT max 15 min + rotating refresh, secrets in vault, dependency scanning in CI, append-only
audit log
- PII minimized and encrypted at rest, excluded from logs; account-erasure job
- CI race test: N parallel requests on one slot then exactly one PENDING_VENUE
Performance, offline & reliability
- Search P95 under 500 ms; availability month under 300 ms; CDN images
- Business Mode offline: cached calendar reads, queued Add Reservation writes, conflicts surfaced on sync
- Business modules lazy-loaded; 99.5% uptime target; structured logs + error tracking from day one
Recommended stack (recommendation — justify deviations)
- Client: React Native (Expo) + TypeScript strict; one codebase, both modes, lazy business bundle
- Backend: Node (NestJS/Fastify) + PostgreSQL, or Supabase with RLS for speed; OpenAPI generated;
EU-region hosting
- PSP behind an interface with a staging stub, so M1–M2 never block on the [VERIFY] items

## 12. Milestones & acceptance
M
Contents
Acceptance
M1
Auth, business onboarding, halls, Calendar + day sheet,
Add Reservation (all sources, offline queue), Block,
Bookings list — Business Mode core
Real owner migrates a notebook under 30 min;
booking entry under 15 s; conflict guard proven
M2
Dashboard KPIs, price rules, Customers, staff invites,
MK/SQ, mode-switch shell
5 pilot venues log 100% of bookings for 2
straight weeks, phone-only
M3
Quotes, state machine, PSP interface (stubbed),
Requests inbox, mode-tagged notifications
Race test green; full lifecycle incl. expiry + refund
on staging
M4
Couple Mode complete (C0–C13) + mode switch
Real-money end-to-end booking across two
phones; crash-free above 99.5%
M5
Admin console, payouts reconciliation, analytics,
support runbook
20 live venues in Skopje/Tetovo; dispute drill
executed
Appendix A — image-generation prompts for the
remaining screens

Style suffix for all: 'clean modern iOS mobile UI, white background, purple #4C1D95 primary, Plus Jakarta Sans-style
type, subtle gray dividers, 9:41 status bar, high-fidelity mockup'. Screens: the Profile sub-windows — Help & Support
(prompt embedded at C13d), plus:
- Messages inbox (C11 list view): one thread per booking — venue avatar, name, last message preview,
timestamp, unread dot; matching the thread mockup's style
- OTP code entry (A0 step 2): six large input boxes, resend timer, 'change number' link, lavender wash matching
the Welcome screen
- Business Payments: kapar transaction list with authorized/captured/paid-out states, payout schedule card, Villa
Elegance sample data, tab bar Dashboard/Calendar/+/Bookings/More
- Business Customers: searchable customer list keyed by phone with booking history and total value
- Business Analytics: occupancy %, revenue, bookings-by-source donut, top month/day/hall cards
- Business Settings: venue profile, halls management, kapar price rules, staff, payout IBAN, 'Switch to Planning'
- Seed photography: 'luxurious Balkan wedding ballroom, crystal chandeliers, white and gold florals, round tables
with gold chairs, warm candlelight, wide angle, photorealistic'
— End. Companion artifacts: kapar-home-v3.html (C1 visual contract), kapar-venue-app.jsx (interaction study), six cropped
Business Mode PNGs (01–06) delivered alongside this document.


---

## Screen image manifest (files in /design/)

Each screen's mockup image, mapped to its spec ID. These are the visual contract.

| Spec ID | Screen | Image file |
|---|---|---|
| A0 | Welcome / phone verification (shared entry) | welcome_entry.png |
| C1 | Home / Explore | home_explore_final.png |
| C2 | Search Results | p10_search_results.png |
| C3 | Venue Details | p13_venue_details.png |
| C4 | Availability & Guests | p12_availability.png |
| C5 | Booking Summary | p07_booking_summary.png |
| C6 | Payment (kapar) | p09_payment.png |
| C7 | Request Sent | p08_request_sent.png |
| C8 | Booking Confirmed | p05_booking_confirmed.png |
| C9 | My Bookings | p04_my_bookings.png |
| C10 | Booking Detail | p06_booking_detail.png |
| C11 | Messages (thread) | messages_thread.png |
| C12 | Favorites | favorites.png |
| C13 | Profile (hub) | profile_hub.png |
| C13a | Profile Information | profile_info.png |
| C13b | Payment Methods | payment_methods.png |
| C13c | Settings | settings.png |
| C13d | Help & Support | help_support.png |
| B1 | Dashboard | 01_dashboard_home.png |
| B2 | Calendar | 02_calendar.png |
| B3 | Add Reservation | 04_add_reservation.png |
| B4 | Booking Requests | 03_booking_requests.png |
| B5 | My Bookings (business) | 05_my_bookings.png |
| B6 | Booking Detail (business) | 06_booking_detail.png |
| B7 | Block Date | dcrop_block_date.png |
| B8 | Analytics | dcrop_analytics.png |
| B9 | Payments | b9_payments.png |
| B10 | Customers | b10_customers.png |
| B11 | Settings (business) | b11_settings.png |

**No mockup yet** (build from the text spec + prompt): OTP code-entry step, Messages inbox list.
