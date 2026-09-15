# Optional bot-assisted Telegram return

Implemented 2026-09-13 as a separate opt-in fallback. The existing OIDC default,
PKCE, encrypted transaction cookie and `/auth` provider flow remain unchanged.
This is not a guarantee that Telegram or iOS will return to the same browser tab.

Production activation and focused verification are recorded in the [15 September release](release-2026-09-15.md). Physical iPhone approval/return remains explicitly unverified until exercised on the owner's device.

## Runtime configuration and prerequisites

- `AUTH_TELEGRAM_BOT_ENABLED=true` and `AUTH_TELEGRAM_ENABLED=true`.
- Existing server-only `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
  `CLERK_SECRET_KEY`, Supabase service key and canonical `EXTERNAL_AUTH_ORIGIN`.
- A dedicated random `TELEGRAM_WEBHOOK_SECRET` (32–256 base64url characters).
- Migration `20260912161553_telegram_bot_browser_return.sql` applied before enablement.
- BotFather's linked login domain must match the canonical callback host,
  including the chosen `www` host. OIDC redirect/trusted-origin configuration
  does not by itself establish the legacy LoginUrl domain configuration.
- Bot API webhook points to `/api/auth/telegram/bot/webhook`, with its secret
  token. Inspect any existing webhook/consumer before changing it; do not drop
  pending updates. An existing bot workflow must be preserved or coordinated.

## Endpoints

| Endpoint | Contract |
| --- | --- |
| `GET /api/auth/telegram/bot` | `{ available: boolean }`, no secrets or attempts |
| `POST /api/auth/telegram/bot` | Same-origin JSON `{ returnTo?: string }`; returns `{ flow: "bot", authUrl, expiresAt }` and a Secure HttpOnly browser cookie |
| `POST /api/auth/telegram/bot/webhook` | Telegram secret header; valid private-chat `/start <id>` creates a protected LoginUrl button |
| `GET /api/auth/telegram/bot/callback/[state]` | `[state]` is `<start-id>.<callback-nonce>`; signed Telegram query fields required; redirects to the return page with a fragment claim |
| `GET /api/auth/telegram/bot/return` | Minimal HTML, no Clerk JS, analytics, app layout, external assets or session issuance |
| `POST /api/auth/telegram/bot/return` | Same-origin JSON `{ action: "prepare" | "finish", state, claim, confirmed?: true }`; both cookie and return claim required |

`prepare` returns `{ identity: { id, name } }`, without consuming. `finish`
requires `confirmed: true`, atomically consumes, then returns `{ redirectUrl }`
for the existing 60-second Clerk ticket. No profile or session is created before
the final cookie-bound confirmation. Errors return `{ error: string }` and
no identity/claim/ticket. There is deliberately no approval polling API.

## Two independent proofs

1. Original browser receives a host-only `__Host-mn_telegram_bot` cookie containing
   the public start ID and an independent 256-bit browser secret. The `t.me` start
   payload contains only a random 43-character ID, within Telegram's 64-character
   limit. Only hashes are stored in the server-only pending table.
2. A trusted private-chat webhook binds that attempt to its first Telegram sender
   and generates a fresh callback nonce for the bot's LoginUrl button. A different
   sender cannot rebind it. Retries can rotate the nonce before approval.
3. The LoginUrl callback verifies Telegram's widget HMAC, strict fields, duplicate
   parameters, timestamp and the expected sender. It also atomically records a
   globally unique digest of the proof to prevent reuse in another attempt.
4. Only that approving callback receives a newly generated return claim. The
   claim is not sent to the initiating browser by polling, to the bot, or to any
   profile. Its plaintext is never stored in the database.
5. Return HTML immediately strips the fragment and retains the claim only in
   page memory. An explicit Return to Brave link uses Brave's documented scheme
   with a fixed canonical HTTPS completion URL and fragment. Another-browser
   fallback allows the user to copy this protected return link themselves.
6. Only the browser holding both independent proofs can prepare/confirm. Wrong
   cookies cannot burn the claim. After atomic consumption, failures require a
   fresh attempt rather than reviving a potentially used credential.

This separation prevents an attacker who forwards their own start link to a
victim from polling the victim's approval and signing in: the attacker has the
starting cookie but not the callback-only return claim. Conversely, the victim's
browser does not have the attacker's cookie. Bot messages also warn against
forwarded login links and request Telegram content protection.

## Security boundaries and limitations

- No invented Telegram OAuth deep links, `/crossapp`, native SDK parameters or
  unsupported bank/application schemes are used.
- LoginUrl uses `HMAC-SHA256(data-check-string, SHA256(bot-token))`, not the Mini
  Apps `WebAppData` secret or OIDC JWT verification.
- Return claims, browser secrets and callback signatures are not logged. Logs
  contain stage names only. Telegram's protocol necessarily sends the signed
  proof to its callback in a query; redirect immediately and suppress referrers.
- Return page: no-store, no-referrer, nonce-based CSP, no third-party scripts,
  no framing, no analytics and no external resources. All identity display uses
  text content; no Telegram-supplied HTML or remote image is rendered.
- Exact-origin checks and JSON bodies protect start/prepare/finish. Arbitrary
  callback or browser return destinations are never accepted.
- Tables have RLS and explicit revoked PUBLIC/anon/authenticated grants. RPCs are
  service-role-only SECURITY INVOKER functions. No transaction holds a lock
  across a Telegram or Clerk network request.
- Webhook update IDs deduplicate successful deliveries, concurrent retries wait,
  interrupted workers can recover after 60 seconds. Requests must have the
  configured secret header; only the private sender's `/start` is processed.
- Attempts expire after 10 minutes. Expired proof digests are retained for an
  additional 10 minutes and pruned on the next start; webhook IDs are retained
  for 48 hours. No public profiles or existing accounts are modified by cleanup.
- Brave may open another tab or the wrong private/normal cookie context. A
  cookie mismatch must fail closed; never offer an unbound “continue anyway.”
- A successful server callback is not physical-phone QA. Verify the real
  iPhone/Telegram/Brave path with user approval before claiming that handoff works.

## Primary references

- [Telegram bot start links](https://core.telegram.org/bots/features#deep-linking)
- [Bot API LoginUrl](https://core.telegram.org/bots/api#loginurl)
- [Login domain and HMAC validation](https://core.telegram.org/widgets/login/)
- [Telegram bot-button URL authorization](https://core.telegram.org/api/url-authorization#bot-button-url-authorization)
- [Webhook authentication and retries](https://core.telegram.org/bots/api#setwebhook)
- [Brave's own opening-link reference](https://github.com/brave/ios-open-thirdparty-browser)

Focused verification should cover wrong/missing cookie, wrong claim, a
forwarded start/button, duplicate query fields, stale/future/wrong-sender proofs,
duplicate webhook delivery, concurrent consumption, and missing confirmation.
No real identity or money is needed for these negative-path checks.
