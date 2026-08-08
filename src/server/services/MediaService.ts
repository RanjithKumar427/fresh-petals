import sharp from "sharp";
import {
  MediaRepository,
  type Media,
  type MediaFolder,
  type MediaListItem,
  type MediaUsage,
} from "../db/repositories/MediaRepository";
import { getStorageService } from "../storage";
import { ok, fail, type ServiceResult } from "./result";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function readDimensions(buffer: Buffer): Promise<{ width: number | null; height: number | null }> {
  try {
    const metadata = await sharp(buffer).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    // A corrupt/unreadable image still gets stored — dimensions just show as unknown rather than blocking the upload.
    return { width: null, height: null };
  }
}

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

    const [storage, dimensions] = [getStorageService(), await readDimensions(input.buffer)];
    const stored = await storage.put({
      buffer: input.buffer,
      filename: input.filename,
      mimeType: input.mimeType,
      folder: input.folder,
    });

    try {
      const media = await MediaRepository.create({
        filename: input.filename,
        path: stored.path,
        url: stored.url,
        folder: input.folder,
        mimeType: input.mimeType,
        sizeBytes: stored.sizeBytes,
        width: dimensions.width,
        height: dimensions.height,
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
