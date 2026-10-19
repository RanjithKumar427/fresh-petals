// The public catalogue this deployment publishes: the static catalogue
// (src/data/productCatalog.ts, which still supplies names, descriptions,
// photographs and flowers) limited to the products whose database record is
// "published" in the build's snapshot (src/content.config.ts,
// "catalogueStatus").
//
// Every catalogue surface reads it — prebuilt product pages, category pages,
// search, sitemaps, related products, city lists, and the pages rendered on
// request (homepage, bouquet list, occasion pages) — so a list never offers a
// product whose own page is gone. Publication status is a deployment fact
// for catalogue products, like their prices: a product published or archived
// in the admin changes on the website with the next successful deployment.
// Garland designs are not here: they are read live (src/data/garlands.ts).
//
// In development the database is read directly. A production server without
// a snapshot, a database outage during a build, or a snapshot with no
// published catalogue product is an error, never "everything is published".
import { productCatalog, type Product } from "../../data/productCatalog";
import { publicProducts, reconcileCatalogue, reconciliationReport, type CatalogueRecord, type PublicationMap, type StorefrontReadiness } from "../../data/catalogueRange";
import type { Membership } from "../../data/occasionJourneys";
import { ProductRepository, type ProductListItem } from "../db/repositories/ProductRepository";
import { loadOccasionMembership } from "./OccasionMembership";
import { getDb } from "../db/postgres/client";
import { sql } from "drizzle-orm";

export type SnapshotRecord = CatalogueRecord & { garland: boolean };

const toRecord = (row: ProductListItem): SnapshotRecord => ({ slug: row.slug, status: String(row.status), category: row.categoryName, name: row.name, garland: !!row.designCode });

let buildRows: Promise<ProductListItem[]> | null = null;
/** Every product record, read once per build process (prices and status share it). */
export function readBuildRecords(): Promise<ProductListItem[]> {
  if (!buildRows) buildRows = ProductRepository.list({ withDesignCodes: true });
  return buildRows;
}

/**
 * The build's publication snapshot. Fails the build when the database can't
 * be read, returns no records, or would publish no catalogue product; logs a
 * reconciliation report (excluded, missing, unknown, unmapped, dashboard-only
 * edits) otherwise.
 */
export async function catalogueSnapshot(): Promise<SnapshotRecord[]> {
  let rows: ProductListItem[];
  try {
    rows = await readBuildRecords();
  } catch (error) {
    throw new Error(`Catalogue snapshot: the product database could not be read, so this build cannot say which products are published. Nothing was published. (${error instanceof Error ? error.message : String(error)})`);
  }
  if (rows.length === 0) throw new Error("Catalogue snapshot: the product database returned no records. Refusing to build an empty catalogue.");
  const records = rows.map(toRecord);
  // Drift is reported, never published: the mapped editorial fields are read
  // only to compare with the catalogue, and a failed read only skips that part
  // of the report (publication status is already read above).
  const editorial = await readEditorialFields().catch((error) => {
    console.warn(`[catalogue] editorial fields not compared: ${error instanceof Error ? error.message : String(error)}`);
    return new Map<string, Partial<CatalogueRecord>>();
  });
  const compared = records.map((record) => ({ ...record, ...(editorial.get(record.slug) ?? {}) }));
  const report = reconcileCatalogue(compared, productCatalog, (record) => (record as SnapshotRecord).garland);
  if (report.live.length === 0) throw new Error("Catalogue snapshot: no catalogue product is published in the database. Refusing to build an empty catalogue.");
  console.info(`[catalogue] ${report.live.length} of ${productCatalog.length} catalogue products are published and will be listed.`);
  for (const line of reconciliationReport(report)) console.warn(`[catalogue] ${line}`);
  return records;
}

/** The database fields with a catalogue equivalent (see CatalogueRecord), for the drift report. Read only. */
async function readEditorialFields(): Promise<Map<string, Partial<CatalogueRecord>>> {
  const result = await getDb().execute(sql`
    SELECT p.slug, p.short_description, p.description, p.stem_count,
      (SELECT m.url FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) AS image
    FROM products p`);
  const rows = (result as unknown as { rows: { slug: string; short_description: string | null; description: string | null; stem_count: string | null; image: string | null }[] }).rows;
  return new Map(rows.map((row) => [row.slug, { shortDescription: row.short_description, description: row.description, stemCount: row.stem_count, image: row.image }]));
}

/** The admin's occasion assignments for every catalogue product, for the prebuilt header menu. */
export function occasionSnapshot(): Promise<Map<string, string[]>> {
  return loadOccasionMembership(productCatalog.map((product) => product.slug));
}

let publication: Promise<PublicationMap> | null = null;

/** slug → database status, as this deployment publishes it (live database in development). */
async function readDeployedPublication(): Promise<PublicationMap> {
  const map = await (await import("./PublishedPrices")).publishedStatusMap();
  if (map.size === 0) throw new Error("This deployment has no catalogue publication snapshot (src/content.config.ts). Refusing to treat the catalogue as published.");
  return map;
}

export async function loadPublication(): Promise<PublicationMap> {
  if (import.meta.env.DEV) {
    const rows = await ProductRepository.list();
    return new Map(rows.map((row) => [row.slug, String(row.status)]));
  }
  if (!publication) {
    publication = readDeployedPublication();
    publication.catch(() => (publication = null));
  }
  return publication;
}

/** The public catalogue products, in catalogue order. */
export async function loadPublicCatalogue(): Promise<Product[]> {
  return publicProducts(productCatalog, await loadPublication());
}

/**
 * Occasion assignments for the prebuilt site header (snapshot; changes with a
 * deployment). In development the database is read directly.
 */
export async function loadMenuMembership(): Promise<Membership> {
  if (import.meta.env.DEV) return occasionSnapshot();
  return import("./PublishedPrices").then((module) => module.publishedOccasionMap());
}

/** Whether a product has a storefront entry and what this deployment shows for it (admin). */
export async function storefrontReadiness(slug: string): Promise<StorefrontReadiness> {
  const deployed = await loadPublication().catch(() => null);
  return { mapped: productCatalog.some((product) => product.slug === slug), deployedStatus: deployed?.get(slug) ?? null };
}
