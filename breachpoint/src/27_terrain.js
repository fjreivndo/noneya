/* ═══════════════════════════════════════════════════════════════════════════
   Hills and rounder shapes.
   · Every map gets rolling ground: big hills across Ridgeline's valley, dunes
     in Dustyard's open yards, and hills around the outer ring of Flatgrass
     (the middle stays flat for building). Hills flatten out near buildings,
     cover, water, roads, flags and spawns, so nothing ends up buried.
     Everything follows them: walking, driving, bullets and line of sight,
     grenades, ragdolls and sandbox physics, grass and rocks.
   · Models: every box part gets rounded edges, and soldiers are rebuilt from
     capsules and spheres instead of blocks.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── the height field ──────────────────────────────────────────────────── */
const HILL_CFG = {
  ridgeline: { n: 40, r: [18, 38], h: [2, 6.5] },
  dustyard: { n: 18, r: [7, 14], h: [0.6, 1.6] },
  flatgrass: { n: 26, r: [14, 30], h: [2, 5], ring: 62 },
};
const Terrain = {
  on: false, res: 1, x0: 0, z0: 0, nx: 0, nz: 0, h: null, tile: null, T: 8, tnx: 0, tnz: 0, hmax: 0,
  at(x, z) {
    if (!this.on) return 0;
    const fx = (x - this.x0) / this.res, fz = (z - this.z0) / this.res;
    if (fx < 0 || fz < 0 || fx >= this.nx - 1 || fz >= this.nz - 1) return 0;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, n = this.nx, h = this.h, i = iz * n + ix;
    return (h[i] * (1 - tx) + h[i + 1] * tx) * (1 - tz) + (h[i + n] * (1 - tx) + h[i + n + 1] * tx) * tz;
  },
  normal(x, z, out) { const e = 0.5, dx = this.at(x + e, z) - this.at(x - e, z), dz = this.at(x, z + e) - this.at(x, z - e); out.x = -dx / (2 * e); out.y = 1; out.z = -dz / (2 * e); const l = Math.hypot(out.x, out.y, out.z); out.x /= l; out.y /= l; out.z /= l; return out; },
  tileMax(x, z) { const tx = Math.floor((x - this.x0) / this.T), tz = Math.floor((z - this.z0) / this.T); if (tx < 0 || tz < 0 || tx >= this.tnx || tz >= this.tnz) return 0; return this.tile[tz * this.tnx + tx]; },
  build(id) {
    this.on = false; this.h = null; const C = HILL_CFG[id]; if (!C) return;
    const B = World.bounds, res = this.res, x0 = this.x0 = B.x0 - 12, z0 = this.z0 = B.z0 - 12, nx = this.nx = Math.ceil((B.x1 + 12 - x0) / res) + 1, nz = this.nz = Math.ceil((B.z1 + 12 - z0) / res) + 1;
    const N = nx * nz, blocked = new Uint8Array(N), cell = (x, z) => [Math.round((x - x0) / res), Math.round((z - z0) / res)];
    const rect = (ax, az, bx, bz, m = 0) => { const [i0, j0] = cell(Math.min(ax, bx) - m, Math.min(az, bz) - m), [i1, j1] = cell(Math.max(ax, bx) + m, Math.max(az, bz) + m); for (let j = Math.max(0, j0); j <= Math.min(nz - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) blocked[j * nx + i] = 1; };
    const disc = (x, z, r) => rect(x - r, z - r, x + r, z + r);
    for (const b of World.boxes) if (b.y0 < 1.5) rect(b.x0, b.z0, b.x1, b.z1, 0.5);
    for (const w of World.water) rect(w.x0, w.z0, w.x1, w.z1, 1);
    for (const f of World.flags) disc(f.x, f.z, (f.radius || 10) + 3);
    for (const k of ['T', 'CT']) { for (const s of World.spawns[k] || []) disc(s.x, s.z, 3); const hq = World.hq && World.hq[k]; if (hq) disc(hq.x, hq.z, 14); }
    for (const v of World.vehicleSpawns || []) disc(v.x, v.z, 7);
    if (World.sites) for (const k in World.sites) { const s = World.sites[k]; rect(s.x0, s.z0, s.x1, s.z1, 2); }
    // flat decals on the ground (roads, site markings) stay visible
    if (World.group) World.group.traverse(o => { if (!o.isMesh || o === World._groundMesh || !o.geometry || !o.geometry.parameters) return; const P = o.geometry.parameters;
      if (P.width && P.height && o.position.y < 0.1 && Math.abs(o.rotation.x + Math.PI / 2) < 0.01) rect(o.position.x - P.width / 2, o.position.z - P.height / 2, o.position.x + P.width / 2, o.position.z + P.height / 2, 3.5); });
    // distance from anything blocked (two-pass chamfer), in metres
    const D = new Float32Array(N); for (let i = 0; i < N; i++) D[i] = blocked[i] ? 0 : 1e9;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let d = D[k]; if (i > 0) d = Math.min(d, D[k - 1] + 1); if (j > 0) { d = Math.min(d, D[k - nx] + 1); if (i > 0) d = Math.min(d, D[k - nx - 1] + 1.414); if (i < nx - 1) d = Math.min(d, D[k - nx + 1] + 1.414); } D[k] = d; }
    for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; let d = D[k]; if (i < nx - 1) d = Math.min(d, D[k + 1] + 1); if (j < nz - 1) { d = Math.min(d, D[k + nx] + 1); if (i < nx - 1) d = Math.min(d, D[k + nx + 1] + 1.414); if (i > 0) d = Math.min(d, D[k + nx - 1] + 1.414); } D[k] = d; }
    // hills
    const r = mulberry(hashStr('hills:' + id)), hills = [];
    for (let t = 0; t < C.n * 6 && hills.length < C.n; t++) {
      const x = lerp(B.x0, B.x1, r()), z = lerp(B.z0, B.z1, r()); if (C.ring && Math.hypot(x, z) < C.ring) continue;
      hills.push({ x, z, r: lerp(C.r[0], C.r[1], r()), h: lerp(C.h[0], C.h[1], Math.pow(r(), 1.5)), sx: lerp(0.7, 1.3, r()) });
    }
    const H = this.h = new Float32Array(N); let hmax = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = x0 + i * res, z = z0 + j * res; let s = 0;
      for (const q of hills) { const dx = (x - q.x) * q.sx, dz = (z - q.z) / q.sx, d = Math.sqrt(dx * dx + dz * dz); if (d < q.r) s += q.h * 0.5 * (1 + Math.cos(Math.PI * d / q.r)); }
      if (C.ring) s *= smoothstep(C.ring - 4, C.ring + 14, Math.hypot(x, z));
      const cap = C.h[1] * 1.3; s = cap * (1 - Math.exp(-s / cap));   // overlapping hills don't stack into cliffs
      H[k] = s * smoothstep(2.5, 4 + s * 2.2, D[k]);
    }
    // soften: two separable box blurs, then keep blocked cells flat
    const tmp = new Float32Array(N), R = 3;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { let a = 0, c = 0; for (let d = -R; d <= R; d++) { const q = i + d; if (q >= 0 && q < nx) { a += H[j * nx + q]; c++; } } tmp[j * nx + i] = a / c; }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { let a = 0, c = 0; for (let d = -R; d <= R; d++) { const q = j + d; if (q >= 0 && q < nz) { a += tmp[q * nx + i]; c++; } } H[j * nx + i] = a / c; }
    }
    for (let k = 0; k < N; k++) { H[k] *= smoothstep(1.5, 3.5, D[k]); if (H[k] > hmax) hmax = H[k]; }
    this.hmax = hmax; if (hmax < 0.05) return;
    const T = this.T, tnx = this.tnx = Math.ceil(nx * res / T), tnz = this.tnz = Math.ceil(nz * res / T), tile = this.tile = new Float32Array(tnx * tnz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const t = Math.min(tnz - 1, Math.floor(j * res / T)) * tnx + Math.min(tnx - 1, Math.floor(i * res / T)); if (H[j * nx + i] > tile[t]) tile[t] = H[j * nx + i]; }
    // pad tiles by their neighbours so bilinear edges are covered
    const t2 = tile.slice(); for (let j = 0; j < tnz; j++) for (let i = 0; i < tnx; i++) { let m = tile[j * tnx + i]; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < tnx && b < tnz) m = Math.max(m, tile[b * tnx + a]); } t2[j * tnx + i] = m; } this.tile = t2;
    this.on = true;
    this.mesh();
  },
  /* displace the ground plane */
  mesh() {
    const m = World._groundMesh; if (!m) return;
    const old = m.geometry, P = old.parameters, size = P.width, seg = Math.min(260, Math.round(size / 1.25)), g = new THREE.PlaneGeometry(size, size, seg, seg), pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) { const wx = m.position.x + pos.getX(i), wz = m.position.z - pos.getY(i); pos.setZ(i, this.at(wx, wz)); uv.setXY(i, uv.getX(i) * size / 3, uv.getY(i) * size / 3); }
    g.computeVertexNormals(); m.geometry = g; old.dispose(); m.matrixAutoUpdate = false; m.updateMatrix();
  },
  /* cannon height field for a physics world (ragdolls, sandbox) */
  body(opts) {
    const es = 2, B = World.bounds, x0 = B.x0 - 10, z1 = B.z1 + 10, ni = Math.ceil((B.x1 - B.x0 + 20) / es) + 1, nj = Math.ceil((B.z1 - B.z0 + 20) / es) + 1, data = [];
    for (let i = 0; i < ni; i++) { const col = []; for (let j = 0; j < nj; j++) col.push(this.at(x0 + i * es, z1 - j * es)); data.push(col); }
    const body = new CANNON.Body(Object.assign({ type: CANNON.Body.STATIC, shape: new CANNON.Heightfield(data, { elementSize: es }) }, opts || {}));
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); body.position.set(x0, 0, z1); return body;
  },
};
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function groundH(x, z) { return Terrain.on ? Terrain.at(x, z) : 0; }

