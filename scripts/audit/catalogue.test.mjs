// Catalogue discovery: full ranges versus featured selections, occasion
// eligibility and follow-through, category and colour discovery, and the
// publication snapshot. Source-level with fixtures; never opens a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceLoader } from './source-loader.mjs';

const load = sourceLoader();
const range = load('src/data/catalogueRange.ts');
const journeys = load('src/data/occasionJourneys.ts');
const launch = load('src/data/launchCatalogue.ts');
const filters = load('src/utils/shopFilters.ts');
const { productCatalog } = load('src/data/productCatalog.ts');
const { OCCASION_PAGES } = load('src/data/occasionPages.ts');
const json = (value) => JSON.parse(JSON.stringify(value));
const page = (slug) => OCCASION_PAGES.find((p) => p.slug === slug);
const empty = () => new Map(productCatalog.map((p) => [p.slug, []]));
const ARCHIVED = ['daily-pooja-flower-subscription', 'jasmine-gajra', 'jasmine-malli', 'pooja-basket', 'pooja-flower-box', 'pooja-flowerbox', 'temple-bulk-flowers'];
// Fixture publication: the seven records the audit found archived, everything else published.
const publication = new Map(productCatalog.map((p) => [p.slug, ARCHIVED.includes(p.slug) ? 'archived' : 'published']));
const catalogue = range.publicProducts(productCatalog, publication);
// Arrays made inside the source loader's sandbox; copy into this realm before deepEqual.
const slugs = (list) => Array.from(list, (p) => p.slug);

// ---------------------------------------------------------------------------
// Bouquets: the full range, flower groups and featured selections
// ---------------------------------------------------------------------------

test('the bouquet list is every public Bouquets/Lilies record, not the eight featured slugs', () => {
  const bouquets = range.bouquetRange(catalogue);
  const expected = catalogue.filter((p) => (p.category === 'Bouquets' || p.category === 'Lilies') && !p.isAddon);
  assert.equal(bouquets.length, expected.length);
  assert.equal(bouquets.length, 47);
  assert.equal(bouquets.filter((p) => p.category === 'Bouquets').length, 37);
  assert.equal(bouquets.filter((p) => p.category === 'Lilies').length, 10);
  // Independent of the featured shortlist: removing a featured slug from the editorial list changes nothing here.
  assert.equal(launch.featuredBouquets(catalogue).length, 8);
  assert(bouquets.length > launch.featuredBouquets(catalogue).length);
  const page = readFileSync('src/pages/categories/bouquets.astro', 'utf8');
  assert(/bouquetRange\(publicCatalogue\)/.test(page) && /bouquetFlowerGroups\(bouquets\)/.test(page) && !/launchGroups|featuredGroups|featuredBouquets/.test(page));
  // An unpublished bouquet leaves the list.
  assert.equal(range.bouquetRange(catalogue.filter((p) => p.slug !== 'snow-white-saga')).length, 46);
});

test('rose and lily groups come from recorded flowers, overlap, and every bouquet is in at least one group; totals are unique', () => {
  const bouquets = range.bouquetRange(catalogue);
  const groups = range.bouquetFlowerGroups(bouquets);
  const by = Object.fromEntries(groups.map((g) => [g.id, g.products]));
  assert.deepEqual(Array.from(groups, (g) => g.id), ['roses', 'lilies', 'mixed']);
  assert.equal(by.roses.length, 13);
  assert.equal(by.lilies.length, 15);
  const overlap = by.roses.filter((p) => by.lilies.includes(p));
  const union = range.uniqueBySlug(groups.map((g) => g.products));
  assert.equal(union.length, bouquets.length, 'every bouquet is discoverable through a group');
  assert.equal(by.mixed.length, bouquets.length - (by.roses.length + by.lilies.length - overlap.length));
  for (const p of by.roses) assert(p.flowerTypes.some((t) => /\broses?\b/i.test(t)), p.slug);
  for (const p of by.lilies) assert(p.flowerTypes.some((t) => /\b(lily|lilies)\b/i.test(t)), p.slug);
  for (const p of by.mixed) assert(!p.flowerTypes.some((t) => /\broses?\b|\blil(y|ies)\b/i.test(t)), p.slug);
  // Not by name: a name mentioning a lily does not place a bouquet whose recorded flowers have none.
  assert.equal(range.recordsFlower({ flowerTypes: ['White carnations'] }, 'lilies'), false);
  assert.equal(range.recordsFlower({ name: 'Lily Dream', flowerTypes: [] }, 'lilies'), false);
  // The five lily bouquets in the Bouquets category the old page missed are listed under lilies.
  for (const slug of ['lily-calm', 'little-lilly-prayer', 'love-at-first-sight', 'pink-lily-wish', 'white-silence']) assert(slugs(by.lilies).includes(slug), slug);
  // The page states the overlap and the unique total; the client filter counts distinct products.
  const component = readFileSync('src/components/category/CategoryPage.astro', 'utf8');
  assert(/data-group-overlap/.test(component) && /listed in both groups/.test(component));
  const script = readFileSync('src/components/occasion/ShopFilters.astro', 'utf8');
  assert(/const distinct = /.test(script) && /distinct\(scoped\.filter\(\(item\) => !item\.hidden\)\)/.test(script));
});

test('editorial selections stay small and labelled: homepage four, featured eight, city "Featured bouquets", 24-item city pages', () => {
  const home = sourceLoader({ mocks: { 'src/server/services/ProductPricing.ts': { withAuthoritativePrice: (product) => product } } })('src/data/atelierHome.ts');
  const edit = home.getBouquetEdit(new Map(), catalogue);
  assert.equal(edit.length, 8);
  assert.equal(home.getFeaturedBouquets(edit).length, 4);
  // A featured bouquet that is not public is skipped, never substituted by an invented one.
  const without = catalogue.filter((p) => p.slug !== 'red-affair');
  assert.deepEqual(slugs(launch.featuredBouquets(without)), slugs(launch.featuredBouquets(catalogue)).filter((s) => s !== 'red-affair'));
  // The homepage "View all" names the full list.
  const index = readFileSync('src/pages/index.astro', 'utf8');
  assert(/totalCount=\{bouquetCount\}/.test(index) && /bouquetRange\(publicCatalogue\)\.length/.test(index));
  assert(/View all \$\{totalCount\}/.test(readFileSync('src/components/atelier/BouquetEdit.astro', 'utf8')));
  const city = readFileSync('src/server/services/CityCatalogue.ts', 'utf8');
  assert(/label: "Featured bouquets"/.test(city) && /export const CITY_SHOP_PAGE_SIZE = 24;/.test(city) && /isListedGarland/.test(city));
  // Menu: "All bouquets" is the full list; group links are the flower groups.
  const nav = load('src/data/navigation.ts').siteNav([]);
  const shop = nav.find((item) => item.label === 'Shop Flowers').links;
  assert.deepEqual(json(shop.filter((l) => l.href.startsWith('/categories/bouquets'))), [
    { label: 'All bouquets', href: '/categories/bouquets' },
    { label: 'Bouquets with roses', href: '/categories/bouquets#roses' },
    { label: 'Bouquets with lilies', href: '/categories/bouquets#lilies' },
    { label: 'Other bouquets', href: '/categories/bouquets#mixed' },
  ]);
  // Main-menu readiness gates unchanged.
  assert.deepEqual(json(launch.LAUNCH_CATEGORIES.filter((c) => !c.ready).map((c) => c.id)), ['baskets', 'torans', 'veni']);
  assert(!shop.some((l) => /baskets|torans|jasmine/.test(l.href)));
});

// ---------------------------------------------------------------------------
// Occasions
// ---------------------------------------------------------------------------

