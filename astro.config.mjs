import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  // The storefront stays fully static (output defaults to 'static' and every
  // page keeps prerendering). Only admin/API/media routes opt into on-demand
  // rendering via `export const prerender = false`, which is what actually
  // needs this adapter. Standalone mode keeps deployment hosting-agnostic
  // (any Node host/VPS/Docker) rather than tying the app to one platform.
  adapter: node({ mode: 'standalone' }),

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});