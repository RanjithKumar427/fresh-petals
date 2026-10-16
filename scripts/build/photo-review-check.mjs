// Build-time guard for src/data/productPhotos.ts (PHOTO_REVIEWS).
//
// A review binds a product to one exact catalogue file AND that file's
// content (a sha256 prefix). At runtime the site can only compare paths --
// it never downloads or hashes images -- so a file replaced at the same path
// would keep its old verdict, description and image-sitemap entry. Catalogue
// photographs live in public/ and only change through a deployment, so the
// build is the one place that can catch it: `astro build` fails while any
// reviewed file's content differs from its review, until someone looks at
// the new photograph and updates the entry. Garland photographs are not
// covered here: they are admin uploads stored under generated names that are
// never overwritten (SupabaseStorageProvider, upsert: false).
//
// Reads the existing review entries from the source file; adds no registry.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ENTRY = /^\s*"([a-z0-9-]+)":\s*\{\s*photo:\s*"([^"]+)",\s*sha256:\s*"([0-9a-f]{16})",\s*verdict:\s*"(product|unconfirmed|illustrative|unrelated)"\s*\},?\s*$/;

/** The review entries in productPhotos.ts, as written. */
export function readPhotoReviews(root = process.cwd()) {
  const source = readFileSync(path.join(root, 'src/data/productPhotos.ts'), 'utf8');
  const block = source.slice(source.indexOf('export const PHOTO_REVIEWS'), source.indexOf('\n};', source.indexOf('export const PHOTO_REVIEWS')));
  const entries = [];
  for (const line of block.split(/\r?\n/)) {
    const match = ENTRY.exec(line);
    if (match) entries.push({ slug: match[1], photo: match[2], sha256: match[3], verdict: match[4] });
  }
  return entries;
}

/** Reviews whose file is missing or whose content no longer matches the review. */
export function staleReviews({ root = process.cwd(), publicDir = path.join(root, 'public') } = {}) {
  const reviews = readPhotoReviews(root);
  if (reviews.length === 0) return [{ slug: '(none)', photo: '', reason: 'no review entries could be read from src/data/productPhotos.ts' }];
  const stale = [];
  for (const review of reviews) {
    const file = path.join(publicDir, review.photo);
    if (!existsSync(file)) {
      stale.push({ ...review, reason: 'file missing' });
      continue;
    }
    const actual = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
    if (actual !== review.sha256) stale.push({ ...review, reason: `content changed (now ${actual})` });
  }
  return stale;
}

/** Astro integration: fail the build on any stale review. */
export const photoReviewCheck = {
  name: 'fresh-petals:photo-review-check',
  hooks: {
    'astro:config:setup': ({ command, logger }) => {
      if (command !== 'build') return;
      const stale = staleReviews();
      if (stale.length) {
        const list = stale.map((s) => `  ${s.slug} ${s.photo}: ${s.reason}`).join('\n');
        throw new Error(
          `Photo reviews out of date (src/data/productPhotos.ts). Look at each photograph again and update its entry:\n${list}`,
        );
      }
      logger.info(`Photo reviews match their files (${readPhotoReviews().length} entries).`);
    },
  },
};
