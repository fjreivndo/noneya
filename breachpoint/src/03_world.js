/* ═══════════════════════════════════════════════════════════════════════════
   World: static boxes, their meshes, a broadphase grid for rays and
   collision, and a navigation grid with A* for the bots.
   All static geometry is axis-aligned boxes. That keeps rays, collision and
   line-of-sight exact and cheap enough to run thousands of times a second.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── procedural surface textures ───────────────────────────────────────── */
const Tex = {};
function makeSurface(name, base, fn, size = 128) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d'); c.fillStyle = base; c.fillRect(0, 0, size, size);
  const r = mulberry(hashStr(name)); fn(c, size, r);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; Tex[name] = t; return t;
}
function speckle(c, S, r, n, cols, sz = 2) { for (let i = 0; i < n; i++) { c.fillStyle = pick.call(null, cols); c.globalAlpha = 0.15 + r() * 0.35; c.fillRect(r() * S, r() * S, sz * (0.5 + r()), sz * (0.5 + r())); } c.globalAlpha = 1; }
function initSurfaces() {
  if (Tex.sand) return;
  makeSurface('sand', '#c9ae7c', (c, S, r) => speckle(c, S, r, 900, ['#b89a66', '#d8c096', '#a88c5a'], 2));
  makeSurface('plaster', '#d6c29a', (c, S, r) => { speckle(c, S, r, 500, ['#c4ae84', '#e2d2ae'], 3); c.strokeStyle = 'rgba(90,70,40,.25)'; for (let y = 0; y < S; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke(); } });
  makeSurface('brick', '#a4704c', (c, S, r) => { c.fillStyle = '#8a5a3a'; for (let y = 0, row = 0; y < S; y += 16, row++) { c.fillRect(0, y, S, 2); for (let x = (row % 2) * 16; x < S; x += 32) c.fillRect(x, y, 2, 16); } speckle(c, S, r, 300, ['#b88460', '#7a4a30'], 3); });
  makeSurface('concrete', '#8e8b84', (c, S, r) => { speckle(c, S, r, 900, ['#7c7972', '#a09d96', '#6a6760'], 2); c.strokeStyle = 'rgba(40,40,40,.25)'; c.strokeRect(0, 0, S, S); });
  makeSurface('crate', '#8a6236', (c, S, r) => { c.fillStyle = '#6b4826'; for (let y = 0; y < S; y += 21) c.fillRect(0, y, S, 2); c.strokeStyle = '#5a3a1c'; c.lineWidth = 8; c.strokeRect(4, 4, S - 8, S - 8); c.beginPath(); c.moveTo(8, 8); c.lineTo(S - 8, S - 8); c.stroke(); speckle(c, S, r, 200, ['#9a7246', '#704c28'], 3); });
  makeSurface('metal', '#5d6468', (c, S, r) => { for (let x = 0; x < S; x += 16) { c.fillStyle = x % 32 ? '#565d61' : '#666e72'; c.fillRect(x, 0, 16, S); } speckle(c, S, r, 150, ['#7a8286', '#3a3f42'], 2); });
  makeSurface('grass', '#5b7a3a', (c, S, r) => speckle(c, S, r, 1400, ['#4d6b30', '#6b8a44', '#3f5a28', '#7a9a50'], 2));
  makeSurface('dirt', '#7a6448', (c, S, r) => speckle(c, S, r, 900, ['#6a5438', '#8a7456', '#5a4630'], 2));
  makeSurface('rock', '#7d7a74', (c, S, r) => { speckle(c, S, r, 700, ['#6a6760', '#918e86', '#5a5750'], 5); });
  makeSurface('wood', '#7a5a3a', (c, S, r) => { for (let y = 0; y < S; y += 8) { c.fillStyle = r() < 0.5 ? '#6e5032' : '#846440'; c.fillRect(0, y, S, 7); } });
  makeSurface('sandbag', '#a8986e', (c, S, r) => { c.fillStyle = '#8a7a52'; for (let y = 0, row = 0; y < S; y += 21, row++) { c.fillRect(0, y, S, 3); for (let x = (row % 2) * 21; x < S; x += 42) c.fillRect(x, y, 3, 21); } });
  makeSurface('roof', '#6b3a2a', (c, S, r) => { c.fillStyle = '#5a2f22'; for (let y = 0; y < S; y += 12) c.fillRect(0, y, S, 3); });
}
const _matCache = {};
function mat(tex, color = '#ffffff') {
  const k = tex + color; if (_matCache[k]) return _matCache[k];
  return _matCache[k] = new THREE.MeshLambertMaterial({ map: Tex[tex] || null, color });
}
/* Box geometry with UVs scaled to real size so textures tile instead of stretching. */
function boxGeo(w, h, d, ts = 2) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts); }
  return g;
}