test('a published, assigned bouquet outside the eight is listed; removing the assignment removes it; add-ons and unpublished records never are', () => {
  const membership = empty();
  membership.set('snow-white-saga', ['housewarming', 'birthday']);
  membership.set('cotton-candy', ['mom-to-be']);
  membership.set('chocolates-addon', ['birthday', 'housewarming']);
  membership.set('jasmine-malli', ['housewarming']);
  assert(!slugs(launch.featuredBouquets(catalogue)).includes('snow-white-saga'));
  assert.deepEqual(slugs(journeys.occasionPageProducts(page('housewarming'), membership, catalogue)), ['snow-white-saga']);
  assert.deepEqual(slugs(journeys.occasionPageProducts(page('mom-to-be'), membership, catalogue)), ['cotton-candy']);
  assert(slugs(journeys.giftProducts('birthday', membership, catalogue)).includes('snow-white-saga'));
  assert(!slugs(journeys.giftProducts('birthday', membership, catalogue)).includes('chocolates-addon'));
  membership.set('snow-white-saga', ['birthday']);
  assert.equal(journeys.occasionPageProducts(page('housewarming'), membership, catalogue).length, 0);
  membership.set('snow-white-saga', []);
  assert(!slugs(journeys.giftProducts('birthday', membership, catalogue)).includes('snow-white-saga'));
  // No restoration from seed tags: snow-white-saga's catalogue occasionTags are not read.
  assert(productCatalog.find((p) => p.slug === 'snow-white-saga').occasionTags.length > 0);
  // New mom does not stand in for Baby shower; pooja does not stand in for Housewarming.
  const m2 = empty(); m2.set('pink-serenity-flowerbox', ['new-mom']); m2.set('little-lilly-prayer', ['pooja']);
  assert.equal(journeys.occasionPageProducts(page('mom-to-be'), m2, catalogue).length, 0);
  assert.equal(journeys.occasionPageProducts(page('housewarming'), m2, catalogue).length, 0);
  // Older pages keep their wider scope (any public product), and exclude unpublished ones.
  const m3 = empty(); m3.set('premium-card-addon', ['thank-you']); m3.set('jasmine-gajra', ['thank-you']);
  assert.deepEqual(slugs(journeys.occasionPageProducts(page('thank-you'), m3, catalogue)), ['premium-card-addon']);
  // Ceremony garlands stay separate: gift assignments never create ceremony inventory.
  const m4 = empty(); m4.set('red-affair', ['wedding']);
  assert.equal(journeys.ceremonyProducts('wedding', []).length, 0);
});

test('directory: counts are the real eligible sets; get-well offers its products; housewarming and baby shower link their lists; condolence and ceremonies preserved', () => {
  // Fixture shaped like the 19 Oct 2026 assignments (not constants in code).
  const membership = empty();
  const assign = (list, occasion) => list.forEach((slug) => membership.set(slug, [...membership.get(slug), occasion]));
  assign(['daisy-morning', 'sweet-petal-hour', 'winter-whisper'], 'get-well-soon');
  assign(['snow-white-saga', 'fragrance-festive-giftbox', 'sunrise-asiatic-vase'], 'housewarming');
  assign(['cotton-candy'], 'mom-to-be');
  assign(['cloud-white', 'white-silence'], 'sympathy');
  assign(['cloud-white', 'blue-mountain-grace', 'red-affair'], 'thank-you');
  assign(['red-affair', 'rose-promise'], 'congratulations');
  assign(['chocolates-addon'], 'thank-you');
  const needs = Object.fromEntries(journeys.needDestinations(membership, catalogue).map((n) => [n.need, n]));
  const getWell = needs['Get well & apology'];
  assert.equal(getWell.href, '/categories/bouquets?occasion=get-well-soon');
  assert.equal(getWell.count, 3);
  assert.equal(getWell.note, 'Gentle bouquets from our range.');
  const thanks = needs['Congratulations, thanks & farewell'];
  assert.equal(thanks.href, '/categories/bouquets?occasion=congratulations,thank-you');
  assert.equal(thanks.count, 4, 'red-affair counted once; the add-on is not a bouquet');
  assert.equal(needs['Housewarming & pooja'].href, '/occasions/housewarming?for=gift');
  assert.equal(needs['Housewarming & pooja'].count, 3);
  assert.equal(needs['Baby shower, new baby & naming ceremony'].href, '/occasions/mom-to-be?for=gift');
  assert.equal(needs['Baby shower, new baby & naming ceremony'].count, 1);
  assert.equal(needs.Condolence.href, '/occasions/sympathy');
  assert.equal(needs.Condolence.count, 2);
  assert.equal(needs['Wedding ceremony'].href, '/occasions/wedding?for=ceremony');
  assert.equal(needs['Haldi & Mehendi'].href, null);
  // The link's own list shows the same number: the bouquet list filtered by those occasions.
  const listed = journeys.withAssignments(range.bouquetRange(catalogue), membership).filter((p) => ['congratulations', 'thank-you'].some((o) => p.occasionTags.includes(o)));
  assert.equal(listed.length, thanks.count);
  // With nothing assigned, every gift need falls back to a WhatsApp enquiry (no invented availability).
  const none = Object.fromEntries(journeys.needDestinations(empty(), catalogue).map((n) => [n.need, n]));
  assert.equal(none['Housewarming & pooja'].href, null);
  assert.equal(none['Get well & apology'].href, null);
  assert.equal(none.Condolence.href, '/occasions/sympathy');
});

