// Homepage (docs/homepage-petals-2026-11-17.md): the three ranges, the
// petal scene and its fallback, quote-only wording and the HTML that search
// engines and assistive technology read. Source-level; never opens a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { sourceLoader } from './source-loader.mjs';

const load = sourceLoader({ mocks: { 'src/server/services/ProductPricing.ts': { withAuthoritativePrice: (product) => product } } });
const read = (file) => readFileSync(file, 'utf8');
const json = (value) => JSON.parse(JSON.stringify(value));

test('three ranges: the existing collection URLs, counts from the catalogue, petal photographs on disk', () => {
  const home = load('src/data/atelierHome.ts');
  const ranges = json(home.getHomeRanges({ bouquets: 47, garlands: 156, pooja: 1 }));
  assert.deepEqual(ranges.map((r) => [r.id, r.href]), [
    ['bouquets', '/categories/bouquets'],
    ['garlands', '/categories/garlands'],
    ['pooja', '/categories/pooja-flowers'],
  ]);
  assert.deepEqual(ranges.map((r) => r.countLabel), ['47 designs', '156 designs', '1 choice']);
  assert.equal(json(home.getHomeRanges({ bouquets: 0, garlands: 0, pooja: 0 }))[1].countLabel, 'Ask on WhatsApp');
  for (const range of ranges) {
    assert(range.image.alt.length > 20 && !/₹|price/i.test(range.image.alt), range.id);
    for (const src of [range.image.src, ...range.image.avif.split(', ').map((s) => s.split(' ')[0])]) assert(existsSync(`public${src}`), src);
  }
  const index = read('src/pages/index.astro');
  assert(/getHomeRanges\(\{ bouquets: bouquetCount, garlands: publicGarlands\.length, pooja: poojaProducts\.length \}\)/.test(index));
  assert(/categoryProducts\("pooja-flowers", publicCatalogue\)/.test(index) && /isListedGarland\(product\.garland\)/.test(index));
});

test('the offer, the ranges and every link are HTML outside the canvas; the scene is decorative and optional', () => {
  const hero = read('src/components/home/PetalHero.astro');
  assert(/<h1 id="ph-title"[^>]*>Bouquets, wedding garlands <em>&amp; flowers for pooja\.<\/em><\/h1>/.test(hero));
  assert(/confirm availability, presentation and the\s+final price before you pay/.test(hero));
  // The stage (static petals and canvas) is hidden from assistive technology; the range links are not inside it.
  const stage = hero.slice(hero.indexOf('data-petal-stage'), hero.indexOf('<nav class="ph__ranges"'));
  assert(/aria-hidden="true"/.test(hero.slice(hero.indexOf('<div class="ph__stage"'), hero.indexOf('<div class="ph__stage"') + 80)));
  assert(!/<a\s/.test(stage), 'no link inside the decorative stage');
  assert(/<canvas class="ph__canvas" data-petal-canvas><\/canvas>/.test(hero));
  assert(/<nav class="ph__ranges" aria-label="Shop by range">/.test(hero) && /href=\{range\.href\}/.test(hero));
  // The photographs are in the first HTML; WebGL loads later, only where it should.
  assert(/<picture>/.test(hero) && /fetchpriority="high"/.test(hero) && !/loading="lazy"/.test(stage));
  assert(/import\("\.\.\/\.\.\/scripts\/petal-scene"\)/.test(hero), 'the scene is a separate, lazily loaded chunk');
  assert(/saveData/.test(hero) && /effectiveType/.test(hero) && /deviceMemory/.test(hero) && /requestIdleCallback/.test(hero));
  assert(/prefers-reduced-motion: reduce/.test(hero));
});

test('the scene renders on demand, pauses off-screen and cleans up', () => {
  const scene = read('src/scripts/petal-scene.ts');
  assert(!/from "three"/.test(scene), 'no 3D library for one scene');
  assert(/setVisible\(value\)/.test(scene) && /cancelAnimationFrame\(raf\)/.test(scene));
  assert(/if \(moving\) raf = requestAnimationFrame\(frame\);/.test(scene), 'frames only while something moves');
  assert(/webglcontextlost/.test(scene) && /deleteTexture/.test(scene) && /deleteProgram/.test(scene));
  assert(/powerPreference: "low-power"/.test(scene) && /Math\.min\(window\.devicePixelRatio \|\| 1, cap\)/.test(scene));
  assert(/reducedMotion \? 1 : 1 - Math\.exp/.test(scene), 'reduced motion: no tweening');
});

