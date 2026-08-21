# Money Nerds Supabase

This directory contains the additive, immutable migration history for the
existing Money Nerds database. The baseline was applied on 2026-08-15; donation
intent, private media, rate-limit, aggregate-stat, and internal-policy followups
were applied on 2026-08-21. The files are retained as the reproducible schema
and operational runbook.

## Migration

`migrations/20260815083622_production_schema.sql` keeps the legacy tables and
columns for rollback, then backfills the normalized production model. It is safe
to rehearse against a copy of production and intentionally fails if its dynamic
like or legacy-donation reconciliation checks do not balance.

Production was observed immediately before authoring with:

- 43 `posts`, 46 `post_info` rows, and 7 comments;
- 7 distinct post-author wallets and 7 legacy Auth users (6 distinct wallets,
  including one duplicated identity), producing 8 unioned profiles;
- 34 attributable wallet/post likes and 52 displayed post likes, leaving 18
  unattributed legacy likes that must remain visible;
- 2 unsigned legacy donation entries totalling 20,000,000 lamports; and
- 3 orphan `post_info` rows plus five historic comments whose legacy authors are
  not valid wallet addresses and therefore remain unlinked to wallet profiles.

These numbers are a deployment checklist, not hard-coded migration assumptions.
The SQL calculates and asserts its reconciliation from the database state at the
moment it runs, so writes should be frozen while it is applied.

## Data invariants

- Wallet addresses are base58-shaped Solana public keys (32-44 characters).
- `profiles.wallet_address` is the durable identity key. All valid legacy
  wallets are backfilled; duplicate legacy Auth identities are recorded in
  `internal.legacy_auth_wallet_links` rather than discarded.
- Invalid legacy comment authors remain readable through
  `comments.legacy_author_label`; `author_wallet` is nullable for those rows.
- `post_likes` and `comment_likes` contain one row per wallet and target.
  `like_count` is attributable likes only. For posts,
  `legacy_unattributed_like_count` preserves the difference between the old
  counter and attributable rows. `post_cards.legacy_like_count` exposes it;
  clients display the sum.
- New donations start as a private, short-lived `donation_intents` row and
  belong in `donations` only after the finalized transfer matches its donor,
  recipient, lamports, timestamp, and `moneynerds:{intent-id}` memo. Records are
  immutable and signatures are unique. Unsigned history stays in
  `legacy_unverified_donations` and is never represented as verified.
- Media metadata is normalized through `media_assets`, `post_media`, and
  `comment_media`. The `media` bucket is private. Draft objects remain staged,
  expire after one hour, and become readable through `/media/{id}` only in the
  same transaction that links them to published content. The database enforces
  24 files/120 MiB per wallet per rolling hour; each file is capped at 15 MiB.
- Existing legacy tables and columns are retained for at least one release.

## Read contracts and pagination

Public clients read `post_cards`, `comment_cards`, and `profile_stats`. The
compatibility `likes` view supports the existing client during rollout.
Security-invoker views plus RLS keep access bound to underlying table policies.
Cursor indexes cover feed ordering, comments/replies, profile content, likes,
donations, and media ordering. The feed and comments use bounded cursor reads;
wallet activity exposes bounded 12/25/50 page windows with exact totals.

Anonymous and Supabase-authenticated roles receive public `SELECT` only. They
have no effective table, sequence, function, or Storage write access: Supabase's
Storage-owner grants remain closed by the absence of write RLS policies. All
public data tables have RLS enabled. `wallet_challenges` and `wallet_sessions`
live in the exposed schema only because server routes use PostgREST; they have
explicit deny policies and no anon/authenticated grants. The `internal` schema
is hidden from public roles. Mutations and private auth operations are
service-role only.

## Wallet authentication

Native Supabase Web3 authentication is not assumed. A trusted server route must:

1. Issue a short-lived, single-use challenge containing the site domain, URI,
   wallet, nonce, request ID, issued-at, and expiration time.
2. Verify the exact challenge bytes with Ed25519, check domain/URI/wallet and
   expiry, then atomically consume the challenge while establishing a session.
   Use the service-only `establish_wallet_session` RPC so consumption and
   session creation commit atomically and two requests cannot reuse a challenge.
3. Generate at least 32 random bytes for the session token. Send the raw token
   only as an `HttpOnly; Secure; SameSite=Lax` cookie and store only its SHA-256
   hex digest in `wallet_sessions.token_hash`.
4. Enforce short challenge expiry, bounded session lifetime, streaming request
   limits, and atomic per-source/per-wallet/global rate windows. Wallet signing
   must begin from an explicit user tap so Android wallet handoff is not blocked.

`issue_wallet_challenge`, `establish_wallet_session`, `get_wallet_session`, and
`revoke_wallet_session` are granted only to `service_role`. The production app
uses the atomic establishment RPC after verifying the exact Ed25519 signature.

## Likes, donations, and media writes

Use the service-only `toggle_like_for_wallet(wallet, post_id, comment_id)` RPC.
It requires exactly one target and atomically changes both the normalized row
and exact counter. Never trust a wallet address supplied by a client; obtain it
from the validated server session.

Before inserting `donations`, issue a server intent and include its identifier in
the Memo program instruction. Verify through a trusted Solana RPC that the
transaction is finalized, succeeded inside the intent window, and contains the
exact sender, recipient, lamports, and memo. Record it through
`record_verified_donation`; a signature alone is not proof of payment.

Issue short-lived signed Storage uploads only from a trusted route after
validating the session, declared MIME type, media kind, size, request rate, and
durable hourly quota. Before publication, verify the object size, Storage MIME,
and magic bytes. Publish content and links through `publish_post_with_media` or
`publish_comment_with_media`; ordinary object reads and writes remain private.

## Deployment checklist

The current nine-migration chain is applied in production. For future changes:

1. Take a database backup and rehearse on a Supabase branch or restored copy.
2. Freeze application writes, record fresh source counts/totals, and apply the
   migration with the Supabase CLI or SQL runner as one transaction.
3. Confirm the migration assertions pass, then verify at minimum: 43 posts,
   7 comments, 8 profiles, 34 attributable post likes, 18 unattributed likes,
   and 2 legacy donation rows totalling 20,000,000 lamports. Counts must be
   adjusted only if legitimate writes occurred after the audit.
4. Test anonymous reads and confirm anonymous/authenticated writes, sequence
   access, private auth reads, RPC execution, and Storage writes are denied.
5. Deploy the server-mediated app only after its required migrations, then test
   pagination and one complete challenge/session, like, intent-bound donation,
   and private-media publication flow.
6. Run Supabase security/performance advisors and monitor errors before removing
   the write freeze. Keep legacy data through at least one stable release.

Never expose the Supabase service-role key to browser code, logs, or build-time
public environment variables.
