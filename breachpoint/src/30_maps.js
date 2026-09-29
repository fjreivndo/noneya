/* ═══════════════════════════════════════════════════════════════════════════
   Three new maps.
   · Dockyard (Defuse, TDM, Zombies): a harbour quay with gantry cranes, a
     container yard (B) and a warehouse yard (A), lanes and a mid in between.
   · Frostpeak (Conquest, TDM, Zombies): a snowy mountain valley. Bunker
     outpost, radar station, a timber lodge, a cable-car station and a frozen
     lake, pine forest, a half-frozen river, and falling snow.
   · Oasis Ruins (Conquest, TDM, Zombies): desert dunes around an oasis lake
     with the C flag on its island. Temple ruins, a market, a caravanserai
     and the tombs, among palms and broken columns.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── new surfaces ──────────────────────────────────────────────────────── */
const _initSurfaces30 = initSurfaces;
initSurfaces = function () {
  _initSurfaces30();
  if (Tex.snow_n) return;
  makeSurface2('snow', { base: '#e6ecf2', noise: 0.08, bump: 2.5, rough: 0.75, paint(c, S, r, h) {
    dots(c, S, r, 900, ['#f4f8fc', '#d4dde8', '#ffffff', '#c8d4e2'], 0.5, 2.2);
    for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S, s = 6 + r() * 20; wrapped(S, x, y, s, (X, Y) => { c.fillStyle = rgba(0.06, '120,140,170'); c.beginPath(); c.ellipse(X, Y, s, s * 0.4, r() * 3, 0, TAU); c.fill(); h.fillStyle = '#707070'; h.beginPath(); h.ellipse(X, Y, s, s * 0.4, 0, 0, TAU); h.fill(); }); } } });
  makeSurface2('ice', { base: '#b8d4e4', noise: 0.12, bump: 1.5, rough: 0.12, metal: 0.05, paint(c, S, r, h) {
    cracks(c, S, r, 26, rgba(0.55, '240,250,255'), h); cracks(c, S, r, 10, rgba(0.35, '60,100,130'), null);
    dots(c, S, r, 60, ['#e8f4fa', '#9ec0d4'], 3, 10); } });
  makeSurface2('sandstone', { base: '#d2b07a', noise: 0.3, bump: 4, tint: [150, 110, 70, 0.8], paint(c, S, r, h) {
    const rows = 8, bh = S / rows; for (let row = 0; row < rows; row++) { const bw = S / (2 + (row % 2)); for (let k = 0; k * bw < S; k++) { const v = r(); c.fillStyle = `rgb(${200 + v * 30 | 0},${165 + v * 25 | 0},${110 + v * 20 | 0})`; c.fillRect(k * bw + 1.5, row * bh + 1.5, bw - 3, bh - 3); h.fillStyle = '#b8b8b8'; h.fillRect(k * bw + 1.5, row * bh + 1.5, bw - 3, bh - 3); } }
    h.globalCompositeOperation = 'source-over'; dots(c, S, r, 900, ['#b8945e', '#e2c490', '#a8844e'], 0.4, 1.6); cracks(c, S, r, 8, rgba(0.4, '90,60,30'), h); } });
  makeSurface2('container', { base: '#e0e2e4', noise: 0.14, bump: 5, rough: 0.6, metal: 0.1, tint: [140, 90, 60, 0.9], paint(c, S, r, h) {   // painted corrugated steel
    const n = 16, w = S / n; for (let i = 0; i < n; i++) { const g = c.createLinearGradient(i * w, 0, i * w + w, 0); g.addColorStop(0, '#b8babc'); g.addColorStop(0.5, '#f4f4f4'); g.addColorStop(1, '#b8babc'); c.fillStyle = g; c.fillRect(i * w, 0, w, S);
      const hg = h.createLinearGradient(i * w, 0, i * w + w, 0); hg.addColorStop(0, '#404040'); hg.addColorStop(0.5, '#c0c0c0'); hg.addColorStop(1, '#404040'); h.fillStyle = hg; h.fillRect(i * w, 0, w, S); }
    for (let i = 0; i < 12; i++) { const x = r() * S, y = r() * S; const g = c.createLinearGradient(0, y, 0, y + 50); g.addColorStop(0, rgba(0.35, '120,70,40')); g.addColorStop(1, rgba(0, '120,70,40')); c.fillStyle = g; c.fillRect(x, y, 2 + r() * 4, 50); } } });
  for (const k in _matCache) delete _matCache[k];
};

