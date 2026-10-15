# Kapar (version 1): Business Mode build

**Kapar** is a mobile wedding-venue marketplace for North Macedonia. Couples find a venue, see its real availability and lock their date by paying the *kapar*, the reservation deposit every Balkan venue already uses. Venue owners run their whole booking calendar from the same app.

> **This repo is version 1 (July 2026).** It follows a full product specification and builds the venue-owner side first.
> **Version 2** is in [`wed`](https://github.com/sejdinii/wed). It was rebuilt from scratch with a different stack and covers the couple side, booking, chat and notifications.

## What this version contains

- **Specification:** `SPEC.md` and `Kapar_Master_Specification.pdf`: one app with two modes (Couple and Business), the 15-second rule for logging offline bookings, and money that is always computed on the server.
- **Design:** 29 screen mockups in `design/` (explore, venue detail, booking, payment, bookings, calendar, business dashboard, settings).
- **Milestone 1, Business Mode:**
  - **Mobile (Expo / React Native):** phone sign-in with a one-time code, venue onboarding, calendar, a 15-second "Add Reservation" flow, booking list and detail, blocking dates, and an offline queue.
  - **Server (NestJS + PostgreSQL):** auth with rotating refresh tokens, venues, calendar and bookings. Bookings are race-safe (proven against a live Postgres) and role checks run on every endpoint.
  - **Shared types:** API contracts shared by app and server.
- **Languages:** Macedonian, Albanian and English.

## Stack

Expo · React Native · TypeScript · NestJS · PostgreSQL · npm workspaces (monorepo)

## Structure

```
apps/mobile/            Expo app (Business Mode screens, shared auth, design system, i18n)
apps/server/            NestJS API (auth, venues, calendar, bookings, RBAC, payments mock)
packages/shared-types/  API DTOs shared by both
design/                 screen mockups
SPEC.md                 product and engineering specification
```
