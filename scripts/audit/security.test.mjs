// Security regressions (16–17 October 2026 hardening). Source-level: the real
// middleware, AuthService, request guard, body readers, image sanitizer and
// CSP check run here; Supabase Auth, the database and storage are replaced
// by explicit doubles at their boundaries. Nothing opens a network or
// database connection. Run: node --test scripts/audit/security.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sourceLoader } from './source-loader.mjs';
import { cspProblems, inlineScripts, scriptSources } from '../build/security-headers.mjs';
import { CSP_DIRECTIVES, SECURITY_HEADERS } from '../../src/server/http/securityHeaders.mjs';

const web = { Response, Request, Headers, ReadableStream, TextDecoder, TextEncoder, FormData, Blob, File, Buffer, process };
const load = sourceLoader({ globals: web });
const guard = load('src/server/http/requestGuard.ts');
const body = load('src/server/http/body.ts');

const ORIGIN = 'https://onlyfreshpetals.in';
const headers = (init) => new Headers(init);

// ---------------------------------------------------------------- request guard

test('request guard: unsafe requests must come from this exact origin (Origin and Fetch Metadata)', () => {
  const reason = (init) => guard.crossOriginReason(headers(init), ORIGIN);
  assert.equal(reason({ origin: ORIGIN, 'sec-fetch-site': 'same-origin' }), null);
  assert.equal(reason({ origin: ORIGIN }), null);
  assert.equal(reason({ 'sec-fetch-site': 'same-origin' }), null);
  assert.equal(reason({ origin: 'https://evil.example' }), 'cross-origin');
  assert.equal(reason({ origin: 'https://onlyfreshpetals.in.evil.example' }), 'cross-origin');
  assert.equal(reason({ origin: 'http://onlyfreshpetals.in' }), 'cross-origin');
  assert.equal(reason({ origin: 'https://www.onlyfreshpetals.in' }), 'cross-origin');
  assert.equal(reason({ origin: 'null' }), 'cross-origin');
  assert.equal(reason({ origin: ORIGIN, 'sec-fetch-site': 'cross-site' }), 'sec-fetch-site cross-site');
  assert.equal(reason({ origin: ORIGIN, 'sec-fetch-site': 'same-site' }), 'sec-fetch-site same-site');
  assert.equal(reason({}), 'no origin');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) assert.equal(guard.isUnsafeMethod(method), true, method);
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(guard.isUnsafeMethod(method), false, method);
});

test('request guard: declared size and body type per route; body-less posts pass', () => {
  const problem = (p, init) => guard.bodyProblem(p, headers(init));
  assert.equal(problem('/api/inquiries', { 'content-type': 'application/json', 'content-length': '200' }), null);
  assert.deepEqual({ ...problem('/api/inquiries', { 'content-type': 'text/plain', 'content-length': '20' }) }, { status: 415, error: 'Unsupported request body type.' });
  assert.equal(problem('/api/inquiries', { 'content-type': 'application/json', 'content-length': String(33 * 1024) }).status, 413);
  assert.equal(problem('/api/inquiries', { 'content-type': 'application/json', 'content-length': 'abc' }).status, 413);
  assert.equal(problem('/api/admin/products/7', { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '20' }).status, 415);
  assert.equal(problem('/api/admin/products/7', { 'content-type': 'application/json; charset=utf-8', 'content-length': String(200 * 1024) }), null);
  assert.equal(problem('/api/admin/media', { 'content-type': 'multipart/form-data; boundary=x', 'content-length': '4000000' }), null);
  assert.equal(problem('/api/admin/media', { 'content-type': 'multipart/form-data; boundary=x', 'content-length': '4600000' }).status, 413);
  assert.equal(problem('/api/admin/media', { 'content-type': 'application/json', 'content-length': '10' }).status, 415);
  assert.equal(problem('/api/admin/auth/login', { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '60' }), null);
  assert.equal(problem('/api/admin/auth/login', { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '9000' }).status, 413);
  assert.equal(problem('/admin/products/new', { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '0' }), null);
  assert.equal(problem('/api/admin/garlands/refresh', {}), null);
  assert.equal(problem('/api/inquiries', { 'transfer-encoding': 'chunked' }).status, 415);
});

