// How the admin's website checks read what visitors get.
//
// On Cloudflare the storefront is static files served before the Worker. A
// Worker's fetch() of its own workers.dev address runs the Worker script
// again instead of the static-asset layer, so it would see the Worker's
// fallback 404 for every page. The deployed files are read through the
// ASSETS binding instead: exactly what a visitor is served. Elsewhere
// (Vercel, development) the site is fetched as before.
import { inWorkersRuntime } from "./target";
import { cloudflareEnv } from "./requestScope";

type Fetch = (input: URL | string, init?: RequestInit) => Promise<Response>;

export async function siteFetcher(): Promise<Fetch> {
  if (inWorkersRuntime()) {
    const assets = (await cloudflareEnv()).ASSETS as { fetch(request: Request): Promise<Response> } | undefined;
    if (assets) return (input, init) => assets.fetch(new Request(input, init));
  }
  return (input, init) => fetch(input, init);
}
