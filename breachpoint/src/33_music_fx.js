/* ═══════════════════════════════════════════════════════════════════════════
   Music, eye candy and speech bubbles.
   · Music, synthesised live: a calm theme on the menus and in Sandbox, a
     driving beat in battle, an eerie heartbeat drone in Zombies. Settings →
     Music volume.
   · Eye candy: drifting clouds, circling birds (gulls on the docks), brass
     that ejects from rifles and pistols, muzzle flashes that light the
     surroundings, explosion flashes with shockwaves and scorch marks, dust
     kicked up by footsteps, and dust motes in the desert air.
   · Speech bubbles: chat and radio callouts pop up over the speaker's head,
     for players and bots alike (your own team's radio only).
   ═══════════════════════════════════════════════════════════════════════════ */
if (Settings.music == null) Settings.music = 0.35;

/* ── music ─────────────────────────────────────────────────────────────── */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const CHORD = { m: [0, 3, 7], M: [0, 4, 7], sus: [0, 5, 7], m7: [0, 3, 7, 10] };
const MOODS = {
  menu: { bpm: 84, level: 0.8, prog: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], pad: 0.05, arp: 0.035, kick: 0.25, snare: 0, hat: 0, bass: 0.05 },
  chill: { bpm: 76, level: 0.6, prog: [[48, 'M'], [57, 'm'], [53, 'M'], [55, 'sus']], pad: 0.045, arp: 0.03, kick: 0, snare: 0, hat: 0.012, bass: 0.04 },
  battle: { bpm: 112, level: 0.55, prog: [[50, 'm'], [46, 'M'], [53, 'M'], [48, 'M']], pad: 0.03, arp: 0.022, kick: 0.5, snare: 0.18, hat: 0.03, bass: 0.07, drive: true },
  zombies: { bpm: 68, level: 0.75, prog: [[50, 'm'], [50, 'm'], [51, 'M'], [49, 'm']], pad: 0.04, arp: 0, kick: 0.55, snare: 0, hat: 0, bass: 0.06, heart: true, eerie: true },
};
const Music = {
  gain: null, bus: null, mood: null, next: 0, step: 0,
  ensure() {
    const c = Sfx.ctx; if (!c || c.state !== 'running') return false;
    if (!this.gain) { this.gain = c.createGain(); this.gain.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; this.gain.connect(lp); lp.connect(Sfx.master); this.next = c.currentTime + 0.1; }
    return true;
  },
  want() { if (!Game.running) return 'menu'; const m = Game.mode && Game.mode.id; return m === 'sandbox' ? 'chill' : m === 'zombies' ? 'zombies' : 'battle'; },
  tick() {
    if (!this.ensure()) return; const c = Sfx.ctx, w = this.want(), vol = (Settings.music != null ? Settings.music : 0.35);
    if (w !== this.mood) { this.mood = w; this.step = 0; this.next = Math.max(this.next, c.currentTime + 0.05); }
    const M = MOODS[this.mood], target = vol * M.level * (Game.running && Game.matchOver ? 0.4 : 1);
    this.gain.gain.setTargetAtTime(target, c.currentTime, 0.8);
    if (vol <= 0.001) { this.next = c.currentTime + 0.1; return; }
    const st = 60 / M.bpm / 2;
    while (this.next < c.currentTime + 0.3) { this.play(M, this.step, this.next, st); this.next += st; this.step++; }
  },
  play(M, i, t, st) {
    const bar = Math.floor(i / 16), s = i % 16, ch = M.prog[bar % M.prog.length], root = ch[0], notes = CHORD[ch[1]].map(n => root + n);
    if (s === 0) this.pad(t, notes, st * 16, M.pad);
    if (M.bass && (M.drive ? s % 2 === 0 : s % 8 === 0)) this.bass(t, root - 12, M.drive ? st * 1.6 : st * 7, M.bass);
    if (M.arp && s % 2 === 0) { const seq = [0, 1, 2, 1, 2, 0, 1, 2]; this.pluck(t, notes[seq[(s / 2) % 8] % notes.length] + 12, st * 1.8, M.arp); }
    if (M.kick && (M.heart ? (s === 0 || s === 2) : M.drive ? (s === 0 || s === 6 || s === 8) : s === 0)) this.kick(t, M.kick * (M.heart && s === 2 ? 0.6 : 1));
    if (M.snare && (s === 4 || s === 12)) this.snare(t, M.snare);
    if (M.hat && s % 2 === 1) this.hat(t, M.hat);
    if (M.eerie && s === 8 && bar % 2 === 1) this.pluck(t, root + 25 + (bar % 4 === 1 ? 1 : 0), st * 12, 0.02, 'sine');
  },
  pad(t, notes, dur, vol) {
    const c = Sfx.ctx, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.25); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    f.connect(g); g.connect(this.gain);
    for (const n of notes) for (const d of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur * 1.1); }
  },
  bass(t, n, dur, vol) { const c = Sfx.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'square'; o.frequency.value = mtof(n); f.type = 'lowpass'; f.frequency.value = 320;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(f); f.connect(g); g.connect(this.gain); o.start(t); o.stop(t + dur + 0.05); },
  pluck(t, n, dur, vol, type = 'triangle') { const c = Sfx.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = mtof(n);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + dur + 0.05); },
  kick(t, vol) { const c = Sfx.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + 0.25); },
  snare(t, vol) { if (Sfx.noise) Sfx.burst(this.gain, t, 0.14, 2600, 900, 0.8, vol, 'bandpass'); },
  hat(t, vol) { if (Sfx.noise) Sfx.burst(this.gain, t, 0.035, 9000, 7000, 0.7, vol, 'highpass'); },
};
setInterval(() => { try { Music.tick(); } catch (e) { /* audio not ready */ } }, 60);