const _groundPlane27 = groundPlane;
groundPlane = function (tex, size, color, cx, cz) { const m = _groundPlane27(tex, size, color, cx, cz); if (!World._groundMesh) World._groundMesh = m; return m; };
const _loadMap27 = loadMap;
loadMap = function (id, scene) { World._groundMesh = null; Terrain.on = false; _loadMap27(id, scene); try { Terrain.build(id); } catch (e) { Terrain.on = false; console.warn('terrain', e); } };

/* walking and driving */
const _floorAt27 = World.floorAt;
World.floorAt = function (x, z) { const f = _floorAt27(x, z); return f < 0 || !Terrain.on ? f : Terrain.at(x, z); };

/* rays: bullets, sight, grenades, rockets, placement */
const _raycast27 = World.raycast.bind(World), _tn = { x: 0, y: 0, z: 0 };
World.raycast = function (ox, oy, oz, dx, dy, dz, maxD) {
  const t0 = _raycast27(ox, oy, oz, dx, dy, dz, maxD);
  if (!Terrain.on) return t0;
  const T = Terrain, lim = t0 >= 0 ? t0 : maxD, Hm = T.hmax + 0.01;
  // only the part of the ray below the highest hill can touch the ground
  let a = 0, b = lim;
  if (Math.abs(dy) < 1e-6) { if (oy > Hm) return t0; } else { const tH = (Hm - oy) / dy; if (dy > 0) b = Math.min(b, tH); else a = Math.max(a, tH); }
  if (a >= b) return t0;
  const step = 0.6; let pt = a, py = oy + dy * a, ph = T.at(ox + dx * a, oz + dz * a), above = py >= ph - 0.02;
  for (let t = a + step; ; t += step) {
    const tt = Math.min(t, b), x = ox + dx * tt, z = oz + dz * tt, y = oy + dy * tt;
    if (y > T.tileMax(x, z) + 0.01) { above = true; pt = tt; if (tt >= b) break; continue; }
    const h = T.at(x, z);
    if (y < h && above) {
      let lo = pt, hi = tt; for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (oy + dy * mid < T.at(ox + dx * mid, oz + dz * mid)) hi = mid; else lo = mid; }
      const hx = ox + dx * hi, hz = oz + dz * hi; if (T.at(hx, hz) < 0.03) { above = true; pt = tt; if (tt >= b) break; continue; }   // flat ground: the box/plane test already has it
      T.normal(hx, hz, _tn); const Hh = World.hit; Hh.nx = _tn.x; Hh.ny = _tn.y; Hh.nz = _tn.z; Hh.box = null; Hh.t = hi; return hi;
    }
    above = y >= h; pt = tt; if (tt >= b) break;
  }
  return t0;
};

