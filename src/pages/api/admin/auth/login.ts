import type { APIRoute } from "astro";
import { AuthService } from "../../../../server/services/AuthService";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/admin/dashboard");
  const safeNext = next.startsWith("/admin") ? next : "/admin/dashboard";

  const result = await AuthService.login(email, password, request, cookies);

  if (!result.ok) {
    return redirect(
      `/admin/login?error=${encodeURIComponent(result.error)}&next=${encodeURIComponent(safeNext)}`
    );
  }

  // No manual cookies.set() here, unlike the pre-2B.3 version — AuthService.login()
  // already wrote the session cookie(s) via createSupabaseServerClient's
  // setAll adapter as a side effect of signInWithPassword() succeeding.
  return redirect(safeNext);
};
