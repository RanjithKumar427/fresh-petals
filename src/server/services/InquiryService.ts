import { InquiryRepository, type Inquiry } from "../db/repositories/InquiryRepository";
import { inquiryInputSchema, inquiryStatusSchema } from "../validation/inquirySchema";
import { ok, fail, zodFieldErrors, type ServiceResult } from "./result";

export const InquiryService = {
  async list(): Promise<Inquiry[]> {
    return InquiryRepository.list();
  },

  /**
   * Called from the public, unauthenticated POST /api/inquiries endpoint
   * right as a customer's WhatsApp message is generated — see
   * cart.astro / ProductOptions.astro. Validation failures here are
   * deliberately non-fatal to the caller's WhatsApp flow (the storefront
   * fires this fire-and-forget and always opens WhatsApp regardless), so
   * this stays a plain ServiceResult rather than throwing.
   */
  async create(input: unknown): Promise<ServiceResult<Inquiry>> {
    const parsed = inquiryInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
    }

    const inquiry = await InquiryRepository.create(parsed.data);
    return ok(inquiry);
  },

  async updateStatus(id: number, status: unknown): Promise<ServiceResult<Inquiry>> {
    const parsed = inquiryStatusSchema.safeParse(status);
    if (!parsed.success) {
      return fail("Invalid status.");
    }

    const inquiry = await InquiryRepository.updateStatus(id, parsed.data);
    if (!inquiry) return fail("Inquiry not found.");
    return ok(inquiry);
  },
};
