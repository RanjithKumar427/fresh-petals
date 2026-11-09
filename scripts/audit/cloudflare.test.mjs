// Cloudflare target (DEPLOY_TARGET=cloudflare): the logic that differs from
// Vercel, executed with explicit doubles. Never opens a database or network.
//   node --test scripts/audit/cloudflare.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { sourceLoader } from './source-loader.mjs';
import { withReviewedHashes, policyFirst, metaPolicy, cspProblems, withoutMetaFrameAncestors } from '../build/security-headers.mjs';
import { inlineScriptHash } from '../../src/server/http/inlineScriptHash.mjs';

const cf = (env = {}, extra = {}) => sourceLoader({ globals: { __FP_DEPLOY_TARGET__: 'cloudflare', process: { env }, ...extra } });

test('target: Vercel unless the build defines cloudflare', () => {
  assert.equal(sourceLoader()('src/server/platform/target.ts').DEPLOY_TARGET, 'vercel');
  assert.equal(cf()('src/server/platform/target.ts').DEPLOY_TARGET, 'cloudflare');
});

test('stored photos: Vercel URL unchanged; Cloudflare uses /_image with the same widths', () => {
  const photo = 'https://hjhmetomcaskrrwkgrbp.supabase.co/storage/v1/object/public/media/a.jpg';
  assert.equal(sourceLoader()('src/data/garlandRules.ts').storedPhotoUrl(photo, 480), `/_vercel/image?url=${encodeURIComponent(photo)}&w=480&q=75`);
  assert.equal(cf()('src/data/garlandRules.ts').storedPhotoUrl(photo, 480), `/_image?href=${encodeURIComponent(photo)}&w=480&q=75&f=webp`);
});

test('preview guard: the Cloudflare preview Worker is treated like a Vercel preview', () => {
  const guard = sourceLoader()('src/server/http/requestGuard.ts');
  assert.equal(guard.isPreviewDeployment({ FP_DEPLOY_ENV: 'preview' }), true);
  assert.equal(guard.isPreviewDeployment({ FP_DEPLOY_ENV: 'production' }), false);
  assert.equal(guard.isPreviewDeployment({}), false);
});

test('Cloudflare: a website refresh requests a new build (the storefront is prebuilt), never claims success it cannot confirm', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init }); return { status: 204 }; };
  const env = { FP_PUBLISH_REPOSITORY: 'owner/repo', FP_PUBLISH_GITHUB_TOKEN: 'token' };
  const website = cf(env, { fetch })('src/server/services/GarlandWebsite.ts');
  const ok = await website.refreshWebsite(['occasion-index', 'occasion:birthday']);
  assert.equal(ok.ok, true); assert.equal(ok.method, 'publish');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/owner/repo/dispatches');
  assert.equal(calls[0].init.headers.authorization, 'Bearer token');
  assert.equal(JSON.parse(calls[0].init.body).event_type, 'publish-site');
  assert.equal(website.websiteDelaySeconds(), null, 'no publication deadline is promised on Cloudflare');
  assert.match(ok.message, /^Publishing requested\./); assert.doesNotMatch(ok.message, /\d+ minutes|published/i);

  const refused = cf(env, { fetch: async () => ({ status: 401 }) })('src/server/services/GarlandWebsite.ts');
  const no = await refused.refreshWebsite(['garlands']);
  assert.equal(no.ok, false); assert.match(no.error, /401/); assert.match(no.message, /request failed/); assert.doesNotMatch(no.message, /\d+ minutes/);
  const unconfigured = cf({}, { fetch })('src/server/services/GarlandWebsite.ts');
  const result = await unconfigured.refreshWebsite(['garlands']);
  assert.equal(result.ok, false); assert.equal(result.method, 'publish'); assert.match(result.message, /isn't connected here/);
  assert.equal(calls.length, 1, 'nothing is sent without the dispatch settings');
});

test('Cloudflare: the garland website check says live only for the saved version, pending (no deadline) for an earlier build', async () => {
  const website = cf({}, {})('src/server/services/GarlandWebsite.ts');
  const product = { slug: 'g', status: 'published', updatedAt: 'v2', images: [1], garland: { photoPermission: 'granted', sampleVerified: true, sellingMode: 'enquiry' } };
  const page = (version) => async () => ({ status: 200, text: async () => `<section data-garland-version="${version}">` });
  const live = await website.checkGarlandOnWebsite(product, 'https://x.test', false, page('v2'));
  assert.equal(live.state, 'live');
  // Another edit (v2) saved while a build of v1 ran: the deployed v1 page is not "published" for v2.
  const earlier = await website.checkGarlandOnWebsite(product, 'https://x.test', false, page('v1'));
  assert.equal(earlier.state, 'pending'); assert.match(earlier.message, /earlier version/); assert.doesNotMatch(earlier.message, /\d+ minutes/);
  const missing = await website.checkGarlandOnWebsite(product, 'https://x.test', false, async () => ({ status: 404, text: async () => '' }));
  assert.equal(missing.state, 'pending'); assert.match(missing.message, /when a build that includes this save is deployed/);
});

