/* ═══════════════════════════════════════════════════════════════════════════
   Zombies: co-op wave survival.
   You and a squad of Aegis bots (and friends, in multiplayer) hold out
   against endless waves. Each wave is bigger. Walkers from wave 1, fast
   runners from wave 3, huge brutes from wave 5. Clear a wave and everyone
   who died comes back, ammo refills and armour tops up for a short break.
   The game ends when the whole squad is down. Your best wave per map is kept.
   ═══════════════════════════════════════════════════════════════════════════ */
MODES.zombies = { id: 'zombies', name: 'Zombies', headMult: 3, armor: true, teamSize: 4, respawn: false, respawnTime: 1e9, regen: true, sprint: true, classes: true,
  maps: ['dockyard', 'dustyard', 'ridgeline', 'frostpeak', 'oasis'], desc: 'Co-op waves of zombies.' };
const ZTYPE = {
  walker: { hp: w => 80 + w * 12, speed: 0.74, bite: 20, scale: 1, tint: null },
  runner: { hp: w => 50 + w * 7, speed: 1.1, bite: 13, scale: 0.95, tint: '#6a8a4a' },
  brute: { hp: w => 450 + w * 70, speed: 0.6, bite: 45, scale: 1.35, tint: '#4a3a3a' },
};
/* zombies in this mode always know where the living are */
class HordeBrain extends ZombieBrain {
  constructor(s, type) { super(s); this.type = type || 'walker'; this.seekT = 0; }
  update(dt) {
    const s = this.s; if (!s.alive || s.heldBy) return;
    const m = s.moveIn; m.f = m.s = 0; m.jump = m.crouch = m.walk = m.sprint = false;
    this.biteT -= dt; this.groanT -= dt; this.seekT -= dt;
    if (this.groanT <= 0) { this.groanT = rand(3, 8); Sfx.play('hurt', s.pos, { vol: 0.45 }); }
    if (this.seekT <= 0 || !(this.target && this.target.alive)) {
      this.seekT = 0.6; let best = null, bd = 1e9;
      for (const e of Game.soldiers) { if (!e.alive || e.team === 'Z' || e.team === 'D') continue; const d = dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z) + (e.downed ? 6 : 0); if (d < bd) { bd = d; best = e; } }
      this.target = best;
    }
    const e = this.target; if (!e) return;
    const tp = e.vehicle ? e.vehicle.pos : e.pos, d = dist2(tp.x, tp.z, s.pos.x, s.pos.z), reach = e.vehicle ? e.vehicle.K.r + 1.2 : 1.35;
    this.turnTo(Math.atan2(-(tp.x - s.pos.x), -(tp.z - s.pos.z)), 0, dt, 7);
    if (d > reach) { this.moveTo(tp, dt, false, false, this.type === 'runner'); if (this.type === 'runner') m.sprint = true; }
    else if (this.biteT <= 0) {
      this.biteT = this.type === 'brute' ? 1.4 : 0.9; Sfx.play('knife', s.pos);
      const K = ZTYPE[this.type]; if (e.vehicle) e.vehicle.damage(K.bite * 2, s); else Game.damage(e, K.bite, s, 'zombie', 'chest');
    }
  }
}

