// Measurement: the browser's application context (src/scripts/inline/analytics.js)
// and the CSV review (scripts/seo/report.mjs), executed with controlled
// clocks, storage and input files. No network request is made: the tracking
// script runs without a measurement ID, and the report reads local files only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildReport, classifySource, comparablePeriods, parseArgs, parsePeriod } from '../seo/report.mjs';

const SOURCE = readFileSync('src/scripts/inline/analytics.js', 'utf8');
const ORIGIN = 'https://onlyfreshpetals.in';
const MINUTE = 60 * 1000;
const T0 = Date.parse('2026-10-21T09:00:00Z');

/** A tab's session storage (shared by the documents a tab loads), optionally failing. */
function memoryStorage({ fail = false } = {}) {
  const map = new Map();
  const api = { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key), map };
  return fail ? null : api;
}

/**
 * Loads one document in a tab: runs the reviewed script exactly as
 * Analytics.astro wraps it (no measurement ID), with a controllable clock.
 */
function openDocument({ tab, clock, href, referrer = '', throwOnStorage = false }) {
  const url = new URL(href, ORIGIN);
  const listeners = {};
  const events = [];
  const document = {
    referrer,
    querySelector: () => null,
    addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    dispatchEvent: (event) => (event.type === 'fp:track' && events.push(event.detail), true),
  };
  const window = { addEventListener: (type, fn) => (listeners[`window:${type}`] ??= []).push(fn) };
  Object.defineProperty(window, 'sessionStorage', { get() { if (throwOnStorage) throw new Error('SecurityError'); return tab.storage; } });
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  const context = vm.createContext({ window, document, location: { pathname: url.pathname, search: url.search, origin: url.origin }, localStorage: { getItem: () => null }, URL, URLSearchParams, CustomEvent, Date: FixedDate, JSON, isFinite, Object, String, Number });
  vm.runInContext(`(function () {\nvar measurementId = "";\n${SOURCE}})();\n`, context);
  return {
    events,
    track: (name) => (context.window.fpTrack(name, {}), events.at(-1).params),
    fire: (type) => (listeners[type] ?? []).forEach((fn) => fn({ persisted: false })),
    stored: () => (tab.storage ? JSON.parse(tab.storage.getItem('fp_context')) : null),
  };
}

test('application context: an assistant referral survives active internal navigation, keeps its landing path and is stamped with the last activity', () => {
  const clock = { now: T0 };
  const tab = { storage: memoryStorage() };
  const first = openDocument({ tab, clock, href: '/categories/rose?utm_source=newsletter', referrer: 'https://chatgpt.com/c/secret-prompt-id' });
  assert.deepEqual(first.events.length, 0);
  let params = first.track('whatsapp_enquiry_click');
  assert.equal(params.landing_path, '/categories/rose');
  assert.equal(params.ai_referrer, 'chatgpt');
  assert.equal(params.ai_attribution, 'referrer');
  assert(!JSON.stringify(params).includes('secret-prompt-id') && !JSON.stringify(params).includes('newsletter'));
  // 25 minutes later the visitor opens another page: still the same visit.
  clock.now += 25 * MINUTE;
  const second = openDocument({ tab, clock, href: '/products/red-affair', referrer: `${ORIGIN}/categories/rose` });
  params = second.track('view_item');
  assert.equal(params.landing_path, '/categories/rose');
  assert.equal(params.ai_referrer, 'chatgpt');
  assert.equal(second.stored().at, clock.now);
  // Another 25 minutes (50 in all) of ordinary navigation: activity, not the first visit, is what counts.
  clock.now += 25 * MINUTE;
  assert.equal(openDocument({ tab, clock, href: '/cart', referrer: `${ORIGIN}/products/red-affair` }).track('basket_quote_request').ai_referrer, 'chatgpt');
  // No timer keeps a context alive.
  assert(!/setInterval|setTimeout|requestAnimationFrame/.test(SOURCE));
});

