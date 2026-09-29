/* ═══════════════════════════════════════════════════════════════════════════
   Warzone (v2.7).
   · Bots drive a lot more: they look for a vehicle whenever their objective
     is a fair walk away, pick one up from further off, bring a squadmate
     along in the passenger seat (who shoots out of the window), run people
     over now and then, and fly the transport helicopter to drop troops at
     a flag. Claims that go stale are handed to someone else.
   · Mounted machine guns: two at each base gate and one dug in beside every
     Conquest flag, behind sandbags. E to man one; bots crew them too.
   · Killstreaks (Conquest, TDM): 3 kills for a UAV scan, 5 for an artillery
     strike on your crosshair, 7 for a supply drop. Z calls the next one in.
   · Weather: clear, overcast, rain, fog or a thunderstorm, picked each match
     (Settings → Weather). Snowy maps get blizzards, desert maps sandstorms.
     Fog and storms shorten how far bots can see.
   · Medals: double and triple kills, headshots, longshots, roadkills, sprees.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── helpers ───────────────────────────────────────────────────────────── */
function freeBot(s, team) {
  return s.ctrl === 'bot' && s.alive && !s.vehicle && s.brain && s.brain.constructor === Brain && !s.brain.crew && !s.brain.ride2 && !s.brain.mgGo
    && !s.heldBy && !s.downed && !s.planting && !s.emote && (!team || s.team === team) && !squadBusy(s);
}
/* a bot in a player's squad (while the player is alive) stays with them */
function squadBusy(s) { if (!s.playerSquad) return false; const L = Game.byId(s.playerSquad); return !!(L && L.alive); }
function busyFighting(s, r) { const t = s.brain.target; return t && t.alive && dist2(t.pos.x, t.pos.z, s.pos.x, s.pos.z) < r; }
/* where a bot wants to go: its squad's flag, or the nearest flag its team doesn't hold */
function rideGoal(s, from) {
  if (!World.flags.length) {   // TDM: head for the fighting the team knows about, else the enemy's side
    const cmd = Game.cmd[s.team], it = cmd && [...cmd.intel.values()].filter(i => Game.now - i.t < 25).sort((a, b) => b.t - a.t)[0];
    if (it) return { x: it.pos.x, z: it.pos.z };
    const sp = World.spawns[s.team === 'T' ? 'CT' : 'T']; if (sp && sp.length) { const q = sp[Math.floor(sp.length / 2)]; return { x: q.x * 0.5, z: q.z * 0.5 }; }
    return null;
  }
  const o = s.brain && s.brain.order;
  if (o && o.flag && o.flag.owner !== s.team) return o.flag;
  const fs = World.flags.filter(q => q.owner !== s.team);
  if (!fs.length) return o && o.flag || null;
  return fs.sort((a, b) => dist2(a.x, a.z, from.x, from.z) - dist2(b.x, b.z, from.x, from.z))[0];
}
/* a vehicle claimed by a bot that never got there goes back on the market */
function claimStale(v, secs) {
  if (v.crew && v.crew.alive && v.crew.brain && v.crew.brain.crew === v && !v.crew.vehicle && Game.now - (v.crewT || 0) < secs) return false;
  if (v.crew && v.crew.brain && v.crew.brain.crew === v) { v.crew.brain.crew = null; if (!v.crew.vehicle) { v.skipId = v.crew.id; v.skipT = Game.now + 60; } }
  v.crew = null; return true;
}
const skipped = (v, s) => v.skipId === s.id && Game.now < v.skipT;
function pickBuddy(v, driver) {
  if ((v.K.seats || 2) < 2 || v.passenger || v.K.closed) return;
  let best = null, bd = 30;
  for (const s of Game.soldiers) {
    if (s === driver || !freeBot(s, v.team) || busyFighting(s, 40)) continue;
    const d = dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = s; }
  }
  if (best) { best.brain.ride2 = v; v.buddy = best; v.buddyT = Game.now; }
}
const RIDE_LINES = ['Grabbing a ride!', 'I\'ll drive, get in!', 'Mounting up!', 'Hop on, we\'re going!'];

/* ── bots take vehicles far more often ─────────────────────────────────── */
RideAI.update = function (dt) {
  if (!Game.authority() || !Game.running || !Game.mode.vehicles || Game.mode.id === 'sandbox' || Game.mode.id === 'zombies') return;
  this.t -= dt; if (this.t > 0) return; this.t = 1;
  for (const v of Game.vehicles) {
    if (!LIGHT.has(v.kind) || !v.alive || v.driver || v.held || v.frozen || v.spawn.playerOnly) continue;
    if (!claimStale(v, 15)) continue;
    let best = null, bd = 95;
    for (const s of Game.soldiers) {
      if (!freeBot(s, v.team) || busyFighting(s, 45) || skipped(v, s)) continue;
      const f = rideGoal(s, s.pos); if (!f || dist2(f.x, f.z, s.pos.x, s.pos.z) < 50) continue;
      const d = dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = s; }
    }
    if (!best) continue;
    best.brain.crew = v; v.crew = best; v.crewT = Game.now; pickBuddy(v, best);
    if (chance(0.35) && Game.cmd[best.team]) Game.cmd[best.team].say(best, pick(RIDE_LINES), 5);
  }
};
/* tanks and APCs: a stuck claim times out, and crews come from further away */
TankAI.update = function (dt) {
  if (!Game.authority() || !Game.running) return;
  this.t -= dt; if (this.t > 0) return; this.t = 1.5;
  const sbx = Game.mode.id === 'sandbox'; if (!Game.mode.vehicles && !sbx) return;
  for (const v of Game.vehicles) {
    if (!v.K.turret || !v.alive || v.driver || v.held || v.frozen || v.spawn.playerOnly) continue;
    if (!claimStale(v, 30)) continue;
    let best = null, bd = sbx ? 45 : 110;
    for (const s of Game.soldiers) {
      if (s.ctrl !== 'bot' || !s.alive || s.vehicle || !s.brain || s.brain.constructor !== Brain || s.brain.crew || s.brain.ride2 || s.brain.mgGo || s.heldBy || s.planting || s.downed || skipped(v, s) || squadBusy(s)) continue;
      if (sbx ? !(s.team === 'T' || s.team === 'CT') : (s.team !== v.team || s.cls === 'engineer')) continue;
      const d = dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = s; }
    }
    if (best) { best.brain.crew = v; v.crew = best; v.crewT = Game.now; if (!sbx && Game.cmd[best.team]) Game.cmd[best.team].say(best, v.kind === 'apc' ? 'Taking the APC!' : 'Taking the tank!', 4); }
  }
};

