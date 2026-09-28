/* ═══════════════════════════════════════════════════════════════════════════
   More vehicles.
   Helicopter     transport; the passenger can shoot out of the door
   Attack heli    minigun (LMB) and rocket pods (RMB), crew protected
   Jet            fast; W/S throttle, the mouse steers, cannon and bombs
   Motorbike, Quad bike   quick and light
   APC            armoured, a machine-gun turret you aim with the mouse
   Speedboat      fast on water, stuck on land (Flatgrass has a lake)
   Flying: W/S/A/D move, the mouse turns, Space climbs, Ctrl descends.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── guns fitted to vehicles (hidden weapons, for the kill feed and sounds) ── */
Object.assign(WEAPONS, {
  helimg:     { name: 'Heli minigun', slot: 0, type: 'lmg', dmg: 20, rpm: 1100, hidden: true, speed: 1, spread: 0, moveSpread: 0, recoil: 0, pen: 0.8, sound: 1.3 },
  helirocket: { name: 'Hydra rockets', slot: 0, type: 'launcher', dmg: 140, radius: 4, projectile: 95, gravity: 0.6, explosive: true, hidden: true, speed: 1, spread: 0, moveSpread: 0, recoil: 0, pen: 1 },
  jetgun:     { name: 'Jet cannon', slot: 0, type: 'lmg', dmg: 30, rpm: 1300, hidden: true, speed: 1, spread: 0, moveSpread: 0, recoil: 0, pen: 1, sound: 1.5 },
  jetbomb:    { name: 'Bomb', slot: 0, type: 'launcher', dmg: 320, radius: 8, projectile: 40, gravity: 14, explosive: true, hidden: true, speed: 1, spread: 0, moveSpread: 0, recoil: 0, pen: 1 },
  apcgun:     { name: 'APC gun', slot: 0, type: 'lmg', dmg: 28, rpm: 600, hidden: true, speed: 1, spread: 0, moveSpread: 0, recoil: 0, pen: 1, sound: 1.3 },
});
for (const id of ['helimg', 'helirocket', 'jetgun', 'jetbomb', 'apcgun']) WEAPONS[id].id = id;

