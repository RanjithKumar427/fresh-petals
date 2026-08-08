import { MediaRepository, type Media, type MediaFolder } from "../db/repositories/MediaRepository";
import { ok, fail, type ServiceResult } from "./result";

// Upload handling (StorageService + LocalStorageProvider) lands in Step 4.
// For now this exposes what the dashboard/product form need: reading and
// safely deleting already-registered media.
export const MediaService = {
  list(filter?: { folder?: MediaFolder; search?: string }): Media[] {
    return MediaRepository.list(filter);
  },

  get(id: number): Media | null {
    return MediaRepository.findById(id);
  },

  count(): number {
    return MediaRepository.count();
  },

  remove(id: number): ServiceResult<null> {
    if (!MediaRepository.findById(id)) return fail("File not found.");
    if (MediaRepository.isInUse(id)) {
      return fail("This image is used by a product or category. Remove it there first.");
    }

    MediaRepository.delete(id);
    return ok(null);
  },
};
