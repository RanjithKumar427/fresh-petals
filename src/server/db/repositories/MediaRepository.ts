import { getDb, nowIso } from "../client";

export type MediaFolder = "products" | "categories" | "hero" | "occasions";

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

function mapRow(row: any): Media {
  return {
    id: row.id,
    filename: row.filename,
    path: row.path,
    url: row.url,
    folder: row.folder,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    altText: row.alt_text,
    source: row.source,
    createdAt: row.created_at,
  };
}

export const MediaRepository = {
  list(filter?: { folder?: MediaFolder; search?: string }): Media[] {
    const clauses: string[] = [];
    const params: any[] = [];

    if (filter?.folder) {
      clauses.push("folder = ?");
      params.push(filter.folder);
    }
    if (filter?.search) {
      clauses.push("filename LIKE ?");
      params.push(`%${filter.search}%`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = getDb()
      .prepare(`SELECT * FROM media ${where} ORDER BY created_at DESC`)
      .all(...params);
    return rows.map(mapRow);
  },

  findById(id: number): Media | null {
    const row = getDb().prepare("SELECT * FROM media WHERE id = ?").get(id);
    return row ? mapRow(row) : null;
  },

  count(): number {
    const row = getDb().prepare("SELECT COUNT(*) AS n FROM media").get() as any;
    return row.n;
  },

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
  }): Media {
    const createdAt = nowIso();
    const result = getDb()
      .prepare(
        `INSERT INTO media (filename, path, url, folder, mime_type, size_bytes, width, height, alt_text, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.filename,
        input.path,
        input.url,
        input.folder,
        input.mimeType,
        input.sizeBytes,
        input.width ?? null,
        input.height ?? null,
        input.altText ?? null,
        input.source ?? "upload",
        createdAt
      );

    return this.findById(Number(result.lastInsertRowid))!;
  },

  delete(id: number): void {
    getDb().prepare("DELETE FROM media WHERE id = ?").run(id);
  },

  /** Used to block deletion in the UI when a product/category still references this file. */
  isInUse(id: number): boolean {
    const db = getDb();
    const usedByProduct = db
      .prepare("SELECT 1 FROM product_images WHERE media_id = ? LIMIT 1")
      .get(id);
    const usedByCategory = db
      .prepare("SELECT 1 FROM categories WHERE image_id = ? LIMIT 1")
      .get(id);
    return Boolean(usedByProduct || usedByCategory);
  },
};
