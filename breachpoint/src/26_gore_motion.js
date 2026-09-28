/* ═══════════════════════════════════════════════════════════════════════════
   Dismemberment and physics-driven motion.
   · Explosions tear limbs off ragdolls; shotguns at close range, snipers and
     heavy headshots can take a head or limb. The joint breaks, the part flies
     with a blood trail, and the stump bleeds. (Settings → Dismemberment.)
   · Hits make living soldiers flinch: a spring throws the torso and head away
     from the shot and lets them settle back.
   · Bodies lean into acceleration and turns, and sway back on springs.
   · Helmets fly off as physics objects when they're shot off or on a
     headshot kill.
   · Ground vehicles pitch and roll on their suspension when accelerating,
     braking, turning and landing.
   · GUI scale (Settings → UI scale, default 66%).
   ═══════════════════════════════════════════════════════════════════════════ */
if (Settings.gore == null) Settings.gore = true;
if (Settings.uiScale == null) Settings.uiScale = 0.66;

/* ── GUI scale ─────────────────────────────────────────────────────────── */
function applyUiScale() { document.documentElement.style.setProperty('--ui', String(clamp(+Settings.uiScale || 0.66, 0.4, 1.2))); }
const _applyCursor26 = applyCursor;
applyCursor = function () { _applyCursor26(); applyUiScale(); };
applyUiScale();

/* ── a small spring ────────────────────────────────────────────────────── */
function spring(o, k, damp, dt) { o.v += (-o.x * k - o.v * damp) * dt; o.x += o.v * dt; if (Math.abs(o.x) < 1e-4 && Math.abs(o.v) < 1e-3) { o.x = 0; o.v = 0; } }
function motion(s) { return s.mo || (s.mo = { p: { x: 0, v: 0 }, r: { x: 0, v: 0 }, hp: { x: 0, v: 0 }, hr: { x: 0, v: 0 }, lp: { x: 0, v: 0 }, lr: { x: 0, v: 0 }, vx: 0, vz: 0, yaw: null }); }

/* ── flinch: find who the blood came from and shove them ───────────────── */
const _blood26 = FX.blood;
FX.blood = function (p, dir, k = 1) {
  _blood26.call(this, p, dir, k);
  let best = null, bd = 1.3;
  for (const s of Game.soldiers) { if (!s.alive || !s.model) continue; const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z); if (d < bd && p.y > s.pos.y - 0.2 && p.y < s.pos.y + 2.2) { bd = d; best = s; } }
  if (!best) return;
  const M = motion(best), fx = -Math.sin(best.yaw), fz = -Math.cos(best.yaw), rx = Math.cos(best.yaw), rz = -Math.sin(best.yaw);
  const L = Math.hypot(dir.x, dir.z) || 1, dx = dir.x / L, dz = dir.z / L, fwd = dx * fx + dz * fz, side = dx * rx + dz * rz, head = p.y - best.pos.y > best.height - 0.35;
  const imp = 5 * Math.min(2, k);
  // pushed along the shot: hit from the front tips back, from the side rolls
  M.p.v -= fwd * imp; M.r.v -= side * imp;
  if (head) { M.hp.v -= fwd * imp * 2.2; M.hr.v -= side * imp * 2.2; }
};
/* explosions nearby stagger the living too */
const _fxExp26 = FX.explosion;
FX.explosion = function (p) {
  _fxExp26.call(this, p);
  for (const s of Game.soldiers) { if (!s.alive || !s.model) continue; const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z); if (d > 14) continue; const M = motion(s), k = 9 * (1 - d / 14);
    const dx = (s.pos.x - p.x) / (d || 1), dz = (s.pos.z - p.z) / (d || 1); M.p.v += (dx * -Math.sin(s.yaw) + dz * -Math.cos(s.yaw)) * k; M.r.v += (dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw)) * k; M.hp.v += rand(-k, k); }
};

