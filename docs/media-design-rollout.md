# Media and design rollout — 2026-10-08

Requested: balanced language-select chevron spacing; cookie dismiss X = necessary-only and 50% opacity while scrolling; compact/reliable audio; video volume beside circle; audio/video speeds 0.5/1/1.5/2/2.5; smaller media uploads; free-tier geographic performance.

## Work plan

- [x] Select spacing and cookie interaction (passive, cleaned-up scroll listener; full opacity on focus/hover).
- [x] Playback timing, retry/cancellation, metadata, five speeds, video volume, compact audio.
- [x] Capture bitrate/resolution limits, WebM duration repair, stored duration hints, best-effort local file compression with safe fallback.
- [x] Free-tier region close to Frankfurt DB; lazy media loading; cache expiry and privacy-preserving delivery.
- [x] Type/lint/build + focused browser/API QA on desktop/mobile viewport, then push main/develop/master and verify production READY.

## Baseline evidence

- Published media duration_seconds values are null, including the affected WebM voice note.
- Voice-note browser duration is Infinity (UI shows unknown total); native element is readyState 4.
- MediaRecorder has no bitrate options and requests 720px camera dimensions.
- Production media redirect x-vercel-id includes fra1::iad1: origin compute is in US, database eu-central-1.
- Media bucket is private. Keep staged/private data protected and never publish the whole bucket for performance.

## Limits

Hobby permits one Node function region, not worldwide multi-region compute. Supabase Smart CDN is paid; no paid resources will be enabled. Existing recordings must not be overwritten. iOS programmatic element volume support needs a Web Audio gain fallback where available, with device-volume instructions if unavailable. Physical-phone camera permissions and real signed-in upload still need an actual device/account; do not claim those were tested.

## Focused QA evidence

- Compact voice player measured 230px wide (previously 384px); 390px mobile viewport has no horizontal overflow. All five speeds are selectable; audio/video native playbackRate changes verified.
- Existing WebM voice note now shows its measured 6.900s total and advances/seeks correctly. Three existing videos also had their previously null duration/dimension hints populated from the published recording, preserving all bytes and existing metadata.
- Deliberately missing local media produces a retry message; retry refreshes the stable media URL with a cache-busting query instead of reusing an expired signed redirect.
- Cookie X closes the panel via the existing necessary-only save flow. Its target is 44px; scrolling uses a passive listener with timer/listener cleanup.
- Synthetic 2s WAV audio: 192,044 → 12,602 bytes (93% smaller). Synthetic high-bitrate video: 926,413 → 283,899 bytes (69% smaller), 480×480, finite duration. Results vary with content/codecs.
- Native short-video fallback: 963,413 → 520,747 bytes; decoded output audio peak 0.963 confirms the audio track survived.
- Capture targets: mono audio 48kbps; video 450kbps, 24fps, ideal 480px. Browsers treat bitrate constraints as hints. File optimization is local/lazy, prefers AAC/H.264 MP4, otherwise Opus/VP8 WebM; retains the original unless output is at least 10% smaller. Conversion is bounded to 30s; native fallback only handles clips up to 20s. Unsupported codecs, interruption and failed conversion preserve the original.
- Published media route keeps the bucket private, bounds Vercel cache to 240s, and extends signed playback URLs to one hour. User-specific routes are not given public caching.

## Production release verification

- Implementation commit `dbefdf7d7610679a9e684402d5edec95f19f2b94` pushed atomically to main, develop and master without rewriting history. Production deployment `dpl_2cKK4h4jDEdnHcG7gTLxysSEvJbp` reached READY, with www.moneynerds.online assigned and region fra1.
- Production `/p/97`: voice duration 0:06; keyboard seek to 0:05; playbackRate 0.5, readyState 4, no media error. `/p/102`: video completed playback, elapsed/remaining correct, 30% volume, playbackRate 2.5, readyState 4, no error. Fresh browser error/warning logs were empty for these checks.
- Actual rendered viewport dimensions verified at 1280×720 (desktop) and 390×844 (phone layout), with no horizontal page overflow. Language chevron inset is 13.6px, equal to left text inset, with 38.4px total right padding for the arrow.
- Initial home view: off-screen audio/video elements have no src. Repeated public media redirect requests returned CDN HIT with fra1::fra1 routing; final recording supports HTTP206 range requests and anonymous CORS.
- Necessary-only settings returned HTTP200 and the privacy cookie; the X closed the banner. Missing media returns 404 and unsigned upload-signing returns 401. No staged/private asset was made public.
- Lint, typecheck, production build and translation audit passed (683 source phrases, 967 reviewed messages, no missing/mismatched translations). The temporary synthetic-media QA page and diagnostic logging were removed before shipping.
- No real post, comment, donation or uploaded user media was created for QA. Physical-device recording permissions and iOS gain behavior remain unverified. Existing GitHub Dependabot alerts are not a completed security audit and were outside this focused release.

## Reference decisions

- [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region): one Hobby region; use fra1 near the Frankfurt database, while the existing global CDN handles static delivery.
- [Supabase Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn): paid-tier feature, deliberately not enabled.
- [HTML media volume](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume): limited browser support; retain mute/device-volume fallback rather than promise unsupported iOS behavior.
