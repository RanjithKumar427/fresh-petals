// Applies a reviewed copy manifest (e.g. docs/offer-clarity-2026-11-16.changes.json)
// to the admin product records, so the dashboard — which supplies product
// names and descriptions on Cloudflare builds (src/data/dashboardCatalogue.ts)
// — holds the same copy as the storefront source. The dashboard stays the
// editor of these fields; nothing here makes code override them.
//
//   node scripts/content/apply-copy-changes.mjs plan     --manifest <file> --database-url <url>
//   node scripts/content/apply-copy-changes.mjs apply    --manifest <file> --database-url <url> --receipt <new file>
//   node scripts/content/apply-copy-changes.mjs rollback --receipt <file>  --database-url <url>
//   node scripts/content/apply-copy-changes.mjs reconcile --receipt <file> --database-url <url>
//
// Every intended field is classified against the record as it is now:
//   expected-old  holds the value live before the release  -> will be changed
//   already-new   already holds the new copy                -> left alone (no-op)
//   conflicting   holds something else (an admin edit since)  -> abort
//   missing       no product with that slug                 -> abort
// Any conflicting or missing field aborts the whole batch; nothing is written.
//
// apply and rollback run in one transaction: the rows are locked (SELECT …
// FOR UPDATE, so an admin save waits rather than slipping between the check
// and the write), classified again, updated with a guard on the expected
// value, read back and compared before COMMIT. The receipt records only the
// fields this run changed, with their actual before-values; rollback restores
// exactly those, matched by the product's id and slug, and only while each
// still holds the value this run wrote (a replacement record or a newer edit
// aborts the whole rollback).
//
// Receipts. apply refuses to start if <receipt> or <receipt>.pending already
// exists, and creates <receipt>.pending exclusively before COMMIT; after
// COMMIT it is renamed to <receipt>. If the process stops between the two,
// the commit's outcome is uncertain and the .pending file is the only copy of
// the before-values: a rerun refuses to start (so they cannot be overwritten
// by a receipt of "nothing changed"). Run `reconcile`: it reads the records
// and renames .pending to <receipt> when every listed field holds the new
// copy (committed), to <receipt>.uncommitted when every one holds its
// before-value (not committed), and otherwise stops without touching it.
// The database URL is never read from the environment: it must be passed.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

export const PENDING = (receipt) => `${receipt}.pending`;
import pg from 'pg';
// The same pinned Supabase CA and full verification the application uses (src/server/db/postgres/client.ts).
import { supabasePoolSsl } from '../../src/server/db/postgres/ssl.mjs';

export const COLUMNS = new Set(['name', 'short_description', 'description']);

/** Classify manifest changes against current rows ({ slug, id, name, short_description, description }). */
export function classify(changes, rows) {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return changes.map((change) => {
    if (!COLUMNS.has(change.column)) throw new Error(`Unsupported column ${change.column}`);
    const row = bySlug.get(change.slug);
    if (!row) return { ...change, status: 'missing', current: null, id: null };
    const current = row[change.column];
    const status = current === change.new ? 'already-new' : current === change.old ? 'expected-old' : 'conflicting';
    return { ...change, status, current, id: row.id };
  });
}

/** Field and distinct-product counts per status. */
export function summarise(classified) {
  const out = {};
  for (const status of ['expected-old', 'already-new', 'conflicting', 'missing', 'replaced']) {
    const items = classified.filter((item) => item.status === status);
    out[status] = { fields: items.length, products: new Set(items.map((item) => item.slug)).size };
  }
  out.total = { fields: classified.length, products: new Set(classified.map((item) => item.slug)).size };
  return out;
}

const blocking = (classified) => classified.filter((item) => item.status === 'conflicting' || item.status === 'missing' || item.status === 'replaced');

const report = (label, classified) => {
  console.log(`${label}: ${JSON.stringify(summarise(classified))}`);
  for (const item of blocking(classified)) console.log(`  ${item.status}: ${item.slug}.${item.column} holds ${JSON.stringify(item.current)}`);
};

async function lockedRows(client, slugs) {
  return (await client.query('select id, slug, name, short_description, description from products where slug = any($1::text[]) order by id for update', [slugs])).rows;
}

async function readRows(client, slugs) {
  return (await client.query('select id, slug, name, short_description, description from products where slug = any($1::text[]) order by id', [slugs])).rows;
}