test('publish state: successful fingerprints cached 30 s per isolate, reads shared, failures never cached or served stale', async () => {
  const { fingerprintCache, PUBLISH_STATE_TTL_MS } = cf({}, {})('src/server/services/Publishing.ts');
  assert.equal(PUBLISH_STATE_TTL_MS, 30_000);
  const A = 'a'.repeat(32), B = 'b'.repeat(32);
  let clock = 1_000, reads = 0, next = A, release;
  const read = () => { reads++; return next === 'wait' ? new Promise((r) => (release = r)) : next instanceof Error ? Promise.reject(next) : Promise.resolve(next); };
  const get = fingerprintCache(read, { now: () => clock });
  assert.equal(await get(), A); assert.equal(await get(), A); assert.equal(reads, 1, 'second request within 30 s reuses the read');
  clock += 29_999; assert.equal(await get(), A); assert.equal(reads, 1);
  clock += 1; next = B; assert.equal(await get(), B); assert.equal(reads, 2, 'expired after 30 s: a fresh read');
  // Concurrent requests share one read in flight.
  clock += 30_000; next = 'wait';
  const all = Promise.all([get(), get(), get()]);
  release(A); assert.deepEqual(await all, [A, A, A]); assert.equal(reads, 3);
  // A failed refresh is not cached and never returns the expired value.
  clock += 30_000; next = new Error('db down');
  await assert.rejects(get(), /db down/); await assert.rejects(get(), /db down/); assert.equal(reads, 5);
  // A malformed fingerprint is a failure, not a success.
  next = 'not-a-fingerprint'; await assert.rejects(get(), /invalid fingerprint/);
  next = 'B'.repeat(32); await assert.rejects(get(), /invalid fingerprint/);
  next = A; assert.equal(await get(), A);
  // A waiting request gives up on a stuck shared read; the next one after it settles reads again.
  clock += 30_000; next = 'wait';
  const slow = fingerprintCache(read, { now: () => clock, waitMs: 20 });
  const first = slow(); await assert.rejects(slow(), /timed out/); release(B); assert.equal(await first, B);
  // The endpoint uses the cache, keeps its contract and never reads the request (so query strings can't bypass it).
  const route = readFileSync('src/pages/api/publish/state.ts', 'utf8');
  assert.match(route, /GET: APIRoute = async \(\) =>/); assert.match(route, /publishedStateFingerprint\(\)/);
  assert.match(route, /JSON\.stringify\(\{ fingerprint \}\)/); assert.match(route, /"cache-control": "no-store", "x-robots-tag": "noindex"/); assert.match(route, /status: 503/);
  // Builds read the database directly, never the cached endpoint.
  assert.match(readFileSync('scripts/cloudflare/build.mjs', 'utf8'), /client\.query\(FINGERPRINT_SQL\)/);
});

