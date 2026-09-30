/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Solo setup, Medic class, revives for everyone.
   · The solo Play screen lists every mode the game has (Zombies was missing,
     and the new v3.0 modes appear here too). Modes can add their own rows
     (time of day, mission...) through PLAY_OPTS.
   · Medic: carbine, smokes, a med bag (G heals everyone close) and a
     defibrillator: revives take one second and bring people back at full
     health.
   · Getting downed instead of killed now happens to everyone in the
     respawn modes, bots and solo players included, whenever a teammate is
     around to pick you up. Bots run over and revive their friends (medics
     from further away). Downed? Hold Space to give up and redeploy.
   ═══════════════════════════════════════════════════════════════════════════ */
const MODE_ORDER = ['defuse', 'conquest', 'rush', 'tdm', 'coop', 'royale', 'zombies', 'sandbox'];
const MODE_BLURB = { defuse: 'CS-style rounds, bomb, economy', conquest: 'Battlefield flags, tickets, vehicles', rush: 'Attack sector by sector, or hold the line', tdm: 'Respawns, classes', coop: 'Missions with your squad against bots', royale: 'Last one standing, shrinking zone, loot', zombies: 'Co-op waves of the undead', sandbox: 'Spawn props & NPCs, physgun, toolgun' };
/* extra rows on the Play screen: { key, label, show(cfg), opts(cfg) -> [[value, label, sub]], def } */
const PLAY_OPTS = [];
UI.render_play = function () {
  const c = this.playCfg; if (!MODES[c.mode]) c.mode = 'defuse';
  const M = MODES[c.mode];
  if (!M.maps.includes(c.map)) c.map = M.maps[0];
  const seg = (key, opts) => `<div class="seg" data-k="${key}">${opts.map(([v, l, sub]) => `<button class="${String(c[key]) === String(v) ? 'on' : ''}" data-v="${v}">${l}${sub ? `<small>${sub}</small>` : ''}</button>`).join('')}</div>`;
  const sb = c.mode === 'sandbox', sizes = M.sizes || (c.mode === 'defuse' ? [3, 5] : c.mode === 'conquest' || c.mode === 'rush' ? [8, 12, 16] : [4, 6, 8]);
  if (!sb && sizes.length && !sizes.includes(+c.teamSize)) c.teamSize = sizes[Math.min(1, sizes.length - 1)];
  const modes = MODE_ORDER.filter(m => MODES[m]).concat(Object.keys(MODES).filter(m => !MODE_ORDER.includes(m)));
  const teams = M.noTeam ? '' : `<label>${sb ? 'Your faction (NPCs of it follow you)' : 'Your team'}</label>${seg('team', (sb || M.fixedTeam ? [] : [['auto', 'Auto']]).concat(M.fixedTeam ? [[M.fixedTeam, TEAM_STYLE[M.fixedTeam].name]] : [['CT', 'Aegis', c.mode === 'defuse' ? 'defend' : c.mode === 'rush' ? 'defend' : ''], ['T', 'Vanta', c.mode === 'defuse' || c.mode === 'rush' ? 'attack' : '']]))}`;
  if (M.fixedTeam) c.team = M.fixedTeam;
  let extra = '';
  for (const o of PLAY_OPTS) { if (o.show && !o.show(c)) continue; const opts = o.opts(c); if (!opts.length) continue; if (!opts.some(x => String(x[0]) === String(c[o.key]))) c[o.key] = o.def != null && opts.some(x => String(x[0]) === String(o.def)) ? o.def : opts[0][0]; extra += `<label>${o.label}</label>${seg(o.key, opts)}`; }
  $('playForm').innerHTML = `
    <label>Mode</label>${seg('mode', modes.map(m => [m, MODES[m].name, MODE_BLURB[m] || MODES[m].desc || '']))}
    <label>Map</label>${seg('map', M.maps.map(m => [m, MAPS[m].name, MAPS[m].desc]))}
    ${sb || !sizes.length ? '' : `<label>${M.sizeLabel || 'Players per team'}</label>${seg('teamSize', sizes.map(n => [n, M.sizeFmt ? M.sizeFmt(n) : n + 'v' + n]))}`}
    <label>${sb ? 'NPC skill' : 'Bot skill'}</label>${seg('diff', Object.entries(DIFF).map(([k, v]) => [k, v.label]))}
    ${teams}${extra}`;
  $('playForm').querySelectorAll('.seg').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => { const k = s.dataset.k; c[k] = isNaN(+b.dataset.v) || b.dataset.v === '' ? b.dataset.v : +b.dataset.v; Store.set('playcfg', c); Sfx.play('ui'); this.render_play(); }));
  $('playGo').onclick = () => this.startSolo();
};
/* the extra rows travel with the match config */
const _enter48 = UI.enterGame.bind(UI);
UI.enterGame = function (cfg) {
  if (cfg && cfg.localId === 'me' && !cfg.roster) for (const o of PLAY_OPTS) if (this.playCfg[o.key] != null && (!o.show || o.show(this.playCfg)) && cfg[o.key] == null) cfg[o.key] = this.playCfg[o.key];
  return _enter48(cfg);
};

