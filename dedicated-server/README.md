# Running simple-streamer as a dedicated, remotely-reachable server

This turns a spare/always-on computer into the one place that runs
`simple-streamer` (the Express server + Postgres from the project root), so
your phone or laptop can connect to it from anywhere — not just when you're
on the same Wi-Fi — using [Tailscale](https://tailscale.com/) rather than
exposing it to the public internet (the app has no login/auth, so it should
never be reachable from the open internet — see the discussion that led
here).

Nothing about the app itself changes for this — it's the same
`node server.js` from the project root. This directory just holds the extra
pieces needed to run it unattended, always-on, on a machine other than the
one you actively use.

## 1. Install the app on the dedicated machine

Follow the root [README.md](../README.md)'s Setup section on that machine:
Node.js + Postgres, `npm install`, `.env` (TMDB/OMDB keys, `DATABASE_URL`),
`createdb` + `schema.sql`. Confirm `npm start` works and
`http://localhost:4173` loads locally before moving on.

## 2. Install Tailscale

On the dedicated machine **and** every phone/laptop you want to connect
from:

1. Install Tailscale ([tailscale.com/download](https://tailscale.com/download)).
2. Sign in with the same account on all of them, so they join the same
   private network (your "tailnet").
3. On the dedicated machine, find its Tailscale IP — the Tailscale app shows
   it, or run `tailscale ip -4` in a terminal. It looks like `100.x.y.z`.
   That address is what you'll use from everywhere else, instead of a LAN IP
   or a public domain.

`server.js` already binds to all network interfaces, so nothing needs to
change there — once Tailscale is up, `http://100.x.y.z:4173` just works from
any other device on the tailnet.

## 3. (Optional) Also host the mobile app's Expo dev server here

If you want this same machine to serve the React Native app to Expo Go too
— not just the web app — install the mobile app's dependencies as well:

```bash
cd mobile
npm install
cp .env.example .env
```

Then edit `mobile/.env` and set:

```
EXPO_PACKAGER_HOSTNAME=<tailscale-ip>
```

This tells Metro to advertise its Tailscale address instead of whatever LAN
IP it would otherwise guess — and, as a side effect, `mobile/src/config.js`
picks up that same address for the backend automatically, so you don't need
to *also* set `EXPO_PUBLIC_API_HOST` when both live on this one machine.

## 4. Keep it running unattended

You don't want to leave terminal windows open forever, so make everything
start on its own:

### Windows

```powershell
cd dedicated-server
.\install-windows-startup.ps1
```

This adds Startup-folder shortcuts for both [run-server.cmd](run-server.cmd)
(the backend) and [run-expo.cmd](run-expo.cmd) (the Expo dev server, if you
set it up in step 3) so both launch every time you log in. No admin rights
or third-party tools needed. Skip the Expo shortcut with
`.\install-windows-startup.ps1 -SkipExpo` if you didn't set that up. If the
machine should come back up fully unattended after a power loss/reboot,
also turn on auto-login for that Windows account (Settings > Accounts >
Sign-in options, or `netplwiz`).

To start either right now without rebooting, just double-click
`run-server.cmd` / `run-expo.cmd`.

### Linux (systemd)

Edit the paths/username in [simple-streamer.service](simple-streamer.service)
(and [simple-streamer-expo.service](simple-streamer-expo.service) if you set
up step 3), then:

```bash
sudo cp dedicated-server/simple-streamer.service /etc/systemd/system/
sudo cp dedicated-server/simple-streamer-expo.service /etc/systemd/system/   # optional
sudo systemctl daemon-reload
sudo systemctl enable --now simple-streamer
sudo systemctl enable --now simple-streamer-expo   # optional
```

Check status with `systemctl status simple-streamer` and follow logs with
`journalctl -u simple-streamer -f` (swap in `-expo` for the other one).

### macOS

There's no launchd plist here yet — for now, running things in a
`screen`/`tmux` session (so they survive closing the terminal) is the
simplest option; ask if you want proper `launchd` agents added.

### Connecting Expo Go without a QR code

Since this runs headless, you won't have a terminal showing a QR code to
scan. In Expo Go, use **"Enter URL manually"** instead and type:

```
exp://<tailscale-ip>:8081
```

## 5. Connect to it

- **Browser** (phone or computer): `http://<tailscale-ip>:4173`.
- **Mobile app**, if you set up step 3: open Expo Go on your phone and enter
  `exp://<tailscale-ip>:8081` manually (see above) — no need to run
  `expo start` yourself at all. If instead you're running `expo start` from
  your own dev laptop and only want the *backend* on the dedicated server,
  skip step 3 and set `EXPO_PUBLIC_API_HOST=<tailscale-ip>` in `mobile/.env`
  instead (see [mobile/.env.example](../mobile/.env.example)).
- **webOS TV app**: on the TV's first-launch screen (see [../webos/README.md](../webos/README.md)),
  enter `http://<tailscale-ip>:4173`. Caveat: webOS has no native Tailscale
  client, so this only works if the TV can otherwise route to that
  Tailscale IP — e.g. it's on the same LAN as the dedicated machine, or your
  home router/Tailscale subnet-router setup already bridges the two. If the
  TV is just sitting on your home network next to the dedicated machine,
  its regular LAN IP works fine too and you don't need Tailscale for it at
  all.
