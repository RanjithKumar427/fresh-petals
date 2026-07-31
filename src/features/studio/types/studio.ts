/**
 * Emotion ids intentionally match the values already used as `occasionTags`
 * in `src/data/productCatalog.ts` wherever a matching tag exists, so later
 * phases can filter the real catalogue directly by `EmotionOption.occasionTags`
 * instead of introducing a second, parallel taxonomy.
 *
 * "corporate" and "graduation" have no occasion-tagged inventory in the
 * catalogue today (verified against productCatalog.ts) — their
 * `occasionTags` are left empty rather than pointing at fabricated tags.
 * The Studio should route these into a WhatsApp-confirmed custom flow
 * once Phase 7 (emotion-first builder) is implemented, the same way
 * `categories/[slug].astro` already does for untagged categories.
 */
export type EmotionId =
  | "romantic"
  | "birthday"
  | "celebration"
  | "spiritual"
  | "housewarming"
  | "corporate"
  | "wedding"
  | "graduation";

export interface EmotionOption {
  id: EmotionId;
  label: string;
  icon: string;
  description: string;
  /** Real occasionTags from productCatalog.ts — empty where no inventory exists yet. */
  occasionTags: string[];
}

export type StudioView = "landing" | "canvas";
