import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { sourceLoader } from './source-loader.mjs';

const load = sourceLoader();
const journeys = load('src/data/occasionJourneys.ts');
const filters = load('src/utils/shopFilters.ts');
const context = load('src/utils/journey.ts');
const { productCatalog } = load('src/data/productCatalog.ts');
const { OCCASION_PAGES } = load('src/data/occasionPages.ts');
const empty = () => new Map(productCatalog.map((p) => [p.slug, []]));
const json = (value) => JSON.parse(JSON.stringify(value));

test('homepage edit keeps eligible designs and their supplied prices; no hidden design is invented', () => {
  const { getFeaturedBouquets } = sourceLoader({ mocks: {
    'src/server/services/ProductPricing.ts': { withAuthoritativePrice: (product) => product },
  } })('src/data/atelierHome.ts');
  const range = load('src/data/launchCatalogue.ts').launchProducts().map((product, index) => ({ ...product, priceLabel: `From ₹${2100 + index}` }));
  const featured = getFeaturedBouquets(range);
  assert.equal(featured.length, 4);
  assert.equal(new Set(featured.map((product) => product.slug)).size, 4);
  assert(featured.every((product) => range.includes(product)));
  const withoutFeatured = range.filter((product) => !featured.some((item) => item.slug === product.slug));
  const replacement = getFeaturedBouquets(withoutFeatured);
  assert.equal(replacement.length, Math.min(4, withoutFeatured.length));
  assert(replacement.every((product) => withoutFeatured.includes(product)));
  for (const count of [0, 1, 2, 3]) assert.equal(getFeaturedBouquets(range.slice(0, count)).length, count);
  assert.equal(range.length, load('src/data/launchCatalogue.ts').launchProducts().length);
});