/* ── shared pieces ─────────────────────────────────────────────────────── */
function hqBlock(team, x, z, houseTex, houseCol) {
  const s = team === 'CT' ? 1 : -1; World.hq[team] = { x, z };
  sandbags(x - 12, z - 8 * s, x - 4, z - 8 * s + s); sandbags(x + 4, z - 8 * s, x + 12, z - 8 * s + s);
  house(x - 18, z + 2 * s, 8, 6, s > 0 ? 'n' : 's', houseTex, houseCol);
  for (let i = 0; i < 8; i++) World.spawns[team].push({ x: x - 8 + i * 2.2, z: z + 2 * s, yaw: s > 0 ? Math.PI : 0 });
}
/* jeeps, a tank, an APC, an attack helicopter, bikes and a quad per side */
function motorPool(team, x, z) {
  const s = team === 'CT' ? 1 : -1, yaw = s > 0 ? Math.PI : 0;
  const put = (kind, dx, dz) => { const K = VKIND[kind] || VKIND.jeep; for (let i = 0; i < 14; i++) { const px = x + dx + (i ? rand(-3, 3) : 0), pz = z + dz * s + (i ? rand(-3, 3) : 0); if (World.bodyFree(px, 0.05, pz, K.br || K.r || 1.5, K.bh || K.h || 2)) { World.vehicleSpawns.push({ team, x: px, z: pz, yaw, kind: kind === 'jeep' ? undefined : kind }); return; } } };
  put('jeep', 16, 0); put('jeep', 22, -3); put('tank', 32, -4); put('apc', 23, 6); put('attackheli', 34, 10); put('bike', 12, 6); put('bike', 13, 8); put('quad', 8, 5);
}
function perimeter(S, tex, col, capTex) {
  const r = mulberry(hashStr(tex + S)); for (let i = -S; i < S; i += 12) { const h = 10 + r() * 8;
    for (const [x, z, w, d] of [[i + 6, -S - 3, 13, 8], [i + 6, S + 3, 13, 8], [-S - 3, i + 6, 8, 13], [S + 3, i + 6, 8, 13]]) {
      World.add(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, tex, col, { ts: 3 }); if (capTex) World.add(x - w / 2 - 0.2, h, z - d / 2 - 0.2, x + w / 2 + 0.2, h + 0.6, z + d / 2 + 0.2, capTex, '#ffffff', { ts: 3 }); } }
}
function conquestFlags(list) {
  list.forEach(f => { World.flags.push(Object.assign({ owner: null, prog: 0, radius: 11 }, f)); const R = Math.max(16, (f.radius || 11) + 5); World.zones.push({ name: f.name + ' ' + f.label, x0: f.x - R, z0: f.z - R, x1: f.x + R, z1: f.z + R }); });
  World.zones.push({ name: 'Aegis HQ', x0: -30, z0: 84, x1: 30, z1: 110 }, { name: 'Vanta HQ', x0: -30, z0: -110, x1: 30, z1: -84 });
}
function scatter(n, seed, keepOut, fn) {
  const r = mulberry(seed);
  for (let i = 0; i < n; i++) { const x = (r() * 2 - 1) * 100, z = (r() * 2 - 1) * 92; if (keepOut(x, z)) continue; fn(x, z, r); }
}
function dirtRoad(x0, z0, x1, z1, tex = 'dirt', col) { const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)), mat(tex, col)); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2); World.deco(m); }

