import {
  MediaRepository,
  type Media,
  type MediaFolder,
  type MediaListItem,
  type MediaUsage,
} from "../db/repositories/MediaRepository";
import { getStorageService } from "../storage";
import { sanitizeImage } from "../media/imageSafety";
import { ok, fail, type ServiceResult } from "./result";

export const MediaService = {
  async list(filter?: { folder?: MediaFolder; search?: string; unused?: boolean }): Promise<MediaListItem[]> {
    return MediaRepository.list(filter);
  },

  async get(id: number): Promise<Media | null> {
    return MediaRepository.findById(id);
  },

  async count(): Promise<number> {
    return MediaRepository.count();
  },

  async countByFolder(): Promise<Record<MediaFolder, number>> {
    return MediaRepository.countByFolder();
  },

  async getUsage(id: number): Promise<MediaUsage> {
    return MediaRepository.getUsage(id);
  },

  async remove(id: number): Promise<ServiceResult<null>> {
    const media = await MediaRepository.findById(id);
    if (!media) return fail("File not found.");
    if (await MediaRepository.isInUse(id)) {
      return fail("This image is used by a product or category. Remove it there first.");
    }

    await MediaRepository.delete(id);
    // Best-effort: a seeded row (path === null) has nothing on disk to remove.
    if (media.path) getStorageService().delete(media.path).catch(() => {});
    return ok(null);
  },

  async rename(id: number, filename: string): Promise<ServiceResult<Media>> {
    const trimmed = filename.trim();
    if (!trimmed) return fail("Filename can't be empty.");

    const media = await MediaRepository.rename(id, trimmed);
    if (!media) return fail("File not found.");
    return ok(media);
  },

  async updateAltText(id: number, altText: string | null): Promise<ServiceResult<Media>> {
    const media = await MediaRepository.updateAltText(id, altText);
    if (!media) return fail("File not found.");
    return ok(media);
  },

  /** Moves a file to a different folder — physical relocation (StorageService.move) plus the DB row, kept in sync. */
  async move(id: number, toFolder: MediaFolder): Promise<ServiceResult<Media>> {
    const media = await MediaRepository.findById(id);
    if (!media) return fail("File not found.");
    if (media.folder === toFolder) return ok(media);
    if (!media.path) return fail("Seeded images aren't stored as files yet, so they can't be moved.");

    const storage = getStorageService();
    const moved = await storage.move(media.path, toFolder);

    try {
      const updated = await MediaRepository.updateLocation(id, { folder: toFolder, path: moved.path, url: moved.url });
      return ok(updated!);
    } catch (error) {
      // Move the file back so a DB failure doesn't strand it under the new folder with a stale DB row.
      await storage.move(moved.path, media.folder).catch(() => {});
      throw error;
    }
  },

  /**
   * Orchestrates StorageService.put + MediaRepository.create as one unit:
   * if the DB insert fails after the file is written, the file is cleaned
   * up so a failed upload never leaves an orphaned file on disk.
   *
   * Only a decoded and re-encoded image is stored (sanitizeImage in
   * ../media/imageSafety.ts): its real format must match the declared
   * type, size, pixel and frame limits apply, metadata and trailing bytes
   * are removed, and the stored name and type follow the real format.
   * A file that fails any check is refused before storage is touched.
   */
  async upload(input: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    folder: MediaFolder;
    altText?: string | null;
  }): Promise<ServiceResult<Media>> {
    const checked = await sanitizeImage({ buffer: input.buffer, declaredMime: input.mimeType, filename: input.filename });
    if (!checked.ok) return fail(checked.error);
    const image = checked.image;

    const storage = getStorageService();
    const stored = await storage.put({
      buffer: image.buffer,
      filename: image.filename,
      mimeType: image.mimeType,
      folder: input.folder,
    });

    try {
      const media = await MediaRepository.create({
        filename: image.filename,
        path: stored.path,
        url: stored.url,
        folder: input.folder,
        mimeType: image.mimeType,
        sizeBytes: stored.sizeBytes,
        width: image.width,
        height: image.height,
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
