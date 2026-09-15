# Deploying simple-streamer

End-to-end: get the backend into the cloud, then get an app icon on your
iPhone, plus the TV pointed at the same place.

The iPhone part needs **no Apple Developer account and no App Store** — the
web app installs to the home screen as a standalone app.

---

## Part 1: Deploy the backend to Render

Full detail in [render/README.md](render/README.md). Short version:

1. **Push this repo** to GitHub/GitLab.
2. **Render > New + > Blueprint**, connect the repo. It reads
   [render.yaml](render.yaml) and proposes a web service + Postgres.
3. **Fill in the prompted values:**
   - `TMDB_API_KEY`, `OMDB_API_KEY` — same as your local `.env`.
   - `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` — invent these. This is the
     username/password you'll type to get in. Not optional: the service is
     public and nothing else in the app checks who's calling.
4. **Apply.** `DATABASE_URL` and `PORT` are wired up automatically.
5. **Load the schema** (one time — Continue Watching/Favorites 500 without
   it). Copy the database's *External Database URL* from the Render
   dashboard, then:
   ```bash
   psql "<external-database-url>" -f schema.sql
   ```
6. **Test it:** open `https://<name>.onrender.com`. The browser prompts for
   the Basic Auth credentials, then the app loads.

---

## Part 2: Put it on your iPhone home screen

The app ships as an installable web app ([manifest.webmanifest](manifest.webmanifest)
plus the iOS meta tags in each page), so this takes about thirty seconds and
costs nothing:

1. Open `https://<name>.onrender.com` in **Safari** on the iPhone (must be
   Safari — Chrome/Firefox on iOS can't install to the home screen).
2. Enter the Basic Auth username/password.
3. Tap **Share** > **Add to Home Screen** > **Add**.

You get an icon labelled *Streamer* that opens **fullscreen with no address
bar**, with its own entry in the app switcher, its own icon, and a dark
status bar matching the app. Navigation between pages stays inside it.

### What you're not getting, to be clear

This is the web UI running fullscreen, not the React Native app in
[mobile/](mobile/). No offline support (it streams anyway), and no push
notifications. For an app whose whole job is playing video from a server,
that's nearly all of what a native build would give you.

### If it asks for the password every launch

iOS sometimes doesn't persist HTTP Basic Auth credentials into a standalone
home-screen app the way it does in Safari proper. If you find yourself
re-entering it on every launch, say so — swapping Basic Auth for a
cookie-based login (enter it once, stays logged in for months) is a small
change to [server.js](server.js) and fixes it properly.

---

## Part 3: Point the TV app at it

On the webOS app's first-launch screen, enter
`https://<name>.onrender.com` instead of a LAN address. The TV's browser
prompts for the Basic Auth credentials like any other browser.

This is *easier* than the Tailscale route — no special networking on the TV.
Build/install steps are unchanged: [webos/README.md](webos/README.md).

---

## Optional: a real native iPhone app

Only worth reading if you specifically want the React Native UI in
[mobile/](mobile/) as a true installed app. **This is the one thing here
that costs money: the Apple Developer Program is $99/year**, required for
installing a self-built app on a physical iPhone — there's no free path to
it from Windows. The config is ready in [mobile/eas.json](mobile/eas.json)
if you ever want it:

```bash
npm install --global eas-cli
cd mobile
eas login
eas init

# Bake in where the backend lives
eas env:set --name EXPO_PUBLIC_API_URL --value https://<name>.onrender.com --environment production --visibility plaintext
eas env:set --name EXPO_PUBLIC_BASIC_AUTH_USER --value <your-user> --environment production --visibility sensitive
eas env:set --name EXPO_PUBLIC_BASIC_AUTH_PASS --value <your-pass> --environment production --visibility sensitive

eas device:create                              # register the iPhone's UDID
eas build --platform ios --profile preview     # builds on EAS's Macs; Windows is fine
```

Note that `EXPO_PUBLIC_*` values are compiled into the JS bundle, so the
password ships *inside the app binary* and is extractable. That's inherent
to putting credentials in a client app — fine for keeping scanners out of
your watch history, but don't reuse that password anywhere else.

Expo Go is the free alternative, but it needs Metro (`npx expo start`)
running on a machine somewhere, which defeats the point of a standalone app.

---

## Things that will bite you later

- **Render's free Postgres is deleted after 30 days.** Your watch history
  goes with it. Upgrade the database to a paid plan if you want it to
  persist, or dump it periodically.
- **Free Render web services sleep after ~15 min idle** — the first request
  takes roughly a minute to wake. Noticeable when you open the app cold.
- **Basic Auth is one shared password** over HTTPS. No per-user accounts,
  no rate limiting, no lockout on repeated guesses. Fine for personal use;
  don't reuse the password elsewhere.
- **The video embed is a third-party site** ([player.js](player.js)) and is
  unaffected by any of this — deploying to Render doesn't proxy it, and
  whether it plays is outside this app's control.

---

## Staying on your own hardware instead

If you'd rather not use the cloud at all, [dedicated-server/](dedicated-server/)
covers running this on a spare machine reachable from anywhere over
Tailscale — no public exposure, no Basic Auth needed, no monthly anything.
The home-screen install in Part 2 works against that too.
