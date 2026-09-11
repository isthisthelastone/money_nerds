# Experimental SBP: integration findings

Researched 2026-09-10. Scope: personal RUB transfers, not merchant acquiring.
No bank sign-in, transfer, payment creation, or authenticated bank API call was
performed. URL-format checks do not verify a recipient, an active collection,
the payer's bank compatibility, or successful receipt of money.

## Official C2C API exists, but is restricted

[NSPK's official API reference](https://sbp.nspk.ru/api/new/) contains the section
“Операции с Функциональными ссылками СБП для C2C для Участников СБП”. It explicitly
limits these methods to SBP participant certificates. The documentation added
the C2C methods on 2025-06-27.

- Create: `POST /payment/v1/c2c/payment-link/one-time-use`.
- Read: `GET /payment/v1/c2c/paymentdata/{qrcId}`.
- Status notification: `POST /payment/v1/c2c/payment-link/notification`.
- The creation example supplies recipient bank `memberId`, `payeeId`, `payerId`,
  amount in kopecks, optional payment purpose, expiry, and return URL.
- Expiry is 1–3600 seconds (default 10); this is not a permanent profile QR.
- The response supplies a registered `qrcId`, HTTPS `payload`, and optional QR
  image. Do not generate an identifier locally or substitute a phone in its place.
- C2C and merchant C2B examples both use `qr.nspk.ru`; host/ID shape alone cannot
  prove that an arbitrary pasted NSPK URL is a personal-transfer link.

The reference page above is the verified schema URL. No standalone downloadable
OpenAPI JSON/YAML URL was established. Money Nerds lacks participant integration;
do not call this an anonymous public API or claim C2C QR is impossible.

[NSPK's 2026 announcement](https://nspk.ru/press-center/details/061b4371-5ed9-45b6-94fe-2ea5a0958a9e)
also confirms C2C QR pilots with partner banks.

## Bank-issued links: verified versus unknown

### Alfa-Bank — exact shape documented

The bank's [2026 personal collection contract](https://alfabank.servicecdn.ru/site-upload/57/33/2365/dogovor_sbp-qr-code-6032026.pdf)
defines `https://web.alfabank.ru/public/mrv2/[encoded_id]` as a collection link,
where the bank creates the opaque identifier. This is the strongest supported
shape for a strict personal-collection allowlist: exact HTTPS hostname plus
`/public/mrv2/` and one nonempty opaque path segment. The contract does not specify
the identifier's character alphabet; do not assert an arbitrary regex is the
bank's standard.

The owner creates a collection in the bank. Donor opens its link, reviews the
recipient/collection, enters an amount, and selects SBP. The bank supplies a QR
and sender-bank choice. Its contract describes transfer to the bank for subsequent
credit to the recipient's collection account: it is a bank-hosted personal
collection service, not evidence of direct Money Nerds C2C API access.

### T-Bank — service and long route supported; short route not specified

[Official help](https://www.tbank.ru/bank/help/debit-cards/tinkoff-black/additional-options/request-and-collect/)
describes opening a collection and sharing its link or QR with clients of any
bank. [Official product page](https://www.tbank.ru/payments-and-transfers/fundraise/)
confirms separate collection accounts and explains that links stop working when
the collection closes; sender-bank fees can apply.

The bank's own [robots.txt](https://www.tbank.ru/robots.txt) lists the route
`/collectmoney/crowd/*/*/`. This supports the existence of a long two-segment
collection route on `www.tbank.ru`, but is not an API or contractual URL grammar.
Treat acceptance of this narrowly scoped route as a product implementation
decision, not bank-verified ownership or guaranteed SBP availability.

`https://tbank.ru/cf/<id>` and its `www` form occur in user-generated posts hosted
on the bank's site, but an official bank-authored format specification was not
found. They are observed short-link shapes, **not a verified published contract**.
Do not broadly allow generic bank shorteners, `/rm/`, legacy domains, or arbitrary
paths on the assumption that they necessarily mean a personal collection.

### Ozon Bank — product verified; exact link shape unknown

[Official QR product](https://finance.ozon.ru/promo/payments/qr-tips) and
[official workflow](https://finance.ozon.ru/blog/b2c/article/qr-kod-dly-chaevyh)
describe personal tips, donations and collections. The owner generates a QR in
Account → QR for top-ups. The donor scans, enters an amount, selects a sending
bank, and confirms in its app/page.

Neither accessible source established the exact issued URL host/path grammar.
**Do not invent an Ozon allowlist from its marketing-page URL, or allow all
`finance.ozon.ru` / `ozon.ru` / `qr.nspk.ru` links as personal transfers.** Add a
supported path only after examining a genuine owner-provided bank-issued link
and confirming its role against the bank's material.

The product currently states a 1.9% receiving fee from other banks unless the
recipient has Premium. Money Nerds taking no commission does not mean the bank
route is free.

## Implementation boundaries

- Prefer an exact, recipient-provided bank-issued collection URL. A local QR may
  encode that URL unchanged; the button opens the same URL. Sending-bank choice
  happens in the supported bank flow, not through guessed application schemes.
- Parse URLs; require HTTPS, exact allowlisted hostname/path, no credentials,
  custom ports, fragments, or ambiguous encoded separators. Unknown tracking or
  redirect query parameters should not silently broaden the allowlist.
- An allowlisted bank domain is not proof that the user owns the receiving
  account. Label details as recipient-provided and require confirmation in the
  bank. Never collect banking credentials on Money Nerds.
- Keep phone/link details behind server-side authentication and both users'
  experimental opt-ins, including APIs and QR handoff pages. QR is encoding, not
  encryption; an authorized viewer can still copy its contents.
- Where there is no supported bank-issued link, the last fallback is deliberate
  phone reveal/copy plus recipient-bank instructions. If a QR opens those
  instructions, label it “Open transfer instructions”, not “SBP payment QR”.
- No verified bank notification means no verified donation amount. Opening a
  page, showing a QR, or returning to Money Nerds must not update donation totals.
- Do not conflate C2C, merchant C2B and self-transfer Me2Me. They are distinct
  scenarios in [NSPK's explanation](https://sbp.nspk.ru/blog/zacem-nuzna-sbp).
