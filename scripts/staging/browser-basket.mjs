// The customer basket in a real browser on the deployed staging Worker: add a product,
// fill the delivery details, send on WhatsApp. Checks the WhatsApp draft and that the
// enquiry the page logs is stored once (with the staging test key) or refused without
// it while WhatsApp still opens. Removes its own enquiry rows; checks every table after.
//
//   node scripts/staging/inquiry-test-window.mjs -- node scripts/staging/browser-basket.mjs \
//     --env=<staging env file> --playwright=<playwright-core index.mjs> [--db-port=6543] [--out=<results.json>]
import { pathToFileURL } from "node:url";
import { parseArgs, startRun, snapshot, compareSnapshots, tag, sleep, WORKER, SYNTHETIC_PREFIX } from "./test-lib.mjs";

const args = parseArgs();
const run = startRun({ envFile: args.env, minFreeMb: 1200 });
const { check, log, q, finish } = run;
const KEY = process.env.FP_STAGING_INQUIRY_TEST_KEY ?? "";
if (!args.playwright) { console.log("STOP: --playwright=<path to playwright-core index.mjs> is required"); process.exit(2); }
const { chromium } = await import(pathToFileURL(args.playwright).href);
const WHATSAPP = "https://wa.me/919652012274";
const MARK = `${SYNTHETIC_PREFIX}basket-`;

const before = await snapshot(q);
log("baseline", JSON.stringify({ tables: Object.keys(before.tables).length, objects: before.storage.n, auth: before.auth }));
const leftover = (await q(`select count(*)::int n from inquiries where customer_name like $1`, [`${MARK}%`]))[0].n;
check("setup", "no basket test enquiries left from earlier runs", leftover === 0, `${leftover}`);

// A static product page with a basket button, from the sitemap.
const sitemap = await (await fetch(`${WORKER}/sitemap.xml`)).text();
const products = [...sitemap.matchAll(/<loc>https:\/\/onlyfreshpetals\.in(\/products\/[a-z0-9-]+)<\/loc>/g)].map((m) => m[1]);

const browser = await chromium.launch({ headless: true });
const inDays = (n) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };

async function basket({ withKey, label }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const posts = [];
  await context.route(`${WORKER}/api/inquiries`, async (route) => {
    const headers = { ...route.request().headers() };
    if (withKey && KEY) headers["x-fp-staging-inquiry-test"] = KEY;
    const response = await route.fetch({ headers });
    posts.push({ status: response.status(), body: route.request().postDataJSON() });
    await route.fulfill({ response });
  });
  // WhatsApp is captured, never opened: window.open returns a stand-in tab that records its address.
  await context.addInitScript(() => {
    if (location.protocol !== "https:") return;
    window.__wa = [];
    window.open = (url) => { if (url) window.__wa.push(url); return { close() {}, location: { set href(v) { window.__wa.push(v); } } }; };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/403|Content Security|favicon/.test(m.text())) errors.push(m.text()); });

  let product = null;
  for (const path of products.slice(0, 20)) {
    await page.goto(`${WORKER}${path}`, { waitUntil: "domcontentloaded" });
    const button = page.locator("[data-add-to-cart]:visible").first();
    // The first basket button may belong to a related-product card: record what it adds.
    if (await button.count()) { const name = (await button.getAttribute("data-cart-name")) ?? ""; await button.click(); product = { path, name }; break; }
  }
  check("basket", `${label}: a product page adds to the basket`, !!product, product?.path ?? "no basket button on the first 20 products");
  if (!product) { await context.close(); return null; }

  await page.goto(`${WORKER}/cart`, { waitUntil: "domcontentloaded" });
  const marker = `${MARK}${tag()}`;
  await page.locator("[data-customer-name]").fill(marker);
  await page.locator("[data-customer-phone]").fill("9876543210");
  await page.locator("[data-delivery-date]").fill(inDays(4));
  const slot = page.locator("[data-delivery-slot]");
  const slotValue = await slot.evaluate((s) => [...s.options].find((o) => o.value && !o.disabled)?.value ?? "");
  await slot.selectOption(slotValue);
  await page.locator("[data-recipient-name]").fill("Test Recipient");
  await page.locator("[data-recipient-phone]").fill("9876543211");
  await page.locator("[data-delivery-landmark]").fill("Staging test landmark");
  await page.locator("[data-send-cart-whatsapp]").click();
  let wa = [];
  for (let i = 0; i < 30 && !wa.length; i++) { await sleep(500); wa = await page.evaluate(() => window.__wa ?? []); }
  const url = wa.find((u) => u.startsWith("https://")) ?? "";
  const text = url.startsWith(`${WHATSAPP}?`) ? new URL(url).searchParams.get("text") ?? "" : "";
  const shown = await page.locator("[data-cart-error], [role=alert]").allInnerTexts().catch(() => []);
  check("whatsapp", `${label}: Send on WhatsApp opens the shop's WhatsApp with the basket in the draft`, !!text && text.includes(product.name) && text.includes("Test Recipient"), text ? text.slice(0, 140) : `no WhatsApp address; page says: ${shown.join(" ").slice(0, 160)}`);
  for (let i = 0; i < 20 && !posts.length; i++) await sleep(500);
  await sleep(1500);
  const rows = await q(`select id, phone, recipient_phone, status::text status, products::text products from inquiries where customer_name=$1`, [marker]);
  check("console", `${label}: no script errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
  return { marker, posts, rows, product };
}

try {
  const keyed = await basket({ withKey: true, label: "with the test key" });
  if (keyed) {
    check("enquiry", "the page logged the enquiry once and the Worker stored it (201)", keyed.posts.length === 1 && keyed.posts[0].status === 201 && keyed.rows.length === 1, `${keyed.posts.map((p) => p.status).join(",")}; rows ${keyed.rows.length}`);
    const row = keyed.rows[0];
    check("enquiry", "stored row: new, phone numbers normalised, the basket's product recorded", !!row && row.status === "new" && /9876543210$/.test(row.phone) && /9876543211$/.test(row.recipient_phone) && row.products.includes(keyed.product.name), row ? `${row.status} ${row.products.slice(0, 80)}` : "none");
  }
  const visitor = await basket({ withKey: false, label: "as a visitor (no key)" });
  if (visitor) check("enquiry", "a visitor's enquiry is refused on staging (403) and nothing is stored, while WhatsApp still opened", visitor.posts.length === 1 && visitor.posts[0].status === 403 && visitor.rows.length === 0, `${visitor.posts.map((p) => p.status).join(",")}; rows ${visitor.rows.length}`);
} finally {
  await browser.close();
  const removed = await q(`delete from inquiries where customer_name like $1 returning id`, [`${MARK}%`]);
  log(`cleanup: removed ${removed.length} basket test enquiry row(s)`);
  const after = await snapshot(q);
  compareSnapshots(check, before, after);
}
process.exit(finish({ out: args.out }) ? 1 : 0);
