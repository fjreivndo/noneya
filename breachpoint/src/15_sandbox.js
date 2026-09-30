/* ═══════════════════════════════════════════════════════════════════════════
   Sandbox mode. Spawn props, entities, NPCs, weapons and jeeps from the
   spawn menu (Q); move and freeze things with the physics gun; build with
   the tool gun (weld, rope, balloon, thruster, dynamite, light, color,
   material, scale, remover). Z undoes, V noclips.

   Every change is an *action* (what someone asked for) that the authority
   turns into *events* (what happened). Events are applied the same way on
   the host and on every client, so solo and multiplayer share one path.
   ═══════════════════════════════════════════════════════════════════════════ */

TEAM_STYLE.Z = { name: 'Zombies', short: 'ZMB', color: '#8ad04a', uniform: '#4a5a3a', accent: '#5a3a2a', skin: '#8aa070', helmet: '#3a4a2a', glove: '#8aa070' };
TEAM_STYLE.N = { name: 'Citizens', short: 'CIV', color: '#d8d8d8', uniform: '#3a5a8a', accent: '#b8b0a0', skin: '#d8b090', helmet: '#4a3a2a', glove: '#d8b090' };
TEAM_STYLE.D = { name: 'Dummies', short: 'DUM', color: '#ff9a3a', uniform: '#d8a060', accent: '#c88040', skin: '#e0b070', helmet: '#c88040', glove: '#e0b070' };

/* who shoots whom: zombies hate everyone, citizens and dummies are never
   anyone's target except zombies' (and yours, if you insist) */
Game.hostile = function (a, b) {
  if (a === b || !b.alive) return false;
  if (a.team === 'Z') return b.team !== 'Z' && b.team !== 'D';
  if (b.team === 'Z') return true;
  if (b.team === 'N' || b.team === 'D' || a.team === 'N' || a.team === 'D') return false;
  if (b.ctrl === 'local' || b.ctrl === 'remote' || b.ctrl === 'puppet' && !b.isBot) { if (Sandbox.on && Sandbox.opts.ignorePlayers && a.isBot) return false; }
  return a.team !== b.team;
};

/* ── tools as weapons ──────────────────────────────────────────────────── */
WEAPONS.physgun = { id: 'physgun', name: 'Physics Gun', slot: 6, type: 'physgun', speed: 1, spread: 0.01, moveSpread: 0, recoil: 0, rpm: 600, build(g) {
  const B = new THREE.MeshLambertMaterial({ color: 0x2a3a4a }), G = new THREE.MeshBasicMaterial({ color: 0x5ad8ff });
  g.add(bx(0.05, 0.06, 0.26, B, 0, 0, -0.05)); g.add(cyl(0.025, 0.14, B, 0, 0.005, -0.24, 10)); g.add(cyl(0.03, 0.02, G, 0, 0.005, -0.31, 12));
  for (let i = 0; i < 3; i++) g.add(bx(0.056, 0.01, 0.01, G, 0, 0.022, -0.12 - i * 0.04));
  const gr = bx(0.03, 0.09, 0.04, B, 0, -0.07, 0.06); gr.rotation.x = -0.28; g.add(gr);
  g.userData.muzzle.position.set(0, 0.005, -0.33); g.userData.sight = { y: 0.05 };
} };
WEAPONS.toolgun = { id: 'toolgun', name: 'Tool Gun', slot: 7, type: 'tool', speed: 1, spread: 0.01, moveSpread: 0, recoil: 0, rpm: 300, build(g) {
  const B = new THREE.MeshLambertMaterial({ color: 0xd8d8d0 }), K = lam('#222'), S = new THREE.MeshBasicMaterial({ color: 0x1a8aff });
  g.add(bx(0.05, 0.07, 0.22, B, 0, 0, -0.03)); g.add(cyl(0.012, 0.12, K, 0, 0.01, -0.19)); g.add(bx(0.04, 0.035, 0.002, S, 0, 0.012, 0.081));
  const scr = bx(0.036, 0.03, 0.002, S, 0.026, 0.01, -0.03); scr.rotation.y = Math.PI / 2; g.add(scr);
  const gr = bx(0.03, 0.09, 0.04, K, 0, -0.07, 0.05); gr.rotation.x = -0.28; g.add(gr);
  g.userData.muzzle.position.set(0, 0.01, -0.25); g.userData.sight = { y: 0.05 };
} };
for (const id of ['physgun', 'toolgun']) WEAPONS[id].id = id;