/* ── ray vs box ────────────────────────────────────────────────────────── */
let _rbAxis = 0, _rbSign = 0;
function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity, t1, t2, s;
  _rbAxis = 0; _rbSign = 0;
  if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) return -1; }
  else { t1 = (b.x0 - ox) / dx; t2 = (b.x1 - ox) / dx; s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; } if (t1 > tmin) { tmin = t1; _rbAxis = 0; _rbSign = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) return -1; }
  else { t1 = (b.y0 - oy) / dy; t2 = (b.y1 - oy) / dy; s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; } if (t1 > tmin) { tmin = t1; _rbAxis = 1; _rbSign = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) return -1; }
  else { t1 = (b.z0 - oz) / dz; t2 = (b.z1 - oz) / dz; s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; } if (t1 > tmin) { tmin = t1; _rbAxis = 2; _rbSign = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (tmax < 0) return -1;
  return tmin < 0 ? 0 : tmin;
}

/* ── world ─────────────────────────────────────────────────────────────── */
const World = {
  scene: null, group: null, boxes: [], cell: 8, grid: null, gx0: 0, gz0: 0, gw: 0, gh: 0, stamp: 1,
  zones: [], sites: {}, spawns: { T: [], CT: [] }, flags: [], hq: {}, vehicleSpawns: [], smokeSpots: {},
  bounds: { x0: -50, z0: -50, x1: 50, z1: 50 }, nav: null, def: null, hit: { t: 0, nx: 0, ny: 0, nz: 0, box: null },

  reset(scene) {
    if (this.group) { scene.remove(this.group); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.boxes = []; this.zones = []; this.sites = {}; this.spawns = { T: [], CT: [] }; this.flags = []; this.hq = {}; this.vehicleSpawns = []; this.smokeSpots = {};
  },
  add(x0, y0, z0, x1, y1, z1, tex, color, opts = {}) {
    const b = { x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), stamp: 0, tex };
    if (!opts.noCollide) this.boxes.push(b);
    if (!opts.invisible) {
      const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0;
      const m = new THREE.Mesh(boxGeo(w, h, d, opts.ts || 2), mat(tex, color));
      m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
      m.matrixAutoUpdate = false; m.updateMatrix(); this.group.add(m); b.mesh = m;
    }
    return b;
  },
  deco(obj) { obj.matrixAutoUpdate = false; obj.updateMatrix(); this.group.add(obj); return obj; },
  finalize() {
    const B = this.bounds, cs = this.cell;
    this.gx0 = B.x0 - cs; this.gz0 = B.z0 - cs;
    this.gw = Math.ceil((B.x1 - B.x0) / cs) + 2; this.gh = Math.ceil((B.z1 - B.z0) / cs) + 2;
    this.grid = Array.from({ length: this.gw * this.gh }, () => []);
    this.boxes.forEach((b, i) => {
      const cx0 = clamp(Math.floor((b.x0 - this.gx0) / cs), 0, this.gw - 1), cx1 = clamp(Math.floor((b.x1 - this.gx0) / cs), 0, this.gw - 1);
      const cz0 = clamp(Math.floor((b.z0 - this.gz0) / cs), 0, this.gh - 1), cz1 = clamp(Math.floor((b.z1 - this.gz0) / cs), 0, this.gh - 1);
      for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) this.grid[z * this.gw + x].push(b);
    });
    this.nav = new NavGrid(B.x0, B.z0, B.x1, B.z1, 1);
    this.nav.build();
  },
  /* boxes whose cells touch a rectangle; each box returned once */
  near(x0, z0, x1, z1, out = []) {
    out.length = 0; const cs = this.cell; this.stamp++;
    const cx0 = clamp(Math.floor((x0 - this.gx0) / cs), 0, this.gw - 1), cx1 = clamp(Math.floor((x1 - this.gx0) / cs), 0, this.gw - 1);
    const cz0 = clamp(Math.floor((z0 - this.gz0) / cs), 0, this.gh - 1), cz1 = clamp(Math.floor((z1 - this.gz0) / cs), 0, this.gh - 1);
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) for (const b of this.grid[z * this.gw + x]) if (b.stamp !== this.stamp) { b.stamp = this.stamp; out.push(b); }
    return out;
  },
  /* First hit along a normalized ray. Returns distance or -1; details in World.hit. */
  raycast(ox, oy, oz, dx, dy, dz, maxD) {
    let best = maxD, found = false; const H = this.hit; H.box = null;
    if (dy < -1e-6) { const t = -oy / dy; if (t >= 0 && t < best) { best = t; found = true; H.nx = 0; H.ny = 1; H.nz = 0; } }
    const cs = this.cell; this.stamp++;
    let cx = Math.floor((ox - this.gx0) / cs), cz = Math.floor((oz - this.gz0) / cs);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? cs / Math.abs(dx) : Infinity, tdz = Math.abs(dz) > 1e-9 ? cs / Math.abs(dz) : Infinity;
    let tmx = Math.abs(dx) > 1e-9 ? ((cx + (dx > 0 ? 1 : 0)) * cs + this.gx0 - ox) / dx : Infinity;
    let tmz = Math.abs(dz) > 1e-9 ? ((cz + (dz > 0 ? 1 : 0)) * cs + this.gz0 - oz) / dz : Infinity;
    let t = 0, guard = 0;
    while (t <= best && guard++ < 400) {
      if (cx >= 0 && cx < this.gw && cz >= 0 && cz < this.gh) {
        for (const b of this.grid[cz * this.gw + cx]) {
          if (b.stamp === this.stamp) continue; b.stamp = this.stamp;
          const tb = rayBox(ox, oy, oz, dx, dy, dz, b);
          if (tb >= 0 && tb < best) { best = tb; found = true; H.box = b; H.nx = _rbAxis === 0 ? _rbSign : 0; H.ny = _rbAxis === 1 ? _rbSign : 0; H.nz = _rbAxis === 2 ? _rbSign : 0; }
        }
      } else if ((cx < 0 && sx < 0) || (cx >= this.gw && sx > 0) || (cz < 0 && sz < 0) || (cz >= this.gh && sz > 0)) break;
      if (tmx < tmz) { t = tmx; tmx += tdx; cx += sx; } else { t = tmz; tmz += tdz; cz += sz; }
    }
    H.t = best;
    return found ? best : -1;
  },
  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.05) < 0;
  },
  zoneAt(x, z) { for (const zn of this.zones) if (x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) return zn.name; return ''; },
  siteAt(x, z) { for (const k in this.sites) { const s = this.sites[k]; if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return k; } return null; },
  /* solid box overlap test for a standing body — used by step-up and uncrouch */
  bodyFree(x, y, z, r, h) {
    for (const b of this.near(x - r, z - r, x + r, z + r, _tmpNear2)) if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1 && y + h > b.y0 && y < b.y1 - 0.001) return false;
    return true;
  },
};
const _tmpNear = [], _tmpNear2 = [];

