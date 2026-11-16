// scripts/content/apply-copy-changes.mjs: classification always; the database
// cases (clean apply, rerun, conflict, missing record, rollback after a newer
// edit) only with FP_COPY_TEST_DATABASE_URL set to a disposable database. They
// run in a throwaway schema that is dropped afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { apply, classify, plan, rollback, summarise } from '../content/apply-copy-changes.mjs';

const manifest = JSON.parse(readFileSync('docs/offer-clarity-2026-11-16.changes.json', 'utf8'));

test('manifest: 24 dashboard-controlled fields across 17 products, each a real change', () => {
  const s = summarise(manifest.changes.map((c) => ({ ...c, status: 'expected-old' })));
  assert.deepEqual(s.total, { fields: 24, products: 17 });
  for (const change of manifest.changes) assert.notEqual(change.old, change.new, `${change.slug}.${change.column}`);
});

test('manifest: every "new" value is the storefront source copy, and every changed copy field is in it', async () => {
  const { sourceLoader } = await import('./source-loader.mjs');
  const { productCatalog } = sourceLoader()('src/data/productCatalog.ts');
  const field = { name: 'name', short_description: 'description', description: 'longDescription' };
  for (const change of manifest.changes) assert.equal(productCatalog.find((p) => p.slug === change.slug)?.[field[change.column]], change.new, `${change.slug}.${change.column}`);
});

test('classification: expected-old, already-new, conflicting and missing', () => {
  const changes = [
    { slug: 'a', column: 'name', old: 'A', new: 'A2' },
    { slug: 'b', column: 'name', old: 'B', new: 'B2' },
    { slug: 'c', column: 'name', old: 'C', new: 'C2' },
    { slug: 'z', column: 'name', old: 'Z', new: 'Z2' },
  ];
  const rows = [{ id: 1, slug: 'a', name: 'A' }, { id: 2, slug: 'b', name: 'B2' }, { id: 3, slug: 'c', name: 'edited' }];
  assert.deepEqual(classify(changes, rows).map((c) => c.status), ['expected-old', 'already-new', 'conflicting', 'missing']);
  assert.throws(() => classify([{ slug: 'a', column: 'price', old: 1, new: 2 }], rows));
});

const url = process.env.FP_COPY_TEST_DATABASE_URL;

test('database: apply, rerun, conflict, missing, rollback', { skip: !url && 'FP_COPY_TEST_DATABASE_URL not set' }, async () => {
  const schema = `copy_test_${process.pid}`;
  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();
  const reset = async (overrides = {}) => {
    await client.query(`drop schema if exists ${schema} cascade; create schema ${schema}; set search_path = ${schema};`);
    await client.query('create table products (id serial primary key, slug text unique not null, name text not null, short_description text, description text, updated_at timestamptz not null default now())');
    const slugs = [...new Set(manifest.changes.map((c) => c.slug))];
    for (const slug of slugs) {
      const row = { name: `${slug} name`, short_description: `${slug} short`, description: `${slug} long` };
      for (const c of manifest.changes.filter((c) => c.slug === slug)) row[c.column] = c.old;
      Object.assign(row, overrides[slug] ?? {});
      if (row.drop) continue;
      await client.query('insert into products (slug, name, short_description, description) values ($1, $2, $3, $4)', [slug, row.name, row.short_description, row.description]);
    }
  };
  const value = async (slug, column) => (await client.query(`select ${column} from products where slug = $1`, [slug])).rows[0]?.[column];
  try {
    // Clean application: all 24 fields change, and read back as new.
    await reset();
    let result = await apply(client, manifest.changes, { release: 'test' });
    assert.equal(result.ok, true);
    assert.equal(result.receipt.changed.length, 24);
    for (const c of manifest.changes) assert.equal(await value(c.slug, c.column), c.new);
    const firstReceipt = result.receipt;

    // Rerun: every field is already new; nothing is written and the receipt changes nothing.
    result = await apply(client, manifest.changes, { release: 'test' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.summary['already-new'], { fields: 24, products: 17 });
    assert.equal(result.receipt.changed.length, 0);
    assert.equal((await rollback(client, result.receipt)).ok, true); // an empty receipt restores nothing
    for (const c of manifest.changes) assert.equal(await value(c.slug, c.column), c.new);

    // Rollback after a newer admin edit: aborts, both the edit and the other fields stay.
    await client.query("update products set short_description = 'Admin edit' where slug = 'daisy-morning'");
    result = await rollback(client, firstReceipt);
    assert.equal(result.ok, false);
    assert.equal(await value('daisy-morning', 'short_description'), 'Admin edit');
    assert.equal(await value('dear-sunshine', 'short_description'), manifest.changes.find((c) => c.slug === 'dear-sunshine' && c.column === 'short_description').new);

    // Clean rollback restores exactly the receipt's before-values.
    await client.query('update products set short_description = $1 where slug = $2', [manifest.changes.find((c) => c.slug === 'daisy-morning' && c.column === 'short_description').new, 'daisy-morning']);
    assert.equal((await rollback(client, firstReceipt)).ok, true);
    for (const c of manifest.changes) assert.equal(await value(c.slug, c.column), c.old);

    // Mixed: a field already new is a no-op and is not in the receipt, so rollback never reverts it.
    const lilyCalm = manifest.changes.find((c) => c.slug === 'lily-calm');
    await reset({ 'lily-calm': { short_description: lilyCalm.new } });
    result = await apply(client, manifest.changes, { release: 'test' });
    assert.equal(result.ok, true);
    assert.equal(result.receipt.changed.length, 23);
    assert.equal(result.receipt.alreadyNew.length, 1);
    assert.equal((await rollback(client, result.receipt)).ok, true);
    assert.equal(await value('lily-calm', 'short_description'), lilyCalm.new);

    // Conflict: one admin-edited field aborts the batch; nothing is written.
    await reset({ 'sweet-petal-hour': { short_description: 'Edited in the admin' } });
    result = await apply(client, manifest.changes, { release: 'test' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.summary.conflicting, { fields: 1, products: 1 });
    for (const c of manifest.changes.filter((c) => c.slug !== 'sweet-petal-hour')) assert.equal(await value(c.slug, c.column), c.old);

    // Missing record: aborts; nothing is written.
    await reset({ 'mini-succulent-gift': { drop: true } });
    assert.equal((await plan(client, manifest.changes)).ok, false);
    result = await apply(client, manifest.changes, { release: 'test' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.summary.missing, { fields: 1, products: 1 });
    for (const c of manifest.changes.filter((c) => c.slug !== 'mini-succulent-gift')) assert.equal(await value(c.slug, c.column), c.old);
  } finally {
    await client.query(`drop schema if exists ${schema} cascade`).catch(() => {});
    await client.end();
  }
});
