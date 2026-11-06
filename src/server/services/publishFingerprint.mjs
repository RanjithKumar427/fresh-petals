// One fingerprint of everything the prebuilt storefront is built from: every
// public table except enquiries and admin accounts. Shared by the build
// (scripts/cloudflare/build.mjs writes it to /_publish/state.json) and the
// Worker (GET /api/publish/state), so "is the deployed site current?" is one
// comparison. The database computes it: one row of 32 characters crosses the
// network, whatever the table sizes. Plain JS so the build script can import it.
export const PUBLISHED_TABLES = [
  "categories",
  "delivery_zones",
  "flower_types",
  "garland_details",
  "media",
  "moods",
  "occasions",
  "product_care_instructions",
  "product_flower_types",
  "product_garland_filters",
  "product_images",
  "product_moods",
  "product_occasions",
  "product_options",
  "product_variants",
  "product_whats_included",
  "products",
];

export const FINGERPRINT_SQL = `select md5(concat_ws('|', ${PUBLISHED_TABLES.map(
  (table) => `(select md5(coalesce(string_agg(x::text, ',' order by x::text), '')) from (select to_jsonb(r) x from public."${table}" r) s)`,
).join(", ")})) as fingerprint`;
