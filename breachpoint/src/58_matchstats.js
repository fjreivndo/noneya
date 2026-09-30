/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Match report.
   The results screen gets a "Match report" panel: a heatmap of where you
   spent the match over the map, where you got your kills (green) and where
   you died (red), plus your best weapon, longest kill, time alive,
   distance covered, headshots, vehicle kills, revives and flags.
   ═══════════════════════════════════════════════════════════════════════════ */
const MatchStats = {
  path: [], kills: [], deaths: [], wk: {}, longest: 0, longW: null, alive: 0, dist: 0, last: null, t: 0, revives: 0, flags: 0, vk: 0, hs: 0,
  reset() { Object.assign(this, { path: [], kills: [], deaths: [], wk: {}, longest: 0, longW: null, alive: 0, dist: 0, last: null, t: 0, revives: 0, flags: 0, vk: 0, hs: 0 }); },
  update(dt) {
    const L = Game.local; if (!L || Game.matchOver) return;
    if (L.alive) {
      this.alive += dt;
      const p = L.vehicle ? L.vehicle.pos : L.pos;
      if (this.last) { const d = Math.hypot(p.x - this.last.x, p.z - this.last.z); if (d < 30) this.dist += d; }
      this.last = { x: p.x, z: p.z };
      this.t -= dt; if (this.t <= 0) { this.t = 1; this.path.push([+p.x.toFixed(1), +p.z.toFixed(1)]); if (this.path.length > 3000) this.path.splice(0, 1000); }
    } else this.last = null;
  },
  onKill(ev) {
    const L = Game.local, a = Game.byId(ev.a), v = Game.byId(ev.v); if (!L || !v) return;
    if (a === L && v !== L) {
      const d = Math.hypot(v.pos.x - L.pos.x, v.pos.z - L.pos.z);
      this.kills.push([+v.pos.x.toFixed(1), +v.pos.z.toFixed(1)]); this.wk[ev.w] = (this.wk[ev.w] || 0) + 1;
      if (d > this.longest) { this.longest = d; this.longW = ev.w; }
      if (ev.hs) this.hs++; if (VKIND[ev.w] || L.vehicle || (WEAPONS[ev.w] && WEAPONS[ev.w].hidden)) this.vk++;
    }
    if (v === L) this.deaths.push([+L.pos.x.toFixed(1), +L.pos.z.toFixed(1)]);
  },
  wname(w) { return WEAPONS[w] ? WEAPONS[w].name : VKIND[w] ? VKIND[w].name : w === 'knife' ? 'Knife' : String(w || '—'); },
  /* the map with the heat, the kills and the deaths */
  draw(cv) {
    const img = HUD.radarImg; if (!img) return;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, k = Math.min(W / img.width, H / img.height), ox = (W - img.width * k) / 2, oy = (H - img.height * k) / 2;
    c.fillStyle = '#16171a'; c.fillRect(0, 0, W, H); c.drawImage(img, ox, oy, img.width * k, img.height * k);
    const X = x => ox + HUD.wx(x) * k, Z = z => oy + HUD.wz(z) * k;
    // heat: soft blobs where you were, summed
    const heat = document.createElement('canvas'); heat.width = W; heat.height = H; const h = heat.getContext('2d');
    h.globalCompositeOperation = 'lighter';
    const r = Math.max(6, 10 * k * HUD.radarScale);
    for (const [x, z] of this.path) { const g = h.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r); g.addColorStop(0, 'rgba(255,140,40,.16)'); g.addColorStop(1, 'rgba(255,140,40,0)'); h.fillStyle = g; h.fillRect(X(x) - r, Z(z) - r, r * 2, r * 2); }
    c.drawImage(heat, 0, 0);
    // your route, faintly
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; c.beginPath(); this.path.forEach(([x, z], i) => i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z))); c.stroke();
    for (const [x, z] of this.kills) { c.fillStyle = '#6aff8a'; c.strokeStyle = '#0a2a10'; c.lineWidth = 1.5; c.beginPath(); c.arc(X(x), Z(z), 4, 0, TAU); c.fill(); c.stroke(); }
    c.strokeStyle = '#ff4a4a'; c.lineWidth = 2.5; for (const [x, z] of this.deaths) { const px = X(x), pz = Z(z); c.beginPath(); c.moveTo(px - 5, pz - 5); c.lineTo(px + 5, pz + 5); c.moveTo(px + 5, pz - 5); c.lineTo(px - 5, pz + 5); c.stroke(); }
    // flags
    for (const f of World.flags) { c.fillStyle = 'rgba(255,255,255,.85)'; c.font = 'bold 11px system-ui'; c.textAlign = 'center'; c.fillText(f.name, X(f.x), Z(f.z) + 4); }
  },
};
const _start58 = Game.start.bind(Game);
Game.start = function (cfg) { MatchStats.reset(); return _start58(cfg); };
const _gupdate58 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate58(dt); if (this.running) MatchStats.update(dt); };
const _onKill58 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) { _onKill58(ev); try { MatchStats.onKill(ev); } catch (e) { } };
const _cev58 = Career.event.bind(Career);
Career.event = function (on, e) { if (Game.running) { if (on === 'revive') MatchStats.revives++; if (on === 'flag') MatchStats.flags++; } return _cev58(on, e); };
const _results58 = UI.matchResults.bind(UI);
UI.matchResults = function (r) {
  _results58(r); if (typeof Medal !== 'undefined' && Medal.el) { Medal.el.style.display = 'none'; Medal.q = []; Medal.t = 0; }
  const el = document.getElementById('results'), grid = el && el.querySelector('.rgrid'); if (!grid || Game.mode.id === 'editor') return;
  const M = MatchStats, best = Object.entries(M.wk).sort((a, b) => b[1] - a[1])[0];
  const tile = (v, l) => `<div class="rs"><b>${v}</b><small>${l}</small></div>`;
  const box = document.createElement('div'); box.className = 'mreport';
  box.innerHTML = `<h3>Match report</h3><div class="mrgrid"><canvas width="300" height="300"></canvas><div>
    <div class="rstats">${tile(best ? escapeHtml(M.wname(best[0])) : '—', best ? `best weapon · ${best[1]} kills` : 'best weapon')}${tile(M.longest ? Math.round(M.longest) + ' m' : '—', M.longest ? 'longest kill · ' + escapeHtml(M.wname(M.longW)) : 'longest kill')}
      ${tile(fmtTime(M.alive), 'time alive')}${tile(M.dist > 1000 ? (M.dist / 1000).toFixed(2) + ' km' : Math.round(M.dist) + ' m', 'distance covered')}${tile(M.hs, 'headshots')}${tile(M.vk, 'vehicle kills')}${tile(M.revives, 'revives')}${tile(M.flags, 'flags taken')}</div>
    <p class="muted small"><span style="color:#ff9a3a">■</span> where you spent the match · <span style="color:#6aff8a">●</span> your kills · <span style="color:#ff4a4a">✕</span> your deaths</p></div></div>`;
  grid.after(box);
  try { M.draw(box.querySelector('canvas')); } catch (e) { console.warn('report', e); }
};
