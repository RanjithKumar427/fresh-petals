// Downloads every Supabase Storage object (all buckets) with its path, and
// writes a manifest with size and SHA-256 compared to Storage's own metadata.
// Read-only: lists and downloads, never uploads, moves or deletes.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup/storage-backup.mjs <outDir>
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('Usage: storage-backup.mjs <outDir>');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: buckets, error } = await supabase.storage.listBuckets();
if (error) throw error;
const manifest = { takenAt: new Date().toISOString(), buckets: [] };
let failures = 0;
async function walk(bucket, prefix, files) {
  for (let offset = 0; ; offset += 1000) {
    const { data, error: listError } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (listError) throw listError;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) await walk(bucket, full, files);
      else files.push({ path: full, size: item.metadata?.size ?? null, mimetype: item.metadata?.mimetype ?? null });
    }
    if (data.length < 1000) break;
  }
}
for (const bucket of buckets) {
  const files = [];
  await walk(bucket.name, '', files);
  for (const file of files) {
    const { data, error: downloadError } = await supabase.storage.from(bucket.name).download(file.path);
    if (downloadError) { file.error = downloadError.message; failures += 1; continue; }
    const bytes = Buffer.from(await data.arrayBuffer());
    const target = path.join(out, bucket.name, file.path);
    if (!target.startsWith(path.resolve(out))) throw new Error(`unsafe object path ${file.path}`);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    file.sha256 = createHash('sha256').update(bytes).digest('hex');
    file.downloaded = bytes.length;
    if (file.size !== null && file.size !== bytes.length) { file.error = 'size differs from Storage metadata'; failures += 1; }
  }
  manifest.buckets.push({ name: bucket.name, public: bucket.public, objects: files.length, files });
  console.log(`${bucket.name}: ${files.length} objects`);
}
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
if (failures) { console.error(`${failures} object(s) failed or differ; see manifest.json`); process.exit(1); }
