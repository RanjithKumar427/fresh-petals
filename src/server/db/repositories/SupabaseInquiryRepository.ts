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
import type { Inquiry, InquiryStatus } from "./InquiryRepository";

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
  }): Promise<Inquiry> {
    return withRepositoryCall("SupabaseInquiryRepository.create", async () => {
      const [row] = await getDb()
        .insert(inquiries)
        .values({
          customerName: input.customerName,
          phone: input.phone,
          products: input.products,
          deliveryDate: input.deliveryDate ?? null,
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