/* ── springs applied on top of the animation ───────────────────────────── */
const _sync26 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) {
  const hadHelmet = this._hadHelmet; this._hadHelmet = !!this.helmet;
  const r = _sync26.call(this, dt, localTeam, viewer);
  // a helmet that just got shot off
  if (hadHelmet && !this.helmet && this.alive && this.model && Game.mode && Game.mode.armor) Gore.popHelmet(this, null);
  if (!this.alive || !this.model || !this.model.visible || this.rag || this.vehicle || dt <= 0) return r;
  const M = motion(this), u = this.model.userData, d = Math.min(dt, 0.05);
  // acceleration in the body's frame: lean into it
  const ax = (this.vel.x - M.vx) / d, az = (this.vel.z - M.vz) / d; M.vx = this.vel.x; M.vz = this.vel.z;
  const fwdA = ax * -Math.sin(this.yaw) + az * -Math.cos(this.yaw), sideA = ax * Math.cos(this.yaw) - az * Math.sin(this.yaw);
  const yr = M.yaw == null ? 0 : angDiff(M.yaw, this.yaw) / d; M.yaw = this.yaw;
  M.lp.v += -clamp(fwdA, -40, 40) * 0.24 * d; M.lr.v += (-clamp(sideA, -40, 40) * 0.2 + clamp(yr, -8, 8) * 0.9 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 5)) * d;
  for (const [o, k, c] of [[M.p, 120, 11], [M.r, 120, 11], [M.hp, 160, 12], [M.hr, 160, 12], [M.lp, 60, 12], [M.lr, 60, 12]]) spring(o, k, c, d);
  const pt = clamp(M.p.x + M.lp.x, -0.6, 0.6), rl = clamp(M.r.x + M.lr.x, -0.5, 0.5);
  u.upper.rotation.x += pt; u.upper.rotation.z = rl; u.head.rotation.x = clamp(M.hp.x, -0.7, 0.7); u.head.rotation.z = clamp(M.hr.x, -0.5, 0.5);
  u.arms.rotation.z = -rl * 0.5;
  return r;
};

