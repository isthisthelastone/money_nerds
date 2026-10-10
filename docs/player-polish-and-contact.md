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
- [ ] Provision and verify Resend free-tier receiving for contact@moneynerds.online, set MX/DKIM/SPF records returned by the provider, verify delivery, then enable NEXT_PUBLIC_CONTACT_EMAIL_READY and redeploy.

## Actual email blocker

Vercel DNS is authoritative, but the domain currently has no MX records. Vercel does not host mailboxes. Marketplace discovery returned Resend email with a verified `free` billing plan (0.00). No provider resource or paid plan was provisioned.

The user explicitly authorized accepting Resend's free-plan terms. The CLI nevertheless refuses term acceptance by AI agents and requires the account holder to complete it directly; the in-app Vercel browser is also at its sign-in page. Do not bypass this guard or claim the inbox is live.

Account-holder action: sign in and accept https://vercel.com/vladislav-artiushkins-projects/~/integrations/accept-terms/resend?source=cli . Alternatively run `vercel integration accept-terms resend --scope team_s7MYu462z3d8TqkdH80B3K9H` directly in the user's terminal.

After confirmed acceptance, retry the existing intended resource once:

```sh
vercel integration add resend/resend-email --name money-nerds-contact --plan free -m domain=moneynerds.online -m region=eu-west-1 --no-claim --no-env-pull --scope team_s7MYu462z3d8TqkdH80B3K9H
```

Inspect installations/resources before retrying to avoid duplicate provisioning. Follow any Resend skill installed by Marketplace. Use only provider-returned DNS values, preserve website/search-verification DNS, verify receiving (not just sending), and only then enable public email actions. Resend's receiving dashboard can provide the inbox without forwarding mail to a personal address.

No authentication, funding, user profile, existing media or database-schema change is in this release. Git history is not rewritten; third-party cached copies of old pages are outside the live-site removal guarantee.

## Production verification

Implementation `4fa1577e2e39abea1798cba101a1f99a06059045` reached production READY as `dpl_ChA4bNcmtvxrCyeWdKeJP8Ac2CD9`, assigned to www.moneynerds.online in fra1. The three branches were pushed atomically, without rewriting history.

Seven routes (`/`, FAQ, safety, legal index, report, privacy and regional notices) × five locales returned HTTP200 with no old personal-contact string. None exposed an active mailto while readiness is off. The report page explicitly shows pending status and contains no form collecting reports for an inactive inbox.

Live desktop audio measured 448×73px, phone audio 313px at a 390px viewport, with the title fitting fully and no horizontal overflow. Circle diameter measured 212px, volume range 96px, and the speed pill's horizontal center matched its controls column. Seeking to five seconds and 0.5× playback worked. Lint, typecheck, build and the 684-phrase/969-message translation audit passed. No error/fatal server logs were returned for this deployment during the scoped ten-minute check; localhost-only Clerk origin errors were not treated as production failures.

An early speed-selection race was caught during live QA: media load could restore the browser's default 1× rate. The follow-up sets both defaultPlaybackRate and playbackRate so selection survives a source load/retry. Verify that follow-up's deployment before calling the player release finished.

Sources: [Vercel email setup](https://vercel.com/kb/guide/set-up-email-with-your-vercel-domain), [Resend receiving](https://resend.com/docs/dashboard/receiving/introduction), [Resend pricing](https://resend.com/pricing).