test('publishing: one dispatch per write unless a website change already sent it; off Cloudflare nothing', async () => {
  const calls = [];
  const fetch = async (url) => { calls.push(url); return { status: 204 }; };
  const publishing = cf({ FP_PUBLISH_REPOSITORY: 'owner/repo', FP_PUBLISH_GITHUB_TOKEN: 't' }, { fetch })('src/server/services/Publishing.ts');
  assert.equal((await publishing.publishAfterChange('saved')).ok, true);
  assert.equal(await publishing.publishAfterChange('saved', { refresh: { method: 'publish' } }), null);
  assert.equal(calls.length, 1);
  const vercel = sourceLoader({ globals: { process: { env: {} }, fetch } })('src/server/services/Publishing.ts');
  assert.equal(await vercel.publishAfterChange('saved'), null);
  const fingerprint = await import('../../src/server/services/publishFingerprint.mjs');
  for (const table of ['products', 'product_images', 'media', 'product_occasions', 'garland_details']) assert(fingerprint.PUBLISHED_TABLES.includes(table), table);
  for (const table of ['inquiries', 'admin_users']) assert(!fingerprint.PUBLISHED_TABLES.includes(table), table);
  assert.match(fingerprint.FINGERPRINT_SQL, /^select md5\(concat_ws/);
});

test('static storefront: the Worker answers addresses without a file statically, cities by their one address', async () => {
  const fallback = sourceLoader({ globals: { Request, Response } })('src/server/platform/staticFallback.ts');
  for (const path of ['/', '/categories/garlands', '/products/x', '/locations/bangalore', '/zz', '/studio/a']) assert.equal(fallback.servedStatically('GET', path), true, path);
  for (const path of ['/admin', '/admin/login', '/api/inquiries', '/api/publish/state', '/_image', '/garland-enquiry', '/media/a.jpg']) assert.equal(fallback.servedStatically('GET', path), false, path);
  assert.equal(fallback.servedStatically('POST', '/'), false, 'unsafe methods go through the usual checks');
  assert.equal(fallback.cityRedirect('/locations/bangalore'), '/locations/bengaluru');
  assert.equal(fallback.cityRedirect('/locations/Bengaluru/shop'), '/locations/bengaluru/shop');
  assert.equal(fallback.cityRedirect('/locations/bengaluru'), null);
  assert.equal(fallback.cityRedirect('/locations/atlantis'), null);
  assert.equal(fallback.notFoundPage('/products/blue-mountain-grace'), '/unavailable/catalogue');
  assert.equal(fallback.notFoundPage('/products/zz-invented'), '/unavailable/garland');
  assert.equal(fallback.notFoundPage('/zz'), '/404');
  const assets = { fetch: async (request) => new Response(`page ${new URL(request.url).pathname}`, { headers: { 'content-type': 'text/html' } }) };
  const miss = await fallback.staticFallback(new URL('https://x.in/zz?a=1'), 'GET', assets, { 'x-frame-options': 'DENY' });
  assert.equal(miss.status, 404); assert.equal(await miss.text(), 'page /404'); assert.equal(miss.headers.get('x-frame-options'), 'DENY');
  const moved = await fallback.staticFallback(new URL('https://x.in/locations/bangalore?utm_source=a'), 'GET', assets, {});
  assert.equal(moved.status, 301); assert.equal(moved.headers.get('location'), '/locations/bengaluru?utm_source=a');
  const product = await fallback.staticFallback(new URL('https://x.in/products/blue-mountain-grace'), 'GET', assets, {});
  assert.equal(product.status, 404); assert.equal(await product.text(), 'page /unavailable/catalogue');
  const middleware = readFileSync('src/middleware.ts', 'utf8');
  assert(middleware.indexOf('servedStatically(') < middleware.indexOf('const scope = await workerScope()'), 'answered before any database scope');
  // The admin's website checks read the deployed files (a Worker's fetch of its own address runs the Worker, not the assets).
  for (const file of ['src/pages/api/admin/products/[id]/website.ts', 'src/pages/api/admin/products/[id]/occasion-pages.ts']) assert.match(readFileSync(file, 'utf8'), /await siteFetcher\(\)/, file);
  assert.match(readFileSync('src/server/platform/siteFetch.ts', 'utf8'), /assets\.fetch\(new Request\(input, init\)\)/);
  // Astro skips the middleware for an address no route matches, so a catch-all on-demand route makes it run.
  assert.match(readFileSync('src/pages/[...fallback].ts', 'utf8'), /export const prerender = false;[\s\S]*status: 404/);
  // Prebuilt garland pages ask the Worker's /_image for resized copies, never the Storage originals.
  const rules = cf({})('src/data/garlandRules.ts');
  const photo = { path: 'https://wyndmywdtacucojvudxg.supabase.co/storage/v1/object/public/media/products/a.jpg', width: 1200, height: 1600, alt: 'x' };
  assert.deepEqual(rules.garlandPhotoSrcset(photo, 480).split(', '), ['/_image?href=https%3A%2F%2Fwyndmywdtacucojvudxg.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fproducts%2Fa.jpg&w=240&q=75&f=webp 240w', '/_image?href=https%3A%2F%2Fwyndmywdtacucojvudxg.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fproducts%2Fa.jpg&w=480&q=75&f=webp 480w']);
});

test('edge cache: only anonymous public GET/HEAD responses that opt in with s-maxage', async () => {
  const store = new Map();
  const caches = { default: { match: async (r) => store.get(r.url)?.clone(), put: async (r, res) => { store.set(r.url, res); } } };
  const edge = sourceLoader({ globals: { caches, Request, Response, Headers } })('src/server/platform/edgeCache.ts');
  const req = (path, init) => new Request('https://onlyfreshpetals.in' + path, init);
  assert.equal(edge.edgeCacheable(req('/occasions/birthday'), '/occasions/birthday'), true);
  for (const p of ['/admin/dashboard', '/api/inquiries', '/_image', '/media/x.jpg']) assert.equal(edge.edgeCacheable(req(p), p), false, p);
  assert.equal(edge.edgeCacheable(req('/x', { method: 'POST' }), '/x'), false);
  assert.equal(edge.edgeCacheable(req('/x', { headers: { cookie: 'sb-hjh-auth-token.0=abc' } }), '/x'), false);

  const page = () => new Response('page', { headers: { 'cache-control': 'public, max-age=0, s-maxage=120', 'vercel-cache-tag': 'occasion-index,occasion:birthday' } });
  const sent = edge.edgeCacheStore(req('/occasions/birthday?budget=a'), page());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent.headers.get('x-fp-edge-cache'), 'MISS');
  assert.equal(sent.headers.get('vercel-cache-tag'), null);
  assert.equal(store.get('https://onlyfreshpetals.in/occasions/birthday?budget=a').headers.get('cache-tag'), 'occasion-index,occasion:birthday');
  const hit = await edge.edgeCacheMatch(req('/occasions/birthday?budget=a'));
  assert.equal(hit.headers.get('x-fp-edge-cache'), 'HIT'); assert.equal(hit.headers.get('cache-tag'), null);
  assert.equal(hit.headers.get('cache-control'), 'public, max-age=0, s-maxage=120', 'visitors get the original header');
  assert.equal(store.get('https://onlyfreshpetals.in/occasions/birthday?budget=a').headers.get('cache-control'), 'public, max-age=120');
  // Older than its s-maxage: never served, whatever the runtime's cache kept.
  const old = store.get('https://onlyfreshpetals.in/occasions/birthday?budget=a');
  old.headers.set('x-fp-stored-at', String(Date.now() - 121_000));
  assert.equal(await edge.edgeCacheMatch(req('/occasions/birthday?budget=a')), undefined);
  old.headers.set('x-fp-stored-at', String(Date.now()));
  assert.equal(await edge.edgeCacheMatch(req('/occasions/birthday?budget=b')), undefined, 'query string is part of the key');
  assert.equal((await edge.edgeCacheMatch(req('/occasions/birthday?budget=a&utm_source=x&gclid=1'))).headers.get('x-fp-edge-cache'), 'HIT', 'tracking parameters are not part of the key');
  const shop = 'https://x.in/locations/chennai/shop';
  assert.equal(edge.cacheKeyUrl(`${shop}?page=2&utm_medium=a&fbclid=b`), `${shop}?page=2`);
  // Parameters a page doesn't read share its copy (a crawler's ?ref=…, a cache-buster), and order doesn't matter.
  assert.equal(edge.cacheKeyUrl('https://x.in/?ref_1a2b=1&x=9'), 'https://x.in/');
  assert.equal(edge.cacheKeyUrl('https://x.in/?page=7&collection=x&colour=red'), 'https://x.in/', 'names are kept only where a page reads them');
  assert.equal(edge.cacheKeyUrl('https://x.in/locations/chennai?page=7'), 'https://x.in/locations/chennai');
  assert.equal(edge.cacheKeyUrl(`${shop}?page=2&collection=roses&junk=1`), `${shop}?collection=roses&page=2`);
  assert.equal(edge.cacheKeyUrl(`${shop}?collection=roses&page=2`), edge.cacheKeyUrl(`${shop}?page=2&collection=roses`));
  const kept = (path, name) => new URL(edge.cacheKeyUrl(`https://x.in${path}?${name}=v`)).searchParams.get(name) === 'v';
  for (const [path, names] of [
    ['/locations/chennai/shop', ['collection', 'page']],
    ['/categories/garlands', ['unavailable', 'occasion', 'budget', 'colour', 'for']],
    ['/fragments/garlands', ['for', 'occasion']],
    ['/categories/bouquets', ['occasion', 'budget', 'colour', 'for']],
    ['/occasions/birthday', ['occasion', 'budget', 'colour', 'for']],
    ['/garland-enquiry', ['code', 'qty', 'opt', 'occ', 'for', 'city']],
  ]) for (const name of names) assert(kept(path, name), `${path} keeps ${name}`);
  assert(!kept('/categories/bouquets', 'page') && !kept('/products/fp-g001', 'occ') && !kept('/', 'for'));
  assert.equal((await edge.edgeCacheMatch(req('/occasions/birthday?budget=a&cachebuster=123'))).headers.get('x-fp-edge-cache'), 'HIT', 'an unread parameter is not part of the key');

  // A redirect echoing utm_source is never shared under the stripped key.
  const redirect = (loc) => new Response(null, { status: 301, headers: { location: loc, 'cache-control': 'public, max-age=0, s-maxage=120' } });
  edge.edgeCacheStore(req('/categories/bouquets?colour=red&utm_source=x'), redirect('/categories/bouquets?utm_source=x#colour=red'));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.has('https://onlyfreshpetals.in/categories/bouquets?colour=red'), false);
  edge.edgeCacheStore(req('/categories/bouquets?colour=red'), redirect('/categories/bouquets#colour=red'));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal((await edge.edgeCacheMatch(req('/categories/bouquets?colour=red'))).status, 301);
  assert.equal(await edge.edgeCacheMatch(req('/categories/bouquets?colour=red&utm_source=y')), undefined);
  assert.equal(await edge.edgeCacheMatch(req('/categories/bouquets?colour=red&ref=z')), undefined, 'nor to a request with any unread parameter');

  edge.edgeCacheStore(req('/a'), new Response('x', { headers: { 'cache-control': 'public, max-age=0, s-maxage=60', 'set-cookie': 'a=b' } }));
  edge.edgeCacheStore(req('/b'), new Response('x', { headers: { 'cache-control': 'private, no-store' } }));
  edge.edgeCacheStore(req('/c'), new Response('x', { status: 500, headers: { 'cache-control': 'public, s-maxage=60' } }));
  await new Promise((r) => setTimeout(r, 0));
  for (const p of ['/a', '/b', '/c']) assert.equal(store.has('https://onlyfreshpetals.in' + p), false, p);
});

