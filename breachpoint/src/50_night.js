/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Night and dusk.
   · Play → Time of day: Day, Dusk or Night (random in multiplayer unless
     the host picked one). Night has a moon, stars, lit street lamps and
     a dark blue world; dusk is a low orange sun.
   · Flashlight (L): a torch on your gun. Other people's torches show as
     beams, and bots at night carry theirs until the shooting starts.
   · Night vision (M): green goggles that make the dark readable.
   · Flares (J, two per life at night): a red light that burns for half a
     minute and shows everyone standing near it.
   · At night bots can only see you up close, unless you're lit: torch on,
     shooting, standing in a flare or under a lamp, or driving (headlights).
   ═══════════════════════════════════════════════════════════════════════════ */
KEY_ACTIONS.push(['light', 'Flashlight', 'KeyL'], ['nvg', 'Night vision', 'KeyM'], ['flare', 'Throw flare (night)', 'KeyJ']);
KB.rebuild();
PLAY_OPTS.push({ key: 'tod', label: 'Time of day', opts: () => [['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night'], ['random', 'Random']], def: 'day' });
const TOD = {
  day: { name: 'Day' },
  dusk: { name: 'Dusk', sky: 0xd08a5a, fog: 0xb08060, fogK: 0.8, sun: 0xffa468, sunI: 1.5, hemi: 0.42, hemiC: 0xffc8a0, hemiG: 0x3a2a20, dir: [-60, 18, 30], sight: 110 },
  night: { name: 'Night', sky: 0x070b16, fog: 0x0b1020, fogK: 0.55, sun: 0x9fb4e8, sunI: 0.32, hemi: 0.14, hemiC: 0x5a6a9a, hemiG: 0x14141c, dir: [-30, 60, 40], sight: 38, stars: true, lamps: true, clouds: 0x20242e },
};
const _sunDir50 = SUN_DIR.clone();
const Night = {
  cur: 'day', lamps: [], pool: [], flares: [], beams: new Map(), spot: null, spotT: null, nvg: false, light: false, stars: null, glow: null, nextFlare: 1,
  def() { return TOD[this.cur] || TOD.day; },
  dark() { return this.cur === 'night'; },
  pick(v) { return v === 'random' || !TOD[v] ? pick(['day', 'day', 'dusk', 'night']) : v; },
  /* after the map (and the weather) set sky, fog and sun */
  tint() {
    const T = this.def(); SUN_DIR.copy(_sunDir50);
    if (!T.sky) return;
    const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
    const k = this.dark() ? 1 : 0.55;   // (colours mix in linear light, so night is set outright)
    World.skyColor = mix(World.skyColor, T.sky, k);
    const f = World.fog || [World.skyColor, 60, 300]; World.fog = [mix(f[0], T.fog, k), f[1] * T.fogK, f[2] * T.fogK];
    World.sun = T.sun; SUN_DIR.set(...T.dir).normalize();
  },
  setup(scene) {
    const T = this.def(); this.pool = []; this.flares = []; this.beams.clear(); this.spot = null; this.stars = null; this.setNvg(false); this.light = this.dark();
    if (!T.sky) { if (Game.view && Game.view.scene) Game.view.scene.traverse(o => { if (o.isLight && o.userData.dayI != null) o.intensity = o.userData.dayI; }); return; }
    const sun = scene.userData.sun, hemi = scene.userData.hemi || scene.children.find(o => o.isHemisphereLight);
    if (sun) { sun.intensity = T.sunI; sun.color.set(T.sun); }
    if (hemi) { hemi.intensity = T.hemi; hemi.color.set(T.hemiC); hemi.groundColor.set(T.hemiG); }
    // the gun in your hands is lit by its own lights: dim them to match
    if (Game.view && Game.view.scene) Game.view.scene.traverse(o => { if (o.isLight) { if (o.userData.dayI == null) o.userData.dayI = o.intensity; o.intensity = o.userData.dayI * (this.dark() ? 0.3 : 0.75); } });
    if (T.clouds && typeof Candy !== 'undefined') for (const c of Candy.clouds) if (c.material) c.material.color.setHex(T.clouds);
    if (T.stars) {
      const n = 1400, p = new Float32Array(n * 3), r = mulberry(7);
      for (let i = 0; i < n; i++) { const a = r() * TAU, y = 0.08 + r() * 0.92, k = Math.sqrt(1 - y * y); p.set([Math.cos(a) * k * 800, y * 800, Math.sin(a) * k * 800], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
      this.stars.frustumCulled = false; this.stars.renderOrder = -1; scene.add(this.stars);
    }
    if (this.dark()) {
      // street lamps and lights at flags and bases: a pool of real lights moved to the closest ones
      if (!this.lamps.length) { for (const f of World.flags) this.lamps.push({ x: f.x + 3, y: 5, z: f.z + 3 }); for (const t of ['T', 'CT']) { const h = World.hq[t]; if (h) this.lamps.push({ x: h.x, y: 5, z: h.z }); for (const s of (World.spawns[t] || []).slice(0, 3)) this.lamps.push({ x: s.x, y: 4.5, z: s.z }); } for (const k in World.sites) { const s = World.sites[k]; this.lamps.push({ x: s.cx, y: 5, z: s.cz }); } }
      for (let i = 0; i < 6; i++) { const L = new THREE.PointLight(0xffd9a0, 0, 24, 1.3); L.position.set(0, -50, 0); scene.add(L); this.pool.push(L); }
      const gt = softDot('rgba(255,230,180,1)', 'rgba(255,200,120,0)'); this.glowMat = new THREE.SpriteMaterial({ map: gt, color: 0xffe0a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      for (const l of this.lamps) { const s = new THREE.Sprite(this.glowMat); s.scale.set(2.2, 2.2, 1); s.position.set(l.x, l.y + 0.2, l.z); scene.add(s); }
    }
    // your torch (only built when there's darkness to light)
    if (this.dark() || this.cur === 'dusk') {
      const S = this.spot = new THREE.SpotLight(0xfff2d8, 0, 48, 0.42, 0.55, 1.1); scene.add(S); scene.add(S.target); S.castShadow = false;
      this.others = [0, 1].map(() => { const s = new THREE.SpotLight(0xfff2d8, 0, 34, 0.4, 0.6, 1.2); scene.add(s); scene.add(s.target); return s; });
    }
    for (const s of Game.soldiers) { s.light = this.dark() && s.isBot && chance(0.8); s.flares = this.dark() ? 2 : 0; s.flHabit = chance(0.75); }
    if (T.sky) setTimeout(() => { if (Game.running) HUD.center(this.dark() ? 'Night · L flashlight · M night vision · J flare' : 'Dusk', 2.6); }, 3800);
  },
  setNvg(on) {
    this.nvg = on; document.body.classList.toggle('nvg', on);
    let o = document.getElementById('nvgOverlay');
    if (on && !o) { o = document.createElement('div'); o.id = 'nvgOverlay'; document.body.appendChild(o); }
    if (o) o.style.display = on ? '' : 'none';
  },
  /* who's lit up (bots can see them from far away) */
  lit(e) {
    if (!this.dark()) return true;
    if (e.light || e.vehicle || Game.now - (e.lastShot || -9) < 1.5) return true;
    for (const f of this.flares) if (dist2(f.pos.x, f.pos.z, e.pos.x, e.pos.z) < 22) return true;
    for (const l of this.lamps) if (dist2(l.x, l.z, e.pos.x, e.pos.z) < 9) return true;
    return false;
  },
  /* ── flares ── */
  throwFlare(s, remote) {
    if (!remote) { if (!this.dark() || !s.alive || s.vehicle || (s.flares || 0) <= 0) return; s.flares--; }
    const eye = s.eye(new V3()), f = s.forward(new V3());
    const d = remote || { id: s.id + ':f' + (this.nextFlare++), p: [eye.x + f.x * 0.5, eye.y, eye.z + f.z * 0.5], v: [f.x * 15, f.y * 15 + 4, f.z * 15] };
    this.spawnFlare(d);
    if (!remote) { if (Net.role === 'host') Net.event({ t: 'flr', d }); else if (Net.role === 'client') Net.send({ t: 'flr', d }); if (s.ctrl === 'local') Sfx.play('pin', s.pos); if (s.isBot && Game.cmd[s.team]) Game.cmd[s.team].say(s, 'Flare out!', 3); }
  },
  spawnFlare(d) {
    if (this.flares.some(f => f.id === d.id) || !Game.scene) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), new THREE.MeshBasicMaterial({ color: 0xff5a4a }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.dot, color: 0xff3a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(1.6, 1.6, 1); m.add(glow);
    m.position.set(...d.p); Game.scene.add(m);
    this.flares.push({ id: d.id, pos: m.position, vel: new V3(...d.v), m, glow, t: 0, life: 28 });
    if (this.flares.length > 8) { const o = this.flares.shift(); if (o.m.parent) o.m.parent.remove(o.m); }
    Sfx.play('smoke', m.position, { vol: 0.5 });
  },
  updateFlares(dt) {
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i]; f.t += dt;
      if (f.t > f.life) { if (f.m.parent) f.m.parent.remove(f.m); this.flares.splice(i, 1); continue; }
      if (!f.rest) {
        f.vel.y -= 14 * dt; const n = f.pos.clone().addScaledVector(f.vel, dt), hit = World.los(f.pos.x, f.pos.y, f.pos.z, n.x, n.y, n.z);
        if (!hit) { f.vel.x *= -0.3; f.vel.z *= -0.3; } else f.pos.copy(n);
        const fl = topBelow(f.pos.x, f.pos.z, f.pos.y + 0.2); if (f.pos.y < fl + 0.05) { f.pos.y = fl + 0.05; f.vel.y *= -0.25; f.vel.x *= 0.6; f.vel.z *= 0.6; if (f.vel.length() < 0.6) f.rest = true; }
        f.m.rotation.z += dt * 6;
      }
      const k = f.t > f.life - 3 ? (f.life - f.t) / 3 : 1; f.glow.scale.setScalar((1.4 + Math.random() * 0.6) * k); f.glow.material.opacity = k;
      if (Math.random() < dt * 30) FX.emit('add', f.pos.x, f.pos.y + 0.1, f.pos.z, 1, 1.5, [1, 0.35, 0.25], 0.4, -3, 0.8);
      if (Math.random() < dt * 4) FX.emit('big', f.pos.x, f.pos.y + 0.2, f.pos.z, 1, 0.5, [0.45, 0.2, 0.2], 1.6, 0.6, 0.4);
    }
  },
  /* the light pool follows the closest flares and lamps */
  updatePool(dt) {
    this.poolT = (this.poolT || 0) - dt; const cam = Game.camera; if (!this.pool.length || !cam) return;
    if (this.poolT <= 0) {
      this.poolT = 0.25; const c = cam.position;
      const src = this.flares.map(f => ({ f, d: dist2(f.pos.x, f.pos.z, c.x, c.z) - 20 })).concat(this.lamps.map(l => ({ l, d: dist2(l.x, l.z, c.x, c.z) }))).sort((a, b) => a.d - b.d);
      this.pool.forEach((L, i) => { const s = src[i]; L.userData.src = s || null; });
    }
    for (const L of this.pool) {
      const s = L.userData.src;
      if (!s) { L.intensity = 0; continue; }
      if (s.f) { if (!s.f.m.parent) { L.userData.src = null; L.intensity = 0; continue; } L.color.setHex(0xff4a36); L.distance = 30; L.position.set(s.f.pos.x, s.f.pos.y + 0.4, s.f.pos.z); const k = s.f.t > s.f.life - 3 ? (s.f.life - s.f.t) / 3 : 1; L.intensity = (16 + Math.random() * 6) * k; }
      else { L.color.setHex(0xffd9a0); L.distance = 18; L.position.set(s.l.x, s.l.y, s.l.z); L.intensity = 10; }
    }
  },
  /* torches: yours is a real light; others are beams, the two closest also light */
  updateTorches(dt) {
    const L = Game.local, cam = Game.camera; if (!this.spot || !cam) return;
    const mine = L && L.alive && !L.vehicle && this.light && !Game.view.third;
    this.spot.intensity = mine ? 30 : 0;
    if (mine) { const f = cam.getWorldDirection(new V3()); this.spot.position.copy(cam.position).addScaledVector(f, 0.3).add(new V3(0, -0.15, 0)); this.spot.target.position.copy(cam.position).addScaledVector(f, 10); this.spot.target.updateMatrixWorld(); }
    const seen = new Set(), near = [];
    for (const s of Game.soldiers) {
      if (!s.alive || !s.light || s.vehicle || (s === L && !Game.view.third) || !s.model || !s.model.visible) continue;
      const d = dist2(s.pos.x, s.pos.z, cam.position.x, cam.position.z); if (d > 140) continue;
      seen.add(s.id); near.push([d, s]);
      let b = this.beams.get(s.id);
      if (!b || b.parent !== Game.scene) { const g = new THREE.ConeGeometry(1.8, 11, 14, 1, true); g.translate(0, -5.5, 0); b = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); b.frustumCulled = false; const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.dot, color: 0xfff6e0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); dot.scale.set(0.5, 0.5, 1); b.add(dot); Game.scene.add(b); this.beams.set(s.id, b); }
      const f = s.forward(new V3()), e = s.eye(new V3()).addScaledVector(f, 0.45); e.y -= 0.18;
      b.position.copy(e); b.quaternion.setFromUnitVectors(new V3(0, -1, 0), f); b.visible = true;
    }
    for (const [id, b] of this.beams) if (!seen.has(id)) { if (b.parent) b.parent.remove(b); this.beams.delete(id); }
    near.sort((a, b) => a[0] - b[0]);
    this.others.forEach((S, i) => { const n = near[i]; if (!n) { S.intensity = 0; return; } const s = n[1], f = s.forward(new V3()); S.position.copy(s.eye(new V3())).addScaledVector(f, 0.4); S.target.position.copy(S.position).addScaledVector(f, 10); S.target.updateMatrixWorld(); S.intensity = 22; });
  },
  /* bots: torch on while looking around, off once the shooting starts (mostly) */
  updateBots(dt) {
    if (!this.dark() || !Game.authority()) return;
    this.botT = (this.botT || 0) - dt; if (this.botT > 0) return; this.botT = 0.5;
    for (const s of Game.soldiers) {
      if (s.ctrl !== 'bot' || !s.alive || !s.brain || s.team === 'Z') continue;
      const fighting = s.brain.target && s.brain.target.alive, want = s.flHabit && !(fighting && s.flHabit && (s.id.charCodeAt(1) % 2));
      if (want !== !!s.light) { s.light = want; if (Net.role === 'host') Net.event({ t: 'torch', id: s.id, on: want ? 1 : 0 }); }
      // heard something in the dark: light it up
      const h = s.brain.heard; if ((s.flares || 0) > 0 && h && Game.now - h.t < 1 && !fighting && chance(0.05)) { const yaw = s.yaw, pitch = s.pitch; s.yaw = Math.atan2(-(h.x - s.pos.x), -(h.z - s.pos.z)); s.pitch = 0.35; this.throwFlare(s); s.yaw = yaw; s.pitch = pitch; }
    }
  },
  /* vehicle headlights at night */
  updateHeadlights() {
    if (!this.dark()) return;
    for (const v of Game.vehicles) {
      const on = v.alive && v.driver && v.K.type !== 'emplacement' && v.K.type !== 'boat';
      let h = v.model && v.model.userData.headBeam;
      if (!h && on && v.model) { const g = new THREE.ConeGeometry(3.2, 20, 14, 1, true); g.translate(0, -10, 0); h = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); h.rotation.x = -Math.PI / 2; h.position.set(0, 1.0, -(v.K.r || 1.5) - 0.3); h.frustumCulled = false; v.model.add(h); v.model.userData.headBeam = h; }
      if (h) h.visible = !!on && (v.K.type !== 'heli' && v.K.type !== 'jet' || true);
    }
  },
  update(dt) {
    if (this.stars && Game.camera) this.stars.position.copy(Game.camera.position);
    this.updateFlares(dt); this.updatePool(dt); this.updateTorches(dt); this.updateBots(dt); this.updateHeadlights();
  },
};
/* hooks */
const _loadMap50 = loadMap;
loadMap = function (id, scene) { Night.lamps = []; _loadMap50(id, scene); Night.tint(); };
const _lamp50 = lamp;
lamp = function (x, z) { Night.lamps.push({ x, y: 5.0, z }); return _lamp50(x, z); };
const _startCfg50 = Net.startCfgFor.bind(Net);
Net.startCfgFor = function (cfg) { if (cfg && !cfg.tod) cfg.tod = Night.pick(UI.playCfg && UI.playCfg.tod || 'day'); return _startCfg50(cfg); };
const _start50 = Game.start.bind(Game);
Game.start = function (cfg) {
  cfg.tod = Night.pick(cfg.tod || 'day'); Night.cur = cfg.tod;
  const r = _start50(cfg); Night.setup(this.scene); return r;
};
const _gupdate50 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate50(dt); if (this.running) Night.update(dt); };
/* keys */
const _pc50 = Player.controls.bind(Player);
Player.controls = function (s, dt) {
  const r = _pc50(s, dt), I = Input;
  if (!Sandbox.on || Night.dark()) {
    if (I.hit('KeyL') && !Sandbox.on) { Night.light = !Night.light; s.light = Night.light; Sfx.play('ui'); HUD.center(Night.light ? 'Flashlight on' : 'Flashlight off', 0.6); if (Net.role === 'host') Net.event({ t: 'torch', id: s.id, on: s.light ? 1 : 0 }); else if (Net.role === 'client') Net.send({ t: 'torch', on: s.light ? 1 : 0 }); }
    if (I.hit('KeyM')) { Night.setNvg(!Night.nvg); Sfx.play('ui'); }
    if (I.hit('KeyJ') && !Sandbox.on) { if (!Night.dark()) HUD.center('Flares are for the night', 0.8); else if ((s.flares || 0) <= 0) HUD.center('No flares left', 0.8); else Night.throwFlare(s); }
  }
  return r;
};
const _respawn50 = Game.respawn.bind(Game);
Game.respawn = function (s, where) { const r = _respawn50(s, where); s.flares = Night.dark() ? 2 : 0; if (s === Game.local) s.light = Night.light; return r; };
/* network */
const _hostData50 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  const p = this.peers && this.peers.get(id), s = p && p.sid && Game.byId(p.sid);
  if (m && m.t === 'torch') { if (s) { s.light = !!m.on; Net.event({ t: 'torch', id: s.id, on: m.on }); } return; }
  if (m && m.t === 'flr') { if (s && m.d) { Night.spawnFlare(m.d); Net.event({ t: 'flr', d: m.d }); } return; }
  return _hostData50(id, m);
};
const _applyEvent50 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  if (e && e.t === 'torch') { const s = Game.byId(e.id); if (s && s !== Game.local) s.light = !!e.on; return; }
  if (e && e.t === 'flr') { Night.spawnFlare(e.d); return; }
  return _applyEvent50(e);
};
/* bots in the dark */
const _enemies50 = Brain.prototype.enemies;
Brain.prototype.enemies = function () {
  const list = _enemies50.call(this), T = Night.def(); if (!T.sight) return list;
  const s = this.s, R = T.sight;
  return list.filter(e => dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z) < R || Night.lit(e) || (this.target === e));
};
/* the start screen gets a "torch" line in the HUD hint */
const _stop50 = Game.stop.bind(Game);
Game.stop = function () { Night.setNvg(false); return _stop50(); };
