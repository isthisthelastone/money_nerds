# Telegram app → browser return

The normal Telegram OIDC authorization page uses a browser polling flow. Approving
its login prompt can leave the user in Telegram. Money Nerds cannot navigate a
browser while another native application is in the foreground.

## Mobile flow

1. Money Nerds creates the same OIDC transaction as before: random state and nonce,
   S256 PKCE, and an authenticated/encrypted, HttpOnly, SameSite=Lax cookie. The
   registered HTTPS callback stays `/api/auth/telegram/oidc/callback`.
2. On mobile devices the start endpoint additionally requests a native URL from
   `https://oauth.telegram.org/crossapp`, with the same authorization parameters.
   This is the endpoint used by Telegram's first-party native SDK. Money Nerds
   does **not** set `ios_sdk`, `android_sdk`, app IDs, or custom callback schemes.
   An explicit **Use the Telegram app** action opts into the same flow on desktop
   or when mobile detection misses a device. The primary desktop action retains
   the documented browser flow. **Start again** in the native controls creates
   another native attempt, preserving that explicit choice.
3. Only a validated Telegram-issued OAuth deep link is opened, verbatim. Telegram
   owns approval and the return to the registered browser callback. No native
   token is invented from a client ID, redirect URI, or OAuth state.
4. A visible **Continue in browser** link keeps the original documented `/auth`
   URL, state, nonce and PKCE challenge. A provider error, timeout or unexpected
   response also falls back to that documented flow.
5. The page can restore its pending controls after reload using
   `/api/auth/telegram?resume=1`. This decrypts the existing transaction cookie;
   it does not issue a new transaction or extend its ten-minute expiry. Only an
   expiry timestamp is stored in sessionStorage, never a native token, code,
   verifier, ID token or Clerk ticket. Resume never automatically reopens the app.

The existing callback still requires the browser cookie and matching state,
exchanges the one-use code server-side with PKCE, validates the ID-token signature,
issuer, audience, expiry and nonce, and uses the stable Telegram identity and
Clerk-to-Supabase profile mapping. There is no callback security bypass for an
alternate browser. Users must finish in the browser that started sign-in.

## Provider contract and limitations

`/crossapp` is present in first-party SDK source, but is **not** part of Telegram's
documented web OIDC discovery contract. On 2026-09-11, unauthenticated probes using
our registered HTTPS web callback and code-flow parameters returned HTTP 200 with
`{ "url": "tg://resolve?domain=oauth&startapp=…" }`, without native SDK flags or
native app registrations. No account approval or token exchange was performed.
This validates issuance, not an end-to-end iPhone login.

The same probe included both a random `state` and a nonce. Telegram accepted the
request but returned only an opaque URL, so an unauthenticated probe cannot prove
that it echoes state in the callback or includes nonce in the signed ID token.
Those remain mandatory in our unchanged callback; a dropped/mismatched value
fails closed. The first-party SDK documents direct return, but its native-app
example does not establish that every web-client configuration behaves identically.
Likewise, its response contains no match-code/emoji data; any unexpected Telegram
match-code prompt must use the documented browser fallback, not guessed codes.

The endpoint has no CORS allow-origin header, including when sent our registered
Origin. It is therefore requested server-side. The actual browser User-Agent is
forwarded so Telegram can identify the returning browser; the approval screen's
IP/location may instead reflect our hosting server. We do not forge forwarded-IP
headers. Provider unavailability cannot disable the normal browser login.

Telegram's client documentation says to open an accepted URL in the external
browser, preferably the originating browser, **when the accepted result includes
a URL**. Without one, Telegram shows a success message. Our website cannot force
OS app switching or guarantee the behavior of every Telegram/browser version.
The fallback is explicit, preserves the transaction, and may require approval
again in Telegram's browser flow. It does not claim to recover an authorization
code that Telegram never delivered to our callback.

Physical acceptance still needs a user with Telegram installed to approve:
iPhone Safari, iPhone non-default browser, Android Chrome, Telegram absent,
cancelled/expired prompt, page reload, and return to the original post. Never
claim these were tested based only on a browser-width simulation or provider
HTTP probes.

## First-party evidence

- [Telegram Login and manual OIDC flow](https://core.telegram.org/bots/telegram-login)
- [Telegram client OAuth acceptance and external-browser return](https://core.telegram.org/api/url-authorization#oauth-authorization)
- [Telegram OAuth deep-link formats](https://core.telegram.org/api/links#oauth-links)
- [Official iOS SDK cross-app request](https://github.com/TelegramMessenger/telegram-login-ios/blob/main/Sources/TelegramLogin/TelegramLogin.swift#L203)
- [Telegram iOS opens the accepted URL in the originating external browser](https://github.com/TelegramMessenger/Telegram-iOS/blob/master/submodules/TelegramUI/Sources/OpenResolvedUrl.swift#L1924)
