// Browser checks for a deployed preview (GET only; WhatsApp and every other
// host are blocked, so nothing is sent). Run by preview-pipeline.mjs after its
// HTTP checks, or by hand:
//
//   node scripts/cloudflare/preview-browser.mjs --base=https://fresh-petals-preview.<sub>.workers.dev \
//     [--playwright=<playwright-core index.mjs>] [--chrome=/usr/bin/google-chrome] [--cores=8]
//
// --cores emulates navigator.hardwareConcurrency for local machines with ≤ 2
// cores, where the homepage deliberately keeps the static petals.
//
// 1. Old filter links (docs/cloudflare-migration.md, "Query-string behaviour
//    moved to the browser"): /categories/bouquets?occasion=birthday is a
//    static page; its script selects Birthday, shows only birthday designs,
//    moves the address to #occasion=birthday and keeps filtering afterwards.
//    The canonical stays the clean collection address.
// 2. The homepage's petal hand-over (docs/homepage-petals-2026-11-17.md): the
//    static petals stay visible until the canvas is fully opaque over them,
//    and a petal click opens its range.
//
// Every check either runs and passes or fails; a missing browser or WebGL is
// a failure, never a skip.
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

// Minimal PNG reader (8-bit RGB/RGBA, non-interlaced: Chrome's screenshots).
function readPng(buf) {
  let p = 8, w = 0, h = 0, ch = 4;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ch = data[9] === 2 ? 3 : 4; }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= ch && y ? out[(y - 1) * stride + x - ch] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[y * stride + x] = (row[x] + pred) & 255;
    }
  }
  return { w, h, ch, px: out };
}
// Petal pixels: anything not the magenta key the stage is put on for the capture.
const silhouette = ({ w, h, ch, px }) => Array.from({ length: w * h }, (_, i) => Math.abs(px[i * ch] - 255) + px[i * ch + 1] + Math.abs(px[i * ch + 2] - 255) > 90);

const CANONICAL = 'https://onlyfreshpetals.in/categories/bouquets';

