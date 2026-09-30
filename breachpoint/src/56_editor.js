/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Map editor.
   Play → Map editor. Start from a blank field (small, medium or large) or
   open one of your maps. You fly around (V to walk).
   · LMB places the current piece where you aim; RMB removes what you aim at.
   · Mouse wheel picks the piece, R turns it, Z undoes.
   · Q opens the tool panel: pieces (walls, floors, blocks, stairs, crates,
     sandbags, fences, containers...), texture and colour, and markers:
     Vanta and Aegis spawns, capture flags, vehicles.
   · Save it with a name, then play it: your maps show up in Team
     Deathmatch, Zombies, Royale, Co-op and Sandbox, and in Conquest and
     Breakthrough once they have three flags. In multiplayer the host's
     map is sent to everyone.
   ═══════════════════════════════════════════════════════════════════════════ */
const ED_PIECES = [
  { k: 'wall', name: 'Wall', d: [4, 3, 0.3], tex: 'brick', col: '#b08868' },
  { k: 'wallL', name: 'Long wall', d: [8, 3, 0.3], tex: 'plaster', col: '#d6c29a' },
  { k: 'low', name: 'Low wall', d: [4, 1.1, 0.4], tex: 'concrete', col: '#8e8b84' },
  { k: 'floor', name: 'Floor', d: [4, 0.25, 4], tex: 'concrete', col: '#a8a49c' },
  { k: 'block', name: 'Block', d: [2, 2, 2], tex: 'concrete', col: '#8e8b84' },
  { k: 'pillar', name: 'Pillar', d: [0.6, 3, 0.6], tex: 'concrete', col: '#9a968e' },
  { k: 'stairs', name: 'Stairs', d: [2, 3.2, 4], tex: 'concrete', col: '#bcbcb4', stairs: 8 },
  { k: 'crate', name: 'Crate', d: [1.2, 1.2, 1.2], tex: 'crate', col: '#ffffff' },
  { k: 'crateL', name: 'Big crate', d: [2, 2, 2], tex: 'crate', col: '#e8dcc8' },
  { k: 'sandbag', name: 'Sandbags', d: [2.4, 0.9, 0.8], tex: 'sandbag', col: '#ffffff' },
  { k: 'fence', name: 'Fence', d: [4, 2, 0.12], tex: 'metal', col: '#7a8088' },
  { k: 'container', name: 'Container', d: [6, 2.6, 2.4], tex: 'metal', col: '#8a4a3a' },
  { k: 'platform', name: 'Platform', d: [4, 0.3, 4], tex: 'wood', col: '#ffffff' },
  { k: 'roof', name: 'Roof slab', d: [6, 0.3, 6], tex: 'roof', col: '#ffffff' },
];
const ED_MARKS = [
  { k: 'spT', name: 'Vanta spawn', col: '#e05a3a' }, { k: 'spCT', name: 'Aegis spawn', col: '#3a8ae0' }, { k: 'flag', name: 'Capture flag', col: '#ffd24a' },
  { k: 'v_jeep', name: 'Jeep', col: '#aaa' }, { k: 'v_quad', name: 'Quad', col: '#aaa' }, { k: 'v_truck', name: 'Truck', col: '#aaa' }, { k: 'v_tank', name: 'Tank', col: '#aaa' }, { k: 'v_heli', name: 'Helicopter', col: '#aaa' }, { k: 'v_aa', name: 'AA truck', col: '#aaa' },
];
const ED_TEX = ['brick', 'plaster', 'concrete', 'metal', 'wood', 'crate', 'sandbag', 'rock', 'roof', 'sand', 'grass', 'dirt'];
const ED_GROUND = { grass: ['grass', '#6b8a44'], sand: ['sand', '#c9ae7c'], concrete: ['concrete', '#6a6a66'], dirt: ['dirt', '#7a6448'], snow: ['concrete', '#e8ecf0'] };
const FLAG_NAMES = 'ABCDEFGH';
/* ── saved maps ─────────────────────────────────────────────────────────── */
const MyMaps = {
  all() { const m = Store.get('bp_maps', {}); return m && typeof m === 'object' ? m : {}; },
  save(d) { const all = this.all(); all[d.id] = d; Store.set('bp_maps', all); this.register(d); },
  del(id) { const all = this.all(); delete all[id]; Store.set('bp_maps', all); this.unregister(id); },
  slug(n) { return 'c_' + (String(n).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'map'); },
  blank(S, name) { return { v: 1, id: '', name: name || 'My map', S, ground: 'grass', boxes: [], sp: { T: [], CT: [] }, flags: [], veh: [] }; },
  /* a map made in the editor, playable like any other */
  build(d, edit) {
    const S = d.S || 60; World.bounds = { x0: -S, z0: -S, x1: S, z1: S };
    const G = ED_GROUND[d.ground] || ED_GROUND.grass; groundPlane(G[0], S * 2 + 80, G[1]);
    for (const [x0, z0, x1, z1] of [[-S - 0.5, -S - 0.5, S + 0.5, -S], [-S - 0.5, S, S + 0.5, S + 0.5], [-S - 0.5, -S, -S, S], [S, -S, S + 0.5, S]]) { const b = World.add(x0, 0, z0, x1, 4, z1, 'metal', '#5a6068'); b.noDestroy = true; }
    for (const r of d.boxes) { const b = World.add(r[0], r[1], r[2], r[3], r[4], r[5], r[6] || 'concrete', r[7] || '#ffffff'); if (edit) b.edRec = r; }
    const sp = t => (d.sp && d.sp[t] || []).map(p => ({ x: p[0], z: p[1], yaw: p[2] || 0 }));
    World.spawns.T = sp('T'); World.spawns.CT = sp('CT');
    if (!World.spawns.T.length) for (let i = 0; i < 8; i++) World.spawns.T.push({ x: -7 + i * 2, z: -S + 6, yaw: Math.PI });
    if (!World.spawns.CT.length) for (let i = 0; i < 8; i++) World.spawns.CT.push({ x: -7 + i * 2, z: S - 6, yaw: 0 });
    for (const t of ['T', 'CT']) { const P = World.spawns[t]; World.hq[t] = { x: P.reduce((a, p) => a + p.x, 0) / P.length, z: P.reduce((a, p) => a + p.z, 0) / P.length }; World.zones.push({ name: t === 'T' ? 'Vanta base' : 'Aegis base', x0: World.hq[t].x - 12, z0: World.hq[t].z - 12, x1: World.hq[t].x + 12, z1: World.hq[t].z + 12 }); }
    (d.flags || []).forEach((f, i) => { const n = FLAG_NAMES[i] || String(i + 1); World.flags.push({ name: n, label: 'Point ' + n, x: f[0], z: f[1], owner: null, prog: 0, radius: 10 }); World.zones.push({ name: 'Point ' + n, x0: f[0] - 14, z0: f[1] - 14, x1: f[0] + 14, z1: f[1] + 14 }); });
    for (const v of d.veh || []) if (VKIND[v[4]]) World.vehicleSpawns.push({ team: v[0], x: v[1], z: v[2], yaw: v[3] || 0, kind: v[4] });
    World.skyColor = 0x9ec4e8; World.fog = [0xcfdce6, 90, 420]; World.sun = 0xfff4e0;
  },
  register(d) {
    MAPS[d.id] = { name: d.name, desc: `Your map · ${d.boxes.length} pieces`, custom: true, build: () => { const ed = Editor.on() && Editor.data && Editor.data.id === d.id; this.build(ed ? Editor.data : d, ed); } };
    const add = m => { if (MODES[m] && !MODES[m].maps.includes(d.id)) MODES[m].maps.push(d.id); }, rm = m => { if (MODES[m]) MODES[m].maps = MODES[m].maps.filter(x => x !== d.id); };
    ['tdm', 'zombies', 'royale', 'coop', 'sandbox', 'editor'].forEach(add);
    for (const m of ['conquest', 'rush']) (d.flags && d.flags.length >= 3 ? add : rm)(m);
  },
  unregister(id) { delete MAPS[id]; for (const m in MODES) if (MODES[m].maps) MODES[m].maps = MODES[m].maps.filter(x => x !== id); },
};
MODES.editor = { id: 'editor', name: 'Map editor', headMult: 1, armor: false, teamSize: 0, respawn: true, respawnTime: 1, regen: true, sprint: true, noTeam: true, sizes: [], maps: ['e_small', 'e_medium', 'e_large'], desc: 'Build your own maps' };
MODE_ORDER.push('editor'); MODE_BLURB.editor = 'Build your own maps and play them';
for (const [k, S, n] of [['e_small', 50, 'New map · small'], ['e_medium', 80, 'New map · medium'], ['e_large', 120, 'New map · large']]) MAPS[k] = { name: n, desc: `${S * 2} m square, empty`, build: () => MyMaps.build(Editor.data || MyMaps.blank(S), true), blankS: S };
PLAY_OPTS.push({ key: 'edground', label: 'Ground', show: c => c.mode === 'editor' && MAPS[c.map] && MAPS[c.map].blankS, opts: () => Object.keys(ED_GROUND).map(k => [k, k[0].toUpperCase() + k.slice(1)]), def: 'grass' });
for (const d of Object.values(MyMaps.all())) try { MyMaps.register(d); } catch (e) { }

