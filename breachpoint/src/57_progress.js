/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Prestige, player cards, badges and weekly challenges.
   · Prestige: from level 50 you can reset to level 1 for a prestige star
     (up to 10), ₵5000, a Master Key and a card background of your own.
   · Player card: a banner with your name, a title, your prestige and up to
     three badges. Pick them in Armory → Career. It shows on the main menu,
     on the kill card when you take someone out... and yours when they get
     you.
   · Badges: bronze, silver and gold for headshots, revives, vehicle kills,
     explosives, long shots, knife kills, flags taken, Royale wins, Co-op
     missions, matches and wins. Each tier pays out and unlocks cards.
   · Weekly challenges: three bigger ones every week, worth ₵1500-3000 and a
     case with a key.
   ═══════════════════════════════════════════════════════════════════════════ */
const BADGES = [
  { id: 'hs', name: 'Marksman', desc: 'Headshot kills', icon: '◎', tiers: [50, 400, 2000] },
  { id: 'revives', name: 'Guardian', desc: 'Teammates revived', icon: '✚', tiers: [10, 75, 300] },
  { id: 'vkills', name: 'Mechanised', desc: 'Kills in or with vehicles', icon: '⛟', tiers: [20, 150, 600] },
  { id: 'xkills', name: 'Demolition', desc: 'Explosive kills', icon: '✸', tiers: [25, 200, 800] },
  { id: 'long', name: 'Eagle eye', desc: 'Kills from over 80 m', icon: '⌖', tiers: [10, 80, 300] },
  { id: 'knife', name: 'Cold steel', desc: 'Knife kills', icon: '⚔', tiers: [5, 40, 150] },
  { id: 'flags', name: 'Standard bearer', desc: 'Flags captured', icon: '⚑', tiers: [15, 120, 500] },
  { id: 'rwins', name: 'Last one standing', desc: 'Royale wins', icon: '♛', tiers: [1, 10, 40] },
  { id: 'missions', name: 'Operator', desc: 'Co-op missions completed', icon: '◈', tiers: [1, 15, 60] },
  { id: 'matches', name: 'Veteran', desc: 'Matches played', icon: '★', tiers: [25, 250, 1000] },
  { id: 'wins', name: 'Champion', desc: 'Matches won', icon: '♜', tiers: [10, 120, 500] },
];
const TIER = ['Bronze', 'Silver', 'Gold'], TIER_COL = ['#c8844a', '#c8d0d8', '#ffd24a'];
const CARD_BG = [
  { id: 'steel', name: 'Steel', css: 'linear-gradient(135deg,#2a3038,#4a5460)', need: null },
  { id: 'desert', name: 'Desert', css: 'linear-gradient(135deg,#6a5030,#c8a060)', need: null },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(135deg,#1e3020,#4a6a3a)', need: null },
  { id: 'night', name: 'Night op', css: 'radial-gradient(circle at 70% 30%,#3a4a7a,#0a0e1a 70%)', need: { lvl: 10 } },
  { id: 'dusk', name: 'Dusk', css: 'linear-gradient(160deg,#3a1a3a,#c86a3a 60%,#ffc870)', need: { lvl: 20 } },
  { id: 'camo', name: 'Urban camo', css: 'repeating-linear-gradient(45deg,#3a3e44 0 14px,#55595f 14px 26px,#2a2e33 26px 38px)', need: { lvl: 30 } },
  { id: 'tiger', name: 'Tiger', css: 'repeating-linear-gradient(-60deg,#e87a1a 0 10px,#1a1208 10px 16px)', need: { lvl: 40 } },
  { id: 'storm', name: 'Storm wall', css: 'linear-gradient(90deg,#1a2a6a,#4a8aff 50%,#1a2a6a)', need: { badge: 'rwins', t: 0 } },
  { id: 'medic', name: 'Field medic', css: 'linear-gradient(135deg,#f0f0f0 0 40%,#d02a2a 40% 60%,#f0f0f0 60%)', need: { badge: 'revives', t: 1 } },
  { id: 'blast', name: 'Blast radius', css: 'radial-gradient(circle at 30% 60%,#ffe08a,#e84a1a 30%,#2a0a04 70%)', need: { badge: 'xkills', t: 1 } },
  { id: 'scope', name: 'Crosshairs', css: 'radial-gradient(circle,transparent 30%,#0a0a0a 31% 33%,transparent 34%),linear-gradient(135deg,#2a3a2a,#5a6a4a)', need: { badge: 'long', t: 1 } },
  { id: 'gold', name: 'Gold', css: 'linear-gradient(135deg,#6a4a10,#ffd24a 45%,#fff0b0 55%,#8a6a1a)', need: { badge: 'wins', t: 2 } },
  { id: 'weekly', name: 'Weekly warrior', css: 'repeating-linear-gradient(90deg,#1a3a4a 0 18px,#2a5a6a 18px 36px)', need: { weekly: 3 } },
  { id: 'p1', name: 'Prestige I', css: 'linear-gradient(135deg,#2a1a4a,#8a4aff)', need: { prestige: 1 } },
  { id: 'p3', name: 'Prestige III', css: 'linear-gradient(135deg,#4a0a1a,#ff3a5a 50%,#4a0a1a)', need: { prestige: 3 } },
  { id: 'p5', name: 'Prestige V', css: 'conic-gradient(from 45deg,#ffd24a,#ff5a3a,#8a4aff,#3aa0ff,#ffd24a)', need: { prestige: 5 } },
  { id: 'p10', name: 'Prestige X', css: 'linear-gradient(135deg,#000,#1a1a1a 40%,#ffd24a 50%,#1a1a1a 60%,#000)', need: { prestige: 10 } },
];
const CARD_TITLES = [
  ['Recruit', null], ['Rifleman', null], ['Survivor', { lvl: 5 }], ['Pointman', { lvl: 15 }], ['Veteran', { badge: 'matches', t: 0 }], ['Deadeye', { badge: 'hs', t: 1 }], ['Angel', { badge: 'revives', t: 1 }],
  ['Tanker', { badge: 'vkills', t: 1 }], ['Sapper', { badge: 'xkills', t: 0 }], ['Ghost', { badge: 'knife', t: 1 }], ['Flag bearer', { badge: 'flags', t: 1 }], ['King of the storm', { badge: 'rwins', t: 1 }], ['Operator', { badge: 'missions', t: 0 }], ['Legend', { prestige: 1 }], ['Immortal', { prestige: 5 }],
];
const WEEKLY_T = [
  { id: 'w_kills', desc: n => `Get ${n} kills`, on: 'kill', f: () => true, n: [150, 250] },
  { id: 'w_hs', desc: n => `Get ${n} headshot kills`, on: 'kill', f: e => e.hs, n: [40, 70] },
  { id: 'w_veh', desc: n => `Get ${n} vehicle kills`, on: 'kill', f: e => e.veh, n: [15, 30] },
  { id: 'w_win', desc: n => `Win ${n} matches`, on: 'win', f: () => true, n: [6, 10] },
  { id: 'w_match', desc: n => `Finish ${n} matches`, on: 'match', f: () => true, n: [10, 18] },
  { id: 'w_revive', desc: n => `Revive ${n} teammates`, on: 'revive', f: () => true, n: [12, 25] },
  { id: 'w_flag', desc: n => `Capture ${n} flags`, on: 'flag', f: () => true, n: [15, 30] },
  { id: 'w_zombie', desc: n => `Kill ${n} zombies`, on: 'kill', f: e => e.z, n: [200, 350] },
  { id: 'w_royale', desc: n => `Finish top 5 in Royale ${n} times`, on: 'top5', f: () => true, n: [3, 6] },
  { id: 'w_coop', desc: n => `Complete ${n} Co-op missions`, on: 'mission', f: () => true, n: [3, 6] },
];
DAILY_T.push({ id: 'flag', desc: n => `Capture ${n} flags`, on: 'flag', f: () => true, n: [4, 8] }, { id: 'mission', desc: n => `Complete ${n} Co-op mission${n > 1 ? 's' : ''}`, on: 'mission', f: () => true, n: [1, 2] });

const Prog = {
  d() { const D = Inv.data; if (!D.prog || typeof D.prog !== 'object') D.prog = {}; const P = D.prog; P.b = P.b || {}; P.card = P.card || { bg: 'steel', title: 'Recruit', show: [] }; P.prestige = P.prestige || 0; P.weeklyDone = P.weeklyDone || 0; return P; },
  stat(id) { const S = Inv.data.stats; return id === 'hs' ? S.hsKills || 0 : id === 'matches' ? S.matches || 0 : id === 'wins' ? S.wins || 0 : id === 'revives' ? S.revives || 0 : (S[id] || 0); },
  bump(id, n = 1) { const S = Inv.data.stats; if (id === 'hs') S.hsKills = (S.hsKills || 0) + n; else S[id] = (S[id] || 0) + n; this.checkBadge(id); },
  tierOf(b) { const v = this.stat(b.id); let t = -1; b.tiers.forEach((n, i) => { if (v >= n) t = i; }); return t; },
  checkBadge(id) {
    const b = BADGES.find(x => x.id === id); if (!b) return; const P = this.d(), have = P.b[id] != null ? P.b[id] : -1, t = this.tierOf(b);
    if (t > have) { P.b[id] = t; const pay = [500, 1500, 4000][t]; Inv.data.credits += pay; Career.tell(`Badge: ${b.name} · ${TIER[t]} · +₵${pay}`); if (t === 2) { Inv.data.keys.master = (Inv.data.keys.master || 0) + 1; } }
  },
  meets(need) {
    if (!need) return true; const P = this.d(), D = Inv.data;
    if (need.lvl) return D.level >= need.lvl || P.prestige > 0;
    if (need.prestige) return P.prestige >= need.prestige;
    if (need.badge) return (P.b[need.badge] != null ? P.b[need.badge] : -1) >= need.t;
    if (need.weekly) return P.weeklyDone >= need.weekly;
    return false;
  },
  needText(need) {
    if (!need) return ''; if (need.lvl) return `Level ${need.lvl}`; if (need.prestige) return `Prestige ${need.prestige}`; if (need.weekly) return `${need.weekly} weekly challenges`;
    if (need.badge) { const b = BADGES.find(x => x.id === need.badge); return `${b ? b.name : need.badge} ${TIER[need.t]}`; } return '';
  },
  /* ── weekly ── */
  weekKey() { const t = new Date(), d = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())), day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return `${y}-W${w}`; },
  weekly() {
    const C = Career.d(), wk = this.weekKey();
    if (!C.weekly || C.weekly.wk !== wk) {
      const r = mulberry(hashStr('bp-weekly-' + wk)), pool = WEEKLY_T.slice(), list = [];
      while (list.length < 3 && pool.length) { const T = pool.splice(Math.floor(r() * pool.length), 1)[0]; const n = Math.round(T.n[0] + r() * (T.n[1] - T.n[0])); list.push({ id: T.id, n, have: 0, done: false, reward: 1500 + Math.round(r() * 3) * 500 }); }
      C.weekly = { wk, list };
    }
    return C.weekly;
  },
  weeklyEvent(on, e = {}) {
    const W = this.weekly();
    for (const q of W.list) {
      if (q.done) continue; const T = WEEKLY_T.find(x => x.id === q.id); if (!T || T.on !== on || !T.f(e)) continue;
      q.have = Math.min(q.n, q.have + 1);
      if (q.have >= q.n) { q.done = true; const D = Inv.data, c = pick(CASES); D.credits += q.reward; D.cases[c.id] = (D.cases[c.id] || 0) + 1; D.keys[c.id] = (D.keys[c.id] || 0) + 1; this.d().weeklyDone++; Career.tell(`Weekly done: ${T.desc(q.n)} · +₵${q.reward} + ${c.name} and key`); }
    }
  },
  prestige() {
    const D = Inv.data, P = this.d(); if (D.level < 50 || P.prestige >= 10) return false;
    P.prestige++; D.level = 1; D.xp = 0; D.credits += 5000; D.keys.master = (D.keys.master || 0) + 1; Inv.save(); Sfx.play('rare');
    UI.toast(`PRESTIGE ${P.prestige}! +₵5000, a Master Key, and a new card background`, 5000); return true;
  },
  /* ── the card ── */
  cardOf(s) {
    if (s === Game.local || !s) { const P = this.d(); return { name: Settings.name, bg: P.card.bg, title: P.card.title, pr: P.prestige, show: (P.card.show || []).filter(id => P.b[id] != null).map(id => [id, P.b[id]]), lvl: Inv.data.level }; }
    if (s.card) return Object.assign({ name: s.name }, s.card);
    // bots: a steady made-up card from their name
    const r = mulberry(hashStr('card:' + s.name)), bgs = CARD_BG.filter(b => !b.need || b.need.lvl || (b.need.prestige && b.need.prestige <= 3));
    const bs = BADGES.slice().sort(() => r() - 0.5).slice(0, Math.floor(r() * 3)).map(b => [b.id, Math.floor(r() * 3)]);
    return { name: s.name, bg: bgs[Math.floor(r() * bgs.length)].id, title: CARD_TITLES[Math.floor(r() * CARD_TITLES.length)][0], pr: r() < 0.25 ? 1 + Math.floor(r() * 3) : 0, show: bs, lvl: 1 + Math.floor(r() * 80) };
  },
  cardHtml(c, small) {
    const bg = CARD_BG.find(b => b.id === c.bg) || CARD_BG[0];
    const stars = c.pr ? `<span class="pstar" title="Prestige ${c.pr}">${'★'.repeat(Math.min(5, c.pr))}${c.pr > 5 ? '<sup>' + c.pr + '</sup>' : ''}</span>` : '';
    const badges = (c.show || []).map(([id, t]) => { const b = BADGES.find(x => x.id === id); return b ? `<i class="pbadge" style="--bc:${TIER_COL[t] || '#aaa'}" title="${b.name} ${TIER[t] || ''}">${b.icon}</i>` : ''; }).join('');
    return `<div class="pcard ${small ? 'small' : ''}" style="background:${bg.css}"><div class="pc-l"><b>${escapeHtml(c.name || '')}</b><small>${escapeHtml(c.title || '')}</small></div><div class="pc-r">${stars}<span class="plvl">${c.lvl || ''}</span>${badges}</div></div>`;
  },
};
/* ── tracking ──────────────────────────────────────────────────────────── */
const _onKill57 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  _onKill57(ev);
  const L = this.local, a = this.byId(ev.a), v = this.byId(ev.v); if (!L || !Inv.data || this.mode.id === 'sandbox' || this.mode.id === 'editor') return;
  if (a === L && v && v !== L && (v.team !== L.team || v.team === 'Z' || this.mode.id === 'royale')) {
    const W = WEAPONS[ev.w];
    if (ev.hs) Prog.checkBadge('hs');   // hsKills is tallied by the game
    if (VKIND[ev.w] || (W && W.hidden) || L.vehicle) Prog.bump('vkills');
    if (EXPLOSIVE_KILLS.includes(ev.w) || (W && W.explosive)) Prog.bump('xkills');
    if (ev.w === 'knife') Prog.bump('knife');
    if (dist2(L.pos.x, L.pos.z, v.pos.x, v.pos.z) > 80) Prog.bump('long');
    Prog.weeklyEvent('kill', { hs: ev.hs, veh: !!(VKIND[ev.w] || (W && W.hidden) || L.vehicle), z: v.team === 'Z' });
  }
};
/* game-wide hsKills are counted per match; keep a lifetime total too */
const _finish57 = Game.finishMatch.bind(Game);
Game.finishMatch = function (winner) {
  const L = this.local, first = !this.finished && L && this.mode.id !== 'sandbox' && this.mode.id !== 'editor';
  const r = _finish57(winner);
  if (first && Inv.data) {
    const won = this.finished && L.team === winner && winner !== 'lost';
    Prog.bump('hs', L.hsKills || 0);
    Prog.checkBadge('matches'); Prog.checkBadge('wins');
    Prog.weeklyEvent('match'); if (won) Prog.weeklyEvent('win');
    if (this.mode.id === 'royale') { if (L.place === 1) Prog.bump('rwins'); if ((L.place || 99) <= 5) Prog.weeklyEvent('top5'); }
    if (this.mode.id === 'coop' && winner === 'CT') { Prog.bump('missions'); Prog.weeklyEvent('mission'); Career.event('mission'); }
    Inv.save();
  }
  return r;
};
/* revives come from 48 through Career.event('revive'); count them for the weekly too */
const _cev57 = Career.event.bind(Career);
Career.event = function (on, e) { const r = _cev57(on, e); if (on === 'revive') { Prog.weeklyEvent('revive'); Prog.checkBadge('revives'); } if (on === 'flag') Prog.weeklyEvent('flag'); return r; };
/* flags you were standing on when they fell to your team */
const FlagWatch = { own: new Map(), t: 0,
  update(dt) {
    const L = Game.local; if (!L || !World.flags.length) return; this.t -= dt; if (this.t > 0) return; this.t = 0.3;
    for (const f of World.flags) { const was = this.own.get(f); if (was !== undefined && was !== f.owner && f.owner === L.team && L.alive && dist2(L.pos.x, L.pos.z, f.x, f.z) < (f.radius || 10) + 2) { Prog.bump('flags'); Career.event('flag'); } this.own.set(f, f.owner); }
  } };
