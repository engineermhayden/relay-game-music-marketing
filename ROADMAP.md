# RELAY Roadmap

RELAY is a free browser co-op game built on the Aura3D engine. It is also an open learning resource for developers and a live proof of concept for promoting music inside a game. This roadmap describes what comes next for all three.

Items are grouped into phases and listed in priority order within each phase. Optional accounts come first because music submissions and recordings depend on them. There are no fixed dates. The [TODO list in the README](README.md#roadmap-and-todo) tracks the same items as a checklist.

Have an idea? [Open an issue](https://github.com/engineermhayden/relay-game-music-marketing/issues). Once the feedback tool ships, you'll also be able to send suggestions from inside the game.

## Principles

These apply to every feature on this list:

- **Playing stays free, with no account.** An account unlocks creating and keeping things, such as submitting music or saving recordings. It is never required to play, join a squad or watch.
- **Artists stay credited and in control.** Every track shows its credits wherever it plays. No music is published without review and the artist's permission, and artists can withdraw their music at any time.
- **The server stays in charge.** Spectators, replays and AI features read the authoritative simulation. They cannot move pilots or change scores.
- **Collect as little data as possible.** Players are told what is collected and why, and account holders can export or delete their data.
- **Every feature is a learning example.** New systems are documented so developers can see how they are built with Aura3D, Django and Channels.

## Phase 1: Foundations

### Optional player accounts

Guests keep playing exactly as they do today. An account adds a profile that unlocks music submissions, recordings and the other account features below.

- Sign up with email and password, with email verification and password reset.
- Converting a guest session into an account keeps the current callsign and squad.
- Account holders can download their data, or delete their account and everything tied to it.
- Builds on the existing guest pilot sessions and Django's built-in authentication.

### Feedback and suggestions tool

A **Feedback** button in the game lets anyone, guest or account holder, report a bug, suggest an idea or comment on the music.

- Players can choose to attach a screenshot (from the existing Photograph capture) and a technical snapshot from the Engine lab: browser, renderer path, frame rate and warnings. Bug reports then arrive with what is needed to reproduce them.
- Submissions land in an admin review queue, where each is marked new, planned, done or declined.
- Accepted suggestions appear on a public ideas board where players can upvote them. The most-wanted ideas feed this roadmap.
- Rate limits and spam filtering keep the queue usable.

### Privacy and analytics controls

- Make Matomo analytics an environment setting, off by default for local development, so people running RELAY on their own machine are not tracked.
- Add a privacy page that explains what is collected and why, with a consent notice where required.

### Continuous integration

- Run the unit, integration and Playwright tests and the frontend build on every pull request with GitHub Actions. (`.github` is currently listed in `.gitignore` and must be removed from it first.)
- Scan every push for accidentally committed secrets.
- Turn on automated dependency update alerts.

### Any AI provider, including self-hosted models

ORA currently calls the Anthropic Messages API directly, and the production Compose file requires an Anthropic API key. RELAY should work with any AI provider, including models you run yourself.

- Settings choose the provider, model and endpoint: Anthropic, other hosted providers, or any OpenAI-compatible endpoint. The OpenAI-compatible option covers self-hosted servers such as Ollama, vLLM and llama.cpp.
- With a self-hosted model, player prompts and game state never leave your own infrastructure, and there is no per-request cost.
- No AI key is required to deploy. With no provider configured, ORA uses its labeled local guidance in production as well as locally.
- Every provider's answer passes the same server-side validation as today. ORA can still only return dialogue, weather, a relay waypoint and a companion command, and it still cannot award points or move pilots. Models without tool calling return structured JSON that is validated the same way.
- The daily request limit, per-pilot cooldown and local fallback apply to every provider.
- Each provider adapter passes a shared test suite, and the README documents how to configure each option.

## Phase 2: Community music

### Music submissions with review

Account holders can submit their own music to RELAY RADIO. The maintainer reviews every submission before it is published.

- The submission form uses the same credit fields as today's admin upload: title, composer, artist or band, website, cover art and descriptions.
- Submitters confirm they own or control the rights to the track and grant RELAY permission to stream it. They choose separately whether it may appear in downloaded recordings.
- Automatic checks run first: the existing format and size validation, loudness normalization so every track plays at a similar volume, and duplicate detection.
- The maintainer listens, then approves, asks for changes or declines, with a note to the submitter. Approval uses the existing publish flow, so the track reaches players' queues within 30 seconds.
- Submitters see each track's status and can withdraw a published track at any time.
- A per-account submission limit keeps the queue manageable.

### Artist profiles and spotlight

- Every artist on RELAY RADIO gets a profile page with their bio, links, cover art and tracks.
- The now-playing bar links to the artist's profile, so a player who likes a song can find more in one click.
- A **Featured artist** slot on the home screen rotates on a schedule the maintainer controls.

### Release premieres

An artist's new track debuts to everyone online at the same moment.

- A countdown appears in the game ahead of the premiere.
- When it starts, every player's radio switches to the new track (players can opt out), and the landing pad on every destination hosts a light show synchronized to the music.
- A live listener count and simple one-tap reactions let the audience respond.
- Afterwards, the artist sees how many people listened live and how they reacted.

### Likes, charts and artist insights

- Account holders can like tracks and save favorites.
- A **RELAY Top 10** chart ranks tracks by plays and likes.
- Artists see aggregate stats for their tracks: plays, how often people listen to the end, skips and likes. This shows artists what in-game exposure did for their music. No individual's listening history is shared.

### Squad listening party

RELAY RADIO is personal today. A squad can opt in to a shared station instead: the pilot who launched the squad picks the playlist, and everyone hears the same track in sync. Each pilot still controls their own volume and can switch back to their personal radio at any time.

### A world that moves to the music

- Relay cores, crystals and the sky pulse in time with the current track, driven by the Web Audio API and Aura3D material and bloom settings.
- An optional intensity layer builds as the signal window runs out.
- A setting turns the effect down or off for players who prefer calmer visuals or are sensitive to flashing.

### Ask ORA for music

- Players can ask ORA for a mood, such as "Play something calmer" or "Give us something fast for the final relay."
- ORA picks from the published catalog using each track's description, through the same bounded, validated tool call ORA uses today. It can only choose a track; it cannot change the catalog.
- Requests count against the existing daily AI limit. When the limit is reached, a keyword match on track descriptions takes over.

## Phase 3: Watch and share

### Spectator mode

Anyone can watch a public expedition live without joining it, with or without an account.

- A **Live now** list on the home screen shows public expeditions with their destination, squad size, time remaining and spectator count.
- Spectators receive the same 10 Hz server updates as players over a read-only connection that cannot send movement or actions.
- Spectators choose the overview camera, a free camera, or follow any pilot.
- The squad sees how many people are watching. Private squads cannot be watched unless they share a watch link, and any squad can turn spectating off.

### Recordings, replays and MP4 downloads

Account holders can record their expeditions, watch them later and download them as MP4 video for personal use.

- RELAY records the server's authoritative mission data, not video. Recordings stay small, and replays are re-rendered in Aura3D, so you can rewatch from any pilot's view or the overview.
- Everyone in the squad sees a recording indicator before and during the mission.
- A **My recordings** library lists past expeditions with destination, squad, result and date. Recordings can be renamed, starred or deleted.
- **Download as MP4** renders the replay to 720p or 1080p video (H.264 with AAC audio) in a background job. The player gets a download link when it is ready.
- Videos include RELAY RADIO music only when the artist allowed it at submission; otherwise they use game audio only. An end card credits every track that played.
- Unstarred recordings are kept for a limited time to control storage.
- Builds on the simulation, which already broadcasts the full mission state 10 times a second and saves recovery snapshots every 10 seconds.

### Highlight clips and photo mode

- RELAY marks key moments automatically: the final relay coming online, last-second transmissions and rescues. Each can be saved as a 30-second clip.
- Photo mode pauses a replay, hides the HUD and frees the camera, extending today's Photograph button.
- Shared images and clips carry a small credit for the song that was playing, so every share also promotes the artist.

### ORA mission debriefs

After a mission, ORA writes a short debrief: who installed the most cells, the closest call with a sentinel, and the moment that decided the run.

- It uses the same bounded AI request, daily limit and local fallback as today's ORA guidance.
- Debriefs attach to the recording and can be shared alongside highlight clips.

## Phase 4: More to play

### Daily signal challenge and ghost runs

- One seeded variant of a destination each day, the same for every player, with relay positions and hazards that change daily.
- Daily and weekly leaderboards, built on the existing leaderboard of completed public missions.
- **Ghost runs:** race a translucent replay of your best run or the day's top run, built on the recording system.

### New destinations

New islands added through `shared/levels.json`, each with its own rule:

- **The Sunken Archive:** a drowned library in deep fog, where relays only become visible after a survey pulse reveals them.
- **The Drift Belt:** a low-gravity asteroid field whose platforms drift under Aura3D physics, so relay positions shift during the mission.

### Achievements and cosmetics

- Achievements for skilled and playful runs, such as finishing without a rescue, winning during an ion storm, or completing all four original destinations.
- Earned cosmetics: pilot colors, trail effects and ORA skins.
- Everything is earned by playing; nothing is for sale. Account holders keep their unlocks permanently, and guests keep them for their session.

### Gamepad and accessibility

- Gamepad support through the browser Gamepad API.
- Remappable keys.
- Colorblind-safe palettes for relays, hazards and pilots.
- A reduced-motion mode, and visual cues for every important sound.
- Screen reader announcements for mission events, such as a relay coming online or the timer entering its final minute.

## Phase 5: For developers

### Aura3D tutorials

A step-by-step series built on RELAY's real source, with each tutorial linking to the files it explains:

- Build and instance a meadow of thousands of objects.
- Add a destination through `shared/levels.json`.
- Read Aura3D's renderer evidence and diagnose dropped passes.
- Connect a multiplayer server to an Aura3D scene with Django Channels.

### Explore more of Aura3D

The README lists Aura3D features RELAY does not use yet. Candidates:

- A WebGPU rendering path, compared side by side with WebGL2 in the Engine lab.
- Navmesh-driven sentinels that path around obstacles instead of following fixed patrols.
- Skeletal animation for pilots.
- An XR spectator view.

### Contributor guide

- A `CONTRIBUTING.md` covering setup, tests, code style and the pull request process.
- "Good first issue" labels on beginner-friendly tasks.

## Phase 6: Operations

### Scale the simulation

The simulation runs as a single worker today. Splitting rooms across several workers, with leader election, lets RELAY host many more squads at once.

### Moderation

- Players can report a callsign, feedback post or track.
- Automatic filtering for offensive callsigns and text.
- Admin tools to hide content and suspend accounts.

### Backups and dependency upkeep

- Scheduled, tested backups of PostgreSQL and the music library volume.
- Resolve the Aura3D `npm audit` advisories (through `@loaders.gl/textures`) once an upstream fix is available.

## Later ideas

Not yet planned, but worth exploring:

- An installable app (PWA) with an offline local preview.
- Translations of the game interface.
- A destination editor, so players can design and share their own islands.
- Streaming overlays for Twitch and YouTube that show the current track's credits.
