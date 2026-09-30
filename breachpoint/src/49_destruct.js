/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Destructible cover.
   · Explosions wreck the small stuff standing on the ground: crates,
     sandbags, barrels, market stalls, low walls.
   · Fences and low walls get a gap blown through them.
   · Rockets, tank shells, C4 and bombs punch a hole in thin walls, big
     enough to walk or shoot through. In the City that's every building.
   · Vehicles at speed smash through crates, sandbags and fences.
   The host decides what breaks and tells everyone which boxes went; the
   bots' walking grid is patched so they use the new holes.
   ═══════════════════════════════════════════════════════════════════════════ */
if (Settings.destruction == null) Settings.destruction = true;
/* remember each box's colour and link the mesh back to it */
const _wadd49 = World.add.bind(World);
World.add = function (x0, y0, z0, x1, y1, z1, tex, color, opts = {}) {
  const b = _wadd49(x0, y0, z0, x1, y1, z1, tex, color, opts); b.col = color; if (b.mesh) b.mesh.userData.box = b; return b;
};
const _wfin49 = World.finalize.bind(World);
World.finalize = function () { const r = _wfin49(); Destruct.reset(); return r; };

const Destruct = {
  byId: new Map(), radarT: 0, debris: [], queue: [],
  reset() { this.byId.clear(); this.debris.forEach(d => d.m.parent && d.m.parent.remove(d.m)); this.debris = []; World.boxes.forEach((b, i) => { b.bid = 'b' + i; this.byId.set(b.bid, b); }); },
  on() { return Settings.destruction !== false && Game.mode && Game.mode.id !== 'sandbox' || (Game.mode && Game.mode.id === 'sandbox' && Settings.destruction === 'all'); },
  edge(b) { const B = World.bounds; return b.x0 <= B.x0 + 0.6 || b.x1 >= B.x1 - 0.6 || b.z0 <= B.z0 + 0.6 || b.z1 >= B.z1 - 0.6; },
  visible(b) { return !!(b.mref || (b.mesh && b.mesh.parent)); },
  /* what an explosion can do to this box: 'break', 'gap', 'hole' or null */
  kind(b, dmg) {
    if (!b || b.noDestroy || b.deck || b.gone || !this.visible(b) || b.tex === 'rock' || b.tex === 'grass' || b.tex === 'dirt' || this.edge(b)) return null;
    const dx = b.x1 - b.x0, dz = b.z1 - b.z0, dy = b.y1 - b.y0, thin = Math.min(dx, dz), long = Math.max(dx, dz);
    if (dy < 0.5 || b.y0 > 30) return null;
    const light = b.tex === 'crate' || b.tex === 'wood' || b.tex === 'sandbag' || b.tex === 'metal';
    if (b.y0 < 0.35 && dy <= (light ? 2.7 : 1.3) && dx * dz <= 6.5 && long <= 4.2) return 'break';
    if (thin <= 0.75 && long >= 1.2 && b.y0 < 0.35 && dy < 2.7) return dmg >= 50 ? 'gap' : null;
    if (thin <= 0.75 && long >= 1.6 && dy >= 2.2) return dmg >= 100 ? 'hole' : null;
    return null;
  },
  /* host: an explosion at p */
  blast(p, dmg, radius, weapon) {
    if (!this.on() || !World.grid) return;
    const R = clamp(radius * (dmg >= 100 ? 0.55 : 0.4), 1.6, 6), ops = [];
    for (const b of World.near(p.x - R, p.z - R, p.x + R, p.z + R, [])) {
      const k = this.kind(b, dmg); if (!k) continue;
      const cx = clamp(p.x, b.x0, b.x1), cy = clamp(p.y, b.y0, b.y1), cz = clamp(p.z, b.z0, b.z1), d = Math.hypot(cx - p.x, cy - p.y, cz - p.z);
      if (d > (k === 'break' ? R : k === 'gap' ? R * 0.8 : Math.min(R, 3))) continue;
      if (k === 'break') ops.push({ b: b.bid });
      else ops.push({ b: b.bid, h: [+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2)], g: k === 'gap' ? 1 : 0, w: dmg >= 300 ? 3.2 : 2.3 });
      if (ops.length > 12) break;
    }
    if (ops.length) this.run(ops, true);
  },
  run(ops, send) {
    for (const o of ops) { const b = this.byId.get(o.b); if (!b || b.gone) continue; if (o.h) this.hole(b, o.h, o.g, o.w); else this.remove(b, true); }
    if (send && Net.role === 'host') Net.event({ t: 'dstr', ops });
    this.radarT = 1.5;
  },
  /* take a box out of the world */
  remove(b, debris) {
    b.gone = true;
    const i = World.boxes.indexOf(b); if (i >= 0) World.boxes.splice(i, 1);
    const cs = World.cell, cx0 = clamp(Math.floor((b.x0 - World.gx0) / cs), 0, World.gw - 1), cx1 = clamp(Math.floor((b.x1 - World.gx0) / cs), 0, World.gw - 1), cz0 = clamp(Math.floor((b.z0 - World.gz0) / cs), 0, World.gh - 1), cz1 = clamp(Math.floor((b.z1 - World.gz0) / cs), 0, World.gh - 1);
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) { const c = World.grid[z * World.gw + x], j = c.indexOf(b); if (j >= 0) c.splice(j, 1); }
    this.hideMesh(b);
    for (const P of [Ragdoll, Phys]) if (P.statics && P.world) { const body = P.statics.get && P.statics.get(b); if (body && body.world !== undefined) { try { P.world.removeBody(body); } catch (e) { } } if (P.statics.delete) P.statics.delete(b); }
    if (debris) this.burst(b);
    this.navPatch(b.x0, b.z0, b.x1, b.z1);
  },
  hideMesh(b) {
    if (b.mref) {
      const P = b.mref.mesh.geometry.attributes.position, a = P.array, s = b.mref.vo * 3, x = a[s], y = a[s + 1], z = a[s + 2];
      for (let k = 0; k < b.mref.n; k++) { a[s + k * 3] = x; a[s + k * 3 + 1] = y; a[s + k * 3 + 2] = z; }
      P.needsUpdate = true; b.mref = null;
    }
    if (b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
  },
  /* a hole (tall walls) or a full-height gap (fences, low walls) */
  hole(b, h, gap, W) {
    const alongX = (b.x1 - b.x0) >= (b.z1 - b.z0), half = (gap ? W + 0.4 : W) / 2;
    const a0 = alongX ? b.x0 : b.z0, a1 = alongX ? b.x1 : b.z1, c = alongX ? h[0] : h[2];
    let h0 = Math.max(a0, c - half), h1 = Math.min(a1, c + half);
    if (h0 - a0 < 0.35) h0 = a0; if (a1 - h1 < 0.35) h1 = a1;
    let y0 = b.y0, y1 = b.y1;
    if (!gap) { y0 = Math.max(b.y0, h[1] - W / 2); y1 = Math.min(b.y1, y0 + W); if (y0 - b.y0 < 0.6) y0 = b.y0; if (b.y1 - y1 < 0.35) y1 = b.y1; }
    const pieces = [], mk = (p0, p1, q0, q1) => { if (p1 - p0 < 0.05 || q1 - q0 < 0.05) return; pieces.push(alongX ? [p0, q0, b.z0, p1, q1, b.z1] : [b.x0, q0, p0, b.x1, q1, p1]); };
    mk(a0, h0, b.y0, b.y1); mk(h1, a1, b.y0, b.y1); mk(h0, h1, b.y0, y0); mk(h0, h1, y1, b.y1);
    const mid = alongX ? [(h0 + h1) / 2, (y0 + y1) / 2, (b.z0 + b.z1) / 2] : [(b.x0 + b.x1) / 2, (y0 + y1) / 2, (h0 + h1) / 2];
    this.remove(b, false);
    pieces.forEach((q, k) => { const n = World.add(q[0], q[1], q[2], q[3], q[4], q[5], b.tex, b.col); n.bid = b.bid + '.' + k; n.noMerge = true; this.byId.set(n.bid, n); this.live(n); this.navPatch(n.x0, n.z0, n.x1, n.z1); });
    this.burst({ x0: mid[0] - 0.8, x1: mid[0] + 0.8, y0: mid[1] - 0.8, y1: mid[1] + 0.8, z0: mid[2] - 0.8, z1: mid[2] + 0.8, tex: b.tex, col: b.col });
  },
  live(b) {
    const cs = World.cell, cx0 = clamp(Math.floor((b.x0 - World.gx0) / cs), 0, World.gw - 1), cx1 = clamp(Math.floor((b.x1 - World.gx0) / cs), 0, World.gw - 1), cz0 = clamp(Math.floor((b.z0 - World.gz0) / cs), 0, World.gh - 1), cz1 = clamp(Math.floor((b.z1 - World.gz0) / cs), 0, World.gh - 1);
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) World.grid[z * World.gw + x].push(b);
  },
  /* the bots' walking grid, redone around a change */
  navPatch(x0, z0, x1, z1) {
    const N = World.nav; if (!N) return;
    const cs = N.cs, R = 0.4, near = [];
    const ix0 = Math.max(0, Math.floor((x0 - N.x0) / cs) - 2), ix1 = Math.min(N.w - 1, Math.floor((x1 - N.x0) / cs) + 2), iz0 = Math.max(0, Math.floor((z0 - N.z0) / cs) - 2), iz1 = Math.min(N.h - 1, Math.floor((z1 - N.z0) / cs) + 2);
    for (let z = iz0; z <= iz1; z++) for (let x = ix0; x <= ix1; x++) {
      const wx = N.x0 + (x + 0.5) * cs, wz = N.z0 + (z + 0.5) * cs; let ok = 1;
      for (const b of World.near(wx - cs, wz - cs, wx + cs, wz + cs, near)) if (b.y0 < 1.6 && b.y1 > 0.5 && wx + R > b.x0 && wx - R < b.x1 && wz + R > b.z0 && wz - R < b.z1) { ok = 0; break; }
      if (N.wet && N.wet[z * N.w + x]) ok = N.walk[z * N.w + x];
      N.walk[z * N.w + x] = ok;
    }
    for (let z = Math.max(0, iz0 - 1); z <= Math.min(N.h - 1, iz1 + 1); z++) for (let x = Math.max(0, ix0 - 1); x <= Math.min(N.w - 1, ix1 + 1); x++) {
      const i = z * N.w + x; if (!N.walk[i]) continue; let c = 1;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= N.w || nz >= N.h || !N.walk[nz * N.w + nx]) c = 2.2; }
      N.cost[i] = c;
    }
    N.reach = null;
  },
  /* chunks flying off */
  burst(b) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2, col = new THREE.Color(b.col || '#8a7a60');
    const tint = b.tex && Tex[b.tex] ? mat(b.tex, b.col || '#ffffff') : new THREE.MeshLambertMaterial({ color: col });
    const n = clamp(Math.round((b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0) * 3), 4, 14);
    for (let i = 0; i < n; i++) {
      if (this.debris.length > 90) { const o = this.debris.shift(); if (o.m.parent) o.m.parent.remove(o.m); }
      const s = rand(0.12, 0.38), m = new THREE.Mesh(boxGeo(s, s * rand(0.5, 1), s * rand(0.6, 1.2), 1), tint);
      m.position.set(rand(b.x0, b.x1), rand(b.y0, b.y1), rand(b.z0, b.z1)); Game.scene.add(m);
      this.debris.push({ m, vx: (m.position.x - cx) * 4 + rand(-3, 3), vy: rand(2, 7), vz: (m.position.z - cz) * 4 + rand(-3, 3), rx: rand(-8, 8), rz: rand(-8, 8), t: 0 });
    }
    FX.emit('big', cx, cy, cz, 10, 2.5, [col.r * 0.8, col.g * 0.8, col.b * 0.8], 1.4, 0.5, 1);
    FX.emit('norm', cx, cy, cz, 18, 7, [col.r, col.g, col.b], 0.9, -12, 1);
    Sfx.play('impact', new V3(cx, cy, cz), { vol: 2 }); Sfx.play('land', new V3(cx, cy, cz));
  },
  update(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i], m = d.m; d.t += dt;
      if (d.t > 6) { if (m.parent) m.parent.remove(m); this.debris.splice(i, 1); continue; }
      if (d.rest) continue;
      d.vy -= 18 * dt; m.position.x += d.vx * dt; m.position.y += d.vy * dt; m.position.z += d.vz * dt; m.rotation.x += d.rx * dt; m.rotation.z += d.rz * dt;
      const f = topBelow(m.position.x, m.position.z, m.position.y + 0.3);
      if (m.position.y < f + 0.08) { m.position.y = f + 0.08; if (Math.abs(d.vy) < 2) { d.rest = true; } d.vy = -d.vy * 0.3; d.vx *= 0.5; d.vz *= 0.5; d.rx *= 0.4; d.rz *= 0.4; }
    }
    if (this.radarT > 0) { this.radarT -= dt; if (this.radarT <= 0 && Game.running) try { HUD.buildRadar(); } catch (e) { } }
  },
  /* vehicles plough through the light stuff */
  ram(dt) {
    if (!this.on()) return; const ops = [];
    for (const v of Game.vehicles) {
      if (!v.alive || !v.K || v.K.type === 'heli' || v.K.type === 'jet' || v.K.type === 'emplacement' || Math.abs(v.speed || 0) < 6) continue;
      const r = (v.K.br || v.K.r || 1.2) + 0.5, p = v.pos;
      for (const b of World.near(p.x - r, p.z - r, p.x + r, p.z + r, [])) {
        if (b.y0 > p.y + 1.2 || b.y1 < p.y + 0.2 || p.x + r < b.x0 || p.x - r > b.x1 || p.z + r < b.z0 || p.z - r > b.z1) continue;
        const k = this.kind(b, 60); if (k !== 'break' && k !== 'gap') continue;
        if (k === 'break' && (b.y1 - b.y0) * (b.x1 - b.x0) * (b.z1 - b.z0) > (v.kind === 'tank' || v.kind === 'apc' ? 20 : 4)) continue;
        ops.push(k === 'break' ? { b: b.bid } : { b: b.bid, h: [clamp(p.x, b.x0, b.x1), p.y + 1, clamp(p.z, b.z0, b.z1)], g: 1, w: 2.4 });
        v.speed *= v.kind === 'tank' ? 0.95 : 0.8;
      }
    }
    if (ops.length) this.run(ops, true);
  },
};
/* ground or the top of whatever box is under a point */
const _tb49 = [];
function topBelow(x, z, y) { let f = World.floorAt(x, z); for (const b of World.near(x - 0.1, z - 0.1, x + 0.1, z + 0.1, _tb49)) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.y1 <= y && b.y1 > f) f = b.y1; return f; }
/* hook: explosions (the host decides; clients hear about it) */
const _explosion49 = Game.explosion.bind(Game);
Game.explosion = function (p, dmg, radius, owner, weapon) {
  const r = _explosion49(p, dmg, radius, owner, weapon);
  if (this.authority()) try { Destruct.blast(p, dmg, radius, weapon); } catch (e) { console.warn('destruct', e); }
  return r;
};
const _applyEvent49 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) { if (e && e.t === 'dstr') { Destruct.run(e.ops || [], false); return; } return _applyEvent49(e); };
const _gupdate49 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate49(dt); if (!this.running) return; Destruct.update(dt); if (this.authority()) { Destruct.ramT = (Destruct.ramT || 0) - dt; if (Destruct.ramT <= 0) { Destruct.ramT = 0.1; Destruct.ram(0.1); } } };
