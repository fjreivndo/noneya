/* ═══════════════════════════════════════════════════════════════════════════
   More wiring.
   Inputs   keypad (code lock), key input, laser tripwire, damage sensor,
            prop sensor, toggle button, random.
   Logic    NAND, NOR, pulse, set/reset latch.
   Numbers  counter, constant, adder, comparator, number display, text screen.
            Parts pass numbers along wires; anything non-zero counts as on.
   Outputs  turret, speaker, forcefield, lift, spawner, thumper.
   Tools    wire colours, show wires only with the tool gun, and a debugger
            that reads out any part you aim at.
   Parts with two kinds of input (latch, counter, comparator) take wires on
   their left half as the first input and on the right half as the second.
   ═══════════════════════════════════════════════════════════════════════════ */

const WG = (grp, o) => Object.assign({ cat: 'Wiring', grp, mass: 2, mat: 'plastic', flush: true }, o);
const CHIP2 = (grp, name, label, color, logic, extra) => WG(grp, Object.assign({ name, shapes: [B3(0.13, 0.025, 0.13)], color: '#24272c', parts: 'chip', label, chip: color, logic }, extra || {}));
Object.assign(PROPS, {
  keypad:     WG('Inputs', { name: 'Keypad', shapes: [B3(0.1, 0.02, 0.14)], color: '#2a2e34', parts: 'keypad', logic: 'keypad', usable: true, ask: true, desc: 'On for 2 s when the right code is typed. E sets the code the first time' }),
  keyin:      WG('Inputs', { name: 'Key input', shapes: [B3(0.1, 0.025, 0.1)], color: '#2a3a4a', parts: 'chip', label: 'KEY', chip: '#3a6a9a', logic: 'keyin', usable: true, ask: true, desc: 'On while its owner holds the bound key. E binds a key' }),
  laser:      WG('Inputs', { name: 'Laser tripwire', shapes: [B3(0.06, 0.04, 0.06)], color: '#2a2a2a', parts: 'laser', logic: 'laser', desc: 'Shoots a beam out of its face; on while someone breaks it' }),
  dmgsensor:  WG('Inputs', { name: 'Damage sensor', shapes: [B3(0.08, 0.03, 0.08)], color: '#4a2a2a', parts: 'chip', label: 'HIT', chip: '#aa3a3a', logic: 'dmgsensor', desc: 'On for 1 s when it, or anything welded to it, is shot' }),
  propsensor: WG('Inputs', { name: 'Prop sensor', shapes: [B3(0.08, 0.04, 0.08)], color: '#2a3a2a', parts: 'sensor', logic: 'propsensor', desc: 'On while a prop is within 2.5 m' }),
  togglebtn:  WG('Inputs', { name: 'Toggle button', shapes: [B3(0.11, 0.025, 0.11)], color: '#3a3e44', parts: 'button', logic: 'switch', usable: true, desc: 'Stays on until pressed again' }),
  randomchip: CHIP2('Inputs', 'Random', 'RND', '#7a7a2a', 'random', { usable: true, desc: 'Randomly on or off every second. E changes the speed' }),
  g_nand:     CHIP2('Logic', 'NAND gate', 'NAND', '#3a7a4a', 'nand', { desc: 'Off only when every input is on' }),
  g_nor:      CHIP2('Logic', 'NOR gate', 'NOR', '#3a6a7a', 'nor', { desc: 'On only when no input is on' }),
  pulse:      CHIP2('Logic', 'Pulse', 'PLS', '#8a6a2a', 'pulse', { desc: 'A 0.3 s blip each time its input turns on' }),
  srlatch:    CHIP2('Logic', 'Set/reset latch', 'S | R', '#6a3a8a', 'sr', { desc: 'Wire the left half to set, the right half to reset' }),
  counter:    CHIP2('Numbers', 'Counter', '+ | 0', '#2a5a8a', 'counter', { usable: true, num: true, desc: 'Left half counts up, right half resets. E resets' }),
  constant:   CHIP2('Numbers', 'Constant', 'VAL', '#2a7a7a', 'const', { usable: true, ask: true, num: true, desc: 'Outputs a number. E sets it' }),
  adder:      CHIP2('Numbers', 'Adder', 'SUM', '#4a6a2a', 'adder', { num: true, desc: 'Adds up its inputs' }),
  cmp:        CHIP2('Numbers', 'Comparator', 'A≥B', '#7a4a2a', 'cmp', { usable: true, ask: true, desc: 'On when left ≥ right. No right wires: compares to a value you set with E' }),
  numdisplay: WG('Numbers', { name: 'Number display', shapes: [B3(0.3, 0.02, 0.18)], color: '#111', parts: 'screen', logic: 'numdisp', num: true, mass: 4, desc: 'Shows the number coming in' }),
  textscreen: WG('Numbers', { name: 'Text screen', shapes: [B3(0.5, 0.02, 0.28)], color: '#111', parts: 'screen', logic: 'text', usable: true, ask: true, mass: 6, desc: 'Shows your text while powered (always, if not wired). E edits' }),
  turret:     WG('Outputs', { name: 'Turret', shapes: [B3(0.12, 0.05, 0.12)], color: '#3a3a3a', parts: 'turret', mass: 12, desc: 'Fires out of its barrel while powered' }),
  speaker:    WG('Outputs', { name: 'Speaker', shapes: [B3(0.1, 0.04, 0.1)], color: '#2a2a2a', parts: 'speaker', usable: true, desc: 'Plays a sound each time it turns on. E picks the sound' }),
  forcefield: { name: 'Forcefield', cat: 'Wiring', grp: 'Outputs', shapes: [B3(1, 1.1, 0.03)], mass: 20, mat: 'glass', color: '#5ad8ff', field: true, upright: true, usable: true, desc: 'A wall that blocks everything while on. E or wire' },
  lift:       { name: 'Lift', cat: 'Wiring', grp: 'Outputs', shapes: [B3(1, 0.05, 1)], mass: 80, mat: 'metal', color: '#6a7078', door: 'piston', travel: 2.6, usable: true, desc: 'A platform that rises 2.6 m. E or wire' },
  spawner:    WG('Outputs', { name: 'Spawner', shapes: [B3(0.25, 0.03, 0.25)], color: '#2a2e34', parts: 'spawner', usable: true, desc: 'Spawns something above it each time it turns on. E picks what' }),
  thumper:    WG('Outputs', { name: 'Thumper', shapes: [{ t: 'cyl', r: 0.3, h: 0.12 }], color: '#4a4a3a', parts: 'thumper', mass: 40, desc: 'Pounds the ground while powered: shakes and knocks props' }),
});
for (const k of ['button', 'switch', 'plate', 'sensor', 'timer']) PROPS[k].grp = 'Inputs';
for (const k of ['g_and', 'g_or', 'g_not', 'g_xor', 'delay', 'flipflop']) PROPS[k].grp = 'Logic';
PROPS.alarm.grp = 'Outputs';
for (const k in PROPS) { const d = PROPS[k]; d.id = k; let r = 0; for (const s of d.shapes) { const o = s.off || [0, 0, 0], ext = s.t === 'sphere' ? s.r : s.t === 'cyl' ? Math.hypot(s.r, s.h / 2) : Math.hypot(...s.h); r = Math.max(r, Math.hypot(...o) + ext); } d.radius = r; }
const SPEAKER_SOUNDS = ['beep', 'capture', 'win', 'reveal', 'rare', 'pin', 'kill', 'explode'];
const SPAWN_KINDS = ['crate', 'barrel', 'ball', 'melon', 'barrel_ex', 'tire', 'zombie', 'citizen'];
const RESERVED_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'KeyC', 'KeyE', 'KeyQ', 'KeyR', 'KeyZ', 'KeyV', 'KeyH', 'KeyG', 'KeyF', 'KeyX', 'Tab', 'Enter', 'Escape', 'KeyY', 'KeyB'].concat([1, 2, 3, 4, 5, 6, 7].map(n => 'Digit' + n));
const keyName = c => !c ? '—' : c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ').replace(/^Arrow/, '');

