import type { APIRoute } from "astro";
import { AuthService } from "../../../../server/services/AuthService";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (!password || !confirmPassword) {
    return redirect(
      `/admin/reset-password?error=${encodeURIComponent("Please fill in both password fields.")}`
    );
  }
  if (password !== confirmPassword) {
    return redirect(`/admin/reset-password?error=${encodeURIComponent("Passwords do not match.")}`);
  }
  // A soft floor only, mirrored client-side too -- Supabase's own
  // configured minimum (set in its dashboard, not this codebase) is the
  // actual authority; this just avoids a wasted round trip for obviously
  // too-short input. See AuthService.updatePassword for what happens if
  // Supabase's real minimum is stricter than this.
  if (password.length < 6) {
    return redirect(
      `/admin/reset-password?error=${encodeURIComponent("Password must be at least 6 characters.")}`
    );
  }

  const result = await AuthService.updatePassword(password, request, cookies);

  if (!result.ok) {
    return redirect(`/admin/reset-password?error=${encodeURIComponent(result.error)}`);
  }

  return redirect("/admin/reset-password?done=1");
};
