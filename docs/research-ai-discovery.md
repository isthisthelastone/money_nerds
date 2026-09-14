# Money Nerds: evidence-led discovery in search and AI answers

## Executive assessment

The defensible zero-cost strategy is to make a genuinely useful public product easy to retrieve, understand, cite accurately, and use. No credible evidence establishes a durable technique that makes a new site recommended across ChatGPT, Claude, Gemini, Grok, DeepSeek, Qwen, Kimi, Yandex Alice, and GigaChat for every relevant query. Access is necessary, not sufficient; citations are not customers.

This review covers primary publisher documentation and research available through **14 September 2026**. Peer-reviewed experiments carry more weight than promotional case studies. Recent preprints are useful but provisional. A provider’s API search feature establishes that retrieval exists; it does not establish how every consumer interface discovers publishers. Unpublished crawler requirements remain unknown, not invented.

The proposed audience is specific: people seeking direct support for an idea, creative work, a meme, or a personal need, and people considering supporting them. Money Nerds should not try to rank as medical advice, an investment service, a guaranteed fundraising solution, or a verified charity.

## What “visibility” actually measures

The useful sequence is:

**Relevant query → search enabled → page discovered/indexed → retrieved → selected/cited accurately → visit → meaningful action.**

These are different outcomes. A rewrite tested after a document is already in a model’s context cannot establish that the document will be found on the live web. Giving a chatbot our URL tests direct retrieval, not unprompted discovery. A model remembering a brand from training is different from fetching current information. The 2026 critical survey explicitly distinguishes these stages and identifies major gaps in cross-platform, longitudinal, causal evidence.[^survey]

For this product, a useful action could be reading a real post, creating one, or supporting someone. More mentions with an inaccurate “fee-free everywhere” description would be a failure, not a win.

## Academic evidence and its limits

| Primary research | What it supports | What it does not establish |
| --- | --- | --- |
| **Aggarwal et al., GEO, KDD 2024** | On its benchmark, content changes such as supported statistics and citations sometimes improved source visibility, with reported gains up to 40%. Effects differed by domain.[^geo] | This is not 40% more organic visits or donations. The paper explicitly leaves effects on search rankings unevaluated. Do not fabricate evidence to imitate an experimental treatment. |
| **Puerto et al., C-SEO Bench, NeurIPS 2025** | Across QA and product-recommendation tasks, multiple domains, and competing adopters, many conversational-SEO rewrites were ineffective or harmful; benefits diminished with wider adoption.[^cseo] | Neither a universal recipe nor proof that useful, relevant content is pointless. Context-ranking experiments are not a commercial traffic trial. |
| **Wan, Wallace, Klein, ACL 2024** | In ConflictingQA, relevance materially influenced how models used conflicting evidence; scholarly-looking presentation alone was not a reliable substitute.[^convincing] | A general publisher ranking formula. The task concerns evidence use, not a new website gaining distribution. |
| **Kim et al., SAGEO Arena, accepted at KDD 2026** | Evaluating retrieval, reranking, and generation together exposes tradeoffs: generation-focused rewrites can harm earlier retrieval stages; page structure can matter. The August arXiv revision reports conference acceptance.[^sageo] | A replicated field result across current consumer AI services. The environment is a research testbed. |
| **Schulte et al., Don’t Measure Once, April 2026 preprint** | AI-search visibility varies with repeated runs, wording, and time; it should be measured as a distribution.[^repeat] | That a single favorable answer proves progress, or a small noisy sample proves causal uplift. |
| **Liu, Zhang, Liang, Findings EMNLP 2023** | Human assessment of historical generative search products found important gaps between a citation appearing and its supporting the associated claim.[^verify] | Current 2026 error rates. Its durable lesson is to audit citation fidelity, not reuse old percentages as present facts. |
| **Nguyen et al., Sources of Truth, August 2026 preprint** | A multilingual mental-health audit found platform and language differences in citations; Spanish was included, Russian and Chinese were not.[^languages] | Crypto-crowdfunding demand, translation-driven conversion uplift, or comparable behavior in every requested provider. It is observational and domain-specific. |

