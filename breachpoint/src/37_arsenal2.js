/* ═══════════════════════════════════════════════════════════════════════════
   More guns, more crates.
   Weapons:
   · Vector: an SMG with a ridiculous fire rate.
   · Double Barrel: two shells, both huge.
   · M14 DMR: a semi-automatic marksman rifle.
   · MG42: a belt-fed LMG that chews through belts.
   · MGL-6: a six-round revolving grenade launcher (Engineer gadget).
   · Flamethrower: a short cone of fire that sets people alight (burning keeps
     hurting for a few seconds). Walls stop it.
   · Railgun: a charged slug that goes straight through every enemy in a line.
   Crates: Venom, Royal, Stormfront, Wasteland and Midnight, with skins for
   the new guns and old favourites, and knives in each.
   ═══════════════════════════════════════════════════════════════════════════ */
Object.assign(WEAPONS, {
  vector:  { name: 'Vector', slot: 1, type: 'smg', dmg: 24, rpm: 1100, mag: 25, reserve: 100, reload: 2.3, spread: 0.018, moveSpread: 0.02, recoil: 0.45, falloff: 0.84, pen: 0.55, price: 1500, kill: 600, speed: 0.97, sound: 0.55, zoom: 65, auto: true, L: 0.66 },
  dbarrel: { name: 'Double Barrel', slot: 1, type: 'shotgun', dmg: 24, pellets: 12, rpm: 200, mag: 2, reserve: 30, reload: 2.6, spread: 0.07, moveSpread: 0.02, recoil: 5, falloff: 0.5, pen: 0.55, price: 1200, kill: 900, speed: 0.95, sound: 1.6, zoom: 70 },
  m14:     { name: 'M14 DMR', slot: 1, type: 'rifle', dmg: 58, rpm: 300, mag: 20, reserve: 80, reload: 2.9, spread: 0.002, moveSpread: 0.11, recoil: 2.2, falloff: 0.99, pen: 0.85, price: 3500, kill: 300, speed: 0.88, sound: 1.3, zoom: 36, L: 1.12 },
  mg42:    { name: 'MG42', slot: 1, type: 'lmg', dmg: 30, rpm: 1200, mag: 75, reserve: 225, reload: 6, spread: 0.014, moveSpread: 0.12, recoil: 0.7, falloff: 0.96, pen: 0.8, price: 5600, kill: 300, speed: 0.78, sound: 1.2, zoom: 58, auto: true },
  mgl:     { name: 'MGL-6', slot: 4, type: 'launcher', dmg: 100, radius: 4.2, rpm: 110, mag: 6, reserve: 6, reload: 4.2, spread: 0.008, moveSpread: 0.03, recoil: 4, falloff: 1, pen: 1, price: 0, kill: 300, speed: 0.9, sound: 1.0, zoom: 55, projectile: 32, gravity: 9, explosive: true },
  flamer:  { name: 'Flamethrower', slot: 1, type: 'lmg', flamer: true, dmg: 7, rpm: 600, mag: 100, reserve: 200, reload: 4, spread: 0.08, moveSpread: 0.02, recoil: 0.1, falloff: 1, pen: 0.9, price: 3000, kill: 600, speed: 0.9, sound: 0.4, zoom: 70, auto: true, range: [10, 11, 0] },
  railgun: { name: 'Railgun', slot: 1, type: 'sniper', rail: true, dmg: 95, rpm: 38, mag: 4, reserve: 20, reload: 3.4, spread: 0.0008, hipSpread: 0.03, moveSpread: 0.08, recoil: 6, falloff: 1, pen: 1, price: 6000, kill: 150, speed: 0.84, sound: 1.8, zoom: 24, scope: true },
});
for (const id of ['vector', 'dbarrel', 'm14', 'mg42', 'mgl', 'flamer', 'railgun']) WEAPONS[id].id = id;
// same accuracy pass the older guns got (see 19_combat_ai.js)
for (const id of ['vector', 'dbarrel', 'm14', 'mg42', 'mgl', 'railgun']) { const w = WEAPONS[id], k = w.type === 'shotgun' ? { sp: 0.75, mv: 0.5, rc: 0.7 } : w.type === 'sniper' ? { sp: 0.5, mv: 0.5, rc: 0.7 } : w.type === 'launcher' ? { sp: 0.5, mv: 0.5, rc: 1 } : { sp: 0.4, mv: 0.45, rc: 0.6 };
  w.spread *= k.sp; if (w.hipSpread) w.hipSpread *= k.sp + 0.05; w.moveSpread *= k.mv; w.recoil *= k.rc; }
