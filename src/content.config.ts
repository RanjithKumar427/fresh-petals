// Build-time data, read once from the database when the site is built, so
// every page of a deployment — prebuilt or rendered on request — shows the
// same catalogue:
//
// - "publishedPrices": product prices (src/server/services/ProductPricing.ts).
//   Baskets are reconciled against them.
// - "catalogueStatus": each product record's publication status. A catalogue
//   product is listed, searchable, in the sitemaps and has a product page only
//   while its record is "published" here (src/data/catalogueRange.ts,
//   src/server/services/PublicCatalogue.ts).
// - "occasionAssignments": the admin's occasion assignments, for the prebuilt
//   site header's occasion menu. Occasion pages and lists read assignments
//   live; the header changes with a deployment.
//
// A price, status or header-menu change made in the admin reaches these with
// the next deployment; live garland designs and occasion pages are read on
// request and are not affected. Dev, sync and type checking do not need a
// snapshot. Every build must read validated data, and fails explicitly if its
// database is unavailable or the snapshot would publish an empty catalogue.
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { readPriceMapFromDatabase } from "./server/services/ProductPricing";
import { catalogueSnapshot, occasionSnapshot, readBuildRecords } from "./server/services/PublicCatalogue";

// astro.config records the actual command. sync/check uses production
// mode, so import.meta.env.DEV cannot distinguish it from a build.
const building = () => process.env.FP_ASTRO_COMMAND === "build";

const publishedPrices = defineCollection({
  loader: async () => (building() ? [...(await readPriceMapFromDatabase(await readBuildRecords()))].map(([slug, price]) => ({ id: slug, ...price })) : []),
  schema: z.object({
    priceLabel: z.string().nullable(),
    sellingPrice: z.number().nullable(),
    compareAtPrice: z.number().nullable(),
  }),
});

const catalogueStatus = defineCollection({
  loader: async () => (building() ? (await catalogueSnapshot()).map((record) => ({ id: record.slug, ...record })) : []),
  // Status stays a string: an unknown value is kept (and reported) as not published, never coerced.
  schema: z.object({ slug: z.string(), status: z.string(), category: z.string(), name: z.string(), garland: z.boolean() }),
});

const occasionAssignments = defineCollection({
  loader: async () => (building() ? [...(await occasionSnapshot())].map(([slug, occasions]) => ({ id: slug, occasions })) : []),
  schema: z.object({ occasions: z.array(z.string()) }),
});

export const collections = { publishedPrices, catalogueStatus, occasionAssignments };
