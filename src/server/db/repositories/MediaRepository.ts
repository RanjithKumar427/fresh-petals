// Stable public entry point every service imports from — see
// ProductRepository.ts (Phase 2B.1) for the fuller explanation of this
// pattern. As of Phase 2B.2 this re-exports SupabaseMediaRepository
// instead of a node:sqlite one. Rollback is a `git revert` of that
// phase's commit; every consumer's import statement is untouched either
// way.
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

/** What the grid/list view needs per card — usage rolled up via correlated subqueries rather than N+1 lookups. */
export type MediaListItem = Media & { usageCount: number; isPrimary: boolean };

/** The contract every MediaRepository implementation (SQLite, Supabase, or a future one) must satisfy. */
export interface MediaRepositoryContract {
  list(filter?: { folder?: MediaFolder; search?: string; unused?: boolean }): Promise<MediaListItem[]>;
  findById(id: number): Promise<Media | null>;
  count(): Promise<number>;
  countByFolder(): Promise<Record<MediaFolder, number>>;
  create(input: {
    filename: string;
    path: string | null;
    url: string;
    folder: MediaFolder;
    mimeType: string;
    sizeBytes: number;
    width?: number | null;
    height?: number | null;
    altText?: string | null;
    source?: "upload" | "seed";
  }): Promise<Media>;
  rename(id: number, filename: string): Promise<Media | null>;
  updateAltText(id: number, altText: string | null): Promise<Media | null>;
  updateLocation(id: number, input: { folder: MediaFolder; path: string; url: string }): Promise<Media | null>;
  delete(id: number): Promise<void>;
  isInUse(id: number): Promise<boolean>;
  getUsage(id: number): Promise<MediaUsage>;
}

export { SupabaseMediaRepository as MediaRepository } from "./SupabaseMediaRepository";
