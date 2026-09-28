/* ═══════════════════════════════════════════════════════════════════════════
   Ragdolls. When someone dies their body goes limp: torso, head, arms and
   legs become physics bodies joined at the hips, neck and shoulders, thrown
   by the hit that killed them (explosions throw harder) and settling on the
   level's geometry and sandbox props. Purely visual, so every machine runs
   its own; nothing is sent over the network.
   ═══════════════════════════════════════════════════════════════════════════ */

const EXPLOSIVE_KILLS = ['frag', 'rpg', 'm79', 'tankshell', 'dynamite', 'jeep', 'bomb'];
const Ragdoll = {
  world: null, scene: null, list: [], MAX: 10, acc: 0, propBodies: new Map(),
  ensureWorld() {
    if (this.world && this.scene === Game.scene) return this.world;
    this.clearAll(); this.scene = Game.scene;
    const w = this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -14, 0) });
    w.broadphase = new CANNON.SAPBroadphase(w); w.allowSleep = true; w.solver.iterations = 10;
    w.defaultContactMaterial.friction = 0.7; w.defaultContactMaterial.restitution = 0.05;
    const stat = shape => new CANNON.Body({ type: CANNON.Body.STATIC, shape, collisionFilterGroup: 1, collisionFilterMask: 2 });
    const ground = stat(new CANNON.Plane()); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); w.addBody(ground);
    for (const b of World.boxes) { const body = stat(new CANNON.Box(new CANNON.Vec3((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2))); body.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); w.addBody(body); }
    return w;
  },
  clearAll() { for (const r of this.list.slice()) this.release(r.s); this.list = []; this.world = null; this.propBodies.clear(); },
  /* a sandbox prop the bodies can land on: a kinematic box that follows its bounds */
  syncProps() {
    if (!Phys.active || !this.world) return;
    const seen = new Set();
    for (const b of Phys.dyn) {
      const p = b.prop; if (!p) continue; seen.add(p);
      let k = this.propBodies.get(p);
      const hx = Math.max(0.02, (b.x1 - b.x0) / 2), hy = Math.max(0.02, (b.y1 - b.y0) / 2), hz = Math.max(0.02, (b.z1 - b.z0) / 2);
      if (!k || Math.abs(k.hx - hx) + Math.abs(k.hy - hy) + Math.abs(k.hz - hz) > 0.01) {
        if (k) this.world.removeBody(k.body);
        const body = new CANNON.Body({ type: CANNON.Body.KINEMATIC, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), collisionFilterGroup: 1, collisionFilterMask: 2 });
        this.world.addBody(body); k = { body, hx, hy, hz }; this.propBodies.set(p, k);
      }
      k.body.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    }
    for (const [p, k] of this.propBodies) if (!seen.has(p)) { this.world.removeBody(k.body); this.propBodies.delete(p); }
  },
  create(s, push) {
    const M = s.model; if (!M || !M.visible || s.vehicle || this.list.some(r => r.s === s)) return;
    const w = this.ensureWorld(), u = M.userData; M.updateMatrixWorld(true);
    if (this.list.length >= this.MAX) this.freeze(this.list.find(r => !r.frozen) || this.list[0]);
    const defs = [
      { k: 'legL', g: u.legL, half: [0.085, 0.44, 0.1], off: [0, -0.44, 0], mass: 9 },
      { k: 'legR', g: u.legR, half: [0.085, 0.44, 0.1], off: [0, -0.44, 0], mass: 9 },
      { k: 'upper', g: u.upper, half: [0.25, 0.3, 0.15], off: [0, 0.3, 0], mass: 22 },
      { k: 'head', g: u.head, sphere: 0.14, off: [0, 0, 0], mass: 5 },
      { k: 'arms', g: u.arms, half: [0.22, 0.08, 0.28], off: [0, -0.05, -0.25], mass: 7 },
    ];
    const r = { s, parts: {}, saved: [], t: 0, frozen: false, joints: [] };
    for (const d of defs) {
      r.saved.push({ g: d.g, p: d.g.position.clone(), q: d.g.quaternion.clone() });
      const wp = new V3(...d.off).applyMatrix4(d.g.matrixWorld), wq = d.g.getWorldQuaternion(new THREE.Quaternion());
      const body = new CANNON.Body({ mass: d.mass, shape: d.sphere ? new CANNON.Sphere(d.sphere) : new CANNON.Box(new CANNON.Vec3(...d.half)), linearDamping: 0.08, angularDamping: 0.35, collisionFilterGroup: 2, collisionFilterMask: 1 });
      body.position.set(wp.x, wp.y, wp.z); body.quaternion.set(wq.x, wq.y, wq.z, wq.w);
      const jolt = d.k === 'upper' || d.k === 'head' ? 1 : 0.6;
      body.velocity.set(s.vel.x + push.x * jolt + rand(-0.4, 0.4), Math.max(0, s.vel.y) + push.y * jolt + rand(0, 0.5), s.vel.z + push.z * jolt + rand(-0.4, 0.4));
      body.angularVelocity.set(rand(-2, 2), rand(-2, 2), rand(-2, 2));
      body.sleepSpeedLimit = 0.2; body.sleepTimeLimit = 0.8;
      w.addBody(body); r.parts[d.k] = { body, off: d.off, g: d.g };
    }
    const U = r.parts.upper.body, joint = (k, gp, angle, axis) => {
      const A = r.parts[k].body, pw = gp.clone(), ax = new CANNON.Vec3(...axis);
      const pa = A.pointToLocalFrame(new CANNON.Vec3(pw.x, pw.y, pw.z)), pb = U.pointToLocalFrame(new CANNON.Vec3(pw.x, pw.y, pw.z));
      const axA = A.quaternion.inverse().vmult(U.quaternion.vmult(ax));   // the same world direction in each body's frame
      const c = CANNON.ConeTwistConstraint ? new CANNON.ConeTwistConstraint(A, U, { pivotA: pa, pivotB: pb, axisA: axA, axisB: ax, angle, twistAngle: angle * 0.5, maxForce: 1e6 }) : new CANNON.PointToPointConstraint(A, pa, U, pb, 1e6);
      c.collideConnected = false; w.addConstraint(c); r.joints.push(c);
    };
    const at = g => g.localToWorld(new V3(0, 0, 0));
    joint('legL', at(u.legL), 0.9, [0, -1, 0]); joint('legR', at(u.legR), 0.9, [0, -1, 0]);
    joint('head', at(u.head), 0.55, [0, 1, 0]); joint('arms', at(u.arms), 1.3, [0, 0, -1]);
    s.rag = r; this.list.push(r);
  },
  freeze(r) { if (!r || r.frozen) return; r.frozen = true; for (const c of r.joints) this.world && this.world.removeConstraint(c); for (const k in r.parts) this.world && this.world.removeBody(r.parts[k].body); },
  release(s) {
    const r = s.rag; if (!r) return; this.freeze(r);
    for (const sv of r.saved) { sv.g.position.copy(sv.p); sv.g.quaternion.copy(sv.q); }
    s.rag = null; this.list = this.list.filter(x => x !== r);
  },
  step(dt) {
    if (!this.world || this.scene !== Game.scene || !this.list.some(r => !r.frozen)) return;
    this.syncProps();
    this.acc = Math.min(this.acc + dt, 3 / 60);
    while (this.acc >= 1 / 60) { this.acc -= 1 / 60; this.world.step(1 / 60); }
    for (const r of this.list) if (!r.frozen) { r.t += dt; if (r.t > 7 || Object.values(r.parts).every(p => p.body.sleepState === CANNON.Body.SLEEPING)) { if (r.t > 1.5) this.freeze(r); } }
  },
  /* put the model's limbs where the bodies are */
  pose(s) {
    const r = s.rag, M = s.model, u = M.userData;
    M.position.set(0, 0, 0); M.rotation.set(0, 0, 0); u.body.position.set(0, 0, 0); u.body.rotation.set(0, 0, 0);
    const world = k => { const b = r.parts[k].body, q = new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); return { q, p: new V3(-r.parts[k].off[0], -r.parts[k].off[1], -r.parts[k].off[2]).applyQuaternion(q).add(new V3(b.position.x, b.position.y, b.position.z)) }; };
    for (const k of ['legL', 'legR', 'upper']) { const W = world(k), g = r.parts[k].g; g.position.copy(W.p); g.quaternion.copy(W.q); }
    const up = r.parts.upper.g, iq = up.quaternion.clone().invert();
    for (const k of ['head', 'arms']) { const W = world(k), g = r.parts[k].g; g.position.copy(W.p.sub(up.position).applyQuaternion(iq)); g.quaternion.copy(iq.clone().multiply(W.q)); }
  },
  /* explosions shove bodies that are already down */
  blast(p) {
    for (const r of this.list) {
      if (r.frozen) continue;
      for (const k in r.parts) { const b = r.parts[k].body, d = new V3(b.position.x - p.x, b.position.y - p.y + 0.5, b.position.z - p.z), L = d.length(); if (L > 10) continue; d.normalize().multiplyScalar(12 * (1 - L / 10)); b.velocity.x += d.x; b.velocity.y += d.y; b.velocity.z += d.z; b.wakeUp(); }
    }
  },
};

