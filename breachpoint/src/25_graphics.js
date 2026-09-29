/* ═══════════════════════════════════════════════════════════════════════════
   Graphics overhaul.
   · Surfaces: 256px procedural textures built from tiling fractal noise,
     each with a normal map, on physically based materials. Boxes get baked
     contact shading where they meet the ground.
   · Light: a sun that casts soft shadows around the camera, sky lighting from
     a gradient sky dome with a sun disc, and filmic tone mapping.
   · Post: HDR render, bloom on bright things (sun, muzzle flashes,
     explosions, lamps), a light colour grade and a vignette.
   · Detail: grass tufts, rocks and rubble scattered where nothing stands.
   · Settings → Graphics: Low (the old look) / Medium / High.
   ═══════════════════════════════════════════════════════════════════════════ */
if (Settings.gfx == null) Settings.gfx = 'high';
const GFX_Q = { low: { shadow: 0, post: false, props: 0, msaa: 0 }, medium: { shadow: 1024, post: true, props: 0.5, msaa: 0 }, high: { shadow: 2048, post: true, props: 1, msaa: 4 } };
const gq = () => GFX_Q[Settings.gfx] || GFX_Q.high;

/* ── tiling noise ──────────────────────────────────────────────────────── */
function tileNoise(S, r, periods, amps) {
  const out = new Float32Array(S * S); let norm = 0;
  periods.forEach((P, o) => {
    const g = new Float32Array(P * P); for (let i = 0; i < g.length; i++) g[i] = r();
    const a = amps[o]; norm += a;
    for (let y = 0; y < S; y++) {
      const fy = y / S * P, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), y1 = (y0 + 1) % P;
      for (let x = 0; x < S; x++) {
        const fx = x / S * P, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % P;
        const v = lerp(lerp(g[y0 * P + x0], g[y0 * P + x1], sx), lerp(g[y1 * P + x0], g[y1 * P + x1], sx), sy);
        out[y * S + x] += v * a;
      }
    }
  });
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}
/* draw something that may cross the tile edge on every side it touches */
function wrapped(S, x, y, rad, fn) { for (const dx of [0, -S, S]) for (const dy of [0, -S, S]) { if ((dx && (dx < 0 ? x < S - rad : x > rad)) || (dy && (dy < 0 ? y < S - rad : y > rad))) continue; fn(x + dx, y + dy); } }

/* A surface: colour canvas painted by `paint`, modulated by fractal noise, and a
   normal map from a height field (the painted luminance, optionally inverted,
   plus the noise). */
function makeSurface2(name, o) {
  const S = 256, r = mulberry(hashStr(name + '#2'));
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
  c.fillStyle = o.base; c.fillRect(0, 0, S, S);
  const hc = document.createElement('canvas'); hc.width = hc.height = S; const h = hc.getContext('2d');
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  if (o.paint) o.paint(c, S, r, h);
  const n = tileNoise(S, r, [4, 8, 16, 32, 64, 128], [1, 0.8, 0.55, 0.4, 0.3, 0.2]);
  const img = c.getImageData(0, 0, S, S), d = img.data, hd = h.getImageData(0, 0, S, S).data, H = new Float32Array(S * S);
  const amp = o.noise != null ? o.noise : 0.3, tint = o.tint;
  for (let i = 0; i < S * S; i++) {
    const k = 1 + (n[i] - 0.5) * 2 * amp; let R = d[i * 4] * k, G = d[i * 4 + 1] * k, B = d[i * 4 + 2] * k;
    if (tint) { const m = Math.max(0, n[i] - 0.55) * tint[3]; R = lerp(R, tint[0], m); G = lerp(G, tint[1], m); B = lerp(B, tint[2], m); }
    d[i * 4] = clamp(R, 0, 255); d[i * 4 + 1] = clamp(G, 0, 255); d[i * 4 + 2] = clamp(B, 0, 255);
    H[i] = hd[i * 4] / 255 * (o.hk != null ? o.hk : 1) + n[i] * (o.nk != null ? o.nk : 0.5);
  }
  c.putImageData(img, 0, 0);
  const nc = document.createElement('canvas'); nc.width = nc.height = S; const nctx = nc.getContext('2d'), ni = nctx.createImageData(S, S), nd = ni.data, st = o.bump != null ? o.bump : 4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const L = H[y * S + (x - 1 + S) % S], R = H[y * S + (x + 1) % S], U = H[((y - 1 + S) % S) * S + x], D = H[((y + 1) % S) * S + x];
    let nx = (L - R) * st, ny = (D - U) * st, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4; nd[i] = (nx * 0.5 + 0.5) * 255; nd[i + 1] = (ny * 0.5 + 0.5) * 255; nd[i + 2] = (nz * 0.5 + 0.5) * 255; nd[i + 3] = 255;
  }
  nctx.putImageData(ni, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const tn = new THREE.CanvasTexture(nc); tn.wrapS = tn.wrapT = THREE.RepeatWrapping; tn.anisotropy = 8;
  Tex[name] = t; Tex[name + '_n'] = tn; SURF[name] = { rough: o.rough != null ? o.rough : 0.9, metal: o.metal || 0, ns: o.ns || 1 };
  return t;
}
const SURF = {};
const rgba = (a, rgb = '0,0,0') => `rgba(${rgb},${a})`;
function dots(c, S, r, n, cols, s0, s1, h, hv) {
  for (let i = 0; i < n; i++) { const x = r() * S, y = r() * S, s = s0 + r() * (s1 - s0); c.fillStyle = cols[Math.floor(r() * cols.length)]; c.globalAlpha = 0.25 + r() * 0.5;
    wrapped(S, x, y, s, (X, Y) => { c.beginPath(); c.ellipse(X, Y, s, s * (0.6 + r() * 0.4), r() * 3, 0, TAU); c.fill(); if (h) { h.fillStyle = hv; h.beginPath(); h.ellipse(X, Y, s, s * 0.8, 0, 0, TAU); h.fill(); } }); }
  c.globalAlpha = 1;
}
function cracks(c, S, r, n, col, h) {
  c.strokeStyle = col; if (h) h.strokeStyle = '#303030';
  for (let i = 0; i < n; i++) { let x = r() * S, y = r() * S, a = r() * TAU; const len = 10 + r() * 40, pts = [[x, y]];
    for (let k = 0; k < len / 4; k++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * 4; y += Math.sin(a) * 4; pts.push([x, y]); }
    for (const ctx of h ? [c, h] : [c]) { ctx.lineWidth = 0.6 + r() * 0.8; wrapped(S, pts[0][0], pts[0][1], len, (X, Y) => { const ox = X - pts[0][0], oy = Y - pts[0][1]; ctx.beginPath(); pts.forEach(([px, py], j) => j ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)); ctx.stroke(); }); } }
}