test('request guard: preview deployments refuse every admin/Auth route and the enquiry log, nothing else', () => {
  assert.equal(guard.isPreviewDeployment({ VERCEL_ENV: 'preview' }), true);
  assert.equal(guard.isPreviewDeployment({ VERCEL_ENV: 'production' }), false);
  assert.equal(guard.isPreviewDeployment({}), false);
  for (const p of ['/admin', '/admin/login', '/admin/reset-password', '/api/admin/auth/recovery-session', '/api/admin/auth/login', '/api/admin/products', '/api/inquiries']) {
    assert.equal(guard.blockedOnPreview(guard.normalisePath(p)), true, p);
  }
  for (const p of ['/', '/products/red-affair', '/api/delivery/check', '/garland-enquiry', '/categories/garlands', '/cart']) {
    assert.equal(guard.blockedOnPreview(guard.normalisePath(p)), false, p);
  }
  assert.equal(guard.normalisePath('/Admin//Login/'), '/admin/login');
  assert.equal(guard.normalisePath('/API/admin/'), '/api/admin');
});

// ---------------------------------------------------------------- bounded bodies

const streamOf = (chunks) => new ReadableStream({ pull(controller) { const next = chunks.shift(); next ? controller.enqueue(next) : controller.close(); } });

test('bounded bodies: the stream is held to the limit even without (or with a false) Content-Length', async () => {
  const chunk = new Uint8Array(16 * 1024).fill(97);
  let pulled = 0;
  const endless = new ReadableStream({ pull(controller) { pulled += 1; controller.enqueue(chunk); } });
  const chunked = new Request(`${ORIGIN}/api/inquiries`, { method: 'POST', body: endless, duplex: 'half', headers: { 'content-type': 'application/json' } });
  await assert.rejects(body.readJson(chunked, 32 * 1024), (error) => error.status === 413);
  assert(pulled <= 4, `stopped reading after the limit (${pulled} chunks)`);

  const lying = new Request(`${ORIGIN}/api/inquiries`, { method: 'POST', body: streamOf([chunk, chunk, chunk]), duplex: 'half', headers: { 'content-type': 'application/json', 'content-length': '10' } });
  await assert.rejects(body.readBodyBytes(lying, 32 * 1024), (error) => error.status === 413);

  const declared = new Request(`${ORIGIN}/x`, { method: 'POST', body: 'x', headers: { 'content-type': 'application/json', 'content-length': '999999' } });
  await assert.rejects(body.readBodyBytes(declared, 1024), (error) => error.status === 413);
});

test('bounded bodies: JSON must be declared JSON and valid; forms must be form encoded', async () => {
  const req = (contentType, payload) => new Request(`${ORIGIN}/x`, { method: 'POST', body: payload, headers: { 'content-type': contentType } });
  assert.deepEqual(JSON.parse(JSON.stringify(await body.readJson(req('application/json', '{"a":1}'), 1024))), { a: 1 });
  await assert.rejects(body.readJson(req('text/plain', '{"a":1}'), 1024), (error) => error.status === 415);
  await assert.rejects(body.readJson(req('application/x-www-form-urlencoded', 'a=1'), 1024), (error) => error.status === 415);
  await assert.rejects(body.readJson(req('application/json', '{"a":'), 1024), (error) => error.status === 400);
  await assert.rejects(body.readJson(req('application/json', new Uint8Array([0x7b, 0xff, 0x7d])), 1024), (error) => error.status === 400);
  const form = await body.readForm(req('application/x-www-form-urlencoded', 'email=a%40b.c&x=1'), 1024);
  assert.equal(form.get('email'), 'a@b.c');
  await assert.rejects(body.readForm(req('application/json', '{}'), 1024), (error) => error.status === 415);
  const response = await body.jsonBody(req('application/json', '[1,2]'), 1024);
  assert.equal(response.status, 400);
});

// ---------------------------------------------------------------- middleware