Object.assign(TOOLS, { debugger: { name: 'Debugger', lmb: 'read out the part you aim at', rmb: 'read out every part wired into it' } });
Object.assign(Sandbox.opts, Object.assign({ wireColor: '', showWires: 'always' }, Store.get('sbx_opts', {})));
Sandbox.heldKeys = {}; Sandbox.kin = {};

/* ── logic for the new parts ───────────────────────────────────────────── */
const inVal = x => x.num !== undefined ? x.num : (x.sig ? 1 : 0);
const sideAny = (W, left) => !!W && W.some(w => w.left === left && w.p.sig);
const sideSum = (W, left) => W ? W.filter(w => w.left === left).reduce((a, w) => a + inVal(w.p), 0) : 0;
Object.assign(Wiring.extra, {
  keypad: (p, o) => ({ v: o.now < (p.openT || 0) }),
  keyin: p => ({ v: !!(p.cfg && p.cfg.key && Sandbox.heldKeys[p.own] && Sandbox.heldKeys[p.own][p.cfg.key]) }),
  laser: p => ({ v: !!p.tripped }),
  dmgsensor: (p, o) => ({ v: o.now - (p.hitT == null ? -9 : p.hitT) < 1 }),
  propsensor: p => { for (const q of Phys.props) if (q !== p && q.def.cat !== 'Wiring' && q.def.cat !== 'Lights' && dist3(new V3(q.x, q.y, q.z), new V3(p.x, p.y, p.z)) < 2.5 + q.def.radius * q.scale * 0.5) return { v: true }; return { v: false }; },
  random: (p, o) => { const per = p.period || 1, k = Math.floor(o.now / per); if (k !== p.rk) { p.rk = k; p.rv = Math.random() < 0.5; } return { v: !!p.rv }; },
  nand: (p, o) => ({ v: !(o.L && o.on === o.L.length) }),
  nor: (p, o) => ({ v: !o.any }),
  pulse: (p, o) => { if (o.any && !p.plLast) p.plT = o.now + 0.3; p.plLast = o.any; return { v: o.now < (p.plT || 0) }; },
  sr: (p, o) => { const S = sideAny(o.W, true), R = sideAny(o.W, false); if (S && !p.sLast) p.latch = true; if (R && !p.rLast) p.latch = false; p.sLast = S; p.rLast = R; return { v: !!p.latch }; },
  counter: (p, o) => { const A = sideAny(o.W, true), R = sideAny(o.W, false); if (A && !p.cLast) p.count = (p.count || 0) + 1; if (R && !p.crLast) p.count = 0; p.cLast = A; p.crLast = R; const n = p.count || 0; return { v: n !== 0, n }; },
  const: p => { const n = +(p.cfg && p.cfg.val) || 0; return { v: n !== 0, n }; },
  adder: (p, o) => { const n = o.W ? o.W.reduce((a, w) => a + inVal(w.p), 0) : 0; return { v: n !== 0, n }; },
  cmp: (p, o) => { if (!o.W || !o.W.some(w => w.left)) return { v: false }; const A = sideSum(o.W, true), B = o.W.some(w => !w.left) ? sideSum(o.W, false) : +(p.cfg && p.cfg.thr) || 0; return { v: A >= B }; },
  numdisp: (p, o) => { const n = o.W ? o.W.reduce((a, w) => a + inVal(w.p), 0) : 0; return { v: n !== 0, n }; },
  text: (p, o) => ({ v: o.L ? o.any : true }),
});

