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
  }): Promise<Inquiry>;
  updateStatus(id: number, status: InquiryStatus): Promise<Inquiry | null>;
}

export { SupabaseInquiryRepository as InquiryRepository } from "./SupabaseInquiryRepository";
