# Photon setup guide

Breachpoint's internet multiplayer and the Trade Hub run on **Photon Cloud**
(Photon Realtime, the JavaScript SDK from Exit Games). This guide covers
getting an App ID, putting it in the game, and what to check when something
doesn't connect.

**Your App ID is already set up.** `photon.config.json` in this folder holds
`2198cb04-4e27-4d85-aae3-f3b5d60b2a9d` with region `eu`, and the prebuilt
`Breachpoint v2.6.html` has it built in. Anyone who opens that file is
online through your Photon app. Read on only to change the App ID or region,
build the game yourself, or fix connection problems.

---

## 1. What goes over Photon

Everything that crosses the internet uses one Photon link:

| Feature | How it travels |
|---|---|
| Lobby (teams, mode, map, bots) | host → everyone |
| Match start, spawns, rounds, kills, flags, bomb | host → everyone |
| World snapshots (players, bots, vehicles, props), 15× a second | host → everyone, one event per tick |
| Your movement, shots, hits, grenades, rockets, vehicle seats | you → host |
| Chat, team radio, speech bubbles, emotes | through the host to everyone |
| Sandbox building (props, welds, wiring, saves) | through the host to everyone |
| Zombies waves, injuries, downed/revive | host → everyone |
| **Trade Hub**: presence, chat, trade offers | its own Photon room, `BP-TRADEHUB` |

The game is still **host-authoritative**. The player who hosts runs the bots,
rules and damage, and Photon relays messages between players. You don't need
a server of your own.

Two offline options stay as they were and don't use Photon:
- `local:ABCDE`: two tabs of the same browser, for testing.
- `ws://192.168.x.x:8080`: the LAN relay built into the desktop app, for
  playing without internet.

---

## 2. Get a Photon App ID (skip if you're keeping the current one)

1. Go to **https://dashboard.photonengine.com** and sign up (free).
2. Click **Create a new app**.
3. Set **Application type** to *Multiplayer Game*. Set **Photon SDK** to
   **Realtime** (not PUN, Fusion, Quantum, Chat or Voice).
4. Give it a name, e.g. *Breachpoint*, and click **Create**.
5. The new app shows an **App ID**, a long string like
   `2198cb04-4e27-4d85-aae3-f3b5d60b2a9d`. Copy it.

The free plan allows **20 players online at the same time** (CCU) across all
rooms, including the Trade Hub. You can buy more CCU from the same dashboard
later; nothing in the game changes.

---

## 3. Put the App ID in the game

There are three ways. Pick one.

### A. Build it in (recommended, and already done)

Edit `photon.config.json` in the `breachpoint/` folder:

```json
{
  "appId": "2198cb04-4e27-4d85-aae3-f3b5d60b2a9d",
  "region": "eu"
}
```

Then rebuild:

```
cd breachpoint
npm install
node build.js
```

The build prints `Photon App ID baked in (region eu)`. The new
`Breachpoint vX.Y.html` and `site/index.html` both contain the App ID.

A Photon App ID isn't a password. Every client has to know it to connect, so
committing it to the repository is normal.

### B. Environment variables (CI, Cloudflare)

If you'd rather not commit the file, set these in your build environment
(for example Cloudflare → Workers → Settings → Build → Variables):

```
PHOTON_APP_ID=2198cb04-4e27-4d85-aae3-f3b5d60b2a9d
PHOTON_REGION=eu
```

They override `photon.config.json`.

### C. Paste it in the game

Open **Multiplayer → Photon settings**, paste the App ID and pick a region.
It's saved in that browser only. A value here overrides the built-in one, and
clearing the box goes back to the built-in App ID.

---

## 4. Regions

Photon runs servers around the world. **Everyone who plays together must
use the same App ID and the same region.** The default is `eu`. Other
choices are in Multiplayer → Photon settings: `us`, `usw`, `cae`, `sa`,
`asia`, `jp`, `kr`, `in`, `au`, `za`, `uae`, `tr`.

Pick the one closest to most of your players. To change the default for
everyone, change `region` in `photon.config.json` and rebuild.

---

## 5. Playing

- **Host:** Multiplayer → *Host a room*. You get a 5-letter code (the Photon
  room is `BP-<code>`).
- **Join:** Multiplayer → type the code → *Join*, or click the game under
  **Open games**. That list shows every open Breachpoint room on your App
  ID and region.
- **Trade Hub:** Main menu → *Trade Hub*. Everyone in it can chat. Click
  *Trade* next to a name, both build offers (skins, cases, keys, credits),
  both press **Ready**, then both press **Confirm trade**.

Players on different game versions don't see each other's rooms. Photon's app
version is set to `breachpoint-<version>`, so everyone should update to the
same build.

---

## 6. Troubleshooting

| Message | Fix |
|---|---|
| *Internet play needs a Photon App ID* | No App ID in the build or settings. See step 3. |
| *Photon rejected the App ID* | Typo, or the app isn't a **Realtime** app. Create a Realtime app (step 2). |
| *Could not reach Photon Cloud* | No internet, or a firewall blocks outgoing secure websockets to `*.photonengine.io` on ports **19090–19093**. School and work networks often block these, so try another network. |
| *No game with that code* | The code is wrong, the host left, or you're on a different **region** or **version** from the host. |
| *That game is full* | The room holds 16 players. |
| *Photon's player limit for this App ID is reached* | The free plan's 20 CCU is used up (the Trade Hub counts too). Wait, or raise the CCU in the dashboard. |
| *That Photon region is not available for this App ID* | Some apps are limited to certain regions (dashboard → your app → *Edit*). Pick an allowed one. |
| Lag or rubber-banding | Pick a closer region. The host's connection matters most, because everyone's updates go through the host. |

The Photon dashboard (**Analyze** tab) shows live CCU, rooms and messages per
second, which helps check whether players are really connecting.

---

## 7. Limits and costs

- **CCU:** 20 at once on the free plan, counted per App ID. A 4-player match
  with 2 people in the Trade Hub uses 6.
- **Messages:** Photon's soft limit is about 500 messages per second per
  room, counting each delivery. The host sends 15 snapshots a second (one
  event, delivered to every other player), and each player sends about 20
  input updates a second. An 8-player match uses roughly 250 messages a
  second, inside the limit.
- **Traffic:** snapshots are compact JSON. A busy 8-player Conquest match is
  roughly 30–60 KB/s for the host.

---

## 8. Trading: how safe is it?

Trades are checked on both machines. Each step carries a fingerprint of both
offers, so a player can't swap an item at the last second, and received
items are checked against the skin catalogue.

However, **inventories live in each player's browser** (local storage). There's
no central server holding them, so someone who edits their browser data or
modifies the game could fake items. Trade with people you know. If you ever
want a real economy, you'd need a trusted backend (Photon WebHooks or your
own server) to own the inventories. That's a separate project.

---

## 9. For developers

- The SDK is the npm package `photon-realtime` (Exit Games, v4.4.0).
  `build.js` inlines it, removes the Node-only websocket shim, and uses the
  browser's own `WebSocket`.
- The networking code is in `src/35_photon.js`. `Net.photonLink()` gives
  Photon the same link interface the rest of the game already used (`send`,
  `close`, and `ready` / `open` / `connect` / `data` / `close` / `error`
  handlers), so the game logic in `src/10_net.js` didn't change.
- Game messages are Photon event code **1**. The Trade Hub uses **10**
  (presence, chat) and **11** (trades).
- The host creates the room. Clients find the host through the room's master
  client, say `_hello`, and get `_welcome` back before the lobby syncs.
- `photon.config.json` can also set `"appVersion"` to split players into
  separate pools on purpose.
