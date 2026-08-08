import { createTagRepository } from "./TagRepository";

export const MoodRepository = createTagRepository("moods");
export type { Tag as Mood } from "./TagRepository";