/* ── Medic ─────────────────────────────────────────────────────────────── */
CLASSES.medic = { name: 'Medic', primary: { T: 'galil', CT: 'famas' }, options: ['ump45', 'vector', 'aug'], secondary: 'p2000', nades: { smoke: 2 }, gadget: 'medkit', defib: true,
  desc: 'Carbine and smokes. Med bag (G heals everyone close) and a defibrillator: revives take a second and bring people back at full health. Medium armour.' };
CLASS_ARMOUR.medic = [60, true];
const _giveClass48 = Game.giveClass.bind(Game);
Game.giveClass = function (s) { _giveClass48(s); if (s.cls === 'medic') { s.medkits = 3; s.meds = 2; } };

/* ── who can be downed ─────────────────────────────────────────────────── */
const REVIVE_MODES = new Set(['conquest', 'rush', 'tdm', 'coop', 'zombies']);
if (Settings.revives == null) Settings.revives = true;
downable = function (s) {
  if (!s || !Game.mode || !REVIVE_MODES.has(Game.mode.id) || Settings.revives === false || s.npc || s.team === 'Z') return false;
  if (!(s.ctrl === 'local' || s.ctrl === 'remote' || s.ctrl === 'bot')) return false;
  return Game.soldiers.some(o => o !== s && o.alive && !o.downed && o.team === s.team);
};

/* medics revive faster and fully */
const _revive48 = Injury.revive.bind(Injury);
Injury.revive = function (s, by) {
  const was = s && s.alive && s.downed; _revive48(s, by);
  if (!was) return;
  if (by && by.cls === 'medic' && Game.mode.classes) { s.hp = 100; this.clear(s); }
  if (by) { by.score = (by.score || 0) + (by.cls === 'medic' ? 12 : 8); if (by === Game.local) { Medal.q = []; Medal.show('Revive +' + (by.cls === 'medic' ? 12 : 8)); Career48.revive(); } }
  Net.event({ t: 'rvv', id: s.id, by: by ? by.id : null });
};
DAILY_T.push({ id: 'revive', desc: n => `Revive ${n} teammates`, on: 'revive', f: () => true, n: [3, 6] });
const Career48 = { revive() { try { Inv.data.stats.revives = (Inv.data.stats.revives || 0) + 1; Career.event('revive'); Inv.save(); } catch (e) { } } };
const _applyEvent48 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  if (e && e.t === 'rvv') { const s = Game.byId(e.id), by = Game.byId(e.by); if (s && by && by.cls === 'medic') s.hp = 100; if (s && s === Game.local) HUD.center(by ? `${by.name} revived you` : 'Revived', 1.5); return; }
  return _applyEvent48(e);
};
/* holding E: the defib is 2.5× faster */
const _pc48 = Player.controls.bind(Player);
Player.controls = function (s, dt) {
  const r = _pc48(s, dt);
  if (Revive.tgt && s.cls === 'medic' && Game.mode.classes && Input.down('KeyE')) Revive.t += dt * 1.5;
  // downed: hold Space to give up
  if (s.downed && s.alive) {
    if (Input.down('Space')) { s.giveUpT = (s.giveUpT || 0) + dt; HUD.center(`Giving up… ${Math.min(100, Math.round(s.giveUpT / 1.2 * 100))}%`, 0.2); if (s.giveUpT >= 1.2) { s.giveUpT = 0; if (Game.authority()) s.bleedOut = 0; else Net.send({ t: 'giveup' }); } }
    else s.giveUpT = 0;
  }
  return r;
};
const _hostData48 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  if (m && m.t === 'giveup') { const p = this.peers.get(id), s = p && p.sid && Game.byId(p.sid); if (s && s.downed) s.bleedOut = 0; return; }
  return _hostData48(id, m);
};
/* the down message mentions giving up */
const _center48 = HUD.center.bind(HUD);
HUD.center = function (text, t) { if (typeof text === 'string' && text.startsWith("YOU'RE DOWN")) text = text.replace('a teammate can hold E to revive you', 'a teammate can revive you · hold Space to give up'); return _center48(text, t); };

