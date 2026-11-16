// Applies a reviewed copy manifest (e.g. docs/offer-clarity-2026-11-16.changes.json)
// to the admin product records, so the dashboard — which supplies product
// names and descriptions on Cloudflare builds (src/data/dashboardCatalogue.ts)
// — holds the same copy as the storefront source. The dashboard stays the
// editor of these fields; nothing here makes code override them.
//
//   node scripts/content/apply-copy-changes.mjs plan     --manifest <file> --database-url <url>
//   node scripts/content/apply-copy-changes.mjs apply    --manifest <file> --database-url <url> --receipt <new file>
//   node scripts/content/apply-copy-changes.mjs rollback --receipt <file>  --database-url <url>
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
// exactly those, and only while each still holds the value this run wrote.
// The database URL is never read from the environment: it must be passed.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import pg from 'pg';

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
  for (const status of ['expected-old', 'already-new', 'conflicting', 'missing']) {
    const items = classified.filter((item) => item.status === status);
    out[status] = { fields: items.length, products: new Set(items.map((item) => item.slug)).size };
  }
  out.total = { fields: classified.length, products: new Set(classified.map((item) => item.slug)).size };
  return out;
}

const blocking = (classified) => classified.filter((item) => item.status === 'conflicting' || item.status === 'missing');

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

/** Restores the receipt's changed fields; any field edited since (or missing) aborts the batch. */
export async function rollback(client, receipt) {
  await client.query('begin');
  try {
    await client.query("set local lock_timeout = '10s'");
    const changes = receipt.changed.map((item) => ({ slug: item.slug, column: item.column, old: item.after, new: item.before }));
    const slugs = [...new Set(changes.map((c) => c.slug))];
    // "old" here is what this run wrote, "new" the restored value.
    const classified = classify(changes, await lockedRows(client, slugs));
    if (blocking(classified).length) {
      await client.query('rollback');
      return { ok: false, classified, summary: summarise(classified) };
    }
    for (const item of classified.filter((i) => i.status === 'expected-old')) await writeField(client, { id: item.id, column: item.column, from: item.current, to: item.new });
    const after = classify(changes, await readRows(client, slugs));
    const wrong = after.filter((item) => item.status !== 'already-new');
    if (wrong.length) throw new Error(`Rollback verification failed for ${wrong.map((w) => `${w.slug}.${w.column}`).join(', ')}`);
    await client.query('commit');
    return { ok: true, classified, summary: summarise(classified) };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  }
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
  if (!['plan', 'apply', 'rollback'].includes(action) || !opts['database-url']) {
    console.error('Usage: plan|apply --manifest <file> --database-url <url> [--receipt <new file>] | rollback --receipt <file> --database-url <url>');
    process.exit(64);
  }
  const url = opts['database-url'];
  const client = new pg.Client({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : { rejectUnauthorized: true } });
  await client.connect();
  try {
    if (action === 'rollback') {
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
        if (!opts.receipt) throw new Error('apply needs --receipt <new file>');
        if (existsSync(opts.receipt)) throw new Error(`Receipt ${opts.receipt} exists; choose a new file`);
        const pending = `${opts.receipt}.pending`;
        const result = await apply(client, manifest.changes, { release: manifest.release, beforeCommit: (receipt) => writeFileSync(pending, JSON.stringify(receipt, null, 1)) });
        report('apply', result.classified);
        if (result.ok) {
          renameSync(pending, opts.receipt);
          console.log(`Changed ${result.receipt.changed.length} fields; receipt written to ${opts.receipt}.`);
        } else {
          console.log('Aborted: nothing was written.');
        }
        process.exitCode = result.ok ? 0 : 2;
      }
    }
  } finally {
    await client.end();
  }
}
