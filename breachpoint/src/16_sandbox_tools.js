/* ═══════════════════════════════════════════════════════════════════════════
   More sandbox: elastic bands, motor wheels (build cars), hoverballs, lamps,
   effect emitters, fire, a duplicator that copies whole welded builds,
   physical properties (heavy / light / bouncy / ice / zero-g), trails, and
   medkits plus health / armor / ammo stations.
   Layered on the core sandbox by wrapping its action/event/tool handlers.
   ═══════════════════════════════════════════════════════════════════════════ */

Object.assign(PROPS, {
  medkit:   { name: 'Medkit', cat: 'Entities', shapes: [B3(0.16, 0.08, 0.12)], mass: 2, mat: 'plastic', color: '#f0f0f0', use: 'med', parts: 'cross' },
  hstation: { name: 'Health station', cat: 'Entities', shapes: [B3(0.3, 0.6, 0.2)], mass: 120, mat: 'metal', color: '#dfe8df', use: 'hstation', parts: 'station', glow: '#3aff6a' },
  astation: { name: 'Armor station', cat: 'Entities', shapes: [B3(0.3, 0.6, 0.2)], mass: 120, mat: 'metal', color: '#dfe4ec', use: 'astation', parts: 'station', glow: '#3a9aff' },
  mstation: { name: 'Ammo station', cat: 'Entities', shapes: [B3(0.3, 0.6, 0.2)], mass: 120, mat: 'metal', color: '#ece6dc', use: 'mstation', parts: 'station', glow: '#ffb03a' },
  wheel:    { name: 'Wheel', cat: 'Hidden', shapes: [{ t: 'cyl', r: 0.4, h: 0.2 }], mass: 15, mat: 'rubber', color: '#1a1a1a', wheel: true, parts: 'wheel' },
});
for (const k in PROPS) { const d = PROPS[k]; if (d.radius) continue; d.id = k; let r = 0; for (const s of d.shapes) { const o = s.off || [0, 0, 0], ext = s.t === 'sphere' ? s.r : s.t === 'cyl' ? Math.hypot(s.r, s.h / 2) : Math.hypot(...s.h); r = Math.max(r, Math.hypot(...o) + ext); } d.radius = r; }

Object.assign(TOOLS, {
  elastic:    { name: 'Elastic', lmb: 'click two points for a stretchy band', rmb: 'stiff band', opts: ['slack'] },
  wheel:      { name: 'Wheel', lmb: 'attach a wheel (hold U forward, J back)', rmb: 'attach a reversed wheel', opts: ['wspeed'] },
  hoverball:  { name: 'Hoverball', lmb: 'make it hover at this height', rmb: 'remove hovering' },
  lamp:       { name: 'Lamp', lmb: 'stick a spotlight here (L toggles)', rmb: 'remove its lamps', opts: ['color'] },
  emitter:    { name: 'Emitter', lmb: 'stick an effect emitter here (O toggles)', rmb: 'remove its emitters', opts: ['effect'] },
  ignite:     { name: 'Ignite', lmb: 'set it on fire', rmb: 'put it out' },
  duplicator: { name: 'Duplicator', lmb: 'paste a copy', rmb: 'copy what you aim at (and everything welded to it)' },
  physprop:   { name: 'Physical props', lmb: 'apply', rmb: 'back to normal', opts: ['physprop'] },
  trail:      { name: 'Trail', lmb: 'add a trail', rmb: 'remove the trail', opts: ['color'] },
});
const PHYSPROPS = { normal: 'Normal', heavy: 'Heavy ×5', light: 'Light ×0.2', bouncy: 'Bouncy', ice: 'Ice (no friction)', zerog: 'Zero gravity' };
const EFFECTS = { smoke: 'Smoke', sparks: 'Sparks', fire: 'Fire', confetti: 'Confetti', steam: 'Steam' };
Object.assign(Sandbox.opts, Object.assign({ wspeed: 12, effect: 'sparks', physprop: 'bouncy' }, Store.get('sbx_opts', {})));