/* the driver: waits for a passenger, drives to the flag, sometimes runs someone down */
Brain.prototype.driveLight = function (dt) {
  const s = this.s, v = s.vehicle, now = Game.now, inp = { f: 0, s: 0, brake: false };
  const T = this.ride || (this.ride = { stuckT: 0, revT: 0, revS: 1, path: null, pi: 0, repathT: 0, goal: null, stucks: 0, senseT: 0, ramT: 0, rammed: false });
  s.pos.set(v.pos.x, v.pos.y, v.pos.z); s.vel.set(0, 0, 0); s.moveIn.f = s.moveIn.s = 0;
  const bail = () => { Game.exitVehicle(s); this.ride = null; this.path = null; };
  if (v.hp < v.maxHp * 0.25 || v.burnT > 0 || T.stucks > 4) return bail();
  if (!T.boarded) { T.boarded = now; if (!v.passenger && !v.buddy) pickBuddy(v, s); }
  const b = v.buddy;
  if (b && b.alive && b.brain && b.brain.ride2 === v && !b.vehicle && !v.passenger && now - T.boarded < 7) { v.drive({ f: 0, s: 0, brake: true }, dt); s.yaw = v.yaw; return; }
  T.senseT -= dt; if (T.senseT <= 0) { T.senseT = 0.3; this.sense(); }
  const tgt = this.target && this.target.alive ? this.target : null, td = tgt ? dist2(tgt.pos.x, tgt.pos.z, v.pos.x, v.pos.z) : 1e9;
  if (tgt && !tgt.vehicle && !T.rammed && td < 26 && td > 6 && v.hp > v.maxHp * 0.5 && v.K.crush >= 5) { T.rammed = true; if (chance(0.55)) T.ramT = 3.5; }
  let goal, direct = false;
  if (T.ramT > 0 && tgt && !tgt.vehicle) { T.ramT -= dt; goal = { x: tgt.pos.x, z: tgt.pos.z }; direct = true; }
  else {
    if (tgt && td < (v.passenger ? 18 : 30)) return bail();
    const f = rideGoal(s, v.pos); if (!f || dist2(f.x, f.z, v.pos.x, v.pos.z) < 20) return bail();
    goal = { x: f.x, z: f.z };
  }
  if (!direct && (!T.path || now > T.repathT || !T.goal || dist2(T.goal.x, T.goal.z, goal.x, goal.z) > 6)) { if (AI.budget > 0) { AI.budget--; T.goal = goal; T.path = World.nav.find(v.pos.x, v.pos.z, goal.x, goal.z); T.pi = 0; T.repathT = now + 4; } }
  let wp = !direct && T.path && T.path[T.pi];
  while (wp && dist2(v.pos.x, v.pos.z, wp.x, wp.z) < 4 && T.pi < T.path.length - 1) wp = T.path[++T.pi];
  if (!direct && T.path) for (let j = Math.min(T.path.length - 1, T.pi + 6); j > T.pi; j--) if (World.nav.lineClear(v.pos.x, v.pos.z, T.path[j].x, T.path[j].z)) { T.pi = j; wp = T.path[j]; break; }
  const tx = wp ? wp.x : goal.x, tz = wp ? wp.z : goal.z, want = Math.atan2(-(tx - v.pos.x), -(tz - v.pos.z)), diff = angDiff(v.yaw, want);
  inp.s = clamp(-diff * 2.2, -1, 1); inp.f = Math.abs(diff) < 0.9 ? 1 : 0.3; if (Math.abs(diff) > 0.6 && v.speed > 12) inp.brake = true;
  if (T.revT > 0) { T.revT -= dt; inp.f = -1; inp.s = T.revS; }
  else if (inp.f > 0 && Math.abs(v.speed) < 1) { T.stuckT += dt; if (T.stuckT > 1.4) { T.stuckT = 0; T.revT = 1.1; T.revS = chance(0.5) ? 1 : -1; T.path = null; T.stucks++; } }
  else T.stuckT = 0;
  v.drive(inp, dt); s.yaw = v.yaw;
};

/* the passenger: rides along and shoots out of the window */
Brain.prototype.rideAlong = function (dt) {
  const s = this.s, v = s.vehicle, now = Game.now, in_ = s.moveIn; in_.f = in_.s = 0; in_.jump = in_.crouch = in_.sprint = false;
  const coming = !v.driver && v.crew && v.crew.alive && v.crew.brain && v.crew.brain.crew === v && now - (v.crewT || 0) < 20;
  if (!v.alive || (!coming && (!v.driver || !v.driver.alive))) { Game.exitVehicle(s); return; }
  s.pos.set(v.pos.x, v.pos.y, v.pos.z); s.vel.set(0, 0, 0);
  this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.15; this.sense(); }
  const e = this.target && this.target.alive ? this.target : null, m = e && this.mem.get(e.id);
  if (!e || !m || !m.vis || v.K.closed) { this.turnTo(v.yaw + (s === v.passenger ? -0.9 : 0), 0, dt, 2); return; }
  const eye = s.eye(new V3()), p = e.vehicle ? e.vehicle.pos : e.pos, hb = e.hitboxes(), ay = e.vehicle ? p.y + 1.1 : hb.baseY + hb.h * 0.6;
  const hd = Math.hypot(p.x - eye.x, p.z - eye.z), sway = Math.min(0.05, Math.abs(v.speed) * 0.002) + this.d.err * 0.004;
  const wy = Math.atan2(-(p.x - eye.x), -(p.z - eye.z)) + rand(-sway, sway), wp = Math.atan2(ay - eye.y, hd) + rand(-sway, sway);
  this.turnTo(wy, wp, dt, this.d.turn * 1.4);
  const w = s.w, a = s.ammo[s.cur];
  if (!w || w.type === 'knife' || w.projectile || isNade(s.cur)) { if (s.cur !== s.bestWeapon()) s.switchTo(s.bestWeapon()); return; }
  if (a && a.mag === 0) { s.startReload(); return; }
  if (hd > weaponRange(w)[1] * 1.2) return;
  if (Math.abs(angDiff(s.yaw, wy)) + Math.abs(s.pitch - wp) > 0.12) return;
  if (!w.auto && s.fireCd > -rand(0, 0.1)) return;
  fireWeapon(s, now, this.d.recoil);
};

/* ── the transport helicopter: fly a squad to the flag and land ─────────── */
const TransportAI = {
  t: 0,
  update(dt) {
    if (!Game.authority() || !Game.running || !Game.mode.vehicles || Game.mode.id === 'sandbox' || Game.mode.id === 'zombies') return;
    this.t -= dt; if (this.t > 0) return; this.t = 2;
    for (const v of Game.vehicles) {
      if (v.kind !== 'heli' || !v.alive || v.driver || v.held || v.frozen || v.spawn.playerOnly) continue;
      if (!claimStale(v, 25)) continue;
      let best = null, bd = 90;
      for (const s of Game.soldiers) {
        if (!freeBot(s, v.team) || busyFighting(s, 50) || s.cls === 'engineer' || skipped(v, s)) continue;
        const f = rideGoal(s, v.pos); if (!f || dist2(f.x, f.z, v.pos.x, v.pos.z) < 100) continue;
        const d = dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = s; }
      }
      if (best) { best.brain.crew = v; v.crew = best; v.crewT = Game.now; pickBuddy(v, best); if (Game.cmd[best.team]) Game.cmd[best.team].say(best, 'Transport chopper, get in!', 5); }
    }
  },
};
/* a clear, flat spot near the flag to put down on */
function landingZone(f, from) {
  let best = null, bd = 1e9;
  for (const r of [16, 22, 28]) for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
    let ok = true; for (const [dx, dz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) if (!World.nav.walkableAt(x + dx, z + dz) || groundUnder(x + dx, z + dz, 60) > 2.5) { ok = false; break; }
    if (!ok) continue; const d = dist2(x, z, from.x, from.z); if (d < bd) { bd = d; best = { x, z }; }
  }
  return best || { x: f.x, z: f.z };
}
Brain.prototype.driveTransport = function (dt) {
  const s = this.s, v = s.vehicle, now = Game.now, H = this.tr || (this.tr = { phase: 'board', t0: now, lz: null, landT: 0 });
  s.pos.set(v.pos.x, v.pos.y, v.pos.z); s.vel.set(0, 0, 0); s.moveIn.f = s.moveIn.s = 0;
  if (!v.alive) return;
  const floor = groundUnder(v.pos.x, v.pos.z, v.pos.y + 1), agl = v.pos.y - floor;
  const out = () => { const p = v.passenger; if (p && p.ctrl === 'bot') Game.exitVehicle(p); Game.exitVehicle(s); this.tr = null; };
  if (H.phase === 'board') {
    if (!H.picked) { H.picked = true; if (!v.passenger && !v.buddy) pickBuddy(v, s); }
    const b = v.buddy; v.inp = { f: 0, s: 0, up: 0, down: 0 };
    if (!(b && b.alive && b.brain && b.brain.ride2 === v && !b.vehicle && !v.passenger && now - H.t0 < 9)) H.phase = 'fly';
    return;
  }
  const f = rideGoal(s, v.pos);
  if (H.phase === 'fly') {
    if (v.hp < v.maxHp * 0.35 || !f) { H.phase = 'land'; H.lz = { x: v.pos.x, z: v.pos.z }; }
    else if (dist2(f.x, f.z, v.pos.x, v.pos.z) < 55) { H.phase = 'land'; H.lz = landingZone(f, v.pos); if (Game.cmd[s.team]) Game.cmd[s.team].say(s, 'Setting down, get ready!', 4); }
  }
  if (H.phase === 'land') { H.landT += dt; if ((agl < 1.2 && Math.hypot(v.vel.x, v.vel.z) < 3) || (H.landT > 25 && agl < 4)) return out(); }
  const P = H.phase === 'fly' ? { x: f.x, z: f.z } : H.lz, dx = P.x - v.pos.x, dz = P.z - v.pos.z, dist = Math.hypot(dx, dz);
  const fwdX = -Math.sin(v.yaw), fwdZ = -Math.cos(v.yaw), ahead = World.raycast(v.pos.x, v.pos.y + 1, v.pos.z, fwdX, 0, fwdZ, 30);
  const floorAhead = Math.max(floor, groundUnder(v.pos.x + fwdX * 20, v.pos.z + fwdZ * 20, 80));
  let wantY = H.phase === 'fly' ? floorAhead + 30 : dist > 6 ? floorAhead + Math.min(18, 4 + dist * 0.35) : floor - 2;
  if (ahead >= 0) wantY = Math.max(wantY, v.pos.y + 8);
  const k = Math.min(1, dist / (H.phase === 'fly' ? 18 : 30)), mx = dist > 0.1 ? dx / dist * k : 0, mz = dist > 0.1 ? dz / dist * k : 0;
  const rise = v.pos.y < 2.5 && v.rotorK < 0.95 && H.phase === 'fly';
  v.inp = { f: rise ? 0 : mx * fwdX + mz * fwdZ, s: rise ? 0 : mx * Math.cos(v.yaw) - mz * Math.sin(v.yaw), up: v.pos.y < wantY - 1 ? 1 : 0, down: v.pos.y > wantY + 1.5 ? 1 : 0 };
  if (ahead >= 0 && ahead < 14) v.inp.f = Math.min(v.inp.f, 0);
  if (dist > 3) s.yaw = angWrap(Math.atan2(-dx, -dz)); s.pitch = 0;
};