const _initSurfaces0 = initSurfaces;
initSurfaces = function () {
  if (Tex.sand) return;
  _initSurfaces0();   // older materials and props keep working with the low-res set until replaced below
  makeSurface2('sand', { base: '#c8ab78', noise: 0.18, bump: 3, paint(c, S, r, h) {
    for (let y = 0; y < S; y += 2) { const w = Math.sin(y / S * TAU * 6 + Math.sin(y / S * TAU) * 2); c.fillStyle = w > 0 ? rgba(0.05 * w, '255,240,210') : rgba(-0.06 * w); c.fillRect(0, y, S, 2); h.fillStyle = `rgb(${128 + w * 30 | 0},0,0)`; h.fillRect(0, y, S, 2); }
    dots(c, S, r, 2600, ['#b39462', '#dcc49a', '#a2865a', '#e8d6b0'], 0.4, 1.1); dots(c, S, r, 40, ['#8a7a64', '#a09080'], 1, 2.2, h, '#c0c0c0'); } });
  makeSurface2('plaster', { base: '#d4c09a', noise: 0.22, bump: 3, tint: [150, 125, 95, 0.9], paint(c, S, r, h) {
    dots(c, S, r, 900, ['#c4ae84', '#e4d4b2', '#bfa77c'], 0.8, 3); for (let i = 0; i < 14; i++) { c.fillStyle = rgba(0.06 + r() * 0.06, '120,100,70'); const x = r() * S, y = r() * S, s = 8 + r() * 30; wrapped(S, x, y, s, (X, Y) => { c.beginPath(); c.ellipse(X, Y, s, s * 0.6, r() * 3, 0, TAU); c.fill(); }); }
    cracks(c, S, r, 6, rgba(0.35, '70,55,40'), h); c.fillStyle = rgba(0.18, '90,70,40'); c.fillRect(0, S - 2, S, 2); h.fillStyle = '#505050'; h.fillRect(0, S - 2, S, 2); } });
  makeSurface2('brick', { base: '#b3aa98', noise: 0.18, bump: 6, hk: 1, paint(c, S, r, h) {
    const rows = 12, bh = S / rows, bw = S / 4;
    h.fillStyle = '#404040'; h.fillRect(0, 0, S, S);
    for (let row = 0; row < rows; row++) for (let k = -1; k < 4; k++) {
      const x = k * bw + (row % 2) * bw / 2, y = row * bh, v = r(); const R = 150 + v * 40 | 0, G = 88 + v * 30 | 0, B = 58 + v * 20 | 0;
      c.fillStyle = `rgb(${R},${G},${B})`; c.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3); h.fillStyle = '#b0b0b0'; h.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      c.fillStyle = rgba(0.18, '255,230,200'); c.fillRect(x + 1.5, y + 1.5, bw - 3, 1.5); c.fillStyle = rgba(0.22); c.fillRect(x + 1.5, y + bh - 3, bw - 3, 1.5);
      if (x + bw > S) { c.fillStyle = `rgb(${R},${G},${B})`; c.fillRect(x - S + 1.5, y + 1.5, bw - 3, bh - 3); h.fillStyle = '#b0b0b0'; h.fillRect(x - S + 1.5, y + 1.5, bw - 3, bh - 3); }
    }
    dots(c, S, r, 700, ['#7a4a30', '#c08a64', '#5a3a2a'], 0.4, 1.4); } });
  makeSurface2('concrete', { base: '#8f8c85', noise: 0.28, bump: 3, tint: [70, 68, 62, 0.8], paint(c, S, r, h) {
    dots(c, S, r, 1600, ['#7c7972', '#a4a19a', '#6a6760'], 0.4, 1.4); dots(c, S, r, 60, ['#5a5752'], 0.8, 1.8, h, '#303030');
    cracks(c, S, r, 4, rgba(0.4, '40,40,40'), h); c.strokeStyle = rgba(0.35, '40,40,40'); c.lineWidth = 2; c.strokeRect(1, 1, S - 2, S - 2); h.strokeStyle = '#303030'; h.lineWidth = 3; h.strokeRect(1, 1, S - 2, S - 2);
    for (let i = 0; i < 5; i++) { const x = r() * S, g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, rgba(0)); g.addColorStop(1, rgba(0.1, '50,45,40')); c.fillStyle = g; c.fillRect(x, 0, 4 + r() * 10, S); } } });
  makeSurface2('crate', { base: '#8a6236', noise: 0.15, bump: 5, paint(c, S, r, h) {
    const n = 6, ph = S / n; for (let i = 0; i < n; i++) { const v = r(); c.fillStyle = `rgb(${128 + v * 25 | 0},${90 + v * 18 | 0},${50 + v * 12 | 0})`; c.fillRect(0, i * ph, S, ph);
      for (let k = 0; k < 18; k++) { c.strokeStyle = rgba(0.12 + r() * 0.12, '60,35,15'); c.lineWidth = 0.6 + r(); const y = i * ph + r() * ph; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= S; x += 16) c.lineTo(x, y + Math.sin(x / 30 + k) * 1.5); c.stroke(); }
      c.fillStyle = rgba(0.55, '40,25,10'); c.fillRect(0, i * ph, S, 2); h.fillStyle = '#303030'; h.fillRect(0, i * ph, S, 2); }
    c.strokeStyle = '#5c3c1e'; c.lineWidth = 22; c.strokeRect(11, 11, S - 22, S - 22); h.strokeStyle = '#d0d0d0'; h.lineWidth = 22; h.strokeRect(11, 11, S - 22, S - 22);
    c.lineWidth = 18; c.beginPath(); c.moveTo(22, 22); c.lineTo(S - 22, S - 22); c.stroke(); h.lineWidth = 18; h.beginPath(); h.moveTo(22, 22); h.lineTo(S - 22, S - 22); h.stroke();
    c.strokeStyle = rgba(0.4, '30,18,8'); c.lineWidth = 1.5; c.strokeRect(22, 22, S - 44, S - 44); c.strokeRect(1, 1, S - 2, S - 2);
    for (const [x, y] of [[11, 11], [S - 11, 11], [11, S - 11], [S - 11, S - 11], [S / 2, 11], [S / 2, S - 11], [11, S / 2], [S - 11, S / 2]]) { c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(x, y, 2.5, 0, TAU); c.fill(); c.fillStyle = '#8a8a8a'; c.beginPath(); c.arc(x - 0.6, y - 0.6, 1, 0, TAU); c.fill(); } } });
  makeSurface2('metal', { base: '#5d6468', noise: 0.22, bump: 4, rough: 0.55, metal: 0.55, tint: [120, 70, 40, 1.6], paint(c, S, r, h) {
    const n = 16, w = S / n; for (let i = 0; i < n; i++) { const g = c.createLinearGradient(i * w, 0, i * w + w, 0); g.addColorStop(0, '#4a5054'); g.addColorStop(0.5, '#7a8286'); g.addColorStop(1, '#4a5054'); c.fillStyle = g; c.fillRect(i * w, 0, w, S);
      const hg = h.createLinearGradient(i * w, 0, i * w + w, 0); hg.addColorStop(0, '#404040'); hg.addColorStop(0.5, '#c0c0c0'); hg.addColorStop(1, '#404040'); h.fillStyle = hg; h.fillRect(i * w, 0, w, S); }
    for (let i = 0; i < 10; i++) { const x = r() * S, y = r() * S; const g = c.createLinearGradient(0, y, 0, y + 60); g.addColorStop(0, rgba(0.4, '130,70,35')); g.addColorStop(1, rgba(0, '130,70,35')); c.fillStyle = g; c.fillRect(x, y, 2 + r() * 5, 60); }
    dots(c, S, r, 120, ['#8a5030', '#6a3a20', '#9a6040'], 1, 4); } });
  makeSurface2('grass', { base: '#56763a', noise: 0.35, bump: 2.5, tint: [110, 100, 60, 0.8], paint(c, S, r) {
    const cols = ['#4a6a2e', '#6a8c44', '#3c5a26', '#7c9c52', '#5e7e3a', '#86a45a'];
    for (let i = 0; i < 5200; i++) { const x = r() * S, y = r() * S, l = 2 + r() * 4, a = -Math.PI / 2 + (r() - 0.5) * 1.2; c.strokeStyle = cols[Math.floor(r() * cols.length)]; c.globalAlpha = 0.4 + r() * 0.5; c.lineWidth = 0.6 + r() * 0.8;
      wrapped(S, x, y, l, (X, Y) => { c.beginPath(); c.moveTo(X, Y); c.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); c.stroke(); }); }
    c.globalAlpha = 1; dots(c, S, r, 30, ['#7a6a48', '#6a5a3a'], 1.5, 4); } });
  makeSurface2('dirt', { base: '#76603f', noise: 0.3, bump: 4, paint(c, S, r, h) {
    dots(c, S, r, 1600, ['#6a5438', '#8a7456', '#5a4630', '#9a8464'], 0.4, 1.4);
    for (let i = 0; i < 140; i++) { const x = r() * S, y = r() * S, s = 1 + r() * 3.5, v = 110 + r() * 60 | 0;
      wrapped(S, x, y, s + 2, (X, Y) => { c.fillStyle = rgba(0.35); c.beginPath(); c.ellipse(X + 1, Y + 1.2, s, s * 0.75, 0, 0, TAU); c.fill(); c.fillStyle = `rgb(${v},${v - 12},${v - 28})`; c.beginPath(); c.ellipse(X, Y, s, s * 0.75, 0, 0, TAU); c.fill();
        h.fillStyle = '#e0e0e0'; h.beginPath(); h.ellipse(X, Y, s, s * 0.75, 0, 0, TAU); h.fill(); }); } } });
  makeSurface2('rock', { base: '#7b7872', noise: 0.5, bump: 6, nk: 1.2, tint: [95, 100, 70, 0.7], paint(c, S, r, h) {
    dots(c, S, r, 900, ['#6a6760', '#96938b', '#5a5750', '#a8a49a'], 1, 4); cracks(c, S, r, 14, rgba(0.5, '30,30,30'), h);
    for (let i = 0; i < 30; i++) { const y = r() * S; c.fillStyle = rgba(0.05 + r() * 0.05, r() < 0.5 ? '255,255,255' : '0,0,0'); c.fillRect(0, y, S, 2 + r() * 6); } } });
  makeSurface2('wood', { base: '#7a5a3a', noise: 0.15, bump: 4, paint(c, S, r, h) {
    const n = 8, ph = S / n; for (let i = 0; i < n; i++) { const v = r(); c.fillStyle = `rgb(${110 + v * 30 | 0},${80 + v * 22 | 0},${50 + v * 15 | 0})`; c.fillRect(0, i * ph, S, ph);
      for (let k = 0; k < 14; k++) { c.strokeStyle = rgba(0.1 + r() * 0.15, '50,30,12'); c.lineWidth = 0.5 + r(); const y = i * ph + r() * ph, f = 20 + r() * 40, a = 0.5 + r() * 1.5; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= S; x += 8) c.lineTo(x, y + Math.sin(x / f * TAU / 4 + k) * a); c.stroke(); }
      if (r() < 0.5) { const kx = r() * S, ky = i * ph + ph / 2; c.fillStyle = rgba(0.45, '50,30,12'); c.beginPath(); c.ellipse(kx, ky, 4, 2.5, 0, 0, TAU); c.fill(); }
      c.fillStyle = rgba(0.6, '30,18,8'); c.fillRect(0, i * ph, S, 1.5); h.fillStyle = '#202020'; h.fillRect(0, i * ph, S, 1.5); } } });
  makeSurface2('sandbag', { base: '#8a7a52', noise: 0.2, bump: 7, paint(c, S, r, h) {
    const rows = 6, bh = S / rows, bw = S / 3;
    for (let row = 0; row < rows; row++) for (let k = -1; k < 3; k++) { const x = k * bw + (row % 2) * bw / 2, y = row * bh, v = r();
      for (const X of [x, x + S]) { if (X > S || X + bw < 0) continue;
        const g = c.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, `rgb(${170 + v * 20 | 0},${155 + v * 18 | 0},${112 + v * 14 | 0})`); g.addColorStop(1, `rgb(${120 + v * 20 | 0},${108 + v * 16 | 0},${76 + v * 10 | 0})`);
        c.fillStyle = g; c.beginPath(); c.roundRect(X + 1, y + 1, bw - 2, bh - 2, bh * 0.4); c.fill();
        const hg = h.createLinearGradient(0, y, 0, y + bh); hg.addColorStop(0, '#909090'); hg.addColorStop(0.4, '#e0e0e0'); hg.addColorStop(1, '#707070'); h.fillStyle = hg; h.beginPath(); h.roundRect(X + 1, y + 1, bw - 2, bh - 2, bh * 0.4); h.fill(); } }
    for (let y = 0; y < S; y += 3) { c.fillStyle = rgba(0.05); c.fillRect(0, y, S, 1); } } });
  makeSurface2('roof', { base: '#6b3a2a', noise: 0.2, bump: 6, paint(c, S, r, h) {
    const rows = 10, th = S / rows, tw = S / 8;
    for (let row = 0; row < rows; row++) for (let k = -1; k < 8; k++) { const x = k * tw + (row % 2) * tw / 2, y = row * th, v = r();
      for (const X of [x, x + S]) { if (X > S || X + tw < 0) continue;
        const g = c.createLinearGradient(0, y, 0, y + th); g.addColorStop(0, `rgb(${120 + v * 30 | 0},${62 + v * 16 | 0},${44 + v * 10 | 0})`); g.addColorStop(1, `rgb(${80 + v * 20 | 0},${40 + v * 10 | 0},${30 + v * 6 | 0})`);
        c.fillStyle = g; c.fillRect(X + 0.5, y, tw - 1, th - 1); const hg = h.createLinearGradient(0, y, 0, y + th); hg.addColorStop(0, '#606060'); hg.addColorStop(1, '#d0d0d0'); h.fillStyle = hg; h.fillRect(X + 0.5, y, tw - 1, th - 1); } } } });
  for (const k in _matCache) delete _matCache[k];
};

