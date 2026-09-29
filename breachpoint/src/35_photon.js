/* ═══════════════════════════════════════════════════════════════════════════
   Photon networking.
   Internet play goes through Photon Cloud (Photon Realtime, the JavaScript
   SDK) instead of PeerJS. Everything that crosses the network (lobby, match
   snapshots, sandbox builds, chat, voice-free radio, trading) rides the same
   link, so nothing else in the game had to change.

   · Each game is a Photon room named BP-<code>. The creator is the host and
     stays authoritative, exactly as before.
   · Messages are Photon events (code 1), sent to one actor, or to everyone
     in one go when the host broadcasts.
   · Open rooms are listed in Photon's lobby, so Multiplayer shows a browser
     of games you can click to join.
   · The App ID comes from the build (photon.config.json or PHOTON_APP_ID) or
     from Multiplayer → Photon settings. See PHOTON_SETUP.md.
   local:CODE (same browser) and ws:// (LAN relay) still work offline.
   ═══════════════════════════════════════════════════════════════════════════ */
if (Settings.photonAppId == null) Settings.photonAppId = '';
if (Settings.photonRegion == null) Settings.photonRegion = '';
const PHOTON_REGIONS = [['eu', 'Europe'], ['us', 'USA East'], ['usw', 'USA West'], ['cae', 'Canada East'], ['sa', 'South America'], ['asia', 'Asia (Singapore)'], ['jp', 'Japan'], ['kr', 'South Korea'], ['in', 'India'], ['au', 'Australia'], ['za', 'South Africa'], ['uae', 'UAE'], ['tr', 'Turkey']];
const PhotonNet = {
  cfg() { return window.PHOTON_CONFIG || {}; },
  appId() { return String(Settings.photonAppId || this.cfg().appId || '').trim(); },
  region() { return String(Settings.photonRegion || this.cfg().region || 'eu').toLowerCase(); },
  version() { return this.cfg().appVersion || 'breachpoint-' + VERSION; },   // different game versions never meet
  ok() { return typeof Photon !== 'undefined' && !!Photon.LoadBalancing; },
  client() {
    const LBC = Photon.LoadBalancing.LoadBalancingClient, c = new LBC(Photon.ConnectionProtocol.Wss, this.appId(), this.version());
    try { c.setLogLevel(1); } catch (e) { /* older SDK */ }
    return c;
  },
  errText(code, msg) {
    return ({ 32767: 'Photon rejected the App ID. Check it in Multiplayer → Photon settings (it must be a Photon Realtime / "Multiplayer Game" app).', 32766: 'That room code is already in use, try hosting again.',
      32758: 'No game with that code (it may have ended).', 32765: 'That game is full.', 32764: 'That game is closed.', 32757: 'Photon\'s player limit for this App ID is reached (free apps allow 20 at once).', 32756: 'That Photon region is not available for this App ID.' })[code]
      || (/NameServer|Master|peer error/i.test(msg || '') ? 'Could not reach Photon Cloud. Check your internet connection, and that a firewall is not blocking Photon (it needs outgoing secure websockets, ports 19090-19093).' : 'Photon: ' + (msg || 'error ' + code));
  },
  need() {
    if (!this.ok()) return 'The Photon SDK is missing from this build.';
    if (!this.appId()) return 'Internet play needs a Photon App ID: Multiplayer → Photon settings (see PHOTON_SETUP.md).';
    return null;
  },
};

