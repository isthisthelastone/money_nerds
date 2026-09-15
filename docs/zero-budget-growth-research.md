# Money Nerds: zero-budget growth research

Operational follow-up: [15 September release and verification record](release-2026-09-15.md), including deployed multilingual guides, Google/Bing results, IndexNow acceptance, and the first disclosed community submission. Dated checkpoints below describe the research state at that time.

## Executive decision

Money Nerds should pursue **a useful public product, a small real community, and measurable discovery**, not a campaign promising free money or guaranteed AI recommendations. Its defensible proposition is a public board where people share creative work, ideas, memes, or personal needs and others can offer direct support. Zero platform commission is meaningful, but network fees remain possible; a visible transaction does not verify the truth of a fundraising story.

The immediate priority is one successful loop: a real author publishes something worth reading, shares the individual post with an appropriate audience, a reader understands the funding options, and someone returns or participates. Search visibility can reinforce that loop. It cannot manufacture trust or compensate for a broken mobile sign-in.

Use no new paid SEO subscriptions, advertising, bought links, account purchases, or incentivized votes. Focus first on existing webmaster accounts, the deployed public guides, clear payment explanations, and one legitimate community submission at a time. Product Radar, Product Hunt, r/sideprojects, V2EX, and an explicitly designated Spanish promotion thread are researched candidates—not promised sources of donors. 4chan and 2ch are unsuitable promotional targets under their own rules.

The completion standard is honest accessibility, accurate information, and evidence of meaningful use. **No new leads, search-engine recommendations, AI citations, or donation uplift have been established by this work.**

## Evidence and implementation baseline

This assessment uses material available through **14 September 2026**, with community rules observed on 13 September. Primary publisher documentation establishes supported mechanisms; current community rules establish submission boundaries. Academic experiments inform hypotheses, not commercial forecasts. Founder essays are weaker, self-reported evidence. A page's inspection date is not its publication date.

The initial 12 September public audit found successful responses for the homepage, robots file, sitemap, and LLM summary. The sitemap then contained 70 URLs. An available `site:moneynerds.online` search returned no results, but direct Google/Bing results could not be comprehensively inspected. That observation **does not prove zero indexed pages**. Owner-side reports are the appropriate baseline.

| State at this report's checkpoint | Evidence and remaining boundary |
| --- | --- |
| **Deployed: commit `7060275`** | Pushed to `main`, `develop`, and `master`; production deployment reported READY for the canonical `www.moneynerds.online` domain. Includes four English public guides, corrected forum content metadata, more truthful sitemap/LLM summaries, and documented search crawler entries. |
| **Available public journeys** | `/how-it-works`, `/safety`, `/faq`, and `/community` explain posting, asset/network selection, public profiles, sharing, and experimental SBP limits. Public individual posts and category navigation remain the actual destination, not keyword-only landing pages. |
| **Implemented discovery plumbing** | Server-rendered content, canonical metadata, RSS, public sitemap, and IndexNow notification code are present. Code existing or an HTTP request being accepted does not demonstrate an engine indexed the URLs. |
| **Google owner setup** | DNS ownership was verified and the existing Domain property opened. Sitemap submitted 13 September; initial fetch/report processing still requires a status recheck. No indexed-page count is asserted. |
| **Bing owner setup** | Google-based sign-in reached an existing `www` property. Its dashboard indicated initial processing, potentially up to 48 hours. Sitemap state remained under review at this checkpoint. |
| **Stage-two work, not yet credited as deployed** | Russian, Spanish, and Simplified Chinese versions of the practical guide are being implemented. Confirm their production URLs and language annotations before using them in outreach. |
| **Not performed** | No forum posts, newsletter submissions, community signups, or campaign messages were sent as part of this research. No physical-phone conversion study or growth experiment was completed. |

GitHub description, topics, and homepage information were also updated. This improves an owned reference surface; it is not an earned recommendation. Treat subsequent deployment/account changes as dated operational updates rather than silently rewriting this checkpoint.