/* ── the editor ────────────────────────────────────────────────────────── */
const Editor = {
  data: null, piece: 0, rot: 0, tex: null, col: null, mark: null, team: 'T', undo: [], ghost: null, marks: [], open: false, dirty: false,
  on() { return !!(Game.mode && Game.mode.id === 'editor'); },
  begin(cfg) {
    const M = MAPS[cfg.map];
    if (M && M.custom) { const d = MyMaps.all()[cfg.map]; this.data = JSON.parse(JSON.stringify(d)); }
    else this.data = Object.assign(MyMaps.blank(M && M.blankS || 60), { ground: cfg.edground || 'grass' });
    this.undo = []; this.marks = []; this.dirty = false;
  },
  /* after the map is built: markers, ghost, you */
  setup() {
    const L = Game.local; this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x6aff8a, transparent: true, opacity: 0.35, depthWrite: false }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x6aff8a })); this.ghost.add(edges); Game.scene.add(this.ghost);
    for (const t of ['T', 'CT']) for (const p of this.data.sp[t]) this.addMarkMesh(t === 'T' ? 'spT' : 'spCT', p);
    for (const f of this.data.flags) this.addMarkMesh('flag', f);
    for (const v of this.data.veh) this.addMarkMesh('v_' + v[4], v);
    if (L) { Game.respawn(L); L.noclip = true; L.pos.set(0, 8, this.data.S * 0.6); L.pitch = -0.35; L.weapons = { 1: null, 2: null, 3: 'knife', 4: null }; L.cur = 'knife'; }
    HUD.showDeploy(false);
    setTimeout(() => { if (this.on() && Game.running) HUD.center('MAP EDITOR · Q tools · LMB place · RMB remove · wheel piece · R turn · Z undo · V fly/walk', 4); }, 600);
  },
  cur() { return ED_PIECES[this.piece]; },
  dims() { const P = this.cur(), d = P.d.slice(); if (this.rot % 2) { const t = d[0]; d[0] = d[2]; d[2] = t; } return d; },
  snap(v) { return Math.round(v * 2) / 2; },
  /* where the piece would go */
  aim() {
    const cam = Game.camera, o = cam.position, d = cam.getWorldDirection(new V3());
    let t = World.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 250), n = new V3(World.hit.nx, World.hit.ny, World.hit.nz), box = t >= 0 ? World.hit.box : null;
    if (t < 0 || (d.y < 0 && o.y / -d.y < t)) { if (d.y >= -0.01) return null; t = o.y / -d.y; n.set(0, 1, 0); box = null; }
    return { p: o.clone().addScaledVector(d, t), n, box, t };
  },
  placement(a) {
    const [w, h, dd] = this.dims(), p = a.p, n = a.n; let cx, cz, y0;
    if (n.y > 0.5) { cx = this.snap(p.x); cz = this.snap(p.z); y0 = +p.y.toFixed(2); }
    else if (n.y < -0.5) { cx = this.snap(p.x); cz = this.snap(p.z); y0 = +(p.y - h).toFixed(2); }
    else { cx = Math.abs(n.x) > 0.5 ? p.x + n.x * w / 2 : this.snap(p.x); cz = Math.abs(n.z) > 0.5 ? p.z + n.z * dd / 2 : this.snap(p.z); y0 = a.box ? a.box.y0 : Math.max(0, Math.floor(p.y)); }
    return { x0: cx - w / 2, y0: Math.max(0, y0), z0: cz - dd / 2, x1: cx + w / 2, y1: Math.max(0, y0) + h, z1: cz + dd / 2 };
  },
  place(a) {
    const P = this.cur(), B = this.placement(a), S = this.data.S, tex = this.tex || P.tex, col = this.col || P.col, group = [];
    if (B.x1 < -S || B.x0 > S || B.z1 < -S || B.z0 > S) return;
    if (P.stairs) {
      const n = P.stairs, along = this.rot % 4, W = B.x1 - B.x0, D = B.z1 - B.z0, H = B.y1 - B.y0;
      for (let i = 0; i < n; i++) {
        const top = B.y0 + H * (i + 1) / n; let r;
        if (along === 0) r = [B.x0, B.y0, B.z1 - D * (i + 1) / n, B.x1, top, B.z1 - D * i / n];
        else if (along === 2) r = [B.x0, B.y0, B.z0 + D * i / n, B.x1, top, B.z0 + D * (i + 1) / n];
        else if (along === 1) r = [B.x1 - W * (i + 1) / n, B.y0, B.z0, B.x1 - W * i / n, top, B.z1];
        else r = [B.x0 + W * i / n, B.y0, B.z0, B.x0 + W * (i + 1) / n, top, B.z1];
        group.push(this.addBox(r.map(v => +v.toFixed(2)).concat([tex, col])));
      }
    } else group.push(this.addBox([B.x0, B.y0, B.z0, B.x1, B.y1, B.z1].map(v => +v.toFixed(2)).concat([tex, col])));
    this.undo.push({ kind: 'boxes', list: group }); this.dirty = true; Sfx.play('buy');
  },
  addBox(r) { this.data.boxes.push(r); const b = World.add(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]); b.edRec = r; Destruct.live(b); return b; },
  removeBox(b) { const i = this.data.boxes.indexOf(b.edRec); if (i >= 0) this.data.boxes.splice(i, 1); Destruct.remove(b, true); this.dirty = true; },
  /* markers */
  addMarkMesh(k, rec) {
    const M = ED_MARKS.find(m => m.k === k) || ED_MARKS[0], g = new THREE.Group(), vk = k.startsWith('v_') ? k.slice(2) : null;
    const col = vk ? TEAM_STYLE[rec[0]] ? TEAM_STYLE[rec[0]].color : '#aaa' : M.col;
    g.add(cyl(0.06, 2.6, lam('#dddddd'), 0, 1.3, 0, 6));
    if (k === 'flag') { const c = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); c.position.set(0.6, 2.2, 0); g.add(c); const ring = new THREE.Mesh(new THREE.RingGeometry(9.6, 10, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring); }
    else if (vk) { const K = VKIND[vk]; g.add(bx((K && K.br || 1.2) * 2, 0.9, (K && K.br || 1.2) * 3, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4 }), 0, 0.45, 0)); }
    else { const s = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 10), new THREE.MeshBasicMaterial({ color: col })); s.rotation.x = Math.PI; s.position.y = 1.2; g.add(s); const ar = bx(0.12, 0.05, 0.9, new THREE.MeshBasicMaterial({ color: col }), 0, 0.05, -0.45); g.add(ar); }
    const x = vk ? rec[1] : rec[0], z = vk ? rec[2] : rec[1], yaw = vk ? rec[3] : rec[2] || 0;
    g.position.set(x, topBelow(x, z, 60), z); g.rotation.y = yaw || 0; Game.scene.add(g);
    const m = { k, rec, mesh: g, x, z }; this.marks.push(m); return m;
  },
  placeMark(a) {
    const k = this.mark, L = Game.local, yaw = Math.round((L ? L.yaw : 0) / (Math.PI / 4)) * (Math.PI / 4), x = +a.p.x.toFixed(1), z = +a.p.z.toFixed(1);
    if (Math.abs(x) > this.data.S - 1 || Math.abs(z) > this.data.S - 1) return;
    let rec;
    if (k === 'spT' || k === 'spCT') { rec = [x, z, +yaw.toFixed(2)]; this.data.sp[k === 'spT' ? 'T' : 'CT'].push(rec); }
    else if (k === 'flag') { if (this.data.flags.length >= FLAG_NAMES.length) { HUD.center('Eight flags at most', 1); return; } rec = [x, z]; this.data.flags.push(rec); }
    else { rec = [this.team, x, z, +yaw.toFixed(2), k.slice(2)]; this.data.veh.push(rec); }
    const m = this.addMarkMesh(k, rec); this.undo.push({ kind: 'mark', m }); this.dirty = true; Sfx.play('buy');
  },
  removeMark(m) {
    for (const arr of [this.data.sp.T, this.data.sp.CT, this.data.flags, this.data.veh]) { const i = arr.indexOf(m.rec); if (i >= 0) arr.splice(i, 1); }
    if (m.mesh.parent) m.mesh.parent.remove(m.mesh); this.marks = this.marks.filter(x => x !== m); this.dirty = true;
  },
  del(a) {
    const near = this.marks.filter(m => Math.hypot(m.x - a.p.x, m.z - a.p.z) < 1.6).sort((p, q) => Math.hypot(p.x - a.p.x, p.z - a.p.z) - Math.hypot(q.x - a.p.x, q.z - a.p.z))[0];
    if (near) { this.removeMark(near); Sfx.play('ui'); return; }
    if (a.box && a.box.edRec) { this.removeBox(a.box); Sfx.play('ui'); }
  },
  undoLast() {
    const u = this.undo.pop(); if (!u) return;
    if (u.kind === 'boxes') for (const b of u.list) if (!b.gone) this.removeBox(b);
    if (u.kind === 'mark') this.removeMark(u.m);
  },
  update(dt) {
    if (!this.on() || !Game.running || !this.ghost) return;
    const a = !this.open && this.aim();
    if (!a) { this.ghost.visible = false; return; }
    if (this.mark) { this.ghost.visible = true; this.ghost.scale.set(0.8, 2.6, 0.8); this.ghost.position.set(a.p.x, a.p.y + 1.3, a.p.z); return; }
    const B = this.placement(a); this.ghost.visible = true;
    this.ghost.scale.set(B.x1 - B.x0, B.y1 - B.y0, B.z1 - B.z0); this.ghost.position.set((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2);
  },
  /* ── the tool panel ── */
  panel(on) {
    this.open = on; let el = document.getElementById('edPanel');
    if (!on) { if (el) el.classList.add('hidden'); UI.lock(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'edPanel'; document.body.appendChild(el); }
    el.classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock();
    const D = this.data, sw = c => `<button class="edsw ${this.col === c ? 'on' : ''}" data-col="${c}" style="background:${c}"></button>`;
    el.innerHTML = `<div class="edbox"><div class="edhead"><b>Map editor</b><input id="edName" maxlength="24" value="${escapeHtml(D.name)}"><span class="muted">${D.boxes.length} pieces · ${D.sp.T.length}/${D.sp.CT.length} spawns · ${D.flags.length} flags · ${D.veh.length} vehicles</span></div>
      <h4>Pieces</h4><div class="edgrid">${ED_PIECES.map((p, i) => `<button class="edp ${!this.mark && this.piece === i ? 'on' : ''}" data-p="${i}">${p.name}<small>${p.d.join('×')}</small></button>`).join('')}</div>
      <h4>Texture</h4><div class="edgrid">${['', ...ED_TEX].map(t => `<button class="edt ${(this.tex || '') === t ? 'on' : ''}" data-tex="${t}">${t || 'piece default'}</button>`).join('')}</div>
      <h4>Colour</h4><div class="edcols"><button class="edsw ${!this.col ? 'on' : ''}" data-col="">·</button>${['#ffffff', '#b08868', '#d6c29a', '#8e8b84', '#5a6068', '#8a4a3a', '#4a5a3a', '#3a4a6a', '#c8a070', '#2a2a2a', '#e8e0d0', '#7a2a2a'].map(sw).join('')}</div>
      <h4>Markers <span class="muted">vehicles for</span> <select id="edTeam"><option value="T" ${this.team === 'T' ? 'selected' : ''}>Vanta</option><option value="CT" ${this.team === 'CT' ? 'selected' : ''}>Aegis</option></select></h4>
      <div class="edgrid">${ED_MARKS.map(m => `<button class="edm ${this.mark === m.k ? 'on' : ''}" data-m="${m.k}" style="--mc:${m.col}">${m.name}</button>`).join('')}</div>
      <div class="edrow"><button class="btn" id="edSave">Save</button><button class="btn" id="edPlay">Save & play (TDM)</button><button class="btn ghost" id="edClose">Back to building (Q)</button><button class="btn ghost danger" id="edDelete">Delete map</button><button class="btn ghost" id="edExit">Exit editor</button></div>
      <p class="muted small">Your maps appear in Team Deathmatch, Zombies, Royale, Co-op and Sandbox, and in Conquest and Breakthrough with 3+ flags. Spawns default to the two ends if you place none.</p></div>`;
    el.querySelectorAll('.edp').forEach(b => b.onclick = () => { this.piece = +b.dataset.p; this.mark = null; this.panel(true); });
    el.querySelectorAll('.edt').forEach(b => b.onclick = () => { this.tex = b.dataset.tex || null; this.panel(true); });
    el.querySelectorAll('.edsw').forEach(b => b.onclick = () => { this.col = b.dataset.col || null; this.panel(true); });
    el.querySelectorAll('.edm').forEach(b => b.onclick = () => { this.mark = b.dataset.m; this.panel(true); });
    el.querySelector('#edTeam').onchange = e => { this.team = e.target.value; };
    el.querySelector('#edName').oninput = e => { D.name = e.target.value.slice(0, 24) || 'My map'; };
    el.querySelector('#edName').onkeydown = e => e.stopPropagation();
    el.querySelector('#edSave').onclick = () => { this.save(); this.panel(true); };
    el.querySelector('#edPlay').onclick = () => { const id = this.save(); if (!id) return; this.panel(false); UI.leaveGame(); Object.assign(UI.playCfg, { mode: 'tdm', map: id, teamSize: 4 }); Store.set('playcfg', UI.playCfg); UI.startSolo(); };
    el.querySelector('#edClose').onclick = () => this.panel(false);
    el.querySelector('#edExit').onclick = () => { if (this.dirty && !confirm('Leave without saving?')) return; this.panel(false); UI.leaveGame(); };
    el.querySelector('#edDelete').onclick = () => { const id = this.data.id; if (!id || !MAPS[id]) { UI.toast('Not saved yet'); return; } if (!confirm(`Delete "${this.data.name}"?`)) return; MyMaps.del(id); this.data.id = ''; UI.toast('Map deleted'); this.panel(true); };
  },
  save() {
    const D = this.data; D.name = (D.name || 'My map').trim().slice(0, 24) || 'My map';
    const id = D.id || MyMaps.slug(D.name); D.id = id;
    try { MyMaps.save(JSON.parse(JSON.stringify(D))); this.dirty = false; UI.toast(`Saved "${D.name}"`); return id; } catch (e) { UI.toast('Could not save: storage full?'); return null; }
  },
};
/* ── hooks ─────────────────────────────────────────────────────────────── */
const _start56 = Game.start.bind(Game);
Game.start = function (cfg) {
  if (MODES[cfg.mode] && MODES[cfg.mode].id === 'editor') Editor.begin(cfg); else Editor.data = null;
  if (cfg.customMap && cfg.customMap.id && (!MAPS[cfg.customMap.id] || MAPS[cfg.customMap.id].placeholder)) MyMaps.register(cfg.customMap);   // multiplayer: the host's map
  const r = _start56(cfg);
  if (Editor.on()) { this.tdm = { kills: { T: 0, CT: 0 }, timeLeft: 0 }; Editor.setup(); }
  return r;
};
const _startCfg56 = Net.startCfgFor.bind(Net);
Net.startCfgFor = function (cfg) { if (cfg && MAPS[cfg.map] && MAPS[cfg.map].custom) cfg.customMap = MyMaps.all()[cfg.map] || null; return _startCfg56(cfg); };
const _showDeploy56 = HUD.showDeploy.bind(HUD);
HUD.showDeploy = function (on) { if (on && Editor.on()) return; return _showDeploy56(on); };
const _pc56 = Player.controls.bind(Player);
Player.controls = function (s, dt) {
  if (!Editor.on()) return _pc56(s, dt);
  const I = Input;
  if (!UI.blocking()) {
    if (I.hit('KeyQ')) { Editor.panel(!Editor.open); I.pressed.KeyQ = false; }
    if (I.hit('KeyV')) { s.noclip = !s.noclip; s.vel.set(0, 0, 0); HUD.center(s.noclip ? 'Flying' : 'Walking', 0.6); }
    if (I.hit('KeyR')) { Editor.rot = (Editor.rot + 1) % 4; I.pressed.KeyR = false; }
    if (I.hit('KeyZ')) { Editor.undoLast(); I.pressed.KeyZ = false; }
    if (I.mouse.wheel) { Editor.mark = null; Editor.piece = (Editor.piece + (I.mouse.wheel > 0 ? 1 : -1) + ED_PIECES.length) % ED_PIECES.length; I.mouse.wheel = 0; HUD.center(Editor.cur().name, 0.6); }
    const a = (I.mouse.leftPressed || I.mouse.rightPressed) && Editor.aim();
    if (a && I.mouse.leftPressed) { if (Editor.mark) Editor.placeMark(a); else Editor.place(a); }
    if (a && I.mouse.rightPressed) Editor.del(a);
    I.mouse.leftPressed = I.mouse.rightPressed = false; I.mouse.left = I.mouse.right = false;
  }
  return _pc56(s, dt);
};
const _fire56 = fireWeapon;
fireWeapon = function (s, now, rc) { if (Editor.on()) return false; return _fire56(s, now, rc); };
const _blocking56 = UI.blocking.bind(UI);
UI.blocking = function () { return _blocking56() || !!(Editor.on() && Editor.open); };
addEventListener('keydown', e => { if (Editor.open && (e.code === 'Escape' || (e.code === 'KeyQ' && e.target.tagName !== 'INPUT'))) { e.preventDefault(); e.stopImmediatePropagation(); Editor.panel(false); } }, true);
const _gupdate56 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate56(dt); Editor.update(dt); };
const _hud56 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hud56(dt); if (!Editor.on()) return; const E = this.el;
  E.timer.textContent = 'EDITOR'; E.timer.classList.remove('bomb', 'freeze'); E.scT.textContent = ''; E.scCT.textContent = '';
  E.rinfo.textContent = `${Editor.mark ? (ED_MARKS.find(m => m.k === Editor.mark) || {}).name : Editor.cur().name}${Editor.rot % 2 ? ' (turned)' : ''} · LMB place · RMB remove · Q tools · wheel piece · R turn · Z undo · V ${Game.local && Game.local.noclip ? 'walk' : 'fly'}${Editor.dirty ? ' · unsaved' : ''}`;
};
/* the Play screen: when editing, the map list is "new" plus your maps */
const _rp56 = UI.render_play;
UI.render_play = function () { MODES.editor.maps = ['e_small', 'e_medium', 'e_large'].concat(Object.keys(MyMaps.all()).filter(id => MAPS[id])); return _rp56.call(this); };
/* no destruction or noise in the editor */
const _dOn56 = Destruct.on.bind(Destruct);
Destruct.on = function () { return !Editor.on() && _dOn56(); };
const _stop56 = Game.stop.bind(Game);
Game.stop = function () { if (Editor.open) Editor.panel(false); return _stop56(); };
/* a client's lobby may name a map it hasn't been sent yet */
const _lobby56 = UI.render_lobby.bind(UI);
UI.render_lobby = function () { const L = Net.lobby; if (L && L.map && !MAPS[L.map]) MAPS[L.map] = { name: "Host's map", desc: '', placeholder: true, build() { buildFlatgrass(); } }; return _lobby56(); };
