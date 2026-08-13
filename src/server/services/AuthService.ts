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
   * Forgot-password — asks Supabase to email a recovery link pointed back
   * at redirectTo (the site's own /admin/reset-password). Errors are
   * swallowed deliberately: Supabase's own resetPasswordForEmail already
   * doesn't distinguish "no such account" from "sent" in its response,
   * the same anti-enumeration property login()'s error message relies on
   * — the API route above this always returns one generic message
   * regardless of what happens here, so a thrown error has nothing useful
   * to change about that response, only something unsafe to leak.
   */
  async requestPasswordReset(
    email: string,
    redirectTo: string,
    request: Request,
    cookies: AstroCookies
  ): Promise<void> {
    const supabase = createSupabaseServerClient(request, cookies);
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo }).catch(() => {});
  },

  /**
   * Recovery link, PKCE path — the redirect Supabase sends after the
   * emailed link is clicked carries a one-time `?code=`, exchanged here
   * for a real session (written via the same cookie adapter login() uses).
   * Returns false on any failure (already-used code, expired code) rather
   * than throwing — the caller falls back to checking for an
   * already-established session next, since a page refresh after a prior
   * successful exchange re-sends the same now-stale code.
   */
  async exchangeRecoveryCode(code: string, request: Request, cookies: AstroCookies): Promise<boolean> {
    const supabase = createSupabaseServerClient(request, cookies);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  },

  /**
   * Recovery link, implicit-flow fallback — if this Supabase project's
   * auth flow type is not PKCE, the recovery tokens arrive in the URL
   * *fragment* instead of a `?code=` query param, which only client-side
   * JS can read (fragments never reach the server). reset-password.astro's
   * inline script detects that case and posts the tokens here (body, not
   * query string, so they never land in a server access log) so the
   * session can be established the same server-side, cookie-based way as
   * the PKCE path above.
   */
  async setRecoverySession(
    accessToken: string,
    refreshToken: string,
    request: Request,
    cookies: AstroCookies
  ): Promise<boolean> {
    const supabase = createSupabaseServerClient(request, cookies);
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return !error;
  },

  /** Is there currently a valid Supabase session at all (recovery or otherwise)? Used to decide whether reset-password.astro can show the form. */
  async hasSession(request: Request, cookies: AstroCookies): Promise<boolean> {
    const supabase = createSupabaseServerClient(request, cookies);
    const { data, error } = await supabase.auth.getUser();
    return !error && !!data.user;
  },

  /**
   * Sets the new password on whichever session reset-password.astro
   * already established. Re-checks getUser() itself rather than trusting
   * that the page's earlier render-time check is still valid — same
   * "never trust a token just because it's well-formed" discipline
   * verifySession() below already applies. Explicitly signs the recovery
   * session out afterward: a password reset must not silently leave the
   * browser authenticated. The existing login page remains the one entry
   * point into /admin — see reset-password.astro's success state, which
   * links there rather than forwarding straight to the dashboard.
   */
  async updatePassword(password: string, request: Request, cookies: AstroCookies): Promise<AuthResult> {
    const supabase = createSupabaseServerClient(request, cookies);

    const { data: userCheck } = await supabase.auth.getUser();
    if (!userCheck.user) {
      return { ok: false, error: "This password reset link is invalid or has expired. Please request a new one." };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      // Supabase's own message here (e.g. a configured minimum-length
      // rule) is implementation detail, not something to surface verbatim.
      return { ok: false, error: "We couldn't set that password. Please choose a different password and try again." };
    }

    await supabase.auth.signOut();
    return { ok: true };
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

    // Deliberately does NOT self-heal (create a missing admin_users row)
    // here, unlike login() -- see login()'s own create-if-missing call,
    // which already covers the legitimate "first request after a brand
    // new admin's first successful sign-in" case synchronously, in the
    // same request, before any redirect back to a protected page.
    //
    // Password-reset milestone: this used to also self-heal, on the
    // reasoning that it was "belt-and-braces" for that same race. It
    // wasn't load-bearing for that case (login()'s own create already
    // finishes before the browser follows the redirect), but it silently
    // turned "has any valid Supabase session" into "is an admin" for
    // *any* path that can establish a session -- which used to only be
    // /admin/login (gated by already having admin credentials someone
    // handed out), but now also includes the password-recovery flow
    // (AuthService.exchangeRecoveryCode / setRecoverySession), reachable
    // by any existing Supabase Auth user, not just ones meant to be
    // admins. Only an admin_users row that already exists is authoritative
    // here now -- see login() if a genuinely new admin needs provisioning.
    return AdminUserRepository.findById(data.user.id);
  },
};
