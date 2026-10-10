# Homepage occasion carousel

Replaces the homepage `OccasionDeck` (collections deck) with an occasion
carousel in the same position (`src/pages/index.astro`, after the bouquet edit).

## Where things live

- `src/data/launchCatalogue.ts` — `OCCASION_CAROUSEL` (label, route, optional
  featured photo, in the owner's order) and `occasionCarousel()`.
- `src/data/atelierHome.ts` — `getOccasionCarousel()`: card title, link, count
  and photograph (each card uses a photograph of one of its own bouquets; no
  photograph repeats while an unused one exists).
- `src/components/atelier/OccasionCarousel.astro` — markup, script, styles.

## Rules

- **Eligibility and count**: `launchProductsForOccasion(route)` — the launch
  range (ready categories, every product priced from the database through
  `ProductPricing`) genuinely tagged for the route. This is the same list and
  count the launch occasion pages show as "N options". An occasion with no
  eligible bouquets is left out; occasions are never repeated or padded.
- **Order**: Birthday, Anniversary, Wedding, Engagement, Housewarming & Pooja
  (`/occasions/housewarming`), Condolence (`/occasions/sympathy`).
- **Dataset sizes**: 0 — no section; 1 — one linked card; 2 — a balanced
  static pair; 3+ — the carousel. Today's catalogue gives Birthday (8) and
  Anniversary (5), so production currently shows the pair.
- **Refresh**: the homepage is prerendered, as before. Counts and visibility
  change with the next build, exactly as the menus and occasion pages do. The
  admin garland cache refresh (`GarlandWebsite.ts`) is unchanged; garlands are
  loaded live on the occasion pages and are not counted here.

## Behaviour (3+ occasions)

- One continuous position value drives every card, so looping is seamless
  without duplicate cards. Cards fade out before they wrap sides.
- 800ms transitions; autoplay every 4.5s.
- Previous/next, a position indicator (dots and "01 / 06"), and pause/play.
- Swipe, mouse drag and arrow keys. A drag never follows a link. A plain
  click on a visible card opens that card's occasion page.
- Autoplay pauses on mouse hover, keyboard focus, a pressed pointer, a hidden
  tab and an off-screen section, and resumes when that ends. Pause stays
  paused until Play.
- Desktop (1024px and up): centre 100%, neighbours 80%, outer cards 65%, with
  dimming. Below 1024px: centre card and neighbours; on phones the neighbours
  only peek and show no caption.
- Accessibility: there is one keyboard stop for the cards (the centre one)
  plus three buttons. Hidden cards are `inert`. Focus is visible. User moves
  are announced through a polite live region. Reduced motion, no JavaScript,
  and 1–2 occasions all show the server-rendered static layout with no
  autoplay.

## Known limitation

`/occasions/sympathy` is not a launch-restricted page. It also lists tagged
non-launch items and a fallback add-on, so if a launch bouquet is ever tagged
`sympathy`, the Condolence card shows the bouquet count ("1 design") while
that page shows more options ("2 options"). This case is hidden today
(0 eligible bouquets). Making it exact means either restricting
`/occasions/sympathy` to the launch range or counting what that page lists.
That is the owner's decision.

## Verification (10 Oct 2026)

These checks ran locally on a disposable PostgreSQL database built from
`drizzle/` with catalogue-priced fixture rows. Production was not used. The
dataset sizes 0, 1, 2, 3, 4 and 6 were built by changing occasion tags in
memory at build time.

- Viewports 375, 390, 768, 1024 and 1440: 670 browser checks passed. These
  covered links and counts, order, scales, overflow, looping, transition
  timing, autoplay timing, the pause conditions, keyboard use, swipe and drag,
  clicks, reduced motion and no-JS.
- The only failure was the Condolence count case above.
- `astro check` reports the existing 20 errors in `DiscoveryPostCard`,
  `MobileBottomBar` and `SubscriptionConfigurator`. There are no new errors.
- Not verified: real iOS/Android devices or a Safari/WebKit engine (only
  Chromium was used), and a build against the production database.
