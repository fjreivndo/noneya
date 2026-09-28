/* ═══════════════════════════════════════════════════════════════════════════
   Multiplayer. Host-authoritative star: the host runs bots, rules and damage;
   clients move themselves, shoot, and report hits.

   Links (all carry the same messages):
     PeerJS     WebRTC through the free PeerJS broker. A 5-letter room code,
                works across the internet, nothing to run.
     local      BroadcastChannel between tabs of the same browser (testing).
     ws://      any broadcast relay (e.g. relay.js from Hollowreach Desktop)
                for LAN play without internet.
   ═══════════════════════════════════════════════════════════════════════════ */

const Net = {
  role: 'off', link: null, code: null, myId: null, peers: new Map(), lobby: null, sendT: 0, snapT: 0, lastHost: 0, pingT: 0,
  status: '', onLobby: null, onError: null,

  /* ── links ── */
  makeLink(code, isHost, handlers) {
    const c = code.trim();
    if (/^local:/i.test(c)) return this.starLink(new BroadcastChannel('bp-' + c.slice(6).toUpperCase()), isHost, handlers);
    if (/^wss?:\/\//i.test(c)) { const ws = new WebSocket(c); const medium = { postMessage: m => ws.readyState === 1 && ws.send(JSON.stringify(m)), close: () => ws.close() }; ws.onmessage = e => { try { medium.onmessage && medium.onmessage({ data: JSON.parse(e.data) }); } catch (er) { } }; ws.onopen = () => medium.onready && medium.onready(); ws.onerror = () => handlers.error('Could not reach relay ' + c); ws.onclose = () => handlers.close && handlers.close(); return this.starLink(medium, isHost, handlers, true); }
    return this.peerLink(c.toUpperCase(), isHost, handlers);
  },
  /* A star network over a broadcast medium: every message carries from/to. */
  starLink(medium, isHost, h, waitReady) {
    const me = isHost ? 'host' : 'c' + uid(6), seen = new Map(); this.myId = me;
    const link = {
      me, send: (to, m) => medium.postMessage({ from: me, to, m }), close: () => { try { medium.postMessage({ from: me, to: isHost ? '*' : 'host', m: { t: '_bye' } }); medium.close(); } catch (e) { } }, lastSeen: seen,
    };
    medium.onmessage = e => {
      const { from, to, m } = e.data || {}; if (!m || from === me || (to !== me && to !== '*')) return;
      seen.set(from, performance.now());
      if (m.t === '_bye') { if (isHost) h.close(from); else h.close(); return; }
      if (isHost && m.t === '_hello') { h.connect(from); return; }
      if (!isHost && m.t === '_welcome') { h.open(); return; }
      if (isHost) h.data(from, m); else h.data(m);
    };
    const hello = () => { if (!isHost) medium.postMessage({ from: me, to: 'host', m: { t: '_hello' } }); };
    if (isHost) { const origConnect = h.connect; h.connect = id => { medium.postMessage({ from: me, to: id, m: { t: '_welcome' } }); origConnect(id); }; setTimeout(() => h.ready && h.ready(), 0); }
    if (waitReady) medium.onready = () => { hello(); if (isHost) h.ready && h.ready(); }; else setTimeout(hello, 50);
    if (!isHost) { link.helloTimer = setTimeout(() => { if (!Net.connected) h.error('No host answered on that code.'); }, 5000); }
    return link;
  },
  peerLink(code, isHost, h) {
    if (typeof Peer === 'undefined') { h.error('PeerJS failed to load. Use local:CODE or ws:// instead.'); return null; }
    const conns = new Map();
    const peer = isHost ? new Peer('breachpt-' + code.toLowerCase(), { debug: 0 }) : new Peer({ debug: 0 });
    const link = { me: null, send: (to, m) => { if (isHost) { const c = conns.get(to); if (c && c.open) c.send(m); } else if (link.conn && link.conn.open) link.conn.send(m); }, close: () => { try { peer.destroy(); } catch (e) { } }, lastSeen: new Map() };
    peer.on('open', id => {
      link.me = id; Net.myId = isHost ? 'host' : id;
      if (isHost) { h.ready && h.ready(); return; }
      const conn = peer.connect('breachpt-' + code.toLowerCase(), { reliable: true, serialization: 'json' }); link.conn = conn;
      conn.on('open', () => h.open());
      conn.on('data', d => h.data(d));
      conn.on('close', () => h.close());
      conn.on('error', () => h.error('Connection error.'));
      setTimeout(() => { if (!conn.open) h.error('No host found for code ' + code + '.'); }, 9000);
    });
    peer.on('connection', conn => { conn.on('open', () => { conns.set(conn.peer, conn); h.connect(conn.peer); }); conn.on('data', d => h.data(conn.peer, d)); conn.on('close', () => { conns.delete(conn.peer); h.close(conn.peer); }); });
    peer.on('error', e => h.error({
      'unavailable-id': 'That room code is taken, try again.',
      'peer-unavailable': 'No host found for code ' + code + '.',
      'server-error': 'Could not reach the PeerJS matchmaking server. Check your connection, or play over LAN with a ws:// relay.',
      'network': 'Lost the connection to the PeerJS server.',
      'browser-incompatible': 'This browser has no WebRTC support.',
    }[e.type] || 'Network: ' + (e.message || e.type)));
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
    return link;
  },

  /* ── lobby ── */
  host(code, opts) {
    this.leave(); this.role = 'host'; this.code = code; this.connected = true;
    this.lobby = { players: [{ id: 'host', name: Settings.name, team: 'CT', skins: Inv.loadoutSkins(), cls: 'assault' }], mode: opts.mode, map: opts.map, diff: opts.diff, teamSize: opts.teamSize, started: false };
    this.link = this.makeLink(code, true, {
      ready: () => { this.status = 'Hosting ' + code; this.pushLobby(); },
      connect: id => { this.peers.set(id, { id, sid: null }); },
      data: (id, m) => this.hostData(id, m),
      close: id => this.dropPeer(id),
      error: e => { this.status = e; this.onError && this.onError(e); },
    });
    if (!this.link) this.role = 'off';
  },
  join(code) {
    this.leave(); this.role = 'client'; this.code = code; this.connected = false;
    this.link = this.makeLink(code, false, {
      open: () => { this.connected = true; clearTimeout(this.link && this.link.helloTimer); this.status = 'Connected'; this.send({ t: 'join', name: Settings.name, skins: Inv.loadoutSkins(), att: Inv.data.attach }); this.lastHost = performance.now(); },
      data: m => { this.lastHost = performance.now(); this.clientData(m); },
      close: () => this.hostGone(),
      error: e => { this.status = e; this.onError && this.onError(e); },
    });
    if (!this.link) this.role = 'off';
  },
  leave() {
    if (this.link) { try { if (this.role === 'client') this.send({ t: 'leave' }); this.link.close(); } catch (e) { } }
    this.link = null; this.role = 'off'; this.peers.clear(); this.lobby = null; this.connected = false;
  },
  hostGone() { if (this.role !== 'client') return; this.leave(); if (Game.running) Game.stop(); UI.toast('Host left the game.'); UI.show('main'); },
  send(m) { if (this.role === 'client' && this.link) this.link.send('host', m); },
  to(id, m) { if (this.role === 'host' && this.link) this.link.send(id, m); },
  toAll(m, except) { if (this.role !== 'host') return; for (const id of this.peers.keys()) if (id !== except) this.to(id, m); },
  pushLobby() { if (this.role !== 'host') return; this.toAll({ t: 'lobby', l: this.lobby }); this.onLobby && this.onLobby(this.lobby); },
  setTeam(team) { if (this.role === 'host') { this.lobby.players[0].team = team; this.pushLobby(); } else this.send({ t: 'team', team }); },
  peerOf(sid) { for (const p of this.peers.values()) if (p.sid === sid) return p; return null; },
  dropPeer(id) {
    const p = this.peers.get(id); if (!p) return; this.peers.delete(id);
    if (this.lobby) this.lobby.players = this.lobby.players.filter(x => x.id !== p.sid);
    const s = p.sid && Game.byId(p.sid);
    if (s && Game.running) { s.ctrl = 'bot'; s.isBot = true; s.brain = new Brain(s); s.name = s.name + ' (bot)'; Game.radio(s.team, 'Server', `${s.name.replace(' (bot)', '')} left — a bot took over.`); HUD.chat('Server', `${s.name} left the game`); this.toAll({ t: 'ctrl', id: s.id, name: s.name }); }
    this.pushLobby();
  },

  /* ── host side ── */
  hostData(id, m) {
    const p = this.peers.get(id); if (!p) return;
    const s = p.sid ? Game.byId(p.sid) : null;
    switch (m.t) {
      case 'join': {
        const sid = 'p' + uid(5); p.sid = sid; p.name = String(m.name || 'Player').slice(0, 16);
        const counts = { T: 0, CT: 0 }; this.lobby.players.forEach(x => counts[x.team]++);
        const team = counts.T <= counts.CT ? 'T' : 'CT';
        const entry = { id: sid, name: p.name, team, skins: m.skins || {}, att: m.att || {}, cls: 'assault' };
        this.lobby.players.push(entry);
        this.to(id, { t: 'you', id: sid });
        HUD.chat('Server', p.name + ' joined');
        if (Game.running) this.lateJoin(id, entry); else this.pushLobby();
        break;
      }
      case 'team': { const e = this.lobby.players.find(x => x.id === p.sid); if (e && !Game.running) { e.team = m.team === 'T' ? 'T' : 'CT'; this.pushLobby(); } break; }
      case 'leave': this.dropPeer(id); break;
      case 'st': if (s) this.applyState(s, m); break;
      case 'hit': {
        const v = Game.byId(m.v); if (!s || !v || !s.alive) break;
        const w = WEAPONS[m.w]; const cap = w ? w.dmg * 4.2 * (w.pellets || 1) : 200;
        Game.damage(v, Math.min(+m.d || 0, cap, 200), s, m.w, m.z);
        break;
      }
      case 'vhit': { const v = Game.vehicles.find(x => x.id === m.v); if (v) v.damage(Math.min(+m.d || 0, 60), s); break; }
      case 'fire': if (s) { const e = new V3(m.e[0], m.e[1], m.e[2]); this.showShot(s, e, m.w); this.shotsOut.push([s.id, +m.e[0].toFixed(2), +m.e[1].toFixed(2), +m.e[2].toFixed(2)]); Game.noise(s, 60); } break;
      case 'nade': if (s) { Game.throwNade(s, m.ty, true, { pos: new V3(...m.p), vel: new V3(...m.v), id: m.id }); this.toAll({ t: 'nade', ty: m.ty, p: m.p, v: m.v, o: s.id, id: m.id }, id); } break;
      case 'rkt': if (s) { Game.spawnRocket(s, new V3(...m.p), new V3(...m.d), false, m.w); this.toAll({ t: 'rkt', p: m.p, d: m.d, o: s.id, w: m.w }, id); } break;
      case 'med': if (s) { s.meds = Math.max(s.meds, 1); Game.useMed(s); } break;
      case 'buy': if (s) { const r = UI.applyBuy(s, m.item); if (r) this.to(id, { t: 'give', item: m.item, m: s.money, ar: s.armor, hm: s.helmet, kit: s.kit }); } break;
      case 'act': if (s) {
        if (m.k === 'plant') Game.startPlant(s);
        else if (m.k === 'defuse') Game.startDefuse(s);
        else if (m.k === 'cancel') { s.planting = null; if (Game.bomb.defuser === s.id) Game.bomb.defuser = null; }
        break;
      }
      case 'deploy': if (s && !s.alive && (s.respawnT == null || s.respawnT <= 0.6) && !Game.matchOver) { if (CLASSES[m.cls]) s.cls = m.cls; s.pickW = m.pw || null; s.pickG = m.pg || null; Game.respawn(s, m.where); } break;
      case 'spot': { const e = Game.byId(m.e); if (e && s) Game.markSpotted(e, s.team, Math.min(10, +m.d || 6)); break; }
      case 'gadget': if (s) { if (m.k === 'heal') Game.requestHeal(s); else Game.requestAmmo(s); } break;
      case 'seat': { const v = Game.vehicles.find(x => x.id === m.id); if (v && s) { this.applySeat(v, m); this.toAll({ t: 'seat', id: v.id, d: m.d, p: m.p }, id); } break; }
      case 'chat': if (s) { const x = String(m.x).slice(0, 120); HUD.chat(s.name, x, s.team); this.toAll({ t: 'chat', n: s.name, x, team: s.team }, id); } break;
      case 'drop': if (s) Game.dropBomb(s); break;
      case 'sbx': if (s && Sandbox.on && m.a) Sandbox.run(Object.assign({}, m.a, { by: s.id })); break;
    }
  },
  lateJoin(peerId, entry) {
    // take over a bot on the joining player's team
    const bot = Game.soldiers.find(x => x.team === entry.team && x.isBot);
    if (bot) Game.removeSoldier(bot.id);
    const s = Game.addSoldier({ id: entry.id, name: entry.name, team: entry.team, ctrl: 'remote', skins: entry.skins, att: entry.att });
    s.buildModel(Game.scene); s.alive = false; s.respawnT = 0; s.money = 800; s.resetLoadout(s.team);
    this.to(peerId, { t: 'start', cfg: this.startCfgFor(), late: true });
    if (Sandbox.on) this.to(peerId, { t: 'sbxfull', st: Sandbox.snapshotAll() });
    this.toAll({ t: 'rosterDel', id: bot ? bot.id : null, add: this.rosterEntry(s) }, peerId);
    if (Game.mode.id === 'defuse') HUD.chat('Server', entry.name + ' will spawn next round');
  },
  rosterEntry(s) { return { id: s.id, name: s.name, team: s.team, isBot: s.isBot, cls: s.cls, skins: s.ctrl === 'local' ? Inv.loadoutSkins() : s.skins, att: s.attach, npc: s.npc || undefined }; },
  startCfgFor(cfg) { const c = Object.assign({}, cfg || Game.cfg); c.roster = cfg ? cfg.roster : Game.soldiers.map(s => this.rosterEntry(s)); c.players = []; return c; },
  /* host: start the match for everyone */
  startMatch() {
    const L = this.lobby; L.started = true;
    const cfg = { mode: L.mode, map: L.map, diff: L.diff, teamSize: L.mode === 'sandbox' ? 0 : L.teamSize, players: L.players.map(p => ({ id: p.id, name: p.name, team: p.team, skins: p.skins, att: p.id === 'host' ? Inv.data.attach : p.att, cls: p.cls, ctrl: p.id === 'host' ? 'local' : 'remote' })), localId: 'host' };
    // clients must be in the match before the first round's spawn events reach them
    Game.prepareRoster(cfg);
    this.toAll({ t: 'start', cfg: this.startCfgFor(cfg) });
    UI.enterGame(cfg);
  },
  applyState(s, m) {
    s.net.tx = m.p[0]; s.net.ty = m.p[1]; s.net.tz = m.p[2]; s.net.tyaw = m.y; s.net.tpitch = m.pi;
    if (!s.alive) return;
    s.vel.set(m.v[0], m.v[1], m.v[2]); s.crouch = m.c; s.ads = !!m.a;
    if (m.w && m.w !== s.cur && (WEAPONS[m.w] || isNade(m.w))) { s.cur = m.w; }
    if (m.veh && s.vehicle && s.vehicle.driver === s) { const v = s.vehicle; v.net = { x: m.veh[0], y: m.veh[1], z: m.veh[2], yaw: m.veh[3], sp: m.veh[4] }; }
  },
  applySeat(v, m) {
    for (const k of ['driver', 'passenger']) { const cur = v[k]; if (cur && cur.ctrl !== 'local') { cur.vehicle = null; v[k] = null; } }
    const d = Game.byId(m.d), p = Game.byId(m.p);
    if (d && d.ctrl !== 'local') { v.driver = d; d.vehicle = v; } if (p && p.ctrl !== 'local') { v.passenger = p; p.vehicle = v; }
  },

  /* ── client side ── */
  clientData(m) {
    switch (m.t) {
      case 'lobby': this.lobby = m.l; this.onLobby && this.onLobby(m.l); break;
      case 'you': this.myId = m.id; this.sid = m.id; break;
      case 'start': {
        const cfg = m.cfg; cfg.localId = this.sid;
        UI.enterGame(cfg);
        if (m.late) HUD.chat('Server', 'Joined a match in progress');
        break;
      }
      case 'snap': this.applySnap(m); break;
      case 'sbxev': if (Sandbox.on) Sandbox.apply(m.ev); break;
      case 'sbxfull': if (Sandbox.on) { for (const ev of m.st.props) Sandbox.apply(ev); for (const ev of m.st.cons) Sandbox.apply(ev); for (const ev of m.st.veh) Sandbox.apply(ev); } break;
      case 'toast': HUD.center(m.x, 0.8); break;
      case 'ev': this.applyEvent(m.e); break;
      case 'spawn': this.applySpawn(m); break;
      case 'round': this.applyRound(m); break;
      case 'radio': HUD.radio(m.f, m.x); break;
      case 'chat': HUD.chat(m.n, m.x, m.team); break;
      case 'dmg': { const L = Game.local; if (!L) break; L.hp = m.hp; L.armor = m.ar; L.lastDamage = Game.now; HUD.hurt(m.a ? { x: m.a[0], z: m.a[1] } : null, m.d); break; }
      case 'give': { const L = Game.local; if (!L) break; if (WEAPONS[m.item] || isNade(m.item)) L.give(m.item); if (m.item === 'medkit') L.meds++; L.money = m.m; L.armor = m.ar; L.helmet = m.hm; L.kit = m.kit; Sfx.play('buy'); UI.refreshBuy(); break; }
      case 'nade': { const o = Game.byId(m.o); if (o) Game.throwNade(o, m.ty, true, { pos: new V3(...m.p), vel: new V3(...m.v), id: m.id }); break; }
      case 'rkt': { const o = Game.byId(m.o); if (o) Game.spawnRocket(o, new V3(...m.p), new V3(...m.d), false, m.w); break; }
      case 'seat': { const v = Game.vehicles.find(x => x.id === m.id); if (v) this.applySeat(v, m); break; }
      case 'ctrl': { const s = Game.byId(m.id); if (s) { s.name = m.name; s.isBot = true; } break; }
      case 'rosterDel': {
        if (m.id) Game.removeSoldier(m.id);
        if (m.add && !Game.byId(m.add.id)) { const s = Game.addSoldier(Object.assign({}, m.add, { ctrl: 'puppet' })); s.buildModel(Game.scene); }
        break;
      }
    }
  },
  applySnap(m) {
    if (!Game.running) return;
    const L = Game.local;
    for (const a of m.s) {
      const s = Game.byId(a[0]); if (!s) continue;
      const alive = !!a[9];
      if (s === L) {
        L.hp = a[7]; L.armor = a[8]; L.money = a[11]; L.helmet = !!(a[12] & 1);
        if (!alive && L.alive) { L.alive = false; }
        L.spotT = (a[12] & 2) ? Game.now + 1 : 0; L.spotCT = (a[12] & 4) ? Game.now + 1 : 0;
        continue;
      }
      s.net.tx = a[1]; s.net.ty = a[2]; s.net.tz = a[3]; s.net.tyaw = a[4]; s.net.tpitch = a[5]; s.crouch = a[6]; s.hp = a[7]; s.armor = a[8];
      if (alive && !s.alive) { s.pos.set(a[1], a[2], a[3]); s.deadT = 0; if (s.model) { s.model.userData.body.rotation.x = 0; s.model.userData.body.position.y = 0; } }
      s.alive = alive; if (a[10] && (WEAPONS[a[10]] || isNade(a[10]))) s.cur = a[10]; s.money = a[11];
      s.spotT = (a[12] & 2) ? Game.now + 1 : 0; s.spotCT = (a[12] & 4) ? Game.now + 1 : 0; s.planting = (a[12] & 8) ? {} : null;
    }
    const g = m.g; if (g) {
      if (g.r) { Game.round = Game.round || {}; Object.assign(Game.round, { phase: g.r[0], timeLeft: g.r[1], t: g.r[2], num: g.r[3] }); Game.score = { T: g.r[4], CT: g.r[5] }; Game.roundNum = g.r[3]; }
      if (g.b) { const B = Game.bomb; B.state = g.b[0]; B.carrier = g.b[1]; B.pos = g.b[2] ? new V3(...g.b[2]) : null; B.timer = g.b[3]; B.site = g.b[4]; B.defuser = g.b[5]; B.progress = g.b[6]; B.progressMax = g.b[7];
        if ((B.state === 'planted' || B.state === 'dropped') && B.pos) Game.bombModel(true); else if (Game.bombMesh && Game.bombMesh.parent) Game.bombModel(false);
        if (B.state === 'planted') { B.beep = (B.beep || 0) - 1 / 15; if (B.beep <= 0) { B.beep = B.timer > 10 ? 1 : B.timer > 5 ? 0.5 : 0.22; Sfx.play('beep', B.pos); } }
        if (Game.bombMesh && B.pos) { Game.bombMesh.position.copy(B.pos); Game.bombMesh.children[0].visible = B.state === 'planted' && (Game.now * 2 % 1) < 0.5; }
      }
      if (g.tk) Game.tickets = { T: g.tk[0], CT: g.tk[1] };
      if (g.f) g.f.forEach((f, i) => { const F = World.flags[i]; if (F) { F.prog = f[0]; F.owner = f[1] || null; F.contested = !!f[2]; } });
      if (g.td && Game.tdm) { Game.tdm.kills = { T: g.td[0], CT: g.td[1] }; Game.tdm.timeLeft = g.td[2]; }
      if (g.v) g.v.forEach(a => { const v = Game.vehicles.find(x => x.id === a[0]); if (!v || (v.driver && v.driver.ctrl === 'local')) return; v.net = { x: a[1], y: a[2], z: a[3], yaw: a[4], sp: a[5] }; v.hp = a[6]; if (!!a[7] !== v.alive) { v.alive = !!a[7]; v.model.visible = v.alive; if (v.alive) v.reset(); } });
    }
    if (m.p) for (const a of m.p) { const p = Phys.byId.get(a[0]); if (p) p.net = a.slice(1); }
    if (m.sh) for (const sh of m.sh) { const s = Game.byId(sh[0]); if (s && s !== L) this.showShot(s, new V3(sh[1], sh[2], sh[3]), s.cur); }
  },
  showShot(s, end, wid) {
    const eye = s.eye(new V3()), w = s.stat(wid) || s.w;
    const mz = eye.clone().add(new V3(0, -0.2, 0));
    if (!(w && w.suppressed) && chance(0.7)) FX.tracer(mz, end); if (!(w && w.suppressed)) FX.muzzle(mz);
    const d = end.clone().sub(eye), dist = d.length(); d.multiplyScalar(1 / dist);
    const hit = World.raycast(eye.x, eye.y, eye.z, d.x, d.y, d.z, dist + 0.2); if (hit >= 0 && Math.abs(hit - dist) < 0.3) FX.impact(end, { x: World.hit.nx, y: World.hit.ny, z: World.hit.nz });
    if (w) Sfx.play('shot', eye, { w });
    // bullets cracking past your head
    const L = Game.local; if (L && L.alive && s.team !== L.team) { const le = L.eye(new V3()), t = clamp(le.clone().sub(eye).dot(d), 0, dist), cp = eye.clone().addScaledVector(d, t); if (cp.distanceTo(le) < 1.2) Sfx.play('whiz', cp); }
  },
  applyEvent(e) {
    switch (e.t) {
      case 'kill': Game.onKillEvent(e); break;
      case 'bomb': {
        const B = Game.bomb; B.state = e.s;
        if (e.s === 'planted') { B.pos = new V3(...e.p); B.site = e.site; Game.bombModel(true); HUD.center('BOMB PLANTED', 2); Sfx.play('plant', B.pos); if (Game.local) Game.local.planting = null; }
        if (e.s === 'dropped') { B.pos = new V3(...e.p); Game.bombModel(true); }
        if (e.s === 'carried') { B.carrier = e.c; Game.bombModel(false); if (Game.local && e.c === Game.local.id) HUD.center('You picked up the bomb', 1.5); }
        if (e.s === 'exploded') { FX.explosion(B.pos); FX.explosion(B.pos.clone().setY(2)); Sfx.play('explode', B.pos, { vol: 2 }); Game.bombModel(false); }
        if (e.s === 'defused') { B.localDefuse = null; Sfx.play('plant', B.pos); }
        break;
      }
      case 'flag': if (Game.local) { const f = World.flags.find(x => x.name === e.f); if (f) f.owner = e.o; if (e.o === Game.local.team) Sfx.play('capture'); } break;
      case 'veh': { const v = Game.vehicles.find(x => x.id === e.id); if (v) { if (!e.alive && v.alive) { v.alive = false; FX.explosion(v.pos.clone().setY(1)); Sfx.play('explode', v.pos); v.model.visible = false; for (const s of [v.driver, v.passenger]) if (s) Game.exitVehicle(s, true); } else if (e.alive && !v.alive) v.reset(); v.hp = e.hp; } break; }
      case 'pk': if (e.op === 'add') Game.addPickup(e.kind, new V3(...e.p), e.id); else Game.removePickup(e.id); break;
      case 'ammo': { const s = Game.byId(e.s), L = Game.local; if (s && L && L.alive && L.team === s.team && dist2(L.pos.x, L.pos.z, s.pos.x, s.pos.z) < 6) { for (const id in L.ammo) { const w = WEAPONS[id]; L.ammo[id].res = Math.min(w.reserve * 1.5, L.ammo[id].res + w.mag * 2); } HUD.center('Ammo resupplied', 1); } break; }
    }
  },
  applySpawn(m) {
    const s = Game.byId(m.id); if (!s) return;
    s.alive = true; s.hp = 100; s.deadT = 0; s.vehicle = null; s.blind = 0;
    s.pos.set(m.p[0], m.p[1], m.p[2]); s.net.tx = m.p[0]; s.net.ty = m.p[1]; s.net.tz = m.p[2]; s.yaw = s.net.tyaw = m.yaw; s.pitch = 0;
    if (s.model) { s.model.userData.body.rotation.x = 0; s.model.userData.body.position.y = 0; }
    if (s === Game.local) {
      const L = m.lo; s.weapons = L.w; s.ammo = {}; for (const k in L.w) if (L.w[k]) s.fillAmmo(L.w[k]); s.nades = L.n; s.meds = L.md || 0; s.armor = L.ar; s.helmet = L.hm; s.kit = L.kit; s.cls = L.cls; s.medkits = L.mk || 0; s.ammoBoxes = L.ab || 0;
      s.cur = Sandbox.on ? 'physgun' : s.bestWeapon(); s.drawT = 0.4; s.vel.set(0, 0, 0); s.respawnT = null; s.planting = null;
      HUD.showDeploy(false); HUD.onSpawn();
    }
  },
  applyRound(m) {
    if (m.k === 'start') {
      Game.nades.forEach(n => Game.scene.remove(n.mesh)); Game.nades = []; FX.smokes.forEach(s => s.sprites.forEach(sp => Game.scene.remove(sp))); FX.smokes = [];
      Game.bomb = { state: 'carried', carrier: m.bc }; Game.bombModel(false); Game.round = { phase: 'freeze', t: m.fr, timeLeft: Game.mode.roundTime, num: m.n };
      if (m.teams) m.teams.forEach(([id, team]) => { const s = Game.byId(id); if (s && s.team !== team) { s.team = team; s.buildModel(Game.scene); } });
      HUD.onRoundStart();
    }
    if (m.k === 'end') { Game.round.phase = 'over'; Game.announce(m.winner, m.text, Game.byId(m.mvp)); }
    if (m.k === 'match') Game.finishMatch(m.winner);
  },
  interp(s, dt) {
    const n = s.net, k = 1 - Math.exp(-dt * 14);
    if (s.vehicle) { s.pos.copy(s.vehicle.pos); }
    else {
      const px = s.pos.x, pz = s.pos.z;
      if (Math.hypot(n.tx - s.pos.x, n.tz - s.pos.z) > 6) s.pos.set(n.tx, n.ty, n.tz);
      else { s.pos.x = lerp(s.pos.x, n.tx, k); s.pos.y = lerp(s.pos.y, n.ty, k); s.pos.z = lerp(s.pos.z, n.tz, k); }
      if (dt > 0) { s.vel.x = (s.pos.x - px) / dt; s.vel.z = (s.pos.z - pz) / dt; }
      s.walkPhase += Math.hypot(s.vel.x, s.vel.z) * dt * 1.7;
    }
    s.yaw = angWrap(s.yaw + angDiff(s.yaw, n.tyaw) * k); s.pitch = lerp(s.pitch, n.tpitch, k);
  },
  interpVehicle(v, dt) {
    const n = v.net; if (!n) return; const k = 1 - Math.exp(-dt * 12);
    v.pos.x = lerp(v.pos.x, n.x, k); v.pos.y = lerp(v.pos.y, n.y, k); v.pos.z = lerp(v.pos.z, n.z, k); v.yaw = angWrap(v.yaw + angDiff(v.yaw, n.yaw) * k); v.speed = n.sp;
    v.model.position.copy(v.pos); v.model.rotation.y = v.yaw; v.model.userData.wheels.forEach(w => w.rotation.x += v.speed * dt / 0.42);
  },

  /* ── hooks called by the game ── */
  shotsOut: [],
  shot(s, end) {
    if (this.role === 'host') { if (s.ctrl !== 'remote') this.shotsOut.push([s.id, +end.x.toFixed(2), +end.y.toFixed(2), +end.z.toFixed(2)]); }
    else if (this.role === 'client' && s.ctrl === 'local') this.send({ t: 'fire', e: [+end.x.toFixed(2), +end.y.toFixed(2), +end.z.toFixed(2)], w: s.cur });
  },
  nade(n) {
    const msg = { t: 'nade', ty: n.type, p: [n.pos.x, n.pos.y, n.pos.z], v: [n.vel.x, n.vel.y, n.vel.z], o: n.owner.id, id: n.id };
    if (this.role === 'host') this.toAll(msg); else if (this.role === 'client') this.send(msg);
  },
  rocket(s, p, d, w) { const msg = { t: 'rkt', p: [p.x, p.y, p.z], d: [d.x, d.y, d.z], o: s.id, w }; if (this.role === 'host') this.toAll(msg); else if (this.role === 'client') this.send(msg); },
  event(e) { if (this.role === 'host') this.toAll({ t: 'ev', e }); },
  radio(team, from, text) { if (this.role !== 'host') return; for (const p of this.peers.values()) { const s = Game.byId(p.sid); if (s && s.team === team) this.to(p.id, { t: 'radio', f: from, x: text }); } },
  onDamage(v, hp, att, zone) { if (this.role !== 'host' || v.ctrl !== 'remote') return; const p = this.peerOf(v.id); if (p) this.to(p.id, { t: 'dmg', hp: v.hp, ar: v.armor, d: hp, a: att ? [att.pos.x, att.pos.z] : null }); },
  onSpawn(s) {
    if (this.role !== 'host') return;
    const lo = { w: s.weapons, n: s.nades, md: s.meds, ar: s.armor, hm: s.helmet, kit: s.kit, cls: s.cls, mk: s.medkits, ab: s.ammoBoxes };
    this.toAll({ t: 'spawn', id: s.id, p: [+s.pos.x.toFixed(2), +s.pos.y.toFixed(2), +s.pos.z.toFixed(2)], yaw: s.yaw, lo });
  },
  broadcastRound(k, data = {}) {
    if (this.role !== 'host') return;
    if (k === 'start') { this.toAll({ t: 'round', k, bc: Game.bomb.carrier, fr: Game.round.t, n: Game.roundNum, teams: Game.soldiers.map(s => [s.id, s.team]) }); Game.soldiers.forEach(s => this.onSpawn(s)); }
    else this.toAll(Object.assign({ t: 'round', k }, data));
  },
  broadcastRoster() { },
  vehicleSeat(v) { const m = { t: 'seat', id: v.id, d: v.driver ? v.driver.id : null, p: v.passenger ? v.passenger.id : null }; if (this.role === 'host') this.toAll(m); else if (this.role === 'client') this.send(m); },
  syncHp() { },
  chat(text) {
    const L = Game.local; if (!L) return;
    HUD.chat(L.name, text, L.team);
    if (this.role === 'host') this.toAll({ t: 'chat', n: L.name, x: text, team: L.team }); else this.send({ t: 'chat', x: text });
  },

  /* ── periodic sends ── */
  update(dt) {
    if (this.role === 'off' || !Game.running) return;
    const L = Game.local;
    if (this.role === 'client') {
      this.sendT -= dt;
      if (this.sendT <= 0 && L) {
        this.sendT = 1 / 20;
        const m = { t: 'st', p: [+L.pos.x.toFixed(2), +L.pos.y.toFixed(2), +L.pos.z.toFixed(2)], v: [+L.vel.x.toFixed(1), +L.vel.y.toFixed(1), +L.vel.z.toFixed(1)], y: +L.yaw.toFixed(3), pi: +L.pitch.toFixed(3), c: +L.crouch.toFixed(2), w: L.cur, a: L.ads ? 1 : 0 };
        if (L.vehicle && L.vehicle.driver === L) { const v = L.vehicle; m.veh = [+v.pos.x.toFixed(2), +v.pos.y.toFixed(2), +v.pos.z.toFixed(2), +v.yaw.toFixed(3), +v.speed.toFixed(2)]; }
        this.send(m);
      }
      if (performance.now() - this.lastHost > 8000 && this.link && !this.link.conn) this.hostGone();
      return;
    }
    // host snapshot
    this.snapT -= dt; if (this.snapT > 0 || !this.peers.size) return;
    this.snapT = 1 / 15;
    const s = Game.soldiers.map(o => [o.id, +o.pos.x.toFixed(2), +o.pos.y.toFixed(2), +o.pos.z.toFixed(2), +o.yaw.toFixed(3), +o.pitch.toFixed(3), +o.crouch.toFixed(2), Math.round(o.hp), Math.round(o.armor), o.alive ? 1 : 0, o.cur, o.money,
      (o.helmet ? 1 : 0) | ((o.spotT || 0) > Game.now ? 2 : 0) | ((o.spotCT || 0) > Game.now ? 4 : 0) | (o.planting ? 8 : 0)]);
    const g = {};
    const R = Game.round; if (R && Game.mode.id === 'defuse') g.r = [R.phase, +R.timeLeft.toFixed(1), +(R.t || 0).toFixed(1), Game.roundNum, Game.score.T, Game.score.CT];
    if (Game.mode.id === 'defuse') { const B = Game.bomb; g.b = [B.state, B.carrier, B.pos ? [+B.pos.x.toFixed(2), +B.pos.y.toFixed(2), +B.pos.z.toFixed(2)] : null, +(B.timer || 0).toFixed(1), B.site, B.defuser, +(B.progress || 0).toFixed(2), B.progressMax || 10]; }
    if (Game.mode.id === 'conquest') { g.tk = [Math.ceil(Game.tickets.T), Math.ceil(Game.tickets.CT)]; g.f = World.flags.map(f => [+f.prog.toFixed(3), f.owner, f.contested ? 1 : 0]); }
    if (Game.mode.id === 'tdm') g.td = [Game.tdm.kills.T, Game.tdm.kills.CT, Math.round(Game.tdm.timeLeft)];
    if (Game.vehicles.length) g.v = Game.vehicles.map(v => [v.id, +v.pos.x.toFixed(2), +v.pos.y.toFixed(2), +v.pos.z.toFixed(2), +v.yaw.toFixed(3), +v.speed.toFixed(2), Math.round(v.hp), v.alive ? 1 : 0]);
    let props;
    if (Sandbox.on) { this.propFull = (this.propFull || 0) - 1; const all = this.propFull <= 0; if (all) this.propFull = 15; props = Phys.props.filter(p => all || (p.body && p.body.sleepState !== CANNON.Body.SLEEPING && !p.frozen)).map(p => [p.id, +p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), +p.q.x.toFixed(4), +p.q.y.toFixed(4), +p.q.z.toFixed(4), +p.q.w.toFixed(4)]); }
    this.toAll({ t: 'snap', s, g, sh: this.shotsOut.splice(0), p: props });
  },
};
