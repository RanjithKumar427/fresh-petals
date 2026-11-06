// Staging isolation: request guards, media origin and deploy checks. No network.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { sourceLoader } from './source-loader.mjs';
import { storedMediaOrigin, STAGING_MEDIA_ORIGIN } from '../../src/server/http/securityHeaders.mjs';
import { originFailures, repoFailures, workerConfigFailures, AUTH_ORIGIN, HYPERDRIVE_NAME } from '../staging/deploy-lib.mjs';

const guard = sourceLoader({ mocks: { 'src/server/http/body.ts': { BODY_LIMITS: {} } } })('src/server/http/requestGuard.ts');
const good = {
  FP_DEPLOY_ENV: 'staging', SUPABASE_URL: 'https://wyndmywdtacucojvudxg.supabase.co', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'b',
  SITE_URL: 'https://onlyfreshpetals.in', FP_AUTH_ORIGIN: AUTH_ORIGIN, FP_STAGING_DB_ID: '7702070854497379551',
};
const context = { stagingBuild: true, viaHyperdrive: true, requestOrigin: AUTH_ORIGIN };
const problems = (env = good, ctx = context) => guard.stagingConfigProblems(env, ctx);

test('a complete staging configuration passes', () => assert.deepEqual([...problems()], []));

test('each missing or mismatched setting refuses', () => {
  for (const change of [
    { FP_DEPLOY_ENV: undefined }, { FP_DEPLOY_ENV: 'preview' }, { SUPABASE_URL: undefined }, { SUPABASE_URL: 'https://hjhmetomcaskrrwkgrbp.supabase.co' },
    { SUPABASE_ANON_KEY: undefined }, { SUPABASE_SERVICE_ROLE_KEY: undefined }, { SITE_URL: AUTH_ORIGIN }, { FP_AUTH_ORIGIN: undefined },
    { FP_AUTH_ORIGIN: 'https://onlyfreshpetals.in' }, { FP_AUTH_ORIGIN: 'https://fresh-petals-preview.x.workers.dev' }, { FP_STAGING_DB_ID: undefined },
    { DATABASE_URL: 'postgres://x' }, { CF_ZONE_ID: 'z' }, { CF_CACHE_PURGE_TOKEN: 't' }, { OTHER: 'x-hjhmetomcaskrrwkgrbp-y' },
  ]) assert.ok(problems({ ...good, ...change }).length > 0, JSON.stringify(Object.keys(change)));
});

test('the bundle, binding and request address must all be staging', () => {
  assert.ok(problems(good, { ...context, stagingBuild: false }).length);
  assert.ok(problems(good, { ...context, viaHyperdrive: false }).length);
  assert.ok(problems(good, { ...context, requestOrigin: 'https://onlyfreshpetals.in' }).length);
});

test('problem descriptions carry no values', () => {
  const secret = 'postgres://user:secret@host/db';
  assert.ok(!problems({ ...good, DATABASE_URL: secret }).join().includes('secret'));
});

test('Auth links use only the configured origin', () => {
  assert.equal(guard.stagingAuthOrigin(good), AUTH_ORIGIN);
  assert.equal(guard.stagingAuthOrigin({ SITE_URL: 'https://onlyfreshpetals.in' }), null);
  assert.equal(guard.stagingAuthOrigin({ FP_AUTH_ORIGIN: 'https://evil.example' }), null);
});

test('staging refuses the enquiry log but not admin; preview keeps refusing admin', () => {
  assert.equal(guard.isStagingDeployment({ FP_DEPLOY_ENV: 'staging' }), true);
  assert.equal(guard.isPreviewDeployment({ FP_DEPLOY_ENV: 'staging' }), false);
  assert.equal(guard.blockedOnStaging('/api/inquiries'), true);
  assert.equal(guard.blockedOnStaging('/admin/login'), false);
  assert.equal(guard.isPreviewDeployment({ FP_DEPLOY_ENV: 'preview' }), true);
  assert.equal(guard.blockedOnPreview('/admin/login'), true);
});

test('staging enquiry writes open only to a request carrying the configured test key', () => {
  const key = 'k'.repeat(40);
  const env = { FP_DEPLOY_ENV: 'staging', FP_STAGING_INQUIRY_TEST_KEY: key };
  const sent = (value) => new Headers(value === undefined ? {} : { [guard.STAGING_INQUIRY_TEST_HEADER]: value });
  assert.equal(guard.blockedOnStaging('/api/inquiries', undefined, env), true);
  assert.equal(guard.blockedOnStaging('/api/inquiries', sent(key), env), false);
  for (const value of [undefined, '', key.slice(1), key + 'x', 'j'.repeat(40)]) assert.equal(guard.blockedOnStaging('/api/inquiries', sent(value), env), true, String(value));
  // No secret, a short secret, or a non-staging deployment: always refused, even with a matching header.
  assert.equal(guard.blockedOnStaging('/api/inquiries', sent(key), { FP_DEPLOY_ENV: 'staging' }), true);
  assert.equal(guard.blockedOnStaging('/api/inquiries', sent('short'), { FP_DEPLOY_ENV: 'staging', FP_STAGING_INQUIRY_TEST_KEY: 'short' }), true);
  assert.equal(guard.blockedOnStaging('/api/inquiries', sent(key), { ...env, FP_DEPLOY_ENV: 'preview' }), true);
  // The preview refusal is a separate check that ignores the key entirely.
  assert.equal(guard.blockedOnPreview('/api/inquiries'), true);
  // Other staging paths are unaffected.
  assert.equal(guard.blockedOnStaging('/admin/login', sent(undefined), env), false);
});

