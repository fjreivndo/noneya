/* ═══════════════════════════════════════════════════════════════════════════
   Game: rules for Defuse, Conquest and Team Deathmatch. Whoever has
   authority (solo, or the multiplayer host) runs damage, deaths, money,
   the bomb, flags and tickets. Clients only report their own hits.
   ═══════════════════════════════════════════════════════════════════════════ */

const MODES = {
  defuse: { id: 'defuse', name: 'Defuse', headMult: 4, armor: true, buy: true, roundTime: 115, freeze: 8, bombTime: 40, plantTime: 3.2, defuseTime: 10, kitTime: 5, winRounds: 7, halfAt: 6, teamSize: 5, respawn: false, sprint: false, maps: ['dustyard'] },
  conquest: { id: 'conquest', name: 'Conquest', headMult: 2.2, armor: false, tickets: 200, teamSize: 12, respawn: true, respawnTime: 6, regen: true, sprint: true, classes: true, vehicles: true, maps: ['ridgeline'] },
  tdm: { id: 'tdm', name: 'Team Deathmatch', headMult: 3, armor: false, killTarget: 50, timeLimit: 600, teamSize: 6, respawn: true, respawnTime: 3, regen: true, sprint: true, classes: true, maps: ['dustyard', 'ridgeline'] },
};

