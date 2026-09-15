# simple-streamer for LG webOS TVs

A small native-feeling wrapper so simple-streamer installs and launches like
any other app on an LG smart TV, using the D-pad instead of a mouse. It does
**not** bundle its own copy of the web app — it's a tiny "connect" screen
([index.html](index.html)) that points the TV at the simple-streamer server
already running on your network (see the [root README](../README.md) for
setting that up), the same way the [mobile/](../mobile/) app does.

- [appinfo.json](appinfo.json) — the webOS app manifest (id, icons, etc.), read by `ares-package`.
- [index.html](index.html) — first screen shown on launch: enter the server's LAN address (e.g. `http://192.168.1.50:4173`), it's saved on the TV and remembered next time, then the app navigates there. Everything after that — home page, search, player — is the same simple-streamer web app, running from your server, with no code duplicated here.
- [icon.png](icon.png) / [largeIcon.png](largeIcon.png) — placeholder app icons (80×80 / 130×130). Swap these for real artwork before distributing.

Remote-control (D-pad) navigation for the actual app pages — arrow keys to
move between rows/cards, OK to select, Back to go back — lives in
[../tvnav.js](../tvnav.js) and is loaded on every page of the main app, so it
works here without any of those pages needing to know they're running on a TV.

## Prerequisites

- A TV or emulator in **Developer Mode**: install the "Developer Mode" app from the LG Content Store, sign in, and note the IP address and passphrase it shows.
- The [webOS TV CLI](https://webostv.developer.lge.com/develop/tools/cli-installation) (`@webosose/ares-cli`):
  ```bash
  npm install -g @webosose/ares-cli
  ```
- The simple-streamer server (root of this repo) running and reachable from the TV's network — `npm start` there, then confirm you can open `http://<your-computer-ip>:4173` from another device on the same Wi-Fi/LAN. Note the computer's LAN IP (`ipconfig` on Windows, `ifconfig`/`ip a` on macOS/Linux) — you'll type this into the TV on first launch.

## Register the device once

```bash
ares-setup-device
```
Follow the prompts using the IP and passphrase from Developer Mode on the TV.

## Build, install, and launch

From this `webos/` folder:

```bash
ares-package .
ares-install ./com.simplestreamer.tv_1.0.0_all.ipk -d <device-name>
ares-launch com.simplestreamer.tv -d <device-name>
```

`<device-name>` is whatever `ares-setup-device` named it (list registered
devices with `ares-setup-device -list`).

On first launch, the TV shows a "Simple Streamer" connect screen — use the
D-pad to enter your server's address (e.g. `http://192.168.1.50:4173`) and
press OK on **Connect**. It's remembered for next time; to point it at a
different server later, clear the app's storage from webOS Settings > Apps,
or just overwrite the address on that screen again (it re-shows on relaunch
after the app has been fully closed, not just backgrounded).

## Notes / limitations

- This app talks to your simple-streamer server over plain HTTP on your local network — same trust model as the mobile app. Don't expose that server to the public internet.
- The video embed used by [player.js](../player.js) is a third-party site loaded in an iframe; whether it plays correctly depends on that site being compatible with the webOS browser engine, which is outside this app's control.
- Older webOS versions (roughly webOS ≤ 4, on older Chromium) may not support every modern JS feature the pages use (`fetch`, ES modules, `<dialog>`). Tested primarily against recent webOS (5+); if you're targeting an older TV, check those pages load correctly first via `ares-launch --inspect` (opens a remote Chrome DevTools session).
