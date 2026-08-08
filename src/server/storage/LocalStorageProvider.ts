import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { UPLOADS_ROOT } from "../db/paths.mjs";
import type { StorageService, StoredFile } from "./StorageService";

function safeExtension(filename: string): string {
  const match = filename.match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : "";
}

/** v1 storage driver — writes to the project-root /uploads folder (see paths.mjs for why it lives outside src/public). */
export const LocalStorageProvider: StorageService = {
  async put({ buffer, filename, folder }): Promise<StoredFile> {
    const dir = path.join(UPLOADS_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });

    const generatedName = `${randomUUID()}${safeExtension(filename)}`;
    await fs.writeFile(path.join(dir, generatedName), buffer);

    const relativePath = `${folder}/${generatedName}`;
    return {
      path: relativePath,
      url: `/media/${relativePath}`,
      sizeBytes: buffer.byteLength,
    };
  },

  async delete(relativePath: string): Promise<void> {
    const fullPath = path.join(UPLOADS_ROOT, relativePath);
    await fs.rm(fullPath, { force: true });
  },
};
