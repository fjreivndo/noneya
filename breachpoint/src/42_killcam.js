/* ═══════════════════════════════════════════════════════════════════════════
   Killcam (v2.9).
   When someone kills you, a second later the last four seconds replay from
   just behind your killer: everyone where they were, every tracer, then the
   shot that got you. Their name, weapon, distance and health show along the
   bottom. Space skips it. The deploy screen comes up when it ends.
   ═══════════════════════════════════════════════════════════════════════════ */
const Killcam = {
  frames: [], shots: [], recT: 0, active: false, t: 0, t0: 0, t1: 0, killer: null, info: null, pendingDeploy: false, replaying: false, el: null, lastShotT: 0,
  record(dt) {
    this.recT -= dt; if (this.recT > 0) return; this.recT = 0.1;
    const S = [], V = [];
    for (const s of Game.soldiers) if (s.alive) S.push([s.id, s.pos.x, s.pos.y, s.pos.z, s.yaw, s.pitch, s.vehicle ? s.vehicle.id : null]);
    for (const v of Game.vehicles) if (v.alive) V.push([v.id, v.pos.x, v.pos.y, v.pos.z, v.yaw]);
    this.frames.push({ t: Game.now, S, V });
    while (this.frames.length && this.frames[0].t < Game.now - 7) this.frames.shift();
    while (this.shots.length && this.shots[0].t < Game.now - 7) this.shots.shift();
  },
  start(ev) {
    const L = Game.local, a = Game.byId(ev.a); if (!a || a === L || !this.frames.length) return;
    const tk = Game.now;
    setTimeout(() => {
      if (!Game.running || Game.local !== L || L.alive || Game.matchOver) return;
      this.active = true; this.killer = a.id; this.t0 = Math.max(this.frames[0].t, tk - 4); this.t1 = tk + 0.5; this.t = this.t0; this.lastShotT = this.t0;
      const d = Math.round(Math.hypot(a.pos.x - L.pos.x, a.pos.z - L.pos.z)), w = WEAPONS[ev.w] ? WEAPONS[ev.w].name : VKIND[ev.w] ? VKIND[ev.w].name : ev.w === 'zombie' ? 'Teeth' : String(ev.w || '');
      this.info = { name: a.name, team: a.team, w, d, hs: ev.hs, hp: Math.max(0, Math.round(a.hp)) };
      this.show(true);
    }, 1000);
  },
  stop() {
    if (!this.active) return; this.active = false; this.show(false);
    for (const v of Game.vehicles) { v.model.visible = v.alive; v.model.position.copy(v.pos); v.model.rotation.y = v.yaw; }
    if (this.pendingDeploy) { this.pendingDeploy = false; if (Game.running && Game.local && !Game.local.alive && !Game.matchOver) HUD.showDeploy(true); }
  },
  show(on) {
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'killcam'; document.body.appendChild(this.el); }
    this.el.style.display = on ? '' : 'none'; if (!on) return;
    const I = this.info, col = TEAM_STYLE[I.team] ? TEAM_STYLE[I.team].color : '#ddd';
    this.el.innerHTML = `<div class="kc-bar kc-top"><b>KILLCAM</b></div><div class="kc-bar kc-bot"><span class="kc-name" style="color:${col}">${escapeHtml(I.name)}</span><span>${escapeHtml(I.w)}${I.hs ? ' · headshot' : ''}</span><span>${I.d} m</span><span>${I.hp} HP left</span><small>Space to skip</small></div>`;
  },
  frameAt(t) {
    const F = this.frames; let i = 0; while (i < F.length - 1 && F[i + 1].t < t) i++;
    const a = F[i], b = F[Math.min(i + 1, F.length - 1)], k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    return { a, b, k };
  },
  /* after the live update: pose everyone from the recording and aim the camera */
  play(dt) {
    this.t += dt; if (this.t >= this.t1) return this.stop();
    const { a, b, k } = this.frameAt(this.t), mapB = new Map(b.S.map(r => [r[0], r])), seen = new Set();
    for (const r of a.S) {
      const s = Game.byId(r[0]); if (!s || !s.model) continue; const r2 = mapB.get(r[0]) || r; seen.add(s);
      s.model.visible = true; s.model.position.set(lerp(r[1], r2[1], k), lerp(r[2], r2[2], k), lerp(r[3], r2[3], k));
      s.model.rotation.y = r[4] + angDiff(r[4], r2[4]) * k;
    }
    for (const s of Game.soldiers) if (s.model && !seen.has(s) && s.team !== 'D') s.model.visible = false;
    const vB = new Map(b.V.map(r => [r[0], r]));
    for (const r of a.V) { const v = Game.vehicles.find(x => x.id === r[0]); if (!v) continue; const r2 = vB.get(r[0]) || r; v.model.visible = true; v.model.position.set(lerp(r[1], r2[1], k), lerp(r[2], r2[2], k), lerp(r[3], r2[3], k)); v.model.rotation.y = r[4] + angDiff(r[4], r2[4]) * k; }
    // tracers fired during this slice
    this.replaying = true;
    for (const sh of this.shots) if (sh.t > this.lastShotT && sh.t <= this.t) { FX.tracer(new V3(...sh.o), new V3(...sh.e), sh.c); FX.muzzle(new V3(...sh.o)); }
    this.replaying = false; this.lastShotT = this.t;
    // camera: over the killer's shoulder, looking where they looked
    const ka = a.S.find(r => r[0] === this.killer), kb = b.S.find(r => r[0] === this.killer) || ka; if (!ka) return;
    const x = lerp(ka[1], kb[1], k), y = lerp(ka[2], kb[2], k) + (ka[6] ? 2.2 : 1.55), z = lerp(ka[3], kb[3], k), yaw = ka[4] + angDiff(ka[4], kb[4]) * k, pitch = lerp(ka[5], kb[5], k);
    const f = new V3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)), r = new V3(Math.cos(yaw), 0, -Math.sin(yaw));
    const eye = new V3(x, y, z), back = new V3(-f.x, 0, -f.z).normalize().multiplyScalar(ka[6] ? 7 : 2.3).add(r.clone().multiplyScalar(0.55)).add(new V3(0, ka[6] ? 1.6 : 0.45, 0));
    const len = back.length(), dir = back.clone().normalize(), hit = World.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, len);
    const cam = Game.camera; cam.position.copy(eye).addScaledVector(dir, hit >= 0 ? Math.max(0.3, hit - 0.2) : len);
    cam.lookAt(eye.clone().addScaledVector(f, 25)); Game.view.third = true;
    const km = Game.byId(this.killer); if (km && km.model) km.model.visible = true;
  },
};
/* record tracers (live ones, not the replayed ones) */
const _tracer42 = FX.tracer.bind(FX);
FX.tracer = function (o, e, c) { if (Game.running && !Killcam.replaying) Killcam.shots.push({ t: Game.now, o: [o.x, o.y, o.z], e: [e.x, e.y, e.z], c }); return _tracer42(o, e, c); };
const _onKill42 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  _onKill42(ev);
  const L = this.local; if (!L || ev.v !== L.id || !ev.a || ev.a === L.id || !this.mode || this.mode.id === 'sandbox' || Settings.killcam === false) return;
  Killcam.start(ev);
};
const _showDeploy42 = HUD.showDeploy.bind(HUD);
HUD.showDeploy = function (on) { if (on && Killcam.active) { Killcam.pendingDeploy = true; return; } return _showDeploy42(on); };
const _gupdate42 = Game.update.bind(Game);
Game.update = function (dt) {
  _gupdate42(dt); if (!this.running) { if (Killcam.active) Killcam.stop(); return; }
  if (Killcam.active) { if (this.local && this.local.alive) Killcam.stop(); else Killcam.play(dt); }
  Killcam.record(dt);
};
const _start42 = Game.start.bind(Game);
Game.start = function (cfg) { Killcam.frames = []; Killcam.shots = []; Killcam.active = false; if (Killcam.el) Killcam.el.style.display = 'none'; return _start42(cfg); };
addEventListener('keydown', e => { if (Killcam.active && (e.code === 'Space' || e.code === 'Escape')) { e.preventDefault(); e.stopImmediatePropagation(); Killcam.stop(); } }, true);
if (Settings.killcam == null) Settings.killcam = true;