/* Move a body (feet at p) through the world. Axis-separated so sliding along
   walls works; small ledges (crates, stairs) are stepped up automatically. */
const STEP = 0.55;
function moveBody(p, v, dt, r, h, grounded) {
  const near = World.near(p.x - r - 1.5, p.z - r - 1.5, p.x + r + 1.5, p.z + r + 1.5, _tmpNear);
  // sandbox props: their bounding boxes collide like walls you can stand on
  if (Phys.dyn.length) for (const d of Phys.dyn) if (d.x1 > p.x - r - 1.5 && d.x0 < p.x + r + 1.5 && d.z1 > p.z - r - 1.5 && d.z0 < p.z + r + 1.5 && d.y1 > p.y - 1 && d.y0 < p.y + h + 1) near.push(d);
  const res = { grounded: false, hitWall: false, landed: 0 };
  for (let axis = 0; axis < 2; axis++) {
    const vv = axis === 0 ? v.x : v.z; if (vv === 0) continue;
    if (axis === 0) p.x += vv * dt; else p.z += vv * dt;
    for (const b of near) {
      if (!(p.x + r > b.x0 && p.x - r < b.x1 && p.z + r > b.z0 && p.z - r < b.z1 && p.y + h > b.y0 && p.y < b.y1 - 0.001)) continue;
      const rise = b.y1 - p.y;
      if (grounded && rise > 0 && rise <= STEP && World.bodyFree(p.x, b.y1 + 0.001, p.z, r, h)) { p.y = b.y1; continue; }
      res.hitWall = true;
      if (b.prop && !b.prop.frozen && b.prop.body && b.prop.def.mass * b.prop.scale ** 3 < 400) { // shove light props out of the way
        const bv = b.prop.body.velocity, want = vv * 0.9; if (axis === 0) bv.x += (want - bv.x) * 0.5; else bv.z += (want - bv.z) * 0.5; b.prop.body.wakeUp();
      }
      if (axis === 0) { p.x = vv > 0 ? b.x0 - r - 1e-4 : b.x1 + r + 1e-4; }
      else { p.z = vv > 0 ? b.z0 - r - 1e-4 : b.z1 + r + 1e-4; }
    }
  }
  const prevY = p.y; p.y += v.y * dt;
  if (p.y <= 0) { if (v.y < 0) res.landed = -v.y; p.y = 0; v.y = 0; res.grounded = true; }
  for (const b of near) {
    if (!(p.x + r > b.x0 && p.x - r < b.x1 && p.z + r > b.z0 && p.z - r < b.z1)) continue;
    if (p.y + h > b.y0 && p.y < b.y1) {
      if (v.y <= 0 && prevY >= b.y1 - STEP) { if (v.y < 0) res.landed = -v.y; p.y = b.y1; v.y = 0; res.grounded = true; }
      else if (v.y > 0) { p.y = b.y0 - h; v.y = 0; }
    } else if (Math.abs(p.y - b.y1) < 0.02 && v.y <= 0) { p.y = b.y1; v.y = 0; res.grounded = true; }
  }
  const B = World.bounds; p.x = clamp(p.x, B.x0 + r, B.x1 - r); p.z = clamp(p.z, B.z0 + r, B.z1 - r);
  return res;
}

