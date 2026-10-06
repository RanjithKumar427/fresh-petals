import type { APIRoute } from "astro";
import { AuthService, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../../../../server/services/AuthService";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");
  const code = String(form.get("code") || "").trim() || null;
  const fail = (message: string) => redirect(`/admin/reset-password?error=${encodeURIComponent(message)}`);

  if (!password || !confirmPassword) return fail("Please fill in both password fields.");
  if (password !== confirmPassword) return fail("Passwords do not match.");
  // Same rule as the form and the Supabase project setting.
  if (password.length < PASSWORD_MIN_LENGTH) return fail(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) return fail(`Password must be at most ${PASSWORD_MAX_LENGTH} characters.`);

  const result = await AuthService.updatePassword(password, code, request, cookies);
  if (!result.ok) return fail(result.error);

  return redirect("/admin/reset-password?done=1");
};
