/* ═══════════════════════════════════════════════════════════════════════════
   Water on every map.
   · Dustyard: a flooded canal through Lower with a dry plank walkway, and a
     fountain pool in CT spawn.
   · Ridgeline: a river across the valley with three bridges, and a lake
     around an island holding a sixth flag (F, Island), reached by a
     footbridge, a dock, a boat or a swim. A speedboat for each side.
   · Flatgrass: the lake gets depth, an island with a lighthouse, a dock and a
     footbridge.
   Water has a real bed: you wade in the shallows (slower), swim in deep
   water (slower still, no shooting, Space rises, Ctrl dives), drown after
   8 s under, and climb out at the bank. The view goes murky underwater.
   Bullets stop at the surface, so a swimmer is only exposed from the neck
   up. Ground vehicles that drive in stall and flood; boats float.
   ═══════════════════════════════════════════════════════════════════════════ */

function inWater(x, z) { for (const w of World.water) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return w; return null; }
World.floorAt = function (x, z) { const w = inWater(x, z); return w ? -w.depth : 0; };
function deckAt(x, z) { if (!World.grid) return null; for (const b of World.near(x - 0.5, z - 0.5, x + 0.5, z + 0.5)) if (b.deck && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return b; return null; }

/* ── building blocks ───────────────────────────────────────────────────── */
function lake(x0, z0, x1, z1, depth, hole) {
  // a rectangle of water, optionally with an island (hole) left dry
  if (!hole) { World.water.push({ x0, z0, x1, z1, depth }); return; }
  const [a, b, c, d] = hole;
  World.water.push({ x0, z0, x1, z1: b, depth }, { x0, z0: d, x1, z1, depth }, { x0, z0: b, x1: a, z1: d, depth }, { x0: c, z0: b, x1, z1: d, depth });
}
/* a deck you can walk (and drive) on, with posts down to the bed and optional rails */
function deck(x0, z0, x1, z1, rails) {
  const b = World.add(x0, 0.15, z0, x1, 0.45, z1, 'wood', '#9a7a5a'); b.deck = true;
  const along = x1 - x0 > z1 - z0;
  for (let t = 0; t <= 1.001; t += 0.25) {
    const px = along ? x0 + (x1 - x0) * t : null, pz = along ? null : z0 + (z1 - z0) * t;
    for (const side of [0, 1]) { const x = along ? px : side ? x1 - 0.2 : x0 + 0.2, z = along ? (side ? z1 - 0.2 : z0 + 0.2) : pz; if (inWater(x, z)) World.add(x - 0.12, -inWater(x, z).depth, z - 0.12, x + 0.12, 0.15, z + 0.12, 'wood', '#6a5a4a'); }
  }
  // nothing low (sandbags, fences, rocks) blocks either end
  const m = 3, lx0 = along ? x0 - m : x0, lx1 = along ? x1 + m : x1, lz0 = along ? z0 : z0 - m, lz1 = along ? z1 : z1 + m;
  World.boxes = World.boxes.filter(o => { if (o === b || o.deck || o.y0 > 0.01 || o.y0 < -0.01 || o.y1 > 1.6 || !(o.x1 > lx0 && o.x0 < lx1 && o.z1 > lz0 && o.z0 < lz1)) return true; if (o.mesh) World.group.remove(o.mesh); return false; });
  if (rails) {
    if (along) { World.add(x0, 0.45, z0, x1, 1.3, z0 + 0.15, 'wood', '#8a6a4a'); World.add(x0, 0.45, z1 - 0.15, x1, 1.3, z1, 'wood', '#8a6a4a'); }
    else { World.add(x0, 0.45, z0, x0 + 0.15, 1.3, z1, 'wood', '#8a6a4a'); World.add(x1 - 0.15, 0.45, z0, x1, 1.3, z1, 'wood', '#8a6a4a'); }
  }
  return b;
}
/* clear anything low that the map scattered where the water now is */
function clearWater() {
  const wet = b => World.water.some(w => b.x1 > w.x0 && b.x0 < w.x1 && b.z1 > w.z0 && b.z0 < w.z1);
  World.boxes = World.boxes.filter(b => { if (b.deck || b.y0 < -0.01 || b.y0 > 0.01 || b.y1 > 9 || !wet(b)) return true; if (b.mesh) World.group.remove(b.mesh); return false; });
  for (const o of World.group.children.slice()) if (o.isMesh && o.geometry && o.geometry.type === 'ConeGeometry' && inWater(o.position.x, o.position.z)) World.group.remove(o);
}
const WATER_LAYOUT = {
  flatgrass() {
    lake(52, -96, 96, -52, 3.5, [74, -86, 86, -74]);
    World.add(78.5, 0, -81.5, 81.5, 9, -78.5, 'concrete', '#e8e4dc'); World.add(78, 9, -82, 82, 10.2, -78, 'metal', '#c83a2a');
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe8a0 })); lamp.position.set(80, 10.9, -80); World.deco(lamp);
    deck(46, -66, 62, -63, false); deck(78.5, -77, 81.5, -50, true);
  },
  dustyard() {
    lake(-28, 0.2, -8, 5.8, 1.1); lake(-4, -34, 4, -28, 0.8);
    deck(-28, 0.2, -8, 1.5, false);
  },
  ridgeline() {
    lake(-108, 19, 25, 27, 3); lake(45, 19, 108, 27, 3); lake(25, 12, 45, 40, 3.5, [31, 22, 39, 30]);
    clearWater();
    deck(-3, 17, 3, 29, true); deck(-62, 17, -58, 29, true); deck(72, 17, 76, 29, true);
    deck(33.5, 11, 36.5, 23, true); deck(29, 34, 32, 41, false);
    sandbags(32.5, 24, 37.5, 24.6); World.add(38, 0, 28.5, 38.4, 5, 28.9, 'wood', '#6a5a4a'); World.add(37.2, 5, 27.7, 39.2, 5.2, 29.7, 'wood', '#8a6a4a');
    World.flags.push(Object.assign({ owner: null, prog: 0, radius: 5.5 }, { name: 'F', label: 'Island', x: 35, z: 26 }));
    World.zones.push({ name: 'F Island', x0: 25, z0: 12, x1: 45, z1: 40 }, { name: 'River', x0: -110, z0: 17, x1: 110, z1: 29 });
    World.vehicleSpawns.push({ team: 'CT', x: -30, z: 23, yaw: Math.PI / 2, kind: 'boat' }, { team: 'T', x: 60, z: 23, yaw: -Math.PI / 2, kind: 'boat' });
  },
};
for (const k in MAPS) {
  const m = MAPS[k], b = m.build;
  m.build = function () { World.water = []; const r = b.apply(this, arguments); if (WATER_LAYOUT[k]) { WATER_LAYOUT[k](); if (k !== 'ridgeline') clearWater(); } return r; };
}

