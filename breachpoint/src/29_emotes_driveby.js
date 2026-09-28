/* ═══════════════════════════════════════════════════════════════════════════
   Emotes and drive-by shooting.
   · Hold N (or B outside Defuse) for the emote wheel: move the mouse toward
     one, or press 1–8, and let go. Wave, salute, cheer, dance, point, clap,
     flex, facepalm. The camera swings round so you can watch; moving or
     shooting stops it. Everyone sees it in multiplayer. Bots emote after
     kills when it's safe, and celebrate round and match wins.
   · Shooting while driving: in cars, jeeps, bikes, quads and boats the mouse
     orbits the camera and LMB fires your hand weapon (R reloads). Faster
     driving means less accuracy.
   ═══════════════════════════════════════════════════════════════════════════ */
const EMOTES = [
  { k: 'wave', name: 'Wave', icon: '👋', dur: 2.4 }, { k: 'salute', name: 'Salute', icon: '🫡', dur: 2.2 },
  { k: 'cheer', name: 'Cheer', icon: '🙌', dur: 2.8 }, { k: 'dance', name: 'Dance', icon: '💃', dur: 6 },
  { k: 'point', name: 'Point', icon: '👉', dur: 2 }, { k: 'clap', name: 'Clap', icon: '👏', dur: 2.8 },
  { k: 'flex', name: 'Flex', icon: '💪', dur: 2.6 }, { k: 'facepalm', name: 'Facepalm', icon: '🤦', dur: 2.4 },
];
const EMOTE_BY = Object.fromEntries(EMOTES.map(e => [e.k, e]));
const Emote = {
  start(s, k, remote) {
    if (!s || !s.alive || s.vehicle || s.downed || !EMOTE_BY[k]) return;
    s.emote = { k, t0: Game.now, dur: EMOTE_BY[k].dur };
    if (remote) return;
    if (Net.role === 'host') Net.event({ t: 'emote', id: s.id, k });
    else if (Net.role === 'client' && s.ctrl === 'local') Net.send({ t: 'emote', k });
  },
  stop(s) { if (s && s.emote) { s.emote = null; const u = s.model && s.model.userData; if (u && u.gunMount) u.gunMount.visible = true; } },
  /* the poses; t = seconds into the emote */
  pose(u, k, t) {
    const aL = u.armL, aR = u.armR, S = Math.sin, down = -1.45;
    for (const a of [aL, aR]) if (a && a.rotation.order !== 'ZXY') a.rotation.order = 'ZXY';
    u.arms.rotation.x = 0; u.upper.rotation.x = 0; u.head.rotation.x = 0;
    if (aL) aL.rotation.set(down, 0, -0.08); if (aR) aR.rotation.set(down, 0, 0.08);
    if (!aL || !aR) return;
    switch (k) {
      case 'wave': aR.rotation.set(2.7, 0, -0.25 + S(t * 9) * 0.45); u.head.rotation.z = S(t * 3) * 0.08; break;
      case 'salute': aR.rotation.set(1.95, 0, 1.05); u.upper.rotation.x = -0.05; u.head.rotation.x = -0.05; break;
      case 'cheer': { const p = S(t * 8) * 0.3; aL.rotation.set(2.75 + p, 0, 0.35); aR.rotation.set(2.75 - p, 0, -0.35); u.body.position.y += Math.abs(S(t * 5)) * 0.22; u.head.rotation.x = -0.3; break; }
      case 'dance': { const b = t * 6; aL.rotation.set(1.3 + S(b) * 1.2, 0, 0.4); aR.rotation.set(1.3 - S(b) * 1.2, 0, -0.4); u.upper.rotation.z = S(t * 3) * 0.3; u.body.rotation.y = S(t * 1.5) * 0.9;
        u.body.position.y += Math.abs(S(b)) * 0.1; u.legL.rotation.x = S(b) * 0.5; u.legR.rotation.x = -S(b) * 0.5; u.head.rotation.z = S(b) * 0.15; break; }
      case 'point': aR.rotation.set(0.15, 0, 0); u.head.rotation.x = -0.05; aL.rotation.set(-0.4, 0, -0.9); break;
      case 'clap': { const c = Math.abs(S(t * 9)); aL.rotation.set(0.2, -0.15 - c * 0.45, 0); aR.rotation.set(0.2, 0.15 + c * 0.45, 0); if (u._clap !== undefined && c < 0.15 && u._clap >= 0.15 && Math.random() < 0.9) this.clapSfx(u); u._clap = c; break; }
      case 'flex': { const f = 0.5 + S(t * 4) * 0.2; aL.rotation.set(0, 1.57, -f); aR.rotation.set(0, -1.57, f); u.upper.rotation.x = -0.12; u.head.rotation.x = -0.2; break; }
      case 'facepalm': aR.rotation.set(1.8, 0, 0.55); u.upper.rotation.x = 0.2; u.head.rotation.x = 0.45; u.head.rotation.y = S(t * 5) * 0.2; break;
    }
  },
  clapSfx(u) { const p = u.head.getWorldPosition(new V3()); Sfx.play('bounce', p, { vol: 0.5 }); },
};
/* animate */
const _sync29 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) {
  const e = this.emote;
  if (e && (!this.alive || this.vehicle || this.downed || Game.now - e.t0 > e.dur || Game.now < e.t0 - 0.5)) Emote.stop(this);
  // someone else's emote ends when they walk off
  if (this.emote && this.ctrl !== 'local' && Math.hypot(this.vel.x, this.vel.z) > 1.2 && Game.now - this.emote.t0 > 0.4) Emote.stop(this);
  const u = this.model && this.model.userData;
  if (u && !this.emote && u.armL && u.armL.rotation.x !== 0 && !this.rag) { u.armL.rotation.set(0, -0.42, 0); u.armR.rotation.set(0, 0.3, 0); u.body.rotation.y = 0; u.head.rotation.y = 0; u.head.rotation.z = 0; u.upper.rotation.z = 0; }
  const r = _sync29.call(this, dt, localTeam, viewer);
  if (this.emote && u && this.model.visible && this.alive) { if (u.gunMount) u.gunMount.visible = false; Emote.pose(u, this.emote.k, Game.now - this.emote.t0); }
  return r;
};