/* ── mounted machine guns ──────────────────────────────────────────────── */
WEAPONS.hmg = { id: 'hmg', name: 'Mounted MG', slot: 0, type: 'lmg', dmg: 36, rpm: 620, hidden: true, speed: 1, spread: 0, moveSpread: 0, recoil: 0, pen: 1, sound: 1.4 };
function buildMG() {
  const g = new THREE.Group(), steel = lam('#3c4146'), dark = lam('#24282c'), olive = lam('#4f5a36');
  // tripod stays put
  for (const a of [0, 2.1, 4.2]) { const leg = bx(0.06, 1.05, 0.06, steel, Math.sin(a) * 0.32, 0.48, Math.cos(a) * 0.32); leg.rotation.z = Math.sin(a) * 0.35; leg.rotation.x = -Math.cos(a) * 0.35; g.add(leg); }
  g.add(bx(0.1, 0.25, 0.1, steel, 0, 1.02, 0));
  // the part that swings round
  const sw = new THREE.Group(); sw.position.y = 1.18; g.add(sw);
  const gun = new THREE.Group(); sw.add(gun);
  gun.add(bx(0.2, 0.2, 0.75, dark, 0, 0.08, -0.05));
  const barrel = cyl(0.035, 1.05, steel, 0, 0.1, -0.95); gun.add(barrel);
  gun.add(cyl(0.06, 0.28, dark, 0, 0.1, -0.62));
  gun.add(bx(0.12, 0.14, 0.2, dark, 0, 0.12, 0.42));
  gun.add(bx(0.18, 0.16, 0.22, olive, 0.2, 0.02, 0.0));
  gun.add(bx(0.04, 0.2, 0.04, dark, -0.08, -0.08, 0.32)); gun.add(bx(0.04, 0.2, 0.04, dark, 0.08, -0.08, 0.32));
  const shield = bx(0.9, 0.55, 0.04, olive, 0, 0.12, -0.42); gun.add(shield);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.1, -1.5); gun.add(muzzle);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { wheels: [], swivel: sw, gun, muzzle };
  return g;
}
VKIND.mg = {
  name: 'Mounted MG', desc: 'Heavy machine gun. LMB fires, E gets off', type: 'emplacement', hp: 420, max: 0, rev: 0, acc: 0, r: 0.7, h: 1.4, br: 0.55, bh: 1.4,
  crush: 0, enter: 2.6, bullet: 0.3, blast: 1.6, at: 1, respawn: 30, seats: 1, seatAt: [0, 1.45, 0.95], build: buildMG,
  guns: { lmb: { label: 'MG', wid: 'hmg', rpm: 620, dmg: 36, spread: 0.012, from: [0, 1.3, -1.4] } },
};
const _phys38 = Vehicle.prototype.physics;
Vehicle.prototype.physics = function (dt) {
  if (this.K.type !== 'emplacement' || !this.alive) return _phys38.call(this, dt);
  this.speed = 0; this.vel.set(0, 0, 0); this.ext.set(0, 0, 0); this.held = false;
  this.pos.set(this.spawn.x, World.floorAt(this.spawn.x, this.spawn.z), this.spawn.z);
  if (this.driver) this.yaw = this.driver.yaw;
  this.gunTick(dt); this.recoil = Math.max(0, (this.recoil || 0) - dt * 3);
  this.model.position.copy(this.pos);
};
const _drive38 = Vehicle.prototype.drive;
Vehicle.prototype.drive = function (inp, dt) { if (this.K.type === 'emplacement') { this.inp = inp; return; } return _drive38.call(this, inp, dt); };
/* the tripod stays facing its sandbags; the gun swings and tilts with the gunner */
function poseMG(v, dt) {
  const u = v.model.userData; if (!u.swivel) return;
  const base = v.spawn.yaw || 0; v.model.rotation.set(0, base, 0);
  const d = v.driver, want = d ? angDiff(base, d.yaw) : 0;
  u.swivel.rotation.y = d ? want : lerp(u.swivel.rotation.y, 0, 1 - Math.exp(-dt * 2));
  u.gun.rotation.x = d ? clamp(d.pitch, -0.45, 0.6) : lerp(u.gun.rotation.x, 0, 1 - Math.exp(-dt * 2));
  u.gun.position.z = (v.recoil || 0) * 0.06;
}
/* fire from the real muzzle */
const _shoot38 = Vehicle.prototype.shoot;
Vehicle.prototype.shoot = function (s, k) {
  if (this.K.type !== 'emplacement') return _shoot38.call(this, s, k);
  const G = this.K.guns[k]; if (!G || !this.alive) return false;
  const st = this.gunState(k); if (st.cd > 0) return false; st.cd = 60 / G.rpm;
  poseMG(this, 0); this.model.updateMatrixWorld(true);
  const from = this.model.userData.muzzle.getWorldPosition(new V3());
  const dir = aimPoint(s, this).sub(from).normalize(); dir.add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(G.spread)).normalize();
  vehHitscan(this, s, from, dir, G); this.recoil = Math.min(1, (this.recoil || 0) + 0.35);
  return true;
};
/* over the gun, looking down the sights */
const _pcam38 = Player.camera;
Player.camera = function (s, dt) {
  const v = s.vehicle;
  if (s.alive && v && v.driver === s && v.K.type === 'emplacement') {
    const V = Game.view, cam = Game.camera, f = s.forward(new V3()), r = new V3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    V.third = true;
    const c = new V3(v.pos.x, v.pos.y + 2.6, v.pos.z).addScaledVector(new V3(f.x, 0, f.z).normalize(), -1.7).addScaledVector(r, 0.3);
    cam.position.lerp(c, 1 - Math.exp(-dt * 18)); cam.lookAt(new V3(v.pos.x, v.pos.y + 1.3, v.pos.z).addScaledVector(f, 45));
    cam.fov = Settings.fov; cam.updateProjectionMatrix(); return;
  }
  return _pcam38.call(this, s, dt);
};
const _vehicleHint38 = vehicleHint;
vehicleHint = function (L) { const v = L.vehicle; if (v && v.K.type === 'emplacement' && v.driver === L) return `${v.K.name} ${Math.max(0, Math.ceil(v.hp))}/${v.maxHp} · mouse aims · LMB fire · E get off`; return _vehicleHint38(L); };
/* where they go: two at each base gate, one beside every flag */
const _militaryBase38 = militaryBase;
militaryBase = function (team, style) {
  _militaryBase38(team, style);
  const s = team === 'CT' ? 1 : -1, yaw = s > 0 ? 0 : Math.PI;
  for (const x of [-12.5, 12.5]) World.vehicleSpawns.push({ team, x, z: 86.6 * s, yaw, kind: 'mg', baseMG: true });
};
function flagMGs() {
  World.flags.forEach((f, fi) => {
    for (const r of [8, 10, 12]) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.4, x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
      // face away from the flag, squared up to the nearest side so the sandbags line up
      const out = Math.atan2(-(x - f.x), -(z - f.z)), yaw = Math.round(out / (Math.PI / 2)) * (Math.PI / 2);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const B = World.bounds; if (B && (x < B.x0 + 6 || x > B.x1 - 6 || z < B.z0 + 6 || z > B.z1 - 6)) continue;
      if (World.boxes.some(b => b.y1 > 0.3 && b.y0 < 2.2 && b.x0 < x + 2.2 && b.x1 > x - 2.2 && b.z0 < z + 2.2 && b.z1 > z - 2.2)) continue;
      if (World.vehicleSpawns.some(v => dist2(v.x, v.z, x, z) < 7)) continue;
      if (typeof inWater === 'function' && inWater(x, z)) continue;
      // a horseshoe of sandbags in front: real cover
      const bag = (cx, cz, w, d) => { const hx = Math.abs(rx) * w / 2 + Math.abs(fx) * d / 2, hz = Math.abs(rz) * w / 2 + Math.abs(fz) * d / 2; World.add(cx - hx, 0, cz - hz, cx + hx, 0.95, cz + hz, 'sandbag'); };
      bag(x + fx * 1.2, z + fz * 1.2, 2.6, 0.5);
      for (const side of [-1, 1]) bag(x + rx * 1.3 * side + fx * 0.35, z + rz * 1.3 * side + fz * 0.35, 0.5, 1.2);
      World.vehicleSpawns.push({ team: f.owner || (fi % 2 ? 'T' : 'CT'), x, z, yaw, kind: 'mg', flag: fi });
      return;
    }
  });
}
for (const k of MODES.conquest.maps) {
  const m = MAPS[k]; if (!m) continue; const b = m.build;
  m.build = function () { const r = b.apply(this, arguments); try { flagMGs(); } catch (e) { console.warn('flag MGs', e); } return r; };
}
/* bots crew them: defenders at their flag, and anyone hanging round their base */
const MgAI = {
  t: 0,
  update(dt) {
    if (!Game.authority() || !Game.running || !Game.mode.vehicles || Game.mode.id === 'sandbox') return;
    this.t -= dt; if (this.t > 0) return; this.t = 2;
    for (const v of Game.vehicles) {
      if (v.K.type !== 'emplacement' || !v.alive || v.driver || v.spawn.playerOnly) continue;
      const g = v.mgBot;
      if (g && g.alive && g.brain && g.brain.mgGo === v && Game.now - (v.mgT || 0) < 12) continue;
      if (g && g.brain && g.brain.mgGo === v) g.brain.mgGo = null; v.mgBot = null;
      if (Game.now - (v.mgFreeT || -99) < 8) continue;
      const f = v.spawn.flag != null ? World.flags[v.spawn.flag] : null;
      let best = null, bd = 26;
      for (const s of Game.soldiers) {
        if (!freeBot(s) || busyFighting(s, 30)) continue;
        if (v.spawn.baseMG ? s.team !== v.team : !(f && f.owner === s.team)) continue;
        const d = dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = s; }
      }
      if (best && chance(0.6)) { best.brain.mgGo = v; v.mgBot = best; v.mgT = Game.now; }
    }
  },
};
Brain.prototype.driveMG = function (dt) {
  const s = this.s, v = s.vehicle, now = Game.now, M = this.mg || (this.mg = { lastT: now, scan: rand(0, TAU), errT: 0, ex: 0, ey: 0, burst: 0 });
  s.pos.set(v.pos.x, v.pos.y, v.pos.z); s.vel.set(0, 0, 0); s.moveIn.f = s.moveIn.s = 0;
  const leave = () => { Game.exitVehicle(s); v.mgFreeT = now; this.mg = null; };
  if (s.hp < 35 || v.hp < v.maxHp * 0.3) return leave();
  this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.15; this.sense(); }
  const e = this.target && this.target.alive ? this.target : null, m = e && this.mem.get(e.id);
  if (e && m && m.vis) {
    M.lastT = now;
    const eye = s.eye(new V3()), p = e.vehicle ? e.vehicle.pos : e.pos, hb = e.hitboxes(), ay = e.vehicle ? p.y + 1.2 : hb.baseY + hb.h * 0.6, hd = Math.hypot(p.x - eye.x, p.z - eye.z);
    M.errT -= dt; if (M.errT <= 0) { M.errT = 0.5; const k = this.d.err * 0.008 + 0.006; M.ex = rand(-k, k); M.ey = rand(-k, k); }
    const wy = Math.atan2(-(p.x - eye.x), -(p.z - eye.z)) + M.ex, wp = Math.atan2(ay - eye.y, hd) + M.ey;
    this.turnTo(wy, wp, dt, this.d.turn * 1.2);
    M.burst += dt; const on = M.burst % 1.7 < 1.0;
    if (on && hd < 160 && Math.abs(angDiff(s.yaw, wy)) + Math.abs(s.pitch - wp) < 0.09) v.shoot(s, 'lmb');
  } else {
    M.scan += dt * 0.35; this.turnTo((v.spawn.yaw || 0) + Math.sin(M.scan) * 0.9, -0.02, dt, 1.5);
    const o = this.order, far = o && o.flag && dist2(o.flag.x, o.flag.z, v.pos.x, v.pos.z) > 45;
    if (now - M.lastT > (far ? 10 : 35)) return leave();
  }
};

