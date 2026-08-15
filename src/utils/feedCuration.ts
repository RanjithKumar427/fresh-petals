import { productCatalog } from "../data/productCatalog";

interface CurationCandidate {
  slug: string;
  category: string;
  image: string;
}

/**
 * Discovery Architecture Hardening (Phase 5), Workstream A milestone —
 * deterministically reorders a slug list to maximize category and image
 * diversity near each card, without ever fabricating variety the data
 * doesn't have.
 *
 * Replaces the naive `interleave()` used in index.astro before this: that
 * function round-robined across nine hand-picked groups by POSITION
 * (index 0 of every group, then index 1, ...), which worked while every
 * group had similar length but meant the two large pools (16-item
 * DiscoveryFeed pool, 8-item ProductSection pool) only ran out of
 * position-mates once the six 4-item groups were exhausted -- measured
 * live in the Phase 5 audit as 16 consecutive Bouquets/Lilies cards in
 * the last third of the feed, and the first two cards (cloud-nine-blue,
 * blue-mountain-grace) landing adjacent as near-duplicate blue-and-white
 * bouquets since both happened to sit at position 0 of two different
 * groups.
 *
 * Algorithm: a stable greedy scheduler, the same family as the classic
 * "Reorganize String" / CPU "Task Scheduler" problem. Group candidates by
 * their real product `category` (not by which of the nine legacy groups
 * they came from -- e.g. the old 16-item "DiscoveryFeed" group actually
 * mixes two real categories, Bouquets and Lilies, and bucketing by the
 * real field lets them separate correctly). At each step, emit the next
 * card from whichever remaining category bucket currently has the MOST
 * items left, skipping a bucket only if picking from it would repeat the
 * immediately preceding card's category -- and only when a genuinely
 * different bucket is still available. "Most items left" is exactly what
 * spreads a large category across the WHOLE output instead of exhausting
 * small categories first and dumping the large one at the tail -- it
 * directly targets the measured defect above.
 *
 * Within the chosen bucket, prefer whichever candidate doesn't repeat the
 * immediately preceding card's image (several products across different
 * categories share a stock photo -- e.g. cat-pooja.jpg is reused by four
 * products) -- again, only when an alternative exists in that bucket.
 *
 * Content reality always wins: if every remaining candidate would repeat
 * the previous category or image, the repeat is emitted rather than
 * dropped -- this function reorders real products, it never invents,
 * duplicates, or removes one to force artificial diversity.
 *
 * Fully deterministic: no Math.random(), no Date.now(), no client state,
 * no personalization. The same input slug list always produces the same
 * output order, on every request, on every render.
 */
export function curateDiscoveryOrder(slugs: string[]): string[] {
  const candidates: CurationCandidate[] = slugs
    .map((slug) => {
      const product = productCatalog.find((item) => item.slug === slug);
      return product ? { slug, category: product.category, image: product.image } : null;
    })
    .filter((candidate): candidate is CurationCandidate => candidate !== null);

  // Group by category, preserving each bucket's original relative order
  // as a stable tiebreaker -- this function reorders BETWEEN categories,
  // it does not reshuffle the existing hand-picked order within one.
  const buckets = new Map<string, CurationCandidate[]>();
  for (const candidate of candidates) {
    const bucket = buckets.get(candidate.category) ?? [];
    bucket.push(candidate);
    buckets.set(candidate.category, bucket);
  }

  // Stable category order (first-seen in the input), so ties in
  // remaining-bucket-size resolve deterministically rather than by
  // Map/object iteration-order quirks.
  const categoryOrder = [...buckets.keys()];

  const result: CurationCandidate[] = [];
  let lastCategory: string | null = null;
  let lastImage: string | null = null;

  while (result.length < candidates.length) {
    const nonEmpty = categoryOrder.filter((category) => (buckets.get(category)?.length ?? 0) > 0);
    const eligible = nonEmpty.filter((category) => category !== lastCategory);
    const pool = eligible.length > 0 ? eligible : nonEmpty;

    pool.sort((a, b) => {
      const sizeDiff = (buckets.get(b)?.length ?? 0) - (buckets.get(a)?.length ?? 0);
      if (sizeDiff !== 0) return sizeDiff;
      return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
    });

    const chosenCategory = pool[0];
    const bucket = buckets.get(chosenCategory)!;

    let pickIndex = bucket.findIndex((candidate) => candidate.image !== lastImage);
    if (pickIndex === -1) pickIndex = 0;

    const [picked] = bucket.splice(pickIndex, 1);
    result.push(picked);
    lastCategory = picked.category;
    lastImage = picked.image;
  }

  return result.map((candidate) => candidate.slug);
}
