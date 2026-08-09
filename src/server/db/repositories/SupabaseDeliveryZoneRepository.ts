// Postgres/Drizzle implementation of the DeliveryZoneRepository contract
// — see DeliveryZoneRepository.ts for the stable public export every
// service imports, and SupabaseCategoryRepository.ts for the fuller
// explanation of this file-per-implementation pattern. One method only,
// deliberately: the Delivery Capability Engine has exactly one real
// query pattern today (look up a zone by exact pincode) — no list(),
// create(), update() or delete() because there is no admin UI for this
// table in this milestone (see the report's Admin section for why).
import { eq } from "drizzle-orm";
import { getDb } from "../postgres/client";
import { deliveryZones } from "../postgres/schema";
import { withRepositoryCall } from "../postgres/repository";
import type { DeliveryZone } from "./DeliveryZoneRepository";

type DeliveryZoneRow = typeof deliveryZones.$inferSelect;

function mapRow(row: DeliveryZoneRow): DeliveryZone {
  return {
    id: row.id,
    pincode: row.pincode,
    area: row.area,
    city: row.city,
    deliveryFee: row.deliveryFee,
    sameDayAvailable: row.sameDayAvailable,
    morningDeliveryAvailable: row.morningDeliveryAvailable,
  };
}

export const SupabaseDeliveryZoneRepository = {
  async findByPincode(pincode: string): Promise<DeliveryZone | null> {
    return withRepositoryCall("SupabaseDeliveryZoneRepository.findByPincode", async () => {
      const [row] = await getDb().select().from(deliveryZones).where(eq(deliveryZones.pincode, pincode));
      return row ? mapRow(row) : null;
    });
  },
};