/* ── one brain wrapper for all of the above ────────────────────────────── */
const _brainUpdate38 = Brain.prototype.update;
Brain.prototype.update = function (dt) {
  const s = this.s; if (!s.alive) return _brainUpdate38.call(this, dt);
  const v = s.vehicle;
  if (v && v.passenger === s) return this.rideAlong(dt);
  if (v && v.driver === s && v.K.type === 'emplacement') return this.driveMG(dt);
  if (v && v.driver === s && v.kind === 'heli' && !v.K.guns && Game.mode.id !== 'sandbox') return this.driveTransport(dt);
  // on the way to a passenger seat, or to a machine gun
  const go = this.ride2 || this.mgGo;
  if (!v && go) {
    this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.12; this.sense(); }
    const t = this.target && this.target.alive ? this.target : null, m = t && this.mem.get(t.id);
    const bad = !go.alive || (this.ride2 ? (go.passenger || !(go.driver || go.crew) || Game.now - (go.buddyT || 0) > 20) : (go.driver || Game.now - (go.mgT || 0) > 14));
    if (bad || (t && m && m.vis && dist2(t.pos.x, t.pos.z, s.pos.x, s.pos.z) < 25)) {
      if (go.buddy === s) go.buddy = null; if (go.mgBot === s) go.mgBot = null; this.ride2 = null; this.mgGo = null;
      return _brainUpdate38.call(this, dt);
    }
    const in_ = s.moveIn; in_.f = in_.s = 0; in_.jump = in_.crouch = in_.walk = in_.sprint = false;
    if (dist2(s.pos.x, s.pos.z, go.pos.x, go.pos.z) < go.K.enter) {
      if (this.ride2) { go.passenger = s; s.vehicle = go; go.buddy = null; this.ride2 = null; }
      else { go.driver = s; s.vehicle = go; go.mgBot = null; this.mgGo = null; this.mg = null; }
      Net.vehicleSeat(go); return;
    }
    this.moveTo(go.pos, dt, false, false, true); this.turnTo(Math.atan2(-(go.pos.x - s.pos.x), -(go.pos.z - s.pos.z)), 0, dt, 6);
    return;
  }
  return _brainUpdate38.call(this, dt);
};
const _brainReset38 = Brain.prototype.reset;
Brain.prototype.reset = function () { _brainReset38.call(this); this.ride2 = null; this.mgGo = null; this.mg = null; this.tr = null; };
const _aiUpdate38 = AI.update.bind(AI);
AI.update = function (dt) { _aiUpdate38(dt); TransportAI.update(dt); MgAI.update(dt); };