/* ── models ────────────────────────────────────────────────────────────── */
function rotorBlades(len, w, M) { const g = new THREE.Group(); g.add(bx(len, 0.05, w, M)); g.add(bx(w, 0.05, len, M)); g.add(vcyl(0.12, 0.2, lam('#222'), 0, 0, 0)); return g; }
function buildHeli(team, attack) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#5e5a3a' : '#3e4e5e'), K = lam('#1c1c1c'), Gl = lam('#8ab4cc'), M = lam('#444');
  if (attack) {
    g.add(bx(1.1, 1.2, 4.4, C, 0, 1.4, 0)); g.add(bx(0.9, 0.7, 1.6, Gl, 0, 2.2, -0.9)); g.add(bx(0.4, 0.4, 4.0, C, 0, 1.7, 3.8)); g.add(bx(0.1, 1.2, 0.9, C, 0, 2.3, 5.6));
    g.add(bx(3.2, 0.1, 0.8, C, 0, 1.3, 0.2)); for (const x of [-1.4, 1.4]) g.add(cyl(0.18, 1.2, K, x, 1.1, 0.1, 10));
    g.add(cyl(0.05, 0.9, K, 0, 0.75, -2.5, 6)); g.add(bx(0.3, 0.25, 0.3, M, 0, 0.8, -2.1));
  } else {
    g.add(bx(1.8, 1.6, 4.2, C, 0, 1.45, 0)); g.add(bx(1.6, 1.0, 1.1, Gl, 0, 1.6, -2.2)); g.add(bx(0.4, 0.4, 3.8, C, 0, 1.8, 3.8)); g.add(bx(0.1, 1.2, 0.9, C, 0, 2.4, 5.5));
    g.add(bx(0.02, 1.0, 1.4, K, 0.91, 1.5, 0.2)); g.add(bx(0.02, 1.0, 1.4, K, -0.91, 1.5, 0.2));
  }
  for (const x of [-0.85, 0.85]) { g.add(bx(0.08, 0.08, 3.4, M, x, 0.08, 0)); g.add(bx(0.06, 0.5, 0.06, M, x, 0.35, -0.8)); g.add(bx(0.06, 0.5, 0.06, M, x, 0.35, 0.8)); }
  const rotor = rotorBlades(attack ? 9 : 10, 0.32, K); rotor.position.set(0, attack ? 2.35 : 2.45, 0.1); g.add(rotor); g.add(vcyl(0.1, 0.4, M, 0, attack ? 2.1 : 2.2, 0.1));
  const tail = new THREE.Group(); tail.add(bx(0.04, 1.4, 0.16, K)); tail.add(bx(0.04, 0.16, 1.4, K)); tail.position.set(0.26, 2.2, attack ? 5.7 : 5.6); g.add(tail);
  g.userData = { wheels: [], rotor, tail, paint: C }; return g;
}
function buildAttackHeli(team) { return buildHeli(team, true); }
function buildJet(team) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#6a6450' : '#5a6878'), K = lam('#222'), Gl = lam('#3a5a7a');
  g.add(bx(1.1, 1.0, 8.6, C, 0, 1.3, 0)); const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 8), C); nose.rotation.x = -Math.PI / 2; nose.position.set(0, 1.3, -5.2); g.add(nose);
  g.add(bx(0.7, 0.45, 1.8, Gl, 0, 1.95, -2.4)); g.add(bx(9, 0.12, 2.4, C, 0, 1.2, 0.6)); g.add(bx(3.6, 0.1, 1.1, C, 0, 1.3, 3.8)); g.add(bx(0.12, 1.7, 1.5, C, 0, 2.3, 3.8));
  g.add(cyl(0.45, 0.4, K, 0, 1.3, 4.4, 10)); const flame = cyl(0.35, 0.6, new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 0, 1.3, 4.9, 10); g.add(flame);
  for (const [x, z] of [[0, -3], [-1.4, 0.8], [1.4, 0.8]]) { g.add(bx(0.08, 0.7, 0.08, K, x, 0.45, z)); const w = cyl(0.16, 0.12, K, x, 0.14, z, 10); w.rotation.set(0, 0, Math.PI / 2); g.add(w); }
  g.userData = { wheels: [], flame, paint: C }; return g;
}
function buildBike(team) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#a03a2a' : '#2a5aa0'), K = lam('#1a1a1a'), M = lam('#888');
  const wheels = []; for (const z of [-0.75, 0.75]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 14), K); w.rotation.z = Math.PI / 2; w.position.set(0, 0.34, z); g.add(w); wheels.push(w); }
  g.add(bx(0.3, 0.35, 1.1, C, 0, 0.7, 0)); g.add(bx(0.26, 0.12, 0.6, K, 0, 0.92, 0.25)); const fork = bx(0.06, 0.6, 0.06, M, 0, 0.8, -0.72); fork.rotation.x = 0.35; g.add(fork); g.add(bx(0.7, 0.05, 0.05, M, 0, 1.12, -0.62));
  g.add(bx(0.24, 0.2, 0.3, lam('#ffffcc'), 0, 0.9, -0.82));
  g.userData = { wheels, paint: C }; return g;
}
function buildQuad(team) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#6a7a2a' : '#2a6a5a'), K = lam('#1a1a1a'), M = lam('#666');
  const wheels = []; for (const [x, z] of [[-0.6, -0.65], [0.6, -0.65], [-0.6, 0.65], [0.6, 0.65]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12), K); w.rotation.z = Math.PI / 2; w.position.set(x, 0.3, z); g.add(w); wheels.push(w); }
  g.add(bx(0.9, 0.35, 1.5, C, 0, 0.6, 0)); g.add(bx(0.5, 0.15, 0.7, K, 0, 0.85, 0.25)); g.add(bx(0.8, 0.05, 0.05, M, 0, 1.05, -0.5)); g.add(bx(1.2, 0.06, 0.4, C, 0, 0.72, -0.8)); g.add(bx(1.2, 0.06, 0.4, C, 0, 0.72, 0.8));
  g.userData = { wheels, paint: C }; return g;
}
function buildAPC(team) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#6a6446' : '#4a5a52'), K = lam('#1a1a1a'), Dk = lam(team === 'T' ? '#4e4a32' : '#36443e');
  g.add(bx(2.6, 1.3, 5.6, C, 0, 1.25, 0)); const nose = bx(2.6, 0.8, 1.2, C, 0, 1.45, -2.9); nose.rotation.x = 0.5; g.add(nose); g.add(bx(2.2, 0.1, 4.6, Dk, 0, 1.95, 0.3));
  const wheels = []; for (const x of [-1.35, 1.35]) for (const z of [-1.8, -0.6, 0.6, 1.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12), K); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w); wheels.push(w); }
  const turret = new THREE.Group(); turret.position.set(0, 2.1, -0.4); turret.add(bx(1.1, 0.5, 1.3, Dk, 0, 0.1, 0)); g.add(turret);
  const gun = new THREE.Group(); gun.position.set(0, 0.15, -1.25); gun.add(cyl(0.07, 1.4, K, 0, 0, 0.1, 8)); turret.add(gun);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -0.65); gun.add(muzzle);
  g.userData = { wheels, turret, gun, muzzle, paint: C }; return g;
}
function buildBoat(team) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#c8c0a8' : '#e8e8ec'), S = lam(team === 'T' ? '#a03a2a' : '#2a5aa0'), K = lam('#222'), Gl = lam('#8ab4cc');
  g.add(bx(1.8, 0.6, 3.6, C, 0, 0.35, 0.3)); const bow = bx(1.28, 0.6, 1.28, C, 0, 0.35, -1.5); bow.rotation.y = Math.PI / 4; g.add(bow); g.add(bx(1.82, 0.1, 3.62, S, 0, 0.6, 0.3));
  g.add(bx(1.4, 0.4, 0.05, Gl, 0, 0.9, -0.5)); g.add(bx(0.4, 0.7, 0.4, K, 0, 0.5, 2.2));
  g.userData = { wheels: [], paint: C }; return g;
}