test('application context: a tab left idle over 30 minutes emits no stale referral at event time; a tap after idling starts a new context', () => {
  const clock = { now: T0 };
  const tab = { storage: memoryStorage() };
  const page = openDocument({ tab, clock, href: '/categories/bouquets?utm_source=perplexity.ai', referrer: '' });
  assert.deepEqual([page.track('view_item_list').ai_referrer, page.track('view_item_list').ai_attribution], ['perplexity', 'campaign']);
  // Three hours idle, then a WhatsApp click on the same, already loaded document.
  clock.now += 3 * 60 * MINUTE;
  const stale = page.track('whatsapp_enquiry_click');
  assert.equal(stale.ai_referrer, undefined, 'the old campaign is not a fresh referral');
  assert.equal(stale.landing_path, '/categories/bouquets');
  assert.equal(page.stored().ai, '');
  assert.equal(page.stored().at, clock.now);
  // The same through an activity listener first (pointerdown before the click's event).
  const tab2 = { storage: memoryStorage() };
  const other = openDocument({ tab: tab2, clock, href: '/categories/lilies', referrer: 'https://claude.ai/' });
  clock.now += 31 * MINUTE;
  other.fire('pointerdown');
  assert.equal(other.stored().ai, '');
  assert.equal(other.track('whatsapp_enquiry_click').ai_referrer, undefined);
  // Exactly 30 minutes is still the same context; activity keeps it going.
  const tab3 = { storage: memoryStorage() };
  const active = openDocument({ tab: tab3, clock, href: '/', referrer: 'https://gemini.google.com/' });
  clock.now += 30 * MINUTE;
  active.fire('keydown');
  clock.now += 29 * MINUTE;
  assert.equal(active.track('whatsapp_enquiry_click').ai_referrer, 'gemini');
});

test('application context: a new document after expiry classifies only its own entry; Google and direct visits are never AI', () => {
  const clock = { now: T0 };
  const tab = { storage: memoryStorage() };
  openDocument({ tab, clock, href: '/', referrer: 'https://chatgpt.com/' });
  clock.now += 45 * MINUTE;
  const fromGoogle = openDocument({ tab, clock, href: '/categories/garlands', referrer: 'https://www.google.com/' }).track('view_item_list');
  assert.equal(fromGoogle.landing_path, '/categories/garlands');
  assert.equal(fromGoogle.ai_referrer, undefined);
  clock.now += 45 * MINUTE;
  const campaign = openDocument({ tab, clock, href: '/locations/bengaluru?utm_source=chatgpt.com&utm_medium=x', referrer: '' }).track('view_item_list');
  assert.deepEqual([campaign.landing_path, campaign.ai_referrer, campaign.ai_attribution], ['/locations/bengaluru', 'chatgpt', 'campaign']);
  // Strict: lookalike hosts and bare words are not assistants.
  for (const [referrer, utm] of [['https://chatgpt-coupon.example/', ''], ['https://openai.com/blog', ''], ['', 'chatgpt'], ['https://www.bing.com/', ''], ['', '']]) {
    const fresh = openDocument({ tab: { storage: memoryStorage() }, clock, href: `/${utm ? `?utm_source=${utm}` : ''}`, referrer }).track('view_item_list');
    assert.equal(fresh.ai_referrer, undefined, `${referrer} ${utm}`);
  }
});