/* ── catalog ───────────────────────────────────────────────────────────── */
const PMAT = {
  default: { name: 'Default' }, wood: { name: 'Wood', tex: 'wood' }, metal: { name: 'Metal', tex: 'metal' }, concrete: { name: 'Concrete', tex: 'concrete' },
  plastic: { name: 'Plastic' }, rubber: { name: 'Rubber' }, glass: { name: 'Glass', glass: true }, glow: { name: 'Glow', glow: true }, chrome: { name: 'Chrome', chrome: true }, crate: { name: 'Crate', tex: 'crate' },
};
const B3 = (x, y, z, off) => ({ t: 'box', h: [x, y, z], off });
const PROPS = {
  crate:     { name: 'Wood crate', cat: 'Props', shapes: [B3(0.4, 0.4, 0.4)], mass: 20, mat: 'crate' },
  crate_big: { name: 'Big crate', cat: 'Props', shapes: [B3(0.75, 0.75, 0.75)], mass: 70, mat: 'crate' },
  barrel:    { name: 'Barrel', cat: 'Props', shapes: [{ t: 'cyl', r: 0.3, h: 0.9 }], mass: 30, mat: 'metal', color: '#3a6aa0' },
  pallet:    { name: 'Pallet', cat: 'Props', shapes: [B3(0.6, 0.07, 0.5)], mass: 10, mat: 'wood' },
  plank:     { name: 'Plank', cat: 'Props', shapes: [B3(0.12, 0.04, 1.5)], mass: 8, mat: 'wood' },
  beam:      { name: 'Long beam', cat: 'Props', shapes: [B3(0.15, 0.15, 3)], mass: 40, mat: 'wood' },
  sheet:     { name: 'Metal sheet', cat: 'Props', shapes: [B3(1, 0.03, 1)], mass: 25, mat: 'metal' },
  panel:     { name: 'Big panel', cat: 'Props', shapes: [B3(2, 0.05, 2)], mass: 80, mat: 'metal', color: '#9aa0a8' },
  block:     { name: 'Concrete block', cat: 'Props', shapes: [B3(0.5, 0.5, 0.5)], mass: 200, mat: 'concrete' },
  barrier:   { name: 'Jersey barrier', cat: 'Props', shapes: [B3(0.3, 0.45, 1.2)], mass: 300, mat: 'concrete' },
  wall:      { name: 'Wall slab', cat: 'Props', shapes: [B3(1.5, 1.2, 0.1)], mass: 150, mat: 'concrete' },
  door:      { name: 'Door', cat: 'Props', shapes: [B3(0.5, 1, 0.03)], mass: 20, mat: 'wood', color: '#b08050' },
  fridge:    { name: 'Fridge', cat: 'Props', shapes: [B3(0.35, 0.9, 0.35)], mass: 90, mat: 'plastic', color: '#e8e8e4' },
  dumpster:  { name: 'Dumpster', cat: 'Props', shapes: [B3(1, 0.6, 0.6)], mass: 250, mat: 'metal', color: '#2e6a3a' },
  chair:     { name: 'Chair', cat: 'Props', shapes: [B3(0.22, 0.03, 0.22, [0, 0.45, 0]), B3(0.22, 0.25, 0.03, [0, 0.73, 0.19]), B3(0.2, 0.21, 0.2, [0, 0.21, 0])], mass: 6, mat: 'wood', parts: 'chair' },
  table:     { name: 'Table', cat: 'Props', shapes: [B3(0.7, 0.03, 0.45, [0, 0.74, 0]), B3(0.03, 0.36, 0.03, [0.62, 0.36, 0.38]), B3(0.03, 0.36, 0.03, [-0.62, 0.36, 0.38]), B3(0.03, 0.36, 0.03, [0.62, 0.36, -0.38]), B3(0.03, 0.36, 0.03, [-0.62, 0.36, -0.38])], mass: 20, mat: 'wood' },
  car:       { name: 'Car wreck', cat: 'Props', shapes: [B3(0.95, 0.35, 2.1, [0, 0.6, 0]), B3(0.85, 0.3, 1.05, [0, 1.25, 0.15])], mass: 900, mat: 'metal', color: '#8a2a2a', parts: 'car' },
  pipe:      { name: 'Pipe', cat: 'Props', shapes: [{ t: 'cyl', r: 0.1, h: 3 }], mass: 20, mat: 'metal', color: '#7a7e84' },
  tire:      { name: 'Tire', cat: 'Props', shapes: [{ t: 'cyl', r: 0.4, h: 0.25 }], mass: 12, mat: 'rubber', color: '#1a1a1a', bouncy: true },
  cone:      { name: 'Traffic cone', cat: 'Props', shapes: [{ t: 'cyl', r: 0.14, h: 0.5 }], mass: 1.5, mat: 'plastic', color: '#ff6a1a', parts: 'cone' },
  ball:      { name: 'Ball', cat: 'Props', shapes: [{ t: 'sphere', r: 0.35 }], mass: 4, mat: 'rubber', color: '#e03030', bouncy: true },
  bigball:   { name: 'Big ball', cat: 'Props', shapes: [{ t: 'sphere', r: 1 }], mass: 40, mat: 'plastic', color: '#3a8ae0', bouncy: true },
  melon:     { name: 'Melon', cat: 'Props', shapes: [{ t: 'sphere', r: 0.18 }], mass: 2, mat: 'plastic', color: '#3a8a2a', parts: 'melon' },
  // entities
  barrel_ex: { name: 'Explosive barrel', cat: 'Entities', shapes: [{ t: 'cyl', r: 0.3, h: 0.9 }], mass: 30, mat: 'metal', color: '#c02a1a', explosive: 130, hp: 25, parts: 'hazard' },
  health:    { name: 'Health kit', cat: 'Entities', shapes: [B3(0.2, 0.1, 0.15)], mass: 3, mat: 'plastic', color: '#f0f0f0', use: 'health', parts: 'cross' },
  ammo:      { name: 'Ammo crate', cat: 'Entities', shapes: [B3(0.3, 0.18, 0.2)], mass: 10, mat: 'metal', color: '#4a5a2a', use: 'ammo' },
  balloon:   { name: 'Balloon', cat: 'Entities', shapes: [{ t: 'sphere', r: 0.35 }], mass: 0.5, mat: 'plastic', color: '#ff3a8a', lift: 14, parts: 'balloon', damping: 0.6 },
  dynamite:  { name: 'Dynamite', cat: 'Entities', shapes: [B3(0.05, 0.05, 0.12)], mass: 1, mat: 'plastic', color: '#c01a1a', explosive: 150, hp: 5, dynamite: true },
  lightbulb: { name: 'Light', cat: 'Entities', shapes: [{ t: 'sphere', r: 0.12 }], mass: 1, mat: 'glow', color: '#ffe8a0', light: true },
};
for (const k in PROPS) {
  const d = PROPS[k]; d.id = k; let r = 0;
  for (const s of d.shapes) { const o = s.off || [0, 0, 0], ext = s.t === 'sphere' ? s.r : s.t === 'cyl' ? Math.hypot(s.r, s.h / 2) : Math.hypot(...s.h); r = Math.max(r, Math.hypot(...o) + ext); }
  d.radius = r;
}
const NPCS = {
  aegis:   { name: 'Aegis soldier', team: 'CT', weapon: 'm4a4', desc: 'Fights Vanta and zombies. Follows you if you are Aegis.' },
  vanta:   { name: 'Vanta soldier', team: 'T', weapon: 'ak47', desc: 'Fights Aegis and zombies. Follows you if you are Vanta.' },
  zombie:  { name: 'Zombie', team: 'Z', weapon: null, desc: 'Shambles at anything alive and bites.' },
  citizen: { name: 'Citizen', team: 'N', weapon: null, desc: 'Wanders. Runs from gunfire and zombies.' },
  dummy:   { name: 'Target dummy', team: 'D', weapon: null, desc: 'Stands still. Good for testing damage.' },
};
const TOOLS = {
  remover:  { name: 'Remover', lmb: 'remove what you aim at', rmb: 'remove its welds and ropes' },
  weld:     { name: 'Weld', lmb: 'click two things to weld them', rmb: 'cancel' },
  rope:     { name: 'Rope', lmb: 'click two points to tie a rope', rmb: 'tight rope (pulls them together)', opts: ['slack'] },
  balloon:  { name: 'Balloon', lmb: 'tie a balloon here', rmb: 'tie a balloon on a longer string', opts: ['lift', 'color'] },
  thruster: { name: 'Thruster', lmb: 'stick a thruster here (hold T to fire)', rmb: 'reverse thruster', opts: ['force'] },
  dynamite: { name: 'Dynamite', lmb: 'place dynamite (press K to blow)', rmb: 'place a bigger charge', opts: [] },
  light:    { name: 'Light', lmb: 'place a light', rmb: 'stick a light to a prop', opts: ['color'] },
  color:    { name: 'Color', lmb: 'paint', rmb: 'pick up the color', opts: ['color'] },
  material: { name: 'Material', lmb: 'apply material', rmb: 'reset', opts: ['material'] },
  scale:    { name: 'Scale', lmb: 'grow', rmb: 'shrink' },
  freezer:  { name: 'Freezer', lmb: 'freeze', rmb: 'unfreeze' },
};