/* ── kinds ─────────────────────────────────────────────────────────────── */
Object.assign(VKIND.jeep, { desc: 'Fast, two seats. E to drive' });
Object.assign(VKIND.car, { desc: 'Quick and light. E to drive' });
Object.assign(VKIND.tank, { desc: 'Armoured, cannon on LMB', br: 1.7, bh: 2.2, camBack: 10 });
Object.assign(VKIND, {
  heli:       { name: 'Helicopter', desc: 'Two seats; your passenger can shoot out of the door', type: 'heli', hp: 700, max: 28, rev: 0, acc: 0, r: 1.5, h: 2.6, br: 1.6, bh: 2.9, crush: 0, enter: 4.5, bullet: 0.12, blast: 1.6, at: 1.4, respawn: 40, seats: 2, seatAt: [-0.45, 1.0, -1.5], seatAt2: [0.6, 1.0, 0.4], camBack: 14, build: buildHeli },
  attackheli: { name: 'Attack heli', desc: 'Minigun (LMB) and rockets (RMB)', type: 'heli', hp: 900, max: 32, rev: 0, acc: 0, r: 1.4, h: 2.5, br: 1.5, bh: 2.8, crush: 0, enter: 4.5, bullet: 0.07, blast: 1.4, at: 1.4, respawn: 45, seats: 1, closed: true, seatAt: [0, 1.6, -0.9], camBack: 14, build: buildAttackHeli,
    guns: { lmb: { label: 'minigun', wid: 'helimg', rpm: 1100, dmg: 20, spread: 0.012, from: [0, 0.75, -2.95] }, rmb: { label: 'rockets', type: 'rocket', wid: 'helirocket', rpm: 240, clip: 14, reload: 7, from: [-1.4, 1.1, -0.6], alt: [1.4, 1.1, -0.6] } } },
  jet:        { name: 'Jet', desc: 'W/S throttle, mouse steers. Cannon (LMB), bombs (RMB)', type: 'jet', hp: 550, max: 72, stall: 26, rev: 0, acc: 0, r: 1.6, h: 2.0, br: 1.8, bh: 2.4, crush: 0, enter: 5, bullet: 0.12, blast: 1.8, at: 1.2, respawn: 50, seats: 1, closed: true, seatAt: [0, 1.9, -2.4], camBack: 20, build: buildJet,
    guns: { lmb: { label: 'cannon', wid: 'jetgun', rpm: 1300, dmg: 30, spread: 0.01, from: [0, 1.3, -5.8] }, rmb: { label: 'bombs', type: 'rocket', wid: 'jetbomb', rpm: 120, clip: 4, reload: 10, drop: true, from: [0, 0.3, 0.5] } } },
  bike:       { name: 'Motorbike', desc: 'The fastest thing on wheels. One seat', hp: 200, max: 34, rev: -5, acc: 20, r: 0.6, h: 1.4, br: 0.7, bh: 1.4, crush: 5, enter: 2.8, bullet: 0.4, blast: 3, at: 1, respawn: 20, seats: 1, seatAt: [0, 1.05, 0.15], lean: true, build: buildBike },
  quad:       { name: 'Quad bike', desc: 'Nimble, two seats', hp: 280, max: 26, rev: -7, acc: 17, r: 0.85, h: 1.3, br: 0.95, bh: 1.3, crush: 6, enter: 3, bullet: 0.3, blast: 2.6, at: 1, respawn: 20, seats: 2, seatAt: [0, 1.1, 0.1], seatAt2: [0, 1.15, 0.6], build: buildQuad },
  apc:        { name: 'APC', desc: 'Armoured, machine-gun turret, carries two', hp: 1500, max: 18, rev: -7, acc: 9, r: 1.5, h: 2.4, br: 1.5, bh: 2.4, crush: 18, enter: 4, bullet: 0.03, blast: 1.2, at: 1.5, respawn: 40, seats: 2, closed: true, turret: true, seatAt: [0, 2.3, 0], seatAt2: [0, 1.6, 1.4], camBack: 10, build: buildAPC,
    guns: { lmb: { label: 'machine gun', wid: 'apcgun', rpm: 600, dmg: 28, spread: 0.008, turret: true } } },
  boat:       { name: 'Speedboat', desc: 'Fast on water, stuck on land. Flatgrass has a lake', type: 'boat', hp: 320, max: 26, rev: -6, acc: 13, r: 1.2, h: 1.2, br: 1.2, bh: 1.2, crush: 6, enter: 3.5, bullet: 0.2, blast: 2.4, at: 1, respawn: 25, seats: 2, seatAt: [-0.4, 0.75, 0.3], seatAt2: [0.4, 0.75, 0.9], build: buildBoat },
});

