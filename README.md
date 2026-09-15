# simple-streamer

A Netflix-style TMDB browser + player — home page with rows (Continue Watching, Favorites,
Recommended For You, Trending, Popular), actor search and filmography pages, ratings, and
Continue Watching / Favorites backed by Postgres. The [mobile/](mobile/) app (React Native)
has the same feature set; this is its web counterpart, built as a handful of static pages
with no bundler. [webos/](webos/) packages this same web app as an installable LG webOS TV
app, navigable with a remote's D-pad instead of a mouse.

- [index.html](index.html) / [app.js](app.js) — home page: a hero banner, then rows for Continue Watching, Favorites, **Recommended For You** (seeded from those two via TMDB's `/{type}/{id}/recommendations`, merged/deduped, hidden until there's something to seed it from), Trending Now, Popular Movies, Popular TV. All rows are English-language-filtered and, where the endpoint allows it, ranked by rating. A search icon opens `search.html`.
- [search.html](search.html) / [search.js](search.js) — live-as-you-type search (movies, TV, **and actors** — TMDB's `/search/multi` already returns people). Actor results are round photos that open `person.html`.
- [person.html](person.html) / [person.js](person.js) — an actor's filmography (TMDB's `/person/{id}/combined_credits`), sorted by popularity. Reached from search or from clicking anyone in a Player page's Cast row.
- [player.html](player.html) / [player.js](player.js) — fetches full TMDB details and exposes them as `window.TMDB_DATA` (also mirrored into a `<script id="tmdb-data">` JSON blob). The `<iframe id="player-frame">` points at a custom embed API using the TMDB id: `/embed/movie/{id}` for movies, `/embed/tv/{id}/{season}/{episode}` for TV. Below the video: title/year/runtime/genres, IMDb/Rotten Tomatoes/Metacritic ratings (via OMDb), the overview, season chips, a Cast row (clickable, photos + character names), the episode list, and a "More Like This" row.
- [ui.js](ui.js) — shared card/row/hero rendering used by all four pages above (hover a card to preview title/year/overview — the mouse equivalent of the mobile app's long-press).
- [seasonEpisodePicker.js](seasonEpisodePicker.js) — the `<dialog>`-based season/episode picker opened by the **☰** badge on a TV card, so you can jump to a specific episode without leaving the browse page.
- [server.js](server.js) — Express server that serves the static frontend, proxies TMDB and OMDb requests (so those keys stay server-side), and stores Continue Watching / Favorites in Postgres ([schema.sql](schema.sql)).
- [tvnav.js](tvnav.js) — D-pad/remote-control navigation (arrow keys, OK, Back) loaded on every page above, so the same pages work with a TV remote as well as a mouse.
- [mobile/](mobile/) — the React Native (Expo) counterpart targeting iPhone, sharing this same backend and database. See [mobile/README.md](mobile/README.md) to run it on a real device via Expo Go.
- [webos/](webos/) — packages this web app as an installable LG webOS TV app. See [webos/README.md](webos/README.md) to build and side-load it with the webOS TV CLI.
- [dedicated-server/](dedicated-server/) — run this app unattended on a spare machine and reach it from your phone/laptop from anywhere via Tailscale, instead of only on the same Wi-Fi. See [dedicated-server/README.md](dedicated-server/README.md).
- [render/](render/) — the cloud alternative: deploy the backend to Render ([render.yaml](render.yaml)), reachable over HTTPS from anywhere. Requires the Basic Auth described below, since the service is public. See [render/README.md](render/README.md).

## Setup

### Windows (PowerShell)

1. Install [Node.js](https://nodejs.org/) and [PostgreSQL](https://www.postgresql.org/download/windows/) if you don't have them. The Postgres installer bundles `psql`/`createdb` under `C:\Program Files\PostgreSQL\<version>\bin` — add that folder to your `PATH` (or use the full path to the exe below) if the commands aren't found.
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Create your env file:
   ```powershell
   Copy-Item .env.example .env
   ```
   Then edit `.env` and fill in:
   - `TMDB_API_KEY` — a TMDB v3 API key or v4 read access token, from https://www.themoviedb.org/settings/api.
   - `OMDB_API_KEY` — optional, a free key from https://www.omdbapi.com/apikey.aspx. Only powers the IMDb/Rotten Tomatoes/Metacritic ratings on the player page — everything else works without it.
   - `DATABASE_URL` — a Postgres connection string, e.g. `postgres://postgres:YOUR_PASSWORD@localhost:5432/simple_streamer`. Use the password you set for the `postgres` user when Postgres was installed (the `postgres:postgres` default in `.env.example` usually won't match).
4. Create the database and load the schema. `createdb`/`psql` will prompt for the `postgres` user's password:
   ```powershell
   createdb simple_streamer
   psql -d simple_streamer -f schema.sql
   ```
   If you'd rather not use the command line, open **pgAdmin**, create a database named `simple_streamer`, then open its Query Tool, paste the contents of [schema.sql](schema.sql), and run it.
5. Start the app:
   ```powershell
   npm start
   ```
   Then open http://localhost:4173.

### macOS / Linux

1. `npm install`
2. `cp .env.example .env` and fill in `TMDB_API_KEY` and `DATABASE_URL` as described above.
3. Create the database and load the schema:
   ```bash
   createdb simple_streamer
   psql -d simple_streamer -f schema.sql
   ```
4. `npm start`, then open http://localhost:4173.

### Without Postgres

If you skip the `.env` / Postgres setup entirely, the app still works standalone: open `index.html` directly and it falls back to the old **API Key** dialog (paste a TMDB key, stored in `localStorage`, sent straight to TMDB) — Continue Watching and Favorites just won't be available in that mode.

## Continue Watching & Favorites

- The player listens for the embed's `PLAYER_EVENT` `postMessage` events and saves exact playback position (`player_progress`/`player_duration`, plus season/episode for TV) to Postgres every ~5s while playing. Resuming a title replays it via the embed's `startAt` param at the exact saved second — for TV, it jumps straight to the saved season/episode rather than reopening the picker.
- A row is removed automatically once the embed reports `completed`.
- Favoriting is independent of watch progress — toggle it from the **☆ Add to Favorites** button on the player page.
- Both lists are visible from the home page (`index.html`), each with a small **×** to remove an entry without opening it.
