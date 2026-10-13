// Focused, read-only HTTP release checks. No credentials or user-data writes.
const origin = new URL(process.argv[2] ?? 'https://www.moneynerds.online').origin;
const canonicalOrigin = 'https://www.moneynerds.online';
const locales = ['en', 'es', 'zh', 'ru', 'vi'];
const guides = ['crypto-crowdfunding', 'how-it-works', 'about', 'faq', 'safety', 'community', 'transparency'];
const failures = [];
const results = [];
const pathFor = (guide, locale) => `/${locale === 'en' ? '' : `${locale}/`}${guide}`;
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"');
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1].toLowerCase(), decode(match[2])]));
}
function check(ok, message) { if (!ok) failures.push(message); }
async function fetchPage(path, headers = {}) {
  const response = await fetch(`${origin}${path}`, { redirect: 'manual', headers, signal: AbortSignal.timeout(30_000) });
  return { response, body: await response.text() };
}
async function editorial(guide, locale) {
  const path = pathFor(guide, locale);
  const { response, body } = await fetchPage(path, { 'Accept-Language': 'ru', Cookie: 'mn_locale=vi' });
  const links = [...body.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attributes(tag));
  const metas = [...body.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => attributes(tag));
  const canonical = links.find(link => link.rel === 'canonical')?.href;
  const alternates = links.filter(link => link.rel === 'alternate' && link.hreflang);
  const lang = body.match(/<html\b[^>]*\blang="([^"]+)"/)?.[1];
  check(response.status === 200, `${path}: HTTP ${response.status}`);
  check(lang === (locale === 'zh' ? 'zh-Hans' : locale), `${path}: mismatched document language ${lang}`);
  check(canonical === `${canonicalOrigin}${path}`, `${path}: canonical ${canonical}`);
  check(!metas.some(meta => /robots|googlebot/.test(meta.name ?? '') && /noindex/.test(meta.content ?? '')), `${path}: noindex`);
  check(Boolean(metas.find(meta => meta.name === 'description')?.content), `${path}: missing description`);
  for (const other of locales) {
    const language = other === 'zh' ? 'zh-Hans' : other;
    check(alternates.some(link => link.hreflang === language && link.href === `${canonicalOrigin}${pathFor(guide, other)}`), `${path}: missing ${language} alternate`);
  }
  check(alternates.some(link => link.hreflang === 'x-default' && link.href === `${canonicalOrigin}/${guide}`), `${path}: missing x-default`);
  for (const [, json] of body.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(json); } catch { failures.push(`${path}: invalid JSON-LD`); }
  }
  results.push({ path, status: response.status, lang });
}

// Bounded concurrency avoids turning verification into a crawler load spike.
const work = guides.flatMap(guide => locales.map(locale => () => editorial(guide, locale)));
for (let i = 0; i < work.length; i += 4) await Promise.all(work.slice(i, i + 4).map(run => run()));

for (const [path, canonical, indexable] of [
  ['/?page=2', '/?page=2', true],
  ['/?page=1', '/', true],
  ['/?sort=loved', '/', false],
  ['/?size=25', '/', false],
  ['/?language=ru', '/', false],
]) {
  const { response, body } = await fetchPage(path);
  const links = [...body.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attributes(tag));
  const metas = [...body.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => attributes(tag));
  check(response.status === 200, `${path}: HTTP ${response.status}`);
  check(links.some(link => link.rel === 'canonical' && link.href && new URL(link.href).href === new URL(`${canonicalOrigin}${canonical}`).href), `${path}: wrong pagination canonical`);
  const noindex = metas.some(meta => meta.name === 'robots' && /noindex/.test(meta.content ?? ''));
  check(noindex !== indexable, `${path}: incorrect indexing directive`);
}
for (const [path, destination] of [['/how-it-works?ui=ru', '/ru/how-it-works'], ['/en/how-it-works', '/how-it-works'], ['/contact', '/legal/report'], ['/privacy', '/legal/privacy']]) {
  const { response } = await fetchPage(path);
  const location = response.headers.get('location');
  check([301, 302, 307, 308].includes(response.status) && location && new URL(location, origin).pathname === destination, `${path}: wrong redirect ${response.status} ${location}`);
}
const missing = await fetchPage('/fr/crypto-crowdfunding');
check(missing.response.status === 404, 'Unsupported guide language must return 404');
const markdown = await fetchPage('/', { Accept: 'text/markdown' });
check(markdown.response.status === 200 && markdown.response.headers.get('content-type')?.startsWith('text/markdown'), 'Homepage Markdown negotiation failed');
check(/\baccept\b/i.test(markdown.response.headers.get('vary') ?? '') && markdown.body.startsWith('# Money Nerds'), 'Markdown Vary/body missing');
const html = await fetchPage('/', { Accept: 'text/html' });
check(html.response.headers.get('content-type')?.startsWith('text/html'), 'HTML negotiation failed');
check(/\baccept\b/i.test(html.response.headers.get('vary') ?? ''), 'HTML Vary: Accept missing');
const htmlPosts = [...new Set([...html.body.matchAll(/<a\b[^>]*href="\/p\/(\d+)"/g)].map((match) => match[1]))].sort();
const markdownPosts = [...new Set([...markdown.body.matchAll(/### \[[^\n]+\]\(https:\/\/www\.moneynerds\.online\/p\/(\d+)\)/g)].map((match) => match[1]))].sort();
check(htmlPosts.length > 0 && JSON.stringify(htmlPosts) === JSON.stringify(markdownPosts), 'HTML/Markdown public post links differ');
const rss = await fetchPage('/feed.xml');
check(rss.response.status === 200 && rss.body.includes('xmlns:dc=') && !rss.body.includes('<author>'), 'RSS creator namespace/semantics failed');
const sitemap = await fetchPage('/sitemap.xml');
check(sitemap.response.status === 200, 'Sitemap failed');
for (const guide of guides) for (const locale of locales) check(sitemap.body.includes(`${canonicalOrigin}${pathFor(guide, locale)}</loc>`), `Sitemap missing ${pathFor(guide, locale)}`);
for (const path of ['/llms.txt', '/llms-full.txt']) {
  const { response, body } = await fetchPage(path);
  check(response.status === 200 && body.includes('/vi/how-it-works') && body.includes('/crypto-crowdfunding') && body.includes('/legal/report'), `${path}: incomplete public references`);
}
console.log(JSON.stringify({ origin, editorialPages: results.length, failures, results }, null, 2));
process.exitCode = failures.length ? 1 : 0;
