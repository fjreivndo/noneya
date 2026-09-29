/* ═══════════════════════════════════════════════════════════════════════════
   Garage (v2.8).
   · Vehicles now spawn in Team Deathmatch and Zombies on maps that have
     them (the bases used to stand empty there).
   · Player-only vehicles: at each base one jeep, one motorbike and one
     attack helicopter are marked PLAYERS ONLY. Bots leave them alone.
   · Cars and jeeps have interiors: seats for everyone, a dashboard, a
     steering wheel that turns, and real see-through windows. C switches the
     driver between the chase camera and the view from the seat.
   · Armory: "Apply to all guns" copies the current gun's attachments to
     every gun they fit, and cases get "Open all" (per case and for
     everything at once).
   · Crate keys for the five newest cases had no price (it said
     "undefined"). Fixed.
   · Saving: progress is also saved when you close or refresh the page
     (including credits and XP for a match in progress), a full storage is
     cleared of old sandbox saves instead of silently failing, and
     Settings → Save data can export and import your progress. A warning
     shows when the browser won't let the page save at all.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── key prices for every case ─────────────────────────────────────────── */
Object.assign(KEY_PRICE, { venom: 900, royal: 1000, storm: 900, wasteland: 950, midnight: 1000 });
for (const c of CASES) if (!(KEY_PRICE[c.id] > 0)) KEY_PRICE[c.id] = Math.round(c.price * 2.1 / 50) * 50;

/* ── vehicles in more modes ────────────────────────────────────────────── */
MODES.tdm.vehicles = true; if (MODES.zombies) MODES.zombies.vehicles = true;

/* ── player-only vehicles ──────────────────────────────────────────────── */
const _militaryBase39 = militaryBase;
militaryBase = function (team, style) {
  const had = new Set(World.vehicleSpawns); _militaryBase39(team, style);
  const mine = World.vehicleSpawns.filter(v => !had.has(v) && v.team === team), pickOne = f => { const v = mine.find(f); if (v) v.playerOnly = true; };
  pickOne(v => !v.kind && v.x === 35); pickOne(v => v.kind === 'bike' && v.x === 50); pickOne(v => v.kind === 'attackheli' && v.x === -36);
};
function playerOnlyTag(v) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
  c.fillStyle = 'rgba(20,18,10,.78)'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#ffcc33'; c.fillRect(0, 0, 256, 6); c.fillRect(0, 58, 256, 6);
  c.font = 'bold 30px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PLAYERS ONLY', 128, 33);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set(2.4, 0.6, 1); sp.position.y = (v.K.bh || 1.6) + 1.1; sp.userData.noShadow = true; v.model.add(sp); v.model.userData.poTag = sp;
  // yellow stripes on ground vehicles so it reads from a distance too
  if (v.K.type) return; const y = lam('#ffcc33'), L = (v.K.br || 1.1) * 2 + 0.04, h = v.kind === 'bike' ? 0.72 : 1.0;
  v.model.add(bx(L, 0.06, 0.2, y, 0, h, -0.8)); v.model.add(bx(L, 0.06, 0.2, y, 0, h, 0.8));
}
/* belt and braces: if anything hands one to a bot, take it back */
const _aiUpdate39 = AI.update.bind(AI);
AI.update = function (dt) {
  _aiUpdate39(dt);
  for (const v of Game.vehicles) {
    if (!v.spawn.playerOnly) continue;
    if (v.crew && v.crew.ctrl === 'bot') { if (v.crew.brain && v.crew.brain.crew === v) v.crew.brain.crew = null; v.crew = null; }
    if (v.driver && v.driver.ctrl === 'bot' && Game.authority()) Game.exitVehicle(v.driver);
  }
};

