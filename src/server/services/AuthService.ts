import type { AstroCookies } from "astro";
import { AdminUserRepository, isApprovedAdmin, type AdminUser } from "../db/repositories/AdminUserRepository";
import { createSupabaseServerClient } from "../auth/supabaseServerClient";

export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * Administrator access is one of three explicit states, decided on the
 * server for every protected request:
 *
 *   none — no valid Supabase session, or a valid session whose user has no
 *          approved admin_users row. Denied everywhere.
 *   mfa  — an approved administrator who has only passed the first factor
 *          (session assurance level aal1). Allowed only the two-step
 *          verification page and logout.
 *   full — an approved administrator whose session has been upgraded to
 *          aal2 by verifying a TOTP code. Allowed the dashboard and APIs.
 *
 * Identity comes from Supabase Auth: getUser() asks the Auth server (so a
 * revoked session is caught), and getClaims() verifies the access token
 * before its `aal` claim is trusted. Approval comes only from an existing
 * admin_users row for that exact auth UUID with an approved role — never
 * from an email match, user metadata or anything the browser sends.
 */
export type AdminAccess =
  | { state: "none"; hadSession: boolean; unapproved: boolean }
  | { state: "mfa"; admin: AdminUser; hasVerifiedFactor: boolean }
  | { state: "full"; admin: AdminUser };

export const PASSWORD_MIN_LENGTH = 12;
// Supabase Auth hashes with bcrypt, which only uses the first 72 bytes.
export const PASSWORD_MAX_LENGTH = 72;

const GENERIC_LOGIN_ERROR = "Invalid email or password.";
const CODE_PATTERN = /^\d{6}$/;

type Supabase = ReturnType<typeof createSupabaseServerClient>;
type Factor = { id: string; factor_type: string; status: string };

function totpFactors(user: { factors?: Factor[] | null } | null | undefined) {
  const all = (user?.factors ?? []).filter((f) => f.factor_type === "totp");
  return { verified: all.filter((f) => f.status === "verified"), unverified: all.filter((f) => f.status !== "verified") };
}

/** Removes every Supabase session cookie this request carried, whatever signOut managed to do. */
function clearSessionCookies(request: Request, cookies: AstroCookies) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name && name.startsWith("sb-")) cookies.delete(name, { path: "/" });
  }
}

async function endSession(supabase: Supabase, request: Request, cookies: AstroCookies) {
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  clearSessionCookies(request, cookies);
}

/**
 * Validated identity + assurance level for the current request, or null.
 * The `sub` of the verified token must be the same user the Auth server
 * returned, otherwise nothing is trusted.
 */
async function verifiedIdentity(supabase: Supabase) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims || claimsData.claims.sub !== userData.user.id) return null;
  const aal = claimsData.claims.aal === "aal2" ? "aal2" : "aal1";
  return { user: userData.user, aal } as const;
}

function hasSessionCookie(request: Request) {
  return /(?:^|;\s*)sb-[^=]+=/.test(request.headers.get("cookie") ?? "");
}

