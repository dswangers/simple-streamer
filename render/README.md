# Deploying the backend to Render

Puts the backend (`server.js` + Postgres) on [Render](https://render.com/)
so it's reachable from anywhere over HTTPS with no machine of your own to
keep running — the cloud alternative to [../dedicated-server/](../dedicated-server/).

The important difference: a Render service is **genuinely public**. Anyone
with the URL can reach it, and this app has no user accounts — so the
deployment requires HTTP Basic Auth (`BASIC_AUTH_USER` / `BASIC_AUTH_PASS`,
implemented in [../server.js](../server.js)). Without those set, anyone who
finds the URL could read and wipe your watch history and burn through your
TMDB/OMDb quota. The blueprint below won't let you skip them.

The Blueprint itself is [../render.yaml](../render.yaml) — it has to live at
the repo root for Render to auto-detect it, so only the docs are in here.

## 1. Deploy

1. Push this repo to GitHub/GitLab if it isn't already.
2. In Render: **New +** > **Blueprint**, connect the repo. It picks up
   [../render.yaml](../render.yaml) and proposes a web service plus a
   Postgres database.
3. It'll prompt for the four `sync: false` values:
   - `TMDB_API_KEY`, `OMDB_API_KEY` — same values as your local `.env`.
   - `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` — invent these; they're the
     username/password you'll type when you open the site.
4. Apply. `DATABASE_URL` is wired to the new database automatically, and
   `PORT` is provided by Render (the app already reads both).

## 2. Load the schema (one time)

The new database starts empty, so Continue Watching / Favorites will 500
until [../schema.sql](../schema.sql) has been applied:

1. In the Render dashboard, open the database and copy its **External
   Database URL**.
2. From your machine:
   ```bash
   psql "<external-database-url>" -f schema.sql
   ```

If you'd rather not install `psql`, paste the contents of `schema.sql` into
the database's SQL shell in the Render dashboard.

## 3. Connect to it

- **Browser**: open the service URL (`https://<name>.onrender.com`). The
  browser prompts for the Basic Auth username/password once, then caches it.
- **Mobile app**: in `mobile/.env` (see [../mobile/.env.example](../mobile/.env.example)):
  ```
  EXPO_PUBLIC_API_URL=https://<name>.onrender.com
  EXPO_PUBLIC_BASIC_AUTH_USER=<same as server>
  EXPO_PUBLIC_BASIC_AUTH_PASS=<same as server>
  ```
  React Native can't show a password prompt the way a browser does, so the
  app sends the credentials itself.
- **webOS TV app**: enter `https://<name>.onrender.com` on the first-launch
  screen ([../webos/README.md](../webos/README.md)). The TV's browser will
  prompt for the credentials like any other browser — and unlike the
  Tailscale route, this needs no special networking on the TV at all.

## Caveats worth knowing before you rely on this

- **Free Postgres is deleted after 30 days.** Render's free database plan
  expires; your watch history goes with it unless you upgrade to a paid
  plan or dump the data first.
- **Free web services sleep.** After ~15 minutes idle, the first request
  takes roughly a minute while it wakes back up.
- **The video embed is unchanged.** [../player.js](../player.js) still
  points at a third-party embed site; putting the backend on Render doesn't
  proxy or change that in any way.
- **Basic Auth is a single shared password**, sent over HTTPS. Fine for
  personal use; it's not per-user accounts, and there's no rate limiting or
  lockout on guesses.
- **`DATABASE_SSL=true`** is only needed if you point the service at a
  Postgres reached over the public internet. The blueprint uses Render's
  internal connection string, which doesn't need it.
