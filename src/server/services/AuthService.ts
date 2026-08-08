import { AdminUserRepository, type AdminUser } from "../db/repositories/AdminUserRepository";
import { SessionRepository } from "../db/repositories/SessionRepository";
import { hashPassword, verifyPassword } from "../auth/password";
import { generateSessionToken, sessionExpiryIso, isExpired } from "../auth/session";

export type AuthResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; error: string };

/**
 * Everything auth-related that pages/API routes are allowed to call.
 * Pages never touch AdminUserRepository/SessionRepository/password hashing
 * directly — only this service.
 */
export const AuthService = {
  /** Used once, at first boot, by scripts/create-admin.mjs. */
  hasAdminAccount(): boolean {
    return AdminUserRepository.count() > 0;
  },

  createAdminAccount(email: string, password: string): AdminUser {
    return AdminUserRepository.create({ email, passwordHash: hashPassword(password) });
  },

  login(email: string, password: string): AuthResult {
    const user = AdminUserRepository.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return { ok: false, error: "Invalid email or password." };
    }

    const token = generateSessionToken();
    const expiresAt = sessionExpiryIso();
    SessionRepository.create({ token, adminUserId: user.id, expiresAt });
    AdminUserRepository.touchLastLogin(user.id);

    return { ok: true, token, expiresAt };
  },

  logout(token: string): void {
    SessionRepository.deleteByToken(token);
  },

  /** Returns the signed-in admin user for a session token, or null if absent/expired. */
  verifySession(token: string | undefined | null): AdminUser | null {
    if (!token) return null;

    const session = SessionRepository.findByToken(token);
    if (!session) return null;

    if (isExpired(session.expiresAt)) {
      SessionRepository.deleteByToken(token);
      return null;
    }

    return AdminUserRepository.findById(session.adminUserId);
  },
};
