import type { EmotionOption } from "../types/studio";

/**
 * The eight entry points into the Studio. `occasionTags` are cross-checked
 * against `src/data/productCatalog.ts` so Phase 7 (emotion-first builder)
 * can pre-populate a canvas from real, deliverable stems on day one.
 */
export const emotionOptions: EmotionOption[] = [
  {
    id: "romantic",
    label: "Romantic",
    icon: "❤️",
    description: "Anniversaries, date nights and quiet, deliberate gestures.",
    occasionTags: ["romantic", "anniversary"],
  },
  {
    id: "birthday",
    label: "Birthday",
    icon: "😊",
    description: "Bright, joyful arrangements built to open like a surprise.",
    occasionTags: ["birthday"],
  },
  {
    id: "celebration",
    label: "Celebration",
    icon: "🎉",
    description: "Promotions, good news, milestones worth marking.",
    occasionTags: ["congratulations", "just-because"],
  },
  {
    id: "spiritual",
    label: "Spiritual",
    icon: "🙏",
    description: "Pooja and daily ritual flowers, fresh and unfussy.",
    occasionTags: ["pooja"],
  },
  {
    id: "housewarming",
    label: "Housewarming",
    icon: "🏡",
    description: "A first gift for a new home.",
    occasionTags: ["housewarming"],
  },
  {
    id: "corporate",
    label: "Corporate",
    icon: "💼",
    description: "Client gifting and office arrangements, confirmed on WhatsApp.",
    occasionTags: [],
  },
  {
    id: "wedding",
    label: "Wedding",
    icon: "💍",
    description: "Bridal, mandap and event flowers for the big day.",
    occasionTags: ["wedding"],
  },
  {
    id: "graduation",
    label: "Graduation",
    icon: "🎓",
    description: "For the person who just finished something hard.",
    occasionTags: [],
  },
];