if (WEAPONS.m79 && WEAPONS.m79.gravity && WEAPONS.mgl) WEAPONS.mgl.gravity = WEAPONS.m79.gravity;
EXPLOSIVE_KILLS.push('mgl');
CLASSES.assault.options.push('m14'); CLASSES.engineer.options.push('vector', 'dbarrel'); CLASSES.engineer.gadgets.push('mgl');
CLASSES.support.options.push('mg42', 'flamer'); CLASSES.recon.options.push('railgun');
/* bots don't take the flamethrower (it only reaches ten metres) */
const _giveClass37 = Game.giveClass.bind(Game);
Game.giveClass = function (s) { if (s.isBot && s.pickW === 'flamer') s.pickW = 'mg42'; return _giveClass37(s); };
/* buy menu */
const _buyItems37 = UI.buyItems.bind(UI);
UI.buyItems = function (team) {
  const cats = _buyItems37(team), w = id => ({ id, name: WEAPONS[id].name, price: WEAPONS[id].price }), cat = n => cats.find(c => c[0] === n);
  cat('SMGs') && cat('SMGs')[1].push(w('vector')); cat('Heavy') && cat('Heavy')[1].push(w('dbarrel'), w('mg42')); cat('Rifles') && cat('Rifles')[1].push(w('m14'));
  cats.splice(5, 0, ['Special', [w('flamer'), w('railgun')]]);
  return cats;
};

