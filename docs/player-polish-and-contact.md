# Player redesign and private-contact removal — 2026-10-10

## Requested scope

- Wider, lower-height audio player; readable voice-message title; less vertical padding; slimmer seek indicator.
- Desktop play control about 10% smaller, phone play control retained.
- Much smaller visual speed controls, centered on phones for both audio and video; keep all five existing rates and native accessible picker.
- Circle video and volume controls about 10–15% smaller.
- Smaller attachment remove/X control and tighter preview spacing; reduce cookie X visually without losing its larger touch area.
- Remove the personal email from current application source/docs and production contact surfaces. Establish contact@moneynerds.online through a real email provider, not just a changed label.

## State and evidence

- [x] Implemented shared centered 36×24px speed pill with invisible 44×44px native select hit target. Native picker semantics, localization, keyboard support and rates remain.
- [x] Audio desktop measured 448×73px (previously 230×103px), 6px vertical padding, readable 13px title, 40px play control; phone retains 44px play control.
- [x] 390×844 phone viewport: audio measured 313px wide, full title visible without truncation, no horizontal overflow. Playback at 2.5× and five-second keyboard seeking preserved. Browser-native speed value is overlaid with a consistently centered label instead of depending on native select alignment.
- [x] Circle target 212px (previously 240px); vertical volume range 96px (previously 112px). Compact right-hand controls stay centered.
- [x] All current source/documentation mentions of the old personal contact removed. Shared project-domain contact configuration now controls footer, FAQ, safety, report/legal pages and Malaysia's bilingual notice.
- [x] Email readiness defaults off. No nonfunctional mailto links or report collection while the inbox is inactive; setup-pending copy translated into all five UI languages.
- [x] Finish live desktop/phone layout and playback QA; push main/develop/master; confirm production READY and absence of the personal contact.
- [x] Provision Resend free-tier receiving for contact@moneynerds.online; add and verify provider-returned MX/DKIM/SPF records and a real neutral delivery.
- [x] Enable NEXT_PUBLIC_CONTACT_EMAIL_READY and confirm the production contact/report surfaces after redeployment.

## Contact email setup — acceptance completed

The account holder confirmed terms acceptance on 2026-10-10. The scoped CLI successfully provisioned `money-nerds-contact` with explicit `--plan free` and connected it to the existing Money Nerds project. No paid plan, replenishment threshold or personal-address forwarding was enabled. Vercel provides DNS; Resend provides receiving and sending.

Identifiers for safe continuation (do not provision a duplicate):

- Vercel project: `prj_B1sBZeomudxUYGba1NqXk75DrwMT`, team: `team_s7MYu462z3d8TqkdH80B3K9H`.
- Installation returned by provisioning: `icfg_K722R8uhjUyhZVt2yYps4uJP`; resource: `ir_dukNIWDbVRS4bgIu`.
- A direct, scoped Vercel configuration read confirms installation type `marketplace` and billing plan `free` / `Free`, cost `0.00`, no payment method required: 3,000 emails/month, 100/day, 3 domains.
- Resend domain: `00f4227d-1ce1-452a-8d5b-9d71746329c2`, `moneynerds.online`, `eu-west-1`.
- Provider API confirmed the domain and both capabilities enabled. Open/click tracking remains disabled. Vercel's integration-list views currently return empty despite successful provisioning and working connected credentials; do not interpret that as permission to create another resource.
- Credential is injected as server-only `RESEND_API_KEY`. Use `vercel env run -e production` for scoped administration without echoing or committing it; preserve existing local environment files.
- Marketplace installed provider skills under local `.agents/skills`; these and `skills-lock.json` are ignored as generated tooling.

Added the four provider-returned mail records and an initial non-enforcing DMARC record, preserving website, Clerk, search-verification and unrelated records:

| Name | Type | Purpose / ID |
| --- | --- | --- |
| `resend._domainkey` | TXT | Provider DKIM key; `rec_67ac5da95929265df5996dae` |
| `send` | MX | `feedback-smtp.eu-west-1.amazonses.com`, priority 10; `rec_cec3ef5dd25ef7ca40888331` |
| `send` | TXT | `v=spf1 include:amazonses.com ~all`; `rec_30776f18c65306b36b9ce87f` |
| apex | MX | `inbound-smtp.eu-west-1.amazonaws.com`, priority 10; `rec_8be254b408fd5e21c17150ca` |
| `_dmarc` | TXT | Initial non-enforcing `v=DMARC1; p=none`; `rec_c371a619277e06e8085276a3` |

Public DNS resolvers 1.1.1.1 and 8.8.8.8 return exact matches for all four provider-generated records. On 2026-10-10 at 10:37 UTC / 13:37 Moscow, Resend reported domain status `verified` and all four records `verified`, with sending and receiving enabled.

