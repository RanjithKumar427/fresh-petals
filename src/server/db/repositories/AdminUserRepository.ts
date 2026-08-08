// Stable public entry point every service imports from — see
// ProductRepository.ts (Phase 2B.1) for the fuller explanation of this
// pattern. As of Phase 2B.3 this re-exports SupabaseAdminUserRepository
// instead of a node:sqlite one, and its shape changed with its meaning:
// this is a profile/role record now, not a credential store — Supabase
// Auth (its own `auth.users` table) is the sole source of truth for
// passwords. `id` is that auth user's UUID, not an app-generated one.
export type AdminUser = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
};

/** The contract every AdminUserRepository implementation must satisfy. */
export interface AdminUserRepositoryContract {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  count(): Promise<number>;
  create(input: { id: string; email: string; role?: string }): Promise<AdminUser>;
  touchLastLogin(id: string): Promise<void>;
}

export { SupabaseAdminUserRepository as AdminUserRepository } from "./SupabaseAdminUserRepository";
