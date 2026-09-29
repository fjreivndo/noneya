/* ═══════════════════════════════════════════════════════════════════════════
   Menus, armory (inventory / cases / trade-up), buy menu, lobby, settings.
   ═══════════════════════════════════════════════════════════════════════════ */

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
        if (this.spawnOpen) { this.toggleSpawnMenu(false); return; }
        if (Game.running && !this.resultsOpen && $('deploy').classList.contains('hidden')) { this.pause(!this.pauseOpen); }
      }
      if (Game.running && !this.blocking() && (e.code === 'KeyY' || e.code === 'Enter')) { e.preventDefault(); HUD.openChat(); }
      if (e.code === 'KeyQ' && this.spawnOpen && !e.repeat) { this.toggleSpawnMenu(false); Input.pressed.KeyQ = false; }
    });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && Game.running && !this.blocking() && !Input.typing && $('deploy').classList.contains('hidden')) this.pause(true);
    });
    $('view').addEventListener('click', () => { if (Game.running && !this.blocking()) this.lock(); });
    this.show('main');
  },
  blocking() { return this.pauseOpen || this.buyOpen || this.spawnOpen || this.resultsOpen || Input.typing || !$('deploy').classList.contains('hidden'); },
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
    $('mainStats').innerHTML = `<div><b>${d.stats.kills}</b><small>kills</small></div><div><b>${d.stats.wins}</b><small>wins</small></div><div><b>${d.items.length}</b><small>skins</small></div><div><b>${Object.values(d.cases).reduce((a, b) => a + b, 0)}</b><small>cases</small></div><div><b>${Inv.totalKeys()}</b><small>keys</small></div><div><b>${d.level}</b><small>level</small></div>`;
    $('mainName').value = Settings.name;
    $('mainName').onchange = () => { Settings.name = $('mainName').value.trim().slice(0, 16) || Settings.name; saveSettings(); };
    $('equipCount').textContent = eq ? `${eq} skin${eq > 1 ? 's' : ''} equipped` : 'No skins equipped yet';
  },

  /* ── solo setup ── */
  render_play() {
    const c = this.playCfg, M = MODES[c.mode];
    if (!M.maps.includes(c.map)) c.map = M.maps[0];
    const seg = (key, opts) => `<div class="seg" data-k="${key}">${opts.map(([v, l, sub]) => `<button class="${String(c[key]) === String(v) ? 'on' : ''}" data-v="${v}">${l}${sub ? `<small>${sub}</small>` : ''}</button>`).join('')}</div>`;
    const sb = c.mode === 'sandbox', sizes = c.mode === 'defuse' ? [3, 5] : c.mode === 'conquest' ? [8, 12, 16] : [4, 6, 8];
    if (!sb && !sizes.includes(+c.teamSize)) c.teamSize = sizes[1];
    $('playForm').innerHTML = `
      <label>Mode</label>${seg('mode', [['defuse', 'Defuse', 'CS-style rounds, bomb, economy'], ['conquest', 'Conquest', 'Battlefield flags, tickets, jeeps'], ['tdm', 'Team Deathmatch', 'Respawns, classes'], ['sandbox', 'Sandbox', 'Spawn props & NPCs, physgun, toolgun']])}
      <label>Map</label>${seg('map', M.maps.map(m => [m, MAPS[m].name, MAPS[m].desc]))}
      ${sb ? '' : `<label>Players per team</label>${seg('teamSize', sizes.map(n => [n, n + 'v' + n]))}`}
      <label>${sb ? 'NPC skill' : 'Bot skill'}</label>${seg('diff', Object.entries(DIFF).map(([k, v]) => [k, v.label]))}
      <label>${sb ? 'Your faction (NPCs of it follow you)' : 'Your team'}</label>${seg('team', (sb ? [] : [['auto', 'Auto']]).concat([['CT', 'Aegis', c.mode === 'defuse' ? 'defend' : ''], ['T', 'Vanta', c.mode === 'defuse' ? 'attack' : '']]))}`;
    $('playForm').querySelectorAll('.seg').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => { const k = s.dataset.k; c[k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; Store.set('playcfg', c); Sfx.play('ui'); this.render_play(); }));
    $('playGo').onclick = () => this.startSolo();
  },
  startSolo() {
    const c = this.playCfg, team = c.team === 'auto' ? pick(['T', 'CT']) : c.team;
    Net.leave();
    if (c.mode === 'sandbox') { Sandbox.opts.npcSkill = c.diff; Sandbox.opts.faction = team; Sandbox.saveOpts(); }
    this.enterGame({ mode: c.mode, map: c.map, diff: c.diff, teamSize: c.mode === 'sandbox' ? 0 : c.teamSize, players: [{ id: 'me', name: Settings.name, team, ctrl: 'local', cls: 'assault' }], localId: 'me' });
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
    this.resultsOpen = false; $('results').classList.add('hidden'); $('results').innerHTML = '';
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
    /* every slot on the team: people first, then the bots that will fill in
       for the missing ones (same names the match will use) */
    const fill = L.mode !== 'sandbox' && L.bots !== false, names = L.botNames || BOT_NAMES;
    let bi = 0; const botsFor = {};
    for (const t of ['T', 'CT']) { const n = L.players.filter(p => p.team === t).length, k = fill ? Math.max(0, L.teamSize - n) : 0; botsFor[t] = []; for (let i = 0; i < k; i++) botsFor[t].push(names[bi++ % names.length]); }
    const col = team => {
      const hum = L.players.filter(p => p.team === team), over = fill && hum.length > L.teamSize;
      return `<div class="lteam" style="--tc:${TEAM_STYLE[team].color}"><h3>${TEAM_STYLE[team].name} <small>${hum.length} ${hum.length === 1 ? 'player' : 'players'}${botsFor[team].length ? ' + ' + botsFor[team].length + ' bot' + (botsFor[team].length > 1 ? 's' : '') : ''}</small></h3>
        ${hum.map(p => `<div class="lp ${p.id === me ? 'me' : ''}"><span class="dot"></span>${escapeHtml(p.name)}${p.id === 'host' ? ' <small>host</small>' : ''}${p.id === me ? ' <small>you</small>' : ''}</div>`).join('')}
        ${botsFor[team].map(n => `<div class="lp bot"><span class="dot"></span><i>BOT</i> ${escapeHtml(n)} <small>${DIFF[L.diff] ? DIFF[L.diff].label : ''}</small></div>`).join('')}
        ${over ? `<div class="lp warn">${hum.length - L.teamSize} over the team size, so no bots on this team</div>` : ''}
        ${!fill && L.mode !== 'sandbox' ? '<div class="lp bots">Bots off: people only</div>' : ''}
        <button class="btn small" data-team="${team}">Join ${TEAM_STYLE[team].name}</button></div>`;
    };
    $('lobbyTeams').innerHTML = col('CT') + col('T');
    $('lobbyTeams').querySelectorAll('[data-team]').forEach(b => b.onclick = () => Net.setTeam(b.dataset.team));
    const M = MODES[L.mode];
    if (host) {
      const sel = (k, opts) => `<select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(L[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      const sizes = L.mode === 'defuse' ? [3, 5] : L.mode === 'conquest' ? [8, 12, 16] : L.mode === 'sandbox' ? [0] : [4, 6, 8];
      const allSizes = L.mode === 'sandbox' ? [0] : Array.from({ length: L.mode === 'defuse' ? 8 : 16 }, (_, i) => i + 1);
      if (!allSizes.includes(+L.teamSize)) L.teamSize = allSizes[Math.min(allSizes.length - 1, 4)];
      $('lobbySettings').innerHTML = `<label>Mode ${sel('mode', Object.values(MODES).map(m => [m.id, m.name]))}</label><label>Map ${sel('map', M.maps.map(m => [m, MAPS[m].name]))}</label>${L.mode === 'sandbox' ? '' : `<label>Team size ${sel('teamSize', allSizes.map(n => [n, n + 'v' + n]))}</label><label>Fill with bots ${sel('bots', [['true', 'On'], ['false', 'Off']])}</label>`}<label>Bot skill ${sel('diff', Object.entries(DIFF).map(([k, v]) => [k, v.label]))}</label><button class="btn small ghost" id="lobbyBalance">Balance teams</button>`;
      $('lobbyBalance').onclick = () => Net.balance();
      $('lobbySettings').querySelectorAll('select').forEach(s => s.onchange = () => { const k = s.dataset.k; L[k] = s.value === 'true' ? true : s.value === 'false' ? false : isNaN(+s.value) ? s.value : +s.value; if (k === 'mode') { L.map = MODES[L.mode].maps[0]; L.teamSize = MODES[L.mode].teamSize; } if (k === 'diff') Sandbox.opts.npcSkill = L.diff; Net.pushLobby(); this.render_lobby(); });
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
    if (this.armoryTab !== 'gunsmith') GunPreview.stop();
    if (this.armoryTab === 'inv') this.renderInventory(body);
    else if (this.armoryTab === 'gunsmith') this.renderGunsmith(body);
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
    const keyChip = id => `<span class="keychip" style="--kc:${Inv.keyColor(id)}">${keySvg(Inv.keyColor(id), 18)}<b>${d.keys[id] || 0}</b> ${Inv.keyName(id)}</span>`;
    body.innerHTML = `<div class="bar keys">${['master'].concat(CASES.map(c => c.id)).map(keyChip).join('')}<span class="muted">Each case opens with its own key. Master keys open any case. Keys also drop from matches and level-ups.</span></div>
      <div class="cases">${CASES.map(c => {
        const odds = [1, 2, 3, 4, 5, 6].map(r => `<span style="color:${RARITY[r].color}">${RARITY[r].name} ${(CASE_ODDS[r] * 100).toFixed(r >= 5 ? 1 : 0)}%</span>`).join(' · ');
        return `<div class="case" style="--cc:${c.color}"><div class="case-art"><div class="crate"><span>${c.name.split(' ')[0].toUpperCase()}</span></div></div>
        <h3>${c.name}</h3><p class="muted">${c.desc}</p><div class="own">Owned: <b>${d.cases[c.id] || 0}</b></div>
        <div class="own">${keySvg(c.color, 16)} Keys: <b>${d.keys[c.id] || 0}</b>${d.keys.master ? ` <span class="muted">+ ${d.keys.master} master</span>` : ''}</div>
        <div class="row"><button class="btn small" data-buy="${c.id}">Buy case ₵${c.price}</button><button class="btn small" data-key="${c.id}">Buy key ₵${KEY_PRICE[c.id]}</button><button class="btn small ghost" data-bundle="${c.id}">${KEY_BUNDLE.n} keys ₵${Math.round(KEY_PRICE[c.id] * KEY_BUNDLE.n * KEY_BUNDLE.discount)}</button></div>
        <div class="row"><button class="btn" data-open="${c.id}" ${d.cases[c.id] && Inv.keysFor(c.id) ? '' : 'disabled'}>${!d.cases[c.id] ? 'No case' : !Inv.keysFor(c.id) ? 'Needs a key' : 'Open'}</button></div>
        <div class="odds">${odds}</div>
        <div class="contents">${SKIN_LIST.filter(s => s.caseId === c.id).sort((a, b) => b.rarity - a.rarity).map(s => `<div class="ci" style="--rc:${RARITY[s.rarity].color}" title="${escapeHtml(s.name)}"><canvas width="110" height="55" data-skin="${s.id}"></canvas><small>${s.weapon === 'knife' ? '★ ' + escapeHtml(s.name) : WEAPONS[s.weapon].name + ' | ' + escapeHtml(s.name)}</small></div>`).join('')}</div></div>`;
      }).join('')}</div>`;
    body.querySelectorAll('canvas[data-skin]').forEach(cv => { const s = SKINS[cv.dataset.skin]; drawSkinPreview(cv, { seed: 1, float: 0.03, skinId: s.id }, s.weapon === 'knife' ? Object.assign({}, s, { pattern: 'solid', pal: ['#e4ae39', '#b88a20'] }) : s); });
    const buyKeys = (id, n, price) => { if (d.credits < price) return this.toast('Not enough credits'); d.credits -= price; d.keys[id] = (d.keys[id] || 0) + n; Inv.save(); Sfx.play('buy'); this.toast(`+${n} ${Inv.keyName(id)}${n > 1 ? 's' : ''}`); this.render_armory(); };
    body.querySelectorAll('[data-key]').forEach(b => b.onclick = () => buyKeys(b.dataset.key, 1, KEY_PRICE[b.dataset.key]));
    body.querySelectorAll('[data-bundle]').forEach(b => b.onclick = () => buyKeys(b.dataset.bundle, KEY_BUNDLE.n, Math.round(KEY_PRICE[b.dataset.bundle] * KEY_BUNDLE.n * KEY_BUNDLE.discount)));
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const c = CASES.find(x => x.id === b.dataset.buy); if (d.credits < c.price) return this.toast('Not enough credits'); d.credits -= c.price; d.cases[c.id]++; Inv.save(); Sfx.play('buy'); this.render_armory(); });
    body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => this.openCase(b.dataset.open));
  },
  /* the reel: a long strip slides and eases to a stop on the prize */
  openCase(caseId) {
    const d = Inv.data; if (!d.cases[caseId] || !Inv.keysFor(caseId)) return;
    const used = Inv.useKey(caseId); d.cases[caseId]--; d.stats.opened++;
    if (used === 'master') this.toast('Used a Master Key');
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
    const el = $('reveal'); if (!el) return;   // the reel was closed mid-spin
    el.innerHTML = `<div class="prize" style="--rc:${r.color}"><canvas width="520" height="240" id="prizeCv"></canvas><div class="pn">${escapeHtml(Inv.displayName(it))}</div><div class="pr" style="color:${r.color}">${r.name} · ${wearOf(it.float).name} · float ${it.float.toFixed(4)}</div>
      <div class="row"><button class="btn" id="pvEquip">Equip</button><button class="btn warn" id="pvSell">Sell ₵${Inv.value(it)}</button><button class="btn" id="pvAgain" ${Inv.data.cases[caseId] && Inv.keysFor(caseId) ? '' : 'disabled'}>Open another</button><button class="btn ghost" id="pvClose">Close</button></div></div>`;
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
      ${rng('sens', 'Mouse sensitivity', 0.1, 4, 0.05)}${rng('fov', 'Field of view', 65, 110, 1)}${rng('vol', 'Volume', 0, 1, 0.05)}${rng('music', 'Music volume', 0, 1, 0.05)}${rng('viewDist', 'View distance', 0.5, 2.5, 0.1)}${rng('botSight', 'Bot sight distance', 0.5, 1.5, 0.05)}${rng('dmgCooldown', 'Damage cooldown (s, host)', 0, 0.5, 0.01)}${rng('uiScale', 'UI scale', 0.4, 1.2, 0.02)}
      <label>Default bot skill <select data-k="diff">${Object.entries(DIFF).map(([k, v]) => `<option value="${k}" ${S.diff === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label>Crosshair <select data-k="xhStyle">${[['cross', 'Cross'], ['tshape', 'T-shape'], ['dot', 'Dot'], ['circle', 'Circle'], ['crossring', 'Cross + circle'], ['chevron', 'Chevron']].map(([k, n]) => `<option value="${k}" ${S.xhStyle === k ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="xh-prev"><span id="xhPrev" class="xh-in"></span></span></label>
      <label>Crosshair color <input type="color" data-k="xhColor" value="${S.xhColor}"></label>${rng('xhSize', 'Crosshair length', 2, 16, 1)}${rng('xhGap', 'Crosshair gap', 0, 12, 1)}
      <label><input type="checkbox" data-k="xhDot" ${S.xhDot ? 'checked' : ''}> Center dot</label><label><input type="checkbox" data-k="showFps" ${S.showFps ? 'checked' : ''}> Show FPS</label>
      <label><input type="checkbox" data-k="blood" ${S.blood ? 'checked' : ''}> Blood</label><label><input type="checkbox" data-k="ragdoll" ${S.ragdoll !== false ? 'checked' : ''}> Ragdolls</label><label><input type="checkbox" data-k="gore" ${S.gore !== false ? 'checked' : ''}> Dismemberment</label>
      <label>Weather <select data-k="weather">${[['random', 'Random'], ['clear', 'Clear'], ['overcast', 'Overcast'], ['rain', 'Rain'], ['fog', 'Fog'], ['storm', 'Thunderstorm']].map(([k, n]) => `<option value="${k}" ${(S.weather || 'random') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label>Graphics <select data-k="gfx">${[['low', 'Low'], ['medium', 'Medium'], ['high', 'High']].map(([k, n]) => `<option value="${k}" ${(S.gfx || 'high') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label>Mouse cursor <select data-k="cursor"><option value="themed" ${S.cursor !== 'system' ? 'selected' : ''}>Breachpoint</option><option value="system" ${S.cursor === 'system' ? 'selected' : ''}>System</option></select></label>`;
    HUD.applyCrosshair($('xhPrev'));
    $('setForm').querySelectorAll('[data-k]').forEach(el => el.oninput = () => {
      const k = el.dataset.k; S[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
      if (el.nextElementSibling && el.nextElementSibling.tagName === 'OUTPUT') el.nextElementSibling.textContent = el.value;
      saveSettings(); HUD.applyCrosshair(); HUD.applyCrosshair($('xhPrev')); applyCursor(); Game.applyViewDist(); if (k === 'fov' && Game.camera) { Game.camera.fov = S.fov; Game.camera.updateProjectionMatrix(); }
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
    return World.spawns[s.team].some(sp => dist2(s.pos.x, s.pos.z, sp.x, sp.z) < 22);   // any of the team's spawn points
  },
  buyItems(team) {
    const w = id => ({ id, name: WEAPONS[id].name, price: WEAPONS[id].price });
    return [
      ['Pistols', [w(team === 'T' ? 'glock' : 'p2000'), w(team === 'T' ? 'tec9' : 'fiveseven'), w('deagle'), w('magnum')]],
      ['SMGs', [w(team === 'T' ? 'mac10' : 'mp9'), w('ump45'), w('p90')]],
      ['Heavy', [w('nova'), w('xm1014'), w('m249')]],
      ['Rifles', [w(team === 'T' ? 'galil' : 'famas'), w(team === 'T' ? 'ak47' : 'm4a4'), w(team === 'T' ? 'scar' : 'aug')]],
      ['Snipers', [w('ssg'), w('awp'), w('autosniper')]],
      ['Gear', [{ id: 'kevlar', name: 'Kevlar', price: 650 }, { id: 'helmet', name: 'Kevlar + Helmet', price: 1000 }, { id: 'medkit', name: 'Medkit (H)', price: 400 }].concat(team === 'CT' ? [{ id: 'kit', name: 'Defuse Kit', price: 400 }] : [])],
      ['Grenades', [{ id: 'frag', name: 'HE Grenade', price: 300 }, { id: 'flash', name: 'Flashbang', price: 200 }, { id: 'smoke', name: 'Smoke', price: 300 }]],
    ];
  },
  priceOf(id) { return id === 'medkit' ? 400 : WEAPONS[id] ? WEAPONS[id].price : GRENADES[id] ? GRENADES[id].price : EQUIP[id] ? (id === 'helmet' ? 1000 : EQUIP[id].price) : 0; },
  applyBuy(s, id) {
    if (!this.canBuy(s)) return false;
    let price = this.priceOf(id); if (id === 'helmet' && s.armor >= 100) price = 350;
    if (s.money < price) return false;
    if (WEAPONS[id]) { const w = WEAPONS[id]; if (w.side && w.side !== s.team) return false; if (s.weapons[w.slot] === id) return false; }
    else if (GRENADES[id]) { if (s.nades[id] >= GRENADES[id].max) return false; }
    else if (id === 'kevlar') { if (s.armor >= 100) return false; }
    else if (id === 'helmet') { if (s.helmet && s.armor >= 100) return false; }
    else if (id === 'kit') { if (s.kit || s.team !== 'CT') return false; }
    else if (id === 'medkit') { if (s.meds >= 2) return false; }
    s.money -= price;
    if (WEAPONS[id] || GRENADES[id]) s.give(id);
    else if (id === 'kevlar') s.armor = 100; else if (id === 'helmet') { s.armor = 100; s.helmet = true; } else if (id === 'kit') s.kit = true; else if (id === 'medkit') s.meds++;
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
  /* End of match: result, both scoreboards, your numbers, what you earned. */
  matchResults(r) {
    if (!Game.running) return;
    this.resultsOpen = true; this.toggleBuy(false); this.toggleSpawnMenu && this.spawnOpen && this.toggleSpawnMenu(false); HUD.showDeploy(false);
    if (document.pointerLockElement) document.exitPointerLock();
    const L = Game.local, e = $('results'), S = r.stats, W = TEAM_STYLE[r.winner], M = Game.mode;
    e.classList.remove('hidden'); e.style.setProperty('--wc', W.color);
    const score = M.id === 'defuse' ? `${Game.score.CT} – ${Game.score.T}` : M.id === 'conquest' ? `${Math.ceil(Game.tickets.CT)} – ${Math.ceil(Game.tickets.T)} tickets` : M.id === 'tdm' ? `${Game.tdm.kills.CT} – ${Game.tdm.kills.T} kills` : '';
    const table = team => {
      const rows = Game.soldiers.filter(s => s.team === team && !s.npc).sort((a, b) => b.score - a.score || b.kills - a.kills);
      const top = rows[0];
      return `<div class="rt ${team === r.winner ? 'won' : ''}" style="--tc:${TEAM_STYLE[team].color}"><div class="rth"><b>${TEAM_STYLE[team].name}</b>${team === r.winner ? '<span class="wtag">WINNER</span>' : ''}</div>
        <table><tr><th></th><th>K</th><th>A</th><th>D</th><th>Score</th></tr>${rows.map(s => `<tr class="${s === L ? 'me' : ''}"><td>${s === top && s.score > 0 ? '<span class="star" title="Top score">★</span>' : ''}${s.isBot ? '<i>BOT</i> ' : ''}${escapeHtml(s.name)}${s.mvps ? ` <span class="mv">${s.mvps}×MVP</span>` : ''}</td><td>${s.kills}</td><td>${s.assists}</td><td>${s.deaths}</td><td>${s.score}</td></tr>`).join('')}</table></div>`;
    };
    const tile = (v, l) => `<div class="rs"><b>${v}</b><small>${l}</small></div>`;
    const kd = S.d ? (S.k / S.d).toFixed(2) : S.k.toFixed(2), hsp = S.k ? Math.round(S.hs / S.k * 100) + '%' : '–', acc = S.shots ? Math.round(S.hits / S.shots * 100) + '%' : '–';
    let drops = '';
    if (r.drop) drops += r.drop.kind === 'case' ? `<div class="dropc" style="--dc:${CASES.find(c => c.id === r.drop.caseId).color}"><div class="crate mini"><span>${CASES.find(c => c.id === r.drop.caseId).name.split(' ')[0].toUpperCase()}</span></div><small>${CASES.find(c => c.id === r.drop.caseId).name}</small></div>` : this.itemCard(r.drop.item);
    if (r.keyDrop) drops += `<div class="dropc" style="--dc:${Inv.keyColor(r.keyDrop)}">${keySvg(Inv.keyColor(r.keyDrop), 64)}<small>${Inv.keyName(r.keyDrop)}</small></div>`;
    for (const u of r.ups) drops += `<div class="dropc lvl" style="--dc:#ffd24a"><div class="lvbadge">${u.level}</div><small>Level ${u.level}: +₵${u.credits}, ${Inv.keyName(u.key)}${u.master ? ', Master Key, ' + CASES.find(c => c.id === u.case).name : ''}</small></div>`;
    const D = Inv.data, pctFrom = r.before.xp / r.before.need * 100, pctTo = D.xp / Inv.xpFor(D.level) * 100;
    const host = Net.role === 'host', client = Net.role === 'client';
    e.innerHTML = `<div class="rbox2">
      <div class="rhead ${r.won ? 'win' : 'loss'}"><h1>${r.won ? 'VICTORY' : 'DEFEAT'}</h1><div class="rsub"><b style="color:${W.color}">${W.name} wins</b> · ${score} · ${M.name} · ${World.def.name} · ${fmtTime(r.dur)}</div></div>
      <div class="rgrid">
        <div class="rteams">${table(r.winner)}${table(other(r.winner))}</div>
        <div class="rme">
          <h3>Your match</h3>
          <div class="rstats">${tile(S.k, 'kills')}${tile(S.d, 'deaths')}${tile(S.a, 'assists')}${tile(kd, 'K/D')}${tile(hsp, 'headshot %')}${tile(acc, 'accuracy')}${tile(S.dmg, 'damage')}${tile(S.mvps, 'MVPs')}</div>
          <h3>Earned</h3>
          <div class="rlines">${r.lines.map(l => `<div><span>${l[0]}</span><b>+₵${l[1]}</b></div>`).join('')}<div class="tot"><span>Total</span><b>+₵${r.credits}</b></div></div>
          <div class="xpbar"><div class="xpl">Level <b>${D.level}</b> <span>+${r.xp} XP</span></div><div class="xpt"><i style="width:${r.ups.length ? 0 : pctFrom}%" data-to="${pctTo}"></i></div><small>${D.xp} / ${Inv.xpFor(D.level)} XP</small></div>
          ${drops ? `<h3>Drops</h3><div class="rdrops">${drops}</div>` : ''}
        </div>
      </div>
      <div class="row rbtns">${host ? '<button class="btn big" id="resRematch">Play again</button><button class="btn" id="resLobby">Back to lobby</button>' : client ? '<span class="muted">Waiting for the host to start again…</span>' : '<button class="btn big" id="resAgain">Play again</button>'}<button class="btn ghost" id="resArm">Armory</button><button class="btn ghost" id="resMenu">${Net.role === 'off' ? 'Main menu' : 'Leave'}</button></div></div>`;
    this.paintCards(e);
    Sfx.play(r.won ? 'win' : 'lose'); if (r.ups.length) setTimeout(() => Sfx.play('rare'), 900);
    requestAnimationFrame(() => setTimeout(() => { const bar = e.querySelector('.xpt i'); if (bar) bar.style.width = bar.dataset.to + '%'; }, 300));
    $('resMenu').onclick = () => this.leaveGame();
    $('resArm').onclick = () => { this.leaveGame(); this.armoryTab = 'inv'; this.show('armory'); };
    if ($('resAgain')) $('resAgain').onclick = () => { this.leaveGame(); this.startSolo(); };
    if ($('resRematch')) $('resRematch').onclick = () => { Game.stop(); this.resultsOpen = false; Net.startMatch(); };
    if ($('resLobby')) $('resLobby').onclick = () => { Game.stop(); this.resultsOpen = false; e.classList.add('hidden'); $('hud').classList.add('hidden'); Net.lobby.started = false; Net.toAll({ t: 'tolobby' }); MenuBG.start(); this.openLobby(); Net.pushLobby(); };
  },
};

/* ── gunsmith ─────────────────────────────────────────────────────────── */
UI.gsWeapon = 'ak47';
UI.renderGunsmith = function (body) {
  const d = Inv.data, wid = this.gsWeapon, base = WEAPONS[wid], att = d.attach[wid] || (d.attach[wid] = {}), mod = modWeapon(base, att);
  const guns = Object.values(WEAPONS).filter(w => w.mag && w.type !== 'launcher');
  const bar = (label, a, b, max, better) => { const pa = clamp(a / max, 0, 1) * 100, pb = clamp(b / max, 0, 1) * 100, good = better === 'high' ? b > a + 1e-6 : b < a - 1e-6, bad = better === 'high' ? b < a - 1e-6 : b > a + 1e-6; return `<div class="gsb"><span>${label}</span><div class="gbar"><i style="width:${Math.min(pa, pb)}%"></i><em class="${good ? 'good' : bad ? 'bad' : ''}" style="left:${Math.min(pa, pb)}%;width:${Math.abs(pb - pa)}%"></em></div><b>${typeof b === 'number' ? (Number.isInteger(b) ? b : b.toFixed(2)) : b}</b></div>`; };
  body.innerHTML = `<div class="gs"><div class="gslist">${guns.map(w => `<button class="${w.id === wid ? 'on' : ''}" data-w="${w.id}">${w.name}<small>${ATT_SLOTS.filter(k => (d.attach[w.id] || {})[k]).length || ''}</small></button>`).join('')}</div>
    <div class="gscenter"><canvas id="gsCanvas" width="620" height="330"></canvas><h2>${base.name}</h2>
      <div class="gstats">${bar('Damage', base.dmg, mod.dmg, 120, 'high')}${bar('Vertical recoil', base.recoil, base.recoil * (mod.upK || 1), 5, 'low')}${bar('Horizontal recoil', base.recoil, base.recoil * (mod.sideK || 1), 5, 'low')}${bar('Hip spread', base.spread * 1000, base.spread * (mod.hipK || 1) * 1000, 20, 'low')}${bar('Move spread', base.moveSpread * 100, mod.moveSpread * 100, 16, 'low')}${bar('Magazine', base.mag, mod.mag, 150, 'high')}${bar('Reload (s)', base.reload, mod.reload, 7, 'low')}${bar('ADS zoom', 90 - base.zoom, 90 - mod.zoom, 70, 'high')}</div></div>
    <div class="gsslots">${ATT_SLOTS.map(k => { const opts = Object.keys(ATTACH).filter(a => ATTACH[a].slot === k && attachAllowed(wid, a)); if (!opts.length) return ''; return `<div class="gsslot"><h4>${ATT_SLOT_NAMES[k]}</h4><button class="att ${!att[k] ? 'on' : ''}" data-k="${k}" data-a="">None</button>${opts.map(a => { const A = ATTACH[a], own = d.unlocked.includes(a); return `<button class="att ${att[k] === a ? 'on' : ''} ${own ? '' : 'locked'}" data-k="${k}" data-a="${a}" title="${escapeHtml(A.desc)}"><span>${A.name}</span>${own ? '' : `<b>🔒 ₵${A.price}</b>`}<small>${A.desc}</small></button>`; }).join('')}</div>`; }).join('')}</div></div>`;
  body.querySelectorAll('.gslist button').forEach(b => b.onclick = () => { this.gsWeapon = b.dataset.w; Sfx.play('ui'); this.renderGunsmith(body); });
  body.querySelectorAll('.att').forEach(b => b.onclick = () => {
    const k = b.dataset.k, a = b.dataset.a;
    if (a && !d.unlocked.includes(a)) { const A = ATTACH[a]; if (d.credits < A.price) return this.toast('Not enough credits'); if (!confirm(`Unlock ${A.name} for ₵${A.price}? It works on every gun that fits it.`)) return; d.credits -= A.price; d.unlocked.push(a); Sfx.play('buy'); $('credits').textContent = d.credits.toLocaleString(); }
    if (a) att[k] = a; else delete att[k];
    Inv.save(); Sfx.play('ui'); this.renderGunsmith(body);
  });
  GunPreview.show($('gsCanvas'), wid, Inv.equippedItem(wid), att);
};
const GunPreview = {
  r: null, raf: 0,
  show(canvas, wid, item, att) {
    this.stop();
    if (!this.r) { this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); this.r.outputColorSpace = THREE.SRGBColorSpace; this.scene = new THREE.Scene(); this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555544, 1.8)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(1, 2, 2); this.scene.add(d); this.cam = new THREE.PerspectiveCamera(28, 620 / 330, 0.01, 20); }
    this.r.setSize(620, 330, false); canvas.replaceWith(this.r.domElement); this.r.domElement.id = 'gsCanvas';
    if (this.gun) this.scene.remove(this.gun);
    this.gun = buildGun(wid, item, att); const box = new THREE.Box3().setFromObject(this.gun), c = box.getCenter(new V3()); this.gun.position.sub(c);
    const piv = new THREE.Group(); piv.add(this.gun); this.scene.add(piv); this.gun = piv;
    const size = box.getSize(new V3()).length(); this.cam.position.set(0, size * 0.18, size * 1.08); this.cam.lookAt(0, 0, 0);
    let t = 0; const loop = () => { this.raf = requestAnimationFrame(loop); t += 0.01; piv.rotation.y = Math.PI / 2 + Math.sin(t) * 0.6; piv.rotation.x = Math.sin(t * 0.7) * 0.1; this.r.render(this.scene, this.cam); };
    loop();
  },
  stop() { cancelAnimationFrame(this.raf); },
};

/* ── spawn menu (sandbox) ──────────────────────────────────────────────── */
UI.spawnTab = 'Props';
UI.toggleSpawnMenu = function (on) {
  if (on === undefined) on = !this.spawnOpen;
  this.spawnOpen = on; $('spawnmenu').classList.toggle('hidden', !on);
  if (on) { this.pause(false); Input.clear(); if (document.pointerLockElement) document.exitPointerLock(); this.renderSpawnMenu(); } else this.lock();
};
UI.renderSpawnMenu = function () {
  const tabs = ['Props', 'Entities', 'Wiring', 'Lights', 'NPCs', 'Weapons', 'Vehicles', 'Tools', 'Saves', 'Options'], T = this.spawnTab, O = Sandbox.opts;
  const tile = (kind, key, name, img, sub) => `<button class="sp-tile" data-kind="${kind}" data-key="${key}"><img src="${img}" alt=""><span>${escapeHtml(name)}</span>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</button>`;
  let html = '';
  if (T === 'Wiring') html = UI.wiringHtml(p => tile('prop', p.id, p.name, Thumbs.get('p:' + p.id, () => buildPropMesh(p)), p.desc));
  else if (['Props', 'Entities', 'Wiring', 'Lights'].includes(T)) html = `${T === 'Wiring' ? '<p class="muted sp-note">Place parts where you aim (on a prop they get welded to it). Connect them with the <b>Wire</b> tool: click an output, then what it powers. <b>E</b> presses buttons, flips switches, opens doors and switches lights.</p>' : ''}<div class="sp-grid">${Object.values(PROPS).filter(p => p.cat === T).map(p => tile('prop', p.id, p.name, Thumbs.get('p:' + p.id, () => buildPropMesh(p)), p.desc)).join('')}</div>`;
  else if (T === 'Saves') html = UI.savesHtml();
  else if (T === 'NPCs') html = `<div class="sp-row"><label>Weapon <select id="npcW"><option value="default">Default</option>${Object.values(WEAPONS).filter(w => w.mag && w.type !== 'launcher').map(w => `<option value="${w.id}" ${O.npcWeapon === w.id ? 'selected' : ''}>${w.name}</option>`).join('')}<option value="knife" ${O.npcWeapon === 'knife' ? 'selected' : ''}>Knife</option></select></label><label>Skill <select id="npcS">${Object.entries(DIFF).map(([k, v]) => `<option value="${k}" ${O.npcSkill === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label></div>
    <div class="sp-grid">${Object.entries(NPCS).map(([k, n]) => tile('npc', k, n.name, Thumbs.get('n:' + k, () => { const m = buildSoldierModel(n.team); if (!n.weapon) m.userData.gunMount.visible = false; else setSoldierGun(m, n.weapon, null, null); if (k === 'zombie') m.userData.arms.rotation.x = -0.3; m.rotation.y = Math.PI * 0.85; return m; }), n.desc)).join('')}</div>`;
  else if (T === 'Weapons') html = `<div class="sp-grid">${Object.values(WEAPONS).filter(w => w.id !== 'physgun' && w.id !== 'toolgun' && !w.hidden).map(w => tile('weapon', w.id, w.name, Thumbs.get('w:' + w.id + attSig(Inv.data.attach[w.id]), () => { const g = buildGun(w.id, Inv.equippedItem(w.id), Inv.data.attach[w.id]); g.rotation.y = Math.PI / 2; return g; }))).join('')}${['frag', 'flash', 'smoke'].map(n => tile('weapon', n, GRENADES[n].name, Thumbs.get('g:' + n, () => new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 12), lam(n === 'frag' ? '#3a4a2a' : n === 'flash' ? '#b8b8b8' : '#5a6a7a'))))).join('')}</div>`;
  else if (T === 'Vehicles') html = `<div class="sp-grid">${Object.entries(VKIND).map(([k, K]) => tile('veh', k, K.name, Thumbs.get('v:' + k, () => { const j = K.build('CT'); j.rotation.y = 0.6; return j; }), K.desc || '')).join('')}</div>`;
  else if (T === 'Tools') {
    const tool = TOOLS[O.tool], opt = tool.opts || [];
    html = `<div class="sp-tools"><div class="sp-toollist">${Object.entries(TOOLS).map(([k, t]) => `<button class="${O.tool === k ? 'on' : ''}" data-tool="${k}">${t.name}</button>`).join('')}</div><div class="sp-toolopts"><h3>${tool.name}</h3><p><b>LMB</b> ${tool.lmb}<br><b>RMB</b> ${tool.rmb}<br><b>R</b> clear selection</p>
      ${opt.includes('color') ? `<label>Color</label><div class="swatches">${['#ff4a4a', '#ff9a2a', '#ffe04a', '#5ad04a', '#2ac0ff', '#3a6aff', '#a04aff', '#ff4ad0', '#ffffff', '#888888', '#222222', '#8a5a2a'].map(c => `<i data-c="${c}" style="background:${c}" class="${O.color === c ? 'on' : ''}"></i>`).join('')}<input type="color" id="toolColor" value="${O.color}"></div>` : ''}
      ${opt.includes('material') ? `<label>Material</label><div class="mats">${Object.entries(PMAT).filter(([k]) => k !== 'default').map(([k, m]) => `<button data-m="${k}" class="${O.material === k ? 'on' : ''}">${m.name}</button>`).join('')}</div>` : ''}
      ${opt.includes('slack') ? `<label>Rope slack <input type="range" id="optSlack" min="1" max="2" step="0.05" value="${O.slack}"></label>` : ''}
      ${opt.includes('lift') ? `<label>Balloon lift (kg it can carry) <input type="range" id="optLift" min="2" max="150" step="1" value="${O.lift}"></label>` : ''}
      ${opt.includes('force') ? `<label>Thruster force <input type="range" id="optForce" min="200" max="6000" step="100" value="${O.force}"></label><p class="muted">Hold T to fire every thruster you placed.</p>` : ''}
      ${O.tool === 'dynamite' ? '<p class="muted">Press K to set off every charge you placed.</p>' : ''}
      ${opt.includes('wspeed') ? `<label>Wheel speed <input type="range" id="optWspeed" min="2" max="40" step="1" value="${O.wspeed}"></label><p class="muted">Hold U to drive every wheel you placed, J to reverse. Put wheels on a welded frame to build a car.</p>` : ''}
      ${opt.includes('effect') ? `<label>Effect</label><div class="mats">${Object.entries(EFFECTS).map(([k, n]) => `<button data-fx="${k}" class="${O.effect === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}
      ${opt.includes('physprop') ? `<label>Physics</label><div class="mats">${Object.entries(PHYSPROPS).filter(([k]) => k !== 'normal').map(([k, n]) => `<button data-pp="${k}" class="${O.physprop === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}
      ${O.tool === 'duplicator' ? `<p class="muted">${Sandbox.clip ? 'Clipboard: ' + Sandbox.clip.items.length + ' prop(s)' : 'Clipboard empty'}</p>` : ''}
      ${O.tool === 'lamp' ? '<p class="muted">Press L to switch all your lamps on or off.</p>' : ''}${O.tool === 'emitter' ? '<p class="muted">Press O to switch your emitters on or off.</p>' : ''}${UI.toolExtra(O)}
      <button class="btn" id="useTool">Use tool gun</button></div></div>`;
  } else html = `<div class="sp-opts"><label>Faction <select id="optFac"><option value="CT" ${O.faction === 'CT' ? 'selected' : ''}>Aegis</option><option value="T" ${O.faction === 'T' ? 'selected' : ''}>Vanta</option></select> <small class="muted">takes effect when you respawn</small></label>
    <label><input type="checkbox" id="optIgnore" ${O.ignorePlayers ? 'checked' : ''}> NPCs ignore players</label>
    <div class="row"><button class="btn" id="optFreeze">Freeze all props</button><button class="btn warn" id="optClearNpc">Remove all NPCs</button><button class="btn warn" id="optClear">Clear everything</button></div>
    <p class="muted">Keys: <b>Q</b> this menu · <b>6</b> physics gun · <b>7</b> tool gun · <b>Z</b> undo · <b>V</b> noclip · <b>T</b> thrusters · <b>K</b> dynamite · <b>E</b> hold with physgun to rotate</p></div>`;
  $('spawnmenu').innerHTML = `<div class="sp-box"><div class="sp-tabs">${tabs.map(t => `<button class="${t === T ? 'on' : ''}" data-tab="${t}">${t}</button>`).join('')}<div class="sp-close">Q / Esc to close</div></div><div class="sp-body">${html}</div></div>`;
  const M = $('spawnmenu'), L = Game.local;
  M.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { this.spawnTab = b.dataset.tab; Sfx.play('ui'); this.renderSpawnMenu(); });
  M.querySelectorAll('.sp-tile').forEach(b => b.onclick = () => { Sandbox.spawn(b.dataset.kind, b.dataset.key); this.toggleSpawnMenu(false); });
  M.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { O.tool = b.dataset.tool; Sandbox.pick = null; Sandbox.saveOpts(); this.renderSpawnMenu(); });
  M.querySelectorAll('.swatches i').forEach(b => b.onclick = () => { O.color = b.dataset.c; Sandbox.saveOpts(); this.renderSpawnMenu(); });
  M.querySelectorAll('.mats button').forEach(b => b.onclick = () => { O.material = b.dataset.m; Sandbox.saveOpts(); this.renderSpawnMenu(); });
  const bind = (id, k, num) => { const e = $(id); if (e) e.oninput = () => { O[k] = num ? +e.value : e.value; Sandbox.saveOpts(); }; };
  bind('toolColor', 'color'); bind('optSlack', 'slack', 1); bind('optLift', 'lift', 1); bind('optForce', 'force', 1); bind('optWspeed', 'wspeed', 1); bind('npcW', 'npcWeapon');
  M.querySelectorAll('[data-fx]').forEach(b => b.onclick = () => { O.effect = b.dataset.fx; Sandbox.saveOpts(); this.renderSpawnMenu(); });
  M.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { O.physprop = b.dataset.pp; Sandbox.saveOpts(); this.renderSpawnMenu(); }); bind('npcS', 'npcSkill');
  if ($('npcW')) $('npcW').onchange = $('npcW').oninput; if ($('npcS')) $('npcS').onchange = $('npcS').oninput;
  if (T === 'Tools') UI.bindToolExtra(M, O);
  if (T === 'Saves') UI.bindSaves(M);
  if ($('useTool')) $('useTool').onclick = () => { if (L) L.switchTo('toolgun'); this.toggleSpawnMenu(false); };
  if ($('optFac')) $('optFac').onchange = e => { O.faction = e.target.value; Sandbox.saveOpts(); if (L && Net.role === 'off') { L.team = O.faction; L.buildModel(Game.scene); Game.view && (Game.view.key = null); } };
  if ($('optIgnore')) $('optIgnore').onchange = e => { O.ignorePlayers = e.target.checked; Sandbox.saveOpts(); };
  if ($('optFreeze')) $('optFreeze').onclick = () => { Sandbox.exec({ op: 'freezeall' }); this.toggleSpawnMenu(false); };
  if ($('optClearNpc')) $('optClearNpc').onclick = () => { Sandbox.exec({ op: 'clearnpc' }); this.toggleSpawnMenu(false); };
  if ($('optClear')) $('optClear').onclick = () => { if (confirm('Remove every prop and NPC?')) { Sandbox.exec({ op: 'clear' }); this.toggleSpawnMenu(false); } };
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
