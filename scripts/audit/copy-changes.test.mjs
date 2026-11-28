// scripts/content/apply-copy-changes.mjs and its manifest. Always: the
// manifest is the complete copy diff from its declared baseline, in both
// directions; classification. With FP_COPY_TEST_DATABASE_URL set to a
// disposable database: clean apply, rerun, conflict, missing record,
// interrupted receipt (commit, then no rename) and guarded rollback (newer
// edit, replacement record). They run in a throwaway schema, dropped afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { apply, classify, classifyReceipt, plan, reconcile, rollback, summarise } from '../content/apply-copy-changes.mjs';
import { sourceLoader } from './source-loader.mjs';

const manifest = JSON.parse(readFileSync('docs/offer-clarity-2026-11-16.changes.json', 'utf8'));
// The dashboard-controlled copy of every product at the release base, kept in
// the repository so this check needs no git history (CI checks out depth 1).
const baseline = JSON.parse(readFileSync('docs/offer-clarity-2026-11-16.baseline.json', 'utf8'));
const FIELD = { name: 'name', short_description: 'description', description: 'longDescription' };
const copyOf = (catalogue) => Object.fromEntries(catalogue.map((p) => [p.slug, Object.fromEntries(Object.entries(FIELD).map(([column, key]) => [column, p[key]]))]));
const key = (c) => `${c.slug}.${c.column}`;

test('manifest: exactly the copy diff from its declared baseline, both directions, with old and new values', () => {
  assert(baseline.base.startsWith(manifest.base), `manifest base ${manifest.base} vs baseline ${baseline.base}`);
  const current = copyOf(sourceLoader()('src/data/productCatalog.ts').productCatalog);
  // Products added by a later release carry their own records (Car Decoration: docs/car-decoration.md).
  const later = new Set(sourceLoader()('src/data/productCatalog.ts').productCatalog.filter((p) => p.category === 'Car Decoration').map((p) => p.slug));
  for (const slug of Object.keys(current)) assert(baseline.products[slug] || later.has(slug), `${slug} is not in the baseline: a product added since needs its own record, not a copy change`);
  for (const slug of later) delete current[slug];
  const diff = [];
  for (const [slug, fields] of Object.entries(baseline.products)) {
    assert(current[slug], `${slug} was removed from the catalogue since the baseline`);
    for (const column of Object.keys(FIELD)) if (fields[column] !== current[slug][column]) diff.push({ slug, column, old: fields[column], new: current[slug][column] });
  }
  const inManifest = new Map(manifest.changes.map((c) => [key(c), c]));
  const inDiff = new Map(diff.map((c) => [key(c), c]));
  assert.equal(inManifest.size, manifest.changes.length, 'duplicate field in the manifest');
  const omitted = [...inDiff.keys()].filter((k) => !inManifest.has(k));
  const extra = [...inManifest.keys()].filter((k) => !inDiff.has(k));
  assert.deepEqual({ omitted, extra }, { omitted: [], extra: [] });
  for (const [k, change] of inManifest) {
    assert.equal(change.old, inDiff.get(k).old, `${k}: "old" is not the baseline value`);
    assert.equal(change.new, inDiff.get(k).new, `${k}: "new" is not the storefront source copy`);
  }
  // The reviewed release scope.
  assert.deepEqual(summarise(manifest.changes.map((c) => ({ ...c, status: 'expected-old' }))).total, { fields: 24, products: 17 });
});