/* ── physics materials: friction and bounce multiply between two bodies ── */
const PMATS = {};
function physMat(kind) {
  if (PMATS[kind]) return PMATS[kind];
  const v = { stat: [1, 1], dyn: [0.45, 0.15], bouncy: [0.45, 0.85], ice: [0.02, 0.1], wheel: [1.4, 0.1] }[kind] || [0.45, 0.15];
  return PMATS[kind] = new CANNON.Material({ friction: v[0], restitution: v[1] });
}
const _physInit = Phys.init.bind(Phys);
Phys.init = function () { _physInit(); for (const b of this.world.bodies) b.material = physMat('stat'); };
const _makeBody = Phys.makeBody.bind(Phys);
Phys.makeBody = function (def, scale) { const b = _makeBody(def, scale); b.material = physMat(def.wheel ? 'wheel' : def.bouncy ? 'bouncy' : 'dyn'); return b; };
function applyPhysProp(p) {
  const mode = p.pp || 'normal'; if (!p.body) return;
  const mult = mode === 'heavy' ? 5 : mode === 'light' ? 0.2 : 1;
  p.body.material = physMat(mode === 'bouncy' ? 'bouncy' : mode === 'ice' ? 'ice' : p.def.wheel ? 'wheel' : p.def.bouncy ? 'bouncy' : 'dyn');
  if (!p.frozen) { p.body.mass = p.def.mass * p.scale ** 3 * mult; p.body.updateMassProperties(); }
  p.body.wakeUp();
}
const _setScale = Phys.setScale.bind(Phys);
Phys.setScale = function (p, sc) { _setScale(p, sc); applyPhysProp(p); };
const _setFrozen = Phys.setFrozen.bind(Phys);
Phys.setFrozen = function (p, on) { _setFrozen(p, on); if (!on) applyPhysProp(p); };

/* wheels are hinges with a motor; everything else stays as the core made it */
const _rebuild = Phys.rebuildConstraint.bind(Phys);
Phys.rebuildConstraint = function (c) {
  if (c.type !== 'wheel') return _rebuild(c);
  if (!c.axis || !Game.authority() || !this.world || !c.a || !c.b || !c.a.body || !c.b.body) return;
  const s = c.a.scale;
  c.cn = new CANNON.HingeConstraint(c.a.body, c.b.body, { pivotA: new CANNON.Vec3(c.la[0] * s, c.la[1] * s, c.la[2] * s), axisA: new CANNON.Vec3(...c.axis), pivotB: new CANNON.Vec3(0, -0.12, 0), axisB: new CANNON.Vec3(0, 1, 0), maxForce: 1e6 });
  this.world.addConstraint(c.cn);
};

/* ── attachments on props (visuals built on every machine) ── */
function attachHover(p, h) {
  p.hover = h; if (p.hoverMesh) p.mesh.remove(p.hoverMesh); p.hoverMesh = null; if (!h) return;
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0x6ae0ff })); m.position.set(...h.at); m.userData.keep = true; p.mesh.add(m); p.hoverMesh = m;
}
function attachLamp(p, l) {
  (p.lamps = p.lamps || []).push(l);
  const g = new THREE.Group(); g.add(cyl(0.08, 0.12, lam('#333'), 0, 0, 0, 10)); const lens = cyl(0.07, 0.01, new THREE.MeshBasicMaterial({ color: l.color }), 0, 0, -0.065, 10); g.add(lens);
  const L = new THREE.SpotLight(l.color, 40, 45, 0.45, 0.4, 1.2); L.position.set(0, 0, -0.07); const tgt = new THREE.Object3D(); tgt.position.set(0, 0, -5); g.add(L, tgt); L.target = tgt;
  g.position.set(...l.at); g.quaternion.setFromUnitVectors(new V3(0, 0, -1), new V3(...l.dir)); g.traverse(o => o.userData.keep = true); p.mesh.add(g);
  l.mesh = g; l.light = L; l.lens = lens; L.visible = l.on !== false;
}
function attachEmitter(p, e) { (p.emitters = p.emitters || []).push(e); const m = cyl(0.05, 0.08, lam('#555'), 0, 0, 0, 8); m.position.set(...e.at); m.quaternion.setFromUnitVectors(new V3(0, 0, 1), new V3(...e.dir)); m.userData.keep = true; p.mesh.add(m); e.mesh = m; }
function setTrail(p, color) {
  if (p.trail && p.trail.line) Game.scene.remove(p.trail.line);
  p.trail = null; if (!color) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 3), 3)); g.setDrawRange(0, 0);
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })); line.frustumCulled = false; Game.scene.add(line);
  p.trail = { color, pts: [], line, t: 0 };
}

