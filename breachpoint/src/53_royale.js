/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Royale.
   Everyone for themselves. The match starts with a HALO drop across the
   map; you land with a knife and a pistol. Crates everywhere hold guns,
   armour, med kits and grenades (walk up and press E). A blue storm wall
   closes in, stage by stage; outside it you lose health, faster each
   stage. Last one standing wins. No respawns, no revives.
   Uniform colours are just for looks: everyone is hostile to everyone.
   ═══════════════════════════════════════════════════════════════════════════ */
INJ_W.add('storm');
MODES.royale = { id: 'royale', name: 'Royale', headMult: 2.5, armor: true, teamSize: 10, respawn: false, respawnTime: 1e9, regen: false, sprint: true, classes: false, noTeam: true,
  sizes: [6, 10, 15], sizeLabel: 'Players', sizeFmt: n => `${n * 2} players`, maps: ['city', 'ridgeline', 'frostpeak', 'oasis'].filter(m => MAPS[m]), desc: 'Last one standing' };
const LOOT = {
  common: ['mp9', 'mac10', 'ump45', 'nova', 'p90', 'tec9', 'fiveseven', 'deagle'],
  uncommon: ['ak47', 'm4a4', 'galil', 'famas', 'xm1014', 'vector', 'aug', 'scar'],
  rare: ['awp', 'ssg', 'm249', 'autosniper', 'm14', 'mg42', 'dbarrel'],
  epic: ['rpg', 'minigun', 'railgun'],
};
const LOOT_COL = { common: '#b0c3d9', uncommon: '#5e98d9', rare: '#8847ff', epic: '#e4ae39' };
const ZONE_STAGES = [[50, 40, 0.5, 1], [35, 35, 0.3, 2], [30, 30, 0.16, 4], [25, 25, 0.06, 7], [20, 20, 0, 12]];   // wait, shrink, radius (of the first), damage/s
const Royale = {
  crates: [], zone: null, wall: null, ring: null, alive0: 0, placeOf: {}, syncT: 0, dmgT: 0, aiT: 0, nextCrate: 1,
  on() { return !!(Game.mode && Game.mode.id === 'royale'); },
  R0() { const B = World.bounds; return Math.hypot(B.x1 - B.x0, B.z1 - B.z0) / 2 + 4; },
  aliveList() { return Game.soldiers.filter(s => s.alive && !s.npc && s.team !== 'Z'); },
  /* ── start ── */
  start() {
    const B = World.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    this.placeOf = {}; this.crates.forEach(c => c.mesh.parent && c.mesh.parent.remove(c.mesh)); this.crates = [];
    this.zone = { x: cx, z: cz, r: this.R0(), fx: cx, fz: cz, fr: this.R0(), nx: cx, nz: cz, nr: this.R0(), st: -1, ph: 'wait', t: 20 };
    this.nextStage();
    this.buildVisuals();
    if (Game.authority()) {
      // crates on open ground, spread out
      const n = Math.round(clamp((B.x1 - B.x0) * (B.z1 - B.z0) / 900, 26, 60)), r = mulberry(hashStr(World.id + ':' + Math.floor(Date.now() / 1000)));
      for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
        const p = World.nav.randomNear(B.x0 + r() * (B.x1 - B.x0), B.z0 + r() * (B.z1 - B.z0), 6); if (!p) continue;
        if (this.crates.some(c => dist2(c.x, c.z, p.x, p.z) < 18)) continue;
        const tier = r() < 0.06 ? 'epic' : r() < 0.22 ? 'rare' : r() < 0.55 ? 'uncommon' : 'common';
        this.addCrate({ id: 'c' + (this.nextCrate++), x: +p.x.toFixed(2), z: +p.z.toFixed(2), tier }); i++;
      }
      // the drop: a line across the map at 150 m
      const spots = [];
      for (const s of Game.soldiers) {
        let p = null;
        for (let k = 0; k < 40 && !p; k++) { const q = { x: rand(B.x0 + 8, B.x1 - 8), z: rand(B.z0 + 8, B.z1 - 8) }; if (!spots.some(o => dist2(o.x, o.z, q.x, q.z) < Math.max(12, 30 - k * 0.5))) p = q; }
        p = p || { x: rand(B.x0 + 8, B.x1 - 8), z: rand(B.z0 + 8, B.z1 - 8) }; spots.push(p); this.drop(s, p.x, p.z);
      }
      this.alive0 = this.aliveList().length;
      if (Net.role === 'host') Net.event({ t: 'rcr', list: this.crates.map(c => ({ id: c.id, x: c.x, z: c.z, tier: c.tier })) });
    }
    HUD.showDeploy(false);
    setTimeout(() => { if (Game.running && this.on()) HUD.center('ROYALE · last one standing · E opens crates', 3); }, 800);
  },
  drop(s, x, z) {
    Game.respawn(s);
    x = clamp(x, World.bounds.x0 + 4, World.bounds.x1 - 4); z = clamp(z, World.bounds.z0 + 4, World.bounds.z1 - 4);
    s.pos.set(x, 150 + topBelow(x, z, 300), z); s.vel.set(0, -2, 0); s.grounded = false; s.freefall = true; s.spawnProt = Game.now + 60; s.dropping = true; s.yaw = rand(0, TAU);
    this.kit(s); Net.onSpawn(s);
  },
  kit(s) {
    s.weapons = { 1: null, 2: 'glock', 3: 'knife', 4: null }; s.ammo = {}; s.fillAmmo('glock'); s.ammo.glock.res = 40;
    s.nades = { frag: 0, flash: 0, smoke: 0 }; s.armor = 0; s.helmet = false; s.meds = 0; s.medkits = 0; s.ammoBoxes = 0; s.cur = 'glock'; s.drawT = 0.5; s.pickW = null;
  },
  /* ── crates ── */
  addCrate(c) {
    if (this.crates.some(o => o.id === c.id)) return;
    const g = new THREE.Group(), col = LOOT_COL[c.tier] || '#b0c3d9';
    g.add(bx(0.9, 0.55, 0.6, lam('#4a5238'), 0, 0.28, 0)); g.add(bx(0.94, 0.08, 0.64, lam('#5a6448'), 0, 0.58, 0));
    const lid = bx(0.7, 0.04, 0.45, new THREE.MeshBasicMaterial({ color: col }), 0, 0.63, 0); g.add(lid);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.dot, color: new THREE.Color(col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); glow.scale.set(1.6, 1.6, 1); glow.position.y = 1.0; g.add(glow);
    const y = topBelow(c.x, c.z, 50); g.position.set(c.x, y, c.z); g.rotation.y = rand(0, TAU); Game.scene.add(g);
    this.crates.push(Object.assign({ mesh: g, glow, open: false }, c));
  },
  openCrate(c) { if (c.open) return; c.open = true; c.glow.visible = false; c.mesh.children[2].visible = false; c.mesh.children[1].position.set(0, 0.62, -0.3); c.mesh.children[1].rotation.x = -1.1; Sfx.play('reload', new V3(c.x, 0.5, c.z)); },
  roll(c, rr = Math.random) {
    const items = [], pickL = a => a[Math.floor(rr() * a.length)];
    const tierW = c.tier === 'epic' ? ['epic', 'rare'] : c.tier === 'rare' ? ['rare', 'uncommon'] : c.tier === 'uncommon' ? ['uncommon', 'common'] : ['common', 'uncommon'];
    items.push({ k: 'w', w: pickL(LOOT[rr() < 0.75 ? tierW[0] : tierW[1]]) });
    if (rr() < 0.55) items.push({ k: 'armor', n: c.tier === 'common' ? 50 : 100 });
    if (rr() < 0.5) items.push({ k: 'med', n: 1 + (rr() < 0.3 ? 1 : 0) });
    if (rr() < 0.45) items.push({ k: 'nade', n: pickL(['frag', 'frag', 'smoke', 'flash']) });
    items.push({ k: 'ammo' });
    return items;
  },
  /* host: someone opened a crate */
  loot(s, id) {
    const c = this.crates.find(o => o.id === id); if (!c || c.open || !s || !s.alive || dist2(c.x, c.z, s.pos.x, s.pos.z) > (s.ctrl === 'remote' ? 5 : 3.2)) return;
    const items = this.roll(c); this.openCrate(c);
    if (Net.role === 'host') Net.event({ t: 'rco', id });
    if (s.ctrl === 'bot' || s.ctrl === 'local') this.give(s, items);
    else { const pr = Net.peerOf(s.id); if (pr) Net.to(pr.id, { t: 'ev', e: { t: 'rgive', items } }); }
  },
  give(s, items) {
    const got = [];
    for (const it of items) {
      if (it.k === 'w') { const W = WEAPONS[it.w]; if (!W) continue; if (W.slot === 4) { s.weapons[4] = it.w; s.fillAmmo(it.w); s.switchTo(it.w); } else s.give(it.w); got.push(W.name); }
      else if (it.k === 'armor') { if (it.n > s.armor) { s.armor = it.n; s.helmet = it.n >= 100 || s.helmet; } got.push(`Armour ${it.n}`); }
      else if (it.k === 'med') { s.meds = Math.min(4, (s.meds || 0) + it.n); got.push(`Med kit ×${it.n}`); }
      else if (it.k === 'nade') { s.nades[it.n] = Math.min(3, (s.nades[it.n] || 0) + 1); got.push(GRENADES[it.n] ? GRENADES[it.n].name : it.n); }
      else if (it.k === 'ammo') { for (const id in s.ammo) { const w = s.stat(id); if (!w || !w.mag || w.type === 'launcher') continue; s.ammo[id].res = Math.min(w.reserve * 1.5, s.ammo[id].res + w.mag * 2); } }
    }
    if (s.ctrl === 'local') { HUD.center('Looted: ' + got.join(' · '), 2); Sfx.play('buy'); }
  },
  /* ── the zone ── */
  nextStage() {
    const Z = this.zone; Z.st++;
    const S = ZONE_STAGES[Math.min(Z.st, ZONE_STAGES.length - 1)];
    Z.fx = Z.nx; Z.fz = Z.nz; Z.fr = Z.nr;
    const nr = this.R0() * S[2], room = Math.max(0, Z.fr - nr), a = rand(0, TAU), d = Math.sqrt(Math.random()) * room;
    let nx = Z.fx + Math.cos(a) * d, nz = Z.fz + Math.sin(a) * d;
    const i = World.nav.nearest(nx, nz, 20); if (i >= 0 && Math.hypot(World.nav.cx(i) - Z.fx, World.nav.cz(i) - Z.fz) <= room + 0.01) { nx = World.nav.cx(i); nz = World.nav.cz(i); }
    Z.nx = nx; Z.nz = nz; Z.nr = nr; Z.ph = 'wait'; Z.t = Z.st === 0 ? S[0] + 25 : S[0]; Z.dps = S[3];
  },
  updateZone(dt) {
    const Z = this.zone; if (!Z) return;
    Z.t -= dt;
    const S = ZONE_STAGES[Math.min(Z.st, ZONE_STAGES.length - 1)];
    if (Z.ph === 'wait') { if (Z.t <= 0) { Z.ph = 'shrink'; Z.t = S[1]; if (Game.local) { HUD.center('THE STORM IS CLOSING IN', 2.5); Sfx.play('capture'); } } }
    else if (Z.ph === 'shrink') {
      const k = clamp(1 - Z.t / S[1], 0, 1); Z.x = lerp(Z.fx, Z.nx, k); Z.z = lerp(Z.fz, Z.nz, k); Z.r = lerp(Z.fr, Z.nr, k);
      if (Z.t <= 0) { Z.x = Z.nx; Z.z = Z.nz; Z.r = Z.nr; if (Z.st < ZONE_STAGES.length - 1) this.nextStage(); else Z.ph = 'final'; }
    }
  },
  outside(s) { const Z = this.zone; return Z && Math.hypot(s.pos.x - Z.x, s.pos.z - Z.z) > Z.r; },
  buildVisuals() {
    const g = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true);
    this.wall = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x3a8cff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.wall.frustumCulled = false; this.wall.renderOrder = 5; Game.scene.add(this.wall);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.frustumCulled = false; Game.scene.add(this.ring);
    this.tint = document.getElementById('stormTint') || Object.assign(document.createElement('div'), { id: 'stormTint' }); document.body.appendChild(this.tint);
  },
  updateVisuals() {
    const Z = this.zone; if (!Z || !this.wall) return;
    this.wall.position.set(Z.x, 60, Z.z); this.wall.scale.set(Math.max(0.5, Z.r), 160, Math.max(0.5, Z.r));
    this.wall.material.opacity = 0.18 + Math.sin(Game.now * 2) * 0.04;
    this.ring.position.set(Z.nx, 0.15, Z.nz); this.ring.scale.setScalar(Math.max(0.5, Z.nr)); this.ring.visible = Z.ph !== 'final' && Z.nr > 0.5;
    const L = Game.local; this.tint.style.display = L && L.alive && this.outside(L) ? '' : 'none';
  },
  /* ── the host's per-frame work ── */
  update(dt) {
    if (!this.on() || !Game.running) return;
    this.updateZone(dt); this.updateVisuals();
    if (!Game.authority()) return;
    // landed: a few seconds of cover, then fair game
    for (const s of Game.soldiers) if (s.dropping && s.alive && s.grounded && !s.chute) { s.dropping = false; s.spawnProt = Game.now + 4; }
    // storm damage
    this.dmgT -= dt; if (this.dmgT <= 0) { this.dmgT = 1; for (const s of this.aliveList()) if (this.outside(s)) Game.damage(s, this.zone.dps || 1, null, 'storm', 'chest'); }
    // crates: bots grab what they walk over; the local player presses E
    for (const s of Game.soldiers) if (s.alive && s.ctrl === 'bot') for (const c of this.crates) if (!c.open && dist2(c.x, c.z, s.pos.x, s.pos.z) < 2.2 && s.grounded) this.loot(s, c.id);
    this.ai(dt);
    // winner
    const A = this.aliveList();
    if (!Game.matchOver && this.alive0 > 1 && A.length <= 1) { const w = A[0]; if (w) this.placeOf[w.id] = 1; Game.endMatch(w ? 'id:' + w.id : 'none'); }
    this.syncT -= dt; if (this.syncT <= 0 && Net.role === 'host') { this.syncT = 1; const Z = this.zone; Net.event({ t: 'rzn', z: [Z.x, Z.z, Z.r, Z.fx, Z.fz, Z.fr, Z.nx, Z.nz, Z.nr, Z.st, Z.t].map(v => +(+v).toFixed(2)), ph: Z.ph, n: A.length }); }
  },
  /* bots: loot when under-armed, stay inside the zone, otherwise roam */
  ai(dt) {
    this.aiT -= dt; if (this.aiT > 0) return; this.aiT = 0.5;
    const Z = this.zone;
    for (const s of Game.soldiers) {
      if (s.ctrl !== 'bot' || !s.alive || !s.brain || s.chute || (s.freefall && !s.grounded)) continue;
      const b = s.brain; if (b.target && b.target.alive) continue;
      const o = b.order, dz = Math.hypot(s.pos.x - Z.x, s.pos.z - Z.z), threat = Z.ph === 'shrink' ? Z.nr : Z.r;
      const goingSafe = o.type === 'hunt' && o.safe && Game.now - o.at < 15;
      if (dz > Z.r * 0.9 || (Z.ph === 'shrink' && Math.hypot(s.pos.x - Z.nx, s.pos.z - Z.nz) > Z.nr * 0.85)) {
        if (!goingSafe) { const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * Math.max(2, (Z.ph === 'shrink' ? Z.nr : Z.r) * 0.6), p = World.nav.randomNear((Z.ph === 'shrink' ? Z.nx : Z.x) + Math.cos(a) * rr, (Z.ph === 'shrink' ? Z.nz : Z.z) + Math.sin(a) * rr, 6); if (p) b.setOrder({ type: 'hunt', pos: p, at: Game.now, safe: true }); }
        continue;
      }
      const armed = !!s.weapons[1], wantLoot = !armed || s.armor < 50 || (s.meds || 0) < 1;
      if (wantLoot && !(o.type === 'hunt' && o.rcrate && Game.now - o.at < 12)) {
        let best = null, bd = armed ? 30 : 60;
        for (const c of this.crates) { if (c.open || Math.hypot(c.x - Z.x, c.z - Z.z) > threat) continue; const d = dist2(c.x, c.z, s.pos.x, s.pos.z); if (d < bd) { bd = d; best = c; } }
        if (best) { b.setOrder({ type: 'hunt', pos: { x: best.x, z: best.z }, at: Game.now, rcrate: best.id }); continue; }
      }
      if (o.type !== 'hunt' || Game.now - o.at > 14 || dist2(s.pos.x, s.pos.z, o.pos.x, o.pos.z) < 4) {
        const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * threat * 0.8, p = World.nav.randomNear(Z.x + Math.cos(a) * rr, Z.z + Math.sin(a) * rr, 8);
        if (p) b.setOrder({ type: 'hunt', pos: p, at: Game.now });
      }
      // heal when calm
      if (s.hp < 60 && s.meds > 0 && s.healT <= 0) Game.useMed(s);
    }
  },
};
/* ── hooks ─────────────────────────────────────────────────────────────── */
/* roster: half in each uniform, bots fill it */
const _start53 = Game.start.bind(Game);
Game.start = function (cfg) {
  const r = _start53(cfg);
  if (Royale.on()) { this.tdm = { kills: { T: 0, CT: 0 }, timeLeft: 0 }; Royale.start(); }
  else { if (Royale.wall && Royale.wall.parent) Royale.wall.parent.remove(Royale.wall); Royale.zone = null; if (Royale.tint) Royale.tint.style.display = 'none'; }
  return r;
};
const _gupdate53 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate53(dt); Royale.update(dt); };
/* everyone is hostile */
const _hostile53 = Game.hostile;
Game.hostile = function (a, b) { if (Royale.on() && a && b && a !== b && b.alive && a.team !== 'Z' && b.team !== 'Z' && !b.npc && !a.npc) return true; return _hostile53.call(this, a, b); };
/* teams only for looks: damage, kills and blasts ignore them */
function royaleSolo(fn, who) {
  if (!Royale.on() || !who) return fn();
  const t = who.team, k = '_' + who.id; if (t === k) return fn();
  if (!TEAM_STYLE[k]) TEAM_STYLE[k] = TEAM_STYLE[t] || TEAM_STYLE.T;
  const hadCmd = k in Game.cmd; if (!hadCmd) Game.cmd[k] = Game.cmd[t];
  who.team = k; try { return fn(); } finally { who.team = t; if (!hadCmd) delete Game.cmd[k]; }
}
const _damage53 = Game.damage.bind(Game);
Game.damage = function (v, dmg, att, weapon, zone, from) { return royaleSolo(() => _damage53(v, dmg, att, weapon, zone, from), att && att !== v ? att : null); };
const _kill53 = Game.kill.bind(Game);
Game.kill = function (v, att, weapon, hs) {
  if (Royale.on() && v && v.alive) { Royale.placeOf[v.id] = Royale.aliveList().length; }
  return royaleSolo(() => _kill53(v, att, weapon, hs), att && att !== v ? att : null);
};
const _expl53 = Game.explosion.bind(Game);
Game.explosion = function (p, dmg, radius, owner, weapon) { return royaleSolo(() => _expl53(p, dmg, radius, owner, weapon), owner); };
const _onKill53 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  const a = this.byId(ev.a);
  const r = royaleSolo(() => _onKill53(ev), a && ev.a !== ev.v ? a : null);
  if (Royale.on() && this.byId(ev.v) === this.local && this.local) {
    const place = Royale.placeOf[this.local.id] || Royale.aliveList().length + 1; this.local.place = place;
    setTimeout(() => { if (Game.running && !Game.finished) Game.finishMatch('lost'); }, 3500);
  }
  return r;
};
/* no deploy screen: you're dropped in */
const _showDeploy53 = HUD.showDeploy.bind(HUD);
HUD.showDeploy = function (on) { if (on && Royale.on()) return; return _showDeploy53(on); };
/* results: your place */
const _finish53 = Game.finishMatch.bind(Game);
Game.finishMatch = function (winner) {
  if (!Royale.on()) return _finish53(winner);
  const L = this.local; if (!L) return;
  const won = typeof winner === 'string' && winner === 'id:' + L.id;
  if (won) L.place = 1;
  L.mvps = won ? 1 : 0;
  const mo = this.matchOver, r = _finish53(won ? L.team : other(L.team));
  if (winner === 'lost') this.matchOver = mo;   // you're out, the others play on
  return r;
};
const _endMatch53 = Game.endMatch.bind(Game);
Game.endMatch = function (winner) { return _endMatch53(winner); };
const _results53 = UI.matchResults.bind(UI);
UI.matchResults = function (r) {
  _results53(r); if (!Royale.on()) return;
  const L = Game.local, el = document.getElementById('results'); if (!el || !L) return;
  const n = Royale.alive0 || Game.soldiers.length, place = L.place || (L.alive ? 1 : n);
  const h = el.querySelector('h1'); if (h) h.textContent = place === 1 ? 'VICTORY ROYALE' : `#${place} OF ${n}`;
  const sub = el.querySelector('.rsub'); if (sub) sub.textContent = `${L.kills} kills · Royale · ${World.def.name} · ${fmtTime(r.dur)}`;
  const t = el.querySelector('.rteams');
  if (t) {
    const rows = Game.soldiers.filter(s => !s.npc).map(s => ({ s, p: s.alive ? 1 : Royale.placeOf[s.id] || n })).sort((a, b) => a.p - b.p || b.s.kills - a.s.kills).slice(0, 12);
    t.innerHTML = `<div class="rt won"><div class="rth"><b>Standings</b></div><table><tr><th>#</th><th></th><th>K</th><th>Dmg</th></tr>${rows.map(({ s, p }) => `<tr class="${s === L ? 'me' : ''}"><td>${p}</td><td>${s.isBot ? '<i>BOT</i> ' : ''}${escapeHtml(s.name)}</td><td>${s.kills}</td><td>${Math.round(s.dmgDealt || 0)}</td></tr>`).join('')}</table></div>`;
  }
};
/* E on a crate */
const _pc53 = Player.controls.bind(Player);
Player.controls = function (s, dt) {
  if (Royale.on() && s.alive && !s.vehicle && Input.hit('KeyE')) {
    let best = null, bd = 2.6; for (const c of Royale.crates) { if (c.open) continue; const d = dist2(c.x, c.z, s.pos.x, s.pos.z); if (d < bd) { bd = d; best = c; } }
    if (best) { if (Game.authority()) Royale.loot(s, best.id); else { Net.send({ t: 'rloot', id: best.id }); Royale.openCrate(best); } }
  }
  return _pc53(s, dt);
};
/* HUD: players left, storm timer, crate hint; no friends on the radar */
const _hud53 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hud53(dt); if (!Royale.on() || !Game.local) return; const E = this.el, Z = Royale.zone, L = Game.local; if (!Z) return;
  const left = Game.authority() ? Royale.aliveList().length : (Royale.left || 0);
  E.timer.textContent = Z.ph === 'wait' ? `STORM ${Math.max(0, Math.ceil(Z.t))}s` : Z.ph === 'shrink' ? `CLOSING ${Math.max(0, Math.ceil(Z.t))}s` : 'FINAL';
  E.timer.classList.toggle('bomb', Z.ph === 'shrink'); E.scCT.textContent = left; E.scT.textContent = L.kills;
  E.rinfo.textContent = `${left} left · ${L.kills} kills${L.alive && Royale.outside(L) ? ' · IN THE STORM, get inside!' : ''}`;
  if (L.alive && !L.vehicle && E.hint) { const c = Royale.crates.find(c => !c.open && dist2(c.x, c.z, L.pos.x, L.pos.z) < 2.6); if (c) { E.hint.textContent = `E — open ${c.tier} crate`; E.hint.style.opacity = 1; } }
};
const _teamSees53 = HUD.teamSees.bind(HUD);
HUD.teamSees = function (e) { if (Royale.on()) return false; return _teamSees53(e); };
const _radar53 = HUD.drawRadar.bind(HUD);
HUD.drawRadar = function () {
  const L = Game.local; if (!Royale.on() || !L) return _radar53();
  const t = L.team; L.team = '_'; try { _radar53(); } finally { L.team = t; }
  const c = this.rctx, R = this.el.radar.width, Z = Royale.zone; if (!Z || !this.radarImg) return;
  const zoom = 1.1, cam = L.alive ? L.pos : Game.camera.position, yaw = L.alive ? L.yaw : 0;
  c.save(); c.beginPath(); c.arc(R / 2, R / 2, R / 2 - 2, 0, TAU); c.clip(); c.translate(R / 2, R / 2); c.rotate(yaw); c.scale(zoom, zoom); c.translate(-this.wx(cam.x), -this.wz(cam.z));
  c.lineWidth = 2.5 / zoom; c.strokeStyle = '#4aa0ff'; c.beginPath(); c.arc(this.wx(Z.x), this.wz(Z.z), Z.r * this.radarScale, 0, TAU); c.stroke();
  if (Z.ph !== 'final') { c.strokeStyle = '#ffffff'; c.setLineDash([6 / zoom, 5 / zoom]); c.beginPath(); c.arc(this.wx(Z.nx), this.wz(Z.nz), Z.nr * this.radarScale, 0, TAU); c.stroke(); c.setLineDash([]); }
  for (const cr of Royale.crates) if (!cr.open && dist2(cr.x, cr.z, cam.x, cam.z) < 60) { c.fillStyle = LOOT_COL[cr.tier]; c.fillRect(this.wx(cr.x) - 3 / zoom, this.wz(cr.z) - 3 / zoom, 6 / zoom, 6 / zoom); }
  c.restore();
};
/* uniforms don't make friends: name tags and outlines as enemies */
const _sync53 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) { return _sync53.call(this, dt, Royale.on() && this !== Game.local ? '_' : localTeam, viewer); };
/* bots don't waste bullets on people still dropping in */
const _enemies53 = Brain.prototype.enemies;
Brain.prototype.enemies = function () { const l = _enemies53.call(this); return Royale.on() ? l.filter(e => !(e.spawnProt > Game.now)) : l; };
/* commanders stay quiet */
const _cmdUpd53 = Commander.prototype.update;
Commander.prototype.update = function (dt) { if (Royale.on()) { this.radioCd -= dt; return; } return _cmdUpd53.call(this, dt); };
const _radio53 = Game.radio.bind(Game);
Game.radio = function (team, from, text) { if (Royale.on()) return; return _radio53(team, from, text); };
/* network */
const _hostData53 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  if (m && m.t === 'rloot') { const p = this.peers.get(id), s = p && p.sid && Game.byId(p.sid); if (s) Royale.loot(s, m.id); return; }
  return _hostData53(id, m);
};
const _applyEvent53 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  switch (e && e.t) {
    case 'rcr': for (const c of e.list || []) Royale.addCrate(c); return;
    case 'rco': { const c = Royale.crates.find(o => o.id === e.id); if (c) Royale.openCrate(c); return; }
    case 'rgive': { const L = Game.local; if (L) Royale.give(L, e.items || []); return; }
    case 'rzn': { const Z = Royale.zone; if (!Z) return; [Z.x, Z.z, Z.r, Z.fx, Z.fz, Z.fr, Z.nx, Z.nz, Z.nr, Z.st, Z.t] = e.z; Z.ph = e.ph; Royale.left = e.n; return; }
  }
  return _applyEvent53(e);
};
/* the storm as a cause of death */
const _killfeed53 = HUD.killfeed.bind(HUD);
HUD.killfeed = function (a, v, w, hs) { return _killfeed53(a, v, w === 'storm' ? 'fall' : w, hs); };