test('valid empty occasion survives; invalid value is ignored; facets do not define validity', () => {
  const state = filters.parseShopFilters(new URLSearchParams('occasion=housewarming,unknown,housewarming'));
  assert.deepEqual(json(state.occasion), ['housewarming']);
  assert.equal(filters.matchesShopFilters({ occasions: ['birthday'], colours: [], budget: null, intent: 'gift' }, state), false);
  const groups = journeys.filterGroups([], ['occasion'], { allOccasions: true });
  assert.equal(groups[0].options.find((o) => o.key === 'housewarming').count, 0);
  assert.equal(filters.parseShopFilters(new URLSearchParams('occasion=unknown')).occasion.length, 0);
});
test('filters round trip, OR within a group, AND across groups, clear explicitly', () => {
  const state = filters.parseShopFilters(new URLSearchParams('occasion=birthday,anniversary&colour=red&budget=under-1500&for=gift'));
  assert.equal(filters.matchesShopFilters({ occasions: ['anniversary'], colours: ['red'], budget: 'under-1500', intent: 'gift' }, state), true);
  assert.equal(filters.matchesShopFilters({ occasions: ['anniversary'], colours: ['pink'], budget: 'under-1500', intent: 'gift' }, state), false);
  assert.deepEqual(json(filters.parseShopFilters(new URL(filters.shopFilterUrl('/categories/bouquets', state), 'http://localhost').searchParams)), json(state));
});
test('selected zero-count budget/colour are present and facet counts apply other filters', () => {
  const products = [{ ...productCatalog[0], priceLabel: 'From ₹1000', flowerTypes: ['Red roses'], occasionTags: ['birthday'] }];
  const state = filters.parseShopFilters(new URLSearchParams('occasion=housewarming&budget=1500-plus&colour=pink'));
  const groups = journeys.filterGroups(products, ['occasion', 'budget', 'colour'], { allOccasions: true, selected: state });
  assert(groups.find((g) => g.id === 'budget').options.some((o) => o.key === '1500-plus'));
  assert(groups.find((g) => g.id === 'colour').options.some((o) => o.key === 'pink'));
  assert(filters.countShopFacets(groups, products.map((p) => journeys.shopItemData(p)), state).every((g) => g.options.every((o) => o.count === 0)));
});
for (const slug of ['premium-card-addon', 'red-affair']) {
  test(`${slug}: admin assignments control additions, explicit removals, empty lists and restoration`, () => {
    const page = OCCASION_PAGES.find((p) => p.slug === 'thank-you');
    const membership = empty();
    const has = () => journeys.occasionPageProducts(page, membership).some((p) => p.slug === slug);
    assert.equal(has(), false);
    membership.set(slug, ['thank-you', 'romantic']); assert.equal(has(), true);
    membership.set(slug, ['romantic']); assert.equal(has(), false);
    membership.set(slug, []); assert.equal(has(), false);
    membership.set(slug, ['thank-you']); assert.equal(has(), true);
  });
}
test('wider catalogue remains available on assigned older routes; launch-route gates remain', () => {
  assert.equal(journeys.occasionProductEligible('premium-card-addon', 'thank-you', ['thank-you']), true);
  assert.equal(journeys.occasionProductEligible('premium-card-addon', 'birthday', ['birthday']), false);
  assert.equal(journeys.occasionProductEligible('red-affair', 'housewarming', ['pooja']), true);
});
test('shared checker detects actual product cards and preserves genuine discrepancies', async () => {
  let html = '<a href="/products/premium-card-addon">Related link</a>';
  const check = sourceLoader({ mocks: { 'src/server/services/GarlandWebsite.ts': {}, 'src/server/services/OccasionMembership.ts': {} }, globals: { fetch: async () => ({ status: 200, text: async () => html }) } })('src/server/services/OccasionWebsite.ts').checkOccasionPages;
  assert.equal((await check({ slug: 'premium-card-addon' }, [], ['thank-you'], 'http://localhost'))[0].ok, true);
  html = '<li data-occasion-product-slug="premium-card-addon">';
  assert.equal((await check({ slug: 'premium-card-addon' }, [], ['thank-you'], 'http://localhost'))[0].ok, false);
  assert.equal((await check({ slug: 'premium-card-addon' }, ['thank-you'], ['thank-you'], 'http://localhost'))[0].ok, true);
});
test('gift-only assignments do not enable ceremony shortcuts or ceremony inventory', () => {
  const membership = empty(); membership.set('red-affair', ['housewarming', 'pooja', 'wedding', 'engagement']);
  assert(!journeys.homeShortcuts(membership).some((s) => s.label === 'Flowers for a ceremony'));
  assert.equal(journeys.ceremonyProducts('wedding', []).length, 0);
  assert.equal(journeys.needDestinations(membership).find((n) => n.need === 'Wedding ceremony').count, 0);
  assert(journeys.needDestinations(membership).find((n) => n.need === 'Housewarming & pooja').href.endsWith('for=gift'));
});
test('ceremony suitability uses supported routes and every public product gate', () => {
  const design = { occasionTags: ['wedding', 'housewarming'], published: true, archived: false, photoPermission: 'granted', sampleVerified: true, hasStoredPhoto: true };
  assert.equal(journeys.ceremonyProducts('wedding', [design]).length, 1);
  assert.equal(journeys.ceremonyProducts('housewarming', [design]).length, 0);
  for (const [field, value] of [['published', false], ['archived', true], ['photoPermission', 'unconfirmed'], ['sampleVerified', false], ['hasStoredPhoto', false]]) assert.equal(journeys.ceremonyProducts('wedding', [{ ...design, [field]: value }]).length, 0);
});
test('sample verification is optional for WhatsApp enquiry garlands only; cart mode still needs it', () => {
  const { isListedGarland, garlandSampleRequired } = load('src/data/garlandRules.ts');
  const design = { published: true, archived: false, photoPermission: 'granted', sampleVerified: false, hasStoredPhoto: true, sellingMode: 'enquiry' };
  assert.equal(garlandSampleRequired('enquiry'), false);
  assert.equal(garlandSampleRequired('cart'), true);
  assert.equal(garlandSampleRequired(undefined), true);
  assert.equal(isListedGarland(design), true);
  assert.equal(isListedGarland({ ...design, sellingMode: 'cart' }), false);
  assert.equal(isListedGarland({ ...design, sellingMode: 'cart', sampleVerified: true }), true);
  for (const [field, value] of [['published', false], ['archived', true], ['photoPermission', 'unconfirmed'], ['photoPermission', 'refused'], ['hasStoredPhoto', false]]) assert.equal(isListedGarland({ ...design, [field]: value }), false);
  assert.equal(journeys.ceremonyProducts('wedding', [{ ...design, occasionTags: ['wedding'] }]).length, 1);
  for (const file of ['src/server/services/ProductService.ts', 'src/server/services/GarlandWebsite.ts', 'src/features/admin/productEditor/publishReadiness.ts', 'src/features/admin/productEditor/completion.ts']) assert(readFileSync(file, 'utf8').includes('garlandSampleRequired('), file);
});
test('156 original draft garlands remain private', () => {
  const designs = JSON.parse(readFileSync('src/data/garlandDrafts.json', 'utf8')).designs;
  const { isListedGarland, isCartGarland } = load('src/data/garlandRules.ts');
  assert.equal(designs.length, 156);
  assert.equal(new Set(designs.map((d) => d.code)).size, 156);
  assert(designs.every((d) => d.price === 5000 && !isListedGarland(d) && !isCartGarland(d)));
});
test('multiple selected occasions and purpose travel together; invalid and unfiltered contexts stay absent', () => {
  const journey = context.makeJourney(['birthday', 'anniversary'], 'gift', '/categories/bouquets?occasion=birthday,anniversary');
  const url = new URL(context.journeyHref('/products/red-affair', journey), 'http://localhost');
  assert.equal(context.journeyFromParams(url.searchParams).occasion, 'birthday,anniversary');
  assert.equal(context.makeJourney([], 'gift'), null);
  assert.equal(context.journeyFromParams(new URLSearchParams('occ=unknown')), null);
  assert.equal(context.makeJourney(['birthday'], 'gift', '//malicious.example').from, '');
});
test('basket merges equal contexts but separates mixed occasions, purpose and unfiltered items', () => {
  const storage = new Map();
  const cart = sourceLoader({ globals: { window: { localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) }, dispatchEvent() {} }, CustomEvent: class {} } })('src/utils/cart.ts');
  const base = { id: 'red-affair', slug: 'red-affair', name: 'Red Affair', priceLabel: 'From ₹1000', image: '/test.jpg', category: 'Bouquets' };
  cart.addToCart({ ...base, journey: context.makeJourney(['birthday'], 'gift') });
  cart.addToCart({ ...base, journey: context.makeJourney(['birthday'], 'gift') });
  cart.addToCart({ ...base, journey: context.makeJourney(['anniversary'], 'gift') });
  cart.addToCart(base);
  const items = cart.getCartItems();
  assert.equal(items.length, 3);
  assert.equal(items.find((i) => i.journey?.occasion === 'birthday').quantity, 2);
  assert.equal(items.filter((i) => !i.journey).length, 1);
});
test('development pricing errors remain explicit, retry recovers; invalid prices never become zero/fallback', async () => {
  let rows = null;
  const pricing = sourceLoader({ dev: true, mocks: { 'src/server/db/repositories/ProductRepository.ts': { ProductRepository: { list: async () => { if (!rows) throw new Error('fixture outage'); return rows; } } } } })('src/server/services/ProductPricing.ts');
  await assert.rejects(pricing.loadAuthoritativePrices(), /fixture outage/);
  rows = [{ slug: 'red-affair', priceType: 'from', sellingPrice: 1234, compareAtPrice: null }];
  // The database amount is read and validated, but a quote-only bouquet reaches the storefront without it.
  assert.equal((await pricing.readPriceMapFromDatabase()).get('red-affair').priceLabel, 'From ₹1234');
  assert.deepEqual({ ...(await pricing.loadAuthoritativePrices()).get('red-affair') }, { priceLabel: 'Price on WhatsApp', sellingPrice: null, compareAtPrice: null });
  for (const amount of [0, -1, null, NaN]) { rows[0].sellingPrice = amount; await assert.rejects(pricing.readPriceMapFromDatabase(), /Invalid authoritative price/); }
  // Offer ranges have no amount: the catalogue's merchandising label is kept, never a number.
  const offers = ['flowers-under-499', 'bouquets-under-999', 'flower-gifts-under-1499'];
  rows = offers.map((slug) => ({ slug, priceType: 'from', sellingPrice: null, compareAtPrice: null }));
  const offerPrices = await pricing.readPriceMapFromDatabase();
  for (const slug of offers) assert.deepEqual({ ...offerPrices.get(slug) }, { priceLabel: null, sellingPrice: null, compareAtPrice: null });
  assert.equal(pricing.withAuthoritativePrice({ slug: offers[0], priceLabel: 'Budget picks' }, offerPrices).priceLabel, 'Budget picks');
  for (const amount of [0, -1, NaN]) { rows[0].sellingPrice = amount; await assert.rejects(pricing.readPriceMapFromDatabase(), /Invalid authoritative price for "flowers-under-499"/); }
  // A priced catalogue product, and a row the catalogue does not know, still need an amount.
  for (const slug of ['red-affair', 'blue-mountain-grace', 'not-in-catalogue']) { rows = [{ slug, priceType: 'from', sellingPrice: null, compareAtPrice: null }]; await assert.rejects(pricing.readPriceMapFromDatabase(), /Invalid authoritative price/); }
  assert.throws(() => pricing.withAuthoritativePrice({ slug: 'missing', priceLabel: '₹1' }, new Map()), /No authoritative price/);
});
test('failed refresh retains 120+60 second headers and truthful saved/failed admin feedback', async () => {
  const website = sourceLoader({ globals: { process: { env: { SITE_CACHE_PURGE_URL: 'http://127.0.0.1/fixture-purge' } }, fetch: async () => ({ ok: false, status: 503 }) } })('src/server/services/GarlandWebsite.ts');
  const result = await website.refreshWebsite(['occasion:housewarming']);
  assert.equal(result.ok, false);
  assert.match(result.message, /refresh failed.*change is saved.*within 3 minutes/);
  assert.equal(website.OCCASION_MAX_STALE_SECONDS, 180);
  assert.match(website.occasionCacheHeaders(['occasion:housewarming'])['Cache-Control'], /s-maxage=120, stale-while-revalidate=60/);
});
test('delivery retains configuration gates and fees without the unconfirmed express promise', () => {
  const { evaluateDeliveryMethod, DELIVERY_METHOD_OPTIONS } = load('src/server/services/delivery/deliveryRules.ts');
  const now = { isoDate: '2026-10-07', minuteOfDay: 600 };
  const zone = { area: 'Fixture area', city: 'Bengaluru', deliveryFee: 42, sameDayAvailable: true, morningDeliveryAvailable: true };
  const result = evaluateDeliveryMethod('EXPRESS', now.isoDate, zone, now, new Date());
  assert.equal(result.available, true); assert.equal(result.fee, 42);
  assert.match(result.promise, /agreed on WhatsApp before order acceptance/);
  assert(!/4[-–]6/.test(result.promise + DELIVERY_METHOD_OPTIONS.map((o) => o.label).join(' ')));
  assert.equal(evaluateDeliveryMethod('EXPRESS', now.isoDate, { ...zone, sameDayAvailable: false }, now, new Date()).available, false);
});
test('occasion carousel cards: owner order, occasion pages, counts equal the page list, admin assignments authoritative', () => {
  const home = sourceLoader({ mocks: { 'src/server/services/ProductPricing.ts': { withAuthoritativePrice: (product) => product } } })('src/data/atelierHome.ts');
  const page = (slug) => OCCASION_PAGES.find((p) => p.slug === slug);
  assert.equal(home.getOccasionCarousel(empty()).length, 0);
  const launch = journeys.launchSlugs();
  const membership = empty();
  membership.set(launch[0], ['birthday', 'wedding', 'engagement', 'sympathy']);
  membership.set(launch[1], ['birthday', 'pooja']);
  // Outside the launch range: never counted on a launch occasion.
  membership.set('premium-card-addon', ['birthday', 'anniversary', 'sympathy']);
  // A public bouquet outside the launch range keeps its place on Condolence.
  membership.set('cloud-white', ['sympathy']);
  const cards = json(home.getOccasionCarousel(membership));
  assert.deepEqual(cards.map((card) => [card.key, card.title, card.href, card.countLabel]), [
    ['birthday', 'Birthday', '/occasions/birthday', '2 designs'],
    ['wedding', 'Wedding', '/occasions/wedding', '1 design'],
    ['engagement', 'Engagement', '/occasions/engagement', '1 design'],
    ['housewarming', 'Housewarming & Pooja', '/occasions/housewarming', '1 design'],
    ['sympathy', 'Condolence', '/occasions/sympathy', '2 designs'],
  ]);
  // The card counts exactly what its occasion page lists (no add-ons, no fallbacks).
  for (const card of cards) assert.equal(card.count, journeys.occasionPageProducts(page(card.key), membership).length);
  assert.deepEqual(json(journeys.occasionPageProducts(page('sympathy'), membership).map((p) => p.slug).sort()), [launch[0], 'cloud-white'].sort());
  // No photograph repeats while an occasion still has an unused one.
  assert.notEqual(cards[3].image.src, cards[0].image.src);
  assert.match(cards[4].image.src, /cloud-white/);
  // Removing assignments in the admin removes the card.
  membership.set('cloud-white', []);
  membership.set(launch[0], ['birthday', 'wedding', 'engagement']);
  assert.equal(json(home.getOccasionCarousel(membership)).some((card) => card.key === 'sympathy'), false);
});
test('Condolence lists public bouquets only; other older routes keep their wider scope', () => {
  assert.equal(journeys.occasionProductEligible('premium-card-addon', 'sympathy', ['sympathy']), false);
  assert.equal(journeys.occasionProductEligible('cloud-white', 'sympathy', ['sympathy']), true);
  assert.equal(journeys.occasionProductEligible('cloud-white', 'sympathy', []), false);
  assert.equal(journeys.occasionProductEligible('premium-card-addon', 'thank-you', ['thank-you']), true);
});
test('hero campaigns: three slides with real destinations; garland routes only while garlands are public; no product claims', () => {
  const home = sourceLoader({ mocks: { 'src/server/services/ProductPricing.ts': { withAuthoritativePrice: (product) => product } } })('src/data/atelierHome.ts');
  const slides = json(home.getHeroCampaigns({ garlandsPublic: true }));
  assert.deepEqual(slides.map((slide) => slide.id), ['bouquets', 'garlands', 'pooja']);
  assert.deepEqual(slides.map((slide) => [slide.primary.href, slide.secondary?.href]), [['/categories/bouquets', '/occasions'], ['/categories/garlands', '/custom-orders'], ['/custom-orders', '/categories/pooja-flowers']]);
  assert.equal(slides[0].headline.before + slides[0].headline.accent + slides[0].headline.after, 'Flowers that feel as special as the moment.');
  for (const slide of slides) {
    // Campaign imagery: no price, no delivery promise, and every file exists.
    assert.doesNotMatch(JSON.stringify([slide.headline, slide.text, slide.print.caption]), /₹|same-day|free delivery/i);
    for (const picture of [slide.image, slide.print.image]) for (const entry of `${picture.avif}, ${picture.webp}`.split(', ')) assert.ok(readFileSync(`public${entry.split(' ')[0]}`).length > 0);
    assert.equal(slide.image.width, 1672);
    assert.equal(slide.image.height, 941);
  }
  const withoutGarlands = json(home.getHeroCampaigns({ garlandsPublic: false }));
  assert.deepEqual(withoutGarlands.map((slide) => slide.id), ['bouquets', 'pooja']);
  assert.ok(!JSON.stringify(withoutGarlands.map((slide) => [slide.primary, slide.secondary])).includes('/categories/garlands'));
});
test('hero banner: three distinct launch bouquets, each with its own photograph and supplied price', () => {
  const home = sourceLoader({ mocks: {
    'src/server/services/ProductPricing.ts': { withAuthoritativePrice: (product) => product },
  } })('src/data/atelierHome.ts');
  const range = load('src/data/launchCatalogue.ts').launchProducts().map((product, index) => ({ ...product, priceLabel: `From ₹${2100 + index}` }));
  const slides = json(home.getHeroSlides(range));
  assert.deepEqual(slides.map((slide) => slide.slug), ['timeless-hug', 'rose-promise', 'blush-lily-letter']);
  assert.equal(new Set(slides.map((slide) => slide.image.src)).size, 3);
  for (const slide of slides) {
    const product = range.find((item) => item.slug === slide.slug);
    // The caption is the photographed bouquet: its name, its price, its own image file.
    assert.equal(slide.name, product.name);
    assert.equal(slide.priceLabel, product.priceLabel);
    assert.ok(slide.image.srcset.includes(product.image));
    assert.ok(slide.image.width > 0 && slide.image.height > 0);
  }
  // A bouquet that leaves the range is replaced by another launch bouquet, never an invented one.
  const without = range.filter((product) => product.slug !== 'rose-promise');
  const replaced = json(home.getHeroSlides(without));
  assert.equal(replaced.length, 3);
  assert.ok(replaced.every((slide) => without.some((product) => product.slug === slide.slug)));
  for (const count of [0, 1, 2]) assert.equal(home.getHeroSlides(range.slice(0, count)).length, count);
  // The first slide is the bouquet the business check reads (scripts/audit/business.mjs).
  assert.equal(home.getHeroPhoto().slug, slides[0].slug);
  // Condolence is the one quiet card.
  const membership = empty();
  const launch = journeys.launchSlugs();
  membership.set(launch[0], ['birthday', 'sympathy']);
  assert.deepEqual(json(home.getOccasionCarousel(membership)).map((card) => [card.key, card.tone]), [['birthday', 'default'], ['sympathy', 'quiet']]);
});