/* ── actions ── */
const _run = Sandbox.run.bind(Sandbox);
Sandbox.run = function (a) {
  const actor = Game.byId(a.by); if (!actor) return;
  const undo = this.undo[a.by] || (this.undo[a.by] = []);
  switch (a.op) {
    case 'wheel': {
      const p = Phys.byId.get(a.id); if (!p) return;
      const n = new V3(...a.axis).applyQuaternion(p.q), at = Phys.anchor(p, a.at), pos = at.clone().addScaledVector(n, 0.13);
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n), wid = 'e' + (Phys.nextId++), cid = 'c' + (Phys.nextId++);
      this.emit({ e: 'add', id: wid, k: 'wheel', pos: [pos.x, pos.y, pos.z], quat: [q.x, q.y, q.z, q.w], sc: 1, own: a.by });
      this.emit({ e: 'con', id: cid, type: 'wheel', a: p.id, la: a.at, b: wid, lb: [0, 0, 0], len: 0, axis: a.axis, rev: !!a.rev, speed: a.speed, own: a.by });
      undo.push({ kind: 'ent', id: wid }); return;
    }
    case 'dupe': {
      const ids = a.items.map(() => 'e' + (Phys.nextId++)), base = new V3(...a.pos);
      a.items.forEach((it, i) => this.emit({ e: 'add', id: ids[i], k: it.k, pos: [base.x + it.rel[0], base.y + it.rel[1], base.z + it.rel[2]], quat: it.quat, sc: it.sc, col: it.col, mat: it.mat, fr: it.fr, pp: it.pp, own: a.by }));
      for (const w of a.welds || []) this.emit({ e: 'con', id: 'c' + (Phys.nextId++), type: 'weld', a: ids[w[0]], la: w[2], b: ids[w[1]], lb: w[3] });
      undo.push({ kind: 'group', ids }); return;
    }
    case 'hover': { const p = Phys.byId.get(a.id); if (!p) return; this.emit({ e: 'hover', id: a.id, h: a.off ? null : { at: a.at, y: Phys.anchor(p, a.at).y } }); return; }
    case 'lamp': { const p = Phys.byId.get(a.id); if (!p) return; this.emit(a.off ? { e: 'lampdel', id: a.id } : { e: 'lamp', id: a.id, l: { at: a.at, dir: a.dir, color: a.color, own: a.by, on: true } }); return; }
    case 'emitter': { const p = Phys.byId.get(a.id); if (!p) return; this.emit(a.off ? { e: 'emitdel', id: a.id } : { e: 'emit', id: a.id, em: { at: a.at, dir: a.dir, kind: a.kind, own: a.by, on: true } }); return; }
    case 'ignite': { const p = Phys.byId.get(a.id); if (p) this.emit({ e: 'burn', id: a.id, t: a.off ? 0 : 20 }); return; }
    case 'set': if (a.pp || a.trail !== undefined) { const p = Phys.byId.get(a.id); if (!p) return; const ev = { e: 'set2', id: a.id }; if (a.pp) ev.pp = a.pp; if (a.trail !== undefined) ev.trail = a.trail; this.emit(ev); return; } break;
    case 'undo': {
      // a duplicated group undoes as one
      const last = undo[undo.length - 1];
      if (last && last.kind === 'group') { undo.pop(); for (const id of last.ids) this.removeEntity(id); const pr = Net.peerOf(a.by); if (pr) Net.to(pr.id, { t: 'toast', x: 'Undone' }); if (actor === Game.local) HUD.center('Undone', 0.8); return; }
      break;
    }
    case 'key': {
      for (const c of Phys.constraints) if (c.type === 'wheel' && c.own === a.by && c.cn && (a.key === 'KeyU' || a.key === 'KeyJ')) {
        if (a.down) { c.cn.enableMotor(); c.cn.setMotorSpeed((a.key === 'KeyU' ? 1 : -1) * (c.rev ? -1 : 1) * (c.speed || 12)); c.cn.motorEquation.maxForce = 400; c.a.body.wakeUp(); c.b.body.wakeUp(); }
        else c.cn.disableMotor();
      }
      if (a.down && (a.key === 'KeyL' || a.key === 'KeyO')) { this.emit({ e: 'toggle', by: a.by, key: a.key }); return; }
      if (a.key === 'KeyU' || a.key === 'KeyJ') return;
      break;
    }
  }
  return _run(a);
};
Sandbox.exists = (function (orig) { return function (u) { return u.kind === 'group' ? u.ids.some(id => Phys.byId.has(id)) : orig.call(this, u); }; })(Sandbox.exists);