function middlewareHarness({ access, env = {}, onResolve } = {}) {
  const calls = { resolve: 0, next: 0 };
  const AuthService = {
    resolveAccess: async () => {
      calls.resolve += 1;
      onResolve?.();
      if (access instanceof Error) throw access;
      return access ?? { state: 'none', hadSession: false, unapproved: false };
    },
  };
  const processDouble = { ...process, env: { ...env } };
  const { onRequest } = sourceLoader({
    globals: { ...web, process: processDouble },
    mocks: {
      'astro:middleware': { defineMiddleware: (fn) => fn },
      'src/server/services/AuthService.ts': { AuthService },
    },
  })('src/middleware.ts');
  async function run(pathname, { method = 'GET', headers: h = {}, body: b, nextResponse } = {}) {
    const url = new URL(pathname, ORIGIN);
    const request = new Request(url, { method, headers: h, ...(b !== undefined ? { body: b } : {}) });
    const deleted = [];
    const context = {
      url,
      request,
      locals: {},
      cookies: { delete: (name) => deleted.push(name), set() {} },
      redirect: (location, status = 302) => new Response(null, { status, headers: { location } }),
    };
    const response = await onRequest(context, async () => {
      calls.next += 1;
      return nextResponse ? nextResponse() : new Response('handler', { status: 200 });
    });
    return { response, context, deleted };
  }
  return { run, calls };
}

const admin = { id: '00000000-0000-4000-8000-000000000001', email: 'owner@example.test', role: 'admin' };

test('middleware: anonymous and first-factor sessions are refused on every protected admin API and page', async () => {
  const anon = middlewareHarness();
  const api = await anon.run('/api/admin/products');
  assert.equal(api.response.status, 401);
  assert.equal(anon.calls.next, 0);
  assert.equal(api.response.headers.get('cache-control'), 'private, no-store, max-age=0');
  const pageResult = await anon.run('/admin/dashboard');
  assert.equal(pageResult.response.status, 302);
  assert.match(pageResult.response.headers.get('location'), /^\/admin\/login\?next=/);

  const mfa = middlewareHarness({ access: { state: 'mfa', admin, hasVerifiedFactor: true } });
  assert.equal((await mfa.run('/api/admin/products')).response.status, 403);
  assert.equal((await mfa.run('/api/admin/media', { method: 'POST', headers: { origin: ORIGIN } })).response.status, 403);
  assert.match((await mfa.run('/admin/products')).response.headers.get('location'), /^\/admin\/mfa\?next=/);
  const mfaPage = await mfa.run('/admin/mfa');
  assert.equal(mfaPage.response.status, 200);
  assert.equal(mfaPage.context.locals.pendingAdmin.id, admin.id);
  assert.equal(mfa.calls.next, 1, 'only the two-step page itself was rendered');

  const full = middlewareHarness({ access: { state: 'full', admin } });
  const ok = await full.run('/api/admin/products');
  assert.equal(ok.response.status, 200);
  assert.equal(ok.context.locals.admin.id, admin.id);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(ok.response.headers.get(name), value, name);
  assert.equal(ok.response.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('middleware: an Auth or database outage fails closed with 503 and keeps the session cookies', async () => {
  const outage = new Error('unavailable');
  outage.name = 'AuthUnavailableError';
  const h = middlewareHarness({ access: outage });
  const api = await h.run('/api/admin/products', { headers: { cookie: 'sb-x-auth-token=abc' } });
  assert.equal(api.response.status, 503);
  assert.equal((await api.response.json()).ok, false);
  assert.deepEqual(api.deleted, []);
  const pageResult = await h.run('/admin/dashboard');
  assert.equal(pageResult.response.status, 503);
  assert.match(pageResult.response.headers.get('content-type'), /text\/html/);
  assert.equal(h.calls.next, 0);
});

test('middleware: cross-origin and fetch-metadata failures are refused before authentication or any handler', async () => {
  const h = middlewareHarness({ access: { state: 'full', admin } });
  const cases = [
    ['/api/admin/products/7', 'PATCH', { origin: 'https://evil.example', 'content-type': 'application/json' }, '{}'],
    ['/api/admin/products/7', 'DELETE', { origin: 'https://evil.example' }],
    ['/api/admin/media', 'POST', { 'sec-fetch-site': 'cross-site', origin: ORIGIN }],
    ['/admin/products/new', 'POST', { origin: 'null', 'content-type': 'application/x-www-form-urlencoded' }, ''],
    ['/api/inquiries', 'POST', { 'content-type': 'application/json' }, '{}'],
    ['/api/admin/auth/login', 'POST', { origin: 'https://evil.example', 'content-type': 'application/x-www-form-urlencoded' }, 'email=a'],
  ];
  for (const [p, method, init, payload] of cases) {
    const { response } = await h.run(p, { method, headers: init, body: payload });
    assert.equal(response.status, 403, `${method} ${p}`);
  }
  assert.equal(h.calls.resolve, 0);
  assert.equal(h.calls.next, 0);
});

test('middleware: oversized or wrongly typed bodies are refused before any handler; same-origin JSON passes', async () => {
  const h = middlewareHarness({ access: { state: 'full', admin } });
  const big = await h.run('/api/inquiries', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'content-length': String(64 * 1024) }, body: 'x' });
  assert.equal(big.response.status, 413);
  const plain = await h.run('/api/inquiries', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(plain.response.status, 415);
  assert.equal(h.calls.next, 0);
  const good = await h.run('/api/delivery/check', { method: 'POST', headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: '{"pincode":"560018"}' });
  assert.equal(good.response.status, 200);
  assert.equal(h.calls.resolve, 0, 'public routes never consult admin access');
});

test('middleware: GET and HEAD reach handlers without origin checks; public responses get the security headers', async () => {
  const h = middlewareHarness();
  for (const method of ['GET', 'HEAD']) {
    const { response } = await h.run('/categories/garlands', { method });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), null, 'public caching untouched');
  }
});

