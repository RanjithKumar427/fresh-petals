// Mandatory recipient city for product WhatsApp enquiries (24 Nov 2026).
// Source-level; the browser behaviour is checked by
// scripts/cloudflare/preview-browser.mjs on the deployed preview.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(path, 'utf8');
const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));

test('one gate: window capture listeners that stop a blocked enquiry before any other listener', () => {
  const gate = read('src/utils/productEnquiry.ts');
  assert.match(gate, /window\.addEventListener\("click", onActivate, true\)/);
  assert.match(gate, /window\.addEventListener\("auxclick", onActivate, true\)/);
  assert.match(gate, /event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\);/);
  // Product enquiry links are recognised by attribute, by the garland check, or by a WhatsApp draft that links to a product.
  assert.match(gate, /\[data-product-enquiry\], \[data-garland-quote\], \[data-whatsapp-order-link\]/);
  assert.match(gate, /garland-enquiry/);
  assert.match(gate, /\\\/products\\\//);
  // Analytics listens on document (capture): a window capture listener always runs first.
  assert.match(read('src/scripts/inline/analytics.js'), /document\.addEventListener\(\s*"click"/);
  // Never a default city and never the page's city by itself.
  assert.doesNotMatch(gate, /setDestination\(/);
  const destination = read('src/utils/destination.ts');
  assert.doesNotMatch(destination.slice(destination.indexOf('export function resolveDestination')), /setDestination\(/);
});

test('every page carries the city step; every product page has the Recipient city selector', () => {
  assert.match(read('src/layouts/BaseLayout.astro'), /<RecipientCityStep \/>/);
  const step = read('src/components/RecipientCityStep.astro');
  assert.match(step, /<dialog[^>]*data-city-step/);
  assert.match(step, /<DestinationCity/);
  // Product pages: the options panel (all non-garland products, and garlands sold through the basket) and the garland quote panel.
  assert.match(read('src/components/ProductOptions.astro'), /<div id="recipient-city"[^>]*>\s*<DestinationCity/);
  assert.match(read('src/components/GarlandProductMain.astro'), /<div id="recipient-city"[^>]*>\s*<DestinationCity/);
  const control = read('src/components/DestinationCity.astro');
  assert.match(control, /data-destination-error role="alert" hidden/);
  assert.match(control, /Required for WhatsApp enquiries/);
});

test('no product draft is built with a city or opened without the gate', () => {
  // Drafts handed to the gate carry no city line; the gate writes it once.
  for (const file of ['src/components/ProductCard.astro', 'src/components/GuideProductCard.astro', 'src/utils/cityEnquiry.ts', 'src/components/ProductOptions.astro']) {
    const source = read(file);
    const product = file.endsWith('cityEnquiry.ts') ? source.slice(source.indexOf('export function productEnquiryDraft')) : source;
    assert.doesNotMatch(product, /Recipient city: \$\{|"Recipient city:",|Recipient city: "/, file);
  }
  // Scripted enquiries ask the gate first and build the link through it.
  const options = read('src/components/ProductOptions.astro');
  assert.equal(options.match(/requireRecipientCity\(/g).length, 2);
  assert.equal(options.match(/window\.open\(productEnquiryHref\(/g).length, 2);
  assert.doesNotMatch(options, /wa\.me/);
  // No component writes a product WhatsApp link itself any more.
  for (const file of walk('src').filter((f) => /\.(astro|ts|js)$/.test(f) && !f.startsWith('src/pages/admin') && !f.includes('/server/'))) {
    const source = read(file);
    if (!/wa\.me|whatsappLink\(/.test(source)) continue;
    assert.doesNotMatch(source, /wa\.me[^\n]*\/products\/|whatsappLink\([^\n]*\/products\//, file);
  }
  // Links in templates: product enquiry links opt in and fall back to a page, never a city-less draft.
  assert.match(read('src/components/ProductCard.astro'), /href=\{enquiryFallbackHref\}\s*data-product-enquiry\s*data-enquiry-text=\{finalMessage\}/);
  assert.match(read('src/components/GuideProductCard.astro'), /href=\{`\/products\/\$\{product\.slug\}#recipient-city`\} data-product-enquiry data-enquiry-text/);
  assert.match(read('src/components/GarlandCard.astro'), /data-garland-quote=\{design\.code\}\s*data-product-enquiry/);
  assert.match(read('src/pages/products/[slug].astro'), /href="#recipient-city"\s*data-product-enquiry\s*data-enquiry-text/);
  assert.match(read('src/pages/saved.astro'), /data-product-enquiry/);
  for (const file of ['src/pages/locations/[city].astro', 'src/pages/locations/[city]/shop.astro']) {
    const source = read(file);
    assert.match(source, /data-product-enquiry data-enquiry-text/, file);
    assert.doesNotMatch(source, /garlandEnquiryHref\(\{[^}]*city:/, `${file}: never the page's city by itself`);
  }
});

test('general WhatsApp contact is unchanged: no gate on it', () => {
  for (const file of ['src/pages/contact.astro', 'src/components/atelier/SiteFooter.astro', 'src/utils/cityEnquiry.ts', 'src/data/collectionGuidance.ts']) {
    const source = read(file);
    assert.doesNotMatch(source, /data-product-enquiry|requireRecipientCity/, file);
  }
  const general = read('src/utils/cityEnquiry.ts');
  assert.match(general, /export function cityEnquiryHref\(cityName: string\)/);
});