/* ── events ── */
const _apply = Sandbox.apply.bind(Sandbox);
Sandbox.apply = function (ev) {
  switch (ev.e) {
    case 'add': {
      _apply(ev); const p = Phys.byId.get(ev.id); if (!p) return;
      if (ev.pp) { p.pp = ev.pp; applyPhysProp(p); }
      if (ev.hov) attachHover(p, ev.hov);
      if (ev.lamps) ev.lamps.forEach(l => attachLamp(p, Object.assign({}, l)));
      if (ev.emits) ev.emits.forEach(e => attachEmitter(p, Object.assign({}, e)));
      if (ev.trail) setTrail(p, ev.trail);
      if (ev.burn) p.burnT = ev.burn;
      if (p.def.parts === 'station') { const pan = bx(0.4, 0.3, 0.02, new THREE.MeshBasicMaterial({ color: p.def.glow }), 0, 0.25, -0.21); pan.userData.keep = true; p.mesh.add(pan); }
      if (p.def.parts === 'wheel') { const hub = cyl(0.15, 0.22, lam('#888'), 0, 0, 0, 10); hub.rotation.x = 0; hub.userData.keep = true; p.mesh.add(hub); }
      return;
    }
    case 'con': {
      _apply(ev); const c = Phys.constraints.find(x => x.id === ev.id);
      if (c && ev.type === 'wheel') { c.axis = ev.axis; c.rev = ev.rev; c.speed = ev.speed; c.own = ev.own; if (c.cn) Phys.world.removeConstraint(c.cn); c.cn = null; Phys.rebuildConstraint(c); }
      if (c && ev.type === 'elastic' && c.line) c.line.material.color.set(0xffd23a);
      return;
    }
    case 'hover': { const p = Phys.byId.get(ev.id); if (p) attachHover(p, ev.h); return; }
    case 'lamp': { const p = Phys.byId.get(ev.id); if (p) attachLamp(p, ev.l); return; }
    case 'lampdel': { const p = Phys.byId.get(ev.id); if (p && p.lamps) { p.lamps.forEach(l => p.mesh.remove(l.mesh)); p.lamps = null; } return; }
    case 'emit': { const p = Phys.byId.get(ev.id); if (p) attachEmitter(p, ev.em); return; }
    case 'emitdel': { const p = Phys.byId.get(ev.id); if (p && p.emitters) { p.emitters.forEach(e => p.mesh.remove(e.mesh)); p.emitters = null; } return; }
    case 'burn': { const p = Phys.byId.get(ev.id); if (p) p.burnT = ev.t; return; }
    case 'set2': { const p = Phys.byId.get(ev.id); if (!p) return; if (ev.pp) { p.pp = ev.pp === 'reset' ? null : ev.pp; applyPhysProp(p); } if (ev.trail !== undefined) setTrail(p, ev.trail); return; }
    case 'toggle': {
      for (const p of Phys.props) {
        if (ev.key === 'KeyL' && p.lamps) for (const l of p.lamps) if (l.own === ev.by) { l.on = !l.on; l.light.visible = l.on; l.lens.material.color.set(l.on ? l.color : '#222'); }
        if (ev.key === 'KeyO' && p.emitters) for (const e of p.emitters) if (e.own === ev.by) e.on = !e.on;
      }
      return;
    }
    case 'del': { const p = Phys.byId.get(ev.id); if (p && p.trail) setTrail(p, null); return _apply(ev); }
  }
  return _apply(ev);
};
/* late joiners get every attachment too */
const _snapAll = Sandbox.snapshotAll.bind(Sandbox);
Sandbox.snapshotAll = function () {
  const st = _snapAll();
  st.props.forEach(ev => {
    const p = Phys.byId.get(ev.id); if (!p) return;
    if (p.pp) ev.pp = p.pp; if (p.hover) ev.hov = p.hover; if (p.trail) ev.trail = p.trail.color; if (p.burnT > 0) ev.burn = p.burnT;
    if (p.lamps) ev.lamps = p.lamps.map(l => ({ at: l.at, dir: l.dir, color: l.color, own: l.own, on: l.on }));
    if (p.emitters) ev.emits = p.emitters.map(e => ({ at: e.at, dir: e.dir, kind: e.kind, own: e.own, on: e.on }));
  });
  st.cons.forEach(ev => { const c = Phys.constraints.find(x => x.id === ev.id); if (c && c.type === 'wheel') Object.assign(ev, { axis: c.axis, rev: c.rev, speed: c.speed, own: c.own }); });
  return st;
};