/* ── navigation grid + A* ──────────────────────────────────────────────── */
class NavGrid {
  constructor(x0, z0, x1, z1, cs) {
    this.x0 = x0; this.z0 = z0; this.cs = cs; this.w = Math.ceil((x1 - x0) / cs); this.h = Math.ceil((z1 - z0) / cs);
    const n = this.w * this.h;
    this.walk = new Uint8Array(n); this.cost = new Float32Array(n); this.g = new Float32Array(n); this.par = new Int32Array(n);
    this.seen = new Uint32Array(n); this.closed = new Uint32Array(n); this.run = 0; this.heap = []; this.hf = new Float32Array(n);
  }
  idx(x, z) { const cx = Math.floor((x - this.x0) / this.cs), cz = Math.floor((z - this.z0) / this.cs); return (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) ? -1 : cz * this.w + cx; }
  cx(i) { return this.x0 + (i % this.w + 0.5) * this.cs; }
  cz(i) { return this.z0 + (Math.floor(i / this.w) + 0.5) * this.cs; }
  build() {
    // a cell is walkable when a body standing on its centre fits (radius R), so
    // 1.7 m doorways stay open while the path still keeps off walls via cost
    const R = 0.4, cs = this.cs, near = [];
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      const wx = this.x0 + (x + 0.5) * cs, wz = this.z0 + (z + 0.5) * cs; let ok = 1;
      for (const b of World.near(wx - cs, wz - cs, wx + cs, wz + cs, near)) {
        if (b.y0 < 1.6 && b.y1 > 0.5 && wx + R > b.x0 && wx - R < b.x1 && wz + R > b.z0 && wz - R < b.z1) { ok = 0; break; }
      }
      this.walk[z * this.w + x] = ok;
    }
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      const i = z * this.w + x; if (!this.walk[i]) continue; let c = 1;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h || !this.walk[nz * this.w + nx]) c = 2.2; }
      this.cost[i] = c;
    }
  }
  walkableAt(x, z) { const i = this.idx(x, z); return i >= 0 && this.walk[i] === 1; }
  nearest(x, z, maxR = 12) {
    let i = this.idx(x, z); if (i >= 0 && this.walk[i]) return i;
    const cx = Math.floor((x - this.x0) / this.cs), cz = Math.floor((z - this.z0) / this.cs);
    for (let r = 1; r <= maxR; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue; i = nz * this.w + nx; if (this.walk[i]) return i;
    }
    return -1;
  }
  /* straight grid line clear of blocked cells (supercover-ish by sampling) */
  lineClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (this.cs * 0.5));
    for (let k = 0; k <= n; k++) { const t = n ? k / n : 0; const i = this.idx(ax + (bx - ax) * t, az + (bz - az) * t); if (i < 0 || !this.walk[i]) return false; }
    return true;
  }
  lineHits(ax, az, bx, bz, fn) { const n = Math.ceil(Math.hypot(bx - ax, bz - az)); for (let k = 0; k <= n; k++) { const t = n ? k / n : 0; if (fn(ax + (bx - ax) * t, az + (bz - az) * t)) return true; } return false; }
  hpush(i, f) { const h = this.heap; this.hf[i] = f; h.push(i); let k = h.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (this.hf[h[p]] <= f) break; h[k] = h[p]; k = p; } h[k] = i; }
  hpop() { const h = this.heap, top = h[0], last = h.pop(); if (h.length) { let k = 0; const f = this.hf[last]; for (;;) { let c = 2 * k + 1; if (c >= h.length) break; if (c + 1 < h.length && this.hf[h[c + 1]] < this.hf[h[c]]) c++; if (this.hf[h[c]] >= f) break; h[k] = h[c]; k = c; } h[k] = last; } return top; }
  /* avoid: rectangles to route around when there's another way (cost, not a wall) */
  find(sx, sz, tx, tz, avoid, maxIter = 16000) {
    const s = this.nearest(sx, sz), t = this.nearest(tx, tz);
    if (s < 0 || t < 0) return null;
    if (s === t) return [{ x: tx, z: tz }];
    const inAvoid = (x, z) => { if (!avoid) return false; for (const r of avoid) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true; return false; };
    const tInAvoid = inAvoid(tx, tz), avoiding = avoid && avoid.length && !tInAvoid;
    if (this.lineClear(sx, sz, tx, tz) && !(avoiding && this.lineHits(sx, sz, tx, tz, inAvoid))) return [{ x: tx, z: tz }];
    const run = ++this.run, W = this.w, tX = t % W, tZ = Math.floor(t / W);
    this.heap.length = 0; this.g[s] = 0; this.par[s] = -1; this.seen[s] = run;
    const hfn = i => { const dx = Math.abs(i % W - tX), dz = Math.abs(Math.floor(i / W) - tZ); return (dx + dz + (1.414 - 2) * Math.min(dx, dz)) * 1.15; };
    this.hpush(s, hfn(s)); let it = 0, found = false;
    while (this.heap.length && it++ < maxIter) {
      const c = this.hpop(); if (this.closed[c] === run) continue; this.closed[c] = run;
      if (c === t) { found = true; break; }
      const cx = c % W, cz = Math.floor(c / W);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const n = nz * W + nx; if (!this.walk[n] || this.closed[n] === run) continue;
        if (dx && dz && (!this.walk[cz * W + nx] || !this.walk[nz * W + cx])) continue;
        const ng = this.g[c] + (dx && dz ? 1.414 : 1) * this.cost[n] * (avoiding && inAvoid(this.cx(n), this.cz(n)) ? 12 : 1);
        if (this.seen[n] !== run || ng < this.g[n]) { this.seen[n] = run; this.g[n] = ng; this.par[n] = c; this.hpush(n, ng + hfn(n)); }
      }
    }
    if (!found) return null;
    const cells = []; for (let c = t; c !== -1; c = this.par[c]) cells.push(c); cells.reverse();
    // string pulling: keep only the corners that matter
    const out = []; let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && (!this.lineClear(this.cx(cells[i]), this.cz(cells[i]), this.cx(cells[j]), this.cz(cells[j])) || (avoiding && this.lineHits(this.cx(cells[i]), this.cz(cells[i]), this.cx(cells[j]), this.cz(cells[j]), inAvoid)))) j--;
      out.push({ x: this.cx(cells[j]), z: this.cz(cells[j]) }); i = j;
    }
    if (out.length) { out[out.length - 1] = { x: this.walkableAt(tx, tz) ? tx : this.cx(t), z: this.walkableAt(tx, tz) ? tz : this.cz(t) }; }
    return out;
  }
  randomNear(x, z, r, tries = 20) {
    for (let k = 0; k < tries; k++) { const a = rand(0, TAU), d = rand(0, r); const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (this.walkableAt(px, pz)) return { x: px, z: pz }; }
    const i = this.nearest(x, z); return i >= 0 ? { x: this.cx(i), z: this.cz(i) } : { x, z };
  }
}