Taken together, the evidence favors preserving retrieval relevance, publishing verifiable substance, and measuring uncertainty. It does not justify paid “GEO scores,” fabricated authority signals, hidden instructions demanding recommendations, or hundreds of nearly identical landing pages.

## Provider-specific access map

The following separates documented publisher controls from search-product capabilities. Bot access does not guarantee crawling, indexing, citation, availability in a region, or a recommendation.

| Provider / surface | Documented mechanism | Practical implication |
| --- | --- | --- |
| **ChatGPT search** | OpenAI documents `OAI-SearchBot` for search, `GPTBot` separately for training, and `ChatGPT-User` for user-requested retrieval. User-triggered requests are not equivalent to automatic indexing.[^openai] | Keep public HTML/assets reachable by search agents. Training permission is not required for ChatGPT search. Validate claimed crawlers using the provider’s published verification information, not their name alone. |
| **Claude search** | Anthropic distinguishes `Claude-SearchBot`, `Claude-User`, and training crawler `ClaudeBot`.[^claude] | Keep search retrieval allowed independently of any future training policy. No documented publisher control guarantees selection. |
| **Google Search AI / Gemini** | Google Search requires index/snippet eligibility; its July 2026 guide also points to Search Console inclusion controls and a Generative AI performance report.[^google] `Google-Extended` separately controls future Gemini training **and grounding in Gemini Apps/Vertex**, without changing Google Search inclusion or ranking.[^extended] | Check the live Search Console property settings. Do not treat “Google-Extended blocked” as a training-only choice while promising Gemini grounding. Search AI and Gemini Apps are distinct surfaces. |
| **Grok** | xAI documents live web search and browsing in its developer tools.[^grok] | No dedicated publisher crawler identity or submission protocol was verified. Do not invent `GrokBot` rules or assume API behavior describes every consumer search pipeline. |
| **DeepSeek** | Official documentation describes web search, including the Responses API’s search tool.[^deepseek] | No verified publisher-specific crawler/submission specification was found. Maintain ordinary public crawlability; API integration is not publisher registration. |
| **Qwen** | Alibaba documents model web search, with model/strategy-dependent behavior; its plugin documentation distinguishes Quark search from other search configurations.[^qwen] | Do not infer one exclusive index for all Qwen surfaces, or add unverified crawler names. Search API access is not required to publish a discoverable page. |
| **Kimi** | Kimi publishes `Kimi-SearchBot` for its search index, `Kimi-User` for user-initiated access, and `KimiBot` for training, with crawler/IP documentation.[^kimi] | Search agents can be explicitly documented in robots rules; our wildcard already allows them. User-initiated access and bulk crawling have different robots semantics. |
| **Yandex Alice** | Yandex Webmaster explains that Alice uses strong search results and that source ordering need not mirror ordinary result positions. Yandex publishes robot verification guidance.[^alice] | Maintain Yandex search eligibility and use free Webmaster diagnostics. This documentation is not a guarantee about every Alice device or mode. |
| **GigaChat** | Sber’s public product page documents internet search with links to sources.[^giga] | A publisher crawler identity, index-submission API, and comprehensive grounding-source policy were not verified. Unknown is not evidence that `GigaChatBot` or a particular partner index exists. |

No public instruction file can force these independent services to recommend the project. API keys, paid model calls, or a paid SEO subscription are unnecessary for the access improvements described here.

## English, Russian, Spanish, and Chinese

Translate complete useful guidance, not a list of keywords. Google’s Spanish documentation recommends separately addressable language versions and appropriate language annotations; automatic locale redirection can obstruct discovery.[^international] Russian-language primary evidence is available directly from Yandex Webmaster, rather than relying on English vendors’ guesses about Alice.[^alice] Alibaba and Kimi provide relevant Chinese-provider documentation, but this does not imply that one Chinese search submission reaches every model.

