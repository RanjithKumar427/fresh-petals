# Homepage: one flower, three petals — 17 November 2026

Fresh Petals sells three things, and customers choose between them first:
bouquets, wedding garlands and pooja flowers. The homepage is built around that
choice.

## Concept

**Three petals, one flower.** The opening scene is a single flower whose three
petals each hold a photograph of one range: bouquets (left), wedding garlands
(centre), pooja flowers (right). The brand name is the idea; the petals are the
three ways in.

- Pointing at or focusing a range link turns its petal towards the visitor and
  lets the other two fall back (and desaturate slightly). Pointing at a petal
  highlights its range link, and a click opens the range.
- Scrolling past the hero folds the petals together, connecting the opening to
  the range chapters below.
- The photographs stay upright inside each petal: the petal turns, the flowers
  do not.
- No idle animation, no intro sequence, no custom cursor, no sound. The scene
  redraws only while something moves.

The petals are framing, not products: the campaign photographs carry no product
name, price, size or inclusion.

## Page sequence

1. **PetalHero** (`src/components/home/PetalHero.astro`): headline, how ordering
   works in one sentence, the three range links (with counts from this build's
   catalogue), secondary links (search by name or garland code, occasions,
   custom orders), and the scene.
2. **01 Bouquets** (`RangeBouquets.astro`): four featured designs from
   `launchCatalogue.ts`, "Price on WhatsApp", the existing basket button, flower
   groups and "View all N bouquets".
3. **02 Wedding garlands** (`RangeGarlands.astro`): the garland guide's six pilot
   designs (topped up with other public designs), each with its code and name,
   hanging from one thread; the three enquiry steps; populated flower collections
   and the guide.
4. **03 Pooja flowers** (`RangePooja.astro`): the collection page's own sections
   by form — loose, boxes, strings and torans, regular deliveries (recurring
   plans), bulk and ceremony — with each product's own price wording, and the
   pooja WhatsApp draft.
5. Occasion carousel (admin assignments, unchanged).
6. **How ordering works** (`HowOrdering.astro`): four steps for all three ranges,
   with delivery coverage and policy links beside them.
7. Questions (unchanged) and the closing invitation (copy broadened to gifts,
   weddings and pooja).

Removed from the homepage: the campaign carousel (`HeroAtelier.astro`), the
bouquet-only edit and ordering components and the bouquet close-up section
(`InsideBouquet.astro`); their facts remain on product and policy pages.

## Rendering

- **First paint**: the three photographs are ordinary `<picture>` elements (AVIF/
  WebP, 360/540/705 px, preloaded) masked to the petal outline with CSS. This is
  also the complete fallback: no JavaScript, reduced motion, WebGL unavailable,
  data saver, 2G, ≤ 2 GB memory or ≤ 2 cores.
- **Signature scene** (`src/scripts/petal-scene.ts`, ~4.5 KB gzipped, loaded on
  idle after `load`): plain WebGL, one shader, one shared petal mesh, three
  textures taken from the already loaded `<img>` elements (no extra download),
  set up across frames. Lit, cupped and curled petals; picking on the CPU.
  Pixel ratio capped (2, or 1.25 on phones and ≤ 4-core devices); renders only
  while moving; pauses off-screen and in hidden tabs; frees its resources on
  context loss and falls back to the static petals.
- The outline, spread and photo placement are shared
  (`src/shared/petalShape.ts`), so the hand-over from HTML to WebGL keeps the
  silhouette.
- Reduced motion: no tweening, folding, pointer tilt or CSS transitions; one
  still frame.

## Accessibility and SEO

- The stage is `aria-hidden`; every link and all text are HTML outside it. The
  petal images keep descriptive `alt` text for image search.
- Title, description and canonical are unchanged (`HOME_LANDING`); the social
  image is now `/images/og-home.jpg`, a 1200×630 crop of the three range
  photographs. Structured data is still Organization + WebSite only.
- Homepage header on phones: search now sits beside the basket (saved flowers
  remain in the menu).
- The occasion carousel's slides are `div role="group"` in carousel mode (a list
  item may not take that role); without the carousel they stay a list.
- The text font (Jost) is preloaded on the homepage with the display serif, so
  the copy above the petals does not re-wrap and move them.

## Checks before release (local fixture build, 17 Nov 2026)

- `node --test` on every `scripts/audit/*.test.mjs` (including the new
  `homepage.test.mjs`) and the garland importer suites: all pass;
  `scripts/audit/business.mjs` passes; `astro check` reports only the fixture
  copy's TLS stub.
- Browser checks at 390, 768 and 1440 px: no horizontal overflow; headline and
  all three range links inside the first viewport; links ≥ 44 px; WebGL active;
  keyboard focus emphasises the matching petal with a visible outline; pointer
  picking and click-through; basket count; WhatsApp drafts unsent and without
  amounts; reduced motion (still frame); WebGL disabled (static petals, tap
  opens the range); JavaScript disabled (headline, links, photographs).
- Lighthouse mobile (simulated, 3 runs, same server): accessibility 0.95 → 1.00,
  SEO 1.00, best practices 1.00; page weight 863 → 670 KB; CLS 0.02 → 0.01;
  LCP/FCP within ~0.1 s of the previous homepage.
- Applied throttling (4× CPU, 1.6 Mbps, 150 ms; 3 runs each, scene enabled):
  CLS 0.067 → 0.003; LCP 2.43–2.61 s → 2.48–2.64 s; transferred 645 → 485 KB;
  scene set-up adds tasks of at most ~100 ms under software rendering.

The fixture has no garland photographs, so the garland chapter was checked with
stand-in images locally and with the real designs on the preview Worker before
release.