/* ── killstreaks ───────────────────────────────────────────────────────── */
WEAPONS.artyshell = { id: 'artyshell', name: 'Artillery', slot: 0, type: 'launcher', dmg: 300, radius: 6.5, projectile: 70, gravity: 9, explosive: true, hidden: true, speed: 1, spread: 0, moveSpread: 0, recoil: 0, pen: 1 };
const KS = {
  steps: [[3, 'uav'], [5, 'arty'], [7, 'drop']],
  name: { uav: 'UAV scan', arty: 'Artillery strike', drop: 'Supply drop' },
  mine: [], streak: 0, uav: { T: 0, CT: 0 }, uavT: 0, strikes: [], drops: [], uavMesh: [], flares: [], retryT: 0,
  on() { return Game.running && !!Game.mode && (Game.mode.id === 'conquest' || Game.mode.id === 'tdm'); },
  reset() {
    this.mine = []; this.streak = 0; this.uav = { T: 0, CT: 0 }; this.strikes = [];
    for (const d of this.drops) Game.scene && Game.scene.remove(d.mesh); this.drops = [];
    for (const u of this.uavMesh) Game.scene && Game.scene.remove(u.mesh); this.uavMesh = [];
    for (const f of this.flares) Game.scene && Game.scene.remove(f.mesh); this.flares = [];
  },
  /* host: someone earned one */
  grant(s, r) {
    if (s.ctrl === 'bot') { (s.ksHave || (s.ksHave = [])).push(r); return this.botUse(s); }
    if (s.ctrl === 'local') { this.mine.push(r); return this.earned(r); }
    (s.ksHave || (s.ksHave = [])).push(r); const p = Net.peerOf(s.id); if (p) Net.to(p.id, { t: 'ev', e: { t: 'ksg', r } });
  },
  earned(r) { HUD.center(`${this.name[r]} ready · press Z`, 2.2); if (Sfx.ctx) { const t = Sfx.ctx.currentTime, o = Sfx.out(0.5, 0); Sfx.tone(o, t, 0.12, 660, 660, 0.25, 'triangle'); Sfx.tone(o, t + 0.13, 0.2, 990, 990, 0.25, 'triangle'); } },
  /* the local player calls one in */
  activate() {
    const L = Game.local, r = this.mine[0]; if (!r || !L || !L.alive) return;
    let p = null;
    if (r !== 'uav') {
      const o = Game.camera.position, d = Game.camera.getWorldDirection(new V3());
      let t = World.raycast(o.x, o.y, o.z, d.x, d.y, d.z, r === 'arty' ? 400 : 60);
      if (t < 0 && d.y < -0.02) t = Math.min(r === 'arty' ? 400 : 60, (o.y - World.floorAt(o.x, o.z)) / -d.y);
      if (t < 0) { if (r === 'arty') { HUD.center('Aim at the ground to call in artillery', 1.4); return; } p = [L.pos.x, 0, L.pos.z]; }
      else { const q = o.clone().addScaledVector(d, t); p = [q.x, q.y, q.z]; }
    }
    this.mine.shift();
    if (Game.authority()) this.use(L, r, p); else Net.send({ t: 'ksuse', r, p });
  },
  /* host: bots use theirs straight away, or as soon as there's a target */
  botUse(s) {
    if (!s.ksHave || !s.ksHave.length) return;
    const r = s.ksHave[0]; let p = null;
    if (r === 'arty') { p = this.botTarget(s); if (!p) return; }
    if (r === 'drop') p = [s.pos.x, 0, s.pos.z];
    s.ksHave.shift(); this.use(s, r, p);
  },
  botTarget(s) {
    const cmd = Game.cmd[s.team]; if (!cmd) return null;
    const seen = [...cmd.intel.values()].filter(i => Game.now - i.t < 6), mates = Game.soldiers.filter(m => m.alive && m.team === s.team);
    let best = null, bn = 0;
    for (const c of seen) {
      if (mates.some(m => dist2(m.pos.x, m.pos.z, c.pos.x, c.pos.z) < 16)) continue;
      const n = seen.filter(o => dist2(o.pos.x, o.pos.z, c.pos.x, c.pos.z) < 12).length;
      if (n > bn) { bn = n; best = c; }
    }
    return best ? [best.pos.x, best.pos.y, best.pos.z] : null;
  },
  /* host: make it happen, and tell everyone */
  use(s, r, p) {
    const now = Game.now, ev = { t: 'ksfx', k: r, team: s.team, by: s.id, p };
    if (r === 'uav') { this.uav[s.team] = now + 25; this.uavT = 0; }
    if (r === 'arty') this.strikes.push({ owner: s, p, t: now + 3.2, n: 12, next: 0 });
    if (r === 'drop') { const i = World.nav.nearest(p[0], p[2], 10), q = i >= 0 ? [World.nav.cx(i), 0, World.nav.cz(i)] : [p[0], 0, p[2]]; ev.p = q; ev.id = 'd' + uid(5); }
    this.fx(ev); Net.event(ev);
  },
  /* every peer: sights and sounds */
  fx(ev) {
    const L = Game.local, by = Game.byId(ev.by), mine = L && L.team === ev.team, who = by ? by.name : 'Someone', say = (t, x) => { if (Game.authority()) Game.radio(t, 'Command', x); };
    if (ev.k === 'uav') {
      say(ev.team, `UAV online, called in by ${who}.`); say(ev.team === 'T' ? 'CT' : 'T', 'Enemy UAV overhead!');
      const m = new THREE.Group(), c = lam('#5a6068'); m.add(bx(0.5, 0.35, 3.2, c)); m.add(bx(6, 0.08, 0.7, c, 0, 0.1, 0.2)); m.add(bx(1.8, 0.06, 0.4, c, 0, 0.1, 1.45)); m.add(bx(0.06, 0.6, 0.4, c, 0, 0.35, 1.45));
      m.scale.setScalar(1.6); Game.scene.add(m); this.uavMesh.push({ mesh: m, end: Game.now + 25, a: rand(0, TAU) });
    }
    if (ev.k === 'arty') {
      const P = new V3(...ev.p); say(ev.team, `${who}: artillery inbound!`);
      const light = new THREE.PointLight(0xff3020, 3, 18); light.position.set(P.x, P.y + 1, P.z); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4020 }));
      const g = new THREE.Group(); g.add(light); fl.position.copy(P).setY(P.y + 0.1); g.add(fl); Game.scene.add(g); this.flares.push({ mesh: g, end: Game.now + 9, p: P, red: true });
      if (L && L.alive && !mine && dist2(L.pos.x, L.pos.z, P.x, P.z) < 35) HUD.center('INCOMING ARTILLERY! Move!', 2.5);
      if (Sfx.ctx) for (let i = 0; i < 12; i++) setTimeout(() => this.whistle(P), 2600 + i * 350);
    }
    if (ev.k === 'drop') {
      say(ev.team, `Supply drop coming in for ${who}.`);
      const g = new THREE.Group(), crate = new THREE.Group();
      crate.add(bx(1.1, 0.8, 1.1, lam('#4a5a30'))); crate.add(bx(1.14, 0.1, 1.14, lam('#2a3020'), 0, 0.3, 0)); crate.add(bx(0.5, 0.02, 0.5, lam('#e8e0c0'), 0, 0.41, 0));
      const chute = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 6, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8d0b0, side: THREE.DoubleSide, roughness: 0.9 })); chute.position.y = 4.5; chute.scale.y = 0.55;
      const ropes = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([-1, 1].flatMap(sx => [-1, 1].flatMap(sz => [new V3(sx * 0.5, 0.4, sz * 0.5), new V3(sx * 1.9, 4.5, sz * 1.9)]))), new THREE.LineBasicMaterial({ color: 0x333333 }));
      g.add(crate); g.add(chute); g.add(ropes);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 60, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x40ff60, transparent: true, opacity: 0.18, depthWrite: false })); beam.position.set(ev.p[0], 30, ev.p[2]);
      g.position.set(ev.p[0], 60, ev.p[2]); Game.scene.add(g); Game.scene.add(beam);
      this.drops.push({ id: ev.id, p: new V3(ev.p[0], World.floorAt(ev.p[0], ev.p[2]), ev.p[2]), mesh: g, beam, chute, ropes, t0: Game.now, landed: false });
    }
  },
  whistle(P) {
    if (!Sfx.ctx || !Game.running) return; const sp = Sfx.spatial(P, 260); if (!sp) return;
    const t = Sfx.ctx.currentTime, o = Sfx.out(sp[0] * 0.6, sp[1]); Sfx.tone(o, t, 1.0, 1500, 420, 0.3, 'sine');
  },
  /* host: someone walked into a crate */
  open(d, s) {
    this.removeDrop(d.id); Net.event({ t: 'ksd', id: d.id });
    s.hp = 100; if (Game.mode.armor) { s.armor = 100; s.helmet = true; }
    const w = pick(['mgl', 'railgun', 'flamer', 'mg42', 'm14', 'vector', 'dbarrel', 'm249', 'awp'].filter(id => WEAPONS[id]));
    if (s.ctrl === 'local' || s.ctrl === 'bot') this.stock(s, w);
    else { const p = Net.peerOf(s.id); if (p) Net.to(p.id, { t: 'ev', e: { t: 'ksw', s: s.id, w } }); }
  },
  stock(s, w) {
    for (const id in s.ammo) { const st = s.stat(id); if (st && st.mag) { s.ammo[id].mag = st.mag; s.ammo[id].res = Math.max(s.ammo[id].res, Math.round((st.reserve || st.mag * 3) * 1.5)); } }
    if (w) { s.give(w); s.fillAmmo(w); if (s.ctrl === 'bot') s.switchTo(w); }
    if (s.ctrl === 'local') { HUD.center(`Supply drop: full health, armour and ammo${w ? ' + ' + WEAPONS[w].name : ''}`, 2.5); Sfx.play('ui'); }
  },
  removeDrop(id) { const d = this.drops.find(x => x.id === id); if (!d) return; Game.scene.remove(d.mesh); Game.scene.remove(d.beam); this.drops = this.drops.filter(x => x !== d); },
  update(dt) {
    const now = Game.now;
    // visuals everywhere
    for (const u of this.uavMesh.slice()) { if (now > u.end) { Game.scene.remove(u.mesh); this.uavMesh = this.uavMesh.filter(x => x !== u); continue; } u.a += dt * 0.12; const B = World.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, R = Math.min(B.x1 - B.x0, B.z1 - B.z0) * 0.3; u.mesh.position.set(cx + Math.cos(u.a) * R, 75, cz + Math.sin(u.a) * R); u.mesh.rotation.set(0, -u.a, 0.25); }
    for (const f of this.flares.slice()) { if (now > f.end) { Game.scene.remove(f.mesh); this.flares = this.flares.filter(x => x !== f); continue; } f.mesh.children[0].intensity = 2 + Math.random() * 2.5; if (Math.random() < dt * 20) FX.emit('big', f.p.x, f.p.y + 0.3, f.p.z, 1, 0.8, [0.9, 0.2, 0.15], 2.5, 1.5, 0.3); }
    for (const d of this.drops) {
      const g = d.mesh, y = Math.max(d.p.y, 60 - (now - d.t0) * 7.5);
      g.position.y = y; g.rotation.y += dt * (d.landed ? 0 : 0.4);
      if (!d.landed && y <= d.p.y + 0.01) { d.landed = true; d.chute.visible = false; d.ropes.visible = false; FX.emit('big', d.p.x, d.p.y + 0.2, d.p.z, 12, 3, [0.6, 0.55, 0.45], 1, 1, 1); Sfx.play('impact', d.p); }
      d.beam.material.opacity = 0.12 + Math.sin(now * 4) * 0.06;
    }
    if (!Game.authority()) return;
    // UAV: keep every enemy on the minimap
    this.uavT -= dt;
    if (this.uavT <= 0) { this.uavT = 1; for (const team of ['T', 'CT']) if (this.uav[team] > now) for (const e of Game.soldiers) if (e.alive && e.team !== team && (e.team === 'T' || e.team === 'CT')) Game.markSpotted(e, team, 1.4); }
    // artillery shells
    for (const st of this.strikes.slice()) {
      if (now < st.t) continue; st.next -= dt; if (st.next > 0) continue; st.next = 0.35;
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * 11, x = st.p[0] + Math.cos(a) * r, z = st.p[2] + Math.sin(a) * r;
      Game.spawnRocket(st.owner, new V3(x + rand(-6, 6), 95, z + rand(-6, 6)), new V3(rand(-0.02, 0.02), -1, rand(-0.02, 0.02)).normalize(), true, 'artyshell');
      if (--st.n <= 0) this.strikes = this.strikes.filter(q => q !== st);
    }
    // crates
    for (const d of this.drops.slice()) {
      if (!d.landed) continue;
      if (now - d.t0 > 75) { this.removeDrop(d.id); Net.event({ t: 'ksd', id: d.id }); continue; }
      for (const s of Game.soldiers) if (s.alive && !s.vehicle && (s.team === 'T' || s.team === 'CT') && dist2(s.pos.x, s.pos.z, d.p.x, d.p.z) < 1.7) { this.open(d, s); break; }
    }
    // bots holding an artillery strike keep looking for a target
    this.retryT -= dt; if (this.retryT <= 0) { this.retryT = 3; for (const s of Game.soldiers) if (s.ctrl === 'bot' && s.alive && s.ksHave && s.ksHave.length) this.botUse(s); }
    // bots go for crates nearby
    for (const d of this.drops) if (d.landed && !d.claimed) {
      let best = null, bd = 40; for (const s of Game.soldiers) if (freeBot(s) && !busyFighting(s, 30)) { const q = dist2(s.pos.x, s.pos.z, d.p.x, d.p.z); if (q < bd) { bd = q; best = s; } }
      if (best) { d.claimed = true; best.brain.setOrder && best.brain.setOrder({ type: 'goto', pos: d.p.clone(), crate: d.id }); }
    }
  },
};
/* host: count kills */
const _kill38 = Game.kill.bind(Game);
Game.kill = function (v, att, weapon, hs) {
  const was = v.alive; _kill38(v, att, weapon, hs);
  if (!was || v.alive) return;
  v.ksStreak = 0;
  if (!KS.on() || !att || att === v || !att.alive || att.team === v.team || v.npc || !(att.team === 'T' || att.team === 'CT')) return;
  att.ksStreak = (att.ksStreak || 0) + 1;
  const st = KS.steps.find(x => x[0] === att.ksStreak); if (st) KS.grant(att, st[1]);
};
/* clients: messages from and to the host */
const _hostData38 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  if (m && m.t === 'ksuse') {
    const p = this.peers.get(id), s = p && p.sid && Game.byId(p.sid);
    if (s && s.alive && s.ksHave && s.ksHave.includes(m.r) && KS.name[m.r]) { s.ksHave.splice(s.ksHave.indexOf(m.r), 1); const q = Array.isArray(m.p) ? m.p.slice(0, 3).map(n => +n || 0) : [s.pos.x, 0, s.pos.z]; KS.use(s, m.r, q); }
    return;
  }
  return _hostData38(id, m);
};
const _applyEvent38 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  if (e && e.t === 'ksfx') return KS.fx(e);
  if (e && e.t === 'ksd') return KS.removeDrop(e.id);
  if (e && e.t === 'ksg') { KS.mine.push(e.r); return KS.earned(e.r); }
  if (e && e.t === 'ksw') { const L = Game.local; if (L && e.s === L.id) KS.stock(L, WEAPONS[e.w] ? e.w : null); return; }
  return _applyEvent38(e);
};
/* bots with a crate order just walk there */
const _peace38 = Brain.prototype.peace;
Brain.prototype.peace = function (dt, now, noLook) {
  const o = this.order;
  if (o && o.crate) {
    const d = KS.drops.find(x => x.id === o.crate);
    if (!d || dist2(this.s.pos.x, this.s.pos.z, d.p.x, d.p.z) < 1) this.order = { type: 'idle' };
    else { this.moveTo(d.p, dt, false, false, true); this.lookAround(dt, null); return; }
  }
  return _peace38.call(this, dt, now, noLook);
};

