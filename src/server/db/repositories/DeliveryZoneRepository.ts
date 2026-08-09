// Stable public entry point every service imports from — see
// CategoryRepository.ts for the fuller explanation of this pattern.
// Postgres/Drizzle-only from day one: this table never existed in the
// SQLite era (it's a promotion of src/data/serviceAreas.ts, a static
// TS array), so there is no prior implementation to have migrated away
// from.
export type DeliveryZone = {
  id: number;
  pincode: string;
  area: string;
  city: string;
  deliveryFee: number;
  sameDayAvailable: boolean;
  morningDeliveryAvailable: boolean;
};

/** The contract every DeliveryZoneRepository implementation must satisfy. */
export interface DeliveryZoneRepositoryContract {
  findByPincode(pincode: string): Promise<DeliveryZone | null>;
}

export { SupabaseDeliveryZoneRepository as DeliveryZoneRepository } from "./SupabaseDeliveryZoneRepository";