/* the link: same shape as the old PeerJS one (me, send, close; ready/open/connect/data/close/error) */
Net.photonLink = function (code, isHost, h) {
  const bad = PhotonNet.need(); if (bad) { setTimeout(() => h.error(bad), 0); return null; }
  const LBC = Photon.LoadBalancing.LoadBalancingClient, S = LBC.State, c = PhotonNet.client(), room = 'BP-' + code.toUpperCase();
  let hostNr = 0, done = false, opened = false;
  const link = {
    me: null, photon: c,
    send(to, m) { if (!c.isJoinedToRoom()) return; const nr = to === 'host' ? hostNr : +String(to).replace(/^a/, ''); if (nr) c.raiseEvent(1, m, { targetActors: [nr] }); },
    broadcast(m, except) {
      if (!c.isJoinedToRoom()) return;
      if (!except) { c.raiseEvent(1, m, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others }); return; }
      const ids = [...Net.peers.keys()].filter(id => id !== except).map(id => +String(id).replace(/^a/, '')).filter(Boolean); if (ids.length) c.raiseEvent(1, m, { targetActors: ids });
    },
    close() { done = true; try { c.disconnect(); } catch (e) { /* gone */ } },
  };
  c.onStateChange = st => {
    if (done) return;
    if (st === S.JoinedLobby) {
      if (isHost) {
        const L = Net.lobby || {}; c.createRoom(room, { isVisible: true, isOpen: true, maxPlayers: 16, emptyRoomLiveTime: 0,
          customGameProperties: { n: Settings.name, m: L.mode || '', mp: L.map || '', c: code.toUpperCase() }, propsListedInLobby: ['n', 'm', 'mp', 'c'] });
      } else c.joinRoom(room);
    }
    else if (st === S.Joined) {
      link.me = 'a' + c.myActor().actorNr; Net.myId = isHost ? 'host' : link.me;
      if (isHost) { hostNr = c.myActor().actorNr; Net.photonRegion = PhotonNet.region(); h.ready && h.ready(); }
      else {
        hostNr = c.myRoomMasterActorNr(); c.raiseEvent(1, { t: '_hello' }, { targetActors: [hostNr] });
        link.helloTimer = setTimeout(() => { if (!opened && !done) h.error('The host did not answer.'); }, 9000);
      }
    }
    else if (st === S.Disconnected) { if (isHost) h.error('Lost the connection to Photon.'); else if (opened) h.close(); else h.error('Could not reach Photon (' + PhotonNet.region().toUpperCase() + ').'); }
  };
  c.onEvent = (code, m, actorNr) => {
    if (code !== 1 || !m || done) return;
    if (isHost) { const id = 'a' + actorNr; if (m.t === '_hello') { c.raiseEvent(1, { t: '_welcome' }, { targetActors: [actorNr] }); h.connect(id); return; } h.data(id, m); }
    else { if (actorNr !== hostNr) return; if (m.t === '_welcome') { opened = true; clearTimeout(link.helloTimer); h.open(); return; } h.data(m); }
  };
  c.onActorLeave = actor => { if (done) return; if (isHost) h.close('a' + actor.actorNr); else if (actor.actorNr === hostNr) h.close(); };
  c.onOperationResponse = (err, msg) => { if (err && !done) h.error(PhotonNet.errText(err, msg)); };
  c.onError = (err, msg) => { if (!done) h.error(PhotonNet.errText(err, msg)); };
  // keep the lobby listing (mode, map) current for the room browser
  link.updateListing = () => { try { const r = c.myRoom(), L = Net.lobby || {}; if (isHost && c.isJoinedToRoom()) { r.setCustomProperty('m', L.mode || ''); r.setCustomProperty('mp', L.map || ''); r.setIsOpen && r.setIsOpen(!Game.running || L.mode === 'sandbox' || !!L.dropIn); } } catch (e) { /* cosmetic */ } };
  if (!c.connectToRegionMaster(PhotonNet.region())) { setTimeout(() => h.error('Could not start the Photon connection.'), 0); return null; }
  return link;
};
const _makeLink35 = Net.makeLink.bind(Net);
Net.makeLink = function (code, isHost, handlers) {
  const c = code.trim();
  if (/^local:|^wss?:\/\//i.test(c)) return _makeLink35(c, isHost, handlers);   // same-browser and LAN links as before
  return this.photonLink(c.toUpperCase(), isHost, handlers);
};
/* one Photon event for everyone instead of one per player */
const _toAll35 = Net.toAll.bind(Net);
Net.toAll = function (m, except) { if (this.role === 'host' && this.link && this.link.broadcast) return this.link.broadcast(m, except); return _toAll35(m, except); };
const _pushLobby35 = Net.pushLobby.bind(Net);
Net.pushLobby = function () { const r = _pushLobby35(); if (this.link && this.link.updateListing) this.link.updateListing(); return r; };

/* ── Multiplayer screen: Photon settings and a browser of open games ──── */
const RoomBrowser = {
  c: null, t: 0,
  start() {
    this.stop(); const el = $('mpRooms'); if (!el) return;
    const bad = PhotonNet.need(); if (bad) { el.innerHTML = ''; return; }
    const c = this.c = PhotonNet.client(), S = Photon.LoadBalancing.LoadBalancingClient.State;
    el.innerHTML = '<h3>Open games</h3><p class="muted">Connecting to Photon ' + PhotonNet.region().toUpperCase() + '…</p>';
    const draw = () => {
      if (this.c !== c) return; const rooms = (c.availableRooms() || []).filter(r => r.isOpen !== false && /^BP-/.test(r.name));
      el.innerHTML = `<h3>Open games <small class="muted">Photon ${PhotonNet.region().toUpperCase()}</small></h3>` + (rooms.length ? rooms.map(r => {
        const cp = n => r.getCustomProperty ? r.getCustomProperty(n) : (r._customProperties || {})[n], M = MODES[cp('m')], MP = MAPS[cp('mp')];
        return `<div class="pho-room"><b>${escapeHtml(String(cp('n') || 'Someone'))}'s game</b><span>${M ? M.name : '—'} · ${MP ? MP.name : '—'} · ${r.playerCount}/${r.maxPlayers || 16}</span><button class="btn small" data-code="${escapeHtml(String(cp('c') || r.name.slice(3)))}">Join</button></div>`;
      }).join('') : '<p class="muted">No open games right now. Host one!</p>');
      el.querySelectorAll('[data-code]').forEach(b => b.onclick = () => { this.stop(); UI.openLobby(); Net.join(b.dataset.code); });
    };
    c.onRoomList = draw; c.onRoomListUpdate = draw;
    c.onStateChange = st => { if (st === S.JoinedLobby) draw(); };
    c.onError = (e, m) => { if (this.c === c) el.innerHTML = `<h3>Open games</h3><p class="muted">${escapeHtml(PhotonNet.errText(e, m))}</p>`; };
    c.onOperationResponse = (e, m) => { if (e && this.c === c) el.innerHTML = `<h3>Open games</h3><p class="muted">${escapeHtml(PhotonNet.errText(e, m))}</p>`; };
    c.connectToRegionMaster(PhotonNet.region());
  },
  stop() { if (this.c) { const c = this.c; this.c = null; try { c.disconnect(); } catch (e) { /* gone */ } } },
};
function renderPhotonSettings() {
  const el = $('mpPhoton'); if (!el) return;
  const baked = !!PhotonNet.cfg().appId, id = PhotonNet.appId(), reg = PhotonNet.region();
  el.innerHTML = `<details ${id ? '' : 'open'}><summary>Photon settings <span class="muted">· ${id ? 'App ID set' + (baked && !Settings.photonAppId ? ' (built in)' : '') : 'no App ID yet'} · region ${reg.toUpperCase()}</span></summary>
    <label>App ID <input type="text" id="phoApp" value="${escapeHtml(Settings.photonAppId || '')}" placeholder="${baked ? 'using the built-in App ID' : 'paste your Photon Realtime App ID'}" spellcheck="false"></label>
    <label>Region <select id="phoReg">${PHOTON_REGIONS.map(([k, n]) => `<option value="${k}" ${k === reg ? 'selected' : ''}>${n} (${k})</option>`).join('')}</select></label>
    <p class="muted">Everyone who plays together must use the same App ID and region. Free Photon apps allow 20 players online at once. How to get an App ID: PHOTON_SETUP.md.</p></details>`;
  $('phoApp').onchange = () => { Settings.photonAppId = $('phoApp').value.trim(); saveSettings(); renderPhotonSettings(); RoomBrowser.start(); };
  $('phoReg').onchange = () => { Settings.photonRegion = $('phoReg').value; saveSettings(); renderPhotonSettings(); RoomBrowser.start(); };
}
const _renderMp35 = UI.render_mp.bind(UI);
UI.render_mp = function () { _renderMp35(); renderPhotonSettings(); RoomBrowser.start(); };
const _show35 = UI.show.bind(UI);
UI.show = function (name) { if (name !== 'mp') RoomBrowser.stop(); return _show35(name); };
/* the lobby hint for Photon rooms */
const _renderLobby35 = UI.render_lobby.bind(UI);
UI.render_lobby = function () {
  _renderLobby35(); const code = Net.code || '';
  if (!/^local:|^wss?:/i.test(code) && $('lobbyHint')) $('lobbyHint').textContent = `Friends: Multiplayer → Join → type this code, or pick it from Open games. Photon region ${PhotonNet.region().toUpperCase()}; they must use the same one.`;
};
