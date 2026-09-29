/* ═══════════════════════════════════════════════════════════════════════════
   Squads (v2.9), in Conquest and TDM.
   · Every player leads a squad of three bots from their team. The squad
     follows you, fights around you, and shows on the left of the HUD with
     its health.
   · T places a squad marker where you aim: the squad moves there and holds
     it for a minute. T at the sky calls them back to you.
   · Deploy on a squadmate: the deploy screen lists every living member of
     your squad (players in multiplayer included).
   ═══════════════════════════════════════════════════════════════════════════ */
const Squads = {
  list: new Map(),   // leader id -> { leader, members: [ids], ping: {x,y,z,until}|null }
  t: 0, markers: new Map(),
  on() { return Game.running && Game.mode && (Game.mode.id === 'conquest' || Game.mode.id === 'tdm'); },
  of(s) { if (!s) return null; for (const q of this.list.values()) if (q.leader === s.id || q.members.includes(s.id)) return q; return null; },
  reset() { this.list.clear(); for (const m of this.markers.values()) Game.scene && Game.scene.remove(m); this.markers.clear(); },
  /* host: every human gets up to three bots */
  form() {
    const humans = Game.soldiers.filter(s => (s.ctrl === 'local' || s.ctrl === 'remote') && (s.team === 'T' || s.team === 'CT'));
    let changed = false;
    for (const id of [...this.list.keys()]) if (!humans.some(h => h.id === id)) { for (const m of this.list.get(id).members) { const b = Game.byId(m); if (b) b.playerSquad = null; } this.list.delete(id); changed = true; }
    for (const h of humans) {
      let q = this.list.get(h.id); if (!q) { q = { leader: h.id, members: [], ping: null }; this.list.set(h.id, q); changed = true; }
      q.members = q.members.filter(id => { const b = Game.byId(id); return b && b.team === h.team && b.ctrl === 'bot'; });
      while (q.members.length < 3) {
        const free = Game.soldiers.filter(b => b.ctrl === 'bot' && b.isBot && b.team === h.team && !b.playerSquad && !b.npc && b.brain && b.brain.constructor === Brain);
        if (!free.length) break;
        free.sort((a, b) => dist2(a.pos.x, a.pos.z, h.pos.x, h.pos.z) - dist2(b.pos.x, b.pos.z, h.pos.x, h.pos.z));
        const b = free[0]; b.playerSquad = h.id; q.members.push(b.id); changed = true;
      }
      for (const id of q.members) { const b = Game.byId(id); if (b) b.playerSquad = h.id; }
    }
    if (changed && Net.role === 'host') this.broadcast();
  },
  broadcast() { Net.event({ t: 'sqs', l: [...this.list.values()].map(q => ({ l: q.leader, m: q.members, p: q.ping })) }); },
  /* host: move the squad */
  order() {
    for (const q of this.list.values()) {
      const L = Game.byId(q.leader); if (!L) continue;
      if (q.ping && Game.now > q.ping.until) { q.ping = null; if (Net.role === 'host') this.broadcast(); }
      q.members.forEach((id, i) => {
        const b = Game.byId(id); if (!b || !b.alive || !b.brain || b.vehicle) return;
        const B = b.brain, o = B.order;
        if (b.brain.crew || b.brain.ride2 || b.brain.mgGo) return;
        // the leader is driving something with a free seat: the first squadmate hops in
        const V = L.alive && L.vehicle;
        if (i === 0 && V && V.driver === L && !V.passenger && !V.buddy && (V.K.seats || 2) > 1 && (!V.K.closed || V.K.pguns) && dist2(b.pos.x, b.pos.z, V.pos.x, V.pos.z) < 40) { B.ride2 = V; V.buddy = b; V.buddyT = Game.now; return; }
        let pos, look;
        if (q.ping) { const a = i / 3 * TAU + 0.6; pos = { x: q.ping.x + Math.cos(a) * 2.6, z: q.ping.z + Math.sin(a) * 2.6 }; look = { x: q.ping.x + Math.cos(a) * 20, z: q.ping.z + Math.sin(a) * 20 }; }
        else if (L.alive) {
          const back = L.vehicle ? 6 : 3.5, side = [-2.6, 0, 2.6][i], fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw);
          pos = { x: L.pos.x - fx * back + fz * side, z: L.pos.z - fz * back - fx * side }; look = { x: L.pos.x + fx * 20, z: L.pos.z + fz * 20 };
          if (o && o.type === 'hold' && o.sq && dist2(o.pos.x, o.pos.z, pos.x, pos.z) < 2.5) return;   // close enough, don't jitter
        } else return;   // leader down: keep doing what they were doing
        const q2 = World.nav.nearest(pos.x, pos.z, 6); if (q2 >= 0) pos = { x: World.nav.cx(q2), z: World.nav.cz(q2) };
        if (o && o.type === 'hold' && o.sq && dist2(o.pos.x, o.pos.z, pos.x, pos.z) < (q.ping ? 1 : 2.5)) { o.look = new V3(look.x, 1.5, look.z); o.crouch = !!q.ping; return; }   // same spot: keep the path
        B.setOrder({ type: 'hold', pos: new V3(pos.x, 0, pos.z), look: new V3(look.x, 1.5, look.z), crouch: !!q.ping, sq: true });
      });
    }
  },
  /* anyone: place or clear a marker (host applies) */
  ping(leaderId, p) {
    const q = this.list.get(leaderId); if (!q) return;
    q.ping = p ? { x: p[0], y: p[1], z: p[2], until: Game.now + 60 } : null;
    const L = Game.byId(leaderId), cmd = L && Game.cmd[L.team];
    if (cmd && L) cmd.say(L, p ? `Squad, move to ${World.zoneAt(p[0], p[2]) || 'my marker'}!` : 'Squad, on me!', 0);
    for (const id of q.members) { const b = Game.byId(id); if (b && b.brain) b.brain.order = { type: 'idle' }; }
    if (Net.role === 'host') this.broadcast();
    this.order();
  },
  localPing() {
    const L = Game.local; if (!L || !L.alive) return;
    const o = Game.camera.position, d = Game.camera.getWorldDirection(new V3());
    let t = World.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 300);
    if (t < 0 && d.y < -0.01) t = (o.y - World.floorAt(o.x, o.z)) / -d.y;
    const p = t > 0 && t < 300 ? o.clone().addScaledVector(d, t) : null, arr = p ? [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] : null;
    if (Game.authority()) this.ping(L.id, arr); else Net.send({ t: 'sqping', p: arr });
    Sfx.play('ui'); HUD.center(p ? 'Squad marker placed' : 'Squad: regroup on me', 1);
  },
  /* the marker you and your squad see */
  drawMarkers() {
    const L = Game.local, q = this.of(L), want = q && q.ping && (q.leader === L.id || q.members.includes(L.id)) ? q.ping : null;
    let m = this.markers.get('me');
    if (!want) { if (m) m.visible = false; return; }
    if (!m) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
      c.fillStyle = 'rgba(80,220,120,.9)'; c.beginPath(); c.moveTo(64, 8); c.lineTo(112, 56); c.lineTo(64, 104); c.lineTo(16, 56); c.closePath(); c.fill();
      c.strokeStyle = '#0a2a14'; c.lineWidth = 6; c.stroke(); c.fillStyle = '#0a2a14'; c.font = 'bold 44px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 64, 58);
      m = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); m.renderOrder = 999; Game.scene.add(m); this.markers.set('me', m);
    }
    m.visible = true; const d = Math.hypot(want.x - Game.camera.position.x, want.z - Game.camera.position.z), s = clamp(d * 0.035, 0.8, 5);
    m.position.set(want.x, want.y + 1.4 + s * 0.4 + Math.sin(Game.now * 3) * 0.12, want.z); m.scale.set(s, s, 1);
  },
  hud() {
    let el = document.getElementById('sqpanel');
    if (!el) { el = document.createElement('div'); el.id = 'sqpanel'; HUD.el.hud.appendChild(el); }
    const L = Game.local, q = this.of(L); if (!q || !this.on()) { el.style.display = 'none'; return; }
    const ids = [q.leader].concat(q.members), rows = ids.map(id => { const s = Game.byId(id); if (!s) return ''; const hp = s.alive ? Math.max(0, Math.round(s.hp)) : 0;
      return `<div class="sq-row ${s.alive ? '' : 'dead'} ${s === L ? 'me' : ''}"><span>${id === q.leader ? '★ ' : ''}${escapeHtml(s.name)}</span><i style="width:${hp}%"></i></div>`; }).join('');
    const html = `<div class="sq-h">Squad${q.ping ? ' · holding marker' : ''} <small>T: marker</small></div>${rows}`;
    if (el._h !== html) { el.innerHTML = html; el._h = html; } el.style.display = '';
  },
};
/* commanders leave squad bots alone while their leader is alive */
const _bots41 = Commander.prototype.bots;
Commander.prototype.bots = function () { return _bots41.call(this).filter(b => { if (!b.playerSquad) return true; const L = Game.byId(b.playerSquad); return !(L && L.alive); }); };
/* per frame */
const _gupdate41 = Game.update.bind(Game);
Game.update = function (dt) {
  _gupdate41(dt); if (!this.running || !Squads.on()) return;
  if (this.authority()) { Squads.t -= dt; if (Squads.t <= 0) { Squads.t = 0.5; Squads.form(); Squads.order(); } }
  Squads.drawMarkers();
};
const _hud41 = HUD.update.bind(HUD);
HUD.update = function (dt) { _hud41(dt); if (Game.running) Squads.hud(); };
const _start41 = Game.start.bind(Game);
Game.start = function (cfg) { Squads.reset(); const r = _start41(cfg); Squads.t = 0; return r; };
addEventListener('keydown', e => { if (e.code === 'KeyT' && Game.running && !Input.typing && Squads.on() && !UI.blocking()) Squads.localPing(); });
/* network */
const _hostData41 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  if (m && m.t === 'sqping') { const p = this.peers.get(id), s = p && p.sid && Game.byId(p.sid); if (s) Squads.ping(s.id, Array.isArray(m.p) ? m.p.slice(0, 3).map(n => +n || 0) : null); return; }
  return _hostData41(id, m);
};
const _applyEvent41 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  if (e && e.t === 'sqs') { if (!Game.authority()) { Squads.list.clear(); for (const q of e.l) Squads.list.set(q.l, { leader: q.l, members: q.m, ping: q.p ? Object.assign({}, q.p, { until: Game.now + 60 }) : null }); } return; }
  return _applyEvent41(e);
};
/* deploy on a squadmate */
HUD.updateDeploy = function () {
  const L = Game.local; if (!L) return;
  const opts = [{ k: 'hq', label: 'HQ', where: null }];
  if (Game.mode.id === 'conquest') World.flags.forEach((f, i) => { if (f.owner === L.team) opts.push({ k: 'f' + i, label: `${f.name} · ${f.label}${f.contested ? ' ⚠' : ''}`, where: { flag: i } }); });
  const q = Squads.on() && Squads.of(L);
  if (q) for (const id of [q.leader].concat(q.members)) { const s = Game.byId(id); if (!s || s === L || !s.alive || s.vehicle) continue; const hot = s.brain && s.brain.target && s.brain.target.alive; opts.push({ k: 'sq' + id, label: `Squad · ${escapeHtml(s.name)}${hot ? ' ⚔' : ''}`, where: { squad: id } }); }
  const sig = opts.map(o => o.k).join(',');
  if (sig !== this.deploySig) {
    this.deploySig = sig; if (this.deployWhere && !opts.find(o => o.k === this.deployWhere.k)) this.deployWhere = null;
    $('spawnlist').innerHTML = opts.map(o => `<button class="btn sp ${this.deployWhere && this.deployWhere.k === o.k || (!this.deployWhere && o.k === 'hq') ? 'sel' : ''} ${o.k.startsWith('sq') ? 'sqsp' : ''}" data-k="${o.k}">${o.label}</button>`).join('');
    $('spawnlist').querySelectorAll('button').forEach(b => b.onclick = () => { this.deployWhere = opts.find(o => o.k === b.dataset.k); $('spawnlist').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); });
  }
  const t = L.respawnT || 0; $('deployT').textContent = t > 0 ? `Ready in ${t.toFixed(1)}s` : 'Ready';
  $('deployBtn').disabled = t > 0;
};