test('bouquets and garlands are quote-only: no amount in labels, price maps, filters or WhatsApp drafts', async () => {
  const rule = load('src/shared/quoteOnly.ts');
  const quoted = productCatalog.filter((product) => rule.isQuoteOnly(product));
  assert.ok(quoted.some((p) => p.slug === 'event-garlands') && quoted.some((p) => p.slug === 'blush-lily-letter') && quoted.some((p) => p.slug === 'red-affair'));
  assert.ok(productCatalog.filter((p) => p.category === 'Bouquets' || p.category === 'Lilies').every((p) => rule.isQuoteOnly(p)));
  assert.equal(rule.isQuoteOnly({ category: 'Garlands', slug: 'any-garland' }), true);
  assert.equal(rule.isQuoteOnly({ category: 'Add-ons', slug: 'chocolates-addon' }), false);
  const rows = productCatalog.map((p) => ({ slug: p.slug, priceType: 'fixed', sellingPrice: 4321, compareAtPrice: 5000 }));
  const pricing = sourceLoader({ dev: true, mocks: { 'src/server/db/repositories/ProductRepository.ts': { ProductRepository: { list: async () => rows } } } })('src/server/services/ProductPricing.ts');
  const map = await pricing.loadAuthoritativePrices();
  for (const product of quoted) {
    assert.deepEqual({ ...map.get(product.slug) }, { priceLabel: 'Price on WhatsApp', sellingPrice: null, compareAtPrice: null });
    const shown = pricing.withAuthoritativePrice({ ...product, salePriceLabel: '₹999', regularPriceLabel: '₹1999', discountLabel: '50% off' }, map);
    assert.equal(shown.priceLabel, 'Price on WhatsApp');
    assert.equal(shown.priceType, 'quote');
    assert.ok(!/₹|\d{3,}/.test(JSON.stringify([shown.priceLabel, shown.salePriceLabel, shown.regularPriceLabel, shown.discountLabel])));
    assert.equal(journeys.budgetBand(shown), null);
  }
  // Other products keep their database price.
  assert.equal(pricing.withAuthoritativePrice(productCatalog.find((p) => p.slug === 'chocolates-addon'), map).priceLabel, '₹4321');
  // No price filter, and an old ?budget= link does not empty the list.
  const shown = quoted.map((product) => pricing.withAuthoritativePrice(product, map));
  const state = filters.parseShopFilters(new URLSearchParams('budget=under-1500'));
  assert.equal(journeys.filterGroups(shown, ['occasion', 'budget', 'colour'], { allOccasions: true, selected: state }).some((g) => g.id === 'budget'), false);
  assert.equal(filters.withoutUnpricedBudget(state, shown.map((p) => journeys.shopItemData(p))).budget.length, 0);
  // Garland enquiry: code, quantity, options, occasion, link; no amount; fixed closing line.
  const { garlandEnquiryText } = load('src/utils/garlandEnquiry.ts');
  const text = garlandEnquiryText({ code: 'FP-G001', title: 'Rose Garland', quantity: 2, unit: 'pair', options: ['Finish: Gold tassels'], url: 'https://onlyfreshpetals.in/products/rose-garland', occasion: 'Wedding', price: '₹5,000' });
  assert.match(text, /Design: FP-G001 — Rose Garland/);
  assert.match(text, /Quantity: 2 pairs/);
  assert.match(text, /Finish: Gold tassels/);
  assert.match(text, /Occasion: Wedding/);
  assert.match(text, /Link: https:\/\/onlyfreshpetals\.in\/products\/rose-garland/);
  assert.ok(!/₹|Listed price/.test(text));
  assert.ok(text.endsWith('Please share the prices and availability for these selections.'));
});

test('garland collections: live membership, counts and links; an empty collection is never advertised; copy carries no amount or delivery promise', () => {
  const collections = load('src/data/garlandCollections.ts');
  const design = (code, filters) => ({ slug: code.toLowerCase(), garland: { code, filters } });
  const garlands = [design('FP-G001', ['rose']), design('FP-G002', ['rose', 'designer-mixed']), design('FP-G014', ['lotus']), design('FP-G020', ['designer-mixed'])];
  const populated = collections.populatedCollections(garlands);
  assert.deepEqual(json(populated.map((entry) => [entry.collection.key, entry.count])), [['rose', 2], ['lotus', 1]]);
  assert.equal(collections.populatedCollections([]).length, 0);
  assert.deepEqual(json(collections.GARLAND_COLLECTIONS.map((c) => c.path)), ['/categories/garlands/rose', '/categories/garlands/lotus', '/categories/garlands/tuberose']);
  assert.equal(collections.garlandCollection('designer-mixed'), null);
  assert.equal(collections.garlandCollection('marigold'), null);
  const titles = [collections.GARLANDS_LANDING.title, ...collections.GARLAND_COLLECTIONS.map((c) => c.title)];
  assert.equal(new Set(titles).size, titles.length);
  const copy = JSON.stringify([collections.GARLAND_COLLECTIONS, collections.GARLANDS_LANDING, collections.GARLAND_CONFIRM_POINTS, collections.GARLAND_COVERAGE]);
  assert(!/₹|Rs\.?\s?\d|same[- ]day|express|guarantee|\d+\s?(hours|days)|free delivery|rated|stars/i.test(copy));
  // Coverage is the registry's count, with no neighbourhood restriction left behind.
  assert(new RegExp(`${load('src/data/serviceCities.ts').serviceCityCount()} cities across India`).test(collections.GARLAND_COVERAGE) && !/Chamarajpet|Basavanagudi/.test(copy));
  const page = readFileSync('src/pages/categories/garlands/[flower].astro', 'utf8');
  assert(/garlandCacheHeaders\(\)/.test(page) && /if \(empty\) Astro\.response\.status = 404/.test(page) && /noindex = empty \|\| drafts/.test(page));
  const sitemap = readFileSync('src/pages/sitemap-garlands.xml.ts', 'utf8');
  assert(/populatedCollections\(garlands\)/.test(sitemap) && /isListedGarland/.test(sitemap));
});