/* hooks: start on death, pose while dead, let go on respawn */
const _onKill21 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  const v = this.byId(ev.v), a = this.byId(ev.a);
  if (v && Settings.ragdoll !== false && v.model && !v.vehicle) {
    let dir = a && a !== v ? new V3(v.pos.x - a.pos.x, 0, v.pos.z - a.pos.z) : new V3(rand(-1, 1), 0, rand(-1, 1)); if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1); dir.normalize();
    const boom = EXPLOSIVE_KILLS.includes(ev.w) || !!(WEAPONS[ev.w] && WEAPONS[ev.w].explosive), pow = boom ? 9 : ev.hs ? 4.2 : 3.2;
    try { Ragdoll.create(v, new V3(dir.x * pow, boom ? 6 : 1.2, dir.z * pow)); } catch (e) { v.rag = null; }
  }
  _onKill21(ev);
};
const _sync21 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) {
  if (this.rag && (this.alive || !this.model)) Ragdoll.release(this);
  if (this.rag && !this.alive) {
    const M = this.model; M.visible = this.deadT < 8 && this !== viewer;
    this.deadT += dt; if (this.tag) this.tag.visible = false;
    if (M.visible) Ragdoll.pose(this); else Ragdoll.release(this);
    return;
  }
  return _sync21.call(this, dt, localTeam, viewer);
};
const _gupdate21 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate21(dt); if (this.running) Ragdoll.step(dt); };
const _fxExplosion21 = FX.explosion.bind(FX);
FX.explosion = function (p) { _fxExplosion21(p); Ragdoll.blast(p); };
const _gstop21 = Game.stop.bind(Game);
Game.stop = function () { Ragdoll.clearAll(); return _gstop21(); };
