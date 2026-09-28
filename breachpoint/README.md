# Breachpoint

A browser FPS that crosses CS-style tactical rounds with Battlefield-style
all-out war. It has squad AI that plans and talks, peer-to-peer multiplayer,
and a crate/skin economy. Everything is one HTML file: double-click it.

```
Breachpoint v1.0.html     the game (built, self-contained, works offline)
desktop/                  Electron wrapper + LAN relay
src/                      source, concatenated in file order by build.js
build.js                  npm install && node build.js  →  Breachpoint v1.0.html
```

## Modes

| mode | map | what it is |
|---|---|---|
| **Defuse** | Dustyard | 5v5 rounds, first to 7, sides swap at 6. Buy menu, economy with loss bonus, bomb plant/defuse, kits, armor, one life per round. |
| **Conquest** | Ridgeline | Up to 16v16 on a 220 m valley. Five flags, tickets that bleed, four classes, squad spawns, jeeps, RPGs. |
| **Team Deathmatch** | either | Respawns, classes, first to 50. |

## The AI

Each team has a **commander**. Every bot has its own **brain**. Everything
the commander decides goes out on the radio, so you can watch the plan happen.

**Defuse, attacking.** The commander picks a plan each round:

- **rush**: everyone through one route
- **split**: two groups stage on two routes and wait for the call
- **default**: spread out, gather info, then hit whichever site had fewer
  defenders spotted
- **fake**: two bots make noise at one site while the rest stage for the other

Utility carriers throw smokes and flashes at the site's chokes on the execute
call. The carrier plants once the site is quiet, and everyone takes post-plant
angles. If the carrier dies, the nearest bot is sent to pick up the bomb.
Staging routes avoid walking through the sites. Plans are chosen from how
well each site has gone before, and that memory persists between matches.

**Defuse, defending.** The commander sets a 2-1-2 hold. When two or more
attackers are seen on a site, it calls a rotation and leaves one anchor in
case it's a fake. After a plant, the team gathers at a retake point and pushes
together. The closest bot defuses once the area is clear. If there isn't
enough time left, it calls a save. Defenders also learn which site attackers
favor and stack it.

**Conquest.** Bots form four-person squads. The commander scores every flag
(threatened, neutral, enemy-held, distance) and spreads squads across them.
Members follow the leader in a wedge, spread out on the flag, and respawn on
their leader. When a squad is pinned, one member is sent wide to flank.

**Every bot:**

- Sees with a vision cone and line of sight. Smoke really blocks it.
- Hears footsteps and gunfire.
- Aims with a reaction delay, starting error that settles over time,
  target leading and partial recoil control.
- Counter-strafes to shoot accurately at range and strafes up close.
- Tap-fires at distance.
- Falls back to cover to reload when hurt.
- Grenades enemies that went behind cover.
- Shares every sighting with the team. That's what the red dots on your
  radar are.

Bot skill has four levels: Recruit, Regular, Veteran and Elite.

## Multiplayer

**Multiplayer → Host a room** gives you a five-letter code. Friends enter it
under **Join**, and that works across the internet. It uses WebRTC through
the free PeerJS broker, so there's no server to run. The host simulates the
bots and all the rules; clients move themselves and report their hits.
Empty slots fill with bots. If someone leaves, a bot takes over their
soldier. People can also join a match that's already running.

Other codes:

- `local:ABCDE` connects tabs of the same browser. Serve the file over
  `http://`, because tabs opened from `file://` can't see each other.
- `ws://host:port` uses a broadcast relay: the desktop app's, or
  `node relay.js`. To host on one, type its address in the box and press
  Host.

If a strict NAT blocks WebRTC, use the LAN relay.

## Crates and skins

- **Rarities:** Common, Uncommon, Rare, Epic, Legendary, Mythic and Exotic
  (★ knives: Talon, Flip-Wing, Spike Bayonet).
- **Cases:** Ember, Glacier and Neon. Each needs a key to open. You get the
  CS-style scrolling reel with rarity odds listed on every case.
- **Every copy is unique.** It has a float that sets its wear (Factory New
  down to Battle-Scarred), a pattern seed and a 10% StatTrak™ chance. Skins
  are painted procedurally, so the same skin looks different from one seed
  to the next. Rare seeds (a blue-gem Case Hardened, a gem Doppler) are
  worth more.
- **What you can do with them:** equip them (they show in first person and
  on your soldier for other players), inspect, sell for credits, and sign
  **trade-up contracts** (10 of one rarity → 1 of the next, from the same
  collections, output float = input average).
- **Credits** come from matches: kills, wins and MVPs. Matches also drop
  cases and field-collection skins.

Everything is saved in the browser's localStorage.

## Controls

`WASD` move · `Shift` walk (Defuse) / sprint · `Ctrl`/`C` crouch · `Space` jump ·
`LMB`/`RMB` fire / aim (grenades: throw / lob) · `R` reload · `1-5` weapons, grenades,
RPG · `X` last weapon · `E` plant, defuse, jeep · `B` buy · `Q` spot · `G` gadget ·
`F` inspect · `Tab` scores · `Y`/`Enter` chat · `Esc` pause

## Building

```
cd breachpoint
npm install        # three.js 0.160 and PeerJS 1.5, inlined into the build
node build.js
```
