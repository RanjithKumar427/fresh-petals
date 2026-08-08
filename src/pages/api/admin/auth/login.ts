import type { APIRoute } from "astro";
import { AuthService } from "../../../../server/services/AuthService";
import { SESSION_COOKIE_NAME } from "../../../../server/auth/session";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/admin/dashboard");
  const safeNext = next.startsWith("/admin") ? next : "/admin/dashboard";

  const result = AuthService.login(email, password);

  if (!result.ok) {
    return redirect(
      `/admin/login?error=${encodeURIComponent(result.error)}&next=${encodeURIComponent(safeNext)}`
    );
  }

  cookies.set(SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    path: "/",
    expires: new Date(result.expiresAt),
  });

  return redirect(safeNext);
};
