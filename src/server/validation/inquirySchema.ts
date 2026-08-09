import { z } from "zod";

// Deliberately permissive on the *customer's own* `phone` (no digit-count/
// regex enforcement): this is submitted from the storefront's existing
// cart/product-order forms, which already validate phone presence for
// their own WhatsApp-message purposes — re-validating format here would
// just be a second, possibly-conflicting opinion on data this endpoint
// only stores, never dials or messages itself.
//
// `recipientPhone` gets real normalization below (Milestone 2): unlike
// the customer's own phone, this one is rendered as a clickable WhatsApp
// link on the admin page (see /admin/inquiries), so a consistent, valid
// shape actually matters here in a way it doesn't for the free-text
// customer phone.
const INDIAN_MOBILE_LOCAL_LENGTH = 10;

/**
 * Strips formatting and an optional country/trunk prefix down to a bare
 * 10-digit Indian mobile number, or returns null if what's left isn't a
 * valid one. Never truncates or drops digits from a *valid* number —
 * "do not silently corrupt the number" — it only removes prefixes that
 * are unambiguously not part of the subscriber number (a leading "91"
 * making the total 12 digits, or a leading trunk "0" making it 11).
 * Deliberately Indian-only: this project's whole customer base and every
 * other phone field in the codebase (see cart.astro's customer phone,
 * WhatsApp deep links) already assume Indian mobile numbers — adding
 * general international parsing here would be speculative, unused
 * complexity, not a real requirement.
 */
export function normalizeIndianMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  const local =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;

  return local.length === INDIAN_MOBILE_LOCAL_LENGTH && /^[6-9]\d{9}$/.test(local) ? local : null;
}

const recipientPhoneSchema = z
  .string()
  .trim()
  .min(1, "Recipient phone is required.")
  .transform((value, ctx) => {
    const normalized = normalizeIndianMobile(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number." });
      return z.NEVER;
    }
    return normalized;
  });

export const inquiryInputSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required.").max(120),
  phone: z.string().trim().min(1, "Phone is required.").max(20),
  products: z.string().trim().min(1, "Products is required.").max(2000),
  deliveryDate: z.string().trim().max(40).optional().nullable(),

  // Required for every *new* submission (the storefront's Delivery
  // Details section gates "Send Cart on WhatsApp" on all four being
  // filled) — but see schema.ts's `inquiries` table comment for why the
  // database columns themselves stay nullable regardless.
  recipientName: z.string().trim().min(1, "Recipient name is required.").max(120),
  recipientPhone: recipientPhoneSchema,
  deliveryLandmark: z.string().trim().min(1, "Delivery landmark is required.").max(200),
  // Free text, not an enum: the real occasion list lives in the `occasions`
  // DB table (admin-editable), and the storefront dropdown also allows
  // "Other: <short description>" (folded into one string client-side).
  // Re-validating against the live taxonomy here would couple this
  // lightweight inquiry log to the taxonomy admin feature for no real
  // benefit — see the Milestone 2 report's Architectural Decisions.
  occasion: z.string().trim().min(1, "Occasion is required.").max(160),
});

export type InquiryInput = z.infer<typeof inquiryInputSchema>;

export const inquiryStatusSchema = z.enum(["new", "contacted", "confirmed", "completed", "cancelled"]);
