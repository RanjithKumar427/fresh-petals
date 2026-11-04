// Which host this build is for. astro.config.mjs replaces
// __FP_DEPLOY_TARGET__ at build time ("cloudflare" when DEPLOY_TARGET=cloudflare,
// otherwise "vercel"). Anything that isn't built by Vite (the audit
// source-loader) sees the identifier as undeclared and falls back to
// "vercel", so every existing behaviour and test keeps its Vercel meaning.
declare const __FP_DEPLOY_TARGET__: string | undefined;

export const DEPLOY_TARGET: "vercel" | "cloudflare" =
  typeof __FP_DEPLOY_TARGET__ === "string" && __FP_DEPLOY_TARGET__ === "cloudflare" ? "cloudflare" : "vercel";

export const ON_CLOUDFLARE = DEPLOY_TARGET === "cloudflare";

declare const __FP_BUILD_ENV__: string | undefined;

/** True only for a bundle built by `scripts/cloudflare/build.mjs staging`. */
export const STAGING_BUILD = typeof __FP_BUILD_ENV__ === "string" && __FP_BUILD_ENV__ === "staging";

/** True only inside the Cloudflare Workers runtime (not while prerendering in Node). */
export function inWorkersRuntime(): boolean {
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent === "Cloudflare-Workers";
}