/* ── seats, hitboxes, controls ─────────────────────────────────────────── */
const _seat22 = Vehicle.prototype.seatPos;
Vehicle.prototype.seatPos = function (out, s) {
  const K = this.K; if (!K.seatAt) return _seat22.call(this, out, s);
  const a = s === this.passenger && K.seatAt2 ? K.seatAt2 : K.seatAt, c = Math.cos(this.yaw), sn = Math.sin(this.yaw);
  return out.set(this.pos.x + c * a[0] + sn * a[2], this.pos.y + a[1], this.pos.z - sn * a[0] + c * a[2]);
};
Vehicle.prototype.box = function () {
  const K = this.K, r = K.br || 1.1, h = K.bh || 1.6;
  return { x0: this.pos.x - r, x1: this.pos.x + r, y0: this.pos.y + 0.2, y1: this.pos.y + h, z0: this.pos.z - r, z1: this.pos.z + r };
};
Vehicle.prototype.gunState = function (k) { const g = this.guns || (this.guns = {}); return g[k] || (g[k] = { cd: 0, reload: 0, n: (this.K.guns && this.K.guns[k] && this.K.guns[k].clip) || 0, alt: false }); };
Vehicle.prototype.controls = function (s, I) {
  if (this.K.guns) { if (I.mouse.left) this.shoot(s, 'lmb'); if (I.mouse.right) this.shoot(s, 'rmb'); }
  else if (I.mouse.left && this.kind === 'tank') this.fire(s);
};
const _fire22 = Vehicle.prototype.fire;
Vehicle.prototype.fire = function (s) { if (this.K.guns) return this.shoot(s, 'lmb'); return _fire22.call(this, s); };
const _vin22 = Player.vehicleInput.bind(Player);
Player.vehicleInput = function () { const r = _vin22(), I = Input, b = UI.blocking(); r.up = !b && I.down('Space') ? 1 : 0; r.down = !b && (I.down('ControlLeft') || I.down('KeyC')) ? 1 : 0; return r; };

