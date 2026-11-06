// One database read per build for data every prerendered page shares.
//
// The storefront is prerendered (static files served without running the
// Worker), so a build renders a few hundred pages that each ask for the same
// garlands, occasion assignments and occasions. Without this, every page would
// re-read them: about 50 MB of database results per build. While `astro build`
// runs (astro.config sets FP_ASTRO_COMMAND), the first read is shared by every
// page of that build. Everywhere else (the Worker's admin and API requests,
// development) each call reads fresh, as before.
const memo = new Map<string, Promise<unknown>>();

export const building = (): boolean => typeof process !== "undefined" && process.env?.FP_ASTRO_COMMAND === "build";

export function buildMemo<T>(key: string, read: () => Promise<T>): Promise<T> {
  if (!building()) return read();
  let hit = memo.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = read();
    // A failed read is not kept: the build fails on it, or a later page retries.
    hit.catch(() => memo.delete(key));
    memo.set(key, hit);
  }
  return hit;
}