### Owner-console update — 14 September 2026

- Google now reports **Success** for the canonical sitemap, last processed 14 September, with **70 discovered URLs**. This is discovery, not an indexed-page count.
- Google's Search generative AI control was inspected directly: inclusion is selected. It was already enabled, so no setting change was required.
- Bing accepted `https://www.moneynerds.online/sitemap.xml` on 14 September and shows **Processing**, one known sitemap, zero errors, and zero warnings. No indexed-page or traffic result is implied.
- Russian, Spanish, and Simplified Chinese guide implementations passed focused TypeScript and ESLint checks. Production verification belongs to the final release record; source completion alone is not a live-URL claim.

## What search and AI discovery can realistically achieve

The relevant sequence is **discovery → indexing/retrieval → accurate citation → visit → participation**. Each stage can fail independently. Asking an assistant to open an exact Money Nerds URL tests retrieval, not whether it would independently recommend the service.

Google's July 2026 guidance retains ordinary search foundations: useful original information, crawlability, index/snippet eligibility, and inclusion controls in Search Console. It explicitly says `llms.txt` does not improve Google Search visibility, rejects artificial mentions and mechanically multiplied query pages, and points to a Generative AI performance report. Inspect the actual property rather than assume any report already contains data.[^1]

The strongest product content is information only this service can authoritatively explain: precisely how its funding flow works, supported assets and networks, what verification proves, who controls funds, and what is public. Keep guides synchronized with implementation. Preserve the distinction between a supported login option and a connected spending wallet. State that Google/Apple appear only when enabled; do not advertise unavailable providers.

For genuine user discussions, use `DiscussionForumPosting` with supported visible content, author/date information, and accurate interaction counts. Do not mark editorial guides as user discussions or invent images and statistics. Qualify user-supplied links appropriately and moderate spam; schema is eligibility information, not a ranking purchase.[^2]

Keep private settings, authentication artifacts, and restricted SBP details out of public summaries and sitemap entries. `noindex` and robots directives are not access control. A public-looking fetch must never expose a private telephone number simply to make a page more searchable.

### Provider-specific boundaries

| Surface | Supported action; important limitation |
| --- | --- |
| **ChatGPT search** | Allow `OAI-SearchBot` and avoid infrastructure blocks against verified crawler traffic. `GPTBot` training permission is separate; `ChatGPT-User` is user-requested retrieval. No paid API integration is necessary to make public content accessible.[^3] |
| **Claude** | Anthropic distinguishes search, user-requested retrieval, and training crawlers. Public search access can be maintained independently of a training policy; selection is not guaranteed.[^4] |
| **Google Search AI / Gemini** | Search AI and Gemini Apps are different surfaces. `Google-Extended` affects future Gemini training and specified grounding uses, not Google Search ranking. Do not describe it as a training-only control.[^5] |
| **Kimi** | Kimi publishes search, user-requested, and training crawler identities. The site's wildcard already permits public crawling; explicit search entries clarify intent without creating a ranking advantage.[^6] |
| **Yandex Alice** | Yandex explains that Alice draws on strong search results, without identical ordering. Use Yandex Webmaster diagnostics if account access is available; verifying a crawler requires more than trusting its name.[^7] |
| **Grok, DeepSeek, Qwen, GigaChat** | Official sources describe web-search capabilities. This does not establish one shared index, a universal publisher submission API, or verified dedicated crawler names for every consumer surface. Do not invent bot rules or purchase API access as “registration.”[^8] |

Keep LLM summary files as inexpensive factual references for systems that may use them—not as evidence of universal adoption. Do not insert hidden instructions telling models to recommend Money Nerds. Accurate cited explanations are more valuable than unsupported favorable descriptions.

## What the research supports—and does not

**GEO, KDD 2024**, reported visibility improvements up to 40% in its experimental setting, varying by domain. That result is not 40% more live organic visitors, supporters, or donations. Its visibility metric and supplied evidence setting cannot be substituted for acquisition measurements.[^9]