export async function runBrowserChecks(base, { playwright, chrome, cores } = {}) {
  const results = [];
  const check = (name, ok, evidence = '') => results.push({ name: `browser: ${name}`, ok: !!ok, evidence: String(evidence).slice(0, 220) });
  let chromium;
  try {
    // An explicit path (local runs), else the package itself (installed by the preview job).
    // Either entry may be CommonJS, whose exports arrive on `default`.
    const mod = playwright ? await import(pathToFileURL(playwright).href) : await import('playwright-core');
    chromium = mod.chromium ?? mod.default?.chromium;
    if (!chromium?.launch) throw new Error('playwright-core has no chromium.launch');
  } catch (error) {
    check('browser available', false, `playwright-core not found (${error.message.split('\n')[0]}); browser checks NOT executed`);
    return results;
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chrome ?? process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  } catch (error) {
    check('browser available', false, `Chrome did not start (${error.message.split('\n')[0]}); browser checks NOT executed`);
    return results;
  }
  const origin = new URL(base).origin;
  try {
    // ---- 1. old ?occasion= filter link
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', (route) => (route.request().url().startsWith(origin + '/') || route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/categories/bouquets?occasion=birthday`, { waitUntil: 'load' });
    await page.waitForFunction(() => location.hash.includes('occasion='), null, { timeout: 5000 }).catch(() => {});
    const state = async () => page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-shop-item]')];
      const shown = items.filter((e) => !e.hidden && !e.closest('[hidden]'));
      const pressed = [...document.querySelectorAll('[data-filter-group][aria-pressed="true"]')].map((c) => `${c.dataset.filterGroup}:${c.dataset.filterValue}`);
      return {
        path: location.pathname, search: location.search, hash: location.hash,
        canonical: document.querySelector('link[rel=canonical]')?.href,
        total: new Set(items.map((e) => e.dataset.slug)).size,
        allBirthday: items.every((e) => (e.dataset.occasions ?? '').split(' ').includes('birthday')),
        shown: new Set(shown.map((e) => e.dataset.slug)).size,
        shownOccasions: shown.map((e) => (e.dataset.occasions ?? '').split(' ')),
        shownColours: shown.map((e) => (e.dataset.colours ?? '').split(' ')),
        pressed,
        count: document.querySelector('[data-shop-count]')?.textContent.replace(/\s+/g, ' ').trim(),
        colourChip: [...document.querySelectorAll('[data-filter-group="colour"]')].find((c) => !c.hidden && c.getAttribute('aria-pressed') !== 'true')?.dataset.filterValue ?? null,
      };
    });
    let s = await state();
    check('?occasion=birthday: the address becomes /categories/bouquets#occasion=birthday', s.path === '/categories/bouquets' && s.search === '' && s.hash === '#occasion=birthday', `${s.path}${s.search}${s.hash}`);
    check('?occasion=birthday: the Birthday chip is the only active filter', s.pressed.length === 1 && s.pressed[0] === 'occasion:birthday', s.pressed.join(','));
    check('?occasion=birthday: only birthday designs are shown, and some are', s.shown > 0 && s.shownOccasions.every((o) => o.includes('birthday')) && (s.shown < s.total || s.allBirthday), `${s.shown} of ${s.total} shown; "${s.count}"`);
    check('?occasion=birthday: the count reports the selection', new RegExp(`Showing ${s.shown} of ${s.total}`).test(s.count ?? ''), s.count);
    check('?occasion=birthday: the canonical is the clean collection address', s.canonical === CANONICAL, s.canonical);
    // Filtering still works after initialisation: remove Birthday, then pick a colour.
    await page.click('[data-filter-group="occasion"][data-filter-value="birthday"]');
    await page.waitForTimeout(250);
    s = await state();
    check('after clearing Birthday: every bouquet is shown and the address has no filter', s.shown === s.total && !/occasion=/.test(s.hash) && s.pressed.length === 0, `${s.shown}/${s.total} ${s.hash}`);
    const colour = s.colourChip;
    if (colour) {
      await page.click(`[data-filter-group="colour"][data-filter-value="${colour}"]`);
      await page.waitForTimeout(250);
      s = await state();
      check(`then choosing colour "${colour}": only those designs, address #colour=${colour}`, s.shown > 0 && s.shown < s.total && s.shownColours.every((c) => c.includes(colour)) && s.hash === `#colour=${colour}`, `${s.shown}/${s.total} ${s.hash}`);
    } else check('a colour chip to test filtering after initialisation', false, 'no colour chip on the page');
    check('bouquet list: no script errors', errors.length === 0, errors.join(' | '));
    await ctx.close();

    // ---- 1b. collection layout (audit 18 Nov 2026): first view at 1366x768,
    // filter groups in view, group links agree with the visible results.
    const lay = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await lay.route('**/*', (route) => (route.request().url().startsWith(origin + '/') || route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    const lp = await lay.newPage();
    await lp.goto(`${origin}/categories/bouquets`, { waitUntil: 'load' });
    const first = await lp.evaluate(() => {
      const h1 = document.querySelector('h1').getBoundingClientRect();
      const intro = document.querySelector('.collection-head > div:nth-child(2) p')?.getBoundingClientRect();
      const img = [...document.querySelectorAll('[data-shop-item] img')].find((i) => i.offsetParent)?.getBoundingClientRect();
      const groups = [...document.querySelectorAll('.filters__group')].filter((g) => !g.hidden).map((g) => ({ label: g.querySelector('.filters__label')?.textContent.trim(), left: g.getBoundingClientRect().left, top: g.getBoundingClientRect().top }));
      return { h1Top: Math.round(h1.top), introTop: Math.round(intro?.top ?? -1), img: Math.round(img?.top ?? 9999), groups };
    });
    check('1366x768: title and introduction start together', Math.abs(first.h1Top - first.introTop) < 60, `h1 ${first.h1Top}, intro ${first.introTop}`);
    check('1366x768: the first bouquet photographs start in the opening view', first.img < 768 - 40, `first photo at ${first.img}px`);
    check('1366x768: Occasion and Colour filters are both in view', first.groups.length >= 2 && first.groups.every((g) => g.left >= 0 && g.left < 1366 && g.top < 768), first.groups.map((g) => `${g.label}@${Math.round(g.left)},${Math.round(g.top)}`).join(' '));
    const red = await lp.locator('[data-filter-group="colour"]:not([hidden])').first().getAttribute('data-filter-value');
    await lp.click(`[data-filter-group="colour"][data-filter-value="${red}"]`);
    await lp.waitForTimeout(250);
    const agree = await lp.evaluate(() => [...document.querySelectorAll('[data-group-link]')].map((l) => {
      const n = document.getElementById(l.dataset.groupLink)?.querySelectorAll('[data-shop-item]:not([hidden])').length ?? 0;
      return { id: l.dataset.groupLink, hidden: l.hidden, label: l.querySelector('[data-group-count]')?.textContent, n };
    }));
    check(`group links agree with the visible results (colour ${red})`, agree.length > 0 && agree.every((g) => (g.n === 0 ? g.hidden : !g.hidden && g.label === `(${g.n})`)), agree.map((g) => `${g.id}:${g.hidden ? 'hidden' : g.label}/${g.n}`).join(' '));
    await lay.close();

    // ---- 1c. the lower guide ("How the groups differ") under filters (audit F4)
    const gctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await gctx.route('**/*', (route) => (route.request().url().startsWith(origin + '/') || route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    const gp = await gctx.newPage();
    const gErrors = []; gp.on('pageerror', (e) => gErrors.push(e.message));
    const guide = () => gp.evaluate(() => {
      const shown = (el) => !!el && !el.hidden && !el.closest('[hidden]');
      const items = [...document.querySelectorAll('[data-shop-item]')].filter(shown);
      const visibleSlugs = new Set(items.map((i) => i.dataset.slug));
      const jumps = [...document.querySelectorAll('[data-group-jump]')].map((a) => ({ id: a.dataset.groupJump, visible: shown(a), targetVisible: shown(document.getElementById(a.dataset.groupJump)) }));
      const lines = [...document.querySelectorAll('[data-guide-slug]')].filter(shown).map((l) => l.dataset.guideSlug);
      return {
        hash: location.hash, search: location.search,
        count: document.querySelector('[data-shop-count]')?.textContent.replace(/\s+/g, ' ').trim(),
        distinct: visibleSlugs.size, total: new Set([...document.querySelectorAll('[data-shop-item]')].map((i) => i.dataset.slug)).size,
        pressed: [...document.querySelectorAll('[data-filter-value][aria-pressed="true"]')].map((c) => `${c.dataset.filterGroup}:${c.dataset.filterValue}`).sort().join(','),
        guideVisible: shown(document.querySelector('[data-group-guidance-all]')),
        filteredNote: shown(document.querySelector('[data-guide-filtered]')),
        jumps, lines, linesOutsideResults: lines.filter((s) => !visibleSlugs.has(s)).length,
        empty: shown(document.querySelector('[data-shop-empty]')),
      };
    });
    // No visible jump may target a hidden group, and no guide line may name a design outside the results.
    const consistent = (g) => g.jumps.every((j) => !j.visible || j.targetVisible) && g.jumps.every((j) => j.visible === j.targetVisible) && g.linesOutsideResults === 0;
    const countOk = (g) => (g.pressed ? g.count === `Showing ${g.distinct} of ${g.total} bouquets` : g.count === `${g.total} bouquets`);
    await gp.goto(`${origin}/categories/bouquets`, { waitUntil: 'load' });
    let g = await guide();
    check('guide, unfiltered: every group jump and design line is offered', g.guideVisible && !g.filteredNote && g.jumps.length >= 3 && g.jumps.every((j) => j.visible && j.targetVisible) && g.lines.length > 0, `${g.jumps.map((j) => j.id).join(',')}; ${g.lines.length} lines`);
    const allLines = g.lines.length;
    // Red (or the first colour on offer) removes at least one group.
    const colourValue = (await gp.locator('[data-filter-group="colour"][data-filter-value="red"]').count()) ? 'red' : await gp.locator('[data-filter-group="colour"]:not([hidden])').first().getAttribute('data-filter-value');
    await gp.click(`[data-filter-group="colour"][data-filter-value="${colourValue}"]`);
    await gp.waitForTimeout(250);
    g = await guide();
    const excluded = g.jumps.filter((j) => !j.targetVisible).map((j) => j.id);
    check(`guide, ${colourValue}: excluded groups (${excluded.join(',') || 'none'}) have no jump; lines match the results`, consistent(g) && g.filteredNote && g.lines.length < allLines && countOk(g), `jumps ${g.jumps.map((j) => `${j.id}:${j.visible ? 'shown' : 'hidden'}`).join(' ')}; ${g.lines.length}/${allLines} lines; "${g.count}"`);
    const validJump = g.jumps.find((j) => j.visible);
    if (validJump) {
      const before = g;
      await gp.click(`[data-group-jump="${validJump.id}"]`);
      await gp.waitForTimeout(900);
      const landed = await gp.evaluate((id) => { const h = document.getElementById(`${id}-title`); const r = h.getBoundingClientRect(); return { inView: r.top >= -1 && r.top < innerHeight && !h.closest('[hidden]'), focused: document.activeElement === h }; }, validJump.id);
      g = await guide();
      check(`guide jump to ${validJump.id}: lands on its visible heading; filter, chips and count unchanged`, landed.inView && landed.focused && g.hash === before.hash && g.pressed === before.pressed && g.count === before.count, `${JSON.stringify(landed)} ${g.hash} ${g.pressed} "${g.count}"`);
      await gp.reload({ waitUntil: 'load' }); await gp.waitForTimeout(250);
      g = await guide();
      check('guide jump then reload: the selection survives', g.pressed === before.pressed && g.count === before.count && consistent(g), `${g.hash} "${g.count}"`);
      // Keyboard: Enter on the guide jump does the same.
      await gp.focus(`[data-group-jump="${validJump.id}"]`); await gp.keyboard.press('Enter'); await gp.waitForTimeout(900);
      const kb = await gp.evaluate((id) => document.activeElement?.id === `${id}-title` && location.hash, validJump.id);
      check('guide jump by keyboard (Enter): focus moves to the heading, address keeps the filter', kb === before.hash, String(kb));
    } else check('guide: a valid jump under the colour filter', false, 'no group left visible');
    // Combined filters.
    await gp.goto(`${origin}/categories/bouquets#occasion=birthday&colour=${colourValue}`, { waitUntil: 'load' }); await gp.waitForTimeout(250);
    g = await guide();
    check(`guide, birthday + ${colourValue}: consistent with the results`, consistent(g) && countOk(g) && g.pressed === `colour:${colourValue},occasion:birthday`, `"${g.count}" ${g.lines.length} lines`);
    // Zero results: no guide, no jumps.
    await gp.goto(`${origin}/categories/bouquets#occasion=mom-to-be&colour=${colourValue}`, { waitUntil: 'load' }); await gp.waitForTimeout(250);
    const zero = await guide();
    check('guide, zero results: guide and every jump hidden; empty state shown', !zero.guideVisible && zero.jumps.every((j) => !j.visible) && zero.empty && zero.distinct === 0, `"${zero.count}"`);
    // Clear, then Back/Forward.
    await gp.locator('[data-shop-empty] [data-filters-clear]').click(); await gp.waitForTimeout(250);
    g = await guide();
    check('guide after Clear: full guide again, address has no filter', g.guideVisible && !g.filteredNote && g.lines.length === allLines && g.jumps.every((j) => j.visible) && !/=/.test(g.hash), `${g.hash} ${g.lines.length} lines`);
    await gp.goBack(); await gp.waitForTimeout(300);
    g = await guide();
    check('Back: the zero-result selection and its hidden guide return', !g.guideVisible && g.empty && g.count === zero.count, `${g.hash} "${g.count}"`);
    await gp.goForward(); await gp.waitForTimeout(300);
    g = await guide();
    check('Forward: unfiltered again with the full guide', g.guideVisible && g.lines.length === allLines && !g.pressed, `${g.hash} "${g.count}"`);
    // Legacy query link.
    await gp.goto(`${origin}/categories/bouquets?occasion=birthday`, { waitUntil: 'load' }); await gp.waitForTimeout(300);
    g = await guide();
    check('legacy ?occasion=birthday: fragment address, guide consistent with the results', g.hash === '#occasion=birthday' && !g.search && consistent(g) && countOk(g), `${g.search}${g.hash} "${g.count}"`);
    check('guide checks: no script errors', gErrors.length === 0, gErrors.join(' | '));
    await gctx.close();

    // ---- 1d. recipient city before every product WhatsApp enquiry (24 Nov 2026).
    // window.open is stubbed and WhatsApp, the garland check's redirect and
    // the enquiry log are intercepted: nothing is sent or logged.
    const rc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await rc.addInitScript(() => {
      window.__opened = []; window.__events = [];
      window.open = (u) => { const t = { close() {}, location: {} }; Object.defineProperty(t.location, 'href', { set: (v) => window.__opened.push(v) }); if (u) window.__opened.push(u); return t; };
      document.addEventListener('fp:track', (e) => window.__events.push(e.detail.name));
    });
    const rcOut = [];
    await rc.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === '/garland-enquiry' || u.hostname === 'wa.me' || u.pathname === '/api/inquiries') { rcOut.push(u.pathname + u.search); return route.fulfill({ status: 200, contentType: 'text/plain', body: 'intercepted' }); }
      return u.href.startsWith(origin + '/') || u.href.startsWith('data:') ? route.continue() : route.abort();
    });
    const rp = await rc.newPage();
    const rcErrors = []; rp.on('pageerror', (e) => rcErrors.push(e.message));
    let rcPopups = 0; rp.on('popup', (p) => { rcPopups++; p.close().catch(() => {}); });
    const rcState = () => rp.evaluate(() => ({ opened: window.__opened.slice(), events: window.__events.filter((n) => /whatsapp_enquiry_click|basket_quote_request/.test(n)).length }));
    const cityLines = (url) => { try { return (new URL(url).searchParams.get('text') || '').split('\n').filter((l) => /^Recipient city:/.test(l)); } catch { return []; } };
    // Product page (a bouquet): blocked, explained and focused; then once with the city.
    await rp.goto(`${origin}/products/red-affair`, { waitUntil: 'load' });
    await rp.locator('[data-simple-whatsapp]').tap(); await rp.waitForTimeout(400);
    let st = await rcState();
    const flagged = await rp.evaluate(() => { const c = document.querySelector('#recipient-city [data-destination-control]'); const sel = c?.querySelector('select'); return !!c && !c.querySelector('[data-destination-error]').hidden && sel.getAttribute('aria-invalid') === 'true' && document.activeElement === sel; });
    check('recipient city: product page enquiry without a city is blocked, explained, focused; no enquiry event', st.opened.length === 0 && st.events === 0 && flagged, JSON.stringify({ ...st, flagged }));
    await rp.selectOption('#recipient-city select', 'pune'); await rp.locator('[data-simple-whatsapp]').tap(); await rp.waitForTimeout(400);
    st = await rcState();
    check('recipient city: after choosing Pune the draft opens once naming Pune exactly once', st.opened.length === 1 && cityLines(st.opened[0]).join() === 'Recipient city: Pune' && st.events === 1, cityLines(st.opened[0] || '').join() + ` events ${st.events}`);
    // A listing card (no selector on the page): the city step, then the same enquiry.
    await rp.evaluate(() => { localStorage.removeItem('fresh_petals_destination_city'); localStorage.removeItem('fresh_petals_destination_confirmed'); });
    await rp.goto(`${origin}/categories/bouquets`, { waitUntil: 'load' });
    const card = rp.locator('[data-shop-item]:visible [data-whatsapp-order-link]').first();
    await card.tap(); await rp.waitForTimeout(400);
    const stepOpen = await rp.evaluate(() => { const d = document.querySelector('[data-city-step]'); return !!d?.open && document.activeElement === d.querySelector('select'); });
    check('recipient city: card enquiry without a city opens the city step; nothing opened', stepOpen && rcPopups === 0 && (await rcState()).events === 0, `step ${stepOpen}, popups ${rcPopups}`);
    await rp.selectOption('[data-city-step] select', 'hyderabad'); await rp.locator('[data-city-step-continue]').tap(); await rp.waitForTimeout(600);
    const cardHref = await card.getAttribute('href');
    check('recipient city: the city step continues the card enquiry with Hyderabad once', rcPopups === 1 && cityLines(cardHref).join() === 'Recipient city: Hyderabad', `${rcPopups} ${cityLines(cardHref).join()}`);
    // A garland design page: the live check gets the chosen city.
    await rp.goto(`${origin}/categories/garlands`, { waitUntil: 'load' });
    const garlandPage = await rp.locator('[data-garland-card] a[href^="/products/"], a.garland-card__link').first().getAttribute('href').catch(() => null);
    if (garlandPage) {
      await rp.goto(origin + garlandPage, { waitUntil: 'load' });
      const quote = rp.locator('[data-garland-quote-panel] [data-garland-quote]');
      if (await quote.count()) {
        await rp.evaluate(() => { localStorage.removeItem('fresh_petals_destination_city'); localStorage.removeItem('fresh_petals_destination_confirmed'); window.dispatchEvent(new CustomEvent('fresh-petals-destination-updated')); });
        const before = rcPopups;
        await quote.tap(); await rp.waitForTimeout(300);
        const blocked = rcPopups === before;
        await rp.selectOption('[data-garland-quote-panel] #recipient-city select', 'chennai'); await quote.tap(); await rp.waitForTimeout(600);
        const href = new URL(await quote.getAttribute('href'), origin);
        check('recipient city: garland enquiry blocked without a city, then the live check gets city=chennai once', blocked && rcPopups === before + 1 && href.pathname === '/garland-enquiry' && href.searchParams.getAll('city').join() === 'chennai', href.pathname + href.search);
      } else check('recipient city: garland design page has an enquiry panel', false, garlandPage);
    } else check('recipient city: a garland design page to test', false, 'none found');
    // The live check itself, without a city: a page that asks, never a WhatsApp redirect.
    const code = await rp.evaluate(() => document.querySelector('[data-garland-quote]')?.getAttribute('data-garland-quote'));
    if (code) {
      const r = await fetch(`${origin}/garland-enquiry?code=${encodeURIComponent(code)}&qty=1`, { redirect: 'manual' });
      const body = await r.text();
      check('recipient city: /garland-enquiry without a city asks for it (no redirect, no preselected city)', r.status === 200 && !r.headers.get('location') && /name="city" required/.test(body) && !/selected/.test(body), `${r.status} ${r.headers.get('location') ?? ''}`);
    }
    // The basket: blocked before the blank tab, the log and the event.
    await rp.evaluate(() => { localStorage.removeItem('fresh_petals_destination_city'); localStorage.removeItem('fresh_petals_destination_confirmed'); });
    await rp.goto(`${origin}/categories/bouquets`, { waitUntil: 'load' });
    await rp.locator('[data-shop-item]:visible [data-add-to-cart]').first().tap();
    await rp.goto(`${origin}/cart`, { waitUntil: 'load' }); await rp.waitForTimeout(400);
    await rp.fill('[data-customer-name]', 'Audit Test'); await rp.fill('[data-customer-phone]', '9000000000');
    await rp.fill('[data-delivery-date]', new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)).catch(() => {});
    const slotSelect = rp.locator('[data-delivery-slot]'); await slotSelect.selectOption(await slotSelect.locator('option').nth(1).getAttribute('value'));
    await rp.fill('[data-recipient-name]', 'Audit Recipient'); await rp.fill('[data-recipient-phone]', '9000000001'); await rp.fill('[data-delivery-landmark]', 'Audit landmark');
    const outBefore = rcOut.length;
    await rp.locator('[data-send-cart-whatsapp]').tap(); await rp.waitForTimeout(600);
    st = await rcState();
    check('recipient city: basket without a city sends nothing, logs nothing, fires no basket event', st.opened.length === 0 && st.events === 0 && rcOut.length === outBefore, JSON.stringify({ opened: st.opened.length, events: st.events, out: rcOut.slice(outBefore) }));
    await rp.selectOption('[data-destination-select]:visible', 'delhi'); await rp.locator('[data-send-cart-whatsapp]').tap(); await rp.waitForTimeout(2000);
    st = await rcState();
    const basketDraft = st.opened.find((u) => /wa\.me/.test(u)) || '';
    check('recipient city: basket draft names Delhi exactly once', cityLines(basketDraft).join() === 'Recipient city: Delhi' && st.events === 1, cityLines(basketDraft).join());
    check('recipient city: no script errors', rcErrors.length === 0, rcErrors.join(' | '));
    await rp.evaluate(() => { localStorage.clear(); });
    await rc.close();

    // ---- 2. homepage petal hand-over (desktop)
    const home = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await home.route('**/*', (route) => (route.request().url().startsWith(origin + '/') || route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    // Local machines with ≤ 2 cores skip the scene by design (PetalHero.astro); --cores emulates more.
    if (cores) await home.addInitScript((n) => Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => n }), Number(cores));
    // Every animation frame from the moment the canvas starts to appear: both
    // layers' rendered opacity. Two partly transparent layers at once is the
    // doubled image this guards against.
    await home.addInitScript(() => {
      window.__frames = [];
      const sample = () => {
        const stage = document.querySelector('[data-petal-stage]');
        if (stage && /is-3d/.test(stage.className) && window.__frames.length < 600) {
          const canvas = getComputedStyle(stage.querySelector('canvas'));
          const petals = getComputedStyle(stage.querySelector('.ph__petals'));
          window.__frames.push({ t: Math.round(performance.now()), canvas: +canvas.opacity, petals: petals.visibility === 'hidden' ? 0 : +petals.opacity, settled: stage.classList.contains('is-3d-settled') });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const hp = await home.newPage();
    const homeErrors = [];
    hp.on('pageerror', (e) => homeErrors.push(e.message));
    await hp.goto(`${origin}/`, { waitUntil: 'load' });
    const took = await hp.waitForFunction(() => { const f = window.__frames; return f.length > 0 && f[f.length - 1].canvas === 1 && f[f.length - 1].petals === 0; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
    await hp.waitForTimeout(400);
    const frames = await hp.evaluate(() => window.__frames);
    const env = await hp.evaluate(() => ({ cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory ?? null, webgl: !!document.createElement('canvas').getContext('webgl'), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }));
    check('home: the WebGL scene replaces the static petals within 15 s', took, `${frames.length} frames sampled; ${JSON.stringify(env)}`);
    const doubled = frames.filter((f) => f.canvas < 0.999 && f.petals > 0.001 && f.petals < 0.999);
    const uncovered = frames.filter((f) => f.petals < 0.999 && f.canvas < 0.999);
    check('home: never two partly transparent layers (no doubled image)', took && doubled.length === 0, `${doubled.length} doubled of ${frames.length} frames${doubled[0] ? ` e.g. ${JSON.stringify(doubled[0])}` : ''}`);
    check('home: the static petals fade only once the canvas is fully opaque (no blank frame)', took && uncovered.length === 0, `${uncovered.length} uncovered${uncovered[0] ? ` e.g. ${JSON.stringify(uncovered[0])}` : ''}`);
    const ranges = await hp.$$eval('[data-range]', (as) => as.map((a) => a.getAttribute('href')));
    check('home: three range links', ranges.join() === '/categories/bouquets,/categories/garlands,/categories/pooja-flowers', ranges.join());
    const box = await hp.locator('[data-petal-stage]').boundingBox();
    await hp.mouse.move(box.x + box.width / 2, box.y + box.height * 0.45);
    await hp.waitForTimeout(300);
    await Promise.all([hp.waitForURL('**/categories/garlands', { timeout: 6000 }).catch(() => {}), hp.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45)]);
    check('home: clicking the centre petal opens wedding garlands', new URL(hp.url()).pathname === '/categories/garlands', hp.url());
    check('home: no script errors', homeErrors.length === 0, homeErrors.join(' | '));
    await home.close();

    // ---- 3. the hand-over frame matches the static petals
    // Hold the canvas fade (so the scene stays in its hand-over pose), then
    // screenshot each layer alone and compare the petal silhouettes.
    for (const [vw, vh] of [[1440, 900], [390, 844]]) {
    const held = await browser.newContext({ viewport: { width: vw, height: vh } });
    await held.route('**/*', (route) => (route.request().url().startsWith(origin + '/') || route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    if (cores) await held.addInitScript((n) => Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => n }), Number(cores));
    await held.addInitScript(() => addEventListener('DOMContentLoaded', () => { const c = document.querySelector('[data-petal-canvas]'); if (c) c.style.transitionDuration = '600s'; }));
    const hold = await held.newPage();
    await hold.goto(`${origin}/`, { waitUntil: 'load' });
    const ready = await hold.waitForFunction(() => document.querySelector('[data-petal-stage]')?.classList.contains('is-3d'), null, { timeout: 15000 }).then(() => true).catch(() => false);
    if (ready) {
      await hold.waitForTimeout(500);
      const stage = hold.locator('[data-petal-stage]');
      const show = (which) => hold.evaluate((w) => {
        const s = document.querySelector('[data-petal-stage]');
        const c = s.querySelector('canvas'), p = s.querySelector('.ph__petals');
        c.style.transition = 'none'; c.style.opacity = w === 'canvas' ? '1' : '0';
        p.style.visibility = w === 'static' ? 'visible' : 'hidden';
        s.querySelector('.ph__ground').style.visibility = 'hidden';
        s.style.background = '#ff00ff';
      }, which);
      await show('static'); await hold.waitForTimeout(150);
      const a = silhouette(readPng(await stage.screenshot({ type: 'png' })));
      await show('canvas'); await hold.waitForTimeout(150);
      const b = silhouette(readPng(await stage.screenshot({ type: 'png' })));
      // The canvas fades its lowest 7% by design (the petal bases, which fade
      // away after the hand-over); compare above that band.
      const { w, h } = readPng(await stage.screenshot({ type: 'png' }));
      const limit = Math.floor(h * 0.9) * w;
      const area = a.slice(0, limit).filter(Boolean).length, diff = a.slice(0, limit).reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);
      check(`home ${vw}px: the first WebGL frame covers the static petals exactly (silhouette mismatch < 3%)`, area > 1000 && diff / area < 0.03, `${diff} of ${area} petal pixels differ (${((100 * diff) / Math.max(1, area)).toFixed(2)}%)`);
    } else check(`home ${vw}px: the first WebGL frame covers the static petals exactly (silhouette mismatch < 3%)`, false, 'the scene did not start');
    await held.close();
    }
  } catch (error) {
    check('browser checks completed', false, error.message.split('\n')[0]);
  } finally {
    await browser.close();
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=')]));
  if (!args.base) { console.log('usage: --base=<preview URL> [--playwright=<index.mjs>] [--chrome=<path>]'); process.exit(2); }
  const results = await runBrowserChecks(args.base.replace(/\/$/, ''), { playwright: args.playwright, chrome: args.chrome, cores: args.cores });
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.evidence ? ` | ${r.evidence}` : ''}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} browser checks passed.`);
  process.exit(failed ? 1 : 0);
}
