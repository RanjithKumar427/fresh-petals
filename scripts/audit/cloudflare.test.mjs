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
  assert.equal(website.websiteDelaySeconds(), 25 * 60, 'the admin is told the publishing bound');

  const refused = cf(env, { fetch: async () => ({ status: 401 }) })('src/server/services/GarlandWebsite.ts');
  const no = await refused.refreshWebsite(['garlands']);
  assert.equal(no.ok, false); assert.match(no.error, /401/); assert.match(no.message, /scheduled publishing check/);
  const unconfigured = cf({}, { fetch })('src/server/services/GarlandWebsite.ts');
  const result = await unconfigured.refreshWebsite(['garlands']);
  assert.equal(result.ok, false); assert.equal(result.method, 'publish'); assert.match(result.message, /isn't connected here/);
  assert.equal(calls.length, 1, 'nothing is sent without the dispatch settings');
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
  for (const fn of ['findGarland(', 'findGarlandByCode(']) {
    const body = data.slice(data.indexOf(`export async function ${fn}`), data.indexOf('}', data.indexOf(`export async function ${fn}`)) + 200);
    assert.match(body, /if \(!\(await garlandMayExist\(\{ (slug|code) \}\)\)\) return null;/, fn);
  }
  const catalogue = readFileSync('src/server/services/GarlandCatalogue.ts', 'utf8');
  assert.match(catalogue, /export async function garlandRecordExists[\s\S]*?\.limit\(1\)/);
});

test('robots.txt keeps crawlers off parameterised city shop views and the enquiry redirect', () => {
  const robots = readFileSync('src/pages/robots.txt.ts', 'utf8');
  for (const rule of ['Disallow: /locations/*/shop?', 'Disallow: /garland-enquiry', 'Disallow: /categories/*?', 'Disallow: /occasions/*?']) assert(robots.includes(rule), rule);
  assert(!/Disallow: \/locations\/\*\/shop$/m.test(robots), 'the plain city shop stays crawlable');
});