test('petal outline: closed at both ends, widest at one point; photographs stay upright and cover each petal', () => {
  const shape = load('src/shared/petalShape.ts');
  assert.equal(shape.petalHalfWidth(0), 0);
  assert(shape.petalHalfWidth(1) < 1e-9);
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => shape.petalHalfWidth(i / 100)));
  assert(Math.abs(peak - 1) < 1e-3);
  assert(/^M0\.5 1L/.test(shape.petalPath(20)) && shape.petalPath(20).endsWith('Z'));
  for (const theta of [shape.PETAL_SPREAD, 0, -shape.PETAL_SPREAD]) {
    const box = shape.petalPhotoBox(theta);
    assert(Math.abs(box.sx / box.sy - shape.PETAL_IMAGE_ASPECT) < 1e-9, 'the photograph keeps its aspect ratio');
    for (let i = 0; i <= 20; i++) {
      const v = i / 20;
      const w = shape.petalHalfWidth(v) * shape.PETAL_ASPECT / 2;
      for (const x of [-w, w]) {
        const X = Math.cos(theta) * x - Math.sin(theta) * v;
        const Y = Math.sin(theta) * x + Math.cos(theta) * v;
        assert(Math.abs(X - box.ox) <= box.sx / 2 + 1e-9 && Math.abs(Y - box.oy) <= box.sy / 2 + 1e-9, 'covered');
      }
    }
  }
});

test('quote-only ranges never show an amount; pooja products keep their own price wording; recurring plans are labelled', () => {
  for (const file of ['src/components/home/RangeBouquets.astro', 'src/components/home/RangeGarlands.astro', 'src/components/home/PetalHero.astro']) {
    assert(!/₹|formatGarlandPrice|sellingPrice/.test(read(file)), file);
  }
  assert(/QUOTE_ONLY_PRICE_LABEL/.test(read('src/components/home/RangeGarlands.astro')));
  assert(/\{product\.priceLabel\}/.test(read('src/components/home/RangeBouquets.astro')));
  const pooja = read('src/components/home/RangePooja.astro');
  assert(/\{product\.priceLabel\}/.test(pooja) && /poojaSections|sections\.map/.test(pooja));
  const guidance = load('src/data/collectionGuidance.ts');
  assert(json(guidance.POOJA_SECTIONS).some((s) => s.id === 'regular' && s.label === 'Regular deliveries'));
  // Garlands are shown by their own name and code; nothing invented about them.
  const garlands = read('src/components/home/RangeGarlands.astro');
  assert(/\{design\.code\}/.test(garlands) && /\{design\.title\}/.test(garlands) && /alt=\{design\.image\.alt\}/.test(garlands));
  assert(!/(\d+\s*(cm|inch|ft|feet|hours?|days?))|same[- ]day|rated|reviews?/i.test(garlands));
});