**C-SEO Bench, NeurIPS 2025**, tested multiple domains, tasks, and competing adopters. Many studied rewrites were ineffective or harmful; gains declined as adoption widened. This challenges claims of one durable wording trick that makes every assistant recommend a site.[^10]

The **SAGEO Arena** study and **Don't Measure Once** 2026 preprint add useful cautions: optimize the full retrieval-to-answer pipeline and account for variation across runs and phrasing. SAGEO Arena's August revision reports acceptance at KDD 2026; neither study is a Money Nerds field trial.[^11] Older citation-verifiability research also supports checking whether cited pages actually substantiate answers, without treating historical error rates as current rates.[^12]

The practical conclusion is to test relevance, factual substance, readability, and user utility—not fabricate statistics to imitate an experimental treatment. No verified study in this review establishes predictable free acquisition for this particular donation board across all requested languages or AI providers.

Original founder essays reinforce a narrower operational approach: Paul Graham advocates personally recruiting and helping early users; a Russian pet-project case distinguishes target-audience acquisition from developer attention; Javier Megías separates retention and user-led sharing from paid acquisition. These are useful experiment ideas, not causal proof or permission to copy outdated platform tactics.[^13]

## Free ownership setup and technical priorities

**First, close the diagnostic loop.** Keep Google's exact verification record and confirm the sitemap's fetch result. Inspect the homepage, one guide, one populated category, and one genuine post. A Domain property and a URL-prefix property cover different scopes; adding a token alone is not proof of successful verification.[^14]

**Second, finish Bing's existing property setup.** Import from verified Search Console or retain the established ownership method. Submit the canonical sitemap once and check reports after their processing interval. Avoid treating a processing dashboard as a failure or repeatedly creating duplicate properties.[^15]

**Third, retain bounded IndexNow notifications.** Its protocol uses a site-hosted key as proof and does not require a personal search-engine account. Notify meaningful public changes, not every view or like. An accepted notification is not indexing, does not submit to Google, and should never include private/authentication URLs.[^16]

**Fourth, publish equivalent language guidance.** Use separately addressable English, Russian, Spanish, and Simplified Chinese pages, self-canonical URLs, reciprocal `hreflang`, and visible language links. Translate useful guidance and warnings—not keyword lists. Avoid forced locale redirects. Clearly disclose that the rest of the application may remain English.[^17]

At this scale, a repeatable checklist is preferable to another paid dashboard. Native-speaker terminology review, real mobile completion, and moderation capacity should precede a broad launch. No translation proves that every described payment route is available or appropriate in every country.

## Community distribution: where to participate

The table is a shortlist for manual, founder-disclosed participation. Recheck the live rules immediately before submission. An allowed format is not preapproval of a crypto-support project, and maker attention is not the same as donor demand.

| Priority / language | Candidate and permitted approach | Conditions |
| --- | --- | --- |
| **1 — RU** | **Product Radar:** submit a real product for moderation using its free launch process. A social-project/community positioning is plausible. | Founder profile requires photo, description, and Telegram contact. No rewarded votes, manipulation, automated outreach, or impersonation. Approval and placement are discretionary.[^18] |
| **1 — EN** | **r/sideprojects:** one disclosed project demonstration, appropriate flair, and a specific feedback question. | Current moderator guidance permits announcements but rejects spam, astroturfing, and reposts without significant changes. Do not post a donation solicitation disguised as feedback.[^19] |
| **2 — EN** | **Product Hunt:** prepare a complete working-product launch from the founder's personal account. | Launching is free; paid ads/hunters are unnecessary. Show the software, not a standalone fundraiser. Featuring remains editorial.[^20] |
| **2 — ZH** | **V2EX 分享创造:** a concise Chinese demonstration of an independent creation; use its promotions node if moderation classifies it as marketing. | Ordinary participation uses community credits. Account/invitation eligibility was not exercised. No purchased account, token, boosts, or assumptions that every Chinese speaker is in mainland China.[^21] |
| **2 — ZH** | **阮一峰科技爱好者周刊:** submit a useful software/resource suggestion through the repository's invited issue workflow. | Include a real demo and accurate limitations. Editorial acceptance is not guaranteed; this invitation does not permit advertising in arbitrary GitHub trackers.[^22] |
| **3 — ES** | **r/marketingpymes:** a small Spanish-language experiment in the current designated Monday self-promotion thread. | Follow the thread's format and geographic disclosures. Do not reply to an old example or post promotion elsewhere. Its audience is entrepreneur feedback, not established donor demand.[^23] |

