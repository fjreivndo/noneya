/* ═══════════════════════════════════════════════════════════════════════════
   Sandbox, part three:
   · Wiring: buttons, switches, pressure plates, sensors and timers feed
     AND / OR / NOT / XOR gates, delays and toggle latches, which drive
     doors, lights, alarms, thrusters, wheels, lamps, emitters and dynamite.
     The Wire tool connects an output to an input.
   · Doors that work: hinged, sliding and garage doors. E opens them, or
     wire them to a circuit.
   · Lights: bulbs, ceiling panels, neon tubes, floodlights and lanterns,
     switched with E or by wire. A fixed pool of real lights is shared by
     every light in the world, so a hundred bulbs don't stall the renderer.
   · Axis (hinge) and Ball socket constraints, and a Repair tool.
   · Vehicles work with the physics gun (pick up, rotate, throw, freeze) and
     the tool gun (paint, freeze, ignite, copy, repair, remove).
   · Saves: named slots in the browser, plus export / import as a file.
   ═══════════════════════════════════════════════════════════════════════════ */

const Y_AXIS = new V3(0, 1, 0);

/* ── catalog ───────────────────────────────────────────────────────────── */
const CHIP = (name, label, color, logic, extra) => Object.assign({ name, cat: 'Wiring', shapes: [B3(0.13, 0.025, 0.13)], mass: 2, mat: 'plastic', color: '#24272c', parts: 'chip', label, chip: color, logic, flush: true }, extra || {});
Object.assign(PROPS, {
  button:   { name: 'Button', cat: 'Wiring', shapes: [B3(0.11, 0.025, 0.11)], mass: 2, mat: 'plastic', color: '#3a3e44', parts: 'button', logic: 'button', usable: true, flush: true, desc: 'On for 1 s when pressed' },
  switch:   { name: 'Switch', cat: 'Wiring', shapes: [B3(0.09, 0.025, 0.13)], mass: 2, mat: 'plastic', color: '#3a3e44', parts: 'switch', logic: 'switch', usable: true, flush: true, desc: 'Flip it on and off with E' },
  plate:    { name: 'Pressure plate', cat: 'Wiring', shapes: [B3(0.6, 0.03, 0.6)], mass: 30, mat: 'metal', color: '#5a6068', parts: 'plate', logic: 'plate', flush: true, desc: 'On while someone or something is on it' },
  sensor:   { name: 'Proximity sensor', cat: 'Wiring', shapes: [B3(0.08, 0.04, 0.08)], mass: 2, mat: 'plastic', color: '#2a2e34', parts: 'sensor', logic: 'sensor', flush: true, desc: 'On while anyone is within 4 m' },
  timer:    CHIP('Timer', 'CLK', '#2a6adf', 'timer', { usable: true, desc: 'Pulses on and off. E changes the speed' }),
  g_and:    CHIP('AND gate', 'AND', '#2a9a5a', 'and', { desc: 'On when every input is on' }),
  g_or:     CHIP('OR gate', 'OR', '#2a8a9a', 'or', { desc: 'On when any input is on' }),
  g_not:    CHIP('NOT gate', 'NOT', '#9a3a3a', 'not', { desc: 'On when no input is on' }),
  g_xor:    CHIP('XOR gate', 'XOR', '#8a5a2a', 'xor', { desc: 'On when an odd number of inputs are on' }),
  delay:    CHIP('Delay', 'DLY', '#6a4aaa', 'delay', { desc: 'Copies its input 1 s later' }),
  flipflop: CHIP('Toggle latch', 'T-FF', '#aa4a8a', 'flipflop', { desc: 'Flips each time its input turns on. Button + latch = light switch' }),
  alarm:    { name: 'Alarm', cat: 'Wiring', shapes: [{ t: 'cyl', r: 0.1, h: 0.06 }], mass: 2, mat: 'plastic', color: '#2a2a2a', parts: 'alarm', flush: true, desc: 'Flashes and beeps while powered' },
  hdoor:    { name: 'Hinged door', cat: 'Entities', shapes: [B3(0.6, 1.1, 0.04)], mass: 40, mat: 'wood', color: '#9a6a3a', door: 'hinge', parts: 'door', usable: true, desc: 'E to open, or wire it' },
  sdoor:    { name: 'Sliding door', cat: 'Entities', shapes: [B3(0.75, 1.1, 0.05)], mass: 60, mat: 'metal', color: '#7a8088', door: 'slide', parts: 'door', usable: true, desc: 'Slides aside. E or wire' },
  garage:   { name: 'Garage door', cat: 'Entities', shapes: [B3(1.5, 1.2, 0.05)], mass: 120, mat: 'metal', color: '#a8aca8', door: 'lift', parts: 'garage', usable: true, desc: 'Rolls up. E or wire' },
  ceiling:  { name: 'Ceiling light', cat: 'Lights', shapes: [B3(0.35, 0.025, 0.35)], mass: 3, mat: 'glow', color: '#fff4dc', light: { i: 9, d: 20, at: [0, 0.2, 0] }, usable: true, flush: true },
  neon:     { name: 'Neon tube', cat: 'Lights', shapes: [B3(0.025, 0.025, 0.7)], mass: 1, mat: 'glow', color: '#ff3ad8', light: { i: 3, d: 9, at: [0, 0.1, 0] }, usable: true, flush: true },
  flood:    { name: 'Floodlight', cat: 'Lights', shapes: [B3(0.2, 0.02, 0.2, [0, 0.02, 0]), B3(0.025, 0.55, 0.025, [0, 0.6, 0]), B3(0.18, 0.13, 0.08, [0, 1.2, 0])], mass: 15, mat: 'metal', color: '#333333', parts: 'flood', light: { spot: true, i: 70, d: 60, at: [0, 1.2, -0.12], dir: [0, -0.3, -1], angle: 0.55 }, usable: true, flush: true },
  lantern:  { name: 'Lantern', cat: 'Lights', shapes: [{ t: 'cyl', r: 0.09, h: 0.24 }], mass: 2, mat: 'glow', color: '#ffc860', parts: 'lantern', light: { i: 5, d: 12 }, usable: true },
});
Object.assign(PROPS.lightbulb, { cat: 'Lights', usable: true, flush: true });
for (const k in PROPS) { const d = PROPS[k]; d.id = k; let r = 0; for (const s of d.shapes) { const o = s.off || [0, 0, 0], ext = s.t === 'sphere' ? s.r : s.t === 'cyl' ? Math.hypot(s.r, s.h / 2) : Math.hypot(...s.h); r = Math.max(r, Math.hypot(...o) + ext); } d.radius = r; }

Object.assign(TOOLS, {
  wire:   { name: 'Wire', lmb: 'click an output (button, gate…), then what it powers', rmb: 'cut every wire going into what you aim at' },
  hinge:  { name: 'Axis', lmb: 'click a prop where it should pivot, then the other prop or the world', rmb: 'cancel' },
  ball:   { name: 'Ball socket', lmb: 'click a prop, then the other prop or the world: they pivot freely there', rmb: 'cancel' },
  repair: { name: 'Repair', lmb: 'repair a vehicle', rmb: 'repair every vehicle near you' },
});
TOOLS.light = { name: 'Light', lmb: 'place the chosen light (welded if you aim at a prop)', rmb: 'switch the light you aim at on or off', opts: ['lightkind', 'color', 'bright'] };
Object.assign(Sandbox.opts, Object.assign({ lightKind: 'lightbulb', bright: 1 }, Store.get('sbx_opts', {})));
const LIGHT_KINDS = { lightbulb: 'Bulb', ceiling: 'Ceiling panel', neon: 'Neon tube', flood: 'Floodlight', lantern: 'Lantern' };