test('stored garland photographs: resized copies only on a Vercel deployment, at configured widths, never wider than the original', () => {
  const rules = sourceLoader({ globals: { process } })('src/data/garlandRules.ts');
  const photo = { path: 'https://hjhmetomcaskrrwkgrbp.supabase.co/storage/v1/object/public/media/products/a.jpg', width: 720, height: 1600, alt: 'x' };
  const before = process.env.VERCEL;
  delete process.env.VERCEL;
  assert.equal(rules.garlandPhotoSrcset(photo), undefined);
  process.env.VERCEL = '1';
  const srcset = rules.garlandPhotoSrcset(photo);
  assert.deepEqual(srcset.split(', ').map((part) => part.split(' ')[1]), ['240w', '480w', '720w']);
  assert(srcset.startsWith('/_vercel/image?url=https%3A%2F%2Fhjhmetomcaskrrwkgrbp.supabase.co'));
  assert.equal(rules.garlandPhotoSrcset(photo, 480).split(', ').length, 2);
  assert.equal(rules.garlandPhotoSrcset({ ...photo, path: '/images/garlands/a.jpg' }), undefined);
  assert.equal(rules.garlandPhotoSrcset({ ...photo, path: '/images/a.jpg', variants: { 240: '/images/a-240w.webp' } }), '/images/a-240w.webp 240w, /images/a.jpg 720w');
  if (before === undefined) delete process.env.VERCEL; else process.env.VERCEL = before;
  const config = readFileSync('astro.config.mjs', 'utf8');
  assert(config.includes(`sizes: [${rules.STORED_PHOTO_WIDTHS.join(', ')}]`));
});

