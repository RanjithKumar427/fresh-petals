// Staging isolation: request guards, media origin and deploy checks. No network.
import { test } from 'node:test';
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

test('only an explicit staging build changes the media host', () => {
  assert.equal(storedMediaOrigin({ FP_DEPLOY_ENV: 'staging' }), STAGING_MEDIA_ORIGIN);
  for (const env of [{}, { FP_DEPLOY_ENV: 'preview' }, { FP_DEPLOY_ENV: 'production' }]) assert.equal(storedMediaOrigin(env), 'https://hjhmetomcaskrrwkgrbp.supabase.co');
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