const Horde = {
  wave: 0, phase: 'off', t: 0, toSpawn: 0, spawnT: 0, kills: 0, next: 1, syncT: 0, best: 0,
  on() { return Game.mode && Game.mode.id === 'zombies'; },
  humans() { return Game.soldiers.filter(s => s.team === 'CT'); },
  zombies() { return Game.soldiers.filter(s => s.team === 'Z' && s.alive); },
  start() { this.wave = 0; this.phase = 'break'; this.t = 10; this.toSpawn = 0; this.kills = 0; this.next = 1; this.best = +(Store.get('zbest_' + World.id, 0)) || 0; },
  /* somewhere out of sight, a fair distance from everyone */
  spawnSpot() {
    const H = this.humans().filter(s => s.alive); if (!H.length) return null;
    for (let k = 0; k < 30; k++) {
      const h = pick(H), a = rand(0, TAU), r = rand(26, 46), p = World.nav.randomNear(h.pos.x + Math.cos(a) * r, h.pos.z + Math.sin(a) * r, 6);
      if (!p || H.some(o => dist2(o.pos.x, o.pos.z, p.x, p.z) < 20)) continue;
      const B = World.bounds; if (p.x < B.x0 + 2 || p.x > B.x1 - 2 || p.z < B.z0 + 2 || p.z > B.z1 - 2) continue;
      if (k < 20 && H.some(o => World.los(o.pos.x, o.eyeY, o.pos.z, p.x, 1.4, p.z))) continue;
      return p;
    }
    const sp = pick(World.spawns.T.concat(World.spawns.CT)); return World.nav.randomNear(sp.x, sp.z, 8);
  },
  spawn(type) {
    const p = this.spawnSpot(); if (!p) return;
    const ev = { e: 'npc', id: 'z' + (this.next++), k: 'zombie', name: (type === 'brute' ? 'Brute' : type === 'runner' ? 'Runner' : 'Zombie') + ' ' + this.next, team: 'Z', w: null, pos: [p.x, 0, p.z], yaw: rand(0, TAU), zt: type, zw: this.wave };
    this.apply(ev); if (Net.role === 'host') Net.event({ t: 'zspawn', ev });
  },
  apply(ev) {
    Sandbox.apply(ev); const s = Game.byId(ev.id); if (!s) return; const K = ZTYPE[ev.zt] || ZTYPE.walker;
    s.zt = ev.zt; s.hp = s.maxHp = K.hp(ev.zw || 1); s.speedK = K.speed; s.spawnT = Game.now; s.armor = 0; s.helmet = false;
    if (s.ctrl === 'bot') s.brain = new HordeBrain(s, ev.zt);
    if (s.model) { s.model.scale.setScalar(K.scale); if (K.tint) s.model.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === '4a5a3a') { o.material = o.material.clone(); o.material.color.set(K.tint); } }); }
  },
  startWave() {
    this.wave++; const n = this.humans().length;
    this.toSpawn = Math.round((5 + this.wave * 4) * (0.7 + 0.12 * n)); this.brutes = this.wave >= 5 ? 1 + Math.floor((this.wave - 5) / 2) : 0;
    this.phase = 'wave'; this.spawnT = 0.5;
    for (const s of this.humans()) if (!s.alive && !s.deaths) Game.respawn(s);   // anyone still on the deploy screen joins in
    this.banner(`WAVE ${this.wave}`, this.wave >= 5 ? 'Brutes incoming' : this.wave >= 3 ? 'Runners incoming' : 'Hold together');
  },
  endWave() {
    this.phase = 'break'; this.t = 14;
    for (const s of this.humans()) {
      if (!s.alive) Game.respawn(s);
      for (const w of Object.values(s.weapons || {})) if (w && WEAPONS[w] && WEAPONS[w].mag) s.fillAmmo(w);
      s.armor = Math.max(s.armor || 0, 50); s.helmet = true; if (s.hp < 100) s.hp = 100; if (s.inj) Injury.clear(s);
      if (s.nades) s.nades.frag = Math.max(s.nades.frag || 0, 1);
    }
    if (this.wave > this.best) { this.best = this.wave; Store.set('zbest_' + World.id, this.best); }
    this.banner(`WAVE ${this.wave} CLEARED`, 'Ammo refilled · fallen squadmates are back');
  },
  banner(a, b) { HUD.center(a + (b ? ' — ' + b : ''), 3); Sfx.play('capture'); if (Net.role === 'host') Net.event({ t: 'zban', a, b }); },
  update(dt) {
    if (!this.on() || !Game.authority() || Game.matchOver) return;
    const H = this.humans(), aliveH = H.filter(s => s.alive).length, Z = this.zombies();
    if (this.phase === 'break') { this.t -= dt; if (this.t <= 0) this.startWave(); }
    else if (this.phase === 'wave') {
      this.spawnT -= dt; const cap = Math.min(40, 14 + this.wave * 2);
      if (this.toSpawn > 0 && Z.length < cap && this.spawnT <= 0) {
        this.spawnT = Math.max(0.2, 1.1 - this.wave * 0.07); this.toSpawn--;
        const type = this.brutes > 0 && chance(0.25) ? (this.brutes--, 'brute') : this.wave >= 3 && chance(Math.min(0.45, 0.15 + this.wave * 0.03)) ? 'runner' : 'walker';
        this.spawn(type);
      }
      if (this.toSpawn <= 0 && this.brutes > 0) { this.brutes--; this.spawn('brute'); }
      if (this.toSpawn <= 0 && this.brutes <= 0 && Z.length === 0) this.endWave();
      // stragglers that got lost come back somewhere closer
      for (const z of Z) {
        if (!z.lastP || Game.now - z.lastPT > 12) { const stuck = z.lastP && Math.hypot(z.pos.x - z.lastP.x, z.pos.z - z.lastP.z) < 3 && !H.some(h => h.alive && dist2(h.pos.x, h.pos.z, z.pos.x, z.pos.z) < 3);
          z.lastP = { x: z.pos.x, z: z.pos.z }; z.lastPT = Game.now;
          const lost = Game.now - (z.spawnT || 0) > 70 && !H.some(h => h.alive && dist2(h.pos.x, h.pos.z, z.pos.x, z.pos.z) < 35);
          if (stuck || lost) { const p = this.spawnSpot(); if (p) { z.pos.set(p.x, World.floorAt(p.x, p.z), p.z); z.vel.set(0, 0, 0); z.spawnT = Game.now; z.lastP = null; if (z.brain) { z.brain.path = null; z.brain.seekT = 0; } } } }
      }
    }
    if (aliveH === 0 && H.length && this.phase !== 'off') { this.phase = 'off'; if (this.wave > this.best) { this.best = this.wave; Store.set('zbest_' + World.id, this.best); } Game.endMatch('T'); }
    // clear bodies
    for (const s of Game.soldiers.slice()) if (s.team === 'Z' && !s.alive && s.deadT > 5) { Game.removeSoldier(s.id); if (Net.role === 'host') Net.event({ t: 'zdel', id: s.id }); }
    this.syncT -= dt; if (this.syncT <= 0 && Net.role === 'host') { this.syncT = 0.5; Net.event({ t: 'zst', w: this.wave, p: this.phase, tt: this.t, l: this.toSpawn + (this.brutes || 0) + Z.length }); }
  },
};

