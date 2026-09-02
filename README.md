# Money Nerds

Money Nerds is a public board for asks, ideas, memes, and mutual aid. People sign
in once, publish a request, and receive direct support through the crypto routes
they choose. The platform takes no commission and never custodies user funds.

## Product surface

- Clerk provides one application session across email verification codes,
  Telegram, and supported Web3 sign-in methods on desktop and mobile. Google and
  Apple remain feature-gated until their provider-issued production credentials
  are configured.
- Every Clerk identity is linked to a stable Supabase profile, preserving posts,
  comments, aliases, payout routes, and verified sent/received activity.
- Posts, replies, unique views, atomic likes, and direct verified funding.
- Images, uploaded or recorded audio, and circular video attachments up to 15 MB.
- Public profiles with aliases, activity, funding routes, totals, and verified
  transaction links.
- Responsive editorial UI, a reduced-motion-safe 3D hero, SSR metadata, JSON-LD,
  dynamic sitemap, RSS, robots, manifest, `llms.txt`, and `llms-full.txt`.
- Explicit separation between verified on-chain transfers and unsigned legacy
  donation history.
- Per-post funding snapshots support SOL, USDC and USDT on Solana; ETH and USDT
  on Ethereum; BTC; TRX and USDT on TRON; TON; and INJ. Solana/SPL and injected
  EVM wallets submit in-browser; the other networks use wallet deep links or QR
  handoff and verify the supplied transaction hash before recording a donation.

## Stack

Next.js 16, React 19, TypeScript 6, Tailwind CSS 4, Clerk, Solana Wallet Adapter,
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
likes are toggled atomically, media uploads are signed into private staging and
atomically published after byte validation, funding intents are single-use, and
donation rows are created only after the selected network verifier confirms the
recipient, asset, amount, intent reference, and finality requirements.

## Deployment

The GitHub repository is connected to the Vercel `money-nerds` project. Configure
the variables from `.env.example` for Preview and Production, apply pending
Supabase migrations, then deploy from the protected production branch. The
canonical URL is <https://www.moneynerds.online>.

## Authentication and profile sync

Clerk is the authentication authority; Supabase stores the durable public Money
Nerds profile and activity graph. Request-time synchronization is authoritative,
and `/api/auth/clerk/webhook` provides eventual synchronization for Clerk user
create/update/delete events when `CLERK_WEBHOOK_SIGNING_SECRET` is configured.

Keep `PROFILE_IDENTITY_SECRET` and `EXTERNAL_AUTH_SECRET` stable and backed up.
They derive privacy-preserving profile IDs and must not be rotated without an
identity migration. Configure Telegram with BotFather and expose only the bot
username to browser code. Google requires a production OAuth client in Clerk;
Apple additionally requires its Services ID, Team ID, key ID, and private key.
Set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` or `NEXT_PUBLIC_AUTH_APPLE_ENABLED` only
after the corresponding Clerk strategy is fully configured.

The current profile and multi-currency schema is completed by:

1. `20260822044349_post_unique_views.sql`
2. `20260822044356_external_identity_sessions.sql`
3. `20260822044404_verified_payout_accounts.sql`
4. `20260822095500_clerk_multicurrency_post_funding.sql`
5. `20260822113000_multicurrency_funding_fk_indexes.sql`
