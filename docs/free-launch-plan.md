# Free discovery and first-user launch plan

Research snapshot: 2026-09-12. This is a launch checklist, not a claim that submissions, account verification, or outreach have happened. No paid ads, paid directories, bought links, or automated community posting are needed. Organic discovery still requires useful content, working onboarding, and sustained human participation; neither indexing nor users are guaranteed.

Operational update, 2026-09-14: Google Domain ownership is verified; Google successfully fetched the submitted sitemap and reports 70 discovered URLs (not 70 indexed URLs). Search generative AI inclusion is enabled. Bing's existing verified property accepted the canonical sitemap and shows Processing, with zero reported sitemap errors. The original audit/checklist below is retained as history. See [the expanded research](zero-budget-growth-research.md) for the multilingual evidence review and measurement plan.

## What the audit established

- The public [homepage](https://www.moneynerds.online/), [robots.txt](https://www.moneynerds.online/robots.txt), [sitemap](https://www.moneynerds.online/sitemap.xml), and [llms.txt](https://www.moneynerds.online/llms.txt) returned HTTP 200. The homepage had a canonical URL and no `X-Robots-Tag` blocking indexing. The sitemap contained 70 URLs at the time of inspection, without settings, API, or private SBP URLs.
- A public search for `site:moneynerds.online` returned no results through the available search tool. Direct Google and Bing result pages could not be inspected. This is **not proof that either engine has indexed zero pages**; owner-side Search Console and Bing reports are the next diagnostic.
- No Google or Bing verification meta tag was visible in the homepage at that time. DNS/file verification or an existing owner account may nevertheless exist.
- The repository already had server-rendered public posts, category canonicals, profile and discussion structured data, a sitemap, RSS, crawler rules, and plain-text LLM guides. New implementation work must be verified after deployment, not assumed live from local source.

## Priority 1: make discovery convert into real use

Before a launch announcement, complete a real iPhone sign-in and first-post attempt with the owner. Public browsing must remain possible without login. Clearly explain what a donor sees, which chain/token they are sending, and that zero platform commission does not mean zero network/provider fees. Describe privacy, moderation, irreversible transfers, and the limits of verifying another person's story.

Invite a small initial group of people the founder actually knows to try genuine art, build, meme, or mutual-aid posts. Ask permission before sharing their post elsewhere. Do not fabricate users, requests, donations, medical emergencies, testimonials, or activity to make the board look populated. Initial successful usage is more valuable than sending a large audience into broken onboarding.

## Priority 2: free technical discovery

1. Keep important public content in server-rendered text with normal links from home, categories, and related guides. Use one canonical for each public page; exclude private settings, auth callbacks, personal SBP information, and redundant filter variants from discovery.
2. Maintain short, useful public guides: how direct funding works; supported networks and token selection; checking a transaction; writing a clear request; and safety/privacy. Answer actual user questions, link to the relevant product screen, and keep claims synchronized with working features. Do not generate hundreds of near-identical cryptocurrency or location pages.
3. Use `DiscussionForumPosting` only for genuine user discussions. Text-only posts need the supported `text` content property, not just `articleBody`; include real author/date information and only visible, accurate interaction counts. Publisher-written guides are not forum posts. [Google's discussion schema requirements](https://developers.google.com/search/docs/appearance/structured-data/discussion-forum).
4. Moderate spam and qualify user-supplied external links with `rel="ugc"`; do not sell ranking links or create doorway pages. [Google outbound-link guidance](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links), [spam policies](https://developers.google.com/search/docs/essentials/spam-policies).
5. Allow `OAI-SearchBot` and its verified published IP ranges through robots and hosting controls. This is the search crawler; `GPTBot` training permission is a separate choice, while `ChatGPT-User` is user-initiated fetching rather than the search indexing crawler. A request with a spoofed user agent does not prove the real crawler gets through. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).

There is no special Google AI schema or mandatory `llms.txt` file for AI Overviews/AI Mode. An indexed, snippet-eligible, crawlable page with helpful visible content is the foundation. Keep the existing LLM files as factual supplementary guides, not a promised ranking mechanism. [Google's AI search guidance](https://developers.google.com/search/docs/appearance/ai-features).

## Priority 3: establish search ownership and change notifications

| Service | Exact next action | Account/access needed | Completion evidence |
| --- | --- | --- | --- |
| Google Search Console | Add Domain property `moneynerds.online`; install the exact DNS verification record Google supplies. Alternatively add URL-prefix `https://www.moneynerds.online/` and install its exact homepage meta tag or HTML file. Click Verify, submit `https://www.moneynerds.online/sitemap.xml`, and inspect home, a category, a guide, and a real post. | Owner's Google account, plus DNS access for Domain verification or deployment access for URL-prefix verification. | Verified property, accepted sitemap, and URL Inspection results; not merely a tag in source. |
| Bing Webmaster Tools | Import the verified Google property and sitemap, or use Bing's own DNS/XML-file/meta verification. Submit the same sitemap and review crawl/index reports. | Owner's Microsoft/Google-compatible account; verified Google access if importing. | Verified site and crawl/index reports. |
| IndexNow | Generate a random protocol-compatible key; serve the exact key in a UTF-8 file on the canonical host. Notify a participating endpoint about newly public, meaningfully changed, or deleted canonical URLs. Keep keys/host/URLs consistent. | Deployment control of the website; no Google or Microsoft personal account is required by the protocol. | Public key verification plus accepted notifications. HTTP 200 means received, not indexed; 202 means verification is pending. |

Verification tokens are account-specific: do not invent them or claim ownership setup is finished without the console result. A code hook for optional verification metadata can be prepared before the owner supplies a token. Domain verification covers subdomains/protocols; URL-prefix verification is limited to its prefix. Keep verification records in place. [Google ownership methods](https://support.google.com/webmasters/answer/9008080), [Bing Search Console import and alternatives](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools).

IndexNow is a change notification protocol, not a Google indexing submission or a traffic guarantee. Submit public post/category updates in bounded batches, not on every view or like; never submit private auth/SBP URLs. Avoid re-announcing the entire sitemap on every request. Accountless IndexNow does not replace owner-side diagnostic dashboards. [IndexNow protocol](https://www.indexnow.org/documentation), [Bing's IndexNow dashboard](https://www.bing.com/webmasters/help/indexnow-0z209wby).

## Priority 4: a small, rules-aware launch

These are candidate channels, not permission to publish an identical pitch everywhere. Recheck current rules when posting, disclose that you built Money Nerds, use the owner's genuine account, and answer feedback yourself. No signups or external posts were made during this research.

| Channel | Suitable contribution | Rules and prerequisites |
| --- | --- | --- |
| [Product Hunt](https://www.producthunt.com/) | Launch the working web application, with screenshots of browsing, creating a post, and choosing a funding network. Explain the product rather than asking for donations. | Launching is [free; ads are optional](https://help.producthunt.com/en/articles/7950405-ad-campaigns). A personal account must complete onboarding; a paid hunter is unnecessary. Prepare the direct URL, accurate pricing, a 240×240 thumbnail, and at least two gallery images, recommended 1270×760. [Posting guide](https://help.producthunt.com/en/articles/479557-how-to-post-a-product). Featuring is editorial, not guaranteed. [Featuring guidelines](https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines). |
| [r/sideprojects](https://www.reddit.com/r/sideprojects/) | One disclosed maker demonstration asking a specific UX or trust question, with a useful screenshot and link. | The [moderator rules announcement](https://www.reddit.com/r/sideprojects/comments/1ld5xve/my_side_project_rsideprojects_new_rules_and_an/) permits project announcements, requires significant changes before reposting, prohibits astroturfing and DM-bait advertising, and requires an appropriate post flair. Read the current sidebar before submitting. |
| [r/SideProject](https://www.reddit.com/r/SideProject/) | Secondary feedback candidate: a real product demonstration, not a fundraising appeal. | Its public feed is explicitly for sharing side projects, but the complete current posting restrictions were not exposed to this audit. Check signed-in rules/flair requirements first; do not assume posts from other users imply unrestricted promotion. Skip if rules cannot be confirmed. |
| [DEV Community](https://dev.to/) | A complete technical article about separating social identity from payment destinations, or securely verifying direct donations. Include useful code/tradeoffs and a disclosed project link. | The [terms, section 11](https://dev.to/terms), require substantive, relevant content, not primarily promotional or thin link-only posts. The [code of conduct](https://dev.to/code-of-conduct) requires disclosure of AI assistance. A generic launch advertisement is not the recommended format. |

Do not cold-post a pitch in r/solana: a [2026 moderator notice](https://www.reddit.com/r/solana/comments/1ui96oe/removed/) explicitly rejects project promotion and crypto begging. Seek moderator permission for a genuinely relevant contribution, or skip it. The old `solana-labs/ecosystem` repository is archived; its historic submission link is not a verified current directory workflow.

Show HN is also conditional, not an automatic launch target: its [rules](https://news.ycombinator.com/showhn.html) exclude fundraisers and landing pages. Only consider a working software demonstration that actually fits. Additionally, [HN prohibits generated or AI-edited text](https://news.ycombinator.com/newsguidelines.html), so the founder must write any submission independently; do not publish an agent-written HN pitch.

Keep the project's own GitHub README useful: live URL, honest feature status, screenshots, safety model, and contributor instructions. This can help interested developers understand and share the project without buying directory placement. Do not mass-open unrelated repositories' issues to advertise.

## A practical first month

- **Days 1–3:** complete mobile onboarding, ship factual public guides, configure available owner verification, and establish a baseline of indexing and sign-in success.
- **Week 1:** invite a small consenting group to create real posts; observe where first-time readers hesitate. Improve explanations before broad promotion.
- **Week 2:** publish one rules-compliant feedback post in a suitable maker community. Launch on Product Hunt when the product can be tried successfully. Stay available for replies; do not solicit coordinated votes.
- **Week 3:** publish one substantive DEV engineering article if there is a real lesson worth sharing. Ask real users whether they want to share their own posts with their existing communities.
- **Week 4:** compare which sources brought people who actually signed in, posted, or funded. Fix the largest drop-off, update guides from real questions, and repeat only the channels that produced useful participation.

Measure organic landing visits, successful sign-ins, first posts, funding intents, independently verified donations, and returning users. Use aggregate, privacy-conscious analytics; never put phone numbers, emails, wallet addresses, or auth tokens into campaign parameters/events. Record network-specific donations accurately rather than adding unlike currencies as one amount. Search impressions and bot visits are diagnostics, not proof of product adoption.

The next meaningful milestone is a stranger finding a useful public post, signing in successfully on their device, and completing a real action—not a nominal “SEO score,” a crawler allowlist, or a promised number of visitors.