/* ── car and jeep interiors ────────────────────────────────────────────── */
const GLASS = new THREE.MeshStandardMaterial({ color: 0xa8cce0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide });
function steeringWheel(x, y, z) {
  const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.x = -1.1;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 6, 20), lam('#1a1a1a')); w.add(rim);
  w.add(bx(0.3, 0.035, 0.03, lam('#222'))); w.add(bx(0.035, 0.17, 0.03, lam('#222'), 0, -0.085, 0));
  w.add(vcyl(0.035, 0.05, lam('#333'), 0, 0, 0.02));
  return w;
}
function carSeat(x, y, z, col, wide) {
  const s = new THREE.Group(), m = lam(col);
  s.add(bx(wide || 0.5, 0.14, 0.5, m, 0, 0, 0)); const back = bx(wide || 0.5, 0.6, 0.12, m, 0, 0.3, 0.25); back.rotation.x = -0.12; s.add(back);
  if (!wide) s.add(bx(0.3, 0.16, 0.1, m, 0, 0.68, 0.3));   // headrest
  s.position.set(x, y, z); return s;
}
function buildJeep39(team) {
  const g = new THREE.Group(), C = lam(team === 'CT' ? '#44556a' : '#6a5a3a'), Dk = lam(team === 'CT' ? '#35434f' : '#524630'), D = lam('#1a1a1a'), M = lam('#555'), In = '#2c2c2a';
  // tub, hood, fenders
  g.add(bx(2.0, 0.45, 4.0, C, 0, 0.68, 0));
  g.add(bx(0.1, 0.35, 2.6, C, -0.95, 1.08, 0.55)); g.add(bx(0.1, 0.35, 2.6, C, 0.95, 1.08, 0.55)); g.add(bx(1.9, 0.35, 0.1, C, 0, 1.08, 1.95));   // tub walls
  g.add(bx(1.9, 0.42, 1.5, C, 0, 1.12, -1.25));   // hood
  g.add(bx(1.8, 0.05, 2.5, Dk, 0, 0.93, 0.6));   // floor
  // windshield: frame and glass
  g.add(bx(1.9, 0.07, 0.07, M, 0, 1.92, -0.78)); g.add(bx(0.07, 0.62, 0.07, M, -0.92, 1.6, -0.78)); g.add(bx(0.07, 0.62, 0.07, M, 0.92, 1.6, -0.78));
  g.add(bx(1.78, 0.55, 0.02, GLASS, 0, 1.6, -0.78));
  // roll bar
  g.add(bx(0.07, 0.8, 0.07, M, -0.92, 1.5, 0.95)); g.add(bx(0.07, 0.8, 0.07, M, 0.92, 1.5, 0.95)); g.add(bx(1.9, 0.07, 0.07, M, 0, 1.9, 0.95));
  // inside: dashboard, gauges, wheel, stick, seats, rear bench
  g.add(bx(1.8, 0.24, 0.3, lam(In), 0, 1.25, -0.62));
  for (const x of [-0.58, -0.35]) g.add(bx(0.12, 0.12, 0.02, lam('#d8e0e8'), x, 1.3, -0.46));
  const wheel = steeringWheel(-0.45, 1.3, -0.36); g.add(wheel);
  g.add(bx(0.05, 0.25, 0.05, lam('#222'), 0.02, 1.08, 0.2)); g.add(bx(0.08, 0.08, 0.08, lam('#111'), 0.02, 1.22, 0.2));
  g.add(carSeat(-0.45, 1.02, 0.35, In)); g.add(carSeat(0.45, 1.02, 0.35, In)); g.add(carSeat(0, 1.02, 1.45, In, 1.6));
  const wheels = [];
  [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), D); w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); wheels.push(w); });
  g.add(bx(0.4, 0.3, 0.3, lam('#ffffaa'), -0.6, 0.85, -2.0)); g.add(bx(0.4, 0.3, 0.3, lam('#ffffaa'), 0.6, 0.85, -2.0));
  g.userData.wheels = wheels; g.userData.paint = C; g.userData.steerWheel = wheel;
  return g;
}
function buildCar39(team) {
  const g = new THREE.Group(), C = lam(team === 'T' ? '#8a3a2a' : '#2a5a9a'), D = lam('#1a1a1a'), M = lam('#c8c8c8'), In = '#3a3632', Sc = '#5a5048';
  // lower body with a floor pan, hood and boot
  g.add(bx(1.9, 0.4, 4.3, C, 0, 0.55, 0)); g.add(bx(1.8, 0.04, 2.3, lam(In), 0, 0.77, 0.25));
  g.add(bx(1.9, 0.18, 1.25, C, 0, 0.84, -1.52)); g.add(bx(1.9, 0.18, 0.9, C, 0, 0.84, 1.7));
  // doors: low side panels you can see over
  g.add(bx(0.08, 0.42, 2.3, C, -0.91, 0.95, 0.25)); g.add(bx(0.08, 0.42, 2.3, C, 0.91, 0.95, 0.25));
  g.add(bx(0.02, 0.3, 2.2, lam(In), -0.86, 0.97, 0.25)); g.add(bx(0.02, 0.3, 2.2, lam(In), 0.86, 0.97, 0.25));
  // pillars and roof
  const P = (x, z, tilt) => { const p = bx(0.08, 0.6, 0.08, C, x, 1.45, z); p.rotation.x = tilt; g.add(p); };
  for (const x of [-0.86, 0.86]) { P(x, -0.72, -0.45); P(x, 0.28, 0); P(x, 1.27, 0.4); }
  g.add(bx(1.8, 0.07, 1.75, C, 0, 1.77, 0.28)); g.add(bx(1.7, 0.02, 1.65, lam('#6a665e'), 0, 1.73, 0.28));   // roof and headliner
  // glass: windshield, rear window, four side windows
  const ws = bx(1.66, 0.7, 0.02, GLASS, 0, 1.44, -0.72); ws.rotation.x = -0.55; g.add(ws);
  const rw = bx(1.66, 0.6, 0.02, GLASS, 0, 1.45, 1.3); rw.rotation.x = 0.5; g.add(rw);
  for (const x of [-0.9, 0.9]) for (const z of [-0.22, 0.78]) g.add(bx(0.02, 0.55, 0.9, GLASS, x, 1.45, z));
  // interior
  g.add(bx(1.7, 0.26, 0.35, lam(In), 0, 1.07, -0.72)); g.add(bx(1.6, 0.03, 0.2, lam('#222'), 0, 1.21, -0.68));
  for (const x of [-0.55, -0.35]) g.add(bx(0.12, 0.12, 0.02, lam('#d8e0e8'), x, 1.13, -0.54));
  const wheel = steeringWheel(-0.45, 1.13, -0.4); g.add(wheel);
  g.add(bx(0.2, 0.3, 0.9, lam(In), 0, 0.92, -0.05));   // centre console
  g.add(carSeat(-0.45, 0.85, 0.1, Sc)); g.add(carSeat(0.45, 0.85, 0.1, Sc)); g.add(carSeat(0, 0.85, 1.05, Sc, 1.6));
  // trim and lights
  g.add(bx(1.95, 0.12, 0.2, M, 0, 0.45, -2.16)); g.add(bx(1.95, 0.12, 0.2, M, 0, 0.45, 2.16));
  g.add(bx(0.36, 0.14, 0.05, lam('#ffffcc'), -0.62, 0.72, -2.16)); g.add(bx(0.36, 0.14, 0.05, lam('#ffffcc'), 0.62, 0.72, -2.16)); g.add(bx(0.36, 0.12, 0.05, lam('#c01818'), -0.62, 0.74, 2.16)); g.add(bx(0.36, 0.12, 0.05, lam('#c01818'), 0.62, 0.74, 2.16));
  const wheels = [];
  [[-0.9, -1.35], [0.9, -1.35], [-0.9, 1.35], [0.9, 1.35]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12), D); w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); wheels.push(w); });
  g.userData.wheels = wheels; g.userData.paint = C; g.userData.steerWheel = wheel;
  return g;
}
VKIND.jeep.build = buildJeep39; VKIND.jeep.interior = true;
VKIND.car.build = buildCar39; VKIND.car.interior = true; VKIND.car.seatY = 1.45;
/* the view from the seat: C switches it for the driver */
if (Settings.carView == null) Settings.carView = 'chase';
const _pcam39 = Player.camera;
Player.camera = function (s, dt) {
  const v = s.vehicle;
  if (s.alive && v && v.driver === s && v.K.interior && Settings.carView === 'seat') {
    const V = Game.view, cam = Game.camera; V.third = false;
    cam.position.copy(s.eye(new V3())); cam.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    cam.fov = Settings.fov; cam.updateProjectionMatrix(); return;
  }
  return _pcam39.call(this, s, dt);
};
addEventListener('keydown', e => {
  if (e.code !== 'KeyC' || !Game.running || Input.typing) return;
  const L = Game.local, v = L && L.vehicle; if (!v || v.driver !== L || !v.K.interior) return;
  Settings.carView = Settings.carView === 'seat' ? 'chase' : 'seat'; saveSettings();
  HUD.center(Settings.carView === 'seat' ? 'Driver\'s seat view · C to switch' : 'Chase camera · C to switch', 1);
});
const _vehicleHint39 = vehicleHint;
vehicleHint = function (L) { const h = _vehicleHint39(L), v = L.vehicle; let out = h; if (v && v.driver === L && v.K.interior) out += ' · C camera'; if (v && v.spawn.playerOnly) out = 'PLAYERS ONLY · ' + out; return out; };