The first bounded implementation is a full **How it works** guide in English, Russian, Spanish, and Simplified Chinese. Each should have a self-canonical URL, reciprocal `hreflang`, visible language navigation, and the same substantive warnings. Keep asset symbols and network names unambiguous. State that the app and other guides may remain English. Do not claim banking, wallet, or service availability in a country merely because a translation exists.

The multilingual study above is a reason to measure languages separately, not evidence that translation alone increases reach. Native-speaker feedback should improve terminology over time; changes to payment behavior must propagate to every translation.

## Repository assessment and bounded actions

At inspection, `src/app/robots.ts` permits public pages for explicitly listed search agents and through `User-agent: *`, excluding `/api/`. Therefore Kimi and Yandex are not accidentally blocked merely because their names are absent. Adding their documented search names would clarify intent, not create a ranking advantage. Preserve rate limits and abuse protection; never trust a user-agent string as authentication.

Existing work provides public server-rendered pages, individual post URLs, canonical metadata, a sitemap, public guides, and structured data aligned with visible content. Keep private authentication/settings/SBP details out of indexing; enforce privacy through authorization, not robots. Do not place telephone numbers or private transfer instructions in sitemap, schema, or AI summaries.

Keep `llms.txt` and `llms-full.txt` only as inexpensive, maintained product summaries. Google explicitly says these special files do not improve its Search visibility. Its current guide also rejects mechanical chunking, artificial mentions, and mass pages targeting query variations.[^google] There is no verified cross-provider evidence that these files independently generate qualified traffic.

Priorities, without new paid services:

1. **Remove access failures:** stable successful public responses, correct redirects/canonicals, readable HTML, no accidental public-page authentication wall. Observe actual infrastructure blocks before changing firewall rules.
2. **Complete free webmaster setup:** verify ownership in Google Search Console, Bing Webmaster Tools, and Yandex Webmaster where accessible; submit the real sitemap and inspect representative URLs. Verification/submission is a request, not proof of indexing.[^bing][^yandex]
3. **Publish durable first-party guidance:** explain exact asset/network support, fees, custody, transaction verification, public profiles, and experimental SBP limits. Link it visibly from real journeys.
4. **Add the four-language guide cluster:** complete equivalent content, crawlable links, reciprocal alternatives, and sitemap entries. No fake “fully localized app” promise.
5. **Earn relevant attention:** participate only where community rules permit, disclose authorship, answer real questions, and share genuine examples with consent. No paid links, fake users, or invented fundraising success.
6. **Maintain truth:** correct stale features and translations, remove misleading structured data, and assess real user feedback before expanding content.

“Free” means no new vendor subscription or advertising spend; implementation, moderation, translation review, and hosting capacity still have costs.

## Measurement design

Before changing content, save a small fixed panel of **intent families**, not thousands of keyword permutations: direct support for creators, small personal fundraisers, crypto-network questions, and branded product questions. Use natural EN/RU/ES/ZH examples, separate branded from unbranded searches, and reserve some wording for later checks.

Record provider, consumer surface, visible model/version, date, locale, search-enabled status, query wording, cited URL, and whether the description matches the page. Repeat a modest sample over separate days using available free interfaces and their terms. Label direct-URL probes separately. Do not present a successful branded lookup as an unbranded acquisition result.

Track distinct levels:

- **Access/indexing:** successful public fetches, submitted versus indexed URLs, canonical selected by search engines, actual blocking errors.
- **Answer visibility:** proportion of eligible sampled answers citing the site, with an explicit denominator and missing/error cases.
- **Fidelity:** whether claims about fees, verification, supported networks, and SBP are supported by the cited page.
- **Traffic and use:** attributable referrals, engaged visits, completed sign-in, created posts, and verified support events, using privacy-respecting aggregate data.

Referral labels can be missing or ambiguous; report unattributed traffic rather than assigning it to AI. Repeated prompts are correlated, so a large response count does not equal many independent observations. Small samples should remain descriptive. Broader before/after movement may reflect platform growth, seasonality, ranking updates, or community outreach—not the content change alone. If sufficient traffic develops, compare staggered content cohorts while retaining those confounders.

