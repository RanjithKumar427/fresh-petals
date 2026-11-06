// The prebuilt storefront's browser-side behaviour on the deployed staging Worker (no
// credentials, GET only): the city shop's ?collection= and ?page=, old ?colour= filter links,
// the garland list's ?unavailable= notice, garland results in search, and no CSP or script
// errors. WhatsApp and every other host are blocked.
//
//   node scripts/staging/browser-static.mjs --playwright=<playwright-core index.mjs> [--out=<results.json>]
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { AUTH_ORIGIN as WORKER } from "./deploy-lib.mjs";
import { parseArgs } from "./test-lib.mjs";

const args = parseArgs();
if (!args.playwright) { console.log("usage: --playwright=<playwright-core index.mjs>"); process.exit(2); }
const { chromium } = await import(pathToFileURL(args.playwright).href);
const results = [];
const check = (area, name, ok, evidence = "") => {
  results.push({ area, name, status: ok ? "PASS" : "FAIL", evidence: String(evidence).slice(0, 300) });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${evidence ? ` | ${String(evidence).slice(0, 180)}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route("**/*", (route) => (route.request().url().startsWith(`${WORKER}/`) || route.request().url().startsWith("data:") ? route.continue() : route.abort()));
const problems = [];
const page = await context.newPage();
page.on("pageerror", (e) => problems.push(`error: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/net::ERR_FAILED|ERR_BLOCKED/.test(m.text())) problems.push(m.text().slice(0, 160)); });
const visible = (selector) => page.$$eval(selector, (els) => els.filter((e) => !e.hidden && !e.closest("[hidden]")).length);

try {
  const shop = `${WORKER}/locations/hyderabad/shop`;
  await page.goto(`${shop}?collection=garlands-rose&page=2`, { waitUntil: "load" });
  const heading = await page.locator("[data-shop-heading]").innerText();
  const range = await page.locator("[data-shop-range]").innerText();
  const current = await page.$$eval("[data-shop-pages] [aria-current=page]", (els) => els.map((e) => e.textContent));
  check("shop", "?collection=garlands-rose&page=2: that collection's page 2 (24 cards), heading, range, page links and title", (await visible("[data-shop-item]")) === 24 && /Rose wedding garlands in Hyderabad/.test(heading) && /Showing 25–48 of 78, page 2 of 4/.test(range) && current.join() === "2" && /page 2/.test(await page.title()), `${heading} | ${range}`);
  const chip = await page.$eval('[data-shop-collection="garlands-rose"]', (a) => a.getAttribute("aria-current"));
  const allChip = await page.$eval('[data-shop-collection="all"]', (a) => a.getAttribute("aria-current"));
  check("shop", "the chosen collection's chip is current, All products is not", chip === "page" && allChip === null, `${chip} ${allChip}`);
  const next = await page.$eval('[data-shop-pages] a[rel="next"]', (a) => a.getAttribute("href"));
  check("shop", "Next links to page 3 of the same collection", next === "/locations/hyderabad/shop?collection=garlands-rose&page=3", next);
  await page.goto(`${shop}?collection=nope&page=999`, { waitUntil: "load" });
  const range2 = await page.locator("[data-shop-range]").innerText();
  check("shop", "unknown collection shows everything; an out-of-range page shows the last one", /Showing 217–238 of 238, page 10 of 10/.test(range2) && (await visible("[data-shop-item]")) === 22, range2);
  await page.goto(shop, { waitUntil: "load" });
  check("shop", "plain shop: page 1 of all products", /Showing 1–24 of 238/.test(await page.locator("[data-shop-range]").innerText()) && (await visible("[data-shop-item]")) === 24);
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  await nojs.route("**/*", (route) => (route.request().url().startsWith(`${WORKER}/`) ? route.continue() : route.abort()));
  const plain = await nojs.newPage();
  await plain.goto(`${shop}?page=3`, { waitUntil: "load" });
  check("shop", "without scripts every product is listed and linked", (await plain.$$eval("[data-shop-item]", (els) => els.filter((e) => !e.hidden).length)) === 238);
  await nojs.close();

  await page.goto(`${WORKER}/categories/bouquets?colour=red&utm_source=t`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const url = new URL(page.url());
  const colours = await page.$$eval("[data-shop-item]", (els) => els.filter((e) => !e.hidden && !e.closest("[hidden]")).map((e) => e.getAttribute("data-colours") ?? ""));
  check("filters", "an old ?colour=red link: the static page shows red bouquets only and moves to the fragment address, keeping utm_source", url.search === "?utm_source=t" && url.hash === "#colour=red" && colours.length > 0 && colours.every((c) => c.split(" ").includes("red")), `${url.search}${url.hash}; ${colours.length} shown`);
  await page.goto(`${WORKER}/occasions/birthday?colour=pink`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  check("filters", "an occasion ?colour= link moves to its fragment address", new URL(page.url()).hash === "#colour=pink" && new URL(page.url()).search === "", page.url());
  // Every product is quote-only, so no list carries a budget band and an old ?budget= selection is
  // ignored (withoutUnpricedBudget): the address becomes the plain page, the full list stays shown.
  await page.goto(`${WORKER}/occasions/birthday?budget=under-1500`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const shownBudget = await visible("[data-shop-item]");
  check("filters", "an old ?budget= link on an all-quote-only list: plain address, nothing filtered out", new URL(page.url()).search === "" && new URL(page.url()).hash === "" && shownBudget > 0, `${page.url()} ${shownBudget} shown`);

  await page.goto(`${WORKER}/categories/garlands?unavailable=fp-g99999`, { waitUntil: "load" });
  const notice = page.locator("[data-garland-unavailable-notice]");
  check("garlands", "?unavailable= shows the notice with the design code (filled in the browser)", (await notice.isVisible()) && /Design FP-G99999 isn't available/.test(await notice.innerText()));
  await page.goto(`${WORKER}/categories/garlands?unavailable=<script>`, { waitUntil: "load" });
  check("garlands", "an invalid code shows no notice", !(await notice.isVisible()));
  await page.click('[data-garland-filter="lotus"]');
  await page.waitForTimeout(300);
  const filters = await page.$$eval("[data-garland-card]", (els) => els.filter((e) => e.offsetParent !== null).map((e) => (e.getAttribute("data-garland-filters") ?? "").split(" ")));
  check("garlands", "the lotus chip shows only lotus garlands", filters.length > 0 && filters.every((f) => f.includes("lotus")), `${filters.length} shown`);

  await page.goto(`${WORKER}/search?q=lotus`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const results = await page.$$eval("[data-product-result]", (els) => els.filter((e) => !e.hidden && e.offsetParent !== null).length);
  check("search", "search finds garlands from the prebuilt fragment", results > 0, `${results} results for lotus`);
  check("console", "no script errors or CSP violations on these pages", problems.length === 0, problems.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(`SUMMARY ${results.length - failed} PASS, ${failed} FAIL`);
if (args.out) writeFileSync(args.out, JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
process.exit(failed ? 1 : 0);