/* ── the wheel ─────────────────────────────────────────────────────────── */
const EmoteWheel = {
  el: null, open: false, key: null, vx: 0, vy: 0, sel: -1,
  build() {
    if (this.el) return; const hud = document.getElementById('hud'); if (!hud) return;
    const el = this.el = document.createElement('div'); el.id = 'emotewheel'; el.className = 'hidden';
    el.innerHTML = `<div class="ew-c">Emotes<br><small>move the mouse · release</small></div>` + EMOTES.map((e, i) => { const a = i / EMOTES.length * TAU - Math.PI / 2;
      return `<div class="ew-i" data-i="${i}" style="left:${50 + Math.cos(a) * 36}%;top:${50 + Math.sin(a) * 36}%"><b>${e.icon}</b><span>${i + 1} ${e.name}</span></div>`; }).join('');
    hud.appendChild(el);
  },
  show(on, key) { this.build(); if (!this.el) return; this.open = on; this.key = key; this.vx = this.vy = 0; this.sel = -1; this.el.classList.toggle('hidden', !on); this.mark(); },
  mark() { if (!this.el) return; this.el.querySelectorAll('.ew-i').forEach(d => d.classList.toggle('on', +d.dataset.i === this.sel)); },
  update(s) {
    const I = Input; this.vx += I.mouse.dx; this.vy += I.mouse.dy; const l = Math.hypot(this.vx, this.vy);
    if (l > 60) { this.vx *= 60 / l; this.vy *= 60 / l; }
    if (l > 18) { let a = Math.atan2(this.vy, this.vx) + Math.PI / 2; a = (a + TAU) % TAU; this.sel = Math.round(a / (TAU / EMOTES.length)) % EMOTES.length; }
    for (let i = 1; i <= EMOTES.length; i++) if (I.hit('Digit' + i)) { this.sel = i - 1; this.pick(s); return; }
    this.mark();
    if (!I.down(this.key)) this.pick(s);
  },
  pick(s) { const i = this.sel; this.show(false); if (i >= 0) Emote.start(s, EMOTES[i].k); },
};
const _pcontrols29 = Player.controls.bind(Player);
Player.controls = function (s, dt) {
  const I = Input;
  if (EmoteWheel.open) { if (!s.alive || s.vehicle) EmoteWheel.show(false); else { s.moveIn.f = s.moveIn.s = 0; EmoteWheel.update(s); return; } }
  const key = I.hit('KeyN') ? 'KeyN' : I.hit('KeyB') && !Game.mode.buy ? 'KeyB' : null;
  if (key && !s.vehicle && !s.downed) { EmoteWheel.show(true, key); return; }
  const e = s.emote, yaw = s.yaw;
  const r = _pcontrols29(s, dt);
  if (e && s.emote) {
    const m = s.moveIn; if (m.f || m.s || m.jump || I.mouse.leftPressed || I.mouse.rightPressed) Emote.stop(s);
    else s.yaw = yaw;   // the mouse orbits the camera instead
  }
  return r;
};
/* watch yourself */
const Emocam = { a: 0, p: -0.25 };
const _pcam29 = Player.camera.bind(Player);
Player.camera = function (s, dt) {
  _pcam29(s, dt);
  if (!s.alive || !s.emote || s.vehicle) { Emocam.a = 0; Emocam.p = -0.25; return; }
  if (!UI.blocking()) { Emocam.a -= Input.mouse.dx * 0.004; Emocam.p = clamp(Emocam.p - Input.mouse.dy * 0.003, -0.9, 0.5); }
  const cam = Game.camera, a = s.yaw + Math.PI + 0.5 + Emocam.a, R = 3.4, cy = s.pos.y + 1.2;
  const c = new V3(s.pos.x - Math.sin(a) * R * Math.cos(Emocam.p), cy - Math.sin(Emocam.p) * R, s.pos.z - Math.cos(a) * R * Math.cos(Emocam.p));
  // don't put the camera inside a wall
  const d = c.clone().sub(new V3(s.pos.x, cy, s.pos.z)), L = d.length(); d.multiplyScalar(1 / L); const t = World.raycast(s.pos.x, cy, s.pos.z, d.x, d.y, d.z, L); if (t >= 0) c.set(s.pos.x + d.x * (t - 0.25), cy + d.y * (t - 0.25), s.pos.z + d.z * (t - 0.25));
  c.y = Math.max(c.y, World.floorAt(c.x, c.z) + 0.3);
  cam.position.copy(c); cam.lookAt(s.pos.x, cy, s.pos.z); Game.view.third = true;
};

