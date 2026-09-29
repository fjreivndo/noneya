/* ═══════════════════════════════════════════════════════════════════════════
   Military bases, more aircraft, and bots that use them.
   · Each side's HQ on the Conquest maps is a fenced military base: a gate,
     watchtowers, barracks, a vehicle hangar (tank, APC, jeeps), a garage
     (bikes, quads), three helipads (two attack helicopters and a transport)
     and a runway with a control tower and a jet.
   · Bots fly the jets: take off down the runway, climb, pick a target,
     dive on it with the cannon, drop bombs, pull out and come round again.
   · Bots drive quads, bikes and jeeps: when their squad's flag is far away,
     one grabs a nearby vehicle, drives most of the way, and jumps out to
     fight.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── the base ──────────────────────────────────────────────────────────── */
function flatPlane(x0, z0, x1, z1, tex, col, y = 0.011) { const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)), mat(tex, col)); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; return World.deco(m); }
function militaryBase(team, style) {
  const s = team === 'CT' ? 1 : -1, Z = z => z * s, zr = (a, b) => [Math.min(Z(a), Z(b)), Math.max(Z(a), Z(b))];
  const X0 = -64, X1 = 64, [RZ0, RZ1] = zr(80, 109.5);
  // clear what the map put here
  World.boxes = World.boxes.filter(b => { const inside = b.x0 >= X0 && b.x1 <= X1 && b.z0 >= RZ0 && b.z1 <= RZ1 && b.y1 < 14; if (inside && b.mesh) World.group.remove(b.mesh); return !inside; });
  for (const o of World.group.children.slice()) if (o.isMesh && o.geometry && o.geometry.type === 'ConeGeometry' && o.position.x > X0 && o.position.x < X1 && o.position.z > RZ0 && o.position.z < RZ1) World.group.remove(o);
  World.vehicleSpawns = World.vehicleSpawns.filter(v => !(v.x > X0 && v.x < X1 && v.z > RZ0 && v.z < RZ1));
  World.spawns[team] = [];
  const wallTex = style.wall || 'concrete', wallCol = style.wallCol || '#b8b8b0', faceIn = s > 0 ? 0 : Math.PI, box = (x0, a, x1, b, y0, y1, tex, col) => { const [z0, z1] = zr(a, b); return World.add(x0, y0, z0, x1, y1, z1, tex, col); };
  // yard, road and runway surfaces (these also keep the ground flat)
  flatPlane(-62, Z(82), 62, Z(102), style.yard || 'concrete', style.yardCol || '#a8a49c', 0.009);
  flatPlane(-4.5, Z(70), 4.5, Z(102), 'concrete', '#8a8680', 0.012);
  flatPlane(-62, Z(103), 62, Z(108.5), 'concrete', '#5a5a5c', 0.012);
  for (let x = -56; x < 60; x += 8) flatPlane(x, Z(105.6), x + 4, Z(105.9), 'concrete', '#f0f0e8', 0.016);   // centre-line dashes
  // fence with a gate, side fences, sandbags at the gate
  for (const [a, b] of [[-62, -9], [9, 62]]) { box(a, 82, b, 82.25, 0, 2, 'metal', '#7a8088'); for (let x = a; x <= b; x += 6) box(x - 0.12, 81.9, x + 0.12, 82.35, 0, 2.4, 'metal', '#5a6068'); }
  for (const x of [-62.25, 62]) World.add(x, 0, Math.min(Z(82), Z(103)), x + 0.25, 2, Math.max(Z(82), Z(103)), 'metal', '#7a8088');
  box(-9.6, 81.6, -8.8, 82.6, 0, 3, wallTex, wallCol); box(8.8, 81.6, 9.6, 82.6, 0, 3, wallTex, wallCol);
  sandbags(-15, Math.min(Z(84.5), Z(85.5)), -10, Math.max(Z(84.5), Z(85.5))); sandbags(10, Math.min(Z(84.5), Z(85.5)), 15, Math.max(Z(84.5), Z(85.5)));
  watchtower(-58, Z(85)); watchtower(58, Z(85));
  // barracks and a command building
  house(-48, Z(89), 12, 6, s > 0 ? 'n' : 's', wallTex, wallCol); house(-10, Z(97.5), 9, 5, 'ew', wallTex, style.hqCol || wallCol);
  // hangar: three walls and a roof, open toward the gate
  box(18, 99.6, 40, 100, 0, 7, 'metal', style.hangarCol || '#8a9098'); box(18, 86, 18.4, 100, 0, 7, 'metal', style.hangarCol || '#8a9098'); box(39.6, 86, 40, 100, 0, 7, 'metal', style.hangarCol || '#8a9098');
  box(17.6, 85.6, 40.4, 100.4, 7, 7.5, 'metal', '#6a7078');
  // garage for bikes and quads
  box(44, 97.6, 58, 98, 0, 4, wallTex, wallCol); box(44, 90, 44.4, 98, 0, 4, wallTex, wallCol); box(57.6, 90, 58, 98, 0, 4, wallTex, wallCol); box(43.6, 89.6, 58.4, 98.4, 4, 4.4, 'metal', '#6a7078');
  // helipads with H markings, and the control tower by the runway
  for (const x of [-52, -36, -22]) { flatPlane(x - 4, Z(94), x + 4, Z(102), 'concrete', '#6a6a6c', 0.014); labelDecal('H', x, Z(98), 5, '#f0f0f0'); }
  box(-60, 99, -56, 102.6, 0, 9, wallTex, wallCol); box(-60.4, 98.6, -55.6, 103, 9, 11.2, 'metal', '#3a5a7a'); box(-60.6, 98.4, -55.4, 103.2, 11.2, 11.6, 'metal', '#5a6068');
  // flag pole
  box(-0.1, 87.9, 0.1, 88.1, 0, 9, 'metal', '#c8c8c8'); const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshStandardMaterial({ color: TEAM_STYLE[team].color, side: THREE.DoubleSide, roughness: 0.9 })); cloth.position.set(1.15, 8.2, Z(88)); World.deco(cloth);
  // spawn points by the command building
  for (let i = 0; i < 10; i++) World.spawns[team].push({ x: -6 + (i % 5) * 2.6, z: Z(91 + Math.floor(i / 5) * 2.2), yaw: faceIn });
  World.hq[team] = { x: 0, z: Z(94) };
  // the motor pool
  const V = (kind, x, z, yaw = faceIn) => World.vehicleSpawns.push({ team, x, z: Z(z), yaw, kind: kind === 'jeep' ? undefined : kind });
  V('tank', 24, 93); V('apc', 33, 93); V('jeep', 22, 88.5); V('jeep', 35, 88.5);
  V('bike', 47, 94); V('bike', 50, 94); V('quad', 53.5, 94); V('quad', 47.5, 91.5);
  V('attackheli', -52, 98); V('attackheli', -36, 98); V('heli', -22, 98);
  V('jet', 54, 105.8, Math.PI / 2);
}
const BASE_STYLE = {
  ridgeline: { wall: 'concrete', wallCol: '#b0b4b0', hqCol: '#9ab0c8' },
  frostpeak: { wall: 'concrete', wallCol: '#b4b8bc', yard: 'snow', yardCol: '#c8d0da', hangarCol: '#7a8a9a' },
  oasis: { wall: 'sandstone', wallCol: '#e0c490', yard: 'sand', yardCol: '#c8a878', hangarCol: '#a89878' },
};
for (const k of Object.keys(BASE_STYLE)) {
  const m = MAPS[k]; if (!m) continue; const b = m.build;
  m.build = function () { const r = b.apply(this, arguments); militaryBase('CT', BASE_STYLE[k]); militaryBase('T', BASE_STYLE[k]); return r; };
}

