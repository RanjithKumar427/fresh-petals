#!/usr/bin/env node
// Brief headless-browser checks of the staging admin sign-in UI, with disposable synthetic identities.
//
//   node scripts/staging/browser-auth.mjs --env=<staging env file> --playwright=<path to playwright-core index.mjs> [--out=<results.json>]
//
// Covers what the HTTP-level run (auth-integration.mjs) cannot: the pages render and submit, the
// reset page's script bridges the link's fragment and clears it from the address bar, autofill hints,
// Content-Security-Policy violations, a real page on another site, and the UI logout. The browser may
// only reach the staging Worker and the staging Supabase project; every other request is aborted, and
// "evil.example" is answered locally. Nothing is recorded but statuses, booleans and counts: no
// screenshots, traces, URLs with tokens, field values or cookie values.
import { pathToFileURL } from "node:url";
import { STAGING_ORIGIN } from "./guard.mjs";
import { WORKER, Z, sleep, scrub, parseArgs, startRun, servedRevision, freshCode, snapshot, compareSnapshots, syntheticIdentities, enrolFactor, jarClient, random } from "./test-lib.mjs";

const args = parseArgs();
if (!args.playwright) { console.log("STOP: --playwright=<path to playwright-core index.mjs> is required"); process.exit(2); }
const { chromium } = await import(pathToFileURL(args.playwright).href);
const run = startRun({ envFile: args.env, minFreeMb: 1200 });
const { log, check, due, guarded, q, service, sdkFor } = run;
const REQUIRED = args.require || "c1307afc48f2a5125cb3738eefc3e94adaa506c7";
const rev = await servedRevision(guarded, REQUIRED);
if (!rev.ok) { console.log(`STOP: the served revision does not contain ${REQUIRED.slice(0, 7)}; nothing was created`); process.exit(2); }
log("deployed revision", rev.served.slice(0, 7));
const before = await snapshot(q);
const ids = syntheticIdentities({ q, service, check, log });
const EVIL = "https://evil.example";

const browser = await chromium.launch({ headless: true });
const csp = [];
async function newContext() {
  const context = await browser.newContext();
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(`${EVIL}/`)) return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>other site</title><p>other site</p>" });
    if (url.startsWith(`${WORKER}/`) || url.startsWith(`${STAGING_ORIGIN}/`) || url.startsWith("data:")) return route.continue();
    return route.abort();
  });
  context.on("console", (m) => { if (/Content Security Policy|Refused to (execute|load|apply)/i.test(m.text())) csp.push(new URL(m.location()?.url || WORKER).pathname); });
  return context;
}
const sbCookies = async (context) => (await context.cookies(WORKER)).filter((c) => c.name.startsWith("sb-"));
const apiStatus = async (context) => (await context.request.fetch(`${WORKER}/api/admin/products`, { maxRedirects: 0 })).status();
const pathOf = (page) => new URL(page.url()).pathname;
const hasFragment = (page) => page.evaluate(() => location.hash.length > 1 || /access_token|refresh_token/.test(location.href));
const visible = (page, text) => page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
async function recoveryLink(user) {
  const link = await service.auth.admin.generateLink({ type: "recovery", email: user.email, options: { redirectTo: `${WORKER}/admin/reset-password` } });
  if (link.error) throw new Error(`generateLink refused, status ${link.error.status}`);
  return link.data.properties.action_link;
}
async function signIn(page, user) {
  await page.goto(`${WORKER}/admin/login`);
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await Promise.all([page.waitForLoadState("load"), page.click('button[type="submit"]')]);
  await page.waitForLoadState("load");
}
async function enterCode(page, user) {
  await page.fill('input[name="code"]', await freshCode(user.secret, due));
  await Promise.all([page.waitForURL((u) => u.pathname !== "/admin/mfa", { timeout: 30000 }).catch(() => {}), page.click('form:has(input[name="code"]) button[type="submit"]')]);
  await page.waitForLoadState("load");
}