/* ── per match ─────────────────────────────────────────────────────────── */
const _start39 = Game.start.bind(Game);
Game.start = function (cfg) {
  const r = _start39(cfg);
  for (const v of this.vehicles) if (v.spawn.playerOnly) playerOnlyTag(v);
  MatchSave.done = false; return r;
};
const _gupdate39 = Game.update.bind(Game);
Game.update = function (dt) {
  _gupdate39(dt); if (!this.running) return;
  const L = this.local;
  for (const v of this.vehicles) {
    const u = v.model.userData;
    if (u.steerWheel) u.steerWheel.rotation.z = -(v.steer || 0) * 2.2;
    if (u.poTag) u.poTag.visible = v.alive && !v.driver && !!L && dist2(L.pos.x, L.pos.z, v.pos.x, v.pos.z) < 45;
  }
};

/* ── armory: apply attachments to every gun, open every case ───────────── */
const _gs39 = UI.renderGunsmith;
UI.renderGunsmith = function (body) {
  _gs39.call(this, body);
  const c = body.querySelector('.gscenter'); if (!c) return;
  const row = document.createElement('div'); row.className = 'row gs-all';
  row.innerHTML = '<button class="btn small" id="gsAll">Apply to all guns</button><span class="muted">Copies these attachments to every gun they fit. Slots set to None are cleared.</span>';
  c.appendChild(row);
  row.querySelector('#gsAll').onclick = () => {
    const d = Inv.data, wid = this.gsWeapon, src = d.attach[wid] || {}; let n = 0;
    if (!confirm(`Put ${WEAPONS[wid].name}'s attachments on every gun they fit?`)) return;
    for (const w of Object.values(WEAPONS)) {
      if (!w.mag || w.type === 'launcher' || w.id === wid || w.hidden) continue;
      const dst = d.attach[w.id] || (d.attach[w.id] = {}); let changed = false;
      for (const k of ATT_SLOTS) {
        const a = src[k];
        if (a) { if (attachAllowed(w.id, a) && dst[k] !== a) { dst[k] = a; changed = true; } }
        else if (dst[k] && Object.keys(ATTACH).some(x => ATTACH[x].slot === k && attachAllowed(wid, x))) { delete dst[k]; changed = true; }
      }
      if (changed) n++;
    }
    Inv.save(); Sfx.play('buy'); this.toast(n ? `Updated ${n} gun${n > 1 ? 's' : ''}` : 'Every gun already matches'); this.renderGunsmith(body);
  };
};
UI.openMany = function (ids) {
  const d = Inv.data, got = [];
  for (const id of ids) while (d.cases[id] > 0 && Inv.keysFor(id) > 0 && got.length < 500) { Inv.useKey(id); d.cases[id]--; d.stats.opened++; const it = rollCase(id); d.items.push(it); got.push(it); }
  if (!got.length) return this.toast('No cases you have keys for');
  Inv.save();
  got.sort((a, b) => SKINS[b.skinId].rarity - SKINS[a.skinId].rarity);
  const best = RARITY[SKINS[got[0].skinId].rarity], value = got.reduce((a, it) => a + Inv.value(it), 0);
  const m = $('modal'); m.classList.add('open');
  m.innerHTML = `<div class="mbox openall" style="--rc:${best.color}"><h2>Opened ${got.length} case${got.length > 1 ? 's' : ''}</h2><div class="muted">Best: <b style="color:${best.color}">${best.name}</b> · total value ₵${value.toLocaleString()}</div>
    <div class="grid oa-grid">${got.map(it => this.itemCard(it)).join('')}</div><div class="row"><button class="btn" id="oaClose">Nice</button></div></div>`;
  this.paintCards(m); m.querySelectorAll('.card[data-u]').forEach(c => c.onclick = () => this.inspect(Inv.byUid(c.dataset.u)));
  $('oaClose').onclick = () => { this.closeModal(); this.render_armory(); };
  Sfx.play(SKINS[got[0].skinId].rarity >= 5 ? 'win' : 'buy');
};
const _cases39 = UI.renderCases;
UI.renderCases = function (body) {
  _cases39.call(this, body);
  const d = Inv.data, n = id => Math.min(d.cases[id] || 0, Inv.keysFor(id));
  body.querySelectorAll('[data-open]').forEach(b => {
    const id = b.dataset.open, k = n(id); if (k < 2) return;
    const x = document.createElement('button'); x.className = 'btn ghost'; x.textContent = `Open all (${k})`; x.onclick = () => this.openMany([id]); b.after(x);
  });
  const total = CASES.reduce((a, c) => a + n(c.id), 0), bar = body.querySelector('.bar.keys');
  if (bar && total > 1) { const x = document.createElement('button'); x.className = 'btn small'; x.textContent = `Open every case (${total})`; x.title = 'Uses case keys first, then master keys'; x.onclick = () => this.openMany(CASES.map(c => c.id)); bar.prepend(x); }
};

