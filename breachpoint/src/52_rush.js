/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Breakthrough.
   Vanta attacks, Aegis defends. The flags are split into sectors from the
   attackers' side to the defenders'. Only the current sector can be
   captured; take all of its flags and the defenders fall back to the next
   one while the attackers get reinforcements. Attackers have limited
   tickets (one per death); defenders have as many as they like. Attackers
   win by taking the last sector, defenders by running them out of tickets.
   It runs on top of Conquest (flags, squads, vehicles, HALO), so under the
   hood its mode id is 'conquest' with a rush flag.
   ═══════════════════════════════════════════════════════════════════════════ */
MODES.rush = Object.assign({}, MODES.conquest, { id: 'conquest', key: 'rush', rush: true, name: 'Breakthrough', tickets: 120, reinforce: 45, teamSize: 12, armor: true,
  maps: ['ridgeline', 'frostpeak', 'oasis', 'city'].filter(m => MAPS[m]), desc: 'Attack sector by sector, or hold the line' });
const Rush = {
  sectors: [], active: 0, on() { return !!(Game.mode && Game.mode.rush); },
  /* flags sorted from the attackers' HQ outward, in pairs (the first alone when odd) */
  build() {
    const hq = World.hq.T || { x: 0, z: -100 };
    const F = World.flags.slice().sort((a, b) => dist2(a.x, a.z, hq.x, hq.z) - dist2(b.x, b.z, hq.x, hq.z));
    this.sectors = []; let i = 0; if (F.length % 2) this.sectors.push([F[i++]]); while (i < F.length) this.sectors.push(F.slice(i, i += 2));
    this.sectors.forEach((sec, k) => sec.forEach(f => { f.sector = k; }));
    this.active = 0; for (const f of World.flags) { f.owner = 'CT'; f.prog = 1; } this.apply();
  },
  apply() {
    for (const f of World.flags) {
      f.locked = f.sector !== this.active;
      if (f.sector < this.active) { f.owner = 'T'; f.prog = -1; }
      else if (f.sector > this.active) { f.owner = 'CT'; f.prog = 1; }
    }
  },
  cur() { return this.sectors[this.active] || []; },
  label() { return `Sector ${this.active + 1}/${this.sectors.length}`; },
  /* capture: like Conquest, only on the live sector, and no ticket bleed */
  updateFlags(dt) {
    const G = Game;
    for (const f of World.flags) {
      if (f.locked) { f.contested = false; continue; }
      let t = 0, c = 0;
      for (const s of G.soldiers) if (s.alive && !s.downed && dist2(s.pos.x, s.pos.z, f.x, f.z) < f.radius && s.pos.y - topBelow(s.pos.x, s.pos.z, s.pos.y) < 3 && s.pos.y < 20) { if (s.team === 'T') t++; else c++; }
      f.contested = t > 0 && c > 0; f.tN = t; f.cN = c;
      const diff = c - t;
      if (diff !== 0) {
        const before = f.prog;
        f.prog = clamp(f.prog + Math.sign(diff) * Math.min(Math.abs(diff), 3) * dt / 10, -1, 1);
        if (before > 0 && f.prog <= 0 && f.owner === 'CT') { f.owner = null; G.radio('CT', 'Command', `We lost ${f.name} (${f.label})!`); Net.event({ t: 'flag', f: f.name, o: null }); }
        const now = f.prog >= 1 ? 'CT' : f.prog <= -1 ? 'T' : f.owner;
        if (now !== f.owner && Math.abs(f.prog) >= 1) {
          f.owner = now; G.radio(now, 'Command', `We ${now === 'T' ? 'took' : 'retook'} ${f.name} (${f.label})!`); G.radio(other(now), 'Command', now === 'T' ? `Enemy took ${f.name}!` : `They retook ${f.name}.`);
          for (const s of G.soldiers) if (s.alive && s.team === now && dist2(s.pos.x, s.pos.z, f.x, f.z) < f.radius) s.score += 20;
          if (G.local && G.local.team === now) Sfx.play('capture');
          Net.event({ t: 'flag', f: f.name, o: now });
        }
      } else if (!t && !c && f.owner) f.prog = lerp(f.prog, f.owner === 'CT' ? 1 : -1, dt * 0.2);
    }
    G.tickets.CT = 999;
    if (G.matchOver) return;
    if (this.cur().length && this.cur().every(f => f.owner === 'T')) this.advance();
    if (G.tickets.T <= 0) { G.tickets.T = 0; G.endMatch('CT'); }
  },
  advance() {
    const G = Game;
    if (this.active >= this.sectors.length - 1) { this.active = this.sectors.length; this.apply(); this.banner('T', 'Vanta broke through!'); G.endMatch('T'); return; }
    this.active++; this.apply(); G.tickets.T += G.mode.reinforce;
    this.banner(null, `${this.label()} · attackers +${G.mode.reinforce} tickets`);
    G.radio('CT', 'Command', 'Sector lost! Fall back to the next line!'); G.radio('T', 'Command', 'Sector taken! Push on to the next objective!');
    // defenders spawning on lost flags go back to HQ; the attackers' deploy screen updates by itself
    Net.event({ t: 'rsec', a: this.active });
  },
  banner(team, text) { HUD.center(text.toUpperCase(), 3); Sfx.play('capture'); if (Net.role === 'host') Net.event({ t: 'rban', text }); },
};
/* start: owners, sectors */
const _start52 = Game.start.bind(Game);
Game.start = function (cfg) {
  const r = _start52(cfg);
  if (Rush.on()) { Rush.build(); this.tickets = { T: this.mode.tickets, CT: 999 }; if (this.local) setTimeout(() => { if (Game.running && Rush.on()) HUD.center(Game.local.team === 'T' ? `Breakthrough · attack ${Rush.cur().map(f => f.name).join(' + ')}` : `Breakthrough · hold ${Rush.cur().map(f => f.name).join(' + ')}`, 3); }, 1200); }
  else World.flags.forEach(f => { f.locked = false; });
  return r;
};
const _updFlags52 = Game.updateFlags.bind(Game);
Game.updateFlags = function (dt) { if (Rush.on()) return Rush.updateFlags(dt); return _updFlags52(dt); };
/* only attacker deaths cost tickets */
const _kill52 = Game.kill.bind(Game);
Game.kill = function (v, att, weapon, hs) { const before = this.tickets.CT, r = _kill52(v, att, weapon, hs); if (Rush.on()) this.tickets.CT = 999; return r; };
/* bots only fight over the live sector */
const _think52 = Commander.prototype.thinkConquest;
Commander.prototype.thinkConquest = function () {
  if (!Rush.on()) return _think52.call(this);
  const all = World.flags, live = Rush.cur(); if (!live.length) return;
  World.flags = live; try { return _think52.call(this); } finally { World.flags = all; }
};
/* bot spawns: attackers from HQ or taken flags close to the front, defenders from the live sector or the next */
const _pickSpawn52 = Game.pickSpawn.bind(Game);
Game.pickSpawn = function (s) {
  if (!Rush.on()) return _pickSpawn52(s);
  const all = World.flags, a = Rush.active;
  World.flags = all.filter(f => s.team === 'T' ? f.sector === a - 1 : f.sector === a || f.sector === a + 1);
  try { return _pickSpawn52(s); } finally { World.flags = all; }
};
/* the deploy screen shows the same choices */
const _deployUpd52 = HUD.updateDeploy.bind(HUD);
HUD.updateDeploy = function () {
  if (!Rush.on() || !Game.local) return _deployUpd52();
  const L = Game.local, all = World.flags, a = Rush.active;
  const ok = f => f.owner === L.team && (L.team === 'T' ? f.sector === a - 1 : (f.sector === a || f.sector === a + 1));
  const keep = all.map(f => f.owner); all.forEach(f => { if (!ok(f)) f.owner = f.owner === L.team ? '_' : f.owner; });
  try { return _deployUpd52(); } finally { all.forEach((f, i) => { f.owner = keep[i]; }); }
};
const _respawn52 = Game.respawn.bind(Game);
Game.respawn = function (s, where) {
  if (Rush.on() && where && where.flag != null) { const f = World.flags[where.flag]; if (!f || f.owner !== s.team || f.locked && s.team === 'CT') where = null; }
  return _respawn52(s, where);
};
/* HUD: locked flags greyed out, sector and tickets */
const _hud52 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hud52(dt); if (!Rush.on() || !Game.local) return;
  for (const f of World.flags) { const el = document.getElementById('flag_' + f.name); if (el) { el.classList.toggle('locked', !!f.locked); el.classList.toggle('taken', f.locked && f.owner === 'T'); } }
  const E = this.el; if (E.rinfo) E.rinfo.textContent = `${Rush.label()} · ${Game.local.team === 'T' ? 'take' : 'hold'} ${Rush.cur().map(f => f.name).join(' + ')}`;
  if (E.scCT) E.scCT.textContent = '∞';
};
/* clients */
const _applyEvent52 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  if (e && e.t === 'rsec') { if (!Rush.sectors.length) Rush.build(); Rush.active = e.a; Rush.apply(); return; }
  if (e && e.t === 'rban') { HUD.center(String(e.text).toUpperCase(), 3); Sfx.play('capture'); return; }
  return _applyEvent52(e);
};
/* the lobby lists modes by key (Breakthrough shares Conquest's id) */
const _lobby52 = UI.render_lobby.bind(UI);
UI.render_lobby = function () {
  const r = _lobby52(); const L = Net.lobby, sel = document.querySelector('#lobbySettings select[data-k="mode"]');
  if (sel && L) { const keys = MODE_ORDER.filter(m => MODES[m]); sel.innerHTML = keys.map(k => `<option value="${k}" ${L.mode === k ? 'selected' : ''}>${MODES[k].name}</option>`).join(''); }
  return r;
};
/* the flag models: taken sectors fly Vanta colours, far ones are dim */
const _ufm52 = updateFlagModels;
updateFlagModels = function () { _ufm52(); if (!Rush.on()) return; for (const f of World.flags) if (f.model) f.model.ring.material.opacity = f.locked ? 0.1 : 0.35; };