/* ── medals (your own kills) ───────────────────────────────────────────── */
const Medal = {
  el: null, t: 0, mk: 0, lastK: -9, q: [],
  show(txt) {
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'medal'; document.body.appendChild(this.el); }
    this.q.push(txt); this.el.textContent = this.q.join(' · '); this.el.classList.remove('pop'); void this.el.offsetWidth; this.el.classList.add('pop'); this.el.style.display = ''; this.t = 2.4;
    if (Sfx.ctx) { const t = Sfx.ctx.currentTime, o = Sfx.out(0.45, 0); Sfx.tone(o, t, 0.1, 880, 880, 0.2, 'triangle'); Sfx.tone(o, t + 0.09, 0.16, 1320, 1320, 0.2, 'triangle'); }
  },
  update(dt) { if (this.t > 0) { this.t -= dt; if (this.t <= 0 && this.el) { this.el.style.display = 'none'; this.q = []; } } },
};
const _onKill38 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  _onKill38(ev);
  const L = this.local; if (!L) return; const a = this.byId(ev.a), v = this.byId(ev.v);
  if (v === L) { KS.streak = 0; Medal.mk = 0; }
  if (!a || a !== L || !v || v === L || v.team === L.team) return;
  KS.streak++; const now = this.now;
  Medal.mk = now - Medal.lastK < 3.5 ? Medal.mk + 1 : 1; Medal.lastK = now;
  const out = [];
  if (Medal.mk >= 2) out.push(['', '', 'Double kill', 'Triple kill', 'Multi kill'][Medal.mk] || 'Rampage!');
  if (ev.hs) out.push('Headshot');
  if (dist2(L.pos.x, L.pos.z, v.pos.x, v.pos.z) > 80 && WEAPONS[ev.w] && !WEAPONS[ev.w].explosive) out.push('Longshot');
  if (VKIND[ev.w]) out.push('Roadkill');
  if (KS.streak === 5) out.push('Killing spree'); if (KS.streak === 10) out.push('Unstoppable'); if (KS.streak === 15) out.push('Legendary');
  if (out.length) { Medal.q = []; Medal.show(out.join(' · ')); }
};