const _gupdate57 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate57(dt); if (this.running && Inv.data) FlagWatch.update(dt); };
const _start57 = Game.start.bind(Game);
Game.start = function (cfg) { FlagWatch.own = new Map(); const r = _start57(cfg); if (this.local) { this.local.card = null; if (Net.role !== 'off') { const c = Prog.cardOf(this.local); delete c.name; if (Net.role === 'host') Net.event({ t: 'card', id: this.local.id, c }); else Net.send({ t: 'card', c }); } } return r; };
const _hostData57 = Net.hostData.bind(Net);
Net.hostData = function (id, m) { if (m && m.t === 'card') { const p = this.peers.get(id), s = p && p.sid && Game.byId(p.sid); if (s && m.c) { s.card = m.c; Net.event({ t: 'card', id: s.id, c: m.c }); } return; } return _hostData57(id, m); };
const _applyEvent57 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) { if (e && e.t === 'card') { const s = Game.byId(e.id); if (s && s !== Game.local) s.card = e.c; return; } return _applyEvent57(e); };
/* the kill card shows the killer's player card */
const _died57 = HUD.died.bind(HUD);
HUD.died = function (a, w, hs) { _died57(a, w, hs); if (a && a !== Game.local && this.el.killcard) this.el.killcard.insertAdjacentHTML('afterbegin', Prog.cardHtml(Prog.cardOf(a), true)); };
/* main menu: your card */
const _renderMain57 = UI.render_main;
UI.render_main = function () {
  const r = _renderMain57.apply(this, arguments); const host = $('mainStats'); if (!host || !Inv.data) return r;
  let el = document.getElementById('mainCard'); if (!el) { el = document.createElement('div'); el.id = 'mainCard'; host.parentElement.insertBefore(el, host); }
  el.innerHTML = Prog.cardHtml(Prog.cardOf(null)); el.onclick = () => { this.armoryTab = 'career'; this.show('armory'); };
  return r;
};
/* Armory → Career: prestige, card, badges, weekly */
const _renderCareer57 = UI.renderCareer.bind(UI);
UI.renderCareer = function (body) {
  _renderCareer57(body); const P = Prog.d(), D = Inv.data, root = body.querySelector('.career'); if (!root) return;
  const W = Prog.weekly(), bar = (a, b) => `<div class="cbar"><i style="width:${clamp(a / b, 0, 1) * 100}%"></i></div>`;
  const now = new Date(), left = (7 - ((now.getDay() + 6) % 7)) * 864e5 - (now.getHours() * 3.6e6 + now.getMinutes() * 6e4), dd = Math.floor(left / 864e5), hh = Math.floor(left / 3.6e6) % 24;
  const weekly = W.list.map(q => { const T = WEEKLY_T.find(x => x.id === q.id); return `<div class="cday ${q.done ? 'done' : ''}"><b>${T ? T.desc(q.n) : q.id}</b>${bar(q.have, q.n)}<small>${q.have}/${q.n} · ₵${q.reward} + case & key${q.done ? ' · done ✓' : ''}</small></div>`; }).join('');
  const badges = BADGES.map(b => { const t = P.b[b.id] != null ? P.b[b.id] : -1, v = Prog.stat(b.id), nxt = b.tiers[t + 1]; return `<div class="cbadge ${t >= 0 ? 'got' : ''}" style="--bc:${t >= 0 ? TIER_COL[t] : '#555'}"><i>${b.icon}</i><b>${b.name}</b><small>${b.desc}: ${v}${nxt != null ? ' / ' + nxt : ' · maxed'}</small>${nxt != null ? bar(v, nxt) : ''}<span>${t >= 0 ? TIER[t] : 'Locked'}</span></div>`; }).join('');
  const canP = D.level >= 50 && P.prestige < 10;
  const bgs = CARD_BG.map(b => { const ok = Prog.meets(b.need); return `<button class="pcbg ${P.card.bg === b.id ? 'on' : ''} ${ok ? '' : 'locked'}" data-bg="${b.id}" style="background:${b.css}" title="${b.name}${ok ? '' : ' · ' + Prog.needText(b.need)}">${ok ? '' : '🔒'}</button>`; }).join('');
  const titles = CARD_TITLES.map(([t, need]) => `<option ${P.card.title === t ? 'selected' : ''} ${Prog.meets(need) ? '' : 'disabled'}>${t}${Prog.meets(need) ? '' : ' (' + Prog.needText(need) + ')'}</option>`).join('');
  const earned = BADGES.filter(b => P.b[b.id] != null), show = new Set(P.card.show || []);
  const pick3 = earned.length ? earned.map(b => `<label class="pcpick"><input type="checkbox" data-sb="${b.id}" ${show.has(b.id) ? 'checked' : ''}> ${b.icon} ${b.name}</label>`).join('') : '<span class="muted">Earn badges to show them off here.</span>';
  root.insertAdjacentHTML('afterbegin', `
    <section class="cprest"><h3>Player card</h3><div class="pcwrap">${Prog.cardHtml(Prog.cardOf(null))}
      <div class="pcopts"><div class="pcbgs">${bgs}</div><label>Title <select id="pcTitle">${titles}</select></label><div class="pcpicks">${pick3}</div></div></div></section>
    <section class="cprest"><h3>Prestige ${P.prestige ? '★'.repeat(Math.min(5, P.prestige)) + (P.prestige > 5 ? ' ' + P.prestige : '') : ''}</h3>
      <p class="muted">${P.prestige >= 10 ? 'Max prestige. Legendary.' : canP ? 'You can prestige: back to level 1 for a prestige star, ₵5000, a Master Key and a new card.' : `Reach level 50 to prestige (you're level ${D.level}).`}</p>
      <button class="btn ${canP ? '' : 'ghost'}" id="pcPrest" ${canP ? '' : 'disabled'}>Prestige${P.prestige ? ' ' + (P.prestige + 1) : ''}</button></section>
    <section><h3>Weekly challenges <small class="muted">new ones in ${dd}d ${hh}h</small></h3><div class="cdays">${weekly}</div></section>
    <section><h3>Badges</h3><div class="cbadges">${badges}</div></section>`);
  root.querySelectorAll('.pcbg').forEach(b => b.onclick = () => { if (b.classList.contains('locked')) { UI.toast('Unlock: ' + Prog.needText((CARD_BG.find(x => x.id === b.dataset.bg) || {}).need)); return; } P.card.bg = b.dataset.bg; Inv.save(); Sfx.play('ui'); this.renderCareer(body); });
  const ts = root.querySelector('#pcTitle'); if (ts) ts.onchange = () => { P.card.title = ts.value; Inv.save(); this.renderCareer(body); };
  root.querySelectorAll('[data-sb]').forEach(c => c.onchange = () => { const s = new Set(P.card.show || []); if (c.checked) { if (s.size >= 3) { c.checked = false; UI.toast('Three badges at most'); return; } s.add(c.dataset.sb); } else s.delete(c.dataset.sb); P.card.show = [...s]; Inv.save(); this.renderCareer(body); });
  const pb = root.querySelector('#pcPrest'); if (pb) pb.onclick = () => { if (!confirm('Prestige? Your level goes back to 1 (you keep everything else).')) return; if (Prog.prestige()) this.renderCareer(body); };
};
