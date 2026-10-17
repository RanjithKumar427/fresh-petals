import type { APIRoute } from "astro";
import { AuthService } from "../../../../server/services/AuthService";
import { safeAdminPath } from "../../../../server/auth/safeAdminPath";
import { BODY_LIMITS, readForm } from "../../../../server/http/body";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await readForm(request, BODY_LIMITS.authForm).catch(() => null);
  if (!form) return redirect(`/admin/login?error=${encodeURIComponent("Please try signing in again.")}`);
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  const next = safeAdminPath(String(form.get("next") || ""));

  const result = await AuthService.login(email, password, request, cookies);

  if (!result.ok) {
    return redirect(`/admin/login?error=${encodeURIComponent(result.error)}&next=${encodeURIComponent(next)}`);
  }

  // The password is only the first step: every administrator finishes
  // signing in on /admin/mfa (set up an authenticator, or enter its code).
  return redirect(`/admin/mfa?next=${encodeURIComponent(next)}`);
};