test('upload frame/canvas parsers enforce limits before decoding', async () => {
  const plain = (value) => JSON.parse(JSON.stringify(value)); // objects come from the loader's own realm
  const { gifFrames, webpFrames } = sourceLoader({ mocks: { 'src/server/platform/requestScope.ts': {} } })('src/server/media/imageSafetyCloudflare.ts');
  const frame = (c) => sharp({ create: { width: 30, height: 20, channels: 3, background: c } }).png().toBuffer();
  const frames = await Promise.all(['#f00', '#0f0', '#00f', '#fff'].map(frame));
  const gif = await sharp(frames, { join: { animated: true } }).gif().toBuffer();
  assert.deepEqual(plain(gifFrames(gif)), { frames: 4, width: 30, height: 20 });
  const webp = await sharp(frames, { join: { animated: true } }).webp().toBuffer();
  assert.deepEqual(plain(webpFrames(webp)), { frames: 4, width: 30, height: 20 });
  const still = await sharp({ create: { width: 9, height: 9, channels: 3, background: '#000' } }).webp().toBuffer();
  assert.equal(webpFrames(still).frames, 1);
  assert.equal(gifFrames(Buffer.from('GIF89a')), null);
  assert.equal(webpFrames(Buffer.from('RIFF\x10\x00\x00\x00WEBPJUNK')), null);
});