/* where the driver is aiming: the point under the crosshair */
function aimPoint(s, v) {
  if (s.ctrl === 'local' && Game.camera) {
    const o = Game.camera.position.clone(), d = Game.camera.getWorldDirection(new V3());
    // start past our own hull, then find the first thing under the crosshair: level, ground, props, people, vehicles
    const tv = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, v.box()); if (tv >= 0) o.addScaledVector(d, tv + 0.2);
    let t = World.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 700); if (t < 0) t = 700;
    if (d.y < -1e-3) t = Math.min(t, o.y / -d.y);
    const ph = Phys.active ? Phys.ray(o, d, t) : null; if (ph) t = ph.t;
    const sh = raySoldiers(o, d, t, s, Game.soldiers); if (sh) t = sh.t;
    const vh = Game.rayVehicles(o, d, t, v); if (vh) t = vh.t;
    return o.addScaledVector(d, Math.max(t, 8));
  }
  return s.eye(new V3()).addScaledVector(s.forward(new V3()), 300);
}
function vehHitscan(v, s, o, d, G) {
  let t = World.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 600); const n = new V3(World.hit.nx, World.hit.ny, World.hit.nz); if (t < 0) t = 600;
  const ph = Phys.active ? Phys.ray(o, d, t) : null; if (ph) { t = ph.t; n.copy(ph.n); }
  const sh = raySoldiers(o, d, t, s, Game.soldiers);
  let vh = null; for (const x of Game.vehicles) { if (x === v || !x.alive) continue; const tt = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, x.box()); if (tt >= 0 && tt < (sh ? sh.t : t) && (!vh || tt < vh.t)) vh = { v: x, t: tt }; }
  const end = o.clone().addScaledVector(d, vh ? vh.t : sh ? sh.t : t), mine = s.ctrl === 'local' || (s.ctrl === 'bot' && Game.authority());
  if (vh) { if (mine) Game.reportVehicleHit(s, vh.v, G.dmg * vh.v.K.bullet * 2, G.wid); FX.impact(end, d.clone().negate()); }
  else if (sh) { if (mine) Game.reportHit(s, sh.s, G.dmg * (sh.zone === 'head' ? 1.6 : 1) * rangeMult(WEAPONS[G.wid], sh.t), sh.zone, G.wid, o); FX.blood(end, d, 1); }
  else if (t < 600) { FX.impact(end, n); if (ph && mine) Game.propHit(s, ph.p, end, d, G.dmg); }
  if (Math.random() < 0.6) FX.tracer(o, end); FX.muzzle(o); Sfx.play('shot', o, { w: WEAPONS[G.wid] });
  if (mine) Net.shot(s, end);
}
Vehicle.prototype.shoot = function (s, k) {
  const G = this.K.guns && this.K.guns[k]; if (!G || !this.alive) return false;
  const st = this.gunState(k); if (st.cd > 0 || st.reload > 0) return false;
  st.cd = 60 / G.rpm;
  if (G.clip) { st.n--; if (st.n <= 0) { st.reload = G.reload; st.n = G.clip; } }
  this.model.updateMatrixWorld(true);
  const from = G.turret && this.model.userData.muzzle ? this.model.userData.muzzle.getWorldPosition(new V3()) : this.model.localToWorld(new V3(...(G.alt && st.alt ? G.alt : G.from)));
  st.alt = !st.alt;
  let dir;
  if (G.turret) { const yaw = this.yaw + this.tYaw, cp = Math.cos(this.tPitch); dir = new V3(-Math.sin(yaw) * cp, Math.sin(this.tPitch), -Math.cos(yaw) * cp); }
  else if (G.drop) dir = this.vel.clone().setY(Math.min(this.vel.y, 0) - 6).normalize();
  else dir = aimPoint(s, this).sub(from).normalize();
  if (G.spread) dir.add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(G.spread)).normalize();
  if (G.type === 'rocket') { Game.spawnRocket(s, from, dir, true, G.wid); Sfx.play('shot', from, { w: WEAPONS.rpg }); if (G.drop) Sfx.play('pin', from); return true; }
  vehHitscan(this, s, from, dir, G); this.recoil = Math.min(1, (this.recoil || 0) + 0.15);
  return true;
};

