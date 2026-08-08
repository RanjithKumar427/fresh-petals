import { LocalStorageProvider } from "./LocalStorageProvider";
import type { StorageService } from "./StorageService";

/**
 * Factory seam for swapping storage drivers later (Supabase/S3/Cloudinary/
 * Vercel Blob) without touching MediaService or anything above it — add a
 * STORAGE_DRIVER env var + a branch here when that day comes.
 */
export function getStorageService(): StorageService {
  return LocalStorageProvider;
}