/* ── meshes: screens, keypads, lasers, turrets, speakers, spawners ─────── */
function screenCanvas(g, w, h, face) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = keepAdd(g, new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }))); m.rotation.x = -Math.PI / 2; m.position.y = face + 0.002;
  g.userData.screen = { c, x: c.getContext('2d'), t }; return g.userData.screen;
}
function drawScreen(p) {
  const S = p.mesh.userData.screen; if (!S) return; const { c, x, t } = S, cfg = p.cfg || {};
  x.fillStyle = '#05080a'; x.fillRect(0, 0, c.width, c.height);
  if (p.def.logic === 'numdisp') {
    const n = p.num || 0, txt = Number.isInteger(n) ? String(n) : n.toFixed(2);
    x.fillStyle = '#3aff8a'; x.font = `bold ${Math.min(c.height * 0.8, c.width * 1.6 / Math.max(2, txt.length))}px monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, c.width / 2, c.height / 2 + 4);
  } else {
    const on = p.sig !== false, lines = String(cfg.text || 'Hello!').slice(0, 80).split('|');
    x.fillStyle = on ? '#ffd23a' : '#2a2a22'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const fs = Math.min(c.height / (lines.length + 0.6), c.width * 1.7 / Math.max(6, ...lines.map(l => l.length))); x.font = `bold ${fs}px sans-serif`;
    lines.forEach((l, i) => x.fillText(l.trim(), c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * fs * 1.1));
  }
  t.needsUpdate = true;
}
const _buildPropMesh20 = buildPropMesh;
buildPropMesh = function (def, p = {}) {
  const g = _buildPropMesh20(def, p), u = g.userData, h = def.shapes[0].h;
  switch (def.parts) {
    case 'keypad': { const c = document.createElement('canvas'); c.width = 64; c.height = 88; const x = c.getContext('2d'); x.fillStyle = '#1a1c20'; x.fillRect(0, 0, 64, 88); x.fillStyle = '#9aa0a8'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; '123456789*0#'.split('').forEach((k, i) => { const cx = 12 + (i % 3) * 20, cy = 14 + Math.floor(i / 3) * 20; x.fillStyle = '#3a3e44'; x.fillRect(cx - 8, cy - 8, 16, 16); x.fillStyle = '#e8e8e8'; x.fillText(k, cx, cy + 1); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = keepAdd(g, new THREE.Mesh(new THREE.PlaneGeometry(h[0] * 1.8, h[2] * 1.8), new THREE.MeshBasicMaterial({ map: t }))); m.rotation.x = -Math.PI / 2; m.position.y = h[1] + 0.002; addLed(g, h[0] * 0.85, h[1] + 0.01, -h[2] * 0.95); break; }
    case 'screen': screenCanvas(g, h[0] * 1.9, h[2] * 1.85, h[1]); break;
    case 'laser': { keepAdd(g, vcyl(0.025, 0.04, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), 0, 0.05, 0)); addLed(g, 0.045, 0.045, -0.045); break; }
    case 'turret': { keepAdd(g, vcyl(0.07, 0.12, lam('#2a2a2a'), 0, 0.1, 0)); keepAdd(g, vcyl(0.025, 0.26, lam('#111'), 0, 0.28, 0)); addLed(g, 0.1, 0.055, -0.1); break; }
    case 'speaker': { keepAdd(g, vcyl(0.07, 0.02, lam('#555'), 0, 0.045, 0)); keepAdd(g, vcyl(0.03, 0.025, lam('#111'), 0, 0.055, 0)); addLed(g, 0.08, 0.045, -0.08); break; }
    case 'spawner': { const r = keepAdd(g, new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 24), new THREE.MeshBasicMaterial({ color: 0x3aa0ff, side: THREE.DoubleSide }))); r.rotation.x = -Math.PI / 2; r.position.y = h[1] + 0.003; u.ring = r; addLed(g, 0.22, 0.035, -0.22); break; }
    case 'thumper': { keepAdd(g, vcyl(0.12, 0.5, lam('#6a6a5a'), 0, 0.3, 0)); u.ram = keepAdd(g, vcyl(0.22, 0.12, lam('#3a3a30'), 0, 0.12, 0)); break; }
  }
  if (def.field) { g.children.forEach(o => { if (o.isMesh && !o.userData.keep) { o.material.opacity = 0.35; o.material.emissive && o.material.emissive.set('#1a4a6a'); } }); }
  return g;
};

/* ── forcefields: solid while on, pass-through while off ───────────────── */
function setGhost(p, ghost) {
  p.ghost = ghost; if (p.body) p.body.collisionResponse = !ghost;
  p.mesh.children.forEach(o => { if (o.isMesh && !o.userData.keep && o.material) { o.material.opacity = ghost ? 0.06 : 0.35; } });
}
const _afterStep20 = Phys.afterStep.bind(Phys);
Phys.afterStep = function (dt) { _afterStep20(dt); if (this.dyn.some(b => b.prop && b.prop.ghost)) this.dyn = this.dyn.filter(b => !(b.prop && b.prop.ghost)); };

/* ── signals: what the new outputs do ──────────────────────────────────── */
const _wapply20 = Wiring.apply.bind(Wiring);
Wiring.apply = function (p, v) {
  const was = !!p.sig; _wapply20(p, v);
  const d = p.def, auth = Game.authority();
  if (d.field) setGhost(p, !v);
  if (p.mesh.userData.screen) drawScreen(p);
  if (d.parts === 'speaker' && v && !was) Sfx.play((p.cfg && p.cfg.snd) || 'beep', new V3(p.x, p.y, p.z), { vol: 1.5 });
  if (d.parts === 'spawner' && p.mesh.userData.ring) p.mesh.userData.ring.material.color.set(v ? 0x8ae0ff : 0x3aa0ff);
  if (auth && d.parts === 'spawner' && v && !was) spawnFrom(p);
};
function spawnFrom(p) {
  const kind = (p.cfg && p.cfg.kind) || 'crate', up = Y_AXIS.clone().applyQuaternion(p.q), by = Game.byId(p.own) ? p.own : Game.local && Game.local.id; if (!by) return;
  const pos = new V3(p.x, p.y, p.z).addScaledVector(up, 0.3 + (PROPS[kind] ? PROPS[kind].radius : 0.9));
  p.spawned = (p.spawned || []).filter(id => Phys.byId.has(id) || Game.byId(id));
  if (p.spawned.length >= 20) { const old = p.spawned.shift(); if (Phys.byId.has(old)) Sandbox.removeEntity(old); else if (Game.byId(old)) Sandbox.emit({ e: 'npcdel', id: old }); }
  const before = new Set(Phys.props.map(x => x.id).concat(Game.soldiers.map(s => s.id)));
  if (PROPS[kind]) Sandbox.run({ op: 'prop', by, k: kind, pos: [pos.x, pos.y, pos.z], yaw: rand(0, TAU) });
  else if (NPCS[kind]) Sandbox.run({ op: 'npc', by, k: kind, pos: [pos.x, Math.max(0, pos.y - 0.9), pos.z], yaw: rand(0, TAU) });
  const made = Phys.props.map(x => x.id).concat(Game.soldiers.map(s => s.id)).find(id => !before.has(id)); if (made) p.spawned.push(made);
  Sandbox.emit({ e: 'boom0', p: [pos.x, pos.y, pos.z] });
}

/* ── actions and events ────────────────────────────────────────────────── */
const _run20 = Sandbox.run.bind(Sandbox);
Sandbox.run = function (a) {
  const actor = Game.byId(a.by); if (!actor) return;
  switch (a.op) {
    case 'kin': { if (typeof a.key !== 'string' || a.key.length > 20) return; (this.heldKeys[a.by] = this.heldKeys[a.by] || {})[a.key] = !!a.down; Wiring.tick(); return; }
    case 'wcfg': {
      const p = Phys.byId.get(a.id); if (!p || !a.c) return; const c = {};
      if (a.c.code != null) c.code = String(a.c.code).replace(/\D/g, '').slice(0, 8);
      if (a.c.text != null) c.text = String(a.c.text).slice(0, 80);
      if (a.c.val != null && isFinite(+a.c.val)) c.val = clamp(+a.c.val, -1e6, 1e6);
      if (a.c.thr != null && isFinite(+a.c.thr)) c.thr = clamp(+a.c.thr, -1e6, 1e6);
      if (a.c.key != null && typeof a.c.key === 'string' && a.c.key.length < 20 && !RESERVED_KEYS.includes(a.c.key)) c.key = a.c.key;
      if (!Object.keys(c).length) return;
      this.emit({ e: 'wcfg', id: p.id, c }); Wiring.tick(); return;
    }
    case 'phit': {
      _run20(a); const p = Phys.byId.get(a.id); if (!p) return;
      // damage sensors on the thing that was shot, or welded to it
      const seen = new Set([p]), q = [p];
      while (q.length && seen.size < 60) { const x = q.pop(); if (x.def.logic === 'dmgsensor') x.hitT = Game.now; for (const c of Phys.constraints) if (c.type === 'weld') { const o = c.a === x ? c.b : c.b === x ? c.a : null; if (o && !seen.has(o)) { seen.add(o); q.push(o); } } }
      return;
    }
    case 'use': {
      const p = Phys.byId.get(a.id), d = p && p.def; if (!p || !inReach(actor, p)) return;
      const tell = x => { const pr = Net.peerOf(a.by); if (pr) Net.to(pr.id, { t: 'toast', x }); if (actor === Game.local) HUD.center(x, 1); };
      const cfg = p.cfg || {};
      if (d.logic === 'keypad') {
        if (!cfg.code) { if (a.code) { this.emit({ e: 'wcfg', id: p.id, c: { code: String(a.code).replace(/\D/g, '').slice(0, 8) } }); tell('Code set'); } return; }
        if (String(a.code) === cfg.code) { p.openT = Game.now + 2; this.emit({ e: 'wst', id: p.id, m: p.manual, per: p.period, click: 1 }); tell('Access granted'); }
        else { this.emit({ e: 'boom0', p: [p.x, p.y, p.z], snd: 'empty' }); tell('Wrong code'); }
        Wiring.tick(); return;
      }
      if (d.logic === 'counter') { p.count = 0; Wiring.tick(); tell('Counter reset'); return; }
      if (d.logic === 'random') { const ps = [0.25, 0.5, 1, 2, 4]; p.period = ps[(ps.indexOf(p.period || 1) + 1) % ps.length]; this.emit({ e: 'wst', id: p.id, m: p.manual, per: p.period, click: 1 }); tell(`Random: every ${p.period} s`); return; }
      if (d.parts === 'speaker') { const i = SPEAKER_SOUNDS.indexOf(cfg.snd || 'beep'), snd = SPEAKER_SOUNDS[(i + 1) % SPEAKER_SOUNDS.length]; this.emit({ e: 'wcfg', id: p.id, c: { snd } }); Sfx.play(snd, new V3(p.x, p.y, p.z)); tell('Speaker: ' + snd); return; }
      if (d.parts === 'spawner') { const i = SPAWN_KINDS.indexOf(cfg.kind || 'crate'), kind = SPAWN_KINDS[(i + 1) % SPAWN_KINDS.length]; this.emit({ e: 'wcfg', id: p.id, c: { kind } }); tell('Spawner: ' + (PROPS[kind] ? PROPS[kind].name : NPCS[kind].name)); return; }
      if (d.field) { if (Wiring.wired(p)) { tell('This forcefield is wired to a circuit'); return; } p.manual = p.manual === false; this.emit({ e: 'wst', id: p.id, m: p.manual, per: p.period, click: 1 }); Wiring.tick(); return; }
      break;
    }
  }
  return _run20(a);
};
const _apply20 = Sandbox.apply.bind(Sandbox);
Sandbox.apply = function (ev) {
  switch (ev.e) {
    case 'add': {
      _apply20(ev); const p = Phys.byId.get(ev.id); if (!p) return;
      if (ev.wc) p.cfg = Object.assign({}, ev.wc); if (ev.wn !== undefined) p.num = ev.wn; if (ev.wx) { p.count = ev.wx.count; p.latch = ev.wx.latch; }
      if (p.def.field) setGhost(p, p.sig === false || (p.manual === false && !Wiring.wired(p)));
      if (p.mesh.userData.screen) drawScreen(p);
      return;
    }
    case 'wcfg': { const p = Phys.byId.get(ev.id); if (!p) return; p.cfg = Object.assign(p.cfg || {}, ev.c); if (p.mesh.userData.screen) drawScreen(p); return; }
    case 'boom0': { const q = new V3(...ev.p); if (ev.snd) Sfx.play(ev.snd, q); else { FX.emit('add', q.x, q.y, q.z, 14, 2.5, [0.4, 0.8, 1], 0.4, 0, 0.8); Sfx.play('pin', q); } return; }
  }
  return _apply20(ev);
};
const _snap20 = Sandbox.snapshotAll.bind(Sandbox);
Sandbox.snapshotAll = function () {
  const st = _snap20();
  st.props.forEach(ev => { const p = Phys.byId.get(ev.id); if (!p) return; if (p.cfg) ev.wc = p.cfg; if (p.num !== undefined) ev.wn = p.num; if (p.count || p.latch) ev.wx = { count: p.count, latch: p.latch }; });
  return st;
};

/* ── per frame: lasers, turrets, thumpers, bound keys, wire visibility ─── */
const _update20 = Sandbox.update.bind(Sandbox);
Sandbox.update = function (dt) {
  _update20(dt);
  if (!this.on) return;
  const auth = Game.authority(), L = Game.local, now = Game.now;
  // keys bound by my key-input parts
  if (L) {
    const keys = new Set(); for (const p of Phys.props) if (p.def.logic === 'keyin' && p.own === L.id && p.cfg && p.cfg.key) keys.add(p.cfg.key);
    for (const k of keys) { const d = !UI.blocking() && Input.down(k); if (d !== !!this.kin[k]) { this.kin[k] = d; this.exec({ op: 'kin', key: k, down: d }); } }
  }
  const showW = this.opts.showWires !== 'tool' || (L && L.cur === 'toolgun');
  for (const c of Phys.constraints) if (c.type === 'wire' && c.line) c.line.visible = showW;
  for (const p of Phys.props) {
    const d = p.def;
    if (d.logic === 'laser') {
      const up = Y_AXIS.clone().applyQuaternion(p.q), o = new V3(p.x, p.y, p.z).addScaledVector(up, 0.07);
      let t = World.raycast(o.x, o.y, o.z, up.x, up.y, up.z, 30); if (t < 0) t = 30; const ph = Phys.ray(o, up, t, p); if (ph) t = ph.t;
      if (auth) { const sh = raySoldiers(o, up, t, null, Game.soldiers); if (!!sh !== !!p.tripped) { p.tripped = !!sh; Wiring.tick(); } }
      let beam = p.mesh.userData.beam;
      if (!beam) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); beam = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.8 })); beam.frustumCulled = false; Game.scene.add(beam); p.mesh.userData.beam = beam; }
      const a = beam.geometry.attributes.position.array, e = o.clone().addScaledVector(up, t); a[0] = o.x; a[1] = o.y; a[2] = o.z; a[3] = e.x; a[4] = e.y; a[5] = e.z; beam.geometry.attributes.position.needsUpdate = true;
      beam.material.color.set(p.sig ? 0xffe03a : 0xff2a2a);
    }
    if (d.parts === 'turret' && p.sig) {
      p.fireT = (p.fireT || 0) - dt; if (p.fireT > 0) continue; p.fireT = 0.11;
      const up = Y_AXIS.clone().applyQuaternion(p.q), o = new V3(p.x, p.y, p.z).addScaledVector(up, 0.42), dir = up.clone().add(new V3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.02, 0.02))).normalize();
      let t = World.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, 120); const n = new V3(World.hit.nx, World.hit.ny, World.hit.nz); if (t < 0) t = 120;
      const ph = Phys.ray(o, dir, t, p); if (ph) { t = ph.t; n.copy(ph.n); }
      const sh = raySoldiers(o, dir, t, null, Game.soldiers), end = o.clone().addScaledVector(dir, sh ? sh.t : t);
      FX.tracer(o, end); FX.muzzle(o); Sfx.play('shot', o, { w: WEAPONS.m249 });
      if (sh) { FX.blood(end, dir, 1); if (auth) Game.damage(sh.s, 14, null, 'turret', sh.zone); }
      else if (t < 120) { FX.impact(end, n); if (ph && auth) { Phys.impulse(ph.p, end, dir, 3); Phys.damage(ph.p, 14, null); } }
    }
    if (d.parts === 'thumper') {
      const ram = p.mesh.userData.ram; if (!ram) continue;
      if (p.sig) {
        p.thT = (p.thT || 0) - dt; const ph = clamp(1 - p.thT / 0.9, 0, 1); ram.position.y = 0.12 + Math.sin(ph * Math.PI) * 0.35;
        if (p.thT <= 0) {
          p.thT = 0.9; const c = new V3(p.x, p.y, p.z); Sfx.play('explode', c, { vol: 0.6 }); FX.emit('norm', c.x, c.y, c.z, 20, 4, [0.5, 0.45, 0.38], 0.8, -3, 1);
          if (L && dist3(L.pos, c) < 30) HUD.shake(0.4 * (1 - dist3(L.pos, c) / 30));
          if (auth) Phys.blast(c, 8, 4);
        }
      } else ram.position.y = lerp(ram.position.y, 0.12, 1 - Math.exp(-dt * 6));
    }
  }
};
/* laser beams leave with their part */
const _premove20 = Phys.remove.bind(Phys);
Phys.remove = function (p) { if (p && p.mesh && p.mesh.userData.beam) { const b = p.mesh.userData.beam; if (b.parent) b.parent.remove(b); } return _premove20(p); };
const _pclear20 = Phys.clear.bind(Phys);
Phys.clear = function () { for (const p of this.props) { const b = p.mesh && p.mesh.userData.beam; if (b && b.parent) b.parent.remove(b); } return _pclear20(); };

/* ── E on parts that need typing ───────────────────────────────────────── */
UI.askText = function (title, init, cb, o = {}) {
  let el = $('askbox'); if (!el) { el = document.createElement('div'); el.id = 'askbox'; el.className = 'hidden'; document.body.appendChild(el); }
  el.innerHTML = `<div class="ask-in"><b>${escapeHtml(title)}</b><input id="askIn" maxlength="${o.max || 60}" value="${escapeHtml(init == null ? '' : init)}" autocomplete="off"><small>${o.key ? 'Press the key to bind · Esc cancels' : o.hint || 'Enter to confirm · Esc cancels'}</small></div>`;
  el.classList.remove('hidden'); Input.typing = true; Input.clear(); if (document.pointerLockElement) document.exitPointerLock();
  const inp = $('askIn'); setTimeout(() => { inp.focus(); inp.select(); }, 0);
  const done = val => { el.classList.add('hidden'); inp.onkeydown = null; Input.typing = false; Input.clear(); UI.lock(); if (val != null) cb(val); };
  inp.onkeydown = e => {
    e.stopPropagation();
    if (o.key) { e.preventDefault(); if (e.code === 'Escape') return done(null); if (RESERVED_KEYS.includes(e.code)) { el.querySelector('small').textContent = `${keyName(e.code)} is already used — pick another key`; return; } return done(e.code); }
    if (e.key === 'Enter') done(inp.value); else if (e.key === 'Escape') done(null);
  };
};
const _tryUse20 = Sandbox.tryUse.bind(Sandbox);
Sandbox.tryUse = function (s) {
  const p = this.useTarget(s); if (!p || !p.def.ask) return _tryUse20(s);
  const d = p.def, cfg = p.cfg || {}, set = c => this.exec({ op: 'wcfg', id: p.id, c });
  if (d.logic === 'keypad') UI.askText(cfg.code ? 'Enter the code' : 'Set this keypad\'s code (digits)', '', v => this.exec({ op: 'use', id: p.id, code: v.replace(/\D/g, '') }), { max: 8 });
  else if (d.logic === 'keyin') UI.askText('Key input: press the key it should listen for', '', v => set({ key: v }), { key: true });
  else if (d.logic === 'const') UI.askText('Constant: output value', cfg.val || 0, v => set({ val: v }), { max: 12 });
  else if (d.logic === 'cmp') UI.askText('Comparator: on when left ≥ this (used when nothing is wired to the right half)', cfg.thr || 0, v => set({ thr: v }), { max: 12 });
  else if (d.logic === 'text') UI.askText('Text screen ( | starts a new line)', cfg.text || '', v => set({ text: v }), { max: 80 });
  return true;
};
const _useHint20 = Sandbox.useHint.bind(Sandbox);
Sandbox.useHint = function (s) {
  if (s.cur === 'toolgun' && this.opts.tool === 'debugger') { const tr = this.trace(s, 60); return tr.kind === 'prop' ? 'Debugger: ' + describePart(tr.prop) : 'Debugger: aim at a part'; }
  const p = this.useTarget(s); if (!p) return '';
  const d = p.def, cfg = p.cfg || {};
  switch (d.logic) {
    case 'keypad': return cfg.code ? `E — enter code${p.sig ? ' (open)' : ''}` : 'E — set a code';
    case 'keyin': return `Key input: ${keyName(cfg.key)} · E to rebind`;
    case 'counter': return `Counter: ${p.num || 0} · E resets`;
    case 'const': return `Constant: ${cfg.val || 0} · E to change`;
    case 'cmp': return `Comparator: left ≥ ${Wiring.wired(p) && Phys.constraints.some(c => c.type === 'wire' && c.b === p && c.lb && c.lb[0] >= 0) ? 'right' : cfg.thr || 0} (${p.sig ? 'on' : 'off'}) · E sets the value`;
    case 'text': return 'E — edit the text';
    case 'random': return `Random: every ${p.period || 1} s · E changes`;
  }
  if (d.parts === 'speaker') return `Speaker: ${cfg.snd || 'beep'} · E changes the sound`;
  if (d.parts === 'spawner') return `Spawner: ${(PROPS[cfg.kind || 'crate'] || NPCS[cfg.kind]).name} · E changes`;
  if (d.field) return Wiring.wired(p) ? 'Forcefield — controlled by its wiring' : `E — turn forcefield ${p.sig === false ? 'on' : 'off'}`;
  if (d.door === 'piston') return Wiring.wired(p) ? 'Lift — controlled by its wiring' : `E — ${p.sig ? 'lower' : 'raise'} the lift`;
  return _useHint20(s);
};
/* anything the debugger can say about a part */
function describePart(p) {
  const d = p.def, ins = Phys.constraints.filter(c => c.type === 'wire' && c.b === p), outs = Phys.constraints.filter(c => c.type === 'wire' && c.a === p);
  const bits = [d.name, p.sig ? 'ON' : 'off'];
  if (p.num !== undefined) bits.push('value ' + p.num);
  if (d.logic === 'counter' || d.logic === 'sr' || d.logic === 'cmp') bits.push(`${ins.filter(c => c.lb && c.lb[0] < 0).length} left / ${ins.filter(c => !(c.lb && c.lb[0] < 0)).length} right in`);
  else bits.push(`${ins.length} in`);
  bits.push(`${outs.length} out`);
  if (p.frozen) bits.push('frozen');
  return bits.join(' · ');
}
const _useTool20 = Sandbox.useTool.bind(Sandbox);
Sandbox.useTool = function (s, dt) {
  const I = Input;
  if (s.cur === 'toolgun' && this.opts.tool === 'debugger' && (I.mouse.leftPressed || I.mouse.rightPressed)) {
    const tr = this.trace(s, 60); this.toolFx(s, tr); if (tr.kind !== 'prop') return;
    if (I.mouse.rightPressed) { const ins = Phys.constraints.filter(c => c.type === 'wire' && c.b === tr.prop).map(c => c.a); HUD.center(ins.length ? ins.map(describePart).join('  |  ') : 'Nothing is wired into it', 3); }
    else HUD.center(describePart(tr.prop), 2.5);
    return;
  }
  if (s.cur === 'toolgun' && this.opts.tool === 'wire' && I.mouse.leftPressed && this.pick) {
    // colour the wire we're about to make
    const tr = this.trace(s); if (tr.kind === 'prop' && tr.prop.id !== this.pick.id) { this.toolFx(s, tr); this.exec({ op: 'con', type: 'wire', a: this.pick.id, la: this.pick.l, b: tr.prop.id, lb: Phys.worldToLocal(tr.prop, tr.p), col: this.opts.wireColor || undefined }); this.pick = null; HUD.center('Wired', 0.6); return; }
  }
  return _useTool20(s, dt);
};

/* ── spawn menu: grouped wiring tab, wire tool options ─────────────────── */
UI.wiringHtml = function (tile) {
  const groups = ['Inputs', 'Logic', 'Numbers', 'Outputs'];
  return `<p class="muted sp-note">Place parts where you aim (on a prop they get welded to it). Connect them with the <b>Wire</b> tool: click an output, then what it powers. Latches, counters and comparators take their first input on the <b>left</b> half and the second on the <b>right</b> half. <b>E</b> uses a part; the <b>Debugger</b> tool reads any part out.</p>` +
    groups.map(g => `<h4 class="sp-grp">${g}</h4><div class="sp-grid">${Object.values(PROPS).filter(p => p.cat === 'Wiring' && (p.grp || 'Outputs') === g).map(tile).join('')}</div>`).join('');
};
const _toolExtra20 = UI.toolExtra.bind(UI);
UI.toolExtra = function (O) {
  if (O.tool === 'wire') return _toolExtra20(O) + `<label>Wire colour</label><div class="swatches wirecols"><i data-wc="" class="${!O.wireColor ? 'on' : ''}" title="Signal colours (green on / red off)" style="background:linear-gradient(135deg,#3aff6a 50%,#8a2a2a 50%)"></i>${['#ff4a4a', '#ff9a2a', '#ffe04a', '#5ad04a', '#2ac0ff', '#3a6aff', '#a04aff', '#ff4ad0', '#ffffff'].map(c => `<i data-wc="${c}" style="background:${c}" class="${O.wireColor === c ? 'on' : ''}"></i>`).join('')}</div><p class="muted">A coloured wire glows bright while it carries a signal.</p><label><input type="checkbox" id="optShowW" ${O.showWires === 'tool' ? 'checked' : ''}> Only show wires while holding the tool gun</label>`;
  if (O.tool === 'debugger') return '<p class="muted">Aim at any part to see its state in the hint line: on or off, its number, how many wires go in and out.</p>';
  return _toolExtra20(O);
};
const _bindToolExtra20 = UI.bindToolExtra.bind(UI);
UI.bindToolExtra = function (M, O) {
  _bindToolExtra20(M, O);
  M.querySelectorAll('[data-wc]').forEach(b => b.onclick = e => { e.stopPropagation(); O.wireColor = b.dataset.wc; Sandbox.saveOpts(); this.renderSpawnMenu(); });
  const sw = $('optShowW'); if (sw) sw.onchange = () => { O.showWires = sw.checked ? 'tool' : 'always'; Sandbox.saveOpts(); };
};