/* ══ Frostpeak ════════════════════════════════════════════════════════════ */
function snowTree(x, z, s = 1) {
  World.add(x - 0.28 * s, 0, z - 0.28 * s, x + 0.28 * s, 3.2 * s, z + 0.28 * s, 'wood', '#6a4a34');
  for (const [y, r, h] of [[2.6, 2.2, 3.2], [4.4, 1.7, 2.8], [6.0, 1.1, 2.2]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 8), mat('grass', '#2c4a38')); m.position.set(x, y * s, z); World.deco(m);
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * s * 0.82, h * s * 0.35, 8), mat('snow')); c.position.set(x, y * s + h * s * 0.33, z); World.deco(c);
  }
}
function bunker(cx, cz, w, d, doors) {
  house(cx, cz, w, d, doors, 'concrete', '#b4b8bc');
  World.add(cx - w / 2 - 0.5, 3.5, cz - d / 2 - 0.5, cx + w / 2 + 0.5, 4.1, cz + d / 2 + 0.5, 'snow', '#ffffff');   // snow on the roof
}
function watchtower(x, z) {
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) World.add(x + dx - 0.15, 0, z + dz - 0.15, x + dx + 0.15, 6, z + dz + 0.15, 'wood', '#6a4a34');
  World.add(x - 1.8, 6, z - 1.8, x + 1.8, 6.25, z + 1.8, 'wood', '#8a6a4a');
  for (const [a, b, c, d] of [[-1.8, -1.8, 1.8, -1.65], [-1.8, 1.65, 0.8, 1.8], [-1.8, -1.8, -1.65, 1.8], [1.65, -1.8, 1.8, 1.8]]) World.add(x + a, 6.25, z + b, x + c, 7.3, z + d, 'wood', '#6a4a34');
  World.add(x - 2, 8.6, z - 2, x + 2, 8.9, z + 2, 'wood', '#5a3a2a', { noCollide: false });
  for (let i = 0; i < 17; i++) { const z0 = z + 1.8 + (16 - i) * 0.4; World.add(x + 0.9, 0, z0, x + 1.8, (i + 1) * 0.36, z0 + 0.4, 'wood', '#7a5a3a'); }   // stairs up to the gap in the rail
}
function buildFrostpeak() {
  const S = 110; World.bounds = { x0: -S, z0: -S, x1: S, z1: S };
  groundPlane('snow', 260, '#ffffff');
  perimeter(S, 'rock', '#c8ccd2', 'snow');
  const flags = [
    { name: 'A', label: 'Outpost', x: -60, z: 52 }, { name: 'B', label: 'Radar', x: 58, z: 50 }, { name: 'C', label: 'Lodge', x: 0, z: 0 },
    { name: 'D', label: 'Cable Station', x: -58, z: -50 }, { name: 'E', label: 'Frozen Lake', x: 60, z: -54, radius: 12 },
  ];
  // A — bunker outpost
  bunker(-66, 46, 10, 7, 'es'); bunker(-52, 60, 7, 6, 'ws'); watchtower(-54, 44); sandbags(-62, 56, -57, 57); sandbags(-70, 56, -68, 60); World.add(-66, 0, 54, -64, 1.2, 55, 'crate');
  // B — radar station: a tower with a dome and a fenced compound
  World.add(56.5, 0, 46.5, 59.5, 10, 49.5, 'metal', '#a8b0b8');
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 12), mat('concrete', '#f0f2f4')); dome.position.set(58, 12.2, 48); World.deco(dome);
  bunker(66, 56, 8, 7, 'wn'); World.add(46, 0, 40, 46.3, 1.4, 54, 'metal', '#8a9098'); World.add(46, 0, 40, 54, 1.4, 40.3, 'metal', '#8a9098'); sandbags(50, 56, 54, 57);
  // C — the lodge: two timber buildings around a yard
  house(-10, -8, 9, 7, 'se', 'wood', '#8a5a3a'); house(10, 9, 9, 7, 'nw', 'wood', '#7a4a2a'); house(11, -10, 6, 6, 'sw', 'wood', '#8a5a3a');
  for (const [x, z] of [[-10, -3.2], [10, 4.2], [11, -6.7]]) World.add(x - 5, 3.2, z - 0.4, x + 5, 3.6, z + 0.4, 'snow');
  World.add(-3, 0, 2, -1, 1.1, 4, 'crate'); World.add(2, 0, -3, 4, 1.1, -1, 'crate'); World.add(-1.5, 0, -0.5, 1.5, 0.6, 0.5, 'wood', '#6a4a34');
  // D — cable-car station and pylon
  bunker(-50, -44, 10, 8, 'nw'); World.add(-67, 0, -57, -65, 18, -55, 'metal', '#8a3a2a'); World.add(-68, 18, -57.5, -64, 18.6, -54.5, 'metal', '#8a3a2a');
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.4), mat('metal', '#c83a2a')); cab.position.set(-66, 14, -52); World.deco(cab);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 80, 4), mat('metal', '#222')); wire.rotation.x = Math.PI / 2 - 0.12; wire.position.set(-66, 22, -95); World.deco(wire);
  sandbags(-60, -60, -56, -59); World.add(-62, 0, -46, -60, 2.2, -44, 'crate');
  // E — frozen lake with fishing huts; its ice is solid ground
  World.add(48, 0, -66, 74, 0.04, -44, 'ice', '#ffffff', { ts: 6 });
  house(52, -48, 4, 4, 's', 'wood', '#9a6a3a'); house(69, -62, 4, 4, 'n', 'wood', '#6a8aa0'); rock(62, -58, 3, 1.6, 2);
  // HQs and motor pools
  for (const k of ['CT', 'T']) { const z = k === 'CT' ? 98 : -98; hqBlock(k, 0, z, 'concrete', k === 'CT' ? '#9ab0c8' : '#c8a890'); motorPool(k, 0, z); }
  // a half-frozen river in the west with two crossings
  lake(-108, -10, -34, -3, 1.4); deck(-82, -12, -78, -1, true); deck(-50, -12, -46, -1, true);
  // forest and rocks
  const keep = (x, z) => flags.some(f => dist2(f.x, f.z, x, z) < 18) || (Math.abs(z) > 80 && Math.abs(x) < 42) || (z > -12 && z < -1 && x < -30) || Math.abs(x) < 5 || (Math.abs(z) < 4 && Math.abs(x) < 70);
  scatter(110, 4242, keep, (x, z, r) => { if (r() < 0.7) snowTree(x, z, 0.8 + r() * 0.6); else { const w = 1.5 + r() * 3, h = 0.9 + r() * 2, d = 1.5 + r() * 3; World.add(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 'rock', '#d8dce2', { ts: 3 }); World.add(x - w / 2 + 0.1, h, z - d / 2 + 0.1, x + w / 2 - 0.1, h + 0.25, z + d / 2 - 0.1, 'snow'); } });
  // stone walls between lanes
  [[-30, 30, -18, 30.6], [18, 28, 32, 28.6], [-34, -28, -20, -27.4], [22, -30, 36, -29.4], [-6, 50, 6, 50.6], [-6, -52, 6, -51.4]].forEach(([a, b, c, d]) => World.add(a, 0, b, c, 1.1, d, 'rock', '#c8ccd2'));
  dirtRoad(-2.5, -100, 2.5, 100, 'snow', '#c8ccd4'); dirtRoad(-70, -2.5, 70, 2.5, 'snow', '#c8ccd4');
  conquestFlags(flags);
  World.water.length && World.zones.push({ name: 'River', x0: -110, z0: -12, x1: -30, z1: 0 });
  World.skyColor = 0xbcc8d6; World.fog = [0xdde4ec, 70, 330]; World.sun = 0xf4f8ff;
}

