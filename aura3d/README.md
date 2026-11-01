# RELAY — an Aura3D expedition

A cooperative 3D game for **1–8 pilots per squad**, with independent simultaneous squad worlds. Recover glowing signal fragments, install three cells in each ancient relay, avoid orbiting sentinels, and return to the central landing pad before the destination's signal window closes (10-13 minutes).

The browser is a standalone **React + TypeScript + Vite SPA** rendered by **Aura3D 4.0.0**. **Django REST Framework** serves JSON, **Django Channels** serves WebSockets, **Redis** coordinates live worlds, and **PostgreSQL/PostGIS** stores missions, players, snapshots, spatial landmarks and results. **nginx** serves the SPA and proxies the API and WebSockets over HTTP. Django never serves or embeds the frontend.

## Start

Requires Docker Desktop with the Linux engine running and Docker Compose v2.24 or newer (optional `env_file` support).

```powershell
docker compose up --build -d
docker compose ps
```

Open **http://localhost:8080**. Click **Launch squad**, choose a callsign and destination, and start an expedition. Use the copy-invite button on the squad card to invite friends. To test two players on one machine, use separate browsers or an incognito window: tabs in the same browser share the same pilot session.

The initial page is an explicitly labeled **local preview**. It runs without the API, makes no Anthropic requests, and does not write scores. Launching a squad switches to the real server simulation. Reloading resumes the last squad in that browser. A finished squad remains viewable; launch a new one to play again.

```powershell
docker compose logs -f api simulation
docker compose stop
# Later:
docker compose up -d
```

The `postgres_data` and `redis_data` folders retain the database and Redis AOF across container restarts. Music uploads persist in the `music_media` named volume.

If another application uses port 8080, select a free port and matching CSRF origins before starting the stack:

```powershell
$env:HTTP_PORT='127.0.0.1:8088'
$env:CSRF_TRUSTED_ORIGINS='http://localhost:8088,http://127.0.0.1:8088'
docker compose up --build -d
```

Use that port in the site and admin URLs below. `docker compose start --wait` restarts existing stopped containers with their previously configured port.

## Backend administrator URL

Set `DJANGO_ADMIN_URL` in `.env` (or in `.env.prod` when using `--env-file .env.prod`) to choose the admin path on your site's domain. The default is `admin/`. For example, `DJANGO_ADMIN_URL=control-panel/` places the admin at `https://your-domain.com/control-panel/` and music management at `/control-panel/music/track/`. Nested paths such as `staff/backend/` work too; leading/trailing slashes are normalized. Supply a path, not a full URL. API, media, static and WebSocket prefixes are reserved.

Both Compose configurations pass this setting to Django and nginx. After the initial code update, rebuild with `docker compose up -d --build api nginx` (include your usual production Compose/env-file flags when applicable). Later environment-only changes require `docker compose up -d api nginx` to recreate the affected containers; `docker compose restart` does not load changed environment settings. Use the selected path in place of `/admin/` in the examples below. For Vite development, the same setting is read from the repository root `.env` or the shell environment; restart Vite after changing it.

## Music library and uploads

The persistent **RELAY RADIO** bar plays music while visitors explore, change destinations, open panels, or play with a squad. It supports play/pause, next track, mute, volume, seeking, a clickable track list, **Loop song**, **Loop playlist**, and **Repeat off**. Use the up/down arrows beside each song to reorder your playlist. The browser remembers your order, selected song, volume, mute and repeat preferences. These are personal listening settings; they do not change other visitors' playlists. The viewport speaker button continues to control game sound effects separately.

The player attempts playback on a new visit. If the browser blocks audible autoplay, press **Play** once. After that, songs advance automatically. **Loop playlist** is the default; **Repeat off** stops after the last song. **Next track** always advances, including when looping one song, and wraps to the beginning when clicked on the last song. Playback continues across in-app navigation; a full page reload restores your selection but starts that song from the beginning, subject to browser autoplay policy.

Create your backend administrator once (choose your own username and password):

```powershell
docker compose exec api python manage.py createsuperuser
```

Open **http://localhost:8080/admin/music/track/**, sign in, and choose **Add track**. Upload an audio file and enter **title**, **author / composer**, **artist / band name**, **artist website**, **cover art**, **audio description**, and **artist / group description**. Leave **Is published** checked to add it to the public library. Title and audio are required; the remaining credits can be filled in later. Published releases are automatically appended to visitors' personal queues within 30 seconds while the tab is visible, on window focus, or immediately using **Refresh tracks**. Updating metadata does not interrupt the currently playing recording. Removing or unpublishing a track removes it from the queue on the next refresh.

