import { z } from "zod";

// Deliberately permissive on `phone` (no digit-count/regex enforcement):
// this is submitted from the storefront's existing cart/product-order
// forms, which already validate phone presence for their own WhatsApp-
// message purposes — re-validating format here would just be a second,
// possibly-conflicting opinion on data this endpoint only stores, never
// dials or messages itself.
export const inquiryInputSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required.").max(120),
  phone: z.string().trim().min(1, "Phone is required.").max(20),
  products: z.string().trim().min(1, "Products is required.").max(2000),
  deliveryDate: z.string().trim().max(40).optional().nullable(),
});

export type InquiryInput = z.infer<typeof inquiryInputSchema>;

export const inquiryStatusSchema = z.enum(["new", "contacted", "confirmed", "completed", "cancelled"]);