/* ── light pool ────────────────────────────────────────────────────────── */
/* Real lights are expensive and every change in how many exist recompiles
   shaders. So the world keeps a few, and each frame hands them to the
   nearest switched-on lights. The count only ever steps between a handful
   of sizes. */
const LightPool = {
  pts: [], spots: [], scene: null, STEP_P: [0, 2, 4, 8], STEP_S: [0, 1, 2, 4],
  init(scene) {
    this.clear(); this.scene = scene;
    for (let i = 0; i < 8; i++) { const L = new THREE.PointLight(0xffffff, 0, 10); L.visible = false; scene.add(L); this.pts.push(L); }
    for (let i = 0; i < 4; i++) { const L = new THREE.SpotLight(0xffffff, 0, 40, 0.5, 0.45, 1.2); L.visible = false; scene.add(L); scene.add(L.target); this.spots.push(L); }
  },
  clear() { for (const L of this.pts.concat(this.spots)) { if (L.parent) L.parent.remove(L); if (L.target && L.target.parent) L.target.parent.remove(L.target); } this.pts = []; this.spots = []; this.scene = null; },
  update() {
    if (!this.scene || this.scene !== Game.scene) return;
    const cam = Game.camera.position, P = [], S = [];
    for (const p of Phys.props) {
      const s = p.mesh.userData.light;
      if (s && s.visible) {
        const w = s.at ? Phys.anchor(p, s.at) : new V3(p.x, p.y, p.z), e = { s, w, d: w.distanceToSquared(cam), k: p.bright || 1 };
        if (s.spot) e.dir = new V3(...s.dir).normalize().applyQuaternion(p.q);
        (s.spot ? S : P).push(e);
      }
      if (p.lamps) for (const l of p.lamps) if (l.light && l.light.visible) { const dir = new V3(...l.dir).normalize().applyQuaternion(p.q), w = Phys.anchor(p, l.at).addScaledVector(dir, 0.1); S.push({ s: l.light, w, dir, d: w.distanceToSquared(cam), k: 1 }); }
    }
    P.sort((a, b) => a.d - b.d); S.sort((a, b) => a.d - b.d);
    const fill = (pool, list, steps) => {
      const k = steps.find(n => n >= Math.min(list.length, pool.length)), want = k === undefined ? pool.length : k;
      pool.forEach((L, i) => {
        L.visible = i < want; const e = list[i];
        if (!e) { L.intensity = 0; return; }
        L.color.copy(e.s.color); L.intensity = e.s.intensity * e.k; L.distance = e.s.distance * Math.sqrt(e.k); L.position.copy(e.w);
        if (L.isSpotLight) { L.angle = e.s.angle || 0.5; L.target.position.copy(e.w).addScaledVector(e.dir, 5); L.target.updateMatrixWorld(); }
      });
    };
    fill(this.pts, P, this.STEP_P); fill(this.spots, S, this.STEP_S);
  },
};

