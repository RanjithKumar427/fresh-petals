import { SupabaseStorageProvider } from "./SupabaseStorageProvider";
import type { StorageService } from "./StorageService";

/**
 * Factory seam for swapping storage drivers (this project has already used
 * it once — LocalStorageProvider through Phase 2B.2, SupabaseStorageProvider
 * as of Phase 2B.3) without touching MediaService or anything above it.
 * `LocalStorageProvider` is preserved (unused, not deleted) as the
 * documented rollback path — see docs/architecture/supabase-migration.md's
 * Phase 2B.3 section — swap the export below back to restore it.
 */
export function getStorageService(): StorageService {
  return SupabaseStorageProvider;
}
