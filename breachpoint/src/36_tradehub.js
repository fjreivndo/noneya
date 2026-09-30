/* ═══════════════════════════════════════════════════════════════════════════
   Trade Hub: a global online room where anyone playing can chat and trade.
   Main menu → Trade Hub joins the Photon room BP-TRADEHUB (same App ID and
   region as multiplayer). Click Trade next to someone to ask; if they accept,
   a trade window opens for both:
     1. each side builds an offer: skins, cases, keys, credits
     2. both press Ready. Changing either offer un-readies both
     3. both press Confirm on the summary, and the swap happens on both machines
   Every step carries a fingerprint of both offers, so nobody can swap
   something in at the last moment. Received items are checked against the
   skin catalogue before they're added.
   ═══════════════════════════════════════════════════════════════════════════ */
const EV_HUB = 10, EV_TRADE = 11;
const Hub = {
  c: null, people: new Map(), chat: [], T: null, state: 'off',
  connect() {
    if (this.c) return; const bad = PhotonNet.need(); if (bad) { this.state = 'error'; this.err = bad; UI.cur === 'hub' && UI.render_hub(); return; }
    const c = this.c = PhotonNet.client(), S = Photon.LoadBalancing.LoadBalancingClient.State;
    this.state = 'connecting'; this.people.clear();
    try { c.myActor().setName(Settings.name); } catch (e) { /* set on join instead */ }
    c.onStateChange = st => {
      if (this.c !== c) return;
      if (st === S.JoinedLobby) c.joinRoom('BP-TRADEHUB', { createIfNotExists: true }, { isVisible: false, maxPlayers: 0, emptyRoomLiveTime: 0 });
      else if (st === S.Joined) { this.state = 'on'; this.hello(); this.sys('You joined the Trade Hub on Photon ' + PhotonNet.region().toUpperCase() + '.'); }
      else if (st === S.Disconnected) { this.state = 'off'; this.c = null; if (this.T) this.endTrade('The connection to the hub dropped.'); }
      UI.cur === 'hub' && UI.render_hub();
    };
    c.onActorJoin = a => { if (this.c === c && a.actorNr !== c.myActor().actorNr) this.hello(a.actorNr); };
    c.onActorLeave = a => { const p = this.people.get(a.actorNr); this.people.delete(a.actorNr); if (p) this.sys(p.name + ' left.'); if (this.T && this.T.with === a.actorNr) this.endTrade(p ? p.name + ' left the hub.' : 'They left.'); UI.cur === 'hub' && UI.render_hub(); };
    c.onEvent = (code, m, from) => { if (this.c !== c || !m) return; if (code === EV_HUB) this.onHub(m, from); else if (code === EV_TRADE) this.onTrade(m, from); };
    c.onError = (e, msg) => { this.state = 'error'; this.err = PhotonNet.errText(e, msg); UI.cur === 'hub' && UI.render_hub(); };
    c.onOperationResponse = (e, msg) => { if (e) { this.state = 'error'; this.err = PhotonNet.errText(e, msg); UI.cur === 'hub' && UI.render_hub(); } };
    c.connectToRegionMaster(PhotonNet.region());
  },
  disconnect() { if (this.T) this.cancel('left the hub'); const c = this.c; this.c = null; this.state = 'off'; this.people.clear(); if (c) try { c.disconnect(); } catch (e) { /* gone */ } },
  send(code, m, to) { const c = this.c; if (!c || !c.isJoinedToRoom()) return; if (to) c.raiseEvent(code, m, { targetActors: [to] }); else c.raiseEvent(code, m, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others }); },
  me() { return { name: Settings.name, lv: Inv.data.level, n: Inv.data.items.length }; },
  hello(to) { this.send(EV_HUB, Object.assign({ t: 'hi' }, this.me()), to); },
  sys(x) { this.chat.push({ sys: true, x }); if (this.chat.length > 80) this.chat.shift(); UI.cur === 'hub' && Hub.drawChat(); },
  say(x) { x = String(x).trim().slice(0, 140); if (!x) return; this.send(EV_HUB, { t: 'chat', x }); this.chat.push({ n: Settings.name, x, me: true }); this.drawChat(); },
  onHub(m, from) {
    if (m.t === 'hi') { const known = this.people.has(from); this.people.set(from, { nr: from, name: String(m.name || 'Player').slice(0, 16), lv: m.lv | 0, n: m.n | 0 }); if (!known) { this.sys(this.people.get(from).name + ' is here.'); this.hello(from); } UI.cur === 'hub' && UI.render_hub(); }
    else if (m.t === 'chat') { const p = this.people.get(from); this.chat.push({ n: p ? p.name : 'Someone', x: String(m.x).slice(0, 140) }); if (this.chat.length > 80) this.chat.shift(); this.drawChat(); }
  },

  /* ── trading ── */
  request(nr) {
    if (this.T) return UI.toast('Finish your current trade first');
    const sid = uid(8); this.T = this.newTrade(nr, sid, 'asking'); this.send(EV_TRADE, { t: 'req', sid }, nr);
    UI.toast('Trade request sent to ' + this.T.name); this.T.askT = setTimeout(() => { if (this.T && this.T.stage === 'asking') this.endTrade(this.T.name + ' did not answer.'); }, 30000);
  },
  newTrade(nr, sid, stage) { const p = this.people.get(nr); return { with: nr, name: p ? p.name : 'Player', sid, stage, mine: { items: [], cases: {}, keys: {}, credits: 0 }, theirs: { items: [], cases: {}, keys: {}, credits: 0 }, v: 0, rdy: false, trdy: false, conf: false, tconf: false }; },
  onTrade(m, from) {
    const T = this.T;
    if (m.t === 'req') {
      if (T) { this.send(EV_TRADE, { t: 'dec', sid: m.sid, why: 'busy' }, from); return; }
      const p = this.people.get(from), name = p ? p.name : 'Someone';
      UI.confirmBox(`${name} wants to trade with you.`, 'Accept', 'Decline', ok => {
        if (!ok || this.T) { this.send(EV_TRADE, { t: 'dec', sid: m.sid }, from); return; }
        this.T = this.newTrade(from, m.sid, 'open'); this.send(EV_TRADE, { t: 'acc', sid: m.sid }, from); this.openWin();
      });
      return;
    }
    if (!T || m.sid !== T.sid || from !== T.with) return;
    if (m.t === 'acc' && T.stage === 'asking') { clearTimeout(T.askT); T.stage = 'open'; this.openWin(); }
    else if (m.t === 'dec') { this.endTrade(T.name + (m.why === 'busy' ? ' is busy with another trade.' : ' declined.')); }
    else if (m.t === 'cancel') { this.endTrade(T.name + ' cancelled the trade.'); }
    else if (m.t === 'offer') { T.theirs = this.cleanOffer(m.o); T.rdy = T.trdy = T.conf = T.tconf = false; T.stage = 'open'; this.drawWin(); }
    else if (m.t === 'ready') { T.trdy = m.h === this.hash(); this.drawWin(); }
    else if (m.t === 'conf') { T.tconf = m.h === this.hash() && T.rdy && T.trdy; if (T.tconf && T.conf) this.execute(); else this.drawWin(); }
  },
  /* only real catalogue items, sensible numbers */
  cleanOffer(o) {
    o = o || {}; const out = { items: [], cases: {}, keys: {}, credits: 0 };
    for (const it of (Array.isArray(o.items) ? o.items : []).slice(0, 40)) {
      if (!it || !SKINS[it.skinId]) continue;
      out.items.push({ skinId: it.skinId, float: clamp(+it.float || 0.5, 0.0001, 0.9999), seed: clamp(it.seed | 0, 0, 999), st: !!it.st, kills: Math.max(0, it.kills | 0), t: +it.t || 0, name: it.name ? String(it.name).slice(0, 24) : undefined });
    }
    for (const k of ['cases', 'keys']) for (const id in (o[k] || {})) { const n = clamp(o[k][id] | 0, 0, 999); if (n > 0 && (CASES.some(c => c.id === id) || (k === 'keys' && id === 'master'))) out[k][id] = n; }
    out.credits = clamp(Math.floor(+o.credits || 0), 0, 10000000);
    return out;
  },
  myOfferWire() { const M = this.T.mine; return { items: M.items.map(u => Inv.byUid(u)).filter(Boolean).map(({ uid: _u, ...rest }) => rest), cases: M.cases, keys: M.keys, credits: M.credits }; },
  hash() {
    const T = this.T, me = this.c ? this.c.myActor().actorNr : 0, a = JSON.stringify(this.cleanOffer(this.myOfferWire())), b = JSON.stringify(T.theirs);
    const s = me < T.with ? a + '|' + b : b + '|' + a; return hashStr(s).toString(36) + ':' + s.length;
  },
  pushOffer() { const T = this.T; if (!T) return; T.v++; T.rdy = T.trdy = T.conf = T.tconf = false; this.send(EV_TRADE, { t: 'offer', sid: T.sid, o: this.myOfferWire() }, T.with); this.drawWin(); },
  ready() { const T = this.T; if (!T) return; if (!this.ownsOffer()) return UI.toast('You no longer have everything in your offer'); T.rdy = true; this.send(EV_TRADE, { t: 'ready', sid: T.sid, h: this.hash() }, T.with); this.drawWin(); },
  confirm() { const T = this.T; if (!T || !T.rdy || !T.trdy) return; if (!this.ownsOffer()) return UI.toast('You no longer have everything in your offer'); T.conf = true; this.send(EV_TRADE, { t: 'conf', sid: T.sid, h: this.hash() }, T.with); if (T.tconf) this.execute(); else this.drawWin(); },
  cancel(why) { const T = this.T; if (!T) return; this.send(EV_TRADE, { t: 'cancel', sid: T.sid }, T.with); this.endTrade(why ? 'Trade cancelled: ' + why : 'Trade cancelled.'); },
  ownsOffer() { const M = this.T.mine, D = Inv.data; return M.items.every(u => Inv.byUid(u)) && Object.entries(M.cases).every(([k, n]) => (D.cases[k] || 0) >= n) && Object.entries(M.keys).every(([k, n]) => (D.keys[k] || 0) >= n) && D.credits >= M.credits; },
  execute() {
    const T = this.T, D = Inv.data; if (!T || T.stage === 'done') return; T.stage = 'done';
    const M = T.mine, R = T.theirs;
    for (const u of M.items) { const it = Inv.byUid(u); if (it) { if (Inv.isEquipped(it)) Inv.unequip(SKINS[it.skinId].weapon); D.items = D.items.filter(i => i !== it); } }
    for (const [k, n] of Object.entries(M.cases)) D.cases[k] = Math.max(0, (D.cases[k] || 0) - n);
    for (const [k, n] of Object.entries(M.keys)) D.keys[k] = Math.max(0, (D.keys[k] || 0) - n);
    D.credits -= M.credits;
    for (const it of R.items) D.items.push(Object.assign({}, it, { uid: uid(10) }));
    for (const [k, n] of Object.entries(R.cases)) D.cases[k] = (D.cases[k] || 0) + n;
    for (const [k, n] of Object.entries(R.keys)) D.keys[k] = (D.keys[k] || 0) + n;
    D.credits += R.credits;
    (D.tradeLog = D.tradeLog || []).push({ t: Date.now(), with: T.name, gave: M.items.length + ' items', got: R.items.length + ' items' }); if (D.tradeLog.length > 50) D.tradeLog.shift();
    Inv.save(); Sfx.play('rare'); const cr = $('credits'); if (cr) cr.textContent = D.credits.toLocaleString();
    this.endTrade(`Trade with ${T.name} complete: you got ${this.describe(R)}.`, true);
  },
  endTrade(msg, good) { const T = this.T; if (T) clearTimeout(T.askT); this.T = null; const w = $('tradewin'); if (w) w.classList.add('hidden'); if (msg) { UI.toast(msg, 4000); this.sys(msg); } if (UI.cur === 'hub') UI.render_hub(); if (good) this.hello(); },
  describe(o) {
    const parts = []; if (o.items.length) parts.push(o.items.length === 1 ? Inv.displayName(o.items[0]) : o.items.length + ' skins');
    const nc = Object.values(o.cases).reduce((a, b) => a + b, 0), nk = Object.values(o.keys).reduce((a, b) => a + b, 0);
    if (nc) parts.push(nc + ' case' + (nc > 1 ? 's' : '')); if (nk) parts.push(nk + ' key' + (nk > 1 ? 's' : '')); if (o.credits) parts.push('₵' + o.credits.toLocaleString());
    return parts.join(', ') || 'nothing';
  },

  /* ── the window ── */
  openWin() {
    let w = $('tradewin'); if (!w) { w = document.createElement('div'); w.id = 'tradewin'; w.className = 'ov'; document.body.appendChild(w); }
    w.classList.remove('hidden'); this.drawWin();
  },
  drawWin() {
    const w = $('tradewin'), T = this.T; if (!w || !T) return; const D = Inv.data, M = T.mine;
    const theirCards = T.theirs.items.map((it, i) => `<div class="card sm" data-ti="${i}" style="--rc:${RARITY[SKINS[it.skinId].rarity].color}"><canvas width="220" height="110"></canvas><div class="cn">${escapeHtml(Inv.displayName(it))}</div><div class="cw">${wearOf(it.float).name}</div><div class="cr">${RARITY[SKINS[it.skinId].rarity].name}<span>₵${Inv.value(it)}</span></div></div>`).join('');
    const counts = (k, src) => CASES.concat(k === 'keys' ? [{ id: 'master', name: 'Master' }] : []).filter(c => (src[c.id] || 0) > 0 || (M[k][c.id] || 0) > 0).map(c => `<span class="tw-cnt">${escapeHtml(c.name.replace(' Case', ''))} ${k === 'cases' ? 'case' : 'key'} <button data-k="${k}" data-id="${c.id}" data-d="-1">−</button><b>${M[k][c.id] || 0}</b><button data-k="${k}" data-id="${c.id}" data-d="1">+</button><small>of ${src[c.id] || 0}</small></span>`).join('');
    const theirsList = (k, lab) => Object.entries(T.theirs[k]).map(([id, n]) => `<span class="tw-cnt">${n}× ${escapeHtml((CASES.find(c => c.id === id) || { name: 'Master' }).name.replace(' Case', ''))} ${lab}</span>`).join('');
    const inv = D.items.filter(i => !M.items.includes(i.uid)).sort((a, b) => Inv.value(b) - Inv.value(a));
    const stage = T.stage === 'asking' ? `Waiting for ${escapeHtml(T.name)} to accept…` : T.rdy && T.trdy ? 'Both ready. Check the summary and confirm.' : T.rdy ? `You're ready. Waiting for ${escapeHtml(T.name)}…` : T.trdy ? `${escapeHtml(T.name)} is ready.` : 'Build your offer, then press Ready.';
    w.innerHTML = `<div class="pbox tw"><h2>Trade with ${escapeHtml(T.name)}</h2><p class="muted">${stage}</p>
      <div class="tw-cols"><div><h3>Your offer ${T.rdy ? '<span class="ok">✓ ready</span>' : ''}</h3><div class="grid tw-grid">${M.items.map(u => Inv.byUid(u)).filter(Boolean).map(i => UI.itemCard(i, 'sm mine')).join('') || '<p class="muted">Click skins below to add them.</p>'}</div>
          <div class="tw-row">${counts('cases', D.cases)}${counts('keys', D.keys)}</div>
          <div class="tw-row"><label>Credits <input type="number" id="twCred" min="0" max="${D.credits}" value="${M.credits}"> <small class="muted">of ₵${D.credits.toLocaleString()}</small></label></div></div>
        <div><h3>${escapeHtml(T.name)}'s offer ${T.trdy ? '<span class="ok">✓ ready</span>' : ''}</h3><div class="grid tw-grid">${theirCards || '<p class="muted">Nothing yet.</p>'}</div>
          <div class="tw-row">${theirsList('cases', 'case')}${theirsList('keys', 'key')}${T.theirs.credits ? `<span class="tw-cnt">₵${T.theirs.credits.toLocaleString()}</span>` : ''}</div></div></div>
      ${T.rdy && T.trdy ? `<div class="tw-sum">You give <b>${escapeHtml(this.describe(this.cleanOffer(this.myOfferWire())))}</b> and get <b>${escapeHtml(this.describe(T.theirs))}</b>.</div>` : ''}
      <div class="row" style="justify-content:center">${T.stage === 'asking' ? '' : T.rdy && T.trdy ? `<button class="btn big" id="twConf" ${T.conf ? 'disabled' : ''}>${T.conf ? 'Confirmed, waiting…' : 'Confirm trade'}</button>` : `<button class="btn big" id="twReady" ${T.rdy ? 'disabled' : ''}>${T.rdy ? 'Ready ✓' : 'Ready'}</button>`}<button class="btn ghost" id="twCancel">Cancel</button></div>
      ${T.stage === 'asking' ? '' : `<h3>Your inventory</h3><div class="grid tw-inv">${inv.map(i => UI.itemCard(i, 'sm')).join('') || '<p class="muted">No skins.</p>'}</div>`}</div>`;
    UI.paintCards(w); w.querySelectorAll('.card[data-ti]').forEach(c => drawSkinPreview(c.querySelector('canvas'), T.theirs.items[+c.dataset.ti]));
    w.querySelectorAll('.tw-inv .card[data-u]').forEach(c => c.onclick = () => { if (M.items.length >= 20) return UI.toast('20 skins per trade at most'); M.items.push(c.dataset.u); this.pushOffer(); });
    w.querySelectorAll('.tw-grid .card.mine[data-u]').forEach(c => c.onclick = () => { M.items = M.items.filter(u => u !== c.dataset.u); this.pushOffer(); });
    w.querySelectorAll('.tw-cnt button').forEach(b => b.onclick = () => { const k = b.dataset.k, id = b.dataset.id, have = (k === 'cases' ? D.cases : D.keys)[id] || 0; M[k][id] = clamp((M[k][id] || 0) + +b.dataset.d, 0, have); if (!M[k][id]) delete M[k][id]; this.pushOffer(); });
    const cr = $('twCred'); if (cr) cr.onchange = () => { M.credits = clamp(Math.floor(+cr.value || 0), 0, D.credits); this.pushOffer(); };
    const r = $('twReady'); if (r) r.onclick = () => this.ready();
    const cf = $('twConf'); if (cf) cf.onclick = () => this.confirm();
    $('twCancel').onclick = () => this.cancel();
  },
  drawChat() {
    const el = $('hubChat'); if (!el) return;
    el.innerHTML = this.chat.map(m => m.sys ? `<div class="hc sys">${escapeHtml(m.x)}</div>` : `<div class="hc ${m.me ? 'me' : ''}"><b>${escapeHtml(m.n)}</b> ${escapeHtml(m.x)}</div>`).join(''); el.scrollTop = el.scrollHeight;
  },
};
UI.render_hub = function () {
  Hub.connect();
  const st = Hub.state, people = [...Hub.people.values()];
  $('hubStatus').textContent = st === 'on' ? `Connected · Photon ${PhotonNet.region().toUpperCase()} · ${people.length + 1} online` : st === 'connecting' ? 'Connecting to Photon…' : st === 'error' ? Hub.err : 'Offline';
  $('hubPeople').innerHTML = `<div class="hp me"><b>${escapeHtml(Settings.name)}</b> <small>you · level ${Inv.data.level}</small></div>` + (people.map(p => `<div class="hp"><b>${escapeHtml(p.name)}</b> <small>level ${p.lv} · ${p.n} skins</small><button class="btn small" data-nr="${p.nr}" ${Hub.T ? 'disabled' : ''}>Trade</button></div>`).join('') || (st === 'on' ? '<p class="muted">Nobody else is here right now. Leave this open, or ask a friend to come to the Trade Hub.</p>' : ''))
    + (st === 'error' || st === 'off' ? '<button class="btn" id="hubRetry">Connect</button>' : '');
  $('hubPeople').querySelectorAll('[data-nr]').forEach(b => b.onclick = () => Hub.request(+b.dataset.nr));
  const rt = $('hubRetry'); if (rt) rt.onclick = () => { Hub.state = 'off'; Hub.c = null; Hub.connect(); UI.render_hub(); };
  const inp = $('hubSay'); inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { Hub.say(inp.value); inp.value = ''; } };
  Hub.drawChat();
};
const _show36 = UI.show.bind(UI);
UI.show = function (name) { if (name !== 'hub' && this.cur === 'hub' && !Hub.T) Hub.disconnect(); return _show36(name); };
/* a small yes/no box (trade requests) */
UI.confirmBox = function (text, yes, no, cb) {
  let el = $('confirmbox'); if (!el) { el = document.createElement('div'); el.id = 'confirmbox'; el.className = 'ov'; document.body.appendChild(el); }
  el.innerHTML = `<div class="pbox" style="max-width:420px;text-align:center"><p style="font-size:18px">${escapeHtml(text)}</p><div class="row" style="justify-content:center"><button class="btn big" id="cbYes">${escapeHtml(yes)}</button><button class="btn ghost" id="cbNo">${escapeHtml(no)}</button></div></div>`;
  el.classList.remove('hidden'); const done = v => { el.classList.add('hidden'); cb(v); };
  $('cbYes').onclick = () => done(true); $('cbNo').onclick = () => done(false);
  setTimeout(() => { if (!el.classList.contains('hidden')) done(false); }, 25000);
};
