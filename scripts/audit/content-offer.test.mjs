// Offer clarity (16 Nov 2026): collection membership agrees with each
// product's recorded colours and form, product identity is stated in plain
// words, what is supplied is separated from what is only on request, and no
// collection introduction is a generic "Explore …" line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceLoader } from './source-loader.mjs';

const load = sourceLoader();
const { productCatalog } = load('src/data/productCatalog.ts');
const pages = load('src/data/categoryPages.ts');
const supply = load('src/data/productSupply.ts');
const titles = load('src/data/productTitles.ts');
const bySlug = (slug) => productCatalog.find((product) => product.slug === slug);
const members = (slug) => pages.categoryProducts(slug, productCatalog).primary.map((product) => product.slug);

test('colour and form collections list only products whose record supports them', () => {
  const red = members('red-flowers');
  for (const slug of red) assert(bySlug(slug).flowerTypes.some((flower) => /\bred\b/i.test(flower)), `${slug} records no red flower`);
  for (const slug of ['love-at-first-sight', 'midnight-romance', 'rose-promise']) assert(!red.includes(slug), slug);
  const yellow = members('yellow-flowers');
  for (const slug of ['mandarin-lily-glow', 'coral-lily-bloom']) assert(!yellow.includes(slug), slug);
  assert(!members('fragrant-lilies').includes('sunrise-asiatic-vase'), 'Asiatic lilies are not listed as fragrant');
  assert(!members('pastel-flowers').includes('sweet-petal-hour') && !members('mini-bouquets').includes('sweet-petal-hour'));
  assert(members('pink-flowers').includes('timeless-hug') && members('blue-flowers').includes('winter-whisper'));
  // Hampers are hampers; single add-ons are not counted as hampers.
  for (const slug of members('hampers')) assert(!bySlug(slug).isAddon && bySlug(slug).category !== 'Add-ons', slug);
  assert(!members('all-decor').includes('pet-friendly-flowerbox'));
  // Custom: made to a brief and quoted, never a fixed design.
  assert(members('custom').length > 1 && members('custom').every((slug) => bySlug(slug).priceType === 'quote'));
});

test('every category page has a specific introduction, and empty or narrow pages do not offer what is not listed', () => {
  const { CATEGORY_LANDING } = load('src/data/seoLanding.ts');
  for (const slug of pages.categorySlugs(productCatalog)) {
    // A landing page renders its own intro; a category intro there would be an unused, unchecked draft.
    if (CATEGORY_LANDING[slug]) { assert(!pages.CATEGORY_INTROS[slug], `${slug}: unused intro beside landing copy`); continue; }
    const { description } = pages.categoryMeta(slug);
    assert(!/^Explore\b/.test(description), `${slug}: generic introduction`);
    assert(pages.CATEGORY_INTROS[slug], `${slug}: no written introduction`);
  }
  assert(/not part of this range/.test(pages.CATEGORY_INTROS['all-decor']));
  assert(/Tools are not included/.test(pages.CATEGORY_INTROS['diy-kits']));
  assert(/^Greeting cards/.test(pages.CATEGORY_INTROS.stationery) && /not sold/.test(pages.CATEGORY_INTROS.stationery));
  assert(/recurring jasmine .* delivery plan/.test(pages.CATEGORY_INTROS.jasmine));
  assert(/cannot guarantee/.test(pages.CATEGORY_INTROS['pet-friendly']) && !/pet friendly/i.test(pages.CATEGORY_NAMES['pet-friendly']));
  for (const slug of ['eid-al-adha', 'tuberose-rajnigandha', 'hydrangeas', 'orchid', 'mini-bouquets', 'skincare', 'tea']) assert(/not listed|not sold|No .* listed/.test(pages.CATEGORY_INTROS[slug]), slug);
});

test('identity: creative names get a plain flower and form line, and gypsophila-only designs are named by it', () => {
  assert.equal(supply.productIdentity(bySlug('cloud-nine-blue')), 'Blue gypsophila bouquet');
  assert.equal(supply.productIdentity(bySlug('pink-secret')), 'Pink gypsophila bouquet');
  assert.equal(supply.productIdentity(bySlug('violet-picnic')), 'Mixed statice flower basket');
  assert.equal(titles.productTitle(bySlug('cloud-nine-blue')), 'Cloud Nine Blue – Blue Gypsophila Bouquet | Fresh Petals');
  assert.equal(titles.productTitle(bySlug('pet-friendly-flowerbox')), 'Flowerbox for Homes with Pets | Fresh Petals');
  assert(!/bouquet/i.test(bySlug('violet-picnic').ratingLabel) && !/pastel/i.test(bySlug('sweet-petal-hour').ratingLabel));
  for (const product of productCatalog) {
    if (!/^(Bouquets|Lilies)$/.test(product.category)) assert(supply.productIdentity(product), `${product.slug}: no identity line`);
  }
  assert.equal(supply.enquiryName(bySlug('cloud-nine-blue')), 'Cloud Nine Blue (blue gypsophila bouquet)');
});

