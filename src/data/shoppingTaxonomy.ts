// Shared URL vocabulary, independent of which filter chips currently have products.
export const OCCASION_FILTER_LABELS: Record<string, string> = {
  birthday: "Birthday", anniversary: "Anniversary", romantic: "Love & proposal",
  "thank-you": "Thank you", congratulations: "Congratulations", "i-am-sorry": "Apology",
  "just-because": "Just because", "get-well-soon": "Get well", wedding: "Wedding",
  engagement: "Engagement", housewarming: "Housewarming", pooja: "Pooja",
  "mom-to-be": "Baby shower", "new-mom": "New baby", sympathy: "Condolence",
};
export const BUDGET_LABELS = { "under-1500": "Under ₹1,500", "1500-plus": "₹1,500 and above" };
// Colours read from the recorded flowers (src/data/occasionJourneys.ts productColours), in chip order.
export const COLOUR_LABELS = { red: "Red", pink: "Pink", peach: "Peach", orange: "Orange", white: "White", yellow: "Yellow", blue: "Blue", purple: "Purple & lavender", mixed: "Mixed colours" };
/** Other colour words accepted in a ?colour= link, normalized to one key: lavender, lilac, violet and mauve are purple. */
export const COLOUR_ALIASES: Record<string, keyof typeof COLOUR_LABELS> = { lavender: "purple", lilac: "purple", violet: "purple", mauve: "purple" };