test('static pages: reviewed inline hashes join the meta policy, which moves before every script', () => {
  const reviewed = '(function(){document.documentElement.dataset.x=1})()';
  const rogue = 'alert(1)';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script data-fp-inline>${reviewed}</script><meta http-equiv="content-security-policy" content="default-src 'self'; script-src 'self'"><script>${rogue}</script></head></html>`;
  const out = policyFirst(withReviewedHashes(html));
  assert(out.indexOf('content-security-policy') < out.indexOf('<script'), 'policy precedes scripts');
  const policy = metaPolicy(out);
  assert(policy.includes(`'${inlineScriptHash(reviewed)}'`));
  assert(!policy.includes(`'${inlineScriptHash(rogue)}'`), 'unmarked script is not hashed');
  assert.deepEqual(cspProblems(out, policy).length, 1, 'the unreviewed inline script still fails the build check');
  const framed = withoutMetaFrameAncestors(`<meta http-equiv="content-security-policy" content="default-src 'self';frame-ancestors 'none';object-src 'none'">`);
  assert.equal(metaPolicy(framed), "default-src 'self';object-src 'none'");
});

test('Images-binding uploads: JPEG and PNG are re-encoded without asking for animation', async () => {
  // A stand-in binding with the real one's rule: animated output only for GIF or WebP (IMAGES_TRANSFORM_ERROR 9401).
  const calls = [];
  const IMAGES = {
    info: async (stream) => { const b = Buffer.from(await new Response(stream).arrayBuffer()); const m = await sharp(b).metadata(); return { format: `image/${m.format}`, width: m.width, height: m.pageHeight ?? m.height, fileSize: b.length }; },
    input: (stream) => ({
      transform() { return this; },
      output: async (opts) => {
        calls.push(opts);
        if (opts.anim && !/gif|webp/.test(opts.format)) throw new Error('IMAGES_TRANSFORM_ERROR 9401: Could not resize the image: Animated output is only supported for GIF or WebP');
        const b = Buffer.from(await new Response(stream).arrayBuffer());
        return { response: () => new Response(b), contentType: () => opts.format };
      },
    }),
  };
  const { sanitizeWithImagesBinding } = sourceLoader({ mocks: { 'src/server/platform/requestScope.ts': { cloudflareEnv: async () => ({ IMAGES }) } }, globals: { Response, ReadableStream, Buffer } })('src/server/media/imageSafetyCloudflare.ts');
  const { sniffImageFormat, safeImageFilename } = sourceLoader({ mocks: { 'src/server/platform/target.ts': { ON_CLOUDFLARE: false } } })('src/server/media/imageSafety.ts');
  const base = sharp({ create: { width: 40, height: 30, channels: 3, background: '#c03' } });
  for (const format of ['jpeg', 'png', 'webp']) {
    const buffer = await base.clone()[format]().toBuffer();
    const result = await sanitizeWithImagesBinding({ buffer, format, filename: `x.${format}` }, { maxPixels: 1e8, maxFrames: 100, maxOutputBytes: 1e7 }, { sniff: sniffImageFormat, filename: safeImageFilename });
    assert.equal(result.ok, true, `${format}: ${result.error ?? ''}`);
    assert.equal(result.image.width, 40);
  }
  assert.deepEqual(calls.map((c) => c.anim === true), [false, false, true]);
});

test('deleting media waits for the Storage object removal (a Worker drops unawaited requests)', () => {
  const source = readFileSync('src/server/services/MediaService.ts', 'utf8');
  const remove = source.slice(source.indexOf('async remove('), source.indexOf('async rename('));
  assert.match(remove, /await getStorageService\(\)\s*\.delete\(media\.path\)/);
  assert.doesNotMatch(remove, /^\s*(?!await)\S*getStorageService\(\)\.delete\(media\.path\)\.catch/m);
});

test('invented garland slugs and codes are refused without reading every garland', () => {
  // Garland pages are static files; an invented /products/<slug> never reaches a route that reads the database.
  const route = readFileSync('src/pages/products/[...garland].astro', 'utf8');
  assert.match(route, /export const prerender = true;/);
  assert.match(route, /export async function getStaticPaths\(\)/);
  const data = readFileSync('src/data/garlands.ts', 'utf8');
  const body = data.slice(data.indexOf('export async function findGarland('), data.indexOf('}', data.indexOf('export async function findGarland(')) + 200);
  assert.match(body, /if \(!\(await garlandMayExist\(\{ slug \}\)\)\) return null;/);
  const catalogue = readFileSync('src/server/services/GarlandCatalogue.ts', 'utf8');
  assert.match(catalogue, /export async function garlandRecordExists[\s\S]*?\.limit\(1\)/);
  // The enquiry reads one design: its row by code (limit 1), then that product's options and one photo row.
  const one = catalogue.slice(catalogue.indexOf('export async function loadGarlandEnquiryRecord'), catalogue.indexOf('let cache'));
  assert.match(one, /\.where\(eq\(garlandDetails\.designCode, code\)\)\s*\.limit\(1\)/);
  assert.equal((one.match(/eq\(product(Options|Images)\.productId, row\.productId\)/g) ?? []).length, 2);
  assert.doesNotMatch(one, /inArray|sellingPrice|extraCharge|description|garlandFilters|productOccasions/);
  assert.doesNotMatch(readFileSync('src/pages/garland-enquiry.ts', 'utf8'), /loadGarlands|findGarlandByCode/);
});

// Garland enquiry (src/pages/garland-enquiry.ts): one design per request, with exactly the answers the
// full catalogue read gave. Records and the bundled catalogue are controlled here; no database.
const enquiryFixture = () => {
  const drafts = JSON.parse(readFileSync('src/data/garlandDrafts.json', 'utf8')).designs;
  // Bundled designs are all unpublished drafts today; two are made visible here so the fallback and
  // the database-over-catalogue precedence are actually exercised.
  const shown = (design) => ({ ...design, published: true, photoPermission: 'granted', sampleVerified: true, hasStoredPhoto: true, options: [{ label: 'Finish', values: ['Plain', { label: 'Gold bands', extraCharge: 400 }] }] });
  const [a, b, c, d, e, f, g] = drafts;
  const bundle = { designs: [shown(a), shown(b), c, d, e, f, g, ...drafts.slice(7)] };
  const img = { url: 'https://x.supabase.co/storage/v1/object/public/media/products/m.jpg', altText: null, width: 600, height: 1200, isPrimary: true };
  const record = (design, over = {}) => ({ productId: 7, designCode: design.code, slug: `${design.slug}-db`, name: `${design.title} (admin)`, shortDescription: 'secret copy', description: null, status: 'published', updatedAt: '2026-11-01T00:00:00.000Z', priceType: 'fixed', sellingPrice: 4500, soldUnit: 'pair', length: null, flowerRecipe: null, thickness: null, finish: null, leadTime: null, substitutionPolicy: null, sellingMode: 'enquiry', readyForSale: false, photoPermission: 'granted', sampleVerified: false, filters: [], occasions: [], options: [{ optionName: 'Finish', valueLabel: 'Pearl tassels', extraCharge: 300 }, { optionName: 'Finish', valueLabel: 'Plain', extraCharge: null }, { optionName: 'Length', valueLabel: '5 ft', extraCharge: null }], images: [img], ...over });
  const records = new Map([
    // b: a stored record that is hidden must never fall back to the visible bundled b.
    [b.code, record(b, { status: 'draft' })],
    [c.code, record(c)],
    [d.code, record(d, { status: 'archived' })],
    [e.code, record(e, { photoPermission: 'unconfirmed' })],
    [f.code, record(f, { images: [] })],
    [g.code, record(g, { sellingMode: 'cart', sampleVerified: false })],
    ['FP-G900', record({ code: 'FP-G900', slug: 'db-only', title: 'Database only' }, { soldUnit: null })],
  ]);
  const calls = { full: 0, one: [] };
  const enquiryRecord = (r) => ({ productId: r.productId, designCode: r.designCode, slug: r.slug, name: r.name, status: r.status, soldUnit: r.soldUnit, sellingMode: r.sellingMode, readyForSale: r.readyForSale, photoPermission: r.photoPermission, sampleVerified: r.sampleVerified, options: r.options.map(({ optionName, valueLabel }) => ({ optionName, valueLabel })), hasPhoto: r.images.length > 0 });
  const catalogue = {
    loadGarlandRecords: async () => { calls.full++; return records; },
    loadGarlandEnquiryRecord: async (code) => { calls.one.push(code); const r = records.get(code); return r ? enquiryRecord(r) : null; },
    garlandRecordExists: async () => true,
  };
  const load = sourceLoader({ globals: { Response, Headers, process: { env: {} } }, mocks: { 'src/data/garlandDrafts.json': bundle, 'src/server/services/GarlandCatalogue.ts': catalogue } });
  return { a, b, c, d, e, f, g, records, calls, catalogue, load };
};

test('garland enquiry lookup reads one design and matches the full catalogue read exactly', async () => {
  const { a, b, c, d, e, f, g, calls, load } = enquiryFixture();
  const garlands = load('src/data/garlands.ts');
  const json = (x) => JSON.parse(JSON.stringify(x));
  for (const code of [a.code, b.code, c.code, d.code, e.code, f.code, g.code, 'FP-G900', 'FP-G999']) {
    const full = (await garlands.loadGarlands()).find((product) => product.garland.code === code) ?? null;
    const before = { full: calls.full, one: calls.one.length };
    const one = await garlands.findGarlandForEnquiry(code);
    assert.equal(calls.full, before.full, `${code}: the enquiry lookup never reads every garland`);
    assert.deepEqual(calls.one.slice(before.one), [code], `${code}: exactly one single-design read`);
    const expected = full && { code: full.garland.code, slug: full.garland.slug, title: full.garland.title, soldUnit: full.garland.soldUnit, options: full.garland.options };
    assert.deepEqual(json(one), json(expected), code);
  }
  // The cases the comparison covers, stated outright.
  assert.equal((await garlands.findGarlandForEnquiry(a.code))?.slug, a.slug, 'no record: the bundled design is the fallback');
  assert.equal(await garlands.findGarlandForEnquiry(b.code), null, 'a hidden record is never resurrected by its visible bundled copy');
  assert.equal((await garlands.findGarlandForEnquiry(c.code))?.title, `${c.title} (admin)`, 'the record wins over the bundled copy');
  for (const hidden of [d, e, f]) assert.equal(await garlands.findGarlandForEnquiry(hidden.code), null, hidden.code);
  assert.equal(await garlands.findGarlandForEnquiry(g.code), null, 'cart mode still needs a verified sample');
  assert.equal((await garlands.findGarlandForEnquiry('FP-G900'))?.slug, 'db-only-db', 'records missing from the bundle are found');
  const shown = await garlands.findGarlandForEnquiry(c.code);
  assert.doesNotMatch(JSON.stringify(shown), /4500|300|secret|extraCharge":[1-9]/, 'no amounts or copy');
  assert.deepEqual(json(shown.options), [{ label: 'Finish', values: [{ label: 'Pearl tassels', extraCharge: null }, { label: 'Plain', extraCharge: null }] }, { label: 'Length', values: [{ label: '5 ft', extraCharge: null }] }]);
});

test('garland enquiry route: redirects, refusals, headers and database failures unchanged', async () => {
  const { a, b, c, calls, catalogue, load } = enquiryFixture();
  const route = load('src/pages/garland-enquiry.ts');
  const site = new URL('https://onlyfreshpetals.in');
  const redirect = (location, status) => new Response(null, { status, headers: { location } });
  const get = (query) => route.GET({ url: new URL(`https://onlyfreshpetals.in/garland-enquiry${query}`), site, redirect });
  const text = (r) => decodeURIComponent(new URL(r.headers.get('location')).searchParams.get('text'));
  const noStore = (r) => r.headers.get('cache-control') === 'no-store' && r.headers.get('x-robots-tag') === 'noindex';

  const ok = await get(`?code=${c.code.toLowerCase()}%20&qty=900&opt=Finish::Pearl%20tassels&opt=Finish::Pearl%20tassels&opt=Finish::Diamonds&opt=Length::5%20ft&occ=wedding&for=gift&city=mumbai&utm_source=x`);
  assert.equal(ok.status, 302);
  assert(ok.headers.get('location').startsWith('https://wa.me/919652012274?text='));
  assert(noStore(ok));
  const message = text(ok);
  assert.match(message, new RegExp(`Design: ${c.code} — ${c.title} \\(admin\\)`));
  assert.match(message, new RegExp(`Link: https://onlyfreshpetals.in/products/${c.slug}-db\\n`));
  assert.match(message, /Quantity: 500 pairs/, 'quantity capped at 500, sold unit named');
  assert.match(message, /Options: Finish: Pearl tassels; Length: 5 ft\n/, 'only existing choices, once each');
  assert.match(message, /Recipient city: Mumbai/);
  assert.match(message, /Occasion: Wedding/);
  assert.match(message, /For: /);
  assert.doesNotMatch(message, /₹|4500|300|Diamonds/);
  assert.match(text(await get(`?code=${c.code}&qty=-3`)), /Quantity: 1 pair\n/);
  assert.match(text(await get(`?code=${c.code}&qty=abc&city=atlantis&occ=nope&for=other`)), /Quantity: 1 pair\n(?![\s\S]*(Recipient city|Occasion:|For:))/);
  assert.match(text(await get(`?code=${a.code}`)), /Single garland or pair/, 'bundled fallback, unit unknown');

  const refused = async (query, location) => {
    const r = await get(query);
    assert.equal(r.status, 303, query);
    assert.equal(r.headers.get('location'), location, query);
    assert(noStore(r), query);
  };
  const reads = calls.one.length;
  await refused('', '/categories/garlands');
  await refused('?code=abc', '/categories/garlands?unavailable=ABC');
  await refused('?code=FP-G1', '/categories/garlands?unavailable=FP-G1');
  assert.equal(calls.one.length, reads, 'a malformed code reads nothing');
  await refused('?code=FP-G999', '/categories/garlands?unavailable=FP-G999');
  await refused(`?code=${b.code}`, `/categories/garlands?unavailable=${b.code}`);
  assert.equal(calls.full, 0, 'the route never reads every garland');

  catalogue.loadGarlandEnquiryRecord = async () => { throw new Error('connection refused'); };
  await assert.rejects(get(`?code=${c.code}`), /connection refused/, 'a database failure is an error, never a WhatsApp redirect');
});