test('only an explicit staging build changes the media host', () => {
  assert.equal(storedMediaOrigin({ FP_DEPLOY_ENV: 'staging' }), STAGING_MEDIA_ORIGIN);
  for (const env of [{}, { FP_DEPLOY_ENV: 'preview' }, { FP_DEPLOY_ENV: 'production' }]) assert.equal(storedMediaOrigin(env), 'https://hjhmetomcaskrrwkgrbp.supabase.co');
});

test('post-sign-in paths are judged after resolving them', () => {
  const { safeAdminPath } = sourceLoader()('src/server/auth/safeAdminPath.ts');
  assert.equal(safeAdminPath('/admin/products?page=2'), '/admin/products?page=2');
  for (const bad of ['/admin/../../evil', '/admin/%2e%2e/evil', '/admin/x/../../evil', '/admin/x/../mfa', '/admin/%2e%2e/admin/login', '//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)']) {
    assert.equal(safeAdminPath(bad), '/admin/dashboard', bad);
  }
});

const expected = { host: 'aws-1-eu-west-1.pooler.supabase.com', port: 5432, database: 'postgres', user: 'postgres.wyndmywdtacucojvudxg' };
const config = { id: 'stg', name: HYPERDRIVE_NAME, origin: expected, caching: { disabled: true }, mtls: { sslmode: 'verify-full', ca_certificate_id: 'c' } };

test('Hyperdrive is judged by its actual origin, not its name', () => {
  assert.deepEqual(originFailures(config, expected, 'prod'), []);
  assert.ok(originFailures({ ...config, id: 'prod' }, expected, 'prod').length);
  assert.ok(originFailures({ ...config, origin: { ...expected, user: 'postgres.hjhmetomcaskrrwkgrbp' } }, expected, 'prod').length);
  assert.ok(originFailures({ ...config, origin: { ...expected, host: 'other' } }, expected, 'prod').length);
  assert.ok(originFailures({ ...config, origin: { ...expected, port: 6543 } }, expected, 'prod').length);
  assert.ok(originFailures({ ...config, caching: {} }, expected, 'prod').length);
  assert.ok(originFailures({ ...config, mtls: { sslmode: 'require' } }, expected, 'prod').length);
});

const worker = { name: 'fresh-petals-staging', workers_dev: true, preview_urls: false, observability: { enabled: false }, images: { binding: 'IMAGES' }, hyperdrive: [{ binding: 'HYPERDRIVE', id: 'stg' }], vars: { FP_DEPLOY_ENV: 'staging', SITE_URL: 'https://onlyfreshpetals.in', FP_AUTH_ORIGIN: AUTH_ORIGIN, FP_STAGING_DB_ID: '1' } };