/* ── maps ──────────────────────────────────────────────────────────────── */
function groundPlane(tex, size, color, cx = 0, cz = 0) {
  const g = new THREE.PlaneGeometry(size, size); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / 3, uv.getY(i) * size / 3);
  const m = new THREE.Mesh(g, mat(tex, color)); m.rotation.x = -Math.PI / 2; m.position.set(cx, 0, cz); return World.deco(m);
}
function labelDecal(text, x, z, size, color) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = color; c.font = 'bold 110px Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.75; c.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); return World.deco(m);
}
function zoneDecal(x0, z0, x1, z1, color, op = 0.14) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.015, (z0 + z1) / 2); return World.deco(m);
}

/* Dustyard is authored as a character grid (2m cells) by carving rooms out of
   solid rock, then turned into merged boxes. */
function buildDustyard() {
  const N = 44, CS = 2, G = Array.from({ length: N }, () => Array(N).fill('#'));
  const carve = (x0, z0, x1, z1, ch) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) G[z][x] = ch; };
  const put = (x, z, ch) => { G[z][x] = ch; };
  carve(1, 1, 12, 12, 'B'); carve(13, 5, 14, 7, '.'); carve(15, 1, 28, 11, '.'); carve(18, 1, 25, 2, 'S');
  carve(29, 3, 30, 6, '.'); carve(31, 1, 42, 13, 'A'); carve(3, 13, 7, 30, '.'); carve(18, 12, 25, 35, '.');
  carve(26, 13, 30, 15, '.'); carve(36, 14, 41, 30, '.'); carve(8, 22, 17, 24, '.'); carve(2, 31, 41, 34, '.');
  carve(12, 35, 31, 42, '.'); carve(15, 39, 28, 41, 'T');
  // mid doors choke
  carve(18, 17, 19, 17, '#'); carve(24, 17, 25, 17, '#');
  // cover
  [[5, 5], [6, 5], [5, 6], [36, 6], [37, 6], [36, 7], [10, 32], [30, 33], [25, 31], [9, 23]].forEach(([x, z]) => put(x, z, 'C'));
  [[9, 8], [3, 10], [10, 3], [33, 3], [40, 10], [39, 2], [34, 11], [37, 22], [40, 26], [21, 26], [19, 14], [20, 7], [26, 4], [5, 20], [28, 14], [23, 21], [13, 37], [30, 38], [16, 36]].forEach(([x, z]) => put(x, z, 'c'));
  [[15, 33], [16, 33], [27, 32], [28, 32], [2, 27], [41, 18]].forEach(([x, z]) => put(x, z, 'h'));

  const wx = x => (x - N / 2) * CS, wz = z => (z - N / 2) * CS;
  World.bounds = { x0: -N, z0: -N, x1: N, z1: N };
  groundPlane('sand', 120, '#ffffff');
  // merge wall runs row by row, then stack identical runs downward
  const used = Array.from({ length: N }, () => Array(N).fill(false));
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    if (G[z][x] !== '#' || used[z][x]) continue;
    let x2 = x; while (x2 + 1 < N && G[z][x2 + 1] === '#' && !used[z][x2 + 1]) x2++;
    let z2 = z; const rowOk = zz => { for (let k = x; k <= x2; k++) if (G[zz][k] !== '#' || used[zz][k]) return false; return true; };
    while (z2 + 1 < N && rowOk(z2 + 1)) z2++;
    for (let zz = z; zz <= z2; zz++) for (let k = x; k <= x2; k++) used[zz][k] = true;
    const border = x === 0 || z === 0 || x2 === N - 1 || z2 === N - 1;
    const h = border ? 9 : 4.5 + (hashStr(x + ',' + z) % 5) * 0.6;
    const tex = (hashStr(z + ':' + x) % 3) === 0 ? 'brick' : 'plaster';
    World.add(wx(x), 0, wz(z), wx(x2 + 1), h, wz(z2 + 1), tex, border ? '#c9b48a' : '#ffffff');
  }
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const ch = G[z][x], x0 = wx(x), z0 = wz(z);
    if (ch === 'C') { World.add(x0 + 0.1, 0, z0 + 0.1, x0 + 1.9, 1.1, z0 + 1.9, 'crate'); World.add(x0 + 0.25, 1.1, z0 + 0.25, x0 + 1.75, 2.2, z0 + 1.75, 'crate', '#d8c8a8'); }
    if (ch === 'c') World.add(x0 + 0.2, 0, z0 + 0.2, x0 + 1.8, 1.1, z0 + 1.8, 'crate');
    if (ch === 'h') World.add(x0, 0, z0 + 0.6, x0 + 2, 1.05, z0 + 1.4, 'concrete');
    if (ch === 'S') World.spawns.CT.push({ x: x0 + 1, z: z0 + 1, yaw: Math.PI });
    if (ch === 'T') World.spawns.T.push({ x: x0 + 1, z: z0 + 1, yaw: 0 });
  }
  const rect = (x0, z0, x1, z1) => ({ x0: wx(x0), z0: wz(z0), x1: wx(x1 + 1), z1: wz(z1 + 1) });
  const zone = (name, x0, z0, x1, z1) => World.zones.push(Object.assign({ name }, rect(x0, z0, x1, z1)));
  zone('B Site', 1, 1, 12, 12); zone('B Doors', 13, 5, 14, 7); zone('CT Spawn', 15, 1, 28, 11); zone('A Ramp', 29, 3, 30, 6);
  zone('A Site', 31, 1, 42, 13); zone('B Tunnels', 3, 13, 7, 30); zone('Short', 26, 13, 30, 15); zone('Mid', 18, 12, 25, 35);
  zone('Long A', 36, 14, 41, 30); zone('Lower', 8, 22, 17, 24); zone('Courtyard', 2, 31, 41, 34); zone('T Spawn', 12, 35, 31, 42);
  World.sites.A = Object.assign(rect(31, 1, 42, 13), { name: 'A' }); World.sites.B = Object.assign(rect(1, 1, 12, 12), { name: 'B' });
  for (const k in World.sites) { const s = World.sites[k]; s.cx = (s.x0 + s.x1) / 2; s.cz = (s.z0 + s.z1) / 2; zoneDecal(s.x0, s.z0, s.x1, s.z1, '#ff5533', 0.1); labelDecal(k, s.cx, s.cz, 7, '#ff5533'); }
  const P = (x, z) => ({ x: wx(x) + 1, z: wz(z) + 1 });
  /* Routes the T commander chooses between. stage = where the group gathers;
     entry = where they push to; smoke/flash = utility targets for the execute. */
  World.routes = {
    A: [
      { name: 'Long A', stage: P(38, 27), entry: P(38, 9), hold: [P(35, 4), P(40, 5), P(33, 10)], smoke: [P(30, 5)], flash: [P(38, 12)] },
      { name: 'Short', stage: P(22, 18), mid: P(27, 14), entry: P(34, 9), hold: [P(35, 4), P(39, 9)], smoke: [P(30, 5)], flash: [P(31, 12)] },
    ],
    B: [
      { name: 'B Tunnels', stage: P(5, 17), entry: P(6, 6), hold: [P(3, 3), P(9, 10), P(10, 5)], smoke: [P(13, 6)], flash: [P(5, 12)] },
      { name: 'B Doors', stage: P(22, 13), mid: P(17, 6), entry: P(8, 6), hold: [P(4, 4), P(9, 9)], smoke: [P(5, 13)], flash: [P(13, 6)] },
    ],
  };
  /* CT holds: position + where to look */
  World.ctHolds = [
    { site: 'A', pos: P(35, 11), look: P(38, 16) }, { site: 'A', pos: P(32, 4), look: P(28, 14) },
    { site: 'mid', pos: P(21, 8), look: P(21, 20) },
    { site: 'B', pos: P(5, 9), look: P(5, 16) }, { site: 'B', pos: P(10, 10), look: P(5, 14) },
  ];
  World.skyColor = 0x9ec4e8; World.fog = [0xd8c8a8, 60, 220]; World.sun = 0xfff1d6;
}