/* ── the flamethrower and the railgun ──────────────────────────────────── */
const _fire37 = fireWeapon;
fireWeapon = function (s, now, rc) {
  const w = s.w; if (!w || !(w.flamer || w.rail)) return _fire37(s, now, rc);
  if (!s.alive || s.downed || s.swim || s.fireCd > 0 || s.drawT > 0 || s.reloadT > 0 || s.healT > 0) return false;
  const a = s.ammo[s.cur]; if (!a) return false;
  if (a.mag <= 0) { if (s.ctrl === 'local') Sfx.play('empty'); s.fireCd = 0.25; s.startReload(); return false; }
  a.mag--; s.fireCd = 60 / w.rpm; s.lastShot = now; s.shots = (s.shots || 0) + 1;
  const eye = s.eye(new V3()), f = s.forward(new V3()), mine = s.ctrl === 'local' || (s.ctrl === 'bot' && Game.authority());
  if (w.flamer) {
    let reach = 10; const t = World.raycast(eye.x, eye.y, eye.z, f.x, f.y, f.z, reach); if (t >= 0) reach = t;
    flameFX(s, eye, f, reach);
    if (mine) for (const e of Game.soldiers) {
      if (e === s || !e.alive || !(Game.hostile(s, e) || (Game.mode.id === 'sandbox' && e.team === 'D'))) continue;
      const c = new V3(e.pos.x, e.pos.y + 1, e.pos.z).sub(eye), d = c.length(); if (d > reach + 0.6) continue;
      if (c.normalize().dot(f) < 0.93) continue;
      if (!World.los(eye.x, eye.y, eye.z, e.pos.x, e.pos.y + 1, e.pos.z)) continue;
      Game.reportHit(s, e, w.dmg * (1 - d / 14), 'chest', 'flamer');
    }
    if (mine) for (const v of Game.vehicles) { if (!v.alive || v === s.vehicle) continue; const d = v.pos.distanceTo(eye); if (d < reach + v.K.r && new V3(v.pos.x, v.pos.y + 1, v.pos.z).sub(eye).normalize().dot(f) > 0.9) Game.reportVehicleHit(s, v, 3, 'flamer'); }
    if (Math.random() < 0.3) Sfx.play('smoke', eye, { vol: 0.35 });
    Game.onShot(s, eye.clone().addScaledVector(f, reach), eye);
  } else {
    // railgun: straight line, through people, stopped by walls
    const sp = s.adsT > 0.8 ? w.spread : w.hipSpread, yaw = s.yaw + rand(-sp, sp), pitch = s.pitch + rand(-sp, sp), cp = Math.cos(pitch), d = new V3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    let wall = World.raycast(eye.x, eye.y, eye.z, d.x, d.y, d.z, 600); const wallN = { x: World.hit.nx, y: World.hit.ny, z: World.hit.nz }; if (wall < 0) wall = 600;
    const hitList = [], skip = new Set([s]);
    for (let k = 0; k < 8; k++) { const h = raySoldiers(eye, d, wall, null, Game.soldiers.filter(o => !skip.has(o))); if (!h) break; skip.add(h.s); hitList.push(h); }
    if (mine) {
      for (const h of hitList) if (Game.hostile(s, h.s) || Game.mode.id === 'sandbox') Game.reportHit(s, h.s, w.dmg * (h.zone === 'head' ? 2 : h.zone === 'legs' ? 0.75 : 1), h.zone, 'railgun');
      const vh = Game.rayVehicles(eye, d, wall, s.vehicle); if (vh) Game.reportVehicleHit(s, vh.v, 260, 'railgun');
    }
    const end = eye.clone().addScaledVector(d, wall); railFX(eye, end); if (wall < 600) FX.impact(end, wallN);
    Sfx.play('shot', eye, { w }); Sfx.play('flash', eye, { vol: 0.4 });
    if (s.ctrl === 'local') { s.punchY = (s.punchY || 0) + 0.05; Player.shakeT = 0.18; }
    Game.onShot(s, end, eye);
  }
  if (a.mag <= 0 && a.res > 0) s.startReload();
  return true;
};
function flameFX(s, eye, f, reach) {
  const m = eye.clone().addScaledVector(f, 0.7).add(new V3(0, -0.15, 0)), sp = Math.max(4, reach * 1.6);
  FX.emit('add', m.x, m.y, m.z, 5, 1.2, [1, 0.55, 0.15], 0.45, 2, 0.5, f.clone().multiplyScalar(sp));
  FX.emit('add', m.x, m.y, m.z, 3, 0.8, [1, 0.85, 0.35], 0.3, 1, 0.3, f.clone().multiplyScalar(sp * 0.8));
  if (Math.random() < 0.3) FX.emit('norm', m.x + f.x * reach * 0.7, m.y + f.y * reach * 0.7 + 0.4, m.z + f.z * reach * 0.7, 2, 0.8, [0.25, 0.22, 0.2], 1.2, 1.5, 0.8);
  if (typeof Candy !== 'undefined' && Game.camera && Game.camera.position.distanceTo(eye) < 40) Candy.light(m.clone().addScaledVector(f, 2), 7, 10, 0.08, 0xff8030);
}
function railFX(o, e) { for (let i = 0; i < 3; i++) FX.tracer(o.clone().add(new V3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.02, 0.02))), e, i ? 0x6ad8ff : 0xe8f8ff); if (typeof Candy !== 'undefined') Candy.light(o, 12, 10, 0.12, 0x6ad8ff); }
/* other players see flames and beams */
const _showShot37 = Net.showShot.bind(Net);
Net.showShot = function (s, end, wid) {
  const w = WEAPONS[wid];
  if (w && w.flamer) { const eye = s.eye(new V3()), d = end.clone().sub(eye), L = d.length(); flameFX(s, eye, d.multiplyScalar(1 / (L || 1)), L); return; }
  if (w && w.rail) { const eye = s.eye(new V3()); railFX(eye, end); Sfx.play('shot', eye, { w }); return; }
  return _showShot37(s, end, wid);
};
/* burning: the host keeps it going; everyone sees the flames */
const Burn = {
  set(v, by) { if (!v.alive) return; const fresh = !(v.burnT > 0); v.burnT = 3; v.burnBy = by ? by.id : null; if (fresh && Net.role === 'host') Net.event({ t: 'burn', id: v.id }); },
  update(dt) {
    for (const v of Game.soldiers) {
      if (!(v.burnT > 0)) continue; v.burnT -= dt;
      if (!v.alive || v.swim) { v.burnT = 0; continue; }
      if (Math.random() < dt * 12) FX.emit('add', v.pos.x + rand(-0.25, 0.25), v.pos.y + rand(0.3, 1.6), v.pos.z + rand(-0.25, 0.25), 2, 0.6, [1, 0.5, 0.12], 0.4, 3, 0.3);
      if (Game.authority()) { v.burnAcc = (v.burnAcc || 0) + dt; if (v.burnAcc >= 0.25) { v.burnAcc = 0; Game.damage(v, 2.5, Game.byId(v.burnBy) || null, 'flamer', 'chest'); } }
    }
  },
};
const _damage37 = Game.damage.bind(Game);
Game.damage = function (v, dmg, att, weapon, zone, from) { const r = _damage37(v, dmg, att, weapon, zone, from); if (weapon === 'flamer' && v && v.alive && dmg > 3) Burn.set(v, att); return r; };
const _gupdate37 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate37(dt); if (this.running) Burn.update(dt); };
const _applyEvent37 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) { if (e && e.t === 'burn') { const v = Game.byId(e.id); if (v) v.burnT = 3; return; } return _applyEvent37(e); };