Reassess after indexing and enough real observations to be informative; do not promise a fixed ranking deadline. When traffic is too low to distinguish effects, state that limitation and prioritize user utility. The completion criterion is a more accessible, accurate, useful product and an honest measurement baseline—not guaranteed recommendations or donations.

## Sources

[^geo]: Aggarwal et al. **GEO: Generative Engine Optimization**, KDD 2024. [Primary paper, v3](https://arxiv.org/html/2311.09735v3); [publication record](https://collaborate.princeton.edu/en/publications/geo-generative-engine-optimization/).
[^cseo]: Puerto et al. **C-SEO Bench: Does Conversational SEO Work?**, NeurIPS 2025 Datasets and Benchmarks. [Proceedings and paper](https://proceedings.neurips.cc/paper_files/paper/2025/hash/27aa3aeff0f8460a7b43d30fa6c5c032-Abstract-Datasets_and_Benchmarks_Track.html).
[^convincing]: Wan, Wallace, Klein. **What Evidence Do Language Models Find Convincing?**, ACL 2024. [ACL Anthology](https://aclanthology.org/2024.acl-long.403/).
[^sageo]: Kim et al. **SAGEO Arena: A Realistic Environment for Evaluating Search-Augmented Generative Engine Optimization**, submitted 12 February 2026; revised 7 August 2026. The authors' current record reports acceptance at KDD 2026. [arXiv v2](https://arxiv.org/abs/2602.12187v2).
[^repeat]: Schulte, Bleeker, Kaufmann. **Don’t Measure Once: Measuring Visibility in AI Search (GEO)**, 8 April 2026, preprint. [arXiv](https://arxiv.org/abs/2604.07585).
[^verify]: Liu, Zhang, Liang. **Evaluating Verifiability in Generative Search Engines**, Findings EMNLP 2023. [ACL Anthology](https://aclanthology.org/2023.findings-emnlp.467/).
[^languages]: Nguyen et al. **Sources of Truth: A Multi-Platform, Multilingual Audit of Citations in AI Mental Health Information Queries**, 31 August 2026, preprint. [Full text](https://arxiv.org/html/2609.00319v1).
[^survey]: Martinez. **Optimizing Visibility in Generative Engines: A Critical Survey of Generative Engine Optimization (2023–2026)**, 15 July 2026, preprint; interpretive synthesis, not an independent replication. [Full text](https://arxiv.org/html/2607.14035v1).
[^openai]: OpenAI. [Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots).
[^claude]: Anthropic. [Crawler purposes and publisher controls](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler).
[^google]: Google Search Central. [Optimizing your website for generative AI features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), updated 10 July 2026; [Spanish version](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide?hl=es).
[^extended]: Google. [Common crawlers: Google-Extended](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers).
[^grok]: xAI. [Web Search developer documentation](https://docs.x.ai/developers/tools/web-search).
[^deepseek]: DeepSeek. [Responses API documentation](https://api-docs.deepseek.com/guides/responses_api/); [web-search product announcement](https://api-docs.deepseek.com/news/news1210/).
[^qwen]: Alibaba Cloud. [Web search](https://help.aliyun.com/zh/model-studio/web-search); [search and other plugins](https://help.aliyun.com/zh/model-studio/plugins).
[^kimi]: Kimi. [Official crawler registry, purposes, and IP resources](https://www.kimi.ai/policies/kimi-crawlers).
[^alice]: Yandex Webmaster. [Alice AI and publisher visibility, Russian](https://www.yandex.ru/support/webmaster/ru/alice); [verify Yandex robots](https://yandex.ru/support/webmaster/ru/robot-workings/check-yandex-robots).
[^giga]: Sber. [GigaChat product capabilities, Russian](https://giga.chat/portal).
[^international]: Google Search Central. [Managing multilingual and multiregional sites, Spanish](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites?hl=es).
[^bing]: Microsoft. [Bing Webmaster Tools](https://www.bing.com/webmasters/about).
[^yandex]: Yandex. [Webmaster service and diagnostics, Russian](https://yandex.ru/support/webmaster/ru/service/info).
