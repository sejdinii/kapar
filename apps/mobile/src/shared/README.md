# shared/

Cross-mode building blocks — used by both Couple and Business modes and by the shared entry.

- `design-system/` — tokens (SPEC §4), primitives (buttons, status pills, cards, chips).
- `i18n/` — MK / SQ / EN catalogs from day one (SPEC §4). Sunet/Synet in Cyrillic per catalog.
- `api/` — typed client generated from the server's OpenAPI spec. **Money is never client-computed**
  (CLAUDE.md Law #3): the client renders server-issued amounts, never calculates price.
- `auth/` — A0 phone-OTP entry flow and session handling (the mode-neutral gate).
- `navigation/` — the mode router: A0 → last-used mode; `Switch to Business` / `Switch to Planning`.

Business Mode modules are **lazy-loaded** on first entry so couple-only users pay no startup or
download cost (SPEC §2).