/* ── models: a fuel tank on the flamer, coils on the railgun ───────────── */
const _buildGun37 = buildGun;
buildGun = function (weaponId, item, att) {
  const g = _buildGun37(weaponId, item, att);
  if (weaponId === 'flamer') {
    const T = lam('#8a2a1a'), M = lam('#3a3c40'), tank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 12), T); tank.rotation.x = Math.PI / 2; tank.position.set(0, -0.08, 0.02); g.add(tank);
    const tank2 = tank.clone(); tank2.material = lam('#c8a030'); tank2.scale.set(0.7, 0.8, 0.7); tank2.position.set(0.06, -0.07, 0.04); g.add(tank2);
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.14, 10), M); noz.rotation.x = Math.PI / 2; noz.position.set(0, 0, -0.5); g.add(noz);
    const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), new THREE.MeshBasicMaterial({ color: 0x5aa0ff })); pilot.position.set(0, -0.02, -0.58); g.add(pilot);
  }
  if (weaponId === 'railgun') {
    const glow = new THREE.MeshBasicMaterial({ color: 0x6ad8ff });
    for (let i = 0; i < 5; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 6, 16), i % 2 ? glow : lam('#2a2e34')); ring.position.set(0, 0.005, -0.22 - i * 0.07); g.add(ring); }
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), glow); cell.position.set(0, -0.05, 0.06); g.add(cell);
  }
  return g;
};

