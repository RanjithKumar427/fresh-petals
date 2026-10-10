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

- **Eligibility and count**: `occasionBouquets(route)` in `launchCatalogue.ts`
  is the one list behind both a card (count and photo) and the occasion page
  it opens, so the card's "N designs" always equals the page's "N options".
  Launch occasions use the launch range (`launchProductsForOccasion`).
  Condolence (`sympathy`, not a launch occasion) keeps its existing public
  bouquets: catalogue Bouquets/Lilies tagged `sympathy`, with no add-ons or
  fallbacks. Every product is priced from the database through
  `ProductPricing`. An occasion with no eligible bouquets is left out;
  occasions are never repeated or padded.
- **Order**: Birthday, Anniversary, Wedding, Engagement, Housewarming & Pooja
  (`/occasions/housewarming`), Condolence (`/occasions/sympathy`).
- **Dataset sizes**: 0 — no section; 1 — one linked card; 2 — a balanced
  static pair; 3+ — the carousel. Today's catalogue gives Birthday (8),
  Anniversary (5) and Condolence (7), so production shows the carousel.
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

## Occasion source and Condolence

- Source of truth: `launchCatalogue.ts` + catalogue `occasionTags`, as for
  the menus and occasion pages. `LAUNCH_CATEGORIES` and
  `LAUNCH_OCCASION_ROUTES` are unchanged.
- `/occasions/sympathy` keeps the same 7 white/lily bouquets as before; only
  the premium card add-on (a fallback) is no longer listed. It stays indexed
  and in the sitemap.
- `OccasionMembership.ts` / `OccasionWebsite.ts` (admin-driven occasions) are
  not on this branch, `main` or any pushed branch. When that work lands, it
  should replace `occasionCarousel()`'s source rather than run beside it.

## Previewing all six occasions

```sh
npm run preview:occasions   # astro dev with an in-memory six-occasion fixture
```

Open http://localhost:4321/. Tags are rewritten in memory only: no database
write, no file change, and `astro build` with this config is refused. Prices
are read (read-only) from `DATABASE_URL`; `FP_LOCAL_PG=1` uses a plain local
Postgres instead. `FP_OCCASION_FIXTURE="route=slug,slug;route="` sets another
assignment (e.g. `"birthday=;anniversary="` for the empty state).

## Verification (10 Oct 2026)

These checks ran locally on a disposable PostgreSQL database built from
`drizzle/` with catalogue-priced fixture rows. Production was not used. The
dataset sizes 0, 1, 2, 3, 4 and 6 were built by changing occasion tags in
memory at build time.

- Viewports 375, 390, 768, 1024 and 1440: 670 browser checks passed. These
  covered links and counts, order, scales, overflow, looping, transition
  timing, autoplay timing, the pause conditions, keyboard use, swipe and drag,
  clicks, reduced motion and no-JS.
- Follow-up (same day, shared `occasionBouquets` list): 671 browser checks
  passed with 0 failures, rebuilt for 0, 1, 2, 3 (today's real data:
  Birthday, Anniversary, Condolence), 4 and 6 occasions. Focused checks:
  every card count equals its page for the fixture and real data;
  `/occasions/sympathy` keeps its 7 bouquets without the add-on; Alt, Ctrl,
  Meta and Shift with an arrow key are ignored at 390 and 1440px. Every other
  occasion page lists the same products as before.
- `astro check` reports the existing 20 errors in `DiscoveryPostCard`,
  `MobileBottomBar` and `SubscriptionConfigurator`. There are no new errors.
- Not verified: real iOS/Android devices or a Safari/WebKit engine (only
  Chromium was used), and a build against the production database.
