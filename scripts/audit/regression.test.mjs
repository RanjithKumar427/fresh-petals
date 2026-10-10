import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceLoader } from './source-loader.mjs';

const load = sourceLoader();
const journeys = load('src/data/occasionJourneys.ts');
const filters = load('src/utils/shopFilters.ts');
const context = load('src/utils/journey.ts');
const { productCatalog } = load('src/data/productCatalog.ts');
const { OCCASION_PAGES } = load('src/data/occasionPages.ts');
const empty = () => new Map(productCatalog.map((p) => [p.slug, []]));
const json = (value) => JSON.parse(JSON.stringify(value));

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
  assert.equal((await pricing.loadAuthoritativePrices()).get('red-affair').priceLabel, 'From ₹1234');
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
test('occasion carousel ring: one card per place, wraps both ways, cards enter from the side of travel', () => {
  const ring = load('src/utils/occasionCarousel.ts');
  assert.deepEqual([1, 2, 3, 4, 5, 9].map((count) => ring.visibleRadius(count, true)), [0, 0, 1, 1, 2, 2]);
  assert.deepEqual([3, 4, 5, 9].map((count) => ring.visibleRadius(count, false)), [1, 1, 1, 1]);
  for (const count of [3, 4, 5, 6, 7, 13]) for (const wide of [false, true]) for (const direction of [1, -1]) {
    const radius = ring.visibleRadius(count, wide);
    const [enterSide, exitSide] = direction > 0 ? ['off-right', 'off-left'] : ['off-left', 'off-right'];
    let active = 0;
    for (let n = 0; n < count * 2; n++) {
      const rest = json(ring.restingSlots(count, active, radius));
      const onStage = rest.filter((slot) => !slot.startsWith('off'));
      assert.equal(rest[active], '0');
      assert.equal(onStage.length, radius * 2 + 1);
      assert.equal(new Set(onStage).size, onStage.length);
      const next = ring.wrapIndex(active + direction, count);
      const after = json(ring.restingSlots(count, next, radius));
      const plan = json(ring.planStep(count, active, direction, radius));
      plan.forEach((move, index) => {
        assert.equal(move.to, after[index]);
        if (move.kind === 'glide') assert.equal(Math.abs(Number(move.to) - Number(rest[index])), 1);
        if (move.kind === 'enter' || move.kind === 'wrap') assert.equal(move.from, enterSide);
        if (move.kind === 'exit' || move.kind === 'wrap') assert.equal(move.via, exitSide);
        if (move.kind === 'park' || move.kind === 'enter') assert.ok(rest[index].startsWith('off'));
      });
      const kinds = (kind) => plan.filter((move) => move.kind === kind).length;
      // Every card on stage: the end card crosses while hidden. Otherwise one leaves and a waiting one comes in.
      assert.deepEqual([kinds('wrap'), kinds('exit'), kinds('enter')], count === radius * 2 + 1 ? [1, 0, 0] : [0, 1, 1]);
      active = next;
    }
    assert.equal(active, 0);
  }
  assert.deepEqual(json(ring.enqueueStep([], 1)), [1]);
  assert.deepEqual(json(ring.enqueueStep([1, 1], 1)), [1, 1]);
  assert.deepEqual(json(ring.enqueueStep([1], -1)), []);
});
test('occasion carousel cards: public launch bouquets only, owner order, existing routes, counts match the destination', () => {
  const home = sourceLoader({ mocks: { 'src/server/services/ProductPricing.ts': { withAuthoritativePrice: (product) => product } } })('src/data/atelierHome.ts');
  assert.equal(home.getOccasionDeck(empty()).length, 0);
  const launch = journeys.launchSlugs();
  const membership = empty();
  membership.set(launch[0], ['birthday', 'wedding', 'engagement', 'sympathy']);
  membership.set(launch[1], ['birthday', 'pooja']);
  // Outside the launch range: never counted on a launch occasion, never given a card of its own.
  membership.set(productCatalog.find((product) => !launch.includes(product.slug)).slug, ['birthday', 'anniversary']);
  const deck = json(home.getOccasionDeck(membership));
  assert.deepEqual(deck.map((card) => [card.key, card.title, card.href, card.countLabel]), [
    ['birthday', 'Birthday', '/occasions/birthday', '2 designs'],
    ['wedding', 'Wedding', '/occasions/wedding', '1 design'],
    ['engagement', 'Engagement', '/occasions/engagement', '1 design'],
    ['housewarming', 'Housewarming & Pooja', '/occasions/housewarming', '1 design'],
    ['sympathy', 'Condolence', '/categories/bouquets?occasion=sympathy', '1 design'],
  ]);
  for (const card of deck) assert.equal(card.count, journeys.giftProducts(card.key, membership).length);
  // Wedding and Engagement have the same owner photograph; side by side they must not show it twice.
  assert.notEqual(deck[1].image.src, deck[2].image.src);
  assert.deepEqual(deck.map((card) => card.cue), ['Explore designs', 'Explore designs', 'Explore designs', 'Explore designs', 'View designs']);
});