/* ── physics extras: elastic bands, hoverballs, zero-g, fire ── */
Phys.forceHooks.push(function () {
  const P = Phys;
  {
    for (const c of P.constraints) {
      if (c.type !== 'elastic') continue;
      const A = P.anchor(c.a, c.la), B = P.anchor(c.b, c.lb), d = B.clone().sub(A), L = d.length(); if (L < 0.001) continue;
      d.multiplyScalar(1 / L); const k = 30 * (L - c.len);
      for (const [p, at, s] of [[c.a, A, 1], [c.b, B, -1]]) { if (!p || !p.body || p.frozen) continue; const m = p.body.mass; p.body.applyForce(new CANNON.Vec3(d.x * k * m * s, d.y * k * m * s, d.z * k * m * s), Phys.rel(p.body, at)); p.body.velocity.scale(0.99, p.body.velocity); p.body.wakeUp(); }
    }
    for (const p of P.props) {
      if (!p.body || p.frozen) continue;
      if (p.pp === 'zerog') { p.body.applyForce(new CANNON.Vec3(0, -P.gravity * p.body.mass, 0)); }
      if (p.hover) {
        const A = P.anchor(p, p.hover.at), err = p.hover.y - A.y, vy = p.body.velocity.y, m = p.body.mass;
        p.body.applyForce(new CANNON.Vec3(0, m * clamp(-P.gravity + 40 * err - 9 * vy, -60, 90), 0), Phys.rel(p.body, A));
        p.body.angularVelocity.scale(0.97, p.body.angularVelocity); p.body.velocity.x *= 0.995; p.body.velocity.z *= 0.995; p.body.wakeUp();
      }
    }
  }
});

