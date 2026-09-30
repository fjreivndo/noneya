> **Also in this repo:** [`breachpoint/`](breachpoint/) — a browser FPS (CS-style Defuse + Battlefield-style Conquest, squad AI, multiplayer, crates & skins). Open `breachpoint/Breachpoint v2.6.html`.

# Hollowreach Desktop

Hollowreach as a real desktop app, with a multiplayer server built into it.

Run it and you are hosting. Friends on your network type in your address and
they are in your world. There is no account, no lobby service, nothing to sign
up for — your machine is the server.

The game HTML is **not modified**. This wrapper opens it and hands it a socket
after it loads. Drop a newer `Hollowreach vX.html` into this folder and it
picks up the newest one automatically.

---

## Setup

You need [Node.js](https://nodejs.org) (v18 or newer). Then:

```
cd hollow-desktop
npm install          # downloads Electron, ~1 minute
npm start
```

That's it. The window opens, and the console prints the address friends use.

**Files in this folder:**

| file | what it is |
|---|---|
| `main.js` | the Electron app — starts the server, opens the game, wires them together |
| `relay.js` | the multiplayer server. No dependencies, runs on its own too |
| `hollow-relay/` | the same relay on Cloudflare — always up, `wss://`, free. For playing from a website |
| `Hollowreach v1.4.html` | the game. Replace with a newer build any time |
| `package.json` | tells npm what to install |

---

## Playing together

### Your friend joins without installing anything

They don't need this wrapper at all. Send them the `Hollowreach v1.4.html`
file, they open it, make a world **with your seed**, press `T` for the console
and type:

```
/connect ws://192.168.1.14:8080 theirname
```

That's the whole thing on their end. `/net status` checks it, `/say` talks,
`/net detach` leaves. Only you need to be running the server.

### Two players on this one computer (for playtesting)

Start the server once — `npm start`, or just `node relay.js 8080`. Then open
the game HTML in a **second browser** (Firefox if the first is Chrome), press
`T`, and type:

```
/connect local
```

Separate browsers keep separate saves and separate identities, so you get two
real players rather than one wearing two hats. Two tabs of the *same* browser
share storage, so use two different browsers.

### You host (easiest)

```
npm start
```

The terminal prints something like:

```
hosting on port 8080 — friends connect to:
  ws://192.168.1.14:8080
  ws://localhost:8080
```

Give a friend on the same wifi the `192.168.x.x` one. They run:

```
npm start -- --join ws://192.168.1.14:8080
```

Both of you should **use the same world seed**. Only block edits, positions and
chat travel over the wire — the terrain is generated on each machine from the
seed, so different seeds means two different worlds sharing one chat. The game
now says so plainly if it happens, but it's easier to just agree on a seed
before you both make a world.

### Friends outside your network

Two options:

**Port forwarding** — in your router's admin page, forward TCP port 8080 to
your computer. Friends then use your public IP (`whatismyip.com`) instead of
the `192.168` one. Free, but it means opening a port on your router.

**A tunnel** — no router changes:

```
npx localtunnel --port 8080
```

It prints a `https://something.loca.lt` URL. Friends join with the same URL but
`wss://` instead of `https://`:

```
npm start -- --join wss://something.loca.lt
```

Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:8080`) works the
same way and is faster.

### Server with nobody playing on it

If you want a machine that only hosts — a spare laptop, a VPS — skip Electron
entirely:

```
node relay.js 8080
```

That's the whole server. It needs nothing installed. Everyone else joins it
with `--join`.

---

## Options

```
npm start                                   host on 8080
npm start -- --port 9000                    host on a different port
npm start -- --join ws://192.168.1.14:8080  join someone
npm start -- --name koda                    the name others see
npm start -- --solo                         no networking at all
npm start -- --html "Hollowreach v1.4.html" pick a specific build
```

In game, `T` opens the console. `/net status` shows who's connected,
`/net name <you>` renames you, `/say hello` talks.

---

## Making an installer

If you want a real `.exe` / `.dmg` / `.AppImage` to hand to someone who
doesn't have Node:

```
npm install --save-dev electron-builder
npx electron-builder
```

The output lands in `dist/`. `package.json` already has the build config.
A Windows installer comes out around 90 MB, most of which is Chromium.

---

## What's tested

The relay was checked against three real WebSocket clients at once (fan-out is
correct — a sender never hears its own message — and a 70,000-byte message
survives the 16-bit length path intact), and then against two full game
instances talking through it: both saw each other join, positions tracked,
block edits crossed in both directions, chat went both ways, and leaving
dropped the peer count back to zero with no page errors on either side.

---

## Playing from a website (hollowreach.edgeone.dev)

**The proper fix is in `hollow-relay/` — deploy it once and multiplayer works
from your site with no machine of yours running.** Read that folder's README;
it's `npx wrangler deploy` and two console commands. The rest of this section
explains why, and the tunnel is the quick alternative.


A page served over **https may not open a plain `ws://` socket** — browsers
refuse it as mixed content before a packet leaves, so the game only sees
"connection failed". That is why multiplayer works from the downloaded file but
not from the hosted site. Localhost is exempt, which is why same-machine
testing still works there and playing with a friend does not.

You need a `wss://` address. The quickest free one:

```
node relay.js 8080
cloudflared tunnel --url http://localhost:8080
```

It prints something like `https://tidy-lamp-quiet.trycloudflare.com`. In the
game on the website, press `T` and:

```
/connect wss://tidy-lamp-quiet.trycloudflare.com
```

No certificates, no port forwarding, and it works for anyone on the site.
`npx localtunnel --port 8080` does the same job.

EdgeOne can proxy WebSocket traffic to an origin but cannot host the server
itself, so the relay stays on your machine (or on any small VPS, where
`node relay.js` behind TLS gives you a permanent address).

## Who owns what

As of v1.2 the host is authoritative. Whoever runs the server simulates the
creatures and holds the real chest contents; everyone else displays what they
are told, and asks the host to apply damage or chest changes. This is what
stops two people seeing the same wolf in two places, or both looting the same
chest. The desktop build claims authority automatically because it started the
server; from a browser, `/connect host [port]` claims it explicitly, and
`/net status` shows who holds it.

## How the multiplayer actually works

The game exposes `HollowNet`, which is transport-agnostic on purpose: give it
anything with a `send(text)` method and feed incoming text to
`HollowNet.receive(text)`. It speaks small JSON messages:

```
{t:'hello', id, name}                             a peer announcing itself
{t:'state', id, x,y,z,yaw,pitch,health,name}      position, 12× a second
{t:'edit',  id, x,y,z, block}                     a block changed
{t:'chat',  id, name, text}
{t:'bye',   id}
```

`relay.js` is a WebSocket server that broadcasts every message to everyone
except the sender. That's the entire protocol. It's written directly against
RFC 6455 rather than using the `ws` package, so the server half has zero
dependencies — you can copy `relay.js` anywhere Node runs and it works.

`main.js` injects the connection code into the page after load, so the game
file stays a normal standalone HTML file you can still open by double-clicking.

**What this design costs you:** it's authority-free. Everyone's client is
trusted. Fine for playing with friends, wrong for a public server — someone
could send an `edit` for any block anywhere. Adding validation means teaching
`relay.js` about the world, which is a much bigger project.

---

## Alternatives, if you'd rather not host

**Photon** (what you were looking at) — their `/lib/photon.js` is the file to
include; `/src/demo-loadbalancing` is the closest example to this use case.
You'd replace the WebSocket in the bootstrap with a Photon `LoadBalancingClient`
and route `onEvent` into `HollowNet.receive`. Free up to 20 concurrent users,
their servers do the hosting, no port forwarding. The tradeoff is an account, a
dependency, and a ceiling you can hit.

**PeerJS / WebRTC** — no server at all past the initial handshake, and the
lowest latency, but NAT traversal fails on some networks and you'd be
maintaining the peer mesh yourself.

**This** — no accounts, no limits, no third party, and the code is 200 lines
you can read. Costs you a port forward or a tunnel.
