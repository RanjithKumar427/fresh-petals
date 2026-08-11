// Postgres/Drizzle implementation of the InquiryRepository contract — see
// InquiryRepository.ts for the stable public export every service imports,
// and SupabaseCategoryRepository.ts for the fuller explanation of this
// file-per-implementation pattern. Four methods only, deliberately: this
// is an admin inbox log (Commerce Foundation Phase 3, Milestone 5), not an
// order system — no update-arbitrary-fields, no delete, no line items.
import { desc, eq } from "drizzle-orm";
import { getDb } from "../postgres/client";
import { inquiries } from "../postgres/schema";
import { withRepositoryCall } from "../postgres/repository";
import type { Inquiry, InquiryStatus, InquiryDeliveryMethod } from "./InquiryRepository";

type InquiryRow = typeof inquiries.$inferSelect;

function mapRow(row: InquiryRow): Inquiry {
  return {
    id: row.id,
    customerName: row.customerName,
    phone: row.phone,
    products: row.products,
    deliveryDate: row.deliveryDate,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    deliveryLandmark: row.deliveryLandmark,
    occasion: row.occasion,
    deliveryMethod: row.deliveryMethod,
    deliveryPromise: row.deliveryPromise,
    deliveryFee: row.deliveryFee,
  };
}

export const SupabaseInquiryRepository = {
  /** Newest first — an admin opening the log wants to triage what just came in. */
  async list(): Promise<Inquiry[]> {
    return withRepositoryCall("SupabaseInquiryRepository.list", async () => {
      const rows = await getDb().select().from(inquiries).orderBy(desc(inquiries.createdAt));
      return rows.map(mapRow);
    });
  },

  async findById(id: number): Promise<Inquiry | null> {
    return withRepositoryCall("SupabaseInquiryRepository.findById", async () => {
      const [row] = await getDb().select().from(inquiries).where(eq(inquiries.id, id));
      return row ? mapRow(row) : null;
    });
  },

  async create(input: {
    customerName: string;
    phone: string;
    products: string;
    deliveryDate?: string | null;
    recipientName: string;
    recipientPhone: string;
    deliveryLandmark: string;
    // Optional (Customer UX milestone) — see inquirySchema.ts's matching
    // change; the column was always nullable.
    occasion?: string | null;
    deliveryMethod?: InquiryDeliveryMethod | null;
    deliveryPromise?: string | null;
    deliveryFee?: number | null;
  }): Promise<Inquiry> {
    return withRepositoryCall("SupabaseInquiryRepository.create", async () => {
      const [row] = await getDb()
        .insert(inquiries)
        .values({
          customerName: input.customerName,
          phone: input.phone,
          products: input.products,
          deliveryDate: input.deliveryDate ?? null,
          recipientName: input.recipientName,
          recipientPhone: input.recipientPhone,
          deliveryLandmark: input.deliveryLandmark,
          occasion: input.occasion ?? null,
          deliveryMethod: input.deliveryMethod ?? null,
          deliveryPromise: input.deliveryPromise ?? null,
          deliveryFee: input.deliveryFee ?? null,
        })
        .returning();
      return mapRow(row);
    });
  },

  async updateStatus(id: number, status: InquiryStatus): Promise<Inquiry | null> {
    return withRepositoryCall("SupabaseInquiryRepository.updateStatus", async () => {
      const [row] = await getDb().update(inquiries).set({ status }).where(eq(inquiries.id, id)).returning();
      return row ? mapRow(row) : null;
    });
  },
};
