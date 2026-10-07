# I18n and jurisdiction rollout — resumable work log

Started: 2026-09-15. Resumed: 2026-10-07. Status: **technical release deployed and runtime-verified. Legal operational requirements remain documented, not fabricated.**

## Scope (do not drop any item)

- [x] Detect interface language from explicit choice, saved account preference/user metadata, browser language and coarse IP-country fallback; English is fallback.
- [x] Five interface languages: English, Spanish, Simplified Chinese, Russian, Vietnamese. Translate site-owned visible text, accessibility text, errors, metadata, dates/numbers, legal UI and auth UI. Never translate user posts/comments/nicknames or the Money Nerds brand.
- [x] Persistent accessible global switcher with flags **and native language names**, in desktop header, mobile navigation, footer, site settings, account menu (five entry points). Language is not nationality or jurisdiction.
- [x] Optional author-declared post language; existing posts remain untagged. Independent customer feed language filter, retained across category/sort/page changes.
- [x] Replace 6/12/24 page sizes with conventional, researched, consistently supported options; keep SSR pagination, bounded requests and useful empty/out-of-range handling.
- [x] Separate jurisdiction selection/detection from language: EU (all 27 member countries individually), USA, Russia, Singapore, Malaysia; neutral global fallback and manual correction. IP location is an estimate, not proof of legal residence.
- [ ] Research primary current legal sources separately for each block/country. Document applicable vs conditional requirements and unresolved operational dependencies.
- [ ] Implement factual terms, privacy, cookies/storage, country notices, consent/preferences UI, footer access, rights/reporting contact workflow and necessary controls. No invented operator identity, address, company number, DPO, retention promises or claim of immunity from lawsuits.
- [x] Store signed-in preferences in Supabase with ownership enforced; keep auth/Telegram and existing user data safe. Additive post-language migration and verified production migration only after review.
- [x] Complete translation-key/coverage audit and focused desktop/mobile-width runtime QA including auth UI, posting, funding, media, profiles, settings, legal UI, metadata and filters. Do not claim real phone/bank/wallet testing without doing it.
- [x] Review diff, commit, push main/develop/master without rewriting history, deploy Vercel, verify production. Report any genuine legal/operational blockers plainly.

## Current progress and exact resume point — updated 7 October 2026

Implemented: five-language server/client catalogs (962 entries per non-English language, 679 explicit usage keys audited), metadata and Clerk localization, automatic browser/account/IP fallback, five global switcher placements plus direct flag buttons, independent legal country/settings, post-language selection/filtering, 10/25/50 sizes in feed/profile, consent/refusal/revocation/GPC controls, translated wallet chooser, terms/privacy/cookie/regional/report pages and Malaysia BM/EN supplement.

Production Supabase migrations applied and verified:

- `20261007201225 optional_post_language` (local file `20260915193302_optional_post_language.sql`).
- `20261007201227 private_locale_preferences` (local file `20260920182624_private_locale_preferences.sql`).

Verified: 49 existing posts retained; all remain untagged; post_cards invoker security retained; preference table RLS enabled with no anon/authenticated access; publication wrapper callable by service_role only. Security advisors showed only the pre-existing managed Postgres patch warning and unused Supabase-password protection warning, no new schema findings.

Local checks: TypeScript, ESLint and production build passed; runtime script passed five language HTML/metadata/filter checks, legal pages, settings/profile/guide routes, locale cookie persistence, invalid input/origin rejection, privacy opt-in/refusal/revocation, GPC and view endpoint refusal without consent. Browser switching Vietnamese→Spanish and Spanish navigation persistence passed; mobile-width settings/country save passed. Wallet-list SSR mismatch was found and fixed by rendering only on opening. Production runtime script passed the same five-language, route, filtering, guest-cookie, origin, GPC and consent checks. Fresh production browser confirmed Russian switching, language persistence, mobile settings/header fit and privacy-control reopening, with no captured console errors.

Release commits: `2e13830` (main feature) and `a02f9da` (translated error/404 pages), pushed atomically to main/develop/master. Production deployment `dpl_Bxd1M78iyGQsRFzxL218ftpPPRey` was READY on the canonical domain. No pending application implementation work is recorded for this release. Do not repeat already-applied migrations.

Remaining verification limits: account-backed preferences/publication were inspected and schema privileges verified, but a real newly signed-in account was not used in this run; no physical-phone camera, real wallet transfer or bank payment is claimed. Supplemental legal translations are drafts requiring qualified review. Follow `docs/legal-launch-blockers.md` for operator facts, infrastructure, country-specific scope and staffed moderation rather than calling the service universally compliant.

Current legal evidence: `docs/legal-jurisdiction-research.md`; remaining real operator/infrastructure/staffing requirements: `docs/legal-launch-blockers.md`. They are not permission to claim universal compliance.

### Earlier interrupted work (historical, no agents currently assigned)

Repository is `/Users/happinesshater/Documents/Projects/Money Nerds`; AGENTS.md read.
Starting commit: `cf08200` (share-preview fix). Working tree clean at task start.

Parallel work:

1. `legal_eu_us`: primary-source EU+US research → `docs/legal-eu-us-research.md`.
2. `legal_ru_sg_my`: primary-source Russia/Singapore/Malaysia research → `docs/legal-ru-sg-my-research.md`.
3. `post_language`: owns models/data/home/composer/post API + additive migration, no production apply yet → `docs/post-language-implementation.md`.
4. Main agent: i18n architecture, saved language/jurisdiction preferences, global language controls, then complete translation rollout and legal implementation.

Before resuming: read this file, `git status --short`, the three research/implementation docs if present, and the latest changed files. Do not clone another checkout. Never re-run a production migration blindly; inspect migration history first. Do not touch `.env*.local`, `.vercel`, or secrets.

## Decisions and safeguards

- Browser language preferences outrank coarse IP-country hints, because people travel and use VPNs. Explicit choices always win.
- Use 🇬🇧 English, 🇪🇸 Español, 🇨🇳 中文, 🇷🇺 Русский, 🇻🇳 Tiếng Việt as requested; flags are decorative, native labels are the accessible identity. These are interface shortcuts, not legal-region selectors.
- Legal country remains independently selectable and all regional notices remain accessible. Changing locale must never silently waive rights/change governing law.
- Free APIs/edge headers only; do not add a paid geo vendor or expose/store raw IP just for language detection.
- Unverified operator facts cannot be fabricated. Draft public disclosures must match deployed behavior; operational/legal requirements are tracked explicitly, not disguised by boilerplate.
- Existing stable Telegram→Clerk→Supabase identity mapping is out of scope to alter.

## Evidence / references

- [W3C language declarations](https://www.w3.org/International/questions/qa-html-language-declarations)
- [W3C multilingual authoring](https://www.w3.org/International/techniques/authoring-html.en?open=charset)
- [Vercel request geolocation headers](https://vercel.com/docs/headers/request-headers)
- Additional primary legal/pagination sources are recorded in the parallel research documents.

## Remaining prerequisites (must not be called a compliance certification)

- Native legal-translation/counsel review and national scope/operational assessment remain.
- Actual operator identity and some legally required operational details are unverified.
- Russia localization/cross-border and country-specific financial regulation applicability require source-backed review before any compliance claim.
- Deployment and focused production QA are complete. Operational/legal clearance remains separate.
