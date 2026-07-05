# Kapar — Claude Code Handoff Package

This folder is everything Claude Code needs to start building Kapar.

## Contents

```
kapar_handoff/
├── CLAUDE.md                        ← project constitution (Claude Code reads this first)
├── SPEC.md                          ← full specification, Markdown
├── Kapar_Master_Specification.pdf   ← same spec, human-readable with images inline
└── design/                          ← 29 verified screen mockups (the visual contract)
```

## How to use it with Claude Code

> ⚠️ **Verify the mechanism first.** I am fairly confident Claude Code reads a `CLAUDE.md`
> at the project root as persistent context, but this may have changed since Jan 2026.
> Confirm the current behavior at https://docs.claude.com before relying on it.

1. **Create your project folder** and copy these files into its root:
   `CLAUDE.md`, `SPEC.md`, and the `design/` folder.
2. **Start Claude Code** in that folder. It should pick up `CLAUDE.md` automatically.
3. **First prompt to Claude Code — suggested:**
   > "Read CLAUDE.md and SPEC.md. Confirm the stack and the M1 scope back to me,
   > list every `[VERIFY]` blocker you found, and propose a project structure for a
   > React Native + Expo app with a Node/Postgres backend. Do not write feature code yet —
   > scaffold the repo and the `PaymentProvider` interface with an in-memory mock."
4. **Then build M1 only** (Business core — see CLAUDE.md §9). Do not let it jump ahead.

## What this package deliberately does NOT decide

Per the truth-first rules this was built under, the following are **unresolved on purpose** —
Claude Code is instructed to stub or ask, never to guess:

- **Payment integration** — the PSP's real capabilities (tokenization, split payouts, 3DS)
  are unverified. Build against a mocked `PaymentProvider` interface. (CLAUDE.md §7)
- **Legal/compliance** — payment-institution licensing, data-retention periods, EUR-vs-MKD
  price display. Lawyer/accountant questions. (CLAUDE.md §7)
- **Product decisions** — status-dot meaning, profile photos in MVP, reviews creatable or not,
  and the **cancellation & refund flow** (the biggest unspecified area). (CLAUDE.md §8)

## Honest status

This is a **design-complete** specification: every screen has a verified mockup and a written
contract. It is **not yet build-safe for payments**, because a third of the app depends on one
external fact — the payment processor's capabilities — that could not be verified from
available sources. Resolve that (and the cancellation spec) before M3.

The recommended first real-world step is **not** writing code — it is confirming the
`[VERIFY]` items in CLAUDE.md §7 with the payment processor and a local lawyer.