/* Ridgeline: a Battlefield-sized field with five villages to fight over. */
function house(cx, cz, w, d, doors = 'nesw', tex = 'plaster', color = '#ffffff') {
  const t = 0.3, H = 3.2, dw = 1.7, dh = 2.3, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const wall = (ax, az, bx, bz, side) => { // wall along x or z from a to b, with door or window in middle
    const alongX = az === bz, len = alongX ? bx - ax : bz - az, mid = len / 2;
    const seg = (s0, s1, y0, y1) => alongX ? World.add(ax + s0, y0, az - t / 2, ax + s1, y1, az + t / 2, tex, color) : World.add(ax - t / 2, y0, az + s0, ax + t / 2, y1, az + s1, tex, color);
    if (doors.includes(side)) { seg(0, mid - dw / 2, 0, H); seg(mid + dw / 2, len, 0, H); seg(mid - dw / 2, mid + dw / 2, dh, H); }
    else { seg(0, mid - 0.7, 0, H); seg(mid + 0.7, len, 0, H); seg(mid - 0.7, mid + 0.7, 0, 1.0); seg(mid - 0.7, mid + 0.7, 2.0, H); }
  };
  wall(x0, z0, x1, z0, 'n'); wall(x0, z1, x1, z1, 's'); wall(x0, z0 + t / 2, x0, z1 - t / 2, 'w'); wall(x1, z0 + t / 2, x1, z1 - t / 2, 'e');
  World.add(x0 - 0.3, H, z0 - 0.3, x1 + 0.3, H + 0.3, z1 + 0.3, 'roof', '#ffffff');
}
function sandbags(x0, z0, x1, z1) { World.add(x0, 0, z0, x1, 1.05, z1, 'sandbag'); }
function tree(x, z, s = 1) {
  World.add(x - 0.3 * s, 0, z - 0.3 * s, x + 0.3 * s, 3 * s, z + 0.3 * s, 'wood', '#8a6a4a');
  const m = new THREE.Mesh(new THREE.ConeGeometry(2.2 * s, 5 * s, 7), mat('grass', '#4a7040'));
  m.position.set(x, 4.8 * s, z); World.deco(m);
}
function rock(x, z, w, h, d) { World.add(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 'rock', '#ffffff', { ts: 3 }); }

