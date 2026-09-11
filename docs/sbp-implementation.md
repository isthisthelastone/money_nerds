# Experimental SBP implementation

## Product boundary

SBP is off by default in Funding settings (`/settings`). Users may enable it just
to donate, without supplying a phone. Receiving requires a fixed `+7` plus ten
digits and one or more receiving banks. Every new post separately opts in.

Supported recipient-provided bank collection URLs can be opened by button or
encoded unchanged in a QR. Currently accepted: Alfa-Bank's `/public/mrv2/` and
T-Bank's full `/collectmoney/crowd/` URLs. Ownership, bank fees, payment-method
availability and settlement are not verified. See [research](sbp-research.md).

Other banks use explicit manual phone instructions. Their QR opens Money Nerds
instructions, contains no phone or private bank link, and is **not** a payment QR
to scan inside a bank. Sending-bank selection only customizes manual instructions;
there are no invented bank-app prefills. Bank-issued flows choose the sender's
bank on the bank page. Money Nerds never marks these transfers paid or includes
them in verified cryptocurrency totals.

## Privacy and data flow

- Private `profile_sbp_settings` and `post_sbp_options` tables have RLS enabled,
  explicit browser-deny policies, and no anon/authenticated grants.
- Server APIs authenticate through the existing Clerk-to-Supabase profile
  mapping. The identity passed to RPCs comes from the session, never the request.
- `/api/settings/sbp` only reads/writes the current user's settings.
- `/api/posts/[id]/sbp` rechecks viewer opt-in, author opt-in, post ownership and
  per-post inclusion in one database query. GET returns bank labels only; POST
  explicitly reveals the selected bank's details. Reveals are rate-limited.
- Private responses are `no-store`; private pages are `noindex`. Nothing is added
  to public profile/feed shapes, public payout endpoints, search metadata or URLs.
- Authenticated viewers can copy/share revealed details. The UI explains this;
  opt-in gating is not a guarantee of secrecy after disclosure.
- Publishing snapshots the then-current receiving details atomically with the
  post. Editing settings does not reroute earlier posts. Disabling atomically
  removes saved contact data and deletes all previous SBP snapshots. Re-enabling
  does not restore them. Normal database backup retention still applies.
- Settings and recipient reveal reject cross-origin mutations; opted-in post
  publication also requires the same origin. All bank links are HTTPS allowlisted
  paths without redirect/tracking queries, fragments, credentials or traversal.

## Verification (2026-09-11)

- Migration `20260910164519_experimental_sbp_personal_transfers.sql` applied to
  Supabase project `hqluarhwllbisizcirhg`.
- A rolled-back transaction under `service_role` checked donor-only enablement,
  atomic SBP-only publishing, absence of a synthetic SOL route, contact-free
  availability, authorized reveal, anonymous/disabled viewer denial, unlisted
  bank denial, immutable snapshots, author revocation, no resurrection on
  re-enable, phone validation and bank-link validation. No QA post/profile or
  contact data was committed. Post sequences can have gaps after rollback.
- Database grants verified: RLS true; anon and authenticated SELECT false;
  service_role SELECT true on both private tables.
- Focused ESLint and TypeScript checks passed. No broad test suite was run.
- Supabase advisors report no new table-access issues. Pre-existing warnings:
  [Postgres security updates](https://supabase.com/docs/guides/platform/upgrading)
  and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  No database upgrade or unrelated Auth configuration was changed here.
- Real bank transfers and physical-phone bank-app behavior require a recipient's
  genuine bank-issued link, a donor bank account and user approval. They have not
  been exercised with real funds.