/* ══ Oasis Ruins ══════════════════════════════════════════════════════════ */
function palm(x, z, s = 1) {
  World.add(x - 0.22 * s, 0, z - 0.22 * s, x + 0.22 * s, 6.5 * s, z + 0.22 * s, 'wood', '#8a6a4a');
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU, f = new THREE.Mesh(new THREE.ConeGeometry(0.5 * s, 3.4 * s, 4), mat('grass', i % 2 ? '#4a7a30' : '#5a8a38'));
    f.position.set(x + Math.cos(a) * 1.4 * s, 6.2 * s, z + Math.sin(a) * 1.4 * s); f.rotation.set(0, -a, 0); f.rotateZ(Math.PI / 2 + 0.35); f.scale.set(1, 1, 0.25); World.deco(f);
  }
}
function column(x, z, h, broken) {
  World.add(x - 0.6, 0, z - 0.6, x + 0.6, 0.4, z + 0.6, 'sandstone'); World.add(x - 0.4, 0.4, z - 0.4, x + 0.4, h, z + 0.4, 'sandstone', '#e8d0a0');
  if (!broken) World.add(x - 0.6, h, z - 0.6, x + 0.6, h + 0.4, z + 0.6, 'sandstone');
}
function stall(x, z, col) {
  for (const [dx, dz] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) World.add(x + dx - 0.08, 0, z + dz - 0.08, x + dx + 0.08, 2.4, z + dz + 0.08, 'wood', '#6a4a2a');
  World.add(x - 1.7, 2.4, z - 1.3, x + 1.7, 2.5, z + 1.3, 'plaster', col); World.add(x - 1.3, 0, z - 0.6, x + 1.3, 0.9, z + 0.6, 'wood', '#8a6a4a');
}
function buildOasis() {
  const S = 110; World.bounds = { x0: -S, z0: -S, x1: S, z1: S };
  groundPlane('sand', 260, '#f0e0c0');
  perimeter(S, 'sandstone', '#c8a070');
  const flags = [
    { name: 'A', label: 'Temple', x: -60, z: 52 }, { name: 'B', label: 'Market', x: 58, z: 50 }, { name: 'C', label: 'Oasis', x: 0, z: 0, radius: 7 },
    { name: 'D', label: 'Caravanserai', x: -58, z: -50 }, { name: 'E', label: 'Tombs', x: 60, z: -54 },
  ];
  // A — temple: a raised floor with steps, a colonnade and broken walls
  World.add(-72, 0, 44, -48, 1, 60, 'sandstone', '#e0c898'); for (let i = 0; i < 3; i++) World.add(-64 + i * 0, 0, 43 - (i + 1) * 0.9 + 0.9, -56, 1 - (i + 1) * 0.33 + 0.33, 44 - i * 0.9, 'sandstone', '#d8c090');
  for (let i = 0; i < 6; i++) { column(-70 + i * 4.4, 46, 6, i === 2 || i === 5); column(-70 + i * 4.4, 58, 6, i === 1); }
  World.add(-66, 1, 54, -60, 3.4, 55, 'sandstone'); World.add(-56, 1, 50, -55, 2.2, 56, 'sandstone'); World.add(-71, 7, 45, -49, 7.6, 47, 'sandstone', '#d8c090');
  // B — market: stalls, a house and crates
  stall(52, 44, '#c83a2a'); stall(58, 44, '#2a6ac8'); stall(64, 44, '#e0a030'); stall(52, 56, '#3a9a5a'); stall(64, 56, '#9a3ac8');
  house(70, 50, 6, 8, 'w', 'plaster', '#e8d8b8'); World.add(57, 0, 49, 59, 1.1, 51, 'crate'); World.add(47, 0, 49, 48, 1.8, 53, 'sandstone');
  // C — the oasis: a lake with the flag on its island, two footbridges, palms
  lake(-24, -18, 24, 18, 2.4, [-8, -7, 8, 7]);
  deck(-1.5, 6.5, 1.5, 18.5, true); deck(-1.5, -18.5, 1.5, -6.5, true);
  for (const [x, z] of [[-5, -4], [5, 4], [6, -4]]) palm(x, z, 0.8);
  World.add(-3, 0, 3, -1, 0.9, 4.5, 'sandstone'); World.add(2, 0, -2, 3.2, 1.2, 0, 'crate');
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; palm(Math.cos(a) * 36, Math.sin(a) * 30, 0.9 + (i % 3) * 0.15); }
  // D — caravanserai: a walled courtyard with gates and arcades
  const cx = -58, cz = -50, W = 11, T = 0.8, H = 4.2;
  const wallRun = (x0, z0, x1, z1) => World.add(x0, 0, z0, x1, H, z1, 'sandstone', '#e0c490');
  wallRun(cx - W, cz - W, cx - 2, cz - W + T); wallRun(cx + 2, cz - W, cx + W, cz - W + T); wallRun(cx - W, cz + W - T, cx - 2, cz + W); wallRun(cx + 2, cz + W - T, cx + W, cz + W);
  wallRun(cx - W, cz - W, cx - W + T, cz - 2); wallRun(cx - W, cz + 2, cx - W + T, cz + W); wallRun(cx + W - T, cz - W, cx + W, cz + W);
  for (let i = 0; i < 4; i++) column(cx - 6 + i * 4, cz - 4, 3.6, i === 3);
  World.add(cx - 1.5, 0, cz + 2, cx + 1.5, 0.9, cz + 4, 'sandstone'); World.add(cx + 5, 0, cz + 5, cx + 7, 1.1, cz + 7, 'crate');
  // E — tombs: a stepped pyramid, obelisks and sarcophagi
  for (let i = 0; i < 4; i++) World.add(64 - 8 + i * 1.6, i * 1.4, -62 + i * 1.6, 64 + 8 - i * 1.6, (i + 1) * 1.4, -46 - i * 1.6, 'sandstone', i % 2 ? '#d8b880' : '#e2c490');
  World.add(62.5, 0, -46.5, 65.5, 2.4, -45.8, 'sandstone', '#6a5a4a');
  for (const [x, z] of [[52, -60], [52, -46], [72, -40]]) { World.add(x - 0.6, 0, z - 0.6, x + 0.6, 7, z + 0.6, 'sandstone', '#c8a878'); }
  for (const [x, z] of [[50, -52], [54, -40], [74, -52]]) World.add(x - 1.2, 0, z - 0.5, x + 1.2, 0.9, z + 0.5, 'sandstone', '#b89868');
  // HQs and motor pools
  for (const k of ['CT', 'T']) { const z = k === 'CT' ? 98 : -98; hqBlock(k, 0, z, 'plaster', k === 'CT' ? '#b8c4d0' : '#d8b890'); motorPool(k, 0, z); }
  // ruins and palms across the dunes
  const keep = (x, z) => flags.some(f => dist2(f.x, f.z, x, z) < 18) || (Math.abs(z) > 80 && Math.abs(x) < 42) || (Math.abs(x) < 32 && Math.abs(z) < 26) || Math.abs(x) < 5;
  scatter(90, 777, keep, (x, z, r) => { const t = r(); if (t < 0.35) palm(x, z, 0.8 + r() * 0.4); else if (t < 0.7) column(x, z, 1.5 + r() * 4.5, r() < 0.7); else World.add(x - 1 - r() * 2, 0, z - 0.5, x + 1 + r() * 2, 0.8 + r() * 1.6, z + 0.6 + r(), 'sandstone', '#d8b880'); });
  dirtRoad(-2.5, -100, 2.5, -32, 'dirt', '#c8a878'); dirtRoad(-2.5, 32, 2.5, 100, 'dirt', '#c8a878'); dirtRoad(-70, -2.5, -30, 2.5, 'dirt', '#c8a878'); dirtRoad(30, -2.5, 70, 2.5, 'dirt', '#c8a878');
  conquestFlags(flags); World.zones.push({ name: 'Oasis Lake', x0: -24, z0: -18, x1: 24, z1: 18 });
  World.skyColor = 0xa0c0e0; World.fog = [0xe8d8b8, 90, 420]; World.sun = 0xfff0d0;
}