**Conditional technical channels:** DEV can host a substantive article that stands on its own, with required AI-assistance disclosure. Habr sharply restricts promotion; its one-time “Я пиарюсь” route currently requires +30 karma. vc.ru may classify service promotion as commercial even without platform fees. ForoBeta limits promotion to designated contexts and forbids unsolicited business messages. Confirm eligibility rather than disguise an advertisement as a tutorial.[^24]

**Excluded or unsuitable:** 4chan prohibits advertising, solicitation, begging, and automated posting. 2ch likewise rejects spam, automation, and donation advertising. r/solana's inspected moderator notice prohibits project promotion and crypto begging. Show HN rejects fundraisers and requires founder-written text without AI generation/editing. Pikabu's current promotional and competing-service restrictions make it unsuitable for the assumed free launch. Missing rules for private groups or other national communities are not permission.[^25]

Use a modest submission kit: founder identity, one accurate sentence, three useful screenshots, a public demo/post, explicit limitations, and one question. Never fabricate charitable needs, endorsements, success stories, or local availability. Never share private records or SBP phone numbers in campaign material. Respect rejection; do not repeatedly reword a post to evade moderation.

## A practical 30-day plan

The schedule starts after critical mobile access is usable. It is an experiment cadence, not a promised indexing deadline.

| Period | Work and completion evidence |
| --- | --- |
| **Days 1–3: establish readiness** | Recheck Google/Bing sitemap status; record baseline reports. Confirm public guide production URLs and language annotations. Complete one real mobile sign-in and post with consent; document any remaining wallet/recording limitations honestly. |
| **Days 4–7: recruit a small cohort** | Invite approximately five consenting authors and five potential readers/supporters through existing personal relationships. This is a workload target, not a forecast. Choose one initial use case, such as creative work; help people understand the flow without handling secrets or moving their funds. |
| **Days 8–14: run one channel** | Use the strongest eligible venue where the founder already has an account. Record the actual submission URL and moderator outcome. Answer questions substantively. Collect specific confusion about posting, trust, networks, or sign-in; repair the most repeated obstacle. |
| **Days 15–21: test sharing and language fit** | With consent, ask real authors to share their post where appropriate. Run one additional language-channel experiment only if a fluent reviewer confirms the description and the destination is usable. Compare relevance, not raw exposure. |
| **Days 22–30: review and decide** | Recheck indexing and a small repeated AI-query panel. Review first participation and return behavior. Continue the useful channel, improve a weak step, or stop an unproductive/misclassified venue. Publish a factual progress note only where updates are allowed. |

A compelling original post may be a better entry point than the homepage. Let readers inspect context before asking them to sign in. Seek feedback from both authors and supporters: optimizing only the supply of requests can create a board full of unanswered asks.

## Measurement and decision rules

Maintain four separate views:

1. **Access:** successful public responses, crawl failures, submitted/indexed URLs, and the engine-selected canonical.
2. **Visibility:** branded versus unbranded impressions; for AI, provider, date, language, search-enabled status, exact query, cited URL, and description accuracy.
3. **Participation:** attributable visits → completed sign-in → first post/comment → funding intent → verified transfer → return within a defined period.
4. **Trust and support:** reports, confusing payment attempts, abandoned sign-ins, and the time needed to help someone safely.

