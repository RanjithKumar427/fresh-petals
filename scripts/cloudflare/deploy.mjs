// Builds and deploys one Cloudflare environment with wrangler.
//
//   node scripts/cloudflare/deploy.mjs preview
//   node scripts/cloudflare/deploy.mjs production --confirm-production
//
// Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (or `wrangler login`),
// DATABASE_URL for the build, and the Hyperdrive id in wrangler.jsonc.
// Deploying production does NOT route any traffic: the Worker only answers on
// onlyfreshpetals.in once the custom domain is attached at cutover
// (docs/cloudflare-migration.md). It never touches the Vercel project.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const target = process.argv[2];
if (!['preview', 'production'].includes(target)) {
  console.error('Usage: node scripts/cloudflare/deploy.mjs <preview|production> [--confirm-production]');
  process.exit(2);
}
if (target === 'production' && !process.argv.includes('--confirm-production')) {
  console.error('Production deploys need --confirm-production.');
  process.exit(2);
}
const config = readFileSync('wrangler.jsonc', 'utf8');
if (config.includes('REPLACE_WITH_HYPERDRIVE_ID')) {
  console.error('Set the Hyperdrive id in wrangler.jsonc first (runbook step "Hyperdrive").');
  process.exit(1);
}
const run = (args, env = process.env) => {
  const r = spawnSync(args[0], args.slice(1), { stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run([process.execPath, 'scripts/cloudflare/build.mjs', target]);
// The build wrote dist/server/wrangler.json with this environment already selected.
run([process.execPath, 'node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', 'dist/server/wrangler.json']);
