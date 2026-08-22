# Money Nerds

Money Nerds is a wallet-native public board for asks, ideas, memes, and mutual
aid. People publish with a Solana wallet and can receive SOL directly from other
wallets. The platform takes no commission and never custodies user funds.

## Product surface

- One wallet connection and signature creates the secure app session; optional
  Google, Apple, and Telegram sessions use privacy-preserving public profile IDs.
- Posts, threaded replies, atomic likes, and direct verified SOL support.
- Images, uploaded or recorded audio, and circular video attachments up to 15 MB.
- Public wallet profiles with aliases, activity, and verified transaction links.
- Responsive editorial UI, a reduced-motion-safe 3D hero, SSR metadata, JSON-LD,
  dynamic sitemap, RSS, robots, manifest, and `llms.txt`.
- Explicit separation between verified on-chain transfers and unsigned legacy
  donation history.
- A private-proof/public-route payout registry validates Solana, Ethereum,
  Bitcoin, TRON, TON, and Injective addresses. Only SOL transfer execution is
  enabled until each additional chain has ownership and finality verification.

## Stack

Next.js 16, React 19, TypeScript 6, Tailwind CSS 4, Solana Wallet Adapter,
Supabase Postgres/Storage, and Vercel. Production targets Node 24 and pnpm 10.

## Local development

1. Install Node 24 and enable the pinned pnpm version with Corepack.
2. Copy `.env.example` to `.env.local` and fill in the project values.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm dev`.

The Supabase service-role key is server-only. It must never appear in browser
code, logs, or a `NEXT_PUBLIC_` variable.

## Quality checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The database migrations and reconciliation runbook live in `supabase/`. New
database writes are server-mediated: public tables are read-only through RLS,
wallet challenges are single-use, likes are toggled atomically, media uploads
are signed into private staging and atomically published after byte validation,
and donation rows are created only after a finalized transfer matches a
single-use server intent and on-chain memo.

## Deployment

The GitHub repository is connected to the Vercel `money-nerds` project. Configure
the variables from `.env.example` for Preview and Production, apply pending
Supabase migrations, then deploy from the protected production branch. The
canonical URL is <https://www.moneynerds.online>.

## Optional Google, Apple, and Telegram sign-in

External sign-in is disabled by default. Apply
`20260822044356_external_identity_sessions.sql` before deploying the matching
application code, set a stable `EXTERNAL_AUTH_SECRET` of at least 32 bytes, and
set `EXTERNAL_AUTH_ORIGIN` to the exact site origin (for production,
`https://www.moneynerds.online`). The secret derives privacy-preserving profile
IDs and must be backed up; rotating it requires a deliberate identity migration.

For Google or Apple, configure that provider in the Supabase Authentication
dashboard and register Supabase's provider callback with Google or Apple:

```text
https://hqluarhwllbisizcirhg.supabase.co/auth/v1/callback
```

Add the corresponding application callbacks to Supabase's redirect allowlist:

```text
https://www.moneynerds.online/api/auth/oauth/google/callback/**
https://www.moneynerds.online/api/auth/oauth/apple/callback/**
```

Google requires its OAuth client ID and secret in Supabase. Apple additionally
requires the Services ID, Team ID, key ID, and private key; rotate Apple's
generated client secret before it expires. Use equivalent localhost callback
allowlist entries for local testing.

For Telegram, configure the production domain with BotFather, then set the bot
token and username from BotFather in `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_BOT_USERNAME`. Never expose the token to browser code.

Only after each provider is fully configured, set its `AUTH_*_ENABLED` flag to
`true` in that environment. `/api/auth/providers` reports only safe availability
metadata, so clients should render a provider control only when `available` is
true. External identities expose a deterministic Money Nerds profile ID, never
an email or provider subject. That profile ID is not a Solana payout address;
SOL funding requires a separately verified payout wallet.

The related production migrations run in this order:

1. `20260822044349_post_unique_views.sql`
2. `20260822044356_external_identity_sessions.sql`
3. `20260822044404_verified_payout_accounts.sql`