/* ══ Dockyard ═════════════════════════════════════════════════════════════ */
function buildDockyard() {
  const N = 48, CS = 2, G = Array.from({ length: N }, () => Array(N).fill('#'));
  const carve = (x0, z0, x1, z1, ch) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) G[z][x] = ch; };
  const put = (x, z, ch) => { G[z][x] = ch; };
  carve(1, 1, 46, 8, '.'); carve(20, 5, 27, 7, 'S');                         // the quay, CT spawn on it
  carve(34, 10, 46, 21, 'A'); carve(1, 10, 13, 21, 'B');                    // sites
  carve(20, 9, 27, 37, '.'); carve(28, 17, 33, 19, '.'); carve(14, 13, 19, 15, '.');   // mid, A short, B connector
  carve(40, 22, 45, 35, '.'); carve(3, 22, 7, 35, '.'); carve(2, 34, 45, 38, '.');     // A long, B alley, lower yard
  carve(15, 39, 32, 46, 'T'); carve(38, 9, 41, 9, '.'); carve(6, 9, 9, 9, '.');       // T spawn; quay → sites
  carve(20, 24, 21, 24, '#'); carve(26, 24, 27, 24, '#');                  // mid choke
  // containers (K), stacked containers (k), crates (C/c), low barriers (h)
  [[37, 12], [43, 17], [36, 19], [4, 12], [10, 17], [3, 19], [22, 13], [25, 30], [30, 36], [12, 36], [42, 28], [5, 27]].forEach(([x, z]) => put(x, z, 'K'));
  [[45, 11], [1, 11], [23, 20]].forEach(([x, z]) => put(x, z, 'k'));
  [[39, 15], [8, 14], [21, 33], [26, 11], [34, 37], [16, 35], [44, 33], [2, 30], [31, 18]].forEach(([x, z]) => put(x, z, 'c'));
  [[40, 20], [11, 11], [24, 17], [18, 36], [37, 35]].forEach(([x, z]) => put(x, z, 'C'));
  [[14, 6], [33, 6], [9, 4], [38, 4]].forEach(([x, z]) => put(x, z, 'h'));
  const wx = x => (x - N / 2) * CS, wz = z => (z - N / 2) * CS;
  World.bounds = { x0: -N, z0: -N, x1: N, z1: N };
  groundPlane('concrete', 130, '#b8b4ac');
  const used = Array.from({ length: N }, () => Array(N).fill(false)), COLS = ['#8a3a2a', '#2a5a8a', '#3a7a4a', '#b87a2a', '#6a6a70', '#7a2a5a'];
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    if (G[z][x] !== '#' || used[z][x]) continue;
    let x2 = x; while (x2 + 1 < N && G[z][x2 + 1] === '#' && !used[z][x2 + 1]) x2++;
    let z2 = z; const rowOk = zz => { for (let k = x; k <= x2; k++) if (G[zz][k] !== '#' || used[zz][k]) return false; return true; };
    while (z2 + 1 < N && rowOk(z2 + 1)) z2++;
    for (let zz = z; zz <= z2; zz++) for (let k = x; k <= x2; k++) used[zz][k] = true;
    const border = x === 0 || z === 0 || x2 === N - 1 || z2 === N - 1, hsh = hashStr(x + ',' + z);
    const warehouse = !border && (x2 - x + 1) * (z2 - z + 1) > 10;
    const h = border ? 10 : warehouse ? 7 + (hsh % 3) : 5.2;
    World.add(wx(x), 0, wz(z), wx(x2 + 1), h, wz(z2 + 1), border ? 'concrete' : warehouse ? 'brick' : 'container', border ? '#8a8a88' : warehouse ? '#ffffff' : COLS[hsh % COLS.length]);
  }
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const ch = G[z][x], x0 = wx(x), z0 = wz(z), col = COLS[hashStr(z + ':' + x) % COLS.length];
    if (ch === 'K') World.add(x0 + 0.1, 0, z0 - 0.9, x0 + 1.9, 2.6, z0 + 2.9, 'container', col);
    if (ch === 'k') { World.add(x0 + 0.1, 0, z0 - 0.9, x0 + 1.9, 2.6, z0 + 2.9, 'container', col); World.add(x0 + 0.1, 2.6, z0 - 0.9, x0 + 1.9, 5.2, z0 + 2.9, 'container', COLS[(hashStr(x + ':' + z) + 2) % COLS.length]); }
    if (ch === 'C') { World.add(x0 + 0.1, 0, z0 + 0.1, x0 + 1.9, 1.1, z0 + 1.9, 'crate'); World.add(x0 + 0.25, 1.1, z0 + 0.25, x0 + 1.75, 2.2, z0 + 1.75, 'crate', '#d8c8a8'); }
    if (ch === 'c') World.add(x0 + 0.2, 0, z0 + 0.2, x0 + 1.8, 1.1, z0 + 1.8, 'crate');
    if (ch === 'h') World.add(x0, 0, z0 + 0.6, x0 + 2, 1.05, z0 + 1.4, 'concrete', '#e8c030');
    if (ch === 'S') World.spawns.CT.push({ x: x0 + 1, z: z0 + 1, yaw: Math.PI });
    if (ch === 'T') World.spawns.T.push({ x: x0 + 1, z: z0 + 1, yaw: 0 });
  }
  // the harbour basin along the north wall, a mooring post line, and two gantry cranes
  lake(wx(8), wz(1), wx(40), wz(4), 3.5);
  for (let x = 8; x <= 40; x += 4) World.add(wx(x) - 0.25, 0, wz(4) + 0.3, wx(x) + 0.25, 0.7, wz(4) + 0.8, 'metal', '#d8c030');
  for (const cx of [wx(14), wx(33)]) {
    for (const dx of [-3, 3]) World.add(cx + dx - 0.4, 0, wz(5) - 0.4, cx + dx + 0.4, 15, wz(5) + 0.4, 'metal', '#d8a020');
    World.add(cx - 3.6, 15, wz(1), cx + 3.6, 16.2, wz(8), 'metal', '#d8a020');
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2), mat('metal', '#e8e8e8')); cab.position.set(cx, 14, wz(3)); World.deco(cab);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8, 4), mat('metal', '#222')); hook.position.set(cx, 11, wz(3)); World.deco(hook);
  }
  const rect = (x0, z0, x1, z1) => ({ x0: wx(x0), z0: wz(z0), x1: wx(x1 + 1), z1: wz(z1 + 1) });
  const zone = (name, x0, z0, x1, z1) => World.zones.push(Object.assign({ name }, rect(x0, z0, x1, z1)));
  zone('Quay', 1, 1, 46, 8); zone('A Warehouse Yard', 34, 10, 46, 21); zone('B Containers', 1, 10, 13, 21); zone('Mid', 20, 9, 27, 37); zone('A Short', 28, 17, 33, 19);
  zone('B Connector', 14, 13, 19, 15); zone('A Long', 40, 22, 45, 35); zone('B Alley', 3, 22, 7, 35); zone('Lower Yard', 2, 34, 45, 38); zone('T Spawn', 15, 39, 32, 46);
  World.sites.A = Object.assign(rect(34, 10, 46, 21), { name: 'A' }); World.sites.B = Object.assign(rect(1, 10, 13, 21), { name: 'B' });
  for (const k in World.sites) { const s = World.sites[k]; s.cx = (s.x0 + s.x1) / 2; s.cz = (s.z0 + s.z1) / 2; zoneDecal(s.x0, s.z0, s.x1, s.z1, '#ff5533', 0.1); labelDecal(k, s.cx, s.cz, 7, '#ff5533'); }
  const P = (x, z) => ({ x: wx(x) + 1, z: wz(z) + 1 });
  World.routes = {
    A: [
      { name: 'A Long', stage: P(42, 32), entry: P(42, 16), hold: [P(37, 11), P(45, 13), P(35, 20)], smoke: [P(39, 9)], flash: [P(42, 20)] },
      { name: 'A Short', stage: P(23, 21), mid: P(30, 18), entry: P(37, 16), hold: [P(36, 11), P(44, 14)], smoke: [P(39, 9)], flash: [P(34, 18)] },
    ],
    B: [
      { name: 'B Alley', stage: P(5, 31), entry: P(6, 17), hold: [P(3, 11), P(11, 11), P(9, 20)], smoke: [P(7, 9)], flash: [P(5, 21)] },
      { name: 'B Connector', stage: P(23, 16), mid: P(16, 14), entry: P(10, 15), hold: [P(3, 12), P(11, 19)], smoke: [P(7, 9)], flash: [P(13, 14)] },
    ],
  };
  World.ctHolds = [
    { site: 'A', pos: P(38, 11), look: P(42, 24) }, { site: 'A', pos: P(35, 20), look: P(28, 18) },
    { site: 'mid', pos: P(23, 10), look: P(23, 25) },
    { site: 'B', pos: P(5, 11), look: P(5, 24) }, { site: 'B', pos: P(12, 16), look: P(17, 14) },
  ];
  World.skyColor = 0x98a6b4; World.fog = [0xa8b2bc, 60, 230]; World.sun = 0xf2f2f0;
}

