// Builds the Cloudflare Worker for one environment and checks the output.
//
//   node scripts/cloudflare/build.mjs preview      → separate *.workers.dev preview
//   node scripts/cloudflare/build.mjs staging      → isolated *.workers.dev staging
//   node scripts/cloudflare/build.mjs production   → onlyfreshpetals.in (after cutover)
//
// Requires DATABASE_URL (the build reads the catalogue once, as on Vercel).
// The preview build never carries analytics or search-verification tags and
// marks every static file noindex; the production build must carry neither
// marker. Vercel builds are unaffected (they never set DEPLOY_TARGET).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { supabasePoolSsl } from '../../src/server/db/postgres/ssl.mjs';
import { FINGERPRINT_SQL } from '../../src/server/services/publishFingerprint.mjs';
import { DASHBOARD_CATALOGUE_SQL, writeDashboardCatalogue } from '../build/dashboard-catalogue.mjs';
import { STORED_PHOTOS_SQL, copyReferencedPhotos, prepareStoredPhotos } from '../build/stored-photos.mjs';

const target = process.argv[2];
if (!['preview', 'staging', 'production'].includes(target)) {
  console.error('Usage: node scripts/cloudflare/build.mjs <preview|staging|production>');
  process.exit(2);
}
const env = { ...process.env, DEPLOY_TARGET: 'cloudflare' };
if (target === 'preview' || target === 'staging') {
  Object.assign(env, { CLOUDFLARE_ENV: target, FP_DEPLOY_ENV: target });
  // Keep test traffic out of production analytics and verification.
  for (const name of ['PUBLIC_GA_MEASUREMENT_ID', 'PUBLIC_GOOGLE_SITE_VERIFICATION', 'PUBLIC_BING_SITE_VERIFICATION']) delete env[name];
} else {
  delete env.CLOUDFLARE_ENV;
  if (env.FP_DEPLOY_ENV === 'preview' || env.FP_DEPLOY_ENV === 'staging') {
    console.error(`FP_DEPLOY_ENV=${env.FP_DEPLOY_ENV} is set: refusing to build production with those controls.`);
    process.exit(1);
  }
  delete env.FP_DEPLOY_ENV;
}
if (!env.DATABASE_URL) {
  console.error('DATABASE_URL is required: the build reads the published catalogue.');
  process.exit(1);
}

// The content fingerprint is read before the build reads the catalogue, so a
// change saved while this build runs leaves the deployed fingerprint behind
// the live one and the next publishing check builds again
// (src/server/services/Publishing.ts).
// The admin's catalogue records are written for src/data/dashboardCatalogue.ts
// in the same connection (products added or edited in the admin).
const fingerprint = await (async () => {
  const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(env.DATABASE_URL) ? false : supabasePoolSsl, statement_timeout: 30000 });
  await client.connect();
  try {
    const value = (await client.query(FINGERPRINT_SQL)).rows[0].fingerprint;
    const records = writeDashboardCatalogue((await client.query(DASHBOARD_CATALOGUE_SQL)).rows);
    console.log(`Dashboard catalogue: ${records} product records written for the build.`);
    // Stored photos as static files (scripts/build/stored-photos.mjs).
    await prepareStoredPhotos((await client.query(STORED_PHOTOS_SQL)).rows);
    return value;
  } finally { await client.end().catch(() => {}); }
})();

