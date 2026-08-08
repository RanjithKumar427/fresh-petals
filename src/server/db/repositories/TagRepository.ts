// Shared type for the three independent taxonomies (occasions, moods,
// flower_types) — still one shape, still not three copy-pasted type
// definitions. The `createTagRepository` SQLite factory that used to live
// here is retired as of Phase 2B.2 (its Postgres/Drizzle successor is
// SupabaseTagRepository.ts's `createSupabaseTagRepository`); preserved in
// git history, not duplicated here as dead code — a `git revert` of that
// phase's commit brings it back if ever needed.
export type Tag = {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
};

/** The contract every tag-repository implementation (SQLite, Supabase, or a future one) must satisfy. */
export interface TagRepositoryContract {
  list(): Promise<Tag[]>;
  findById(id: number): Promise<Tag | null>;
  findByName(name: string): Promise<Tag | null>;
  create(input: { name: string; slug: string }): Promise<Tag>;
  findOrCreate(name: string, slug: string): Promise<Tag>;
  delete(id: number): Promise<void>;
}
