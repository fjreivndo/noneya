/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Co-op missions.
   You and your squad (friends in multiplayer, bots filling the rest) go in
   against Vanta bots guarding objectives on the far side of the map:
   · Silence the Guns — blow up three artillery pieces (hold E to plant a
     charge; get clear).
   · Hostage Rescue — find the scientist, free them (hold E) and bring them
     back alive. Stray bullets count.
   · Data Raid — download intel from two terminals (hold E; it takes a
     while and the whole base hears about it).
   Then get everyone to the extraction point. Your squad shares a pool of
   lives; Vanta keeps sending reinforcements until its pool runs dry.
   ═══════════════════════════════════════════════════════════════════════════ */
MODES.coop = { id: 'coop', name: 'Co-op', headMult: 2.5, armor: true, teamSize: 4, respawn: true, respawnTime: 8, regen: true, sprint: true, classes: true, fixedTeam: 'CT',
  sizes: [2, 4, 6], sizeLabel: 'Squad size', sizeFmt: n => `Squad of ${n}`, maps: ['dustyard', 'city', 'ridgeline', 'dockyard', 'frostpeak', 'oasis'].filter(m => MAPS[m]), desc: 'Missions against bots' };
const MISSIONS = {
  sabotage: { name: 'Silence the Guns', brief: 'Destroy the three artillery pieces, then extract.' },
  rescue: { name: 'Hostage Rescue', brief: 'Free the scientist and bring them to extraction alive.' },
  intel: { name: 'Data Raid', brief: 'Download the intel from both terminals, then extract.' },
};
PLAY_OPTS.push({ key: 'mission', label: 'Mission', show: c => c.mode === 'coop', opts: () => Object.entries(MISSIONS).map(([k, m]) => [k, m.name, m.brief.split(',')[0]]).concat([['random', 'Random']]), def: 'sabotage' });

/* ── objective markers over the world (HTML, projected) ────────────────── */
const Markers = {
  list: new Map(), root: null,
  set(id, o) { this.list.set(id, Object.assign(this.list.get(id) || {}, o)); },
  del(id) { const m = this.list.get(id); if (m && m.el) m.el.remove(); this.list.delete(id); },
  clear() { for (const id of [...this.list.keys()]) this.del(id); },
  update() {
    if (!Game.camera || !Game.running) { for (const m of this.list.values()) if (m.el) m.el.style.display = 'none'; return; }
    if (!this.root) { this.root = document.createElement('div'); this.root.id = 'omarks'; document.body.appendChild(this.root); }
    const cam = Game.camera, v = new V3(), W = innerWidth, H = innerHeight, L = Game.local;
    for (const m of this.list.values()) {
      if (!m.el) { m.el = document.createElement('div'); m.el.className = 'omark'; this.root.appendChild(m.el); }
      if (m.hidden) { m.el.style.display = 'none'; continue; }
      v.set(m.x, m.y, m.z).project(cam);
      const behind = v.z > 1; let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      if (behind) { x = W - x; y = H - 40; }
      x = clamp(x, 30, W - 30); y = clamp(y, 40, H - 40);
      const d = L ? Math.round(Math.hypot(m.x - L.pos.x, m.z - L.pos.z)) : 0;
      m.el.style.display = ''; m.el.style.transform = `translate(${x}px,${y}px)`; m.el.style.setProperty('--mc', m.color || '#ffd24a');
      const html = `<i>${m.icon || '◆'}</i><b>${m.label}</b><small>${d} m${m.prog != null ? ' · ' + Math.round(m.prog * 100) + '%' : ''}</small>`;
      if (m.html !== html) { m.el.innerHTML = html; m.html = html; }
    }
  },
};