/* multiplayer */
const _hostData29 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  if (m && m.t === 'emote') { const p = this.peers.get(id), s = p && p.sid && Game.byId(p.sid); if (s && EMOTE_BY[m.k]) { Emote.start(s, m.k, true); this.event({ t: 'emote', id: s.id, k: m.k }); } return; }
  return _hostData29(id, m);
};
const _applyEvent29 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  if (e && e.t === 'emote') { const s = Game.byId(e.id); if (s && !(s.ctrl === 'local' && s.emote && s.emote.k === e.k)) Emote.start(s, e.k, true); return; }
  return _applyEvent29(e);
};

/* bots */
const _onKill29 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  _onKill29(ev);
  if (!this.authority()) return; const a = this.byId(ev.a), v = this.byId(ev.v);
  if (a && a !== v && a.ctrl === 'bot' && a.brain && chance(0.3)) { a.brain.emoteAt = this.now + rand(0.8, 1.8); a.brain.emoteK = pick(['wave', 'cheer', 'flex', 'point', 'salute', 'clap', 'dance']); }
  if (v && v.emote) Emote.stop(v);
};
function celebrate(team, p) { for (const s of Game.soldiers) if (s.team === team && s.alive && s.ctrl === 'bot' && s.brain && chance(p)) { s.brain.emoteAt = Game.now + rand(0.2, 1.5); s.brain.emoteK = pick(['cheer', 'dance', 'flex', 'clap', 'wave']); } }
const _endRound29 = Game.endRound.bind(Game);
Game.endRound = function (winner, reason) { const r = _endRound29(winner, reason); if (this.authority() && winner) celebrate(winner, 0.6); return r; };
const _endMatch29 = Game.endMatch.bind(Game);
Game.endMatch = function (winner) { const r = _endMatch29(winner); if (this.authority() && winner) celebrate(winner, 1); return r; };
const _brainUpdate29 = Brain.prototype.update;
Brain.prototype.update = function (dt) {
  const s = this.s;
  if (this.emoteAt && Game.now >= this.emoteAt) {
    this.emoteAt = 0; this.senseT = 0; this.sense();
    if (s.alive && !s.vehicle && !s.downed && !(this.target && this.target.alive) && !this.reviving) Emote.start(s, this.emoteK);
  }
  if (s.emote && s.alive) {
    this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.15; this.sense(); }
    if (this.target && this.target.alive || (Game.now - (s.lastDamage || -9)) < 0.3) Emote.stop(s);
    else { const m = s.moveIn; m.f = m.s = 0; m.jump = m.sprint = m.crouch = false; return; }
  }
  return _brainUpdate29.call(this, dt);
};
const _respawn29 = Game.respawn.bind(Game);
Game.respawn = function (s, where) { Emote.stop(s); return _respawn29(s, where); };

