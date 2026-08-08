import type { ProductDraft } from "./types";

export type SectionStatus = "complete" | "warning" | "unavailable";

export type SectionConfig = {
  id: string;
  label: string;
  /** Sections not yet built in this milestone render as "coming soon" rather than a misleading warning. */
  available: boolean;
};

export const SECTIONS: SectionConfig[] = [
  { id: "basic-information", label: "Basic Information", available: true },
  { id: "images", label: "Images", available: true },
  { id: "pricing", label: "Pricing", available: false },
  { id: "classification", label: "Classification", available: false },
  { id: "flower-details", label: "Flower Details", available: false },
  { id: "whats-included", label: "What's Included", available: false },
  { id: "care", label: "Care Instructions", available: false },
  { id: "seo", label: "SEO", available: false },
  { id: "publishing", label: "Publishing", available: false },
];

/**
 * Only the two sections built this milestone get a real ✓/⚠ — everything
 * else is "unavailable" (a neutral dash in the sidebar) rather than a
 * warning, since showing "⚠ missing" on a section the florist can't even
 * open yet would be misleading, not helpful.
 */
export function getSectionStatus(sectionId: string, draft: ProductDraft): SectionStatus {
  const section = SECTIONS.find((entry) => entry.id === sectionId);
  if (!section?.available) return "unavailable";

  if (sectionId === "basic-information") {
    const hasName = draft.name.trim().length > 0 && draft.name !== "Untitled Product";
    return hasName ? "complete" : "warning";
  }

  if (sectionId === "images") {
    return draft.images.length > 0 ? "complete" : "warning";
  }

  return "unavailable";
}