test('what is supplied: ordering steps are not items, optional extras are on request, and boilerplate fits the product', () => {
  for (const product of productCatalog) {
    const { included, onRequest } = supply.suppliedItems(product);
    assert(included.length > 0, `${product.slug}: nothing included`);
    for (const item of included) assert(!/whatsapp|confirmation|on request|optional|final (price|quote)/i.test(item), `${product.slug}: ${item}`);
    if (/^(Bouquets|Lilies)$/.test(product.category)) assert(!included.some((item) => /message note/i.test(item)) || onRequest.length === 0);
  }
  assert.equal(supply.suppliedItems(bySlug('gift-basket')).onRequest.length, 2);
  assert.deepEqual([...supply.trustIndicators(bySlug('florist-cutter'))], ['Delivery Confirmed on WhatsApp', 'WhatsApp Ordering']);
  assert(supply.trustIndicators(bySlug('red-affair')).includes('Hand-Arranged'));
  assert.equal(supply.flowerFact(bySlug('clear-glass-vase')).label, 'What it is');
  assert(/by the stem/i.test(supply.quantityBasis(bySlug('roses-by-stem'))));
  assert.equal(supply.quantityBasis(bySlug('red-affair')), null);
  assert.equal(supply.enquiryQuantityLine(bySlug('roses-by-stem')), 'Quantity needed: ');
  assert.equal(supply.enquiryQuantityLine(bySlug('red-affair')), 'Quantity: 1');
  assert(/option available/.test(supply.quoteDrivers(bySlug('florist-cutter'))) && /design, flowers/.test(supply.quoteDrivers(bySlug('premium-flower-basket'))));
  assert.equal(supply.idealForText({ occasionTags: ['housewarming', 'just-because'] }), 'Housewarming, Just because');
});

test('admin-added records are read the same way: process lines dropped, on-request items separated', () => {
  const record = { whatsIncluded: ['Fresh roses', 'Message note on request', 'Availability confirmation on WhatsApp'] };
  assert.deepEqual(JSON.parse(JSON.stringify(supply.suppliedItems(record))), { included: ['Fresh roses'], onRequest: ['Message note'], toConfirm: [] });
});

// Correction, 16 Nov 2026 (second pass).
const { withRecordEdits } = load('src/data/dashboardCatalogue.ts');
const { DELIBERATE_CATALOGUE_COPY } = load('src/data/catalogueRange.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('inclusion uncertainty: an unrecorded pot or vase is neither included nor on request', () => {
  const succulent = plain(supply.suppliedItems(bySlug('mini-succulent-gift')));
  assert(!succulent.included.some((item) => /pot|planter/i.test(item)) && !succulent.onRequest.some((item) => /pot|planter/i.test(item)));
  assert(succulent.toConfirm.some((item) => /pot or planter is included/.test(item)));
  const dried = plain(supply.suppliedItems(bySlug('dried-flower-vase-set')));
  assert(!dried.included.some((item) => /vase/i.test(item)) && !dried.onRequest.some((item) => /vase/i.test(item)));
  assert.deepEqual(dried.toConfirm, ['Whether a vase is included']);
  // A record's explicit status wins over availability wording: only toConfirm puts an item with the quote.
  assert.deepEqual(plain(supply.suppliedItems({ whatsIncluded: ['Fresh roses', 'Vase option based on availability'], onRequest: ['Basket, depending on availability', 'Message note'] })), { included: ['Fresh roses', 'Vase option based on availability'], onRequest: ['Basket, depending on availability', 'Message note'], toConfirm: [] });
  assert.deepEqual(plain(supply.suppliedItems({ whatsIncluded: ['Fresh roses'], toConfirm: ['Whether a vase is included'] })), { included: ['Fresh roses'], onRequest: [], toConfirm: ['Whether a vase is included'] });
  assert.equal(supply.enquiryConfirmLine(bySlug('dried-flower-vase-set')), 'Please confirm in the quote: whether a vase is included.');
  assert.equal(supply.enquiryConfirmLine(bySlug('red-affair')), null);
  assert.equal(supply.enquiryName(bySlug('sunrise-asiatic-vase')), 'Sunrise Asiatic Vase (Asiatic lily vase arrangement)');
  // The copy that carries the same fact says neither "with" nor "without".
  for (const slug of ['dried-flower-vase-set', 'mini-succulent-gift']) {
    const { description, longDescription } = bySlug(slug);
    assert(!/with a vase option|vase style|pot option/i.test(`${description} ${longDescription}`), slug);
  }
  assert(!/any vase you choose/.test(supply.quoteDrivers(bySlug('dried-flower-vase-set'))));
});