One neutral message was sent from/to the project address using idempotency key `money-nerds-contact/2026-10-10-check1`. Outbound ID `01a12564-0e8c-74a0-a144-5bc89fd83fbd` reports `delivered`; inbound ID `e600ad85-ab36-4b14-9b1c-57af2b7e6c1e` arrived at `2026-10-10T10:37:58.309Z`. The receiving API returned the expected recipient, subject and exact test marker in the actual plain-text body. No personal data, wallet funds, user posts or report submissions were involved.

Maintenance if interrupted: mailbox provisioning, readiness activation, branch pushes and production verification are complete. Do not provision another resource or send another verification message. Keep the provider API key out of the browser and source. Local `.env` files remain untouched and the template's readiness default stays false for unprovisioned installations. Verify the existing resource and inbox before changing DNS or readiness again.

Incoming emails can be read in Resend's dashboard → Emails → Receiving. This is not a Gmail/IMAP mailbox, automatic forwarding or an automated moderation system. Human inbox monitoring, responses and legal reporting operations still need an owner. No webhook or processing of arbitrary inbound email has been introduced.

Operational limits: the free plan's 100/day and 3,000/month allowance is shared by sent and received emails. Resend's published default email/log retention is 30 days; preserve necessary reporting records through an owner-approved retention process, not a promise of permanent provider storage. Dashboard access uses the integration's official Vercel SSO; the in-app browser blocked that SSO endpoint during setup, so no authenticated dashboard session was claimed. The configured API can still verify the exact neutral delivery without exposing credentials.

No authentication, funding, user profile, existing media or database-schema change is in this release. Git history is not rewritten; third-party cached copies of old pages are outside the live-site removal guarantee.

## Production verification

### Verified email activation

Commit `82faa8dac1c8a3f47e8fdab279aa571249b242a1` was pushed atomically to main/develop/master. `NEXT_PUBLIC_CONTACT_EMAIL_READY=true` is configured for production, preview and development. Production deployment `dpl_4kp8PtgioCuKAYK4xH3MrTTMbNEq` reached READY after a roughly 65-second build, assigned both www.moneynerds.online and the apex domain. The Git push did not trigger a build during a bounded check; the existing Git connection was then deployed through the scoped Vercel API with the exact main-branch commit. No local environment files were uploaded and no project/auth settings were changed.

All seven routes listed below × all five locales returned HTTP200: 35 checks confirmed active project-address mailto links, no pending-inbox notice and no old private contact. All report pages contain the form and all privacy pages disclose Resend. A fresh production browser confirmed an enabled Open email draft button, three project-address mailto links and the hydrated Sign in header. No legal report was submitted and no user's email application was launched; actual delivery was verified separately by the neutral provider message above.

Focused ESLint, typecheck and the translation audit passed (684 phrases, 971 reviewed messages, zero missing phrases or placeholder mismatches). No error/fatal server logs were returned in the scoped ten-minute production check. This verification does not certify unrelated security issues or jurisdiction-wide legal compliance.

### Player redesign release history

Implementation `4fa1577e2e39abea1798cba101a1f99a06059045` reached production READY as `dpl_ChA4bNcmtvxrCyeWdKeJP8Ac2CD9`, assigned to www.moneynerds.online in fra1. The three branches were pushed atomically, without rewriting history.

Seven routes (`/`, FAQ, safety, legal index, report, privacy and regional notices) × five locales returned HTTP200 with no old personal-contact string. None exposed an active mailto while readiness is off. The report page explicitly shows pending status and contains no form collecting reports for an inactive inbox.

Live desktop audio measured 448×73px, phone audio 313px at a 390px viewport, with the title fitting fully and no horizontal overflow. Circle diameter measured 212px, volume range 96px, and the speed pill's horizontal center matched its controls column. Seeking to five seconds and 0.5× playback worked. Lint, typecheck, build and the 684-phrase/969-message translation audit passed. No error/fatal server logs were returned for this deployment during the scoped ten-minute check; localhost-only Clerk origin errors were not treated as production failures.

An early speed-selection race was caught during live QA: media load could restore the browser's default 1× rate. Commit `7dc6267` sets both defaultPlaybackRate and playbackRate so selection survives a source load/retry; it reached production READY as `dpl_43nQZjT5AvXAZFDjujXazTmHxq6s`. The following hydration guard also prevents a native select accepting a choice before React's handler is attached. Its server state is disabled and visually muted; the client enables it when interactive, without adding listeners or timers.

Sources: [Vercel email setup](https://vercel.com/kb/guide/set-up-email-with-your-vercel-domain), [Resend receiving](https://resend.com/docs/dashboard/receiving/introduction), [Resend pricing](https://resend.com/pricing).