/* ── jet pilots ────────────────────────────────────────────────────────── */
const JetAI = {
  t: 0,
  update(dt) {
    if (!Game.authority() || !Game.running || !Game.mode.vehicles) return;
    this.t -= dt; if (this.t > 0) return; this.t = 2.5;
    for (const v of Game.vehicles) {
      if (v.K.type !== 'jet' || !v.alive || v.driver || v.held) continue;
      if (v.crew && v.crew.alive && v.crew.brain && v.crew.brain.crew === v && !v.crew.vehicle && Game.now - (v.crewT || 0) < 40) continue;
      if (v.crew && v.crew.brain && v.crew.brain.crew === v) v.crew.brain.crew = null; v.crew = null;
      let best = null, bd = 60;
      for (const s of Game.soldiers) { if (s.ctrl !== 'bot' || !s.alive || s.vehicle || !s.brain || s.brain.constructor !== Brain || s.brain.crew || s.team !== v.team || s.cls === 'engineer') continue;
        const d = dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = s; } }
      if (best) { best.brain.crew = v; v.crew = best; v.crewT = Game.now; if (Game.cmd[best.team]) Game.cmd[best.team].say(best, 'Heading for the jet!', 4); }
    }
  },
};
Brain.prototype.driveJet = function (dt) {
  const s = this.s, v = s.vehicle, J = this.jet || (this.jet = { phase: 'roll', t: 0, tgt: null, senseT: 0, rkT: 0, pull: 0 });
  s.pos.set(v.pos.x, v.pos.y, v.pos.z); s.vel.set(0, 0, 0); s.moveIn.f = s.moveIn.s = 0;
  if (!v.alive) return;
  const B = World.bounds, floor = groundUnder(v.pos.x, v.pos.z, v.pos.y + 1), agl = v.pos.y - floor, thr = w => clamp((w - (v.throttle || 0)) * 8, -1, 1);
  if (v.grounded && J.phase !== 'roll' && v.speed < 8) { Game.exitVehicle(s); this.jet = null; return; }
  if (v.hp < v.maxHp * 0.2 && agl < 6) { Game.exitVehicle(s); return; }
  let yaw = v.yaw, pitch = 0, throttle = 0.6;
  if (J.phase === 'roll') { throttle = 1; yaw = agl > 3 ? Math.atan2(v.pos.x, v.pos.z * 0.6) : v.yaw; pitch = v.speed > v.K.stall + 0.5 ? 0.55 : 0; if (agl > 25) J.phase = 'cruise'; }
  else {
    J.senseT -= dt;
    if (J.senseT <= 0) { J.senseT = 0.8; let best = null, bs = -1e9;
      for (const e of Game.soldiers) { if (!e.alive || !Game.hostile(s, e)) continue; const p = e.vehicle ? e.vehicle.pos : e.pos; if (e.vehicle && e.vehicle.K.type === 'jet') continue;
        const d = Math.hypot(p.x - v.pos.x, p.z - v.pos.z); const sc = (e.vehicle ? 80 : 0) - d * 0.3 + rand(0, 20); if (sc > bs) { bs = sc; best = e; } }
      J.tgt = best; }
    const tgt = J.tgt && J.tgt.alive ? J.tgt : null, tp = tgt ? (tgt.vehicle ? tgt.vehicle.pos : tgt.pos) : null;
    const edge = Math.max(Math.abs(v.pos.x) - (B.x1 - 40), Math.abs(v.pos.z) - (B.z1 - 40)) > 0;
    if (J.pull > 0) { J.pull -= dt; pitch = 0.45; yaw = v.yaw + 0.25; throttle = 0.75; }
    else if (edge) { yaw = Math.atan2(v.pos.x, v.pos.z); pitch = clamp((55 - agl) * 0.02, -0.2, 0.35); }   // back toward the middle (atan2 of the outward vector faces inward)
    else if (tp) {
      const dx = tp.x - v.pos.x, dz = tp.z - v.pos.z, hd = Math.hypot(dx, dz), want = Math.atan2(-dx, -dz), off = Math.abs(angDiff(v.yaw, want));
      yaw = want;
      if (hd > 190 || off > 0.75) { pitch = clamp((45 - agl) * 0.025, -0.3, 0.35); throttle = 0.58; }
      else {   // attack run
        const dive = Math.atan2(tp.y + 0.5 - v.pos.y, hd); pitch = clamp(dive, -0.75, 0.2); throttle = 0.5;
        if (Math.abs(angDiff(v.yaw, want)) < 0.12 && Math.abs(v.jpitch - dive) < 0.18 && hd < 170) v.shoot(s, 'lmb');
        J.rkT -= dt; if (hd < 32 && agl < 60 && J.rkT <= 0 && v.shoot(s, 'rmb')) J.rkT = 1.5;
        if (hd < 22 || agl < 22) J.pull = 3.2;
      }
    } else { yaw = v.yaw + 0.35; pitch = clamp((60 - agl) * 0.02, -0.2, 0.3); }
    if (agl < 18) pitch = Math.max(pitch, 0.5);
    // something tall ahead (the cliffs round the map)
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw); if (World.raycast(v.pos.x, v.pos.y, v.pos.z, fx, 0, fz, 60) >= 0) pitch = Math.max(pitch, 0.6);
  }
  v.inp = { f: thr(throttle) }; s.yaw = angWrap(yaw); s.pitch = pitch;
};