/* ── materials ─────────────────────────────────────────────────────────── */
const _matVC = {};
mat = function (tex, color = '#ffffff', vc = false) {
  const k = tex + color + (vc ? '|vc' : ''), C = vc ? _matVC : _matCache; if (C[k]) return C[k];
  const s = SURF[tex] || { rough: 0.9, metal: 0, ns: 1 };
  const m = new THREE.MeshStandardMaterial({ map: Tex[tex] || null, normalMap: Tex[tex + '_n'] || null, color, roughness: s.rough, metalness: s.metal, vertexColors: vc });
  if (m.normalMap) m.normalScale.set(s.ns, s.ns);
  return C[k] = m;
};
const _lamStd = {};
lam = function (color) { return _lamStd[color] || (_lamStd[color] = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05 })); };
/* contact shading baked into box vertices: darker toward the ground and underneath */
const _worldAdd25 = World.add.bind(World);
World.add = function (x0, y0, z0, x1, y1, z1, tex, color, opts) {
  const b = _worldAdd25(x0, y0, z0, x1, y1, z1, tex, color, opts);
  if (b.mesh && Tex[tex]) {
    const g = b.mesh.geometry, P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3), h = b.y1 - b.y0, base = b.y0 < 0.05;
    for (let i = 0; i < P.count; i++) {
      const yw = P.getY(i) + h / 2, ny = N.getY(i); let v = 1;
      if (ny < -0.5) v = 0.55; else if (ny < 0.5 && base) v = 0.58 + 0.42 * Math.min(1, yw / Math.min(1.1, h * 0.6));
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); b.mesh.material = mat(tex, color || '#ffffff', true);
  }
  return b;
};