/* ── bots revive friends ───────────────────────────────────────────────── */
const _brainUpdate48 = Brain.prototype.update;
Brain.prototype.update = function (dt) {
  const s = this.s;
  if (!s.alive || s.downed || s.vehicle || s.heldBy || !REVIVE_MODES.has(Game.mode.id) || (Game.round && Game.round.phase === 'freeze')) return _brainUpdate48.call(this, dt);
  if (this.reviveJob(dt)) return;
  return _brainUpdate48.call(this, dt);
};
Brain.prototype.reviveJob = function (dt) {
  const s = this.s, medic = s.cls === 'medic';
  this.revPickT = (this.revPickT || 0) - dt;
  let d = this.revTgt && Game.byId(this.revTgt);
  if (!d || !d.alive || !d.downed) { if (d && d.reviver === s) d.reviver = null; d = null; this.revTgt = null; s.revT = 0; }
  if (!d && this.revPickT <= 0) {
    this.revPickT = 0.5;
    if (this.target && this.target.alive && Game.now - this.lastSeenAny < 2) return false;
    const R = medic ? 45 : 22; let best = null, bd = R;
    for (const e of Game.soldiers) { if (e === s || !e.alive || !e.downed || e.team !== s.team || (e.reviver && e.reviver !== s && e.reviver.alive)) continue; const q = dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z); if (q < bd) { bd = q; best = e; } }
    if (best) { d = best; this.revTgt = d.id; d.reviver = s; if (chance(0.5) && Game.cmd[s.team]) Game.cmd[s.team].say(s, medic ? `Medic! Coming for you, ${d.name}.` : `Hang on ${d.name}, I've got you.`, 3); }
  }
  if (!d) return false;
  // enemies close: fight first
  this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.12; this.sense(); }
  if (this.target && this.target.alive && dist2(this.target.pos.x, this.target.pos.z, s.pos.x, s.pos.z) < 30) { s.revT = 0; return false; }
  const m = s.moveIn; m.f = m.s = 0; m.jump = m.crouch = m.walk = m.sprint = false;
  const dd = dist2(d.pos.x, d.pos.z, s.pos.x, s.pos.z);
  if (dd > 1.6) { this.moveTo(d.pos, dt, false, false, dd > 6); this.lookAround(dt, null); s.revT = 0; return true; }
  m.crouch = true; this.turnTo(Math.atan2(-(d.pos.x - s.pos.x), -(d.pos.z - s.pos.z)), -0.5, dt, 8);
  s.revT = (s.revT || 0) + dt;
  if (s.revT >= (medic && Game.mode.classes ? 1.0 : 2.5)) { s.revT = 0; this.revTgt = null; d.reviver = null; Injury.revive(d, s); }
  return true;
};
/* reviving pose: kneeling, hands down */
const _sync48 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) {
  const r = _sync48.call(this, dt, localTeam, viewer);
  if (this.alive && !this.downed && this.revT > 0.05 && this.model && this.model.visible && !this.vehicle) { const u = this.model.userData; u.arms.rotation.x = -0.8; u.upper.rotation.x = 0.45; u.head.rotation.x = 0.4; }
  return r;
};

/* ── markers over downed teammates (through walls) ─────────────────────── */
const DownMarks = {
  tex: null, list: new Map(),
  texture() {
    if (this.tex) return this.tex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(32, 32, 28, 0, TAU); c.fill();
    c.fillStyle = '#ff4a4a'; c.fillRect(26, 12, 12, 40); c.fillRect(12, 26, 40, 12);
    return this.tex = new THREE.CanvasTexture(cv);
  },
  update() {
    const L = Game.local, seen = new Set();
    if (L && Game.scene) for (const s of Game.soldiers) {
      if (!s.alive || !s.downed || s === L || s.team !== L.team) continue;
      if (dist2(s.pos.x, s.pos.z, L.pos.x, L.pos.z) > 90) continue;
      let sp = this.list.get(s.id);
      if (!sp || sp.parent !== Game.scene) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture(), depthTest: false, transparent: true })); sp.renderOrder = 999; Game.scene.add(sp); this.list.set(s.id, sp); }
      const k = 0.55 + 0.15 * Math.sin(Game.now * 6); sp.scale.set(k, k, 1); sp.position.set(s.pos.x, s.pos.y + 1.1, s.pos.z); sp.visible = true; seen.add(s.id);
    }
    for (const [id, sp] of this.list) if (!seen.has(id)) { if (sp.parent) sp.parent.remove(sp); this.list.delete(id); }
  },
};
const _gupdate48 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate48(dt); if (this.running) DownMarks.update(); };
const _start48 = Game.start.bind(Game);
Game.start = function (cfg) { DownMarks.list.clear(); return _start48(cfg); };
