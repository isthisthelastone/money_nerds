# Search and AI discovery release — 12 October 2026

## Objective and working state

Improve relevant organic discovery for Money Nerds: crypto crowdfunding, direct creator support, meme/art/build requests and mutual aid. The product does not mine or mint NFTs. Ranking first, indexing, AI recommendations and customer acquisition are independent outcomes; no forced rankings or fabricated authority claims are part of this implementation.

Work remains in the permanent checkout. Preserve existing Clerk/Telegram authentication, personal-data boundaries and translations. Push main/develop/master without rewriting history after focused checks, then verify production. No paid services or ads.

## Baseline observed on 12 October

- Google Search Console's existing verified domain property opens with the existing session. Overview reports **46 indexed pages, 118 not indexed and 0 web-search clicks**. These are owner-report values, not a claim about live rankings; the report interval/details are being inspected.
- Existing implementation already has SSR public posts, categories and profiles, sitemap, RSS, JSON-LD, crawler allowances, IndexNow and LLM reference files. September's release record documents successful Google/Bing sitemap setup and one disclosed Chinese newsletter submission; do not repeat ownership setup or duplicate that submission.
- Confirmed defects: English `/how-it-works` changes language with browser/cookie while declaring English hreflang; normal page-two feed canonical points to page one and is noindex; RSS uses a wallet address in the email-only author field; LLM references omit Vietnamese.
- Google indexing report last updated 9 October: 75 noindex URLs, 3 historical 4xx media URLs, 3 redirects, 33 discovered/not indexed, 4 crawled/not indexed. Sampled noindex URLs are profile page-size/filter combinations and correctly excluded. All three historical media URLs now return HTTP200, so this is not evidence of a current media outage.
- Google performance (3-month selection, available chart data 11 September–10 October): 26 impressions, 0 clicks, average position 25.6. Visible queries mostly do not represent the intended crowdfunding use case; no target-query ranking improvement is asserted.
- Bing search (3-month view through 11 October): 0 impressions and 0 clicks. Home recommendation flags too few inbound links from high-quality domains.
- Free Is Agentic baseline: **76/100**, scanned 12 October at 12:12:19 UTC, [report](https://is-agentic.com/scan/www.moneynerds.online). Main findings: no negotiated homepage Markdown; weak branded search; missing explicit fit guidance; incomplete organization contact/address; conventional contact URL not found. A real contact can be described; no postal address will be invented. A third-party readiness score is not search ranking or customer acquisition.

## Implementation checklist

- [x] Stable localized URLs and reciprocal hreflang for seven editorial guides, preserving homepage language detection and original UGC URLs.
- [x] Deterministic English guide routes and language-picker navigation; localized shared guide/footer links.
- [x] Substantive crypto-crowdfunding overview in English, Spanish, Simplified Chinese, Russian and Vietnamese, with actual supported assets, fees, steps and limitations.
- [x] Indexable self-canonical ordinary pagination; filtered variants remain excluded.
- [x] Valid RSS creator metadata and content-derived timestamps.
- [x] Update maintained LLM references, sitemap and owned project references; add exact factual entity links where useful.
- [x] Inspect current Google/Bing indexing, search and AI reports; record real results and address actionable exclusions.
- [x] Run free agent-readiness audit; implement negotiated Markdown and factual contact/fit information. A fresh score is not yet verified.
- [x] Focused lint, translation, production build and live HTTP checks; push three branches, deploy and verify. Browser automation was unavailable, so desktop/mobile visual QA is not claimed.
- [x] Notify relevant engines of changed public URLs and record acceptance separately from indexing.

## Continuation state — 13 October

All implementation files are now owned by the main agent; the earlier delegated workers are finished or interrupted. No worker should overwrite the release. Full lint passed. Slow local build/typecheck jobs were intentionally terminated; Vercel performed compilation (15.3s), TypeScript (15.5s), and the production build (44s) successfully. Translation audit: 687 phrases, 973 translated entries, no missing keys or interpolation mismatches. The production target was verified as `team_s7MYu462z3d8TqkdH80B3K9H` / `prj_B1sBZeomudxUYGba1NqXk75DrwMT`. All three branches were fast-forwarded together to `7c7e99ba77fc2564717eb7d78b91c366d5bb3ab3`.

Initial production deployment `dpl_BzJCtVdriqvdPQz3uuq8C9Y2ft4F` reached READY and acquired the canonical domain. All 35 guide routes passed language, canonical, hreflang, description and JSON-LD checks. RSS, sitemap, LLM references, redirects and Markdown passed. Four initial audit failures were equivalent bare-origin/trailing-slash canonical URLs; the check now normalizes URLs. A follow-up audit also verified that HTML and Markdown list the same public post IDs.

One real issue was Next.js overwriting `Vary` for HTML app pages. A framework configuration attempt did not fix it, matching the documented [upstream issue](https://github.com/vercel/next.js/issues/85852) and [proposed fix](https://github.com/vercel/next.js/pull/91039). The ineffective configuration was removed. A narrowly scoped Vercel project-level response transform now appends `Accept` after rendering. This preserves all framework navigation fields, and the personalized HTML remains private/no-store.

The content implementation is complete. Final housekeeping removes the ineffective Next header rule, saves the public-post parity check and this record, and fast-forwards all three branches. Verify the final Git-triggered deployment and check homepage negotiation after this documentation/config cleanup. Never report a submission as indexing or a readiness score as ranking. The readiness tool still returns its cached 12 October score; no fresh score is verified.

Browser automation disconnected on 13 October: its inventory returned no available browsers or native apps. Search Console/Bing sessions inspected on 12 October are evidence for the baseline above, not for new post-release submissions. Use direct HTTP checks and IndexNow if the browser remains unavailable; do not invent dashboard actions or screenshots.

## Delivery evidence — 13 October

- Content release `7c7e99b` and follow-up `0b27da3` were pushed atomically to main/develop/master without rewriting history. `dpl_Bnr3gMbgAvSQxe2EmpgMCE3mSKa7` reached READY with the canonical domain on `0b27da3`.
- Two bounded production audits confirmed all 35 editorial routes, deterministic language under conflicting preferences, five reciprocal hreflang links plus x-default, self-canonical URLs, descriptions and valid JSON-LD. Ordinary pagination is indexable; sort/size/language facets remain noindex. Unsupported guide languages return 404. Legacy language, contact and privacy redirects work. RSS and both LLM references return 200; sitemap contains every localized guide.
- The sole unresolved audit assertion was HTML `Vary: Accept`; after the project transform, direct live checks confirmed HTTP200 and `Vary: Accept` for HTML, Markdown, and HTML with lower-priority Markdown. HTML retains RSC/navigation Vary fields and `private, no-cache, no-store`; Markdown remains `no-store` and matches the public post list. Measured response sizes: HTML252KB and Markdown5.4KB; this is a payload measurement, not a promised ranking or page-speed score.
- Public IndexNow ownership key returned 200 with matching content. **One batch of 45 public canonical URLs was accepted with HTTP200 on 13 October at 13:51:11 UTC**. Acceptance does not establish indexing. Google/Bing already have the registered sitemap; no new dashboard submission or Google URL-inspection request is claimed this turn.
- Existing [Chinese newsletter submission](https://github.com/ruanyf/weekly/issues/11710) was updated in place: five-language support, new Chinese crowdfunding overview and localized safety link. AI-assistance disclosure was preserved. The issue remains a submission; editorial publication or leads are not established.
- Public GitHub repository description and relevant topics were updated. No paid services, ads, fabricated reviews, false traffic or mass posting were used.
- Scoped Vercel runtime error-log query for the initial content deployment returned no matching error entries in the tool's 50-minute window. This is not an end-to-end wallet, phone or funds-transfer check.

### Persistent Vercel header transform

Project route `191b21d8-bc51-45e6-8ae4-029cd91a74bb`, name **Homepage representation negotiation**, is published. It matches only the exact path `/` and appends response header `Vary=Accept`. Staged version `24a5cc7b-f2fa-4622-8f05-4c0717da0373` was inspected before publication; the project had no prior rules or unrelated staged changes. No redirects, authentication, cache policy or request payload transforms were added.

This rule persists independently of Git deployments. For a new Vercel project, recreate it with `vercel routes add 'Homepage representation negotiation' --src '/' --src-syntax equals --append-response-header 'Vary=Accept'`, inspect its diff, and publish for the verified project. Do not remove it while the deployed Next version still overwrites Vary; the focused live check will catch a regression.

## Sources and verification boundaries

Current primary guidance: [Google AI optimization](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [localized URLs](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), [pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading), [Bing AI performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/), [IndexNow](https://www.indexnow.org/documentation), [OpenAI crawlers](https://developers.openai.com/api/docs/bots).

Google's current guidance does not assign ranking benefit to llms.txt or require special AI schema. Keep factual machine-readable references synchronized with visible content. No new ranking, traffic, citation or donation improvement is established by source changes alone.
