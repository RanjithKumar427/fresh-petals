// Car Decoration seed lifecycle against a LOCAL database only
// (scripts/seed-car-decoration.mjs): pre-existing slugs, repeated runs, draft
// publishing, admin edits and rollback. Refuses any non-loopback DATABASE_URL.
//   DATABASE_URL=postgresql://…@127.0.0.1:…/db node scripts/audit/car-seed-lifecycle.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const url = process.env.DATABASE_URL ?? '';
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url) || /supabase|hjhmetomcaskrrwkgrbp/.test(url)) throw new Error('Local database only.');
const db = new pg.Pool({ connectionString: url, ssl: false });
const q = async (sql, args) => (await db.query(sql, args)).rows;
const seed = (action) => execFileSync(process.execPath, ['scripts/seed-car-decoration.mjs', action], { env: process.env, encoding: 'utf8' });
const state = async () => Object.fromEntries((await q(`select p.slug, p.status, p.name, p.description, c.slug as cat from products p join categories c on c.id = p.category_id where p.slug = any($1)`, [S])).map((r) => [r.slug, r]));
const counts = async () => (await q(`select (select count(*) from products) p, (select count(*) from media) m, (select count(*) from product_whats_included) w, (select count(*) from product_care_instructions) c, (select count(*) from product_flower_types) f, (select count(*) from categories) k`))[0];
const log = (s) => console.log('PASS ' + s);

const S = JSON.parse(execFileSync(process.execPath, ['-e', "import('./scripts/audit/source-loader.mjs').then(m=>console.log(JSON.stringify(m.sourceLoader()('src/data/productCatalog.ts').productCatalog.filter(p=>p.category==='Car Decoration').map(p=>p.slug))))"], { encoding: 'utf8' }));
try {
  // Pre-existing record with one of the slugs (another category, published), the rest absent.
  const keep = 'red-rose-heart-car-decoration';
  await q(`delete from products where slug = any($1) and slug <> $2`, [S, keep]);
  // A record that already uses one of the slugs, in another category (made here if the database has none).
  await q(`insert into products (slug, name, category_id, status, price_type) select $1, 'Pre-existing record', (select id from categories where slug <> 'car-decoration' order by id limit 1), 'published', 'quote' where not exists (select 1 from products where slug = $1)`, [keep]);
  const before = (await state())[keep];
  assert(before && before.cat !== 'car-decoration', 'fixture needs a pre-existing record');

  seed('apply');
  let s = await state();
  assert.equal(Object.values(s).filter((r) => r.cat === 'car-decoration' && r.status === 'draft').length, S.length - 1);
  assert.deepEqual(s[keep], before);
  log(`apply: ${S.length - 1} drafts added, pre-existing "${keep}" untouched`);

  const c1 = await counts(); seed('apply'); assert.deepEqual(await counts(), c1);
  log('apply again: no rows added or changed');

  await q(`update products set name = name || ' (admin)', updated_at = now() + interval '1 second' where slug = 'vehicle-pooja-bonnet-posy'`);
  seed('publish');
  s = await state();
  assert.equal(s['vehicle-pooja-bonnet-posy'].status, 'draft');
  assert.equal(Object.values(s).filter((r) => r.cat === 'car-decoration' && r.status === 'published').length, S.length - 2);
  assert.deepEqual(s[keep], before);
  const c2 = await counts(); seed('publish'); assert.deepEqual(await counts(), c2); assert.deepEqual(await state(), s);
  log('publish: untouched seeded drafts published; admin-edited draft and pre-existing record left; repeat is a no-op');

  await q(`update products set description = 'Admin wording', updated_at = now() + interval '1 second' where slug = 'new-car-rose-gajamala'`);
  seed('rollback');
  s = await state();
  assert.deepEqual(Object.keys(s).sort(), [keep, 'new-car-rose-gajamala', 'vehicle-pooja-bonnet-posy'].sort());
  assert.equal(s['new-car-rose-gajamala'].status, 'draft'); assert.equal(s['new-car-rose-gajamala'].description, 'Admin wording');
  assert.match(s['vehicle-pooja-bonnet-posy'].name, /\(admin\)$/);
  assert.deepEqual(s[keep], before);
  assert.equal((await q(`select count(*)::int n from media where url like '/images/car-decoration/%'`))[0].n, 2);
  assert.equal((await q(`select count(*)::int n from categories where slug = 'car-decoration'`))[0].n, 1);
  const c3 = await counts(); seed('rollback'); assert.deepEqual(await counts(), c3);
  log('rollback: untouched seed rows deleted; admin-edited records kept (published one moved to draft, edits intact); pre-existing untouched; repeat is a no-op');

  // Clean slate: remove the two admin-edited seed records by hand, then rollback removes the empty seed category.
  await q(`delete from products where slug in ('new-car-rose-gajamala','vehicle-pooja-bonnet-posy')`);
  seed('rollback');
  assert.equal((await q(`select count(*)::int n from categories where slug = 'car-decoration'`))[0].n, 1, 'category kept: its seed products were removed by hand, so it cannot be proved seed-created');
  await q(`delete from media where url like '/images/car-decoration/%' and source = 'seed' and id not in (select media_id from product_images)`);
  await q(`delete from categories where slug = 'car-decoration'`);
  seed('apply'); seed('rollback');
  assert.equal((await q(`select count(*)::int n from categories where slug = 'car-decoration'`))[0].n, 0);
  assert.deepEqual((await state())[keep], before);
  log('apply + rollback on a clean database leaves nothing behind (category included)');
  await q(`delete from products where slug = $1 and name = 'Pre-existing record'`, [keep]);
} finally {
  await db.end();
}
