// Explicit local-only fixture. Ignores .env and never accepts a remote DB URL.
import { mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { Pool } from 'pg';
import { sourceLoader } from './source-loader.mjs';

export const ROOT = process.cwd();
export const OUT = path.join(ROOT, 'data/focused-audit-2026-10-07');
export const COPY = path.join(OUT, 'workspace');
export const DATABASE_URL = 'postgresql://postgres:local-audit-only@127.0.0.1:55437/freshpetals_audit';
export const PORT = 45123;
export const env = { ...process.env, DATABASE_URL, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_ANON_KEY: '', PUBLIC_SUPABASE_URL: '', PUBLIC_SUPABASE_ANON_KEY: '', SITE_CACHE_PURGE_URL: `http://127.0.0.1:${PORT}/audit-purge`, VERCEL: '', PUBLIC_FP_PREVIEW_DRAFTS: '' };
export const db = () => new Pool({ connectionString: DATABASE_URL, ssl: false });

export function copySource() {
  mkdirSync(COPY, { recursive: true });
  const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const name of names) {
    if (/^(\.env|data\/|\.git\/)/.test(name) || !existsSync(path.join(ROOT, name))) continue;
    const destination = path.join(COPY, name); mkdirSync(path.dirname(destination), { recursive: true }); copyFileSync(path.join(ROOT, name), destination);
  }
  if (!existsSync(path.join(COPY, 'node_modules'))) symlinkSync(path.join(ROOT, 'node_modules'), path.join(COPY, 'node_modules'), 'junction');
  const config = path.join(COPY, 'astro.config.mjs');
  writeFileSync(config, readFileSync(config, 'utf8').replace('vite: {', "vite: {\n    cacheDir: path.join(process.cwd(), '.audit-vite'),"));
  // Transport double, confined to this ignored copy. Production TLS unchanged.
  const client = path.join(COPY, 'src/server/db/postgres/client.ts');
  writeFileSync(client, readFileSync(client, 'utf8').replace('import { supabasePoolSsl } from "./supabaseCa";', '').replace('ssl: supabasePoolSsl,', 'ssl: false,\n    connectionTimeoutMillis: 1500,'));
}
export function installAuthDouble() {
  // Test only the application's permission states, not Supabase's MFA service.
  const authFile = path.join(COPY, 'src/server/services/AuthService.ts');
  writeFileSync(authFile, readFileSync(path.join(ROOT, 'src/server/services/AuthService.ts'), 'utf8') + `\nAuthService.resolveAccess = async (_request: Request, cookies: any): Promise<any> => {
      const state = cookies.get('audit-access')?.value;
      if (state !== 'full' && state !== 'mfa') return { state: 'none', hadSession: false };
      return { state, admin: { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.invalid' }, hasVerifiedFactor: true };
  };\n`);
  mkdirSync(path.join(COPY, 'src/pages'), { recursive: true });
  writeFileSync(path.join(COPY, 'src/pages/audit-purge.ts'), `export const prerender = false; export const POST = () => new Response('fixture purge failure', { status: 503 });`);
}
export async function seed() {
  const pool = db();
  try {
    const identity = (await pool.query('select current_database() as name, inet_server_addr()::text as host')).rows[0];
    if (identity.name !== 'freshpetals_audit') throw new Error('Fixture database identity mismatch');
    // Only this dedicated fixture schema is reset. URL is a hardcoded loopback.
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$;`);
    const journal = JSON.parse(readFileSync(path.join(ROOT, 'drizzle/meta/_journal.json'), 'utf8'));
    for (const entry of journal.entries) await pool.query(readFileSync(path.join(ROOT, 'drizzle', entry.tag + '.sql'), 'utf8'));
    const load = sourceLoader();
    const { productCatalog } = load('src/data/productCatalog.ts');
    const { OCCASION_FILTER_LABELS } = load('src/data/shoppingTaxonomy.ts');
    for (const [slug, name] of Object.entries(OCCASION_FILTER_LABELS)) await pool.query('INSERT INTO occasions (slug,name) VALUES ($1,$2)', [slug, name]);
    const category = (await pool.query("INSERT INTO categories (slug,name) VALUES ('audit-products','Audit fixture products') RETURNING id")).rows[0].id;
    for (const product of productCatalog) {
      const amount = Number(product.priceLabel.match(/₹\s*([\d,]+)/)?.[1].replaceAll(',', '')) || (['fixed', 'from'].includes(product.priceType) ? 1000 : null);
      const id = (await pool.query('INSERT INTO products (slug,name,category_id,status,price_type,selling_price,description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [product.slug, product.name, category, 'published', product.priceType, amount, 'Isolated audit fixture'])).rows[0].id;
      // Unique final Housewarming assignment makes the empty-filter case reproducible.
      const occasions = (product.occasionTags ?? []).filter((o) => !['housewarming', 'pooja'].includes(o));
      if (product.slug === 'red-affair') occasions.push('housewarming');
      for (const occasion of [...new Set(occasions)]) await pool.query('INSERT INTO product_occasions (product_id,occasion_id) SELECT $1,id FROM occasions WHERE slug=$2', [id, occasion]);
    }
    const drafts = JSON.parse(readFileSync(path.join(ROOT, 'src/data/garlandDrafts.json'), 'utf8')).designs;
    for (const draft of drafts) {
      const id = (await pool.query("INSERT INTO products (slug,name,category_id,status,price_type,selling_price) VALUES ($1,$2,$3,'draft','fixed',5000) RETURNING id", [draft.slug, draft.title, category])).rows[0].id;
      await pool.query('INSERT INTO garland_details (product_id,design_code) VALUES ($1,$2)', [id, draft.code]);
    }
    await pool.query("INSERT INTO admin_users (id,email) VALUES ('00000000-0000-4000-8000-000000000001','fixture@example.invalid')");
    writeFileSync(path.join(OUT, 'fixture.json'), JSON.stringify({ database: '127.0.0.1:55437/freshpetals_audit', products: productCatalog.length, draftGarlands: drafts.length, auth: 'resolveAccess boundary double in ignored copy only', port: PORT }, null, 2));
  } finally { await pool.end(); }
}
export async function astro(args, { outage = false, name = args[0] } = {}) {
  const log = [];
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/astro/bin/astro.mjs'), ...args], { cwd: COPY, env: { ...env, DATABASE_URL: outage ? 'postgresql://postgres:local-audit-only@127.0.0.1:55438/freshpetals_audit' : DATABASE_URL }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (s) => { log.push(s.toString()); process.stdout.write(s); }); child.stderr.on('data', (s) => { log.push(s.toString()); process.stderr.write(s); });
  child.on('close', () => writeFileSync(path.join(OUT, name + '.log'), log.join('')));
  return child;
}
if (process.argv[1]?.endsWith('local-fixture.mjs')) {
  const action = process.argv[2];
  if (action === 'prepare') { copySource(); await seed(); console.log('Prepared isolated source and 245 fixture products.'); }
  else if (action === 'check') { copySource(); const child = await astro(['check'], { outage: true, name: 'check-outage' }); child.on('close', (code) => process.exit(code)); }
  else if (action === 'build') { copySource(); installAuthDouble(); const child = await astro(['build']); child.on('close', (code) => process.exit(code)); }
  else if (action === 'dev-outage') { copySource(); const child = await astro(['dev', '--host', '127.0.0.1', '--port', '45124'], { outage: true }); child.on('close', (code) => process.exit(code)); }
  else throw new Error('Use prepare, check, build or dev-outage. Never run against repository .env.');
}