const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], { env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

// Output checks.
const problems = [];
const headers = readFileSync('dist/client/_headers', 'utf8');
// The site-wide rule (/*) decides indexing; /fragments/* is noindex on every target.
const siteRule = (/(?:^|\n)\/\*\n((?:[ \t]+.*\n?)*)/.exec(headers) ?? [])[1] ?? '';
const noindex = /x-robots-tag:\s*noindex/i.test(siteRule);
if (target !== 'production' && !noindex) problems.push(`${target} _headers has no X-Robots-Tag: noindex`);
if (target === 'production' && noindex) problems.push('production _headers carries X-Robots-Tag: noindex');
if (!/strict-transport-security/i.test(headers)) problems.push('_headers has no HSTS');
const worker = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
const vars = worker.vars ?? {};
if (target !== 'production' && vars.FP_DEPLOY_ENV !== target) problems.push(`${target} Worker lacks FP_DEPLOY_ENV=${target}`);
if (target === 'staging') {
  if (worker.name !== 'fresh-petals-staging') problems.push(`staging Worker is named ${worker.name}`);
  if (worker.workers_dev !== true || worker.routes?.length || worker.route) problems.push('staging Worker must be on workers.dev only');
  if (worker.observability?.enabled !== false) problems.push('staging Worker must keep observability off');
  if ((worker.hyperdrive ?? [])[0]?.id !== 'REPLACE_WITH_STAGING_HYPERDRIVE_ID') problems.push('staging build must start from its own Hyperdrive placeholder');
}
if (target === 'production' && vars.FP_DEPLOY_ENV) problems.push(`production Worker has FP_DEPLOY_ENV=${vars.FP_DEPLOY_ENV}`);
if (target === 'production' && worker.workers_dev !== false) problems.push('production Worker must not be served on workers.dev');
if (vars.SITE_URL !== 'https://onlyfreshpetals.in') problems.push('SITE_URL must be https://onlyfreshpetals.in (canonical URLs)');
let pages = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.html')) {
      pages += 1;
      const html = readFileSync(full, 'utf8');
      if (target !== 'production' && /googletagmanager\.com\/gtag|var measurementId = "G-/.test(html)) problems.push(`${full}: analytics tag in a ${target} build`);
      if (target === 'staging' && /hjhmetomcaskrrwkgrbp/.test(html)) problems.push(`${full}: references the production project`);
      if (/<link rel="canonical" href="https:\/\/(?!onlyfreshpetals\.in)/.test(html)) problems.push(`${full}: canonical outside onlyfreshpetals.in`);
      // Every stored photo must be a static copy: /_image would read Storage per visitor (and fails while Storage is unavailable).
      if (target !== 'preview' && /\/_image\?href=|\/storage\/v1\/object\//.test(html)) problems.push(`${full}: a stored photo without a static copy (/_image or a Storage URL)`);
    }
  }
};
walk('dist/client');
for (const sitemap of ['sitemap.xml', 'sitemap-garlands.xml']) {
  const file = path.join('dist/client', sitemap);
  if (target !== 'preview' && existsSync(file) && /\/storage\/v1\/object\//.test(readFileSync(file, 'utf8'))) problems.push(`${sitemap}: lists a Storage URL instead of a static photo`);
}
// Only the stored-photo files that built pages reference become public.
const photos = copyReferencedPhotos('dist/client');
if (photos.missing.length) problems.push(`${photos.missing.length} referenced photo file(s) missing from the cache: ${photos.missing.slice(0, 3).join(', ')}`);
console.log(`Stored photos: ${photos.copied} referenced file(s) copied to /photos.`);
// The storefront is prebuilt: these must be static files, served without running the Worker.
for (const file of ['index.html', 'categories/bouquets/index.html', 'categories/garlands/index.html', 'occasions/index.html', 'sitemap.xml', 'sitemap-garlands.xml', 'sitemap-occasions.xml', 'robots.txt', '404.html', 'fragments/garlands/index.html']) {
  if (!existsSync(path.join('dist/client', file))) problems.push(`missing static file ${file}`);
}
const cityPages = existsSync('dist/client/locations') ? readdirSync('dist/client/locations').filter((name) => existsSync(path.join('dist/client/locations', name, 'shop', 'index.html'))).length : 0;
if (cityPages < 50) problems.push(`only ${cityPages} prebuilt city shop pages`);
// A static import of a module the Worker lacks fails every route that loads the chunk.
const chunks = path.join('dist', 'server', 'chunks');
if (existsSync(chunks)) {
  for (const name of readdirSync(chunks)) {
    if (name.endsWith('.mjs') && /(?:^|[;\n])\s*import\s+(?:[^'"]*\sfrom\s+)?["']sharp["']/.test(readFileSync(path.join(chunks, name), 'utf8'))) problems.push(`${name}: static import of sharp in the Worker bundle`);
  }
}
const hyperdrive = (worker.hyperdrive ?? [])[0]?.id;
if (target !== 'staging' && (!hyperdrive || hyperdrive.startsWith('REPLACE_'))) console.warn('Note: wrangler.jsonc still has the placeholder Hyperdrive id; deploy.mjs will refuse until it is set.');
if (existsSync('dist/client/images/garlands')) console.warn('Note: dist/client/images/garlands exists; the garland photo safety net ran during the build.');
// Publishing tests (scripts/staging/publish.mjs --simulate-build-failure): fail exactly where a real problem would.
if (process.env.FP_SIMULATE_BUILD_FAILURE === '1') problems.push('simulated build failure (publishing test)');
if (problems.length) {
  console.error(`Cloudflare ${target} build output check FAILED:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
// What this build was made from, for the publishing check (/_publish/state.json).
let revision = '';
try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
mkdirSync('dist/client/_publish', { recursive: true });
writeFileSync('dist/client/_publish/state.json', JSON.stringify({ fingerprint, revision, builtAt: new Date().toISOString() }));
console.log(`Cloudflare ${target} build OK: ${pages} static pages; noindex=${noindex}; FP_DEPLOY_ENV=${vars.FP_DEPLOY_ENV ?? '(unset)'}; content fingerprint ${fingerprint.slice(0, 12)}.`);
