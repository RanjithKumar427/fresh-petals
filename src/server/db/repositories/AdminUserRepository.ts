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

/**
 * Roles that grant access to /admin. A row only counts as an approved
 * administrator when its role is in this set; any other value (or no row
 * at all) is denied. Rows are created only by a trusted operator
 * (scripts/link-admin-identity.mjs) -- never by login, session checks,
 * password recovery or MFA handling.
 */
export const APPROVED_ADMIN_ROLES: ReadonlySet<string> = new Set(["admin"]);

export function isApprovedAdmin(row: AdminUser | null): row is AdminUser {
  return !!row && APPROVED_ADMIN_ROLES.has(row.role);
}

/**
 * The contract every AdminUserRepository implementation must satisfy.
 * Deliberately read-only apart from touchLastLogin: the web application
 * cannot create, upsert, relink or elevate administrators.
 */
export interface AdminUserRepositoryContract {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  count(): Promise<number>;
  touchLastLogin(id: string): Promise<void>;
}

export { SupabaseAdminUserRepository as AdminUserRepository } from "./SupabaseAdminUserRepository";