test('application context: old untimed keys continue only on internal navigation and are removed; malformed or future timestamps are discarded', () => {
  const clock = { now: T0 };
  const seeded = (entries) => { const storage = memoryStorage(); for (const [k, v] of Object.entries(entries)) storage.setItem(k, v); return { storage }; };
  // Internal navigation from a page of the previous release: continued, then migrated.
  let tab = seeded({ fp_landing: '/categories/rose', fp_ai_ref: 'chatgpt', fp_ai_method: 'campaign' });
  let params = openDocument({ tab, clock, href: '/products/red-affair', referrer: `${ORIGIN}/categories/rose` }).track('view_item');
  assert.deepEqual([params.landing_path, params.ai_referrer, params.ai_attribution], ['/categories/rose', 'chatgpt', 'campaign']);
  assert.deepEqual([...tab.storage.map.keys()], ['fp_context']);
  // Arriving from outside: the untimed keys may be hours old, so they are dropped.
  tab = seeded({ fp_landing: '/categories/rose', fp_ai_ref: 'chatgpt' });
  params = openDocument({ tab, clock, href: '/categories/lilies', referrer: '' }).track('view_item_list');
  assert.deepEqual([params.landing_path, params.ai_referrer], ['/categories/lilies', undefined]);
  assert.deepEqual([...tab.storage.map.keys()], ['fp_context']);
  // An old label that is not a known assistant is not carried over.
  tab = seeded({ fp_landing: '/', fp_ai_ref: 'bing' });
  assert.equal(openDocument({ tab, clock, href: '/cart', referrer: `${ORIGIN}/` }).track('x').ai_referrer, undefined);
  // Malformed, future-dated and foreign contexts are replaced.
  for (const bad of ['not json', '{"landing":"/x","at":"soon","ai":"","method":""}', JSON.stringify({ landing: '/x', at: T0 + 24 * 60 * MINUTE, ai: 'chatgpt', method: 'referrer' }), JSON.stringify({ landing: 'https://evil.example/', at: T0, ai: '', method: '' }), JSON.stringify({ landing: '/x', at: T0, ai: 'evil', method: 'referrer' })]) {
    tab = seeded({ fp_context: bad });
    params = openDocument({ tab, clock, href: '/occasions', referrer: `${ORIGIN}/x` }).track('view_item_list');
    assert.deepEqual([params.landing_path, params.ai_referrer], ['/occasions', undefined], bad);
  }
});

test('application context: unavailable storage falls back to the document, still expiring at event time; nothing personal is read', () => {
  const clock = { now: T0 };
  const page = openDocument({ tab: { storage: null }, clock, href: '/categories/rose', referrer: 'https://perplexity.ai/search?q=florist+bengaluru', throwOnStorage: true });
  assert.equal(page.track('view_item_list').ai_referrer, 'perplexity');
  clock.now += 40 * MINUTE;
  assert.equal(page.track('whatsapp_enquiry_click').ai_referrer, undefined);
  const noStore = openDocument({ tab: { storage: null }, clock, href: '/', referrer: '' });
  assert.equal(noStore.track('view_item_list').landing_path, '/');
  assert(!/location\.href|document\.cookie|\.value\b|innerText|textContent/.test(SOURCE));
  assert(/whatsapp_enquiry_click/.test(SOURCE) && /window\.fpTrack = function \(name, params\)/.test(SOURCE) && /destination_city/.test(SOURCE));
});

// ---------------------------------------------------------------------------
// CSV review (scripts/seo/report.mjs)
// ---------------------------------------------------------------------------

function exportsFolder(files) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'fp-report-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), text);
  }
  return dir;
}
const NOW = new Date('2026-10-21T06:30:00Z');