/* ── prop meshes ───────────────────────────────────────────────────────── */
function propMaterial(matId, color) {
  const m = PMAT[matId] || PMAT.default;
  if (m.glow) return new THREE.MeshBasicMaterial({ color: color || '#ffe8a0' });
  if (m.glass) return new THREE.MeshLambertMaterial({ color: color || '#bfe4ff', transparent: true, opacity: 0.35, depthWrite: false });
  if (m.chrome) return new THREE.MeshPhongMaterial({ color: color || '#dfe4ea', shininess: 120, specular: 0xffffff });
  if (m.tex) { initSurfaces(); return new THREE.MeshLambertMaterial({ map: Tex[m.tex], color: color || '#ffffff' }); }
  return new THREE.MeshLambertMaterial({ color: color || '#b8b8b8' });
}
function buildPropMesh(def, p = {}) {
  const g = new THREE.Group(), mat = propMaterial(p.mat || def.mat, p.color || def.color);
  for (const sh of def.shapes) {
    let geo;
    if (sh.t === 'box') geo = boxGeo(sh.h[0] * 2, sh.h[1] * 2, sh.h[2] * 2, 1);
    else if (sh.t === 'sphere') geo = new THREE.SphereGeometry(sh.r, 16, 12);
    else geo = new THREE.CylinderGeometry(sh.r, sh.r, sh.h, 16);
    if (def.parts === 'cone' && sh.t === 'cyl') geo = new THREE.ConeGeometry(sh.r, sh.h, 14);
    const m = new THREE.Mesh(geo, mat); if (sh.off) m.position.set(...sh.off); g.add(m);
  }
  const K = lam('#1a1a1a');
  if (def.parts === 'car') { for (const [x, z] of [[-0.9, -1.3], [0.9, -1.3], [-0.9, 1.3], [0.9, 1.3]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12), K); w.rotation.z = Math.PI / 2; w.position.set(x, 0.3, z); g.add(w); } g.add(bx(1.6, 0.4, 0.02, lam('#223'), 0, 1.2, -0.9)); }
  if (def.parts === 'hazard') { g.add(bx(0.62, 0.1, 0.62, lam('#f0d020'), 0, 0.2, 0)); }
  if (def.parts === 'cross') { const R = lam('#d01818'); g.add(bx(0.18, 0.005, 0.05, R, 0, 0.1, 0)); g.add(bx(0.05, 0.005, 0.18, R, 0, 0.1, 0)); }
  if (def.parts === 'melon') { for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.006, 4, 24), lam('#1a5a1a')); s.rotation.y = i * Math.PI / 6; g.add(s); } }
  if (def.parts === 'balloon') { const k = bx(0.04, 0.05, 0.04, mat, 0, -0.37, 0); g.add(k); }
  if (def.light) { const L = new THREE.PointLight(p.color || def.color, 6, 14); g.add(L); g.userData.light = L; }
  if (p.thrusters) for (const t of p.thrusters) addThrusterMesh(g, t);
  return g;
}
function addThrusterMesh(g, t) {
  const m = new THREE.Group(); m.add(cyl(0.07, 0.14, lam('#3a3a3a'), 0, 0, 0, 10)); m.add(cyl(0.05, 0.02, new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 0, 0, 0.075, 10));
  m.position.set(...t.at); m.quaternion.setFromUnitVectors(new V3(0, 0, 1), new V3(...t.dir).negate()); g.add(m); t.mesh = m;
}

/* ── thumbnails for the spawn menu ─────────────────────────────────────── */
const Thumbs = {
  r: null, cache: {},
  get(key, build) {
    if (this.cache[key]) return this.cache[key];
    try {
      if (!this.r) { this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); this.r.setSize(128, 128); this.r.outputColorSpace = THREE.SRGBColorSpace; this.scene = new THREE.Scene(); this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555544, 2)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 3, 4); this.scene.add(d); this.cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100); }
      const obj = build(); this.scene.add(obj);
      const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new V3()), size = box.getSize(new V3()).length() || 1;
      this.cam.position.set(c.x + size * 0.9, c.y + size * 0.6, c.z + size * 1.3); this.cam.lookAt(c);
      this.r.render(this.scene, this.cam); const url = this.r.domElement.toDataURL();
      this.scene.remove(obj);
      return this.cache[key] = url;
    } catch (e) { return this.cache[key] = ''; }
  },
};

/* ── maps ──────────────────────────────────────────────────────────────── */
function buildFlatgrass() {
  const S = 100; World.bounds = { x0: -S, z0: -S, x1: S, z1: S };
  groundPlane('grass', 240, '#ffffff');
  for (let i = -S; i < S; i += 20) { World.add(i, 0, -S - 2, i + 20, 14, -S, 'concrete', '#b8b8b0'); World.add(i, 0, S, i + 20, 14, S + 2, 'concrete', '#b8b8b0'); World.add(-S - 2, 0, i, -S, 14, i + 20, 'concrete', '#b8b8b0'); World.add(S, 0, i, S + 2, 14, i + 20, 'concrete', '#b8b8b0'); }
  // the construct: a big hall with doors and a roof you can reach by stairs
  const hx = 0, hz = -30, w = 24, d = 16, H = 6, t = 0.4;
  const wallX = (z, gapAt) => { World.add(hx - w / 2, 0, z - t / 2, gapAt - 1.5, H, z + t / 2, 'concrete', '#d0d0c8'); World.add(gapAt + 1.5, 0, z - t / 2, hx + w / 2, H, z + t / 2, 'concrete', '#d0d0c8'); World.add(gapAt - 1.5, 3, z - t / 2, gapAt + 1.5, H, z + t / 2, 'concrete', '#d0d0c8'); };
  wallX(hz + d / 2, hx); wallX(hz - d / 2, hx + 6);
  World.add(hx - w / 2 - t / 2, 0, hz - d / 2, hx - w / 2 + t / 2, H, hz + d / 2, 'concrete', '#d0d0c8'); World.add(hx + w / 2 - t / 2, 0, hz - d / 2, hx + w / 2 + t / 2, H, hz + d / 2, 'concrete', '#d0d0c8');
  World.add(hx - w / 2 - 0.3, H, hz - d / 2 - 0.3, hx + w / 2 + 0.3, H + 0.3, hz + d / 2 + 0.3, 'concrete', '#a8a8a0');
  for (let i = 0; i < 18; i++) World.add(hx + w / 2 + 0.3, 0, hz + d / 2 - 1 - i * 0.8, hx + w / 2 + 2.3, (i + 1) * 0.35, hz + d / 2 - 0.2 - i * 0.8, 'concrete', '#bcbcb4');
  // building platforms and a stepped ramp
  World.add(30, 0, 10, 40, 2, 20, 'metal', '#8a9098'); for (let i = 0; i < 6; i++) World.add(30 - (i + 1) * 0.9, 0, 12, 30 - i * 0.9, 2 - (i + 1) * 0.33 + 0.33, 18, 'metal', '#8a9098');
  World.add(-40, 0, 20, -30, 1, 30, 'wood'); World.add(-38, 1, 22, -32, 2, 28, 'wood'); World.add(-36, 2, 24, -34, 3, 26, 'wood');
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; tree(Math.cos(a) * 70, Math.sin(a) * 70, 1.1); }
  World.spawns.CT = []; World.spawns.T = [];
  for (let i = 0; i < 8; i++) { World.spawns.CT.push({ x: -6 + i * 1.8, z: 30, yaw: 0 }); World.spawns.T.push({ x: -6 + i * 1.8, z: 34, yaw: 0 }); }
  World.zones.push({ name: 'The Construct', x0: -12, z0: -38, x1: 12, z1: -22 }, { name: 'Spawn', x0: -15, z0: 25, x1: 15, z1: 40 });
  World.skyColor = 0x8fc0ee; World.fog = [0xc8dcee, 150, 600]; World.sun = 0xfff6e8;
}
MAPS.flatgrass = { name: 'Flatgrass', build: buildFlatgrass, modes: ['sandbox'], desc: 'Big open field and a building. Made for building things.' };
MODES.sandbox = { id: 'sandbox', name: 'Sandbox', headMult: 2.5, armor: false, teamSize: 0, respawn: true, respawnTime: 2, regen: true, sprint: true, maps: ['flatgrass', 'dustyard', 'ridgeline'] };

