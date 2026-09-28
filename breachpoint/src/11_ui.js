/* ═══════════════════════════════════════════════════════════════════════════
   Menus, armory (inventory / cases / trade-up), buy menu, lobby, settings.
   ═══════════════════════════════════════════════════════════════════════════ */

const KEY_PRICE = 250;
const UI = {
  cur: 'main', pauseOpen: false, buyOpen: false, resultsOpen: false, invFilter: { rarity: -1, weapon: '', sort: 'rarity' }, tradeSel: [], playCfg: null,
  init() {
    this.playCfg = Object.assign({ mode: 'defuse', map: 'dustyard', diff: Settings.diff, teamSize: 5, team: 'auto' }, Store.get('playcfg', {}));
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.play('ui'); this.show(b.dataset.go); }));
    addEventListener('keydown', e => {
      if (Input.typing) return;
      if (e.code === 'Escape') {
        if ($('opener').classList.contains('open')) return;
        if (this.buyOpen) { this.toggleBuy(false); return; }
        if (Game.running && !this.resultsOpen && $('deploy').classList.contains('hidden')) { this.pause(!this.pauseOpen); }
      }
      if (Game.running && !this.blocking() && (e.code === 'KeyY' || e.code === 'Enter')) { e.preventDefault(); HUD.openChat(); }
    });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && Game.running && !this.blocking() && !Input.typing && $('deploy').classList.contains('hidden')) this.pause(true);
    });
    $('view').addEventListener('click', () => { if (Game.running && !this.blocking()) this.lock(); });
    this.show('main');
  },
  blocking() { return this.pauseOpen || this.buyOpen || this.resultsOpen || Input.typing || !$('deploy').classList.contains('hidden'); },
  lock() { if (!Game.running || this.blocking()) return; const c = Game.renderer.domElement; const plain = () => { try { const q = c.requestPointerLock(); if (q && q.catch) q.catch(() => { }); } catch (e) { } };
    try { const p = c.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(plain); } catch (e) { plain(); } },
  toast(t, ms = 3000) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(this.toastT); this.toastT = setTimeout(() => e.classList.remove('show'), ms); },
  show(name) {
    this.cur = name; $('menu').classList.remove('hidden');
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + name));
    $('credits').textContent = Inv.data.credits.toLocaleString();
    const r = this['render_' + name]; if (r) r.call(this);
  },

  /* ── main ── */
  render_main() {
    const d = Inv.data, eq = Object.keys(d.equipped).length;
    $('mainStats').innerHTML = `<div><b>${d.stats.kills}</b><small>kills</small></div><div><b>${d.stats.wins}</b><small>wins</small></div><div><b>${d.items.length}</b><small>skins</small></div><div><b>${Object.values(d.cases).reduce((a, b) => a + b, 0)}</b><small>cases</small></div><div><b>${d.keys}</b><small>keys</small></div>`;
    $('mainName').value = Settings.name;
    $('mainName').onchange = () => { Settings.name = $('mainName').value.trim().slice(0, 16) || Settings.name; saveSettings(); };
    $('equipCount').textContent = eq ? `${eq} skin${eq > 1 ? 's' : ''} equipped` : 'No skins equipped yet';
  },

  /* ── solo setup ── */
  render_play() {
    const c = this.playCfg, M = MODES[c.mode];
    if (!M.maps.includes(c.map)) c.map = M.maps[0];
    const seg = (key, opts) => `<div class="seg" data-k="${key}">${opts.map(([v, l, sub]) => `<button class="${String(c[key]) === String(v) ? 'on' : ''}" data-v="${v}">${l}${sub ? `<small>${sub}</small>` : ''}</button>`).join('')}</div>`;
    const sizes = c.mode === 'defuse' ? [3, 5] : c.mode === 'conquest' ? [8, 12, 16] : [4, 6, 8];
    if (!sizes.includes(+c.teamSize)) c.teamSize = sizes[sizes.length > 2 ? 1 : 1];
    $('playForm').innerHTML = `
      <label>Mode</label>${seg('mode', [['defuse', 'Defuse', 'CS-style rounds, bomb, economy'], ['conquest', 'Conquest', 'Battlefield flags, tickets, jeeps'], ['tdm', 'Team Deathmatch', 'Respawns, classes']])}
      <label>Map</label>${seg('map', M.maps.map(m => [m, MAPS[m].name, MAPS[m].desc]))}
      <label>Players per team</label>${seg('teamSize', sizes.map(n => [n, n + 'v' + n]))}
      <label>Bot skill</label>${seg('diff', Object.entries(DIFF).map(([k, v]) => [k, v.label]))}
      <label>Your team</label>${seg('team', [['auto', 'Auto'], ['CT', 'Aegis', c.mode === 'defuse' ? 'defend' : ''], ['T', 'Vanta', c.mode === 'defuse' ? 'attack' : '']])}`;
    $('playForm').querySelectorAll('.seg').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => { const k = s.dataset.k; c[k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; Store.set('playcfg', c); Sfx.play('ui'); this.render_play(); }));
    $('playGo').onclick = () => this.startSolo();
  },
  startSolo() {
    const c = this.playCfg, team = c.team === 'auto' ? pick(['T', 'CT']) : c.team;
    Net.leave();
    this.enterGame({ mode: c.mode, map: c.map, diff: c.diff, teamSize: c.teamSize, players: [{ id: 'me', name: Settings.name, team, ctrl: 'local', cls: 'assault' }], localId: 'me' });
  },
  enterGame(cfg) {
    Sfx.init();
    $('menu').classList.add('hidden'); this.pause(false); this.resultsOpen = false; $('results').classList.add('hidden');
    MenuBG.stop();
    Game.start(cfg);
    setTimeout(() => this.lock(), 50);
  },
  leaveGame() {
    Game.stop(); Net.leave(); this.pause(false); this.toggleBuy(false); $('hud').classList.add('hidden'); HUD.showDeploy(false);
    MenuBG.start(); this.show('main');
  },

  /* ── multiplayer ── */
  render_mp() {
    $('mpName').value = Settings.name;
    $('mpName').onchange = () => { Settings.name = $('mpName').value.trim().slice(0, 16) || Settings.name; saveSettings(); };
    const hostOn = code => { this.openLobby(); Net.host(code, { mode: this.playCfg.mode, map: this.playCfg.map, diff: this.playCfg.diff, teamSize: this.playCfg.teamSize }); };
    $('mpHost').onclick = () => { const typed = $('mpCode').value.trim(); if (/^wss?:\/\//i.test(typed)) return hostOn(typed); const code = uid(5); hostOn($('mpLocal').checked ? 'local:' + code : code); };
    const D = window.__breachDesktop;
    $('mpLan').classList.toggle('hidden', !(D && D.relay));
    if (D && D.relay) {
      $('mpLanAddr').textContent = (D.lan && D.lan.length ? D.lan : [D.relay]).join('  ·  ');
      $('mpLanHost').onclick = () => hostOn(D.relay);
    }
    $('mpJoin').onclick = () => { const code = $('mpCode').value.trim(); if (!code) return this.toast('Enter a room code'); this.openLobby(); Net.join(code); };
    Net.onError = e => { this.toast(e, 5000); if (this.cur === 'lobby' && !Net.connected) { Net.leave(); this.show('mp'); } };
  },
  openLobby() { Net.onLobby = () => { if (this.cur === 'lobby') this.render_lobby(); }; this.show('lobby'); },
  render_lobby() {
    const L = Net.lobby, host = Net.role === 'host';
    const code = Net.code || '';
    $('lobbyCode').textContent = code.replace(/^local:/i, '');
    const D = window.__breachDesktop;
    $('lobbyHint').textContent = /^local:/i.test(code) ? 'Local test room — open this page in another tab of the same browser, Multiplayer → Join, and type local:' + code.slice(6)
      : /^ws/i.test(code) ? 'LAN room. Friends on your network join with: ' + (D && D.lan && D.lan.length && /localhost/.test(code) ? D.lan[0] : code)
        : 'Friends: Multiplayer → Join → type this code. Works over the internet.';
    $('lobbyStatus').textContent = Net.status || (Net.role === 'client' && !Net.connected ? 'Connecting…' : '');
    if (!L) { $('lobbyTeams').innerHTML = '<p class="muted">Waiting for host…</p>'; $('lobbySettings').innerHTML = ''; $('lobbyStart').classList.add('hidden'); return; }
    const me = host ? 'host' : Net.sid;
    const col = team => `<div class="lteam"><h3 style="color:${TEAM_STYLE[team].color}">${TEAM_STYLE[team].name}</h3>${L.players.filter(p => p.team === team).map(p => `<div class="lp ${p.id === me ? 'me' : ''}">${escapeHtml(p.name)}${p.id === 'host' ? ' <small>host</small>' : ''}</div>`).join('')}<div class="lp bots">+ bots fill to ${L.teamSize}</div><button class="btn small" data-team="${team}">Join ${TEAM_STYLE[team].name}</button></div>`;
    $('lobbyTeams').innerHTML = col('CT') + col('T');
    $('lobbyTeams').querySelectorAll('[data-team]').forEach(b => b.onclick = () => Net.setTeam(b.dataset.team));
    const M = MODES[L.mode];
    if (host) {
      const sel = (k, opts) => `<select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(L[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      const sizes = L.mode === 'defuse' ? [3, 5] : L.mode === 'conquest' ? [8, 12, 16] : [4, 6, 8];
      $('lobbySettings').innerHTML = `<label>Mode ${sel('mode', Object.values(MODES).map(m => [m.id, m.name]))}</label><label>Map ${sel('map', M.maps.map(m => [m, MAPS[m].name]))}</label><label>Team size ${sel('teamSize', sizes.map(n => [n, n + 'v' + n]))}</label><label>Bots ${sel('diff', Object.entries(DIFF).map(([k, v]) => [k, v.label]))}</label>`;
      $('lobbySettings').querySelectorAll('select').forEach(s => s.onchange = () => { const k = s.dataset.k; L[k] = isNaN(+s.value) ? s.value : +s.value; if (k === 'mode') { L.map = MODES[L.mode].maps[0]; L.teamSize = MODES[L.mode].teamSize; } Net.pushLobby(); this.render_lobby(); });
      $('lobbyStart').classList.remove('hidden'); $('lobbyStart').onclick = () => Net.startMatch();
    } else {
      $('lobbySettings').innerHTML = `<p>${M.name} · ${MAPS[L.map].name} · ${L.teamSize}v${L.teamSize} · ${DIFF[L.diff].label} bots</p><p class="muted">Waiting for the host to start…</p>`;
      $('lobbyStart').classList.add('hidden');
    }
    $('lobbyLeave').onclick = () => { Net.leave(); this.show('mp'); };
  },

  /* ── armory ── */
  armoryTab: 'inv',
  render_armory() {
    document.querySelectorAll('#armTabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === this.armoryTab); b.onclick = () => { this.armoryTab = b.dataset.t; Sfx.play('ui'); this.render_armory(); }; });
    $('credits').textContent = Inv.data.credits.toLocaleString();
    const body = $('armBody');
    if (this.armoryTab === 'inv') this.renderInventory(body);
    else if (this.armoryTab === 'cases') this.renderCases(body);
    else if (this.armoryTab === 'trade') this.renderTrade(body);
    else this.renderStats(body);
  },
  itemCard(it, extra = '') {
    const s = SKINS[it.skinId], r = RARITY[s.rarity];
    return `<div class="card ${Inv.isEquipped(it) ? 'eq' : ''} ${extra}" data-u="${it.uid}" style="--rc:${r.color}"><canvas width="220" height="110"></canvas>
      <div class="cn">${escapeHtml(Inv.displayName(it))}</div><div class="cw">${wearOf(it.float).name}${it.st ? ` · <span class="st">ST ${it.kills}</span>` : ''}</div><div class="cr">${r.name}<span>₵${Inv.value(it)}</span></div>${Inv.isEquipped(it) ? '<div class="badge">EQUIPPED</div>' : ''}</div>`;
  },
  paintCards(root) { root.querySelectorAll('.card[data-u]').forEach(c => { const it = Inv.byUid(c.dataset.u); if (it) drawSkinPreview(c.querySelector('canvas'), it); }); },
  renderInventory(body) {
    const F = this.invFilter;
    let items = Inv.data.items.slice();
    if (F.rarity >= 0) items = items.filter(i => SKINS[i.skinId].rarity === F.rarity);
    if (F.weapon) items = items.filter(i => SKINS[i.skinId].weapon === F.weapon);
    items.sort(F.sort === 'value' ? (a, b) => Inv.value(b) - Inv.value(a) : F.sort === 'new' ? (a, b) => b.t - a.t : (a, b) => SKINS[b.skinId].rarity - SKINS[a.skinId].rarity || Inv.value(b) - Inv.value(a));
    const weps = [...new Set(Inv.data.items.map(i => SKINS[i.skinId].weapon))];
    const total = Inv.data.items.reduce((a, i) => a + Inv.value(i), 0);
    body.innerHTML = `<div class="bar"><select id="fR"><option value="-1">All rarities</option>${RARITY.map((r, i) => `<option value="${i}" ${F.rarity === i ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
      <select id="fW"><option value="">All weapons</option>${weps.map(w => `<option value="${w}" ${F.weapon === w ? 'selected' : ''}>${w === 'knife' ? 'Knives' : WEAPONS[w].name}</option>`).join('')}</select>
      <select id="fS"><option value="rarity">Sort: rarity</option><option value="value" ${F.sort === 'value' ? 'selected' : ''}>Sort: value</option><option value="new" ${F.sort === 'new' ? 'selected' : ''}>Sort: newest</option></select>
      <span class="muted">${Inv.data.items.length} items · worth ₵${total.toLocaleString()}</span></div>
      <div class="grid">${items.map(i => this.itemCard(i)).join('') || '<p class="muted">Nothing here yet. Open a case or win matches for drops.</p>'}</div>`;
    $('fR').onchange = e => { F.rarity = +e.target.value; this.renderInventory(body); };
    $('fW').onchange = e => { F.weapon = e.target.value; this.renderInventory(body); };
    $('fS').onchange = e => { F.sort = e.target.value; this.renderInventory(body); };
    this.paintCards(body);
    body.querySelectorAll('.card').forEach(c => c.onclick = () => this.inspect(Inv.byUid(c.dataset.u)));
  },
  inspect(it) {
    if (!it) return; const s = SKINS[it.skinId], r = RARITY[s.rarity], eq = Inv.isEquipped(it);
    const m = $('modal'); m.classList.add('open');
    const blue = s.pattern === 'case' && caseBlue(it) > 0.5, gem = s.pattern === 'doppler' && it.seed % 97 === 0;
    m.innerHTML = `<div class="mbox" style="--rc:${r.color}"><canvas id="inspCv" width="620" height="300"></canvas>
      <h2>${escapeHtml(Inv.displayName(it))}</h2><div class="rar" style="color:${r.color}">${r.name} ${s.weapon === 'knife' ? 'Knife' : WEAPONS[s.weapon].type}${blue ? ' · ★ BLUE GEM pattern' : ''}${gem ? ' · ★ RARE GEM pattern' : ''}</div>
      <div class="floatbar"><span style="left:${it.float * 100}%"></span></div><div class="fl">${wearOf(it.float).name} · float ${it.float.toFixed(4)} · pattern #${it.seed}${it.st ? ' · StatTrak kills: ' + it.kills : ''}</div>
      <div class="row"><button class="btn" id="insEq">${eq ? 'Unequip' : 'Equip'}</button><button class="btn warn" id="insSell">Sell for ₵${Inv.value(it)}</button><button class="btn ghost" id="insClose">Close</button></div></div>`;
    const cv = $('inspCv'); let ang = 0; const draw = () => { if (!m.classList.contains('open') || !$('inspCv')) return; const c = cv.getContext('2d'); c.clearRect(0, 0, 620, 300); const tmp = document.createElement('canvas'); tmp.width = 560; tmp.height = 280; drawSkinPreview(tmp, it); c.save(); c.translate(310, 150); c.rotate(Math.sin(ang) * 0.08); c.scale(1, 1 - Math.abs(Math.sin(ang)) * 0.05); c.drawImage(tmp, -280, -140); c.restore(); ang += 0.02; requestAnimationFrame(draw); }; draw();
    $('insEq').onclick = () => { if (eq) Inv.unequip(s.weapon); else Inv.equip(it); Sfx.play('ui'); this.closeModal(); this.render_armory(); };
    $('insSell').onclick = () => { if (s.rarity >= 4 && !confirm(`Sell ${Inv.displayName(it)}?`)) return; const v = Inv.sell(it); this.toast(`Sold for ₵${v}`); Sfx.play('buy'); this.closeModal(); this.render_armory(); };
    $('insClose').onclick = () => this.closeModal();
  },
  closeModal() { $('modal').classList.remove('open'); $('modal').innerHTML = ''; },
  renderCases(body) {
    const d = Inv.data;
    body.innerHTML = `<div class="bar"><span>🔑 Keys: <b>${d.keys}</b></span><button class="btn small" id="buyKey">Buy key ₵${KEY_PRICE}</button><span class="muted">Every case needs one key. Cases drop after matches too.</span></div>
      <div class="cases">${CASES.map(c => {
        const odds = [1, 2, 3, 4, 5, 6].map(r => `<span style="color:${RARITY[r].color}">${RARITY[r].name} ${(CASE_ODDS[r] * 100).toFixed(r >= 5 ? 1 : 0)}%</span>`).join(' · ');
        return `<div class="case" style="--cc:${c.color}"><div class="case-art"><div class="crate"><span>${c.name.split(' ')[0].toUpperCase()}</span></div></div>
        <h3>${c.name}</h3><p class="muted">${c.desc}</p><div class="own">Owned: <b>${d.cases[c.id] || 0}</b></div>
        <div class="row"><button class="btn small" data-buy="${c.id}">Buy ₵${c.price}</button><button class="btn" data-open="${c.id}" ${d.cases[c.id] && d.keys ? '' : 'disabled'}>Open</button></div>
        <div class="odds">${odds}</div>
        <div class="contents">${SKIN_LIST.filter(s => s.caseId === c.id).sort((a, b) => b.rarity - a.rarity).map(s => `<div class="ci" style="--rc:${RARITY[s.rarity].color}" title="${escapeHtml(s.name)}"><canvas width="110" height="55" data-skin="${s.id}"></canvas><small>${s.weapon === 'knife' ? '★ ' + escapeHtml(s.name) : WEAPONS[s.weapon].name + ' | ' + escapeHtml(s.name)}</small></div>`).join('')}</div></div>`;
      }).join('')}</div>`;
    body.querySelectorAll('canvas[data-skin]').forEach(cv => { const s = SKINS[cv.dataset.skin]; drawSkinPreview(cv, { seed: 1, float: 0.03, skinId: s.id }, s.weapon === 'knife' ? Object.assign({}, s, { pattern: 'solid', pal: ['#e4ae39', '#b88a20'] }) : s); });
    $('buyKey').onclick = () => { if (d.credits < KEY_PRICE) return this.toast('Not enough credits'); d.credits -= KEY_PRICE; d.keys++; Inv.save(); Sfx.play('buy'); this.render_armory(); };
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const c = CASES.find(x => x.id === b.dataset.buy); if (d.credits < c.price) return this.toast('Not enough credits'); d.credits -= c.price; d.cases[c.id]++; Inv.save(); Sfx.play('buy'); this.render_armory(); });
    body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => this.openCase(b.dataset.open));
  },
  /* the reel: a long strip slides and eases to a stop on the prize */
  openCase(caseId) {
    const d = Inv.data; if (!d.cases[caseId] || !d.keys) return;
    d.cases[caseId]--; d.keys--; d.stats.opened++;
    const prize = rollCase(caseId); d.items.push(prize); Inv.save();
    const WIN = 52, N = 60, CW = 170;
    const strip = []; for (let i = 0; i < N; i++) strip.push(i === WIN ? { skin: SKINS[prize.skinId], item: prize } : { skin: reelFiller(caseId) });
    const o = $('opener'); o.classList.add('open');
    o.innerHTML = `<div class="reelwrap"><div class="marker"></div><div class="reel" id="reel">${strip.map((e, i) => `<div class="ri" style="--rc:${RARITY[e.skin.rarity].color}"><canvas width="150" height="75" data-i="${i}"></canvas><small>${e.skin.weapon === 'knife' ? '★ Rare Special Item' : WEAPONS[e.skin.weapon].name}</small><b>${e.skin.weapon === 'knife' ? '★' : escapeHtml(e.skin.name)}</b></div>`).join('')}</div></div><div id="reveal"></div>`;
    o.querySelectorAll('canvas[data-i]').forEach(cv => { const e = strip[+cv.dataset.i]; if (e.skin.weapon === 'knife' && e !== strip[WIN]) { const c = cv.getContext('2d'); c.fillStyle = '#e4ae39'; c.font = 'bold 44px serif'; c.textAlign = 'center'; c.fillText('★', 75, 52); } else if (e.skin.weapon === 'knife') { const c = cv.getContext('2d'); c.fillStyle = '#e4ae39'; c.font = 'bold 44px serif'; c.textAlign = 'center'; c.fillText('★', 75, 52); } else drawSkinPreview(cv, e.item || { seed: 3, float: 0.05, skinId: e.skin.id }); });
    const reel = $('reel'), wrap = o.querySelector('.reelwrap');
    const center = wrap.clientWidth / 2, target = WIN * CW + CW / 2 - center + rand(-CW * 0.4, CW * 0.4);
    const dur = 6200, t0 = performance.now(); let lastIdx = -1;
    const ease = t => 1 - Math.pow(1 - t, 4.2);
    const step = now => {
      const t = clamp((now - t0) / dur, 0, 1), x = target * ease(t);
      reel.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + center) / CW); if (idx !== lastIdx) { lastIdx = idx; Sfx.play('tick', null, { p: t * 400 }); }
      if (t < 1) requestAnimationFrame(step); else this.reveal(prize, caseId);
    };
    requestAnimationFrame(step);
  },
  reveal(it, caseId) {
    const s = SKINS[it.skinId], r = RARITY[s.rarity];
    Sfx.play(s.rarity >= 4 ? 'rare' : 'reveal');
    const el = $('reveal');
    el.innerHTML = `<div class="prize" style="--rc:${r.color}"><canvas width="520" height="240" id="prizeCv"></canvas><div class="pn">${escapeHtml(Inv.displayName(it))}</div><div class="pr" style="color:${r.color}">${r.name} · ${wearOf(it.float).name} · float ${it.float.toFixed(4)}</div>
      <div class="row"><button class="btn" id="pvEquip">Equip</button><button class="btn warn" id="pvSell">Sell ₵${Inv.value(it)}</button><button class="btn" id="pvAgain" ${Inv.data.cases[caseId] && Inv.data.keys ? '' : 'disabled'}>Open another</button><button class="btn ghost" id="pvClose">Close</button></div></div>`;
    drawSkinPreview($('prizeCv'), it);
    if (s.rarity >= 5) el.querySelector('.prize').classList.add('burst');
    const close = () => { $('opener').classList.remove('open'); $('opener').innerHTML = ''; this.render_armory(); };
    $('pvEquip').onclick = () => { Inv.equip(it); this.toast('Equipped'); close(); };
    $('pvSell').onclick = () => { this.toast(`Sold for ₵${Inv.sell(it)}`); close(); };
    $('pvAgain').onclick = () => { $('opener').innerHTML = ''; this.openCase(caseId); };
    $('pvClose').onclick = close;
  },
  renderTrade(body) {
    const sel = this.tradeSel.map(u => Inv.byUid(u)).filter(Boolean); this.tradeSel = sel.map(i => i.uid);
    const rar = sel.length ? SKINS[sel[0].skinId].rarity : null, st = sel.length ? sel[0].st : null;
    const eligible = Inv.data.items.filter(i => { const s = SKINS[i.skinId]; return s.weapon !== 'knife' && s.rarity < 5 && s.rarity >= 0 && (rar == null || (s.rarity === rar && i.st === st)) && !Inv.isEquipped(i); });
    let outcomes = '';
    if (sel.length) {
      const pool = {}; sel.forEach(i => SKIN_LIST.filter(s => s.caseId === SKINS[i.skinId].caseId && s.rarity === rar + 1 && s.weapon !== 'knife').forEach(s => pool[s.id] = (pool[s.id] || 0) + 1));
      const tot = Object.values(pool).reduce((a, b) => a + b, 0);
      outcomes = Object.entries(pool).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<span style="color:${RARITY[rar + 1].color}">${WEAPONS[SKINS[id].weapon].name} | ${escapeHtml(SKINS[id].name)} ${(n / tot * 100).toFixed(0)}%</span>`).join('') || '<span class="muted">No higher tier in these collections — any skin of the next rarity.</span>';
    }
    const avgF = sel.length ? sel.reduce((a, i) => a + i.float, 0) / sel.length : 0;
    body.innerHTML = `<div class="trade"><div class="tslots">${Array.from({ length: 10 }, (_, k) => sel[k] ? this.itemCard(sel[k], 'slot') : '<div class="card empty"></div>').join('')}</div>
      <div class="tinfo"><h3>Trade-Up Contract</h3><p class="muted">Ten skins of the same rarity (StatTrak must match) become one skin of the next rarity, from the same collections. The result's float is the average of the inputs.</p>
      <p>${sel.length}/10 · ${rar != null ? RARITY[rar].name + ' → <b style="color:' + RARITY[rar + 1].color + '">' + RARITY[rar + 1].name + '</b>' : 'pick any skin to start'} ${sel.length ? '· output float ≈ ' + avgF.toFixed(3) : ''}</p>
      <div class="outcomes">${outcomes}</div><div class="row"><button class="btn" id="tuGo" ${sel.length === 10 ? '' : 'disabled'}>Sign contract</button><button class="btn ghost" id="tuClear">Clear</button><button class="btn ghost" id="tuFill">Auto-fill</button></div></div></div>
      <h4>Eligible (${eligible.length})</h4><div class="grid">${eligible.filter(i => !this.tradeSel.includes(i.uid)).map(i => this.itemCard(i)).join('')}</div>`;
    this.paintCards(body);
    body.querySelectorAll('.grid .card').forEach(c => c.onclick = () => { if (this.tradeSel.length < 10) { this.tradeSel.push(c.dataset.u); Sfx.play('ui'); this.renderTrade(body); } });
    body.querySelectorAll('.tslots .card[data-u]').forEach(c => c.onclick = () => { this.tradeSel = this.tradeSel.filter(u => u !== c.dataset.u); this.renderTrade(body); });
    $('tuClear').onclick = () => { this.tradeSel = []; this.renderTrade(body); };
    $('tuFill').onclick = () => {
      if (!this.tradeSel.length) { const groups = {}; eligible.forEach(i => { const k = SKINS[i.skinId].rarity + ':' + i.st; (groups[k] = groups[k] || []).push(i); }); const best = Object.values(groups).sort((a, b) => b.length - a.length)[0]; if (best) this.tradeSel = best.sort((a, b) => Inv.value(a) - Inv.value(b)).slice(0, 10).map(i => i.uid); }
      else { for (const i of eligible.sort((a, b) => Inv.value(a) - Inv.value(b))) { if (this.tradeSel.length >= 10) break; if (!this.tradeSel.includes(i.uid)) this.tradeSel.push(i.uid); } }
      this.renderTrade(body);
    };
    $('tuGo').onclick = () => {
      const res = tradeUp(sel); if (!res) return this.toast('Contract invalid');
      Inv.data.items = Inv.data.items.filter(i => !this.tradeSel.includes(i.uid)); Inv.data.items.push(res); Inv.save(); this.tradeSel = [];
      $('opener').classList.add('open'); $('opener').innerHTML = '<div id="reveal"></div>'; this.reveal(res, '__none');
    };
  },
  renderStats(body) {
    const s = Inv.data.stats, v = Inv.data.items.reduce((a, i) => a + Inv.value(i), 0), best = Inv.data.items.slice().sort((a, b) => Inv.value(b) - Inv.value(a))[0];
    body.innerHTML = `<div class="stats"><div><b>${s.matches}</b><small>matches</small></div><div><b>${s.wins}</b><small>wins</small></div><div><b>${s.kills}</b><small>kills</small></div><div><b>${s.deaths}</b><small>deaths</small></div><div><b>${s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills}</b><small>K/D</small></div><div><b>${s.opened}</b><small>cases opened</small></div><div><b>₵${v.toLocaleString()}</b><small>inventory value</small></div></div>
      ${best ? '<h4>Most valuable</h4><div class="grid">' + this.itemCard(best) + '</div>' : ''}<p class="muted" style="margin-top:20px">Bots remember which sites went badly for them across matches. <button class="btn small ghost" id="resetAi">Reset bot memory</button> <button class="btn small ghost" id="resetInv">Reset everything</button></p>`;
    this.paintCards(body);
    $('resetAi').onclick = () => { Store.set('ai_mem_T', null); Store.set('ai_mem_CT', null); this.toast('Bot memory cleared'); };
    $('resetInv').onclick = () => { if (confirm('Wipe inventory, credits and stats?')) { Store.set('inv', null); Inv.load(); this.render_armory(); } };
  },

  /* ── settings ── */
  render_settings() {
    const S = Settings;
    const rng = (k, label, min, max, step) => `<label>${label} <input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${S[k]}"><output>${S[k]}</output></label>`;
    $('setForm').innerHTML = `<label>Name <input type="text" data-k="name" value="${escapeHtml(S.name)}" maxlength="16"></label>
      ${rng('sens', 'Mouse sensitivity', 0.1, 4, 0.05)}${rng('fov', 'Field of view', 65, 110, 1)}${rng('vol', 'Volume', 0, 1, 0.05)}
      <label>Default bot skill <select data-k="diff">${Object.entries(DIFF).map(([k, v]) => `<option value="${k}" ${S.diff === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label>Crosshair color <input type="color" data-k="xhColor" value="${S.xhColor}"></label>${rng('xhSize', 'Crosshair length', 2, 16, 1)}${rng('xhGap', 'Crosshair gap', 0, 12, 1)}
      <label><input type="checkbox" data-k="xhDot" ${S.xhDot ? 'checked' : ''}> Center dot</label><label><input type="checkbox" data-k="showFps" ${S.showFps ? 'checked' : ''}> Show FPS</label>`;
    $('setForm').querySelectorAll('[data-k]').forEach(el => el.oninput = () => {
      const k = el.dataset.k; S[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
      if (el.nextElementSibling && el.nextElementSibling.tagName === 'OUTPUT') el.nextElementSibling.textContent = el.value;
      saveSettings(); HUD.applyCrosshair(); if (k === 'fov' && Game.camera) { Game.camera.fov = S.fov; Game.camera.updateProjectionMatrix(); }
    });
  },

  /* ── in-game overlays ── */
  pause(on) {
    this.pauseOpen = !!on; $('pause').classList.toggle('hidden', !on);
    if (on) {
      Input.clear(); if (document.pointerLockElement) document.exitPointerLock();
      $('pauseInfo').textContent = Net.role === 'off' ? 'Solo · the match keeps running' : `Room ${Net.code} · ${Net.role}`;
      $('pSens').value = Settings.sens; $('pSens').oninput = e => { Settings.sens = +e.target.value; saveSettings(); };
      $('pVol').value = Settings.vol; $('pVol').oninput = e => { Settings.vol = +e.target.value; saveSettings(); };
      $('pResume').onclick = () => { this.pause(false); this.lock(); };
      $('pLeave').onclick = () => this.leaveGame();
    }
  },
  canBuy(s) {
    const R = Game.round; if (!Game.mode.buy || !R || !s.alive) return false;
    if (!(R.phase === 'freeze' || (R.phase === 'live' && Game.mode.roundTime - R.timeLeft < 25))) return false;
    const sp = World.spawns[s.team][0]; return dist2(s.pos.x, s.pos.z, sp.x, sp.z) < 22;
  },
  buyItems(team) {
    const w = id => ({ id, name: WEAPONS[id].name, price: WEAPONS[id].price });
    return [
      ['Pistols', [w(team === 'T' ? 'glock' : 'p2000'), w('deagle')]],
      ['SMGs', [w('mp9'), w('p90')]],
      ['Heavy', [w('nova'), w('m249')]],
      ['Rifles', [w(team === 'T' ? 'ak47' : 'm4a4'), w('scar')]],
      ['Snipers', [w('ssg'), w('awp')]],
      ['Gear', [{ id: 'kevlar', name: 'Kevlar', price: 650 }, { id: 'helmet', name: 'Kevlar + Helmet', price: 1000 }].concat(team === 'CT' ? [{ id: 'kit', name: 'Defuse Kit', price: 400 }] : [])],
      ['Grenades', [{ id: 'frag', name: 'HE Grenade', price: 300 }, { id: 'flash', name: 'Flashbang', price: 200 }, { id: 'smoke', name: 'Smoke', price: 300 }]],
    ];
  },
  priceOf(id) { return WEAPONS[id] ? WEAPONS[id].price : GRENADES[id] ? GRENADES[id].price : EQUIP[id] ? (id === 'helmet' ? 1000 : EQUIP[id].price) : 0; },
  applyBuy(s, id) {
    if (!this.canBuy(s)) return false;
    let price = this.priceOf(id); if (id === 'helmet' && s.armor >= 100) price = 350;
    if (s.money < price) return false;
    if (WEAPONS[id]) { const w = WEAPONS[id]; if (w.side && w.side !== s.team) return false; if (s.weapons[w.slot] === id) return false; }
    else if (GRENADES[id]) { if (s.nades[id] >= GRENADES[id].max) return false; }
    else if (id === 'kevlar') { if (s.armor >= 100) return false; }
    else if (id === 'helmet') { if (s.helmet && s.armor >= 100) return false; }
    else if (id === 'kit') { if (s.kit || s.team !== 'CT') return false; }
    s.money -= price;
    if (WEAPONS[id] || GRENADES[id]) s.give(id);
    else if (id === 'kevlar') s.armor = 100; else if (id === 'helmet') { s.armor = 100; s.helmet = true; } else if (id === 'kit') s.kit = true;
    return true;
  },
  toggleBuy(on) {
    if (on === undefined) on = !this.buyOpen;
    const L = Game.local;
    if (on && (!L || !this.canBuy(L))) { HUD.center('Buy time is over — or you left spawn', 1.2); return; }
    this.buyOpen = on; $('buy').classList.toggle('hidden', !on);
    if (on) { Input.clear(); if (document.pointerLockElement) document.exitPointerLock(); this.refreshBuy(); } else this.lock();
  },
  refreshBuy() {
    if (!this.buyOpen) return; const L = Game.local;
    $('buy').innerHTML = `<div class="buyh"><h2>Buy</h2><span class="money">$${L.money}</span><span class="muted">B or Esc to close · items go straight into your hands</span></div><div class="buycols">${this.buyItems(L.team).map(([cat, list]) => `<div class="bcat"><h4>${cat}</h4>${list.map(it => { const own = L.has(it.id) || (it.id === 'kit' && L.kit) || (it.id === 'helmet' && L.helmet && L.armor >= 100) || (it.id === 'kevlar' && L.armor >= 100); const it2 = WEAPONS[it.id] && Inv.equippedItem(it.id); return `<button class="bi ${own ? 'own' : ''}" data-id="${it.id}" ${L.money < this.priceOf(it.id) && !own ? 'disabled' : ''}><span>${it.name}${it2 ? ' <i style="color:' + RARITY[SKINS[it2.skinId].rarity].color + '">◆</i>' : ''}</span><b>$${it.price}</b></button>`; }).join('')}</div>`).join('')}</div>`;
    $('buy').querySelectorAll('.bi').forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      if (Net.role === 'client') { Net.send({ t: 'buy', item: id }); return; }
      if (this.applyBuy(L, id)) { Sfx.play('buy'); this.refreshBuy(); } else Sfx.play('empty');
    });
  },
  matchResults(r) {
    if (!Game.running) return;
    this.resultsOpen = true; this.toggleBuy(false); HUD.showDeploy(false);
    if (document.pointerLockElement) document.exitPointerLock();
    const L = Game.local, e = $('results'); e.classList.remove('hidden');
    let drop = '';
    if (r.drop) drop = r.drop.kind === 'case' ? `<div class="drop">Drop: <b style="color:${CASES.find(c => c.id === r.drop.caseId).color}">${CASES.find(c => c.id === r.drop.caseId).name}</b></div>` : `<div class="drop">Drop: ${this.itemCard(r.drop.item)}</div>`;
    e.innerHTML = `<div class="rbox"><h1 class="${r.won ? 'win' : 'loss'}">${r.won ? 'VICTORY' : 'DEFEAT'}</h1><p>${TEAM_STYLE[r.winner].name} wins ${Game.mode.id === 'defuse' ? Game.score[r.winner] + ' – ' + Game.score[other(r.winner)] : ''}</p>
      <div class="stats"><div><b>${L.kills}</b><small>kills</small></div><div><b>${L.assists}</b><small>assists</small></div><div><b>${L.deaths}</b><small>deaths</small></div><div><b>${L.mvps}</b><small>MVPs</small></div><div><b>+₵${r.credits}</b><small>credits</small></div></div>${drop}
      <div class="row"><button class="btn" id="resMenu">Main menu</button><button class="btn" id="resArm">Armory</button>${Net.role === 'off' ? '<button class="btn" id="resAgain">Play again</button>' : ''}</div></div>`;
    this.paintCards(e);
    $('resMenu').onclick = () => { this.leaveGame(); };
    $('resArm').onclick = () => { this.leaveGame(); this.armoryTab = 'inv'; this.show('armory'); };
    if ($('resAgain')) $('resAgain').onclick = () => { this.leaveGame(); this.startSolo(); };
  },
};

/* A slow orbit over Dustyard behind the menus. */
const MenuBG = {
  on: false, t: 0,
  start() {
    this.on = true; Game.scene = new THREE.Scene(); loadMap('dustyard', Game.scene);
    Game.scene.background = new THREE.Color(World.skyColor); Game.scene.fog = new THREE.Fog(World.fog[0], 50, 160);
    Game.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a7a60, 1.35)); const sun = new THREE.DirectionalLight(World.sun, 2.2); sun.position.set(40, 80, 25); Game.scene.add(sun);
    Game.view = null;
  },
  stop() { this.on = false; },
  update(dt) { if (!this.on) return; this.t += dt * 0.05; const c = Game.camera; c.position.set(Math.sin(this.t) * 48, 26, Math.cos(this.t) * 48); c.lookAt(0, 0, 0); if (c.fov !== 70) { c.fov = 70; c.updateProjectionMatrix(); } },
};
