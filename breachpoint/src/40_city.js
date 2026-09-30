/* ═══════════════════════════════════════════════════════════════════════════
   City (v2.9): Conquest, TDM, Zombies and Sandbox.
   A downtown grid: streets and intersections, sidewalks, parked cars and
   barricades, and blocks of apartments, offices and a hotel you can walk
   into. Every building has doors and windows on each floor, stairs up
   through every storey, and a roof you can fight from. Five flags: Market,
   Hotel, Square, Station and Park. Each side's HQ is a plaza with a motor
   pool.
   Bots move on the ground floor (their pathfinding is one layer); players
   can take the upper floors and rooftops.
   ═══════════════════════════════════════════════════════════════════════════ */

const FLOOR_H = 3.4, WALL_T = 0.3, SLAB_T = 0.25, STEP_N = 10;
/* a wall along x (fixed z) or along z (fixed x) with window/door openings */
function cityWall(ax, az, bx, bz, y0, openings, tex, col) {
  const alongX = az === bz, L = alongX ? bx - ax : bz - az, t = WALL_T;
  const seg = (s0, s1, y1, y2) => { if (s1 - s0 < 0.02 || y2 - y1 < 0.02) return; if (alongX) World.add(ax + s0, y1, az - t / 2, ax + s1, y2, az + t / 2, tex, col); else World.add(ax - t / 2, y1, az + s0, ax + t / 2, y2, az + s1, tex, col); };
  let at = 0;
  for (const o of openings.sort((a, b) => a.c - b.c)) {
    const s0 = o.c - o.w / 2, s1 = o.c + o.w / 2;
    seg(at, s0, y0, y0 + FLOOR_H); seg(s0, s1, y0, y0 + o.y0); seg(s0, s1, y0 + o.y1, y0 + FLOOR_H); at = s1;
  }
  seg(at, L, y0, y0 + FLOOR_H);
}
/* the openings along one side of one floor: windows, and a door in the middle on the ground floor */
function cityOpenings(L, floor, door, shop) {
  const n = Math.max(1, Math.floor((L - 1.5) / 3.6)), sp = L / n, out = [];
  for (let i = 0; i < n; i++) out.push({ c: sp * (i + 0.5), w: shop && floor === 0 ? Math.min(sp - 0.7, 2.6) : 1.3, y0: shop && floor === 0 ? 0.55 : 0.95, y1: shop && floor === 0 ? 2.6 : 2.3 });
  if (door && floor === 0) { let k = 0; for (let i = 1; i < n; i++) if (Math.abs(out[i].c - L / 2) < Math.abs(out[k].c - L / 2)) k = i; out[k] = { c: out[k].c, w: 1.9, y0: 0, y1: 2.6 }; }
  return out;
}
/* A building you can walk through. Stairs are two lanes in a corner that
   switch back each floor; the slab above each flight is open over it. */