/* ── saving that sticks ────────────────────────────────────────────────── */
const Persist = {
  ok: true, warned: false,
  test() { try { const k = 'bp__probe'; localStorage.setItem(k, '1'); const r = localStorage.getItem(k) === '1'; localStorage.removeItem(k); return r; } catch (e) { return false; } },
  /* free space by dropping the oldest sandbox saves, never your inventory */
  prune() {
    try {
      const list = Store.get('sbx_saves', []); if (!list.length) return false;
      const drop = list.slice(Math.max(1, Math.floor(list.length / 2)));
      for (const s of drop) localStorage.removeItem('bp_sbx_save_' + s.id);
      localStorage.setItem('bp_sbx_saves', JSON.stringify(list.slice(0, list.length - drop.length))); return true;
    } catch (e) { return false; }
  },
  keys() { const out = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('bp_')) out[k] = localStorage.getItem(k); } } catch (e) { /* no storage */ } return out; },
  exportFile() {
    const data = { game: 'breachpoint', v: VERSION, at: new Date().toISOString(), keys: this.keys() };
    if (!data.keys.bp_inv && Inv.data) data.keys.bp_inv = JSON.stringify(Inv.data);
    if (!data.keys.bp_settings) data.keys.bp_settings = JSON.stringify(Settings);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = `breachpoint-save-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },
  importFile(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result); if (!data || data.game !== 'breachpoint' || !data.keys || !data.keys.bp_inv) throw new Error('not a Breachpoint save');
        if (!confirm(`Load this save from ${String(data.at || '').slice(0, 10)}? It replaces your current progress.`)) return;
        for (const k in data.keys) if (k.startsWith('bp_')) localStorage.setItem(k, data.keys[k]);
        location.reload();
      } catch (e) { UI.toast('That file isn\'t a Breachpoint save'); }
    };
    r.readAsText(file);
  },
};
Store.set = function (k, v) {
  const s = JSON.stringify(v);
  try { localStorage.setItem('bp_' + k, s); return true; }
  catch (e) {
    if (Persist.prune()) { try { localStorage.setItem('bp_' + k, s); UI.toast && UI.toast('Storage was full: cleared your oldest sandbox saves to keep your progress'); return true; } catch (e2) { /* still full */ } }
    if (!Persist.warned) { Persist.warned = true; setTimeout(() => UI.toast && UI.toast('Couldn\'t save progress: browser storage is full or blocked. Settings → Export save to keep a copy.', 6000), 50); }
    return false;
  }
};
Persist.ok = Persist.test();
/* StatTrak counts save right away */
const _addKill39 = Inv.addKill.bind(Inv);
Inv.addKill = function (w) { _addKill39(w); clearTimeout(this._st); this._st = setTimeout(() => this.save(), 1500); };
/* leaving mid-match still pays out the basics */
const MatchSave = {
  done: false,
  flush() {
    const G = Game, L = G.local;
    if (G.running && L && !G.finished && !this.done && G.mode && G.mode.id !== 'sandbox' && (L.kills || L.assists || L.score)) {
      this.done = true; const D = Inv.data;
      D.credits += 20 + L.kills * 8 + L.assists * 3; D.stats.kills += L.kills; D.stats.deaths += L.deaths;
      Inv.addXp(Math.round(60 + L.kills * 30 + L.assists * 12 + Math.max(0, L.score) * 2));
    }
    if (Inv.data) Inv.save(); saveSettings();
  },
};
addEventListener('pagehide', () => MatchSave.flush());
addEventListener('beforeunload', () => MatchSave.flush());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && Inv.data) Inv.save(); });
const _finish39 = Game.finishMatch.bind(Game);
Game.finishMatch = function (w) { if (MatchSave.done) { this.matchOver = true; return; } return _finish39(w); };
/* Settings → Save data */
const _rs39 = UI.render_settings;
UI.render_settings = function () {
  _rs39.call(this);
  const f = $('setForm'); if (!f) return;
  const box = document.createElement('div'); box.className = 'savebox';
  box.innerHTML = `<h3>Save data</h3><p class="muted">${Persist.ok ? 'Progress saves in this browser automatically. Export a copy to move it to another browser or computer, or to keep it safe.' : '<b style="color:#ff9a4a">This browser isn\'t letting the page save</b> (a private window, an embedded preview, or blocked site data). Progress is lost when you refresh. Open the HTML file directly in Chrome or Edge, and export your save before closing.'}</p>
    <div class="row"><button class="btn small" id="svExport">Export save</button><label class="btn small ghost">Import save<input type="file" id="svImport" accept=".json,application/json" hidden></label></div>`;
  f.after(box); const old = f.parentElement.querySelectorAll('.savebox'); if (old.length > 1) old[0].remove();
  $('svExport').onclick = () => Persist.exportFile();
  $('svImport').onchange = e => { const file = e.target.files[0]; if (file) Persist.importFile(file); };
};
/* a warning on the menu when saving can't work */
if (!Persist.ok) addEventListener('load', () => {
  const b = document.createElement('div'); b.id = 'saveWarn';
  b.innerHTML = 'This browser won\'t let Breachpoint save, so progress resets when you refresh. Open the file directly in Chrome/Edge, or use Settings → Export save. <button>OK</button>';
  b.querySelector('button').onclick = () => b.remove(); document.body.appendChild(b);
});