function buildRidgeline() {
  const S = 110; World.bounds = { x0: -S, z0: -S, x1: S, z1: S };
  groundPlane('grass', 260, '#ffffff');
  const r = mulberry(1337);
  // perimeter cliffs
  for (let i = -S; i < S; i += 12) { const h = 10 + r() * 8; rock(i + 6, -S - 3, 13, h, 8); rock(i + 6, S + 3, 13, h, 8); rock(-S - 3, i + 6, 8, h, 13); rock(S + 3, i + 6, 8, h, 13); }
  const flags = [
    { name: 'A', label: 'Farm', x: -60, z: 52 }, { name: 'B', label: 'Radio', x: 58, z: 48 }, { name: 'C', label: 'Village', x: 0, z: 0 },
    { name: 'D', label: 'Quarry', x: -58, z: -50 }, { name: 'E', label: 'Depot', x: 60, z: -54 },
  ];
  // A — farm: barn + house + fences
  house(-66, 46, 12, 8, 'ns', 'wood', '#a86a4a'); house(-52, 60, 7, 7, 'we'); sandbags(-58, 44, -54, 45); World.add(-70, 0, 58, -60, 1.0, 58.3, 'wood'); World.add(-48, 0, 44, -48.3, 1.0, 54, 'wood');
  // B — radio tower compound
  house(52, 42, 8, 8, 'sw', 'concrete', '#c8c8c0'); house(66, 54, 7, 9, 'nw', 'concrete', '#c8c8c0'); World.add(57.5, 0, 47.5, 58.5, 14, 48.5, 'metal'); sandbags(60, 40, 64, 41); sandbags(48, 52, 49, 56);
  // C — village plaza
  house(-10, -9, 8, 7, 'se'); house(10, -10, 7, 8, 'sw', 'brick'); house(-11, 10, 7, 8, 'ne', 'brick'); house(11, 9, 8, 7, 'nw'); World.add(-1.2, 0, -1.2, 1.2, 0.8, 1.2, 'concrete'); sandbags(-3, 16, 3, 17); sandbags(-3, -17, 3, -16);
  // D — quarry: rock piles
  rock(-66, -44, 8, 4, 6); rock(-50, -58, 6, 3, 9); rock(-62, -58, 5, 5, 5); house(-50, -42, 7, 6, 'sn', 'concrete', '#b0aca4'); sandbags(-60, -48, -56, -47);
  // E — depot: containers
  World.add(52, 0, -62, 58, 2.6, -59.5, 'metal', '#8a3a2a'); World.add(62, 0, -48, 64.5, 2.6, -42, 'metal', '#2a5a8a'); World.add(52, 2.6, -62, 58, 5.2, -59.5, 'metal', '#3a7a4a');
  house(68, -58, 8, 8, 'nw', 'concrete', '#c8c8c0'); sandbags(56, -50, 60, -49);
  // HQs
  World.hq.CT = { x: 0, z: 98 }; World.hq.T = { x: 0, z: -98 };
  for (const k of ['CT', 'T']) {
    const h = World.hq[k], s = k === 'CT' ? 1 : -1;
    sandbags(h.x - 12, h.z - 8 * s, h.x - 4, h.z - 8 * s + 1 * s); sandbags(h.x + 4, h.z - 8 * s, h.x + 12, h.z - 8 * s + 1 * s);
    house(h.x - 18, h.z + 2 * s, 8, 6, s > 0 ? 'n' : 's', 'concrete', k === 'CT' ? '#9ab0c8' : '#c8a890');
    for (let i = 0; i < 8; i++) World.spawns[k].push({ x: h.x - 8 + i * 2.2, z: h.z + 2 * s, yaw: s > 0 ? Math.PI : 0 });
    World.vehicleSpawns.push({ team: k, x: h.x + 16, z: h.z, yaw: s > 0 ? Math.PI : 0 }, { team: k, x: h.x + 22, z: h.z - 3 * s, yaw: s > 0 ? Math.PI : 0 });
  }
  // scattered cover
  for (let i = 0; i < 70; i++) {
    const x = rand.call(null, -100, 100), z = (r() * 2 - 1) * 90; const rx = (r() * 2 - 1) * 100;
    if (flags.some(f => dist2(f.x, f.z, rx, z) < 16) || Math.abs(z) > 84 && Math.abs(rx) < 30) continue;
    if (r() < 0.55) tree(rx, z, 0.8 + r() * 0.5); else rock(rx, z, 1.5 + r() * 3, 0.9 + r() * 2, 1.5 + r() * 3);
  }
  // field walls between lanes
  [[-30, 30, -18, 30.5], [18, 28, 32, 28.5], [-34, -28, -20, -27.5], [22, -30, 36, -29.5], [-86, 0, -72, 0.5], [72, 4, 86, 4.5], [-6, 50, 6, 50.5], [-6, -52, 6, -51.5]]
    .forEach(([a, b, c, d]) => World.add(a, 0, b, c, 1.1, d, 'rock', '#b0aca0'));
  // dirt roads
  const road = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0) || 5, Math.abs(z1 - z0) || 5), mat('dirt')); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.01, (z0 + z1) / 2); World.deco(m); };
  road(-2.5, -100, 2.5, 100); road(-70, -2.5, 70, 2.5);
  flags.forEach(f => { World.flags.push(Object.assign({ owner: null, prog: 0, radius: 11 }, f)); World.zones.push({ name: f.name + ' ' + f.label, x0: f.x - 16, z0: f.z - 16, x1: f.x + 16, z1: f.z + 16 }); });
  World.zones.push({ name: 'Aegis HQ', x0: -30, z0: 84, x1: 30, z1: 110 }, { name: 'Vanta HQ', x0: -30, z0: -110, x1: 30, z1: -84 });
  World.skyColor = 0xa8c8e8; World.fog = [0xbfd0dc, 110, 460]; World.sun = 0xfff4e0;
}

const MAPS = {
  dustyard: { name: 'Dustyard', build: buildDustyard, modes: ['defuse', 'tdm'], desc: 'Tight lanes, two bomb sites. Built for 5v5.' },
  ridgeline: { name: 'Ridgeline', build: buildRidgeline, modes: ['conquest', 'tdm'], desc: 'Open valley, five flags, jeeps. Up to 16v16.' },
};
function loadMap(id, scene) {
  initSurfaces(); World.reset(scene); World.def = MAPS[id]; World.id = id;
  MAPS[id].build(); World.finalize();
}
