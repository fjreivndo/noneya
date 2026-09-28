/* ═══════════════════════════════════════════════════════════════════════════
   HUD: everything drawn over the 3D view while playing.
   ═══════════════════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const HUD = {
  el: {}, feed: [], radioLines: [], centerT: 0, hitT: 0, hurtList: [], fps: 0, fpsAcc: 0, fpsN: 0, radarImg: null, radarScale: 1, bannerT: 0,
  init() {
    ['hud', 'xh', 'hp', 'hpbar', 'armor', 'ammo', 'ammores', 'wname', 'money', 'timer', 'scT', 'scCT', 'rinfo', 'killfeed', 'radar', 'radio', 'center', 'banner', 'hitm', 'dmgind', 'flash', 'scope', 'prog', 'progbar', 'progtxt', 'board', 'deploy', 'chatlog', 'chatin', 'spec', 'flagbar', 'hint', 'fps', 'vign', 'nades', 'stattrak', 'tickets', 'killcard', 'blood'].forEach(k => this.el[k] = $(k));
    this.dctx = this.el.dmgind.getContext('2d');
    this.rctx = this.el.radar.getContext('2d');
    this.el.chatin.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { const t = this.el.chatin.value.trim(); if (t) Net.chat(t); this.closeChat(); }
      if (e.key === 'Escape') this.closeChat();
    });
  },
  applyCrosshair() {
    const x = this.el.xh, c = Settings.xhColor, s = Settings.xhSize, g = Settings.xhGap;
    x.innerHTML = `<i style="left:${-g - s}px;top:-1px;width:${s}px;height:2px"></i><i style="left:${g}px;top:-1px;width:${s}px;height:2px"></i><i style="top:${-g - s}px;left:-1px;height:${s}px;width:2px"></i><i style="top:${g}px;left:-1px;height:${s}px;width:2px"></i>` + (Settings.xhDot ? '<i style="left:-1px;top:-1px;width:2px;height:2px"></i>' : '');
    x.querySelectorAll('i').forEach(i => i.style.background = c);
  },
  onMatchStart() {
    this.el.hud.classList.remove('hidden'); this.feed = []; this.el.killfeed.innerHTML = ''; this.el.radio.innerHTML = ''; this.el.chatlog.innerHTML = '';
    this.buildRadar(); this.applyCrosshair();
    this.el.flagbar.classList.toggle('hidden', Game.mode.id !== 'conquest');
    this.el.tickets.classList.toggle('hidden', Game.mode.id !== 'conquest');
    this.el.money.classList.toggle('hidden', !Game.mode.buy);
    if (Game.mode.id === 'conquest') this.el.flagbar.innerHTML = World.flags.map(f => `<div class="flag" id="flag_${f.name}"><b>${f.name}</b><span></span></div>`).join('');
    this.showDeploy(false);
  },
  onRoundStart() { this.el.banner.classList.add('hidden'); this.el.killcard.classList.add('hidden'); if (Game.local) HUD.center(Game.local.team === 'T' ? 'Plant the bomb or eliminate Aegis' : 'Defend the sites', 2.5); },
  onSpawn() { this.el.killcard.classList.add('hidden'); },
  buildRadar() {
    const B = World.bounds, W = B.x1 - B.x0, S = 600 / Math.max(W, B.z1 - B.z0); this.radarScale = S;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(W * S); cv.height = Math.ceil((B.z1 - B.z0) * S); const c = cv.getContext('2d');
    c.fillStyle = '#3b3a34'; c.fillRect(0, 0, cv.width, cv.height);
    // walkable area from the nav grid
    const N = World.nav; c.fillStyle = '#8a8270';
    for (let z = 0; z < N.h; z++) for (let x = 0; x < N.w; x++) if (N.walk[z * N.w + x]) c.fillRect((N.x0 + x * N.cs - B.x0) * S, (N.z0 + z * N.cs - B.z0) * S, N.cs * S + 0.6, N.cs * S + 0.6);
    c.fillStyle = 'rgba(40,40,36,.9)';
    for (const b of World.boxes) if (b.y1 > 0.9 && b.y1 - b.y0 > 0.5) c.fillRect((b.x0 - B.x0) * S, (b.z0 - B.z0) * S, (b.x1 - b.x0) * S, (b.z1 - b.z0) * S);
    c.font = `bold ${Math.round(28)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const k in World.sites) { const s = World.sites[k]; c.fillStyle = 'rgba(255,80,50,.25)'; c.fillRect((s.x0 - B.x0) * S, (s.z0 - B.z0) * S, (s.x1 - s.x0) * S, (s.z1 - s.z0) * S); c.fillStyle = '#ff6a4a'; c.fillText(k, (s.cx - B.x0) * S, (s.cz - B.z0) * S); }
    this.radarImg = cv;
  },
  wx(x) { return (x - World.bounds.x0) * this.radarScale; }, wz(z) { return (z - World.bounds.z0) * this.radarScale; },
  drawRadar() {
    const c = this.rctx, R = this.el.radar.width, L = Game.local; if (!L || !this.radarImg) return;
    const zoom = Game.mode.id === 'conquest' ? 0.55 : 1.1, S = this.radarScale;
    const cam = L.alive ? L.pos : Game.camera.position, yaw = L.alive ? L.yaw : 0;
    c.save(); c.clearRect(0, 0, R, R);
    c.beginPath(); c.arc(R / 2, R / 2, R / 2 - 2, 0, TAU); c.clip();
    c.fillStyle = '#23231f'; c.fillRect(0, 0, R, R);
    c.translate(R / 2, R / 2); c.rotate(yaw); c.scale(zoom, zoom); c.translate(-this.wx(cam.x), -this.wz(cam.z));
    c.drawImage(this.radarImg, 0, 0);
    const dot = (x, z, col, r = 5, dir) => { c.fillStyle = col; c.beginPath(); c.arc(this.wx(x), this.wz(z), r / zoom, 0, TAU); c.fill(); if (dir != null) { c.strokeStyle = col; c.lineWidth = 2 / zoom; c.beginPath(); c.moveTo(this.wx(x), this.wz(z)); c.lineTo(this.wx(x) - Math.sin(dir) * 11 / zoom, this.wz(z) - Math.cos(dir) * 11 / zoom); c.stroke(); } };
    for (const f of World.flags) { c.fillStyle = f.owner ? TEAM_STYLE[f.owner].color : '#ddd'; c.globalAlpha = 0.35; c.beginPath(); c.arc(this.wx(f.x), this.wz(f.z), f.radius * S, 0, TAU); c.fill(); c.globalAlpha = 1; c.save(); c.translate(this.wx(f.x), this.wz(f.z)); c.rotate(-yaw); c.font = `bold ${16 / zoom}px sans-serif`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(f.name, 0, 0); c.restore(); }
    for (const v of Game.vehicles) if (v.alive) { c.fillStyle = TEAM_STYLE[v.team].color; c.fillRect(this.wx(v.pos.x) - 5 / zoom, this.wz(v.pos.z) - 8 / zoom, 10 / zoom, 16 / zoom); }
    const B = Game.bomb;
    if (B && B.pos && (B.state === 'planted' || (B.state === 'dropped' && L.team === 'T'))) dot(B.pos.x, B.pos.z, (Game.now * 3 % 1) < 0.5 ? '#ff3030' : '#ffaa00', 6);
    for (const s of Game.soldiers) {
      if (!s.alive || s === L) continue;
      if (s.team === L.team) dot(s.pos.x, s.pos.z, TEAM_STYLE[s.team].color, 4.5, s.yaw);
      else if ((s['spot' + L.team] || 0) > Game.now || this.teamSees(s)) dot(s.pos.x, s.pos.z, '#ff3b3b', 5);
    }
    if (B && B.state === 'carried' && L.team === 'T') { const c2 = Game.byId(B.carrier); if (c2 && c2.alive && c2 !== L) dot(c2.pos.x, c2.pos.z, '#ffaa00', 3); }
    c.restore();
    // you: arrow in the middle
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(R / 2, R / 2 - 8); c.lineTo(R / 2 - 5, R / 2 + 6); c.lineTo(R / 2 + 5, R / 2 + 6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(R / 2, R / 2, R / 2 - 2, 0, TAU); c.stroke();
  },
  teamSees(e) { // enemies your team currently sees (host has the intel; clients get spotting flags)
    if (!Game.authority()) return false;
    const i = Game.cmd[Game.local.team].intel.get(e.id); return i && Game.now - i.t < 0.6;
  },
  update(dt) {
    const L = Game.local; if (!L) return;
    const E = this.el, w = L.w;
    // fps
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; E.fps.textContent = Settings.showFps ? this.fps + ' fps' : ''; }
    E.hp.textContent = Math.max(0, Math.ceil(L.hp)); E.hpbar.style.width = clamp(L.hp, 0, 100) + '%'; E.hpbar.style.background = L.hp > 50 ? '#e8e8e8' : L.hp > 25 ? '#ffb030' : '#ff4040';
    E.armor.textContent = Game.mode.armor ? `🛡 ${Math.ceil(L.armor)}${L.helmet ? ' +H' : ''}${L.kit ? ' · kit' : ''}` : (Game.mode.classes ? CLASSES[L.cls].name + (L.medkits ? ` · ✚${L.medkits}` : '') + (L.ammoBoxes ? ` · ▣${L.ammoBoxes}` : '') : '');
    if (w && (w.type === 'physgun' || w.type === 'tool')) {
      E.ammo.textContent = ''; E.ammores.textContent = ''; E.stattrak.textContent = '';
      const T = TOOLS[Sandbox.opts.tool];
      E.wname.innerHTML = w.type === 'physgun' ? 'Physics Gun · <small>LMB grab · wheel distance · E+mouse rotate · RMB freeze · R unfreeze</small>'
        : `Tool Gun: <b>${T.name}</b>${Sandbox.pick ? ' (1 picked)' : ''} · <small>LMB ${T.lmb} · RMB ${T.rmb} · Q to change</small>`;
    } else if (isNade(L.cur)) { E.ammo.textContent = L.nades[L.cur]; E.ammores.textContent = ''; E.wname.textContent = GRENADES[L.cur].name + '  ·  LMB throw  RMB lob'; }
    else if (w) {
      const a = L.ammo[L.cur]; E.ammo.textContent = a ? a.mag : '∞'; E.ammores.textContent = a ? '/ ' + a.res : '';
      const it = L.skinItem(L.cur); E.wname.textContent = w.name + (it ? ' | ' + SKINS[it.skinId].name.replace(/^.*\| /, '') : '') + (L.reloadT > 0 ? '  · reloading' : '');
      E.stattrak.textContent = it && it.st ? 'StatTrak™ ' + String(it.kills).padStart(5, '0') : '';
    }
    E.nades.textContent = ['frag', 'flash', 'smoke'].map(n => L.nades[n] ? { frag: 'HE', flash: 'FL', smoke: 'SM' }[n] + (L.nades[n] > 1 ? '×' + L.nades[n] : '') : '').filter(Boolean).concat(L.meds ? ['✚' + (L.meds > 1 ? '×' + L.meds : '') + ' (H)'] : []).join(' ');
    E.money.textContent = '$' + L.money;
    // top bar
    const M = Game.mode;
    if (M.id === 'defuse') {
      const R = Game.round || {};
      E.scT.textContent = Game.score.T; E.scCT.textContent = Game.score.CT;
      const B = Game.bomb;
      E.timer.textContent = R.phase === 'freeze' ? fmtTime(R.t) : B.state === 'planted' ? '💣 ' + Math.max(0, B.timer).toFixed(1) : fmtTime(R.timeLeft);
      E.timer.classList.toggle('bomb', B.state === 'planted'); E.timer.classList.toggle('freeze', R.phase === 'freeze');
      E.rinfo.textContent = `Round ${Game.roundNum || 1} · first to ${M.winRounds}` + (R.phase === 'freeze' ? ' · BUY (B)' : '');
    } else if (M.id === 'conquest') {
      E.scT.textContent = Math.ceil(Game.tickets.T); E.scCT.textContent = Math.ceil(Game.tickets.CT); E.timer.textContent = 'CONQUEST'; E.rinfo.textContent = 'Tickets';
      E.timer.classList.remove('bomb', 'freeze');
      for (const f of World.flags) {
        const el = $('flag_' + f.name); if (!el) continue;
        el.style.borderColor = f.owner ? TEAM_STYLE[f.owner].color : '#999';
        el.style.background = f.contested ? 'rgba(255,60,60,.35)' : 'rgba(0,0,0,.45)';
        el.querySelector('span').style.width = Math.abs(f.prog) * 100 + '%'; el.querySelector('span').style.background = f.prog > 0 ? TEAM_STYLE.CT.color : TEAM_STYLE.T.color;
        el.classList.toggle('here', L.alive && dist2(L.pos.x, L.pos.z, f.x, f.z) < f.radius);
      }
    } else if (M.id === 'sandbox') {
      E.scT.textContent = ''; E.scCT.textContent = ''; E.timer.textContent = 'SANDBOX'; E.timer.classList.remove('bomb', 'freeze');
      E.rinfo.textContent = `${Phys.props.length} props · ${Game.soldiers.filter(s => s.npc && s.alive).length} NPCs · Q spawn menu · Z undo · V noclip`;
    } else {
      E.scT.textContent = Game.tdm.kills.T; E.scCT.textContent = Game.tdm.kills.CT; E.timer.textContent = fmtTime(Game.tdm.timeLeft); E.rinfo.textContent = `First to ${M.killTarget} kills`;
      E.timer.classList.remove('bomb', 'freeze');
    }
    // center, hit marker, hurt, flash, scope
    this.centerT -= dt; if (this.centerT <= 0) E.center.classList.add('hidden');
    this.hitT -= dt; E.hitm.style.opacity = clamp(this.hitT / 0.2, 0, 1);
    E.flash.style.opacity = L.blind > 0 ? clamp(L.blind / Math.min(1.5, L.blindMax || 1), 0, 1) : 0;
    // scope overlay fades in over the last part of the aim-in
    const scopeK = L.alive && w && w.scope && !L.vehicle ? clamp((L.adsT - 0.7) / 0.2, 0, 1) : 0, scoped = scopeK > 0.5;
    E.scope.classList.toggle('hidden', scopeK <= 0); if (scopeK > 0) { this.setScope(w.overlay || 'sniper'); E.scope.style.opacity = scopeK; }
    E.xh.classList.toggle('hidden', !L.alive || scoped || L.adsT > 0.5 || (w && w.type === 'sniper') || (L.vehicle && L.vehicle.driver === L && L.vehicle.kind !== 'tank'));
    if (L.alive && w && !scoped) { const g = Settings.xhGap + L.spread() * 900; E.xh.querySelectorAll('i').forEach((i, k) => { const s = Settings.xhSize; if (k === 0) i.style.left = (-g - s) + 'px'; if (k === 1) i.style.left = g + 'px'; if (k === 2) i.style.top = (-g - s) + 'px'; if (k === 3) i.style.top = g + 'px'; }); }
    E.vign.style.opacity = L.alive ? clamp((50 - L.hp) / 50, 0, 0.8) : 0;
    this.drawDamage(dt);
    // progress bars
    let prog = null;
    if (L.planting && L.planting.t != null) prog = ['Planting…', 1 - L.planting.t / Game.mode.plantTime];
    const B = Game.bomb;
    if (B.defuser === L.id) prog = ['Defusing…', 1 - B.progress / (B.progressMax || 10)];
    if (L.healT > 0) prog = ['Healing…', 1 - L.healT / 2];
    if (L.vehicle && L.vehicle.kind === 'tank' && L.vehicle.reloadT > 0) prog = ['Cannon reloading', 1 - L.vehicle.reloadT / L.vehicle.K.reload];
    if (w && w.spinup && L.spin > 0 && L.spin < 1) prog = ['Spinning up', L.spin];
    if (B.localDefuse) prog = ['Defusing…', 1 - B.localDefuse.t / (L.kit ? Game.mode.kitTime : Game.mode.defuseTime)];
    E.prog.classList.toggle('hidden', !prog); if (prog) { E.progtxt.textContent = prog[0]; E.progbar.style.width = clamp(prog[1], 0, 1) * 100 + '%'; }
    // hints
    let hint = '';
    if (L.alive) {
      if (B.state === 'carried' && B.carrier === L.id) hint = World.siteAt(L.pos.x, L.pos.z) ? 'Hold E to plant the bomb' : 'You have the bomb — plant it at A or B';
      else if (L.team === 'CT' && B.state === 'planted' && B.pos && dist2(L.pos.x, L.pos.z, B.pos.x, B.pos.z) < 2 && !prog) hint = 'Hold E to defuse';
      else if (!L.vehicle && Game.vehicles.some(v => v.alive && (!v.driver || (!v.passenger && v.kind !== 'tank')) && dist2(v.pos.x, v.pos.z, L.pos.x, L.pos.z) < v.K.enter)) { const v = Game.vehicles.find(v => v.alive && dist2(v.pos.x, v.pos.z, L.pos.x, L.pos.z) < v.K.enter); hint = 'E — enter ' + (v ? v.K.name.toLowerCase() : 'vehicle'); }
      else if (L.vehicle) hint = L.vehicle.kind === 'tank' ? `Tank ${Math.max(0, Math.ceil(L.vehicle.hp))}/${L.vehicle.maxHp} · W/S drive · A/D turn · mouse aim · LMB fire · E exit` : L.vehicle.driver === L ? 'W/S drive · A/D steer · Space brake · E exit' : 'Passenger — shoot freely · E exit';
      else if (Game.mode.buy && Game.round && UI.canBuy(L)) hint = 'B — buy menu';
    }
    E.hint.textContent = hint;
    this.bannerT -= dt;
    if (Input.down('Tab') && !UI.blocking()) this.renderBoard(); else E.board.classList.add('hidden');
    this.drawRadar();
    if (!E.deploy.classList.contains('hidden')) this.updateDeploy();
  },
  /* Scope reticles drawn as SVG in a 100×100 box centred on the screen.
     The black surround is one huge path with a round hole. */
  setScope(kind) {
    if (this.scopeKind === kind) return; this.scopeKind = kind;
    const R = 44, hole = `M-2000,-2000H2000V2000H-2000Z M0,${-R}A${R},${R} 0 1,0 0,${R}A${R},${R} 0 1,0 0,${-R}Z`;
    const ln = (x1, y1, x2, y2, w = 0.14, c = '#000') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`;
    let ret = '';
    if (kind === 'sniper') {
      ret = ln(-R, 0, -1.4, 0) + ln(1.4, 0, R, 0) + ln(0, -R, 0, -1.4) + ln(0, 1.4, 0, R)
        + ln(-R, 0, -16, 0, 1.1) + ln(16, 0, R, 0, 1.1) + ln(0, 16, 0, R, 1.1) + ln(0, -R, 0, -16, 1.1)
        + [4, 8, 12].map(d => `<circle cx="${d}" cy="0" r=".32"/><circle cx="${-d}" cy="0" r=".32"/><circle cx="0" cy="${d}" r=".32"/><circle cx="0" cy="${-d}" r=".32"/>`).join('')
        + '<circle r=".28" fill="#ff2a2a"/>';
    } else if (kind === 'acog') {
      ret = ln(-R, 0, -9, 0, 0.18) + ln(9, 0, R, 0, 0.18) + ln(0, 2.6, 0, 18, 0.14, '#111')
        + [[5, 2.2], [8, 1.7], [11, 1.3], [14, 1]].map(([y, w]) => ln(-w, y, w, y, 0.16, '#111')).join('')
        + '<path d="M0,0 L-1.9,2.5 L-1.3,2.5 L0,0.8 L1.3,2.5 L1.9,2.5 Z" fill="#ff3a2a" style="filter:drop-shadow(0 0 .4px #ff5a3a)"/>';
    } else {  // crossbow: thin cross and drop marks for longer shots
      ret = ln(-R, 0, -2, 0, 0.12) + ln(2, 0, R, 0, 0.12) + ln(0, -R, 0, -2, 0.12) + ln(0, 2, 0, R, 0.12)
        + [[3, 3], [6, 2.4], [9.5, 1.8]].map(([y, w]) => ln(-w, y, w, y, 0.2, '#1a1a1a')).join('') + '<circle r=".35" fill="#3aff6a"/>';
    }
    this.el.scope.innerHTML = `<svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid meet"><defs>
      <radialGradient id="scV"><stop offset="0.72" stop-color="#000" stop-opacity="0"/><stop offset="0.97" stop-color="#000" stop-opacity="0.85"/><stop offset="1" stop-color="#000"/></radialGradient>
      <radialGradient id="scT"><stop offset="0" stop-color="${kind === 'acog' ? '#ffdca0' : '#bfe8ff'}" stop-opacity="0.07"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
      <circle r="${R}" fill="url(#scT)"/>${ret}<circle r="${R}" fill="url(#scV)"/><circle r="${R}" fill="none" stroke="#111" stroke-width="1.2"/><path d="${hole}" fill="#000" fill-rule="evenodd"/></svg>`;
  },
  center(t, dur = 2) { const e = this.el.center; e.textContent = t; e.classList.remove('hidden'); this.centerT = dur; },
  hitmarker(head) { this.hitT = 0.2; this.el.hitm.classList.toggle('head', !!head); },
  hurt(fromPos, d) {
    const L = Game.local; if (!L) return;
    if (fromPos) this.hurtList.push({ ang: Math.atan2(-(fromPos.x - L.pos.x), -(fromPos.z - L.pos.z)), t: 1 });
    Sfx.play('hurt'); this.el.blood.style.opacity = clamp(d / 60, 0.2, 0.7); setTimeout(() => this.el.blood.style.opacity = 0, 120);
    Player.shakeT = Math.max(Player.shakeT, 0.15);
  },
  shake(t) { Player.shakeT = t; },
  drawDamage(dt) {
    const c = this.dctx, W = this.el.dmgind.width, H = this.el.dmgind.height; c.clearRect(0, 0, W, H);
    const L = Game.local;
    for (let i = this.hurtList.length - 1; i >= 0; i--) {
      const h = this.hurtList[i]; h.t -= dt * 0.8; if (h.t <= 0) { this.hurtList.splice(i, 1); continue; }
      const a = angDiff(L.yaw, h.ang);
      c.save(); c.translate(W / 2, H / 2); c.rotate(-a); c.fillStyle = `rgba(255,40,40,${h.t * 0.8})`;
      c.beginPath(); c.moveTo(-26, -120); c.lineTo(0, -140); c.lineTo(26, -120); c.lineTo(0, -128); c.closePath(); c.fill(); c.restore();
    }
  },
  killfeed(a, v, w, hs) {
    if (!v) return;
    const L = Game.local, wn = w === 'bomb' ? '💣' : w === 'fall' ? 'fell' : w === 'frag' ? 'HE' : w === 'jeep' ? 'roadkill' : WEAPONS[w] ? WEAPONS[w].name : w;
    const col = s => `<b style="color:${TEAM_STYLE[s.team].color}">${escapeHtml(s.name)}</b>`;
    const div = document.createElement('div'); div.className = 'kf' + ((a === L || v === L) ? ' me' : '');
    div.innerHTML = (a && a !== v ? col(a) + ' ' : '') + `<span class="w">${escapeHtml(wn)}${hs ? ' ⌖' : ''}</span> ` + col(v);
    this.el.killfeed.prepend(div); setTimeout(() => div.remove(), 6500);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
  },
  died(a, w, hs) {
    const k = this.el.killcard;
    if (a && a !== Game.local) {
      const it = a.skinItem(w);
      k.innerHTML = `<div class="kc-t">Killed by <b style="color:${TEAM_STYLE[a.team].color}">${escapeHtml(a.name)}</b>${hs ? ' <span class="hs">HEADSHOT</span>' : ''}</div><div class="kc-w">${WEAPONS[w] ? WEAPONS[w].name : w}${it ? ' | ' + escapeHtml(SKINS[it.skinId].name) : ''} · ${Math.max(0, Math.ceil(a.hp))} HP left</div>`;
      k.classList.remove('hidden');
    }
    Inv.data.stats.deaths; // tallied at match end
  },
  radio(from, text) {
    const d = document.createElement('div'); d.innerHTML = `<b>${escapeHtml(from)}</b> <span>${escapeHtml(text)}</span>`;
    this.el.radio.appendChild(d); setTimeout(() => d.remove(), 7000);
    while (this.el.radio.children.length > 6) this.el.radio.firstChild.remove();
  },
  chat(from, text, team) {
    const d = document.createElement('div'); d.innerHTML = `<b style="color:${team ? TEAM_STYLE[team].color : '#ffd84a'}">${escapeHtml(from)}:</b> ${escapeHtml(text)}`;
    this.el.chatlog.appendChild(d); setTimeout(() => d.classList.add('fade'), 9000);
    while (this.el.chatlog.children.length > 8) this.el.chatlog.firstChild.remove();
  },
  openChat() { const i = this.el.chatin; i.classList.remove('hidden'); i.value = ''; Input.typing = true; Input.clear(); if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => i.focus(), 0); this.el.chatlog.querySelectorAll('.fade').forEach(e => e.classList.remove('fade')); },
  closeChat() { const i = this.el.chatin; i.classList.add('hidden'); i.blur(); Input.typing = false; UI.lock(); },
  spectating(s) { const e = this.el.spec; if (s) { e.textContent = 'Spectating ' + s.name + ' · click for next'; e.classList.remove('hidden'); } else e.classList.add('hidden'); },
  roundBanner(winner, text, mvp) {
    const b = this.el.banner, L = Game.local; const won = L && L.team === winner;
    b.className = 'banner ' + (winner === 'T' ? 't' : 'ct');
    b.innerHTML = `<div class="bw">${TEAM_STYLE[winner].name.toUpperCase()} WIN${won ? ' — nice' : ''}</div><div class="bt">${escapeHtml(text)}</div>` + (mvp ? `<div class="bm">★ Round MVP: ${escapeHtml(mvp.name)} (${mvp.roundKills || 0} kills)</div>` : '');
    this.bannerT = 5;
  },
  renderBoard() {
    const E = this.el.board; E.classList.remove('hidden'); const L = Game.local;
    if (Game.mode.id === 'sandbox') { E.innerHTML = `<div class="bt-top">Sandbox · ${World.def.name}${Net.role !== 'off' ? ' · room ' + escapeHtml(Net.code) : ''}</div><table><tr><th>Player</th><th>K</th><th>D</th></tr>${Game.soldiers.filter(s => !s.npc).map(s => `<tr class="${s === L ? 'me' : ''}"><td style="color:${TEAM_STYLE[s.team].color}">${escapeHtml(s.name)}</td><td>${s.kills}</td><td>${s.deaths}</td></tr>`).join('')}</table>`; return; }
    const table = team => {
      const rows = Game.soldiers.filter(s => s.team === team && !s.npc).sort((a, b) => b.score - a.score || b.kills - a.kills);
      return `<div class="bt-h" style="color:${TEAM_STYLE[team].color}">${TEAM_STYLE[team].name} ${Game.mode.id === 'defuse' ? '· ' + Game.score[team] : Game.mode.id === 'conquest' ? '· ' + Math.ceil(Game.tickets[team]) + ' tickets' : '· ' + Game.tdm.kills[team]}</div>
      <table><tr><th>Name</th><th>K</th><th>A</th><th>D</th><th>Score</th>${Game.mode.buy && L && L.team === team ? '<th>$</th>' : ''}</tr>` +
        rows.map(s => `<tr class="${s === L ? 'me' : ''} ${s.alive ? '' : 'dead'}"><td>${s.isBot ? '<i>BOT</i> ' : ''}${escapeHtml(s.name)}${'★'.repeat(Math.min(5, s.mvps))}${Game.bomb.carrier === s.id && L && L.team === 'T' && team === 'T' ? ' 💣' : ''}</td><td>${s.kills}</td><td>${s.assists}</td><td>${s.deaths}</td><td>${s.score}</td>${Game.mode.buy && L && L.team === team ? '<td>$' + s.money + '</td>' : ''}</tr>`).join('') + '</table>';
    };
    E.innerHTML = `<div class="bt-top">${Game.mode.name} · ${World.def.name}${Net.role !== 'off' ? ' · room ' + escapeHtml(Net.code) : ''}</div><div class="cols">${table('CT')}${table('T')}</div>`;
  },
  /* respawn screen: class + spawn point */
  showDeploy(on) {
    const d = this.el.deploy; d.classList.toggle('hidden', !on);
    if (!on) { UI.lock(); return; }
    if (document.pointerLockElement) document.exitPointerLock();
    const L = Game.local;
    L.pickW = L.pickW || null; L.pickG = L.pickG || null;
    const wopts = c => [c.primary[L.team]].concat(c.options || []), gopts = c => c.gadgets || [];
    d.innerHTML = `<h2>Deploy</h2><div class="classes">${Object.entries(CLASSES).map(([k, c]) => `<div class="cls ${L.cls === k ? 'sel' : ''}" data-c="${k}"><b>${c.name}</b><small>${WEAPONS[c.secondary].name}</small><p>${c.desc}</p>
      <div class="wpick">${wopts(c).map(w => `<button class="${(L.cls === k && (L.pickW || c.primary[L.team]) === w) ? 'on' : ''}" data-w="${w}" data-c="${k}">${WEAPONS[w].name}</button>`).join('')}</div>
      ${gopts(c).length ? `<div class="wpick">${gopts(c).map(w => `<button class="${(L.cls === k && (L.pickG || 'rpg') === w) ? 'on' : ''}" data-g="${w}" data-c="${k}">${WEAPONS[w].name}</button>`).join('')}</div>` : ''}</div>`).join('')}</div>
      <div class="spawns" id="spawnlist"></div><button id="deployBtn" class="btn big">Deploy</button><div id="deployT" class="muted"></div>`;
    d.querySelectorAll('.cls').forEach(el => el.onclick = e => {
      const c = el.dataset.c; if (L.cls !== c) { L.pickW = null; L.pickG = null; } L.cls = c;
      const b = e.target.closest('button'); if (b && b.dataset.w) L.pickW = b.dataset.w === CLASSES[c].primary[L.team] ? null : b.dataset.w; if (b && b.dataset.g) L.pickG = b.dataset.g;
      Sfx.play('ui'); this.showDeploy(true);
    });
    this.deployWhere = null; this.deploySig = '';
    $('deployBtn').onclick = () => this.deploy();
    this.updateDeploy();
  },
  updateDeploy() {
    const L = Game.local; if (!L) return;
    const opts = [{ k: 'hq', label: 'HQ', where: null }];
    if (Game.mode.id === 'conquest') World.flags.forEach((f, i) => { if (f.owner === L.team) opts.push({ k: 'f' + i, label: `${f.name} · ${f.label}${f.contested ? ' ⚠' : ''}`, where: { flag: i } }); });
    const sig = opts.map(o => o.k).join(',');
    if (sig !== this.deploySig) {
      this.deploySig = sig; if (this.deployWhere && !opts.find(o => o.k === this.deployWhere.k)) this.deployWhere = null;
      $('spawnlist').innerHTML = opts.map(o => `<button class="btn sp ${this.deployWhere && this.deployWhere.k === o.k || (!this.deployWhere && o.k === 'hq') ? 'sel' : ''}" data-k="${o.k}">${o.label}</button>`).join('');
      $('spawnlist').querySelectorAll('button').forEach(b => b.onclick = () => { this.deployWhere = opts.find(o => o.k === b.dataset.k); $('spawnlist').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); });
    }
    const t = L.respawnT || 0; $('deployT').textContent = t > 0 ? `Ready in ${t.toFixed(1)}s` : 'Ready';
    $('deployBtn').disabled = t > 0;
  },
  deploy() {
    const L = Game.local; if (!L || L.alive || (L.respawnT || 0) > 0) return;
    const where = this.deployWhere ? this.deployWhere.where : null;
    if (Game.authority()) { Game.respawn(L, where); L.respawnT = null; this.showDeploy(false); HUD.onSpawn(); }
    else Net.send({ t: 'deploy', where, cls: L.cls, pw: L.pickW, pg: L.pickG });
    Sfx.play('ui');
  },
};
