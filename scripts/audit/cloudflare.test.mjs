// Cloudflare target (DEPLOY_TARGET=cloudflare): the logic that differs from
// Vercel, executed with explicit doubles. Never opens a database or network.
//   node --test scripts/audit/cloudflare.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { sourceLoader } from './source-loader.mjs';
import { withReviewedHashes, policyFirst, metaPolicy, cspProblems } from '../build/security-headers.mjs';
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

test('purge on Cloudflare: zone purge by tag, never claims success it cannot confirm', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ success: true }) }; };
  const env = { CF_ZONE_ID: 'zone123', CF_CACHE_PURGE_TOKEN: 'token' };
  const website = cf(env, { fetch })('src/server/services/GarlandWebsite.ts');
  const ok = await website.refreshWebsite(['occasion-index', 'occasion:birthday']);
  assert.equal(ok.ok, true); assert.equal(ok.method, 'cloudflare');
  assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/zones/zone123/purge_cache');
  assert.equal(calls[0].init.headers.authorization, 'Bearer token');
  assert.deepEqual(JSON.parse(calls[0].init.body), { tags: ['occasion-index', 'occasion:birthday'] });

  const refused = cf(env, { fetch: async () => ({ ok: true, status: 200, json: async () => ({ success: false }) }) })('src/server/services/GarlandWebsite.ts');
  assert.equal((await refused.refreshWebsite(['garlands'])).ok, false);
  const unconfigured = cf({}, { fetch })('src/server/services/GarlandWebsite.ts');
  const result = await unconfigured.refreshWebsite(['garlands']);
  assert.equal(result.ok, false); assert.match(result.error, /isn't configured/);
  const preview = cf({ FP_DEPLOY_ENV: 'preview' }, { fetch })('src/server/services/GarlandWebsite.ts');
  assert.equal((await preview.refreshWebsite(['garlands'])).method, 'none');
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
  assert.equal(edge.cacheKeyUrl('https://x.in/p?page=2&utm_medium=a&fbclid=b'), 'https://x.in/p?page=2');

  // A redirect echoing utm_source is never shared under the stripped key.
  const redirect = (loc) => new Response(null, { status: 301, headers: { location: loc, 'cache-control': 'public, max-age=0, s-maxage=120' } });
  edge.edgeCacheStore(req('/categories/bouquets?colour=red&utm_source=x'), redirect('/categories/bouquets?utm_source=x#colour=red'));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.has('https://onlyfreshpetals.in/categories/bouquets?colour=red'), false);
  edge.edgeCacheStore(req('/categories/bouquets?colour=red'), redirect('/categories/bouquets#colour=red'));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal((await edge.edgeCacheMatch(req('/categories/bouquets?colour=red'))).status, 301);
  assert.equal(await edge.edgeCacheMatch(req('/categories/bouquets?colour=red&utm_source=y')), undefined);

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
});
