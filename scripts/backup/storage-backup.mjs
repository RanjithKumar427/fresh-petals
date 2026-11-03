// Downloads every Supabase Storage object (all buckets) with its path, and
// writes a manifest with size and SHA-256 compared to Storage's own metadata
// and, when given, to the object counts in the backup inventory.
// Read-only: lists and downloads, never uploads, moves or deletes.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup/storage-backup.mjs <outDir> [inventory.tsv]
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: storage-backup.mjs <outDir> [inventory.tsv]');
const inventoryFile = process.argv[3];
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: buckets, error } = await supabase.storage.listBuckets();
if (error) throw error;
const manifest = { takenAt: new Date().toISOString(), buckets: [], problems: [] };
async function walk(bucket, prefix, files) {
  for (let offset = 0; ; offset += 1000) {
    const { data, error: listError } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (listError) throw new Error(`listing ${bucket}/${prefix}: ${listError.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) await walk(bucket, full, files); // a folder
      else files.push({ path: full, size: item.metadata?.size ?? null, mimetype: item.metadata?.mimetype ?? null });
    }
    if (data.length < 1000) break;
  }
}
for (const bucket of buckets) {
  const files = [];
  await walk(bucket.name, '', files);
  for (const file of files) {
    const target = path.resolve(out, bucket.name, file.path);
    if (!target.startsWith(out + path.sep)) { file.error = 'unsafe object path; not written'; manifest.problems.push(`${bucket.name}/${file.path}: unsafe path`); continue; }
    const { data, error: downloadError } = await supabase.storage.from(bucket.name).download(file.path);
    if (downloadError) { file.error = downloadError.message; manifest.problems.push(`${bucket.name}/${file.path}: ${downloadError.message}`); continue; }
    const bytes = Buffer.from(await data.arrayBuffer());
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    file.sha256 = createHash('sha256').update(bytes).digest('hex');
    file.downloaded = bytes.length;
    if (file.size !== null && file.size !== bytes.length) { file.error = 'size differs from Storage metadata'; manifest.problems.push(`${bucket.name}/${file.path}: size ${bytes.length} vs metadata ${file.size}`); }
  }
  manifest.buckets.push({ name: bucket.name, public: bucket.public, objects: files.length, files });
  console.log(`${bucket.name}: ${files.length} objects`);
}
if (inventoryFile) {
  // storage.objects rows per bucket (from the database) vs objects found by listing.
  const expected = new Map(readFileSync(inventoryFile, 'utf8').split('\n').map((line) => line.split('\t')).filter((cells) => cells[0] === 'storage_objects').map(([, bucket, count]) => [bucket, Number(count)]));
  for (const [bucket, count] of expected) {
    const found = manifest.buckets.find((b) => b.name === bucket)?.objects ?? 0;
    if (found !== count) manifest.problems.push(`${bucket}: ${found} objects listed, ${count} rows in storage.objects`);
  }
}
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
if (manifest.problems.length) { console.error(`${manifest.problems.length} problem(s):\n  ${manifest.problems.slice(0, 20).join('\n  ')}`); process.exit(1); }
