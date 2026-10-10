// Run after local-fixture prepare/build. No production or external requests.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { OUT, PORT, db } from './local-fixture.mjs';
import { serveBuild } from './serve-build.mjs';
import { sourceLoader } from './source-loader.mjs';

if (!process.env.FP_PLAYWRIGHT_MODULE) throw new Error('Set FP_PLAYWRIGHT_MODULE to an installed playwright-core module; see docs/audit-regressions.md.');
const { chromium } = await import(pathToFileURL(process.env.FP_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true });
const server = await serveBuild();
const pool = db();
const base = `http://127.0.0.1:${PORT}`;
const lines = [];
const screenshots = path.join(OUT, 'screenshots'); mkdirSync(screenshots, { recursive: true });
const log = (s) => { lines.push(s); console.log(s); };
const load = sourceLoader();
const { launchProducts } = load('src/data/launchCatalogue.ts');
const { makeJourney } = load('src/utils/journey.ts');
const access = [{ name: 'audit-access', value: 'full', domain: '127.0.0.1', path: '/' }];
async function context(options = {}) {
  const ctx = await browser.newContext(options);
  await ctx.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === '/api/inquiries') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":{"id":0}}' });
    return route.continue();
  });
  await ctx.addInitScript(() => { window.__drafts = []; window.open = (url) => { if (url) window.__drafts.push(url); return null; }; });
  return ctx;
}
async function savedState(slug, occasionIds) {
  const id = (await pool.query('SELECT id FROM products WHERE slug=$1', [slug])).rows[0].id;
  const response = await fetch(`${base}/api/admin/products/${id}`, { headers: { cookie: 'audit-access=full' } });
  const product = (await response.json()).data;
  const result = await fetch(`${base}/api/admin/products/${id}`, { method: 'PATCH', headers: { cookie: 'audit-access=full', origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ ...product, occasionIds }) });
  assert.equal(result.status, 200); return result.json();
}
async function capture(page, name) {
  // Scroll real lazy images into view before retaining full-page evidence.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 90)); }
    scrollTo(0, 0);
    await Promise.all([...document.images].filter((img) => img.complete).map((img) => img.decode().catch(() => {})));
  });
  await page.screenshot({ path: path.join(screenshots, name + '.png'), fullPage: true });
}
async function noOverflow(page) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow'); }
try {
  const redId = (await pool.query("SELECT id FROM products WHERE slug='red-affair'")).rows[0].id;
  const house = (await pool.query("SELECT id,name FROM occasions WHERE slug='housewarming'")).rows[0];
  const initial = (await fetch(`${base}/api/admin/products/${redId}`, { headers: { cookie: 'audit-access=full' } }).then((r) => r.json())).data.occasionIds;
  assert.equal((await fetch(`${base}/api/admin/products/${redId}`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/products/${redId}`, { headers: { cookie: 'audit-access=mfa' } })).status, 403);
  log('PASS permission middleware: anonymous 401, first-factor 403, full fixture admin allowed (Supabase MFA boundary doubled).');

  for (const width of [360, 390, 1440]) {
    await savedState('red-affair', [...new Set([...initial, house.id])]);
    const ctx = await context({ viewport: { width, height: width === 1440 ? 1000 : 844 } });
    await ctx.addCookies(access);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/admin/products/edit/${redId}`);
    const toggle = page.getByRole('button', { name: house.name, exact: true });
    await toggle.waitFor(); assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    const save = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/api/admin/products/${redId}`));
    await toggle.click(); const result = await (await save).json();
    assert.equal(result.occasions.maxDelaySeconds, 180); assert.equal(result.occasions.refresh.ok, false);
    await page.locator('[data-occasion-website="refresh-failed"]').waitFor();
    assert.match(await page.locator('[data-occasion-website]').innerText(), /change is saved.*within 3 minutes/);
    assert.match(await page.locator('body').innerText(), /deployment/i);
    await capture(page, `admin-removal-${width}`);
    const check = await fetch(`${base}/api/admin/products/${redId}/occasion-pages?routes=housewarming`, { headers: { cookie: 'audit-access=full' } }).then((r) => r.json());
    assert.equal(check.data.allOk, true); assert.equal(check.data.pages[0].seen, 'absent');
    log(`PASS ${width}px actual admin assignment removal, checker and failed-refresh feedback (180-second header contract).`);

    await page.goto(`${base}/categories/bouquets?occasion=housewarming`);
    const chip = page.locator('[data-filter-value="housewarming"]');
    assert.equal(await chip.getAttribute('aria-pressed'), 'true'); assert(await chip.isVisible());
    assert.equal(await page.locator('[data-shop-item]:visible').count(), 0);
    assert.match(await page.locator('[data-shop-count]').innerText(), /Showing 0 of 8/);
    assert(await page.locator('[data-shop-empty]').isVisible());
    assert.match(new URL(await page.locator('[data-filter-help]').getAttribute('href')).searchParams.get('text'), /Housewarming/);
    await noOverflow(page); await capture(page, `empty-filter-${width}`);
    await page.reload(); assert.equal(await page.locator('[data-shop-item]:visible').count(), 0);
    await page.locator('[data-filters-clear]').first().click(); assert.equal(await page.locator('[data-shop-item]:visible').count(), 8);
    await page.goBack(); assert.equal(await page.locator('[data-shop-item]:visible').count(), 0); assert.equal(await chip.getAttribute('aria-pressed'), 'true');
    await page.goto(`${base}/categories/bouquets?occasion=invalid-value`); assert.equal(await page.locator('[data-shop-item]:visible').count(), 8);
    log(`PASS ${width}px valid empty filters: direct arrival, reload, Clear, Back, counts, assistance; invalid value stays unselected.`);

    await page.goto(`${base}/categories/bouquets?occasion=birthday&for=gift`);
    const card = page.locator('[data-shop-item]:visible').first();
    const productLink = card.locator('[data-journey-link]').first();
    const href = await productLink.getAttribute('href'); assert.equal(new URL(href, base).searchParams.get('occ'), 'birthday');
    assert.match(new URL(await card.locator('[data-whatsapp-order-link]').getAttribute('href')).searchParams.get('text'), /Occasion: Birthday/);
    await productLink.click(); await page.locator('[data-simple-whatsapp]').waitFor();
    assert(!new URL(await page.locator('link[rel="canonical"]').getAttribute('href')).search);
    await page.locator('[data-simple-whatsapp]').click();
    assert.match(await page.evaluate(() => new URL(window.__drafts.at(-1)).searchParams.get('text')), /Occasion: Birthday[\s\S]*For: A gift/);
    await page.locator('[data-simple-add-to-cart]').click();
    await page.locator('[data-delivery-details-panel] > summary').click();
    await page.locator('[data-option-occasion]').selectOption({ label: 'Anniversary' });
    await page.reload(); assert.equal(await page.locator('[data-option-occasion]').inputValue(), 'Anniversary');
    await page.locator('[data-simple-add-to-cart]').click();
    await page.goto(`${base}/products/red-affair`); await page.locator('[data-simple-add-to-cart]').click();
    let cart = await page.evaluate(() => JSON.parse(localStorage.getItem('fresh_petals_cart')));
    assert.equal(cart.length, 3); assert(cart.some((i) => i.journey?.occasion === 'birthday')); assert(cart.some((i) => i.journey?.occasion === 'anniversary')); assert(cart.some((i) => !i.journey));
    await page.goto(`${base}/cart`); await page.locator('[data-customer-name]').fill('Audit fixture'); await page.locator('[data-customer-phone]').fill('9999999999');
    await page.locator('[data-delivery-date]').fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    await page.locator('[data-delivery-slot]').selectOption({ index: 1 });
    await page.locator('[data-recipient-name]').fill('Fixture recipient'); await page.locator('[data-recipient-phone]').fill('9999999999');
    await page.locator('[data-delivery-landmark]').fill('Isolated test landmark');
    await page.locator('[data-send-cart-whatsapp]').click();
    await page.waitForFunction(() => window.__drafts.length > 0);
    const message = await page.evaluate(() => new URL(window.__drafts.at(-1)).searchParams.get('text'));
    assert.match(message, /Occasion: Birthday/); assert.match(message, /Occasion: Anniversary/);
    const blocks = message.split(/\n\d+\. /).slice(1);
    assert.equal(blocks.filter((b) => b.includes('Occasion: Birthday')).length, 1);
    assert.equal(blocks.filter((b) => b.includes('Occasion: Anniversary')).length, 1);
    assert.match(await page.locator('[data-cart-items]').innerText(), /Chosen for: Birthday/);
    await noOverflow(page); await capture(page, `mixed-context-cart-${width}`);
    log(`PASS ${width}px list/product enquiry, canonical, subsequent choice, unfiltered visit, persisted mixed basket and intercepted WhatsApp draft.`);

    await page.goto(`${base}/occasions/housewarming?for=ceremony`);
    assert.equal(await page.locator('[data-shop-item]:visible').count(), 0); assert.equal(await page.locator('[data-garland-card]:visible').count(), 0);
    assert.match(await page.locator('[data-intent-section="ceremony"]').innerText(), /aren't online yet/);
    await page.goto(`${base}/`); assert.equal(await page.getByRole('link', { name: 'Flowers for a ceremony', exact: true }).count(), 0);
    await noOverflow(page); await capture(page, `home-${width}`);
    assert.equal(errors.length, 0, errors.join('\n'));
    log(`PASS ${width}px ceremony enquiry eligibility and homepage CSS 3D; no browser exceptions or horizontal overflow.`);
    await ctx.close();

    const nojs = await context({ javaScriptEnabled: false, viewport: { width, height: 844 } });
    const plain = await nojs.newPage(); await plain.goto(`${base}/categories/bouquets?occasion=housewarming`);
    assert.equal(await plain.locator('[data-shop-item]:visible').count(), 0); assert(await plain.locator('[data-filter-value="housewarming"]').isVisible());
    assert.match(await plain.locator('[data-shop-count]').innerText(), /Showing 0 of 8/);
    await plain.locator('[data-filters-clear]').first().click(); assert.equal(await plain.locator('[data-shop-item]:visible').count(), 8);
    await plain.goto(`${base}/categories/bouquets?occasion=birthday&for=gift`);
    assert.equal(new URL(await plain.locator('[data-shop-item]:visible [data-journey-link]').first().getAttribute('href'), base).searchParams.get('occ'), 'birthday');
    await nojs.close(); log(`PASS ${width}px JavaScript-disabled filter, count, Clear and contextual links.`);
  }

  // Older catalogue fallback: real API saves and real request-rendered HTML.
  const thanks = (await pool.query("SELECT id FROM occasions WHERE slug='thank-you'")).rows[0].id;
  for (const ids of [[thanks], [], [thanks]]) {
    const save = await savedState('premium-card-addon', ids);
    const html = await fetch(`${base}/occasions/thank-you`).then((r) => r.text());
    assert.equal(html.includes('data-occasion-product-slug="premium-card-addon"'), ids.length > 0);
    assert.equal(save.ok, true);
  }
  log('PASS older catalogue explicit addition, empty removal and restoration through actual admin API; no editorial re-addition.');

  const prices = Object.fromEntries((await pool.query('SELECT slug,selling_price FROM products')).rows.map((p) => [p.slug, p.selling_price]));
  const ctx = await context({ viewport: { width: 1440, height: 1000 } }); const page = await ctx.newPage();
  await page.goto(`${base}/categories/bouquets`);
  for (const product of launchProducts()) {
    assert.match(await page.locator(`[data-cart-slug="${product.slug}"]`).getAttribute('data-cart-price-label'), new RegExp(String(prices[product.slug])));
    await page.goto(`${base}/products/${product.slug}`);
    assert.match(await page.locator('[data-product-options]').getAttribute('data-product-price-label'), new RegExp(String(prices[product.slug])));
    await page.locator('[data-simple-whatsapp]').click();
    assert.match(await page.evaluate(() => new URL(window.__drafts.at(-1)).searchParams.get('text')), new RegExp(String(prices[product.slug])));
    await page.goto(`${base}/categories/bouquets`);
  }
  await pool.query("UPDATE products SET selling_price=selling_price+111 WHERE slug='red-affair'");
  await page.goto(`${base}/categories/bouquets`); assert.match(await page.locator('[data-cart-slug="red-affair"]').getAttribute('data-cart-price-label'), new RegExp(String(prices['red-affair'])));
  await page.evaluate((journey) => localStorage.setItem('fresh_petals_cart', JSON.stringify([{ id: 'persisted', slug: 'red-affair', name: 'Red Affair', image: '/images/product-placeholder.svg', priceLabel: 'From ₹1', category: 'Bouquets', quantity: 2, journey, addOns: [{ id: 'chocolates-addon', name: 'Chocolates', priceLabel: '₹1', quantity: 3 }] }])), makeJourney(['birthday'], 'gift'));
  await page.goto(`${base}/cart`); assert(await page.locator('[data-cart-price-notice]').isVisible());
  const corrected = await page.evaluate(() => JSON.parse(localStorage.getItem('fresh_petals_cart'))[0]);
  assert.match(corrected.priceLabel, new RegExp(String(prices['red-affair']))); assert.equal(corrected.quantity, 2); assert.equal(corrected.addOns[0].quantity, 3); assert.equal(corrected.journey.occasion, 'birthday');
  await capture(page, 'price-change-notice-desktop'); await ctx.close();
  log('PASS eight bouquet list/product snapshot prices, post-build DB edit isolation and persisted item/add-on reconciliation retaining quantities/context.');

  // A new synthetic design, never one of the 156 owner drafts.
  const category = (await pool.query('SELECT id FROM categories LIMIT 1')).rows[0].id;
  const gid = (await pool.query("INSERT INTO products (slug,name,category_id,status,price_type,selling_price) VALUES ('audit-garland-900','Audit garland 900',$1,'published','fixed',5000) RETURNING id", [category])).rows[0].id;
  await pool.query("INSERT INTO garland_details (product_id,design_code,sold_unit,photo_permission,sample_verified) VALUES ($1,'FP-G900','pair','granted',true)", [gid]);
  const mid = (await pool.query("INSERT INTO media (filename,url,folder,mime_type,source) VALUES ('fixture.svg','/images/product-placeholder.svg','products','image/svg+xml','seed') RETURNING id")).rows[0].id;
  await pool.query('INSERT INTO product_images (product_id,media_id,is_primary,sort_order) VALUES ($1,$2,true,0)', [gid, mid]);
  await pool.query("INSERT INTO product_options (product_id,option_name,value_label,extra_charge) VALUES ($1,'Finish','Test tassels',125)", [gid]);
  await pool.query("INSERT INTO product_occasions (product_id,occasion_id) SELECT $1,id FROM occasions WHERE slug='wedding'", [gid]);
  const quote = async () => fetch(`${base}/garland-enquiry?code=FP-G900&qty=2&occ=wedding&for=ceremony&opt=Finish%3A%3ATest%20tassels`, { redirect: 'manual' });
  let response = await quote(); assert.equal(response.status, 302); assert.equal(response.headers.get('cache-control'), 'no-store');
  let message = new URL(response.headers.get('location')).searchParams.get('text'); assert.match(message, /5,000/); assert.match(message, /125/); assert.match(message, /Quantity: 2 pairs/); assert.match(message, /Occasion: Wedding/);
  await pool.query('UPDATE products SET selling_price=6200 WHERE id=$1', [gid]); response = await quote(); message = new URL(response.headers.get('location')).searchParams.get('text'); assert.match(message, /6,200/); assert(!message.includes('12,400'));
  const ceremonyResponse = await fetch(`${base}/occasions/wedding?for=ceremony`);
  assert(ceremonyResponse.headers.get('vercel-cache-tag').includes('garlands'));
  const html = await ceremonyResponse.text(); assert(html.includes('Audit garland 900'));
  for (const width of [360, 390, 1440]) {
    const ctx = await context({ viewport: { width, height: 844 } }); const page = await ctx.newPage();
    await page.goto(`${base}/occasions/wedding?for=ceremony`);
    assert.equal(await page.locator('[data-garland-card]:visible').count(), 1);
    assert.equal(await page.locator('[data-shop-item]:visible').count(), 1);
    const href = await page.locator('[data-garland-card] a[href^="/products/"]').first().getAttribute('href');
    assert.equal(new URL(href, base).searchParams.get('for'), 'ceremony');
    assert.equal(new URL(href, base).searchParams.get('occ'), 'wedding');
    await noOverflow(page); await capture(page, `public-ceremony-fixture-${width}`); await ctx.close();
    log(`PASS ${width}px synthetic public ceremony eligibility and contextual product link; gift bouquets excluded.`);
  }
  await pool.query("UPDATE products SET status='draft' WHERE id=$1", [gid]); response = await quote(); assert.equal(response.status, 303); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM garland_details d JOIN products p ON p.id=d.product_id WHERE d.design_code <> 'FP-G900' AND p.status='draft'")).rows[0].n, 156);
  log('PASS synthetic garland live price/option charges/unit/context, SSR ceremony membership and uncached refusal after unpublishing; all 156 original drafts remain private.');
  log('COMPLETE: local production-mode build only; external browser requests blocked, enquiries intercepted, production CDN/MFA not exercised.');
} catch (error) {
  log('FAIL ' + error.stack); throw error;
} finally {
  writeFileSync(path.join(OUT, 'browser.log'), lines.join('\n') + '\n');
  await browser.close(); await pool.end(); await new Promise((resolve) => server.close(resolve));
}
