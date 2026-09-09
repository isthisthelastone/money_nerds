# Money Nerds repository

## Workspace

The permanent local checkout is `/Users/happinesshater/Documents/Projects/Money Nerds`.
Perform all Money Nerds work here. Do not create another checkout in a dated Codex
or ChatGPT task directory. Older task paths are compatibility symlinks to this
checkout, not separate repositories.

This is the Money Nerds Next.js application, not the quiz projects described by
the parent directory's guidelines. Use this repository's package.json scripts
and conventions. Preserve unrelated changes and never commit `.env*.local`,
`.vercel`, or `.git/local-recovery` content.

## Authentication

Telegram uses OIDC authorization code flow with PKCE, a browser-bound encrypted
transaction cookie, and server-side ID-token validation. Preserve the stable
`telegram:<Bot API user id>` Clerk identity and the existing Clerk-to-Supabase
profile mapping. Credentials remain server-only.

Use Telegram's documented authorization endpoint. Its authorization page owns
the native-app handoff and browser fallback. Do not invent deep links from OAuth
parameters: native OAuth links require a Telegram-issued token.

## Shipping

The user prefers focused runtime checks and deployment over broad test suites
or Clerk Doctor. Do not claim a physical-phone sign-in or permissions flow was
tested unless it was actually completed. Push without rewriting branch history.