const Game = {
  scene: null, renderer: null, camera: null, running: false, paused: false, now: 0, soldiers: [], map: new Map(), local: null,
  cmd: {}, mode: MODES.defuse, cfg: null, round: null, bomb: {}, nades: [], rockets: [], vehicles: [], score: { T: 0, CT: 0 }, tickets: { T: 0, CT: 0 },
  lossStreak: { T: 0, CT: 0 }, shotsOut: [], events: [], matchOver: false, botDiff: null, view: null, spectate: null, earned: 0, killsThisMatch: 0, nextNadeId: 1,

  authority() { return Net.role !== 'client'; },
  byId(id) { return this.map.get(id) || null; },
  alive(team) { return this.soldiers.filter(s => s.alive && (!team || s.team === team)); },

  initRenderer() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.setSize(innerWidth, innerHeight); r.outputColorSpace = THREE.SRGBColorSpace; r.autoClear = false;
    document.getElementById('view').appendChild(r.domElement);
    this.camera = new THREE.PerspectiveCamera(Settings.fov, innerWidth / innerHeight, 0.05, 600);
    addEventListener('resize', () => { r.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); if (this.view) this.view.resize(); });
  },

  /* cfg: { mode, map, diff, teamSize, players:[{id,name,team,skins,ctrl}], localId } */
  start(cfg) {
    this.cfg = cfg; this.mode = MODES[cfg.mode]; this.botDiff = cfg.diff;
    this.scene = new THREE.Scene();
    loadMap(cfg.map, this.scene);
    this.scene.background = new THREE.Color(World.skyColor);
    this.scene.fog = new THREE.Fog(World.fog[0], World.fog[1], World.fog[2]);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a7a60, 1.35));
    const sun = new THREE.DirectionalLight(World.sun, 2.2); sun.position.set(40, 80, 25); this.scene.add(sun);
    FX.init(this.scene);
    this.soldiers = []; this.map.clear(); this.nades = []; this.rockets = []; this.vehicles = []; this.shotsOut = [];
    this.score = { T: 0, CT: 0 }; this.lossStreak = { T: 0, CT: 0 }; this.matchOver = false; this.now = 0; this.earned = 0; this.killsThisMatch = 0;
    this.cmd = { T: new Commander('T'), CT: new Commander('CT') };
    if (!cfg.roster) this.prepareRoster(cfg);
    for (const r of cfg.roster) {
      const ctrl = r.id === cfg.localId ? 'local' : !this.authority() ? 'puppet' : r.isBot ? 'bot' : 'remote';
      this.addSoldier(Object.assign({}, r, { ctrl }));
    }
    this.local = this.byId(cfg.localId);
    this.view = new ViewModel(this);
    if (this.mode.vehicles) World.vehicleSpawns.forEach((v, i) => this.vehicles.push(new Vehicle('v' + i, v.team, v)));
    this.bomb = { state: 'none' };
    if (this.mode.id === 'conquest') {
      this.tickets = { T: this.mode.tickets, CT: this.mode.tickets };
      World.flags.forEach(f => { f.owner = f.z > 20 ? 'CT' : f.z < -20 ? 'T' : null; f.prog = f.owner === 'CT' ? 1 : f.owner === 'T' ? -1 : 0; });
      buildFlagModels();
    }
    if (this.mode.id === 'tdm') this.tdm = { kills: { T: 0, CT: 0 }, timeLeft: this.mode.timeLimit };
    this.soldiers.forEach(s => { s.money = 800; s.buildModel(this.scene); });
    this.running = true; this.paused = false;
    HUD.onMatchStart();
    if (this.authority()) {
      if (this.mode.id === 'defuse') this.startRound(true);
      else { this.round = { phase: 'live', timeLeft: this.mode.timeLimit || 0 }; this.soldiers.forEach(s => { if (s.ctrl !== 'local' && s.ctrl !== 'remote') this.respawn(s); else s.respawnT = 0; }); if (this.local) HUD.showDeploy(true); }
    } else {
      this.round = { phase: this.mode.id === 'defuse' ? 'freeze' : 'live', t: 0, timeLeft: this.mode.roundTime || 0 };
      this.bomb = { state: this.mode.id === 'defuse' ? 'carried' : 'none' };
      if (this.local) { this.local.alive = false; this.local.respawnT = 0; this.local.resetLoadout(this.local.team); if (this.mode.respawn) HUD.showDeploy(true); }
    }
  },
  /* people first, then each team is filled with bots; the host shares this list */
  prepareRoster(cfg) {
    if (cfg.roster) return cfg.roster;
    const size = cfg.teamSize || MODES[cfg.mode].teamSize, roster = cfg.players.map(p => ({ id: p.id, name: p.name, team: p.team, skins: p.skins || {}, cls: p.cls || pick(Object.keys(CLASSES)), isBot: false }));
    const names = shuffle(BOT_NAMES.slice()); let ni = 0;
    for (const team of ['T', 'CT']) { let n = roster.filter(s => s.team === team).length; while (n < size) { roster.push({ id: 'b' + ni + team, name: names[ni++ % names.length], team, isBot: true, cls: pick(Object.keys(CLASSES)), skins: {} }); n++; } }
    return cfg.roster = roster;
  },
  addSoldier(p) {
    const s = new Soldier(p); s.isBot = !!p.isBot || p.ctrl === 'bot';
    if (s.ctrl === 'bot') s.brain = new Brain(s);
    s.cls = p.cls || pick(Object.keys(CLASSES));
    this.soldiers.push(s); this.map.set(s.id, s); return s;
  },
  removeSoldier(id) { const s = this.byId(id); if (!s) return; if (s.model) this.scene.remove(s.model); this.soldiers = this.soldiers.filter(x => x !== s); this.map.delete(id); },
  stop() {
    this.running = false; Input.clear();
    if (document.pointerLockElement) document.exitPointerLock();
  },

  /* ── spawning ── */
  spawnPoints(team) { return World.spawns[team]; },
  place(s, p, yaw) { s.pos.set(p.x, 0, p.z); s.vel.set(0, 0, 0); s.yaw = yaw != null ? yaw : (p.yaw || 0); s.pitch = 0; },
  respawn(s, where) {
    s.alive = true; s.hp = 100; s.deadT = 0; s.blind = 0; s.lastDamage = -9; s.dmgBy = {}; s.vehicle = null; s.spawnProt = this.now + 2;
    if (s.model) { s.model.userData.body.rotation.x = 0; s.model.userData.body.position.y = 0; }
    if (this.mode.classes) this.giveClass(s);
    let p;
    if (where && where.flag != null) { const f = World.flags[where.flag]; p = World.nav.randomNear(f.x, f.z, 8); }
    else if (where && where.squad) { const L = this.byId(where.squad); p = L && L.alive ? World.nav.randomNear(L.pos.x, L.pos.z, 3) : null; }
    if (!p) p = this.pickSpawn(s);
    const faceTo = this.mode.id === 'conquest' ? { x: 0, z: 0 } : null;
    this.place(s, p, faceTo ? Math.atan2(-(faceTo.x - p.x), -(faceTo.z - p.z)) : p.yaw);
    if (s.brain) { s.brain.reset(); }
    Net.onSpawn(s);
  },
  pickSpawn(s) {
    if (this.mode.id === 'conquest' && s.isBot) {
      // squad spawn on the leader if they're not fighting, otherwise the owned flag nearest the objective
      const q = s.squad, L = q && q.members.map(id => this.byId(id)).find(b => b && b.alive && b !== s);
      if (L && !(L.brain && L.brain.target) && chance(0.6)) return World.nav.randomNear(L.pos.x, L.pos.z, 3);
      const tgt = q && q.target, owned = World.flags.filter(f => f.owner === s.team && this.cmd[s.team].recentNear(f.x, f.z, 20, 5).length === 0);
      if (owned.length) { const f = tgt ? owned.sort((a, b) => dist2(a.x, a.z, tgt.x, tgt.z) - dist2(b.x, b.z, tgt.x, tgt.z))[0] : pick(owned); return World.nav.randomNear(f.x, f.z, 9); }
    }
    const pts = this.spawnPoints(s.team);
    if (this.mode.respawn) { // spawn away from enemies
      const en = this.alive(other(s.team)); let best = pts[0], bd = -1;
      for (const p of shuffle(pts.slice()).slice(0, 8)) { let d = 1e9; for (const e of en) d = Math.min(d, dist2(p.x, p.z, e.pos.x, e.pos.z)); if (d > bd) { bd = d; best = p; } }
      const q = World.nav.randomNear(best.x, best.z, 2.5); q.yaw = best.yaw; return q;
    }
    const used = this.soldiers.filter(o => o.team === s.team).indexOf(s);
    return pts[(used * 3) % pts.length];
  },
  giveClass(s) {
    const c = CLASSES[s.cls] || CLASSES.assault;
    s.weapons = { 1: null, 2: null, 3: 'knife', 4: null }; s.ammo = {}; s.nades = { frag: 0, flash: 0, smoke: 0 };
    s.weapons[1] = c.primary[s.team]; s.fillAmmo(s.weapons[1]); s.weapons[2] = c.secondary; s.fillAmmo(c.secondary);
    for (const n in c.nades) s.nades[n] = c.nades[n];
    if (c.gadget === 'rpg' && this.mode.vehicles) { s.weapons[4] = 'rpg'; s.fillAmmo('rpg'); }
    s.medkits = c.gadget === 'medkit' ? 2 : 0; s.ammoBoxes = c.gadget === 'ammo' ? 2 : 0;
    s.cur = s.weapons[1]; s.drawT = 0.5; s.armor = 0; s.helmet = false;
  },

  /* ── defuse rounds ── */
  startRound(first) {
    const M = this.mode;
    if (first) { this.soldiers.forEach(s => { s.money = 800; s.resetLoadout(s.team); s.kills = s.deaths = s.assists = s.score = 0; }); this.roundNum = 1; }
    this.round = { phase: 'freeze', t: M.freeze, timeLeft: M.roundTime, winner: null, num: this.roundNum };
    this.nades.forEach(n => this.scene.remove(n.mesh)); this.nades = []; FX.smokes.forEach(s => s.sprites.forEach(sp => this.scene.remove(sp))); FX.smokes = [];
    this.bomb = { state: 'carried', carrier: null, pos: null, timer: 0, site: null, defuser: null, progress: 0 };
    const pistolRound = this.roundNum === 1 || this.roundNum === M.halfAt + 1;
    for (const s of this.soldiers) {
      if (!s.alive) s.resetLoadout(s.team);
      s.alive = true; s.hp = 100; s.deadT = 0; s.blind = 0; s.planting = null; s.dmgBy = {};
      if (s.model) { s.model.userData.body.rotation.x = 0; s.model.userData.body.position.y = 0; }
      if (s.ctrl === 'bot') s.brain.reset();
    }
    for (const t of ['T', 'CT']) {
      const team = this.soldiers.filter(s => s.team === t), pts = shuffle(this.spawnPoints(t).slice());
      team.forEach((s, i) => { const p = pts[i % pts.length]; this.place(s, { x: p.x + (i >= pts.length ? rand(-1, 1) : 0), z: p.z }, p.yaw); });
      // commander decides the team's buy; one bot is the designated AWPer
      const bots = team.filter(s => s.ctrl === 'bot'), avg = bots.reduce((a, s) => a + s.money, 0) / Math.max(1, bots.length);
      const stance = pistolRound ? 'pistol' : avg < 2000 && this.lossStreak[t] > 0 ? 'eco' : avg < 3800 ? 'force' : 'full';
      const awper = bots.slice().sort((a, b) => b.money - a.money)[0];
      bots.forEach(s => botBuy(s, stance, s === awper && chance(0.6)));
      if (bots.length && stance !== 'full') this.radio(t, bots[0].name, { pistol: 'Pistol round. Stick together.', eco: 'Eco this round, save up. Stack and trade.', force: 'Force buy! Everyone buys what they can.' }[stance]);
      this.cmd[t].onRoundStart();
    }
    const ts = this.soldiers.filter(s => s.team === 'T'); const c = ts.find(s => s.ctrl === 'bot') && chance(0.6) ? pick(ts.filter(s => s.ctrl === 'bot')) : pick(ts);
    if (c) this.bomb.carrier = c.id;
    Net.broadcastRound('start');
    HUD.onRoundStart();
  },
  endRound(winner, reason) {
    const R = this.round; if (R.phase === 'over') return;
    R.phase = 'over'; R.winner = winner; R.reason = reason; R.t = 5.5;
    this.score[winner]++;
    const loser = other(winner);
    this.lossStreak[winner] = 0; this.lossStreak[loser] = Math.min(4, this.lossStreak[loser] + 1);
    for (const s of this.soldiers) {
      if (s.team === winner) s.money += reason === 'bomb' ? 3500 : 3250;
      else s.money += 1400 + 500 * Math.max(0, this.lossStreak[loser] - 1) + (s.team === 'T' && this.bomb.state === 'planted' || this.bomb.state === 'exploded' && s.team === 'T' ? 800 : 0);
      s.money = Math.min(16000, s.money);
    }
    const mvp = this.soldiers.filter(s => s.team === winner).sort((a, b) => (b.roundKills || 0) - (a.roundKills || 0))[0];
    if (mvp) mvp.mvps++;
    this.soldiers.forEach(s => s.roundKills = 0);
    this.cmd.T.onRoundEnd(winner === 'T'); this.cmd.CT.onRoundEnd(winner === 'CT');
    const text = { elim: winner === 'T' ? 'Vanta eliminated the defenders' : 'Aegis eliminated the attackers', bomb: 'The bomb has detonated', defuse: 'The bomb has been defused', time: 'Time ran out — site held' }[reason];
    this.announce(winner, text, mvp);
    Net.broadcastRound('end', { winner, reason, text, mvp: mvp && mvp.id });
  },
  announce(winner, text, mvp) {
    HUD.roundBanner(winner, text, mvp);
    if (this.local) Sfx.play(this.local.team === winner ? 'win' : 'lose');
  },
  nextRound() {
    const M = this.mode;
    if (this.score.T >= M.winRounds || this.score.CT >= M.winRounds) return this.endMatch(this.score.T > this.score.CT ? 'T' : 'CT');
    this.roundNum++;
    if (this.roundNum === M.halfAt + 1) { // swap sides at the half
      this.soldiers.forEach(s => { s.team = other(s.team); s.money = 800; s.alive = false; s.armor = 0; s.helmet = false; s.kit = false; s.buildModel(this.scene); });
      this.score = { T: this.score.CT, CT: this.score.T }; this.lossStreak = { T: 0, CT: 0 };
      this.cmd = { T: new Commander('T'), CT: new Commander('CT') };
      HUD.center('HALFTIME — switching sides', 3);
      Net.broadcastRoster();
    }
    this.startRound(false);
  },
  endMatch(winner) {
    if (this.matchOver) return; this.matchOver = true;
    Net.broadcastRound('match', { winner });
    this.finishMatch(winner);
  },
  finishMatch(winner) {
    this.matchOver = true;
    const L = this.local; if (!L) return;
    const won = L.team === winner;
    const credits = 40 + L.kills * 8 + L.assists * 3 + (won ? 80 : 20) + L.mvps * 15;
    Inv.data.credits += credits; Inv.data.stats.matches++; if (won) Inv.data.stats.wins++;
    Inv.data.stats.kills += L.kills; Inv.data.stats.deaths += L.deaths;
    const drop = matchDrop();
    if (drop) { if (drop.kind === 'case') Inv.data.cases[drop.caseId]++; else Inv.data.items.push(drop.item); }
    Inv.save();
    setTimeout(() => UI.matchResults({ winner, won, credits, drop }), 2500);
  },

  /* ── per-frame rules (authority) ── */
  updateRules(dt) {
    const M = this.mode, R = this.round; if (!R) return;
    if (M.id === 'defuse') {
      if (R.phase === 'freeze') { R.t -= dt; if (R.t <= 0) { R.phase = 'live'; HUD.center('GO!', 1); } }
      else if (R.phase === 'live') {
        if (this.bomb.state !== 'planted') R.timeLeft -= dt;
        this.updateBomb(dt);
        const tA = this.alive('T').length, cA = this.alive('CT').length;
        if (this.bomb.state === 'exploded') this.endRound('T', 'bomb');
        else if (this.bomb.state === 'defused') this.endRound('CT', 'defuse');
        else if (cA === 0) this.endRound('T', 'elim');
        else if (tA === 0 && this.bomb.state !== 'planted') this.endRound('CT', 'elim');
        else if (R.timeLeft <= 0 && this.bomb.state !== 'planted') this.endRound('CT', 'time');
      } else if (R.phase === 'over') { this.updateBomb(dt); R.t -= dt; if (R.t <= 0) this.nextRound(); }
    } else {
      if (M.id === 'conquest') this.updateFlags(dt);
      if (M.id === 'tdm') { this.tdm.timeLeft -= dt; if (!this.matchOver && (this.tdm.kills.T >= M.killTarget || this.tdm.kills.CT >= M.killTarget || this.tdm.timeLeft <= 0)) this.endMatch(this.tdm.kills.T >= this.tdm.kills.CT ? 'T' : 'CT'); }
      for (const s of this.soldiers) {
        if (!s.alive && !this.matchOver && s.ctrl !== 'local') {
          s.respawnT = (s.respawnT ?? M.respawnTime) - dt;
          if (s.respawnT <= 0 && s.ctrl === 'bot') { s.respawnT = undefined; this.respawn(s); }
        }
        if (s.alive && M.regen && this.now - s.lastDamage > 5 && s.hp < 100) s.hp = Math.min(100, s.hp + 14 * dt);
      }
    }
  },
  updateFlags(dt) {
    let own = { T: 0, CT: 0 };
    for (const f of World.flags) {
      let t = 0, c = 0;
      for (const s of this.soldiers) if (s.alive && dist2(s.pos.x, s.pos.z, f.x, f.z) < f.radius && s.pos.y < 6) { if (s.team === 'T') t++; else c++; }
      f.contested = t > 0 && c > 0; f.tN = t; f.cN = c;
      const diff = c - t;
      if (diff !== 0) {
        const before = f.prog;
        f.prog = clamp(f.prog + Math.sign(diff) * Math.min(Math.abs(diff), 3) * dt / 9, -1, 1);
        if (before > 0 && f.prog <= 0 || before < 0 && f.prog >= 0) { if (f.owner) { this.radio(f.owner, 'Command', `We lost ${f.name} (${f.label})!`); f.owner = null; Net.event({ t: 'flag', f: f.name, o: null }); } }
        const nowOwner = f.prog >= 1 ? 'CT' : f.prog <= -1 ? 'T' : f.owner;
        if (nowOwner !== f.owner && Math.abs(f.prog) >= 1) {
          f.owner = nowOwner; this.radio(nowOwner, 'Command', `We captured ${f.name} (${f.label})!`); this.radio(other(nowOwner), 'Command', `Enemy took ${f.name} (${f.label}).`);
          for (const s of this.soldiers) if (s.alive && s.team === nowOwner && dist2(s.pos.x, s.pos.z, f.x, f.z) < f.radius) s.score += 20;
          if (this.local && this.local.team === nowOwner) Sfx.play('capture');
          Net.event({ t: 'flag', f: f.name, o: nowOwner });
        }
      } else if (!t && !c && f.owner) f.prog = lerp(f.prog, f.owner === 'CT' ? 1 : -1, dt * 0.2);
      if (f.owner) own[f.owner]++;
    }
    const d = own.CT - own.T;
    if (d !== 0) { const loser = d > 0 ? 'T' : 'CT'; this.tickets[loser] -= Math.abs(d) * 0.3 * dt; }
    if (!this.matchOver && (this.tickets.T <= 0 || this.tickets.CT <= 0)) { this.tickets.T = Math.max(0, this.tickets.T); this.tickets.CT = Math.max(0, this.tickets.CT); this.endMatch(this.tickets.T > 0 ? 'T' : 'CT'); }
  },

  /* ── bomb ── */
  updateBomb(dt) {
    const B = this.bomb;
    if (B.state === 'carried') {
      const c = this.byId(B.carrier);
      if (c && c.planting) {
        c.planting.t -= dt; c.vel.x *= 0.5; c.vel.z *= 0.5;
        if (!c.alive || !World.siteAt(c.pos.x, c.pos.z) || (c.ctrl === 'local' && !Input.down('KeyE')) || Math.hypot(c.vel.x, c.vel.z) > 1.5) c.planting = null;
        else if (c.planting.t <= 0) {
          c.planting = null; B.state = 'planted'; B.pos = c.pos.clone(); B.site = World.siteAt(c.pos.x, c.pos.z); B.timer = this.mode.bombTime; B.beep = 0;
          c.money += 300; c.score += 2; this.bombModel(true);
          this.radio('T', c.name, 'Bomb planted!'); this.radio('CT', 'Command', `The bomb has been planted at ${B.site}!`);
          HUD.center('BOMB PLANTED', 2); Sfx.play('plant', B.pos); Net.event({ t: 'bomb', s: 'planted', p: [B.pos.x, B.pos.y, B.pos.z], site: B.site });
        }
      }
    } else if (B.state === 'dropped') {
      for (const s of this.alive('T')) if (dist2(s.pos.x, s.pos.z, B.pos.x, B.pos.z) < 1.6) { B.state = 'carried'; B.carrier = s.id; this.bombModel(false); if (s.ctrl === 'local') HUD.center('You picked up the bomb', 1.5); Net.event({ t: 'bomb', s: 'carried', c: s.id }); break; }
    } else if (B.state === 'planted') {
      B.timer -= dt; B.beep -= dt;
      if (B.beep <= 0) { B.beep = B.timer > 10 ? 1 : B.timer > 5 ? 0.5 : 0.22; Sfx.play('beep', B.pos); }
      const d = this.byId(B.defuser);
      if (d) {
        B.progress -= dt;
        if (!d.alive || dist2(d.pos.x, d.pos.z, B.pos.x, B.pos.z) > 2 || (d.ctrl === 'local' && !Input.down('KeyE')) || Math.hypot(d.vel.x, d.vel.z) > 1.5) { B.defuser = null; if (d.brain) d.brain.planting = false; }
        else if (B.progress <= 0 && B.timer > 0) {
          B.state = 'defused'; d.money += 300; d.score += 2; B.defuser = null; Sfx.play('defuse', B.pos);
          this.radio('CT', d.name, 'Bomb defused!'); Net.event({ t: 'bomb', s: 'defused' });
        }
      }
      if (B.timer <= 0 && B.state === 'planted') {
        B.state = 'exploded'; FX.explosion(B.pos); FX.explosion(B.pos.clone().setY(2)); Sfx.play('explode', B.pos, { vol: 2 });
        this.explosion(B.pos, 500, 22, null, 'bomb'); this.bombModel(false); Net.event({ t: 'bomb', s: 'exploded' });
        if (this.local && dist3(this.local.pos, B.pos) < 30) HUD.shake(1.2);
      }
    }
    if (this.bombMesh && B.pos) { this.bombMesh.position.copy(B.pos); this.bombMesh.children[0].visible = B.state === 'planted' && (this.now * 2 % 1) < 0.5; }
  },
  bombModel(show) {
    if (!this.bombMesh) { const g = new THREE.Group(); g.add(bx(0.35, 0.12, 0.22, lam('#3a3a2a'), 0, 0.06, 0)); const l = bx(0.05, 0.05, 0.05, new THREE.MeshBasicMaterial({ color: 0xff2222 }), 0.1, 0.14, 0); g.add(l); g.children.reverse(); this.bombMesh = g; }
    if (show) { if (!this.bombMesh.parent) this.scene.add(this.bombMesh); } else if (this.bombMesh.parent) this.scene.remove(this.bombMesh);
    if (this.bomb.state === 'dropped') this.scene.add(this.bombMesh);
  },
  startPlant(s) {
    if (this.bomb.state !== 'carried' || this.bomb.carrier !== s.id || !World.siteAt(s.pos.x, s.pos.z)) return false;
    if (!this.authority()) { Net.send({ t: 'act', k: 'plant' }); s.planting = { t: this.mode.plantTime, local: true }; return true; }
    if (!s.planting) { s.planting = { t: this.mode.plantTime }; Sfx.play('plant', s.pos); if (s.team === 'T' && s.isBot) this.radio('T', s.name, 'Planting, cover me!'); }
    return true;
  },
  startDefuse(s) {
    const B = this.bomb; if (B.state !== 'planted' || s.team !== 'CT' || dist2(s.pos.x, s.pos.z, B.pos.x, B.pos.z) > 2) return false;
    if (!this.authority()) { Net.send({ t: 'act', k: 'defuse' }); B.localDefuse = { t: s.kit ? this.mode.kitTime : this.mode.defuseTime }; return true; }
    if (B.defuser && B.defuser !== s.id) return false;
    if (!B.defuser) { B.defuser = s.id; B.progress = s.kit ? this.mode.kitTime : this.mode.defuseTime; B.progressMax = B.progress; Sfx.play('plant', B.pos); }
    return true;
  },
  dropBomb(s) {
    if (this.bomb.state === 'carried' && this.bomb.carrier === s.id) {
      // land it somewhere a bot can walk to, never on top of a crate
      const i = World.nav.nearest(s.pos.x, s.pos.z), p = i >= 0 ? new V3(World.nav.cx(i), 0, World.nav.cz(i)) : s.pos.clone().setY(0);
      this.bomb.state = 'dropped'; this.bomb.pos = p; this.bomb.carrier = null; this.bombModel(true);
      if (!s.alive) this.radio('T', 'Command', 'The bomb is down!');
      Net.event({ t: 'bomb', s: 'dropped', p: [p.x, 0, p.z] });
    }
  },

  /* ── damage ── */
  reportHit(att, vic, dmg, zone, weapon, from) {
    if (att.ctrl === 'local') { HUD.hitmarker(zone === 'head'); Sfx.play(zone === 'head' ? 'headshot' : 'hit'); }
    if (this.authority()) this.damage(vic, dmg, att, weapon, zone, from);
    else if (att.ctrl === 'local') Net.send({ t: 'hit', v: vic.id, d: Math.round(dmg * 10) / 10, z: zone, w: weapon });
  },
  reportVehicleHit(att, v, dmg, weapon) { if (this.authority()) v.damage(dmg, att); else if (att.ctrl === 'local') Net.send({ t: 'vhit', v: v.id, d: dmg }); },
  damage(v, dmg, att, weapon, zone = 'chest', from) {
    if (!this.authority() || !v.alive) return;
    if (att && att !== v && att.team === v.team) return; // no friendly fire
    if (v.spawnProt && this.now < v.spawnProt && att && att !== v) return;
    let hp = dmg;
    const armored = this.mode.armor && v.armor > 0 && zone !== 'legs' && (zone !== 'head' || v.helmet);
    if (armored) { const pen = WEAPONS[weapon] ? WEAPONS[weapon].pen : 0.55; hp = dmg * pen; v.armor = Math.max(0, v.armor - (dmg - hp) * 0.5); if (!v.armor) v.helmet = false; }
    hp = Math.max(1, Math.round(hp));
    v.hp -= hp; v.lastDamage = this.now;
    if (att) { v.dmgBy[att.id] = (v.dmgBy[att.id] || 0) + hp; att.dmgDealt = (att.dmgDealt || 0) + hp; }
    if (v.ctrl === 'bot' && att && att !== v) { // being shot tells you where from
      const b = v.brain; b.heard = { x: att.pos.x, z: att.pos.z, t: this.now };
      if (!b.target) { b.mem.set(att.id, { pos: att.pos.clone(), t: this.now, vis: false, id: att.id }); }
    }
    Net.onDamage(v, hp, att, zone);
    if (v.ctrl === 'local') HUD.hurt(att ? att.pos : null, hp);
    if (v.hp <= 0) this.kill(v, att, weapon, zone === 'head');
  },
  kill(v, att, weapon, hs) {
    if (!v.alive) return;
    v.alive = false; v.hp = 0; v.deaths++; v.deadT = 0; v.planting = null;
    if (v.vehicle) this.exitVehicle(v, true);
    this.dropBomb(v);
    if (this.bomb.defuser === v.id) this.bomb.defuser = null;
    if (att && att !== v && att.team !== v.team) {
      att.kills++; att.score += hs ? 3 : 2; att.roundKills = (att.roundKills || 0) + 1;
      if (this.mode.buy) att.money = Math.min(16000, att.money + (WEAPONS[weapon] ? WEAPONS[weapon].kill : 300));
      if (this.mode.id === 'tdm') this.tdm.kills[att.team]++;
    }
    for (const id in v.dmgBy) { const a = this.byId(id); if (a && a !== att && a.team !== v.team && v.dmgBy[id] >= 40) { a.assists++; a.score += 1; } }
    if (this.mode.id === 'conquest') this.tickets[v.team] = Math.max(0, this.tickets[v.team] - 1);
    if (this.mode.respawn) v.respawnT = this.mode.respawnTime;
    const ev = { t: 'kill', v: v.id, a: att ? att.id : null, w: weapon, hs: !!hs };
    this.onKillEvent(ev);
    Net.event(ev);
  },
  /* runs on every peer (host directly, clients from the event) */
  onKillEvent(ev) {
    const v = this.byId(ev.v), a = this.byId(ev.a);
    if (v && !this.authority()) { v.alive = false; v.hp = 0; v.deadT = 0; v.planting = null; if (v.vehicle) this.exitVehicle(v, true); if (a && a !== v) { a.kills++; } v.deaths++; }
    if (v && this.mode.respawn) v.respawnT = this.mode.respawnTime;
    HUD.killfeed(a, v, ev.w, ev.hs);
    if (a && a === this.local && v !== a) { Sfx.play('kill'); if (WEAPONS[ev.w] || ev.w === 'knife') Inv.addKill(ev.w); this.killsThisMatch++; }
    if (v && v === this.local) {
      HUD.died(a, ev.w, ev.hs);
      this.spectate = a && a !== v ? a : null;
      if (this.mode.respawn) setTimeout(() => { if (this.running && !this.local.alive && !this.matchOver) HUD.showDeploy(true); }, 2500);
    }
  },
  explosion(p, dmg, radius, owner, weapon) {
    if (!this.authority()) return;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = Math.hypot(s.pos.x - p.x, s.pos.y + 0.9 - p.y, s.pos.z - p.z); if (d > radius) continue;
      if (!World.los(p.x, p.y + 0.3, p.z, s.pos.x, s.pos.y + 1.0, s.pos.z) && !World.los(p.x, p.y + 0.3, p.z, s.pos.x, s.eyeY, s.pos.z)) continue;
      const f = Math.pow(1 - d / radius, 1.3);
      if (owner && owner.team === s.team && owner !== s) continue;
      this.damage(s, dmg * f, owner, weapon, 'chest');
    }
    for (const v of this.vehicles) { if (!v.alive) continue; const d = dist3(v.pos, p); if (d < radius + 1.5) v.damage(dmg * 2.2 * (1 - d / (radius + 1.5)), owner); }
  },
  flashbang(p, owner) {
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      if (!(s.ctrl === 'local' || (s.ctrl === 'bot' && this.authority()))) continue;
      const eye = s.eye(new V3()), d = dist3(eye, p); if (d > 32) continue;
      if (!World.los(p.x, p.y + 0.1, p.z, eye.x, eye.y, eye.z) || FX.smokeBlocks(p, eye)) continue;
      const f = s.forward(new V3()), to = new V3(p.x - eye.x, p.y - eye.y, p.z - eye.z).normalize();
      const facing = clamp((f.dot(to) + 0.35) / 1.35, 0, 1), dist = 1 - d / 32;
      const t = (0.4 + 4.2 * facing * facing) * (0.35 + 0.65 * dist);
      if (t > s.blind) { s.blind = t; s.blindMax = t; }
      if (s.ctrl === 'bot' && t > 1.5 && owner && owner.team !== s.team) this.cmd[s.team].say(s, "I'm flashed!", 1);
    }
  },
  noise(src, radius) { if (!this.authority()) return; for (const s of this.soldiers) if (s.ctrl === 'bot' && s.alive && s.team !== src.team) s.brain.hear(src, radius); },
  radio(team, from, text) { if (this.local && this.local.team === team) HUD.radio(from, text); Net.radio(team, from, text); },

  /* ── projectiles ── */
  throwNade(s, type, strong, remote) {
    if (!remote) { if (s.nades[type] <= 0) return; s.nades[type]--; }
    const eye = s.eye(new V3()), vel = remote ? remote.vel : throwVelocity(s, strong);
    const pos = remote ? remote.pos : eye.clone().add(s.forward(new V3()).multiplyScalar(0.4));
    const n = new Nade(type, pos, vel, s, remote ? remote.id : s.id + ':' + (this.nextNadeId++));
    this.nades.push(n); Sfx.play('pin', pos);
    if (!remote) {
      Net.nade(n);
      if (s.nades[type] <= 0) s.switchTo(s.bestWeapon()); else s.drawT = 0.5;
      if (s.team && s.isBot) this.radio(s.team, s.name, { frag: 'Frag out!', flash: 'Flashing!', smoke: 'Smoke out.' }[type]);
    }
  },
  spawnRocket(s, pos, dir, local) { const r = new Rocket(s, pos, dir); this.rockets.push(r); if (local) Net.rocket(s, pos, dir); },
  rayVehicles(o, d, maxT) { let best = maxT, hit = null; for (const v of this.vehicles) { if (!v.alive) continue; const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, v.box()); if (t >= 0 && t < best) { best = t; hit = v; } } return hit ? { v: hit, t: best } : null; },
  onShot(s, end, eye) { Net.shot(s, end); },

  /* ── vehicles ── */
  tryEnterVehicle(s) {
    if (s.vehicle) { this.exitVehicle(s); return true; }
    for (const v of this.vehicles) {
      if (!v.alive || dist2(v.pos.x, v.pos.z, s.pos.x, s.pos.z) > 3.5) continue;
      if (!v.driver) { v.driver = s; s.vehicle = v; Net.vehicleSeat(v); return true; }
      if (!v.passenger) { v.passenger = s; s.vehicle = v; Net.vehicleSeat(v); return true; }
    }
    return false;
  },
  exitVehicle(s, forced) {
    const v = s.vehicle; if (!v) return;
    if (v.driver === s) v.driver = null; if (v.passenger === s) v.passenger = null;
    s.vehicle = null;
    const side = { x: Math.cos(v.yaw) * -2.2, z: Math.sin(v.yaw) * 2.2 };
    const p = World.nav.randomNear(v.pos.x + side.x, v.pos.z + side.z, 2);
    s.pos.set(p.x, 0, p.z); s.vel.set(0, 0, 0);
    Net.vehicleSeat(v);
  },
  broadcastVehicle(v) { Net.event({ t: 'veh', id: v.id, alive: v.alive, hp: v.hp }); },

  /* ── main update ── */
  update(dt) {
    if (!this.running) return;
    this.now += dt;
    if (this.authority()) this.updateRules(dt);
    else if (this.round && this.round.phase === 'live' && this.bomb.state !== 'planted' && this.mode.id === 'defuse') this.round.timeLeft -= dt;
    Player.update(dt);
    AI.update(dt);
    for (const s of this.soldiers) {
      if (s.ctrl === 'bot' && s.alive) {
        s.tickWeapon(dt, this.now);
        if (s.planting || (this.bomb.defuser === s.id)) { s.moveIn.f = s.moveIn.s = 0; s.moveIn.crouch = true; }
        s.move(dt);
      } else if (s.ctrl === 'remote' || s.ctrl === 'puppet') Net.interp(s, dt);
    }
    for (const v of this.vehicles) {
      if (v.driver && v.driver.ctrl === 'local') v.drive(Player.vehicleInput(), dt);
      if (!v.driver || v.driver.ctrl === 'local' || v.driver.ctrl === 'bot' || this.authority() && !v.driver) v.physics(dt);
      else Net.interpVehicle(v, dt);
    }
    for (let i = this.nades.length - 1; i >= 0; i--) { this.nades[i].update(dt); if (this.nades[i].done) this.nades.splice(i, 1); }
    for (let i = this.rockets.length - 1; i >= 0; i--) { this.rockets[i].update(dt); if (this.rockets[i].done) this.rockets.splice(i, 1); }
    const viewer = this.local && this.local.alive ? this.local : null;
    for (const s of this.soldiers) s.syncModel(dt, this.local ? this.local.team : null, viewer && !this.view.third ? viewer : null);
    FX.update(dt);
    if (World.flags.length) updateFlagModels();
    Net.update(dt);
  },
  render() {
    const r = this.renderer; r.clear();
    r.render(this.scene, this.camera);
    if (this.view && this.view.visible()) { r.clearDepth(); r.render(this.view.scene, this.view.camera); }
  },
};

/* flag poles for conquest */
function buildFlagModels() {
  for (const f of World.flags) {
    const g = new THREE.Group(); g.add(bx(0.12, 9, 0.12, lam('#bbbbbb'), 0, 4.5, 0));
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); cloth.position.set(1, 8.2, 0); g.add(cloth);
    const ring = new THREE.Mesh(new THREE.RingGeometry(f.radius - 0.3, f.radius, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    g.position.set(f.x, 0, f.z); Game.scene.add(g); f.model = { g, cloth, ring };
    labelDecal(f.name, f.x, f.z, 5, '#ffffff');
  }
}
function updateFlagModels() {
  for (const f of World.flags) {
    if (!f.model) continue;
    const col = f.owner ? new THREE.Color(TEAM_STYLE[f.owner].color) : new THREE.Color('#dddddd');
    f.model.cloth.material.color.copy(col); f.model.ring.material.color.copy(f.contested ? new THREE.Color('#ff4444') : col);
    f.model.cloth.position.y = 1.5 + Math.abs(f.prog) * 6.7;
    f.model.cloth.rotation.y = Math.sin(Game.now * 2 + f.x) * 0.2;
  }
}
