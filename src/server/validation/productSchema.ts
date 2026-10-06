import { z } from "zod";

const productImageInputSchema = z.object({
  mediaId: z.number().int().positive(),
  altText: z.string().trim().max(200).optional().nullable(),
  sortOrder: z.number().int().min(0),
  isPrimary: z.boolean(),
});

// Optional free-text garland facts: blank means "not confirmed yet" and is
// stored as NULL, never as an empty string.
const optionalFact = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

/** Garland-only facts (migration 0011). The design code is deliberately absent: it can't be edited. */
export const garlandInputSchema = z.object({
  soldUnit: z.enum(["single", "pair", "set"]).nullable().optional().transform((v) => v ?? null),
  length: optionalFact(60),
  flowerRecipe: optionalFact(400),
  thickness: optionalFact(60),
  finish: optionalFact(120),
  leadTime: optionalFact(80),
  substitutionPolicy: optionalFact(400),
  sellingMode: z.enum(["enquiry", "cart"]).default("enquiry"),
  readyForSale: z.boolean().default(false),
  photoPermission: z.enum(["unconfirmed", "granted", "refused"]).default("unconfirmed"),
  sampleVerified: z.boolean().default(false),
  filters: z
    .array(z.enum(["rose", "tuberose", "lotus", "designer-mixed"]))
    .max(4)
    .default([])
    .transform((filters) => [...new Set(filters)]),
});

const productOptionInputSchema = z.object({
  optionName: z.string().trim().min(1, "Give the option a name, e.g. Finish.").max(60),
  valueLabel: z.string().trim().min(1, "Enter the choice, e.g. Gold tassels.").max(80),
  extraCharge: z.number().int().min(0, "Extra charge can't be negative.").max(1_000_000).nullable().optional().transform((v) => v ?? null),
  sortOrder: z.number().int().min(0).default(0),
});

export const productInputSchema = z
  .object({
    // Section 1 — Basic Information
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens."),
    shortDescription: z.string().trim().max(240).optional().nullable(),
    description: z.string().trim().max(4000).optional().nullable(),

    // Section 2 — Images
    images: z.array(productImageInputSchema).max(12, "Up to 12 images per product."),

    // Section 3 — Pricing
    priceType: z.enum(["fixed", "from", "market", "quote"]),
    sellingPrice: z.number().int().positive().optional().nullable(),
    compareAtPrice: z.number().int().positive().optional().nullable(),
    costPrice: z.number().int().positive().optional().nullable(),
    deliveryChargeOverride: z.number().int().min(0).optional().nullable(),

    // Section 4 — Category
    categoryId: z.number().int().positive("Choose a category."),

    // Section 5 — Occasions
    occasionIds: z.array(z.number().int().positive()).default([]),

    // Section 6 — Moods
    moodIds: z.array(z.number().int().positive()).default([]),

    // Section 7 — Flower Details
    flowerTypeIds: z.array(z.number().int().positive()).default([]),
    stemCount: z.string().trim().max(40).optional().nullable(),
    colourTheme: z.string().trim().max(80).optional().nullable(),
    arrangementStyle: z.string().trim().max(80).optional().nullable(),
    size: z.string().trim().max(40).optional().nullable(),

    // Section 8 — What's Included
    whatsIncluded: z.array(z.string().trim().min(1).max(160)).default([]),

    // Section 9 — Care Instructions
    careInstructions: z.array(z.string().trim().min(1).max(160)).default([]),

    // Options and additional charges (any product; garlands use them first).
    options: z.array(productOptionInputSchema).max(40, "Up to 40 option choices per product.").optional(),

    // Garland facts — only accepted for products that already are garlands
    // (ProductService checks), never creates one.
    garland: garlandInputSchema.nullable().optional(),

    // Section 10 — SEO
    seoTitle: z.string().trim().max(70).optional().nullable(),
    seoDescription: z.string().trim().max(160).optional().nullable(),

    // Section 11 — Publishing
    status: z.enum(["draft", "published", "archived"]),
    featured: z.boolean().default(false),
    bestseller: z.boolean().default(false),
    newArrival: z.boolean().default(false),
    requiresWhatsappConfirmation: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if ((data.priceType === "fixed" || data.priceType === "from") && !data.sellingPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["sellingPrice"],
        message: "Selling price is required for fixed or starting-from pricing.",
      });
    }
    if (data.compareAtPrice && data.sellingPrice && data.compareAtPrice <= data.sellingPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "Compare-at price must be higher than the selling price — it's the original price shown struck through.",
      });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;
