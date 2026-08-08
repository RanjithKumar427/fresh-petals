// Bridges Astro's cookie API to @supabase/ssr's expected shape — the one
// piece of genuinely framework-specific glue this migration needed, since
// @supabase/ssr ships adapters for Next.js/SvelteKit/Remix but not Astro.
//
// @supabase/ssr's server client needs `getAll()`/`setAll()` over cookies,
// so it can read every `sb-*` cookie a request carries (Supabase splits a
// large session JWT across multiple numbered cookies) and write back a
// refreshed token on every request without every call site needing to
// know that refresh happened. Astro's own `AstroCookies` only exposes
// `get(name)` (one cookie, by a name you already know) — no enumeration —
// so `getAll` is built by parsing the raw `Cookie` request header
// directly via the `cookie` package (a real, direct dependency of this
// project now, not assumed available transitively).
import { createServerClient } from "@supabase/ssr";
// Pinned to the exact version (1.1.1, not a ^2.x range) that both
// @supabase/ssr and Astro's own build internals already depend on — two
// real, build-verified failures led here, not a guess: (1) importing
// `cookie` for the first time with no version pin let npm resolve the
// latest major (2.x), whose API dropped the `parse`/`serialize` names in
// favor of `parseCookie`/`stringifyCookie`, and which Astro's own
// prerenderer internals import by the old names — `astro build` failed
// with "does not provide an export named 'parse'" until this was pinned.
// (2) Relying on it as an *undeclared* transitive dependency of
// @supabase/ssr (to dodge the version conflict without adding our own
// entry) worked in `astro dev` but failed `astro build`: Rollup's
// production bundling refuses to resolve an import this file doesn't
// itself declare, even when some other dependency happens to provide it.
// An exact pin is both correct and required here.
import { parse as parseCookieHeader } from "cookie";
import type { AstroCookies } from "astro";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/**
 * One client per request, bound to that request's cookies. Server-only —
 * never imported by a page component or client-side code; only
 * AuthService and middleware.ts touch this. Uses the anon/publishable
 * key, not the service-role key: this client acts *as* the signed-in
 * user's own session (sign-in, sign-out, session refresh), which is
 * exactly what the anon key + a valid session cookie is for. The
 * service-role key is reserved for genuinely admin-only operations
 * (creating/inviting users, listing all users) that never run as part of
 * a normal request — see scripts/link-admin-identity.mjs.
 */
export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
  return createServerClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        const header = request.headers.get("cookie") ?? "";
        const parsed = parseCookieHeader(header);
        return Object.entries(parsed)
          .filter((entry): entry is [string, string] => entry[1] !== undefined)
          .map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, {
            ...options,
            // Supabase's default cookie options don't set httpOnly — this
            // project's standing rule is that session-bearing cookies are
            // never readable by client-side JS, same as the opaque-token
            // cookie this replaces (SESSION_COOKIE_NAME, Phase 1-era auth).
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: "lax",
          });
        }
      },
    },
  });
}
