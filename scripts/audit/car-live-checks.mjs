// Checks a deployed site's Car Decoration release (preview or production):
//   node scripts/audit/car-live-checks.mjs https://…  [--browser]
// HTTP: category and every product page, photographs byte-identical to the
// reviewed files, concept labels, no amounts, navigation, sitemap, SEO.
// --browser (playwright-core + Google Chrome): the category and a product
// enquiry are blocked until a recipient city is chosen, and the WhatsApp
// draft then carries that city. Exit 1 on any failure.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sourceLoader } from './source-loader.mjs';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) throw new Error('Usage: car-live-checks.mjs https://site [--browser]');
const load = sourceLoader();
const products = load('src/data/productCatalog.ts').productCatalog.filter((p) => p.category === 'Car Decoration');
const { isConceptImage } = load('src/data/productPhotos.ts');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const get = async (path) => { const r = await fetch(base + path, { redirect: 'follow' }); return { status: r.status, body: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') ?? '' }; };

const cat = await get('/categories/car-decoration');
const html = cat.body.toString();
check('category 200', cat.status === 200, `status ${cat.status}`);
check('category indexable, canonical, title', !/noindex/.test(html) && /rel="canonical" href="https:\/\/onlyfreshpetals\.in\/categories\/car-decoration"/.test(html) && /<title>Car Decoration: Car Gajamala/.test(html));
check('category lists every product', products.every((p) => html.includes(`/products/${p.slug}`)), products.filter((p) => !html.includes(`/products/${p.slug}`)).map((p) => p.slug).join(', '));
check('delivered and on-site sections, safety, city-gated enquiry', /id="decorated-on-site"/.test(html) && /id="garlands-delivered"/.test(html) && /data-car-safety/.test(html) && /data-car-enquiry/.test(html) && /data-product-enquiry/.test(html));
check('concept images labelled on cards', (html.match(/data-concept-image/g) ?? []).length === products.filter((p) => isConceptImage(p.image)).length);
check('no amounts on the category', !/₹\s?\d/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')));
for (const p of products) {
  const page = await get(`/products/${p.slug}`);
  const b = page.body.toString();
  const concept = isConceptImage(p.image);
  const okPage = page.status === 200 && /Price on WhatsApp/.test(b) && /data-car-details/.test(b) && /id="recipient-city"|data-destination-control/.test(b) && (!concept || /Concept image \(AI-generated\)/.test(b)) && !/₹\s?\d/.test(b.replace(/<script[\s\S]*?<\/script>/g, ''));
  const img = await get(p.image);
  const same = img.status === 200 && createHash('sha256').update(img.body).digest('hex') === createHash('sha256').update(readFileSync(`public${p.image}`)).digest('hex');
  check(`product ${p.slug}`, okPage && same, `page ${page.status}, photo ${img.status}${same ? ' (reviewed bytes)' : ' (DIFFERENT bytes)'}`);
}
const home = (await get('/')).body.toString();
check('menu/footer link on the homepage', home.includes('href="/categories/car-decoration"'));
const sitemap = (await get('/sitemap.xml')).body.toString();
check('sitemap lists the category, real photos only', sitemap.includes('/categories/car-decoration<') && !products.some((p) => isConceptImage(p.image) && sitemap.includes(p.image)));

if (process.argv.includes('--browser')) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const drafts = [];
    await ctx.route(/https:\/\/(wa\.me|api\.whatsapp\.com)\//, (route) => { drafts.push(decodeURIComponent(route.request().url())); return route.fulfill({ status: 200, body: 'ok' }); });
    const page = await ctx.newPage();
    await page.goto(base + '/categories/car-decoration', { waitUntil: 'networkidle' });
    await page.locator('[data-car-enquiry]').click();
    await page.waitForTimeout(600);
    const blocked = drafts.length === 0 && (await page.locator('[data-city-step] [data-destination-select]').first().isVisible());
    await page.locator('[data-city-step] [data-destination-select]').first().selectOption({ label: 'Bengaluru' });
    const go = page.locator('[data-city-step] [data-city-step-continue]').first();
    if (await go.count()) await go.click();
    await page.waitForTimeout(1500);
    check('category enquiry: city required, then in the draft', blocked && drafts.some((d) => /Recipient city: Bengaluru/.test(d) && /car \/ vehicle flower decoration/.test(d)), drafts.at(-1)?.slice(0, 160));
    drafts.length = 0;
    const product = await ctx.newPage();
    await product.goto(base + '/products/new-car-rose-gajamala', { waitUntil: 'networkidle' });
    await product.locator('[data-simple-whatsapp]').first().click();
    await product.waitForTimeout(1500);
    check('product enquiry carries the chosen city', drafts.some((d) => /New Car Rose Gajamala/.test(d) && /Recipient city: Bengaluru/.test(d)), drafts.at(-1)?.slice(0, 160));
  } finally {
    await browser.close();
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} car decoration checks passed on ${base}`);
process.exit(failed.length ? 1 : 0);
