// Build step: stored photos (admin uploads in Supabase Storage) as static files.
//
// Every stored photo the build may show is resized here, at build time, into WebP
// copies at the site's four widths (STORED_PHOTO_WIDTHS), next to the original.
// Pages then reference /photos/<sha256>-<width>.webp: static files served without
// running the Worker and without reading Storage per visitor (no /_image request,
// no Images transformation, no Storage egress per view). Each photo's bytes are
// checked against media.checksum (SHA-256), so a copy is never silently wrong.
//
// Where the bytes come from, in order:
//   1. the cache (node_modules/.cache/fresh-petals-photos, kept between builds, and
//      by actions/cache in CI), so a build downloads only new uploads;
//   2. FP_PHOTO_SOURCE_DIRS (optional, ';'-separated folders holding exact copies,
//      matched by SHA-256), e.g. the owner's local archive of the uploads;
//   3. the photo's public Storage URL.
// A photo none of these can provide keeps its /_image address (a warning, not a
// failure), so the page still works whenever Storage does.
//
// Only files that a built page actually references are copied into the output
// (copyReferencedPhotos), so a draft's or unapproved photo never becomes public.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const PHOTO_MANIFEST_FILE = 'src/data/generated/photo-manifest.json';
export const PHOTO_CACHE_DIR = 'node_modules/.cache/fresh-petals-photos';
export const PHOTO_WIDTHS = [240, 480, 720, 1080]; // = STORED_PHOTO_WIDTHS in src/data/garlandRules.ts
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

export const STORED_PHOTOS_SQL = `select url, checksum, mime_type, width from media where path is not null and url like 'https://%' and checksum ~ '^[0-9a-f]{64}$' order by id`;

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function indexSources(dirs) {
  const index = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(jpe?g|png|webp|gif)$/i.test(name)) index.set(sha256(readFileSync(full)), full);
    }
  };
  for (const dir of dirs) if (dir && existsSync(dir)) walk(dir);
  return index;
}

/** Writes the photo manifest (Storage URL → static paths) and the resized copies into the cache. */
export async function prepareStoredPhotos(rows, { root = process.cwd(), sourceDirs = (process.env.FP_PHOTO_SOURCE_DIRS ?? '').split(';').filter(Boolean), fetcher = fetch, log = console.log } = {}) {
  const sharp = (await import('sharp')).default;
  const cache = path.join(root, PHOTO_CACHE_DIR);
  mkdirSync(cache, { recursive: true });
  const sources = indexSources(sourceDirs);
  const manifest = {};
  const counts = { cached: 0, local: 0, downloaded: 0, unavailable: 0 };
  for (const row of rows) {
    const ext = EXT[row.mime_type] ?? path.extname(new URL(row.url).pathname) ?? '.jpg';
    const original = path.join(cache, `${row.checksum}${ext}`);
    if (existsSync(original) && sha256(readFileSync(original)) === row.checksum) counts.cached += 1;
    else if (sources.has(row.checksum)) { copyFileSync(sources.get(row.checksum), original); counts.local += 1; }
    else {
      const bytes = await fetcher(row.url, { signal: AbortSignal.timeout(30000) }).then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()) : null)).catch(() => null);
      if (!bytes || sha256(bytes) !== row.checksum) { counts.unavailable += 1; continue; }
      writeFileSync(original, bytes);
      counts.downloaded += 1;
    }
    const variants = {};
    for (const width of PHOTO_WIDTHS.filter((w) => !row.width || w <= row.width)) {
      const file = path.join(cache, `${row.checksum}-${width}.webp`);
      if (!existsSync(file)) await sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 75 }).toFile(file);
      variants[width] = `/photos/${row.checksum}-${width}.webp`;
    }
    const largest = Math.max(...Object.keys(variants).map(Number), 0);
    manifest[row.url] = { path: largest ? variants[largest] : `/photos/${row.checksum}${ext}`, original: `/photos/${row.checksum}${ext}`, variants };
  }
  const file = path.join(root, PHOTO_MANIFEST_FILE);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(manifest));
  log(`Stored photos: ${rows.length} (${counts.cached} cached, ${counts.local} from local copies, ${counts.downloaded} downloaded, ${counts.unavailable} unavailable: those keep /_image).`);
  return counts;
}

/** Copies into the static output only the photo files that built pages reference. */
export function copyReferencedPhotos(staticDir, root = process.cwd()) {
  const cache = path.join(root, PHOTO_CACHE_DIR);
  const referenced = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(html|xml|json)$/.test(name)) for (const m of readFileSync(full, 'utf8').matchAll(/\/photos\/([0-9a-f]{64}(?:-\d+)?\.(?:webp|jpe?g|png|gif))/g)) referenced.add(m[1]);
    }
  };
  walk(staticDir);
  const out = path.join(staticDir, 'photos');
  mkdirSync(out, { recursive: true });
  const missing = [];
  for (const name of referenced) {
    const from = path.join(cache, name);
    if (existsSync(from)) copyFileSync(from, path.join(out, name));
    else missing.push(name);
  }
  return { copied: referenced.size - missing.length, missing };
}
