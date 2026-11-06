// Build step: the admin's catalogue records, for src/data/dashboardCatalogue.ts.
//
// Read once by scripts/cloudflare/build.mjs before `astro build` and written to
// src/data/generated/dashboard-catalogue.json (git-ignored). Every non-garland
// product record is included whatever its status; which ones are public is
// still the build's publication snapshot (src/server/services/PublicCatalogue.ts).
// One query; about 1 KB per product.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const DASHBOARD_CATALOGUE_FILE = 'src/data/generated/dashboard-catalogue.json';

export const DASHBOARD_CATALOGUE_SQL = `
select p.id, p.slug, p.name, p.short_description, p.description, p.price_type::text as price_type, p.stem_count,
  p.requires_whatsapp_confirmation as requires_confirmation, c.name as category, c.slug as category_slug,
  (select json_build_object('url', m.url, 'alt', coalesce(pi.alt_text, m.alt_text), 'width', m.width, 'height', m.height)
     from product_images pi join media m on m.id = pi.media_id where pi.product_id = p.id
     order by pi.is_primary desc, pi.sort_order asc limit 1) as image,
  coalesce((select json_agg(w.value order by w.sort_order, w.id) from product_whats_included w where w.product_id = p.id), '[]') as whats_included,
  coalesce((select json_agg(ci.value order by ci.sort_order, ci.id) from product_care_instructions ci where ci.product_id = p.id), '[]') as care,
  coalesce((select json_agg(f.name order by f.name) from product_flower_types pf join flower_types f on f.id = pf.flower_type_id where pf.product_id = p.id), '[]') as flowers,
  coalesce((select json_agg(o.slug order by o.slug) from product_occasions po join occasions o on o.id = po.occasion_id where po.product_id = p.id), '[]') as occasions
from products p join categories c on c.id = p.category_id
where not exists (select 1 from garland_details g where g.product_id = p.id)
order by p.id`;

/** Writes the records; a local photo path is marked usable only when the file is in public/. */
export function writeDashboardCatalogue(rows, root = process.cwd()) {
  const products = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    priceType: row.price_type,
    stemCount: row.stem_count,
    requiresConfirmation: row.requires_confirmation,
    category: row.category,
    categorySlug: row.category_slug,
    image: row.image
      ? { ...row.image, usable: /^https:\/\//.test(row.image.url ?? '') || (/^\/[\w./-]+$/.test(row.image.url ?? '') && !row.image.url.includes('..') && existsSync(path.join(root, 'public', row.image.url))) }
      : null,
    whatsIncluded: row.whats_included,
    careNotes: row.care,
    flowerTypes: row.flowers,
    occasions: row.occasions,
  }));
  const file = path.join(root, DASHBOARD_CATALOGUE_FILE);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), products }));
  return products.length;
}
