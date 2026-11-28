// Car Decoration (28 Nov 2026, docs/car-decoration.md): every product is
// quoted, says how it is fulfilled, has a reviewed photograph with blank
// plates, concept images are labelled, and the category page and enquiry
// keep the recipient-city gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { sourceLoader } from './source-loader.mjs';

const load = sourceLoader();
const { productCatalog } = load('src/data/productCatalog.ts');
const car = load('src/data/carDecoration.ts');
const photos = load('src/data/productPhotos.ts');
const quote = load('src/shared/quoteOnly.ts');
const pages = load('src/data/categoryPages.ts');
const seo = load('src/data/seoLanding.ts');
const supply = load('src/data/productSupply.ts');
const products = productCatalog.filter((p) => p.category === car.CAR_DECORATION_CATEGORY);

test('car decoration: a distinct range, each product quoted and fulfilment stated', () => {
  assert(products.length >= 8, `only ${products.length} products`);
  assert.equal(new Set(products.map((p) => p.name)).size, products.length);
  for (const p of products) {
    const facts = car.CAR_DECORATION_FACTS[p.slug];
    assert(facts && ['delivered', 'on-site'].includes(facts.fulfilment), `${p.slug}: no fulfilment`);
    assert(quote.isQuoteOnly(p) && p.priceType === 'quote', `${p.slug}: must be quoted`);
    assert.equal(quote.publicPriceView(p).priceLabel, quote.QUOTE_ONLY_PRICE_LABEL);
    assert(supply.productKind(p) === 'vehicle' && supply.productIdentity(p), p.slug);
    const copy = [p.name, p.description, p.longDescription, ...p.whatsIncluded, ...(p.onRequest ?? []), ...p.careNotes].join(' ');
    // No amount, count, size, time or availability claim is recorded, so none is made.
    assert(!/₹|\d+\s*(roses|flowers|stems|ft|feet|cm|hours?|mins?|minutes)|same[- ]day (delivery|decoration|service)|guarantee|always available/i.test(copy), `${p.slug}: ${copy.match(/₹|\d+\s*\w+|same[- ]day|guarantee/i)}`);
  }
  for (const mode of ['delivered', 'on-site']) assert(products.some((p) => car.CAR_DECORATION_FACTS[p.slug].fulfilment === mode), mode);
  for (const slug of Object.keys(car.CAR_DECORATION_FACTS)) assert(products.some((p) => p.slug === slug), `${slug}: facts without a product`);
});

test('car decoration: photographs reviewed byte for byte, concept images labelled and kept out of the image sitemap', () => {
  for (const p of products) {
    const review = photos.PHOTO_REVIEWS[p.slug];
    assert(review && review.photo === p.image, `${p.slug}: unreviewed photograph`);
    const file = `public${p.image}`;
    assert(existsSync(file), file);
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16), review.sha256, `${p.slug}: file changed since review`);
    assert(photos.PHOTO_DESCRIPTIONS[p.image], `${p.slug}: no description`);
    const concept = Boolean(car.CAR_DECORATION_FACTS[p.slug].concept);
    assert.equal(photos.isConceptImage(p.image), concept, `${p.slug}: concept flag and image list disagree`);
    if (concept) {
      assert.equal(review.verdict, 'illustrative');
      assert(/concept image/i.test(p.longDescription) && /concept image/i.test(photos.productPhotoAlt(p)), p.slug);
    } else {
      assert.equal(review.verdict, 'product');
    }
    // Published files carry no camera or location metadata.
    assert(!/Exif|GPS/.test(readFileSync(file).subarray(0, 4096).toString('latin1')), `${p.slug}: metadata`);
  }
  const card = readFileSync('src/components/ProductCard.astro', 'utf8');
  assert(/isConceptImage\(image\)/.test(card) && /Concept image/.test(card));
});

test('car decoration: category page, sections, safety and the city-gated enquiry', () => {
  const listed = pages.categoryProducts(car.CAR_DECORATION_SLUG, productCatalog).primary.map((p) => p.slug).sort();
  assert.deepEqual(listed, products.map((p) => p.slug).sort());
  const sections = car.carDecorationSections(products);
  assert.equal(sections.reduce((n, s) => n + s.products.length, 0), products.length);
  assert.equal(pages.CATEGORY_NAMES[car.CAR_DECORATION_SLUG], 'Car Decoration');
  const landing = seo.CATEGORY_LANDING[car.CAR_DECORATION_SLUG];
  assert(landing && landing.h1 === 'Car Decoration' && /gajamala/i.test(landing.title) && landing.title.length <= 70);
  assert(car.VEHICLE_SAFETY.length >= 4 && car.VEHICLE_SAFETY.some((s) => /number plate|registration plate/i.test(s)));
  assert(!/city/i.test(car.CAR_ENQUIRY_DRAFT.split('\n').find((l) => /city/i.test(l)) ?? ''), 'the gate writes the city line');
  const guide = readFileSync('src/components/car/CarDecorationGuide.astro', 'utf8');
  assert(/data-product-enquiry/.test(guide) && /data-enquiry-text=\{CAR_ENQUIRY_DRAFT\}/.test(guide) && !/wa\.me/.test(guide));
  const page = readFileSync('src/pages/products/[slug].astro', 'utf8');
  assert(/<CarDecorationDetails product=\{product\} \/>/.test(page));
  const nav = load('src/data/navigation.ts');
  assert(nav.siteNav([]).find((item) => item.label === 'Shop Flowers').links.some((l) => l.href === car.CAR_DECORATION_PATH));
});