/* ── new crates ────────────────────────────────────────────────────────── */
(function moreCases() {
  CASES.push({ id: 'venom', name: 'Venom Case', color: '#8aff3d', price: 420, desc: 'Toxins, serpents and acid.' });
  let C = 'venom';
  defSkin(C, 1, 'vector', 'Acid Rain', 'stripes', ['#1a2a0a', '#8aff3d', '#3a5a1a']);
  defSkin(C, 1, 'glock', 'Toxic Waste', 'marble', ['#2a3a0a', '#b8ff4a', '#1a1a0a']);
  defSkin(C, 1, 'nova', 'Swamp Gas', 'camo', ['#2a3a2a', '#5a7a3a', '#8aaa5a', '#1a2a1a']);
  defSkin(C, 1, 'ump45', 'Venom Mesh', 'mesh', ['#0a140a', '#6aff2a']);
  defSkin(C, 2, 'dbarrel', 'Snakebite', 'scales', ['#1a2a0a', '#6aa02a', '#d8ff6a']);
  defSkin(C, 2, 'mp9', 'Hazmat', 'stripes', ['#ffd23d', '#1a1a1a', '#8aff3d']);
  defSkin(C, 2, 'm14', 'Viper', 'tiger', ['#6aff3d', '#0a1405']);
  defSkin(C, 2, 'fiveseven', 'Radioactive', 'fade', ['#d8ff3d', '#3dff6a', '#0a3d1a']);
  defSkin(C, 3, 'ak47', 'Neurotoxin', 'circuit', ['#050a05', '#8aff3d', '#d83dff']);
  defSkin(C, 3, 'mg42', 'Plague', 'rust', ['#2a3a0a', '#6a8a2a', '#1a1a05']);
  defSkin(C, 3, 'deagle', 'Cobra', 'scales', ['#0a0a0a', '#3dff8a', '#ffd23d']);
  defSkin(C, 4, 'flamer', 'Acid Breath', 'flames', ['#0a1405', '#3dff2a', '#d8ff6a', '#ffffff']);
  defSkin(C, 4, 'm4a4', 'Black Mamba', 'waves', ['#050505', '#1a3d1a', '#6aff3d', '#d8ff9a']);
  defSkin(C, 5, 'vector', 'Emerald Venom', 'doppler', ['#0aff6a', '#003d1a', '#b8ff3d', '#001a0a']);
  defKnife(C, 'spike', 'Viper Fang', 'scales', ['#0a1a0a', '#3dff6a', '#d8ff9a']);
  defKnife(C, 'talon', 'Acid Fade', 'fade', ['#d4ff3d', '#3dffb0', '#0a3d2a']);

  CASES.push({ id: 'royal', name: 'Royal Case', color: '#ffd23d', price: 480, desc: 'Gold leaf, marble halls and velvet.' });
  C = 'royal';
  defSkin(C, 1, 'p2000', 'Ivory', 'marble', ['#f4efe4', '#c8bfa8', '#e8dcc0']);
  defSkin(C, 1, 'mac10', 'Velvet', 'solid', ['#5a0a2a', '#3a0518']);
  defSkin(C, 1, 'p90', 'Crown Jewel', 'hex', ['#1a0a3d', '#ffd23d']);
  defSkin(C, 1, 'xm1014', 'Tapestry', 'waves', ['#3a0a1a', '#8a1a2a', '#ffd23d', '#1a0510']);
  defSkin(C, 2, 'magnum', 'Gold Leaf', 'fade', ['#fff4c0', '#ffd23d', '#b8860b']);
  defSkin(C, 2, 'aug', 'Palace Guard', 'lines', ['#0a1a4a', '#ffd23d']);
  defSkin(C, 2, 'scar', 'Regal Marble', 'marble', ['#f8f4ec', '#1a1a1a', '#c8b89a']);
  defSkin(C, 2, 'm14', 'Heirloom', 'stripes', ['#5a3a1a', '#8a5a2a', '#ffd23d']);
  defSkin(C, 3, 'awp', 'Sovereign', 'aurora', ['#1a0a2a', '#ffd23d', '#8a3dff', '#ffffff']);
  defSkin(C, 3, 'railgun', 'Crown Coil', 'circuit', ['#0a0a14', '#ffd23d', '#ffffff']);
  defSkin(C, 3, 'glock', 'Royal Blue', 'doppler', ['#0a2aff', '#001066', '#4f8aff', '#000a33']);
  defSkin(C, 4, 'deagle', 'Midas Touch', 'doppler', ['#ffe066', '#b8860b', '#fff4c0', '#7a5a00']);
  defSkin(C, 4, 'ak47', 'Gilded Dragon', 'flames', ['#140a02', '#b8860b', '#ffd23d', '#fff4c0']);
  defSkin(C, 5, 'railgun', 'Imperial', 'doppler', ['#ffd23d', '#6a1a8a', '#fff4c0', '#2a0a3d']);
  defKnife(C, 'flipwing', 'Gold Rush', 'doppler', ['#ffe066', '#b8860b', '#fff4c0', '#7a5a00']);
  defKnife(C, 'talon', 'Marble Crown', 'marble', ['#f8f4ec', '#b8860b', '#1a1a1a']);

  CASES.push({ id: 'storm', name: 'Stormfront Case', color: '#6ad8ff', price: 420, desc: 'Lightning, rain and thunderheads.' });
  C = 'storm';
  defSkin(C, 1, 'tec9', 'Drizzle', 'lines', ['#1a2a3a', '#6aa8d8']);
  defSkin(C, 1, 'vector', 'Overcast', 'camo', ['#5a6470', '#3a424a', '#8a949e']);
  defSkin(C, 1, 'galil', 'Squall', 'digital', ['#2a3a4a', '#4a6a8a', '#8aaac8']);
  defSkin(C, 1, 'nova', 'Thunderhead', 'marble', ['#2a3040', '#5a6478', '#1a1e28']);
  defSkin(C, 2, 'famas', 'Static Charge', 'glitch', ['#0a0a1a', '#6ad8ff', '#ffffff']);
  defSkin(C, 2, 'dbarrel', 'Hailstorm', 'shards', ['#c8e8ff', '#4a8ac8', '#ffffff']);
  defSkin(C, 2, 'mg42', 'Monsoon', 'waves', ['#0a1a2a', '#2a5a8a', '#6ab0e0', '#c8e8ff']);
  defSkin(C, 2, 'ssg', 'Eye of the Storm', 'fade', ['#6ad8ff', '#2a5aff', '#0a0a3d']);
  defSkin(C, 3, 'm4a4', 'Lightning Strike', 'shards', ['#0a0a1a', '#6ad8ff', '#ffffff']);
  defSkin(C, 3, 'mgl', 'Barometer', 'circuit', ['#0a141a', '#3dd8ff', '#ffd23d']);
  defSkin(C, 3, 'm14', 'Tempest', 'aurora', ['#050a14', '#3d8aff', '#6affff', '#ffffff']);
  defSkin(C, 4, 'railgun', 'Arc Flash', 'waves', ['#050510', '#3dd8ff', '#b8f4ff', '#ffffff']);
  defSkin(C, 4, 'awp', 'Thunderbird', 'flames', ['#05050f', '#2a5aff', '#6ad8ff', '#ffffff']);
  defSkin(C, 5, 'm4a4', 'Superstorm', 'doppler', ['#6ad8ff', '#0a1a6b', '#e8fbff', '#2a4aff']);
  defKnife(C, 'spike', 'Lightning', 'shards', ['#0a0a1a', '#6ad8ff', '#ffffff']);
  defKnife(C, 'flipwing', 'Storm Fade', 'fade', ['#ffffff', '#6ad8ff', '#2a2aff']);

  CASES.push({ id: 'wasteland', name: 'Wasteland Case', color: '#d8843d', price: 450, desc: 'Scrap, rust and warning paint for the new guns.' });
  C = 'wasteland';
  defSkin(C, 1, 'mg42', 'Scrap Metal', 'rust', ['#4a3a2a', '#8a6a4a', '#2a1a10']);
  defSkin(C, 1, 'dbarrel', 'Sawn-Off', 'solid', ['#4a3a2a', '#2a2018']);
  defSkin(C, 1, 'm14', 'Dust Bowl', 'camo', ['#b89a6a', '#8a7050', '#d8c090', '#5a4a30']);
  defSkin(C, 1, 'mgl', 'Road Warrior', 'stripes', ['#1a1a1a', '#d8843d']);
  defSkin(C, 2, 'flamer', 'Burn Unit', 'stripes', ['#1a1a1a', '#ffd23d']);
  defSkin(C, 2, 'vector', 'Junkyard', 'rust', ['#3a2a1a', '#a85a2a', '#1a100a']);
  defSkin(C, 2, 'railgun', 'Salvage', 'mesh', ['#3a3a3a', '#d8843d']);
  defSkin(C, 2, 'minigun', 'Warlord', 'tiger', ['#d8843d', '#1a0a05']);
  defSkin(C, 3, 'flamer', 'Scorched Earth', 'flames', ['#120404', '#ff5a00', '#ffb000', '#fff1a6']);
  defSkin(C, 3, 'm249', 'Fallout', 'hex', ['#2a2a0a', '#ffd23d']);
  defSkin(C, 3, 'mg42', 'Iron Maiden', 'scales', ['#1a1a1a', '#6a6a6a', '#c8c8c8']);
  defSkin(C, 4, 'mgl', 'Big Bang', 'fade', ['#ffe14d', '#ff6a00', '#c2004d', '#3d005c']);
  defSkin(C, 4, 'dbarrel', 'Doomsday', 'waves', ['#0a0505', '#8a1a0a', '#ff6a1a', '#ffd23d']);
  defSkin(C, 5, 'flamer', 'Hellfire', 'doppler', ['#ff3d00', '#1a0500', '#ffb300', '#6a0f00']);
  defKnife(C, 'talon', 'Rust Coat', 'rust', ['#5a2a10', '#c86a2a', '#2a1508']);
  defKnife(C, 'spike', 'Hazard', 'stripes', ['#1a1a1a', '#ffd23d']);

  CASES.push({ id: 'midnight', name: 'Midnight Case', color: '#7a5aff', price: 480, desc: 'Deep space, nebulae and starlight.' });
  C = 'midnight';
  defSkin(C, 1, 'glock', 'Night Sky', 'digital', ['#0a0a1a', '#1a1a3d', '#4a4a8a']);
  defSkin(C, 1, 'mp9', 'Eclipse', 'fade', ['#000000', '#1a1a3d', '#7a5aff']);
  defSkin(C, 1, 'p90', 'Constellation', 'hex', ['#05051a', '#8a8aff']);
  defSkin(C, 1, 'ssg', 'Dark Matter', 'marble', ['#05050a', '#2a1a4a', '#0a0a14']);
  defSkin(C, 2, 'vector', 'Nebula', 'aurora', ['#05050f', '#ff3dd8', '#3d8aff', '#7a3dff']);
  defSkin(C, 2, 'aug', 'Moonlight', 'fade', ['#e8e8ff', '#7a7aa8', '#1a1a3d']);
  defSkin(C, 2, 'galil', 'Starfield', 'shards', ['#05050f', '#ffffff', '#6a6aff']);
  defSkin(C, 2, 'railgun', 'Event Horizon', 'waves', ['#000000', '#1a0a3d', '#7a3dff', '#ffffff']);
  defSkin(C, 3, 'ak47', 'Supernova', 'doppler', ['#ffffff', '#ff3dd8', '#3d0a6b', '#ffd23d']);
  defSkin(C, 3, 'm14', 'Orbit', 'lines', ['#05050f', '#8a8aff']);
  defSkin(C, 3, 'deagle', 'Cosmic', 'aurora', ['#05050f', '#3dffd8', '#b83dff', '#ffffff']);
  defSkin(C, 4, 'awp', 'Galaxy', 'doppler', ['#1a0a4a', '#ff71ce', '#01cdfe', '#05050f']);
  defSkin(C, 4, 'mg42', 'Black Hole', 'fade', ['#000000', '#3d0a6b', '#ff3dd8']);
  defSkin(C, 5, 'deagle', 'Starlight', 'doppler', ['#ffffff', '#6a6aff', '#e8e8ff', '#1a1a4a']);
  defKnife(C, 'flipwing', 'Nebula', 'aurora', ['#05050f', '#ff3dd8', '#3d8aff', '#7a3dff']);
  defKnife(C, 'talon', 'Black Pearl', 'doppler', ['#1a0a3d', '#000000', '#7a3dff', '#05050f']);
  // the catalogue list and lookups are built from SKINS: refresh them
  SKIN_LIST.length = 0; SKIN_LIST.push(...Object.values(SKINS));
})();
/* existing saves get zero counts for the new crates */
const _invLoad37 = Inv.load.bind(Inv);
Inv.load = function () { _invLoad37(); for (const c of CASES) { if (this.data.cases[c.id] == null) this.data.cases[c.id] = 0; if (this.data.keys[c.id] == null) this.data.keys[c.id] = 0; } this.save(); };
