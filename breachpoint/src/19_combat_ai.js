/* ═══════════════════════════════════════════════════════════════════════════
   Combat round:
   · Tighter guns: much less spread, movement bloom and recoil for everyone.
   · Launchers only for Engineers, fewer rockets, and only a few Engineer bots
     per team, so tanks don't melt.
   · Bots crew tanks: a free tank is handed to a nearby bot, who walks over,
     climbs in, drives toward the objective (or the enemy), and aims and
     fires the cannon.
   · Blood: sprays on hits, spatter on walls and floors, a small pool where
     someone dies. Fades out after a while. Settings can turn it off.
   · Crosshair styles and a themed mouse cursor (styles live in the HUD).
   · Safer sandbox placement: NPCs and vehicles appear on your side of walls.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── accuracy ──────────────────────────────────────────────────────────── */
for (const id in WEAPONS) {
  const w = WEAPONS[id]; if (!w || w.hidden || !w.type || w.type === 'knife' || w.type === 'physgun' || w.type === 'tool') continue;
  const k = w.type === 'shotgun' ? { sp: 0.75, mv: 0.5, rc: 0.7 } : w.type === 'sniper' ? { sp: 0.5, mv: 0.5, rc: 0.7 } : w.type === 'launcher' ? { sp: 0.5, mv: 0.5, rc: 1 } : { sp: 0.4, mv: 0.45, rc: 0.6 };
  if (w.spread) w.spread *= k.sp; if (w.hipSpread) w.hipSpread *= k.sp + 0.05; if (w.moveSpread) w.moveSpread *= k.mv; if (w.recoil) w.recoil *= k.rc;
}

/* ── launchers: only a handful of Engineer bots per team ──────────────── */
function botClass(roster, team, size) {
  const cap = Math.max(1, Math.round(size * 0.15)), eng = roster.filter(r => r.team === team && r.cls === 'engineer').length;
  return pick(Object.keys(CLASSES).filter(k => k !== 'engineer' || eng < cap));
}

/* ── mouse cursor ─────────────────────────────────────────────────────── */
function applyCursor() { if (document.body) document.body.classList.toggle('cur-themed', Settings.cursor !== 'system'); }
if (document.body) applyCursor(); else addEventListener('DOMContentLoaded', applyCursor);

