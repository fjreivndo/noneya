/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · More vehicles.
   · Anti-air truck: a twin flak cannon on a turret. Shells burst next to
     helicopters and jets (proximity fuse), weak against the ground. Bots
     man it and track aircraft.
   · Patrol boat: armoured, a heavy machine gun on the bow for the second
     seat (like the tank's roof gun).
   · Transport truck: driver, co-driver and four more in the back, who can
     shoot out over the tailgate.
   One of each (where there's water, for the boat) at every Conquest and
   Breakthrough HQ.
   ═══════════════════════════════════════════════════════════════════════════ */
WEAPONS.flak = { id: 'flak', name: 'Flak cannon', slot: 0, type: 'lmg', dmg: 40, rpm: 260, hidden: true, speed: 1, spread: 0, moveSpread: 0, recoil: 0, pen: 1, sound: 1.8, explosive: true };
function buildAA(team) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#6a6446' : '#4a5a52'), K = lam('#1a1a1a'), Dk = lam(team === 'T' ? '#4e4a32' : '#36443e'), G = lam('#8ab4cc');
  g.add(bx(2.3, 0.5, 5.4, Dk, 0, 0.75, 0.2)); g.add(bx(2.2, 1.3, 1.7, C, 0, 1.55, -1.8)); g.add(bx(2.0, 0.5, 0.05, G, 0, 1.85, -2.66));
  g.add(bx(2.3, 0.35, 3.3, C, 0, 1.2, 1.0));
  const wheels = []; for (const x of [-1.15, 1.15]) for (const z of [-1.8, 0.6, 1.9]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.36, 12), K); w.rotation.z = Math.PI / 2; w.position.set(x, 0.48, z); g.add(w); wheels.push(w); }
  const turret = new THREE.Group(); turret.position.set(0, 1.45, 1.1); turret.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.35, 14), Dk)); turret.add(bx(1.3, 0.8, 0.9, C, 0, 0.55, 0.1)); g.add(turret);
  const gun = new THREE.Group(); gun.position.set(0, 0.75, -0.25); for (const s of [-0.28, 0.28]) { gun.add(cyl(0.07, 2.2, K, s, 0, -1.0, 10)); gun.add(bx(0.18, 0.18, 0.4, K, s, 0, -2.15)); } gun.add(bx(0.8, 0.35, 0.6, Dk, 0, 0, 0)); turret.add(gun);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -2.4); gun.add(muzzle);
  const radar = new THREE.Group(); radar.position.set(0, 2.25, -1.8); radar.add(bx(0.9, 0.35, 0.05, lam('#aab0b4'), 0, 0.25, 0)); radar.add(cyl(0.04, 0.3, K, 0, 0.05, 0, 6)); g.add(radar);
  g.userData = { wheels, turret, gun, muzzle, radar, paint: C }; return g;
}
function buildTruck(team) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#6a6446' : '#4a5a52'), K = lam('#1a1a1a'), Dk = lam(team === 'T' ? '#4e4a32' : '#36443e'), Cv = lam(team === 'T' ? '#7a7454' : '#5a6a60'), G = lam('#8ab4cc');
  g.add(bx(2.2, 0.4, 6.2, Dk, 0, 0.8, 0.3)); g.add(bx(2.2, 1.5, 1.8, C, 0, 1.7, -2.0)); g.add(bx(2.0, 0.6, 0.05, G, 0, 2.05, -2.92)); g.add(bx(2.1, 0.5, 0.9, C, 0, 1.2, -3.2));
  g.add(bx(2.3, 0.1, 3.9, Dk, 0, 1.05, 1.35)); for (const s of [-1.1, 1.1]) g.add(bx(0.08, 0.55, 3.9, C, s, 1.35, 1.35)); g.add(bx(2.3, 0.55, 0.08, C, 0, 1.35, -0.6));
  for (const s of [-0.75, 0.75]) g.add(bx(0.45, 0.35, 3.3, lam('#5a4a30'), s, 1.3, 1.5));   // benches
  for (const z of [-0.4, 0.9, 2.2, 3.2]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.04, 4, 12, Math.PI), K); hoop.position.set(0, 1.6, z); g.add(hoop); }
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 3.7, 12, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshLambertMaterial({ color: Cv.color, side: THREE.DoubleSide })); cover.rotation.x = Math.PI / 2; cover.position.set(0, 1.6, 1.4); g.add(cover);
  const wheels = []; for (const x of [-1.1, 1.1]) for (const z of [-2.3, 1.2, 2.5]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.38, 12), K); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w); wheels.push(w); }
  g.userData = { wheels, paint: C }; return g;
}
function buildPBoat(team) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#5a5e56' : '#4e5a66'), S = lam(team === 'T' ? '#a03a2a' : '#2a5aa0'), K = lam('#222'), Gl = lam('#8ab4cc'), M = lam('#3a3a3a');
  g.add(bx(2.4, 0.8, 6.0, C, 0, 0.45, 0.4)); const bow = bx(1.7, 0.8, 1.7, C, 0, 0.45, -2.5); bow.rotation.y = Math.PI / 4; g.add(bow); g.add(bx(2.42, 0.12, 6.02, S, 0, 0.85, 0.4));
  g.add(bx(1.6, 1.1, 1.6, C, 0, 1.4, 0.8)); g.add(bx(1.5, 0.4, 0.05, Gl, 0, 1.6, -0.02)); g.add(bx(1.8, 0.1, 1.8, M, 0, 2.0, 0.8)); g.add(cyl(0.03, 1.4, K, 0.5, 2.7, 1.2, 6));
  g.add(bx(0.5, 0.8, 0.5, K, 0, 0.6, 3.2));
  const pin = new THREE.Group(); pin.position.set(0, 1.0, -1.7); pin.add(bx(0.08, 0.4, 0.08, M, 0, 0.1, 0)); pin.add(bx(0.9, 0.5, 0.06, M, 0, 0.3, -0.25));
  const gun = new THREE.Group(); gun.position.y = 0.35; pin.add(gun); gun.add(bx(0.14, 0.14, 0.55, K, 0, 0, -0.1)); gun.add(cyl(0.03, 0.8, K, 0, 0, -0.7));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -1.1); gun.add(muzzle); g.add(pin);
  g.userData = { wheels: [], paint: C, pintle: pin, pintleGun: gun, pintleMuzzle: muzzle }; return g;
}
Object.assign(VKIND, {
  aa: { name: 'AA truck', desc: 'Twin flak cannon: shells burst next to aircraft', hp: 900, max: 19, rev: -7, acc: 9, r: 1.4, h: 2.2, br: 1.3, bh: 2.4, crush: 12, enter: 4, bullet: 0.05, blast: 1.3, at: 1.4, respawn: 40, seats: 1, closed: true, turret: true, seatAt: [0, 2.4, 1.1], camBack: 10, build: buildAA,
    guns: { lmb: { label: 'flak', wid: 'flak', rpm: 260, dmg: 40, spread: 0.006, turret: true, flak: true } } },
  truck: { name: 'Transport truck', desc: 'Six seats: four in the back can shoot', hp: 900, max: 21, rev: -7, acc: 10, r: 1.35, h: 2.3, br: 1.3, bh: 2.5, crush: 14, enter: 4.2, bullet: 0.08, blast: 1.6, at: 1.2, respawn: 35, seats: 2, cargo: 4,
    seatAt: [-0.5, 1.65, -2.0], seatAt2: [0.5, 1.65, -2.0], cargoAt: [[-0.7, 1.55, 0.6], [0.7, 1.55, 0.6], [-0.7, 1.55, 2.0], [0.7, 1.55, 2.0]], build: buildTruck },
  pboat: { name: 'Patrol boat', desc: 'Armoured, bow machine gun for the second seat', type: 'boat', hp: 800, max: 22, rev: -6, acc: 10, r: 1.6, h: 1.5, br: 1.5, bh: 1.8, crush: 8, enter: 4, bullet: 0.06, blast: 1.6, at: 1.2, respawn: 35, seats: 2,
    seatAt: [0, 1.25, 0.9], seatAt2: [0, 1.25, -1.6], pguns: { wid: 'hmg', rpm: 650, dmg: 30, spread: 0.012 }, build: buildPBoat },
});