function cityBuilding(cx, cz, w, d, floors, tex, col, doors = 'nesw', shop = false, trim = '#6a6a6a') {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, t = WALL_T;
  for (let f = 0; f < floors; f++) {
    const y = f * FLOOR_H;
    cityWall(x0, z0, x1, z0, y, cityOpenings(w, f, doors.includes('n'), shop), tex, col);
    cityWall(x0, z1, x1, z1, y, cityOpenings(w, f, doors.includes('s'), shop), tex, col);
    cityWall(x0, z0 + t / 2, x0, z1 - t / 2, y, cityOpenings(d - t, f, doors.includes('w'), shop), tex, col);
    cityWall(x1, z0 + t / 2, x1, z1 - t / 2, y, cityOpenings(d - t, f, doors.includes('e'), shop), tex, col);
    if (f > 0) World.add(x0 - 0.12, y - 0.12, z0 - 0.12, x1 + 0.12, y + 0.05, z1 + 0.12, 'concrete', trim, { noCollide: true });   // cornice band
  }
  // stairwell in the north-west corner: lane A climbs east, lane B climbs west
  const run = STEP_N * 0.36, lw = 1.25, sx = x0 + t / 2 + 0.02, szA = z0 + t / 2 + 0.05, szB = szA + lw, rise = FLOOR_H / STEP_N;
  const lane = f => (f % 2 === 0 ? { z: szA, dir: 1 } : { z: szB, dir: -1 });
  // each flight starts with a deep landing step you can step onto from the side, then nine 0.3 m treads
  const tread = i => (i === 0 ? [0, 0.9] : [0.9 + (i - 1) * 0.3, 0.9 + i * 0.3]);
  for (let f = 0; f < floors; f++) {
    const L = lane(f), y = f * FLOOR_H;
    for (let i = 0; i < STEP_N; i++) {
      const [u0, u1] = tread(i), a = L.dir > 0 ? sx + u0 : sx + run - u1, c = L.dir > 0 ? sx + u1 : sx + run - u0;
      World.add(a, y, L.z, c, y + (i + 1) * rise, L.z + lw, 'concrete', '#9a9690');
    }
  }
  // slabs: each floor and the roof, open over the flight that arrives there
  for (let f = 1; f <= floors; f++) {
    const y = f * FLOOR_H, L = lane(f - 1), hx0 = sx - 0.1, hx1 = sx + run + 0.1, hz0 = L.z - 0.05, hz1 = L.z + lw + 0.05;
    const slab = (a, b, c, e) => { if (c - a > 0.05 && e - b > 0.05) World.add(a, y - SLAB_T, b, c, y, e, f === floors ? 'roof' : 'concrete', f === floors ? '#8a8680' : '#b8b2a8'); };
    slab(x0 + t / 2, z0 + t / 2, x1 - t / 2, hz0); slab(x0 + t / 2, hz1, x1 - t / 2, z1 - t / 2);
    slab(x0 + t / 2, hz0, hx0, hz1); slab(hx1, hz0, x1 - t / 2, hz1);
    // railings round the opening, open where you step on and off
    const rail = (a, b, c, e) => World.add(a, y, b, c, y + 1.0, e, 'metal', '#4a4e54');
    rail(hx0, hz1 - 0.04, hx1, hz1 + 0.04);
    if (L.dir < 0) rail(hx1 - 0.04, hz0, hx1 + 0.04, hz1);
  }
  // roof: parapet and a rooftop box or two
  const H = floors * FLOOR_H;
  World.add(x0, H, z0, x1, H + 1.0, z0 + t, tex, col); World.add(x0, H, z1 - t, x1, H + 1.0, z1, tex, col);
  World.add(x0, H, z0 + t, x0 + t, H + 1.0, z1 - t, tex, col); World.add(x1 - t, H, z0 + t, x1, H + 1.0, z1 - t, tex, col);
  if (w > 9) World.add(cx + w / 4 - 1.2, H, cz + d / 4 - 1, cx + w / 4 + 1.2, H + 1.6, cz + d / 4 + 1, 'metal', '#8a9098');   // air handler
  // a little furniture on each floor for cover
  const r = mulberry(hashStr(cx + ':' + cz));
  for (let f = 0; f < floors; f++) {
    const y = f * FLOOR_H;
    for (let k = 0; k < 2; k++) {
      const px = cx + (r() - 0.3) * (w - 5) * 0.8, pz = cz + (r() - 0.3) * (d - 5) * 0.8;
      if (px < sx + run + 1 && pz < szB + lw + 1) continue;   // keep the stairs clear
      if (r() < 0.5) World.add(px - 0.9, y, pz - 0.5, px + 0.9, y + 0.8, pz + 0.5, 'wood', '#7a5a3a'); else World.add(px - 0.55, y, pz - 0.55, px + 0.55, y + 1.1, pz + 0.55, 'crate');
    }
  }
}
function parkedCar(x, z, yaw, col) {
  const m = buildCar39(col); m.position.set(x, 0, z); m.rotation.y = yaw; m.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); World.deco(m);
  const along = Math.abs(Math.sin(yaw)) > 0.5, hw = along ? 2.1 : 0.95, hd = along ? 0.95 : 2.1;
  World.add(x - hw, 0, z - hd, x + hw, 1.5, z + hd, 'metal', '#333', { invisible: true });
}
function jersey(x0, z0, x1, z1) { World.add(x0, 0, z0, x1, 0.95, z1, 'concrete', '#c8c4b8'); }
function lamp(x, z) {
  World.add(x - 0.1, 0, z - 0.1, x + 0.1, 5.2, z + 0.1, 'metal', '#3a3e44');
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); h.position.set(x, 5.25, z); World.deco(h);
}