const Coop = {
  mission: 'sabotage', objs: [], phase: 'off', lives: 0, pool: 0, alarm: false, alarmT: 0, ex: null, hostage: null, syncT: 0, holding: new Map(), thinkT: 0,
  on() { return !!(Game.mode && Game.mode.id === 'coop'); },
  humans() { return Game.soldiers.filter(s => s.team === 'CT' && !s.isBot && !s.npc); },
  center(team) { const P = World.spawns[team] || []; if (!P.length) return World.hq[team] || { x: 0, z: 0 }; return { x: P.reduce((a, p) => a + p.x, 0) / P.length, z: P.reduce((a, p) => a + p.z, 0) / P.length }; },
  /* spots on the enemy's side of the map, spread out */
  spots(n) {
    const a = this.center('CT'), b = this.center('T'), dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, px = -dz / L, pz = dx / L;
    const B = World.bounds, half = Math.min(B.x1 - B.x0, B.z1 - B.z0) * 0.32, out = [];
    for (let k = 0; k < 200 && out.length < n; k++) {
      const t = rand(0.55, 0.95), o = rand(-half, half), q = World.nav.randomNear(a.x + dx * t + px * o, a.z + dz * t + pz * o, 6); if (!q) continue;
      if (q.x < B.x0 + 4 || q.x > B.x1 - 4 || q.z < B.z0 + 4 || q.z > B.z1 - 4) continue;
      if (out.some(p => dist2(p.x, p.z, q.x, q.z) < Math.max(14, 26 - k * 0.1))) continue;
      out.push(q);
    }
    return out;
  },
  /* ── start (host) ── */
  start(cfg) {
    this.mission = MISSIONS[cfg.mission] ? cfg.mission : pick(Object.keys(MISSIONS)); this.objs = []; this.phase = 'go'; this.alarm = false; this.hostage = null; this.holding.clear(); Markers.clear();
    const H = this.humans().length || 1, sq = Game.soldiers.filter(s => s.team === 'CT').length;
    this.lives = 2 + H * 2; this.pool = Math.round(10 + sq * 3);
    const c = this.center('CT'), exP = World.nav.randomNear(c.x, c.z, 4) || c; this.ex = { x: exP.x, z: exP.z };
    if (Game.authority()) {
      if (this.mission === 'sabotage') this.spots(3).forEach((p, i) => this.objs.push({ id: 'o' + i, k: 'gun', x: p.x, z: p.z, st: 'live', prog: 0 }));
      if (this.mission === 'intel') this.spots(2).forEach((p, i) => this.objs.push({ id: 'o' + i, k: 'term', x: p.x, z: p.z, st: 'live', prog: 0 }));
      if (this.mission === 'rescue') { const p = this.spots(1)[0] || this.center('T'); this.objs.push({ id: 'o0', k: 'hostage', x: p.x, z: p.z, st: 'live', prog: 0 }); }
      this.assignGuards();
      if (Net.role === 'host') Net.event({ t: 'cst', m: this.mission, objs: this.objs, ex: this.ex, lives: this.lives });
    }
    this.buildObjs();
    setTimeout(() => { if (Game.running && this.on()) HUD.center(`${MISSIONS[this.mission].name.toUpperCase()} · ${MISSIONS[this.mission].brief}`, 4); }, 1500);
  },
  buildObjs() {
    for (const o of this.objs) {
      if (o.mesh) continue;
      const g = new THREE.Group(), y = topBelow(o.x, o.z, 40);
      if (o.k === 'gun') {
        g.add(bx(2.2, 0.5, 3.2, lam('#4a5238'), 0, 0.35, 0)); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 14), lam('#2a2a2a')); w.rotation.z = Math.PI / 2; w.position.set(s * 1.2, 0.55, 0.6); g.add(w); }
        g.add(bx(1.2, 0.7, 1.4, lam('#56603f'), 0, 0.95, 0)); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 4.2, 10), lam('#3a4030')); b.rotation.x = Math.PI / 2 - 0.5; b.position.set(0, 1.9, -1.7); g.add(b);
        g.add(bx(1.6, 1.0, 0.08, lam('#5a6448'), 0, 1.0, -0.6));
        World.add(o.x - 1.1, y, o.z - 1.6, o.x + 1.1, y + 1.3, o.z + 1.6, 'metal', '#4a5238', { invisible: true }).noDestroy = true;
      } else if (o.k === 'term') {
        g.add(bx(0.9, 1.2, 0.6, lam('#3a3e44'), 0, 0.6, 0)); const scr = bx(0.7, 0.45, 0.05, new THREE.MeshBasicMaterial({ color: 0x3aff8a }), 0, 1.0, 0.31); scr.rotation.x = -0.35; g.add(scr); o.screen = scr;
        g.add(bx(0.3, 1.6, 0.3, lam('#2a2e34'), 0.7, 0.8, 0)); const ant = bx(0.04, 1.2, 0.04, lam('#888'), 0.7, 2.2, 0); g.add(ant);
      } else if (o.k === 'hostage') { /* the hostage is a soldier; just a chair */ g.add(bx(0.5, 0.45, 0.5, lam('#5a4028'), 0, 0.22, 0.3)); g.add(bx(0.5, 0.6, 0.06, lam('#5a4028'), 0, 0.75, 0.55)); }
      g.position.set(o.x, y, o.z); Game.scene.add(g); o.mesh = g;
      if (o.k === 'hostage' && Game.authority() && !this.hostage) {
        const ev = { e: 'npc', id: 'hostage', k: 'citizen', name: 'Dr. Reyes', team: 'N', w: null, pos: [o.x, y, o.z], yaw: 0 };
        Sandbox.apply(ev); if (Net.role === 'host') Net.toAll({ t: 'sbxev', ev });
        const h = Game.byId('hostage'); if (h) { h.hostage = true; h.brain = new HostageBrain(h); h.hp = 140; this.hostage = h; }
      }
    }
    Markers.set('ex', { x: this.ex.x, y: 2.5, z: this.ex.z, label: 'Extraction', icon: '⬆', color: '#6aff8a', hidden: true });
  },
  /* ── enemies: guards on each objective, the rest patrol ── */
  assignGuards() {
    const T = Game.soldiers.filter(s => s.team === 'T' && s.ctrl === 'bot'); let i = 0;
    for (const o of this.objs) for (let k = 0; k < 3 && i < T.length; k++, i++) { T[i].post = World.nav.randomNear(o.x + rand(-7, 7), o.z + rand(-7, 7), 4) || { x: o.x, z: o.z }; T[i].postObj = o.id; }
    for (; i < T.length; i++) T[i].post = null;
  },
  thinkT(cmd) {
    const bots = cmd.bots().filter(b => b.alive); const intel = [...cmd.intel.values()].filter(v => Game.now - v.t < 12).sort((a, b) => b.t - a.t)[0];
    if (intel && !this.alarm) { this.raise(); }
    const tc = this.center('T'), cc = this.center('CT');
    bots.forEach((b, i) => {
      const o = b.brain.order;
      if (this.alarm && intel && (!b.post || i % 2 === 0)) { if (o.type !== 'hunt' || Game.now - o.at > 8) b.brain.setOrder({ type: 'hunt', pos: nearbyPoint(intel.pos, 6), at: Game.now }); return; }
      if (b.post) { if (o.type !== 'hold' || !o.guard) b.brain.setOrder({ type: 'hold', pos: b.post, look: { x: cc.x, z: cc.z }, guard: true, crouch: chance(0.3) }); return; }
      if (o.type !== 'hunt' || Game.now - o.at > 20 || dist2(b.pos.x, b.pos.z, o.pos.x, o.pos.z) < 3) {
        const t = rand(0.4, 1), p = World.nav.randomNear(cc.x + (tc.x - cc.x) * t + rand(-30, 30), cc.z + (tc.z - cc.z) * t + rand(-30, 30), 8);
        if (p) b.brain.setOrder({ type: 'hunt', pos: p, at: Game.now });
      }
    });
  },
  /* allies stay with the nearest person */
  thinkCT(cmd) {
    const H = this.humans().filter(s => s.alive); if (!H.length) return;
    for (const b of cmd.bots()) {
      if (!b.alive || b.npc) continue; const lead = H.sort((x, y) => dist2(x.pos.x, x.pos.z, b.pos.x, b.pos.z) - dist2(y.pos.x, y.pos.z, b.pos.x, b.pos.z))[0];
      const o = b.brain.order, far = dist2(b.pos.x, b.pos.z, lead.pos.x, lead.pos.z) > 6;
      if (o.type !== 'hold' || (far && (!o.pos || dist2(o.pos.x, o.pos.z, lead.pos.x, lead.pos.z) > 5))) { const p = World.nav.randomNear(lead.pos.x, lead.pos.z, 3.5); if (p) b.brain.setOrder({ type: 'hold', pos: p, look: null }); }
    }
  },
  raise() { if (this.alarm) return; this.alarm = true; this.alarmT = Game.now; Game.radio('CT', 'Command', 'They know you\'re here. Expect reinforcements!'); Sfx.play('beep'); if (Net.role === 'host') Net.event({ t: 'cal' }); },
  /* ── per frame (host) ── */
  update(dt) {
    if (!this.on() || !Game.running) return;
    this.markers();
    if (!Game.authority() || Game.matchOver) return;
    const H = this.humans();
    // objectives
    for (const o of this.objs) {
      if (o.st === 'done') continue;
      const near = H.filter(s => s.alive && !s.downed && !s.vehicle && dist2(s.pos.x, s.pos.z, o.x, o.z) < (o.k === 'hostage' ? 2.2 : 2.8) && this.isHolding(s));
      if (o.k === 'gun') {
        if (o.st === 'live' && near.length) { o.prog += dt / 3; if (o.prog >= 1) { o.st = 'armed'; o.fuse = 6; o.by = near[0].id; this.raise(); this.say(`Charge set on the gun. Get clear!`); } }
        else if (o.st === 'live') o.prog = Math.max(0, o.prog - dt * 0.5);
        if (o.st === 'armed') { o.fuse -= dt; if (o.fuse <= 0) this.blow(o); }
      } else if (o.k === 'term') {
        if (near.length) { if (!o.started) { o.started = true; this.raise(); this.say('Download started. Hold the terminal!'); } o.prog = Math.min(1, o.prog + dt / 14); if (o.prog >= 1) { o.st = 'done'; this.say('Download complete.'); this.sync(true); } }
      } else if (o.k === 'hostage') {
        const h = this.hostage;
        if (!h || !h.alive) { this.fail('The hostage was killed'); return; }
        if (o.st === 'live' && near.length) { o.prog += dt / 2; if (o.prog >= 1) { o.st = 'free'; h.freed = near[0].id; this.say('Hostage free. Get them to extraction!'); this.raise(); this.sync(true); } }
        if (o.st === 'free') { o.x = h.pos.x; o.z = h.pos.z; if (dist2(h.pos.x, h.pos.z, this.ex.x, this.ex.z) < 7) { o.st = 'done'; this.win(); return; } }
      }
    }
    // everything done: extract
    if (this.phase === 'go' && this.objs.length && this.objs.every(o => o.st === 'done')) { this.phase = 'ex'; this.say('Objectives complete. Everyone to extraction!'); this.sync(true); }
    if (this.phase === 'ex' && this.mission !== 'rescue') { const up = H.filter(s => s.alive && !s.downed); if (up.length && up.every(s => dist2(s.pos.x, s.pos.z, this.ex.x, this.ex.z) < 10)) { this.win(); return; } }
    // lives
    if (H.length && this.lives <= 0 && H.every(s => !s.alive)) { this.fail('Your squad was wiped out'); return; }
    this.syncT -= dt; if (this.syncT <= 0) this.sync(false);
  },
  isHolding(s) { return s.ctrl === 'local' ? Input.down('KeyE') : !!this.holding.get(s.id); },
  blow(o) {
    o.st = 'done'; const p = new V3(o.x, topBelow(o.x, o.z, 40) + 1, o.z);
    FX.explosion(p); FX.explosion(p.clone().setY(p.y + 1.5)); Sfx.play('explode', p, { vol: 2 }); Game.explosion(p, 320, 5, Game.byId(o.by), 'charge');
    if (o.mesh) { o.mesh.rotation.z = 0.4; o.mesh.position.y -= 0.3; o.mesh.traverse(m => { if (m.material && m.material.color) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.25); } }); }
    this.say(`Gun destroyed (${this.objs.filter(x => x.k === 'gun' && x.st === 'done').length}/3).`); this.sync(true);
    if (Net.role === 'host') Net.event({ t: 'cbl', id: o.id });
  },
  say(text) { Game.radio('CT', 'Command', text); },
  win() { if (Game.matchOver) return; this.phase = 'won'; this.sync(true); Game.endMatch('CT'); },
  fail(why) { if (Game.matchOver) return; this.phase = 'failed'; this.why = why; this.sync(true); Game.endMatch('T'); },
  sync(force) { if (Net.role !== 'host') return; this.syncT = 0.5; Net.event({ t: 'cob', objs: this.objs.map(o => ({ id: o.id, st: o.st, prog: +o.prog.toFixed(2), x: +o.x.toFixed(1), z: +o.z.toFixed(1) })), ph: this.phase, lives: this.lives, pool: this.pool, why: this.why || '' }); },
  markers() {
    const lbl = { gun: 'Artillery', term: 'Terminal', hostage: 'Hostage' }, ic = { gun: '✸', term: '⌨', hostage: '☺' };
    for (const o of this.objs) {
      const done = o.st === 'done';
      Markers.set(o.id, { x: o.x, y: topBelow(o.x, o.z, 40) + (o.k === 'hostage' ? 2.4 : 2.6), z: o.z, label: o.k === 'hostage' && o.st === 'free' ? 'Escort' : o.st === 'armed' ? 'CHARGE SET' : lbl[o.k], icon: ic[o.k], color: o.st === 'armed' ? '#ff5a4a' : '#ffd24a', prog: o.st === 'live' && o.prog > 0 || (o.k === 'term' && !done && o.prog > 0) ? o.prog : null, hidden: done });
      if (o.k === 'term' && o.screen) o.screen.material.color.setHex(done ? 0x2a6aff : o.prog > 0 ? 0xffd24a : 0x3aff8a);
    }
    const ex = Markers.list.get('ex'); if (ex) ex.hidden = !(this.phase === 'ex' || (this.mission === 'rescue' && this.objs[0] && this.objs[0].st === 'free'));
    Markers.update();
  },
};
/* the hostage: hands on head until freed, then follows whoever freed them */
class HostageBrain extends Brain {
  update(dt) {
    const s = this.s, m = s.moveIn; m.f = m.s = 0; m.jump = m.crouch = m.walk = m.sprint = false;
    if (!s.freed) { m.crouch = true; return; }
    let lead = Game.byId(s.freed); if (!lead || !lead.alive) { const H = Coop.humans().filter(h => h.alive); lead = H.sort((a, b) => dist2(a.pos.x, a.pos.z, s.pos.x, s.pos.z) - dist2(b.pos.x, b.pos.z, s.pos.x, s.pos.z))[0]; if (lead) s.freed = lead.id; }
    if (!lead) return;
    const d = dist2(lead.pos.x, lead.pos.z, s.pos.x, s.pos.z);
    if (d > 2.4) { this.moveTo(lead.pos, dt, false, false, d > 6); if (d > 6) m.sprint = true; }
    this.turnTo(Math.atan2(-(lead.pos.x - s.pos.x), -(lead.pos.z - s.pos.z)), 0, dt, 6);
  }
}
/* ── hooks ─────────────────────────────────────────────────────────────── */
const _prep54 = Game.prepareRoster.bind(Game);
Game.prepareRoster = function (cfg) {
  if (cfg.mode !== 'coop' || cfg.roster) return _prep54(cfg);
  for (const p of cfg.players) p.team = 'CT';
  const size = cfg.teamSize || 4, enemies = Math.round(6 + size * 1.5), keep = cfg.teamSize;
  cfg.teamSize = Math.max(size, enemies); const r = _prep54(cfg); cfg.teamSize = keep;
  const humans = r.filter(x => x.team === 'CT' && !x.isBot), allies = r.filter(x => x.team === 'CT' && x.isBot).slice(0, Math.max(0, size - humans.length)), foes = r.filter(x => x.team === 'T').slice(0, enemies);
  return cfg.roster = humans.concat(allies, foes);
};
const _start54 = Game.start.bind(Game);
Game.start = function (cfg) {
  const r = _start54(cfg);
  if (Coop.on()) { this.tdm = { kills: { T: 0, CT: 0 }, timeLeft: 0 }; Coop.start(cfg); }
  else { Coop.phase = 'off'; Markers.clear(); }
  return r;
};
const _gupdate54 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate54(dt); Coop.update(dt); if (!this.running || !Coop.on()) Markers.update(); };
const _cmdUpd54 = Commander.prototype.update;
Commander.prototype.update = function (dt) {
  if (!Coop.on()) return _cmdUpd54.call(this, dt);
  this.radioCd -= dt; this.thinkT -= dt; if (this.thinkT > 0) return; this.thinkT = 0.5;
  if (this.team === 'T') Coop.thinkT(this); else Coop.thinkCT(this);
};
/* lives and reinforcements */
const _kill54 = Game.kill.bind(Game);
Game.kill = function (v, att, weapon, hs) {
  const was = v && v.alive, r = _kill54(v, att, weapon, hs);
  if (Coop.on() && was && v && !v.alive && Game.authority()) {
    if (v.team === 'CT' && !v.isBot && !v.npc) { Coop.lives = Math.max(0, Coop.lives - 1); if (Coop.lives <= 0) { v.respawnT = 1e9; Game.radio('CT', 'Command', 'No more reinforcements for your squad!'); } Coop.sync(true); }
    if (v.team === 'T') { Coop.pool--; if (Coop.pool <= 0) v.respawnT = 1e9; else if (v.post && Coop.alarm) v.post = null; }
  }
  return r;
};
const _respawn54 = Game.respawn.bind(Game);
Game.respawn = function (s, where) {
  if (Coop.on() && s.team === 'CT' && !s.isBot && !s.npc && Coop.lives <= 0 && Coop.phase !== 'off' && Game.running && Game.now > 1) { if (s === Game.local) HUD.center('No lives left · spectating', 2); return; }
  if (Coop.on() && s.team === 'T' && Coop.alarm && s.ctrl === 'bot') s.post = s.post && chance(0.5) ? s.post : null;
  return _respawn54(s, where);
};
/* E is the interact key: don't also get into vehicles next to objectives */
const _pc54 = Player.controls.bind(Player);
Player.controls = function (s, dt) {
  if (Coop.on() && Net.role === 'client') { const on = Input.down('KeyE'); if (on !== !!Coop.myHold) { Coop.myHold = on; Net.send({ t: 'coh', on: on ? 1 : 0 }); } }
  return _pc54(s, dt);
};
const _hostData54 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  if (m && m.t === 'coh') { const p = this.peers.get(id); if (p && p.sid) Coop.holding.set(p.sid, !!m.on); return; }
  return _hostData54(id, m);
};
const _applyEvent54 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  switch (e && e.t) {
    case 'cst': Coop.mission = e.m; Coop.objs = e.objs.map(o => Object.assign({}, o)); Coop.ex = e.ex; Coop.lives = e.lives; Coop.phase = 'go'; Coop.buildObjs(); return;
    case 'cob': for (const u of e.objs) { const o = Coop.objs.find(x => x.id === u.id); if (o) { if (u.st === 'done' && o.st !== 'done' && o.k === 'term' && Game.local) HUD.center('Download complete', 1.5); Object.assign(o, u); } } Coop.phase = e.ph; Coop.lives = e.lives; Coop.pool = e.pool; Coop.why = e.why; return;
    case 'cal': Coop.alarm = true; return;
    case 'cbl': { const o = Coop.objs.find(x => x.id === e.id); if (o && o.mesh) { o.st = 'done'; o.mesh.rotation.z = 0.4; o.mesh.traverse(m => { if (m.material && m.material.color) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.25); } }); } return; }
  }
  return _applyEvent54(e);
};
/* HUD */
const _hud54 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hud54(dt); if (!Coop.on() || !Game.local) return; const E = this.el, L = Game.local;
  E.timer.textContent = MISSIONS[Coop.mission] ? MISSIONS[Coop.mission].name.toUpperCase() : 'CO-OP'; E.timer.classList.remove('bomb', 'freeze');
  E.scCT.textContent = Coop.lives; E.scT.textContent = Math.max(0, Coop.pool);
  const todo = Coop.objs.filter(o => o.st !== 'done').length, total = Coop.objs.length;
  E.rinfo.textContent = Coop.phase === 'ex' ? 'Get to extraction' : Coop.mission === 'rescue' ? (Coop.objs[0] && Coop.objs[0].st === 'free' ? 'Escort the hostage to extraction' : 'Find and free the hostage') : `${total - todo}/${total} objectives · lives ${Coop.lives}${Coop.alarm ? ' · ALARM' : ''}`;
  if (L.alive && !L.vehicle && E.hint) { const o = Coop.objs.find(o => o.st !== 'done' && o.st !== 'armed' && o.st !== 'free' && dist2(o.x, o.z, L.pos.x, L.pos.z) < 2.8); if (o) { E.hint.textContent = `Hold E — ${o.k === 'gun' ? 'plant charge' : o.k === 'term' ? 'download intel' : 'free the hostage'}`; E.hint.style.opacity = 1; } }
};
const _results54 = UI.matchResults.bind(UI);
UI.matchResults = function (r) {
  _results54(r); if (!Coop.on()) return;
  const el = document.getElementById('results'), h = el && el.querySelector('h1'); if (h) h.textContent = r.won ? 'MISSION COMPLETE' : 'MISSION FAILED';
  const sub = el && el.querySelector('.rsub'); if (sub) sub.textContent = `${MISSIONS[Coop.mission].name} · ${World.def.name}${!r.won && Coop.why ? ' · ' + Coop.why : ''} · ${fmtTime(r.dur)}`;
};
const _finish54 = Game.finishMatch.bind(Game);
Game.finishMatch = function (winner) { if (Coop.on() && Game.local && winner === 'CT') Game.local.mvps = Math.max(Game.local.mvps || 0, 1); return _finish54(winner); };
/* no leaving the hostage behind in a car, and Vanta doesn't shoot at them on purpose */
const _stop54 = Game.stop.bind(Game);
Game.stop = function () { Markers.clear(); return _stop54(); };