test('homepage metadata: unchanged title, description and canonical; a real social image; truthful structured data', () => {
  const index = read('src/pages/index.astro');
  const landing = load('src/data/seoLanding.ts');
  assert.equal(landing.HOME_LANDING.title, 'Flower Delivery Across India | Bouquets & Garlands | Fresh Petals');
  assert(/title=\{HOME_LANDING\.title\}/.test(index) && /description=\{HOME_LANDING\.description\}/.test(index));
  assert(/image="\/images\/og-home\.jpg"/.test(index) && existsSync('public/images/og-home.jpg'));
  assert(/organizationNode\(Astro\.site\), websiteNode\(Astro\.site\)/.test(index) && !/Product"|AggregateRating|LocalBusiness/.test(index));
  assert(/export const prerender = true;/.test(index) && /loadOccasionMembership\(/.test(index));
  // Order on the page: hero, the three ranges, occasions, ordering, questions, invitation.
  const order = ['<PetalHero', '<RangeBouquets', '<RangeGarlands', '<RangePooja', '<OccasionCarousel', '<HowOrdering', '<HomeFaq', '<FinalInvite'].map((tag) => index.indexOf(tag));
  assert(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), JSON.stringify(order));
});

test('phones keep search beside the basket in the homepage header', () => {
  const header = read('src/components/atelier/SiteHeader.astro');
  assert(/\.site-header--home \.site-header__actions > \.site-icon:not\(\[href="\/search"\]\)/.test(header));
});

test('petal hand-over: the first WebGL frame projects every petal exactly onto the static CSS petals', () => {
  const shape = load('src/shared/petalShape.ts');
  const scene = load('src/scripts/petal-scene.ts');
  const t = Math.tan(scene.SCENE_FOV / 2);
  // Stage sizes from the hero at 390, 768, 1366 and 1440 px; the canvas is the stage plus 8% each side and 10% above.
  for (const [sw, sh] of [[358, 250], [705, 352], [694, 478], [734, 517]]) {
    const cw = sw * 1.16, ch = sh * 1.1, ox = sw * 0.08, oy = sh * 0.1;
    const H = Math.min(0.92 * sh, 0.63 * sw); // .ph__petal --h
    const layout = { height: H, baseX: ox + sw / 2, baseY: oy + sh };
    const cam = scene.handoverCamera(layout, cw, ch);
    const d = cam.eye[2], aspect = cw / ch;
    const project = (X, Y) => [cw / 2 + ((X - cam.eye[0]) / (t * d * aspect)) * (cw / 2), ch / 2 - ((Y - cam.eye[1]) / (t * d)) * (ch / 2)];
    const turns = [shape.PETAL_SPREAD, 0, -shape.PETAL_SPREAD];
    turns.forEach((theta, i) => {
      const side = i !== 1;
      const worldScale = side ? shape.PETAL_SCALE.side : shape.PETAL_SCALE.centre;
      const worldDx = (i - 1) * shape.PETAL_OFFSET;
      const cssScale = side ? 0.83 : 1; // .ph__petal--left/right --s
      const cssDx = ((i - 1) * shape.PETAL_OFFSET) / shape.PETAL_SCALE.centre * H; // --dx × --h
      for (const [lx, ly] of [[0, 1], [0, 0], [shape.PETAL_ASPECT / 2, 0.633], [-shape.PETAL_ASPECT / 2, 0.633], [0.1, 0.9]]) {
        const rx = Math.cos(theta) * lx - Math.sin(theta) * ly, ry = Math.sin(theta) * lx + Math.cos(theta) * ly;
        const [px, py] = project(worldDx + rx * worldScale, ry * worldScale);
        const cx = layout.baseX + cssDx + rx * H * cssScale, cy = layout.baseY - ry * H * cssScale;
        assert(Math.hypot(px - cx, py - cy) < 0.75, `stage ${sw}×${sh}, petal ${i}, point (${lx}, ${ly}): WebGL ${px.toFixed(1)},${py.toFixed(1)} vs CSS ${cx.toFixed(1)},${cy.toFixed(1)}`);
      }
    });
  }
});

test('preview validation: old filter links are checked as static pages plus real browser behaviour; real redirects keep their 301s', async () => {
  const pipeline = read('scripts/cloudflare/preview-pipeline.mjs');
  assert(!/occasion=birthday', \(r\) => \(r\.status === 301/.test(pipeline), 'no server 301 expected for ?occasion=');
  assert(/filter link: static collection page/.test(pipeline) && /unexpected redirect/.test(pipeline) && /onlyfreshpetals\\\.in\\\/categories\\\/bouquets"/.test(pipeline));
  assert(!/filter-query variants \(301\)/.test(pipeline) && /filter-query variants \(static 200\)/.test(pipeline));
  assert(/check\('legacy \/studio', '\/studio', \(r\) => \(r\.status === 301/.test(pipeline) && /check\('trailing slash', '\/faqs\/'/.test(pipeline));
  assert(/runBrowserChecks\(base/.test(pipeline));
  // A missing browser is a failure, never a silent pass.
  const { runBrowserChecks } = await import('../cloudflare/preview-browser.mjs');
  const results = await runBrowserChecks('http://127.0.0.1:9', { playwright: '/nonexistent/playwright-core.mjs' });
  assert.equal(results.length, 1);
  assert.equal(results[0].ok, false);
  assert.match(results[0].evidence, /NOT executed/);
  // The preview job installs the browser driver; the production job does not run browser checks.
  const workflow = read('.github/workflows/cloudflare.yml');
  const preview = workflow.slice(workflow.indexOf('\n  preview:'), workflow.indexOf('\n  production:'));
  const production = workflow.slice(workflow.indexOf('\n  production:'));
  assert(/npm install --no-save --no-package-lock playwright-core@/.test(preview) && !/playwright/.test(production));
});
