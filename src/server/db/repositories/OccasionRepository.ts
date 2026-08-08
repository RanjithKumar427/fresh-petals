// Stable public entry point — see CategoryRepository.ts / ProductRepository.ts
// for the re-export pattern. As of Phase 2B.2, backed by Postgres.
import { createSupabaseTagRepository } from "./SupabaseTagRepository";
import { occasions } from "../postgres/schema";

export const OccasionRepository = createSupabaseTagRepository(occasions, "occasions");
export type { Tag as Occasion } from "./TagRepository";
