// Build-time data. "publishedPrices" is the database's product prices, read
// once when the site is built, so every page of a deployment — prebuilt or
// rendered on request — shows the same price for a product, and baskets are
// reconciled against it (src/server/services/ProductPricing.ts). A bouquet
// price edited in the admin reaches the website with the next deployment;
// live garland designs are priced separately and are not affected.
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { readPriceMapFromDatabase } from "./server/services/ProductPricing";

const publishedPrices = defineCollection({
  // astro.config records the actual command. sync/check uses production
  // mode, so import.meta.env.DEV cannot distinguish it from a build.
  // Dev, sync and type checking do not need a snapshot. Every build must
  // read validated prices, and fails explicitly if its DB is unavailable.
  loader: async () =>
    process.env.FP_ASTRO_COMMAND === "build" ? [...(await readPriceMapFromDatabase())].map(([slug, price]) => ({ id: slug, ...price })) : [],
  schema: z.object({
    priceLabel: z.string().nullable(),
    sellingPrice: z.number().nullable(),
    compareAtPrice: z.number().nullable(),
  }),
});

export const collections = { publishedPrices };
