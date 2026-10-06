import type { APIRoute } from "astro";
import { AuthService } from "../../../../server/services/AuthService";

export const prerender = false;

// Loose, client-mirrored check only -- Supabase itself is the actual
// authority on whether an address is deliverable; this just avoids a
// network round trip for obviously empty/malformed input.
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Where the emailed link points. In production this must be SITE_URL
 * (https://onlyfreshpetals.in) — never the request's own Host header,
 * which a client controls. Outside production the request origin is used
 * so local and preview runs never email a production link.
 */
function resetRedirect(request: Request): string | null {
  const configured = process.env.SITE_URL;
  const nonProduction = process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development" || !import.meta.env.PROD;
  if (!nonProduction) {
    if (!configured) return null;
    return new URL("/admin/reset-password", configured).toString();
  }
  return new URL("/admin/reset-password", configured || new URL(request.url).origin).toString();
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

  const redirectTo = resetRedirect(request);
  if (redirectTo) {
    await AuthService.requestPasswordReset(email, redirectTo, request, cookies);
  } else {
    console.error("[forgot-password] SITE_URL is not set in production; no reset email sent.");
  }

  // Same response whether or not this email belongs to an administrator,
  // and whether or not an email was sent: never distinguish them here.
  return redirect("/admin/forgot-password?sent=1");
};
