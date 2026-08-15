import { productCatalog } from "../data/productCatalog";
import imageDimensionsData from "../data/imageDimensions.json";

const imageDimensions = imageDimensionsData as Record<string, { width: number; height: number }>;

type ImageShape = "portrait" | "square" | "landscape";

/**
 * Phase 1 (Discovery System Hardening), P1.1 -- coarse aspect-ratio
 * bucketing, not exact ratio matching. The audit's root-cause finding:
 * this module already had an image-*identity* tiebreaker (line ~96 below)
 * but no image-*shape* awareness, so two different photographs that
 * happen to both be square (47 of 71 catalog images are) satisfied the
 * existing tiebreaker perfectly while still producing back-to-back
 * pixel-identical card heights. A product missing from imageDimensions.json
 * is treated as "square" (neutral) rather than excluded -- this function
 * must never let a data gap remove a product from consideration.
 */
function imageShape(image: string): ImageShape {
  const dimensions = imageDimensions[image];
  if (!dimensions) return "square";
  const ratio = dimensions.width / dimensions.height;
  if (ratio > 1.15) return "landscape";
  if (ratio < 0.87) return "portrait";
  return "square";
}

interface CurationCandidate {
  slug: string;
  category: string;
  image: string;
  shape: ImageShape;
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
 * Phase 1 (Discovery System Hardening), P1.1 addendum -- that image
 * tiebreaker alone still let two *different* photographs with the same
 * shape land back to back, and 47 of 71 catalog images are square, which
 * measurably produced long runs of pixel-identical card heights (Bouquets
 * and Lilies, the two largest buckets, are both ~100% square). The pick
 * now also prefers a candidate whose image aspect-ratio bucket (portrait/
 * square/landscape, see imageShape() above) differs from the previous
 * card's, falling back to the plain image-difference check, then to the
 * first remaining item, exactly as before. Bucket *selection* above -- the
 * part that spreads categories across the feed -- is untouched, so this
 * can only reorder shapes that already coexist inside one category.
 *
 * Measured, honest limit: as of this catalog, 16 of 18 categories are
 * internally shape-homogeneous (every image in the category is the same
 * portrait/square/landscape bucket) -- Bouquets and Lilies, the two
 * largest, are both 100% square. Verified by simulation against the real
 * catalog that this tiebreaker is therefore currently a no-op on the
 * homepage and occasion feeds: there is nothing of a different shape to
 * prefer within the category the scheduler is already forced to pick from.
 * It is not dead code -- it activates the moment any category's own
 * photography becomes shape-mixed -- but today's ceiling is photography,
 * not this function. Do not "fix" that by overriding bucket selection
 * above; that reintroduces the 16-consecutive-category-run defect this
 * module exists to prevent.
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
      return product
        ? { slug, category: product.category, image: product.image, shape: imageShape(product.image) }
        : null;
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
  let lastShape: ImageShape | null = null;

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

    // P1.1 -- strictly a within-bucket pick refinement; which category
    // bucket gets chosen (above) is completely untouched. Three-tier
    // fallback, each only used if the previous one finds nothing:
    //   1. different image AND different shape than the previous card
    //      (the actual fix -- stops two different square photos landing
    //      back to back)
    //   2. different image only (the original Phase 5 tiebreaker)
    //   3. first remaining item ("content reality wins" -- never dropped,
    //      never invented, just repeated when no alternative exists)
    let pickIndex = bucket.findIndex(
      (candidate) => candidate.image !== lastImage && candidate.shape !== lastShape
    );
    if (pickIndex === -1) {
      pickIndex = bucket.findIndex((candidate) => candidate.image !== lastImage);
    }
    if (pickIndex === -1) pickIndex = 0;

    const [picked] = bucket.splice(pickIndex, 1);
    result.push(picked);
    lastCategory = picked.category;
    lastImage = picked.image;
    lastShape = picked.shape;
  }

  return result.map((candidate) => candidate.slug);
}
