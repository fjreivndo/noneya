# Breachpoint

A browser FPS that crosses CS-style tactical rounds with Battlefield-style
all-out war. It has squad AI that plans and talks, peer-to-peer multiplayer,
and a crate/skin economy. Everything is one HTML file: double-click it.

```
Breachpoint v1.9.html     the game (built, self-contained, works offline)
desktop/                  Electron wrapper + LAN relay
src/                      source, concatenated in file order by build.js
build.js                  npm install && node build.js  →  Breachpoint v1.9.html
```

## Modes

| mode | map | what it is |
|---|---|---|
| **Defuse** | Dustyard | 5v5 rounds, first to 7, sides swap at 6. Buy menu, economy with loss bonus, bomb plant/defuse, kits, armor, one life per round. |
| **Conquest** | Ridgeline | Up to 16v16 on a 220 m valley. Five flags, tickets that bleed, four classes, squad spawns, jeeps, a tank per side, RPGs. |
| **Team Deathmatch** | either | Respawns, classes, first to 50. |
| **Sandbox** | Flatgrass (or any map) | Garry's Mod-style: spawn props, NPCs, weapons, jeeps and tanks, then build with the physics gun and tool gun. |

## Sandbox

Press **Q** for the spawn menu. It has these tabs:

- **Props:** 23 physics props, including crates, barrels, planks, sheets,
  concrete, furniture, a car wreck, balls and the melon.
- **Entities:** explosive barrels, health kits, ammo crates, balloons,
  dynamite, stations, and hinged / sliding / garage doors (E opens them).
- **Wiring:** buttons, switches, pressure plates, proximity sensors, timers,
  AND / OR / NOT / XOR gates, delays and toggle latches, and an alarm.
- **Lights:** bulbs, ceiling panels, neon tubes, floodlights and lanterns
  (E switches them).
- **NPCs:** Aegis and Vanta soldiers (pick their weapon and skill), zombies,
  citizens and target dummies.
- **Weapons:** everything in the game, with your skins and attachments on.
- **Vehicles:** jeeps, cars, plus tanks (W/S drive, A/D turn on the spot, mouse aims the turret, LMB fires the cannon; the crew is safe from bullets, so bring RPGs or M79s).
- **Tools**, **Saves** (named slots, export / import as a file, an Autosave
  when you leave) and **Options.**

Things spawn where you're aiming.

- **Physics gun (6).** Grab props or NPCs and move them. The mouse wheel
  sets distance, and holding **E** while moving the mouse rotates. **RMB**
  freezes in place and **R** unfreezes.
- **Tool gun (7):**
  - **Remover:** deletes things; RMB strips their constraints.
  - **Weld:** joins two things rigidly.
  - **Rope:** ties two points; RMB makes a tight rope.
  - **Balloon:** lift is set in kg it can carry.
  - **Thruster:** hold **T** to fire.
  - **Dynamite:** press **K** to blow it.
  - **Light, Color, Material** (wood, metal, concrete, glass, glow, chrome…),
    **Scale** and **Freezer.**
- **More tools (1.2):**
  - **Elastic:** a bungee between two points.
  - **Wheel:** hold **U** to drive and **J** to reverse. Weld a frame and add
    four wheels to build a car.
  - **Hoverball:** holds a prop at a height; move it with the physgun.
  - **Lamp:** a spotlight; **L** toggles it.
  - **Emitter:** smoke, sparks, fire, steam or confetti; **O** toggles it.
  - **Ignite:** sets props on fire. Fire hurts, spreads to wood and sets off
    explosive barrels.
  - **Duplicator:** right-click copies a whole welded build; left-click
    pastes it; Z undoes a paste in one go.
  - **Physical props:** heavy, light, bouncy, ice, or zero-g.
  - **Trail.**
- Tool gun and physgun reach is now about 450 m.
- **Z** undoes your last spawn. **V** toggles noclip.
- **NPC behavior.** Soldiers of your faction follow you and fight with you.
  The other faction hunts you. Zombies go for anything alive. Citizens run
  from gunfire and zombies. Dummies stand there and take it.
- **Physics.** Props use cannon-es. Bullets push them and explosions throw
  them. You can stand on props and shove the light ones.
- **Multiplayer.** Sandbox works in multiplayer too. The host runs the
  physics and everyone builds in the same world; people who join late get
  the whole build.


## New in v1.9

- **Ragdolls:** bodies go limp and get thrown by the hit that killed them
  (explosions throw hardest), settle on the level and on props, and get
  shoved by later explosions. Toggle in Settings.
- **More wiring** (Wiring tab, now grouped):
  - Inputs: keypad, key input, laser tripwire, damage sensor, prop sensor,
    toggle button, random.
  - Logic: NAND, NOR, pulse, set/reset latch.
  - Numbers: counter, constant, adder, comparator, number display, text
    screen. Wires carry numbers; non-zero is on. Latches, counters and
    comparators read their left half as input 1 and right half as input 2.
  - Outputs: turret, speaker, forcefield, lift, spawner, thumper.
  - Wire colours, "only show wires with the tool gun", and a Debugger tool.

## New in v1.8

- **Much more accurate guns** for everyone (less spread, bloom and recoil).
- **Fewer launchers:** Engineers only, 2 RPG rockets / 5 M79 grenades, no
  launcher refills from ammo boxes, and only a couple of Engineer bots per
  team.
- **Bots drive tanks:** they take free tanks, push objectives, hunt enemy
  armour and fire the cannon. Sandbox soldiers use tanks too.
- **Blood** on hits: sprays, wall and floor spatter, pools; fades out. Can be
  turned off in Settings.