test('middleware: preview deployments stop admin, Auth (including GET recovery links) and enquiry logging before anything runs', async () => {
  const h = middlewareHarness({ env: { VERCEL_ENV: 'preview' }, access: { state: 'full', admin } });
  for (const [p, method] of [
    ['/admin/reset-password?code=abc', 'GET'],
    ['/admin/login', 'GET'],
    ['/api/admin/auth/recovery-session', 'POST'],
    ['/api/admin/auth/login', 'POST'],
    ['/api/admin/products', 'GET'],
    ['/api/inquiries', 'POST'],
  ]) {
    const { response } = await h.run(p, { method, headers: { origin: ORIGIN, 'content-type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) });
    assert.equal(response.status, 403, `${method} ${p}`);
  }
  assert.equal(h.calls.resolve, 0);
  assert.equal(h.calls.next, 0);
  assert.equal((await h.run('/products/red-affair')).response.status, 200);
  assert.equal((await h.run('/api/delivery/check', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{}' })).response.status, 200);
  assert.equal((await h.run('/garland-enquiry?code=FP-G106')).response.status, 200);
});

test('middleware: separate Set-Cookie headers survive, including on immutable redirect responses', async () => {
  const h = middlewareHarness({ access: { state: 'full', admin } });
  const { response } = await h.run('/admin/dashboard', {
    nextResponse: () => {
      const r = Response.redirect(`${ORIGIN}/admin/products`, 302);
      return r;
    },
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  const withCookies = await h.run('/admin/dashboard', {
    nextResponse: () => {
      const r = new Response('ok');
      r.headers.append('set-cookie', 'a=1; Path=/; HttpOnly');
      r.headers.append('set-cookie', 'b=2; Path=/; HttpOnly');
      return r;
    },
  });
  assert.deepEqual(withCookies.response.headers.getSetCookie(), ['a=1; Path=/; HttpOnly', 'b=2; Path=/; HttpOnly']);
});

// ---------------------------------------------------------------- AuthService

function authHarness({ user, userError = null, claims, claimsError = null, row, rowError } = {}) {
  const log = { signOut: 0, deleted: [] };
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: user ?? null }, error: userError }),
      getClaims: async () => ({ data: claims ? { claims } : null, error: claimsError }),
      signOut: async () => { log.signOut += 1; },
    },
  };
  const { AuthService, AuthUnavailableError } = sourceLoader({
    globals: web,
    mocks: {
      'src/server/auth/supabaseServerClient.ts': { createSupabaseServerClient: () => supabase },
      'src/server/db/repositories/AdminUserRepository.ts': {
        AdminUserRepository: { findById: async () => { if (rowError) throw rowError; return row ?? null; }, touchLastLogin: async () => {} },
        isApprovedAdmin: (r) => !!r && r.role === 'admin',
      },
    },
  })('src/server/services/AuthService.ts');
  const request = new Request(`${ORIGIN}/admin/dashboard`, { headers: { cookie: 'sb-proj-auth-token=x; other=1' } });
  const cookies = { delete: (name) => log.deleted.push(name), set() {} };
  return { access: () => AuthService.resolveAccess(request, cookies), log, AuthUnavailableError };
}

test('AuthService: approved UUID + verified aal2 is full; aal1 is mfa; unapproved or mismatched identities are none', async () => {
  const user = { id: admin.id, factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] };
  assert.equal((await authHarness({ user, claims: { sub: admin.id, aal: 'aal2' }, row: admin }).access()).state, 'full');
  const first = await authHarness({ user, claims: { sub: admin.id, aal: 'aal1' }, row: admin }).access();
  assert.equal(first.state, 'mfa');
  assert.equal(first.hasVerifiedFactor, true);
  const unapproved = authHarness({ user, claims: { sub: admin.id, aal: 'aal2' }, row: { ...admin, role: 'viewer' } });
  assert.deepEqual({ ...(await unapproved.access()) }, { state: 'none', hadSession: true, unapproved: true });
  assert.equal(unapproved.log.signOut, 1);
  const mismatch = authHarness({ user, claims: { sub: 'someone-else', aal: 'aal2' }, row: admin });
  assert.equal((await mismatch.access()).state, 'none');
  assert.deepEqual(mismatch.log.deleted, ['sb-proj-auth-token']);
  const invalid = authHarness({ userError: { name: 'AuthApiError', status: 401 }, row: admin });
  assert.equal((await invalid.access()).state, 'none');
});

test('AuthService: Auth or database outages throw AuthUnavailableError and keep cookies (never approval)', async () => {
  const user = { id: admin.id, factors: [] };
  for (const setup of [
    { userError: { name: 'AuthRetryableFetchError', status: 0 } },
    { userError: { name: 'AuthApiError', status: 503 } },
    { user, claimsError: { name: 'AuthRetryableFetchError', status: 502 } },
    { user, claims: { sub: admin.id, aal: 'aal2' }, rowError: new Error('ECONNRESET') },
  ]) {
    const h = authHarness(setup);
    await assert.rejects(h.access(), (error) => error.name === 'AuthUnavailableError');
    assert.deepEqual(h.log.deleted, []);
    assert.equal(h.log.signOut, 0);
  }
});

// ---------------------------------------------------------------- uploads

const { sanitizeImage, sniffImageFormat, safeImageFilename, MAX_INPUT_BYTES } = sourceLoader({ globals: web, mocks: { sharp } })('src/server/media/imageSafety.ts');

/** An animated GIF/WebP of `count` square frames of side `size`. */
async function animation(format, count, size) {
  const frames = await Promise.all(Array.from({ length: count }, (_, i) => sharp({ create: { width: size, height: size, channels: 4, background: { r: (i * 37) % 256, g: 80, b: 120, alpha: 1 } } }).png().toBuffer()));
  return sharp(frames, { join: { animated: true } }).toFormat(format).toBuffer();
}

async function photo(format = 'jpeg', { width = 64, height = 48, exif = true } = {}) {
  let image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 90 } } });
  if (exif && format === 'jpeg') image = image.withMetadata({ exif: { IFD0: { Copyright: 'secret-camera-owner', Artist: 'GPS 12.97,77.59' } } });
  return image.toFormat(format).toBuffer();
}