test('report: assistant sources are exact hostnames; provenance is stated only when the export can show it; no citation is implied', () => {
  assert.equal(classifySource('chatgpt-coupon.example'), null);
  assert.equal(classifySource('openai.com'), null);
  assert.equal(classifySource('google'), null);
  assert.deepEqual(classifySource('chatgpt.com', 'referral'), { assistant: 'ChatGPT', host: 'chatgpt.com', provenance: 'browser referral' });
  assert.equal(classifySource('chatgpt.com', '(not set)').provenance, 'tagged link (medium "(not set)")');
  assert.equal(classifySource(' ChatGPT.com ').provenance, 'unknown: source only');
  assert.equal(classifySource('perplexity.ai / referral').provenance, 'browser referral');
  const dir = exportsFolder({ 'referrals.csv': 'source,sessions\nchatgpt.com,4\nchatgpt-coupon.example,9\nopenai.com,2\ngoogle,5\n' });
  try {
    const text = buildReport({ dir, now: NOW });
    assert(/\| chatgpt\.com \| ChatGPT \| unknown: source only \| 4 \|/.test(text));
    assert(!/coupon|openai\.com \|/.test(text.split('## Visits from AI assistants')[1].split('Only exact hostnames')[0]));
    assert(/None of these rows shows that an assistant cited or recommended the site/.test(text) && /no medium column/.test(text));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('report: periods are stated or unknown; unequal or overlapping periods are flagged and no change is computed', () => {
  assert.deepEqual(parsePeriod('2026-10-13..2026-10-20'), { start: '2026-10-13', end: '2026-10-20', days: 8 });
  assert.equal(parsePeriod('last 28 days'), null);
  assert.equal(parsePeriod('2026-10-20..2026-10-13'), null);
  assert.equal(comparablePeriods(null, null).comparable, false);
  assert(/differ in length/.test(comparablePeriods(parsePeriod('2026-10-13..2026-10-20'), parsePeriod('2026-10-01..2026-10-12')).reason));
  assert(/does not end before/.test(comparablePeriods(parsePeriod('2026-10-13..2026-10-20'), parsePeriod('2026-10-10..2026-10-17')).reason));
  assert.equal(comparablePeriods(parsePeriod('2026-10-13..2026-10-20'), parsePeriod('2026-10-05..2026-10-12')).comparable, true);
  const args = parseArgs(['C:/exports', '--current-period', '2026-10-13..2026-10-20', '--previous-period', 'oops', '--city', 'Mumbai']);
  assert.deepEqual([args.dir, args.currentPeriod.days, args.previousPeriod, args.badPeriods, args.cities], ['C:/exports', 8, null, ['--previous-period oops'], ['mumbai']]);
  const files = {
    'current/Queries.csv': 'Top queries,Clicks,Impressions,CTR,Position\nlotus garland,2,40,5%,6.0\nrose bouquet,0,12,0%,9\n',
    'previous/Queries.csv': 'Top queries,Clicks,Impressions,CTR,Position\nlotus garland,0,20,0%,8\n',
  };
  const dir = exportsFolder(files);
  try {
    const unknown = buildReport({ dir, now: NOW });
    assert(/Current period: unknown \(not stated\)/.test(unknown) && /\*\*Not compared:\*\* changes \(Δ\) are not shown because the reporting periods were not both stated/.test(unknown));
    assert(/\| lotus garland \| 2 \| – \| 40 \| – \|/.test(unknown));
    assert(!/28 complete days|two days late|about two days/.test(unknown));
    assert(/^Generated 2026-10-21 /m.test(unknown));
    const comparable = buildReport({ dir, now: NOW, currentPeriod: parsePeriod('2026-10-13..2026-10-20'), previousPeriod: parsePeriod('2026-10-05..2026-10-12') });
    // A zero baseline is a change from zero, not "new"; a row absent before is a new row.
    assert(/\| lotus garland \| 2 \| \+2 \| 40 \| \+20 \|/.test(comparable));
    assert(/\| rose bouquet \| 0 \| new row \| 12 \| new row \| 0\.0% \| 9\.0 \| under 30 impressions: triage only \|/.test(comparable));
    const unequal = buildReport({ dir, now: NOW, currentPeriod: parsePeriod('2026-10-13..2026-10-20'), previousPeriod: parsePeriod('2026-09-01..2026-10-12') });
    assert(/periods differ in length \(8 and 42 days\)/.test(unequal) && !/\+2/.test(unequal));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('report: required columns are validated; a missing position is not zero; the average is impression-weighted over rows with a position', () => {
  const dir = exportsFolder({
    'current/Queries.csv': 'Top queries,Clicks,Impressions,CTR,Position\nflowers bangalore,1,10,10%,2\nflower delivery bengaluru,3,30,10%,4\nnavi mumbai flowers,0,5,0%,\nmumbai rose bouquet,1,8,12%,abc\nbad row,x,4,,3\n',
    'current/Pages.csv': 'Top pages,Clicks,CTR\n/,4,1%\n',
  });
  try {
    const text = buildReport({ dir, now: NOW });
    // (2×10 + 4×30) / 40 = 3.5, over the two rows with a position; the blank and invalid ones are disclosed, not counted as 0.
    assert(/\| All queries supplied \| 5 \| – \| 53 \| – \| 9\.4% \| 3\.5 \|/.test(text));
    assert(/2 row\(s\) had no valid position and are left out of the average \(its denominator is the 40 impressions with one\)/.test(text));
    assert(/1 row\(s\) had no query or an invalid clicks\/impressions value and were left out/.test(text));
    assert(/\| navi mumbai flowers \| 0 \| – \| 5 \| – \| 0\.0% \| not given \|/.test(text));
    // A Pages export without impressions is unusable, not a table of zeros.
    assert(/Supplied but not usable: current\/Pages\.csv \(missing column: impressions\)/.test(text));
    assert(!/\| \/ \| 4 \|/.test(text));
    // Missing exports are "not supplied", never zero activity or a tracking switch.
    assert(/no enquiry rows were read\. That is not a count of zero/.test(text) && !/switched on/.test(text));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('report: cities come from the shared registry and aliases, are labelled as words in the query, and overlapping matches are counted once', () => {
  const dir = exportsFolder({ 'current/Queries.csv': 'Top queries,Clicks,Impressions,Position\nflowers bangalore,1,10,2\nflower delivery bengaluru,3,30,4\nnavi mumbai flowers,1,5,3\nbouquet bombay,0,7,5\nfresh petals bengaluru,9,9,1\n' });
  try {
    const all = buildReport({ dir, now: NOW });
    assert(/not where they were searching from/.test(all));
    assert(/\| Bengaluru \| 4 \| 40 \| 10\.0% \|/.test(all), 'bangalore and bengaluru are one city; the brand query is excluded');
    assert(/\| Mumbai \| 1 \| 12 \|/.test(all) && /\| Navi Mumbai \| 1 \| 5 \|/.test(all));
    // 40 + 12 (Mumbai includes the Navi Mumbai row) = 52, not 57.
    assert(/\| \*\*Any of these cities \(each query once\)\*\* \| 5 \| 52 \|/.test(all));
    const selected = buildReport({ dir, now: NOW, cities: ['mumbai'] });
    assert(/appear in the query text: Mumbai\./.test(selected) && !/\| Bengaluru \|/.test(selected));
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const report = readFileSync('scripts/seo/report.mjs', 'utf8');
  assert(!/fetch\(|https?:\/\/(?!chatgpt)/.test(report.replace(/^\/\/.*$/gm, '')) && !/LOCAL = \/bengaluru/.test(report));
});

test('report: several pages for one query are a review candidate; enquiry rows are not orders', () => {
  const dir = exportsFolder({
    'query-pages.csv': 'query,page,clicks,impressions,position\nrose garland,/categories/garlands/rose,1,60,5\nrose garland,/categories/garlands,0,35,9\nlily,/categories/lilies,0,10,4\n',
    'events.csv': 'landing_path,event_name,count\n/categories/garlands/rose,whatsapp_enquiry_click,2\n/,basket_quote_request,oops\n',
  });
  try {
    const text = buildReport({ dir, now: NOW });
    assert(/\*\*rose garland\*\*/.test(text) && /candidate to review, not a finding/.test(text) && !/cannibal/i.test(text));
    assert(/\| \/categories\/garlands\/rose \| 2 \| 0 \| not supplied \|/.test(text) && /1 event row\(s\) had an invalid count/.test(text));
    assert(/not a message sent or an order/.test(text));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
