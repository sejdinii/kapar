# RBAC — server-side authorization

**Non-negotiable (CLAUDE.md §4, SPEC §11):**

- Authorization is enforced **server-side on every endpoint**, keyed to `venue_members`.
- **Mode is a UI concept, never an authorization input.** A request being "in Business Mode"
  grants nothing; membership does.
- **Owner isolation is explicitly tested:** owner A cannot read or mutate owner B's venue.
- Staff permissions are enforced here, not in the client (no payouts / no settings / no venue
  deletion for the `staff` role).

Planned contents: a `VenueMembershipGuard`, a `@RequireVenueRole()` decorator, and the
owner-isolation integration test. Empty until M1 `auth` + `venues` land.
