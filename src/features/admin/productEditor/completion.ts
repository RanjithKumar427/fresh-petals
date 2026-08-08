import type { ProductDraft } from "./types";
import { getPublishBlockers } from "./publishReadiness";

export type SectionStatus = "complete" | "warning" | "unavailable";

export type SectionConfig = {
  id: string;
  label: string;
};

export const SECTIONS: SectionConfig[] = [
  { id: "basic-information", label: "Basic Information" },
  { id: "images", label: "Images" },
  { id: "pricing", label: "Pricing" },
  { id: "classification", label: "Classification" },
  { id: "flower-details", label: "Flower Details" },
  { id: "whats-included", label: "What's Included" },
  { id: "care", label: "Care Instructions" },
  { id: "seo", label: "SEO" },
  { id: "publishing", label: "Publishing" },
];

/**
 * Real ✓/⚠ per section — every section is functional this milestone, so
 * unlike the previous increment there's no "unavailable/coming soon"
 * state left to show.
 */
export function getSectionStatus(
  sectionId: string,
  draft: ProductDraft,
  uncategorizedCategoryId: number
): SectionStatus {
  switch (sectionId) {
    case "basic-information":
      return draft.name.trim().length > 0 && draft.name !== "Untitled Product" ? "complete" : "warning";

    case "images":
      return draft.images.length > 0 ? "complete" : "warning";

    case "pricing":
      if (draft.priceType === "market" || draft.priceType === "quote") return "complete";
      return draft.sellingPrice ? "complete" : "warning";

    case "classification":
      return draft.categoryId !== uncategorizedCategoryId ? "complete" : "warning";

    case "flower-details":
      // Genuinely optional merchandising detail — never warns, just
      // reflects whether anything's been filled in.
      return draft.flowerTypeIds.length > 0 || draft.stemCount || draft.colourTheme ? "complete" : "unavailable";

    case "whats-included":
      return draft.whatsIncluded.length > 0 ? "complete" : "unavailable";

    case "care":
      return draft.careInstructions.length > 0 ? "complete" : "unavailable";

    case "seo":
      return draft.seoTitle || draft.seoDescription ? "complete" : "unavailable";

    case "publishing":
      return getPublishBlockers(draft, uncategorizedCategoryId).length === 0 ? "complete" : "warning";

    default:
      return "unavailable";
  }
}