- **Crosshair styles** (cross, T, dot, circle, cross + circle, chevron) and a
  themed **mouse cursor**, both in Settings.
- **Spawn fixes:** nobody spawns behind walls or in sealed-off pockets;
  sandbox NPCs and vehicles appear on your side of what you aim at.

## New in v1.7

- **Saves** for the sandbox: named slots, file export / import, Autosave.
- **Wiring:** place parts from the Wiring tab, then use the **Wire** tool:
  click an output (button, switch, plate, sensor, timer, gate), then what it
  powers. Doors open, lights switch, alarms sound, thrusters fire, wheels
  drive, lamps and emitters toggle, dynamite explodes. A button into a toggle
  latch makes a light switch; a plate into a door makes an automatic door.
- **Doors that work** and **lights** you switch with **E** or by wire. Lights
  share a small pool of real lights, so lots of them stay fast.
- **Vehicles with the physics gun** (grab, rotate, throw, freeze) and the
  **tool gun** (paint, freeze, ignite, copy, repair, remove), plus a Car.
- **Axis**, **Ball socket** and **Repair** tools.

## New in v1.6

- **Explosions reach twice as far** (grenades, launchers, tank shells, dynamite, barrels, vehicle wrecks), with a bigger fireball. The C4 is unchanged.
- **Tanks are tougher:** 2600 HP, about 10 RPG hits, and bullets barely scratch them.

## New in v1.5

- **Damage cooldown:** after taking a hit, further hits are ignored for 0.1 s, so bursts and focus fire can't delete you instantly. Every pellet of one shotgun blast still counts. Adjustable in Settings (0 to 0.5 s, 0 = off); in multiplayer the host's value applies.

## New in v1.4

- **Tanks** in Conquest (one per side) and the Sandbox spawn menu. 2600 HP since v1.6 (about 10 RPG hits).
- **Prices:** everything bought with credits (cases, keys, bundles, attachment unlocks) costs 3× more; skin sell values are 3× too. In-match Defuse prices are unchanged.
- **Scopes:** sniper, 4x ACOG, AUG and crossbow get full-screen reticles; iron sights and red dots block much less of the view.

## Weapons

There are 27 in all. New in 1.2:
- **Pistols:** Five-SeveN, Tec-9, .357 Magnum.
- **SMGs:** MAC-10, UMP-45.
- **Shotgun:** XM1014 auto shotgun.
- **Rifles:** Galil and FAMAS (3-round burst), AUG (built-in scope).
- **Sniper:** Auto-Sniper.
- **Specials:**
  - **Minigun:** spins up before it fires; hold RMB to keep it spinning.
  - **Crossbow:** silent, and bolts drop over distance and stick where they land.
  - **M79:** lobs explosive grenades in an arc.

The new guns are in the Defuse buy menu, as class alternatives in Conquest
and Team Deathmatch (the deploy screen), and in the sandbox spawn menu. The
**Arsenal Case** has skins for them.

**Range.** Each weapon type now has an effective range: full damage up
close, tapering to a floor.

| type | full damage to | floor | floor reached at |
|---|---|---|---|
| Pistols | 15 m | 45% | 45 m |
| SMGs | 18 m | 40% | 55 m |
| Shotguns | 6 m | 8% | 24 m |
| Rifles | 40 m | 62% | 130 m |
| LMGs | 35 m | 60% | 120 m |

Snipers don't fall off.

Bots won't waste ammo beyond their gun's range; they close in instead.
Distant targets also take longer for them to react to.

Two new settings:
- **View distance** stretches the fog, which now starts much farther out on
  Ridgeline and Flatgrass.
- **Bot sight distance** sets how far bots notice you.

## Medkits

Press **H** to use a medkit: it heals 50 HP over 2 seconds.
- Everyone spawns with one in Conquest, TDM and Sandbox, and Assault gets two.
- In Defuse you can buy one for $400.
- In Conquest and TDM the dead drop health packs and ammo that anyone can
  pick up. Hurt bots go for the packs and use their medkits in cover.
- Sandbox also has medkit pickups and health, armor and ammo stations.

## Attachments

Open **Armory → Gunsmith**. Unlock an attachment once with credits, and it
fits every gun it's compatible with. Each gun has four slots:

| slot | options |
|---|---|
| Optic | Red Dot, Holographic, 4x ACOG. You aim through the actual reticle. |
| Muzzle | Suppressor (quiet, no tracer, bots hear you from much closer), Compensator (−30% horizontal recoil) |
| Underbarrel | Vertical Grip (−22% vertical recoil), Laser (−35% hip spread, projects a visible dot) |
| Magazine | Extended Mag (+50% capacity, slower reload) |

The stat bars show what each change does. Other players see your
attachments, and bots carry random kits outside Defuse.

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
Empty slots fill with bots, and the lobby shows exactly which. With a team
size of 4 and 3 people on a team, that team gets 1 named bot. Hosts can turn
bot fill off, set any team size, balance teams, and use Play again or Back to
lobby after a match. If someone leaves, a bot takes over their
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
- **Keys:** each case opens with its own key (Ember, Glacier, Neon,
  Arsenal); Master Keys open any case. Buy keys one at a time or in bundles
  of 5 at 15% off.
- **Levels and drops:** matches give XP, and each level pays credits plus a
  key; every fifth level adds a case and a Master Key. Matches also drop
  cases, field-collection skins and keys.
- **Credits** come from matches: kills, assists, headshots, wins and MVPs.
  The victory screen itemises them.
- **Update log:** the What's New screen on the main menu lists every
  version's changes and opens by itself after an update.

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