/* ── how water looks ───────────────────────────────────────────────────── */
let _wtex = null, _wScene = null;
function waterTexture() {
  if (_wtex) return _wtex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#2a6a9a'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(${170 + rand(0, 60) | 0},${210 + rand(0, 40) | 0},255,${rand(0.08, 0.25)})`; x.lineWidth = rand(1, 2.5); const px = rand(0, 128), py = rand(0, 128), l = rand(6, 22); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - rand(1, 3), px + l, py); x.stroke(); }
  _wtex = new THREE.CanvasTexture(c); _wtex.wrapS = _wtex.wrapT = THREE.RepeatWrapping; _wtex.colorSpace = THREE.SRGBColorSpace; return _wtex;
}
function ensureWater() {
  if (_wScene === Game.scene || !Game.scene) return; _wScene = Game.scene; UW.on = false;
  const tex = waterTexture(), bedM = lam('#8a7a5a'), sideM = new THREE.MeshLambertMaterial({ color: '#5a4a3a', side: THREE.DoubleSide });
  for (const w of World.water) {
    const W = w.x1 - w.x0, D = w.z1 - w.z0, cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, t = tex.clone(); t.needsUpdate = true; t.repeat.set(W / 10, D / 10);
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: t, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false }));
    surf.rotation.x = -Math.PI / 2; surf.position.set(cx, 0.03, cz); surf.renderOrder = 2; surf.userData.water = true; Game.scene.add(surf);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(W, D), bedM); bed.rotation.x = -Math.PI / 2; bed.position.set(cx, -w.depth, cz); Game.scene.add(bed);
    for (const [px, pz, len, ry] of [[cx, w.z0, W, 0], [cx, w.z1, W, 0], [w.x0, cz, D, Math.PI / 2], [w.x1, cz, D, Math.PI / 2]]) {
      if (inWater(px + (ry ? (px === w.x0 ? -0.3 : 0.3) : 0), pz + (ry ? 0 : (pz === w.z0 ? -0.3 : 0.3)))) continue;   // the neighbouring water rectangle continues here
      const side = new THREE.Mesh(new THREE.PlaneGeometry(len, w.depth), sideM); side.position.set(px, -w.depth / 2, pz); side.rotation.y = ry; Game.scene.add(side);
    }
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(W + 2.4, D + 2.4), lam('#c8b888')); shore.rotation.x = -Math.PI / 2; shore.position.set(cx, 0.012, cz); Game.scene.add(shore);
  }
}
/* underwater: murky blue fog and a tint */
const UW = { on: false, save: null, el: null };
function underwaterFX() {
  const c = Game.camera && Game.camera.position; if (!c || !Game.scene || !Game.scene.fog) return;
  const w = inWater(c.x, c.z), under = !!w && c.y < 0.02 && !deckAt(c.x, c.z);
  if (under === UW.on) return; UW.on = under;
  if (!UW.el) { UW.el = document.createElement('div'); UW.el.id = 'underwater'; const hud = document.getElementById('hud'); if (hud) hud.prepend(UW.el); else document.body.appendChild(UW.el); }
  UW.el.classList.toggle('on', under);
  const F = Game.scene.fog;
  if (under) { UW.save = [F.color.getHex(), F.near, F.far, Game.scene.background.getHex()]; F.color.set(0x14486a); F.near = 0.3; F.far = 16; Game.scene.background.set(0x14486a); }
  else if (UW.save) { F.color.setHex(UW.save[0]); F.near = UW.save[1]; F.far = UW.save[2]; Game.scene.background.setHex(UW.save[3]); }
}
function splash(x, z, k = 1) { FX.emit('norm', x, 0.06, z, Math.round(14 * k), 2.6 * Math.sqrt(k), [0.82, 0.9, 1], 0.7, -9, 0.7 * k, new V3(0, 2.5 * k, 0)); if (k > 0.5) Sfx.play('smoke', new V3(x, 0, z), { vol: 0.5 * k }); }