test('rendered-copy precedence: dashboard name and descriptions replace the entry unless deliberately kept', () => {
  const entry = bySlug('dried-flower-vase-set');
  const record = { slug: entry.slug, name: 'Dashboard name', shortDescription: 'Dashboard short', description: 'Dashboard long', stemCount: null, image: null };
  const shown = withRecordEdits(entry, record);
  assert.equal(shown.name, 'Dashboard name');
  assert.equal(shown.description, 'Dashboard short');
  assert.equal(shown.longDescription, 'Dashboard long');
  // Included items and the quote question stay with the entry (code), whatever the dashboard holds.
  assert.deepEqual(plain(shown.toConfirm), ['Whether a vase is included']);
  // No copy field of these products is forced over the dashboard by code.
  for (const slug of ['dried-flower-vase-set', 'mini-succulent-gift', 'all-white-fragrance', 'sunrise-asiatic-vase']) assert(!DELIBERATE_CATALOGUE_COPY[slug], slug);
});

test('fragrance and colour: grouping follows recorded variety and colour, not names or tones', () => {
  const oriental = members('fragrant-lilies');
  assert(oriental.length > 0);
  for (const slug of oriental) assert(bySlug(slug).flowerTypes.some((flower) => /oriental|stargazer/i.test(flower)), slug);
  for (const slug of ['all-white-fragrance', 'fragrance-festive-giftbox', 'mandarin-lily-glow', 'sunrise-asiatic-vase']) assert(!oriental.includes(slug), slug);
  assert(!productCatalog.some((product) => product.collectionTags?.includes('fragrant-lilies')), 'no product is tagged fragrant');
  assert(!/fragran/i.test(pages.CATEGORY_NAMES['fragrant-lilies']) && /do not promise/.test(pages.CATEGORY_INTROS['fragrant-lilies']) && !/usually|chosen when scent/i.test(pages.CATEGORY_INTROS['fragrant-lilies']));
  for (const product of productCatalog) assert(!/fragran/i.test(`${product.badge} ${product.ratingLabel}`), `${product.slug} badge`);
  assert.equal(bySlug('all-white-fragrance').name, 'All White Fragrance', 'creative name kept');
  assert(!members('yellow-flowers').includes('sunrise-asiatic-vase'));
  for (const slug of members('yellow-flowers')) assert(bySlug(slug).flowerTypes.some((flower) => /yellow|sunflower/i.test(flower)), slug);
  assert(!/sunrise/i.test(pages.CATEGORY_INTROS['yellow-flowers']));
});

test('names and introductions say what is sold', () => {
  assert.equal(pages.CATEGORY_NAMES.stationery, 'Greeting Card Add-ons & Stationery');
  assert.equal(pages.CATEGORY_NAMES['diy-kits'], 'DIY Flower Arranging Boxes');
  assert.match(pages.CATEGORY_NAMES.jasmine, /^Recurring Jasmine \(Malli/);
  assert(/^Dried flowers/.test(pages.CATEGORY_INTROS['all-decor']) && !/lasts|long-lasting/i.test(pages.CATEGORY_INTROS['all-decor']));
  assert(/^The DIY flower box/.test(pages.CATEGORY_INTROS['diy-kits']) && pages.CATEGORY_INTROS['diy-kits'].indexOf('not included') > pages.CATEGORY_INTROS['diy-kits'].indexOf('Choose'));
  assert(/^Loose tuberose/.test(pages.CATEGORY_INTROS['tuberose-rajnigandha']));
  assert.equal(pages.CATEGORY_GARLAND_LINKS['tuberose-rajnigandha'].key, 'tuberose');
});
