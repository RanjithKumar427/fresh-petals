// Stable public entry point — see CategoryRepository.ts / ProductRepository.ts
// for the re-export pattern. As of Phase 2B.2, backed by Postgres.
import { createSupabaseTagRepository } from "./SupabaseTagRepository";
import { moods } from "../postgres/schema";

export const MoodRepository = createSupabaseTagRepository(moods, "moods");
export type { Tag as Mood } from "./TagRepository";
