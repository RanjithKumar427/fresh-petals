// Stable public entry point — see CategoryRepository.ts / ProductRepository.ts
// for the re-export pattern. As of Phase 2B.2, backed by Postgres.
import { createSupabaseTagRepository } from "./SupabaseTagRepository";
import { flowerTypes } from "../postgres/schema";

export const FlowerTypeRepository = createSupabaseTagRepository(flowerTypes, "flower_types");
export type { Tag as FlowerType } from "./TagRepository";
