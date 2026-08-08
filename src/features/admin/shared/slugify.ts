// Client-side mirror of src/server/utils/slugify.ts — kept separate rather
// than imported so admin React islands never pull from src/server/**.
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
