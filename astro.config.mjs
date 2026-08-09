import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
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