test('the shared cache never looks up or stores /garland-enquiry; other pages unchanged', () => {
  const edge = sourceLoader({ globals: { Request, Response, Headers } })('src/server/platform/edgeCache.ts');
  const req = (p) => new Request(`https://onlyfreshpetals.in${p}`);
  const guard = sourceLoader()('src/server/http/requestGuard.ts');
  for (const p of ['/garland-enquiry?code=FP-G001', '/Garland-Enquiry/?code=FP-G001', '//garland-enquiry']) {
    const path = guard.normalisePath(new URL(`https://onlyfreshpetals.in${p}`).pathname);
    assert.equal(edge.edgeCacheable(req(p), path), false, p);
  }
  for (const p of ['/garland-enquiry-guide', '/categories/garlands', '/occasions/wedding']) assert.equal(edge.edgeCacheable(req(p), p), true, p);
  const middleware = readFileSync('src/middleware.ts', 'utf8');
  assert.match(middleware, /const cacheable = edgeCacheable\(context\.request, path\);\s*if \(cacheable\) \{\s*const hit = await edgeCacheMatch/);
});

test('robots.txt keeps crawlers off parameterised city shop views and the enquiry redirect', () => {
  const robots = readFileSync('src/pages/robots.txt.ts', 'utf8');
  for (const rule of ['Disallow: /locations/*/shop?', 'Disallow: /garland-enquiry', 'Disallow: /categories/*?', 'Disallow: /occasions/*?']) assert(robots.includes(rule), rule);
  assert(!/Disallow: \/locations\/\*\/shop$/m.test(robots), 'the plain city shop stays crawlable');
});

test('publishing workflows: staging and production listen to their own events; production stays off until cutover', async () => {
  const { parse } = await import('yaml');
  const flow = (name) => parse(readFileSync(`.github/workflows/${name}`, 'utf8'));
  const staging = flow('staging-publish.yml');
  const production = flow('production-publish.yml');
  const legacy = flow('cloudflare.yml');
  assert.deepEqual(staging.on.repository_dispatch.types, ['publish-site']);
  assert.deepEqual(production.on.repository_dispatch.types, ['publish-production']);
  assert.deepEqual(legacy.on.repository_dispatch.types, ['rebuild-site']);
  for (const job of Object.values(production.jobs)) assert.match(job.if, /vars\.PRODUCTION_PUBLISH_ENABLED == 'true'/);
  for (const f of [staging, production]) assert.equal(f.concurrency['cancel-in-progress'], false);
  const vars = readFileSync('wrangler.jsonc', 'utf8');
  assert.match(vars, /"FP_PUBLISH_EVENT": "publish-production"/, 'the production Worker sends the production event');
  const stagingVars = vars.slice(vars.indexOf('"staging": {'));
  assert(!/FP_PUBLISH_EVENT/.test(stagingVars), 'staging uses the default publish-site event');
  assert.match(readFileSync('src/server/services/Publishing.ts', 'utf8'), /process\.env\.FP_PUBLISH_EVENT \|\| "publish-site"/);
});

test('stored photos: static copies replace /_image, only referenced files are published, bytes checked against the checksum', async () => {
  const photos = sourceLoader()('src/data/storedPhotos.ts');
  const entries = { 'https://x/a.jpg': { path: '/photos/h-1080.webp', original: '/photos/h.jpg', variants: { 240: '/photos/h-240.webp', 480: '/photos/h-480.webp', 1080: '/photos/h-1080.webp' } } };
  assert.deepEqual(JSON.parse(JSON.stringify(photos.staticPhoto('https://x/a.jpg', 1200, 1600, entries))), { path: '/photos/h-1080.webp', width: 1080, height: 1440, variants: { 240: '/photos/h-240.webp', 480: '/photos/h-480.webp' } });
  assert.equal(photos.staticPhoto('https://x/missing.jpg', 10, 10, entries), null);
  const { mkdtempSync, mkdirSync, writeFileSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = (await import('node:path')).default;
  const root = mkdtempSync(path.join(tmpdir(), 'fp-photos-'));
  const build = await import('../build/stored-photos.mjs');
  const sharp = (await import('sharp')).default;
  const bytes = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#a33' } }).jpeg().toBuffer();
  const sum = (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
  const rows = [{ url: 'https://store/a.jpg', checksum: sum, mime_type: 'image/jpeg', width: 600 }, { url: 'https://store/b.jpg', checksum: 'f'.repeat(64), mime_type: 'image/jpeg', width: 600 }];
  const fetcher = async (url) => (url.endsWith('a.jpg') ? new Response(bytes) : new Response(Buffer.from('tampered')));
  const counts = await build.prepareStoredPhotos(rows, { root, sourceDirs: [], fetcher, log: () => {} });
  assert.deepEqual(counts, { cached: 0, local: 0, downloaded: 1, unavailable: 1 }, 'a download that does not match its checksum is refused');
  const manifest = JSON.parse((await import('node:fs')).readFileSync(path.join(root, build.PHOTO_MANIFEST_FILE), 'utf8'));
  assert.deepEqual(Object.keys(manifest), ['https://store/a.jpg']);
  assert.deepEqual(Object.keys(manifest['https://store/a.jpg'].variants), ['240', '480'], 'never wider than the original');
  const out = path.join(root, 'dist');
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'page.html'), `<img src="/photos/${sum}-480.webp">`);
  const copied = build.copyReferencedPhotos(out, root);
  assert.equal(copied.copied, 1);
  assert(existsSync(path.join(out, 'photos', `${sum}-480.webp`)) && !existsSync(path.join(out, 'photos', `${sum}-240.webp`)), 'an unreferenced photo file is not published');

  // An admin upload without a recorded checksum still gets a static copy, keyed by its real bytes
  // (otherwise its page keeps /_image and the build's output check refuses every build).
  const upload = await sharp({ create: { width: 500, height: 500, channels: 3, background: '#3a3' } }).png().toBuffer();
  const uploadSum = (await import('node:crypto')).createHash('sha256').update(upload).digest('hex');
  const root2 = mkdtempSync(path.join(tmpdir(), 'fp-photos-'));
  const noSum = await build.prepareStoredPhotos([{ url: 'https://store/u.png', checksum: null, mime_type: 'image/png', width: 500 }, { url: 'https://store/gone.png', checksum: null, mime_type: 'image/png', width: 500 }], { root: root2, sourceDirs: [], fetcher: async (url) => (url.endsWith('u.png') ? new Response(upload) : new Response('', { status: 404 })), log: () => {} });
  assert.deepEqual(noSum, { cached: 0, local: 0, downloaded: 1, unavailable: 1 });
  const manifest2 = JSON.parse((await import('node:fs')).readFileSync(path.join(root2, build.PHOTO_MANIFEST_FILE), 'utf8'));
  assert.deepEqual(Object.keys(manifest2), ['https://store/u.png']);
  assert.equal(manifest2['https://store/u.png'].original, `/photos/${uploadSum}.png`);
  assert.match(build.STORED_PHOTOS_SQL, /case when checksum/); assert.doesNotMatch(build.STORED_PHOTOS_SQL, /where[^;]*and checksum ~/);
});

test('media upload records the SHA-256 of the stored bytes (the build keys static photo copies by it)', async () => {
  const stored = Buffer.from('sanitised image bytes');
  let created = null;
  const media = sourceLoader({ mocks: {
    'src/server/db/repositories/MediaRepository.ts': { MediaRepository: { create: async (input) => (created = input, { id: 1, ...input }) } },
    'src/server/storage': { getStorageService: () => ({ put: async () => ({ path: 'products/x.png', url: 'https://s/x.png', sizeBytes: stored.length }), delete: async () => {} }) },
    'src/server/media/imageSafety.ts': { sanitizeImage: async () => ({ ok: true, image: { buffer: stored, filename: 'x.png', mimeType: 'image/png', width: 10, height: 10 } }) },
  }, globals: { crypto: globalThis.crypto } })('src/server/services/MediaService.ts').MediaService;
  const result = await media.upload({ buffer: Buffer.from('raw upload'), filename: 'x.png', mimeType: 'image/png', folder: 'products' });
  assert.equal(result.ok, true);
  assert.equal(created.checksum, (await import('node:crypto')).createHash('sha256').update(stored).digest('hex'));
});
