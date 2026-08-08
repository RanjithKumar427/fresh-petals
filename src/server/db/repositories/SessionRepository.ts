import { getDb, nowIso } from "../client";

export type Session = {
  token: string;
  adminUserId: number;
  expiresAt: string;
  createdAt: string;
};

function mapRow(row: any): Session {
  return {
    token: row.token,
    adminUserId: row.admin_user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export const SessionRepository = {
  create(input: { token: string; adminUserId: number; expiresAt: string }): Session {
    const createdAt = nowIso();
    getDb()
      .prepare(
        "INSERT INTO sessions (token, admin_user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(input.token, input.adminUserId, input.expiresAt, createdAt);

    return { ...input, createdAt };
  },

  findByToken(token: string): Session | null {
    const row = getDb().prepare("SELECT * FROM sessions WHERE token = ?").get(token);
    return row ? mapRow(row) : null;
  },

  deleteByToken(token: string): void {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  },

  deleteExpired(): void {
    getDb().prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso());
  },
};