/* ── NPC brains ────────────────────────────────────────────────────────── */
class ZombieBrain extends Brain {
  constructor(s) { super(s); this.biteT = 0; this.groanT = rand(2, 6); }
  update(dt) {
    const s = this.s; if (!s.alive || s.heldBy) return;
    const in_ = s.moveIn; in_.f = in_.s = 0; in_.jump = in_.crouch = in_.walk = in_.sprint = false;
    this.biteT -= dt; this.groanT -= dt; this.senseT -= dt;
    if (this.groanT <= 0) { this.groanT = rand(3, 7); Sfx.play('hurt', s.pos, { vol: 0.5 }); }
    if (this.senseT <= 0) {
      this.senseT = 0.3; let best = null, bd = 1e9;
      for (const e of Game.soldiers) { if (!Game.hostile(s, e)) continue; const d = dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z); if (d > 45 || d > bd) continue; if (d > 14 && !World.los(s.pos.x, s.eyeY, s.pos.z, e.pos.x, e.eyeY, e.pos.z)) continue; best = e; bd = d; }
      this.target = best;
    }
    const e = this.target;
    if (e && e.alive) {
      const d = dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z);
      this.turnTo(Math.atan2(-(e.pos.x - s.pos.x), -(e.pos.z - s.pos.z)), 0, dt, 6);
      if (d > 1.3) this.moveTo(e.pos, dt, false); else if (this.biteT <= 0) { this.biteT = 0.9; Sfx.play('knife', s.pos); Game.damage(e, 22, s, 'zombie', 'chest'); }
    } else {
      if (!this.wander || dist2(s.pos.x, s.pos.z, this.wander.x, this.wander.z) < 1.5 || chance(dt * 0.1)) this.wander = World.nav.randomNear(s.pos.x, s.pos.z, 12);
      this.moveTo(this.wander, dt, true); this.lookAround(dt, null);
    }
  }
}
class CitizenBrain extends Brain {
  update(dt) {
    const s = this.s; if (!s.alive || s.heldBy) return;
    const in_ = s.moveIn; in_.f = in_.s = 0; in_.jump = in_.crouch = in_.walk = in_.sprint = false;
    const scared = this.heard && Game.now - this.heard.t < 5;
    let threat = null; for (const e of Game.soldiers) if (e.alive && e.team === 'Z' && dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z) < 15) threat = e;
    if (scared || threat) {
      const from = threat ? threat.pos : this.heard, dx = s.pos.x - from.x, dz = s.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
      if (!this.flee || Game.now > this.fleeT) { this.flee = World.nav.randomNear(s.pos.x + dx / l * 18, s.pos.z + dz / l * 18, 5); this.fleeT = Game.now + 3; }
      this.moveTo(this.flee, dt, false, false, true);
    } else {
      if (!this.wander || dist2(s.pos.x, s.pos.z, this.wander.x, this.wander.z) < 1.5) this.wander = World.nav.randomNear(s.pos.x, s.pos.z, 14);
      this.moveTo(this.wander, dt, true);
    }
    this.lookAround(dt, null);
  }
}
class IdleBrain extends Brain { update() { const m = this.s.moveIn; m.f = m.s = 0; m.jump = m.crouch = m.walk = m.sprint = false; } }