/** Guarded write of one field; throws unless exactly one row changed. */
async function writeField(client, { id, column, from, to }) {
  const result = await client.query(`update products set ${column} = $1, updated_at = now() where id = $2 and ${column} is not distinct from $3`, [to, id, from]);
  if (result.rowCount !== 1) throw new Error(`Guarded write changed ${result.rowCount} rows for product ${id}.${column}`);
}

export async function plan(client, changes) {
  await client.query('begin read only');
  try {
    const classified = classify(changes, await readRows(client, [...new Set(changes.map((c) => c.slug))]));
    return { classified, summary: summarise(classified), ok: blocking(classified).length === 0 };
  } finally {
    await client.query('rollback');
  }
}

/**
 * beforeCommit(receipt) runs after verification and before COMMIT, so the
 * before-values are on disk before the change is: a failed write aborts the
 * batch, and a receipt left as .pending marks a commit whose outcome is unknown.
 */
export async function apply(client, changes, { release, beforeCommit } = {}) {
  await client.query('begin');
  try {
    await client.query("set local lock_timeout = '10s'");
    const slugs = [...new Set(changes.map((c) => c.slug))];
    const classified = classify(changes, await lockedRows(client, slugs));
    if (blocking(classified).length) {
      await client.query('rollback');
      return { ok: false, classified, summary: summarise(classified) };
    }
    const toWrite = classified.filter((item) => item.status === 'expected-old');
    for (const item of toWrite) await writeField(client, { id: item.id, column: item.column, from: item.current, to: item.new });
    // Read back inside the transaction: every intended field must now hold the new copy.
    const after = classify(changes, await readRows(client, slugs));
    const wrong = after.filter((item) => item.status !== 'already-new');
    if (wrong.length) throw new Error(`Verification failed for ${wrong.map((w) => `${w.slug}.${w.column}`).join(', ')}`);
    const receipt = {
      release,
      appliedAt: new Date().toISOString(),
      changed: toWrite.map((item) => ({ id: item.id, slug: item.slug, column: item.column, before: item.current, after: item.new })),
      alreadyNew: classified.filter((item) => item.status === 'already-new').map((item) => ({ slug: item.slug, column: item.column })),
    };
    if (beforeCommit) await beforeCommit(receipt);
    await client.query('commit');
    return { ok: true, classified, summary: summarise(classified), receipt };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  }
}

/**
 * Classify a receipt's changed fields against rows read by product id: the
 * record must be the same product (id and slug) and hold what this run wrote
 * ("expected-old" here, to be restored) or already its before-value
 * ("already-new": nothing to do). A missing id, a different slug on that id
 * (a replacement record) or any other value blocks.
 */
export function classifyReceipt(changed, rows) {
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  return changed.map((item) => {
    if (!COLUMNS.has(item.column)) throw new Error(`Unsupported column ${item.column}`);
    const change = { slug: item.slug, column: item.column, old: item.after, new: item.before, id: item.id };
    const row = byId.get(String(item.id));
    if (!row) return { ...change, status: 'missing', current: null };
    if (row.slug !== item.slug) return { ...change, status: 'replaced', current: row.slug };
    const current = row[item.column];
    return { ...change, current, status: current === item.before ? 'already-new' : current === item.after ? 'expected-old' : 'conflicting' };
  });
}

async function rowsById(client, ids, { lock = false } = {}) {
  return (await client.query(`select id, slug, name, short_description, description from products where id::text = any($1::text[]) order by id${lock ? ' for update' : ''}`, [ids.map(String)])).rows;
}

/** Restores the receipt's changed fields; a replaced record, a field edited since, or a missing record aborts the batch. */
export async function rollback(client, receipt) {
  await client.query('begin');
  try {
    await client.query("set local lock_timeout = '10s'");
    const ids = [...new Set(receipt.changed.map((c) => c.id))];
    // "old" here is what this run wrote, "new" the restored value.
    const classified = classifyReceipt(receipt.changed, await rowsById(client, ids, { lock: true }));
    if (classified.some((item) => item.status !== 'expected-old' && item.status !== 'already-new')) {
      await client.query('rollback');
      return { ok: false, classified, summary: summarise(classified) };
    }
    for (const item of classified.filter((i) => i.status === 'expected-old')) await writeField(client, { id: item.id, column: item.column, from: item.current, to: item.new });
    const after = classifyReceipt(receipt.changed, await rowsById(client, ids));
    const wrong = after.filter((item) => item.status !== 'already-new');
    if (wrong.length) throw new Error(`Rollback verification failed for ${wrong.map((w) => `${w.slug}.${w.column}`).join(', ')}`);
    await client.query('commit');
    return { ok: true, classified, summary: summarise(classified) };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  }
}

