import type { MediaFolder } from "../db/repositories/MediaRepository";

export type StoredFile = {
  /** Relative path under the storage root — what MediaRepository persists, driver-specific. */
  path: string;
  /** URL the browser actually loads. Local: /media/<path>. Future remote drivers return their own CDN URL. */
  url: string;
  sizeBytes: number;
};

/**
 * Every upload goes through this interface, never through a driver
 * directly — swapping local disk for Supabase Storage/S3/Cloudinary/Vercel
 * Blob later means writing one new provider file and changing the factory
 * in ./index.ts. Nothing above this (MediaService, the upload API route,
 * the product editor) needs to know which driver is active.
 */
export interface StorageService {
  put(input: { buffer: Buffer; filename: string; mimeType: string; folder: MediaFolder }): Promise<StoredFile>;
  delete(path: string): Promise<void>;
}