The DRF browsable upload/edit interface is also available at **/api/music/tracks/** after signing in at **/api-auth/login/** (or the admin). JSON clients use `Accept: application/json`. Audio and covers use `multipart/form-data`; metadata-only changes can use JSON `PATCH /api/music/tracks/{id}/`. Reads are public; uploads, edits and deletes require an authenticated staff account with a CSRF token. Django admin additionally honors its normal model permissions; a superuser has them automatically. Guest game sessions cannot upload music.

Audio is validated and limited to **100 MB** per file: MP3 (recommended), WAV, OGG, M4A, FLAC, or Opus. Browser codec support varies; use MP3 for broad compatibility. Covers must be JPEG, PNG, or WebP, up to **5 MB**. Duration is detected automatically. The three supplied files in `marketing/sample-songs` import automatically on API startup, using embedded titles/credits when present. Two recordings share the embedded title `count's bounce`; you can distinguish them by editing their titles in the admin. Unpublish bundled samples to hide them persistently; deleting a bundled sample allows the startup importer to add it again. Importing again preserves existing edits and publication settings:

```powershell
docker compose exec api python manage.py import_songs
```

Uploaded files live in the persistent Compose **music_media** volume, mounted read-only by nginx for efficient audio streaming and byte-range seeking. Back up this volume together with PostgreSQL. Do not remove it with `docker compose down -v`. Unpublishing hides a recording from the catalog; previously issued media URLs remain public. The **backend_static** volume contains generated admin/DRF CSS and JavaScript. nginx allows 110 MB requests only on the music/admin routes; configure your outer gateway's upload limit to at least 110 MB too (see `deploy/nginx/ispconfig.md`).

For frontend development against Compose, set `$env:API_PROXY_TARGET='http://localhost:8080'` before `npm.cmd run dev`. This proxies the API, media, admin and static assets through Vite. Use your actual Compose port if it differs, and add the Vite origin to `CSRF_TRUSTED_ORIGINS` when editing music through that origin.

## Anthropic / ORA

Your existing `.env.files/.env.antropic` is loaded **only into the API container**. Both `ANTROPIC_API_KEY` (the spelling in your file) and `ANTHROPIC_API_KEY` work. The file is excluded from Git and Docker build contexts. The key is never sent to the frontend, included in an image, or returned in an API response.

The default model is `claude-sonnet-4-6`. In a network expedition, try:

- “What should our squad do next?” — tactics grounded in the current relay and energy state.
- “Bring in an ion storm and scout the next relay.” — shared weather and companion behavior.
- “Clear the skies and guard the landing pad.” — presentation and a companion command.
- “Tell us who built these towers.” — short fictional lore in ORA’s voice.

Claude returns a forced tool call with a bounded schema: dialogue, `aurora/clear/storm`, a relay index, and `follow/scout/guard`. The backend validates it and publishes it to the squad. The model cannot award points, move pilots, complete objectives, execute code, or run SQL. A storm increases sentinel damage. The companion is a visual guide, not a combat bot or navmesh agent.

Requests are player initiated. There are no paid calls in the render loop or background simulation. Limits: 450 output tokens per request, a twelve-second per-pilot cooldown, one concurrent request per room, and **100 provider attempts per UTC day** across the installation by default. `AI_DAILY_REQUEST_LIMIT` and `ANTHROPIC_MODEL` can be set in `.env`. Failed calls also count against the daily request limit. The limit controls requests, not a dollar amount.

If the provider is unavailable, returns an invalid plan, is unconfigured, or the daily limit is reached, deterministic local guidance takes over and is labeled **LOCAL GUIDANCE / FALLBACK**. This is application-level Claude integration; Aura3D does not supply the language model.

An optional standalone credential check sends one small paid request:

```powershell
python scripts/check_anthropic.py --live
```

## Controls

| Control | Action |
| --- | --- |
| WASD / arrows | Move on the island |
| Shift | Sprint |
| E | Collect a nearby fragment, install one shared cell, or finish at the central pad |
| Q | Emit a survey pulse |
| Left-drag / one finger | Orbit around the world or followed pilot |
| Right-drag / Shift-drag | Pan the view across the island |
| Mouse wheel / trackpad scroll | Zoom in and out |
| Two fingers | Pinch to zoom and drag to pan |
| Zoom buttons / Reset view | Accessible zoom controls; restore the default framing |
| Camera button | Switch overview / follow camera |
| Photograph button | Download the rendered scene as PNG |
| Speaker button | Enable synthesized interaction sounds |

Touch controls are available on narrow screens. Each relay needs three cells. Energy is shared, while shields are individual. Sentinels drain shields; shields regenerate away from danger. At zero shield, a pilot is rescued to the landing pad. All three relays must be online before a pilot can transmit from the center to win. The server computes score and remaining-time bonus.

## Destinations

Choose a card above the world to explore it locally, or choose **Destination** when launching a squad. In a live squad, a card opens the launch dialog for a new expedition; it does not change your teammates' world. Existing rooms retain their destination across reconnects and Redis recovery. Old rooms default to Verdant.

| Destination | Time | Distinct challenge |
| --- | --- | --- |
| The Verdant Expanse | 12 min | Original crystal meadow; three sentinels, free relay order |
| Ember Caldera | 11 min | Obsidian island over a molten sea; three heat vents pulse for 4 of every 10 seconds and drain 28 shield/sec before regeneration |
| The Glacial Reach | 13 min | Ice pillars and frost fields; movement inside blue disks is 55% of normal; four outer sentinels |
| Tempest Circuit | 10 min | Violet storm station; five faster sentinels; fully power Arc One, then Arc Two, then Zenith |

All destinations support solo play or eight-player squads. Maps have distinct relay layouts, colors, scenery, patrols and mission rules. `shared/levels.json` is the single catalog consumed by Python and TypeScript. The selected level is stored in the room snapshot; its actual landmark coordinates are persisted in PostGIS. ORA receives the destination rules and zones with each request. Storm weather can still be changed by ORA; the ordered relay requirement remains enforced by the server.

## Movement and rendering performance

Movement in the local sandbox runs at the display frame rate. Network play sends key transitions immediately plus a 10 Hz heartbeat. Local position prediction responds between snapshots and smoothly corrects toward the server; other pilots interpolate buffered positions. Prediction never changes authoritative scores, energy, interactions or hazards. Blur, tab hiding and modal opening release held movement. The input token bucket permits short transition bursts without dropping key releases next to heartbeats.

Repeated scenery and fragments use instance batches, runtime handles are cached, and unchanged/hidden nodes are not dirtied every frame. The React HUD updates separately from the renderer. **Adaptive** resolution (the default) reduces render scale after sustained slow frames without rebuilding the world; Engine lab also offers High and Low. Hover the FPS reading for frame time and current scale.

Reproduce the production-browser movement profile (no paid AI calls):

```powershell
cd frontend
$env:BASE_URL='http://127.0.0.1:8080'
$env:PROFILE_LABEL='current'
node scripts/profile.mjs
```

The report under `artifacts/performance-current.json` includes real animation-frame intervals, input-to-motion measurements, draw counts and CPU hotspots. The October 16, 2026 before/after run on this machine's AMD Radeon / Edge WebGL2 path measured 265 to 101 draw calls, median frame time 50 to 33.3 ms, p95 frame time 83.4 to 50 ms, and sampled input-to-motion 42-61 to 8-24 ms. These are local measurements with production builds and default settings, not a hardware-independent FPS guarantee. The newer default also adapts resolution; the scene retains native Aura3D effects and geometry.

## What this demonstrates

The **Engine lab** exposes material samples, bloom/fog/particle/shadow requests, resolution, physical impulses, and live renderer evidence. **Capability atlas** explains which system owns each feature.

| System | Example | Implementation |
| --- | --- | --- |
| Typed scene authoring | Procedural island, relays, crystals, astronomical background | Aura3D public scene/builders |
| Materials | Ceramic, metal, glass presets, glowing cores | Aura3D material API |
| Rendering | Direct lights, fog, bloom; shadow requests | Aura3D native WebGL2 path |
| Instances | Meadow, rocks, stars, paths, supports, asteroids and moving fragments | Aura3D instanced primitives |
| Animated GLB | ORA with an embedded Hover animation | Typed, hashed original GLB |
| Runtime transforms | Players, pickups, relays, sentinels, scan ring | Registered Aura3D node handles |
| Physics | Five falling/bouncing bodies and an impulse button | Aura3D app physics with native solver |
| Cameras | Overview and player follow | Aura3D camera specifications |
| Evidence | FPS, draw calls, warnings, pass status, PNG capture | Aura3D diagnostics and screenshot API |
| Generative dialogue / direction | Stateful ORA tactics, lore, weather, companion commands | Anthropic + validated DRF endpoint |
| Multiplayer | 10 Hz authority, local prediction, remote interpolation, rooms, presence, reconnect | Django Channels + Redis |
| Spatial data | Nearby relay search and persistent pilot positions | PostGIS `ST_DWithin` / `ST_Distance` |

Aura3D’s strongest selling point here is the integrated TypeScript authoring surface: scene builders, typed assets, cameras, materials, game physics and diagnostics can be composed without implementing a renderer. Its AI-oriented workflow produces inspectable source code. It is not a turnkey multiplayer backend; this project supplies that layer.

This is a broad playable showcase, **not every Aura3D API**. WebGPU, skeletal IK, navmesh crowds, vehicle dynamics, XR, visual scripting, and paid external generative-asset pipelines are not exercised. Runtime evidence distinguishes requested effects from reported execution. In particular, native shadow-map reporting may remain false on this package path even with shadows requested; glass is a material preset demonstration, not a verified physical refraction benchmark. No universal engine-performance or Three.js superiority claim is made.

The original `ora.glb` is generated by `scripts/generate_drone.py` along with its SHA-256 metadata and typed import. It is CC0 and requires no downloads. The rest of the world is procedural. Optional Google Fonts have system-font fallbacks.

## Gateway deployment (HTTP origin, SSL at your gateway)

Copy `.env.example` to `.env` and configure it for your host **before a fresh production database initialization**. Set a random Django secret and database password; the included defaults are for local evaluation. Changing `POSTGRES_PASSWORD` after the database volume has initialized does not change the database user password—rotate it in PostgreSQL as well.

Example non-secret settings:

```dotenv
HTTP_PORT=8080
ALLOWED_HOSTS=relay.example.com,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://relay.example.com,http://localhost:8080,http://127.0.0.1:8080
COOKIE_SECURE=true
```

Point your gateway at `http://<docker-host>:8080` with the original path. Preserve the public `Host`, set `X-Forwarded-Proto: https`, forward WebSocket `Upgrade` and `Connection` headers, and allow `/ws/` connections for at least 90 seconds. The SPA, API and WebSockets share the same public origin; no CORS setup is needed. Use a dedicated hostname or mount at `/` (subpath hosting is not configured).

nginx listens on **port 80 only** inside its container. There are no SSL certificates, HTTPS redirects, or TLS listeners in this project. Only nginx publishes a host port; the database, Redis and API stay on the Compose network. Restrict direct access to the origin to your gateway in deployment, because forwarded headers are trusted. `COOKIE_SECURE=true` is for the HTTPS gateway URL; local HTTP testing needs it false.

For LAN testing, add the host’s LAN IP to `ALLOWED_HOSTS` and `http://<LAN-IP>:8080` to `CSRF_TRUSTED_ORIGINS`. Recreate the API with `docker compose up -d api`. Forwarded IP handling and public access controls can be enforced by your gateway. This showcase uses guest pilot sessions and invitation codes, not account passwords or ranked-game anti-cheat.

## Architecture and persistence

```text
Browser: React + TypeScript + Aura3D
        │ HTTP /api/*   WebSocket /ws/*   static /*
        ▼
API Gateway (your TLS) → nginx :80
                         ├── built SPA files
                         └── Django ASGI :8000 (2 API workers)
                               ├── PostGIS: pilots, rooms, landmarks, snapshots, AI journal
                               ├── Redis: room state, locks, channels, budgets
                               └── Anthropic Messages API (server-side)
                             Simulation worker → 10 Hz updates → Channels → browsers
```

The simulation accepts movement intent, not client positions or scores. Movement is normalized, time steps and world bounds are capped, stale input stops, actions have range/cooldown checks, and a Redis lock serializes changes per room. The server runs the mission timer independently of connected clients. Each active room persists a recovery snapshot and PostGIS player positions every ten seconds, with additional saves on interactions and AI plans. Rooms resume from the database if their Redis state is absent. Keep **one simulation worker**; API workers can scale, but the simulation loop needs sharding/leader election before scaling it horizontally.

The spatial coordinates are fictional world meters stored as planar PostGIS points with SRID 3857. They are not real Earth coordinates. The sector coordinates in the UI are fictional lore. Nearby-landmark queries use actual PostGIS spatial indexing and distance functions.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health/` | Check PostgreSQL/PostGIS and Redis |
| `GET/POST /api/session/` | CSRF bootstrap; create/update guest callsign |
| `GET/POST /api/rooms/` | Public active rooms; create a squad (`level`: verdant/ember/glacier/tempest) |
| `POST /api/rooms/join/` | Join by six-character code |
| `GET /api/rooms/{code}/` | Member-only state and AI journal |
| `GET /api/rooms/{code}/nearby/` | Member-only PostGIS proximity query |
| `POST /api/rooms/{code}/ai/` | Member-only bounded Claude request |
| `GET /api/leaderboard/` | Completed public missions |
| `GET/POST /api/music/tracks/` | Public music catalog; staff multipart upload |
| `GET/PATCH/PUT/DELETE /api/music/tracks/{id}/` | Track metadata; staff edits / removal |
| `/admin/music/track/` | Staff music management, upload and publication forms |
| `/api-auth/login/` | Staff session login for the DRF browsable API |
| `WS /ws/rooms/{code}/` | Session-authorized room updates and movement/actions |

Unsafe HTTP requests require the session bootstrap’s CSRF token in `X-CSRFToken`. WebSocket connections require a member’s session cookie and a permitted origin. Public leaderboard entries exclude private rooms.

## Development and tests

```powershell
# Pure game-rule tests, no services required:
python -m unittest discover -s backend/tests -v

# Real PostGIS/Redis integration and schema checks:
docker compose exec api python manage.py check
docker compose exec api python manage.py makemigrations --check --dry-run
docker compose exec api python manage.py test game music --noinput -v 2

# Frontend build:
cd frontend
npm.cmd ci
npm.cmd run build

# End-to-end tests against the full stack (Edge on Windows by default):
$env:BASE_URL='http://127.0.0.1:8080'
$env:NETWORK_TESTS='1'
npm.cmd run test:e2e
```

Music coverage includes real browser playback, all repeat modes, personal ordering and preferences, new releases, keyboard isolation, and MP3 streaming during live gameplay. To verify an actual staff upload through nginx (creates and removes a temporary account, song and cover):

```powershell
Get-Content -Raw scripts/smoke_music.py | docker compose exec -T api python -
```

For frontend-only work, run `npm.cmd run dev` in `frontend`, then open `http://localhost:5173`. It starts in local preview if no API is reachable. Vite proxies to a locally running backend on port 8000 by default; production Compose does not expose that port. To use the Docker API and nginx media serving during frontend development, set `$env:API_PROXY_TARGET='http://localhost:8080'` and include the dev origin in `CSRF_TRUSTED_ORIGINS`.

Playwright captures desktop, mobile, and lab screenshots under `artifacts/`. Browser tests cover every destination, WASD/arrows, clean scene switching, native physics, mobile layout, focus-loss stopping, socket reconnection, session resume, shared movement, room isolation and unauthorized access rejection. Four separate squads also complete all four missions concurrently using only real WebSocket movement/interact messages; no positions or resources are injected into the server. Pure rule tests cover pulsing heat, frost speed, ordered relays, rescue and solo completion. API tests verify destination validation and PostGIS recovery. Integration tests mock/disable paid AI; the live credential check is separate and opt-in.

`npm audit` currently reports transitive advisories through Aura3D’s `@loaders.gl/textures → texture-compressor` dependencies (`image-size`, `sprintf-js`), without an upstream compatible fix. The app does not expose the compressor or accept uploaded 3D models; staff-uploaded music covers are validated by Django/Pillow and are never passed through Aura3D. These findings still need tracking when updating Aura3D; they have not been silently overridden. Vite is pinned to a patched 7.3.7. The engine build also warns about unused bundled humanoid/Basis assets and a large lazy Rapier chunk. The app uses its own hashed, uncompressed GLB; those absent optional assets are not required by the current scene.

Sources: [Aura3D repository](https://github.com/auraoneai/aura3d), [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create).
