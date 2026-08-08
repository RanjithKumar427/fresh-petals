import type { AstroCookies } from "astro";
import { AdminUserRepository, type AdminUser } from "../db/repositories/AdminUserRepository";
import { createSupabaseServerClient } from "../auth/supabaseServerClient";

export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * Everything auth-related that pages/API routes are allowed to call.
 * Pages never construct a Supabase client, never touch cookies for auth
 * purposes directly, and never touch AdminUserRepository directly — only
 * this service. Supabase Auth itself is an implementation detail behind
 * this file, same as Postgres is behind ProductRepository: every method
 * here takes the same `request`/`cookies` Astro already hands every page
 * and API route, and nothing above this file needs to know a JWT or a
 * `sb-*` cookie exists.
 */
export const AuthService = {
  async login(email: string, password: string, request: Request, cookies: AstroCookies): Promise<AuthResult> {
    const supabase = createSupabaseServerClient(request, cookies);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });

    if (error || !data.user) {
      // Supabase's own error message ("Invalid login credentials") is
      // already safe to show as-is — it doesn't distinguish "no such
      // user" from "wrong password" (neither did the scrypt-based version
      // this replaces), so nothing project-specific to translate here.
      return { ok: false, error: error?.message ?? "Invalid email or password." };
    }

    // Self-healing: create the profile row on first successful login if
    // scripts/link-admin-identity.mjs hasn't run yet for this user (e.g.
    // an admin invited straight from the Supabase dashboard). Every
    // subsequent login just updates last_login_at on the row that already
    // exists.
    const existing = await AdminUserRepository.findById(data.user.id);
    if (!existing) {
      await AdminUserRepository.create({ id: data.user.id, email: data.user.email! });
    }
    await AdminUserRepository.touchLastLogin(data.user.id);

    return { ok: true };
  },

  async logout(request: Request, cookies: AstroCookies): Promise<void> {
    const supabase = createSupabaseServerClient(request, cookies);
    await supabase.auth.signOut();
  },

  /**
   * Returns the signed-in admin for the current request's session, or
   * null if absent/expired/invalid. Uses getUser() (which re-validates
   * the JWT against Supabase's own auth server), not getSession() (which
   * only decodes the locally-held token) — the same "don't trust a token
   * just because it's well-formed" discipline this project has applied to
   * every other trust boundary.
   */
  async verifySession(request: Request, cookies: AstroCookies): Promise<AdminUser | null> {
    const supabase = createSupabaseServerClient(request, cookies);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const existing = await AdminUserRepository.findById(data.user.id);
    if (existing) return existing;
    // Same self-healing path as login() — a valid Supabase session can
    // exist without a profile row yet (e.g. this is the first request
    // after signInWithPassword() already ran and set the cookie, before
    // login()'s own create-if-missing had a chance to run in a different
    // request). Belt-and-braces, not load-bearing on the happy path.
    return AdminUserRepository.create({ id: data.user.id, email: data.user.email! });
  },
};
