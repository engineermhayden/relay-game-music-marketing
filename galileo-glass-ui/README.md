# Galileo — The Glass Observatory

An advanced Hello World built with **real Galileo Glass UI source**, **Next.js 16**, **React 19**, **strict TypeScript**, and **PostgreSQL 17 + PostGIS 3.5**. A local Docker Compose stack runs the application, an idempotent migration job, and the database.

## Run it

With Docker Desktop running in Linux-container mode:

```sh
docker compose up --build -d
```

Open **http://localhost:3000**. The first build downloads images and npm dependencies. The app starts only after PostGIS is healthy and migrations finish. A completed `migrate` container with exit code 0 is expected.

```sh
docker compose ps -a
docker compose logs -f app
docker compose down
```

`down` retains greetings in the named `postgis-data` volume. `down -v` deletes the database permanently. No database port is exposed to the host; the application is bound to localhost. Defaults are intended for this local demo, which has no user authentication or public-write rate limiting.

Optional: copy `.env.example` to `.env` before first startup to change `APP_PORT` or the development database password. If changing an initialized database's password, also update its PostgreSQL role; changing the environment alone does not change an existing database role. URL-encode special characters if supplying a custom password through the connection URI.

## Explore

| Area | What to try |
| --- | --- |
| Overview | Orbital glass artwork, working magnetic button, sliders, switches, and links into the demos. |
| Component atlas | **48 interactive demo groups** across inputs, navigation, feedback, data display, media/layout, and glass/system. Search names, filter categories, reveal TSX recipes, and inspect upstream source. |
| Glass laboratory | Change the actual specialized surface, blur, opacity, glow, tint, and spring parameters; copy the resulting recipe. |
| Hello, world | Create a greeting, inspect coordinate markers, search messages, change distance origin/radius, and sort the data grid. Reload to verify persistence. |
| Why Galileo? | The framework's strengths, architecture, and practical tradeoffs. |

The atlas covers the public component families: buttons/magnetic buttons, text fields, checkbox/radio/switch, sliders/rating, select/autocomplete, tags/multiselect, dates/ranges, forms, toggles, alerts/snackbars, progress/loaders/skeletons, dialog/modal/drawer/backdrop, tooltip/focus, both tab APIs, tab bar, breadcrumbs/pagination, accordion/tree, stepper/bottom navigation, menu/FAB/speed dial, avatars/badges/chips, lists/tables/grid, both chart implementations, KPI cards, timeline, carousel, image viewer/list, masonry, typography/links/card links, layout primitives, structured cards, specialized glass surfaces, all nine surface presets, context-aware glass, backgrounds/atmosphere, visual feedback, themes, accessibility/performance tools, navigation layouts/transitions, and consent patterns. Aliases and composed subcomponents are grouped together. The many lower-level physics hooks are not each presented as standalone demos.

## Why this framework?

Its distinctive combination is a shared **glass material system**, **physics-aware interactions**, and a **broad typed React component API**. This is a component library; Next.js is this app's host framework. PostGIS, API routes, the coordinate visualization, and Compose orchestration are application additions.

The documented npm package was unavailable at setup time. Source is pinned at upstream commit `1474e6df7618ecadfd25ed91ce314da0e4edcb91`, with its MIT license and a transparent [compatibility patch record](vendor/galileo/PROVENANCE.md). The app preserves strict checks while isolating pre-existing vendor type errors. No invented benchmarks or blanket accessibility guarantees are made. Upstream: https://github.com/auraoneai/galileo-glass-ui

## Spatial data

Greetings use `geography(Point,4326)` and a GiST spatial index. `ST_DWithin` filters in meters and `ST_Distance` returns a geodesic distance, displayed in kilometers. Eight clearly marked example greetings seed the first migration only. API queries are parameterized; Zod validates lengths and coordinate bounds. Responses distinguish unavailable storage from empty results.

- `GET /api/health`: checks PostGIS and the greetings table; 503 if unavailable.
- `GET /api/greetings?latitude=39.7392&longitude=-104.9903&radius=1000&search=hello`: up to 200 recent matches; radius is in kilometers, maximum 21,000.
- `POST /api/greetings`: JSON `{ "name":"Ada", "message":"Hello!", "city":"London", "latitude":51.5072, "longitude":-0.1276 }`.

The UI offers eight city presets; the API accepts arbitrary valid coordinates. The map is a stylized equirectangular coordinate view with schematic land outlines, not a navigation map or a tiled GIS map.

## Development & verification

```sh
npm ci
npm run typecheck
npx playwright install chromium
npm test
```

Browser tests expect the Compose app at localhost:3000 (override `TEST_BASE_URL` if needed) and use Docker to remove only the test records they created. They check PostGIS, invalid input, spatial radius filtering, literal search, UI save/reload persistence, all 48 example mounts, search/code display, sorting, dialog dismissal, keyboard sliders, material controls, reduced motion, and desktop/mobile layout. `npm run build` performs the production build with type checks; Docker runs that same build.

Verified locally: the production Docker build and strict application type checks pass; **all 8 Playwright tests pass** against the running Compose app. Both Compose configurations validate. Repeated migrations preserve the eight sample greetings without duplicating them. Preview screenshots are in [`artifacts/`](artifacts/), including the overview, laboratory, guestbook, data grid, and mobile overview.

For hot reload inside Compose:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
```

Source edits update automatically; Docker-managed dependency and Next.js cache volumes avoid mounting host modules into Linux. Switch back to the production configuration with `docker compose up --build -d --force-recreate app`.

Source layout: `src/components/` holds the experience and atlas, `src/app/api/` the API, `db/` versioned migrations, `scripts/migrate.mjs` the transaction/advisory-lock migration runner, and `vendor/galileo/` the pinned library. Illustrations are local CSS/SVG; fonts use Google Fonts with local sans-serif fallbacks.
