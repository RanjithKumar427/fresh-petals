import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { loadEnv } from 'vite';
import { copyFile, link, mkdir, readdir, readFile, rm, rmdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Server-only secrets are read via `process.env` (src/server/db/postgres/
// client.ts, src/server/auth/*), but `astro dev` does not copy .env /
// .env.local into process.env — only `astro build` happened to, so every
// storefront page 500'd locally with "DATABASE_URL is not set". Load just
// these keys from the .env files, and only when the real environment hasn't
// already set them, so Vercel's own project env vars always take precedence
// (and .env files are gitignored, so none exist there anyway). SITE_URL is
// deliberately not in this list: production canonical URLs keep coming
// solely from the real environment.
const SERVER_ENV_KEYS = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const fileEnv = loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', process.cwd(), '');
for (const key of SERVER_ENV_KEYS) {
  if (!process.env[key] && fileEnv[key]) process.env[key] = fileEnv[key];
}

// The one place the production URL is configured — canonical tags,
// sitemap.xml and robots.txt's Sitemap: line all derive from this single
// value (via Astro.site) rather than each hardcoding their own guess.
// Production sets SITE_URL=https://onlyfreshpetals.in in Vercel (verified:
// the live pages' canonical tags use it), but it is scoped to Production
// only, so Preview builds and local builds used to fall back to
// fresh-petals-brown.vercel.app — itself a production alias serving the
// same pages. The fallback is now the live domain, so no build can emit
// canonicals, OG URLs or a sitemap pointing search engines at the
// vercel.app duplicate.
const SITE_URL = process.env.SITE_URL || 'https://onlyfreshpetals.in';

// Garland draft photographs (public/images/garlands/, git-ignored until
// photo-publication permission is confirmed — see docs/garlands.md) must not
// enter a normal build. Unless this is a draft-preview build
// (PUBLIC_FP_PREVIEW_DRAFTS=1, the same flag src/data/garlands.ts reads), a
// build reads its public files from a hard-linked mirror of public/ that
// leaves out every garland photo not belonging to a public design (the rule
// in src/data/garlandRules.ts: published, photo permission "granted", sample
// verified; a public design keeps its main photo and confirmed `gallery`,
// never provisional `relatedViews`). Excluded photos are therefore never
// copied, never listed in the server's static-asset manifest and never
// deployed. After the build, the output is checked again as a safety net.
// `astro dev` always serves public/ directly.
const GARLAND_PREVIEW_BUILD = (process.env.PUBLIC_FP_PREVIEW_DRAFTS ?? fileEnv.PUBLIC_FP_PREVIEW_DRAFTS) === '1';
const GARLAND_DIR = path.join('images', 'garlands');

async function publicGarlandPhotos() {
  const drafts = JSON.parse(await readFile('src/data/garlandDrafts.json', 'utf8'));
  const keep = new Set();
  const add = (photo) => [photo.path, ...Object.values(photo.variants ?? {})].forEach((item) => keep.add(item));
  for (const design of drafts.designs) {
    if (!(design.published === true && design.photoPermission === 'granted' && design.sampleVerified === true)) continue;
    add(design.image);
    (design.gallery ?? []).forEach(add);
  }
  return keep;
}

const webPath = (root, full) => '/' + path.relative(root, full).split(path.sep).join('/');

/** Mirror `from` into `to` with hard links (copies if linking fails), skipping excluded garland photos. */
async function mirror(from, to, root, keep) {
  let skipped = 0;
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      skipped += await mirror(source, target, root, keep);
    } else if (webPath(root, source).startsWith('/images/garlands/') && !keep.has(webPath(root, source))) {
      skipped += 1;
    } else {
      try {
        await link(source, target);
      } catch {
        await copyFile(source, target);
      }
    }
  }
  return skipped;
}

async function stripUnpublished(dir, root, keep) {
  let removed = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += await stripUnpublished(full, root, keep);
      if ((await readdir(full)).length === 0) await rmdir(full);
    } else if (!keep.has(webPath(root, full))) {
      await rm(full, { force: true });
      removed += 1;
    }
  }
  return removed;
}

const garlandDraftPhotos = {
  name: 'fresh-petals:garland-draft-photos',
  hooks: {
    'astro:config:setup': async ({ command, config, updateConfig, logger }) => {
      if (command !== 'build') return;
      if (GARLAND_PREVIEW_BUILD) {
        logger.info('Draft preview build: all garland photos included (PUBLIC_FP_PREVIEW_DRAFTS=1).');
        return;
      }
      const publicRoot = fileURLToPath(config.publicDir);
      const staging = path.resolve('node_modules/.cache/fresh-petals-public');
      await rm(staging, { recursive: true, force: true });
      const skipped = await mirror(publicRoot, staging, publicRoot, await publicGarlandPhotos());
      updateConfig({ publicDir: pathToFileURL(staging + path.sep).href });
      logger.info(`Public files read from a mirror without ${skipped} unpublished garland photo file(s).`);
    },
    'astro:build:done': async ({ dir, logger }) => {
      if (GARLAND_PREVIEW_BUILD) return;
      const keep = await publicGarlandPhotos();
      const roots = new Set([fileURLToPath(dir), 'dist/client', '.vercel/output/static'].map((root) => path.resolve(root)));
      for (const root of roots) {
        const target = path.join(root, GARLAND_DIR);
        if (!existsSync(target)) continue;
        const removed = await stripUnpublished(target, root, keep);
        if ((await readdir(target)).length === 0) await rmdir(target);
        if (removed) logger.warn(`Safety net removed ${removed} unpublished garland photo file(s) from ${path.relative(process.cwd(), target)}`);
      }
    },
  },
};

export default defineConfig({
  site: SITE_URL,

  // The bouquet builder ("Studio", /studio) was removed on 4 Oct 2026. Its
  // old URL permanently redirects to the bouquet listing (a Vercel edge 301).
  // Deeper or trailing-slash paths (/studio/, /studio/…) are answered by
  // src/pages/studio/[...path].astro, since Astro cannot redirect a dynamic
  // path to a static destination here.
  redirects: {
    '/studio': { status: 301, destination: '/categories/bouquets' },
  },

  // The storefront stays fully static (output defaults to 'static' and every
  // page keeps prerendering). Only admin/API/media routes opt into on-demand
  // rendering via `export const prerender = false`, which is what actually
  // needs this adapter — those routes deploy as Vercel serverless functions.
  //
  // `isr` is deliberately left at its default (false/unset): the installed
  // @astrojs/vercel@10.0.8 carries a high-severity advisory
  // (GHSA-x27w-589x-frm2, unauthenticated path override) that lives entirely
  // inside the ISR build path (`buildISRFolder`, gated by `if (isr)` —
  // verified by reading node_modules/@astrojs/vercel/dist/index.js). With
  // isr never enabled, that code never runs, so this build carries the
  // advisory on paper but not as a live attack surface. The real fix is an
  // Astro 7 upgrade (@astrojs/vercel's next major requires astro ^7.0.0),
  // which is a separate, deliberately out-of-scope decision for this
  // milestone — do not enable `isr` here without addressing that upgrade
  // first.
  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react(), garlandDraftPhotos],
});