/* ── bots keep to bridges; nobody spawns in the water ──────────────────── */
const _navBuild23 = NavGrid.prototype.build;
NavGrid.prototype.build = function () {
  _navBuild23.call(this); this.wet = null; if (!World.water.length) return;
  this.wet = new Uint8Array(this.w * this.h);
  for (let i = 0; i < this.w * this.h; i++) { if (!this.walk[i]) continue; const x = this.cx(i), z = this.cz(i), w = inWater(x, z); if (!w || deckAt(x, z)) continue; this.wet[i] = w.depth > 1.3 ? 2 : 1; this.cost[i] = w.depth > 1.3 ? 10 : 3; }
};
const _spawnable23 = NavGrid.prototype.spawnable;
NavGrid.prototype.spawnable = function (x, z) { if (this.wet) { const i = this.idx(x, z); if (i >= 0 && this.wet[i]) return false; } return _spawnable23.call(this, x, z); };

/* ── wading, swimming, drowning ────────────────────────────────────────── */
const _move23 = Soldier.prototype.move;
Soldier.prototype.move = function (dt) {
  if (!World.water.length || this.noclip) { this.swim = this.wade = false; return _move23.call(this, dt); }
  const w = inWater(this.pos.x, this.pos.z), onDeck = w && this.pos.y > 0.1;
  const was = this.swim || this.wade;
  this.swim = !!w && !onDeck && w.depth > 1.3 && this.pos.y < -0.3; this.wade = !!w && !onDeck && !this.swim && this.pos.y < 0.05;
  if (this.swim) this.ads = false;
  moveBody.climb = this.swim ? 1.45 : STEP;
  const r = _move23.call(this, dt);
  moveBody.climb = STEP;
  const w2 = inWater(this.pos.x, this.pos.z);
  if (this.swim && w2) {
    const surf = -1.25, m = this.moveIn;
    if (m.crouch) this.pos.y = Math.max(-w2.depth, this.pos.y - 1.6 * dt);
    else this.pos.y = this.pos.y > surf ? Math.max(surf, this.pos.y - 3 * dt) : Math.min(surf, this.pos.y + (m.jump ? 3 : 1.5) * dt);
    this.vel.y = 0; this.grounded = true;
  }
  const inNow = this.swim || this.wade;
  if (inNow && !was && w2) splash(this.pos.x, this.pos.z, 1);
  if (inNow && Math.hypot(this.vel.x, this.vel.z) > 1.2) { this.ripT = (this.ripT || 0) - dt; if (this.ripT <= 0) { this.ripT = 0.35; splash(this.pos.x, this.pos.z, 0.25); } }
  // under too long and you drown
  if (w2 && this.eyeY < -0.05) {
    this.underT = (this.underT || 0) + dt; this.drownTick = (this.drownTick || 0) - dt;
    if (this.underT > 8 && this.drownTick <= 0 && Game.authority()) { this.drownTick = 1; Game.damage(this, 12, null, 'drown', 'head'); }
    if (this.ctrl === 'local' && this.underT > 5 && this.underT - dt <= 5) HUD.center('Out of breath — surface!', 1.5);
  } else this.underT = 0;
  return r;
};
const _maxSpeed23 = Soldier.prototype.maxSpeed;
Soldier.prototype.maxSpeed = function () { const m = _maxSpeed23.call(this); return this.swim ? m * 0.5 : this.wade ? m * 0.72 : m; };
const _fire23 = fireWeapon;
fireWeapon = function (s, now, rc) { if (s.swim && s.w && s.w.type !== 'knife') { if (s.ctrl === 'local' && Input.mouse.leftPressed) HUD.center('Can\'t shoot while swimming', 0.6); return false; } return _fire23(s, now, rc); };