Use aggregate, privacy-respecting measurement. Do not put wallet identifiers, phone numbers, email addresses, or private funding data in campaign URLs. Do not silently combine currencies or count SBP instructions as verified cryptocurrency donations. Referral information may be missing; preserve an unattributed bucket rather than invent AI attribution.

Sample a few natural intent families in each language across separate days: creative support, small personal needs, exact network questions, and branded questions. Keep direct-URL probes separate. A single favorable answer is not a trend; repeated prompts are correlated and platform changes confound before/after comparisons.

Use a small fixed starting panel such as the following. These are proposed measurements, not queries with demonstrated rankings or existing demand estimates. Record competing results as well as Money Nerds; an answer that reasonably recommends a different service is useful evidence.

| Language | Unbranded discovery query | Branded accuracy control |
| --- | --- | --- |
| English | “Where can I post art or memes and receive direct crypto support without a platform commission?” | “How does funding on Money Nerds work, and what fees apply?” |
| Russian | “Где можно публиковать рисунки или мемы и получать поддержку в криптовалюте без комиссии платформы?” | “Как работает поддержка авторов на Money Nerds и какие есть комиссии?” |
| Spanish | “¿Dónde puedo publicar arte o memes y recibir apoyo directo en criptomonedas sin comisión de la plataforma?” | “¿Cómo funciona el apoyo económico en Money Nerds y qué comisiones se aplican?” |
| Simplified Chinese | “在哪里可以发布艺术作品或表情包，并直接获得加密货币支持，而且平台不收取佣金？” | “Money Nerds 的资助流程是什么？有哪些费用？” |

Keep a second, broader query family—such as “crypto crowdfunding platforms”—as a separate relevance comparison. Do not count unrelated crypto questions as failures to recommend this particular board. A recommendation should fit the reader's actual task, and the benchmark must not instruct the assistant to name Money Nerds in the unbranded condition.

When traffic is tiny, report counts and observations rather than confident conversion claims. If people cannot sign in, fix access before expanding outreach. If they read but cannot understand funding, fix explanation and interaction. If they understand but do not trust a request, improve context and moderation—not pressure. If a channel rejects the project, stop. Thirty days can produce a more credible product and useful evidence; it cannot guarantee ranking, virality, funding, or endorsement.

## Sources