/* ── flak: proximity bursts next to aircraft ───────────────────────────── */
const _vhs55 = vehHitscan;
vehHitscan = function (v, s, o, d, G) {
  if (!G.flak) return _vhs55(v, s, o, d, G);
  let best = null, bt = 0, bd = 8;
  for (const a of Game.vehicles) {
    if (!a.alive || a === v || !(a.K.type === 'heli' || a.K.type === 'jet')) continue;
    const c = new V3(a.pos.x, a.pos.y + 1.2, a.pos.z), t = c.clone().sub(o).dot(d); if (t < 5 || t > 650) continue;
    const dd = o.clone().addScaledVector(d, t).distanceTo(c); if (dd < bd) { bd = dd; best = a; bt = t; }
  }
  if (best && World.los(o.x, o.y, o.z, best.pos.x, best.pos.y + 1, best.pos.z)) {
    const p = o.clone().addScaledVector(d, bt - 0.5), mine = s.ctrl === 'local' || (s.ctrl === 'bot' && Game.authority());
    if (mine) Game.reportVehicleHit(s, best, G.dmg * 3.2 * (1 - bd / 9), G.wid);
    FX.emit('add', p.x, p.y, p.z, 14, 9, [1, 0.7, 0.3], 0.18, 0, 1); FX.emit('big', p.x, p.y, p.z, 6, 1.5, [0.2, 0.2, 0.2], 1.4, 0.3, 0.6);
    Sfx.play('explode', p, { vol: 0.45 }); FX.tracer(o, p); FX.muzzle(o); Sfx.play('shot', o, { w: WEAPONS.flak });
    if (mine) Net.shot(s, p);
    return;
  }
  // no aircraft close to the line: a normal (weaker) round
  return _vhs55(v, s, o, d, Object.assign({}, G, { dmg: G.dmg * 0.7 }));
};