test('menu and homepage counts use eligibility and assignments; the prebuilt header is a deployment snapshot, the occasion pages are live', () => {
  const membership = empty();
  membership.set('snow-white-saga', ['housewarming']);
  membership.set('cotton-candy', ['mom-to-be']);
  const menu = json(journeys.menuOccasions(membership, catalogue));
  assert.deepEqual(menu.map((m) => [m.href, m.count]), [['/occasions/wedding', 0], ['/occasions/engagement', 0], ['/occasions/housewarming', 1], ['/occasions/mom-to-be', 1]]);
  // Static seed tags do not populate the menu.
  assert.equal(json(journeys.menuOccasions(empty(), catalogue)).some((m) => m.href === '/occasions/birthday'), false);
  const header = readFileSync('src/components/atelier/SiteHeader.astro', 'utf8');
  assert(/loadMenuMembership\(\)/.test(header) && /menuOccasions\(menuMembership, publicCatalogue\)/.test(header) && /changes with the\s*\n?\s*\/\/ next deployment/.test(header));
  const service = readFileSync('src/server/services/PublicCatalogue.ts', 'utf8');
  assert(/publishedOccasionMap\(\)/.test(service));
  // Occasion pages and lists read assignments on request.
  for (const file of ['src/pages/occasions/[slug].astro', 'src/pages/occasions/index.astro', 'src/pages/categories/bouquets.astro', 'src/pages/index.astro', 'src/pages/sitemap-occasions.xml.ts']) {
    const source = readFileSync(file, 'utf8');
    assert(/prerender = false/.test(source) && /loadOccasionMembership\(/.test(source) && /loadPublicCatalogue\(\)/.test(source), file);
  }
});

test('admin follow-through: affected routes and refresh tags for non-featured bouquets, additions and removals; no implied occasion', async () => {
  const purged = [];
  const website = sourceLoader({ mocks: {
    'src/server/services/GarlandWebsite.ts': { OCCASION_MAX_STALE_SECONDS: 180, occasionTagsFor: load('src/server/services/GarlandWebsite.ts').occasionTagsFor, refreshWebsite: async (tags) => (purged.push(tags), { ok: true, tags }) },
    'src/server/services/OccasionMembership.ts': { occasionSlugsForIds: async (ids) => ids.map((id) => ({ 1: 'birthday', 2: 'housewarming', 3: 'pooja', 4: 'thank-you' })[id]).sort() },
    'src/server/services/PublicCatalogue.ts': { loadPublicCatalogue: async () => catalogue },
  } })('src/server/services/OccasionWebsite.ts');
  // Adding Birthday and Housewarming to a non-featured public bouquet.
  const added = await website.occasionWebsiteChange({ slug: 'snow-white-saga', occasionIds: [4] }, { slug: 'snow-white-saga', occasionIds: [1, 2, 4] }, catalogue);
  assert.deepEqual(json(added.routes), ['birthday', 'housewarming']);
  assert.equal(added.listed, true);
  assert.deepEqual(json(purged.at(-1)), ['occasion-index', 'occasion:birthday', 'occasion:housewarming']);
  // Removing them purges the same pages.
  const removed = await website.occasionWebsiteChange({ slug: 'snow-white-saga', occasionIds: [1, 2, 4] }, { slug: 'snow-white-saga', occasionIds: [4] }, catalogue);
  assert.deepEqual(json(removed.routes), ['birthday', 'housewarming']);
  // Pooja does not add Housewarming to the pages or the purge.
  const pooja = await website.occasionWebsiteChange({ slug: 'little-lilly-prayer', occasionIds: [] }, { slug: 'little-lilly-prayer', occasionIds: [3] }, catalogue);
  assert.deepEqual(json(pooja.routes), ['pooja']);
  assert(!purged.at(-1).includes('occasion:housewarming'));
  // An add-on only affects older pages; a record the deployment doesn't publish affects none and purges nothing.
  const addon = await website.occasionWebsiteChange({ slug: 'chocolates-addon', occasionIds: [] }, { slug: 'chocolates-addon', occasionIds: [1, 4] }, catalogue);
  assert.deepEqual(json(addon.routes), ['thank-you']);
  const before = purged.length;
  const archived = await website.occasionWebsiteChange({ slug: 'jasmine-malli', occasionIds: [] }, { slug: 'jasmine-malli', occasionIds: [1] }, catalogue);
  assert.equal(archived.listed, false); assert.deepEqual(json(archived.routes), []); assert.equal(archived.refresh, null); assert.equal(purged.length, before);
  // The live-page check expects what the deployed catalogue lists.
  let html = '<li data-occasion-product-slug="snow-white-saga">';
  const check = sourceLoader({ mocks: { 'src/server/services/GarlandWebsite.ts': {}, 'src/server/services/OccasionMembership.ts': {}, 'src/server/services/PublicCatalogue.ts': { loadPublicCatalogue: async () => catalogue } }, globals: { fetch: async () => ({ status: 200, text: async () => html }) } })('src/server/services/OccasionWebsite.ts').checkOccasionPages;
  assert.equal((await check({ slug: 'snow-white-saga' }, ['housewarming'], ['housewarming'], 'http://localhost'))[0].ok, true);
  html = '';
  assert.equal((await check({ slug: 'snow-white-saga' }, [], ['housewarming'], 'http://localhost'))[0].ok, true);
  assert.deepEqual(json(load('src/server/services/GarlandWebsite.ts').occasionTagsFor(['pooja'])), ['occasion-index', 'occasion:pooja']);
});

// ---------------------------------------------------------------------------
// Categories and colours
// ---------------------------------------------------------------------------

test('All Flowers: the seven omitted fresh-flower products qualify by type; plants, tools, containers, add-ons and hampers do not; existing entries kept', () => {
  const all = range.allFlowersRange(productCatalog);
  const has = (slug) => all.some((p) => p.slug === slug);
  for (const slug of ['diy-flowerbox', 'gift-flower-box', 'gift-basket', 'premium-flower-basket', 'fresh-flower-toran', 'roses-by-stem', 'lilies-by-stem']) assert(has(slug), slug);
  for (const slug of ['mini-succulent-gift', 'plant-and-flower-hamper', 'florist-cutter', 'flower-food-sachets', 'clear-glass-vase', 'premium-decor-vase', 'chocolates-addon', 'premium-card-addon', 'flower-chocolate-hamper', 'dried-flower-bunch', 'jasmine-malli-subscription', 'custom-flower-subscription']) assert(!has(slug), slug);
  // Every product already in the flower range keeps its place.
  for (const p of productCatalog.filter((x) => x.collectionTags?.includes('all-flowers'))) assert(has(p.slug), p.slug);
  // A container with no flowers recorded stays out.
  assert.equal(range.isAllFlowersProduct({ category: 'Baskets', whatsIncluded: ['Empty wicker basket'], flowerTypes: [] }), false);
  // Public only: archived records are not listed.
  const publicAll = range.allFlowersRange(catalogue);
  assert(!publicAll.some((p) => ARCHIVED.includes(p.slug)));
  assert.equal(publicAll.length, 58);
  // Every listed product lands in exactly one presentation group (stems have their own).
  const sections = load('src/data/collectionGuidance.ts').allFlowerSections(publicAll);
  assert.equal(new Set(sections.flatMap((s) => slugs(s.products))).size, publicAll.length);
  assert.deepEqual(slugs(sections.find((s) => s.id === 'stems').products).sort(), ['lilies-by-stem', 'roses-by-stem']);
  // No pending category is promoted in the main menu by this.
  assert.equal(launch.LAUNCH_CATEGORIES.find((c) => c.id === 'baskets').ready, false);
});

test('flower pages: /rose and /lilies list every arrangement with that flower plus its stems; /roses stays the stem page; URLs kept', () => {
  const guide = load('src/data/collectionGuidance.ts');
  const rose = [...range.arrangementsWith(catalogue, 'roses'), ...range.stemsOf(catalogue, 'roses')];
  const lilies = [...range.arrangementsWith(catalogue, 'lilies'), ...range.stemsOf(catalogue, 'lilies')];
  assert(rose.length >= 14 && slugs(rose).includes('rose-promise') && slugs(rose).includes('roses-by-stem'));
  for (const slug of ['lily-calm', 'little-lilly-prayer', 'love-at-first-sight', 'pink-lily-wish', 'white-silence', 'lilies-by-stem']) assert(slugs(lilies).includes(slug), slug);
  assert.deepEqual(json(guide.flowerSections(lilies, 'lilies').map((s) => [s.id, s.products.length])), [['arrangements', lilies.length - 1], ['stems', 1]]);
  assert.deepEqual(slugs(range.stemsOf(catalogue, 'roses')), ['roses-by-stem']);
  const route = readFileSync('src/pages/categories/[slug].astro', 'utf8');
  assert(/roses: "Roses by Stem"/.test(route) && /rose: "Rose Bouquets & Arrangements"/.test(route) && /lilies: "Lilies: Bouquets, Arrangements & Stems"/.test(route));
  // No canonical consolidation: the pages have different content.
  const seo = load('src/data/seoLanding.ts');
  assert(!seo.CANONICAL_CATEGORY.rose && !seo.CANONICAL_CATEGORY.roses && !seo.CANONICAL_CATEGORY.lilies);
});

test('colours: recorded blue, purple/lavender and orange are classified; one lavender rule; old URL values kept; unknown values ignored', () => {
  const colours = (...flowerTypes) => json(journeys.productColours({ flowerTypes }));
  assert.deepEqual(colours('Blue gypsophila', 'Baby’s breath'), ['blue']);
  assert.deepEqual(colours('Lavender roses'), ['purple']);
  assert.deepEqual(colours('Lavender statice', 'Purple asters'), ['purple']);
  assert.deepEqual(colours('Orange lilies'), ['orange']);
  assert.deepEqual(colours('Blue delphinium-style flowers', 'White roses'), ['white', 'blue']);
  // Only recorded flowers count: a name or a photograph creates no colour.
  assert.deepEqual(json(journeys.productColours({ name: 'Purple Crush', flowerTypes: [] })), []);
  const bouquets = range.bouquetRange(catalogue);
  for (const key of ['blue', 'purple', 'orange']) assert(bouquets.some((p) => journeys.productColours(p).includes(key)), key);
  const parse = (query) => json(filters.parseShopFilters(new URLSearchParams(query)).colour);
  assert.deepEqual(parse('colour=red,pink,peach,white,yellow,mixed'), ['red', 'pink', 'peach', 'white', 'yellow', 'mixed']);
  assert.deepEqual(parse('colour=lavender'), ['purple']);
  assert.deepEqual(parse('colour=Lilac,purple'), ['purple']);
  assert.deepEqual(parse('colour=Blue,orange'), ['blue', 'orange']);
  assert.deepEqual(parse('colour=teal,<script>,'), []);
  const groups = journeys.filterGroups(bouquets, ['colour']);
  const keys = groups[0].options.map((o) => o.key);
  assert(keys.includes('blue') && keys.includes('purple') && keys.includes('orange'));
  assert.equal(load('src/data/shoppingTaxonomy.ts').COLOUR_LABELS.purple, 'Purple & lavender');
});

// ---------------------------------------------------------------------------
// Publication snapshot
// ---------------------------------------------------------------------------

test('publication: only "published" is public; missing, draft, archived and unknown records are excluded and reported; unmapped records are not live', () => {
  const records = [
    ...productCatalog.filter((p) => p.slug !== 'red-affair').map((p) => ({ slug: p.slug, status: ARCHIVED.includes(p.slug) ? 'archived' : p.slug === 'cloud-white' ? 'draft' : p.slug === 'cotton-candy' ? 'retired' : 'published', category: p.category, name: p.name })),
    { slug: 'new-orchid-bouquet', status: 'published', category: 'Bouquets', name: 'New Orchid Bouquet' },
    { slug: 'fp-g001-garland', status: 'published', category: 'Garlands', name: 'Garland' },
  ];
  records.find((r) => r.slug === 'timeless-hug').name = 'Timeless Hug (edited in the dashboard)';
  const report = range.reconcileCatalogue(records, productCatalog, (record) => record.category === 'Garlands');
  assert.deepEqual(json(report.missingRecord), ['red-affair']);
  assert.deepEqual(json(report.unknownStatus), [{ slug: 'cotton-candy', status: 'retired' }]);
  assert.deepEqual(json(report.hidden.map((h) => h.slug).sort()), [...ARCHIVED, 'cloud-white'].sort());
  assert.deepEqual(json(report.unmapped.map((u) => u.slug)), ['new-orchid-bouquet']);
  assert.deepEqual(json(report.editorialDrift.map((d) => [d.slug, d.field])), [['timeless-hug', 'name']]);
  assert.equal(report.live.length, productCatalog.length - 1 - 1 - 1 - ARCHIVED.length);
  const lines = range.reconciliationReport(report).join('\n');
  assert(/PROBLEM: 1 catalogue product\(s\) have no database record/.test(lines) && /unknown status, treated as not published: cotton-candy \(retired\)/.test(lines) && /NOT live: new-orchid-bouquet/.test(lines) && /src\/data\/productCatalog\.ts/.test(lines));
  // The public set never includes a missing, unknown or unpublished record.
  const map = new Map(records.map((r) => [r.slug, r.status]));
  const visible = slugs(range.publicProducts(productCatalog, map));
  for (const slug of ['red-affair', 'cotton-candy', 'cloud-white', ...ARCHIVED]) assert(!visible.includes(slug), slug);
  assert.equal(range.publicProducts(productCatalog, new Map()).length, 0, 'no snapshot is not "everything published"');
});

test('snapshot: a database outage or an empty result fails the build; production without a snapshot refuses; development reads the database', async () => {
  const withRepo = (list, { dev = false, statusMap = new Map() } = {}) => sourceLoader({ dev, mocks: {
    'src/server/db/repositories/ProductRepository.ts': { ProductRepository: { list } },
    'src/server/services/OccasionMembership.ts': { loadOccasionMembership: async () => new Map() },
    'src/server/services/PublishedPrices.ts': { publishedStatusMap: async () => statusMap, publishedOccasionMap: async () => new Map() },
    'src/server/db/postgres/client.ts': { getDb: () => ({ execute: async () => ({ rows: [] }) }) },
    'drizzle-orm': { sql: () => ({}) },
  } })('src/server/services/PublicCatalogue.ts');
  await assert.rejects(withRepo(async () => { throw new Error('connect ECONNREFUSED'); }).catalogueSnapshot(), /could not be read.*Nothing was published/);
  await assert.rejects(withRepo(async () => []).catalogueSnapshot(), /returned no records/);
  const allArchived = async () => productCatalog.map((p) => ({ slug: p.slug, status: 'archived', categoryName: p.category, name: p.name, designCode: null }));
  await assert.rejects(withRepo(allArchived).catalogueSnapshot(), /no catalogue product is published/);
  const rows = async () => productCatalog.map((p) => ({ slug: p.slug, status: ARCHIVED.includes(p.slug) ? 'archived' : 'published', categoryName: p.category, name: p.name, designCode: null }));
  const snapshot = await withRepo(rows).catalogueSnapshot();
  assert.equal(snapshot.length, productCatalog.length);
  assert.equal(snapshot.find((r) => r.slug === 'jasmine-malli').status, 'archived');
  await assert.rejects(withRepo(rows).loadPublicCatalogue(), /no catalogue publication snapshot/);
  const deployed = await withRepo(rows, { statusMap: new Map(snapshot.map((r) => [r.slug, r.status])) }).loadPublicCatalogue();
  assert.equal(deployed.length, productCatalog.length - ARCHIVED.length);
  const dev = await withRepo(rows, { dev: true }).loadPublicCatalogue();
  assert.equal(dev.length, productCatalog.length - ARCHIVED.length);
  // The content config builds prices and status from one read and only when building.
  const config = readFileSync('src/content.config.ts', 'utf8');
  assert(/readPriceMapFromDatabase\(await readBuildRecords\(\)\)/.test(config) && /catalogueSnapshot\(\)/.test(config) && /status: z\.string\(\)/.test(config));
});

test('admin: dashboard status is shown apart from storefront readiness; unmapped records are never reported live; pending deployment is explicit', () => {
  const { storefrontMessage } = load('src/features/admin/productEditor/storefrontReadiness.ts');
  assert.equal(storefrontMessage('published', { mapped: true, deployedStatus: 'published' }).tone, 'ok');
  const pendingPublish = storefrontMessage('published', { mapped: true, deployedStatus: 'archived' });
  assert.equal(pendingPublish.tone, 'pending'); assert.match(pendingPublish.text, /next successful deployment/);
  const pendingArchive = storefrontMessage('archived', { mapped: true, deployedStatus: 'published' });
  assert.equal(pendingArchive.tone, 'pending'); assert.match(pendingArchive.text, /still live on the storefront until the next successful deployment/);
  const unmapped = storefrontMessage('published', { mapped: false, deployedStatus: 'published' });
  assert.equal(unmapped.tone, 'problem'); assert.match(unmapped.text, /not live/); assert.doesNotMatch(unmapped.text, /^Live/);
  assert.equal(storefrontMessage('draft', { mapped: true, deployedStatus: null }).tone, 'off');
  const edit = readFileSync('src/pages/admin/products/edit/[id].astro', 'utf8');
  assert(/storefrontReadiness\(product\.slug\)/.test(edit) && /UNMAPPED_EDITORIAL_FIELDS/.test(edit) && /DATABASE_DRIVEN_FIELDS/.test(edit));
  assert(range.UNMAPPED_EDITORIAL_FIELDS.includes('name') && range.DATABASE_DRIVEN_FIELDS.some((f) => /publication status \(with the next deployment\)/.test(f)));
  // The admin save/publish contract is unchanged: the same PATCH handler and status actions.
  const api = readFileSync('src/pages/api/admin/products/[id].ts', 'utf8');
  assert(/occasionWebsiteChange\(before, result\.data\)/.test(api) && /garlandWebsiteChange\(before, result\.data\)/.test(api));
});

test('archived and draft records are excluded from routes, lists, recommendations, search and sitemaps; the unavailable page is a 404 with no sales actions', () => {
  const surfaces = {
    'src/pages/products/[slug].astro': /return publicCatalogue\.map\(/,
    'src/pages/categories/[slug].astro': /publicCatalogue\.filter\(/,
    'src/pages/categories/bouquets.astro': /bouquetRange\(publicCatalogue\)/,
    'src/pages/categories/garlands.astro': /const otherProducts = publicCatalogue/,
    'src/pages/search.astro': /const searchableProducts = publicCatalogue\.map/,
    'src/pages/sitemap.xml.ts': /const productPaths = publicCatalogue\.map/,
    'src/pages/saved.astro': /\(await loadPublicCatalogue\(\)\)/,
    'src/pages/cart.astro': /publicCatalogue\.map\(\(product\) => \[product\.slug/,
    'src/pages/locations/[city].astro': /const bySlug = \(slug: string\) => publicCatalogue\.find/,
    'src/pages/guides/jasmine-pooja-flowers-and-gajra.astro': /publicCatalogue\.filter/,
    'src/server/services/CityCatalogue.ts': /featuredBouquets\(publicCatalogue\)/,
    'src/components/ProductOptions.astro': /publicCatalogue\.find/,
  };
  for (const [file, pattern] of Object.entries(surfaces)) {
    const source = readFileSync(file, 'utf8');
    assert(pattern.test(source), file);
    // The category route reads the static catalogue only for its set of addresses (stable URLs; empty pages are noindexed).
    const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/const productCategorySlugs = productCatalog\.map|const productCollectionSlugs = productCatalog\.flatMap/g, '');
    assert(!/\bproductCatalog\s*\.\s*(map|filter|find|flatMap)\(/.test(code), `${file} reads the raw catalogue`);
  }
  // Related products come from the public catalogue too.
  assert(/const relatedProducts = \(await loadPublicCatalogue\(\)\)/.test(readFileSync('src/pages/products/[slug].astro', 'utf8')));
  // Sitemap category entries follow the public lists (empty → left out).
  assert(/hasPublicProducts\(entry\.props\.products\)/.test(readFileSync('src/pages/sitemap.xml.ts', 'utf8')));
  // An unbuilt catalogue slug falls through to the on-request route: 404, noindex, no basket, enquiry or redirect.
  const fallthrough = readFileSync('src/pages/products/[...garland].astro', 'utf8');
  assert(/if \(!product\) Astro\.response\.status = 404;/.test(fallthrough) && /const noindex = !product/.test(fallthrough) && /catalogueRecord/.test(fallthrough) && /This product isn't on sale at the moment/.test(fallthrough));
  assert(!/Astro\.redirect/.test(fallthrough));
  const unavailable = fallthrough.slice(fallthrough.indexOf('data-garland-unavailable'));
  assert(!/data-cart|wa\.me|whatsappLink|garland-enquiry/.test(unavailable.slice(0, unavailable.indexOf('</section>'))));
  // Pooja copy names jasmine products only while they are public.
  assert(/publicSlugs\.has\("jasmine-malli"\) && publicSlugs\.has\("jasmine-gajra"\)/.test(readFileSync('src/components/category/CategoryPage.astro', 'utf8')));
});

// ---------------------------------------------------------------------------
// Release review (19 Oct 2026): baskets, pooja copy, group labels, admin drift
// ---------------------------------------------------------------------------

test('basket: a saved item whose product is no longer published leaves every reader; add-ons too; everything else is untouched', () => {
  const cart = load('src/utils/cart.ts');
  const unavailable = new Set(['jasmine-malli', 'chocolates-addon']);
  const saved = [
    { id: 'bouquet-012:journey:birthday:gift', slug: 'red-affair', name: 'Red Affair', quantity: 3, deliveryDate: '2026-10-25', addOns: [{ id: 'clear-glass-vase', name: 'Clear Glass Vase', priceLabel: '', quantity: 1 }, { id: 'chocolates-addon', name: 'Chocolates', priceLabel: '', quantity: 1 }], journey: { occasion: 'birthday', intent: 'gift' } },
    { id: 'pooja-002', slug: 'jasmine-malli', name: 'Jasmine Malli', quantity: 2 },
  ];
  const { items, removed } = cart.withoutUnavailable(saved, unavailable);
  assert.deepEqual(json(removed), ['Chocolates (add-on with Red Affair)', 'Jasmine Malli']);
  assert.equal(items.length, 1);
  const kept = json(items[0]);
  assert.equal(kept.quantity, 3); assert.equal(kept.deliveryDate, '2026-10-25'); assert.deepEqual(kept.journey, { occasion: 'birthday', intent: 'gift' });
  assert.deepEqual(kept.addOns.map((a) => a.id), ['clear-glass-vase']);
  // Nothing to remove: the same items back.
  assert.equal(cart.withoutUnavailable(saved, new Set()).items, saved);
  // Every basket reader goes through getCartItems, which applies it and persists the result.
  const source = readFileSync('src/utils/cart.ts', 'utf8');
  assert(/const \{ items, removed \} = withoutUnavailable\(parsed, unavailableProducts\(\)\)/.test(source) && /getCartCount\(\) \{\s*return getCartItems\(\)/.test(source));
  // The header embeds this deployment's unpublished catalogue slugs on every page.
  const header = readFileSync('src/components/atelier/SiteHeader.astro', 'utf8');
  assert(/id="fp-unavailable-products"/.test(header) && /filter\(\(slug\) => !publicSlugs\.has\(slug\)\)/.test(header));
  // The basket page's own script prunes before rendering, counting or building a draft, and explains once.
  const script = readFileSync('src/scripts/inline/cart.js', 'utf8');
  assert(/function getCartItems\(\)[\s\S]*withoutUnavailable\(parsed\)/.test(script) && /showUnavailableNotice\(\);\s*renderCart\(\);/.test(script));
  assert(/const items = getCartItems\(\);[\s\S]*if \(items\.length === 0\) \{\s*showError\("Your cart is empty\."\);\s*return "#";/.test(script), 'an emptied basket cannot produce a draft');
  assert(/data-cart-unavailable-notice/.test(readFileSync('src/pages/cart.astro', 'utf8')));
});

test('pooja and jasmine copy: no archived product presented as listed; no dangling section links; guidance kept', () => {
  const hubs = JSON.stringify(load('src/data/cityHubs.ts').CITY_HUBS);
  assert(!/three of the pooja products|Two boxes are listed|jasmine and gajra entries below|Four forms compared|Three forms compared|How these three differ/.test(hubs));
  assert(/loose jasmine \(mallige\) are for offering/.test(hubs), 'educational guidance kept');
  const guidance = load('src/data/collectionGuidance.ts');
  assert(!/Two boxes are listed/.test(JSON.stringify(guidance.POOJA_SECTIONS)));
  const landing = load('src/data/seoLanding.ts').CATEGORY_LANDING['pooja-flowers'];
  assert(!/pooja flower boxes, baskets and temple bulk flowers, priced/.test(landing.description) && /not listed/.test(landing.intro[0]));
  const guide = load('src/data/guides.ts').POOJA_GUIDE;
  assert(!/the two pooja flower boxes|with their listed prices/.test(guide.description + guide.summary) && guide.updated === '2026-10-19');
  const page = readFileSync('src/pages/guides/jasmine-pooja-flowers-and-gajra.astro', 'utf8');
  assert(/boxes\.length === 2 \? ", and the two boxes on this website/.test(page) && /data-guide-unlisted="jasmine"/.test(page) && /\.\.\.\(boxes\.length === 2 \? \[\{ id: "boxes"/.test(page));
  // City pages: guidance-only pooja sections stay without examples; pooja-collection anchors must exist.
  const city = readFileSync('src/pages/locations/[city].astro', 'utf8');
  assert(/section\.sources\.every\(\(source\) => source\.kind === "pooja"\)/.test(city) && /data-city-unlisted/.test(city) && /poojaAnchors\.has\(link\.href\.split\("#"\)\[1\]\)/.test(city));
  // Which pooja sections exist with today's public products (fixture): boxes is gone, so a #boxes link is dropped.
  const poojaPublic = catalogue.filter((p) => p.collectionTags?.includes('pooja-flowers') || p.category === 'Pooja Flowers');
  const anchors = new Set(Array.from(guidance.poojaSections(poojaPublic), (s) => s.id));
  assert(!anchors.has('boxes') && anchors.has('loose'));
  // Edited hubs carry today's date; untouched hubs keep theirs.
  const dates = Object.fromEntries(load('src/data/cityHubs.ts').CITY_HUBS.map((hub) => [hub.slug, hub.updated]));
  assert.deepEqual([dates.bengaluru, dates.coimbatore, dates.mysuru, dates.chennai], ['2026-10-19', '2026-10-19', '2026-10-19', '2026-10-13']);
});

test('bouquet groups: #mixed is "Other bouquets" (no roses or lilies recorded), never claimed as verified mixed flowers', () => {
  const mixed = range.BOUQUET_FLOWER_GROUPS.find((g) => g.id === 'mixed');
  assert.equal(mixed.label, 'Other bouquets'); assert.equal(mixed.menuLabel, 'Other bouquets');
  assert(/neither roses nor lilies/.test(load('src/data/collectionGuidance.ts').BOUQUET_GROUP_GUIDANCE.mixed.intro));
  // Unique totals: the page header and filters count products once; overlapping cards don't inflate them.
  const groups = range.bouquetFlowerGroups(range.bouquetRange(catalogue));
  const rendered = groups.reduce((n, g) => n + g.products.length, 0);
  assert(rendered > range.uniqueBySlug(groups.map((g) => g.products)).length);
  assert.equal(range.uniqueBySlug(groups.map((g) => g.products)).length, range.bouquetRange(catalogue).length);
});

test('admin drift: only equivalent fields compared; placeholders and deliberate copy are not drift; pending deployment is listed separately', () => {
  const product = productCatalog.find((p) => p.slug === 'red-affair');
  const same = { slug: product.slug, status: 'published', name: product.name, category: product.category, shortDescription: product.description, description: `  ${product.longDescription}\n`, stemCount: product.stemCount ?? null, image: product.image };
  assert.deepEqual(json(range.editorialDrift(same, product)), [], 'whitespace differences are not drift');
  const edited = { ...same, name: 'Red Affair Deluxe', shortDescription: 'New text', image: 'https://example.supabase.co/storage/v1/object/public/media/new.webp' };
  assert.deepEqual(json(range.editorialDrift(edited, product).map((d) => d.field)), ['name', 'shortDescription', 'image']);
  // A catalogue placeholder (photograph reviewed as not the product) is a deliberate replacement.
  const placeholder = productCatalog.find((p) => p.image === range.PLACEHOLDER_IMAGE);
  assert.deepEqual(json(range.editorialDrift({ slug: placeholder.slug, status: 'published', name: placeholder.name, category: placeholder.category, image: '/images/addon-card.jpg' }, placeholder)), []);
  // Deliberate catalogue copy is reported as such.
  const pet = productCatalog.find((p) => p.slug === 'pet-friendly-flowerbox');
  const petDrift = range.editorialDrift({ slug: pet.slug, status: 'published', name: pet.name, category: pet.category, shortDescription: 'Flowerbox curated with pet-conscious flower choices.' }, pet);
  assert(petDrift.length === 1 && /trust containment/.test(petDrift[0].deliberate));
  const report = range.reconciliationReport(range.reconcileCatalogue([{ ...edited }, { slug: pet.slug, status: 'published', name: pet.name, category: pet.category, shortDescription: 'x' }], [product, pet], () => false)).join('\n');
  assert(/dashboard edit\(s\) the storefront does not show/.test(report) && /deliberate catalogue difference/.test(report) && /Not compared \(no one-to-one catalogue field\)/.test(report));
  // The panel separates dashboard status, the deployment's catalogue, pending changes and mapping.
  const { storefrontDetails, storefrontMessage } = load('src/features/admin/productEditor/storefrontReadiness.ts');
  const base = { mapped: true, deployedStatus: 'published', deployedPrice: 1499, priceShown: true, drift: [{ field: 'name' }], unmappedFields: [], databaseFields: [] };
  const details = json(storefrontDetails('archived', 1599, base));
  assert.deepEqual(details.rows.map((r) => r.label), ['Dashboard status', "This deployment's catalogue", 'Storefront entry']);
  assert(details.pending.some((l) => /^Status: archived here, published in the deployed catalogue/.test(l)) && details.pending.some((l) => /^Price: ₹1599 here, ₹1499 on the storefront/.test(l)));
  assert.deepEqual(details.notShown, ['name']);
  assert.equal(json(storefrontDetails('published', null, { ...base, priceShown: false, deployedPrice: null })).pending.length, 0, 'quote-only: no price pending');
  // Dashboard status alone never yields "live": an unmapped product published here is a problem, not live.
  assert.equal(storefrontMessage('published', { mapped: false, deployedStatus: 'published' }).tone, 'problem');
  assert.equal(storefrontMessage('published', { mapped: true, deployedStatus: null }).tone, 'pending');
});

// ---------------------------------------------------------------------------
// Catalogue accuracy (21 October 2026): collection semantics, presentation,
// occasion directory, metadata and feedback wording
// ---------------------------------------------------------------------------

const guidance = load('src/data/collectionGuidance.ts');
const bySlug = (slug) => productCatalog.find((p) => p.slug === slug);
const membershipOf = (slug, list = catalogue) => {
  const m = range.RECORDED_COLLECTIONS[slug](list);
  return { primary: slugs(m.primary), related: Object.fromEntries(Array.from(m.related, (s) => [s.id, slugs(s.products)])), noun: m.noun };
};

test('presentation resolver: inclusion phrases, optional equipment, qualified and conflicting items, the three owner checks; never the name', () => {
  const kind = (whatsIncluded, extra = {}) => range.recordedPresentation({ slug: 'fixture', category: 'Bouquets', whatsIncluded, ...extra }).kind;
  // The phrases the catalogue actually uses ("\bbox\b" alone misses Giftbox/Flowerbox).
  assert.equal(kind(['Fresh lilies', 'Giftbox arrangement']), 'box');
  assert.equal(kind(['Pastel gypsophila', 'Pink flower box']), 'box');
  assert.equal(kind(['Fresh loose flowers', 'Flowerbox packing']), 'box');
  assert.equal(kind(['Fresh statice flowers', 'Wicker basket']), 'basket');
  assert.equal(kind(['Fresh gerberas', 'Glass vase']), 'vase');
  assert.equal(kind(['Fresh roses', 'Kraft wrapping']), 'wrapped');
  assert.equal(range.recordedPresentation({ slug: 'x', category: 'Bouquets', whatsIncluded: ['Hand-tied bouquet'] }).handTied, true);
  // Optional or paired equipment and care are not an included container.
  assert.equal(kind(['Dried flower arrangement', 'Vase option based on availability']), 'unrecorded');
  assert.equal(kind(['Florist cutter option', 'Can be paired with flowerbox orders']), 'unrecorded');
  assert.equal(kind(['Fresh flower arrangement', 'Gift basket or hamper packing']), 'unrecorded');
  // Conflicting or merely qualified evidence stays neutral; a product type can confirm a qualified container.
  assert.equal(kind(['Kraft wrapping', 'Wicker basket']), 'unresolved');
  assert.equal(kind(['Fresh gerberas', 'Vase-style arrangement']), 'unresolved');
  assert.equal(kind(['Fresh seasonal flowers', 'Basket-style arrangement'], { category: 'Baskets' }), 'basket');
  // Names, photographs and tags are not evidence.
  assert.equal(range.recordedPresentation({ slug: 'x', name: 'Rose Box Deluxe', category: 'Bouquets', whatsIncluded: ['Kraft wrapping'], collectionTags: ['flowerbox', 'vases'] }).kind, 'wrapped');
  // presentationCheck() comes first: the three designs whose photograph differs stay unresolved, records unchanged.
  for (const slug of ['mandarin-lily-glow', 'luxe-lily-bloom', 'stargazer-affair']) {
    const product = bySlug(slug);
    assert.deepEqual(json(range.recordedPresentation(product)), { kind: 'unresolved', evidence: [], handTied: false, reason: 'owner-check' }, slug);
    assert(product.whatsIncluded.some((item) => /wrapping/i.test(item)), `${slug} record unchanged`);
    assert(/to be confirmed: the photograph shows/.test(guidance.presentationCheck(product).note), slug);
  }
  assert.equal(range.recordedPresentation(bySlug('sweet-petal-hour')).reason, 'qualified');
});

test('subscriptions count plans only; flower boxes come from records across categories; plans and equipment are related, never counted', () => {
  const subs = membershipOf('subscriptions');
  assert.deepEqual(subs.primary, ['weekly-flowerbox-subscription', 'jasmine-malli-subscription', 'custom-flower-subscription']);
  assert.deepEqual(subs.related, { care: ['florist-cutter', 'flower-food-sachets'] });
  assert.equal(subs.noun, 'plan');
  assert(!subs.primary.includes('daily-pooja-flower-subscription'), 'archived plan stays out');
  const box = membershipOf('flowerbox');
  assert.deepEqual(box.primary, ['cotton-candy', 'fragrance-festive-giftbox', 'pink-serenity-flowerbox', 'diy-flowerbox', 'loose-flower-box', 'gift-flower-box', 'pet-friendly-flowerbox']);
  assert.deepEqual(box.related, { plan: ['weekly-flowerbox-subscription'], equipment: ['clear-glass-vase', 'flower-food-sachets'] });
  for (const related of Object.values(box.related).flat()) assert(!box.primary.includes(related), `${related} is not counted as a flower box`);
  // Publication still decides: the archived pooja flower boxes appear only once published.
  const republished = range.publicProducts(productCatalog, new Map(productCatalog.map((p) => [p.slug, 'published'])));
  assert(membershipOf('flowerbox', republished).primary.includes('pooja-flowerbox') && membershipOf('flowerbox', republished).primary.includes('pooja-flower-box'));
  assert(!membershipOf('flowerbox', catalogue.filter((p) => p.slug !== 'cotton-candy')).primary.includes('cotton-candy'));
});

test('baskets, wrapped bouquets, vases and stems: primary sets from records; exceptions, containers and loose boxes kept apart', () => {
  assert.deepEqual(membershipOf('baskets').primary, ['violet-picnic', 'flower-basket', 'gift-basket', 'premium-flower-basket']);
  const wrapped = membershipOf('hand-tied-bouquets').primary;
  assert.equal(wrapped.length, 34);
  for (const slug of ['all-white-fragrance', 'blush-lily-letter', 'coral-lily-bloom', 'ivory-lily-grace', 'rainbow-hug', 'red-affair']) assert(wrapped.includes(slug), slug);
  for (const slug of ['colour-pop-love', 'sunrise-asiatic-vase', 'cotton-candy', 'violet-picnic', 'fragrance-festive-giftbox', 'mandarin-lily-glow', 'luxe-lily-bloom', 'stargazer-affair', 'sweet-petal-hour', 'bouquets-under-999']) assert(!wrapped.includes(slug), slug);
  const vases = membershipOf('vases');
  assert.deepEqual(vases.primary, ['clear-glass-vase', 'premium-decor-vase']);
  assert(vases.primary.every((slug) => bySlug(slug).isAddon), 'an add-on vase is still a vase product');
  assert.deepEqual(vases.related.arranged, ['colour-pop-love', 'daisy-morning', 'dear-sunshine', 'sunshine-confession', 'sunrise-asiatic-vase']);
  assert.deepEqual(vases.related['for-a-vase'], ['diy-flowerbox', 'weekly-flowerbox-subscription', 'dried-flower-vase-set']);
  assert.deepEqual(membershipOf('bouquets-with-vases').primary, vases.related.arranged);
  // Sweet Petal Hour records only a "vase-style arrangement": not counted until the owner confirms a vase (five, not the old six).
  assert.equal(membershipOf('bouquets-with-vases').primary.length, 5);
  assert(!membershipOf('bouquets-with-vases').primary.includes('sweet-petal-hour') && !vases.related.arranged.includes('sweet-petal-hour'));
  assert.equal(guidance.isVaseArrangement(bySlug('sweet-petal-hour')), false);
  const stems = membershipOf('by-stems');
  assert.deepEqual(stems.primary, ['roses-by-stem', 'lilies-by-stem']);
  assert.deepEqual(stems.related, { loose: ['loose-flower-box'] });
  // Category pages and city views read the same primary set; related products stay on their own pages, search and basket.
  const page = readFileSync('src/pages/categories/[slug].astro', 'utf8');
  assert(/recorded\(slug\)\?\.primary \?\?/.test(page) && /related,\s+countNoun: membership\?\.noun/.test(page));
  assert(/items: \(entry\.props\.products as Product\[\]\)\.map\(productItem\)/.test(readFileSync('src/server/services/CityCatalogue.ts', 'utf8')));
  const component = readFileSync('src/components/category/CategoryPage.astro', 'utf8');
  assert(/\{products\.length\} \{countNoun\}/.test(component) && /Related, not counted above/.test(component));
  // Every product a recorded collection now lists as related is still the primary product of another collection or range.
  const allFlowers = slugs(range.allFlowersRange(catalogue));
  const recordedPrimary = new Set(Object.keys(range.RECORDED_COLLECTIONS).flatMap((slug) => membershipOf(slug).primary));
  const ownCategory = (p) => !['Bouquets', 'Lilies'].includes(p.category) && !Object.keys(range.RECORDED_COLLECTIONS).includes(p.category.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-'));
  for (const slug of Object.keys(range.RECORDED_COLLECTIONS).flatMap((key) => Object.values(membershipOf(key).related).flat())) assert(recordedPrimary.has(slug) || allFlowers.includes(slug) || ownCategory(bySlug(slug)), slug);
});

test('presentation copy: titles name a box or basket; All Flowers places each product once; the bouquet note no longer calls every other bouquet wrapped; alt text unchanged', () => {
  const titles = load('src/data/productTitles.ts');
  assert.equal(titles.productTitle(bySlug('cotton-candy')), 'Cotton Candy – Flower Box | Fresh Petals');
  assert.equal(titles.productTitle(bySlug('violet-picnic')), 'Violet Picnic Mixed Statice Flower Basket | Fresh Petals');
  assert.equal(titles.productTitle(bySlug('pink-serenity-flowerbox')), 'Pink Serenity Flowerbox – Pink Lily Box | Fresh Petals');
  assert.equal(titles.productTitle(bySlug('sweet-petal-hour')).includes('Vase'), false, 'a "vase-style" record is not titled a vase arrangement');
  assert(/Arrangement \| Fresh Petals$/.test(titles.productTitle(bySlug('mandarin-lily-glow'))));
  assert.equal(titles.productTitle(bySlug('red-affair')), 'Red Affair – Red Rose Bouquet | Fresh Petals');
  // Lines say what the record includes; photograph descriptions keep their earlier form (no container added).
  assert.equal(guidance.bouquetLine(bySlug('cotton-candy')), 'Pastel gypsophila, pink baby’s breath, blue baby’s breath and lavender baby’s breath, in a pink flower box.');
  assert.equal(guidance.bouquetLine(bySlug('violet-picnic')), 'Purple statice, pink statice and white statice, in a wicker basket.');
  assert.equal(guidance.bouquetPhotoAlt(bySlug('cotton-candy')), 'Cotton Candy: pastel gypsophila, pink baby’s breath, blue baby’s breath and lavender baby’s breath');
  assert.equal(guidance.bouquetPhotoAlt(bySlug('violet-picnic')), 'Violet Picnic: purple statice, pink statice and white statice');
  assert.equal(guidance.bouquetPhotoAlt(bySlug('red-affair')), 'Red Affair: red roses and fresh rose foliage, in premium white wrapping');
  // All Flowers: one group each; the box and basket designs are no longer "wrapped"; the old #lilies address is signposted.
  const listed = range.allFlowersRange(catalogue);
  const sections = guidance.allFlowerSections(listed);
  const groupOf = (slug) => sections.find((s) => s.products.some((p) => p.slug === slug))?.id;
  assert.equal(sections.flatMap((s) => s.products).length, listed.length);
  assert.equal(groupOf('cotton-candy'), 'boxes-baskets');
  assert.equal(groupOf('violet-picnic'), 'boxes-baskets');
  assert.equal(groupOf('all-white-fragrance'), 'wrapped');
  assert.equal(groupOf('stargazer-affair'), 'to-confirm');
  assert(!sections.some((s) => s.id === 'lilies'));
  assert.deepEqual(json(guidance.ALL_FLOWERS_MOVED_GROUPS.map((g) => [g.id, g.href])), [['lilies', '/categories/lilies']]);
  const wrappedRow = json(guidance.presentationComparison(sections)).find((row) => row.id === 'wrapped');
  assert(!wrappedRow.comesIn.some((item) => /box|basket|vase/i.test(item)));
  const component = readFileSync('src/components/category/CategoryPage.astro', 'utf8');
  assert(!/The other bouquets are wrapped/.test(component) && /data-presentation-kind="box-basket"/.test(component) && /data-moved-group/.test(component));
  // The old #lilies anchor: a titled signpost naming the groups that hold lily designs, with no product cards.
  assert.equal(guidance.ALL_FLOWERS_MOVED_GROUPS[0].flower, 'lilies');
  const signpost = component.slice(component.indexOf('movedGroups.map((moved)'), component.indexOf('collectionLinks.length > 0 &&'));
  assert(/<section id=\{moved\.id\}/.test(signpost) && /<h2 id=\{`\$\{moved\.id\}-title`\}/.test(signpost) && /data-moved-where/.test(signpost) && !/ProductCard/.test(signpost), signpost);
  assert.match(component, /recordsFlower\(product, moved\.flower\) \|\| stemsOf\(\[product\], moved\.flower\)\.length > 0/);
  // Its per-section counts, by that rule, add up to the Lilies collection (designs with lilies plus lily stems).
  const lilyRule = (p) => range.recordsFlower(p, 'lilies') || range.stemsOf([p], 'lilies').length > 0;
  const lilyPage = [...range.arrangementsWith(catalogue, 'lilies'), ...range.stemsOf(catalogue, 'lilies')];
  assert.equal(sections.reduce((n, s) => n + s.products.filter(lilyRule).length, 0), lilyPage.length);
  assert.equal(lilyPage.length, 16);
  const landing = load('src/data/seoLanding.ts').CATEGORY_LANDING;
  assert(!/each wrapped or arranged by hand|^Hand-tied/.test(landing.bouquets.intro[0] + landing.bouquets.description) && !/hand-wrapped/.test(landing['all-flowers'].intro[0]));
  // Rose and lily groups still overlap; their #roses/#lilies/#mixed addresses are unchanged.
  assert.deepEqual(Array.from(range.BOUQUET_FLOWER_GROUPS, (g) => g.id), ['roses', 'lilies', 'mixed']);
});

test('contextual links and social previews: bouquet and All Flowers lists link the flower and vase collections; previews use a reviewed photograph from the full collection', () => {
  const component = readFileSync('src/components/category/CategoryPage.astro', 'utf8');
  for (const href of ['/categories/rose', '/categories/lilies', '/categories/bouquets-with-vases']) assert((component.match(new RegExp(`href: "${href}"`, 'g')) ?? []).length >= 2, href);
  assert(/PREVIEW_COLLECTIONS = new Set\(\["bouquets", "all-flowers", "rose", "lilies"\]\)/.test(component) && /collectionPreviewImage\(listedProducts\)/.test(component) && /image=\{previewImage\}/.test(component));
  const images = load('src/data/imageSitemap.ts');
  const photos = load('src/data/productPhotos.ts');
  const bouquets = range.bouquetRange(catalogue);
  const preview = images.collectionPreviewImage(bouquets);
  const first = bouquets.find((p) => photos.isProductPhotograph(p));
  assert.equal(preview, first.image);
  assert(!/hero-main-banner|\.svg$/.test(preview));
  // Deterministic and permission-bound: a placeholder, an illustrative or an unreviewed photograph never qualifies.
  assert.equal(images.collectionPreviewImage([{ slug: 'x', image: '/images/product-placeholder.svg' }, { slug: 'red-affair', image: '/images/renamed.webp' }]), undefined);
  assert.equal(images.collectionPreviewImage([]), undefined);
  for (const [slug, flower] of [['rose', 'roses'], ['lilies', 'lilies']]) {
    const list = [...range.arrangementsWith(catalogue, flower), ...range.stemsOf(catalogue, flower)];
    const image = images.collectionPreviewImage(list);
    assert(image && photos.isProductPhotograph(list.find((p) => p.image === image)), slug);
  }
});

test('occasion directory: every other indexable occasion is linked once, by the sitemap rule, over the whole public catalogue', () => {
  const membership = empty();
  const assign = (list, occasion) => list.forEach((slug) => membership.set(slug, [...(membership.get(slug) ?? []), occasion]));
  assign(['cloud-white', 'red-affair'], 'thank-you');
  assign(['gift-flower-box', 'mini-succulent-gift'], 'get-well-soon'); // older routes list any product type
  assign(['red-affair'], 'i-am-sorry');
  assign(['plant-and-flower-hamper'], 'new-mom');
  assign(['dear-sunshine'], 'just-because');
  assign(['rose-promise'], 'congratulations');
  assign(['midnight-romance'], 'romantic');
  assign(['snow-white-saga'], 'housewarming');
  assign(['jasmine-malli-subscription'], 'pooja'); // explicitly noindexed
  const garlands = [{ occasionTags: ['wedding', 'engagement'] }];
  const needs = journeys.needDestinations(membership, catalogue);
  const more = json(journeys.moreOccasionLinks(needs, membership, catalogue, garlands));
  assert.deepEqual(more.map((o) => o.href), ['/occasions/thank-you', '/occasions/get-well-soon', '/occasions/i-am-sorry', '/occasions/new-mom', '/occasions/just-because', '/occasions/congratulations', '/occasions/romantic']);
  assert.deepEqual(more.find((o) => o.href === '/occasions/get-well-soon'), { label: 'Get Well Soon', href: '/occasions/get-well-soon', count: 2, noun: 'products' });
  assert.equal(more.find((o) => o.href === '/occasions/thank-you').noun, 'bouquets');
  // Not repeated: destinations already linked by a need (housewarming), the noindexed pooja page, and engagement, which is not indexable on garlands alone.
  for (const slug of ['housewarming', 'pooja', 'engagement', 'wedding', 'birthday']) assert(!more.some((o) => o.href === `/occasions/${slug}`), slug);
  // The same rule as the sitemap and the page's robots tag.
  for (const occasion of OCCASION_PAGES) {
    const products = journeys.occasionPageProducts(occasion, membership, catalogue);
    const expected = occasion.slug !== 'pooja' && (products.length > 0 || occasion.slug === 'wedding');
    assert.equal(journeys.occasionIndexable(occasion, membership, catalogue, garlands), expected, occasion.slug);
  }
  // A removed assignment or an unpublished product removes the link.
  membership.set('dear-sunshine', []);
  assign(['pooja-basket'], 'just-because'); // archived: not in the public catalogue
  assert(!journeys.moreOccasionLinks(needs, membership, catalogue, garlands).some((o) => o.href === '/occasions/just-because'));
  // Wiring: full-catalogue membership, the garland cache tag, the shared rule in the sitemap.
  const index = readFileSync('src/pages/occasions/index.astro', 'utf8');
  assert(/loadOccasionMembership\(publicCatalogue\.map/.test(index) && /occasionCacheHeaders\(\[OCCASION_INDEX_TAG, GARLAND_CACHE_TAG\]\)/.test(index) && /data-more-occasions/.test(index) && /<a href=\{occasion\.href\}>/.test(index));
  const sitemap = readFileSync('src/pages/sitemap-occasions.xml.ts', 'utf8');
  assert(/occasionIndexable\(occasion, membership, publicCatalogue, garlands\)/.test(sitemap) && /GARLAND_CACHE_TAG/.test(sitemap));
  assert(/const noindex = NOINDEX_OCCASION_SLUGS\.has\(occasion\.slug\) \|\| \(products\.length === 0 && !ceremonyLanding\)/.test(readFileSync('src/components/occasion/OccasionPage.astro', 'utf8')));
});

test('metadata and claims: subscriptions name no archived plan; housewarming and mom-to-be claim no absent format; garland snippets describe the photograph; feedback and selection wording neutral', () => {
  const landing = load('src/data/seoLanding.ts').CATEGORY_LANDING.subscriptions;
  assert(!/daily pooja/i.test(JSON.stringify([landing.title, landing.description, landing.intro])));
  for (const slug of ['housewarming', 'mom-to-be']) {
    const { description, heroNote } = page(slug);
    assert(!/hamper|basket|plant|toran/i.test(description.split('.')[0]) && /discussed on WhatsApp|WhatsApp/.test(description + heroNote), slug);
  }
  const garland = readFileSync('src/pages/products/[...garland].astro', 'utf8');
  assert(/In the photograph: \$\{product\.garland\.image\.alt/.test(garland) && /product\?\.garland\.soldUnit \? ` Sold as/.test(garland) && /One garland or a pair, and the price, are confirmed on WhatsApp/.test(garland));
  // Reviews: the four enquiry entries are labelled; no blanket confirmation or verified-order badge; quotations unchanged.
  const reviews = readFileSync('src/pages/reviews.astro', 'utf8');
  assert.equal((reviews.match(/customer: "[^"]+ Enquiry"/g) ?? []).length, 4);
  assert(/const ENQUIRY = \/Enquiry\$\//.test(reviews) && /\{label\(review\)\}/.test(reviews));
  assert(!/WhatsApp Confirmed|Early Brand Proof|Early Review|verified (order|purchase)(?! )/i.test(reviews.replace('none is shown as a verified purchase', '').replace('Not verified purchase reviews', '')));
  assert.equal((reviews.match(/^\s+text: "/gm) ?? []).length, 9);
  assert(reviews.includes('Ordered morning pooja flowers. The flowers were fresh, neatly packed and the WhatsApp confirmation made the process simple.'));
  const product = readFileSync('src/pages/products/[slug].astro', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  assert(!/Be the first to write a review|>\s*Write a review/.test(product) && /Read general feedback/.test(product) && /No reviews are shown for this product/.test(product));
  // The bestselling shortlist keeps its URL and members; it is not called a sales ranking.
  const category = readFileSync('src/pages/categories/[slug].astro', 'utf8');
  assert(/"bestselling-bouquets": "Selected Bouquets"/.test(category) && !/most requested/.test(category) && /not a sales ranking/.test(category));
  assert(catalogue.filter((p) => p.collectionTags.includes('bestselling-bouquets')).length > 0);
});