/* ── weather ───────────────────────────────────────────────────────────── */
if (Settings.weather == null) Settings.weather = 'random';
const WEATHER = {
  clear: { name: 'Clear skies' },
  overcast: { name: 'Overcast', sky: 0x9aa3ad, fogCol: 0xaab1b8, fogK: 0.85, sun: 0.5, hemi: 0.95 },
  rain: { name: 'Rain', sky: 0x7d8792, fogCol: 0x939ba4, fogK: 0.62, sun: 0.35, hemi: 0.85, rain: 1500, wind: 1.5, sight: 130, sound: 0.1 },
  fog: { name: 'Fog', sky: 0xb7bcc0, fogCol: 0xc2c6c9, fogNear: 6, fogFar: 85, sun: 0.45, hemi: 1, sight: 62 },
  storm: { name: 'Thunderstorm', sky: 0x3c434c, fogCol: 0x4d555e, fogK: 0.45, sun: 0.15, hemi: 0.6, rain: 3000, wind: 5, lightning: true, sight: 95, sound: 0.18 },
  blizzard: { name: 'Blizzard', sky: 0xc4ccd6, fogCol: 0xd6dde4, fogNear: 5, fogFar: 75, sun: 0.45, hemi: 1.05, snow: 2600, wind: 9, sight: 55, sound: 0.12, wail: true },
  sandstorm: { name: 'Sandstorm', sky: 0xb89464, fogCol: 0xc09a68, fogNear: 4, fogFar: 70, sun: 0.45, hemi: 0.95, dust: 2200, wind: 12, sight: 50, sound: 0.14, wail: true },
};
const Weather = {
  cur: 'clear', pts: null, flash: 0, nextBolt: 0, audio: null,
  def() { return WEATHER[this.cur] || WEATHER.clear; },
  pick(map) {
    let w = Settings.weather;
    if (!WEATHER[w] || w === 'blizzard' || w === 'sandstorm') { const bag = ['clear', 'clear', 'clear', 'clear', 'clear', 'overcast', 'overcast', 'overcast', 'rain', 'rain', 'rain', 'fog', 'fog', 'storm', 'storm']; w = pick(bag); }
    if (w === 'rain' || w === 'storm') { if (map === 'frostpeak') w = 'blizzard'; else if (map === 'oasis' || map === 'dustyard') w = 'sandstorm'; }
    return w;
  },
  /* after the map sets its sky and fog */
  tint() {
    const W = this.def(); if (!W.sky) return;
    const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
    World.skyColor = mix(World.skyColor, W.sky, 0.8);
    const f = World.fog || [World.skyColor, 60, 300];
    World.fog = [mix(f[0], W.fogCol, 0.85), W.fogNear != null ? W.fogNear : f[1] * W.fogK, W.fogFar != null ? W.fogFar : f[2] * W.fogK];
    World.sun = mix(World.sun || 0xfff4e0, 0xdfe4ea, 0.6);
  },
  setup(scene) {
    this.stopAudio(); this.pts = null; this.flash = 0; this.nextBolt = Game.now + rand(4, 10);
    const W = this.def(), n = W.rain || W.snow || W.dust; if (!n) return;
    const g = new THREE.BufferGeometry(), R = 30;
    if (W.rain) {
      const p = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = rand(-R, R), y = rand(-4, 22), z = rand(-R, R); p.set([x, y, z, x, y - 0.6, z], i * 6); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.pts = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab6c4, transparent: true, opacity: W.lightning ? 0.42 : 0.32, depthWrite: false }));
    } else {
      const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([rand(-R, R), rand(-4, 22), rand(-R, R)], i * 3);
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.pts = new THREE.Points(g, new THREE.PointsMaterial({ color: W.snow ? 0xffffff : 0xc8a070, size: W.snow ? 0.12 : 0.16, transparent: true, opacity: W.snow ? 0.9 : 0.55, depthWrite: false }));
    }
    this.pts.frustumCulled = false; this.pts.userData.R = R; this.pts.userData.n = n; scene.add(this.pts);
  },
  startAudio() {
    const W = this.def(); if (this.audio || !W.sound || !Sfx.ctx || Sfx.ctx.state !== 'running') return;
    const c = Sfx.ctx, src = c.createBufferSource(); src.buffer = Sfx.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = W.wail ? 'lowpass' : 'bandpass'; f.frequency.value = W.wail ? 520 : 1400; f.Q.value = W.wail ? 1.2 : 0.4;
    const g = c.createGain(); g.gain.value = W.sound; src.connect(f); f.connect(g); g.connect(Sfx.master); src.start();
    this.audio = { src, f, g };
  },
  stopAudio() { if (this.audio) { try { this.audio.src.stop(); } catch (e) { /* already stopped */ } this.audio = null; } },
  thunder(delay) {
    if (!Sfx.ctx || Sfx.ctx.state !== 'running') return; const t = Sfx.ctx.currentTime + delay, o = Sfx.out(0.9, rand(-0.5, 0.5));
    Sfx.burst(o, t, 0.25, 3000, 400, 0.5, 0.6, 'lowpass'); Sfx.burst(o, t + 0.1, 2.8, 260, 40, 0.8, 1.1, 'lowpass');
  },
  update(dt) {
    const W = this.def(), sc = Game.scene; if (!sc) return;
    // light: dimmer sun, and lightning on the sky light
    const sun = sc.userData.sun, hemi = sc.userData.hemi || sc.children.find(o => o.isHemisphereLight);
    if (W.lightning && Game.now > this.nextBolt) { this.nextBolt = Game.now + rand(6, 18); this.flash = 1; setTimeout(() => { this.flash = 0.8; }, 140); this.thunder(rand(0.4, 2.2)); }
    this.flash = Math.max(0, this.flash - dt * 5);
    for (const [L, k, fl] of [[sun, W.sun, 0], [hemi, W.hemi, 3.5]]) {
      if (!L || k == null) continue;
      if (L.intensity !== L.userData.wI) L.userData.wBase = L.intensity;
      L.intensity = L.userData.wBase * k + this.flash * fl; L.userData.wI = L.intensity;
    }
    if (W.sound) { if (!this.audio) this.startAudio(); else this.audio.g.gain.value = W.sound * (W.wail ? 0.7 + Math.sin(Game.now * 0.7) * 0.3 : 1) * (this.pts && !this.pts.visible ? 0.35 : 1); }
    // particles follow the camera, and stop under a roof
    const P = this.pts; if (!P || !Game.camera) return;
    this.roofT = (this.roofT || 0) - dt; if (this.roofT <= 0) { this.roofT = 0.25; const c0 = Game.camera.position; P.visible = World.raycast(c0.x, c0.y + 0.3, c0.z, 0, 1, 0, 40) < 0; }
    const c = Game.camera.position, a = P.geometry.attributes.position, arr = a.array, R = P.userData.R, n = P.userData.n, wind = W.wind || 0, t = Game.now;
    const stride = W.rain ? 6 : 3, fall = W.rain ? 24 : W.snow ? 2.2 : 0.6;
    for (let i = 0; i < n; i++) {
      const o = i * stride; let x = arr[o], y = arr[o + 1], z = arr[o + 2];
      y -= dt * fall * (1 + (i % 5) * 0.08); x += dt * wind * (W.rain ? 1 : 1 + Math.sin(t + i) * 0.4); z += dt * wind * 0.35 + (W.dust ? Math.sin(t * 2 + i) * dt * 0.8 : 0);
      if (y < c.y - 5) y += 27; if (y > c.y + 22) y -= 27;
      if (x - c.x > R) x -= 2 * R; else if (c.x - x > R) x += 2 * R; if (z - c.z > R) z -= 2 * R; else if (c.z - z > R) z += 2 * R;
      arr[o] = x; arr[o + 1] = y; arr[o + 2] = z;
      if (W.rain) { arr[o + 3] = x - wind * 0.03; arr[o + 4] = y - 0.6; arr[o + 5] = z - wind * 0.01; }
    }
    a.needsUpdate = true;
  },
};
const _loadMap38 = loadMap;
loadMap = function (id, scene) { _loadMap38(id, scene); Weather.tint(); };
const _startCfg38 = Net.startCfgFor.bind(Net);
Net.startCfgFor = function (cfg) { if (cfg && !cfg.weather) cfg.weather = Weather.pick(cfg.map); return _startCfg38(cfg); };
const _start38 = Game.start.bind(Game);
Game.start = function (cfg) {
  if (!cfg.weather) cfg.weather = cfg.mode === 'sandbox' && Settings.weather === 'random' ? 'clear' : Weather.pick(cfg.map);
  Weather.cur = WEATHER[cfg.weather] ? cfg.weather : 'clear';
  KS.reset(); Medal.mk = 0;
  const r = _start38(cfg);
  Weather.setup(this.scene);
  const cc = { overcast: 0xc4c8cc, rain: 0x9ea4aa, fog: 0xd0d2d4, storm: 0x50565e, blizzard: 0xdde2e8, sandstorm: 0xc8a878 }[Weather.cur];
  if (cc && typeof Candy !== 'undefined') for (const c of Candy.clouds) if (c.material) { c.material.color.setHex(cc); if (Weather.cur === 'storm') c.scale.multiplyScalar(1.4); }
  if (Weather.cur !== 'clear') setTimeout(() => { if (Game.running) HUD.center(`Weather: ${Weather.def().name}`, 2.2); }, 1500);
  return r;
};
/* bots can't see as far in fog, rain and storms */
const _sense38 = Brain.prototype.sense;
Brain.prototype.sense = function () {
  const W = Weather.def(), d = this.d;
  if (!W.sight || !d || d.range <= W.sight) return _sense38.call(this);
  const r = d.range; d.range = W.sight; try { return _sense38.call(this); } finally { d.range = r; }
};