/* ── sky dome ──────────────────────────────────────────────────────────── */
const SUN_DIR = new V3(40, 80, 25).normalize();
function makeSky() {
  const top = new THREE.Color(World.skyColor).multiplyScalar(0.62), hor = new THREE.Color(World.fog ? World.fog[0] : World.skyColor).lerp(new THREE.Color(0xffffff), 0.15);
  top.offsetHSL(0, 0.12, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { top: { value: top }, hor: { value: hor }, gnd: { value: hor.clone().multiplyScalar(0.7) }, sun: { value: SUN_DIR.clone() }, sunCol: { value: new THREE.Color(World.sun || 0xfff4e0) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, hor, gnd, sun, sunCol; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float y = d.y;
        vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(hor, gnd, clamp(-y * 6.0, 0.0, 1.0));
        float s = max(dot(d, sun), 0.0); c += sunCol * (pow(s, 1200.0) * 40.0 + pow(s, 60.0) * 0.35 + pow(s, 6.0) * 0.08);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: true,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), m); s.frustumCulled = false; s.renderOrder = -10; s.userData.noShadow = true; s.name = 'sky';
  return s;
}

/* ── detail props: grass, rocks, rubble ────────────────────────────────── */
let _grassTex = null;
function grassTex() {
  if (_grassTex) return _grassTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'), r = mulberry(7);
  for (let i = 0; i < 22; i++) { const bx = 6 + r() * 52, lean = (r() - 0.5) * 18, h = 30 + r() * 32, v = r(); x.strokeStyle = `rgb(${70 + v * 60 | 0},${110 + v * 50 | 0},${40 + v * 30 | 0})`; x.lineWidth = 1.5 + r() * 1.5;
    x.beginPath(); x.moveTo(bx, 64); x.quadraticCurveTo(bx + lean * 0.3, 64 - h * 0.6, bx + lean, 64 - h); x.stroke(); }
  _grassTex = new THREE.CanvasTexture(c); _grassTex.colorSpace = THREE.SRGBColorSpace; return _grassTex;
}
function blockedAt(x, z, m) {
  for (const b of World.boxes) if (b.y0 < 2 && x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) return true;
  if (World._decals) for (const d of World._decals) if (x > d[0] - m && x < d[2] + m && z > d[1] - m && z < d[3] + m) return true;
  return typeof inWater === 'function' && !!inWater(x, z);
}
function detailProps(scene) {
  const k = gq().props; if (!k) return;
  const B = World.bounds, r = mulberry(hashStr(String(World.skyColor)) + 11), gt = World._groundTex || 'grass', lush = gt === 'grass';
  const place = (n, m, fn) => { let made = 0; for (let t = 0; t < n * 4 && made < n; t++) { const x = lerp(B.x0 + 1, B.x1 - 1, r()), z = lerp(B.z0 + 1, B.z1 - 1, r()); if (blockedAt(x, z, m)) continue; fn(x, z, made++); } return made; };
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new V3(), Sc = new V3(), C = new THREE.Color();
  // grass tufts: three crossed cards
  const area = (B.x1 - B.x0) * (B.z1 - B.z0), nG = gt === 'snow' || gt === 'concrete' ? 0 : Math.round(Math.min(14000, area * (lush ? 0.3 : 0.04)) * k);
  if (nG) {
    const g = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3, cx = Math.cos(a) * 0.3, cz = Math.sin(a) * 0.3, o = pos.length / 3;
      pos.push(-cx, 0, -cz, cx, 0, cz, cx, 0.5, cz, -cx, 0.5, -cz); uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    // normals point up so the cards light like the ground under them
    const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
    const m = new THREE.MeshStandardMaterial({ map: grassTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95, color: lush ? 0xffffff : 0xd8c088 });
    const im = new THREE.InstancedMesh(g, m, nG); im.userData.noShadow = true; im.receiveShadow = true;
    // clumps: grass grows in patches
    const cl = []; for (let i = 0; i < 90; i++) cl.push([lerp(B.x0, B.x1, r()), lerp(B.z0, B.z1, r()), 4 + r() * 14]);
    const made = place(nG, 0.35, (x, z, i) => {
      const c0 = cl[Math.floor(r() * cl.length)], a = r() * TAU, d = Math.sqrt(r()) * c0[2]; if (lush && r() < 0.7) { x = c0[0] + Math.cos(a) * d; z = c0[1] + Math.sin(a) * d; if (blockedAt(x, z, 0.35) || x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) { x = lerp(B.x0 + 1, B.x1 - 1, r()); z = lerp(B.z0 + 1, B.z1 - 1, r()); if (blockedAt(x, z, 0.35)) return; } }
      const s = 0.6 + r() * 0.9; Q.setFromEuler(E.set(0, r() * TAU, 0)); M4.compose(P.set(x, groundH(x, z) - 0.02, z), Q, Sc.set(s, s * (0.7 + r() * 0.6), s)); im.setMatrixAt(i, M4);
      im.setColorAt(i, C.setHSL(lush ? 0.22 + r() * 0.06 : 0.11 + r() * 0.03, lush ? 0.35 + r() * 0.2 : 0.3, 0.55 + r() * 0.25));
    });
    im.count = made; scene.add(im);
  }
  // rocks
  const nR = Math.round((lush ? 160 : 110) * k);
  if (nR) {
    const g = new THREE.IcosahedronGeometry(0.5, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = 0.78 + (Math.abs(Math.sin(p.getX(i) * 91.7 + p.getY(i) * 47.3 + p.getZ(i) * 13.1) * 43758.5) % 1) * 0.35;   // same offset for shared corners, so no cracks
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.7, p.getZ(i) * f); } g.computeVertexNormals();
    const im = new THREE.InstancedMesh(g, mat('rock', lush ? '#b8b4aa' : '#d8c8a8'), nR);
    im.count = place(nR, 0.6, (x, z, i) => { const s = 0.15 + Math.pow(r(), 3) * 1.1; Q.setFromEuler(E.set(r() * 0.4, r() * TAU, r() * 0.4)); M4.compose(P.set(x, groundH(x, z) + s * 0.1, z), Q, Sc.set(s * (0.8 + r() * 0.5), s, s * (0.8 + r() * 0.5))); im.setMatrixAt(i, M4); });
    scene.add(im);
  }
  // rubble at the foot of walls
  const walls = World.boxes.filter(b => b.y0 < 0.05 && b.y1 > 1.8 && b.tex && b.tex !== 'crate'), nB = Math.round((lush ? 120 : 420) * k);
  if (nB && walls.length) {
    const g = new THREE.BoxGeometry(1, 1, 1), im = new THREE.InstancedMesh(g, mat('concrete', '#c8c0b0'), nB); let made = 0;
    for (let t = 0; t < nB * 4 && made < nB; t++) {
      const b = walls[Math.floor(r() * walls.length)], side = Math.floor(r() * 4), off = 0.15 + Math.pow(r(), 2) * 1.2;
      const x = side < 2 ? lerp(b.x0, b.x1, r()) : side === 2 ? b.x0 - off : b.x1 + off, z = side >= 2 ? lerp(b.z0, b.z1, r()) : side === 0 ? b.z0 - off : b.z1 + off;
      if (blockedAt(x, z, 0.05)) continue;
      const s = 0.06 + Math.pow(r(), 2) * 0.3; Q.setFromEuler(E.set(r() * 3, r() * 3, r() * 3)); M4.compose(P.set(x, groundH(x, z) + s * 0.3, z), Q, Sc.set(s * (0.6 + r()), s * (0.4 + r() * 0.6), s * (0.6 + r())));
      im.setMatrixAt(made, M4); im.setColorAt(made, C.set(b.tex === 'brick' ? 0xb07a58 : b.tex === 'plaster' ? 0xd8c8a4 : 0xa8a49c)); made++;
    }
    im.count = made; scene.add(im);
  }
}
const _groundPlane25 = groundPlane;
groundPlane = function (tex, size, color, cx, cz) { if (!World._groundTex) World._groundTex = tex; const m = _groundPlane25(tex, size, color, cx, cz); m.receiveShadow = true; return m; };

