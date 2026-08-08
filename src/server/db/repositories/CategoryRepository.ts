import { getDb, nowIso } from "../client";

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageId: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageId: row.image_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const CategoryRepository = {
  list(): Category[] {
    const rows = getDb()
      .prepare("SELECT * FROM categories ORDER BY sort_order ASC, name ASC")
      .all();
    return rows.map(mapRow);
  },

  findById(id: number): Category | null {
    const row = getDb().prepare("SELECT * FROM categories WHERE id = ?").get(id);
    return row ? mapRow(row) : null;
  },

  findBySlug(slug: string): Category | null {
    const row = getDb().prepare("SELECT * FROM categories WHERE slug = ?").get(slug);
    return row ? mapRow(row) : null;
  },

  findByName(name: string): Category | null {
    const row = getDb()
      .prepare("SELECT * FROM categories WHERE lower(name) = lower(?)")
      .get(name);
    return row ? mapRow(row) : null;
  },

  count(): number {
    const row = getDb().prepare("SELECT COUNT(*) AS n FROM categories").get() as any;
    return row.n;
  },

  create(input: {
    name: string;
    slug: string;
    description?: string | null;
    imageId?: number | null;
    sortOrder?: number;
  }): Category {
    const timestamp = nowIso();
    const result = getDb()
      .prepare(
        `INSERT INTO categories (name, slug, description, image_id, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name,
        input.slug,
        input.description ?? null,
        input.imageId ?? null,
        input.sortOrder ?? 0,
        timestamp,
        timestamp
      );

    return this.findById(Number(result.lastInsertRowid))!;
  },

  update(
    id: number,
    input: Partial<{
      name: string;
      slug: string;
      description: string | null;
      imageId: number | null;
      sortOrder: number;
    }>
  ): Category | null {
    const existing = this.findById(id);
    if (!existing) return null;

    getDb()
      .prepare(
        `UPDATE categories
         SET name = ?, slug = ?, description = ?, image_id = ?, sort_order = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.name ?? existing.name,
        input.slug ?? existing.slug,
        input.description === undefined ? existing.description : input.description,
        input.imageId === undefined ? existing.imageId : input.imageId,
        input.sortOrder ?? existing.sortOrder,
        nowIso(),
        id
      );

    return this.findById(id);
  },

  delete(id: number): void {
    getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
  },

  /** Used to block deletion in the UI with a friendly message instead of a raw FK error. */
  countProducts(categoryId: number): number {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS n FROM products WHERE category_id = ?")
      .get(categoryId) as any;
    return row.n;
  },
};