test('the password page claims success only with the cookie set after an accepted change', () => {
  const page = readFileSync('src/pages/admin/reset-password.astro', 'utf8');
  const endpoint = readFileSync('src/pages/api/admin/auth/reset-password.ts', 'utf8');
  assert.match(page, /const done = Astro\.url\.searchParams\.get\("done"\) === "1" && Astro\.cookies\.get\(PASSWORD_CHANGED_COOKIE\)\?\.value === "1";/);
  assert.match(page, /if \(done\) Astro\.cookies\.delete\(PASSWORD_CHANGED_COOKIE/);
  assert.ok(endpoint.indexOf('if (!result.ok) return fail') < endpoint.indexOf('cookies.set(PASSWORD_CHANGED_COOKIE'), 'cookie is set only after the failure return');
  assert.match(endpoint, /cookies\.set\(PASSWORD_CHANGED_COOKIE, "1", \{[^}]*httpOnly: true/);
});

// The real Supabase cookie client with only the network and the admin table replaced.
async function signIn(row) {
  const session = { access_token: 'a.b.c', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh', user: { id: 'user-1', aud: 'authenticated', email: 'someone@example.com' } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => (String(url).includes('/logout') ? new Response(null, { status: 204 }) : new Response(JSON.stringify(session), { status: 200, headers: { 'content-type': 'application/json' } }));
  try {
    const { AuthService } = sourceLoader({ mocks: { 'src/server/db/repositories/AdminUserRepository.ts': { AdminUserRepository: { findById: async () => row, touchLastLogin: async () => {} }, isApprovedAdmin: (x) => !!x } }, globals: { process: { env: { SUPABASE_URL: 'https://stub.supabase.co', SUPABASE_ANON_KEY: 'anon' } } } })('src/server/services/AuthService.ts');
    const jar = new Map();
    const cookies = { set: (name, value) => jar.set(name, value), delete: (name) => jar.set(name, null) };
    const result = await AuthService.login('someone@example.com', 'a-password-for-this-test', { headers: new Headers() }, cookies);
    return { result, jar };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('a refused sign-in leaves no session cookie; an approved one keeps it', async () => {
  const refused = await signIn(null);
  assert.equal(refused.result.ok, false);
  assert.ok(refused.jar.size > 0, 'the sign-in wrote cookies, so this exercises the cleanup');
  assert.deepEqual([...refused.jar.values()].filter(Boolean), [], 'every session cookie is deleted');
  const approved = await signIn({ id: 'user-1' });
  assert.equal(approved.result.ok, true);
  assert.ok([...approved.jar.values()].filter(Boolean).length > 0);
});

// A password change on a recovery session: the real Supabase client rewrites the session after
// updateUser (larger, so chunked into new cookie names) and then ends it in the same response.
async function changePassword() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-1', aal: 'aal1', session_id: 's', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.c2lnbmF0dXJl`;
  const user = { id: 'user-1', aud: 'authenticated', email: 'someone@example.com', factors: [] };
  const session = { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh', user };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes('/logout')) return new Response(null, { status: 204 });
    const body = init.method === 'PUT' ? { ...user, user_metadata: { note: 'x'.repeat(5000) } } : user;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const { AuthService } = sourceLoader({ mocks: { 'src/server/db/repositories/AdminUserRepository.ts': { AdminUserRepository: {}, isApprovedAdmin: (x) => !!x } }, globals: { process: { env: { SUPABASE_URL: 'https://stub.supabase.co', SUPABASE_ANON_KEY: 'anon' } } } })('src/server/services/AuthService.ts');
    const jar = new Map();
    const cookies = { set: (name, value) => jar.set(name, value), delete: (name) => jar.set(name, null) };
    const request = { headers: new Headers({ cookie: `sb-stub-auth-token=base64-${b64(session)}` }) };
    const result = await AuthService.updatePassword('a-new-password-for-this-test', null, request, cookies);
    return { result, jar };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('a completed password change leaves no session cookie, including ones written during it', async () => {
  const { result, jar } = await changePassword();
  assert.equal(result.ok, true);
  assert.ok([...jar.keys()].some((n) => /^sb-stub-auth-token\.\d+$/.test(n)), 'the change wrote chunked cookies, so this exercises the cleanup');
  assert.deepEqual([...jar].filter(([n, v]) => n.startsWith('sb-') && v), [], 'every session cookie is deleted');
});

test('only the staging Worker configuration may deploy', () => {
  assert.deepEqual(workerConfigFailures(worker, 'stg', 'prod'), []);
  for (const change of [{ name: 'fresh-petals-preview' }, { name: 'fresh-petals' }, { workers_dev: false }, { routes: ['x'] }, { hyperdrive: [{ binding: 'HYPERDRIVE', id: 'prod' }] }, { hyperdrive: [] }, { observability: { enabled: true } }, { images: undefined }, { vars: { ...worker.vars, FP_DEPLOY_ENV: 'preview' } }, { vars: { ...worker.vars, SUPABASE_URL: 'https://hjhmetomcaskrrwkgrbp.supabase.co' } }])
    assert.ok(workerConfigFailures({ ...worker, ...change }, 'stg', 'prod').length, JSON.stringify(Object.keys(change)));
});

test('tracked changes, env files and untracked build inputs stop a deploy', () => {
  assert.deepEqual(repoFailures({ status: '?? scripts/staging/restore-lib.mjs', envFiles: [] }), { failures: [], untracked: ['scripts/staging/restore-lib.mjs'] });
  assert.ok(repoFailures({ status: ' M src/middleware.ts', envFiles: [] }).failures.length);
  assert.ok(repoFailures({ status: '?? src/new.ts', envFiles: [] }).failures.length);
  assert.ok(repoFailures({ status: '', envFiles: ['.env.local'] }).failures.length);
});

test('staging test helpers: RFC 6238 code, cookie removal and attribute checks', async () => {
  const lib = await import('../staging/test-lib.mjs');
  // RFC 6238 appendix B, SHA-1, T = 59 s (step 1): 94287082, of which the last 6 digits.
  assert.equal(lib.totpAt('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1), '287082');
  const cookies = lib.parseSetCookie({ headers: { getSetCookie: () => ['sb-abc-auth-token.0=; Max-Age=0; Path=/', 'sb-abc-auth-token=v; Max-Age=34560000; Path=/; HttpOnly; Secure; SameSite=Lax'] } });
  assert.equal(lib.removes(cookies[0]), true);
  assert.equal(lib.removes(cookies[1]), false);
  assert.equal(lib.sessionCookieAttributesOk(cookies[1]), true);
  assert.equal(lib.describeCookie(cookies[1]).includes('v;'), false);
  const jar = new Map([['sb-abc-auth-token.0', 'x']]);
  lib.applyCookies(jar, cookies);
  assert.deepEqual([...jar.keys()], ['sb-abc-auth-token']);
  assert.equal(lib.scrub('see https://x.example/a?token=1 and ' + 'k'.repeat(40)), 'see [url] and [long]');
});
