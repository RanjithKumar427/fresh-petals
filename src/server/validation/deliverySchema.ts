import { z } from "zod";

const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, "Enter a valid 6-digit pincode.");

// "YYYY-MM-DD", matching a `type="date"` input's value exactly — no time
// component, since delivery dates are always calendar dates, never instants.
const deliveryDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid delivery date.");

const deliveryMethodSchema = z.enum(["MORNING", "AFTERNOON", "EVENING", "EXPRESS"]);

/** POST /api/delivery/check with only a pincode — serviceability only, no date/method involved. */
export const deliveryServiceabilitySchema = z.object({
  pincode: pincodeSchema,
});

/** POST /api/delivery/check with no `method` — list all four methods' availability. */
export const deliveryListSchema = z.object({
  pincode: pincodeSchema,
  deliveryDate: deliveryDateSchema,
});

/** POST /api/delivery/check with a `method` — the pre-WhatsApp revalidation shape. */
export const deliveryCheckSchema = z.object({
  pincode: pincodeSchema,
  deliveryDate: deliveryDateSchema,
  method: deliveryMethodSchema,
});

export type DeliveryServiceabilityInput = z.infer<typeof deliveryServiceabilitySchema>;
export type DeliveryListInput = z.infer<typeof deliveryListSchema>;
export type DeliveryCheckInput = z.infer<typeof deliveryCheckSchema>;