/**
 * After an interrupted apply: decide from the records whether the pending
 * receipt's transaction committed. Read-only.
 *   committed     every listed field holds the copy this run wrote
 *   not-committed every listed field holds its before-value
 *   uncertain     anything else (a mix, a newer edit, a replaced or missing record)
 */
export async function reconcile(client, pendingReceipt) {
  const rows = await rowsById(client, [...new Set(pendingReceipt.changed.map((c) => c.id))]);
  const classified = classifyReceipt(pendingReceipt.changed, rows);
  const all = (status) => classified.every((item) => item.status === status);
  const outcome = classified.length === 0 ? 'committed' : all('expected-old') ? 'committed' : all('already-new') ? 'not-committed' : 'uncertain';
  return { outcome, classified };
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

if (process.argv[1]?.endsWith('apply-copy-changes.mjs')) {
  const opts = args(process.argv.slice(2));
  const action = opts._[0];
  if (!['plan', 'apply', 'rollback', 'reconcile'].includes(action) || !opts['database-url']) {
    console.error('Usage: plan|apply --manifest <file> --database-url <url> [--receipt <new file>] | rollback|reconcile --receipt <file> --database-url <url>');
    process.exit(64);
  }
  // Checked before connecting: an apply never starts beside an earlier receipt, final or pending.
  if (action === 'apply') {
    if (!opts.receipt) { console.error('apply needs --receipt <new file>'); process.exit(64); }
    for (const file of [opts.receipt, PENDING(opts.receipt)]) if (existsSync(file)) { console.error(`${file} exists: an earlier apply used this receipt name. If it is .pending, run reconcile first.`); process.exit(65); }
  }
  const url = opts['database-url'];
  const client = new pg.Client({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : supabasePoolSsl });
  await client.connect();
  try {
    if (action === 'reconcile') {
      const pending = PENDING(opts.receipt);
      if (!existsSync(pending)) throw new Error(`No ${pending} to reconcile`);
      if (existsSync(opts.receipt)) throw new Error(`${opts.receipt} already exists; not overwriting it`);
      const { outcome, classified } = await reconcile(client, JSON.parse(readFileSync(pending, 'utf8')));
      report(`reconcile (${outcome})`, classified);
      if (outcome === 'committed') { renameSync(pending, opts.receipt); console.log(`Committed: receipt is ${opts.receipt}.`); }
      else if (outcome === 'not-committed') { renameSync(pending, `${opts.receipt}.uncommitted`); console.log(`Not committed: nothing changed; kept as ${opts.receipt}.uncommitted.`); }
      else console.log(`Uncertain: ${pending} left in place; resolve the fields listed above by hand.`);
      process.exitCode = outcome === 'uncertain' ? 2 : 0;
    } else if (action === 'rollback') {
      const receipt = JSON.parse(readFileSync(opts.receipt, 'utf8'));
      const result = await rollback(client, receipt);
      report('rollback', result.classified);
      process.exitCode = result.ok ? 0 : 2;
    } else {
      const manifest = JSON.parse(readFileSync(opts.manifest, 'utf8'));
      if (action === 'plan') {
        const result = await plan(client, manifest.changes);
        report('plan', result.classified);
        process.exitCode = result.ok ? 0 : 2;
      } else {
        const pending = PENDING(opts.receipt);
        // flag "wx": created exclusively; if it appeared meanwhile, the write fails and nothing commits.
        const result = await apply(client, manifest.changes, { release: manifest.release, beforeCommit: (receipt) => writeFileSync(pending, JSON.stringify(receipt, null, 1), { flag: 'wx' }) });
        report('apply', result.classified);
        if (result.ok) {
          try {
            renameSync(pending, opts.receipt);
          } catch (error) {
            console.error(`Committed, but the receipt could not be renamed (${error.code ?? error.message}). The before-values are in ${pending}; run reconcile.`);
            process.exitCode = 3;
          }
          if (!process.exitCode) console.log(`Changed ${result.receipt.changed.length} fields; receipt written to ${opts.receipt}.`);
        } else {
          console.log('Aborted: nothing was written.');
        }
        if (!process.exitCode) process.exitCode = result.ok ? 0 : 2;
      }
    }
  } finally {
    await client.end();
  }
}
