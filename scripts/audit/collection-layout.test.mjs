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

test('F7: every empty range says whether it is sold; enquiries only where the introduction supports one', () => {
  const { EMPTY_RANGES, CATEGORY_INTROS, emptyRangeCopy } = sourceLoader()('src/data/categoryPages.ts');
  for (const [slug, range] of Object.entries(EMPTY_RANGES)) {
    const intro = CATEGORY_INTROS[slug];
    assert(intro, slug);
    if (range.kind === 'not-offered') assert(/not sold/i.test(intro), `${slug}: intro says it is not sold`);
    else assert(/WhatsApp/.test(intro), `${slug}: intro invites a WhatsApp message`);
    // A quotation is offered only where the introduction itself asks for one.
    if (range.kind === 'quote') assert(/quotation/i.test(intro), `${slug}: intro asks for a quotation`);
    assert(range.see.href.startsWith('/categories/'));
  }
  // Unconfirmed offers check availability, never "custom order" (owner to confirm).
  for (const slug of ['flowers-and-jewellery', 'pooja-urli-boxes', 'eid-al-adha', 'mini-bouquets', 'tuberose-rajnigandha', 'hydrangeas', 'orchid']) assert.equal(EMPTY_RANGES[slug].kind, 'check', slug);
  assert.equal(EMPTY_RANGES['bulk-orders'].kind, 'quote');
  assert.equal(Object.values(EMPTY_RANGES).filter((r) => r.kind === 'not-offered').length, 6);
  // Heading, panel, button and draft say the same thing.
  const check = emptyRangeCopy('check', 'Flowers & Jewellery');
  assert(/Check availability/.test(check.heading) && check.cta === 'Check availability' && /check availability for Flowers & Jewellery/.test(check.draft));
  assert(!/custom|made to order/i.test(check.heading + check.body + check.cta + check.draft));
  const quote = emptyRangeCopy('quote', 'Bulk Flowers');
  assert(/quotation/i.test(quote.cta + quote.draft + quote.body));
  const none = emptyRangeCopy('not-offered', 'Tea');
  assert.equal(none.cta, null); assert.equal(none.draft, null);
  assert.equal(emptyRangeCopy(undefined, 'X').cta, null);
  // Every range whose introduction says it is not listed or not sold is classified
  // (stationery is the exception: it lists greeting cards).
  for (const [slug, intro] of Object.entries(CATEGORY_INTROS)) {
    if (/not (listed|sold)|No .* listed/.test(intro) && slug !== 'stationery') assert(EMPTY_RANGES[slug], `${slug} is classified`);
  }
  const page = read('src/components/category/CategoryPage.astro');
  assert(/emptyCopy\.cta && emptyCopy\.draft/.test(page) && /whatsappLink\(emptyCopy\.draft\)/.test(page));
});

test('F4: the lower guide follows the filters, and group jumps keep the filter address', () => {
  const page = read('src/components/category/CategoryPage.astro');
  assert(/data-group-jump=\{group\.id\}/.test(page) && /data-guide-slug=\{product\.slug\}/.test(page) && /data-guide-filtered hidden/.test(page));
  const filters = read('src/components/occasion/ShopFilters.astro');
  assert(/\[data-group-guidance\]/.test(filters) && /entry\.hidden = !group \|\| group\.hidden/.test(filters));
  assert(/line\.hidden = !visibleSlugs\.has/.test(filters));
  assert(/target\.hidden \|\| target\.closest\("\[hidden\]"\)/.test(filters), 'a jump never lands on a hidden group');
});

test('filter links carry the served address: no trailing slash from a prerendered path', () => {
  const { shopFilterUrl } = sourceLoader()('src/utils/shopFilters.ts');
  const none = { occasion: [], budget: [], colour: [], intent: null };
  assert.equal(shopFilterUrl('/categories/bouquets/', { ...none, colour: ['red'] }), '/categories/bouquets#colour=red');
  assert.equal(shopFilterUrl('/occasions/birthday/', none), '/occasions/birthday');
  assert.equal(shopFilterUrl('/categories/bouquets/?utm_source=x', none), '/categories/bouquets?utm_source=x');
  assert.equal(shopFilterUrl('/', none), '/');
});