/* ── cargo seats (transport truck) ─────────────────────────────────────── */
function cargoOf(v) { return v.cargo || (v.cargo = [null, null, null, null].slice(0, v.K.cargo || 0)); }
const _enter55 = Game.tryEnterVehicle.bind(Game);
Game.tryEnterVehicle = function (s) {
  if (s.vehicle && s.cargoSeat != null) { this.exitVehicle(s); return true; }
  const r = _enter55(s); if (r) return r;
  for (const v of this.vehicles) {
    if (!v.alive || !v.K.cargo || dist2(v.pos.x, v.pos.z, s.pos.x, s.pos.z) > v.K.enter + 0.8) continue;
    const C = cargoOf(v), k = C.findIndex(x => !x || !x.alive || x.vehicle !== v); if (k < 0) continue;
    if (!this.authority()) { Net.send({ t: 'cgo', v: v.id }); return true; }
    this.seatCargo(v, s, k); return true;
  }
  return false;
};
Game.seatCargo = function (v, s, k) {
  const C = cargoOf(v); C[k] = s; s.vehicle = v; s.cargoSeat = k;
  if (s.ctrl === 'local') HUD.center('In the back · shoot over the side · E to get out', 1.6);
  if (Net.role === 'host') Net.event({ t: 'cgs', v: v.id, c: C.map(x => x ? x.id : null) });
};
const _exit55 = Game.exitVehicle.bind(Game);
Game.exitVehicle = function (s, forced) {
  const v = s.vehicle;
  if (v && s.cargoSeat != null) { const C = cargoOf(v); if (C[s.cargoSeat] === s) C[s.cargoSeat] = null; s.cargoSeat = null; if (Net.role === 'host') Net.event({ t: 'cgs', v: v.id, c: C.map(x => x ? x.id : null) }); else if (Net.role === 'client' && s.ctrl === 'local') Net.send({ t: 'cgx' }); }
  return _exit55(s, forced);
};
const _seat55 = Vehicle.prototype.seatPos;
Vehicle.prototype.seatPos = function (out, s) {
  if (s && s.cargoSeat != null && this.K.cargoAt) { const a = this.K.cargoAt[s.cargoSeat] || this.K.cargoAt[0], c = Math.cos(this.yaw), sn = Math.sin(this.yaw); return out.set(this.pos.x + c * a[0] + sn * a[2], this.pos.y + a[1], this.pos.z - sn * a[0] + c * a[2]); }
  return _seat55.call(this, out, s);
};
/* a wrecked truck takes everyone in the back with it */
const _vdmg55 = Vehicle.prototype.damage;
Vehicle.prototype.damage = function (d, by) {
  const riders = this.cargo ? this.cargo.filter(x => x && x.vehicle === this) : [], was = this.alive;
  const r = _vdmg55.call(this, d, by);
  if (was && !this.alive) for (const s of riders) { Game.exitVehicle(s, true); if (Game.authority()) Game.damage(s, 999, by, 'jeep', 'chest'); }
  return r;
};
const _kill55 = Game.kill.bind(Game);
Game.kill = function (v, att, weapon, hs) { if (v && v.vehicle && v.cargoSeat != null) { const C = cargoOf(v.vehicle); if (C[v.cargoSeat] === v) C[v.cargoSeat] = null; v.cargoSeat = null; } return _kill55(v, att, weapon, hs); };
const _hostData55 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  const p = this.peers && this.peers.get(id), s = p && p.sid && Game.byId(p.sid);
  if (m && m.t === 'cgo') { const v = Game.vehicles.find(x => x.id === m.v); if (s && v && v.alive && !s.vehicle) { const C = cargoOf(v), k = C.findIndex(x => !x || !x.alive || x.vehicle !== v); if (k >= 0) Game.seatCargo(v, s, k); } return; }
  if (m && m.t === 'cgx') { if (s && s.vehicle && s.cargoSeat != null) Game.exitVehicle(s); return; }
  return _hostData55(id, m);
};
const _applyEvent55 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  if (e && e.t === 'cgs') {
    const v = Game.vehicles.find(x => x.id === e.v); if (!v) return; const C = cargoOf(v);
    C.forEach((x, k) => { if (x && x.cargoSeat === k && x.vehicle === v && (e.c[k] !== x.id)) { x.cargoSeat = null; if (x !== Game.local || true) { x.vehicle = null; } } });
    e.c.forEach((id, k) => { const s = id && Game.byId(id); C[k] = s || null; if (s) { s.vehicle = v; s.cargoSeat = k; } });
    return;
  }
  return _applyEvent55(e);
};
/* the rider's model sits on the bench */
const _sync55 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) {
  const r = _sync55.call(this, dt, localTeam, viewer);
  if (this.vehicle && this.cargoSeat != null && this.model && this.alive) { this.vehicle.seatPos(this.model.position, this); this.model.position.y = this.vehicle.pos.y + 1.0; }
  return r;
};
const _vhint55 = vehicleHint;
vehicleHint = function (L) { const v = L.vehicle; if (v && L.cargoSeat != null) return `${v.K.name} · riding in the back · E get off`; return _vhint55(L); };

