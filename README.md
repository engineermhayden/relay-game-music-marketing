# RELAY — an Aura3D expedition

A cooperative 3D game for **1–8 pilots per squad**, with independent simultaneous squad worlds. Recover glowing signal fragments, install three cells in each ancient relay, avoid orbiting sentinels, and return to the central landing pad before the destination's signal window closes (10-13 minutes).

The browser is a standalone **React + TypeScript + Vite SPA** rendered by **Aura3D 4.0.0**. **Django REST Framework** serves JSON, **Django Channels** serves WebSockets, **Redis** coordinates live worlds, and **PostgreSQL/PostGIS** stores missions, players, snapshots, spatial landmarks and results. **nginx** serves the SPA and proxies the API and WebSockets over HTTP. Django never serves or embeds the frontend.

## Who it's for

- **Players.** RELAY is free to play in a desktop or mobile browser, with nothing to download or pay for. No account is needed: open the site, choose a callsign, and launch a squad alone or with up to seven friends. Players who want one can create an optional email account that keeps track of the pilots they fly. See [Optional player accounts](#optional-player-accounts). Anyone can report bugs, suggest ideas, comment on the music, and upvote what the team accepts on the [feedback board](#player-feedback-board).
- **Developers learning Aura3D.** The full source is free to use, study and adapt under the [MIT License](LICENSE). It is a working multiplayer example of Aura3D scene authoring, materials, instancing, physics, cameras and diagnostics. Start with [What this demonstrates](#what-this-demonstrates) and the in-game **Engine lab**.
- **A proof of concept for music marketing in games.** RELAY is built to be deployed as a live demonstration of promoting music inside a game. **RELAY RADIO** plays artists' tracks with full credits and links while people play, and new releases reach players without a redeploy. See [Music library and uploads](#music-library-and-uploads).

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

Uploaded files live in the persistent Compose **music_media** volume, mounted read-only by nginx for efficient audio streaming and byte-range seeking. Back up this volume together with PostgreSQL. Do not remove it with `docker compose down -v`. Unpublishing hides a recording from the catalog; previously issued media URLs remain public. The **backend_static** volume contains generated admin/DRF CSS and JavaScript. nginx allows 110 MB requests only on the music/admin routes; configure your outer gateway's upload limit to at least 110 MB too (see `deploy/nginx/apigateway.md`).

For frontend development against Compose, set `$env:API_PROXY_TARGET='http://localhost:8080'` before `npm.cmd run dev`. This proxies the API, media, admin and static assets through Vite. Use your actual Compose port if it differs, and add the Vite origin to `CSRF_TRUSTED_ORIGINS` when editing music through that origin.

## Optional player accounts

Accounts are optional. Guests can play every destination, solo or in a squad, without one. Choose **Sign in** in the top bar to create an account with an email and password, sign in, or reset a forgotten password. Accounts are the foundation for saving expedition results, squad settings and performance data in a later update. For now, an account records which pilots it has flown.

- **Signing up or in never interrupts play.** The browser keeps its callsign and current squad, and that pilot is linked to the account. Pilots created while signed in are linked too (`Pilot.account`).
- **Signing out** ends the browser's whole session, including its pilot, and leaves the current squad on that device. A shared computer therefore never keeps playing as, or recording for, the previous account. Play continues as a guest.
- **Email verification.** Sign-up sends a verification link that is valid for 72 hours. You can play before verifying. **Resend verification email** sends up to three emails per hour. The link also works in a different browser or device.
- **Password reset.** **Forgot password?** emails a single-use link that expires after one hour. The response is the same whether or not the email has an account. Choosing a new password signs you in, confirms the email address, and signs out your other sessions.
- **Changing the email or password.** Choose **Change email or password** in the account dialog and enter your current password. The dialog checks the request first. It then warns that the change signs you out on every device, including this one, which also leaves your current squad on each device. **Cancel** keeps the dialog open and changes nothing.
  - *Password only:* you are signed out everywhere and sign in again with the new password.
  - *Email, or email and password:* first you see your eight recovery keys and must confirm you have stored them. If you close the dialog or cancel at that step, nothing changes, and the next attempt shows the same keys. After you confirm, you are signed out everywhere, the email changes, and the account is **deactivated** until you open the activation link sent to the new address. The previous address is told about the change. Signing in before activation (with the correct password) explains this and offers **Send a new activation link**. A password reset sent to the new address also reactivates the account.
- **Recovery keys.** Eight single-use 12-digit keys (`1234-5678-9012`). **Copy** and **Download** help you store them. **Regenerate recovery keys** (current password required) replaces all eight; the old keys stop working immediately. The account dialog shows how many remain unused. To use one, choose **Sign in → Use a recovery key**. Enter the account email, or the email it had before a change, plus an unused key and a new password. You are signed in, and every other session is signed out. If an email change is still waiting for activation (for example a mistyped address), recovery restores the previous email. Used keys never work again.
- **Downloading your data.** **Download my data** in the account dialog asks for your current password, then saves `relay-account-data-<date>.json`. The file holds your email (and the previous one, after a change), when the account was created and last signed in, and how many recovery keys remain unused. It also lists your pilots and callsigns, the squads they created or joined, the ORA journal of those squads, the prompts you wrote to ORA, the feedback you submitted (in every review status, with any screenshot and Engine lab snapshot you attached) and the feedback you upvoted. It leaves out your password, your recovery keys, and other players' callsigns and prompts. Wrong passwords count toward the sign-in lockout. Downloading changes nothing and keeps you in your squad.

- **Deleting your account.** **Delete account** at the bottom of the account dialog asks for your current password and confirmation. It is a *soft delete*. RELAY keeps the account row and its gameplay history (pilots, expeditions, memberships, positions, scores and mission events) for gameplay analytics. Everything that identifies the player is erased:
  - **Replaced with random text:** the email address (`<64 hex>@deleted.invalid`; the `.invalid` domain can never receive mail) and the username. Also every callsign the account flew, wherever it appears: pilot records, room snapshots, live room state, event text, ORA replies and squadmates' ORA prompts.
  - **Replaced with random text:** names of squads the account created.
  - **Removed:** the password (made unusable), the previous email, recovery keys, and the ORA prompts the player wrote.
  - **Removed from the player's feedback:** the account's current and previous email addresses (replaced with `[email removed]`) and its callsigns (replaced with the same random names as everywhere else), in titles, details and team replies; and the browser user-agent string in attached Engine lab snapshots, which can fingerprint a device.
  - **Kept for analysis:** every feedback item the account submitted, with its type, status, dates, team reply, votes, screenshot (3D scene pixels only) and the rest of its Engine lab snapshot, still linked to the deleted account as its pilots are. The account's upvotes stay too. Apart from the removals above, a post's wording is kept as written; removing any other personal details is part of staff review (see [Player feedback board](#player-feedback-board)).
  - **Marked:** `deletion_reason = 'user-self-deletion'` with a `deleted_at` timestamp. That row is the audit record.

  The account is deactivated and every session is signed out. This browser leaves its squad and forgets the saved callsign. A final confirmation goes to the former address, which is then no longer stored anywhere. The same email can register a new, unrelated account. If Redis is unreachable, deletion fails without changing anything, so live rooms never keep a name the database no longer has.

Without `EMAIL_HOST`, emails are printed to the API log instead of being sent. Copy the link from there:

```powershell
docker compose logs api | Select-String 'account='
```

To send real email, set your SMTP provider's settings in `.env` (or `.env.prod`), then `docker compose up -d api`:

```dotenv
PUBLIC_SITE_URL=https://relay.example.com
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=relay@example.com
EMAIL_HOST_PASSWORD=your-smtp-password
EMAIL_USE_TLS=true
EMAIL_USE_SSL=false
DEFAULT_FROM_EMAIL="RELAY <no-reply@relay.example.com>"
```

`PUBLIC_SITE_URL` is the origin used in emailed links. When it is blank, links use the request's host, which `ALLOWED_HOSTS` restricts. For implicit TLS on port 465, set `EMAIL_USE_TLS=false` and `EMAIL_USE_SSL=true`. `compose.prod.yaml` requires every setting except the SMTP username and password, which may be empty for unauthenticated relays.

Security details:

- Passwords are hashed with Django's default PBKDF2 hasher. They must be 8–128 characters and not common, entirely numeric, or too similar to the email. These validators now also apply to staff `createsuperuser` and `changepassword`.
- Emails are unique regardless of case. Sign-up says so when an address is already registered; sign-in errors do not reveal which emails exist.
- Links carry their tokens in the URL fragment (`/#account=…`). Browsers never send fragments to the server, nginx logs, or `Referer` headers, and the app removes the fragment from the address bar.
- **CAPTCHA.** Sign-up, sign-in, password-reset and feedback requests, and voting on ideas (once per session), require a self-hosted image CAPTCHA: five distorted characters from an alphabet without lookalikes (no 0/O/Q or 1/I/L), answered without regard to case or spaces. There is no third-party service and no new dependency. Images are drawn with Pillow, and each challenge lives in Redis for at most 10 minutes, stored only as a keyed hash of its answer.
  - Every challenge works once. Any submission spends it, right or wrong, so the form shows a new image after every attempt. A page load always starts with a new one, and **Show a new image** replaces it at any time.
  - The CAPTCHA is checked before anything else, so bots cannot create accounts, trigger emails, make the server hash passwords, or add to a player's sign-in lockout without solving it.
  - Each network address can request 60 images per 10 minutes.
  - An account awaiting activation gets a 15-minute signed token from its CAPTCHA-protected sign-in, which it uses to request a new activation link. The resend endpoint never accepts passwords, so it cannot be used to guess them around the CAPTCHA.
  - Limits: like any text CAPTCHA, it deters automated abuse but will not stop a determined attacker using modern OCR or paid human solvers; the rate limits below remain the backstop. There is no audio alternative yet, which matters for players who cannot see the image.
- Sign-in is locked for 15 minutes after 10 wrong passwords for one email, or 50 from one network address. A password reset lifts the email lock. One network address can create 20 accounts per hour, and each address receives at most three verification or reset emails per hour. The counters live in Redis.
- Email changes, password changes and viewing or regenerating recovery keys all require the current password. Wrong current passwords count toward the sign-in lockout. Recovery attempts are limited separately, to 10 failures per email (and 50 per network address) every 15 minutes.
- Signing out everywhere is enforced on every request, game endpoints included. Reactivating an account does not revive earlier sessions.
- Recovery keys are not stored. Each is derived with an HMAC of `DJANGO_SECRET_KEY`, the account, and a random per-set value kept in the database. This is how the same keys can be shown again without storing them in plain text, and why a database copy alone reveals none. **Changing `DJANGO_SECRET_KEY` changes every recovery key**, so players must then regenerate theirs. Keys never appear in emails or logs.
- While an email change awaits activation, the previous address stays reserved, so recovery can always restore it.
- Account deletion covers data RELAY stores. It does not reach server, gateway or SMTP-provider logs (which may hold IP addresses or addresses of sent mail), staff notification emails about feedback (which quote the post but never include the player's email), emails printed by the console backend, or database and volume backups taken before the deletion. Cover those with retention policies. Guest play in a browser where the player never signed in is not linked to the account, so it cannot be identified or erased. Retained gameplay stays linked by a random account ID. With identifiers erased it is intended to be anonymous, but whether it counts as anonymised under GDPR depends on what else you hold, such as access logs. Review that with your compliance advisor.
- Player accounts are never staff. They cannot open the admin or upload music. Staff logins are separate: a staff user cannot sign in to the game with that login, and may create a player account with the same email.

Staff can review accounts at **/admin/accounts/account/**. The email is read-only there, because it is the sign-in and reset address. The admin shows whether an account awaits activation and how many recovery keys remain, never the keys themselves. Players delete their own accounts as described above. Deleting a user under **Authentication and Authorization → Users** is a hard delete. It removes the account, but leaves its pilots, with their callsigns, unlinked in gameplay records, so prefer self-service deletion. A staff-initiated erasure action, for requests received by email, is not yet available. An account a staff member deactivates (by clearing **Active** on its user) stays deactivated: activation links, password resets and recovery keys do not reactivate it.

## Player feedback board

Guests and signed-in players can report a bug, suggest an idea, or comment on the music. Choose **Feedback** in the left rail, or **Ideas & feedback** in the footer on any screen size, then **Send feedback**. Everything goes to a staff review queue. Whatever staff accept (*Planned* or *Done*), bug report, idea or music comment, appears on the **public board**, where players upvote it. Attachments are never public. Posts never show who wrote them; only staff see whether a signed-in account or a guest sent one.

- **Sending.** Choose a type (**Bug report**, **Idea** or **Music**), then write a title (4–120 characters) and optional details (up to 2,000 characters). Every submission needs the self-hosted CAPTCHA. A wrong answer spends the image and keeps the draft and any chosen attachments. An unsent draft also survives closing the dialog within the tab.
- **Attachments (optional, opt-in).** Two unticked boxes, **Attach a screenshot of the game view** and **Attach an Engine lab snapshot**. Ticking one captures it at once and shows a preview, and **Retake** captures the view again. The screenshot uses the same capture as **Save photograph**: it contains only the 3D scene, never the page around it such as callsigns or chat. It is sent as a JPEG. The snapshot records what the Engine lab shows: browser, renderer path and renderer evidence, frame rate, frame time, resolution scale, draw calls, render settings, destination, and any errors, warnings and limitations. Attachments are sent only inside the CAPTCHA-checked submission and only when ticked. The server stores them only after the CAPTCHA passes. Only staff (and the player's own data export) ever see them; they never appear on the board.
- **Following your submissions.** Until a post is decided, and afterwards, its author sees it under **Your submissions**, with its type, attachments, status and any team reply. The statuses are *Awaiting review* (New), *Planned*, *Done* and *Declined*.
- **Voting.** The public board lists everything staff have accepted (*Planned* or *Done*), each marked with its type, sorted by **Top** (most votes) or **New** (most recently accepted). Upvote with the arrow beside an item, and click again to remove your vote. Everyone, guest or signed in, solves the CAPTCHA shown inline before voting. It then lasts `FEEDBACK_VOTER_CHECK_HOURS` (24 hours) in that browser session, and sending feedback also counts as solving it. Each browser session, or each account across all its devices, has one vote per item.
- **Signing in** on the same browser moves that browser's guest posts and votes to the account, like its pilot, without double-counting an item both identities voted for. **Signing out** ends the browser session, so its guest posts and votes are no longer linked to that browser.
- **Deleting an account** keeps its posts, attachments, votes and statuses for analysis. Only the account's email addresses and callsigns are removed from the wording of its posts, and the browser user-agent string from its snapshots. See [Optional player accounts](#optional-player-accounts).

**Review queue.** Staff manage feedback at **/admin/feedback/feedback/**. Everything arrives as **New**, and New items are listed first, newest first. Filter by status, type, attachments, or whether an account sent it, and search titles, details and replies. Select items and choose an action: **Accept as planned**, **Accept as done**, **Decline**, or **Return to new**. The status can also be changed on the item's page. Accepting an item (as planned or done), whatever its type, puts its title, details, type, status and team reply on the public board for players to upvote; declining it or returning it to new takes it off again. Attachments never appear there. The item's page shows the screenshot (served by a staff-only admin URL, never from the public media volume) and the Engine lab snapshot as a table with its raw JSON. Staff can also correct the wording, change the type, or write a **Team reply**, which the author sees and which appears publicly under an accepted item. **Submitted by** links to the author's account, or shows **Deleted account** once its owner has deleted it. Removing personal details from a post's wording is the reviewer's job, before accepting it. Account deletion only removes the author's own email addresses and callsigns. Staff cannot create items in the admin; feedback comes only through the CAPTCHA-protected form. Votes on an item that is later declined are kept, so they return if it is accepted again.

**Staff notifications.** Every accepted submission emails the addresses in `STAFF_EMAILS`, so nothing waits unseen in the queue. The email gives the type, title, details, which attachments were included (named, not attached), whether a guest or a signed-in player sent it, and a direct link to it in the admin. It never includes the player's email; the admin shows the account. One email goes to all listed addresses. It is sent through the same SMTP settings as account emails; without `EMAIL_HOST` it is printed to the API log. If sending fails, the submission is still saved and the failure is logged. Rejected attempts (wrong CAPTCHA, invalid text, spam, over a limit) send nothing.

```dotenv
STAFF_EMAILS=lead@relay.example.com,moderator@relay.example.com
```

**Rate limits and spam filtering.** Submissions are checked in this order: CAPTCHA, cooldown and rate limits, text and attachments, spam filter. Nothing is saved or emailed unless every check passes.

- **Rapid repeats:** after an accepted submission, the same network address and the same player must wait `FEEDBACK_SUBMISSION_COOLDOWN_SECONDS` before sending again (`429` with `Retry-After`).
- **Volume:** per network address per hour, and per account or guest session per day. Only accepted submissions count, because the CAPTCHA already limits failed attempts.
- **Spam filter:**
  - Titles cannot contain links, and details may hold at most `FEEDBACK_MAX_LINKS`.
  - Posts containing any of `FEEDBACK_BLOCKED_WORDS` are rejected. Entries are whole words or phrases, ignoring case and spacing.
  - Runs of one character 25 or more times ("aaaaaaaa…") are rejected, and titles need at least three letters.
  - Text identical to a submission from the last 24 hours, from anyone, ignoring case and spacing, is rejected.
  - A hidden honeypot field, invisible to people and screen readers, catches form-filling bots.
- **Votes:** every voter passes the CAPTCHA; one vote per session or account per item is enforced by a database constraint; vote changes are limited per network address per hour; and one network address can add at most `FEEDBACK_VOTES_PER_IDEA_PER_IP_DAY` new upvotes to a single idea per day, which stops vote stuffing from many sessions. Removing a vote does not give one back, so toggling cannot get around it.
- **Attachments:** screenshots must be PNG, JPEG or WebP, 16–4,096 pixels per side, and at most 1.5 MB. The server checks the declared size before decoding any pixels, then re-encodes the image as JPEG (at most 1,920 pixels per side), which drops metadata and anything that is not an image. Snapshots keep only known fields, with capped lengths and list sizes; malformed ones are rejected. nginx accepts request bodies up to 3 MB on the submission endpoint only; every other API route keeps its 16 KB limit.

The limits are read from `.env` (or `.env.prod`); the defaults below apply when a value is unset or blank in local runs. The counters live in Redis.

| Variable | Default | Meaning |
| --- | --- | --- |
| `FEEDBACK_SUBMISSION_COOLDOWN_SECONDS` | `60` | Wait between submissions from one network or player (`0` turns it off) |
| `FEEDBACK_SUBMISSIONS_PER_IP_HOUR` | `10` | Submissions per network address per hour |
| `FEEDBACK_SUBMISSIONS_PER_SUBMITTER_DAY` | `5` | Submissions per account, or per guest browser session, per day |
| `FEEDBACK_VOTES_PER_IP_HOUR` | `300` | Vote and unvote requests per network address per hour |
| `FEEDBACK_VOTES_PER_IDEA_PER_IP_DAY` | `5` | New upvotes one network address can give a single board item (of any type) per day |
| `FEEDBACK_VOTER_CHECK_HOURS` | `24` | How long a solved CAPTCHA lets a browser session vote |
| `FEEDBACK_MAX_LINKS` | `2` | Links allowed in a submission's details (`0` allows none; titles never allow links) |
| `FEEDBACK_BLOCKED_WORDS` | *(empty)* | Comma-separated words or phrases that get a submission rejected |

Numbers must be whole numbers of at least 1 (the cooldown and link limit may be 0), and `STAFF_EMAILS` must be a comma-separated list of valid addresses. Otherwise the API refuses to start and names the setting. `compose.prod.yaml` requires all of them, including a nonempty `STAFF_EMAILS`, except `FEEDBACK_BLOCKED_WORDS`, which may be empty. Add them to `.env.prod` before deploying this update. Local Compose reads them from `.env`. After changing any of them, run `docker compose up -d api` (a restart does not reload `.env`).

The service stores no IP addresses or callsigns alongside feedback. A guest is identified by a random token in their session; only a keyed hash of that token is stored with their posts and votes. Attachments are kept in PostgreSQL, so they are backed up with the database and never exposed through `/media/`. The board response is marked `Cache-Control: no-store`, because it includes the viewer's own votes and submissions. Posts are plain text: the app never renders them as HTML.

## Anthropic / ORA

Set `ANTHROPIC_API_KEY` in `.env` (see `.env.example`) for local runs, or in `.env.prod` for production. The key is passed **only to the API container**. Both files are excluded from Git, and the key is never built into an image, sent to the frontend, or returned in an API response. The key is optional locally: without one, ORA uses local guidance (described below). The production Compose file requires it.

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

This is a broad playable showcase, **not every Aura3D API**. WebGPU, skeletal IK, navmesh crowds, vehicle dynamics, XR, visual scripting, and paid external generative-asset pipelines are not exercised. Runtime evidence distinguishes requested effects from reported execution. Glass is a material preset demonstration, not a verified physical refraction benchmark. No universal engine-performance or Three.js superiority claim is made.

### Interpreting live renderer evidence

The lab reads Aura3D's current shadow diagnostics, with a fallback to the legacy bridge fields. In 4.0.0, the cascaded shadow path can report `shadows.shadows[].sampled: true` while the legacy `renderer.shadows.mapRendered` stays false because its target-allocation counter is not updated by that path. **Sampled** reflects the newer runtime report; it is not a visual-quality guarantee. Disabled features display **Off**, while requested features without execution evidence display **Requested · unreported**.

RELAY supplies pointer/touch camera controls and keyboard gameplay itself. Pointer and keyboard scene declarations make those controls visible to Aura3D's structural audit without adding a second orbit controller. Relay bases use one instanced batch of translucent blob footprints for grounding; the **Shadows** toggle controls both those footprints and the light's shadow request. These are simple geometry, not screen-space contact shadows or ambient occlusion. The tested WebGL2 path drops a requested contact-occlusion/SSAO pass with `ssao:normals` missing, so adding that effect alone would only hide the structural warning.

**Instanced submissions (total)** is cumulative since the scene mounted, including renderer passes; use the viewport's draw count for per-frame submissions. The GLB clip count, primitive/actor counts, two direct lights and ambient-light intent are informational. **Runtime limitations** surfaces missing postprocess inputs, dropped passes and effect limitations such as unavailable soft-particle depth. **Raw Aura3D reports** preserves the bridge's informational messages and generic unsupported-effect notice.

Scene rebuilds use a fresh canvas to avoid Aura3D 4.0.0's stale VFX attachment (`VFX_APP_BINDING_AMBIGUOUS`), which otherwise stops particles after switching destinations, cameras or lab settings. Adaptive quality changes resolution without requesting unsupported particle scaling (`PERFORMANCE_PARTICLE_OWNER_UNAVAILABLE` when no native particle owner is attached).

Deploy these frontend changes by rebuilding the nginx image on the production host, after updating its checkout (use the env file used by that deployment):

```powershell
docker compose --env-file .env.prod -f compose.prod.yaml up -d --build --no-deps nginx
```

Reload the browser and open Engine lab to inspect the new evidence. No database migration is needed.

The original `ora.glb` is generated by `scripts/generate_drone.py` along with its SHA-256 metadata and typed import. It is CC0 and requires no downloads. The rest of the world is procedural. Optional Google Fonts have system-font fallbacks.

## Gateway deployment (HTTP origin, SSL at your gateway)

Copy `.env.example` to `.env` and configure it for your host **before a fresh production database initialization**. Set a random Django secret and database password; the included defaults are for local evaluation. Changing `POSTGRES_PASSWORD` after the database volume has initialized does not change the database user password—rotate it in PostgreSQL as well.

Example non-secret settings:

```dotenv
HTTP_PORT=8080
ALLOWED_HOSTS=relay.example.com,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://relay.example.com,http://localhost:8080,http://127.0.0.1:8080
COOKIE_SECURE=true
PUBLIC_SITE_URL=https://relay.example.com
```

`compose.prod.yaml` also requires the email settings described in [Optional player accounts](#optional-player-accounts). Existing deployments must add them to `.env.prod` before upgrading. Rebuild the API and nginx (`docker compose --env-file .env.prod -f compose.prod.yaml up -d --build api nginx`). The API applies the account migrations at startup.

Point your gateway at `http://<docker-host>:8080` with the original path. Preserve the public `Host`, set `X-Forwarded-Proto: https`, forward WebSocket `Upgrade` and `Connection` headers, and allow `/ws/` connections for at least 90 seconds. The SPA, API and WebSockets share the same public origin; no CORS setup is needed. Use a dedicated hostname or mount at `/` (subpath hosting is not configured).

nginx listens on **port 80 only** inside its container. There are no SSL certificates, HTTPS redirects, or TLS listeners in this project. Only nginx publishes a host port; the database, Redis and API stay on the Compose network. Restrict direct access to the origin to your gateway in deployment, because forwarded headers are trusted. `COOKIE_SECURE=true` is for the HTTPS gateway URL; local HTTP testing needs it false.

For LAN testing, add the host’s LAN IP to `ALLOWED_HOSTS` and `http://<LAN-IP>:8080` to `CSRF_TRUSTED_ORIGINS`. Recreate the API with `docker compose up -d api`. Forwarded IP handling and public access controls can be enforced by your gateway. This showcase uses guest pilot sessions and invitation codes, with optional player accounts; it has no ranked-game anti-cheat.

## Architecture and persistence

```text
Browser: React + TypeScript + Aura3D
        │ HTTP /api/*   WebSocket /ws/*   static /*
        ▼
API Gateway (your TLS) → nginx :80
                         ├── built SPA files
                         └── Django ASGI :8000 (2 API workers)
                               ├── PostGIS: pilots, accounts, rooms, landmarks, snapshots, AI journal
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
| `GET/POST /api/session/` | CSRF bootstrap; create/update guest callsign; current account |
| `GET /api/account/` | Current player account (or `null`) and CSRF token |
| `GET /api/account/captcha/` | New single-use CAPTCHA for account and feedback forms: `captcha_id`, PNG data-URL `image`, `expires_in` |
| `POST /api/account/signup/` / `login/` / `logout/` | Optional account: `email`, `password`; sign-up and sign-in also need `captcha_id` and `captcha_answer` |
| `POST /api/account/verify-email/` | Confirm an email address: `token` |
| `POST /api/account/verify-email/resend/` | Send a new verification link (signed in, or the `resend_token` a sign-in returns while awaiting activation) |
| `POST /api/account/password-reset/` | Email a reset link: `email`, `captcha_id`, `captcha_answer` |
| `POST /api/account/password-reset/confirm/` | Set a new password: `uid`, `token`, `password` |
| `POST /api/account/recovery-keys/` | Show (creating if needed) the recovery keys: `password`; `regenerate: true` replaces them |
| `POST /api/account/change/` | Change `new_email` and/or `new_password` with `current_password`; `validate_only: true` checks only. An email change also needs `keys_confirmed: true` and the `recovery_set` shown. Signs out everywhere |
| `POST /api/account/recover/` | Recover with `email` (current or previous), an unused recovery `key` and a new `password` |
| `POST /api/account/export/` | Download the account's data as a JSON file: `password`. Returns an attachment marked `Cache-Control: no-store` |
| `POST /api/account/delete/` | Self-service soft deletion: `password`, `confirm: true`. Scrambles personal data, keeps gameplay history, signs out everywhere |
| `GET/POST /api/rooms/` | Public active rooms; create a squad (`level`: verdant/ember/glacier/tempest) |
| `POST /api/rooms/join/` | Join by six-character code |
| `GET /api/rooms/{code}/` | Member-only state and AI journal |
| `GET /api/rooms/{code}/nearby/` | Member-only PostGIS proximity query |
| `POST /api/rooms/{code}/ai/` | Member-only bounded Claude request |
| `GET /api/leaderboard/` | Completed public missions |
| `GET /api/feedback/` | Public board (accepted items of every type): `sort` (`top`/`new`) and `offset` (20 per page). Also returns the viewer's own `mine` submissions of every type and status, and `can_vote` |
| `POST /api/feedback/` | Submit feedback for review: `title`, optional `body`, `category` (`bug`/`idea`/`music`), `captcha_id`, `captcha_answer`. Optional, opt-in: `screenshot` (PNG/JPEG/WebP data URL, up to 1.5 MB) and `diagnostics` (Engine lab snapshot). `429` during the cooldown or over a limit; `400` for spam |
| `POST /api/feedback/{id}/vote/` | Set (`vote: true`) or remove (`vote: false`) an upvote on an accepted (public) item. A session that has not passed the CAPTCHA gets `403` with `captcha_required: true`; resend with `captcha_id` and `captcha_answer` |
| `/admin/feedback/feedback/` | Staff review queue: New, Planned, Done, Declined; attachments; edit and reply |
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
docker compose exec api python manage.py test game music accounts feedback --noinput -v 2

# Frontend build:
cd frontend
npm.cmd ci
npm.cmd run build

# End-to-end tests against the full stack (Edge on Windows by default):
$env:BASE_URL='http://127.0.0.1:8080'
$env:NETWORK_TESTS='1'
npm.cmd run test:e2e
```

The account tests need the CAPTCHA's test answer. Set `CAPTCHA_TEST_MODE=true` in `.env`, run `docker compose up -d api`, and set it back to `false` afterwards. The CAPTCHA test itself still checks that images change on request, after a wrong answer, after a failed sign-in and on reload. Account coverage signs up in the middle of a live squad, verifies from a second browser, signs out, resets the password and signs in again. A second test changes the password (including cancelling at the warning), abandons and then completes an email change behind the same recovery keys, reactivates, undoes a mistyped email with a recovery key, and regenerates keys. A third deletes an account mid-squad and checks the browser, squad, expedition and email. A fourth downloads an account's data mid-squad and checks the file's contents. The backend deletion tests dump the entire database and live Redis state to prove no email, callsign or prompt text survives. Emails are read from `docker compose logs api`, so leave `EMAIL_HOST` blank for that test. The feedback tests also need the test answer. In the first, a guest sends a bug report with an opt-in screenshot and Engine lab snapshot (which needs a rendered scene). A rapid second post is rate-limited, and a temporary staff user checks the attachments in the real admin. It then sets planned, done and declined, while a second player sees the report arrive on the public board (without its attachments) and leave it again. In the second, only accepted items reach the board, and guests and signed-in players each vote once after the CAPTCHA. The tests create and remove their staff user, account and feedback with `docker compose exec -T api python manage.py shell`. The rapid-repeat check relies on the default 60-second cooldown, so it does not pass on a machine too slow to submit twice within a minute. Set `MANAGE_PY` to another command that runs `manage.py` to use a stack outside Docker. Music coverage includes real browser playback, all repeat modes, personal ordering and preferences, new releases, keyboard isolation, and MP3 streaming during live gameplay. To verify an actual staff upload through nginx (creates and removes a temporary account, song and cover):

```powershell
Get-Content -Raw scripts/smoke_music.py | docker compose exec -T api python -
```

For frontend-only work, run `npm.cmd run dev` in `frontend`, then open `http://localhost:5173`. It starts in local preview if no API is reachable. Vite proxies to a locally running backend on port 8000 by default; production Compose does not expose that port. To use the Docker API and nginx media serving during frontend development, set `$env:API_PROXY_TARGET='http://localhost:8080'` and include the dev origin in `CSRF_TRUSTED_ORIGINS`. The Vite proxy rewrites the `Host` header, so also set `PUBLIC_SITE_URL=http://localhost:5173` to make emailed account links open the dev server.

Playwright captures desktop, mobile, and lab screenshots under `artifacts/`. Browser tests cover every destination, WASD/arrows, clean scene switching, native physics, mobile layout, focus-loss stopping, socket reconnection, session resume, shared movement, room isolation and unauthorized access rejection. Four separate squads also complete all four missions concurrently using only real WebSocket movement/interact messages; no positions or resources are injected into the server. Pure rule tests cover pulsing heat, frost speed, ordered relays, rescue and solo completion. API tests verify destination validation and PostGIS recovery. Integration tests mock/disable paid AI; the live credential check is separate and opt-in.

`npm audit` currently reports transitive advisories through Aura3D’s `@loaders.gl/textures → texture-compressor` dependencies (`image-size`, `sprintf-js`), without an upstream compatible fix. The app does not expose the compressor or accept uploaded 3D models; staff-uploaded music covers are validated by Django/Pillow and are never passed through Aura3D. These findings still need tracking when updating Aura3D; they have not been silently overridden. Vite is pinned to a patched 7.3.7. The engine build also warns about unused bundled humanoid/Basis assets and a large lazy Rapier chunk. The app uses its own hashed, uncompressed GLB; those absent optional assets are not required by the current scene.

Sources: [Aura3D repository](https://github.com/auraoneai/aura3d), [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create).

## Roadmap and TODO

The full plan, with details for each item, is in [ROADMAP.md](ROADMAP.md). Suggestions are welcome as [GitHub issues](https://github.com/engineermhayden/relay-game-music-marketing/issues).

**Foundations**

- [x] Optional player accounts (playing stays free and account-free). See [Optional player accounts](#optional-player-accounts)
- [x] In-game feedback and suggestions tool, with a public ideas board. See [Player feedback board](#player-feedback-board)
- [ ] Configurable analytics and a privacy page
- [ ] Continuous integration: tests, build and secret scanning on every pull request
- [ ] Support any AI provider for ORA, including self-hosted models, and drop the Anthropic API key requirement

**Community music**

- [ ] Music submissions from account holders, reviewed before they reach RELAY RADIO
- [ ] Artist profiles and a featured-artist spotlight
- [ ] Release premieres with an in-world light show
- [ ] Likes, a RELAY Top 10 chart, and listening stats for artists
- [ ] Squad listening party: one synced station for the whole squad
- [ ] A world that pulses to the beat of the current track
- [ ] Ask ORA for music by mood

**Watch and share**

- [ ] Spectator mode and a **Live now** list of public expeditions
- [ ] Recorded expeditions for account holders, with replays and MP4 downloads
- [ ] Highlight clips and a replay photo mode
- [ ] ORA mission debriefs

**More to play**

- [ ] Daily signal challenge with ghost runs
- [ ] New destinations: The Sunken Archive and The Drift Belt
- [ ] Achievements and earned cosmetics
- [ ] Gamepad support and accessibility options

**For developers**

- [ ] Step-by-step Aura3D tutorials built on RELAY's source
- [ ] Explore more of Aura3D: WebGPU, navmesh sentinels, skeletal animation, XR
- [ ] Contributor guide

**Operations**

- [ ] Scale the simulation beyond a single worker
- [ ] Moderation tools for callsigns, feedback and tracks
- [ ] Scheduled backups and resolution of the Aura3D `npm audit` advisories

## License

RELAY's source code is released under the [MIT License](LICENSE).

The MIT License does not cover the sample recordings in `marketing/sample-songs/`. They belong to their respective artists and are included only as demo content for the music player. Do not redistribute them without the rights holders' permission. The `ora.glb` model is separately dedicated to the public domain under CC0 1.0 (see `frontend/aura.assets.json`). Third-party dependencies remain under their own licenses.