/* ── per-frame: pickups, stations, fire, emitters, trails ── */
const _sbxUpdate = Sandbox.update.bind(Sandbox);
Sandbox.update = function (dt) {
  _sbxUpdate(dt);
  if (!this.on) return;
  const auth = Game.authority();
  this.tickT = (this.tickT || 0) - dt; const tick = this.tickT <= 0; if (tick) this.tickT = 0.5;
  for (const p of Phys.props.slice()) {
    const u = p.def.use, c = new V3(p.x, p.y, p.z);
    if (auth && (u === 'med' || u === 'hstation' || u === 'astation' || u === 'mstation')) {
      for (const s of Game.soldiers) {
        if (!s.alive || s.npc || dist3(new V3(s.pos.x, s.pos.y + 0.5, s.pos.z), c) > (u === 'med' ? 1.2 : 1.6)) continue;
        if (u === 'med') { if (s.meds < 3) { s.meds++; if (s.ctrl === 'remote') { const pr = Net.peerOf(s.id); if (pr) Net.to(pr.id, { t: 'give', item: 'medkit', m: s.money, ar: s.armor, hm: s.helmet, kit: s.kit }); } else HUD.center('Medkit +1 (H to use)', 1); this.removeEntity(p.id); } break; }
        if (u === 'hstation') s.hp = Math.min(100, s.hp + 15 * dt);
        if (u === 'astation') { s.armor = Math.min(100, s.armor + 30 * dt); if (s.armor >= 100) s.helmet = true; }
        if (u === 'mstation' && tick) { if (s.ctrl === 'local') this.refill(s); else { const pr = Net.peerOf(s.id); if (pr) Net.to(pr.id, { t: 'ev', e: { t: 'ammo', s: s.id } }); } }
      }
    }
    if (p.burnT > 0) {
      p.burnT -= dt; FX.emit('add', p.x + rand(-0.3, 0.3), p.y + p.def.radius * p.scale * 0.5, p.z + rand(-0.3, 0.3), 3, 2, [1, 0.5 + Math.random() * 0.3, 0.1], 0.5, 3, 0.4);
      if (Math.random() < 0.3) FX.emit('big', p.x, p.y + 0.5, p.z, 1, 1, [0.15, 0.14, 0.13], 1.5, 1.5, 0.3);
      if (auth && tick) {
        for (const s of Game.soldiers) if (s.alive && dist3(new V3(s.pos.x, s.pos.y + 0.8, s.pos.z), c) < 1 + p.def.radius * p.scale) Game.damage(s, 5, null, 'fire', 'chest');
        if (p.def.explosive && p.burnT < 17) Phys.damage(p, 999, null);
        for (const q of Phys.props) if (q !== p && !(q.burnT > 0) && q.mat !== 'metal' && (q.def.mat === 'wood' || q.def.mat === 'crate' || q.mat === 'wood') && dist3(new V3(q.x, q.y, q.z), c) < 1.2 + p.def.radius && Math.random() < 0.05) this.emit({ e: 'burn', id: q.id, t: 20 });
      }
    }
    if (p.emitters) for (const e of p.emitters) {
      if (!e.on) continue; const w = new V3(); e.mesh.getWorldPosition(w); const d = new V3(...e.dir).applyQuaternion(p.q);
      if (e.kind === 'smoke') FX.emit('big', w.x, w.y, w.z, 1, 2, [0.55, 0.55, 0.55], 2, 1.2, 0.3, d.multiplyScalar(2));
      else if (e.kind === 'steam') FX.emit('big', w.x, w.y, w.z, 1, 3, [0.9, 0.9, 0.92], 1, 2, 0.2, d.multiplyScalar(3));
      else if (e.kind === 'fire') { FX.emit('add', w.x, w.y, w.z, 3, 3, [1, 0.5, 0.1], 0.4, 4, 0.3, d.multiplyScalar(3)); }
      else if (e.kind === 'confetti') FX.emit('norm', w.x, w.y, w.z, 2, 5, [Math.random(), Math.random(), Math.random()], 1.5, -4, 0.6, d.multiplyScalar(5));
      else FX.emit('add', w.x, w.y, w.z, 3, 7, [1, 0.8, 0.3], 0.4, -12, 0.7, d.multiplyScalar(6));
    }
    if (p.trail) {
      const T = p.trail; T.t -= dt;
      if (T.t <= 0) { T.t = 0.04; T.pts.push(p.x, p.y, p.z); if (T.pts.length > 240) T.pts.splice(0, 3); const a = T.line.geometry.attributes.position.array; a.set(T.pts); T.line.geometry.setDrawRange(0, T.pts.length / 3); T.line.geometry.attributes.position.needsUpdate = true; }
    }
  }
  // a hoverball you're carrying floats at the new height when you let go
  for (const by in this.hold) { const h = this.hold[by], p = h.id && Phys.byId.get(h.id); if (p && p.hover) p.hover.y = Phys.anchor(p, p.hover.at).y; }
};

