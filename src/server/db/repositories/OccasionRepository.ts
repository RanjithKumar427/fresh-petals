import { createTagRepository } from "./TagRepository";

export const OccasionRepository = createTagRepository("occasions");
export type { Tag as Occasion } from "./TagRepository";
