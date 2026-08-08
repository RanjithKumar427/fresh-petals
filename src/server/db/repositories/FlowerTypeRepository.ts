import { createTagRepository } from "./TagRepository";

export const FlowerTypeRepository = createTagRepository("flower_types");
export type { Tag as FlowerType } from "./TagRepository";
