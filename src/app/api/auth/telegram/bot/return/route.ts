import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { checkExternalAuthRateLimit } from "@/lib/auth/external";
import { createTelegramClerkSignIn } from "@/lib/auth/telegram-clerk";
import {
  clearTelegramBotCookie, consumeTelegramBotIdentity, isTelegramBotToken, prepareTelegramBotIdentity,
  TELEGRAM_BOT_RETURN_PATH, telegramBotBrowserSecret, telegramBotConfiguration,
  telegramBotResponse, telegramBotSameOrigin,
} from "@/lib/auth/telegram-bot";
import { readBoundedJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Standalone HTML deliberately bypasses the app layout, Clerk JS and analytics. */
export async function GET() {
  const config = telegramBotConfiguration();
  if (!config) return telegramBotResponse({ error: "Bot-assisted sign-in is unavailable. Return to Money Nerds and use Continue with Telegram." }, 503);
  const nonce = randomBytes(18).toString("base64");
  const origin = JSON.stringify(config.origin).replace(/</g, "\\u003c");
  const path = JSON.stringify(TELEGRAM_BOT_RETURN_PATH);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow,noarchive"><title>Return to Money Nerds</title>
<style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;background:#080c16;color:#f4f5ff;font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100svh;display:grid;place-items:center;padding:24px}main{width:min(100%,520px);padding:clamp(22px,6vw,40px);border:1px solid #2d3650;border-radius:28px;background:linear-gradient(150deg,#192138,#0c1222);box-shadow:0 24px 80px #0005}h1{font-size:clamp(26px,6vw,34px);line-height:1.15;margin:10px 0 20px}p{margin:14px 0;color:#b9c5df}.brand{font-size:12px;text-transform:uppercase;letter-spacing:.2em;color:#9af7d4}.actions{display:flex;flex-direction:column;gap:12px;margin:24px 0}a,button{font:inherit}a{color:#9af7d4}button,.button{border:1px solid #596b83;border-radius:14px;padding:13px 17px;background:#182338;color:#f5f7ff;text-align:center;text-decoration:none;cursor:pointer;font-weight:650}button.primary{background:#a5f7d6;color:#0b2420;border-color:transparent}button:disabled{opacity:.55;cursor:wait}a:focus-visible,button:focus-visible{outline:3px solid #9af7d4;outline-offset:4px}small{display:block;color:#9cabc5;font-size:13px;margin-top:14px}#identity{padding:14px;border:1px solid #546984;border-radius:14px;overflow-wrap:anywhere}#status{min-height:52px}#fallback{border-top:1px solid #2d3650;padding-top:18px}[hidden]{display:none!important}
</style></head><body><main>
<div class="brand">Money Nerds · Telegram</div><h1>Finish where you started.</h1>
<p id="status" role="status" aria-live="polite">Checking whether this is your original browser…</p>
<div id="identity" hidden><strong id="name"></strong><small id="subject"></small></div>
<div class="actions"><button id="confirm" class="primary" type="button" hidden>Confirm sign-in</button></div>
<section id="fallback" hidden><p>If Telegram opened its own browser or Safari, return to the browser where you started signing in.</p>
<div class="actions"><a id="brave" class="button" href="#">Return to Brave</a><button id="check" type="button">Check this browser again</button><button id="copy" type="button">Copy secure return link</button></div>
<small>For another browser, paste the copied link into that browser. Private tabs must return to the same private browsing context. Never share this sign-in link with anyone.</small></section>
<small>This approval only works with the original browser’s private sign-in cookie. No account is signed in until you confirm the identity above.</small>
<p><a href="/sign-in">Cancel and start again</a></p><noscript><p>JavaScript is needed to finish this protected sign-in. Return to Money Nerds in your original browser and enable JavaScript.</p></noscript>
</main><script nonce="${nonce}">
(() => {
  const origin = ${origin};
  const path = ${path};
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const state = fragment.get('state');
  let claim = fragment.get('claim');
  // Strip secrets from the address bar/history before requests or UI actions.
  window.history.replaceState(null, '', path);
  const status = document.getElementById('status');
  const confirm = document.getElementById('confirm');
  const fallback = document.getElementById('fallback');
  const check = document.getElementById('check');
  const copy = document.getElementById('copy');
  const identity = document.getElementById('identity');
  const valid = /^[A-Za-z0-9_-]{43}$/;
  if (!state || !claim || !valid.test(state) || !valid.test(claim) || fragment.getAll('state').length !== 1 || fragment.getAll('claim').length !== 1) {
    status.textContent = 'This return link is incomplete. Go back to the approval return page, or start a fresh login on Money Nerds.';
    return;
  }
  const returnUrl = origin + path + '#' + new URLSearchParams({state, claim}).toString();
  document.getElementById('brave').href = 'brave://open-url?url=' + encodeURIComponent(returnUrl);
  fallback.hidden = false;
  let busy = false;
  let prepared = false;
  async function request(action) {
    const response = await fetch(path, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action, state, claim, ...(action === 'finish' ? {confirmed: true} : {})}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not confirm this login. Please try again.');
    return data;
  }
  async function prepare() {
    if (busy) return;
    busy = true; prepared = false; confirm.hidden = true; confirm.disabled = false; identity.hidden = true; check.disabled = true;
    try {
      const data = await request('prepare');
      if (!data.identity || typeof data.identity.id !== 'string' || typeof data.identity.name !== 'string') throw new Error('Could not read the approved identity. Start a fresh login.');
      document.getElementById('name').textContent = data.identity.name;
      document.getElementById('subject').textContent = 'Telegram ID: ' + data.identity.id;
      identity.hidden = false; confirm.hidden = false; prepared = true;
      status.textContent = 'This is your original browser. Confirm that this is your Telegram identity to finish signing in.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Return to the browser where you started sign-in.';
    } finally {busy = false; check.disabled = false;}
  }
  confirm.addEventListener('click', async () => {
    if (busy || !prepared) return;
    busy = true; confirm.disabled = true; check.disabled = true;
    status.textContent = 'Signing you in securely…';
    try {
      const data = await request('finish');
      const destination = new URL(data.redirectUrl);
      if (destination.protocol !== 'https:' || destination.username || destination.password) throw new Error('Could not open secure sign-in. Please start again.');
      claim = ''; prepared = false;
      window.location.assign(destination.href);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not complete sign-in. Start a fresh login.';
      confirm.hidden = true; identity.hidden = true; prepared = false;
    } finally {busy = false; check.disabled = false;}
  });
  check.addEventListener('click', prepare);
  copy.addEventListener('click', async () => {
    try {await navigator.clipboard.writeText(returnUrl); copy.textContent = 'Copied — paste in your original browser';}
    catch {status.textContent = 'Copying is unavailable here. Use Return to Brave, or start a fresh login from your preferred browser.';}
  });
  void prepare();
})();
</script></body></html>`;
  return new NextResponse(html, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`,
  } });
}

