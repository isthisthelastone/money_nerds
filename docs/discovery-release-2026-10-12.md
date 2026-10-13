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
- [ ] Focused source/build and live browser checks; push three branches, deploy and verify.
- [ ] Notify relevant engines of changed public URLs and record acceptance separately from indexing.

## Continuation state — 13 October

All implementation files are now owned by the main agent; the earlier delegated workers are finished or interrupted. No worker should overwrite the release. Full lint passed. Slow local build/typecheck jobs were intentionally terminated; Vercel performed compilation (15.3s), TypeScript (15.5s), and the production build (44s) successfully. Translation audit: 687 phrases, 973 translated entries, no missing keys or interpolation mismatches. The production target was verified as `team_s7MYu462z3d8TqkdH80B3K9H` / `prj_B1sBZeomudxUYGba1NqXk75DrwMT`. All three branches were fast-forwarded together to `7c7e99ba77fc2564717eb7d78b91c366d5bb3ab3`.

Initial production deployment `dpl_BzJCtVdriqvdPQz3uuq8C9Y2ft4F` reached READY and acquired the canonical domain. All 35 guide routes passed language, canonical, hreflang, description and JSON-LD checks. RSS, sitemap, LLM references, redirects and Markdown passed. One real follow-up: HTML lost `Vary: Accept` after rendering. Declare the complete header union in Next configuration and recheck after the follow-up deploy. Four other audit failures were equivalent bare-origin/trailing-slash canonical URLs; the check now normalizes URLs.

Remaining sequence: push the Vary correction to all three branches, verify the Git-triggered production deployment, repeat the HTTP audit to resolve its reported failures, send one IndexNow batch, update the existing newsletter submission's stale language description, and record exact results below. Never report a submission as indexing or a readiness score as ranking. The readiness tool still returns its cached 12 October score; no fresh score is verified.

Browser automation disconnected on 13 October: its inventory returned no available browsers or native apps. Search Console/Bing sessions inspected on 12 October are evidence for the baseline above, not for new post-release submissions. Use direct HTTP checks and IndexNow if the browser remains unavailable; do not invent dashboard actions or screenshots.

## Sources and verification boundaries

Current primary guidance: [Google AI optimization](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [localized URLs](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), [pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading), [Bing AI performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/), [IndexNow](https://www.indexnow.org/documentation), [OpenAI crawlers](https://developers.openai.com/api/docs/bots).

Google's current guidance does not assign ranking benefit to llms.txt or require special AI schema. Keep factual machine-readable references synchronized with visible content. No new ranking, traffic, citation or donation improvement is established by source changes alone.
