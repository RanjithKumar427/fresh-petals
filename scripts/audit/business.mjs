import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { sourceLoader } from './source-loader.mjs';

const load = sourceLoader({ mocks: { 'src/server/services/ProductPricing.ts': { withAuthoritativePrice: (product) => product } } });
const products = load('src/data/launchCatalogue.ts').launchProducts();
const { getHeroPhoto, getArrivalBouquet } = load('src/data/atelierHome.ts');
const variants = JSON.parse(readFileSync('src/data/imageVariants.json', 'utf8'));
const hero = getHeroPhoto(); const arrival = getArrivalBouquet(new Map());
for (const scene of [hero, arrival]) {
  const product = products.find((p) => p.slug === scene.slug);
  const photo = scene.main ?? scene.photo;
  assert(Object.values(variants[product.image]).includes(photo.src), `${product.slug} must use its own image variants`);
  if (scene.detail) assert.equal(scene.detail.src, photo.src);
}
const shipping = readFileSync('src/pages/shipping.astro', 'utf8');
const terms = readFileSync('src/pages/terms.astro', 'utf8');
const faqs = readFileSync('src/data/seoLanding.ts', 'utf8') + readFileSync('src/pages/faqs.astro', 'utf8');
assert(!/Within 4[-–]6 hours/.test(shipping));
assert(!/for example UPI|may use UPI|UPI checkout later/.test(terms + faqs));
const report = {
  date: '2026-10-07', source: 'Local catalogue records, not owner confirmation or production DB',
  hero: { slug: hero.slug, image: hero.main.src, detail: hero.detail.src },
  arrival: { slug: arrival.slug, image: arrival.photo.src, closeups: 'CSS crops of this same file' },
  bouquets: products.map((p) => ({ slug: p.slug, name: p.name, listedStems: p.stemCount ?? null, included: p.whatsIncluded ?? [], messageNoteRecorded: (p.whatsIncluded ?? []).some((s) => /message|note/i.test(s)) })),
  decisions: ['Actual same-day/express service and cut-off/lead-time/areas', 'Delivery fee rules and whether any estimate is approved', 'Accepted payment methods and payment timing', 'Message-note inclusion/charge for each bouquet; printed card variants, availability and price', 'Cancellation/change cut-off and refund handling', 'Confirmed bouquet dimensions/stem ranges/specifications and photo ownership', 'Verified replacement Instagram handle', 'Garland photo permissions, samples, units, specifications, suitability, lead time and prices'],
};
const out = 'data/focused-audit-2026-10-07'; mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'business-evidence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
