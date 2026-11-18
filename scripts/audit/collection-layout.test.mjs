// Collection pages (audit 18 Nov 2026): the shared header, the filter rows,
// the bouquet list's browsing path, card alignment and empty ranges.
// Source-level; never opens a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceLoader } from './source-loader.mjs';

const read = (path) => readFileSync(path, 'utf8');

test('F1: collection headers start the title and introduction together', () => {
  for (const path of ['src/components/category/CategoryPage.astro', 'src/pages/categories/garlands.astro', 'src/pages/categories/garlands/[flower].astro']) {
    const head = read(path).match(/\.collection-head \{[\s\S]*?\n {2}\}\n\s*@media[\s\S]*?\n {2}\}/)[0];
    assert(/align-items: start/.test(head) && !/align-items: end/.test(head), path);
  }
});

test('F2: bouquet cards follow each group heading; the named-design lists come after the cards', () => {
  const page = read('src/components/category/CategoryPage.astro');
  const group = page.slice(page.indexOf('data-shop-group'), page.indexOf('data-shop-empty'));
  assert(!/bouquetLine\(/.test(group), 'no per-design list between a group heading and its photographs');
  const after = page.slice(page.indexOf('data-shop-empty'));
  assert(/data-group-guidance=\{group\.id\}/.test(after) && /bouquetLine\(product\)/.test(after));
  // Rose, lily and other jump links, and the unique total, stay.
  assert(/href=\{`#\$\{group\.id\}`\} data-group-link/.test(page) && /data-group-overlap/.test(page) && /listed in both groups/.test(page));
});

test('F3–F4: one row per filter group; group links count the visible placements', () => {
  const filters = read('src/components/occasion/ShopFilters.astro');
  const row = filters.match(/\.filters__row \{[^}]*\}/)[0];
  assert(/display: grid/.test(row) && !/overflow-x/.test(row), 'groups stack instead of sharing one sideways row');
  assert(/flex-wrap: wrap/.test(filters));
  assert(/\[data-group-link\]/.test(filters) && /link\.hidden = n === 0/.test(filters));
});

test('F6: card actions sit at the bottom of the card; long names and codes wrap', () => {
  const card = read('src/components/ProductCard.astro');
  assert(/fp-card flex h-full flex-col/.test(card) && /flex flex-1 flex-col/.test(card) && /mt-auto pt-4/.test(card));
  assert((card.match(/\[overflow-wrap:anywhere\]/g) ?? []).length >= 2);
});

test('F7: every empty range says whether it is sold; no enquiry for ranges not sold', () => {
  const { EMPTY_RANGES, CATEGORY_INTROS } = sourceLoader()('src/data/categoryPages.ts');
  for (const [slug, range] of Object.entries(EMPTY_RANGES)) {
    const intro = CATEGORY_INTROS[slug];
    assert(intro, slug);
    if (range.kind === 'not-offered') assert(/not sold/i.test(intro), `${slug}: intro says it is not sold`);
    else assert(/WhatsApp/.test(intro), `${slug}: intro offers an enquiry`);
    assert(range.see.href.startsWith('/categories/'));
  }
  const page = read('src/components/category/CategoryPage.astro');
  assert(/emptyRange && emptyRange\.kind !== "not-offered" && \(/.test(page));
  assert(!/This category is available as a WhatsApp-confirmed custom order/.test(page));
});

test('filter links carry the served address: no trailing slash from a prerendered path', () => {
  const { shopFilterUrl } = sourceLoader()('src/utils/shopFilters.ts');
  const none = { occasion: [], budget: [], colour: [], intent: null };
  assert.equal(shopFilterUrl('/categories/bouquets/', { ...none, colour: ['red'] }), '/categories/bouquets#colour=red');
  assert.equal(shopFilterUrl('/occasions/birthday/', none), '/occasions/birthday');
  assert.equal(shopFilterUrl('/categories/bouquets/?utm_source=x', none), '/categories/bouquets?utm_source=x');
  assert.equal(shopFilterUrl('/', none), '/');
});