try {
  const admin = await ids.create({ approved: true, label: "browser" });
  await enrolFactor({ sdk: jarClient(sdkFor).sdk, user: admin, due });
  const none = await ids.create({ approved: false, label: "browsernp" });

  // ------------------------------------------------------------------ sign-in page and autofill hints
  const a = await newContext();
  const page = await a.newPage();
  await page.goto(`${WORKER}/admin/login`);
  const hints = await page.evaluate(() => {
    const e = document.querySelector('input[name="email"]'), p = document.querySelector('input[name="password"]');
    return { email: e?.getAttribute("autocomplete"), emailType: e?.type, password: p?.getAttribute("autocomplete"), passwordType: p?.type, formAction: document.querySelector("form")?.getAttribute("action"), method: document.querySelector("form")?.getAttribute("method") };
  });
  check("ui", "sign-in page renders with autofill hints (username, current-password) and a POST form", hints.email === "username" && hints.emailType === "email" && hints.password === "current-password" && hints.passwordType === "password" && hints.method === "post", JSON.stringify(hints));

  // Wrong password: generic error on the page, no cookie.
  await signIn(page, { email: admin.email, password: random() });
  check("ui", "wrong password: stays on sign-in with a visible error, no session cookie", pathOf(page) === "/admin/login" && (await page.locator("form").first().isVisible()) && (await page.evaluate(() => /didn.t|incorrect|invalid|not recognised|try again/i.test(document.body.innerText))) && (await sbCookies(a)).length === 0, pathOf(page));
  await sleep(2500);

  // ------------------------------------------------------------------ password then code, through the pages
  await signIn(page, admin);
  const codeHints = await page.evaluate(() => { const c = document.querySelector('input[name="code"]'); return c ? { autocomplete: c.getAttribute("autocomplete"), inputmode: c.getAttribute("inputmode") } : null; });
  check("ui", "correct password leads to the code page with a one-time-code field", pathOf(page) === "/admin/mfa" && codeHints?.autocomplete === "one-time-code" && codeHints?.inputmode === "numeric" && (await apiStatus(a)) === 403, `${pathOf(page)} ${JSON.stringify(codeHints)}`);
  await enterCode(page, admin);
  check("ui", "code accepted: dashboard renders for the signed-in admin, API open", pathOf(page) === "/admin/dashboard" && (await visible(page, admin.email)) && (await apiStatus(a)) === 200, pathOf(page));
  const cookies = await sbCookies(a);
  check("ui", "browser holds only HttpOnly, Secure, SameSite=Lax, host-only session cookies; scripts cannot read them", cookies.length > 0 && cookies.every((c) => c.httpOnly && c.secure && c.sameSite === "Lax" && !c.domain.startsWith(".")) && !(await page.evaluate(() => /sb-[^=]*-auth-token/.test(document.cookie))), `${cookies.length} cookie(s)`);

  // ------------------------------------------------------------------ a real page on another site, with the signed-in cookies present
  const seen = [];
  a.on("response", async (res) => { if (!res.url().startsWith(WORKER) || res.request().method() !== "POST") return; const h = await res.request().allHeaders(); seen.push({ path: new URL(res.url()).pathname.replace(Z, "Z"), status: res.status(), cookieSent: /sb-[^=]*-auth-token/.test(h.cookie ?? "") }); });
  const evil = await a.newPage();
  await evil.goto(`${EVIL}/`);
  await evil.evaluate(async ({ WORKER, Z }) => {
    const opts = { method: "POST", mode: "no-cors", credentials: "include" };
    await fetch(`${WORKER}/api/admin/inquiries/${Z}/status`, { ...opts, headers: { "content-type": "text/plain" }, body: "{}" }).catch(() => {});
    await fetch(`${WORKER}/api/admin/products/${Z}/status`, { ...opts, headers: { "content-type": "application/x-www-form-urlencoded" }, body: "status=published" }).catch(() => {});
  }, { WORKER, Z });
  // A top-level form post from the other site, as a CSRF page would do it.
  await Promise.all([evil.waitForLoadState("load"), evil.evaluate((WORKER) => { const f = document.createElement("form"); f.method = "post"; f.action = `${WORKER}/api/admin/auth/logout`; document.body.appendChild(f); f.submit(); }, WORKER)]);
  await sleep(1500);
  await evil.close();
  check("csrf", "real other-site page: two fetches and a top-level form post, all refused", seen.length === 3 && seen.every((s) => s.status === 403), JSON.stringify(seen));
  check("csrf", "SameSite=Lax kept the session cookie off every cross-site POST", seen.length === 3 && seen.every((s) => !s.cookieSent), JSON.stringify(seen.map((s) => s.cookieSent)));
  check("csrf", "session still valid after the other-site page", (await apiStatus(a)) === 200);

  // ------------------------------------------------------------------ recovery link opened where a valid session already exists
  const linkWhileSignedIn = await recoveryLink(admin);
  const p2 = await a.newPage();
  await p2.goto(linkWhileSignedIn);
  await p2.waitForLoadState("load");
  await sleep(1500);
  const leftTokens = await hasFragment(p2);
  check("recovery ui", "link opened in a browser that is already signed in: no tokens left in the address bar", !leftTokens, `${pathOf(p2)}; fragment present: ${leftTokens}`);
  await p2.close();

  // ------------------------------------------------------------------ UI logout
  await page.goto(`${WORKER}/admin/dashboard`);
  await Promise.all([page.waitForURL((u) => u.pathname === "/admin/login", { timeout: 20000 }).catch(() => {}), page.click('form[action="/api/admin/auth/logout"] button')]);
  check("ui", "logout button: back to sign-in, no session cookie, API 401", pathOf(page) === "/admin/login" && (await sbCookies(a)).length === 0 && (await apiStatus(a)) === 401, pathOf(page));
  await a.close();

  // ------------------------------------------------------------------ recovery in a fresh browser: bridge, address bar, form, success, sign-in
  const b = await newContext();
  const r = await b.newPage();
  await r.goto(await recoveryLink(admin));
  await r.waitForURL((u) => u.pathname === "/admin/reset-password", { timeout: 30000 });
  await r.waitForSelector("#password", { timeout: 20000 }).catch(() => {});
  const form = await r.evaluate(() => ({ password: !!document.querySelector("#password"), confirm: !!document.querySelector("#confirmPassword"), code: !!document.querySelector("#code"), newPasswordHint: document.querySelector("#password")?.getAttribute("autocomplete"), heading: document.querySelector("h1")?.textContent?.trim() }));
  const cleared = !(await hasFragment(r));
  check("recovery ui", "fresh browser: the page script bridges the link and shows the new-password form with a code field", form.password && form.confirm && form.code && form.newPasswordHint === "new-password" && form.heading === "Create a new password", JSON.stringify(form));
  check("recovery ui", "after the bridge, the address bar holds no tokens", cleared && pathOf(r) === "/admin/reset-password");
  const history = await r.evaluate(() => history.length);
  check("recovery ui", "the link alone: protected API refused (403) in this browser", (await apiStatus(b)) === 403, `history entries ${history}`);
  const next = random();
  // Every required field filled (a wrong code), so the browser's own validation doesn't stop it first.
  await r.fill("#password", next);
  await r.fill("#confirmPassword", next + "x");
  await r.fill("#code", "000000");
  await r.click("[data-reset-password-submit]");
  check("recovery ui", "mismatched passwords are stopped in the page before submission", (await r.locator("[data-reset-password-mismatch]").isVisible()) && pathOf(r) === "/admin/reset-password");
  await r.fill("#confirmPassword", next);
  await r.fill("#code", await freshCode(admin.secret, due));
  await Promise.all([r.waitForURL((u) => u.searchParams.get("done") === "1", { timeout: 30000 }).catch(() => {}), r.click("[data-reset-password-submit]")]);
  await r.waitForLoadState("load");
  check("recovery ui", "success page renders after the change, with no session left in the browser", (await visible(r, "Your password has been reset")) && (await sbCookies(b)).length === 0 && (await apiStatus(b)) === 401);
  await r.reload();
  check("recovery ui", "reloading the success page no longer claims success", !(await visible(r, "Your password has been reset")));
  admin.password = next;
  await sleep(2500);
  await signIn(r, admin);
  await enterCode(r, admin);
  check("recovery ui", "sign-in with the new password and a code reaches the dashboard", pathOf(r) === "/admin/dashboard" && (await apiStatus(b)) === 200, pathOf(r));
  await r.goto(`${WORKER}/admin/dashboard`);
  await r.click('form[action="/api/admin/auth/logout"] button');
  await r.waitForLoadState("load");
  await b.close();

  // ------------------------------------------------------------------ no admin profile, through the page
  const c = await newContext();
  const n = await c.newPage();
  await sleep(2500);
  await signIn(n, none);
  check("no profile ui", "identity with no admin profile: sign-in page shows the generic error, no cookie, API 401", pathOf(n) === "/admin/login" && (await sbCookies(c)).length === 0 && (await apiStatus(c)) === 401 && (await ids.sessions(none)).length === 0, pathOf(n));
  await c.close();

  check("ui", "no Content-Security-Policy violations on any page visited", csp.length === 0, csp.length ? [...new Set(csp)].join(",") : "none");
} catch (e) {
  check("run", "run completed without an error", false, scrub(e.message));
} finally {
  await browser.close().catch(() => {});
  await ids.cleanup();
  compareSnapshots(check, before, await snapshot(q), { sequencesMayAdvance: false });
  const fails = run.finish({ out: args.out, extra: { revision: rev.served } });
  process.exit(process.exitCode ?? (fails ? 1 : 0));
}
