import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// The one place the production URL is configured — canonical tags,
// sitemap.xml and robots.txt's Sitemap: line all derive from this single
// value (via Astro.site) rather than each hardcoding their own guess.
// SITE_URL is NOT set anywhere yet: no custom domain has been configured
// on the Vercel project as of this milestone (confirmed by inspecting the
// project's Domains settings directly — only the auto-generated
// fresh-petals-brown.vercel.app exists). The fallback below is that real,
// currently-live URL, used only so canonical/sitemap output is valid today
// — it is explicitly NOT being declared the permanent business domain.
// The moment a real domain is chosen, set SITE_URL in Vercel's project
// environment variables; every URL in the site updates with zero code
// changes.
const SITE_URL = process.env.SITE_URL || 'https://fresh-petals-brown.vercel.app';

export default defineConfig({
  site: SITE_URL,

  // The storefront stays fully static (output defaults to 'static' and every
  // page keeps prerendering). Only admin/API/media routes opt into on-demand
  // rendering via `export const prerender = false`, which is what actually
  // needs this adapter — those routes deploy as Vercel serverless functions.
  //
  // `isr` is deliberately left at its default (false/unset): the installed
  // @astrojs/vercel@10.0.8 carries a high-severity advisory
  // (GHSA-x27w-589x-frm2, unauthenticated path override) that lives entirely
  // inside the ISR build path (`buildISRFolder`, gated by `if (isr)` —
  // verified by reading node_modules/@astrojs/vercel/dist/index.js). With
  // isr never enabled, that code never runs, so this build carries the
  // advisory on paper but not as a live attack surface. The real fix is an
  // Astro 7 upgrade (@astrojs/vercel's next major requires astro ^7.0.0),
  // which is a separate, deliberately out-of-scope decision for this
  // milestone — do not enable `isr` here without addressing that upgrade
  // first.
  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});