// Postgres/Drizzle implementation of the DeliveryZoneRepository contract
// — see DeliveryZoneRepository.ts for the stable public export every
// service imports, and SupabaseCategoryRepository.ts for the fuller
// explanation of this file-per-implementation pattern. Two methods,
// deliberately minimal: the Delivery Capability Engine's real query
// pattern is looking up a zone by exact pincode; `listAreas()` (Simple
// Area Selection milestone) is the only other read this table needs —
// still no create()/update()/delete(), still no admin UI for this table.
import { asc, eq, inArray, sql } from "drizzle-orm";
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

  async listAreas(cityAliases: string[]): Promise<string[]> {
    if (cityAliases.length === 0) return [];
    return withRepositoryCall("SupabaseDeliveryZoneRepository.listAreas", async () => {
      const rows = await getDb()
        .selectDistinct({ area: deliveryZones.area })
        .from(deliveryZones)
        .where(inArray(sql`lower(${deliveryZones.city})`, cityAliases))
        .orderBy(asc(deliveryZones.area));
      return rows.map((row) => row.area);
    });
  },
};