/* ── tool gun handlers for the new tools ── */
const _useTool = Sandbox.useTool.bind(Sandbox);
Sandbox.useTool = function (s, dt) {
  const I = Input, tool = this.opts.tool;
  if (s.cur !== 'toolgun' || !TOOLS[tool] || !['elastic', 'wheel', 'hoverball', 'lamp', 'emitter', 'ignite', 'duplicator', 'physprop', 'trail'].includes(tool)) return _useTool(s, dt);
  if (!(I.mouse.leftPressed || I.mouse.rightPressed || I.hit('KeyR'))) return;
  if (I.hit('KeyR')) { this.pick = null; HUD.center(TOOLS[tool].name + ' reset', 0.6); return; }
  const tr = this.trace(s), rmb = I.mouse.rightPressed, prop = tr.kind === 'prop' ? tr.prop : null;
  this.toolFx(s, tr);
  const local = prop ? Phys.worldToLocal(prop, tr.p) : [tr.p.x, tr.p.y, tr.p.z];
  const nLocal = prop ? tr.n.clone().applyQuaternion(prop.q.clone().invert()) : tr.n.clone();
  switch (tool) {
    case 'elastic':
      if (!this.pick) { this.pick = { id: prop ? prop.id : null, l: local, w: tr.p.clone(), tight: rmb }; HUD.center('Elastic: click the other end', 1); }
      else { this.exec({ op: 'con', type: 'elastic', a: this.pick.id, la: this.pick.l, b: prop ? prop.id : null, lb: local, len: this.pick.w.distanceTo(tr.p) * (this.pick.tight ? 0.4 : 0.9) }); this.pick = null; HUD.center('Elastic band', 0.6); }
      break;
    case 'wheel': if (prop) { this.exec({ op: 'wheel', id: prop.id, at: local, axis: [nLocal.x, nLocal.y, nLocal.z], rev: rmb, speed: this.opts.wspeed }); HUD.center('Wheel: hold U / J', 0.8); } break;
    case 'hoverball': if (prop) { this.exec({ op: 'hover', id: prop.id, at: local, off: rmb }); HUD.center(rmb ? 'Hover off' : 'Hovering', 0.6); } break;
    case 'lamp': if (prop) { this.exec({ op: 'lamp', id: prop.id, at: local, dir: [nLocal.x, nLocal.y, nLocal.z], color: this.opts.color, off: rmb }); if (!rmb) HUD.center('Lamp: L toggles', 0.8); } break;
    case 'emitter': if (prop) { this.exec({ op: 'emitter', id: prop.id, at: local, dir: [nLocal.x, nLocal.y, nLocal.z], kind: this.opts.effect, off: rmb }); if (!rmb) HUD.center('Emitter: O toggles', 0.8); } break;
    case 'ignite': if (prop) this.exec({ op: 'ignite', id: prop.id, off: rmb }); break;
    case 'physprop': if (prop) { this.exec({ op: 'set', id: prop.id, pp: rmb ? 'reset' : this.opts.physprop }); HUD.center(rmb ? 'Normal' : PHYSPROPS[this.opts.physprop], 0.6); } break;
    case 'trail': if (prop) this.exec({ op: 'set', id: prop.id, trail: rmb ? null : this.opts.color }); break;
    case 'duplicator':
      if (rmb) { if (prop) { this.clip = copyGroup(prop); HUD.center(`Copied ${this.clip.items.length} prop${this.clip.items.length > 1 ? 's' : ''}`, 1); } }
      else if (this.clip && tr.kind !== 'none') { const p = tr.p.clone().addScaledVector(tr.n, this.clip.lift); this.exec({ op: 'dupe', items: this.clip.items, welds: this.clip.welds, pos: [p.x, p.y, p.z] }); }
      else if (!this.clip) HUD.center('Right-click something to copy it first', 1);
      break;
  }
};
/* everything welded to a prop, with positions relative to it */
function copyGroup(root) {
  const seen = new Map([[root, 0]]), list = [root];
  for (let i = 0; i < list.length; i++) for (const c of Phys.constraints) if (c.type === 'weld') { const o = c.a === list[i] ? c.b : c.b === list[i] ? c.a : null; if (o && !seen.has(o)) { seen.set(o, list.length); list.push(o); } }
  let minY = Infinity; for (const p of list) minY = Math.min(minY, Phys.aabb(p).y0);
  const items = list.map(p => ({ k: p.def.id, rel: [p.x - root.x, p.y - root.y, p.z - root.z], quat: [p.q.x, p.q.y, p.q.z, p.q.w], sc: p.scale, col: p.color, mat: p.mat, fr: p.frozen, pp: p.pp }));
  const welds = Phys.constraints.filter(c => c.type === 'weld' && seen.has(c.a) && seen.has(c.b)).map(c => [seen.get(c.a), seen.get(c.b), c.la, c.lb]);
  return { items, welds, lift: root.y - minY + 0.05 };
}
/* the core 'prop' action learns to carry paint, material, scale and physics */
Sandbox.onKey = (function (orig) { return function (code, down) { if (['KeyU', 'KeyJ', 'KeyL', 'KeyO'].includes(code)) { if (!this.on || !Game.local) return; if (!!this.keysDown[code] === down) return; this.keysDown[code] = down; this.exec({ op: 'key', key: code, down }); return; } return orig.call(this, code, down); }; })(Sandbox.onKey);
