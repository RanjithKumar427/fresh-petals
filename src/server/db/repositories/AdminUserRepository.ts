import { getDb, nowIso } from "../client";

export type AdminUser = {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
};

function mapRow(row: any): AdminUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

/** All SQL for admin_users lives here — services never touch node:sqlite directly. */
export const AdminUserRepository = {
  findByEmail(email: string): AdminUser | null {
    const row = getDb()
      .prepare("SELECT * FROM admin_users WHERE email = ?")
      .get(email.trim().toLowerCase());
    return row ? mapRow(row) : null;
  },

  findById(id: number): AdminUser | null {
    const row = getDb().prepare("SELECT * FROM admin_users WHERE id = ?").get(id);
    return row ? mapRow(row) : null;
  },

  count(): number {
    const row = getDb().prepare("SELECT COUNT(*) AS n FROM admin_users").get() as any;
    return row.n;
  },

  create(input: { email: string; passwordHash: string }): AdminUser {
    const createdAt = nowIso();
    const result = getDb()
      .prepare(
        "INSERT INTO admin_users (email, password_hash, created_at) VALUES (?, ?, ?)"
      )
      .run(input.email.trim().toLowerCase(), input.passwordHash, createdAt);

    return {
      id: Number(result.lastInsertRowid),
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      createdAt,
      lastLoginAt: null,
    };
  },

  touchLastLogin(id: number): void {
    getDb()
      .prepare("UPDATE admin_users SET last_login_at = ? WHERE id = ?")
      .run(nowIso(), id);
  },
};
