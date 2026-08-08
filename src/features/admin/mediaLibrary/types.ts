// Client-side mirror of the server's Media/MediaUsage shapes — kept
// separate from src/server/** for the same reason as every other admin
// island (that tree pulls in node:sqlite transitively).

export type MediaFolder =
  | "products"
  | "categories"
  | "homepage"
  | "hero"
  | "occasions"
  | "neighbourhoods"
  | "studio"
  | "temporary";

export const MEDIA_FOLDERS: MediaFolder[] = [
  "products",
  "categories",
  "homepage",
  "hero",
  "occasions",
  "neighbourhoods",
  "studio",
  "temporary",
];

export const FOLDER_LABELS: Record<MediaFolder, string> = {
  products: "Products",
  categories: "Categories",
  homepage: "Homepage",
  hero: "Hero",
  occasions: "Occasions",
  neighbourhoods: "Neighbourhoods",
  studio: "Studio",
  temporary: "Temporary",
};

export type Media = {
  id: number;
  filename: string;
  path: string | null;
  url: string;
  folder: MediaFolder;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  source: "upload" | "seed";
  createdAt: string;
};

export type MediaUsage = {
  products: { id: number; name: string; slug: string; isPrimary: boolean }[];
  categories: { id: number; name: string; slug: string }[];
};

export type MediaListItem = Media & { usageCount: number; isPrimary: boolean };
export type MediaWithUsage = Media & { usage: MediaUsage };

export function usageCount(usage: MediaUsage): number {
  return usage.products.length + usage.categories.length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