/* ── vehicles in water: boats float (see the boat), everything else floods ── */
const _vphys23 = Vehicle.prototype.physics;
Vehicle.prototype.physics = function (dt) {
  const y0 = this.pos.y; _vphys23.call(this, dt);
  if (!World.water.length || !this.alive || this.held || this.frozen || this.K.type === 'boat') return;
  const w = inWater(this.pos.x, this.pos.z); if (!w) return;
  if (y0 > -0.1 && this.pos.y < -0.1) splash(this.pos.x, this.pos.z, 2);
  const flooded = this.pos.y < -(this.K.type === 'heli' || this.K.type === 'jet' ? 0.3 : Math.min(1.2, this.K.h * 0.5));
  if (!flooded) return;
  this.speed = clamp(this.speed, -1.2, 1.2); if (this.throttle) this.throttle = 0; if (this.rotorK) this.rotorK *= Math.exp(-dt * 2);
  this.floodT = (this.floodT || 0) - dt;
  if (this.floodT <= 0 && Game.authority()) { this.floodT = 0.5; this.damage(this.maxHp * (this.K.type === 'heli' || this.K.type === 'jet' ? 0.15 : 0.03), null); }
  if (Math.random() < 0.2) FX.emit('norm', this.pos.x + rand(-1, 1), 0.08, this.pos.z + rand(-1, 1), 2, 1, [0.85, 0.92, 1], 0.6, -3, 0.4);
};

/* ── effects: bullets splash on the surface, no blood decals floating on it ── */
const _impact23 = FX.impact.bind(FX);
FX.impact = function (p, n, soft) { if (!soft && World.water.length && n && n.y > 0.7 && p.y < 0.1 && inWater(p.x, p.z) && !deckAt(p.x, p.z)) { this.emit('norm', p.x, 0.06, p.z, 6, 2, [0.85, 0.92, 1], 0.45, -9, 0.3, new V3(0, 2.2, 0)); return; } return _impact23(p, n, soft); };
const _bput23 = BloodDecals.put.bind(BloodDecals);
BloodDecals.put = function (p, n, size) { if (n.y > 0.7 && World.water.length && inWater(p.x, p.z) && !deckAt(p.x, p.z) && p.y < 0.1) return; return _bput23(p, n, size); };

/* ── per frame ─────────────────────────────────────────────────────────── */
const _gu23 = Game.update.bind(Game);
Game.update = function (dt) {
  if (this.running) ensureWater();
  const r = _gu23(dt);
  if (this.running && World.water.length) {
    underwaterFX();
    for (const o of this.scene.children) if (o.userData.water && o.material.map) { o.material.map.offset.x += dt * 0.012; o.material.map.offset.y += dt * 0.007; }
  }
  return r;
};
const _gstop23 = Game.stop.bind(Game);
Game.stop = function () { if (UW.el) UW.el.classList.remove('on'); UW.on = false; UW.save = null; return _gstop23(); };
