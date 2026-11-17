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

## Production release (17 November 2026) — live

**Served revision:** `e5e8baaf62bad25f6f9e7f4ada0d631ad8e55534` (merge of PR #5), built
`2026-11-17T17:18:02.977Z`. This record is a later documentation-only commit;
it changes nothing that is served.

| Step | Record | Result |
|---|---|---|
| Preview of the final candidate | Cloudflare deploy, `environment=preview`, [44105427580](https://github.com/RanjithKumar427/fresh-petals/actions/runs/44105427580) (and a repeat, [44111542100](https://github.com/RanjithKumar427/fresh-petals/actions/runs/44111542100)) | Built and deployed `e5e8baa` to the preview Worker (noindex, workers.dev only); 19/20 checks. The one failure is an obsolete assertion (below). Reviewed and approved by the owner |
| Production deploy | Cloudflare deploy, `main`, `environment=production`, started by the owner: [44135118621](https://github.com/RanjithKumar427/fresh-petals/actions/runs/44135118621) | Production job **success** (preview job skipped). Checkout `e5e8baa`; security + Cloudflare tests 52/52; build OK, 470 static pages, `noindex=false`, `FP_DEPLOY_ENV` unset, content fingerprint `93949deec4e4` (unchanged: a code-only release); 493 new assets uploaded; Worker version `ddeb6b4e-0344-44f1-9266-8a4632b3c985` |
| Previous production (recovery point) | revision `598502070b83…`, built 2026-11-16T14:46:10.891Z | Worker version `378eb653-85a1-4817-b4f4-5f5b329ba8e7` |

**Obsolete preview assertion.** `scripts/cloudflare/preview-pipeline.mjs` expects
`/categories/bouquets?occasion=birthday` → server 301 with a fragment. Since the
pages became static files, the documented behaviour (`docs/cloudflare-migration.md`,
"Query-string behaviour moved to the browser") is a static 200 whose page script
moves the address to `#occasion=birthday`; production returned the same 200 before
this release. Verified on the preview: the address becomes
`/categories/bouquets#occasion=birthday` with the canonical
`https://onlyfreshpetals.in/categories/bouquets`. The preview pipeline is not a
production gate; the assertion is left unchanged and still fails until corrected to
check the browser-side behaviour.

### Live checks (onlyfreshpetals.in, after the deploy)

- `/_publish/state.json`: revision `e5e8baa…`, builtAt `2026-11-17T17:18:02.977Z`
  (the build log's 17:18:02). The homepage HTML carries `data-petal-hero`; its CSS
  holds the short-screen headline rule (`7.4svh`) and the dark garland backing
  (`#26362f`); the scene chunk (`petal-scene.*.js`) loads after `load`.
- Metadata: title and description unchanged; canonical `https://onlyfreshpetals.in/`;
  `og:image` `/images/og-home.jpg`; JSON-LD Organization + WebSite only; no
  `x-robots-tag`, meta robots `max-image-preview:large`, robots.txt has no
  site-wide disallow and lists the sitemap; no `workers.dev` or preview address in
  the homepage, category or product HTML.
- Hero: headline, the three range links (`/categories/bouquets`, `/garlands`,
  `/pooja-flowers`; 47 / 153 designs, 4 choices), all in the first view at 390×844,
  768×1024, 1440×900 and 1366×768; no horizontal overflow at any width; range links
  ≥ 77 px tall on desktop.
- Scene (Chrome, desktop, hardware WebGL): petals fade in after load; Tab to a range
  link raises its petal with a visible focus outline; hovering a petal highlights its
  range; clicking the bouquets petal opened `/categories/bouquets`.
- Reduced motion (simulated in a same-origin frame): still WebGL frame, no
  animation frames while idle, emphasis still follows the range links. No WebGL
  (simulated): the three photographs show as static petals and the centre petal is
  the garlands target.
- Chapters: 4 bouquet, 6 garland (FP-G001, G034, G106, G035, G086, G085) and 4 pooja
  photographs all answer 200; all 35 internal homepage links answer 200.
- Header: recipient-city notice ("Delivering to Coimbatore · Change city"), search
  and basket at every width, the phone menu opens and closes; Add to basket raised
  the count to 1 (the test item was removed afterwards).
- WhatsApp drafts read, not sent: homepage pooja enquiry, the help-me-choose draft
  and the footer question; product pages (bouquet, garland, pooja) still carry their
  drafts. No draft contains an amount.
- Category and product pages (`/categories/garlands`, `/categories/pooja-flowers`,
  `/products/red-affair`, `/products/classic-red-rose-garland`,
  `/products/daily-pooja-flowers`): 200, indexable, with their WhatsApp links.
- Loading (desktop Chrome, warm cache, one run): FCP 172 ms, LCP 188 ms (the bouquet
  petal image), CLS 0, one 52 ms task. Phone width (390 px frame, 3 runs): CLS 0,
  at most one 51 ms task; LCP is not reported inside frames. The throttled
  before/after comparison from the local build (above) remains the mobile
  performance evidence.

### Limitations

- No Safari, Firefox or physical-phone testing; phone and tablet widths were checked
  in same-origin frames on desktop Chrome, and reduced motion / no WebGL were
  simulated in script (the CSS `prefers-reduced-motion` rule was verified locally
  with real emulation).
- While the WebGL petals fade in (≈ 0.7 s, once, a few seconds after load) the HTML
  and WebGL silhouettes do not coincide exactly, so the hand-over can look doubled
  for that moment.
- The obsolete preview assertion above still fails until it is updated.

## Hand-over correction and preview validation (17–18 November 2026, branch `fix/petal-handover`)

Not released. Production remains `e5e8baa` (built 2026-11-17T17:18:02.977Z).

### Static → WebGL hand-over

**Defect.** While the scene took over, two sets of petals showed for about
0.2–0.3 s (recorded at 886–1100 ms after navigation, 1440 px).

**Cause.** Two independent problems compounded:
1. *Different geometry.* The static petals are laid out by CSS (`--h:
   min(92cqh, 63cqw)`, flat, base on the stage's bottom edge). The WebGL petals
   were drawn from their first frame in the final pose: a camera fitted to the
   canvas, which is 116 % × 110 % of the stage, and petals cupped, curled,
   leaning and pushed forward. Their silhouettes differed by 38.5 % of the
   petal area (pixel comparison of the two layers).
2. *Simultaneous fades.* The static petals faded out (0.6 s) while the canvas
   faded in (0.7 s), so for most of that time neither layer was opaque.

The readiness callback was not at fault: `onReady` already fired after the
first textured frame.

**Correction** (`src/scripts/petal-scene.ts`, `src/components/home/PetalHero.astro`):
- *Matched first frame.* Until it is revealed, the scene draws the petals flat
  (shape scaled to 0, no lean or push, fold and pointer tilt off). It uses a
  camera looking straight at the petal plane, computed by `handoverCamera`
  from the static centre petal's measured height and base. Each petal also
  takes the static petal's current CSS scale, mid-transition included, so an
  early hover or focus cannot separate the layers. The photo placement is
  already shared (`petalPhotoBox`).
- *Ordered layers.* The canvas fades in (0.35 s) over static petals that stay
  fully opaque. On its `transitionend` the stage gets `is-3d-settled`: the
  static petals fade out (0.3 s, removing only their shadow) and the scene's
  `reveal()` unfolds the petals into the unchanged final pose. The unfold is a
  finite, on-demand animation of about one second.
- *Fallbacks.*
  - Context loss, before or after the hand-over, removes both classes and the
    static petals are back at once.
  - With reduced motion the scene is not started: unfolding would itself be
    motion, and the static petals are the complete experience.
  - JavaScript-disabled and no-WebGL behaviour is unchanged.
- The settled 3D pose is unchanged from the release: mean pixel difference
  0.16/255 at 1440 px.

**Evidence** (local fixture build; CDP screencast frames through the hand-over):

| Measure | Before (`e5e8baa`) | After |
|---|---|---|
| Static vs first opaque WebGL frame, silhouette difference | 38.5 % | 0.76 % (1440 px screencast); 0.34 % at 1440 px and 0.81 % at 390 px on a magenta key (edge anti-aliasing) |
| Frames with both layers partly transparent | 29 of 68 | 0 of 38–45 |
| Frames with the static petals fading before the canvas is opaque | 34 | 0 |

Also checked, each with no doubled frame:
- hover on a range link before and during the hand-over (garlands, pooja,
  bouquets);
- a viewport resize mid-hand-over;
- context loss before and after the hand-over;
- 390 px.

Petal destinations, keyboard focus and range emphasis are unchanged.

### Preview validation contract

`scripts/cloudflare/preview-pipeline.mjs` expected
`/categories/bouquets?occasion=birthday` → 301 to a fragment. That has been
obsolete since storefront pages became static files: the documented behaviour
is a static 200 whose script moves the address to `#occasion=birthday`.
- **HTTP check, corrected.** Status 200 with noindex, no `Location`, canonical
  `https://onlyfreshpetals.in/categories/bouquets`, and the Birthday filter
  present. The load phase is renamed "filter-query variants (static 200)".
  `/studio` (301) and `/faqs/` (redirect) are unchanged.
- **Browser checks, new** (`scripts/cloudflare/preview-browser.mjs`, Chrome
  driven by playwright-core):
  - The address becomes `/categories/bouquets#occasion=birthday`; Birthday is
    the only active chip; only birthday designs are shown and the count says
    so; the canonical is clean.
  - Clearing Birthday shows every design; choosing a colour then filters to
    that colour (`#colour=…`).
  - Homepage: the scene replaces the static petals with no doubled or
    uncovered frame; the first WebGL frame matches the static silhouettes
    within 3 % at 1440 and 390 px; three range links; the centre petal opens
    wedding garlands; no script errors.
  - A missing browser or an unstarted scene is a failure, never a skip.
- **Workflow.** The preview job installs playwright-core for itself
  (`npm install --no-save`). The production job and the publishing triggers
  are unchanged.
- **Tests.** `scripts/audit/homepage.test.mjs` adds:
  - a projection test: every petal's base, tip and widest points from the
    hand-over camera land within 0.75 px of the CSS layout, at four stage
    sizes;
  - a contract test: no 301 is expected for `?occasion=`, the genuine
    redirects keep theirs, and a missing browser reports "NOT executed".

### Candidate preview

| | |
|---|---|
| Revision | `a3376f6d72bbecfaac7c7f246d974f81dde37c04` (this record is a later docs-only commit on the branch) |
| Run | [44151977673](https://github.com/RanjithKumar427/fresh-petals/actions/runs/44151977673): preview job **success**, production job skipped; **36/36 checks passed** including all 16 browser checks; Worker version `0b3ad665-6985-47d3-81a4-cefd5e5981c7` |
| Earlier run | [44149556815](https://github.com/RanjithKumar427/fresh-petals/actions/runs/44149556815) at `594721a`: deployed, 20/21. The browser checks reported "NOT executed" (playwright-core's CommonJS entry exposes `chromium` only on `default`), fixed in `a3376f6` |
| Isolation | Worker `fresh-petals-preview`, workers.dev only, no routes, `FP_DEPLOY_ENV=preview`, noindex; admin, admin API and enquiry log refused (403) |
| Not exercised | "Stored photo resized by Images binding": no uploaded garland photo is public (unchanged; reported ok but not exercised) |

**Local checks** (fixture build of the candidate):
- `node --test` homepage 9/9, security 30/30, cloudflare 22/22,
  catalogue 26/26, regression 46/46; `astro check` clean apart from the fixture
  copy's TLS stub.
- At 390×844, 768×1024, 1440×900, 1366×768 and 1280×720: no horizontal
  overflow, no overlapping controls, range links inside the first view, a
  visible focus outline that emphasises its petal.
- Reduced motion: static petals, no scene download, focus emphasis works. No
  WebGL: static petals, tap opens the range. No JavaScript: headline, links and
  photographs.

**Performance, before vs after** (same fixture catalogue, server, cold cache;
three runs each, interleaved):

| Run type | Before | After |
|---|---|---|
| Lighthouse mobile (simulated); FCP | 2.93–2.94 s | 2.86–2.93 s |
| Lighthouse mobile; LCP | 4.58–4.59 s | 4.58 s |
| Lighthouse mobile; TBT / CLS / weight | 0 / 0.003 / 669 KB | 0 / 0.003 / 670 KB |
| Applied throttling, top-level 390 px (4× CPU, 1.6 Mbps, 150 ms), scene running; LCP | 2.54–2.56 s | 2.39–2.56 s |
| Applied throttling; long tasks (sum over 50 ms) | 28–52 ms | 24–52 ms |
| Applied throttling; CLS / transferred | 0.003 / 485 KB | 0.003 / 487 KB |

Lighthouse ran Chrome on a 2-core container, where the page deliberately keeps
the static petals, so those runs do not include the scene. The throttled runs
emulate 8 cores so the scene runs. Both use software WebGL (SwiftShader); no
physical phone or Safari.

### Limitations

- The preview could not be opened from a real-GPU desktop browser for this
  pass (the browser extension was offline). The served preview was checked by
  the run's own browser checks (Chrome with SwiftShader, 1440 and 390 px);
  768 px, short-laptop and screenshot checks used the local build of the same
  revision.
- The local build has stand-in garland photographs. The candidate changes no
  catalogue or chapter code; the real photographs were last verified on
  production `e5e8baa`.
- Under reduced motion the homepage now shows the static petals instead of a
  still WebGL frame.