/* physics worlds get the hills too */
const _physInit27 = Phys.init.bind(Phys);
Phys.init = function () { const r = _physInit27.apply(this, arguments); if (Terrain.on && this.world) this.world.addBody(Terrain.body()); return r; };
const _ragWorld27 = Ragdoll.ensureWorld.bind(Ragdoll);
Ragdoll.ensureWorld = function () { const before = this.world, w = _ragWorld27(); if (w !== before && Terrain.on) w.addBody(Terrain.body({ collisionFilterGroup: 1, collisionFilterMask: 2 })); return w; };

/* ground vehicles follow the slope */
const _vupdate27 = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt) {
  const r = _vupdate27.call(this, dt);
  const T = this.K.type; if (!Terrain.on || !this.model || T === 'heli' || T === 'jet' || T === 'boat') return r;
  if (this.pos.y - Terrain.at(this.pos.x, this.pos.z) > 0.4) return r;
  const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), L = Math.max(1.2, (this.K.r || 1.5)), W = 0.9;
  const pitch = Math.atan2(Terrain.at(this.pos.x + fx * L, this.pos.z + fz * L) - Terrain.at(this.pos.x - fx * L, this.pos.z - fz * L), 2 * L);
  const roll = Math.atan2(Terrain.at(this.pos.x - fz * W, this.pos.z + fx * W) - Terrain.at(this.pos.x + fz * W, this.pos.z - fx * W), 2 * W);
  this.slope = this.slope || { p: 0, r: 0 }; this.slope.p = lerp(this.slope.p, pitch, 1 - Math.exp(-dt * 10)); this.slope.r = lerp(this.slope.r, roll, 1 - Math.exp(-dt * 10));
  const m = this.model; if (m.rotation.order !== 'YXZ') m.rotation.order = 'YXZ'; m.rotation.x += this.slope.p; m.rotation.z += this.slope.r;
  return r;
};
/* the camera never dips under a hill */
const _pcam27 = Player.camera.bind(Player);
Player.camera = function (s, dt) { _pcam27(s, dt); const c = Game.camera; if (Terrain.on && c) { const g = Terrain.at(c.position.x, c.position.z) + 0.35; if (c.position.y < g) c.position.y = g; } };

