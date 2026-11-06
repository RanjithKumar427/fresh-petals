import { OccasionRepository } from "../db/repositories/OccasionRepository";
import { MoodRepository } from "../db/repositories/MoodRepository";
import { FlowerTypeRepository } from "../db/repositories/FlowerTypeRepository";
import type { Tag } from "../db/repositories/TagRepository";
import { buildMemo } from "../platform/buildMemo";

/**
 * Read-only access to the three independent taxonomies (see [[refined
 * architecture]] — Category/Occasion/Mood/FlowerType are deliberately
 * separate, junction-tabled entities). No dedicated CRUD UI ships for
 * these in this milestone; the product editor just needs to list them.
 */
export const TaxonomyService = {
  async listOccasions(): Promise<Tag[]> {
    return buildMemo("occasions", () => OccasionRepository.list());
  },
  async listMoods(): Promise<Tag[]> {
    return MoodRepository.list();
  },
  async listFlowerTypes(): Promise<Tag[]> {
    return FlowerTypeRepository.list();
  },
};