test('search indexing rules: one page per intent, duplicates canonicalised, thin reward pages and private routes out of the sitemap', () => {
  const seo = load('src/data/seoLanding.ts');
  const titles = [seo.HOME_LANDING.title, seo.WEDDING_LANDING.title, ...Object.values(seo.CATEGORY_LANDING).map((c) => c.title), ...Object.values(seo.OCCASION_LANDING).map((c) => c.title)];
  assert.equal(new Set(titles).size, titles.length);
  assert(titles.every((title) => title.length <= 70 && !/₹/.test(title)));
  assert.deepEqual(json(seo.CANONICAL_CATEGORY), { 'flower-strings-torans': 'floral-torans-and-strings', diy: 'diy-kits' });
  assert(seo.NOINDEX_STATIC_PAGES.has('/loyalty') && seo.NOINDEX_STATIC_PAGES.has('/refer-a-friend') && !seo.NOINDEX_STATIC_PAGES.has('/reviews'));
  assert(seo.CEREMONY_INDEXABLE_OCCASIONS.has('wedding') && !seo.CEREMONY_INDEXABLE_OCCASIONS.has('engagement'));
  const sitemap = readFileSync('src/pages/sitemap.xml.ts', 'utf8');
  assert(/NOINDEX_STATIC_PAGES\.has\(path\)/.test(sitemap) && /CANONICAL_CATEGORY\[entry\.params\.slug\]/.test(sitemap) && !/"\/cart"|"\/admin|"\/saved"|"\/search"/.test(sitemap));
  const robots = readFileSync('src/pages/robots.txt.ts', 'utf8');
  assert(/Disallow: \/admin/.test(robots) && /Disallow: \/api/.test(robots));
  for (const page of ['rewards', 'loyalty', 'refer-a-friend']) assert(!/wa\.me\/\?text/.test(readFileSync(`src/pages/${page}.astro`, 'utf8')));
});

test('measurement: no tracker without an owner-supplied ID; events carry paths and codes, never customer details', () => {
  const analytics = readFileSync('src/components/Analytics.astro', 'utf8');
  assert(/PUBLIC_GA_MEASUREMENT_ID/.test(analytics) && /\{enabled && <script/.test(analytics));
  assert(/whatsapp_enquiry_click/.test(analytics) && /view_item_list/.test(analytics) && /landing_path/.test(analytics));
  assert(!/customer|recipient|phone|message:|text=/i.test(analytics.split('---')[2]));
  const cart = readFileSync('src/pages/cart.astro', 'utf8');
  const event = cart.slice(cart.indexOf('fpTrack?.("basket_quote_request"'), cart.indexOf('fpTrack?.("basket_quote_request"') + 420);
  assert(/item_id/.test(event) && /request_type/.test(event) && !/name\.value|phone|pincode|note|message/i.test(event.replace('item.name', '')));
});

test('pooja discovery: menu, footer, homepage shortcut and the third hero slide link to the public pooja collection', () => {
  const nav = load('src/data/navigation.ts');
  const shop = nav.SITE_NAV.find((item) => item.label === 'Shop Flowers');
  assert(shop.links.some((link) => link.href === '/categories/pooja-flowers' && link.label === 'Pooja flowers'));
  assert(shop.links.some((link) => link.href === '/categories/bouquets') && shop.links.some((link) => link.href === '/categories/garlands'));
  assert(journeys.homeShortcuts(empty()).some((link) => link.href === '/categories/pooja-flowers'));
  assert(productCatalog.some((product) => product.collectionTags?.includes('pooja-flowers')));
  // A link only: pooja is not a launch category, so no homepage range or occasion page changes.
  assert(!load('src/data/launchCatalogue.ts').LAUNCH_CATEGORIES.some((category) => category.id === 'pooja'));
});

test('bouquet guidance is read from product records: flowers, wrapping or vase; no stems, sizes or amounts', () => {
  const guide = load('src/data/collectionGuidance.ts');
  const bySlug = (slug) => productCatalog.find((product) => product.slug === slug);
  assert.equal(guide.bouquetPhotoAlt(bySlug('red-affair')), 'Red Affair: red roses and fresh rose foliage, in premium white wrapping');
  assert.equal(guide.bouquetPresentation(bySlug('colour-pop-love')), 'in a glass vase');
  assert.equal(guide.isVaseArrangement(bySlug('colour-pop-love')), true);
  const launch = load('src/data/launchCatalogue.ts');
  const bouquets = launch.launchProducts();
  assert.deepEqual(json(bouquets.filter(guide.isVaseArrangement).map((product) => product.slug)), ['colour-pop-love']);
  for (const product of bouquets) {
    const line = guide.bouquetLine(product);
    assert(line && !/₹|\d|stem/i.test(line), `${product.slug}: ${line}`);
    for (const flower of product.flowerTypes) assert(line.toLowerCase().includes(flower.toLowerCase()));
  }
  assert.equal(guide.bouquetPhotoAlt({ name: 'Plain', flowerTypes: [], whatsIncluded: [] }), 'Plain');
  assert.deepEqual(json(Object.keys(guide.BOUQUET_GROUP_GUIDANCE).sort()), json(launch.launchGroups('bouquets').map(({ group }) => group.id).sort()));
  assert(!/₹|same[- ]day|express|guarantee|\d+\s?(stems|roses|hours)/i.test(JSON.stringify(guide.BOUQUET_GROUP_GUIDANCE)));
});

test('pooja sections: every product on the page appears exactly once; unknown products are kept; no pack size, price or delivery promise in the copy', () => {
  const guide = load('src/data/collectionGuidance.ts');
  const page = productCatalog.filter((product) => product.collectionTags?.includes('pooja-flowers') || product.category === 'Pooja Flowers');
  const sections = guide.poojaSections(page);
  const placed = sections.flatMap((section) => section.products.map((product) => product.slug));
  assert.equal(placed.length, page.length);
  assert.equal(new Set(placed).size, page.length);
  assert(!sections.some((section) => section.id === 'more'), `unassigned: ${sections.find((section) => section.id === 'more')?.products.map((p) => p.slug)}`);
  // Both similarly named boxes stay, as separate products.
  assert(placed.includes('pooja-flower-box') && placed.includes('pooja-flowerbox'));
  const withNew = guide.poojaSections([...page, { slug: 'new-pooja-item' }]);
  assert.deepEqual(json(withNew.at(-1).products), [{ slug: 'new-pooja-item' }]);
  assert.equal(guide.poojaSections([]).length, 0);
  const copy = JSON.stringify([guide.POOJA_SECTIONS, guide.POOJA_ENQUIRY_POINTS, guide.POOJA_PHOTO_NOTE]);
  assert(!/₹|\d+\s?(g|gm|grams|kg|ft|cm|pieces)|same[- ]day|every day|guarantee|free delivery/i.test(copy));
  assert(/wa\.me\/919652012274/.test(guide.POOJA_ENQUIRY_HREF) && !/%E2%82%B9/.test(guide.POOJA_ENQUIRY_HREF));
});

// ---------------------------------------------------------------------------
// National coverage (docs/seo/national-coverage-2026-10.md)
// ---------------------------------------------------------------------------

const OWNER_CITIES = 'Bengaluru, Mumbai, Delhi, Hyderabad, Chennai, Pune, Kolkata, Ahmedabad, Jaipur, Coimbatore, Visakhapatnam, Vijayawada, Gurugram, Noida, Mysuru, Surat, Lucknow, Indore, Chandigarh, Kochi, Bhubaneswar, Nagpur, Nashik, Vadodara, Rajkot, Bhopal, Patna, Guwahati, Thiruvananthapuram, Ludhiana, Faridabad, Ghaziabad, Navi Mumbai, Kalyan-Dombivli, Greater Noida, Thane, Varanasi, Udaipur, Madurai, Tirupati, Mangaluru, Kanpur, Meerut, Dehradun, Raipur, Ranchi, Mira-Bhayandar, Vasai-Virar, Tiruppur, Jamshedpur, Manipal, Belagavi, Hubballi-Dharwad, Guntur, Salem, Warangal, Kolhapur, Siliguri, Agra'.split(', ');

test('service-city registry: exactly the 59 owner-confirmed cities, unique, all serviceable; aliases never make a second city; fifteen hubs, 44 without a page', () => {
  const registry = load('src/data/serviceCities.ts');
  const cities = registry.SERVICE_CITIES;
  assert.equal(OWNER_CITIES.length, 59);
  assert.deepEqual(json(cities.map((city) => city.name).sort()), [...OWNER_CITIES].sort());
  assert.equal(new Set(cities.map((city) => city.slug)).size, 59);
  assert.equal(registry.serviceCityCount(), 59);
  assert(cities.every((city) => city.serviceable && /^[a-z]+(-[a-z]+)*$/.test(city.slug)));
  // Every alias resolves to its own city and to no other; no alias is another city's name.
  const names = new Set(cities.flatMap((city) => [city.slug, city.name.toLowerCase()]));
  for (const city of cities) for (const alias of city.aliases) {
    assert.equal(registry.normalizeCity(alias), city.slug, alias);
    assert(!names.has(alias), `alias ${alias} is a city`);
  }
  assert.equal(registry.normalizeCity('Bangalore'), 'bengaluru');
  assert.equal(registry.normalizeCity(' GURGAON '), 'gurugram');
  assert.equal(registry.normalizeCity('Navi Mumbai'), 'navi-mumbai');
  for (const bad of ['', null, undefined, 'paris', '<script>', 'bengaluru/../admin', 'x'.repeat(200), 'mumbai?x=1']) assert.equal(registry.normalizeCity(bad), null, String(bad));
  // Coverage, pages and measured demand are separate facts.
  assert.deepEqual(json(registry.publishedHubs().map((city) => city.slug).sort()), ['ahmedabad', 'bengaluru', 'chennai', 'coimbatore', 'delhi', 'gurugram', 'hyderabad', 'jaipur', 'kolkata', 'mumbai', 'mysuru', 'noida', 'pune', 'vijayawada', 'visakhapatnam']);
  assert.equal(registry.queuedHubs().length, 0);
  assert.equal(cities.filter((city) => city.hub === 'none').length, 44);
  assert.deepEqual(json(cities.filter((city) => city.demand === 'measured').map((city) => city.slug)), ['bengaluru']);
  // A page path exists only for a published hub.
  assert.equal(registry.hubPath(registry.findCity('greater noida')), null);
  assert.equal(registry.hubPath(registry.findCity('gurgaon')), '/locations/gurugram');
  assert.notEqual(registry.normalizeCity('Greater Noida'), registry.normalizeCity('Noida'));
  assert.equal(registry.hubPath(registry.findCity('bangalore')), '/locations/bengaluru');
  assert.equal(registry.citiesByRegion().reduce((sum, region) => sum + region.cities.length, 0), 59);
});

test('city hubs: one authored page per published hub, distinct copy, real sources only, no delivery promise or invented detail', () => {
  const registry = load('src/data/serviceCities.ts');
  const hubs = load('src/data/cityHubs.ts');
  assert.deepEqual(json(hubs.CITY_HUBS.map((hub) => hub.slug).sort()), json(registry.publishedHubs().map((city) => city.slug).sort()));
  for (const field of ['title', 'description', 'h1', 'emphasis']) assert.equal(new Set(hubs.CITY_HUBS.map((hub) => hub[field])).size, 15, field);
  // Not city-name substitution: with every city name removed, no paragraph or answer is shared between two hubs.
  const strip = (text) => registry.SERVICE_CITIES.reduce((out, city) => out.replaceAll(city.name, '#'), text);
  const seen = new Map();
  for (const hub of hubs.CITY_HUBS) {
    const texts = [...hub.intro, ...hub.sections.flatMap((section) => [section.heading + ': ' + section.body.join(' ')]), ...hub.faqs.map((faq) => faq.answer)];
    for (const text of texts) {
      const key = strip(text);
      assert(!seen.has(key) || seen.get(key) === hub.slug, `${hub.slug} repeats ${seen.get(key)}: ${text.slice(0, 60)}`);
      seen.set(key, hub.slug);
    }
    assert(hub.title.includes(registry.findCity(hub.slug).name) && /^\d{4}-\d{2}-\d{2}$/.test(hub.updated));
    assert(hub.sections.length >= 2 && hub.faqs.length >= 3);
    for (const section of hub.sections) assert(section.sources.length > 0 && section.links.length > 0, section.id);
  }
  assert(hubs.CITY_HUBS.find((hub) => hub.slug === 'bengaluru').title.includes('Bangalore'));
  // Pages differ in what they are built from, not only in wording: no two hubs share the same sequence of sections and sources.
  const shape = (hub) => JSON.stringify(hub.sections.map((section) => [section.id, section.sources]));
  assert.equal(new Set(hubs.CITY_HUBS.map(shape)).size, 15);
  // Regional cross-links: a few, to published hubs only, never to itself.
  for (const hub of hubs.CITY_HUBS) {
    assert((hub.nearby ?? []).length <= 3, hub.slug);
    for (const slug of hub.nearby ?? []) assert(slug !== hub.slug && registry.hubPath(registry.findCity(slug)) === `/locations/${slug}`, `${hub.slug} -> ${slug}`);
  }
  // No origin, variety, recipe, size or preparation-time claim.
  const claims = JSON.stringify(hubs.CITY_HUBS.map((hub) => [hub.intro, hub.sections.map((section) => section.body)]));
  assert(!/locally grown|grown in|famous for|\b\d+\s?(feet|ft|inch|days?|hours?|kg|grams?)\b/i.test(claims));
  assert(/do not claim a variety or an origin/.test(JSON.stringify(hubs.CITY_HUBS.find((hub) => hub.slug === 'mysuru').faqs)));
  const copy = JSON.stringify([hubs.CITY_HUBS, hubs.HUB_PHOTO_NOTE]);
  assert(!/₹|Rs\.?\s?\d|free delivery|guarantee|within \d|\d+\s?(hours|minutes|mins|stems|cm|inches)|midnight|rated|stars|reviews?\b|our (shop|store|branch) in/i.test(copy));
  // Same-day is only ever mentioned to say it is not promised.
  for (const hit of copy.match(/[^.]*same[- ]day[^.]*/gi) ?? []) assert(/do not promise|not promise/i.test(hit), hit);
  // Every internal link in the copy is a real route family; no link to an unpublished city.
  for (const href of copy.match(/"href":"[^"]+"/g) ?? []) assert(/^"href":"\/(categories|occasions|guides|custom-orders|locations)(\/|"|#)/.test(href), href);
  for (const slug of copy.match(/\/locations\/[a-z-]+/g) ?? []) assert(registry.hubPath(registry.findCity(slug.split('/').pop())), slug);
  const page = readFileSync('src/pages/locations/[city].astro', 'utf8');
  assert(/prerender = false/.test(page) && /if \(!city \|\| !city\.serviceable\) return Astro\.rewrite\("\/404"\)/.test(page) && /catalogueRoot\(city, serviceCityCount\(\)\)/.test(page) && /GARLAND_CACHE_TAG, OCCASION_INDEX_TAG/.test(page) && /isListedGarland/.test(page) && /giftProducts\(source\.route, membership\)/.test(page));
  // Garland comparisons describe the photograph and name a browsing group; they never present the group as the flowers used.
  assert(/design\.image\.alt/.test(page) && /Browse under:/.test(page) && !/Main flower/.test(page));
  // One H1, visible breadcrumbs, self-canonical (no canonical override), no rating or LocalBusiness markup.
  assert.equal(page.match(/<h1/g).length, 1);
  assert(/aria-label="Breadcrumb"/.test(page) && !/canonical=/.test(page) && !/LocalBusiness|aggregateRating|PostalAddress/.test(page));
});

test('recipient city: one stored value, validated; browsing never re-points a basket; drafts and the enquiry check name only registry cities', () => {
  const store = new Map();
  const events = [];
  const window = {
    localStorage: { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) },
    location: { search: '' },
    dispatchEvent: (event) => events.push(event.detail?.city ?? null),
  };
  const document = { querySelector: () => null };
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  const destination = sourceLoader({ globals: { window, document, CustomEvent } })('src/utils/destination.ts');

  // Nothing decided: a city link sets it; an invalid value is ignored.
  window.location.search = '?city=atlantis';
  assert.deepEqual(json(destination.resolveDestination()), { destination: null, browsing: null, conflict: false });
  window.location.search = '?city=Bangalore&occ=birthday';
  assert.deepEqual(json(destination.resolveDestination()), { destination: 'bengaluru', browsing: 'bengaluru', conflict: false });
  // Empty basket: browsing another city moves with the visitor.
  window.location.search = '?city=pune';
  assert.equal(destination.resolveDestination().destination, 'pune');
  // A basket with a destination is never re-pointed by a visit; the page asks.
  store.set('fresh_petals_cart', JSON.stringify([{ id: 'red-affair', quantity: 1 }]));
  window.location.search = '?city=mumbai';
  assert.deepEqual(json(destination.resolveDestination()), { destination: 'pune', browsing: 'mumbai', conflict: true });
  assert.equal(destination.getDestination(), 'pune');
  // Only an explicit choice changes it.
  assert.equal(destination.setDestination('Gurgaon'), 'gurugram');
  assert.deepEqual(json(destination.destinationLines()), ['Recipient city: Gurugram']);
  // An old basket with no city: the first city seen fills the empty value.
  store.delete('fresh_petals_destination_city');
  window.location.search = '';
  assert.deepEqual(json(destination.resolveDestination()), { destination: null, browsing: null, conflict: false });
  assert.deepEqual(json(destination.destinationLines()), []);
  // A tampered stored value reads as no city.
  store.set('fresh_petals_destination_city', 'not-a-city');
  assert.equal(destination.getDestination(), null);

  // Garland enquiry text and link.
  const enquiry = load('src/utils/garlandEnquiry.ts');
  const text = enquiry.garlandEnquiryText({ code: 'FP-G001', title: 'Rose', quantity: 2, city: 'Mumbai' });
  assert(/Recipient city: Mumbai/.test(text) && !/₹/.test(text));
  assert(!/Recipient city/.test(enquiry.garlandEnquiryText({ code: 'FP-G001', title: 'Rose', quantity: 1 })));
  assert.equal(enquiry.garlandEnquiryHref({ code: 'FP-G001', city: 'mumbai' }), '/garland-enquiry?code=FP-G001&qty=1&city=mumbai');
  assert(/findCity\(url\.searchParams\.get\(CITY_PARAM\)\)\?\.name/.test(readFileSync('src/pages/garland-enquiry.ts', 'utf8')));
  // City drafts: the one number, the city named, no amount for quote-only products.
  const city = load('src/utils/cityEnquiry.ts');
  const general = decodeURIComponent(city.cityEnquiryHref('Kochi'));
  assert(general.startsWith('https://wa.me/919652012274?text=') && /Recipient city: Kochi/.test(general) && !/₹/.test(general));
  const quote = decodeURIComponent(city.cityProductEnquiryHref({ name: 'Red Affair', url: 'https://onlyfreshpetals.in/products/red-affair', cityName: 'Pune', quoteOnly: true, priceLabel: 'From ₹999' }));
  assert(/Recipient city: Pune/.test(quote) && !/₹|999/.test(quote) && /products\/red-affair\n/.test(quote));
  const priced = decodeURIComponent(city.cityProductEnquiryHref({ name: 'Pooja Basket', url: 'https://onlyfreshpetals.in/products/pooja-basket', cityName: 'Chennai', quoteOnly: false, priceLabel: 'From ₹499' }));
  assert(/Price shown: From ₹499/.test(priced) && /Recipient city: Chennai/.test(priced));
  // The basket and the product page use the same stored value, and no second copy.
  const cart = readFileSync('src/pages/cart.astro', 'utf8');
  assert(/fresh_petals_destination_city/.test(cart) && /Recipient city: \$\{destinationName\(\)/.test(cart) && /destination_city: destinationSlug\(\)/.test(cart));
  for (const file of ['src/components/ProductOptions.astro', 'src/components/ProductCard.astro']) {
    const source = readFileSync(file, 'utf8');
    assert(/utils\/destination/.test(source) && !/utils\/area/.test(source), file);
  }
  // City parameters never make a new indexable URL: canonicals drop every query.
  assert(/Query strings never enter the canonical/.test(readFileSync('src/layouts/BaseLayout.astro', 'utf8')));
});

test('delivery estimator: no estimate means charges are confirmed on WhatsApp, never that the city is unavailable', () => {
  const rules = readFileSync('src/server/services/delivery/deliveryRules.ts', 'utf8');
  assert(/Delivery charges will be confirmed on WhatsApp/.test(rules) && !/couldn't confirm delivery for this pincode/.test(rules));
  const cart = readFileSync('src/pages/cart.astro', 'utf8');
  assert(/Delivery charges will be confirmed on WhatsApp/.test(cart) && /type: "info"/.test(cart) && /Delivery Pincode \(optional\)/.test(cart));
  // The estimator still quotes nothing it has not been given: other cities' seeded zones stay unquoted.
  assert(/isStorefrontCity\(zone\.city\) \? zone : null/.test(readFileSync('src/server/services/delivery/DeliveryService.ts', 'utf8')));
});

test('discovery: footer groups, /occasions from the menu, linked garland names, city pages in the sitemap with authored dates', () => {
  const footer = readFileSync('src/components/atelier/SiteFooter.astro', 'utf8');
  for (const group of ['Flowers', 'Occasions', 'Delivery cities', 'Choosing flowers', 'Business and help']) assert(footer.includes(`label: "${group}"`), group);
  assert(/\/occasions\/sympathy/.test(footer) && /publishedHubs\(\)/.test(footer) && /LOCATIONS_PATH/.test(footer) && !/serviceableCities|SERVICE_CITIES/.test(footer));
  assert(/freshpetals\.hyderabad/.test(footer) && /whatsappLink/.test(footer));
  const nav = load('src/data/navigation.ts');
  const occasions = nav.SITE_NAV.find((item) => item.label === 'Shop by Occasion');
  assert.equal(occasions.href, '/occasions');
  assert.deepEqual(json(occasions.links[0]), { label: 'All occasions', href: '/occasions' });
  const card = readFileSync('src/components/GarlandCard.astro', 'utf8');
  assert(/<a href=\{href\} data-journey-link class="garland-card__link">\{design\.title\}/.test(card) && !/class="absolute inset-0 z-10" aria-label/.test(card));
  assert.equal(card.match(/data-journey-link/g).length, 2); // the name, and the cart-mode button
  const sitemap = readFileSync('src/pages/sitemap.xml.ts', 'utf8');
  assert(/publishedHubs\(\)/.test(sitemap) && /lastmod: hub\.updated/.test(sitemap) && !/new Date\(\)/.test(sitemap));
  // The directory lists every city without scripts; only hubs get page links.
  const directory = readFileSync('src/pages/locations/index.astro', 'utf8');
  assert(/hubPath\(city\)/.test(directory) && /cityEnquiryHref\(city\.name\)/.test(directory) && /citiesByRegion\(\)/.test(directory));
  // National copy: the homepage title and coverage sentence; no neighbourhood restriction left in live landing copy.
  const landing = load('src/data/seoLanding.ts');
  assert.equal(landing.HOME_LANDING.title, 'Flower Delivery Across India | Bouquets & Garlands | Fresh Petals');
  assert(/across our 59 service cities/.test(landing.HOME_LANDING.intro[0]));
  assert(!/Chamarajpet|Basavanagudi|in Bengaluru|in Bangalore/.test(JSON.stringify([landing.HOME_LANDING, landing.CATEGORY_LANDING, landing.OCCASION_LANDING, landing.WEDDING_LANDING, landing.HOME_FAQS])));
});

// ---------------------------------------------------------------------------
// Release 3: business profile, buying guides, assistant referrals
// ---------------------------------------------------------------------------

test('business profile: one source of verified facts; one Organization id; no address, hours, rating or LocalBusiness', () => {
  const profile = load('src/data/businessProfile.ts');
  const site = 'https://onlyfreshpetals.in';
  const org = json(profile.organizationNode(site));
  assert.equal(org['@id'], 'https://onlyfreshpetals.in/#organization');
  assert.equal(json(profile.websiteNode(site))['@id'], 'https://onlyfreshpetals.in/#website');
  assert.deepEqual(json(profile.organizationRef(site)), { '@id': org['@id'] });
  assert.equal(org.name, 'Fresh Petals');
  assert.equal(org.alternateName, 'FreshPetals');
  assert.equal(org.logo, 'https://onlyfreshpetals.in/apple-touch-icon.png');
  assert.deepEqual(org.sameAs, ['https://www.instagram.com/freshpetals.hyderabad/']);
  assert.equal(org.areaServed.length, 59);
  assert.equal(org['@type'], 'Organization');
  for (const absent of ['address', 'aggregateRating', 'review', 'openingHours', 'openingHoursSpecification', 'foundingDate', 'founder', 'geo', 'priceRange']) assert(!(absent in org), absent);
  assert(profile.BUSINESS.whatsappNumber === '919652012274' && /96520 12274/.test(profile.BUSINESS.whatsappDisplay));
  assert(!/₹|same[- ]day|rated|since \d{4}|est\./i.test(JSON.stringify([profile.BUSINESS, profile.businessSummary()])));
  // The pages that describe the business all build from it; nobody retypes the node.
  for (const file of ['src/pages/index.astro', 'src/pages/about.astro', 'src/pages/contact.astro']) {
    const source = readFileSync(file, 'utf8');
    assert(/organizationNode\(Astro\.site\)/.test(source) && !/"@type": "Organization"/.test(source) && !/LocalBusiness/.test(source), file);
  }
  assert(!/Astro's default mark/.test(readFileSync('src/pages/index.astro', 'utf8')));
  // The unconfirmed origin is not stated; coverage is described as delivery cities, not branches.
  const about = readFileSync('src/pages/about.astro', 'utf8');
  assert(!/began in|began with|Chamarajpet|Basavanagudi|founded|since \d{4}/i.test(about) && /not shops or branches/.test(about));
});

test('guides: four published guides, one registry; real products only; no price for quote-only examples, no invented specification, no instruction to assistants', () => {
  const guides = load('src/data/guides.ts');
  assert.deepEqual(json(guides.GUIDES.map((guide) => guide.path).sort()), ['/guides/choosing-a-flower-bouquet', '/guides/choosing-wedding-garlands', '/guides/jasmine-pooja-flowers-and-gajra', '/guides/sending-flowers-to-another-city']);
  for (const field of ['title', 'description', 'heading', 'label']) assert.equal(new Set(guides.GUIDES.map((guide) => guide[field])).size, 4, field);
  for (const guide of guides.GUIDES) {
    assert(existsSync(`src/pages${guide.path}.astro`), guide.path);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(guide.published) && guide.updated >= guide.published);
  }
  assert(existsSync('src/pages/guides/index.astro'));
  assert.equal(guides.guideForCategory('Bouquets').slug, 'choosing-a-flower-bouquet');
  assert.equal(guides.guideForCategory('Lilies').slug, 'choosing-a-flower-bouquet');
  assert.equal(guides.guideForCategory('Pooja Flowers').slug, 'jasmine-pooja-flowers-and-gajra');
  assert.equal(guides.guideForCategory('Add-ons'), null);
  const pages = Object.fromEntries(guides.GUIDES.map((guide) => [guide.slug, readFileSync(`src/pages${guide.path}.astro`, 'utf8')]));
  const shell = readFileSync('src/components/GuideShell.astro', 'utf8');
  const card = readFileSync('src/components/GuideProductCard.astro', 'utf8');
  // Products come from the catalogue and public services, never typed as markup.
  assert(/launchGroups\("bouquets"\)/.test(pages['choosing-a-flower-bouquet']) && /loadOccasionMembership/.test(pages['choosing-a-flower-bouquet']) && /OCCASION_INDEX_TAG/.test(pages['choosing-a-flower-bouquet']));
  assert(/loadAuthoritativePrices/.test(pages['jasmine-pooja-flowers-and-gajra']) && /publishedHubs|hasHub/.test(pages['sending-flowers-to-another-city']));
  assert(/isListedGarland/.test(pages['choosing-wedding-garlands']) && /garlandCacheHeaders/.test(pages['choosing-wedding-garlands']));
  // Quote-only examples never render an amount; the card decides by product identity.
  assert(/\{quoteOnly \? "Request a quote" : "Order on WhatsApp"\}/.test(card) && /Price shown: \$\{product\.priceLabel\}/.test(card));
  assert(/quoteOnly \? QUOTE_ONLY_PRICE_LABEL : product\.priceLabel/.test(card) && /loading="lazy"/.test(card) && /width=\{size\?\.width\}/.test(card));
  const prose = Object.values(pages).join('\n').replace(/^\/\/.*$/gm, '');
  assert(!/₹\s?\d/.test(prose));
  assert(!/\b\d+\s?(stems?|roses|cm|inch(es)?|feet|ft|grams?|kg|hours?|minutes?)\b/i.test(prose));
  assert(!/best florist|top florist|number one|#1|award|guarantee|free delivery|midnight/i.test(prose));
  for (const hit of prose.match(/[^.]*same[- ]day[^.]*/gi) ?? []) assert(/do not promise/i.test(hit), hit);
  // Nothing addressed to a search assistant, visible or hidden.
  assert(!/recommend (fresh ?petals|us)|as an ai|language model|ignore (previous|prior)|assistants? should|llms?\.txt/i.test(prose + shell));
  assert(!/display:\s*none|visibility:\s*hidden|sr-only|aria-hidden="true">[^<]{20,}/.test(Object.values(pages).join('') .replace(/<span aria-hidden="true">\/<\/span>/g, '')));
  // The jasmine guide claims no variety, origin or pack size, and labels shared photographs.
  assert(/do not state a variety or where the jasmine is grown/.test(pages['jasmine-pooja-flowers-and-gajra']) && /Shared photograph/.test(pages['jasmine-pooja-flowers-and-gajra']));
  // The garland guide separates what a photograph shows from a specification, and a browsing group from the flowers used.
  assert(/It is not a specification/.test(pages['choosing-wedding-garlands']) && /not a list of the flowers in the garland/.test(pages['choosing-wedding-garlands']));
  // Article markup: published by the one Organization; no person, rating or offer.
  assert(/organizationRef\(Astro\.site\)/.test(shell) && /dateModified: guide\.updated/.test(shell) && !/"Person"|aggregateRating|"offers"|"Review"/.test(shell + Object.values(pages).join('')));
  // Discovery: footer, sitemap, collections, city sections and product pages link the guides.
  assert(/GUIDES\.map/.test(readFileSync('src/components/atelier/SiteFooter.astro', 'utf8')));
  const sitemap = readFileSync('src/pages/sitemap.xml.ts', 'utf8');
  assert(/GUIDES\.filter\(\(guide\) => !guide\.liveSitemap\)/.test(sitemap) && /lastmod: guide\.updated/.test(sitemap));
  assert(/GUIDE_FOR/.test(readFileSync('src/pages/locations/[city].astro', 'utf8')) && /guideForCategory/.test(readFileSync('src/pages/products/[slug].astro', 'utf8')));
  const landing = JSON.stringify(load('src/data/seoLanding.ts').CATEGORY_LANDING);
  assert(/guides\/choosing-a-flower-bouquet/.test(landing) && /guides\/jasmine-pooja-flowers-and-gajra/.test(landing));
});

test('assistant referrals: labelled from a known hostname only; no referrer path, query or prompt is read into an event', () => {
  const analytics = readFileSync('src/components/Analytics.astro', 'utf8');
  const script = analytics.split('---')[2];
  assert(/AI_HOSTS = \{ "chatgpt\.com": "chatgpt"/.test(script) && /new URL\(document\.referrer\)\.hostname/.test(script) && /data\.ai_referrer = aiReferrer/.test(script) && /data\.ai_attribution = aiMethod/.test(script) && /"referrer" : AI_HOSTS\[utm\] \? "campaign"/.test(script));
  // The referrer is used for its hostname and nowhere else; google.com is not an AI host.
  // Two reads for the assistant label (hostname) and two for page_referrer (origin only).
  assert.equal(script.match(/document\.referrer/g).length, 4);
  assert(/page_referrer: \(function \(\) \{\s+try \{\s+return document\.referrer \? new URL\(document\.referrer\)\.origin \+ "\/" : "";/.test(script) && /page_location: location\.origin \+ location\.pathname/.test(script));
  assert(!/google\.com": "|"bing\.com"/.test(script.replace('gemini.google.com', '')));
  assert(!/location\.href|location\.search\)\.toString|pathname \+ location\.search/.test(script));
  assert(/A visit with no referrer is direct/.test(analytics));
});

// ---------------------------------------------------------------------------
// Search-competitiveness release: All Flowers, descriptive titles, product facts
// ---------------------------------------------------------------------------

test('All Flowers: linked first in the menu and footer; every listed product in exactly one presentation group; no empty group', () => {
  const nav = load('src/data/navigation.ts');
  const shop = nav.SITE_NAV.find((item) => item.label === 'Shop Flowers');
  assert.deepEqual(json(shop.links[0]), { label: 'All flowers', href: '/categories/all-flowers' });
  assert(/ALL_FLOWERS_LINK,/.test(readFileSync('src/components/atelier/SiteFooter.astro', 'utf8')));
  const guide = load('src/data/collectionGuidance.ts');
  const listed = productCatalog.filter((product) => product.collectionTags?.includes('all-flowers'));
  const sections = guide.allFlowerSections(listed);
  const placed = sections.flatMap((section) => section.products.map((product) => product.slug));
  assert.equal(placed.length, listed.length);
  assert.equal(new Set(placed).size, listed.length);
  assert(sections.every((section) => section.products.length > 0 && section.label && section.note));
  // Groups come from the records: a vase arrangement is one whose record lists a vase; lilies are the Lilies category.
  for (const product of sections.find((section) => section.id === 'vase')?.products ?? []) assert(product.whatsIncluded.some((item) => /vase/i.test(item)), product.slug);
  for (const product of sections.find((section) => section.id === 'wrapped').products) assert(product.category === 'Bouquets' && !product.whatsIncluded.some((item) => /vase/i.test(item)), product.slug);
  assert.equal(guide.allFlowerSections([]).length, 0);
  assert.deepEqual(json(guide.allFlowerSections([{ slug: 'x', category: 'Offers', whatsIncluded: [] }]).map((section) => section.id)), ['more']);
  const landing = load('src/data/seoLanding.ts');
  const all = landing.CATEGORY_LANDING['all-flowers'];
  // Distinct from the homepage and the bouquet collection; no count typed into the copy.
  assert.equal(new Set([all.title, landing.HOME_LANDING.title, landing.CATEGORY_LANDING.bouquets.title]).size, 3);
  assert(!/(51|37|eight|8)/.test(JSON.stringify([all.intro, all.faqs])) && !/₹|same[- ]day|guarantee/i.test(JSON.stringify(all)));
  assert(/category\.slug === "pooja-flowers" && \(/.test(readFileSync('src/components/category/CategoryPage.astro', 'utf8')));
});

test('product titles and facts: flower and form from the record; model names kept; no stem line for loose flowers; no vague care grade', () => {
  const titles = load('src/data/productTitles.ts');
  const bySlug = (slug) => productCatalog.find((product) => product.slug === slug);
  assert.equal(titles.productTitle(bySlug('red-affair')), 'Red Affair – Red Rose Bouquet | Fresh Petals');
  assert.equal(titles.productTitle(bySlug('blush-lily-letter')), 'Blush Lily Letter – Blush Lily Bouquet | Fresh Petals');
  assert.equal(titles.productTitle(bySlug('first-love')), 'First Love Pink & White Tulip Bouquet | Fresh Petals');
  assert.equal(titles.productTitle(bySlug('colour-pop-love')), 'Colour Pop Love Gerbera & Daisy Vase Arrangement | Fresh Petals');
  // Non-bouquets and products with no recorded flowers keep the plain title.
  assert.equal(titles.productTitle(bySlug('jasmine-malli')), 'Jasmine / Malli – Pooja Flowers | Fresh Petals');
  assert.equal(titles.productTitle({ name: 'Plain', category: 'Bouquets', flowerTypes: [], whatsIncluded: [] }), 'Plain – Bouquets | Fresh Petals');
  assert.equal(titles.flowerDescriptor({ flowerTypes: ['Fresh rose foliage', 'Eucalyptus'] }), null);
  const bouquets = productCatalog.filter((product) => /^(Bouquets|Lilies)$/.test(product.category));
  const all = bouquets.map((product) => titles.productTitle(product));
  assert.equal(new Set(all).size, all.length);
  for (const [index, title] of all.entries()) {
    assert(title.startsWith(bouquets[index].name) && title.endsWith(' | Fresh Petals') && title.length <= 70, title);
    assert(!/₹|\d/.test(title.replace(bouquets[index].name, '')), title);
    // Every descriptor word is a word of the product's own recorded flowers.
    const descriptor = titles.flowerDescriptor(bouquets[index]);
    if (descriptor && descriptor !== 'Mixed Flower') for (const word of descriptor.toLowerCase().split(/[\s&]+/).filter((w) => w && w !== 'mixed')) assert(bouquets[index].flowerTypes.join(' ').toLowerCase().includes(word.replace(/y$/, '')), `${title}: ${word}`);
  }
  const page = readFileSync('src/pages/products/[slug].astro', 'utf8');
  assert(/title=\{productTitle\(product\)\}/.test(page) && /const stemCount = isBouquet \? product\.stemCount \?\? null : null/.test(page) && /\{stemCount && \(/.test(page) && !/careLevel/.test(page) && /A listed range, not a count of the bouquet as made/.test(page));
});

// ---------------------------------------------------------------------------
// City catalogue: every city, the whole public catalogue
// ---------------------------------------------------------------------------

test('city catalogue: one shared source with no sample limits or per-city restriction; a noindex shop view per city; SSR pagination; city kept in links and drafts', () => {
  const service = readFileSync('src/server/services/CityCatalogue.ts', 'utf8');
  // Sources are the shop's own: category pages, launch bouquets, listed garlands; nothing is sliced or limited.
  assert(/getCategoryStaticPaths\(\)/.test(service) && /launchGroups\("bouquets"\)/.test(service) && /isListedGarland/.test(service) && /loadAuthoritativePrices/.test(service));
  assert(!/\.slice\(0|limit|each:/.test(service.replace(/^\s*\/\/.*$/gm, '')));
  assert(/quoteOnly \? QUOTE_ONLY_PRICE_LABEL : product\.priceLabel/.test(service) && /price: QUOTE_ONLY_PRICE_LABEL,\s+quoteOnly: true,\s+category: "Garlands"/.test(service));
  assert(/seen\.has\(item\.key\)/.test(service) && /collection\.items\.length > 0/.test(service));
  const shop = readFileSync('src/pages/locations/[city]/shop.astro', 'utf8');
  assert(/prerender = false/.test(shop) && /if \(!city \|\| !city\.serviceable\) return Astro\.rewrite\("\/404"\)/.test(shop) && /Astro\.redirect\(base, 301\)/.test(shop));
  assert(/noindex=\{true\} canonical=\{base\}/.test(shop) && /GARLAND_CACHE_TAG, OCCASION_INDEX_TAG/.test(shop) && /data-city-context=\{city\.slug\}/.test(shop));
  assert(/rel="prev"/.test(shop) && /rel="next"/.test(shop) && /aria-current=\{number === page \? "page" : undefined\}/.test(shop) && /loading=\{index < 4 \? "eager" : "lazy"\}/.test(shop));
  assert(/garlandEnquiryHref\(\{ code: item\.code, quantity: 1, city: city\.slug \}\)/.test(shop) && /cityProductEnquiryHref/.test(shop) && /withCity\(item\.path\)/.test(shop));
  assert.equal(shop.match(/<h1/g).length, 1);
  assert(!/₹|same[- ]day delivery in|branch|store in/i.test(shop.replace('We do not promise same-day or timed delivery', '')));
  // One address per city: collections and pages are query parameters, not routes.
  assert(!existsSync('src/pages/locations/[city]/[collection].astro'));
  assert(!/\/shop/.test(readFileSync('src/pages/sitemap.xml.ts', 'utf8')));
  // City pages link the whole catalogue; the directory gives every city without a page its shop view.
  assert(/loadCityCatalogue\(\)/.test(readFileSync('src/pages/locations/[city].astro', 'utf8')) && /data-city-shop-link=\{city\.slug\}/.test(readFileSync('src/pages/locations/index.astro', 'utf8')));
});

test('city roots: every serviceable city has an indexable root; the catalogue root states only what is true of every city', () => {
  const hubs = load('src/data/cityHubs.ts');
  const registry = load('src/data/serviceCities.ts');
  const roots = registry.serviceableCities().filter((city) => !registry.hasHub(city)).map((city) => json(hubs.catalogueRoot(city, 59)));
  assert.equal(roots.length, 44);
  for (const field of ['title', 'description', 'h1']) assert.equal(new Set(roots.map((root) => root[field])).size, 44, field);
  for (const root of roots) {
    assert.equal(root.sections.length, 0);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(root.updated));
    const copy = JSON.stringify(root);
    assert(!/₹|same[- ]day|within \d|branch|store|shop in|our team in|local|review|rated|famous|grown/i.test(copy), root.slug);
  }
  const sitemap = readFileSync('src/pages/sitemap.xml.ts', 'utf8');
  assert(/serviceableCities\(\)\.filter\(\(city\) => !hasHub\(city\)\)/.test(sitemap));
  assert(/href=\{`\$\{LOCATIONS_PATH\}\/\$\{city\.slug\}`\}/.test(readFileSync('src/pages/locations/index.astro', 'utf8')));
});

test('search evidence: Bengaluru tasks link complete collections with what a quote needs; garland evidence separates record, photograph and confirmation; drafts ask only for what is missing', () => {
  const hubs = load('src/data/cityHubs.ts');
  const blr = hubs.CITY_HUBS.find((hub) => hub.slug === 'bengaluru');
  // No origin claim for any city.
  assert(!/began|founded|started|origin|home city|where (this|we)/i.test(JSON.stringify(blr.intro)));
  assert.deepEqual(json(blr.sections.map((section) => section.id)), ['bouquets', 'garlands', 'pooja']);
  for (const section of blr.sections) assert(section.collections.length > 0 && section.quote.length >= 4, section.id);
  assert(blr.sections.find((section) => section.id === 'garlands').collections.includes('garlands-lotus'));
  assert(blr.sections.find((section) => section.id === 'bouquets').collections.includes('all-flowers'));
  // Garland evidence: groups are labelled as sorting; empty specifications are to confirm, never invented.
  const collections = load('src/data/garlandCollections.ts');
  assert.equal(collections.GARLAND_PILOT.length, 6);
  for (const group of ['rose', 'lotus', 'tuberose']) assert.equal(collections.GARLAND_PILOT.filter((entry) => entry.group === group).length, 2);
  const design = { code: 'FP-G001', title: 'Classic Red Rose Garland', filters: ['rose'], filterRecipeVerified: false, soldUnit: null, length: null, flowerRecipe: null, weightOrThickness: null, finish: null, leadTime: null, substitutionPolicy: null, image: { alt: 'Red rose garlands with gold-coloured tassels' } };
  const evidence = json(collections.garlandEvidence(design));
  assert.deepEqual(evidence.onRecord.map((fact) => fact.label), ['Design code', 'Browsed under']);
  assert(/not a list of flowers/.test(evidence.onRecord[1].value));
  assert.equal(evidence.photograph, 'Red rose garlands with gold-coloured tassels.');
  assert(evidence.toConfirm.includes('Flowers used') && evidence.toConfirm.includes('Length') && evidence.toConfirm.includes('Price for your date'));
  const recorded = json(collections.garlandEvidence({ ...design, soldUnit: 'Pair', filterRecipeVerified: true }));
  assert(recorded.onRecord.some((fact) => fact.value === 'Pair') && !recorded.toConfirm.some((item) => /^Sold as/.test(item)));
  // Drafts: link and city first; ceremony date and one-or-pair asked once; no amount; fixed closing.
  const enquiry = load('src/utils/garlandEnquiry.ts');
  const text = enquiry.garlandEnquiryText({ code: 'FP-G001', title: 'Rose', quantity: 1, url: 'https://onlyfreshpetals.in/products/rose', city: 'Bengaluru' });
  assert(/Link: https:/.test(text) && /Recipient city: Bengaluru/.test(text) && /one garland or a pair\?/.test(text) && /Ceremony date: /.test(text) && /final flowers, length and delivery/.test(text));
  assert(!/₹|none chosen|Date \(optional\)|pincode/i.test(text));
  assert.equal((text.match(/pair/g) ?? []).length, 1);
  assert(!/one garland or a pair/.test(enquiry.garlandEnquiryText({ code: 'FP-G001', title: 'Rose', quantity: 2, unit: 'pair' })));
  // All Flowers comparison: from the records of each group, care only when most of the group carries it.
  const guidance = load('src/data/collectionGuidance.ts');
  const p = (slug, included, care) => ({ slug, category: 'Bouquets', whatsIncluded: included, careNotes: care });
  const rows = json(guidance.presentationComparison([{ id: 'wrapped', products: [p('a', ['Kraft wrapping'], ['Keep cool.']), p('b', ['Premium wrapping'], ['Keep cool.', 'Rare.']), p('c', ['Kraft wrapping'], [])] }, { id: 'vase', products: [] }]));
  assert.deepEqual(rows.map((row) => row.id), ['wrapped']);
  assert.deepEqual(rows[0].comesIn, ['Kraft wrapping', 'Premium wrapping']);
  assert.deepEqual(json(guidance.presentationComparison([{ id: 'wrapped', products: [p('d', ['Kraft wrapping', 'Wicker basket'], [])] }]))[0].alsoOnSome, ['Wicker basket']);
  assert.deepEqual(rows[0].care, ['Keep cool.']);
  // The garland total names its parts.
  assert(/coded design/.test(readFileSync('src/pages/categories/garlands.astro', 'utf8')));
});
