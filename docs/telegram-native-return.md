# Telegram login recovery and app → browser return

## Current supported flow

Money Nerds starts every Telegram OIDC login at the documented
`https://oauth.telegram.org/auth` endpoint. Telegram's authorization page owns
any native-app launch and its phone-number fallback. The site does not request
native SDK tokens or launch `tg://` links itself.

The start endpoint creates random state and nonce, S256 PKCE, and an
authenticated/encrypted, HttpOnly, SameSite=Lax transaction cookie with a
ten-minute lifetime. The registered HTTPS callback remains
`/api/auth/telegram/oidc/callback`.

The callback requires that browser cookie and matching state, exchanges the
one-use code server-side with PKCE, and validates the ID-token signature, issuer,
audience, expiry and nonce. The stable Telegram identity, Clerk account creation,
and Clerk-to-Supabase profile mapping are unchanged. There is no security bypass
for a callback arriving in a different browser.

If Telegram stays open after approval, return to the **same browser tab** that
started sign-in. Automatic return is still a provider/browser limitation, not a
completed feature. The website cannot force a background browser to foreground.

## Withdrawn native handoff experiment

Commit `97b1305` used Telegram's first-party native SDK `/crossapp` endpoint from
a web client. The endpoint issued an opaque native link in an HTTP probe, but
that did not establish a supported web-client contract or a working physical
phone login. The user subsequently reported that Brave opened Telegram without
an authorization prompt, breaking login that previously worked.

The recovery removes that integration and restores the prior `/auth` startup.
The native link helper is removed. `native=1` no longer changes the flow;
`resume=1` returns HTTP 410 asking the user to start again. The client clears the
old `mn_telegram_pending_v1` sessionStorage hint, so it cannot reopen a cached
native attempt. Credentials, user identities, database data and the SBP feature
are not changed by this recovery.

The exact Brave/client rejection was not captured. A Telegram-issued OAuth deep
link is not necessarily malformed; the unsupported web use of a native SDK
endpoint was the integration mistake. A successful HTTP response alone must not
be used as evidence of app approval or return behavior.

## Safe diagnostic events

Server logs use `telegram_auth` with these stages:

- `start_issued`: browser authorization URL and transaction cookie issued.
- `start_failed`: startup failed.
- `callback_received`: callback reached the application; boolean flags report
  only whether the transaction cookie, code and state are present.
- `callback_rejected`: a fixed, non-sensitive rejection reason.
- `identity_verified`: Telegram's signed identity passed validation.
- `clerk_ticket_issued` or `clerk_ticket_failed`: account/session handoff result.

Logs must never include URLs containing auth data, codes, state values, cookies,
PKCE verifiers, native tokens, ID tokens, Clerk tickets or personal identifiers.
An empty server-error report does not prove that the native app handoff worked.
Telegram handles OAuth approval internally; a bot chat message is not required.

## Verification scope

Focused TypeScript, auth-file lint and diff checks cover the recovery. Production
checks should confirm `/auth` URLs for desktop and mobile, retirement of cached
resume requests, and rejection of invalid callbacks. Physical iPhone/Brave
approval and same-tab completion require a real user's Telegram session; do not
claim these passed based on HTTP probes or a narrow browser viewport.

## First-party references

- [Telegram web login and manual OIDC implementation](https://core.telegram.org/bots/telegram-login#manual-implementation)
- [Native iOS SDK setup and registration contract](https://github.com/TelegramMessenger/telegram-login-ios#2-setup-in-botfather)
- [Telegram client OAuth acceptance and external-browser return](https://core.telegram.org/api/url-authorization#oauth-authorization)
- [Telegram OAuth deep-link formats](https://core.telegram.org/api/links#oauth-links)
