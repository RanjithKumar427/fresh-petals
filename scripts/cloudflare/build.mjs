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
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

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

const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], { env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

// Output checks.
const problems = [];
const headers = readFileSync('dist/client/_headers', 'utf8');
const noindex = /x-robots-tag:\s*noindex/i.test(headers);
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
    }
  }
};
walk('dist/client');
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
if (problems.length) {
  console.error(`Cloudflare ${target} build output check FAILED:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Cloudflare ${target} build OK: ${pages} static pages; noindex=${noindex}; FP_DEPLOY_ENV=${vars.FP_DEPLOY_ENV ?? '(unset)'}.`);
