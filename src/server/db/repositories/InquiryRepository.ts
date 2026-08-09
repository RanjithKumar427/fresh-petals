// Stable public entry point every service imports from — see
// CategoryRepository.ts / ProductRepository.ts for the fuller explanation
// of this pattern. Postgres/Drizzle-only from day one: unlike Category or
// Product, this table never existed in the SQLite era, so there is no
// prior implementation to have migrated away from.
export type InquiryStatus = "new" | "contacted" | "confirmed" | "completed" | "cancelled";

export type Inquiry = {
  id: number;
  customerName: string;
  phone: string;
  products: string;
  deliveryDate: string | null;
  status: InquiryStatus;
  createdAt: string;
  // Commerce Foundation Phase 3, Milestone 2 — Delivery Details. Nullable
  // on the read side because rows created before this milestone (and any
  // future direct-repository caller) have none of this — see schema.ts's
  // comment on the `inquiries` table for the full reasoning.
  recipientName: string | null;
  recipientPhone: string | null;
  deliveryLandmark: string | null;
  occasion: string | null;
};

/** The contract every InquiryRepository implementation must satisfy. */
export interface InquiryRepositoryContract {
  list(): Promise<Inquiry[]>;
  findById(id: number): Promise<Inquiry | null>;
  create(input: {
    customerName: string;
    phone: string;
    products: string;
    deliveryDate?: string | null;
    recipientName: string;
    recipientPhone: string;
    deliveryLandmark: string;
    occasion: string;
  }): Promise<Inquiry>;
  updateStatus(id: number, status: InquiryStatus): Promise<Inquiry | null>;
}

export { SupabaseInquiryRepository as InquiryRepository } from "./SupabaseInquiryRepository";