/* ── flight models ─────────────────────────────────────────────────────── */
function heliPhysics(v, dt) {
  const K = v.K, d = v.driver, inp = (d && v.inp) || { f: 0, s: 0, up: 0, down: 0 };
  v.rotorK = lerp(v.rotorK || 0, d ? 1 : 0, 1 - Math.exp(-dt * (d ? 0.9 : 0.35)));
  const fwd = new V3(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)), right = new V3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
  if (v.rotorK > 0.7) {
    const want = fwd.multiplyScalar(inp.f * K.max).add(right.multiplyScalar(inp.s * K.max * 0.55)); want.y = (inp.up - inp.down) * 9;
    const k = 1 - Math.exp(-dt * 1.3); v.vel.x += (want.x - v.vel.x) * k; v.vel.z += (want.z - v.vel.z) * k; v.vel.y += (want.y - v.vel.y) * (1 - Math.exp(-dt * 2.5));
    if (d) v.yaw = angWrap(v.yaw + clamp(angDiff(v.yaw, d.yaw), -1.8 * dt, 1.8 * dt));
  } else { v.vel.y -= PHYS.gravity * dt * (1 - v.rotorK); v.vel.x *= Math.exp(-dt * 0.6); v.vel.z *= Math.exp(-dt * 0.6); }
  if (v.pos.y > 140 && v.vel.y > 0) v.vel.y = 0;
  const sp = Math.hypot(v.vel.x, v.vel.z), r = moveBody(v.pos, v.vel, dt, K.r, K.h, false);
  if (Game.authority()) { if (r.landed > 11) v.damage((r.landed - 9) * 45, null); if (r.hitWall && sp > 12) { v.damage(sp * 12, null); v.vel.x *= -0.3; v.vel.z *= -0.3; } }
  if (r.grounded) { v.vel.x *= Math.exp(-dt * 5); v.vel.z *= Math.exp(-dt * 5); }
  v.speed = sp;
}
function jetPhysics(v, dt) {
  const K = v.K, d = v.driver, inp = (d && v.inp) || { f: 0 };
  v.throttle = clamp((v.throttle || 0) + (d ? inp.f * dt * 0.5 : -dt * 0.3), 0, 1);
  v.speed = lerp(v.speed, v.throttle * K.max, 1 - Math.exp(-dt * (v.throttle * K.max > v.speed ? 0.45 : 0.25)));
  const ground = !!v.grounded;
  if (d) {
    const dy = angDiff(v.yaw, d.yaw), mt = (ground ? 0.7 : 1.25) * dt, turn = clamp(dy, -mt, mt); v.yaw = angWrap(v.yaw + turn);
    v.bank = lerp(v.bank || 0, ground ? 0 : clamp(turn / dt * 0.7, -1.1, 1.1), 1 - Math.exp(-dt * 3));
    const want = ground && v.speed < K.stall ? 0 : clamp(d.pitch, ground ? 0 : -0.8, 0.7); v.jpitch = lerp(v.jpitch || 0, want, 1 - Math.exp(-dt * 1.6));
  } else { v.bank = lerp(v.bank || 0, 0, 1 - Math.exp(-dt)); v.jpitch = lerp(v.jpitch || 0, ground ? 0 : -0.35, 1 - Math.exp(-dt * 0.4)); }
  const cp = Math.cos(v.jpitch), lift = clamp(v.speed / K.stall, 0, 1);
  v.sink = ground ? 0 : lift < 1 ? (v.sink || 0) + PHYS.gravity * (1 - lift) * dt : Math.max(0, (v.sink || 0) - 25 * dt);
  v.vel.set(-Math.sin(v.yaw) * cp * v.speed, Math.sin(v.jpitch) * v.speed - v.sink, -Math.cos(v.yaw) * cp * v.speed);
  if (ground && v.vel.y < 0) v.vel.y = -2;
  const r = moveBody(v.pos, v.vel, dt, K.r, K.h, true); v.grounded = r.grounded;
  if (Game.authority()) { if (r.hitWall && v.speed > 16) v.damage(v.maxHp * 3, null); else if (r.landed > 13) v.damage((r.landed - 11) * 60, null); }
  if (r.hitWall) v.speed *= 0.2;
  if (r.grounded && v.throttle < 0.15) v.speed *= Math.exp(-dt * 0.9);
}
function poseAir(v, dt) {
  const M = v.model, u = M.userData; M.position.copy(v.pos); M.rotation.order = 'YXZ';
  if (v.K.type === 'heli') {
    const fl = -(v.vel.x * Math.sin(v.yaw) + v.vel.z * Math.cos(v.yaw)), rl = v.vel.x * Math.cos(v.yaw) - v.vel.z * Math.sin(v.yaw);
    v.tiltX = lerp(v.tiltX || 0, -clamp(fl / v.K.max, -1, 1) * 0.28, 1 - Math.exp(-dt * 4)); v.tiltZ = lerp(v.tiltZ || 0, -clamp(rl / v.K.max, -1, 1) * 0.3, 1 - Math.exp(-dt * 4));
    M.rotation.set(v.tiltX, v.yaw, v.tiltZ);
    const spin = (v.rotorK != null ? v.rotorK : v.driver ? 1 : 0) * 38 * dt; if (u.rotor) u.rotor.rotation.y += spin; if (u.tail) u.tail.rotation.x += spin * 1.6;
    if (v.driver && Math.random() < 0.4) Sfx.play('vehicle', v.pos, { f: 28 + (v.rotorK || 1) * 10, dur: 0.1, vol: 1.2 });
  } else {
    M.rotation.set(v.jpitch || 0, v.yaw, -(v.bank || 0));
    if (u.flame) { u.flame.visible = (v.throttle || 0) > 0.05 || !!v.driver; u.flame.scale.setScalar(0.6 + (v.throttle || 0) * 0.8); }
    if (v.driver && Math.random() < 0.5) Sfx.play('vehicle', v.pos, { f: 70 + (v.throttle || 0) * 90, dur: 0.1, vol: 1.3 });
  }
}
Vehicle.prototype.gunTick = function (dt) { if (!this.guns) return; for (const k in this.guns) { const g = this.guns[k]; g.cd -= dt; if (g.reload > 0) g.reload -= dt; } };
const _drive22 = Vehicle.prototype.drive;
Vehicle.prototype.drive = function (inp, dt) {
  this.inp = inp; const T = this.K.type;
  if (T === 'heli' || T === 'jet') return;
  _drive22.call(this, inp, dt);
  if (T === 'boat' && !inWater(this.pos.x, this.pos.z)) this.speed = clamp(this.speed, -1.5, 1.5);
};
const _phys22 = Vehicle.prototype.physics;
Vehicle.prototype.physics = function (dt) {
  const T = this.K.type;
  if ((T === 'heli' || T === 'jet') && this.alive && !this.held && !this.frozen) { if (T === 'heli') heliPhysics(this, dt); else jetPhysics(this, dt); this.reloadT -= dt; this.gunTick(dt); poseAir(this, dt); return; }
  _phys22.call(this, dt); this.gunTick(dt);
  if (!this.alive) return;
  if (this.K.lean) { this.model.rotation.z = -this.steer * clamp(Math.abs(this.speed) / this.K.max, 0, 1) * 0.5; }
  if (T === 'boat') { this.onWater = inWater(this.pos.x, this.pos.z); if (this.onWater) { this.pos.y = 0; this.vel.y = 0; this.model.position.y = Math.sin(Game.now * 3 + this.pos.x) * 0.05; this.model.rotation.x = clamp(this.speed / this.K.max, -1, 1) * 0.12; if (Math.abs(this.speed) > 4 && Math.random() < 0.5) FX.emit('norm', this.pos.x + Math.sin(this.yaw) * 2, 0.1, this.pos.z + Math.cos(this.yaw) * 2, 3, 2, [0.85, 0.9, 0.95], 0.6, -6, 0.6); } }
};
/* other people's aircraft: tilt and spin from how they're moving */
const _interp22 = Net.interpVehicle.bind(Net);
Net.interpVehicle = function (v, dt) {
  const prev = v.pos.clone(); _interp22(v, dt);
  const T = v.K.type; if (T !== 'heli' && T !== 'jet') { if (v.K.lean) v.model.rotation.z = lerp(v.model.rotation.z, 0, dt * 4); return; }
  const vel = v.pos.clone().sub(prev).multiplyScalar(1 / Math.max(dt, 1e-3)); v.vel.lerp(vel, 1 - Math.exp(-dt * 6));
  if (T === 'jet') { const sp = v.vel.length(); v.jpitch = sp > 1 ? Math.asin(clamp(v.vel.y / sp, -1, 1)) : 0; v.throttle = clamp(sp / v.K.max, 0, 1); v.bank = lerp(v.bank || 0, 0, dt); }
  else v.rotorK = lerp(v.rotorK || 0, v.driver ? 1 : 0, 1 - Math.exp(-dt));
  poseAir(v, dt);
};
/* ── HUD line for whoever is aboard ────────────────────────────────────── */
function vehicleHint(L) {
  const v = L.vehicle, K = v.K, hp = `${K.name} ${Math.max(0, Math.ceil(v.hp))}/${v.maxHp}`;
  if (v.driver !== L) return K.closed ? `${K.name} passenger · E exit` : 'Passenger — shoot freely · E exit';
  const g = k => { const G = K.guns && K.guns[k]; if (!G) return ''; const st = v.gunState(k); return ` · ${k === 'lmb' ? 'LMB' : 'RMB'} ${G.label}${G.clip ? ' ' + (st.reload > 0 ? 'reloading' : st.n) : ''}`; };
  if (K.type === 'heli') return `${hp} · W/S/A/D fly · mouse turns · Space up · Ctrl down${g('lmb')}${g('rmb')} · E exit`;
  if (K.type === 'jet') return `${hp} · W/S throttle ${Math.round((v.throttle || 0) * 100)}%${v.grounded && v.speed < K.stall ? ' · take off above ' + K.stall + ' m/s' : ''} · mouse steers${g('lmb')}${g('rmb')} · E exit`;
  if (v.kind === 'tank') return `${hp} · W/S drive · A/D turn · mouse aim · LMB fire · E exit`;
  if (K.turret) return `${hp} · W/S drive · A/D steer · mouse aims the turret${g('lmb')} · E exit`;
  if (K.type === 'boat') return `${hp} · W/S throttle · A/D steer${v.onWater ? '' : ' · on land: push it into the water'} · E exit`;
  return `${hp} · W/S drive · A/D steer · Space brake · E exit`;
}

/* ── Conquest gets the new vehicles too ─────────────────────────────── */
if (MAPS.ridgeline) {
  const b = MAPS.ridgeline.build;
  MAPS.ridgeline.build = function () {
    const r = b.apply(this, arguments);
    for (const t of World.vehicleSpawns.filter(v => v.kind === 'tank')) {
      const add = (kind, dx, dz) => { const K = VKIND[kind]; for (let i = 0; i < 12; i++) { const x = t.x + dx + rand(-3, 3) * (i > 0), z = t.z + dz + rand(-3, 3) * (i > 0); if (World.bodyFree(x, 0.05, z, K.br || K.r, K.bh || K.h)) { World.vehicleSpawns.push({ team: t.team, x, z, yaw: t.yaw, kind }); return; } } };
      add('apc', -9, 0); add('attackheli', 0, t.z > 0 ? 14 : -14); add('bike', 6, 5); add('bike', 7, 7); add('quad', -5, 6);
    }
    return r;
  };
}