/* ── bots on the AA guns: track aircraft ───────────────────────────────── */
const AaAI = {
  t: 0,
  update(dt) {
    if (!Game.authority() || !Game.running || !Game.mode.vehicles) return;
    for (const v of Game.vehicles) {
      if (v.kind !== 'aa' || !v.alive) continue;
      const d = v.driver;
      if (!d) {
        this.t -= dt; if (this.t > 0) continue; this.t = 1;
        if (v.spawn && v.spawn.playerOnly) continue;
        const air = Game.vehicles.some(a => a.alive && a.team !== v.team && (a.K.type === 'heli' || a.K.type === 'jet') && a.driver);
        if (!air) continue;
        const b = Game.soldiers.find(s => s.ctrl === 'bot' && s.alive && !s.vehicle && s.team === v.team && !s.npc && dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z) < 40 && !(s.brain && s.brain.target && !(s.brain.target.vehicle && (s.brain.target.vehicle.K.type === 'heli' || s.brain.target.vehicle.K.type === 'jet'))) && (typeof squadBusy !== 'function' || !squadBusy(s)));
        if (b) { v.driver = b; b.vehicle = v; Net.vehicleSeat(v); }
        continue;
      }
      if (d.ctrl !== 'bot') continue;
      v.speed *= Math.exp(-dt * 3);
      let tgt = null, bd = 380;
      for (const a of Game.vehicles) if (a.alive && a.team !== v.team && (a.K.type === 'heli' || a.K.type === 'jet') && a.driver) { const dd = dist3(a.pos, v.pos); if (dd < bd) { bd = dd; tgt = a; } }
      if (!tgt) { v.idleT = (v.idleT || 0) + dt; if (v.idleT > 25) { v.idleT = 0; Game.exitVehicle(d); } continue; }
      v.idleT = 0;
      const muzzle = new V3(v.pos.x, v.pos.y + 2.6, v.pos.z), lead = bd / 420, aim = tgt.pos.clone().addScaledVector(tgt.vel || new V3(), lead).setY(tgt.pos.y + 1.2 + (tgt.vel ? tgt.vel.y * lead : 0));
      const dx = aim.x - muzzle.x, dy = aim.y - muzzle.y, dz = aim.z - muzzle.z;
      d.yaw = Math.atan2(-dx, -dz); d.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.2, 1.3);
      const tY = v.yaw + (v.tYaw || 0), err = Math.abs(angDiff(tY, d.yaw)) + Math.abs((v.tPitch || 0) - d.pitch);
      if (err < 0.12 && World.los(muzzle.x, muzzle.y, muzzle.z, tgt.pos.x, tgt.pos.y + 1, tgt.pos.z)) v.shoot(d, 'lmb');
    }
  },
};
const _aiUpd55 = AI.update.bind(AI);
AI.update = function (dt) { _aiUpd55(dt); AaAI.update(dt); };
/* flak turret pitches high; the radar spins */
const _gupdate55 = Game.update.bind(Game);
Game.update = function (dt) {
  _gupdate55(dt); if (!this.running) return;
  for (const v of this.vehicles) { if (v.kind === 'aa' && v.model && v.model.userData.radar) v.model.userData.radar.rotation.y += dt * 2.5; if (v.guns && v.guns.lmb && v.kind === 'aa') v.guns.lmb.cd -= 0; }
};
const _aim55 = Vehicle.prototype.aimTurret;
Vehicle.prototype.aimTurret = function (dt, yaw, pitch) {
  if (this.kind !== 'aa') return _aim55.call(this, dt, yaw, pitch);
  const want = angDiff(this.yaw, yaw); this.tYaw = (this.tYaw || 0) + clamp(angDiff(this.tYaw || 0, want), -dt * 2.2, dt * 2.2);
  this.tPitch = (this.tPitch || 0) + clamp(clamp(pitch, -0.1, 1.35) - (this.tPitch || 0), -dt * 1.8, dt * 1.8);
};
const _syncT55 = Vehicle.prototype.syncTurret;
Vehicle.prototype.syncTurret = function () { if (this.kind !== 'aa') return _syncT55.call(this); const u = this.model.userData; if (!u.turret) return; u.turret.rotation.y = this.tYaw || 0; u.gun.rotation.x = this.tPitch || 0; };