/* ── lighting, shadows and post ────────────────────────────────────────── */
const Gfx = {
  sun: null, hemi: null, sky: null, rt: null, bl: [], quad: null, oc: null, shT: 0, env: null,
  setup(scene) {
    const q = gq(); World._groundTex = World._groundTex || null;
    scene.traverse(o => { if (o.isDirectionalLight && !this.sunOf(scene)) scene.userData.sun = o; if (o.isHemisphereLight) scene.userData.hemi = o; });
    const sun = scene.userData.sun, hemi = scene.userData.hemi;
    if (sun) { sun.intensity = 2.9; sun.castShadow = !!q.shadow; sun.shadow.mapSize.set(q.shadow || 512, q.shadow || 512); const S = q.shadow > 1024 ? 48 : 36, cam = sun.shadow.camera;
      cam.left = -S; cam.right = S; cam.top = S; cam.bottom = -S; cam.near = 1; cam.far = 260; cam.updateProjectionMatrix(); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } scene.add(sun.target); }
    if (hemi) hemi.intensity = 0.55;
    const sky = makeSky(); scene.add(sky); scene.userData.sky = sky;
    // image-based light from the sky, so metal and wet surfaces pick up the sky colour
    try { const pm = new THREE.PMREMGenerator(Game.renderer), sc = new THREE.Scene(), s2 = makeSky(); s2.scale.setScalar(0.05); sc.add(s2); const e = pm.fromScene(sc, 0.03).texture; pm.dispose(); scene.environment = e; } catch (e) { /* no env light */ }
    detailProps(scene); this.shT = 0;
  },
  sunOf(scene) { return scene.userData.sun; },
  /* keep shadow flags current: solid things cast, everything receives */
  flags(scene) {
    scene.traverse(o => { if (!o.isMesh || o.userData.noShadow) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) return;
      const solid = !m.transparent && !m.isMeshBasicMaterial && !m.isShaderMaterial && !m.isPointsMaterial; o.castShadow = solid && o.name !== 'sky'; o.receiveShadow = solid || !!m.alphaTest; });
  },
  follow(scene, cam) {
    const sun = scene.userData.sun; if (!sun) return;
    const S = sun.shadow.camera.right, texel = S * 2 / (sun.shadow.mapSize.x || 1024);
    // centre the shadow box ahead of the camera and snap it to shadow texels so edges don't crawl
    const f = cam.getWorldDirection(new V3()); const cx = cam.position.x + f.x * S * 0.5, cz = cam.position.z + f.z * S * 0.5;
    const ux = Math.round(cx / texel) * texel, uz = Math.round(cz / texel) * texel;
    sun.target.position.set(ux, 0, uz); sun.position.set(ux + SUN_DIR.x * 120, SUN_DIR.y * 120, uz + SUN_DIR.z * 120); sun.target.updateMatrixWorld();
  },
  targets() {
    const r = Game.renderer, sz = r.getDrawingBufferSize(new THREE.Vector2()), q = gq(), w = sz.x, h = sz.y;
    if (this.rt && this.rt.width === w && this.rt.height === h && this.rt.samples === q.msaa) return;
    if (this.rt) { this.rt.dispose(); this.bl.forEach(t => t.dispose()); }
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: q.msaa, depthBuffer: true });
    const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2); this.bl = [0, 1].map(() => new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, depthBuffer: false }));
    if (!this.quad) {
      this.oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      this.mBright = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = dot(c, vec3(0.2126,0.7152,0.0722)); gl_FragColor = vec4(c * smoothstep(0.9, 2.2, l), 1.0); }' });
      this.mBlur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: 'uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * 0.316; c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }' });
      this.mComp = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, b: { value: null }, uw: { value: 0 } }, vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D t, b; uniform float uw; varying vec2 vUv;
          void main(){ vec3 c = texture2D(t, vUv).rgb + texture2D(b, vUv).rgb * 0.55;
            float l = dot(c, vec3(0.2126,0.7152,0.0722)); c = mix(vec3(l), c, 1.08);          // a touch more colour
            vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * (0.55 + uw);                           // vignette
            gl_FragColor = vec4(max(c, 0.0), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }` });
      this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mBright); this.quad.frustumCulled = false; this.qs = new THREE.Scene(); this.qs.add(this.quad);
    }
  },
  pass(m, target) { const r = Game.renderer; this.quad.material = m; r.setRenderTarget(target); r.render(this.qs, this.oc); },
};
const _initRenderer25 = Game.initRenderer.bind(Game);
Game.initRenderer = function () {
  _initRenderer25(); const r = this.renderer;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
};
const _start25 = Game.start.bind(Game);
Game.start = function (cfg) { World._groundTex = null; const r = _start25(cfg); Gfx.setup(this.scene); return r; };
const _menuStart25 = MenuBG.start.bind(MenuBG);
MenuBG.start = function () { World._groundTex = null; _menuStart25(); Gfx.setup(Game.scene); };
Game.render = function () {
  const r = this.renderer, sc = this.scene, cam = this.camera, q = gq();
  if (sc.userData.sky) { sc.userData.sky.position.copy(cam.position); sc.userData.sky.visible = !(typeof UW !== 'undefined' && UW.on); }
  const sun = sc.userData.sun;
  if (sun) { sun.castShadow = !!q.shadow; if (q.shadow) { const U = sc.userData; U.shT = (U.shT || 0) - 1; if (U.shT <= 0) { U.shT = 30; Gfx.flags(sc); } Gfx.follow(sc, cam); } }
  const vm = this.view && this.view.visible && this.view.visible();
  if (!q.post) { r.setRenderTarget(null); r.clear(); r.render(sc, cam); }
  else {
    Gfx.targets(); r.setRenderTarget(Gfx.rt); r.clear(); r.render(sc, cam);
    const [A, B] = Gfx.bl; Gfx.mBright.uniforms.t.value = Gfx.rt.texture; Gfx.pass(Gfx.mBright, A);
    for (let i = 0; i < 2; i++) { Gfx.mBlur.uniforms.t.value = A.texture; Gfx.mBlur.uniforms.dir.value.set((1 + i) / A.width, 0); Gfx.pass(Gfx.mBlur, B); Gfx.mBlur.uniforms.t.value = B.texture; Gfx.mBlur.uniforms.dir.value.set(0, (1 + i) / A.height); Gfx.pass(Gfx.mBlur, A); }
    Gfx.mComp.uniforms.t.value = Gfx.rt.texture; Gfx.mComp.uniforms.b.value = A.texture; Gfx.mComp.uniforms.uw.value = typeof UW !== 'undefined' && UW.on ? 0.8 : 0;
    r.setRenderTarget(null); r.clear(); Gfx.pass(Gfx.mComp, null);
  }
  if (vm) { r.clearDepth(); r.render(this.view.scene, this.view.camera); }
};
/* a slow machine on High drops to Medium for the session (once) */
let _gfxChecked = false;
const _hudUpdate25 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hudUpdate25(dt);
  if (_gfxChecked || !Game.running || Settings.gfx !== 'high' || Game.now < 8) return;
  _gfxChecked = true;
  if (this.fps && this.fps < 30) { Settings.gfx = 'medium'; this.center('Graphics set to Medium for smoother play (Settings → Graphics)', 3); }
};