test('uploads: a valid JPEG is re-encoded without metadata or trailing payload, under a derived name', async () => {
  const original = await photo('jpeg');
  assert(original.includes(Buffer.from('secret-camera-owner')), 'fixture carries EXIF');
  const payload = Buffer.concat([original, Buffer.from('<script>alert(1)</script>')]);
  const result = await sanitizeImage({ buffer: payload, declaredMime: 'image/jpeg', filename: 'My Photo (1).JPEG' });
  assert.equal(result.ok, true, result.error);
  const out = result.image;
  assert.equal(out.mimeType, 'image/jpeg');
  assert.equal(out.filename, 'my-photo-1.jpg');
  assert.equal(out.width, 64);
  assert.equal(out.height, 48);
  assert(!out.buffer.includes(Buffer.from('<script>')), 'trailing payload removed');
  assert(!out.buffer.includes(Buffer.from('secret-camera-owner')), 'EXIF removed');
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.exif, undefined);
  assert.equal(meta.format, 'jpeg');
  assert.equal(out.buffer.subarray(-2).toString('hex'), 'ffd9', 'ends at the JPEG end marker');
});

test('uploads: disguised, mismatched, empty, corrupt and oversized files are refused', async () => {
  const refuse = async (buffer, declaredMime, filename = 'x.jpg') => {
    const result = await sanitizeImage({ buffer, declaredMime, filename });
    assert.equal(result.ok, false, `${declaredMime} ${filename} should be refused`);
    return result.error;
  };
  await refuse(Buffer.from('<!doctype html><script>alert(1)</script>'), 'image/jpeg', 'photo.jpg');
  await refuse(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'image/svg+xml', 'logo.svg');
  await refuse(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/png', 'logo.png');
  assert.match(await refuse(await photo('png'), 'image/jpeg', 'really-a-png.jpg'), /match/);
  await refuse(Buffer.alloc(0), 'image/jpeg');
  const jpeg = await photo('jpeg', { width: 400, height: 300 });
  await refuse(jpeg.subarray(0, Math.floor(jpeg.length / 2)), 'image/jpeg', 'truncated.jpg');
  const corrupt = Buffer.from(jpeg);
  corrupt.fill(0x00, 200, 600);
  const corruptResult = await sanitizeImage({ buffer: corrupt, declaredMime: 'image/jpeg', filename: 'c.jpg' });
  if (corruptResult.ok) assert.equal((await sharp(corruptResult.image.buffer).metadata()).format, 'jpeg', 'decodable damage is re-encoded, never stored raw');
  assert.match(await refuse(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_INPUT_BYTES)]), 'image/jpeg'), /4 MB/);
  assert.equal(sniffImageFormat(Buffer.from('GIF89a')), 'gif');
  assert.equal(sniffImageFormat(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(sniffImageFormat(Buffer.from('<svg')), null);
  assert.equal(safeImageFilename('../../etc/passwd.php', 'png'), 'etc-passwd.png');
  assert.equal(safeImageFilename('', 'webp'), 'image.webp');
});

