import type { APIRoute } from "astro";
import { contentFingerprint } from "../../../server/services/Publishing";

export const prerender = false;

// The live database's content fingerprint, for the scheduled publishing check
// (src/server/services/Publishing.ts), compared with /_publish/state.json of
// the deployed build. Only a hash of public catalogue data; nothing else.
export const GET: APIRoute = async () => {
  try {
    const fingerprint = await contentFingerprint();
    return new Response(JSON.stringify({ fingerprint }), { headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" } });
  } catch {
    return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
};
