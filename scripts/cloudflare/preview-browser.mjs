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