/* roster: everyone on Aegis, bots fill the squad, no Vanta */
const _prep31 = Game.prepareRoster.bind(Game);
Game.prepareRoster = function (cfg) {
  if (cfg.mode !== 'zombies' || cfg.roster) return _prep31(cfg);
  for (const p of cfg.players) p.team = 'CT';
  const r = _prep31(cfg); cfg.roster = r.filter(x => !(x.isBot && x.team === 'T')); return cfg.roster;
};
const _start31 = Game.start.bind(Game);
Game.start = function (cfg) {
  const r = _start31(cfg);
  if (this.mode.id === 'zombies') { this.tdm = { kills: { T: 0, CT: 0 }, timeLeft: 0 }; Horde.start(); Horde.localL = 0; }
  else Horde.phase = 'off';
  return r;
};
const _gupdate31 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate31(dt); if (this.running) Horde.update(dt); };
/* kills count toward the squad */
const _onKill31 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) { _onKill31(ev); if (Horde.on()) { const v = this.byId(ev.v); if (v && v.team === 'Z') { Horde.kills++; this.tdm.kills.CT++; } } };
/* clients */
const _applyEvent31 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  switch (e && e.t) {
    case 'zspawn': Horde.apply(e.ev); return;
    case 'zdel': Game.removeSoldier(e.id); return;
    case 'zst': Horde.wave = e.w; Horde.phase = e.p; Horde.t = e.tt; Horde.left = e.l; return;
    case 'zban': HUD.center(e.a + (e.b ? ' — ' + e.b : ''), 3); Sfx.play('capture'); return;
  }
  return _applyEvent31(e);
};
/* HUD: wave, zombies left, squad alive */
const _hud31 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hud31(dt); if (!Horde.on() || !Game.local) return; const E = this.el;
  const left = Game.authority() ? Horde.toSpawn + (Horde.brutes || 0) + Horde.zombies().length : (Horde.left || 0);
  E.timer.textContent = Horde.wave ? `WAVE ${Horde.wave}` : 'ZOMBIES'; E.timer.classList.remove('bomb', 'freeze');
  E.scCT.textContent = Horde.humans().filter(s => s.alive).length; E.scT.textContent = left;
  E.rinfo.textContent = Horde.phase === 'break' ? `Next wave in ${Math.max(0, Math.ceil(Horde.t))}s · best: wave ${Horde.best}` : `${left} zombies left · ${Horde.kills || this.kills || 0} killed`;
  if (Horde.phase === 'wave' && !Game.local.alive) E.rinfo.textContent += ' · you are back when the wave is cleared';
};
/* the end screen says how far you got */
const _results31 = UI.matchResults.bind(UI);
UI.matchResults = function (r) {
  _results31(r); if (Game.mode.id !== 'zombies') return;
  const el = document.getElementById('results'), h = el && el.querySelector('h1, h2'); if (h) h.textContent = `Overrun on wave ${Horde.wave}`;
  const sub = el && el.querySelector('.rsub'); if (sub) sub.textContent = `${Horde.kills} zombies killed · best on ${World.def.name}: wave ${Horde.best} · Zombies · ${fmtTime(r.dur)}`;
  const t = el && el.querySelector('.rteams'); if (t && t.children.length > 1) t.children[0].remove();   // no Vanta table
};
/* no class deploy screen between waves: you come back automatically */
const _showDeploy31 = HUD.showDeploy.bind(HUD);
HUD.showDeploy = function (on) { if (on && Horde.on() && Horde.wave > 0) return; return _showDeploy31(on); };

/* shambling: hunched, arms out in front, no gun */
const _sync31 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) {
  const r = _sync31.call(this, dt, localTeam, viewer);
  if (this.team !== 'Z' || !this.alive || !this.model || !this.model.visible || this.rag) return r;
  const u = this.model.userData, t = Game.now * (this.zt === 'runner' ? 9 : 4) + (this.id.length * 1.7);
  if (u.gunMount) u.gunMount.visible = false;
  u.arms.rotation.x = 0; if (u.armL) { u.armL.rotation.set(0.25 + Math.sin(t) * 0.12, -0.15, 0); u.armR.rotation.set(0.25 - Math.sin(t) * 0.12, 0.15, 0); }
  u.upper.rotation.x = this.zt === 'runner' ? -0.45 : this.zt === 'brute' ? -0.35 : -0.25; u.head.rotation.z = Math.sin(t * 0.5) * 0.25; u.head.rotation.x = 0.2;
  return r;
};
