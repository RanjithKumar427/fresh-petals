// Builds the Cloudflare Worker for one environment and checks the output.
//
//   node scripts/cloudflare/build.mjs preview      → separate *.workers.dev preview
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
if (!['preview', 'production'].includes(target)) {
  console.error('Usage: node scripts/cloudflare/build.mjs <preview|production>');
  process.exit(2);
}
const env = { ...process.env, DEPLOY_TARGET: 'cloudflare' };
if (target === 'preview') {
  Object.assign(env, { CLOUDFLARE_ENV: 'preview', FP_DEPLOY_ENV: 'preview' });
  // Keep test traffic out of production analytics and verification.
  for (const name of ['PUBLIC_GA_MEASUREMENT_ID', 'PUBLIC_GOOGLE_SITE_VERIFICATION', 'PUBLIC_BING_SITE_VERIFICATION']) delete env[name];
} else {
  delete env.CLOUDFLARE_ENV;
  if (env.FP_DEPLOY_ENV === 'preview') {
    console.error('FP_DEPLOY_ENV=preview is set: refusing to build production with preview controls.');
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
if (target === 'preview' && !noindex) problems.push('preview _headers has no X-Robots-Tag: noindex');
if (target === 'production' && noindex) problems.push('production _headers carries X-Robots-Tag: noindex');
if (!/strict-transport-security/i.test(headers)) problems.push('_headers has no HSTS');
const worker = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
const vars = worker.vars ?? {};
if (target === 'preview' && vars.FP_DEPLOY_ENV !== 'preview') problems.push('preview Worker lacks FP_DEPLOY_ENV=preview');
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
      if (target === 'preview' && /googletagmanager\.com\/gtag/.test(html)) problems.push(`${full}: analytics tag in a preview build`);
      if (/<link rel="canonical" href="https:\/\/(?!onlyfreshpetals\.in)/.test(html)) problems.push(`${full}: canonical outside onlyfreshpetals.in`);
    }
  }
};
walk('dist/client');
const hyperdrive = (worker.hyperdrive ?? [])[0]?.id;
if (!hyperdrive || hyperdrive.startsWith('REPLACE_')) console.warn('Note: wrangler.jsonc still has the placeholder Hyperdrive id; deploy.mjs will refuse until it is set.');
if (existsSync('dist/client/images/garlands')) console.warn('Note: dist/client/images/garlands exists; the garland photo safety net ran during the build.');
if (problems.length) {
  console.error(`Cloudflare ${target} build output check FAILED:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Cloudflare ${target} build OK: ${pages} static pages; noindex=${noindex}; FP_DEPLOY_ENV=${vars.FP_DEPLOY_ENV ?? '(unset)'}.`);
