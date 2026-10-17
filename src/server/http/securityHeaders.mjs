// Browser protections shared by the build (astro.config.mjs adds them to
// every response through the Vercel routing config) and src/middleware.ts
// (on-demand responses, including local `astro preview`). Plain .mjs so the
// config file can import it without a TypeScript step.
//
// None of these is a Content-Security-Policy: Astro writes that per page,
// with the hashes of that page's scripts (astro.config.mjs `security.csp`).
// A blanket CSP here would either duplicate it or, worse, be enforced
// alongside it and block the hashed scripts.

/** Headers every response carries. Existing HSTS comes from Vercel's own domain handling and is left alone. */
export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  // Only this site receives the referring path; WhatsApp, Google's tag and
  // image hosts get none. (Analytics sends its own origin-only referrer.)
  'referrer-policy': 'same-origin',
  // The storefront uses none of these. clipboard-write keeps its default
  // (same origin) for the admin's "copy URL" button.
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()',
  'cross-origin-opener-policy': 'same-origin-allow-popups',
};

const SUPABASE_STORAGE = 'https://hjhmetomcaskrrwkgrbp.supabase.co';

/**
 * CSP directives besides script-src / style-src, which Astro builds from
 * hashes (astro.config.mjs). Google's tag needs its documented hosts for
 * images and beacons; product photographs come from this site, Vercel's
 * image optimiser (same origin) or the Supabase public media bucket.
 */
export const CSP_DIRECTIVES = [
  "default-src 'self'",
  `img-src 'self' data: blob: ${SUPABASE_STORAGE} https://*.google-analytics.com https://*.googletagmanager.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  `media-src 'self' ${SUPABASE_STORAGE}`,
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
];
