import { z } from "zod";

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens."),
  description: z.string().trim().max(500).optional().nullable(),
  imageId: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
