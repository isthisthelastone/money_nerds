# Money Nerds

Money Nerds is a wallet-native public board for asks, ideas, memes, and mutual
aid. People publish with a Solana wallet and can receive SOL directly from other
wallets. The platform takes no commission and never custodies user funds.

## Product surface

- One wallet connection and signature creates the secure app session.
- Posts, threaded replies, atomic likes, and direct verified SOL support.
- Images, uploaded or recorded audio, and circular video attachments up to 15 MB.
- Public wallet profiles with aliases, activity, and verified transaction links.
- Responsive editorial UI, a reduced-motion-safe 3D hero, SSR metadata, JSON-LD,
  dynamic sitemap, RSS, robots, manifest, and `llms.txt`.
- Explicit separation between verified on-chain transfers and unsigned legacy
  donation history.

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
