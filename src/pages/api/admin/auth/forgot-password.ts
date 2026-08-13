import type { APIRoute } from "astro";
import { AuthService } from "../../../../server/services/AuthService";

export const prerender = false;

// Loose, client-mirrored check only -- Supabase itself is the actual
// authority on whether an address is deliverable; this just avoids a
// network round trip for obviously empty/malformed input.
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim();

  if (!email) {
    return redirect(`/admin/forgot-password?error=${encodeURIComponent("Please enter your email address.")}`);
  }
  if (!looksLikeEmail(email)) {
    return redirect(`/admin/forgot-password?error=${encodeURIComponent("Please enter a valid email address.")}`);
  }

  // SITE_URL is the same single source of truth astro.config.mjs already
  // uses for canonical/sitemap URLs. Falling back to this request's own
  // origin (not a hardcoded guess) keeps local dev pointed at localhost
  // instead of accidentally emailing a production reset link while testing.
  const siteUrl = process.env.SITE_URL || new URL(request.url).origin;
  const redirectTo = new URL("/admin/reset-password", siteUrl).toString();

  await AuthService.requestPasswordReset(email, redirectTo, request, cookies);

  // Same response whether or not this email belongs to a registered admin
  // -- see AuthService.requestPasswordReset's comment. Never distinguish
  // "not registered" here; that's exactly what account enumeration looks for.
  return redirect("/admin/forgot-password?sent=1");
};