MAPS.dockyard = { name: 'Dockyard', build: buildDockyard, modes: ['defuse', 'tdm'], desc: 'Harbour quay and container stacks. Two bomb sites, 5v5.' };
MAPS.frostpeak = { name: 'Frostpeak', build: buildFrostpeak, modes: ['conquest', 'tdm'], desc: 'Snowy mountain valley: bunkers, radar, frozen lake. Five flags.' };
MAPS.oasis = { name: 'Oasis Ruins', build: buildOasis, modes: ['conquest', 'tdm'], desc: 'Desert dunes, temple ruins and an oasis island. Five flags.' };
MODES.defuse.maps.push('dockyard'); MODES.conquest.maps.push('frostpeak', 'oasis'); MODES.tdm.maps.push('dockyard', 'frostpeak', 'oasis');
MODES.sandbox.maps.push('dockyard', 'frostpeak', 'oasis');
Object.assign(HILL_CFG, { frostpeak: { n: 44, r: [18, 40], h: [3, 8] }, oasis: { n: 40, r: [14, 32], h: [1.5, 5] } });

/* ── falling snow on Frostpeak ─────────────────────────────────────────── */
const Snow = {
  pts: null, N: 2600, R: 34,
  setup(scene) {
    this.pts = null; if (World.id !== 'frostpeak') return;
    const g = new THREE.BufferGeometry(), p = new Float32Array(this.N * 3);
    for (let i = 0; i < this.N; i++) { p[i * 3] = rand(-this.R, this.R); p[i * 3 + 1] = rand(0, 26); p[i * 3 + 2] = rand(-this.R, this.R); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
    this.pts.frustumCulled = false; scene.add(this.pts);
  },
  update(dt) {
    const P = this.pts; if (!P || !Game.camera) return;
    const c = Game.camera.position, a = P.geometry.attributes.position, arr = a.array, R = this.R, t = Game.now;
    for (let i = 0; i < this.N; i++) {
      let x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
      y -= dt * (1.1 + (i % 5) * 0.15); x += Math.sin(t * 0.7 + i) * dt * 0.35; z += dt * 0.4;
      if (y < c.y - 6) y += 30; if (y > c.y + 24) y -= 30;
      if (x - c.x > R) x -= 2 * R; else if (c.x - x > R) x += 2 * R; if (z - c.z > R) z -= 2 * R; else if (c.z - z > R) z += 2 * R;
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    }
    a.needsUpdate = true;
  },
};
const _start30 = Game.start.bind(Game);
Game.start = function (cfg) { const r = _start30(cfg); Snow.setup(this.scene); return r; };
const _gupdate30 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate30(dt); if (this.running && Snow.pts) Snow.update(dt); };
