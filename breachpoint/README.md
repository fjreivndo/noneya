# Breachpoint

A browser FPS that crosses CS-style tactical rounds with Battlefield-style
all-out war. It has squad AI that plans and talks, peer-to-peer multiplayer,
and a crate/skin economy. Everything is one HTML file: double-click it.

```
Breachpoint v3.0.html     the game (built, self-contained, works offline)
desktop/                  Electron wrapper + LAN relay
src/                      source, concatenated in file order by build.js
build.js                  npm install && node build.js  →  Breachpoint v3.0.html
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
- **Vehicles:** jeeps, cars, motorbikes, quad bikes, APCs, helicopters, attack helicopters, jets, speedboats, plus tanks (W/S drive, A/D turn on the spot, mouse aims the turret, LMB fires the cannon; the crew is safe from bullets, so bring RPGs or M79s).
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


## New in v3.0

- **New modes** (Play lists every mode now; Zombies was missing from solo):
  - **Breakthrough**: Vanta attacks the flags sector by sector, Aegis holds.
    Attackers have tickets and get reinforcements per sector taken.
  - **Royale**: everyone for themselves. HALO drop, loot crates (`E`), a
    storm that closes in over five stages; last one standing wins.
  - **Co-op missions**: your squad against Vanta bots. Silence the Guns
    (plant charges on three artillery pieces), Hostage Rescue (free the
    scientist and bring them out alive), Data Raid (download from two
    terminals). Shared lives, enemy reinforcements, extraction.
  - **Map editor**: build maps from walls, floors, blocks, stairs, crates,
    sandbags, fences and containers; place spawns, flags and vehicles; save
    and play them in TDM, Zombies, Royale, Co-op and Sandbox (and Conquest /
    Breakthrough with three flags). The host's map is sent to everyone in
    multiplayer.
- **Medic class** with a defibrillator (one-second revives at full health)
  and a med bag. **Revives for everyone** in the respawn modes: bots and solo
  players get downed, bots run over to pick friends up, hold `Space` to give
  up.
- **Destructible cover**: explosions wreck crates, sandbags and low walls,
  blow gaps in fences and holes in walls (every building in the City);
  vehicles smash through the light stuff. Bots use the new holes.
- **Night and dusk** (Play → Time of day): moon, stars, street lamps,
  flashlights (`L`), night vision (`M`), flares (`J`). Bots only see you up
  close at night unless you're lit.
- **Parachutes and HALO**: bail out of aircraft in the air and open a
  parachute with `Space` (it opens by itself low down); a HALO jump deploy
  option in Conquest and Breakthrough.
- **Vehicles**: AA truck (flak bursts next to aircraft; bots man it), patrol
  boat (bow machine gun), transport truck (four more seats in the back).
- **Progression**: prestige from level 50 (up to 10), player cards
  (background, title, badges) shown on the menu and kill cards, 11 badges in
  three tiers, and weekly challenges.
- **Match report** on the results screen: a heatmap of where you played,
  your kills and deaths, best weapon, longest kill, time alive and more.
- **Sound**: more bot radio calls (read aloud if you like), directional
  hit sounds, armour and headshot hit sounds, a heartbeat when low.
- **Touch controls** for tablets and phones (Settings → Gameplay).

## New in v2.9

- **City** (Conquest, TDM, Zombies, Sandbox): downtown streets, sidewalks,
  parked cars and roadblocks, and apartments, offices and a six-storey hotel
  you can walk into. Doors and windows on every floor, switchback stairs to
  the roof, railings round the stairwells. Flags: Market, Hotel, Square,
  Station, Park. Bots path on the ground floor only.
- **Squads**: you lead three bots. They follow you, a squadmate rides along
  when you drive, `T` puts down a marker they move to and hold (`T` at the sky
  calls them back), and you can deploy on any living squadmate. The squad
  panel on the left shows their health.
- **Killcam**: the last four seconds before you died, replayed from behind
  your killer, with their weapon, distance and health. `Space` skips.
- **Career** (Armory → Career): weapon levels (10 per gun, rewards at each
  level), three daily challenges, and a 30-tier reward track driven by XP.
- **Zombies**: points, weapon lockers (`E` to buy or refill), barricades the
  horde breaks and you repair (hold `E`), and an Abomination boss every fifth
  wave with a ground slam.
- **Vehicles**: tanks have a roof gunner seat with a machine gun (players and
  bots); Dockyard has two patrol boats.
- **Controls**: Settings → Controls rebinds every key (conflicts swap).
- **Performance**: static map geometry is merged into batches per material and
  48 m cell, and far soldiers/vehicles drop their small parts.

## New in v2.8

- **Vehicles in TDM and Zombies**: the bases on Ridgeline, Frostpeak and
  Oasis now get their helicopters, jets, tanks and the rest in every mode, not
  only Conquest.
- **Player-only vehicles**: one jeep, one motorbike and one attack helicopter
  per base wear a yellow PLAYERS ONLY tag; bots never take them.
- **Interiors** for jeeps and cars: driver and passenger seats (and a rear
  bench), dashboard and gauges, a steering wheel that turns with the wheels,
  and see-through windows. `C` switches the driver between the chase camera
  and the seat view.
- **Armory**: Gunsmith → *Apply to all guns*; Cases → *Open all* per case and
  *Open every case*. Keys for the five newest cases had no price; fixed.
- **Saving**: progress also saves when the page closes or refreshes
  (including a match you leave early), full storage drops old sandbox saves
  instead of losing progress, and Settings → Save data can export/import a
  save file. If the browser blocks saving (private window, embedded preview)
  the game says so.

## New in v2.7

- **Bots drive a lot more.** They grab a vehicle whenever their flag is a long
  walk away (from much further off), bring a squadmate along in the passenger
  seat who shoots out of the window, occasionally run people over, and fly the
  transport helicopter to drop troops beside a flag. Claims that stall are
  handed to someone else.
- **Mounted machine guns**: two behind the sandbags at each base gate, and one
  dug in beside every Conquest flag with a sandbag horseshoe for cover. `E` to
  man one, the mouse aims, `LMB` fires. Bots crew them as well.
- **Killstreaks** (Conquest, TDM): 3 kills → UAV scan (all enemies on your
  team's minimap for 25 s), 5 → artillery strike on your crosshair, 7 → supply
  drop (full health, armour, ammo and a special weapon). `Z` calls the next
  one in. Bots use theirs too.
- **Weather**, picked each match or fixed in Settings → Weather: clear,
  overcast, rain, fog, or a thunderstorm with lightning. Frostpeak gets
  blizzards and the desert maps sandstorms. Bots see less far in bad weather.
- **Medals**: double/triple/multi kills, headshots, longshots, roadkills and
  sprees.
- Base fences are open in front of the hangar and garage so vehicles can
  drive out; the admin menu only has game cheats (no credits or cases).

## New in v2.6

- **Photon multiplayer** replaces PeerJS: room codes, an Open games browser,
  and everything networked through Photon Cloud. Setup: [PHOTON_SETUP.md](PHOTON_SETUP.md).
- **Trade Hub:** a global online room to chat and trade skins, cases, keys
  and credits with anyone playing.
- **New weapons:** Vector, Double Barrel, M14 DMR, MG42, MGL-6, Flamethrower,
  Railgun.
- **New crates:** Venom, Royal, Stormfront, Wasteland, Midnight.

## New in v2.5

- **Military bases** on every Conquest map (hangar, garage, helipads, runway,
  control tower, barracks, fences and towers).
- **More aircraft:** 2 attack helis, a transport heli and a jet per side;
  bots fly jets and drive quads/bikes/jeeps.
- **Music**, **speech bubbles** for chat and radio, and more eye candy.
- **Admin menu** (F8), password protected.
- Revive is multiplayer-only for real players; emote, results-screen,
  knife-armour and deploy-screen fixes.

## New in v2.4

- **Zombies mode:** co-op waves (walkers, runners, brutes) with a bot squad;
  the fallen return and ammo refills between waves; best wave per map saved.
- **New maps:** Dockyard (Defuse/TDM), Frostpeak (snowy Conquest/TDM with
  falling snow), Oasis Ruins (desert Conquest/TDM around an oasis island).

## New in v2.3

- **Hills** on every map (Ridgeline hills, Dustyard dunes, Flatgrass outer
  ring). They block sight and bullets; vehicles tilt on slopes.
- **Bot injuries:** limping from leg hits, worse aim from arm hits, bleeding
  and bandaging, and a **downed** state with revives (hold E on a teammate).
- **Emotes:** hold N (or B outside Defuse) for the wheel: wave, salute,
  cheer, dance, point, clap, flex, facepalm. Bots emote too.
- **Shoot while driving** cars, jeeps, bikes, quads and boats.
- **Less blocky:** rounded soldier models and rounded edges on everything.

## New in v2.2

- **Helicopter bots:** bots take attack helis up, patrol the objective and
  strafe enemies; everyone shoots back at helicopters.
- **Body armour** for every class (Support 100, Assault 75, Engineer 50,
  Recon 25) with visible vests and helmets; **vehicle armour zones** (front
  strong, rear and top weak).
- **Dismemberment** from explosions, close shotgun blasts and heavy
  headshots; **physics motion**: hit flinches, blast staggers, body lean,
  helmets that fly off, vehicle suspension.
- **Graphics:** high-res textures with normal maps, PBR materials, sun
  shadows, sky dome, tone mapping, bloom, grass/rocks/rubble. Settings →
  Graphics (Low/Medium/High).
- The GUI is 66% of its old size (Settings → UI scale).

## New in v2.1

- **Water on every map.** Dustyard: a flooded canal with a plank walkway and
  a fountain pool. Ridgeline: a river with three bridges and a lake around
  an island that holds a sixth flag (F, Island), plus a speedboat per side.
  Flatgrass: a deep lake with an island lighthouse, a dock and a footbridge.
- **Swimming:** wade slowly in shallows; swim at half speed in deep water,
  no shooting, Space up / Ctrl dive, climb out at the bank, drown after 8 s
  under. Murky underwater view; bullets stop at the surface.
- Vehicles flood in deep water, boats float, bots stick to bridges.

## New in v2.0

- **Helicopters** (transport and attack), a **jet**, **motorbike**, **quad
  bike**, **APC** and **speedboat** (Flatgrass has a lake for it).
- Flying: W/S/A/D move, the mouse turns, Space climbs, Ctrl descends. Jet:
  W/S throttle, the mouse steers, take off above 26 m/s.
- Weapons: attack heli minigun + rockets, jet cannon + bombs, APC turret
  machine gun (bots crew APCs too).
- Ridgeline Conquest adds an attack heli, an APC, two bikes and a quad per side.

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
under **Join** (or click it under **Open games**), and that works across the
internet through **Photon Cloud**, so there's no server to run. Setting up a
Photon App ID is covered in [PHOTON_SETUP.md](PHOTON_SETUP.md). The host simulates the
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
`F` inspect · `Z` call in a killstreak · `T` squad marker · `C` (driving) chase / seat camera · `Tab` scores ·
`L` flashlight · `M` night vision · `J` flare (night) · `Space` (falling) parachute · `H` medkit ·
`Y`/`Enter` chat · `Esc` pause. Downed: hold `Space` to give up. Map editor: `LMB` place · `RMB` remove ·
`Q` tools · wheel piece · `R` turn · `Z` undo · `V` fly/walk

## Building

```
cd breachpoint
npm install        # three.js 0.160, cannon-es and the Photon Realtime SDK, inlined into the build
node build.js
```