/* ── dismemberment ─────────────────────────────────────────────────────── */
const GIB_WEAPONS = { awp: 0.7, scout: 0.35, deagle: 0.25, nova: 1, xm1014: 1, sawedoff: 1, mag7: 1, tankshell: 1, apcgun: 0.6, helimg: 0.5, jetgun: 0.8 };
const Gore = {
  bits: [],
  stumpMat: null,
  mat() { return this.stumpMat || (this.stumpMat = new THREE.MeshStandardMaterial({ color: 0x6a0808, roughness: 0.35, metalness: 0 })); },
  /* which parts come off */
  pick(ev, v, a) {
    const w = ev.w, boom = EXPLOSIVE_KILLS.includes(w) || !!(WEAPONS[w] && WEAPONS[w].explosive), dist = a ? Math.hypot(a.pos.x - v.pos.x, a.pos.z - v.pos.z) : 99;
    const out = new Set(), limbs = ['legL', 'legR', 'arms', 'head'];
    if (boom) { const n = chance(0.6) ? randi(1, 3) : 0; for (let i = 0; i < n; i++) out.add(pick(limbs)); }
    else if (GIB_WEAPONS[w]) {
      const close = (WEAPONS[w] && WEAPONS[w].type === 'shotgun') ? dist < 7 : true;
      if (close && ev.hs && chance(GIB_WEAPONS[w])) out.add('head');
      else if (close && WEAPONS[w] && WEAPONS[w].type === 'shotgun' && dist < 4 && chance(0.4)) out.add(pick(['arms', 'legL', 'legR']));
    }
    return [...out];
  },
  cut(v, parts, push) {
    const r = v.rag; if (!r || !parts.length) return;
    const order = ['legL', 'legR', 'head', 'arms'], U = r.parts.upper;
    for (const k of parts) {
      const i = order.indexOf(k), c = r.joints[i]; if (!c || c._cut) continue; c._cut = true; Ragdoll.world.removeConstraint(c);
      const P = r.parts[k], b = P.body;
      b.velocity.x += push.x * 0.8 + rand(-3, 3); b.velocity.y += 3 + rand(0, 4); b.velocity.z += push.z * 0.8 + rand(-3, 3);
      b.angularVelocity.set(rand(-12, 12), rand(-12, 12), rand(-12, 12)); b.wakeUp();
      // stumps: red caps at the broken joint, on the body and on the part
      const pa = c.pivotA, pb = c.pivotB, cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 8), this.mat()), cap2 = cap.clone();
      cap.position.set(pb.x + U.off[0], pb.y + U.off[1], pb.z + U.off[2]); cap2.position.set(pa.x + P.off[0], pa.y + P.off[1], pa.z + P.off[2]);
      if (k === 'arms') { cap.rotation.z = cap2.rotation.z = Math.PI / 2; cap.scale.y = cap2.scale.y = 3; }
      U.g.add(cap); P.g.add(cap2); r.caps = r.caps || []; r.caps.push(cap, cap2);
      const at = new V3(b.position.x, b.position.y, b.position.z);
      if (Settings.blood) { FX.blood(at, new V3(push.x || rand(-1, 1), 0.6, push.z || rand(-1, 1)), 2.2); FX.blood(at, new V3(rand(-1, 1), -0.4, rand(-1, 1)), 1.4); }
      this.bits.push({ b, t: 0, stump: U.body, r });
    }
    r.cut = true;
  },
  popHelmet(s, push) {
    const u = s.model && s.model.userData; if (!u || !u.helmet || !Ragdoll.ensureWorld) return;
    const w = Ragdoll.ensureWorld(); u.head.updateMatrixWorld(true);
    const mesh = u.helmet.clone(true); mesh.visible = true; const wp = u.helmet.getWorldPosition(new V3()), wq = u.helmet.getWorldQuaternion(new THREE.Quaternion());
    mesh.position.copy(wp); mesh.quaternion.copy(wq); Game.scene.add(mesh); u.helmet.visible = false;
    const body = new CANNON.Body({ mass: 1.5, shape: new CANNON.Box(new CANNON.Vec3(0.13, 0.06, 0.14)), linearDamping: 0.1, angularDamping: 0.2, collisionFilterGroup: 2, collisionFilterMask: 1 });
    body.position.set(wp.x, wp.y, wp.z); body.quaternion.set(wq.x, wq.y, wq.z, wq.w);
    const px = push ? push.x : rand(-1, 1), pz = push ? push.z : rand(-1, 1);
    body.velocity.set(px * 1.5 + rand(-1, 1), 3.5 + rand(0, 2), pz * 1.5 + rand(-1, 1)); body.angularVelocity.set(rand(-10, 10), rand(-10, 10), rand(-10, 10));
    w.addBody(body); this.bits.push({ b: body, t: 0, mesh, helmet: true }); Ragdoll.keepAwake = 3;
  },
  step(dt) {
    for (const x of this.bits) {
      x.t += dt;
      if (x.mesh) { x.mesh.position.set(x.b.position.x, x.b.position.y, x.b.position.z); x.mesh.quaternion.set(x.b.quaternion.x, x.b.quaternion.y, x.b.quaternion.z, x.b.quaternion.w); }
      // flying parts leave a trail, stumps drip
      if (Settings.blood && x.r && x.t < 2.5 && Math.random() < dt * 30) {
        const b = x.b, sp = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z);
        if (sp > 1) FX.emit('norm', b.position.x, b.position.y, b.position.z, 2, 0.6, [0.4, 0.02, 0.02], 0.5, -9, 0.3);
        if (x.t < 1.5 && Math.random() < 0.4) { const s = x.stump; FX.emit('norm', s.position.x, s.position.y + 0.2, s.position.z, 2, 1.2, [0.45, 0.02, 0.02], 0.6, -9, 0.45, new V3(rand(-1, 1), 2, rand(-1, 1))); }
      }
    }
    for (const x of this.bits.filter(x => x.t > (x.helmet ? 20 : 3))) { if (x.mesh) { Game.scene && Game.scene.remove(x.mesh); if (Ragdoll.world) Ragdoll.world.removeBody(x.b); } }
    this.bits = this.bits.filter(x => x.t <= (x.helmet ? 20 : 3));
  },
  clear() { for (const x of this.bits) if (x.mesh && x.mesh.parent) x.mesh.parent.remove(x.mesh); this.bits = []; },
};
const _onKill26 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  const v = this.byId(ev.v), a = this.byId(ev.a), helm = v && (v.helmet || v._hadHelmet) && v.model && v.model.userData.helmet && v.model.userData.helmet.visible;
  _onKill26(ev);
  if (!v || !v.rag) return;
  const dir = a && a !== v ? new V3(v.pos.x - a.pos.x, 0, v.pos.z - a.pos.z).normalize() : new V3(rand(-1, 1), 0, rand(-1, 1)).normalize();
  const boom = EXPLOSIVE_KILLS.includes(ev.w) || !!(WEAPONS[ev.w] && WEAPONS[ev.w].explosive), push = dir.multiplyScalar(boom ? 9 : 4);
  if (helm && (ev.hs || boom)) try { Gore.popHelmet(v, push); } catch (e) { /* no helmet */ }
  if (Settings.gore !== false) try { Gore.cut(v, Gore.pick(ev, v, a), push); } catch (e) { /* ragdoll gone */ }
};
/* stumps go when the body is let go of */
const _release26 = Ragdoll.release.bind(Ragdoll);
Ragdoll.release = function (s) { const r = s.rag; if (r && r.caps) for (const c of r.caps) if (c.parent) c.parent.remove(c); if (r) Gore.bits = Gore.bits.filter(x => x.r !== r); return _release26(s); };
/* helmets keep the physics world stepping even with no bodies down */
const _rstep26 = Ragdoll.step.bind(Ragdoll);
Ragdoll.step = function (dt) {
  if (this.world && this.scene === Game.scene && Gore.bits.some(x => x.helmet) && !this.list.some(r => !r.frozen)) { this.acc = Math.min(this.acc + dt, 3 / 60); while (this.acc >= 1 / 60) { this.acc -= 1 / 60; this.world.step(1 / 60); } }
  else _rstep26(dt);
  Gore.step(dt);
};
const _clearAll26 = Ragdoll.clearAll.bind(Ragdoll);
Ragdoll.clearAll = function () { Gore.clear(); return _clearAll26(); };

