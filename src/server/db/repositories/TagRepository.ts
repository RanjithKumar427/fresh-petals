import { getDb, nowIso } from "../client";

export type Tag = {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
};

function mapRow(row: any): Tag {
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

/**
 * occasions, moods and flower_types are independent taxonomies with an
 * identical (id, name, slug, created_at) shape — one factory instead of
 * three copy-pasted repositories.
 */
export function createTagRepository(table: "occasions" | "moods" | "flower_types") {
  return {
    list(): Tag[] {
      const rows = getDb().prepare(`SELECT * FROM ${table} ORDER BY name ASC`).all();
      return rows.map(mapRow);
    },

    findById(id: number): Tag | null {
      const row = getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
      return row ? mapRow(row) : null;
    },

    findByName(name: string): Tag | null {
      const row = getDb()
        .prepare(`SELECT * FROM ${table} WHERE lower(name) = lower(?)`)
        .get(name);
      return row ? mapRow(row) : null;
    },

    create(input: { name: string; slug: string }): Tag {
      const createdAt = nowIso();
      const result = getDb()
        .prepare(`INSERT INTO ${table} (name, slug, created_at) VALUES (?, ?, ?)`)
        .run(input.name, input.slug, createdAt);
      return { id: Number(result.lastInsertRowid), name: input.name, slug: input.slug, createdAt };
    },

    /** Idempotent — used heavily by product save/seed, where the same tag gets referenced repeatedly. */
    findOrCreate(name: string, slug: string): Tag {
      const existing = this.findByName(name);
      if (existing) return existing;
      return this.create({ name, slug });
    },

    delete(id: number): void {
      getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    },
  };
}