/* ── speech bubbles ────────────────────────────────────────────────────── */
const Bubble = {
  say(s, text) {
    if (!s || !s.model || !text) return;
    text = String(text).replace(/\s+/g, ' ').trim(); if (text.length > 70) text = text.slice(0, 67) + '…';
    const c = document.createElement('canvas'), x = c.getContext('2d'), fs = 34; x.font = `600 ${fs}px system-ui, sans-serif`;
    // wrap to two lines
    const words = text.split(' '), lines = ['']; for (const w of words) { const t = (lines[lines.length - 1] + ' ' + w).trim(); if (x.measureText(t).width > 460 && lines[lines.length - 1]) { if (lines.length === 2) { lines[1] += '…'; break; } lines.push(w); } else lines[lines.length - 1] = t; }
    const W = Math.min(500, Math.max(...lines.map(l => x.measureText(l).width)) + 40), H = lines.length * (fs + 8) + 28;
    c.width = 512; c.height = 160; x.font = `600 ${fs}px system-ui, sans-serif`;
    const x0 = (512 - W) / 2; x.fillStyle = 'rgba(255,255,255,0.94)'; x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 3;
    x.beginPath(); x.roundRect(x0, 4, W, H, 18); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(256 - 14, H + 3); x.lineTo(256, H + 26); x.lineTo(256 + 14, H + 3); x.fill();
    x.fillStyle = s.team && TEAM_STYLE[s.team] ? '#1a1e24' : '#1a1e24'; x.textAlign = 'center'; x.textBaseline = 'top';
    lines.forEach((l, i) => x.fillText(l, 256, 18 + i * (fs + 8)));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    if (s.bubble) { s.bubble.parent && s.bubble.parent.remove(s.bubble); s.bubble.material.map.dispose(); s.bubble.material.dispose(); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    sp.scale.set(2.4, 0.75, 1); sp.position.y = 2.55; sp.renderOrder = 20; sp.userData.t0 = Game.now; sp.userData.noShadow = true;
    s.model.add(sp); s.bubble = sp;
  },
  update() {
    for (const s of Game.soldiers) { const b = s.bubble; if (!b) continue; const age = Game.now - b.userData.t0;
      if (age > 5 || !s.alive || !s.model || b.parent !== s.model) { b.parent && b.parent.remove(b); b.material.map.dispose(); b.material.dispose(); s.bubble = null; continue; }
      b.material.opacity = age > 4.4 ? 1 - (age - 4.4) / 0.6 : 1; b.position.y = 2.55 + Math.min(age, 0.25) * 0.4; }
  },
  byName(n) { return Game.soldiers.find(s => s.name === n) || null; },
};
const _chat33 = HUD.chat.bind(HUD);
HUD.chat = function (from, text, team) { const r = _chat33(from, text, team); if (Game.running) Bubble.say(Bubble.byName(from), text); return r; };
const _radio33 = HUD.radio.bind(HUD);
HUD.radio = function (from, text) { const r = _radio33(from, text); if (Game.running) Bubble.say(Bubble.byName(from), text); return r; };

/* ── eye candy ─────────────────────────────────────────────────────────── */
function softTex(draw, w = 128, h = 128) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const Candy = {
  scene: null, clouds: [], birds: [], shells: [], lights: [], rings: [], scorch: [], motes: null, _ct: null, _st: null, _sc: null,
  setup(scene) {
    this.scene = scene; this.clouds = []; this.birds = []; this.shells = []; this.lights = []; this.rings = []; this.scorch = []; this.motes = null;
    const outdoors = !!World.def;
    // clouds
    if (!this._ct) this._ct = softTex((x, w, h) => { for (let i = 0; i < 14; i++) { const cx = w * (0.2 + Math.random() * 0.6), cy = h * (0.45 + Math.random() * 0.2), r = w * (0.12 + Math.random() * 0.14), g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); } }, 256, 128);
    if (outdoors) for (let i = 0; i < 16; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._ct, transparent: true, depthWrite: false, fog: false, opacity: 0.75, color: World.id === 'frostpeak' ? 0xdde4ec : 0xffffff }));
      const s = rand(80, 170); m.scale.set(s, s * 0.45, 1); m.position.set(rand(-420, 420), rand(120, 190), rand(-420, 420)); m.userData.noShadow = true; m.renderOrder = -5; scene.add(m); this.clouds.push(m);
    }
    // birds (gulls on the docks)
    const gull = World.id === 'dockyard', bm = lam(gull ? '#f0f0f0' : '#2a2a2a');
    if (outdoors && World.id !== 'frostpeak') for (let f = 0; f < 3; f++) { const cx = rand(-60, 60), cz = rand(-60, 60), R = rand(25, 60), alt = rand(35, 60), sp = rand(0.15, 0.3) * (chance(0.5) ? 1 : -1);
      for (let i = 0; i < 4; i++) { const g = new THREE.Group(), wl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.22), bm), wr = wl.clone(); wl.position.x = -0.35; wr.position.x = 0.35; const pl = new THREE.Group(), pr = new THREE.Group(); pl.add(wl); pr.add(wr); g.add(pl, pr, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.4), bm));
        g.userData = { pl, pr, cx, cz, R: R + i * 2.5, alt: alt + rand(-3, 3), sp, ph: i * 0.18, flap: rand(0, 6) }; scene.add(g); this.birds.push(g); } }
    // muzzle / explosion lights: always present, dark when idle (so shaders never recompile)
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffb060, 0, 9, 2); l.userData.t = 0; scene.add(l); this.lights.push(l); }
    // dust motes in the desert
    if (World.id === 'oasis' || World.id === 'dustyard') {
      const N = 500, g = new THREE.BufferGeometry(), p = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) p[i] = rand(-20, 20);
      g.setAttribute('position', new THREE.BufferAttribute(p, 3)); this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe8b0, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false })); this.motes.frustumCulled = false; scene.add(this.motes);
    }
  },
  light(p, intensity, dist, dur, color) { const l = this.lights.reduce((a, b) => a.userData.t <= b.userData.t ? a : b, this.lights[0]); if (!l) return; l.position.set(p.x, p.y, p.z); l.intensity = intensity; l.distance = dist; l.color.set(color || 0xffb060); l.userData.t = dur; l.userData.i0 = intensity; l.userData.d0 = dur; },
  shell(s) {
    if (this.shells.length > 50) { const o = this.shells.shift(); this.scene.remove(o); }
    const m = new THREE.Mesh(this._sg || (this._sg = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6)), this._sm || (this._sm = new THREE.MeshStandardMaterial({ color: 0xd8a040, metalness: 0.8, roughness: 0.35 })));
    const e = s.eye(new V3()), f = s.forward(new V3()), r = new V3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    m.position.copy(e).addScaledVector(f, 0.45).addScaledVector(r, 0.18).add(new V3(0, -0.12, 0));
    m.userData = { v: r.clone().multiplyScalar(rand(1.8, 3)).add(new V3(0, rand(1.6, 2.6), 0)).add(f.clone().multiplyScalar(rand(-0.3, 0.3))), w: new V3(rand(-20, 20), rand(-20, 20), rand(-20, 20)), t: 0, bounce: 0 };
    this.scene.add(m); this.shells.push(m);
  },
  boom(p) {
    this.light(new V3(p.x, p.y + 1.5, p.z), 60, 30, 0.22, 0xffa040);
    if (!this._rt) this._rt = softTex((x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,240,220,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this._rt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const fy = World.floorAt(p.x, p.z); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, fy + 0.15, p.z); ring.userData = { t: 0, noShadow: true }; this.scene.add(ring); this.rings.push(ring);
    // scorch mark where it touched the ground
    if (p.y - fy < 2.5 && !(typeof inWater === 'function' && inWater(p.x, p.z))) {
      if (!this._sc) this._sc = softTex((x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(10,8,6,0.85)'); g.addColorStop(0.6, 'rgba(20,16,12,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(w / 2 + (Math.random() - 0.5) * w * 0.8, h / 2 + (Math.random() - 0.5) * h * 0.8, 3, 3); } });
      if (this.scorch.length > 14) { const o = this.scorch.shift(); this.scene.remove(o); }
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({ map: this._sc, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      sc.rotation.x = -Math.PI / 2; sc.rotation.z = rand(0, TAU); sc.position.set(p.x, fy + 0.03, p.z); sc.userData = { t0: Game.now, noShadow: true }; this.scene.add(sc); this.scorch.push(sc);
    }
  },
  update(dt) {
    if (this.scene !== Game.scene) return;
    for (const c of this.clouds) { c.position.x += dt * 1.6; if (c.position.x > 460) c.position.x = -460; }
    const t = Game.now;
    for (const b of this.birds) { const u = b.userData, a = t * u.sp - u.ph; b.position.set(u.cx + Math.cos(a) * u.R, u.alt + Math.sin(t * 0.7 + u.ph * 9) * 1.5, u.cz + Math.sin(a) * u.R); b.rotation.y = -a + (u.sp > 0 ? Math.PI : 0); const fl = Math.sin(t * 9 + u.flap) * 0.6; u.pl.rotation.z = fl; u.pr.rotation.z = -fl; }
    for (const l of this.lights) if (l.userData.t > 0) { l.userData.t -= dt; l.intensity = l.userData.t > 0 ? l.userData.i0 * (l.userData.t / l.userData.d0) : 0; }
    for (const m of this.shells) { const u = m.userData; u.t += dt; if (u.bounce > 2) continue; u.v.y -= 14 * dt; m.position.addScaledVector(u.v, dt); m.rotation.x += u.w.x * dt; m.rotation.z += u.w.z * dt;
      const fy = World.floorAt(m.position.x, m.position.z) + 0.012; if (m.position.y < fy) { m.position.y = fy; u.v.y *= -0.35; u.v.x *= 0.5; u.v.z *= 0.5; u.w.multiplyScalar(0.5); u.bounce++; if (u.bounce === 1 && Math.hypot(m.position.x - Sfx.listener.x, m.position.z - Sfx.listener.z) < 6) Sfx.play('bounce', m.position, { vol: 0.15 }); if (u.bounce > 2) m.rotation.set(Math.PI / 2, 0, rand(0, TAU)); } }
    for (const m of this.shells.filter(m => m.userData.t > 6)) this.scene.remove(m); this.shells = this.shells.filter(m => m.userData.t <= 6);
    for (const r of this.rings) { r.userData.t += dt; const k = r.userData.t / 0.45; r.scale.setScalar(1 + k * 22); r.material.opacity = Math.max(0, 1 - k); }
    for (const r of this.rings.filter(r => r.userData.t > 0.45)) { this.scene.remove(r); r.geometry.dispose(); r.material.dispose(); } this.rings = this.rings.filter(r => r.userData.t <= 0.45);
    for (const s of this.scorch) { const age = t - s.userData.t0; if (age > 40) s.material.opacity = Math.max(0, 1 - (age - 40) / 10); }
    if (this.motes && Game.camera) { const c = Game.camera.position, a = this.motes.geometry.attributes.position, arr = a.array;
      for (let i = 0; i < arr.length; i += 3) { arr[i] += Math.sin(t * 0.3 + i) * dt * 0.2 + dt * 0.15; arr[i + 1] += Math.sin(t * 0.5 + i * 0.7) * dt * 0.1; arr[i + 2] += Math.cos(t * 0.4 + i) * dt * 0.2;
        for (const [k, R] of [[0, 20], [1, 8], [2, 20]]) { const cc = k === 0 ? c.x : k === 1 ? c.y : c.z; if (arr[i + k] - cc > R) arr[i + k] -= 2 * R; else if (cc - arr[i + k] > R) arr[i + k] += 2 * R; } }
      a.needsUpdate = true; }
  },
};
const _start33 = Game.start.bind(Game);
Game.start = function (cfg) { const r = _start33(cfg); Candy.setup(this.scene); return r; };
const _gupdate33 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate33(dt); if (this.running) { Candy.update(dt); Bubble.update(); } };
/* brass and muzzle light */
const _fire33 = fireWeapon;
fireWeapon = function (s, now, rc) {
  const r = _fire33(s, now, rc);
  if (r && s.w && Game.camera && !s.vehicle) {
    const d = Game.camera.position.distanceTo(s.pos), T = s.w.type;
    if (d < 45 && T !== 'knife' && T !== 'launcher' && T !== 'bow' && !s.w.projectile) { const e = s.eye(new V3()).addScaledVector(s.forward(new V3()), 0.9); Candy.light(e, 9, 9, 0.06); }
    if (d < 25 && T !== 'knife' && T !== 'launcher' && T !== 'bow' && T !== 'shotgun' && !s.w.projectile) Candy.shell(s);
  }
  return r;
};
const _fxExp33 = FX.explosion.bind(FX);
FX.explosion = function (p) { _fxExp33(p); try { Candy.boom(p); } catch (e) { /* cosmetic */ } };
/* footstep dust on loose ground */
const _sfxPlay33 = Sfx.play.bind(Sfx);
Sfx.play = function (type, pos, opt) {
  if (type === 'step' && pos && Game.running) {
    const gt = World._groundTex, col = gt === 'sand' ? [0.78, 0.68, 0.5] : gt === 'snow' ? [0.95, 0.97, 1] : gt === 'grass' ? null : null;
    if (col && Math.abs(pos.y - World.floorAt(pos.x, pos.z)) < 0.2 && !(typeof inWater === 'function' && inWater(pos.x, pos.z))) FX.emit('norm', pos.x, pos.y + 0.05, pos.z, 4, 0.6, col, 0.6, -1.5, 0.4);
  }
  return _sfxPlay33(type, pos, opt);
};
