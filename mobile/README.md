# simple-streamer (mobile)

A React Native / Expo port of the web app, optimized for iPhone. Same backend, same
Continue Watching / Favorites in Postgres — this just adds a native client.

- [App.js](App.js) — navigation shell (dark-themed native stack: Home → Search / Player).
- [src/screens/HomeScreen.js](src/screens/HomeScreen.js) — Netflix-style browse screen: a hero banner (trending pick), then horizontal rows for Continue Watching, Favorites, **Recommended For You** (seeded from whatever's in Continue Watching/Favorites via TMDB's `/{type}/{id}/recommendations`, merged and deduped — hidden entirely until there's something to seed it from), Trending Now, Popular Movies, and Popular TV (via TMDB's `/trending` and `/discover/{type}`). A search icon in the header opens `SearchScreen`. All of these (plus "More Like This" on the Player screen) are filtered to `original_language=en` and, where the endpoint doesn't support a minimum-vote sort itself, ranked by rating client-side.
- [src/screens/SearchScreen.js](src/screens/SearchScreen.js) — the old search box + results grid, now its own screen (with a clear/× button on the input). Results include actors (TMDB's `/search/multi` already returns `person` results, previously filtered out) shown as round photos; tapping one opens `PersonScreen`.
- [src/screens/PersonScreen.js](src/screens/PersonScreen.js) — an actor's filmography (TMDB's `/person/{id}/combined_credits`), sorted by popularity. Reached from search or from tapping anyone in a Cast row.
- [src/components/MediaCard.js](src/components/MediaCard.js) — the poster card used everywhere: a thin progress bar for in-progress titles, a **☰** badge on TV cards that opens the season/episode picker without leaving the browse screen, a **×** to remove from Continue Watching/Favorites, and a long-press "hold to preview" (title/year/overview) that release cancels.
- [src/components/SeasonEpisodePicker.js](src/components/SeasonEpisodePicker.js) — the bottom-sheet modal that **☰** opens: season chips + episode list (TMDB's `/tv/{id}/season/{n}`), selecting an episode jumps straight into `PlayerScreen` at that season/episode.
- [src/screens/PlayerScreen.js](src/screens/PlayerScreen.js) — loads the embed URL in a `WebView`, relays its `PLAYER_EVENT` messages back into the same Continue Watching / Favorites API the web app uses, and resumes at an exact timestamp the same way. Below the video: title/year/runtime/genres, IMDb/Rotten Tomatoes/Metacritic ratings (via OMDb — see below), the overview, a Cast row (photos + character names, from the `credits` TMDB already returns), and — below the season/episode list on a TV show — a "More Like This" row (TMDB's `/{type}/{id}/similar`) that pushes a new Player screen so you can back out to the previous title. The season/episode defaults to (in order) whatever was passed in via navigation (from the picker modal), then whatever Continue Watching last saved, then season 1 episode 1.
- [src/config.js](src/config.js) — points the app at the backend. It auto-detects your computer's LAN IP from Expo's own dev server address, so you shouldn't need to configure anything by hand.

iPhone-specific choices: dark `userInterfaceStyle`, safe-area insets on every screen, the Home screen is portrait-locked while the Player screen unlocks rotation (so video can go landscape/fullscreen), and the WebView is configured for inline + fullscreen playback (`allowsInlineMediaPlayback`, `allowsFullscreenVideo`).

## Running it on your iPhone (no Mac needed)

1. Make sure the backend is running first — from the **parent** `simple-streamer` folder (not this one):
   ```powershell
   cd ..
   npm start
   ```
   Leave that running. It serves the API and Postgres-backed Continue Watching / Favorites that this app calls. Ratings need `OMDB_API_KEY` set in the parent folder's `.env` (free key: https://www.omdbapi.com/apikey.aspx) — everything else works fine without it, the ratings row on the Player screen just won't show up.
2. Install the **Expo Go** app on your iPhone from the App Store.
3. Make sure your iPhone and your PC are on the **same Wi-Fi network**.
4. From this `mobile` folder:
   ```powershell
   npm install
   npm start
   ```
   This opens Expo's dev tools and prints a QR code in the terminal.
5. Open the iPhone **Camera** app and point it at the QR code — it'll show a notification to open in Expo Go. Tap it.
6. If Windows shows a firewall prompt the first time you run `npm start`, click **Allow access** for Node.js/Expo on your private network — otherwise the phone can't reach the dev server or the API.

If the app loads but Continue Watching/Favorites don't show up, double check the backend (step 1) is actually running and that both devices are on the same network — `src/config.js` derives the API host from the same IP Expo's QR code uses, so if Expo Go can load the app at all, the API should be reachable too.

## Quick sanity checks without a phone

```powershell
npm run web
```

Opens the app in a browser. Useful for iterating on the search screen, lists, and navigation quickly — but the `WebView` (and therefore actual video playback) doesn't work in a browser; test that on a real device.

## Building a real standalone app

Everything above runs through Expo Go, which is enough for development and personal use. If you eventually want an installable `.ipa` (e.g. for TestFlight), that's done via [EAS Build](https://docs.expo.dev/build/introduction/) — it builds in the cloud, so a Mac still isn't required:

```powershell
npx eas login
npx eas build --platform ios
```

That requires a free Expo account, and an Apple Developer account if you want to distribute beyond your own devices.