/* ── prop meshes: decorations, and lights as pool sources ─────────────── */
const _labelCache = {};
function labelTex(text, bg) {
  const key = text + bg; if (_labelCache[key]) return _labelCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3; x.strokeRect(4, 4, 56, 56);
  x.fillStyle = '#fff'; x.font = `bold ${text.length > 3 ? 17 : 21}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return _labelCache[key] = t;
}
function keepAdd(g, m) { m.traverse(o => o.userData.keep = true); g.add(m); return m; }
function addLed(g, x, y, z) { const m = keepAdd(g, new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3a1010 }))); m.position.set(x, y, z); g.userData.led = m; }
function vcyl(r, h, m, x, y, z) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m); o.position.set(x, y, z); return o; }
const _buildPropMesh = buildPropMesh;
buildPropMesh = function (def, p = {}) {
  const g = _buildPropMesh(def, p), u = g.userData;
  if (u.light && u.light.isLight) { g.remove(u.light); u.light.dispose(); u.light = null; }
  if (def.light) { const L = typeof def.light === 'object' ? def.light : {}; u.light = { color: new THREE.Color(p.color || def.color || '#ffe8a0'), intensity: L.i || 6, distance: L.d || 14, spot: !!L.spot, at: L.at || null, dir: L.dir || null, angle: L.angle || 0.5, visible: true }; }
  const h = def.shapes[0].h;
  switch (def.parts) {
    case 'chip': { const top = keepAdd(g, new THREE.Mesh(new THREE.PlaneGeometry(h[0] * 1.8, h[2] * 1.8), new THREE.MeshBasicMaterial({ map: labelTex(def.label, def.chip) }))); top.rotation.x = -Math.PI / 2; top.position.y = h[1] + 0.002; addLed(g, h[0] * 0.8, h[1] + 0.012, -h[2] * 0.8); break; }
    case 'button': u.cap = keepAdd(g, vcyl(0.055, 0.04, lam('#d82020'), 0, 0.045, 0)); addLed(g, 0.085, 0.03, -0.085); break;
    case 'switch': { const lv = new THREE.Group(); lv.position.y = 0.025; lv.add(bx(0.025, 0.1, 0.025, lam('#dcdcdc'), 0, 0.05, 0)); lv.add(bx(0.04, 0.03, 0.04, lam('#d82020'), 0, 0.1, 0)); lv.rotation.x = 0.5; u.lever = keepAdd(g, lv); addLed(g, 0.065, 0.03, -0.105); break; }
    case 'plate': addLed(g, 0.54, 0.035, -0.54); break;
    case 'sensor': keepAdd(g, new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0x1a3a7a }))).position.y = 0.04; addLed(g, 0.06, 0.045, -0.06); break;
    case 'alarm': { const d = keepAdd(g, new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5a1010 }))); d.position.y = 0.03; u.dome = d; break; }
    case 'door': for (const s of [1, -1]) keepAdd(g, bx(0.03, 0.14, 0.05, lam('#c8c8c0'), h[0] * 0.78, 0, s * (h[2] + 0.02))); break;
    case 'garage': for (let i = 0; i < 6; i++) keepAdd(g, bx(h[0] * 2, 0.03, h[2] * 2 + 0.02, lam('#8a8e8a'), 0, -h[1] + 0.2 + i * 0.4, 0)); break;
    case 'flood': u.glows = [keepAdd(g, bx(0.15, 0.1, 0.01, new THREE.MeshBasicMaterial({ color: p.color || '#fff6d8' }), 0, 1.2, -0.086))]; break;
    case 'lantern': keepAdd(g, vcyl(0.1, 0.02, lam('#333'), 0, 0.13, 0)); keepAdd(g, vcyl(0.1, 0.02, lam('#333'), 0, -0.13, 0)); break;
  }
  return g;
};
attachLamp = function (p, l) {
  (p.lamps = p.lamps || []).push(l);
  const g = new THREE.Group(); g.add(cyl(0.08, 0.12, lam('#333'), 0, 0, 0, 10)); const lens = cyl(0.07, 0.01, new THREE.MeshBasicMaterial({ color: l.on === false ? '#222' : l.color }), 0, 0, -0.065, 10); g.add(lens);
  g.position.set(...l.at); g.quaternion.setFromUnitVectors(new V3(0, 0, -1), new V3(...l.dir)); g.traverse(o => o.userData.keep = true); p.mesh.add(g);
  l.mesh = g; l.lens = lens; l.light = { color: new THREE.Color(l.color), intensity: 40, distance: 45, angle: 0.45, spot: true, visible: l.on !== false };
};
function setLightOn(p, on) {
  const s = p.mesh.userData.light; if (!s) return; s.visible = on;
  const col = on ? (p.color || p.def.color || '#ffe8a0') : '#2a2a28';
  if (PMAT[p.mat || p.def.mat] && PMAT[p.mat || p.def.mat].glow) p.mesh.children.forEach(o => { if (o.isMesh && !o.userData.keep && o.material.isMeshBasicMaterial) o.material.color.set(col); });
  for (const o of p.mesh.userData.glows || []) o.material.color.set(on ? (p.color || '#fff6d8') : '#2a2a28');
}

/* ── wiring ────────────────────────────────────────────────────────────── */
const Wiring = {
  t: 0,
  inputs() { const m = new Map(); for (const c of Phys.constraints) if (c.type === 'wire' && c.a && c.b) { let l = m.get(c.b); if (!l) m.set(c.b, l = []); l.push(c.a); } return m; },
  wired(p) { return Phys.constraints.some(c => c.type === 'wire' && c.b === p); },
  plateHit(p) {
    const b = Object.assign({}, Phys.aabb(p));
    for (const s of Game.soldiers) if (s.alive && s.pos.x > b.x0 && s.pos.x < b.x1 && s.pos.z > b.z0 && s.pos.z < b.z1 && s.pos.y > b.y1 - 0.4 && s.pos.y < b.y1 + 0.5) return true;
    for (const q of Phys.props) { if (q === p || q.held) continue; const c = Phys.aabb(q); if (c.x1 > b.x0 && c.x0 < b.x1 && c.z1 > b.z0 && c.z0 < b.z1 && c.y0 > b.y1 - 0.15 && c.y0 < b.y1 + 0.25) return true; }
    for (const v of Game.vehicles) if (v.alive && v.pos.x > b.x0 - v.K.r && v.pos.x < b.x1 + v.K.r && v.pos.z > b.z0 - v.K.r && v.pos.z < b.z1 + v.K.r && Math.abs(v.pos.y - b.y1) < 0.6) return true;
    return false;
  },
  sensorHit(p) { for (const s of Game.soldiers) if (s.alive && dist3(new V3(s.pos.x, s.pos.y + 0.9, s.pos.z), new V3(p.x, p.y, p.z)) < 4) return true; return false; },
  /* authority: work out every output from last tick's outputs, then publish the changes */
  tick() { for (let i = 0; i < 8 && this.step(); i++); },   // settle chains of gates in one tick (loops still oscillate, one step per pass)
  step() {
    const now = Game.now, ins = this.inputs(), changes = [];
    for (const p of Phys.props) {
      const d = p.def, L = ins.get(p), on = L ? L.filter(x => x.sig).length : 0, any = on > 0;
      let v;
      switch (d.logic) {
        case 'button': v = now < (p.pressT || 0); break;
        case 'switch': v = !!p.manual; break;
        case 'plate': v = this.plateHit(p); break;
        case 'sensor': v = this.sensorHit(p); break;
        case 'timer': { const per = p.period || 1; v = (now % per) < per / 2; break; }
        case 'and': v = !!L && on === L.length; break;
        case 'or': v = any; break;
        case 'not': v = !any; break;
        case 'xor': v = on % 2 === 1; break;
        case 'delay': { p.dq = p.dq || []; if (any !== !!p.dLast) { p.dq.push([now + 1, any]); p.dLast = any; } while (p.dq.length && p.dq[0][0] <= now) p.dOut = p.dq.shift()[1]; v = !!p.dOut; break; }
        case 'flipflop': { if (any && !p.ffLast) p.ff = !p.ff; p.ffLast = any; v = !!p.ff; break; }
        default:
          if (L) v = any;
          else if (d.light) v = p.manual !== false;
          else if (d.door) v = !!p.manual;
          else v = false;
      }
      if (v !== !!p.sig) changes.push([p, v]);
    }
    for (const [p, v] of changes) Sandbox.emit({ e: 'sig', id: p.id, v });
    return changes.length > 0;
  },
  /* every machine: what a signal looks like, and (authority) what it does */
  apply(p, v) {
    const was = !!p.sig; p.sig = v; const u = p.mesh.userData, wired = this.wired(p);
    if (u.led) u.led.material.color.set(v ? 0x3aff6a : 0x3a1010);
    if (u.cap) u.cap.position.y = v ? 0.03 : 0.045;
    if (u.lever) u.lever.rotation.x = v ? -0.5 : 0.5;
    if (p.def.light) setLightOn(p, v);
    for (const c of Phys.constraints) if (c.type === 'wire' && c.a === p && c.line) c.line.material.color.set(v ? 0x3aff6a : 0x8a2a2a);
    if (wired) {
      if (p.lamps) for (const l of p.lamps) { l.on = v; l.light.visible = v; l.lens.material.color.set(v ? l.color : '#222'); }
      if (p.emitters) for (const e of p.emitters) e.on = v;
      if (p.thrusters) for (const t of p.thrusters) t.on = v;
    }
    if (!Game.authority() || !wired) return;
    for (const c of Phys.constraints) if (c.type === 'wheel' && c.a === p && c.cn) {
      if (v) { c.cn.enableMotor(); c.cn.setMotorSpeed((c.rev ? -1 : 1) * (c.speed || 12)); c.cn.motorEquation.maxForce = 400; c.a.body.wakeUp(); c.b.body.wakeUp(); } else c.cn.disableMotor();
    }
    if (p.def.dynamite && v && !was) { const pos = new V3(p.x, p.y, p.z); Sandbox.removeEntity(p.id); Sandbox.explode(pos, p.def.explosive * p.scale, 6 * Math.sqrt(p.scale), Game.byId(p.own)); }
  },
};

/* ── doors ─────────────────────────────────────────────────────────────── */
function doorTick(p, dt) {
  const D = p.door || (p.door = { pos: [p.x, p.y, p.z], q: [p.q.x, p.q.y, p.q.z, p.q.w], t: 0, dir: 1 });
  if (p.held || !p.frozen) { D.t = 0; D.moving = false; D.pos = [p.x, p.y, p.z]; D.q = [p.q.x, p.q.y, p.q.z, p.q.w]; return; }
  const want = p.sig ? 1 : 0;
  if (D.t === want) { D.moving = false; if (!want) { D.pos = [p.x, p.y, p.z]; D.q = [p.q.x, p.q.y, p.q.z, p.q.w]; } return; }
  if (!D.moving) Sfx.play('vehicle', new V3(p.x, p.y, p.z), { f: 70, dur: 0.25 });
  D.moving = true; D.t = want > D.t ? Math.min(1, D.t + dt * 1.4) : Math.max(0, D.t - dt * 1.4);
  const e = D.t * D.t * (3 - 2 * D.t), C = new V3(...D.pos), Q = new THREE.Quaternion(...D.q), h = p.def.shapes[0].h, s = p.scale;
  let pos, q = Q.clone();
  if (p.def.door === 'hinge') {
    const H = new V3(-h[0] * s, 0, 0).applyQuaternion(Q).add(C), R = new THREE.Quaternion().setFromAxisAngle(Y_AXIS.clone().applyQuaternion(Q), D.dir * e * Math.PI / 2);
    pos = C.clone().sub(H).applyQuaternion(R).add(H); q = R.multiply(Q);
  } else if (p.def.door === 'slide') pos = C.clone().addScaledVector(new V3(1, 0, 0).applyQuaternion(Q), h[0] * 2 * s * 0.95 * e);
  else pos = C.clone().addScaledVector(Y_AXIS.clone().applyQuaternion(Q), h[1] * 2 * s * 0.92 * e);
  p.x = pos.x; p.y = pos.y; p.z = pos.z; p.q.copy(q);
  if (p.body) { p.body.position.set(pos.x, pos.y, pos.z); p.body.quaternion.set(q.x, q.y, q.z, q.w); p.body.aabbNeedsUpdate = true; }
}

/* ── vehicles: paint ───────────────────────────────────────────────────── */
function paintVehicle(v, col) {
  const src = v.model.userData.paint; if (!src) return;
  if (!v.paintMat) { v.paintMat = new THREE.MeshLambertMaterial({ color: col }); v.model.traverse(o => { if (o.material === src) o.material = v.paintMat; }); }
  else v.paintMat.color.set(col);
  v.paint = col;
}
const vehById = id => Game.vehicles.find(x => x.id === id);

/* ── actions ───────────────────────────────────────────────────────────── */
const _run3 = Sandbox.run.bind(Sandbox);
Sandbox.run = function (a) {
  const actor = Game.byId(a.by); if (!actor) return;
  const undo = this.undo[a.by] || (this.undo[a.by] = []);
  switch (a.op) {
    case 'prop': {
      if (!(a.quat || a.fr || a.weld || a.col || a.br)) break;
      const def = PROPS[a.k]; if (!def) return;
      const id = 'e' + (Phys.nextId++), P = a.weld && Phys.byId.get(a.weld);
      this.emit({ e: 'add', id, k: a.k, pos: a.pos, quat: a.quat || [0, 0, 0, 1], sc: 1, own: a.by, fr: !!a.fr && !P, col: a.col, br: a.br });
      if (P) this.emit({ e: 'con', id: 'c' + (Phys.nextId++), type: 'weld', a: P.id, la: Phys.worldToLocal(P, new V3(...a.pos)), b: id, lb: [0, 0, 0] });
      undo.push({ kind: 'ent', id }); return;
    }
    case 'con': {
      if (!['wire', 'hinge', 'ball'].includes(a.type)) break;
      const A = a.a && Phys.byId.get(a.a), B = a.b && Phys.byId.get(a.b); if (!A || (a.type === 'wire' && !B)) return;
      if (a.type === 'wire' && Phys.constraints.some(c => c.type === 'wire' && c.a === A && c.b === B)) return;
      const id = 'c' + (Phys.nextId++); this.emit({ e: 'con', id, type: a.type, a: a.a, b: a.b || null, la: a.la, lb: a.lb, axisA: a.axisA, axisB: a.axisB });
      undo.push({ kind: 'con', id }); return;
    }
    case 'unwire': { const p = Phys.byId.get(a.id); if (!p) return; for (const c of Phys.constraints.filter(c => c.type === 'wire' && c.b === p)) this.emit({ e: 'cdel', id: c.id }); return; }
    case 'use': {
      const p = Phys.byId.get(a.id), d = p && p.def; if (!p || dist3(actor.eye(new V3()), new V3(p.x, p.y, p.z)) > 12) return;
      const tell = x => { const pr = Net.peerOf(a.by); if (pr) Net.to(pr.id, { t: 'toast', x }); if (actor === Game.local) HUD.center(x, 0.9); };
      if (d.logic === 'button') p.pressT = Game.now + 1;
      else if (d.logic === 'switch') p.manual = !p.manual;
      else if (d.logic === 'timer') { const ps = [0.5, 1, 2, 4]; p.period = ps[(ps.indexOf(p.period || 1) + 1) % ps.length]; tell(`Timer: every ${p.period} s`); }
      else if (d.door || d.light) {
        if (Wiring.wired(p)) { tell(d.door ? 'This door is wired to a circuit' : 'This light is wired to a circuit'); return; }
        p.manual = d.light ? p.manual === false : !p.manual;
        if (d.door === 'hinge' && p.manual && p.door && p.door.t === 0) { const Q = new THREE.Quaternion(...p.door.q), z = new V3(0, 0, 1).applyQuaternion(Q); p.door.dir = (actor.pos.x - p.door.pos[0]) * z.x + (actor.pos.z - p.door.pos[2]) * z.z > 0 ? 1 : -1; }
      } else return;
      this.emit({ e: 'wst', id: p.id, m: p.manual, per: p.period, dr: p.door ? p.door.dir : undefined, click: 1 });
      Wiring.tick(); return;
    }
    case 'grab': {
      if (!a.vid) break;
      const v = vehById(a.vid); if (!v || !v.alive || v.driver) return;
      if (v.frozen) this.emit({ e: 'vset', id: v.id, fr: false });
      v.held = true; this.hold[a.by] = { vid: a.vid, off: a.off, target: a.target, rot: null }; return;
    }
    case 'drop': {
      const h = this.hold[a.by]; if (!h) return;
      if (h.id) { const p = Phys.byId.get(h.id); if (p && p.def.door && !a.freeze) { _run3(a); this.emit({ e: 'set', id: p.id, fr: true }); return; } }
      if (!h.vid) break;
      delete this.hold[a.by]; const v = vehById(h.vid); if (!v) return; v.held = false;
      if (a.freeze) this.emit({ e: 'vset', id: v.id, fr: true });
      else if (h.vel) { const m = h.vel.length(); v.ext.copy(h.vel).multiplyScalar(m > 25 ? 25 / m : 1); v.vel.y = v.ext.y; v.ext.y = 0; }
      return;
    }
    case 'vset': {
      const v = vehById(a.id); if (!v) return;
      const ev = { e: 'vset', id: v.id };
      if (a.col) ev.col = a.col; if (a.fr != null) ev.fr = !!a.fr; if (a.burn != null) ev.burn = a.burn; if (a.fix) ev.hp = v.maxHp;
      this.emit(ev); return;
    }
    case 'vdupe': { const id = 'v' + uid(5); this.emit({ e: 'veh', id, x: a.pos[0], y: a.pos[1], z: a.pos[2], yaw: a.yaw || 0, k: VKIND[a.k] ? a.k : 'jeep', col: a.col }); undo.push({ kind: 'veh', id }); return; }
    case 'clear': { _run3(a); for (const v of Game.vehicles.filter(x => x.noRespawn)) this.emit({ e: 'vehdel', id: v.id }); return; }
  }
  return _run3(a);
};

/* ── events ────────────────────────────────────────────────────────────── */
const _apply3 = Sandbox.apply.bind(Sandbox);
Sandbox.apply = function (ev) {
  switch (ev.e) {
    case 'add': {
      _apply3(ev); const p = Phys.byId.get(ev.id); if (!p) return;
      if (ev.br) p.bright = ev.br;
      if (ev.ws) { p.manual = ev.ws.m; p.period = ev.ws.per; if (ev.ws.dr) p.door = { pos: ev.pos.slice(), q: (ev.quat || [0, 0, 0, 1]).slice(), t: 0, dir: ev.ws.dr }; if (ev.ws.sg) Wiring.apply(p, true); }
      if (p.def.light && p.sig === undefined) p.sig = true;
      return;
    }
    case 'con': {
      _apply3(ev); const c = Phys.constraints.find(x => x.id === ev.id); if (!c) return;
      if (ev.type === 'wire') {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        c.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c.a && c.a.sig ? 0x3aff6a : 0x8a2a2a })); c.line.frustumCulled = false; Game.scene.add(c.line); Phys.ropes.push(c);
        if (c.b && Game.authority()) Wiring.tick();
      }
      if (ev.type === 'hinge' || ev.type === 'ball') { c.axisA = ev.axisA; c.axisB = ev.axisB; if (c.cn && Phys.world) Phys.world.removeConstraint(c.cn); c.cn = null; Phys.rebuildConstraint(c); }
      return;
    }
    case 'set': { _apply3(ev); const p = Phys.byId.get(ev.id); if (p && p.def.light && (ev.col || ev.mat)) setLightOn(p, p.sig !== false); return; }
    case 'sig': { const p = Phys.byId.get(ev.id); if (p) Wiring.apply(p, ev.v); return; }
    case 'wst': { const p = Phys.byId.get(ev.id); if (!p) return; p.manual = ev.m; p.period = ev.per; if (ev.dr && p.door) p.door.dir = ev.dr; if (ev.click) Sfx.play('tick', new V3(p.x, p.y, p.z)); return; }
    case 'veh': {
      _apply3(ev); const v = vehById(ev.id); if (!v) return;
      if (ev.y) { v.pos.y = ev.y; v.model.position.copy(v.pos); }
      if (ev.col) paintVehicle(v, ev.col); if (ev.fr) v.frozen = true; if (ev.hp) v.hp = ev.hp;
      return;
    }
    case 'vset': {
      const v = vehById(ev.id); if (!v) return;
      if (ev.col) paintVehicle(v, ev.col); if (ev.fr != null) v.frozen = ev.fr; if (ev.burn != null) v.burnT = ev.burn; if (ev.hp) { v.hp = ev.hp; if (!v.alive) { v.reset(); } }
      return;
    }
  }
  return _apply3(ev);
};

/* hinges and ball sockets (authority only builds the physics) */
Phys.worldAnchor = function () {
  if (!this._wb || this._wbW !== this.world) { this._wb = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC }); this.world.addBody(this._wb); this._wbW = this.world; }
  return this._wb;
};
const _rebuild3 = Phys.rebuildConstraint.bind(Phys);
Phys.rebuildConstraint = function (c) {
  if (c.type !== 'hinge' && c.type !== 'ball') return _rebuild3(c);
  if (!Game.authority() || !this.world || (c.type === 'hinge' && !c.axisA)) return;
  const A = c.a ? c.a.body : this.worldAnchor(), B = c.b ? c.b.body : this.worldAnchor(); if (!A || !B) return;
  const sa = c.a ? c.a.scale : 1, sb = c.b ? c.b.scale : 1, pA = new CANNON.Vec3(c.la[0] * sa, c.la[1] * sa, c.la[2] * sa), pB = new CANNON.Vec3(c.lb[0] * sb, c.lb[1] * sb, c.lb[2] * sb);
  c.cn = c.type === 'hinge' ? new CANNON.HingeConstraint(A, B, { pivotA: pA, axisA: new CANNON.Vec3(...c.axisA), pivotB: pB, axisB: new CANNON.Vec3(...c.axisB), maxForce: 1e6, collideConnected: false }) : new CANNON.PointToPointConstraint(A, pA, B, pB, 1e6);
  c.cn.collideConnected = false; this.world.addConstraint(c.cn); A.wakeUp(); B.wakeUp();
};

/* late joiners and saves carry the new state too */
const _snap3 = Sandbox.snapshotAll.bind(Sandbox);
Sandbox.snapshotAll = function () {
  const st = _snap3();
  st.props.forEach(ev => {
    const p = Phys.byId.get(ev.id); if (!p) return;
    if (p.bright) ev.br = p.bright;
    if (p.manual !== undefined || p.period || p.sig || p.door) ev.ws = { m: p.manual, per: p.period, sg: !!p.sig && !p.def.logic && !p.def.door, dr: p.door ? p.door.dir : undefined };
    if (p.door && p.door.t > 0) { ev.pos = p.door.pos.slice(); ev.quat = p.door.q.slice(); }
  });
  st.cons.forEach(ev => { const c = Phys.constraints.find(x => x.id === ev.id); if (c && (c.type === 'hinge' || c.type === 'ball')) { ev.axisA = c.axisA; ev.axisB = c.axisB; } });
  st.veh = Game.vehicles.filter(v => v.noRespawn && v.alive).map(v => ({ e: 'veh', id: v.id, x: +v.pos.x.toFixed(3), y: +v.pos.y.toFixed(3), z: +v.pos.z.toFixed(3), yaw: v.yaw, k: v.kind, col: v.paint, fr: v.frozen || undefined, hp: Math.round(v.hp) }));
  return st;
};

/* ── per frame ─────────────────────────────────────────────────────────── */
const _start3 = Sandbox.start.bind(Sandbox);
Sandbox.start = function () { _start3(); LightPool.init(Game.scene); Wiring.t = 0; };
const _stop3 = Sandbox.stop.bind(Sandbox);
Sandbox.stop = function () { try { if (Phys.props.length || Game.soldiers.some(s => s.npc) || Game.vehicles.some(v => v.noRespawn)) Saves.write('Autosave', this.serialize(), 'auto'); } catch (e) { } LightPool.clear(); _stop3(); };
const _update3 = Sandbox.update.bind(Sandbox);
Sandbox.update = function (dt) {
  _update3(dt);
  if (!this.on) return;
  const auth = Game.authority(), now = Game.now;
  if (auth) {
    // physics gun holding a vehicle
    for (const by in this.hold) {
      const h = this.hold[by]; if (!h.vid) continue;
      const v = vehById(h.vid); if (!v || !v.alive || v.driver) { if (v) v.held = false; delete this.hold[by]; continue; }
      if (h.rot) { for (const r of h.rot) v.yaw = angWrap(v.yaw + new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...r), 'YXZ').y); h.rot = null; }
      const want = new V3(...h.target).sub(new V3(...h.off).applyAxisAngle(Y_AXIS, v.yaw)); want.y = Math.max(0, want.y);
      const prev = v.pos.clone(); v.pos.lerp(want, 1 - Math.exp(-dt * 12)); h.vel = v.pos.clone().sub(prev).multiplyScalar(1 / Math.max(dt, 1e-3));
      v.model.position.copy(v.pos); v.model.rotation.y = v.yaw;
    }
    this.wireT = (this.wireT || 0) - dt; if (this.wireT <= 0) { this.wireT = 0.05; Wiring.tick(); }
    for (const p of Phys.props) if (p.def.door) doorTick(p, dt);
  }
  for (const p of Phys.props) if (p.def.parts === 'alarm' && p.mesh.userData.dome) {
    const d = p.mesh.userData.dome;
    if (p.sig) { const blink = Math.sin(now * 12) > 0; d.material.color.set(blink ? 0xff2a1a : 0x7a1010); p.alT = (p.alT || 0) - dt; if (p.alT <= 0) { p.alT = 0.5; Sfx.play('beep', new V3(p.x, p.y, p.z), { vol: 1.4 }); } }
    else d.material.color.set(0x5a1010);
  }
  for (const v of Game.vehicles) if (v.burnT > 0 && v.alive) {
    v.burnT -= dt; FX.emit('add', v.pos.x + rand(-1, 1), v.pos.y + 1.2, v.pos.z + rand(-1, 1), 3, 2, [1, 0.5, 0.1], 0.5, 3, 0.5);
    if (Math.random() < 0.3) FX.emit('big', v.pos.x, v.pos.y + 1.6, v.pos.z, 1, 1, [0.15, 0.14, 0.13], 1.8, 1.5, 0.4);
    if (auth) { v.burnTick = (v.burnTick || 0) - dt; if (v.burnTick <= 0) { v.burnTick = 0.5; v.damage(v.maxHp * 0.025, null); } }
  }
  LightPool.update();
};

/* the physics gun beam to a held vehicle */
function drawCurve(beam, M, T, G) {
  const a = beam.geometry.attributes.position.array;
  for (let i = 0; i < 24; i++) { const t = i / 23, u = 1 - t; a[i * 3] = u * u * M.x + 2 * u * t * T.x + t * t * G.x; a[i * 3 + 1] = u * u * M.y + 2 * u * t * T.y + t * t * G.y; a[i * 3 + 2] = u * u * M.z + 2 * u * t * T.z + t * t * G.z; }
  beam.geometry.attributes.position.needsUpdate = true; beam.visible = true;
}
const _drawBeam3 = Sandbox.drawBeam.bind(Sandbox);
Sandbox.drawBeam = function () {
  const h = this.myHold; if (!h || !h.vid) return _drawBeam3();
  const L = Game.local; this.beam.visible = false; this.marker.visible = false;
  if (!L || !L.alive || L.cur !== 'physgun') return;
  const v = vehById(h.vid); if (!v || !v.alive || v.driver) { this.myHold = null; return; }
  const G = new V3(...h.off).applyAxisAngle(Y_AXIS, v.yaw).add(v.pos);
  const M = Game.view && !Game.view.third ? Game.view.muzzleWorld(new V3()) : L.eye(new V3()), T = L.eye(new V3()).addScaledVector(L.forward(new V3()), h.dist);
  drawCurve(this.beam, M, T, G); this.marker.position.copy(G); this.marker.visible = true;
};

/* ── E: doors, buttons, switches, timers, lights ──────────────────────── */
Sandbox.useTarget = function (s) {
  if (this.myHold) return null;
  const tr = this.trace(s, 3.6); if (tr.kind !== 'prop' || tr.t > 3.6) return null;
  const p = tr.prop, d = p.def; return d.usable || d.door || d.light ? p : null;
};
Sandbox.tryUse = function (s) { const p = this.useTarget(s); if (!p) return false; this.exec({ op: 'use', id: p.id }); return true; };
Sandbox.useHint = function (s) {
  const p = this.useTarget(s); if (!p) return '';
  const d = p.def, wired = Wiring.wired(p);
  if (d.logic === 'button') return 'E — press button';
  if (d.logic === 'switch') return `E — flip switch (${p.sig ? 'on' : 'off'})`;
  if (d.logic === 'timer') return `E — timer: every ${p.period || 1} s`;
  if (d.door) return wired ? 'Door — controlled by its wiring' : `E — ${p.sig ? 'close' : 'open'} ${d.name.toLowerCase()}`;
  if (d.light) return wired ? 'Light — controlled by its wiring' : `E — turn ${p.sig === false ? 'on' : 'off'} ${d.name.toLowerCase()}`;
  return '';
};

/* ── placing things flush on surfaces ─────────────────────────────────── */
const shapeHalf = d => { const s = d.shapes[0]; return d.shapes.length > 1 ? 0.02 : s.t === 'box' ? s.h[1] : s.t === 'cyl' ? s.h / 2 : s.r; };
Sandbox.placement = function (s, d) {
  const tr = this.trace(s, 60); let P = tr.p.clone(), n = tr.n.clone();
  if (tr.kind === 'none' || tr.kind === 'npc' || tr.kind === 'veh' || n.lengthSq() < 0.5) { P = s.eye(new V3()).addScaledVector(s.forward(new V3()), 3); n.set(0, 1, 0); }
  n.normalize();
  const prop = tr.kind === 'prop' ? tr.prop : null, yawQ = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, s.yaw);
  if (d.door) {
    const b = P.clone().addScaledVector(n, 0.15), t = World.raycast(b.x, b.y + 0.05, b.z, 0, -1, 0, 60), ph = Phys.ray(new V3(b.x, b.y + 0.05, b.z), new V3(0, -1, 0), t >= 0 ? t : 60);
    const fy = Math.max(0, ph ? b.y + 0.05 - ph.t : t >= 0 ? b.y + 0.05 - t : 0);
    return { pos: [b.x, fy + d.shapes[0].h[1] + 0.01, b.z], quat: [yawQ.x, yawQ.y, yawQ.z, yawQ.w], fr: true };
  }
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, n).multiply(yawQ), pos = P.addScaledVector(n, shapeHalf(d) + 0.004);
  return { pos: [pos.x, pos.y, pos.z], quat: [q.x, q.y, q.z, q.w], fr: !prop, weld: prop ? prop.id : null };
};
const _spawn3 = Sandbox.spawn.bind(Sandbox);
Sandbox.spawn = function (kind, key, extra) {
  const d = kind === 'prop' && PROPS[key];
  if (!d || !(d.flush || d.door)) return _spawn3(kind, key);
  const L = Game.local; if (!L || !L.alive) return;
  this.exec(Object.assign({ op: 'prop', k: key }, this.placement(L, d), extra || {}));
};

/* ── tool gun + physics gun ───────────────────────────────────────────── */
const _useTool3 = Sandbox.useTool.bind(Sandbox);
Sandbox.useTool = function (s, dt) {
  const I = Input, O = this.opts;
  if (s.cur === 'physgun') {
    if (!this.myHold && (I.mouse.leftPressed || I.hit('KeyR'))) {
      const tr = this.trace(s, 450);
      if (tr.kind === 'veh' && !tr.v.driver) {
        const v = tr.v;
        if (I.hit('KeyR')) { this.exec({ op: 'vset', id: v.id, fr: false }); HUD.center('Unfrozen', 0.6); return; }
        const off = tr.p.clone().sub(v.pos).applyAxisAngle(Y_AXIS, -v.yaw);
        this.myHold = { vid: v.id, dist: tr.t, off: [off.x, off.y, off.z] }; this.exec({ op: 'grab', vid: v.id, off: this.myHold.off, target: [tr.p.x, tr.p.y, tr.p.z] }); Sfx.play('ui');
      }
    }
    return _useTool3(s, dt);
  }
  const tool = O.tool, mine = ['wire', 'hinge', 'ball', 'repair', 'light'].includes(tool);
  if (!(I.mouse.leftPressed || I.mouse.rightPressed || I.hit('KeyR'))) return;
  if (I.hit('KeyR')) return _useTool3(s, dt);
  const tr = this.trace(s), rmb = I.mouse.rightPressed, prop = tr.kind === 'prop' ? tr.prop : null;
  // vehicles take a few of the tools
  if (tr.kind === 'veh' && tool !== 'remover') {
    const v = tr.v; this.toolFx(s, tr);
    switch (tool) {
      case 'color': if (rmb) { if (v.paint) { O.color = v.paint; this.saveOpts(); } } else this.exec({ op: 'vset', id: v.id, col: O.color }); return;
      case 'freezer': this.exec({ op: 'vset', id: v.id, fr: !rmb }); HUD.center(rmb ? 'Unfrozen' : 'Frozen', 0.6); return;
      case 'ignite': this.exec({ op: 'vset', id: v.id, burn: rmb ? 0 : 20 }); return;
      case 'repair': this.exec({ op: 'vset', id: v.id, fix: 1, burn: 0 }); HUD.center(v.K.name + ' repaired', 0.8); return;
      case 'duplicator': if (rmb) { this.clip = { veh: v.kind, col: v.paint, items: [] }; HUD.center('Copied the ' + v.K.name.toLowerCase(), 1); return; } break;
      default: HUD.center(TOOLS[tool].name + ' does not work on vehicles', 1); return;
    }
  }
  if (tool === 'duplicator' && !rmb && this.clip && this.clip.veh) {
    if (tr.kind === 'none') return; this.toolFx(s, tr);
    const K = VKIND[this.clip.veh], p = tr.p.clone().addScaledVector(tr.n, K.r); this.exec({ op: 'vdupe', k: this.clip.veh, col: this.clip.col, pos: [p.x, Math.max(0, p.y - K.r), p.z], yaw: s.yaw }); return;
  }
  if (tool === 'duplicator' && rmb && prop && this.clip && this.clip.veh) this.clip = null;
  if (!mine) return _useTool3(s, dt);
  this.toolFx(s, tr);
  const local = prop ? Phys.worldToLocal(prop, tr.p) : [tr.p.x, tr.p.y, tr.p.z];
  switch (tool) {
    case 'wire':
      if (rmb) { if (prop) { this.exec({ op: 'unwire', id: prop.id }); HUD.center('Wires cut', 0.6); } this.pick = null; break; }
      if (!prop) break;
      if (!this.pick) { this.pick = { id: prop.id, l: local }; HUD.center(`Wire from ${prop.def.name}: now click what it powers`, 1.4); }
      else if (this.pick.id !== prop.id) { this.exec({ op: 'con', type: 'wire', a: this.pick.id, la: this.pick.l, b: prop.id, lb: local }); this.pick = null; HUD.center('Wired', 0.6); }
      break;
    case 'hinge': case 'ball':
      if (rmb) { this.pick = null; break; }
      if (!this.pick) { if (!prop) { HUD.center('Click a prop first', 0.8); break; } this.pick = { id: prop.id, w: tr.p.clone(), n: tr.n.clone().normalize() }; HUD.center(`${TOOLS[tool].name}: now click the other prop, or the world`, 1.3); break; }
      {
        const A = Phys.byId.get(this.pick.id); if (!A || prop === A) { this.pick = null; break; }
        const W = this.pick.w, N = this.pick.n, iA = A.q.clone().invert(), nA = N.clone().applyQuaternion(iA), nB = prop ? N.clone().applyQuaternion(prop.q.clone().invert()) : N;
        this.exec({ op: 'con', type: tool, a: A.id, la: Phys.worldToLocal(A, W), b: prop ? prop.id : null, lb: prop ? Phys.worldToLocal(prop, W) : [W.x, W.y, W.z], axisA: [nA.x, nA.y, nA.z], axisB: [nB.x, nB.y, nB.z] });
        this.pick = null; HUD.center(tool === 'hinge' ? 'Axis made' : 'Ball socket made', 0.7);
      }
      break;
    case 'repair':
      if (rmb) { for (const v of Game.vehicles) if (v.alive && dist2(v.pos.x, v.pos.z, s.pos.x, s.pos.z) < 25) this.exec({ op: 'vset', id: v.id, fix: 1, burn: 0 }); HUD.center('Vehicles nearby repaired', 0.8); }
      else if (prop && prop.burnT > 0) this.exec({ op: 'ignite', id: prop.id, off: true });
      break;
    case 'light':
      if (rmb) { if (prop && prop.def.light) this.exec({ op: 'use', id: prop.id }); break; }
      this.spawn('prop', PROPS[O.lightKind] ? O.lightKind : 'lightbulb', { col: O.color, br: O.bright !== 1 ? O.bright : undefined });
      break;
  }
};

/* ── saves ─────────────────────────────────────────────────────────────── */
const Saves = {
  list() { return Store.get('sbx_saves', []); },
  write(name, data, id) {
    const list = this.list(), old = list.find(s => (id && s.id === id) || s.name === name);
    const sid = id || (old ? old.id : uid(8)), meta = { id: sid, name, map: data.map, t: Date.now(), count: data.props.length + (data.veh || []).length + (data.npc || []).length };
    try { localStorage.removeItem('bp_sbx_save_' + sid); } catch (e) { }
    Store.set('sbx_save_' + sid, data);
    if (!Store.get('sbx_save_' + sid, null)) return false;   // storage full
    Store.set('sbx_saves', [meta].concat(list.filter(s => s.id !== sid)).slice(0, 60)); return true;
  },
  read(id) { return Store.get('sbx_save_' + id, null); },
  remove(id) { try { localStorage.removeItem('bp_sbx_save_' + id); } catch (e) { } Store.set('sbx_saves', this.list().filter(s => s.id !== id)); },
};
Sandbox.serialize = function () {
  const st = this.snapshotAll();
  const npc = Game.soldiers.filter(s => s.npc && s.alive).map(s => { const w = [1, 2].map(k => s.weapons[k]).find(Boolean) || null; return { e: 'npc', k: s.npc, name: s.name, team: s.team, w, pos: [+s.pos.x.toFixed(2), +s.pos.y.toFixed(2), +s.pos.z.toFixed(2)], yaw: s.yaw, att: {} }; });
  return { v: 1, map: Game.cfg.map, props: st.props, cons: st.cons, veh: st.veh, npc };
};
Sandbox.load = function (d) {
  if (!d || !Array.isArray(d.props)) { HUD.center('That save is damaged', 1.5); return; }
  if (!Game.authority()) { HUD.center('Only the host can load a save', 1.5); return; }
  const play = Sfx.play; Sfx.play = () => { };
  try {
    for (const by in this.hold) { const h = this.hold[by], v = h.vid && vehById(h.vid); if (v) v.held = false; }
    this.hold = {}; this.myHold = null; this.pick = null; this.undo = {};
    for (const p of Phys.props.slice()) this.emit({ e: 'del', id: p.id });
    for (const s of Game.soldiers.filter(x => x.npc)) this.emit({ e: 'npcdel', id: s.id });
    for (const v of Game.vehicles.filter(x => x.noRespawn)) this.emit({ e: 'vehdel', id: v.id });
    let max = Phys.nextId; for (const ev of d.props.concat(d.cons || [])) { const n = parseInt(String(ev.id).slice(1), 10); if (n >= max) max = n + 1; }
    Phys.nextId = max;
    for (const ev of d.props) if (PROPS[ev.k]) this.emit(Object.assign({}, ev, { e: 'add' }));
    for (const ev of d.cons || []) if ((!ev.a || Phys.byId.has(ev.a)) && (!ev.b || Phys.byId.has(ev.b))) this.emit(Object.assign({}, ev, { e: 'con' }));
    for (const ev of d.veh || []) this.emit(Object.assign({}, ev, { e: 'veh', id: 'v' + uid(5) }));
    for (const ev of d.npc || []) if (NPCS[ev.k]) this.emit(Object.assign({}, ev, { e: 'npc', id: 'n' + (this.nextNpc++) + uid(3) }));
  } finally { Sfx.play = play; }
  Wiring.tick();
  HUD.center(`Loaded ${d.props.length} props`, 1.4);
};
Sandbox.loadSaved = function (d) {
  if (d && d.map && d.map !== Game.cfg.map && MAPS[d.map]) {
    if (Net.role === 'off') { UI.toggleSpawnMenu(false); UI.leaveGame(); UI.playCfg.mode = 'sandbox'; UI.playCfg.map = d.map; UI.startSolo(); setTimeout(() => Sandbox.load(d), 250); return; }
    HUD.center(`Saved on ${MAPS[d.map].name}, loading it here anyway`, 2);
  }
  UI.toggleSpawnMenu(false); this.load(d);
};

/* ── spawn menu: Saves tab, light and wiring options ───────────────────── */
UI.savesHtml = function () {
  const list = Saves.list(), n = Phys.props.length;
  return `<div class="sv"><div class="sv-new"><input id="svName" maxlength="40" placeholder="Name this save" value="${escapeHtml(this.lastSaveName || '')}"><button class="btn" id="svSave">Save (${n} prop${n === 1 ? '' : 's'})</button><button class="btn ghost" id="svImport">Import file…</button><input type="file" id="svFile" accept=".json,application/json" hidden></div>
    ${list.length ? `<div class="sv-list">${list.map(s => `<div class="sv-row"><div class="sv-info"><b>${escapeHtml(s.name)}</b><small>${escapeHtml(MAPS[s.map] ? MAPS[s.map].name : s.map || '?')} · ${s.count} thing${s.count === 1 ? '' : 's'} · ${new Date(s.t).toLocaleString()}</small></div><button class="btn" data-svload="${s.id}">Load</button><button class="btn ghost" data-svexp="${s.id}">Export</button><button class="btn warn" data-svdel="${s.id}">Delete</button></div>`).join('')}</div>` : '<p class="muted">No saves yet. Type a name and press Save.</p>'}
    <p class="muted">A save keeps every prop, weld, rope, wire, door, light, vehicle and NPC. Saves live in this browser; Export gives you a file to back up or share, Import loads one. Leaving a sandbox also keeps an Autosave.${Net.role === 'client' ? ' Only the host can load saves.' : ''}</p></div>`;
};
UI.bindSaves = function (M) {
  const ren = () => this.renderSpawnMenu();
  $('svSave').onclick = () => { const name = ($('svName').value || '').trim() || `Build ${new Date().toLocaleString()}`; this.lastSaveName = name; if (Saves.write(name, Sandbox.serialize())) { Sfx.play('buy'); HUD.center('Saved: ' + name, 1.2); } else HUD.center('Not enough browser storage for this save — try Export', 2.5); ren(); };
  $('svImport').onclick = () => $('svFile').click();
  $('svFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (!d || !Array.isArray(d.props)) throw 0; const name = (f.name || 'Imported').replace(/\.(bpsave\.)?json$/i, ''); Saves.write(name, d); ren(); HUD.center('Imported ' + name, 1.2); } catch (err) { HUD.center('That file is not a Breachpoint save', 2); } }; r.readAsText(f); };
  M.querySelectorAll('[data-svload]').forEach(b => b.onclick = () => { const d = Saves.read(b.dataset.svload); if (!d) { HUD.center('Save not found', 1.2); return; } Sandbox.loadSaved(d); });
  M.querySelectorAll('[data-svdel]').forEach(b => b.onclick = () => { const s = Saves.list().find(x => x.id === b.dataset.svdel); if (s && confirm(`Delete "${s.name}"?`)) { Saves.remove(s.id); ren(); } });
  M.querySelectorAll('[data-svexp]').forEach(b => b.onclick = () => {
    const s = Saves.list().find(x => x.id === b.dataset.svexp), d = s && Saves.read(s.id); if (!d) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = s.name.replace(/[^\w\- ]+/g, '_') + '.bpsave.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
};
UI.toolExtra = function (O) {
  if (O.tool === 'light') return `<label>Light</label><div class="mats">${Object.entries(LIGHT_KINDS).map(([k, n]) => `<button data-lk="${k}" class="${O.lightKind === k ? 'on' : ''}">${n}</button>`).join('')}</div><label>Brightness <input type="range" id="optBright" min="0.25" max="3" step="0.05" value="${O.bright}"></label><p class="muted">E switches a light on and off. Wire a switch or a button + toggle latch to it to control it remotely.</p>`;
  if (O.tool === 'wire') return `<p class="muted">Outputs: button, switch, pressure plate, proximity sensor, timer, and the gates. Anything can take inputs: doors open, lights turn on, alarms sound, thrusters fire, wheels drive, lamps and emitters switch, dynamite goes off. Several wires into one thing act as OR (except gates). Get parts from the <b>Wiring</b> tab.</p>`;
  if (O.tool === 'hinge') return `<p class="muted">The axis runs through the surface you click first. Click a door's edge, then the wall (or empty world) to make it swing.</p>`;
  if (O.tool === 'repair') return `<p class="muted">Fixes vehicles to full health and puts out fires.</p>`;
  return '';
};
UI.bindToolExtra = function (M, O) {
  M.querySelectorAll('[data-lk]').forEach(b => b.onclick = () => { O.lightKind = b.dataset.lk; Sandbox.saveOpts(); this.renderSpawnMenu(); });
  const e = $('optBright'); if (e) e.oninput = () => { O.bright = +e.value; Sandbox.saveOpts(); };
};