function buildCity() {
  const S = 100; World.bounds = { x0: -S, z0: -S, x1: S, z1: S };
  groundPlane('concrete', 240, '#5a5c60');
  // skyline wall around the edge
  const rr = mulberry(9090);
  for (let i = -S; i < S; i += 10) {
    for (const [x, z, w, d] of [[i + 5, -S - 4, 10, 8], [i + 5, S + 4, 10, 8], [-S - 4, i + 5, 8, 10], [S + 4, i + 5, 8, 10]]) {
      const h = 16 + rr() * 22; World.add(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, rr() < 0.5 ? 'concrete' : 'brick', rr() < 0.5 ? '#9aa0a8' : '#b8a898', { ts: 3 });
    }
  }
  // sidewalks on every block, road markings on the streets
  const colsX = [[-94, -50], [-38, -6], [6, 38], [50, 94]], rowsZ = [[-76, -46], [-34, -6], [6, 34], [46, 76]];
  for (const [ax, bx] of colsX) for (const [az, bz] of rowsZ) flatPlane(ax - 1.5, az - 1.5, bx + 1.5, bz + 1.5, 'concrete', '#a8a8a2', 0.02);
  for (const x of [-44, 0, 44]) for (let z = -74; z < 74; z += 6) flatPlane(x - 0.12, z, x + 0.12, z + 3, 'concrete', '#e8e2c8', 0.018);
  for (const z of [-40, 0, 40]) for (let x = -96; x < 96; x += 6) flatPlane(x, z - 0.12, x + 3, z + 0.12, 'concrete', '#e8e2c8', 0.018);
  for (const x of [-44, 0, 44]) for (const z of [-40, 0, 40]) for (let k = -4; k <= 4; k += 1.6) { flatPlane(x + k - 0.4, z + 6.5, x + k + 0.4, z + 9, 'concrete', '#f0f0ea', 0.019); flatPlane(x + k - 0.4, z - 9, x + k + 0.4, z - 6.5, 'concrete', '#f0f0ea', 0.019); }

  // ── blocks ──
  const B = (cx, cz, w, d, fl, tex, col, doors, shop) => cityBuilding(cx, cz, w, d, fl, tex, col, doors, shop);
  // north-west: apartments; north-east: the hotel (B); middle rows: offices, shops; south: station (D) and the park (E)
  B(-80, 61, 22, 22, 3, 'brick', '#c8a898', 'se', true); B(-60, 61, 14, 22, 4, 'plaster', '#e8dcc8', 'sw');
  B(-28, 61, 16, 24, 4, 'brick', '#b88a78', 'se', true); B(-12, 58, 10, 18, 2, 'plaster', '#d8e0e8', 'sw');
  B(22, 61, 26, 22, 3, 'concrete', '#b8bcc0', 'sw', true);
  B(72, 61, 30, 20, 6, 'plaster', '#f0e6d4', 'nsw', true);   // Hotel
  B(-22, 20, 24, 22, 4, 'brick', '#a87a68', 'nesw');          // apartments
  B(22, 24, 24, 16, 5, 'concrete', '#a8b4c0', 'nsw', true);    // offices
  B(72, 20, 30, 22, 3, 'brick', '#c8b098', 'nsw', true);
  B(-72, -20, 26, 22, 3, 'concrete', '#b0aaa0', 'nes', true); B(-22, -24, 26, 16, 3, 'plaster', '#d8d0c0', 'nes', true);
  B(22, -20, 26, 22, 4, 'brick', '#b89080', 'nsw');
  B(80, -20, 18, 22, 2, 'plaster', '#e8e0d0', 'nw', true);
  B(-22, -62, 26, 20, 3, 'brick', '#a88a7a', 'nes', true); B(22, -62, 26, 20, 4, 'concrete', '#a8b0b8', 'nsw');
  // A — the market: stalls under awnings instead of a building
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const x = -86 + i * 9, z = 12 + j * 9; World.add(x - 1.8, 0, z - 1, x + 1.8, 0.95, z + 1, 'wood', '#8a6a4a');
    World.add(x - 2.2, 2.4, z - 1.6, x + 2.2, 2.55, z + 1.6, 'metal', ['#c83a2a', '#2a7ac8', '#d8b030', '#3a9a5a'][(i + j) % 4], { noCollide: true });
    for (const [dx, dz] of [[-2, -1.4], [2, -1.4], [-2, 1.4], [2, 1.4]]) World.add(x + dx - 0.06, 0, z + dz - 0.06, x + dx + 0.06, 2.4, z + dz + 0.06, 'metal', '#555');
  }
  // D — the station: a low hall and stairs down into a (blocked) metro entrance
  cityBuilding(-72, -61, 30, 20, 1, 'concrete', '#c8c0b0', 'nesw', true);
  World.add(-70, 0, -47.5, -62, 0.5, -45.5, 'concrete', '#8a8a86'); World.add(-70, 0, -45.5, -69.7, 1.1, -42, 'metal', '#3a3e44'); World.add(-62.3, 0, -45.5, -62, 1.1, -42, 'metal', '#3a3e44');
  // E — the park: trees, hedges, a pond and a bandstand
  flatPlane(51, -75, 93, -47, 'grass', '#ffffff', 0.022);
  const rp = mulberry(777);
  for (let i = 0; i < 16; i++) { const x = 54 + rp() * 36, z = -73 + rp() * 24; if (dist2(x, z, 72, -61) < 7) continue; tree(x, z, 0.8 + rp() * 0.4); }
  World.add(56, 0, -52, 66, 0.9, -51, 'grass', '#3a6a3a'); World.add(78, 0, -70, 88, 0.9, -69, 'grass', '#3a6a3a');
  World.add(69, 0, -64, 75, 0.6, -58, 'wood', '#9a7a5a'); for (const [x, z] of [[69.2, -63.8], [74.8, -63.8], [69.2, -58.2], [74.8, -58.2]]) World.add(x - 0.1, 0.6, z - 0.1, x + 0.1, 3.2, z + 0.1, 'wood', '#6a4a34');
  World.add(68.5, 3.2, -64.5, 75.5, 3.5, -57.5, 'roof', '#6a3a2a');
  // C — the square: fountain in the middle of the crossroads, planters around
  World.add(-2.5, 0, -2.5, 2.5, 0.7, 2.5, 'concrete', '#c8c4b8'); World.add(-0.4, 0.7, -0.4, 0.4, 2.2, 0.4, 'concrete', '#d8d4c8');
  for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) World.add(x - 1.2, 0, z - 1.2, x + 1.2, 0.8, z + 1.2, 'grass', '#4a7a3a');

  // ── street furniture ──
  const rs = mulberry(4321), carCols = ['T', 'CT'];
  for (const x of [-44, 0, 44]) for (let z = -70; z < 72; z += 11) { if (Math.abs(z) < 12 || Math.abs(Math.abs(z) - 40) < 10) continue; if (rs() < 0.45) parkedCar(x + (rs() < 0.5 ? -4 : 4), z, 0, pick.call(null, carCols)); }
  for (const z of [-40, 0, 40]) for (let x = -90; x < 90; x += 11) { if (Math.abs(x) < 12 || Math.abs(Math.abs(x) - 44) < 10) continue; if (rs() < 0.4) parkedCar(x, z + (rs() < 0.5 ? -4 : 4), Math.PI / 2, pick.call(null, carCols)); }
  for (const x of [-44, 0, 44]) for (let z = -72; z <= 72; z += 16) { lamp(x - 6.8, z); lamp(x + 6.8, z + 8); }
  // roadblocks and cover near each flag
  jersey(-50, 33, -47, 34); jersey(-41, 46, -38, 47); jersey(38, 33, 41, 34); jersey(47, 46, 50, 47);
  jersey(-50, -47, -47, -46); jersey(-41, -34, -38, -33); jersey(38, -47, 41, -46); jersey(47, -34, 50, -33);
  jersey(-12, -4, -11, 4); jersey(11, -4, 12, 4);
  for (const [x, z] of [[-40, 48], [48, 36], [-48, -36], [40, -48], [5, 10], [-5, -10]]) { World.add(x - 1, 0, z - 0.7, x + 1, 1.3, z + 0.7, 'metal', '#2a5a3a'); }   // dumpsters
  for (const [x, z] of [[-36, 36], [36, 44], [-36, -44], [36, -36], [10, -5], [-10, 5]]) World.add(x - 0.55, 0, z - 0.55, x + 0.55, 1.1, z + 0.55, 'crate');

  // ── HQs: plazas at each end with a motor pool ──
  for (const k of ['CT', 'T']) {
    const s = k === 'CT' ? 1 : -1, z = 90 * s, yaw = s > 0 ? 0 : Math.PI;
    World.hq[k] = { x: 0, z };
    flatPlane(-60, Math.min(z - 12 * s, z + 10 * s), 60, Math.max(z - 12 * s, z + 10 * s), 'concrete', k === 'CT' ? '#8a96a4' : '#a49686', 0.021);
    for (let i = 0; i < 10; i++) World.spawns[k].push({ x: -10 + (i % 5) * 2.5, z: z + (i < 5 ? 2 : 4.5) * s, yaw });
    jersey(-24, z - 10 * s, -8, z - 10 * s + s); jersey(8, z - 10 * s, 24, z - 10 * s + s);
    house(-34, z + 3 * s, 10, 7, s > 0 ? 'n' : 's', 'concrete', k === 'CT' ? '#9ab0c8' : '#c8a890');
    const V = (kind, x, dz, extra) => World.vehicleSpawns.push(Object.assign({ team: k, x, z: z + dz * s, yaw, kind: kind === 'jeep' ? undefined : kind }, extra || {}));
    V('jeep', 16, 0); V('jeep', 21, 0, { playerOnly: true }); V('car', 26, 0); V('apc', 33, 1); V('tank', 41, 1);
    V('quad', 16, 5); V('bike', 19, 5, { playerOnly: true }); V('bike', 21.5, 5);
    flatPlane(46, z - 4, 56, z + 4, 'concrete', '#6a6a6c', 0.023); labelDecal('H', 51, z, 5, '#f0f0f0'); V('attackheli', 51, 0);
  }
  conquestFlags([
    { name: 'A', label: 'Market', x: -44, z: 40 }, { name: 'B', label: 'Hotel', x: 44, z: 40 }, { name: 'C', label: 'Square', x: 0, z: 0 },
    { name: 'D', label: 'Station', x: -44, z: -40 }, { name: 'E', label: 'Park', x: 44, z: -40 },
  ]);
  World.zones.push({ name: 'Main Street', x0: -6, z0: -76, x1: 6, z1: 76 }, { name: 'Market', x0: -94, z0: 6, x1: -50, z1: 34 }, { name: 'Hotel', x0: 57, z0: 51, x1: 87, z1: 71 }, { name: 'Park', x0: 50, z0: -76, x1: 94, z1: -46 });
  World.skyColor = 0xa4b4c4; World.fog = [0xb8c0c8, 70, 300]; World.sun = 0xfff0dc;
}
MAPS.city = { name: 'City', build: buildCity, modes: ['conquest', 'tdm'], desc: 'Downtown streets and buildings you can climb. Five flags.' };
for (const m of ['conquest', 'tdm', 'zombies', 'sandbox']) if (MODES[m] && !MODES[m].maps.includes('city')) MODES[m].maps.push('city');
/* the flag MGs from v2.7 need wrapping for the new map too */
{ const b = MAPS.city.build; MAPS.city.build = function () { const r = b.apply(this, arguments); try { flagMGs(); } catch (e) { console.warn('flag MGs', e); } return r; }; }