/* ── rounder shapes ────────────────────────────────────────────────────── */
const _rbCache = new Map();
function roundedBoxGeo(w, h, d, r) {
  const key = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3) + ',' + r.toFixed(3); let g = _rbCache.get(key); if (g) return g;
  g = new THREE.BoxGeometry(1, 1, 1, 6, 6, 6); const P = g.attributes.position, N = g.attributes.normal, half = [w / 2, h / 2, d / 2];
  const map = (c, hh) => { const a = Math.abs(c), s = Math.sign(c); return s * (a > 0.49 ? hh : a > 0.3 ? hh - r * 0.5 : a > 0.15 ? hh - r : a / 0.1667 * (hh - r) * 0.999); };
  const v = [0, 0, 0], inner = [0, 0, 0], n = [0, 0, 0];
  for (let i = 0; i < P.count; i++) {
    v[0] = map(P.getX(i), half[0]); v[1] = map(P.getY(i), half[1]); v[2] = map(P.getZ(i), half[2]);
    let l = 0; for (let k = 0; k < 3; k++) { inner[k] = clamp(v[k], -(half[k] - r), half[k] - r); n[k] = v[k] - inner[k]; l += n[k] * n[k]; } l = Math.sqrt(l);
    if (l > 1e-6) { for (let k = 0; k < 3; k++) { n[k] /= l; v[k] = inner[k] + n[k] * r; } N.setXYZ(i, n[0], n[1], n[2]); }
    P.setXYZ(i, v[0], v[1], v[2]);
  }
  _rbCache.set(key, g); return g;
}
bx = function (w, h, d, m, x = 0, y = 0, z = 0) {
  const r = Math.min(Math.min(w, h, d) * 0.22, 0.12);
  const o = new THREE.Mesh(r > 0.006 ? roundedBoxGeo(w, h, d, r) : new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o;
};
/* soldiers from capsules and spheres */
const _capCache = {};
function capsule(rad, len, m) { const k = rad + ':' + len; return new THREE.Mesh(_capCache[k] || (_capCache[k] = new THREE.CapsuleGeometry(rad, len, 4, 10)), m); }
function ball(rad, m, sx = 1, sy = 1, sz = 1, part) { const g = new THREE.SphereGeometry(rad, 14, 10, 0, TAU, 0, part || Math.PI); const o = new THREE.Mesh(g, m); o.scale.set(sx, sy, sz); return o; }
buildSoldierModel = function (team) {
  const st = TEAM_STYLE[team], U = lam(st.uniform), A = lam(st.accent), Sk = lam(st.skin), H = lam(st.helmet), Dk = lam('#222'), G = lam(st.glove);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.12, 0.88, 0); legR.position.set(0.12, 0.88, 0);
  for (const L of [legL, legR]) {
    const thigh = capsule(0.092, 0.34, U); thigh.position.y = -0.22; L.add(thigh);
    const shin = capsule(0.078, 0.36, U); shin.position.y = -0.6; L.add(shin);
    const knee = ball(0.072, Dk, 1, 0.9, 0.8); knee.position.set(0, -0.42, -0.06); L.add(knee);
    L.add(bx(0.16, 0.11, 0.27, Dk, 0, -0.84, -0.04));
  }
  body.add(legL, legR);
  const upper = new THREE.Group(); upper.position.y = 0.9; body.add(upper);
  const hips = bx(0.42, 0.18, 0.25, U, 0, 0.04, 0); upper.add(hips);
  const chest = capsule(0.17, 0.2, U); chest.scale.set(1.35, 1, 0.78); chest.position.y = 0.36; upper.add(chest);
  upper.add(bx(0.44, 0.05, 0.27, Dk, 0, 0.12, 0));   // belt
  const vest = new THREE.Group(); upper.add(vest); vest.add(bx(0.48, 0.36, 0.3, A, 0, 0.36, 0));
  for (const x of [-0.14, 0, 0.14]) vest.add(bx(0.1, 0.12, 0.07, A, x, 0.26, -0.17));
  vest.add(bx(0.08, 0.05, 0.3, A, -0.17, 0.56, 0)); vest.add(bx(0.08, 0.05, 0.3, A, 0.17, 0.56, 0));
  const neck = capsule(0.055, 0.06, Sk); neck.position.y = 0.61; upper.add(neck);
  const head = new THREE.Group(); head.position.y = 0.72; upper.add(head);
  head.add(ball(0.125, Sk, 0.92, 1.08, 1));
  const nose = ball(0.03, Sk, 0.8, 1, 1); nose.position.set(0, -0.01, -0.12); head.add(nose);
  const helmet = ball(0.15, H, 1, 0.82, 1.06, Math.PI / 2); helmet.position.y = 0.02; head.add(helmet);
  helmet.add(bx(0.24, 0.05, 0.06, H, 0, -0.02, 0.13));   // neck guard
  head.add(bx(0.2, 0.055, 0.03, Dk, 0, 0.02, -0.115));   // goggles strip
  const arms = new THREE.Group(); arms.position.set(0, 0.45, 0); upper.add(arms);
  const arm = (x, yaw, len) => { const p = new THREE.Group(); p.position.set(x, -0.02, 0); p.rotation.y = yaw; const up = capsule(0.062, len * 0.45, U); up.rotation.x = Math.PI / 2; up.position.z = -len * 0.28; p.add(up);
    const fore = capsule(0.055, len * 0.42, U); fore.rotation.x = Math.PI / 2; fore.position.z = -len * 0.7; p.add(fore); const hand = ball(0.055, G); hand.position.z = -len * 0.98; p.add(hand); arms.add(p); return p; };
  const armR = arm(0.2, 0.3, 0.5), armL = arm(-0.2, -0.42, 0.56);
  const shL = ball(0.08, U), shR = ball(0.08, U); shL.position.set(-0.21, 0.4, 0); shR.position.set(0.21, 0.4, 0); upper.add(shL, shR);
  const gunMount = new THREE.Group(); gunMount.position.set(0.12, -0.02, -0.35); arms.add(gunMount);
  root.userData = { body, legL, legR, upper, head, arms, armL, armR, gunMount, vest, helmet, gunId: null, skinKey: null };
  return root;
};