/* ── the sandbox ───────────────────────────────────────────────────────── */
const Sandbox = {
  on: false, opts: Object.assign({ tool: 'weld', color: '#ff4a4a', material: 'metal', slack: 1.2, lift: 10, force: 900, faction: 'CT', npcWeapon: 'default', ignorePlayers: false, npcSkill: 'normal' }, Store.get('sbx_opts', {}), { v: 2 }),
  undo: {}, hold: {}, pick: null, nextNpc: 1, beam: null, keysDown: {},
  saveOpts() { Store.set('sbx_opts', this.opts); },
  start() {
    this.on = true; this.undo = {}; this.hold = {}; this.pick = null; this.keysDown = {};
    Phys.init();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 24), 3));
    this.beam = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x6ae0ff, transparent: true, opacity: 0.9 })); this.beam.frustumCulled = false; this.beam.visible = false; Game.scene.add(this.beam);
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x6ae0ff })); this.marker.visible = false; Game.scene.add(this.marker);
    this.laserDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(255,40,40,1)', 'rgba(255,0,0,0)'), depthTest: true, transparent: true })); this.laserDot.scale.setScalar(0.12); this.laserDot.visible = false; Game.scene.add(this.laserDot);
  },
  stop() { this.on = false; Phys.clear(); },
  loadout(s) {
    s.weapons = { 1: null, 2: 'p2000', 3: 'knife', 4: null, 6: 'physgun', 7: 'toolgun' }; s.ammo = {}; s.nades = { frag: 0, flash: 0, smoke: 0 };
    s.fillAmmo('p2000'); s.cur = 'physgun'; s.drawT = 0.3;
  },
  /* where the player is looking: world, prop or soldier */
  trace(s, maxD = 450) {
    const o = s.eye(new V3()), d = s.forward(new V3());
    let t = World.raycast(o.x, o.y, o.z, d.x, d.y, d.z, maxD); const n = new V3(World.hit.nx, World.hit.ny, World.hit.nz); if (t < 0) t = maxD;
    const ph = Phys.ray(o, d, t); if (ph) { t = ph.t; n.copy(ph.n); }
    const sh = raySoldiers(o, d, t, s, Game.soldiers);
    const vh = !sh && Game.rayVehicles(o, d, t);
    if (sh) return { kind: 'npc', s: sh.s, t: sh.t, p: o.clone().addScaledVector(d, sh.t), n: d.clone().negate() };
    if (vh) return { kind: 'veh', v: vh.v, t: vh.t, p: o.clone().addScaledVector(d, vh.t), n: d.clone().negate() };
    const p = o.clone().addScaledVector(d, t);
    if (ph) return { kind: 'prop', prop: ph.p, t, p, n };
    return { kind: t < maxD ? 'world' : 'none', t, p, n };
  },
  /* place something so it rests on the surface you're aiming at */
  spawnPoint(s, radius) {
    const tr = this.trace(s, 250), p = tr.kind === 'none' ? s.eye(new V3()).addScaledVector(s.forward(new V3()), 8) : tr.p;
    return p.clone().addScaledVector(tr.n.lengthSq() ? tr.n : new V3(0, 1, 0), radius + 0.05);
  },

  /* ── actions: from the local player, or from a client via the host ── */
  exec(a) { if (!Game.local) return; a.by = Game.local.id; if (Game.authority()) this.run(a); else Net.send({ t: 'sbx', a }); },
  run(a) {
    const actor = Game.byId(a.by); if (!actor) return;
    const undo = this.undo[a.by] || (this.undo[a.by] = []);
    switch (a.op) {
      case 'prop': {
        const def = PROPS[a.k]; if (!def) return;
        const id = 'e' + (Phys.nextId++); const yaw = a.yaw || 0;
        this.emit({ e: 'add', id, k: a.k, pos: a.pos, quat: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], sc: 1, own: a.by });
        undo.push({ kind: 'ent', id }); break;
      }
      case 'npc': {
        const n = NPCS[a.k]; if (!n) return;
        const id = 'n' + (this.nextNpc++) + uid(3), weapon = a.w && a.w !== 'default' ? a.w : n.weapon;
        const att = {}; if (weapon && WEAPONS[weapon] && WEAPONS[weapon].mag) att[weapon] = randomAttach(weapon);
        this.emit({ e: 'npc', id, k: a.k, name: n.name.split(' ')[0] + ' ' + pick(BOT_NAMES), team: n.team, w: weapon, pos: a.pos, yaw: a.yaw || 0, att });
        undo.push({ kind: 'npc', id }); break;
      }
      case 'veh': { const id = 'v' + uid(5); this.emit({ e: 'veh', id, x: a.pos[0], z: a.pos[2], yaw: a.yaw || 0, k: VKIND[a.k] ? a.k : 'jeep' }); undo.push({ kind: 'veh', id }); break; }
      case 'undo': {
        let u; while ((u = undo.pop())) { if (this.exists(u)) break; }
        if (!u) return;
        if (u.kind === 'con') this.emit({ e: 'cdel', id: u.id }); else if (u.kind === 'npc') this.emit({ e: 'npcdel', id: u.id }); else if (u.kind === 'veh') this.emit({ e: 'vehdel', id: u.id }); else this.emit({ e: 'del', id: u.id });
        const pr = Net.peerOf(a.by); if (pr) Net.to(pr.id, { t: 'toast', x: 'Undone' }); if (actor === Game.local) HUD.center('Undone', 0.8);
        break;
      }
      case 'remove': this.removeEntity(a.id); break;
      case 'uncon': for (const c of Phys.constraints.filter(c => (c.a && c.a.id === a.id) || (c.b && c.b.id === a.id))) this.emit({ e: 'cdel', id: c.id }); break;
      case 'npcdel': if (Game.byId(a.id) && Game.byId(a.id).npc) this.emit({ e: 'npcdel', id: a.id }); break;
      case 'vehdel': this.emit({ e: 'vehdel', id: a.id }); break;
      case 'set': { const p = Phys.byId.get(a.id); if (!p) return; const ev = { e: 'set', id: a.id }; if (a.col) ev.col = a.col; if (a.mat) ev.mat = a.mat; if (a.sc) ev.sc = clamp(a.sc, 0.25, 4); if (a.fr != null) ev.fr = a.fr; this.emit(ev); break; }
      case 'con': {
        const A = a.a && Phys.byId.get(a.a), B = a.b && Phys.byId.get(a.b); if (!A && !B) return;
        const id = 'c' + (Phys.nextId++); this.emit({ e: 'con', id, type: a.type, a: a.a, b: a.b, la: a.la, lb: a.lb, len: a.len });
        undo.push({ kind: 'con', id }); break;
      }
      case 'balloon': {
        const target = a.a && Phys.byId.get(a.a); const bid = 'e' + (Phys.nextId++), cid = 'c' + (Phys.nextId++);
        this.emit({ e: 'add', id: bid, k: 'balloon', pos: [a.pos[0], a.pos[1] + a.len, a.pos[2]], sc: 1, col: a.col, own: a.by, lk: a.lift });
        this.emit({ e: 'con', id: cid, type: 'balloon', a: target ? target.id : null, la: target ? a.la : a.pos, b: bid, lb: [0, -0.37, 0], len: a.len });
        undo.push({ kind: 'ent', id: bid }); break;
      }
      case 'thruster': { const p = Phys.byId.get(a.id); if (!p) return; this.emit({ e: 'thr', id: a.id, at: a.at, dir: a.dir, force: a.force, key: a.key || 'KeyT', own: a.by }); break; }
      case 'key': {
        for (const p of Phys.props) {
          if (p.thrusters) for (const t of p.thrusters) if (t.own === a.by && t.key === a.key) t.on = a.down;
          if (a.down && p.def.dynamite && p.own === a.by && a.key === 'KeyK') { const pos = new V3(p.x, p.y, p.z); this.removeEntity(p.id); this.explode(pos, p.def.explosive * p.scale, 6 * Math.sqrt(p.scale), actor); }
        }
        this.emit({ e: 'thrk', by: a.by, key: a.key, down: a.down });
        break;
      }
      case 'phit': { const p = Phys.byId.get(a.id); if (!p) return; Phys.impulse(p, new V3(...a.p), new V3(...a.d), a.f); Phys.damage(p, a.dmg, actor, null); break; }
      case 'grab': {
        const h = { id: a.id, sid: a.sid, local: a.local, target: a.target, rot: null };
        if (a.id) { const p = Phys.byId.get(a.id); if (!p) return; if (p.frozen) this.emit({ e: 'set', id: p.id, fr: false }); p.held = true; }
        if (a.sid) { const s = Game.byId(a.sid); if (!s) return; s.heldBy = a.by; }
        this.hold[a.by] = h; break;
      }
      case 'move': { const h = this.hold[a.by]; if (!h) return; h.target = a.target; if (a.rot) h.rot = (h.rot || []).concat([a.rot]); break; }
      case 'drop': {
        const h = this.hold[a.by]; if (!h) return; delete this.hold[a.by];
        if (h.id) { const p = Phys.byId.get(h.id); if (p) { p.held = false; if (a.freeze) this.emit({ e: 'set', id: p.id, fr: true }); } }
        if (h.sid) { const s = Game.byId(h.sid); if (s) s.heldBy = null; }
        break;
      }
      case 'unfreeze': { const p = Phys.byId.get(a.id); if (p) this.emit({ e: 'set', id: p.id, fr: false }); break; }
      case 'clear': { for (const p of Phys.props.slice()) this.removeEntity(p.id); for (const s of Game.soldiers.filter(x => x.npc)) this.emit({ e: 'npcdel', id: s.id }); break; }
      case 'clearnpc': for (const s of Game.soldiers.filter(x => x.npc)) this.emit({ e: 'npcdel', id: s.id }); break;
      case 'freezeall': for (const p of Phys.props) if (!p.frozen) this.emit({ e: 'set', id: p.id, fr: true }); break;
    }
  },
  exists(u) { return u.kind === 'con' ? Phys.constraints.some(c => c.id === u.id) : u.kind === 'npc' ? !!Game.byId(u.id) : u.kind === 'veh' ? Game.vehicles.some(v => v.id === u.id) : Phys.byId.has(u.id); },
  removeEntity(id) { if (Phys.byId.has(id)) this.emit({ e: 'del', id }); },
  explode(pos, dmg, radius, by) {
    this.emit({ e: 'boom', p: [pos.x, pos.y, pos.z], r: radius });
    Game.explosion(pos, dmg, radius, by, 'dynamite');
    for (const p of Phys.props.slice()) if (p.def.explosive && !p.dead && dist3(new V3(p.x, p.y, p.z), pos) < radius * 0.8) Phys.damage(p, 999, by);
  },
  emit(ev) { this.apply(ev); if (Net.role === 'host') Net.toAll({ t: 'sbxev', ev }); },

  /* ── events: identical on every machine ── */
  apply(ev) {
    switch (ev.e) {
      case 'add': { const p = Phys.add({ id: ev.id, def: PROPS[ev.k], k: ev.k, pos: ev.pos, quat: ev.quat, scale: ev.sc, color: ev.col, mat: ev.mat, frozen: ev.fr, thrusters: ev.thr ? ev.thr.map(t => Object.assign({}, t)) : null }); p.own = ev.own; if (ev.lk) p.liftK = ev.lk; if (ev.thr) p.thrusters = p.thrusters || []; Sfx.play('bounce', new V3(...ev.pos)); break; }
      case 'del': { const p = Phys.byId.get(ev.id); if (p) Phys.remove(p); for (const k in this.hold) if (this.hold[k].id === ev.id) delete this.hold[k]; break; }
      case 'set': {
        const p = Phys.byId.get(ev.id); if (!p) return;
        if (ev.col || ev.mat) { if (ev.col) p.color = ev.col; if (ev.mat) p.mat = ev.mat === 'reset' ? null : ev.mat; if (ev.mat === 'reset') p.color = null; const nm = propMaterial(p.mat || p.def.mat, p.color || p.def.color); p.mesh.traverse(o => { if (o.isMesh && !o.userData.keep && o.parent === p.mesh) o.material = nm; }); if (p.mesh.userData.light) p.mesh.userData.light.color.set(p.color || p.def.color); }
        if (ev.sc) Phys.setScale(p, ev.sc);
        if (ev.fr != null) { Phys.setFrozen(p, ev.fr); p.frozen = ev.fr; }
        break;
      }
      case 'con': {
        const A = ev.a ? Phys.byId.get(ev.a) : null, B = ev.b ? Phys.byId.get(ev.b) : null;
        const c = Phys.addConstraint({ id: ev.id, type: ev.type, a: A, b: B, la: ev.la, lb: ev.lb, len: ev.len });
        if (ev.type === 'balloon') c.balloon = B;
        break;
      }
      case 'cdel': { const c = Phys.constraints.find(c => c.id === ev.id); if (c) Phys.removeConstraint(c); break; }
      case 'thr': { const p = Phys.byId.get(ev.id); if (!p) return; const t = { at: ev.at, dir: ev.dir, force: ev.force, key: ev.key, own: ev.own, on: false }; (p.thrusters = p.thrusters || []).push(t); addThrusterMesh(p.mesh, t); break; }
      case 'thrk': for (const p of Phys.props) if (p.thrusters) for (const t of p.thrusters) if (t.own === ev.by && t.key === ev.key) t.on = ev.down; break;
      case 'npc': {
        if (Game.byId(ev.id)) return;
        const s = Game.addSoldier({ id: ev.id, name: ev.name, team: ev.team, ctrl: Game.authority() ? 'bot' : 'puppet', isBot: true, att: ev.att });
        s.npc = ev.k; if (Game.authority()) s.brain = ev.k === 'zombie' ? new ZombieBrain(s) : ev.k === 'citizen' ? new CitizenBrain(s) : ev.k === 'dummy' ? new IdleBrain(s) : new Brain(s);
        s.buildModel(Game.scene); s.alive = true; s.hp = ev.k === 'zombie' ? 90 : 100; s.pos.set(ev.pos[0], ev.pos[1], ev.pos[2]); s.yaw = ev.yaw; s.net.tx = ev.pos[0]; s.net.ty = ev.pos[1]; s.net.tz = ev.pos[2]; s.net.tyaw = ev.yaw;
        s.weapons = { 1: null, 2: null, 3: 'knife', 4: null }; s.ammo = {};
        if (ev.w && WEAPONS[ev.w]) { s.weapons[WEAPONS[ev.w].slot] = ev.w; s.fillAmmo(ev.w); s.cur = ev.w; } else s.cur = 'knife';
        if (ev.k === 'zombie') { s.speedK = 0.72; if (s.model) { const u = s.model.userData; u.gunMount.visible = false; u.arms.rotation.x = -0.3; } }
        if (ev.k === 'citizen' || ev.k === 'dummy') { if (s.model) s.model.userData.gunMount.visible = false; }
        if (ev.k === 'dummy') s.hp = 500;
        s.tag.visible = false;
        break;
      }
      case 'npcdel': Game.removeSoldier(ev.id); break;
      case 'veh': { const v = new Vehicle(ev.id, Sandbox.opts.faction || 'CT', { x: ev.x, z: ev.z, yaw: ev.yaw, team: 'CT', kind: ev.k || 'jeep' }); v.noRespawn = true; Game.vehicles.push(v); break; }
      case 'vehdel': { const v = Game.vehicles.find(x => x.id === ev.id); if (!v) return; for (const s of [v.driver, v.passenger]) if (s) Game.exitVehicle(s, true); Game.scene.remove(v.model); Game.vehicles = Game.vehicles.filter(x => x !== v); break; }
      case 'boom': { const p = new V3(...ev.p); FX.explosion(p); Sfx.play('explode', p); if (Game.local && dist3(Game.local.pos, p) < 20) HUD.shake(0.6); break; }
    }
  },
  /* full state for someone joining mid-session */
  snapshotAll() {
    return {
      props: Phys.props.map(p => ({ e: 'add', id: p.id, k: p.def.id, pos: [p.x, p.y, p.z], quat: [p.q.x, p.q.y, p.q.z, p.q.w], sc: p.scale, col: p.color, mat: p.mat, fr: p.frozen, own: p.own, lk: p.liftK, thr: p.thrusters ? p.thrusters.map(t => ({ at: t.at, dir: t.dir, force: t.force, key: t.key, own: t.own })) : null })),
      cons: Phys.constraints.map(c => ({ e: 'con', id: c.id, type: c.type, a: c.a && c.a.id, b: c.b && c.b.id, la: c.la, lb: c.lb, len: c.len })),
      veh: Game.vehicles.filter(v => v.noRespawn).map(v => ({ e: 'veh', id: v.id, x: v.pos.x, z: v.pos.z, yaw: v.yaw, k: v.kind })),
    };
  },

  /* ── per-frame (all machines): physgun holds, pickups, beams ── */
  update(dt) {
    if (!this.on) return;
    if (Game.authority()) {
      for (const by in this.hold) {
        const h = this.hold[by], T = new V3(...h.target);
        if (h.id) {
          const p = Phys.byId.get(h.id); if (!p || !p.body) { delete this.hold[by]; continue; }
          const G = Phys.anchor(p, h.local), v = T.sub(G).multiplyScalar(14), m = v.length(); if (m > 40) v.multiplyScalar(40 / m);
          p.body.velocity.set(v.x, v.y, v.z); p.body.angularVelocity.scale(0.6, p.body.angularVelocity);
          if (h.rot) { for (const r of h.rot) { const dq = new THREE.Quaternion(...r), q = dq.multiply(p.q); p.body.quaternion.set(q.x, q.y, q.z, q.w); p.q.copy(q); } h.rot = null; p.body.angularVelocity.set(0, 0, 0); }
          p.body.wakeUp();
        } else if (h.sid) {
          const s = Game.byId(h.sid); if (!s || !s.alive) { delete this.hold[by]; continue; }
          s.pos.set(T.x, Math.max(0, T.y - 1), T.z); s.vel.set(0, 0, 0);
        }
      }
      // touch pickups
      for (const p of Phys.props.slice()) {
        if (!p.def.use) continue;
        for (const s of Game.soldiers) {
          if (!s.alive || s.npc || dist3(new V3(s.pos.x, s.pos.y + 0.5, s.pos.z), new V3(p.x, p.y, p.z)) > 1.2) continue;
          if (p.def.use === 'health' && s.hp < 100) { s.hp = Math.min(100, s.hp + 25); this.removeEntity(p.id); Sfx.play('ui', s.pos); break; }
          if (p.def.use === 'ammo') { if (s.ctrl === 'local') this.refill(s); else { const pr = Net.peerOf(s.id); if (pr) Net.to(pr.id, { t: 'ev', e: { t: 'ammo', s: s.id } }); } this.removeEntity(p.id); break; }
        }
      }
    }
    // thruster flames
    for (const p of Phys.props) if (p.thrusters) for (const t of p.thrusters) if (t.on && t.mesh) { const w = new V3(); t.mesh.getWorldPosition(w); const d = new V3(...t.dir).applyQuaternion(p.q); FX.emit('add', w.x, w.y, w.z, 2, 6, [1, 0.6, 0.2], 0.2, 0, 0.3, d.multiplyScalar(-4)); }
    this.drawBeam();
    this.drawLaser();
  },
  refill(s) { for (const id in s.ammo) { const w = s.stat(id); s.ammo[id].res = Math.min(w.reserve * 2, s.ammo[id].res + w.mag * 3); } Sfx.play('reload', s.pos); HUD.center('Ammo +', 0.8); },
  drawBeam() {
    const L = Game.local; this.beam.visible = false; this.marker.visible = false;
    if (!L || !L.alive || L.cur !== 'physgun' || !this.myHold) return;
    const h = this.myHold; let G;
    if (h.id) { const p = Phys.byId.get(h.id); if (!p) { this.myHold = null; return; } G = Phys.anchor(p, h.local); }
    else { const s = Game.byId(h.sid); if (!s) { this.myHold = null; return; } G = s.eye(new V3()); }
    const M = Game.view && !Game.view.third ? Game.view.muzzleWorld(new V3()) : L.eye(new V3()), T = L.eye(new V3()).addScaledVector(L.forward(new V3()), h.dist);
    const a = this.beam.geometry.attributes.position.array;
    for (let i = 0; i < 24; i++) { const t = i / 23, u = 1 - t; const x = u * u * M.x + 2 * u * t * T.x + t * t * G.x, y = u * u * M.y + 2 * u * t * T.y + t * t * G.y, z = u * u * M.z + 2 * u * t * T.z + t * t * G.z; a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; }
    this.beam.geometry.attributes.position.needsUpdate = true; this.beam.visible = true; this.marker.position.copy(G); this.marker.visible = true;
  },
  drawLaser() {
    const L = Game.local, dot = this.laserDot; if (!dot) return; dot.visible = false;
    if (!L || !L.alive || !L.w || !L.w.laser || L.adsT > 0.5) return;
    const o = L.eye(new V3()), d = L.forward(new V3());
    let t = World.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 80); if (t < 0) return;
    const ph = Phys.ray(o, d, t); if (ph) t = ph.t; const sh = raySoldiers(o, d, t, L, Game.soldiers); if (sh) t = sh.t;
    dot.position.copy(o).addScaledVector(d, t - 0.03); dot.visible = true;
  },

  /* ── local controls while holding the physgun / toolgun ── */
  rotating(s) { return s.cur === 'physgun' && this.myHold && Input.down('KeyE'); },
  wheelUsed(s) { return s.cur === 'physgun' && !!this.myHold; },
  useTool(s, dt) {
    const I = Input;
    if (s.cur === 'physgun') {
      if (I.mouse.leftPressed && !this.myHold) {
        const tr = this.trace(s, 450);
        if (tr.kind === 'prop') { this.myHold = { id: tr.prop.id, local: Phys.worldToLocal(tr.prop, tr.p), dist: tr.t }; this.exec({ op: 'grab', id: tr.prop.id, local: this.myHold.local, target: [tr.p.x, tr.p.y, tr.p.z] }); Sfx.play('ui'); }
        else if (tr.kind === 'npc' && tr.s.npc) { this.myHold = { sid: tr.s.id, dist: tr.t }; this.exec({ op: 'grab', sid: tr.s.id, target: [tr.p.x, tr.p.y, tr.p.z] }); }
      }
      if (this.myHold) {
        if (I.mouse.wheel) this.myHold.dist = clamp(this.myHold.dist - I.mouse.wheel * Math.max(0.8, this.myHold.dist * 0.08), 1.2, 450);
        const T = s.eye(new V3()).addScaledVector(s.forward(new V3()), this.myHold.dist);
        let rot = null;
        if (I.down('KeyE') && (I.mouse.dx || I.mouse.dy)) {
          const cam = Game.camera, up = new V3(0, 1, 0), right = new V3(1, 0, 0).applyQuaternion(cam.quaternion);
          const q = new THREE.Quaternion().setFromAxisAngle(up, I.mouse.dx * 0.006).multiply(new THREE.Quaternion().setFromAxisAngle(right, I.mouse.dy * 0.006));
          rot = [q.x, q.y, q.z, q.w];
        }
        this.sendT = (this.sendT || 0) - dt;
        if (Game.authority() || this.sendT <= 0 || rot) { this.sendT = 1 / 20; this.exec({ op: 'move', target: [T.x, T.y, T.z], rot }); }
        if (I.mouse.rightPressed) { this.exec({ op: 'drop', freeze: true }); this.myHold = null; Sfx.play('pin'); HUD.center('Frozen', 0.6); }
        else if (!I.mouse.left) { this.exec({ op: 'drop' }); this.myHold = null; }
      } else if (I.hit('KeyR')) { const tr = this.trace(s); if (tr.kind === 'prop') { this.exec({ op: 'unfreeze', id: tr.prop.id }); HUD.center('Unfrozen', 0.6); } }
      return;
    }
    // tool gun
    if (!(I.mouse.leftPressed || I.mouse.rightPressed || I.hit('KeyR'))) return;
    const tool = this.opts.tool, tr = this.trace(s), rmb = I.mouse.rightPressed;
    if (I.hit('KeyR')) { this.pick = null; HUD.center(TOOLS[tool].name + ' reset', 0.6); return; }
    this.toolFx(s, tr);
    const prop = tr.kind === 'prop' ? tr.prop : null, P = [tr.p.x, tr.p.y, tr.p.z];
    const local = prop ? Phys.worldToLocal(prop, tr.p) : P;
    switch (tool) {
      case 'remover':
        if (prop) { if (rmb) { this.exec({ op: 'uncon', id: prop.id }); HUD.center('Constraints removed', 0.6); } else this.exec({ op: 'remove', id: prop.id }); }
        else if (tr.kind === 'npc' && tr.s.npc) this.execNpcDel(tr.s.id);
        else if (tr.kind === 'veh' && tr.v.noRespawn) this.execVehDel(tr.v.id);
        break;
      case 'weld':
        if (rmb) { this.pick = null; break; }
        if (!prop) break;
        if (!this.pick) { this.pick = { id: prop.id, l: local }; HUD.center('Weld: now click the second object', 1); }
        else if (this.pick.id !== prop.id) { this.exec({ op: 'con', type: 'weld', a: this.pick.id, la: this.pick.l, b: prop.id, lb: local }); this.pick = null; HUD.center('Welded', 0.6); }
        break;
      case 'rope':
        if (!this.pick) { this.pick = { id: prop ? prop.id : null, l: local, w: tr.p.clone(), tight: rmb }; HUD.center('Rope: click the other end', 1); }
        else { const len = this.pick.tight ? 0.4 : this.pick.w.distanceTo(tr.p) * this.opts.slack; this.exec({ op: 'con', type: 'rope', a: this.pick.id, la: this.pick.l, b: prop ? prop.id : null, lb: local, len }); this.pick = null; HUD.center('Roped', 0.6); }
        break;
      case 'balloon': if (tr.kind === 'none') break; this.exec({ op: 'balloon', a: prop ? prop.id : null, la: local, pos: P, len: rmb ? 4 : 1.8, lift: this.opts.lift, col: this.opts.color }); break;
      case 'thruster': if (!prop) break; { const n = tr.n.clone().applyQuaternion(prop.q.clone().invert()); const dir = rmb ? [n.x, n.y, n.z] : [-n.x, -n.y, -n.z]; this.exec({ op: 'thruster', id: prop.id, at: local, dir, force: this.opts.force }); HUD.center('Thruster on T', 0.8); } break;
      case 'dynamite': { if (tr.kind === 'none') break; const pos = tr.p.clone().addScaledVector(tr.n, 0.08); this.exec({ op: 'prop', k: 'dynamite', pos: [pos.x, pos.y, pos.z], yaw: s.yaw }); if (rmb) this.exec({ op: 'prop', k: 'dynamite', pos: [pos.x, pos.y + 0.15, pos.z], yaw: s.yaw }); HUD.center('Dynamite: press K', 0.8); break; }
      case 'light': { const pos = tr.p.clone().addScaledVector(tr.n, 0.15); this.exec({ op: 'prop', k: 'lightbulb', pos: [pos.x, pos.y, pos.z] }); break; }
      case 'color': if (prop) { if (rmb) { this.opts.color = prop.color || prop.def.color || '#ffffff'; this.saveOpts(); HUD.center('Picked ' + this.opts.color, 0.6); } else this.exec({ op: 'set', id: prop.id, col: this.opts.color }); } break;
      case 'material': if (prop) this.exec({ op: 'set', id: prop.id, mat: rmb ? 'reset' : this.opts.material }); break;
      case 'scale': if (prop) this.exec({ op: 'set', id: prop.id, sc: prop.scale * (rmb ? 0.8 : 1.25) }); break;
      case 'freezer': if (prop) this.exec({ op: 'set', id: prop.id, fr: !rmb }); break;
    }
    // the light we just made takes the tool's color
    if (tool === 'light') setTimeout(() => { const p = Phys.props[Phys.props.length - 1]; if (p && p.def.light) this.exec({ op: 'set', id: p.id, col: this.opts.color }); }, 60);
  },
  execNpcDel(id) { if (Game.authority()) this.emit({ e: 'npcdel', id }); else Net.send({ t: 'sbx', a: { op: 'npcdel', id } }); },
  execVehDel(id) { if (Game.authority()) this.emit({ e: 'vehdel', id }); else Net.send({ t: 'sbx', a: { op: 'vehdel', id } }); },
  toolFx(s, tr) {
    Sfx.play('ui'); const m = Game.view && !Game.view.third ? Game.view.muzzleWorld(new V3()) : s.eye(new V3());
    FX.tracer(m, tr.p, 0x6ab8ff); FX.emit('add', tr.p.x, tr.p.y, tr.p.z, 10, 2, [0.4, 0.7, 1], 0.3, 0, 1);
  },
  onKey(code, down) {
    if (!this.on || !Game.local) return;
    if (code === 'KeyT' || code === 'KeyK') { if (!!this.keysDown[code] === down) return; this.keysDown[code] = down; this.exec({ op: 'key', key: code, down }); }
  },
  /* spawn from the menu at the crosshair */
  spawn(kind, key) {
    const L = Game.local; if (!L || !L.alive) return;
    if (kind === 'prop') { const d = PROPS[key]; const p = this.spawnPoint(L, d.radius * 0.8); this.exec({ op: 'prop', k: key, pos: [p.x, p.y, p.z], yaw: L.yaw }); }
    else if (kind === 'npc') { const q = this.safeSpot(L, 0.4, 1.8); this.exec({ op: 'npc', k: key, w: this.opts.npcWeapon, pos: [q.x, q.y, q.z], yaw: L.yaw + Math.PI }); }
    else if (kind === 'veh') { const K = VKIND[key] || VKIND.jeep, q = this.safeSpot(L, K.r + 0.4, K.h, 120); this.exec({ op: 'veh', k: key, pos: [q.x, q.y, q.z], yaw: L.yaw }); }
    else if (kind === 'weapon') {
      if (isNade(key)) { L.nades[key] = Math.min(3, L.nades[key] + 1); } else { const w = WEAPONS[key]; if (w.slot === 4) { L.weapons[4] = key; L.fillAmmo(key); L.switchTo(key); } else L.give(key); }
      Sfx.play('buy');
    }
  },
};