/* ── per frame, keys, HUD ──────────────────────────────────────────────── */
const _gupdate38 = Game.update.bind(Game);
Game.update = function (dt) {
  _gupdate38(dt);
  if (!this.running) { Weather.stopAudio(); return; }
  for (const v of this.vehicles) if (v.K.type === 'emplacement' && v.alive) poseMG(v, dt);
  KS.update(dt); Weather.update(dt); Medal.update(dt);
};
const _leave38 = UI.leaveGame ? UI.leaveGame.bind(UI) : null;
if (_leave38) UI.leaveGame = function () { Weather.stopAudio(); KS.reset(); Medal.t = 0; Medal.q = []; if (Medal.el) Medal.el.style.display = 'none'; return _leave38.apply(this, arguments); };
const _show38 = UI.show.bind(UI);
UI.show = function (n) { if (Medal.el && !Game.running) Medal.el.style.display = 'none'; return _show38(n); };
addEventListener('keydown', e => {
  if (e.code !== 'KeyZ' || !Game.running || Input.typing || UI.adminOpen || (Game.mode && Game.mode.id === 'sandbox')) return;
  if (KS.on()) KS.activate();
});
const _hud38 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hud38(dt);
  const L = Game.local; if (!L || !Game.running) return;
  if (L.vehicle && L.vehicle.driver === L && L.vehicle.K.type === 'emplacement') this.el.xh.classList.remove('hidden');
  let el = document.getElementById('kspanel');
  if (!el) { el = document.createElement('div'); el.id = 'kspanel'; this.el.hud.appendChild(el); }
  if (!KS.on()) { el.style.display = 'none'; return; }
  const next = KS.steps.find(s => s[0] > KS.streak), have = KS.mine;
  const html = (have.length ? `<div class="ks-ready">[Z] ${KS.name[have[0]]}${have.length > 1 ? ` <span>+${have.length - 1}</span>` : ''}</div>` : '')
    + `<div class="ks-row">Streak <b>${KS.streak}</b>${next ? ` · ${next[0] - KS.streak} to ${KS.name[next[1]]}` : ''}</div>`;
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
  el.style.display = KS.streak || have.length ? '' : 'none';
};