/* ── vehicle suspension ────────────────────────────────────────────────── */
const _vupdate26 = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt) {
  const T = this.K.type, ground = !(T === 'heli' || T === 'jet'), y0 = this.pos.y, s0 = this.speed, yaw0 = this.yaw;
  const r = _vupdate26.call(this, dt);
  if (!ground || !this.model || dt <= 0) return r;
  const S = this.sus || (this.sus = { p: { x: 0, v: 0 }, r: { x: 0, v: 0 }, h: { x: 0, v: 0 }, vy: 0 }), d = Math.min(dt, 0.05);
  const acc = (this.speed - s0) / d, turn = angDiff(yaw0, this.yaw) / d, vy = (this.pos.y - y0) / d, heavy = this.K.turret ? 0.35 : T === 'boat' ? 0.6 : 1;
  S.p.v += clamp(acc, -30, 30) * 0.012 * heavy; S.r.v += clamp(turn * this.speed, -30, 30) * 0.004 * heavy;
  if (S.vy < -3 && vy > -0.5) S.h.v -= Math.min(4, -S.vy) * 0.25;   // landing thump
  S.vy = vy;
  if (T === 'boat') { S.p.v += Math.sin(Game.now * 1.3 + this.pos.x) * 0.02; S.r.v += Math.sin(Game.now * 0.9 + this.pos.z) * 0.03; }
  spring(S.p, 90, 9, d); spring(S.r, 90, 9, d); spring(S.h, 140, 10, d);
  const m = this.model; if (m.rotation.order !== 'YXZ') m.rotation.order = 'YXZ';
  m.rotation.x = clamp(S.p.x, -0.12, 0.12); m.rotation.z = clamp(S.r.x, -0.1, 0.1); m.position.y += clamp(S.h.x, -0.2, 0.1);
  return r;
};