/* ── where they park ───────────────────────────────────────────────────── */
function freeSpot(x, z, r, list) {
  const offs = [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8], [12, 6], [-12, 6], [12, -6], [-12, -6], [16, 0], [-16, 0], [0, 16], [0, -16], [20, 10], [-20, 10], [20, -10], [-20, -10]];
  for (const [ox, oz] of offs) {
    const px = x + ox, pz = z + oz; if (!World.nav.walkableAt(px, pz) || !World.bodyFree(px, 0, pz, r, 2.4) || inWater(px, pz)) continue;
    if (list.some(s => dist2(s.x, s.z, px, pz) < r * 2 + 3)) continue;
    return { x: px, z: pz };
  }
  return null;
}
const _loadMap55 = loadMap;
loadMap = function (id, scene) {
  _loadMap55(id, scene);
  if (!['ridgeline', 'frostpeak', 'oasis', 'city', 'flatgrass', 'dockyard'].includes(id)) return;
  const S = World.vehicleSpawns, land = !['flatgrass', 'dockyard'].includes(id);
  for (const team of ['T', 'CT']) {
    const hq = World.hq[team]; if (!hq || !land) continue;
    const out = hq.z > 0 ? -1 : 1;   // toward the middle of the map
    for (const kind of ['aa', 'truck']) { const p = freeSpot(hq.x + (kind === 'aa' ? -14 : 14), hq.z + out * 10, 2.2, S); if (p) S.push({ team, x: p.x, z: p.z, yaw: out > 0 ? Math.PI : 0, kind }); }
  }
  // a patrol boat next to each side's speedboat
  for (const b of S.filter(v => v.kind === 'boat').slice(0, 4)) {
    for (const [ox, oz] of [[6, 0], [-6, 0], [0, 6], [0, -6], [8, 4], [-8, 4]]) { const w = inWater(b.x + ox, b.z + oz); if (w && w.depth > 1 && !S.some(o => dist2(o.x, o.z, b.x + ox, b.z + oz) < 4)) { S.push({ team: b.team, x: b.x + ox, z: b.z + oz, yaw: b.yaw, kind: 'pboat' }); break; } }
  }
};