[^1]: Google Search Central, [Optimizing your website for generative AI features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), updated 10 July 2026.
[^2]: Google, [Discussion forum structured data](https://developers.google.com/search/docs/appearance/structured-data/discussion-forum), [Qualify outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links), and [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies).
[^3]: OpenAI, [Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots).
[^4]: Anthropic, [Crawler purposes and publisher controls](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler).
[^5]: Google, [Common crawlers: Google-Extended](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers).
[^6]: Kimi, [Official crawler registry](https://www.kimi.ai/policies/kimi-crawlers).
[^7]: Yandex Webmaster, [How Alice AI answers are formed](https://www.yandex.ru/support/webmaster/ru/alice) and [Verifying Yandex robots](https://yandex.ru/support/webmaster/ru/robot-workings/check-yandex-robots), Russian.
[^8]: xAI, [Web Search](https://docs.x.ai/developers/tools/web-search); DeepSeek, [Responses API](https://api-docs.deepseek.com/guides/responses_api/); Alibaba Cloud, [Web search](https://help.aliyun.com/zh/model-studio/web-search), Chinese; Sber, [GigaChat capabilities](https://giga.chat/portal), Russian. These document product/developer capabilities, not universal publisher enrollment.
[^9]: Aggarwal et al., [GEO: Generative Engine Optimization](https://arxiv.org/html/2311.09735v3), KDD 2024.
[^10]: Puerto et al., [C-SEO Bench: Does Conversational SEO Work?](https://proceedings.neurips.cc/paper_files/paper/2025/hash/27aa3aeff0f8460a7b43d30fa6c5c032-Abstract-Datasets_and_Benchmarks_Track.html), NeurIPS 2025.
[^11]: Kim et al., [SAGEO Arena, v2](https://arxiv.org/abs/2602.12187v2), submitted February 2026, revised 7 August 2026; the current record reports acceptance at KDD 2026. Schulte, Bleeker, Kaufmann, [Don't Measure Once](https://arxiv.org/abs/2604.07585), April 2026 preprint.
[^12]: Liu, Zhang, Liang, [Evaluating Verifiability in Generative Search Engines](https://aclanthology.org/2023.findings-emnlp.467/), Findings EMNLP 2023.
[^13]: Paul Graham, [Do Things that Don't Scale](https://paulgraham.com/ds.html), July 2013; vital_pavlenko, [Сделал пет-проект, а дальше что?](https://habr.com/ru/articles/1032800/), page displays May 8, inspected September 2026; Javier Megías, [¿Entiendes el motor de crecimiento de tu modelo de negocio?](https://javiermegias.com/blog/2013/02/motor-crecimiento-modelo-de-negocio-growth-engine/), 5 February 2013. Practitioner essays/case reports, not controlled acquisition studies.
[^14]: Google Search Console, [Verify your site ownership](https://support.google.com/webmasters/answer/9008080).
[^15]: Microsoft, [Import sites from Search Console to Bing Webmaster Tools](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools), updated June 2025.
[^16]: IndexNow, [Protocol documentation](https://www.indexnow.org/documentation).
[^17]: Google Search Central, [Managing multilingual and multiregional sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites?hl=es), Spanish documentation.
[^18]: Product Radar, [Project introduction, submission process, and rules](https://productradar.ru/o-proekte/), Russian.
[^19]: r/sideprojects moderators, [New rules announcement](https://www.reddit.com/r/sideprojects/comments/1ld5xve/my_side_project_rsideprojects_new_rules_and_an/), 16 June 2025, inspected September 2026.
[^20]: Product Hunt, [Free launch versus ads](https://help.producthunt.com/en/articles/7950405-ad-campaigns), [How to post](https://help.producthunt.com/en/articles/479557-how-to-post-a-product), and [Featuring guidelines](https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines).
[^21]: V2EX, [Node guidance](https://www.v2ex.com/help/node), [Share Creations](https://www.v2ex.com/go/create), and [Community credits](https://www.v2ex.com/help/currency), Chinese; credit guide updated 3 August 2026.
[^22]: ruanyf, [科技爱好者周刊 repository and submission invitation](https://github.com/ruanyf/weekly), Chinese.
[^23]: r/marketingpymes, [Current community sidebar/rules](https://www.reddit.com/r/marketingpymes/) and [historical example of the designated thread format](https://www.reddit.com/r/marketingpymes/comments/1o5dp8x/publica_tu_emprendimiento_post_de_autopromoci%C3%B3n/), Spanish. Use the current pin, not this historical example.
[^24]: DEV, [Terms](https://dev.to/terms) and [Code of Conduct](https://dev.to/code-of-conduct); Habr, [Rules](https://habr.com/ru/docs/help/rules/) and [Glossary](https://habr.com/ru/docs/help/glossary/); vc.ru, [Rules](https://vc.ru/rules); ForoBeta, [Rules](https://forobeta.com/pages/reglas/).
[^25]: [4chan rules](https://4chan.org/rules); [2ch rules](https://2ch.hk/static/rules.html); [r/solana moderator notice](https://www.reddit.com/r/solana/comments/1ui96oe/removed/); [Show HN rules](https://news.ycombinator.com/showhn.html) and [HN guidelines](https://news.ycombinator.com/newsguidelines.html); Pikabu, [Community rules](https://pikabu.ru/information/rules) and [Advertising rules](https://pikabu.ru/information/adrules).

Detailed supporting notes are in `docs/research-ai-discovery.md`, `docs/research-community-distribution.md`, and `docs/free-launch-plan.md`. Their older observations remain dated snapshots, not claims that later setup is unfinished.