/* NPC soldiers in sandbox: follow a friendly player, hunt hostiles they know
   about, otherwise mill around where they were spawned. */
Commander.prototype.thinkSandbox = function () {
  const bots = this.bots().filter(b => b.alive && b.npc && !(b.brain instanceof ZombieBrain) && !(b.brain instanceof CitizenBrain) && !(b.brain instanceof IdleBrain));
  const humans = Game.soldiers.filter(s => s.alive && !s.isBot && s.team === this.team);
  bots.forEach((b, i) => {
    const o = b.brain.order;
    if (b.brain.target) return;
    const lead = humans.sort((x, y) => dist2(x.pos.x, x.pos.z, b.pos.x, b.pos.z) - dist2(y.pos.x, y.pos.z, b.pos.x, b.pos.z))[0];
    if (lead && dist2(lead.pos.x, lead.pos.z, b.pos.x, b.pos.z) < 60) {
      if (dist2(lead.pos.x, lead.pos.z, b.pos.x, b.pos.z) > 6 || o.type !== 'hunt') { const a = i / Math.max(1, bots.length) * TAU; b.brain.setOrder({ type: 'hunt', pos: World.nav.randomNear(lead.pos.x + Math.cos(a) * 3, lead.pos.z + Math.sin(a) * 3, 2), at: Game.now }); }
      return;
    }
    const intel = [...this.intel.values()].filter(v => Game.now - v.t < 8 && dist2(v.pos.x, v.pos.z, b.pos.x, b.pos.z) < 70);
    if (intel.length) { if (o.type !== 'hunt' || Game.now - o.at > 6) b.brain.setOrder({ type: 'hunt', pos: nearbyPoint(intel[0].pos, 4), at: Game.now }); return; }
    if (o.type !== 'hold' && o.type !== 'hunt' || (o.type === 'hunt' && Game.now - o.at > 10)) { b.home = b.home || b.pos.clone(); b.brain.setOrder({ type: 'hold', pos: World.nav.randomNear(b.home.x, b.home.z, 6), look: { x: b.pos.x + rand(-5, 5), z: b.pos.z + rand(-5, 5) } }); }
  });
};