export const AuthService = {
  /**
   * First factor. Succeeds only for an approved administrator; any other
   * outcome (wrong password, unconfirmed or unknown account, or a valid
   * account that is not an approved admin) returns the same generic error,
   * and a session created for an unapproved account is ended immediately.
   * Nothing is written for unapproved accounts.
   */
  async login(email: string, password: string, request: Request, cookies: AstroCookies): Promise<AuthResult> {
    const supabase = createSupabaseServerClient(request, cookies);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) return { ok: false, error: GENERIC_LOGIN_ERROR };

    const row = await AdminUserRepository.findById(data.user.id).catch(() => null);
    if (!isApprovedAdmin(row)) {
      await endSession(supabase, request, cookies);
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    await AdminUserRepository.touchLastLogin(row.id);
    return { ok: true };
  },

  async logout(request: Request, cookies: AstroCookies): Promise<void> {
    const supabase = createSupabaseServerClient(request, cookies);
    await endSession(supabase, request, cookies);
  },

  /**
   * The access state for this request (see AdminAccess). A valid session
   * that does not belong to an approved administrator is signed out here,
   * so it cannot linger.
   */
  async resolveAccess(request: Request, cookies: AstroCookies): Promise<AdminAccess> {
    const hadSession = hasSessionCookie(request);
    if (!hadSession) return { state: "none", hadSession, unapproved: false };

    const supabase = createSupabaseServerClient(request, cookies);
    const identity = await verifiedIdentity(supabase);
    if (!identity) {
      clearSessionCookies(request, cookies);
      return { state: "none", hadSession, unapproved: false };
    }

    const row = await AdminUserRepository.findById(identity.user.id).catch(() => null);
    if (!isApprovedAdmin(row)) {
      await endSession(supabase, request, cookies);
      return { state: "none", hadSession, unapproved: true };
    }

    if (identity.aal === "aal2") return { state: "full", admin: row };
    return { state: "mfa", admin: row, hasVerifiedFactor: totpFactors(identity.user).verified.length > 0 };
  },

  /**
   * Two-step setup, step 1 — for an approved administrator at aal1 who has
   * no verified authenticator yet. Any half-finished (unverified) TOTP
   * factor of this same user is removed first, then a new one is created.
   * The returned QR code and secret are shown once to the signed-in owner
   * and never stored or logged by this application.
   */
  async startTotpEnrollment(
    request: Request,
    cookies: AstroCookies
  ): Promise<{ ok: true; factorId: string; qrCode: string; secret: string } | { ok: false; error: string }> {
    const access = await AuthService.resolveAccess(request, cookies);
    if (access.state !== "mfa") return { ok: false, error: "Please sign in again." };
    if (access.hasVerifiedFactor) return { ok: false, error: "An authenticator is already set up for this account." };

    const supabase = createSupabaseServerClient(request, cookies);
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const factor of list?.all ?? []) {
      if (factor.factor_type === "totp" && factor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {});
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `FreshPetals admin ${new Date().toISOString().slice(0, 16)}`,
      issuer: "FreshPetals Admin",
    });
    if (error || !data || data.type !== "totp") {
      return { ok: false, error: "Two-step setup could not start. Please try again." };
    }
    return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  },

  /**
   * Second factor. Verifies a 6-digit code against this session user's own
   * TOTP factor and, on success, Supabase upgrades the session to aal2
   * (new cookies are written through the cookie adapter). The factor is
   * always looked up from the verified session — a posted factor id is
   * only accepted if it is one of this user's own unverified factors,
   * i.e. the one created a moment ago during setup.
   */
  async verifyTotp(code: string, postedFactorId: string | null, request: Request, cookies: AstroCookies): Promise<AuthResult> {
    if (!CODE_PATTERN.test(code)) return { ok: false, error: "Enter the 6-digit code from your authenticator app." };

    const access = await AuthService.resolveAccess(request, cookies);
    if (access.state === "none") return { ok: false, error: "Your session has ended. Please sign in again." };
    if (access.state === "full") return { ok: true };

    const supabase = createSupabaseServerClient(request, cookies);
    const { data: userData } = await supabase.auth.getUser();
    const { verified, unverified } = totpFactors(userData.user as { factors?: Factor[] } | null);

    let factorId: string | undefined;
    if (verified.length) factorId = verified[0].id;
    else if (postedFactorId && unverified.some((f) => f.id === postedFactorId)) factorId = postedFactorId;
    if (!factorId) return { ok: false, error: "Set up your authenticator first." };

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return { ok: false, error: "That code didn't work. Check that your phone's time is correct and enter the current code." };
    return { ok: true };
  },

  /**
   * Forgot-password. Emails a recovery link only when the address belongs
   * to an approved administrator; the response the visitor sees is
   * identical either way (see forgot-password.ts). redirectTo must come
   * from SITE_URL in production, never from the request's Host header.
   */
  async requestPasswordReset(email: string, redirectTo: string, request: Request, cookies: AstroCookies): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const row = await AdminUserRepository.findByEmail(normalized).catch(() => null);
    if (!isApprovedAdmin(row)) return;
    const supabase = createSupabaseServerClient(request, cookies);
    await supabase.auth.resetPasswordForEmail(normalized, { redirectTo }).catch(() => {});
  },

  /** Recovery link, PKCE path: exchanges the one-time ?code= for a (first-factor) session. */
  async exchangeRecoveryCode(code: string, request: Request, cookies: AstroCookies): Promise<boolean> {
    const supabase = createSupabaseServerClient(request, cookies);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  },

  /**
   * Recovery link, token-hash form (works on any device): used when the
   * Supabase "Reset password" email template links to
   * /admin/reset-password?token_hash={{ .TokenHash }}&type=recovery.
   */
  async verifyRecoveryTokenHash(tokenHash: string, request: Request, cookies: AstroCookies): Promise<boolean> {
    const supabase = createSupabaseServerClient(request, cookies);
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    return !error;
  },

  /** Recovery link, implicit-flow fallback: bridges fragment tokens into the httpOnly cookies. */
  async setRecoverySession(accessToken: string, refreshToken: string, request: Request, cookies: AstroCookies): Promise<boolean> {
    const supabase = createSupabaseServerClient(request, cookies);
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return !error;
  },

  /**
   * State of a recovery session for reset-password.astro: whether one is
   * valid at all, and whether the account has an authenticator (in which
   * case the new password is accepted only together with a current code).
   */
  async recoveryState(request: Request, cookies: AstroCookies): Promise<{ valid: boolean; needsCode: boolean }> {
    const supabase = createSupabaseServerClient(request, cookies);
    const identity = await verifiedIdentity(supabase);
    if (!identity) return { valid: false, needsCode: false };
    return { valid: true, needsCode: identity.aal !== "aal2" && totpFactors(identity.user).verified.length > 0 };
  },

  /**
   * Sets a new password on the current recovery session. If the account
   * has an authenticator, a valid current code is required first, so a
   * reset link alone cannot change the password of an MFA-protected
   * account. Never creates or changes admin membership, and always ends
   * the session afterwards: the admin signs in again (both factors).
   */
  async updatePassword(password: string, code: string | null, request: Request, cookies: AstroCookies): Promise<AuthResult> {
    const supabase = createSupabaseServerClient(request, cookies);
    const identity = await verifiedIdentity(supabase);
    if (!identity) {
      return { ok: false, error: "This password reset link is invalid or has expired. Please request a new one." };
    }

    const { verified } = totpFactors(identity.user);
    if (identity.aal !== "aal2" && verified.length) {
      if (!code || !CODE_PATTERN.test(code)) return { ok: false, error: "Enter the current 6-digit code from your authenticator app." };
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verified[0].id, code });
      if (error) return { ok: false, error: "That code didn't work. Enter the current code from your authenticator app." };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return { ok: false, error: "We couldn't set that password. Please choose a different password and try again." };
    }

    await endSession(supabase, request, cookies);
    return { ok: true };
  },
};
