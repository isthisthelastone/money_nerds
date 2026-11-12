# Root landing recovery — 12 November 2026

## Cause and recovery

The homepage route was present. Direct requests showed:

- `https://moneynerds.online/` redirected with HTTP308 to the canonical `www` domain.
- `/` and `/?page=2` returned HTTP500; `/how-it-works` returned HTTP200.
- Vercel logs showed `Unable to load site statistics: TypeError: fetch failed` and the equivalent feed error. Both data requests were awaited before the homepage introduction could render.
- The existing Supabase project `hqluarhwllbisizcirhg` (`money-nerds`, eu-central-1) was `INACTIVE`. Only this project was restored; the unrelated project was left alone. Restoration returned success and progressed through `COMING_UP` to `ACTIVE_HEALTHY`.
- A read-only database query returned 49 posts and 12 profiles. After restoration, the existing production homepage returned HTTP200 with its hero and ten post links. The browser also showed the board again.

No schema, access policy, identity mapping, credentials, billing plan, or domain routing changes were required. Supabase documents possible inactivity pauses on the Free plan; the exact automatic pause trigger was not separately audited.

## Published change

- Keep the responsive interactive coin hero and add a translated mission/benefits section: direct peer support, zero platform commission, public accountability, and a clear network/bank fee caveat.
- Stream the public introduction independently of posts/statistics using a Suspense boundary.
- Handle feed and statistics failures independently. A failed feed shows a retry notice rather than a false empty-board message; failed statistics show unknown values rather than fabricated zero totals.
- Preserve feed filters when retrying and only redirect out-of-range pages after a successful count.
- Keep category pages focused on their category without the welcome section. Localize the hero and introduction guide links.
- Add translated loading/outage messages in all five supported languages and a root-landing assertion to the existing discovery audit.

## Verification

Focused ESLint and TypeScript checks passed. The translation audit reported 692 phrases and 978 translated entries, with no missing keys or placeholder mismatches. Generated development type-reference changes were reverted; local development servers were stopped.

Local HTTP fault injection hit machine watcher limits, then the local Clerk development handshake/proxy loop. No production authentication changes were made to bypass it. A focused VM harness executed the actual transpiled HomePage/PublicBoard functions with real React elements and pure helpers, stubbing infrastructure/UI only. It passed both-data-failed, stats-only-failed, feed-only-failed, empty-success and successful out-of-range scenarios. The landing element tree was produced before any feed/statistics calls; retry preserved filters, unavailable totals were em dashes, healthy data remained visible and a failed count never redirected. This checks component behavior, not HTTP streaming/auth. Production browser/HTTP results are reported in the completion response. Wallet transfers, sign-in, and physical-phone permissions are outside this repair's verification scope.

Deployment target: Vercel team `team_s7MYu462z3d8TqkdH80B3K9H`, project `prj_B1sBZeomudxUYGba1NqXk75DrwMT`, canonical domain `www.moneynerds.online`. Fast-forward main/develop/master together, preserve the existing homepage response-header transform, and verify the live root after the Git-triggered deployment.

Reference: [Supabase production availability](https://supabase.com/docs/guides/deployment/going-into-prod#availability).