test('uploads: decompression bombs (pixels) and frame bombs are refused before decoding', async () => {
  const bomb = await sharp({ create: { width: 8000, height: 6000, channels: 3, background: '#ffffff' } }).png({ compressionLevel: 9 }).toBuffer();
  assert(bomb.length < MAX_INPUT_BYTES, `bomb is small on disk (${bomb.length} bytes)`);
  const big = await sanitizeImage({ buffer: bomb, declaredMime: 'image/png', filename: 'bomb.png' });
  assert.equal(big.ok, false);
  const animated = await animation('gif', 120, 4);
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 120);
  const result = await sanitizeImage({ buffer: animated, declaredMime: 'image/gif', filename: 'many.gif' });
  assert.equal(result.ok, false);
  assert.match(result.error, /frames/);
});

test('uploads: supported animation is preserved (GIF and WebP)', async () => {
  for (const [format, mime] of [['gif', 'image/gif'], ['webp', 'image/webp']]) {
    const animated = await animation(format, 3, 8);
    const result = await sanitizeImage({ buffer: animated, declaredMime: mime, filename: `spin.${format}` });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.image.frames, 3);
    assert.equal((await sharp(result.image.buffer, { animated: true }).metadata()).pages, 3);
    assert.equal(result.image.height, 8);
  }
});

test('uploads: MediaService stores only the sanitised image, and nothing at all for a refused file', async () => {
  const puts = [];
  const created = [];
  const { MediaService } = sourceLoader({
    globals: web,
    mocks: {
      sharp,
      'src/server/storage': { getStorageService: () => ({ put: async (input) => { puts.push(input); return { path: `products/${input.filename}`, url: `/media/${input.filename}`, sizeBytes: input.buffer.byteLength }; }, delete: async () => {} }) },
      'src/server/db/repositories/MediaRepository.ts': { MediaRepository: { create: async (row) => { created.push(row); return { id: 1, ...row }; } } },
    },
  })('src/server/services/MediaService.ts');
  const refused = await MediaService.upload({ buffer: Buffer.from('<html>'), filename: 'x.jpg', mimeType: 'image/jpeg', folder: 'products' });
  assert.equal(refused.ok, false);
  assert.equal(puts.length, 0);
  const jpeg = await photo('jpeg');
  const ok = await MediaService.upload({ buffer: Buffer.concat([jpeg, Buffer.from('TRAILER')]), filename: 'Rose Bouquet.jpeg', mimeType: 'image/jpeg', folder: 'products' });
  assert.equal(ok.ok, true, ok.error);
  assert.equal(puts.length, 1);
  assert.equal(puts[0].filename, 'rose-bouquet.jpg');
  assert.equal(puts[0].mimeType, 'image/jpeg');
  assert(!puts[0].buffer.includes(Buffer.from('TRAILER')));
  assert.equal(created[0].filename, 'rose-bouquet.jpg');
  assert.equal(created[0].width, 64);
});

