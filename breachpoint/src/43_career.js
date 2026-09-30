/* ═══════════════════════════════════════════════════════════════════════════
   Career (v2.9): Armory → Career.
   · Weapon levels: every gun levels up with kills (10 levels). Each level
     pays credits; levels 3, 6 and 9 unlock an attachment that fits the gun,
     levels 5 and 10 give a case key.
   · Daily challenges: three new ones every day (the same for everyone on a
     given date), with credits and sometimes a key.
   · Reward track: 30 tiers filled by match XP, each with a reward that is
     handed out as soon as you reach it.
   ═══════════════════════════════════════════════════════════════════════════ */
const WLV = [0, 10, 25, 50, 100, 175, 275, 400, 600, 850];
const DAILY_T = [
  { id: 'rifle', desc: n => `Get ${n} kills with rifles`, on: 'kill', f: e => e.wt === 'rifle', n: [15, 25] },
  { id: 'smg', desc: n => `Get ${n} kills with SMGs`, on: 'kill', f: e => e.wt === 'smg', n: [12, 20] },
  { id: 'sniper', desc: n => `Get ${n} kills with sniper rifles`, on: 'kill', f: e => e.wt === 'sniper', n: [6, 12] },
  { id: 'shotgun', desc: n => `Get ${n} kills with shotguns`, on: 'kill', f: e => e.wt === 'shotgun', n: [8, 14] },
  { id: 'pistol', desc: n => `Get ${n} kills with pistols`, on: 'kill', f: e => e.wt === 'pistol', n: [6, 12] },
  { id: 'lmg', desc: n => `Get ${n} kills with machine guns`, on: 'kill', f: e => e.wt === 'lmg', n: [12, 20] },
  { id: 'hs', desc: n => `Get ${n} headshot kills`, on: 'kill', f: e => e.hs, n: [8, 15] },
  { id: 'kills', desc: n => `Get ${n} kills`, on: 'kill', f: () => true, n: [30, 50] },
  { id: 'veh', desc: n => `Get ${n} kills in or with vehicles`, on: 'kill', f: e => e.veh, n: [4, 8] },
  { id: 'zombie', desc: n => `Kill ${n} zombies`, on: 'kill', f: e => e.z, n: [40, 80] },
  { id: 'win', desc: n => `Win ${n} matches`, on: 'win', f: () => true, n: [2, 3] },
  { id: 'match', desc: n => `Finish ${n} matches`, on: 'match', f: () => true, n: [3, 5] },
  { id: 'streak', desc: n => `Call in ${n} killstreaks`, on: 'ks', f: () => true, n: [2, 4] },
];
const TRACK_XP = 1200, TRACK_N = 30;
function trackReward(i) {   // tier i (1-based): what it pays
  const k = i % 6;
  if (i % 10 === 0) return { kind: 'skin', label: 'A rare skin' };
  return [{ kind: 'master', label: 'Master key' }, { kind: 'credits', n: 300, label: '₵300' }, { kind: 'case', label: 'A case' }, { kind: 'key', label: 'A case key' }, { kind: 'credits', n: 600, label: '₵600' }, { kind: 'case', label: 'A case + key', key: true }][k];
}
const Career = {
  d() { const D = Inv.data; if (!D.career || typeof D.career !== 'object') D.career = {}; const C = D.career; C.wk = C.wk || {}; C.track = C.track || { xp: 0, tier: 0 }; return C; },
  dayKey() { const t = new Date(); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`; },
  daily() {
    const C = this.d(), day = this.dayKey();
    if (!C.daily || C.daily.day !== day) {
      const r = mulberry(hashStr('bp-daily-' + day)), pool = DAILY_T.slice(), list = [];
      while (list.length < 3 && pool.length) { const T = pool.splice(Math.floor(r() * pool.length), 1)[0]; const n = Math.round(T.n[0] + r() * (T.n[1] - T.n[0])); list.push({ id: T.id, n, have: 0, done: false, reward: 300 + Math.round(r() * 5) * 100, key: r() < 0.35 }); }
      C.daily = { day, list };
    }
    return C.daily;
  },
  wLevel(k) { let l = 1; for (let i = 1; i < WLV.length; i++) if (k >= WLV[i]) l = i + 1; return l; },
  tell(msg) { if (Game.running) HUD.center(msg, 2.2); else UI.toast(msg, 3500); if (Sfx.ctx) { const t = Sfx.ctx.currentTime, o = Sfx.out(0.4, 0); Sfx.tone(o, t, 0.12, 784, 784, 0.22, 'triangle'); Sfx.tone(o, t + 0.12, 0.25, 1175, 1175, 0.22, 'triangle'); } },
  give(r) {
    const D = Inv.data, c = pick(CASES);
    if (r.kind === 'credits') D.credits += r.n;
    else if (r.kind === 'master') D.keys.master = (D.keys.master || 0) + 1;
    else if (r.kind === 'key') D.keys[c.id] = (D.keys[c.id] || 0) + 1;
    else if (r.kind === 'case') { D.cases[c.id] = (D.cases[c.id] || 0) + 1; if (r.key) D.keys[c.id] = (D.keys[c.id] || 0) + 1; }
    else if (r.kind === 'skin') { const pool = Object.values(SKINS).filter(s => s.weapon !== 'knife' && s.rarity >= 3 && s.rarity <= 4); if (pool.length) D.items.push(Inv.newItem(pick(pool).id)); }
  },
  /* a weapon kill */
  weaponKill(w) {
    if (!WEAPONS[w] || WEAPONS[w].hidden) return; const C = this.d(), before = this.wLevel(C.wk[w] || 0);
    C.wk[w] = (C.wk[w] || 0) + 1; const after = this.wLevel(C.wk[w]);
    if (after > before) {
      const D = Inv.data, bits = [`+₵${after * 100}`]; D.credits += after * 100;
      if (after % 3 === 0) { const opts = Object.keys(ATTACH).filter(a => attachAllowed(w, a) && !D.unlocked.includes(a)); if (opts.length) { const a = pick(opts); D.unlocked.push(a); bits.push(ATTACH[a].name + ' unlocked'); } }
      if (after === 5 || after === 10) { const c = pick(CASES); D.keys[c.id] = (D.keys[c.id] || 0) + 1; bits.push(Inv.keyName(c.id)); }
      this.tell(`${WEAPONS[w].name} level ${after}! ${bits.join(' · ')}`);
    }
  },
  event(on, e = {}) {
    const dl = this.daily(); let any = false;
    for (const q of dl.list) {
      if (q.done) continue; const T = DAILY_T.find(x => x.id === q.id); if (!T || T.on !== on || !T.f(e)) continue;
      q.have = Math.min(q.n, q.have + 1); any = true;
      if (q.have >= q.n) { q.done = true; Inv.data.credits += q.reward; let msg = `Daily done: ${T.desc(q.n)} · +₵${q.reward}`; if (q.key) { const c = pick(CASES); Inv.data.keys[c.id] = (Inv.data.keys[c.id] || 0) + 1; msg += ' + ' + Inv.keyName(c.id); } this.tell(msg); }
    }
    return any;
  },
  xp(n) {
    const T = this.d().track; T.xp += n; const reached = Math.min(TRACK_N, Math.floor(T.xp / TRACK_XP));
    while (T.tier < reached) { T.tier++; const r = trackReward(T.tier); this.give(r); this.tell(`Reward track tier ${T.tier}: ${r.label}`); }
  },
};
/* hooks: your kills, matches, killstreaks and XP */
const _onKill43 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  _onKill43(ev);
  const L = this.local, a = this.byId(ev.a), v = this.byId(ev.v); if (!L || a !== L || !v || v === L || (v.team === L.team && v.team !== 'Z') || this.mode.id === 'sandbox') return;
  const W = WEAPONS[ev.w], wt = W ? W.type : null, veh = !!(VKIND[ev.w] || (W && W.hidden) || L.vehicle);
  if (Inv.data) { Career.weaponKill(ev.w); Career.event('kill', { wt, hs: ev.hs, veh, z: v.team === 'Z' }); clearTimeout(Career._sv); Career._sv = setTimeout(() => Inv.save(), 2000); }
};
const _finish43 = Game.finishMatch.bind(Game);
Game.finishMatch = function (winner) {
  const L = this.local, first = !this.finished && L && this.mode.id !== 'sandbox';
  const r = _finish43(winner);
  if (first) { Career.event('match'); if (L.team === winner) Career.event('win'); Inv.save(); }
  return r;
};
const _addXp43 = Inv.addXp.bind(Inv);
Inv.addXp = function (n) { const r = _addXp43(n); try { Career.xp(n); } catch (e) { console.warn(e); } return r; };
const _ksAct43 = KS.activate.bind(KS);
KS.activate = function () { const n = this.mine.length; _ksAct43(); if (this.mine.length < n) Career.event('ks'); };

/* Armory → Career */
UI.renderCareer = function (body) {
  const C = Career.d(), dl = Career.daily(), T = C.track;
  const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), left = Math.max(0, mid - now), hh = Math.floor(left / 3.6e6), mm = Math.floor(left / 6e4) % 60;
  const bar = (a, b) => `<div class="cbar"><i style="width:${clamp(a / b, 0, 1) * 100}%"></i></div>`;
  const dailies = dl.list.map(q => { const Tt = DAILY_T.find(x => x.id === q.id); return `<div class="cday ${q.done ? 'done' : ''}"><b>${Tt ? Tt.desc(q.n) : q.id}</b>${bar(q.have, q.n)}<small>${q.have}/${q.n} · ₵${q.reward}${q.key ? ' + key' : ''}${q.done ? ' · done ✓' : ''}</small></div>`; }).join('');
  const tierNow = T.tier, inTier = T.xp - Math.min(TRACK_N, tierNow) * TRACK_XP;
  let tiers = ''; for (let i = 1; i <= TRACK_N; i++) { const r = trackReward(i); tiers += `<div class="ctier ${i <= tierNow ? 'got' : ''} ${i === tierNow + 1 ? 'next' : ''} ${r.kind === 'skin' ? 'big' : ''}"><b>${i}</b><small>${r.label}</small></div>`; }
  const guns = Object.values(WEAPONS).filter(w => !w.hidden && w.type !== 'knife' && w.type !== 'grenade' && w.slot && w.price != null && w.id !== 'knife');
  guns.sort((a, b) => (C.wk[b.id] || 0) - (C.wk[a.id] || 0));
  const wl = guns.map(w => { const k = C.wk[w.id] || 0, l = Career.wLevel(k), nxt = WLV[l] != null ? WLV[l] : null, prev = WLV[l - 1] || 0;
    return `<div class="cw"><span>${escapeHtml(w.name)}</span><b>Lv ${l}</b>${nxt != null ? bar(k - prev, nxt - prev) : '<div class="cbar max"><i style="width:100%"></i></div>'}<small>${k} kills${nxt != null ? ` · ${nxt - k} to level ${l + 1}` : ' · max level'}</small></div>`; }).join('');
  body.innerHTML = `<div class="career">
    <section><h3>Daily challenges <small class="muted">new ones in ${hh}h ${mm}m</small></h3><div class="cdays">${dailies}</div></section>
    <section><h3>Reward track <small class="muted">tier ${Math.min(TRACK_N, tierNow)}/${TRACK_N}${tierNow < TRACK_N ? ` · ${TRACK_XP - inTier} XP to the next` : ' · complete'}</small></h3>${tierNow < TRACK_N ? bar(inTier, TRACK_XP) : ''}<div class="ctrack">${tiers}</div></section>
    <section><h3>Weapon levels <small class="muted">levels 3, 6, 9 unlock an attachment · 5 and 10 give a key</small></h3><div class="cweps">${wl}</div></section></div>`;
};
const _renderArmory43 = UI.render_armory;
UI.render_armory = function () {
  const tabs = document.getElementById('armTabs');
  if (tabs && !tabs.querySelector('[data-t="career"]')) { const b = document.createElement('button'); b.dataset.t = 'career'; b.textContent = 'Career'; tabs.insertBefore(b, tabs.firstChild.nextSibling); }
  const r = _renderArmory43.apply(this, arguments);
  if (this.armoryTab === 'career') this.renderCareer($('armBody'));
  return r;
};