export async function POST(request: NextRequest) {
  const config = telegramBotConfiguration();
  if (!config) return telegramBotResponse({ error: "Bot-assisted sign-in is unavailable. Use Continue with Telegram." }, 503);
  if (!telegramBotSameOrigin(request, config.origin)) return telegramBotResponse({ error: "Return to the original Money Nerds browser to confirm this login." }, 403);
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody(request, 1024);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch { return telegramBotResponse({ error: "This login confirmation could not be read. Start a fresh login." }, 400); }
  if ((body.action !== "prepare" && body.action !== "finish") || !isTelegramBotToken(body.state) || !isTelegramBotToken(body.claim)) {
    return telegramBotResponse({ error: "This return link is incomplete. Start a fresh login on Money Nerds." }, 400);
  }
  const secret = telegramBotBrowserSecret(request, body.state);
  if (!secret) return telegramBotResponse({ error: "This is not the browser where you started, or its sign-in cookie expired. Use Return to Brave or paste the secure return link into your original browser." }, 401);
  if (body.action === "finish" && body.confirmed !== true) {
    return telegramBotResponse({ error: "Confirm the displayed Telegram identity before signing in." }, 400);
  }
  let consumed = false;
  try {
    const rate = await checkExternalAuthRateLimit(request, "external_auth_callback", 30);
    if (!rate.ok) return telegramBotResponse({ error: "Please wait a minute before trying again." }, rate.limited ? 429 : 503);
    const identity = body.action === "prepare"
      ? await prepareTelegramBotIdentity(body.state, secret, body.claim)
      : await consumeTelegramBotIdentity(body.state, secret, body.claim);
    if (!identity) return telegramBotResponse({ error: "This approval is expired, already used or belongs to another browser. Start a fresh login on Money Nerds." }, 409);
    if (body.action === "prepare") {
      const name = [identity.firstName, identity.lastName].filter(Boolean).join(" ").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
      return telegramBotResponse({ identity: { id: identity.subject, name: name || "Telegram user" } });
    }
    consumed = true;
    // Neither the webhook nor approval callback may create profiles/sessions.
    // Only this cookie + claim + explicit confirmation path can issue a ticket.
    const redirectUrl = await createTelegramClerkSignIn(identity, identity.returnTo);
    console.info("telegram_bot_auth", { event: "clerk_ticket_issued" });
    return clearTelegramBotCookie(telegramBotResponse({ redirectUrl }));
  } catch {
    console.error("telegram_bot_auth", { event: "confirmation_failed" });
    const response = telegramBotResponse({ error: "Could not finish sign-in. For your security, start a fresh login on Money Nerds." }, 503);
    return consumed ? clearTelegramBotCookie(response) : response;
  }
}
