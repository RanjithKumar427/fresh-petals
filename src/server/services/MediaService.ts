import { MediaRepository, type Media, type MediaFolder } from "../db/repositories/MediaRepository";
import { getStorageService } from "../storage";
import { ok, fail, type ServiceResult } from "./result";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

  /**
   * Orchestrates StorageService.put + MediaRepository.create as one unit:
   * if the DB insert fails after the file is written, the file is cleaned
   * up so a failed upload never leaves an orphaned file on disk.
   *
   * Compression/background-removal/AI-enhancement hooks would slot in here
   * later (transform `buffer` before handing it to the storage driver) —
   * nothing upstream (the upload API route, ImagesSection) would need to
   * change.
   */
  async upload(input: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    folder: MediaFolder;
    altText?: string | null;
  }): Promise<ServiceResult<Media>> {
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      return fail("Only JPEG, PNG, WebP or GIF images are supported.");
    }
    if (input.buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return fail("Images must be 8MB or smaller.");
    }
    if (input.buffer.byteLength === 0) {
      return fail("That file is empty.");
    }

    const storage = getStorageService();
    const stored = await storage.put({
      buffer: input.buffer,
      filename: input.filename,
      mimeType: input.mimeType,
      folder: input.folder,
    });

    try {
      const media = MediaRepository.create({
        filename: input.filename,
        path: stored.path,
        url: stored.url,
        folder: input.folder,
        mimeType: input.mimeType,
        sizeBytes: stored.sizeBytes,
        altText: input.altText ?? null,
        source: "upload",
      });
      return ok(media);
    } catch (error) {
      await storage.delete(stored.path);
      throw error;
    }
  },
};