// ---------------------------------------------------------------- privacy

test('privacy: a successful public enquiry returns an acknowledgement only; failures are generic', async () => {
  const stored = { id: 42, customerName: 'Asha Fixture', phone: '9000000001', products: [] };
  let mode = 'ok';
  const route = sourceLoader({
    globals: web,
    mocks: {
      'src/server/services/InquiryService.ts': {
        InquiryService: {
          create: async () => {
            if (mode === 'throw') throw Object.assign(new Error('insert into inquiries values ($1) params: Asha Fixture 9000000001'), { code: '23505' });
            if (mode === 'invalid') return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: { phone: 'Invalid phone' } };
            return { ok: true, data: stored };
          },
        },
      },
    },
  })('src/pages/api/inquiries.ts');
  const post = (payload) => route.POST({ request: new Request(`${ORIGIN}/api/inquiries`, { method: 'POST', body: payload, headers: { 'content-type': 'application/json' } }) });
  const ok = await post('{"customerName":"Asha Fixture"}');
  assert.equal(ok.status, 201);
  assert.deepEqual(await ok.json(), { ok: true });
  mode = 'invalid';
  const invalid = await post('{}');
  assert.equal(invalid.status, 400);
  assert.deepEqual(Object.keys((await invalid.json()).fieldErrors), ['phone']);
  mode = 'throw';
  const failed = await post('{"customerName":"Asha Fixture"}');
  assert.equal(failed.status, 500);
  const text = await failed.text();
  assert(!/Asha|9000000001|insert|23505/.test(text), text);
  assert.equal((await post('not json')).status, 400);
});

test('privacy: repository failures log the call, duration and code only, never SQL, parameters or messages', async () => {
  const lines = [];
  const quiet = { ...console, error: (...args) => lines.push(args.map(String).join(' ')), warn: () => {} };
  const { withRepositoryCall, RepositoryError } = sourceLoader({ globals: { ...web, console: quiet, performance } })('src/server/db/postgres/repository.ts');
  const driver = Object.assign(new Error('duplicate key value violates unique constraint'), {
    cause: { code: '23505', detail: 'Key (phone)=(9000000001) already exists.' },
    query: 'insert into "inquiries" ("customer_name","phone") values ($1, $2)',
    params: ['Asha Fixture', '9000000001'],
  });
  await assert.rejects(withRepositoryCall('InquiryRepository.create', async () => { throw driver; }), (error) => {
    assert.equal(error.name, 'RepositoryError');
    assert.deepEqual({ ...error.cause }, { code: '23505' });
    assert(!JSON.stringify(error).includes('Asha'));
    return true;
  });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[InquiryRepository\.create\] failed after \d+ms \(23505\)$/);
  const connection = Object.assign(new Error('connect ECONNREFUSED postgres://user:pw@host'), { code: 'ECONNREFUSED' });
  await assert.rejects(withRepositoryCall('x', async () => { throw connection; }));
  assert.match(lines[1], /\(ECONNREFUSED\)$/);
  assert(!lines.join('\n').includes('pw@host'));
  assert.equal(new RepositoryError('m', new Error('secret')).cause.code, 'Error');
});

// ---------------------------------------------------------------- draft creation, handlers

const read = (file) => readFileSync(file, 'utf8');

test('draft creation: GET/HEAD never create a product; Add Product is a POST answered with 303', () => {
  const page = read('src/pages/admin/products/new.astro');
  const frontmatter = page.split('---')[1];
  const postBranch = frontmatter.indexOf('if (Astro.request.method === "POST") {');
  assert(postBranch > 0);
  assert.equal(frontmatter.split('await ProductService.createDraft()').length - 1, 1, 'one call');
  assert(frontmatter.indexOf('await ProductService.createDraft()') > postBranch, 'only inside the POST branch');
  assert.match(frontmatter, /Astro\.redirect\(`\/admin\/products\/edit\/\$\{product\.id\}`, 303\)/);
  for (const file of ['src/pages/admin/dashboard.astro', 'src/features/admin/productList/ProductList.tsx']) {
    const source = read(file);
    assert(!/href="\/admin\/products\/new"/.test(source), `${file} has no GET link`);
    assert.match(source, /<form method="post" action="\/admin\/products\/new">/);
  }
});

