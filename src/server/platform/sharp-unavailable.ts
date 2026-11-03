// Stand-in for `sharp` in Cloudflare builds (aliased in astro.config.mjs):
// the native module cannot load in the Workers runtime. Upload sanitising
// uses the Images binding there (src/server/media/imageSafetyCloudflare.ts),
// so this is never called; if it were, it fails loudly instead of skipping checks.
export default function sharp(): never {
  throw new Error("sharp is not available on Cloudflare Workers");
}
