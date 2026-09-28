/* ═══════════════════════════════════════════════════════════════════════════
   Update log. Opens by itself the first time a new version starts, and is
   always one click away on the main menu.
   ═══════════════════════════════════════════════════════════════════════════ */

const CHANGELOG = [
  { v: '2.2', date: 'Sep 2026', title: 'Pilots, armour, gore and a new look', items: [
    ['New', 'Bots fly attack helicopters: they take off, patrol over the objective, and circle enemies firing the minigun in bursts and rockets at vehicles. Every soldier shoots back at helicopters.'],
    ['New', 'Body armour in every mode, worn on the model: Support heavy (100), Assault medium (75), Engineer light (50), Recon barely any (25, no helmet). Sandbox players and soldier NPCs get 50 and a helmet. Armour bar under your health.'],
    ['New', 'Vehicle armour zones: tanks and APCs take 0.6x damage from the front, 1.7x from the rear and 1.5x from above.'],
    ['New', 'Dismemberment: explosions tear off limbs, and close-range shotgun blasts, sniper shots and heavy headshots can take a head or a limb. Parts fly with a blood trail and the stumps bleed. Settings → Dismemberment.'],
    ['New', 'Physics-driven motion: soldiers flinch away from hits and stagger from nearby blasts, lean into acceleration and turns, and helmets fly off when they are shot off. Vehicles pitch and roll on their suspension, and boats bob.'],
    ['New', 'Graphics: new high-resolution textures with surface relief, physically based materials, sun shadows, a gradient sky with a sun, sky reflections, filmic tone mapping, bloom and a vignette. Grass, rocks and rubble are scattered across the maps. Settings → Graphics (Low / Medium / High).'],
    ['Change', 'The interface is 66% of its old size. Settings → UI scale changes it.'],
  ] },
  { v: '2.1', date: 'Sep 2026', title: 'Water everywhere', items: [
    ['New', 'Every map has water. Dustyard: a flooded canal through Lower with a dry plank walkway, and a fountain pool in CT spawn. Ridgeline: a river across the valley with three bridges, and a lake around an island. Flatgrass: a deep lake with an island lighthouse, a dock and a footbridge.'],
    ['New', 'A sixth Conquest flag on Ridgeline: F, the Island. Take it over the footbridge, from the dock, by boat, or swim. Each side gets a speedboat on the river.'],
    ['New', 'Swimming: wade slowly through the shallows; in deep water you swim at half speed and can\'t shoot. Space rises, Ctrl dives, and you climb out at the bank. Stay under for more than 8 seconds and you start to drown.'],
    ['New', 'Underwater the view turns murky blue. Bullets stop at the surface, so a swimmer can only be hit from the neck up.'],
    ['New', 'Ground vehicles that drive into deep water stall and flood; aircraft that ditch sink fast. Boats float. Bullets and blood splash on the surface.'],
    ['Change', 'Bots use the bridges instead of swimming, and nobody spawns in the water.'],
  ] },
  { v: '2.0', date: 'Sep 2026', title: 'Helicopters, jets and more vehicles', items: [
    ['New', 'Helicopter: two seats, and the passenger can shoot out of the open door. W/S/A/D fly, the mouse turns, Space climbs, Ctrl descends. Jump out and it falls.'],
    ['New', 'Attack helicopter: minigun on LMB, 14 rockets on RMB, crew protected.'],
    ['New', 'Jet: W/S throttle, the mouse steers, take off above 26 m/s. Cannon on LMB, 4 bombs on RMB. Hit a wall at speed and it is over.'],
    ['New', 'Motorbike (fastest on wheels, leans into turns) and Quad bike.'],
    ['New', 'APC: armoured, carries two, machine-gun turret aimed with the mouse. Bots crew APCs like tanks.'],
    ['New', 'Speedboat, and a lake on Flatgrass to drive it on.'],
    ['New', 'Conquest on Ridgeline: each side also gets an attack helicopter, an APC, two motorbikes and a quad bike.'],
    ['Fix', 'Vehicles destroyed in the air explode where they are, not on the ground below. Rockets no longer hit the vehicle that fired them.'],
  ] },
  { v: '1.9', date: 'Sep 2026', title: 'Ragdolls and a lot more wiring', items: [
    ['New', 'Ragdolls: bodies go limp when they die, get thrown by the hit (explosions throw them far), tumble down stairs and land on props. Explosions shove bodies already on the ground. Settings can turn them off.'],
    ['New', 'Wiring inputs: keypad (code lock), key input (bind any free key), laser tripwire, damage sensor, prop sensor, toggle button, random.'],
    ['New', 'Wiring logic: NAND, NOR, pulse, and a set/reset latch.'],
    ['New', 'Numbers: counter, constant, adder, comparator, number display and a text screen. Wires now carry numbers; anything non-zero counts as on.'],
    ['New', 'Wiring outputs: turret, speaker (8 sounds), forcefield, lift, spawner (props or NPCs) and thumper.'],
    ['New', 'Latches, counters and comparators take their first input on the left half and the second on the right half.'],
    ['New', 'Wire colours, an option to only show wires while holding the tool gun, and a Debugger tool that reads out any part.'],
    ['New', 'Typing a keypad code, a screen text or a value opens a small box in game.'],
    ['Change', 'The Wiring tab is split into Inputs, Logic, Numbers and Outputs.'],
  ] },
  { v: '1.8', date: 'Sep 2026', title: 'Sharper guns, tank crews and blood', items: [
    ['Change', 'Guns are much more accurate: about 60% less spread, half the movement inaccuracy and 40% less recoil (shotguns and snipers a bit less). Jumping hurts accuracy half as much.'],
    ['Change', 'Launchers are rarer: only Engineers carry them, the RPG has 2 rockets and the M79 5 grenades, ammo boxes no longer refill launchers, and only about 1 in 7 bots per team plays Engineer. Tanks no longer melt.'],
    ['New', 'Bots crew tanks. A free tank is taken by a nearby bot, who drives it to the objective, hunts enemy tanks first, aims the turret, and runs people over who get too close. Sandbox soldiers climb into tanks too.'],
    ['New', 'Blood: sprays on hits, spatter on the wall and floor behind, and a small pool where someone falls. It fades after half a minute. Settings can turn it off.'],
    ['New', 'Crosshair styles in Settings: cross, T-shape, dot, circle, cross + circle and chevron, with a live preview.'],
    ['New', 'A Breachpoint mouse cursor in the menus (or switch back to the system one in Settings).'],
    ['Fix', 'Players, bots and NPCs no longer spawn behind walls or inside sealed-off spaces. Sandbox NPCs and vehicles appear on your side of whatever you aim at, with room to stand.'],
    ['Fix', 'Defuse: you can buy from every spawn point, not only the first one.'],
  ] },
  { v: '1.7', date: 'Sep 2026', title: 'Sandbox: saves, wiring, doors, lights', items: [
    ['New', 'Sandbox saves: name a save in the new Saves tab, load it any time, export it as a file to share or back up, and import files. Leaving a sandbox keeps an Autosave. Loading a save made on another map switches to that map.'],
    ['New', 'Wiring: buttons, switches, pressure plates, proximity sensors, timers, AND / OR / NOT / XOR gates, delays and toggle latches. The new Wire tool connects an output to anything: doors open, lights switch, alarms sound, thrusters fire, wheels drive, lamps and emitters toggle, dynamite goes off.'],
    ['New', 'Doors that work: hinged, sliding and garage doors. Press E to open them, or wire them to a circuit. Hinged doors swing away from you.'],
    ['New', 'Lights: bulbs, ceiling panels, neon tubes, floodlights and lanterns in a new Lights tab, and a Light tool with brightness. E switches any light on and off.'],
    ['New', 'Vehicles work with the physics gun (pick up, rotate with E, throw, freeze with RMB, R unfreezes) and the tool gun (paint, freeze, ignite, copy and paste, repair, remove).'],
    ['New', 'A drivable Car in the Vehicles tab.'],
    ['New', 'Tools: Axis (hinge two props, or a prop to the world), Ball socket, Repair.'],
    ['Change', 'Explosions shove jeeps and cars around.'],
    ['Fix', 'Many lights no longer slow the game down or stutter when switched: the world shares a small set of real lights between the nearest ones.'],
  ] },
  { v: '1.6', date: 'Sep 2026', title: 'Bigger blasts, tougher tanks', items: [
    ['Change', 'Every explosion (grenades, RPG, M79, crossbow bolts, tank shells, dynamite, barrels, blown-up vehicles) now reaches twice as far, with a bigger fireball to match. The C4 was already huge and is unchanged.'],
    ['Fix', 'Tanks died too easily. They now have 2600 HP (was 1300), about 10 RPG hits, and shrug off bullets even more.'],
  ] },
  { v: '1.5', date: 'Sep 2026', title: 'Damage cooldown', items: [
    ['New', 'Damage cooldown: after you take a hit, further hits are ignored for a moment (0.1 s by default), so fast bursts and multiple shooters cannot delete you instantly. Every pellet of a single shotgun blast still counts.'],
    ['New', 'Damage cooldown setting (0 to 0.5 s, 0 turns it off). In multiplayer the host\'s setting applies.'],
  ] },
  { v: '1.4', date: 'Sep 2026', title: 'Tanks, scopes and a pricier armory', items: [
    ['New', 'Tanks. One per side in Conquest, and in the Sandbox spawn menu. W/S drive, A/D turn on the spot, the turret follows your aim, LMB fires the cannon. The crew is safe from bullets. RPGs and M79s do extra damage to it, and engineer bots go after tanks with them.'],
    ['New', 'Real scope overlays for the 4x ACOG, the AUG and the crossbow (with bullet-drop marks), plus a new mil-dot sniper reticle. The overlay fades in as you aim.'],
    ['Fix', 'Aiming down sights blocks much less of the screen: the gun sits further out and is barely magnified.'],
    ['Change', 'Everything bought with credits costs 3× more: cases, keys, key bundles and attachment unlocks. Skin sell values went up 3× too. Match rewards are unchanged, so it takes longer to earn. In-match Defuse prices are unchanged.'],
  ] },
  { v: '1.3', date: 'Sep 2026', title: 'Keys, levels and a proper victory screen', items: [
    ['New', 'Every case now opens with its own key (Ember, Glacier, Neon, Arsenal). Old keys became Master Keys that open anything.'],
    ['New', 'Buy keys one at a time or in bundles of 5 at 15% off, right on each case.'],
    ['New', 'Player levels. Matches give XP, and every level pays credits plus a key. Every fifth level adds a case and a Master Key.'],
    ['New', 'Keys drop from matches too.'],
    ['New', 'Redesigned victory screen: both scoreboards, your K/D, headshot %, accuracy and damage, an itemised credit breakdown, an XP bar, and every drop.'],
    ['New', 'Multiplayer hosts can press Play again or Back to lobby from the results screen, and everyone follows.'],
    ['New', 'The lobby shows every slot: the people, then the named bots that will fill the empty seats. With 3 players and a team size of 4, you see 3 people and 1 bot.'],
    ['New', 'Lobby options: any team size, Fill with bots on/off, and Balance teams.'],
    ['Fix', 'The gun no longer jitters when you move: smoother bob, sway and sprint transitions.'],
    ['New', 'This update log.'],
  ] },
  { v: '1.2', date: 'Sep 2026', title: 'Range, arsenal and medkits', items: [
    ['New', '13 weapons: Five-SeveN, Tec-9, .357 Magnum, MAC-10, UMP-45, XM1014, Galil, FAMAS (burst), AUG, Auto-Sniper, Minigun, Crossbow, M79.'],
    ['New', 'Medkits on H. Health and ammo drops in Conquest and TDM. Health, armor and ammo stations in Sandbox.'],
    ['New', 'Sandbox tools: elastic, motor wheels, hoverball, lamp, emitter, ignite, duplicator, physical props, trail.'],
    ['Fix', 'Weapon damage now falls off by weapon type, and bots close in instead of firing out of range.'],
    ['Fix', 'Longer view distance, plus View distance and Bot sight distance settings.'],
    ['Fix', 'Physics forces are applied correctly, so thrusters and balloons are no longer weak and props no longer spin out of control.'],
  ] },
  { v: '1.1', date: 'Sep 2026', title: 'Sandbox and attachments', items: [
    ['New', "Sandbox mode, Garry's Mod style: spawn menu, physics gun, tool gun, NPCs, undo, noclip."],
    ['New', 'Attachments in the Gunsmith: optics, suppressor, compensator, grip, laser, extended mag.'],
    ['Fix', 'Reworked first-person view: real sights to aim down, hands, reload motion.'],
  ] },
  { v: '1.0', date: 'Sep 2026', title: 'Launch', items: [
    ['New', 'Defuse, Conquest and Team Deathmatch, with squad AI that plans and calls it out on the radio.'],
    ['New', 'Peer-to-peer multiplayer with room codes.'],
    ['New', 'Cases, skins, trade-ups.'],
  ] },
];

UI.render_news = function () {
  $('newsBody').innerHTML = CHANGELOG.map((c, i) => `<div class="cl ${i === 0 ? 'latest' : ''}"><div class="clh"><b>v${c.v}</b><span>${escapeHtml(c.title)}</span><small>${c.date}</small></div>
    <ul>${c.items.map(([t, x]) => `<li><em class="t-${t.toLowerCase()}">${t}</em>${escapeHtml(x)}</li>`).join('')}</ul></div>`).join('');
  Store.set('seenVersion', VERSION);
  const b = $('newsDot'); if (b) b.classList.add('hidden');
};
/* first launch of a new version: show what changed */
UI.maybeShowNews = function () {
  const seen = Store.get('seenVersion', null);
  const dot = $('newsDot'); if (dot) dot.classList.toggle('hidden', seen === VERSION);
  if (seen !== VERSION) setTimeout(() => { if (!Game.running && this.cur === 'main') this.show('news'); }, 400);
};