/* ── blood ─────────────────────────────────────────────────────────────── */
const BloodDecals = {
  N: 64, list: [], i: 0, scene: null, tex: null,
  textures() {
    if (this.tex) return this.tex;
    this.tex = [];
    for (let v = 0; v < 4; v++) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      const blob = (cx, cy, r, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(95,0,0,${a})`); g.addColorStop(0.7, `rgba(120,6,6,${a * 0.9})`); g.addColorStop(1, 'rgba(120,6,6,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); };
      for (let i = 0; i < 7; i++) blob(64 + rand(-16, 16), 64 + rand(-16, 16), rand(14, 30), 0.85);
      for (let i = 0; i < 14; i++) { const a = rand(0, TAU), d = rand(28, 58); blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rand(2, 6), 0.9); }
      for (let i = 0; i < 3; i++) { const a = rand(0, TAU); x.strokeStyle = 'rgba(100,0,0,.8)'; x.lineWidth = rand(2, 4); x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * rand(35, 58), 64 + Math.sin(a) * rand(35, 58)); x.stroke(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; this.tex.push(t);
    }
    return this.tex;
  },
  ensure() {
    if (this.scene === Game.scene && this.list.length) return true;
    if (!Game.scene) return false;
    this.scene = Game.scene; this.list = []; this.i = 0; const T = this.textures(), geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < this.N; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: T[i % 4], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      m.visible = false; m.renderOrder = 1; this.scene.add(m); this.list.push(m);
    }
    return true;
  },
  put(p, n, size) {
    if (!Settings.blood || !this.ensure()) return;
    const m = this.list[this.i++ % this.N];
    m.position.set(p.x + n.x * 0.015, p.y + n.y * 0.015, p.z + n.z * 0.015); m.lookAt(p.x + n.x, p.y + n.y, p.z + n.z); m.rotateZ(rand(0, TAU));
    m.scale.setScalar(size); m.material.map = this.tex[randi(0, 3)]; m.material.opacity = 0.92; m.userData.t0 = Game.now; m.visible = true;
  },
  update() {
    if (this.scene !== Game.scene) return;
    for (const m of this.list) if (m.visible) { const age = Game.now - m.userData.t0; if (age > 30 || age < 0) m.visible = false; else if (age > 20) m.material.opacity = 0.92 * (1 - (age - 20) / 10); }
  },
};
FX.blood = function (p, dir, k = 1) {
  if (!Settings.blood) { this.emit('norm', p.x, p.y, p.z, 4, 2, [0.5, 0.05, 0.05], 0.3, -6, 0.5); return; }
  const d = new V3(dir.x, dir.y, dir.z).normalize();
  this.emit('norm', p.x, p.y, p.z, Math.round(12 * k), 2.6, [0.45, 0.02, 0.02], 0.55, -9, 0.8, d.clone().multiplyScalar(2.5));
  this.emit('norm', p.x, p.y, p.z, Math.round(6 * k), 1.2, [0.3, 0, 0], 0.8, -3, 0.35);
  const t = World.raycast(p.x, p.y, p.z, d.x, d.y, d.z, 2.6);
  if (t >= 0) BloodDecals.put(new V3(p.x + d.x * t, p.y + d.y * t, p.z + d.z * t), new V3(World.hit.nx, World.hit.ny, World.hit.nz), rand(0.35, 0.75) * k);
  if (Math.random() < 0.55) {
    const gx = p.x + d.x * 0.5 + rand(-0.3, 0.3), gz = p.z + d.z * 0.5 + rand(-0.3, 0.3), g = World.raycast(gx, p.y, gz, 0, -1, 0, 4);
    const gy = g >= 0 ? p.y - g : p.y < 3 ? 0 : null; if (gy != null) BloodDecals.put(new V3(gx, gy, gz), new V3(0, 1, 0), rand(0.3, 0.6));
  }
};
const _fxUpdate19 = FX.update.bind(FX);
FX.update = function (dt) { _fxUpdate19(dt); BloodDecals.update(); };
const _onKill19 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  _onKill19(ev);
  const v = this.byId(ev.v); if (!v || !Settings.blood || v.vehicle || ev.w === 'fall') return;
  const scene = this.scene, x = v.pos.x, y = v.pos.y, z = v.pos.z;
  setTimeout(() => { if (this.scene === scene) BloodDecals.put(new V3(x + rand(-0.3, 0.3), y, z + rand(-0.3, 0.3)), new V3(0, 1, 0), rand(0.9, 1.3)); }, 500);
};

/* ── sandbox placement on your side of walls ───────────────────────────── */
function spaceClear(x0, y0, z0, x1, y1, z1) {
  for (const b of World.near(x0, z0, x1, z1)) if (b.x1 > x0 && b.x0 < x1 && b.z1 > z0 && b.z0 < z1 && b.y1 > y0 && b.y0 < y1) return false;
  if (Phys.active) for (const d of Phys.dyn) if (d.x1 > x0 && d.x0 < x1 && d.z1 > z0 && d.z0 < z1 && d.y1 > y0 && d.y0 < y1) return false;
  return true;
}
function floorBelow(x, fromY, z) {
  const t = World.raycast(x, fromY, z, 0, -1, 0, 80), ph = Phys.active ? Phys.ray(new V3(x, fromY, z), new V3(0, -1, 0), t >= 0 ? t : 80) : null;
  const tt = ph ? ph.t : t; return tt >= 0 ? Math.max(0, fromY - tt) : 0;
}
/* walk back from where you aim toward you until there's room to stand and you can see the spot */
Sandbox.safeSpot = function (s, r, h, maxD = 80) {
  const tr = this.trace(s, maxD), eye = s.eye(new V3());
  const P = tr.kind === 'none' ? eye.clone().addScaledVector(s.forward(new V3()), Math.min(12, maxD)) : tr.p.clone().addScaledVector(tr.n, 0.05);
  const bx = eye.x - P.x, bz = eye.z - P.z, len = Math.hypot(bx, bz) || 1, ux = bx / len, uz = bz / len;
  for (let d = 0; d <= len; d += 0.3) {
    const x = P.x + ux * d, z = P.z + uz * d, y = floorBelow(x, Math.max(P.y, 0) + 0.4, z);
    if (!spaceClear(x - r, y + 0.25, z - r, x + r, y + h, z + r)) continue;
    if (!World.los(eye.x, eye.y, eye.z, x, y + Math.min(1.2, h * 0.6), z)) continue;
    return { x, y, z };
  }
  const q = World.nav.randomNear(s.pos.x, s.pos.z, 3); return { x: q.x, y: 0, z: q.z };
};

/* ── bots in tanks ─────────────────────────────────────────────────────── */
const TankAI = {
  t: 0,
  update(dt) {
    if (!Game.authority() || !Game.running) return;
    this.t -= dt; if (this.t > 0) return; this.t = 1.5;
    const sbx = Game.mode.id === 'sandbox'; if (!Game.mode.vehicles && !sbx) return;
    for (const v of Game.vehicles) {
      if (!v.K.turret || !v.alive || v.driver || v.held || v.frozen) continue;
      if (v.crew && v.crew.alive && v.crew.brain && v.crew.brain.crew === v && !v.crew.vehicle) continue;   // someone is on the way
      let best = null, bd = sbx ? 45 : 90;
      for (const s of Game.soldiers) {
        if (s.ctrl !== 'bot' || !s.alive || s.vehicle || !s.brain || s.brain.constructor !== Brain || s.brain.crew || s.heldBy || s.planting) continue;
        if (sbx ? !(s.team === 'T' || s.team === 'CT') : (s.team !== v.team || s.cls === 'engineer')) continue;
        const d = dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = s; }
      }
      if (best) { best.brain.crew = v; v.crew = best; if (!sbx && Game.cmd[best.team]) Game.cmd[best.team].say(best, 'Taking the tank!', 4); }
    }
  },
};
const _aiUpdate19 = AI.update.bind(AI);
AI.update = function (dt) { _aiUpdate19(dt); TankAI.update(dt); };
const _brainReset19 = Brain.prototype.reset;
Brain.prototype.reset = function () { _brainReset19.call(this); this.crew = null; this.tank = null; this.tankTarget = null; };
const _brainUpdate19 = Brain.prototype.update;
Brain.prototype.update = function (dt) {
  const s = this.s; if (!s.alive) return;
  if (s.vehicle) { if (s.vehicle.driver === s && s.vehicle.K.turret) return this.driveTank(dt); if (s.vehicle.driver === s) { Game.exitVehicle(s); } return; }
  const v = this.crew;
  if (v) {
    if (!v.alive || v.driver || v.held || (Game.mode.id !== 'sandbox' && v.team !== s.team)) { if (v.crew === s) v.crew = null; this.crew = null; }
    else {
      this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.12; this.sense(); }
      if (!(this.target && this.target.alive)) {
        const in_ = s.moveIn; in_.f = in_.s = 0; in_.jump = in_.crouch = in_.walk = in_.sprint = false;
        if (dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z) < v.K.enter) {
          v.driver = s; s.vehicle = v; v.crew = null; this.crew = null; if (Game.mode.id === 'sandbox') v.team = s.team;
          this.tank = null; Net.vehicleSeat(v); return;
        }
        this.moveTo(v.pos, dt, false, false, true); this.turnTo(Math.atan2(-(v.pos.x - s.pos.x), -(v.pos.z - s.pos.z)), 0, dt, 6);
        return;
      }
    }
  }
  return _brainUpdate19.call(this, dt);
};
Brain.prototype.driveTank = function (dt) {
  const s = this.s, v = s.vehicle, now = Game.now, inp = { f: 0, s: 0, brake: false };
  const T = this.tank || (this.tank = { stuckT: 0, revT: 0, revS: 1, path: null, pi: 0, repathT: 0, goal: null, errT: 0, ex: 0, ey: 0, senseT: 0 });
  s.pos.set(v.pos.x, v.pos.y, v.pos.z); s.vel.set(0, 0, 0); s.moveIn.f = s.moveIn.s = 0;
  if (v.hp < v.maxHp * 0.12 || v.burnT > 0) { Game.exitVehicle(s); return; }   // bail out of a wreck
  // targets: anything hostile the turret can see, other tanks included
  T.senseT -= dt;
  if (T.senseT <= 0) {
    T.senseT = 0.25; const e0 = new V3(v.pos.x, v.pos.y + 2.3, v.pos.z); let best = null, bd = 160;
    for (const e of Game.soldiers) {
      if (!e.alive || !Game.hostile(s, e)) continue;
      const p = e.vehicle ? e.vehicle.pos : e.pos, d = dist2(p.x, p.z, v.pos.x, v.pos.z); if (d > bd) continue;
      if (!World.los(e0.x, e0.y, e0.z, p.x, p.y + 1.1, p.z)) continue;
      best = e; bd = d * (e.vehicle && e.vehicle.kind === 'tank' ? 0.6 : 1);   // other tanks first
    }
    this.tankTarget = best;
  }
  const tgt = this.tankTarget && this.tankTarget.alive ? this.tankTarget : null;
  const tp = tgt ? (tgt.vehicle ? tgt.vehicle.pos : tgt.pos) : null, tDist = tp ? dist2(tp.x, tp.z, v.pos.x, v.pos.z) : 1e9;
  // where to go: the objective, the enemy, or crush someone who got too close
  let goal = null;
  if (tgt && tDist < 14 && !tgt.vehicle) goal = { x: tp.x, z: tp.z, r: 0.5 };
  else if (tgt && tDist < 70) goal = null;   // good firing position: hold and shoot
  else if (Game.mode.id === 'conquest') {
    const q = s.squad && s.squad.target, f = q || World.flags.filter(f => f.owner !== s.team).sort((a, b) => dist2(a.x, a.z, v.pos.x, v.pos.z) - dist2(b.x, b.z, v.pos.x, v.pos.z))[0];
    if (f) goal = { x: f.x, z: f.z, r: 8 };
  } else if (tgt) goal = { x: tp.x, z: tp.z, r: 30 };
  else { const cmd = Game.cmd[s.team], it = cmd && [...cmd.intel.values()].filter(i => now - i.t < 15).sort((a, b) => b.t - a.t)[0]; if (it) goal = { x: it.pos.x, z: it.pos.z, r: 22 }; }
  if (goal && dist2(goal.x, goal.z, v.pos.x, v.pos.z) > goal.r) {
    if (!T.path || now > T.repathT || !T.goal || dist2(T.goal.x, T.goal.z, goal.x, goal.z) > 6) {
      if (AI.budget > 0) { AI.budget--; T.goal = goal; T.path = World.nav.find(v.pos.x, v.pos.z, goal.x, goal.z); T.pi = 0; T.repathT = now + 4; }
    }
    let wp = T.path && T.path[T.pi];
    while (wp && dist2(v.pos.x, v.pos.z, wp.x, wp.z) < 3.5 && T.pi < T.path.length - 1) wp = T.path[++T.pi];
    if (T.path) for (let j = Math.min(T.path.length - 1, T.pi + 6); j > T.pi; j--) if (World.nav.lineClear(v.pos.x, v.pos.z, T.path[j].x, T.path[j].z)) { T.pi = j; wp = T.path[j]; break; }
    const tx = wp ? wp.x : goal.x, tz = wp ? wp.z : goal.z, want = Math.atan2(-(tx - v.pos.x), -(tz - v.pos.z)), diff = angDiff(v.yaw, want);
    inp.s = clamp(-diff * 2.5, -1, 1); inp.f = Math.abs(diff) < 0.5 ? 1 : 0;
    if (T.revT > 0) { T.revT -= dt; inp.f = -1; inp.s = T.revS; }
    else if (inp.f > 0 && Math.abs(v.speed) < 0.7) { T.stuckT += dt; if (T.stuckT > 1.6) { T.stuckT = 0; T.revT = 1.3; T.revS = chance(0.5) ? 1 : -1; T.path = null; } }
    else T.stuckT = 0;
  } else inp.brake = true;
  v.drive(inp, dt);
  // turret: lead nothing, allow for drop, wobble by skill
  if (tgt) {
    const p = new V3(tp.x, tp.y + (tgt.vehicle ? 1.2 : 1.0), tp.z), m = new V3(v.pos.x, v.pos.y + 2.2, v.pos.z), dx = p.x - m.x, dz = p.z - m.z, hd = Math.hypot(dx, dz);
    T.errT -= dt; if (T.errT <= 0) { T.errT = 1; const e = this.d.err * 0.004; T.ex = rand(-e, e); T.ey = rand(-e, e) * 0.5; }
    const W = WEAPONS.tankshell, drop = (W.gravity || 0) * hd * hd / (2 * W.projectile * W.projectile);
    s.yaw = Math.atan2(-dx, -dz) + T.ex; s.pitch = Math.atan2(p.y - m.y, hd) + drop / Math.max(hd, 1) + T.ey;
    const aligned = Math.abs(angDiff(v.yaw + v.tYaw, s.yaw)) < 0.05 && Math.abs(v.tPitch - clamp(s.pitch, -0.12, 0.32)) < 0.06;
    if (aligned && (v.kind === 'tank' ? v.reloadT <= 0 && hd > 14 : true)) v.fire(s);
  } else { s.yaw = angWrap(v.yaw); s.pitch = 0.02; }
};