/* ── bots on quads, bikes and jeeps ────────────────────────────────────── */
const LIGHT = new Set(['jeep', 'car', 'quad', 'bike']);
const RideAI = {
  t: 0,
  update(dt) {
    if (!Game.authority() || !Game.running || Game.mode.id !== 'conquest') return;
    this.t -= dt; if (this.t > 0) return; this.t = 1.5;
    for (const v of Game.vehicles) {
      if (!LIGHT.has(v.kind) || !v.alive || v.driver || v.held || v.frozen) continue;
      if (v.crew && v.crew.alive && v.crew.brain && v.crew.brain.crew === v && !v.crew.vehicle && Game.now - (v.crewT || 0) < 15) continue;
      if (v.crew && v.crew.brain && v.crew.brain.crew === v) v.crew.brain.crew = null; v.crew = null;
      let best = null, bd = 60;
      for (const s of Game.soldiers) {
        if (s.ctrl !== 'bot' || !s.alive || s.vehicle || !s.brain || s.brain.constructor !== Brain || s.brain.crew || s.team !== v.team || (s.brain.target && s.brain.target.alive) || s.downed) continue;
        const f = s.brain.order && s.brain.order.flag; if (!f || dist2(f.x, f.z, s.pos.x, s.pos.z) < 75) continue;
        const d = dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = s; }
      }
      if (best) { best.brain.crew = v; v.crew = best; v.crewT = Game.now; }
    }
  },
};
Brain.prototype.driveLight = function (dt) {
  const s = this.s, v = s.vehicle, now = Game.now, inp = { f: 0, s: 0, brake: false };
  const T = this.ride || (this.ride = { stuckT: 0, revT: 0, revS: 1, path: null, pi: 0, repathT: 0, goal: null, stucks: 0, senseT: 0 });
  s.pos.set(v.pos.x, v.pos.y, v.pos.z); s.vel.set(0, 0, 0); s.moveIn.f = s.moveIn.s = 0;
  const bail = () => { Game.exitVehicle(s); this.ride = null; this.path = null; };
  if (v.hp < v.maxHp * 0.25 || v.burnT > 0 || T.stucks > 3) return bail();
  T.senseT -= dt; if (T.senseT <= 0) { T.senseT = 0.3; this.sense(); if (this.target && this.target.alive && dist2(this.target.pos.x, this.target.pos.z, v.pos.x, v.pos.z) < 40) return bail(); }
  const f = (this.order && this.order.flag) || World.flags.filter(q => q.owner !== s.team).sort((a, b) => dist2(a.x, a.z, v.pos.x, v.pos.z) - dist2(b.x, b.z, v.pos.x, v.pos.z))[0];
  if (!f || dist2(f.x, f.z, v.pos.x, v.pos.z) < 22) return bail();
  const goal = { x: f.x, z: f.z };
  if (!T.path || now > T.repathT || !T.goal || dist2(T.goal.x, T.goal.z, goal.x, goal.z) > 6) { if (AI.budget > 0) { AI.budget--; T.goal = goal; T.path = World.nav.find(v.pos.x, v.pos.z, goal.x, goal.z); T.pi = 0; T.repathT = now + 4; } }
  let wp = T.path && T.path[T.pi];
  while (wp && dist2(v.pos.x, v.pos.z, wp.x, wp.z) < 4 && T.pi < T.path.length - 1) wp = T.path[++T.pi];
  if (T.path) for (let j = Math.min(T.path.length - 1, T.pi + 6); j > T.pi; j--) if (World.nav.lineClear(v.pos.x, v.pos.z, T.path[j].x, T.path[j].z)) { T.pi = j; wp = T.path[j]; break; }
  const tx = wp ? wp.x : goal.x, tz = wp ? wp.z : goal.z, want = Math.atan2(-(tx - v.pos.x), -(tz - v.pos.z)), diff = angDiff(v.yaw, want);
  inp.s = clamp(-diff * 2.2, -1, 1); inp.f = Math.abs(diff) < 0.9 ? 1 : 0.3; if (Math.abs(diff) > 0.6 && v.speed > 12) inp.brake = true;
  if (T.revT > 0) { T.revT -= dt; inp.f = -1; inp.s = T.revS; }
  else if (inp.f > 0 && Math.abs(v.speed) < 1) { T.stuckT += dt; if (T.stuckT > 1.4) { T.stuckT = 0; T.revT = 1.1; T.revS = chance(0.5) ? 1 : -1; T.path = null; T.stucks++; } }
  else T.stuckT = 0;
  v.drive(inp, dt); s.yaw = v.yaw;
};

const _brainUpdate34 = Brain.prototype.update;
Brain.prototype.update = function (dt) {
  const s = this.s, v = s.vehicle;
  if (s.alive && v && v.driver === s) { if (v.K.type === 'jet') return this.driveJet(dt); if (LIGHT.has(v.kind)) return this.driveLight(dt); }
  return _brainUpdate34.call(this, dt);
};
const _brainReset34 = Brain.prototype.reset;
Brain.prototype.reset = function () { _brainReset34.call(this); this.jet = null; this.ride = null; };
const _aiUpdate34 = AI.update.bind(AI);
AI.update = function (dt) { _aiUpdate34(dt); JetAI.update(dt); RideAI.update(dt); };