test('handlers: every request body is read through the bounded readers', () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|astro)$/.test(name)) files.push(full);
    }
  };
  walk('src/pages');
  const offenders = files.filter((file) => /request\.(json|formData|text|arrayBuffer|blob)\(\)/.test(read(file)));
  assert.deepEqual(offenders, []);
});

// ---------------------------------------------------------------- CSP

test('CSP: policy has no unsafe script sources; frame, object and base restrictions are present', () => {
  assert(CSP_DIRECTIVES.includes("frame-ancestors 'none'"));
  assert(CSP_DIRECTIVES.includes("object-src 'none'"));
  assert(CSP_DIRECTIVES.includes("base-uri 'self'"));
  assert(CSP_DIRECTIVES.includes("form-action 'self'"));
  assert(!CSP_DIRECTIVES.some((d) => /unsafe-eval/.test(d)));
  const config = read('astro.config.mjs');
  assert.match(config, /scriptDirective: \{ resources: \["'self'", 'https:\/\/www\.googletagmanager\.com'\] \}/);
  assert(!/scriptDirective[^\n]*unsafe/.test(config));
  assert.match(config, /staticHeaders: true/);
  assert.equal(SECURITY_HEADERS['x-frame-options'], 'DENY');
  assert.equal(SECURITY_HEADERS['x-content-type-options'], 'nosniff');
  assert(!('content-security-policy' in SECURITY_HEADERS), 'no blanket CSP that would override page policies');
  assert(!('strict-transport-security' in SECURITY_HEADERS), 'HSTS stays with the platform');
});

test('CSP check: unhashed inline scripts and unsafe sources are caught; data blocks and hashed scripts pass', () => {
  const code = 'console.log(1)';
  const hash = `'sha256-${createHash('sha256').update(code).digest('base64')}'`;
  const policy = `default-src 'self'; script-src 'self' ${hash}; style-src 'self'`;
  const html = `<script>${code}</script><script type="application/ld+json">{"a":1}</script><script type="application/json" id="x">[1]</script><script src="/a.js"></script>`;
  assert.deepEqual(cspProblems(html, policy), []);
  assert.equal(inlineScripts(html).length, 1);
  assert.equal(cspProblems(`${html}<script>alert(2)</script>`, policy).length, 1);
  assert.equal(cspProblems(`<script type="module">x()</script>`, policy).length, 1);
  assert.deepEqual(cspProblems(html, `script-src 'self' 'unsafe-inline' ${hash}`), ["script-src allows 'unsafe-inline'"]);
  assert.deepEqual(scriptSources("default-src 'self';script-src 'self' 'sha256-a'"), ["'self'", "'sha256-a'"]);
});

test('CSP: reviewed inline scripts are rendered through InlineScript (hash of their literal code); no other is:inline code runs', () => {
  const component = read('src/components/InlineScript.astro');
  assert.match(component, /createHash\("sha256"\)\.update\(code, "utf8"\)\.digest\("base64"\)/);
  assert.match(component, /Astro\.csp\?\.insertScriptHash\(hash\)/);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.astro')) files.push(full);
    }
  };
  walk('src');
  const inline = [];
  for (const file of files) {
    for (const match of read(file).matchAll(/<script\b[^>]*is:inline[^>]*>/g)) {
      const tag = match[0];
      if (/type="application\/(ld\+)?json"/.test(tag) || /\ssrc=/.test(tag) || /set:html=\{code\}/.test(tag)) continue;
      inline.push(`${path.relative('.', file)}: ${tag}`);
    }
  }
  // DeliveryChecker.astro is not used by any page (kept on disk); the build check fails if it ever is.
  assert.deepEqual(inline.filter((line) => !line.startsWith(path.join('src', 'components', 'DeliveryChecker.astro'))), []);
  const analytics = read('src/components/Analytics.astro');
  assert.match(analytics, /JSON\.stringify\(enabled \? measurementId : ""\)/);
  assert.match(analytics, /const enabled = \/\^G-\[A-Z0-9\]\{4,\}\$\/\.test\(measurementId\)/);
});