/* ── drive-by ──────────────────────────────────────────────────────────── */
function canDriveBy(v) { return v && !v.K.guns && !v.K.turret && v.kind !== 'tank' && v.K.type !== 'heli' && v.K.type !== 'jet'; }
function driveBy(s, v, held) {
  const w = s.w; if (!w || w.type === 'knife' || w.type === 'physgun' || w.type === 'tool' || isNade(s.cur) || w.projectile) return false;
  const want = w.auto ? held : Input.mouse.leftPressed; if (!want) return false;
  const P = aimPoint(s, v), e = s.eye(new V3()), d = P.sub(e), yaw = s.yaw, pitch = s.pitch;
  const j = Math.min(0.06, Math.abs(v.speed) * 0.0025);
  s.yaw = Math.atan2(-d.x, -d.z) + rand(-j, j); s.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) + rand(-j, j);
  const r = fireWeapon(s, Game.now, 0); s.yaw = yaw; s.pitch = pitch; return r;
}
const _vcontrols29 = Vehicle.prototype.controls;
Vehicle.prototype.controls = function (s, I) {
  if (canDriveBy(this) && s.ctrl === 'local') {
    if (I.hit('KeyR')) s.startReload();
    for (const k of [1, 2]) if (I.hit('Digit' + k)) s.switchSlot(k);
    if (I.mouse.left || I.mouse.leftPressed) driveBy(s, this, I.mouse.left);
    return;
  }
  return _vcontrols29.call(this, s, I);
};
/* drivers get the orbit camera and a crosshair, so they can aim */
const _pcam29b = Player.camera;
Player.camera = function (s, dt) {
  const v = s.vehicle;
  if (s.alive && v && v.driver === s && canDriveBy(v)) {
    const V = Game.view, cam = Game.camera, f = s.forward(new V3()), back = v.K.camBack || (v.K.type === 'boat' ? 8 : 7);
    V.third = true; const c = new V3(v.pos.x, v.pos.y + 2.6, v.pos.z).addScaledVector(f, -back); c.y = Math.max(c.y + 0.8, World.floorAt(c.x, c.z) + 1.0);
    cam.position.lerp(c, 1 - Math.exp(-dt * 12)); cam.lookAt(new V3(v.pos.x, v.pos.y + 1.8, v.pos.z).addScaledVector(f, 25));
    cam.fov = Settings.fov; cam.updateProjectionMatrix(); return;
  }
  return _pcam29b.call(this, s, dt);
};
const _hud29 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hud29(dt); const L = Game.local; if (L && L.emote) this.el.xh.classList.add('hidden'); if (!L || !L.alive || !L.vehicle || L.vehicle.driver !== L || !canDriveBy(L.vehicle)) return;
  this.el.xh.classList.remove('hidden');
};
const _vehicleHint29 = vehicleHint;
vehicleHint = function (L) { const h = _vehicleHint29(L), v = L.vehicle; if (v.driver === L && canDriveBy(v)) return h.replace(/ · E exit$/, '') + ` · mouse looks · LMB shoot ${L.w ? L.w.name : ''} · R reload · E exit`; return h; };
/* bullets fired from a seat never hit your own vehicle */
let _shooterVeh = null;
const _fire29 = fireWeapon;
fireWeapon = function (s, now, rc) { _shooterVeh = s.vehicle || null; try { return _fire29(s, now, rc); } finally { _shooterVeh = null; } };
const _rayVeh29 = Game.rayVehicles.bind(Game);
Game.rayVehicles = function (o, d, maxT, skip) { return _rayVeh29(o, d, maxT, skip || _shooterVeh || undefined); };
