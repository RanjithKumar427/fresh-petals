import type { APIRoute } from "astro";
import { AuthService } from "../../../../server/services/AuthService";

export const prerender = false;

// Implicit-flow fallback for the recovery link -- see
// AuthService.setRecoverySession's comment and reset-password.astro's
// inline script. Only reachable by a request that already carries the
// access/refresh token pair Supabase itself put in the URL fragment; this
// endpoint doesn't mint anything, it only bridges tokens the browser
// already has into the same httpOnly session cookies the PKCE path uses.
// Tokens travel in the JSON body, never the query string or a log line.
export const POST: APIRoute = async ({ request, cookies }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }

  const accessToken = typeof (body as any)?.access_token === "string" ? (body as any).access_token : "";
  const refreshToken = typeof (body as any)?.refresh_token === "string" ? (body as any).refresh_token : "";

  if (!accessToken || !refreshToken) {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }

  const ok = await AuthService.setRecoverySession(accessToken, refreshToken, request, cookies);
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400 });
};
