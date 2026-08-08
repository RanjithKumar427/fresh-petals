// Postgres/Drizzle implementation of the AdminUserRepository contract —
// see AdminUserRepository.ts for the stable public export, and
// SupabaseProductRepository.ts for the fuller explanation of the
// file-per-implementation pattern this follows.
//
// This is a profile/role repository now, not a credential store — no
// method here ever sees or handles a password. `id` is a Supabase Auth
// UUID (`auth.users.id`), not an app-generated identifier — every method
// takes/returns that same UUID, never regenerates one.
import { count, eq } from "drizzle-orm";
import { getDb } from "../postgres/client";
import { adminUsers } from "../postgres/schema";
import { withRepositoryCall } from "../postgres/repository";
import type { AdminUser } from "./AdminUserRepository";

type AdminUserRow = typeof adminUsers.$inferSelect;

function mapRow(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  };
}

export const SupabaseAdminUserRepository = {
  async findByEmail(email: string): Promise<AdminUser | null> {
    return withRepositoryCall("SupabaseAdminUserRepository.findByEmail", async () => {
      const [row] = await getDb().select().from(adminUsers).where(eq(adminUsers.email, email.trim().toLowerCase()));
      return row ? mapRow(row) : null;
    });
  },

  async findById(id: string): Promise<AdminUser | null> {
    return withRepositoryCall("SupabaseAdminUserRepository.findById", async () => {
      const [row] = await getDb().select().from(adminUsers).where(eq(adminUsers.id, id));
      return row ? mapRow(row) : null;
    });
  },

  async count(): Promise<number> {
    return withRepositoryCall("SupabaseAdminUserRepository.count", async () => {
      const [row] = await getDb().select({ n: count() }).from(adminUsers);
      return row.n;
    });
  },

  /**
   * Upserts a profile row for an id that must already exist in Supabase
   * Auth (the FK on admin_users.id enforces this — inserting for a
   * nonexistent auth user fails loudly, not silently). Self-healing path
   * for AuthService.verifySession(): if a valid Supabase Auth session
   * exists but its profile row doesn't yet (e.g. an admin invited via the
   * dashboard rather than scripts/link-admin-identity.mjs), login/session
   * verification creates it rather than failing.
   */
  async create(input: { id: string; email: string; role?: string }): Promise<AdminUser> {
    return withRepositoryCall("SupabaseAdminUserRepository.create", async () => {
      const [row] = await getDb()
        .insert(adminUsers)
        .values({ id: input.id, email: input.email.trim().toLowerCase(), role: input.role ?? "admin", createdAt: new Date() })
        .onConflictDoUpdate({ target: adminUsers.id, set: { email: input.email.trim().toLowerCase() } })
        .returning();
      return mapRow(row);
    });
  },

  async touchLastLogin(id: string): Promise<void> {
    return withRepositoryCall("SupabaseAdminUserRepository.touchLastLogin", async () => {
      await getDb().update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, id));
    });
  },
};