// The baseline file must be the real base: checked whenever the base commit is in the checkout.
const baseReachable = (() => { try { execFileSync('git', ['cat-file', '-e', `${baseline.base}^{commit}`], { stdio: 'ignore' }); return true; } catch { return false; } })();
test('baseline: matches src/data/productCatalog.ts at the base commit', { skip: !baseReachable && `base ${baseline.base.slice(0, 7)} not in this checkout (shallow); the committed baseline is used as is` }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fp-base-'));
  try {
    const tar = execFileSync('git', ['archive', baseline.base, 'src'], { maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    assert.deepEqual(copyOf(sourceLoader({ root: dir })('src/data/productCatalog.ts').productCatalog), baseline.products);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test('rollback classification: by product id and slug; replaced, edited and missing records block', () => {
  const changed = [
    { id: 1, slug: 'a', column: 'name', before: 'A', after: 'A2' },
    { id: 2, slug: 'b', column: 'name', before: 'B', after: 'B2' },
    { id: 3, slug: 'c', column: 'name', before: 'C', after: 'C2' },
    { id: 4, slug: 'd', column: 'name', before: 'D', after: 'D2' },
    { id: 5, slug: 'e', column: 'name', before: 'E', after: 'E2' },
  ];
  // 1 holds what the run wrote; 2 is back at its before-value; 3 was edited; 4 now carries another slug; 5 is gone
  // (a new record with slug "e" and another id does not stand in for it).
  const rows = [{ id: 1, slug: 'a', name: 'A2' }, { id: 2, slug: 'b', name: 'B' }, { id: 3, slug: 'c', name: 'edited' }, { id: 4, slug: 'd-renamed', name: 'D2' }, { id: 9, slug: 'e', name: 'E2' }];
  assert.deepEqual(classifyReceipt(changed, rows).map((c) => c.status), ['expected-old', 'already-new', 'conflicting', 'replaced', 'missing']);
});

const url = process.env.FP_COPY_TEST_DATABASE_URL;

test('database: apply, rerun, conflict, missing, interrupted receipt, guarded rollback', { skip: !url && 'FP_COPY_TEST_DATABASE_URL not set' }, async () => {
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

    // Replacement record: same slug, new id. Rollback refuses it and leaves it untouched.
    await reset();
    result = await apply(client, manifest.changes, { release: 'test' });
    const daisy = manifest.changes.filter((c) => c.slug === 'daisy-morning');
    await client.query("delete from products where slug = 'daisy-morning'");
    await client.query('insert into products (slug, name, short_description, description) values ($1, $2, $3, $4)', ['daisy-morning', 'Daisy Morning', daisy.find((c) => c.column === 'short_description').new, daisy.find((c) => c.column === 'description').new]);
    const replaced = await rollback(client, result.receipt);
    assert.equal(replaced.ok, false);
    assert.equal(replaced.summary.missing.products, 1);
    assert.equal(await value('daisy-morning', 'short_description'), daisy.find((c) => c.column === 'short_description').new);
    assert.equal(await value('dear-sunshine', 'short_description'), manifest.changes.find((c) => c.slug === 'dear-sunshine' && c.column === 'short_description').new);

    // Interrupted receipt, through the command line: COMMIT happens, the rename does not.
    const dir = mkdtempSync(path.join(tmpdir(), 'fp-receipt-'));
    const receiptFile = path.join(dir, 'receipt.json');
    const scoped = new URL(url);
    scoped.searchParams.set('options', `-c search_path=${schema}`);
    const cli = (...argv) => spawnSync(process.execPath, ['scripts/content/apply-copy-changes.mjs', ...argv, '--database-url', scoped.toString()], { encoding: 'utf8' });
    try {
      await reset();
      result = await apply(client, manifest.changes, { release: 'test', beforeCommit: (receipt) => writeFileSync(`${receiptFile}.pending`, JSON.stringify(receipt), { flag: 'wx' }) });
      assert.equal(result.ok, true); // committed; the process "stopped" before renaming
      const pendingText = readFileSync(`${receiptFile}.pending`, 'utf8');
      // A rerun refuses to start: the pending before-values cannot be replaced by an empty receipt.
      let run = cli('apply', '--manifest', 'docs/offer-clarity-2026-11-16.changes.json', '--receipt', receiptFile);
      assert.equal(run.status, 65, run.stderr);
      assert.equal(readFileSync(`${receiptFile}.pending`, 'utf8'), pendingText);
      assert(!existsSync(receiptFile));
      // reconcile: every listed field holds the copy written -> committed -> the receipt is finalised.
      assert.equal((await reconcile(client, JSON.parse(pendingText))).outcome, 'committed');
      run = cli('reconcile', '--receipt', receiptFile);
      assert.equal(run.status, 0, run.stderr + run.stdout);
      assert.equal(readFileSync(receiptFile, 'utf8'), pendingText);
      // The recovered receipt still restores the real before-values.
      run = cli('rollback', '--receipt', receiptFile);
      assert.equal(run.status, 0, run.stderr + run.stdout);
      for (const c of manifest.changes) assert.equal(await value(c.slug, c.column), c.old);
      // An existing final receipt also blocks a new apply under that name.
      run = cli('apply', '--manifest', 'docs/offer-clarity-2026-11-16.changes.json', '--receipt', receiptFile);
      assert.equal(run.status, 65);

      // Not committed: the receipt was written, then the transaction failed.
      const second = path.join(dir, 'second.json');
      await assert.rejects(apply(client, manifest.changes, { release: 'test', beforeCommit: (receipt) => { writeFileSync(`${second}.pending`, JSON.stringify(receipt), { flag: 'wx' }); throw new Error('stopped before commit'); } }));
      for (const c of manifest.changes) assert.equal(await value(c.slug, c.column), c.old);
      assert.equal((await reconcile(client, JSON.parse(readFileSync(`${second}.pending`, 'utf8')))).outcome, 'not-committed');
      run = cli('reconcile', '--receipt', second);
      assert.equal(run.status, 0);
      assert(existsSync(`${second}.uncommitted`) && !existsSync(second));

      // Clean CLI apply: exclusive pending file, renamed after COMMIT.
      const third = path.join(dir, 'third.json');
      run = cli('apply', '--manifest', 'docs/offer-clarity-2026-11-16.changes.json', '--receipt', third);
      assert.equal(run.status, 0, run.stderr + run.stdout);
      assert(existsSync(third) && !existsSync(`${third}.pending`));
      assert.equal(JSON.parse(readFileSync(third, 'utf8')).changed.length, 24);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    await client.query(`drop schema if exists ${schema} cascade`).catch(() => {});
    await client.end();
  }
});
