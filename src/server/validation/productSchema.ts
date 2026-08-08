import { z } from "zod";

const productImageInputSchema = z.object({
  mediaId: z.number().int().positive(),
  altText: z.string().trim().max(200).optional().nullable(),
  sortOrder: z.number().int().min(0),
  isPrimary: z.boolean(),
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
