/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Parachutes and HALO jumps.
   · Jumping out of a helicopter or jet in the air now drops you from where
     it was (you used to land on the ground below). Press Space while
     falling to open your parachute; it opens by itself close to the
     ground. WASD steers it. Falling all the way without one is fatal.
   · HALO jump: a deploy option in Conquest and Breakthrough that drops you
     from 130 m over the fight. Some bots do it too.
   · Anything falling from high up (a roof, a cliff, a jet) can use it.
   ═══════════════════════════════════════════════════════════════════════════ */
const CHUTE = { fall: 4.2, glide: 8, auto: 16, botOpen: 45, minOpen: 6, terminal: 55 };
function agl(s) { return s.pos.y - topBelow(s.pos.x, s.pos.z, s.pos.y + 0.1); }
const Chute = {
  /* the canopy on a soldier's model */
  model(s) {
    const u = s.model && s.model.userData; if (!u) return null;
    if (u.chute) return u.chute;
    const g = new THREE.Group(), col = new THREE.Color(TEAM_STYLE[s.team] ? TEAM_STYLE[s.team].color : '#6a7a5a').lerp(new THREE.Color('#6a6a5a'), 0.4);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 6, 0, TAU, 0, Math.PI * 0.42), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide })); dome.scale.y = 0.55; dome.position.y = 5.2; g.add(dome);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, stripe = new THREE.Mesh(new THREE.SphereGeometry(2.82, 2, 6, a, TAU / 16, 0, Math.PI * 0.42), new THREE.MeshLambertMaterial({ color: col.clone().multiplyScalar(0.7), side: THREE.DoubleSide })); stripe.scale.y = 0.55; stripe.position.y = 5.2; g.add(stripe); }
    const pts = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; pts.push(0, 1.4, 0, Math.cos(a) * 2.3, 5.9, Math.sin(a) * 2.3); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x222222 })));
    g.visible = false; s.model.add(g); u.chute = g; return g;
  },
  open(s, send = true) {
    if (s.chute || !s.alive) return; s.chute = true; s.freefall = false; s.vel.y = Math.max(s.vel.y, -12);
    if (s.ctrl === 'local') { Sfx.play('smoke', s.pos, { vol: 0.8 }); HUD.center('Parachute open · WASD to steer', 1.2); }
    if (send) { if (Net.role === 'host') Net.event({ t: 'chute', id: s.id, on: 1 }); else if (Net.role === 'client' && s.ctrl === 'local') Net.send({ t: 'chute', on: 1 }); }
  },
  close(s) { if (!s.chute) return; s.chute = false; if (Net.role === 'host') Net.event({ t: 'chute', id: s.id, on: 0 }); else if (Net.role === 'client' && s.ctrl === 'local') Net.send({ t: 'chute', on: 0 }); },
};
/* movement: glide under the canopy, a terminal speed in free fall */
const _move51 = Soldier.prototype.move;
Soldier.prototype.move = function (dt) {
  if (this.noclip || !this.alive || this.vehicle) return _move51.call(this, dt);
  if (this.chute) {
    const m = this.moveIn, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), f = (m.f || 0) * CHUTE.glide + 2, st = (m.s || 0) * CHUTE.glide * 0.6;
    const wx = -sy * f + cy * st, wz = -cy * f - sy * st, k = 1 - Math.exp(-dt * 1.6);
    this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k;
    this.vel.y = Math.max(this.vel.y, -CHUTE.fall) + PHYS.gravity * dt * 0.97;   // gravity (applied inside) is almost cancelled
    const mj = m.jump; m.jump = false; const r = _move51.call(this, dt); m.jump = mj;
    if (this.grounded) Chute.close(this);
    return r;
  }
  const r = _move51.call(this, dt);
  if (!this.grounded && this.vel.y < -CHUTE.terminal) this.vel.y = -CHUTE.terminal;
  return r;
};
/* free fall: open with Space; opens itself low down. Bots open early */
const Freefall = {
  update(dt) {
    for (const s of Game.soldiers) {
      if (!s.alive || s.vehicle || s.chute || s.grounded || s.noclip || s.vel.y > -7) { if (s.grounded) s.freefall = false; continue; }
      const own = s.ctrl === 'local' || (s.ctrl === 'bot' && Game.authority()); if (!own) continue;
      const h = agl(s); if (h < 3) continue;
      if (h > 22) s.freefall = true;
      if (s.ctrl === 'bot') { if (h < CHUTE.botOpen || s.vel.y < -40 && h < 70) Chute.open(s); continue; }
      if (s.freefall && h < CHUTE.auto) { Chute.open(s); continue; }
      if (s.freefall) HUD.center(`Free fall · ${Math.round(h)} m · Space opens your parachute`, 0.2);
    }
  },
};
const _pc51 = Player.controls.bind(Player);
Player.controls = function (s, dt) {
  const falling = s.alive && !s.vehicle && !s.chute && !s.grounded && s.vel.y < -6 && agl(s) > CHUTE.minOpen;
  if (falling && Input.hit('Space')) Chute.open(s);
  return _pc51(s, dt);
};
/* bailing out of aircraft keeps your height and speed */
const _exit51 = Game.exitVehicle.bind(Game);
Game.exitVehicle = function (s, forced) {
  const v = s.vehicle, air = v && v.K && (v.K.type === 'heli' || v.K.type === 'jet'), h = air ? v.pos.y - topBelow(v.pos.x, v.pos.z, v.pos.y) : 0;
  const r = _exit51(s, forced);
  if (air && h > 5 && s.alive) {
    const side = v.passenger === s ? -1 : 1, ox = Math.cos(v.yaw) * 2.4 * side, oz = -Math.sin(v.yaw) * 2.4 * side;
    s.pos.set(v.pos.x + ox, v.pos.y - 0.6, v.pos.z + oz); s.grounded = false;
    const vv = v.vel || new V3(), hs = Math.hypot(vv.x, vv.z), k = hs > 30 ? 30 / hs : 1; s.vel.set(vv.x * k, Math.min(vv.y, 2), vv.z * k);
    s.freefall = true; s.spawnProt = Math.max(s.spawnProt || 0, Game.now + 0.5);
    if (s.ctrl === 'local') HUD.center('Bailed out! Space to open your parachute', 1.5);
  }
  return r;
};
/* model: canopy, arms up on the risers, spread-eagle in free fall */
const _sync51 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) {
  const r = _sync51.call(this, dt, localTeam, viewer);
  const u = this.model && this.model.userData; if (!u) return r;
  const want = !!(this.alive && this.chute && !this.vehicle);
  if (want || u.chute) { const c = Chute.model(this); if (c) { c.visible = want && this.model.visible; if (want) { c.rotation.z = Math.sin(Game.now * 1.3) * 0.06; c.rotation.x = Math.cos(Game.now * 1.1) * 0.05; } } }
  if (!this.alive || !this.model.visible || this.vehicle) return r;
  if (this.chute) { u.arms.rotation.x = -2.4; if (u.gunMount) u.gunMount.visible = false; u.legL.rotation.x = 0.25; u.legR.rotation.x = 0.1; }
  else if (this.freefall && !this.grounded) { u.body.rotation.x = -1.2; u.arms.rotation.x = -1.8; u.legL.rotation.x = -0.3; u.legR.rotation.x = -0.3; if (u.gunMount) u.gunMount.visible = false; }
  else if (u.gunMount && !this.emote && !this.downed && u.gunMount.visible === false && this.team !== 'Z') u.gunMount.visible = true;
  return r;
};
/* no shooting while hanging on the risers or falling */
const _fire51 = fireWeapon;
fireWeapon = function (s, now, rc) { if (s.chute || (s.freefall && !s.grounded)) return false; return _fire51(s, now, rc); };

/* ── HALO ──────────────────────────────────────────────────────────────── */
const HALO_MODES = new Set(['conquest', 'rush']);
function haloTarget(team) {
  const F = World.flags.filter(f => !f.locked); if (!F.length) return { x: 0, z: 0 };
  const hq = World.hq[team] || { x: 0, z: 0 }, enemy = World.hq[other(team)] || { x: 0, z: 0 };
  const cand = F.filter(f => f.owner !== team); const list = cand.length ? cand : F;
  return list.sort((a, b) => dist2(a.x, a.z, hq.x, hq.z) - dist2(b.x, b.z, hq.x, hq.z))[0] || { x: (hq.x + enemy.x) / 2, z: (hq.z + enemy.z) / 2 };
}
const _respawn51 = Game.respawn.bind(Game);
Game.respawn = function (s, where) {
  const botHalo = !where && s.ctrl === 'bot' && HALO_MODES.has(this.mode.id) && !s.npc && chance(0.07);
  const r = _respawn51(s, where);
  s.chute = false; s.freefall = false;
  if ((where && where.halo) || botHalo) {
    const t = haloTarget(s.team), hq = World.hq[s.team] || { x: 0, z: 0 }, d = Math.hypot(t.x - hq.x, t.z - hq.z) || 1;
    const x = clamp(t.x - (t.x - hq.x) / d * 25 + rand(-18, 18), World.bounds.x0 + 5, World.bounds.x1 - 5), z = clamp(t.z - (t.z - hq.z) / d * 25 + rand(-18, 18), World.bounds.z0 + 5, World.bounds.z1 - 5);
    s.pos.set(x, 130 + topBelow(x, z, 200), z); s.vel.set(0, -2, 0); s.grounded = false; s.freefall = true; s.spawnProt = this.now + 5;
    s.yaw = Math.atan2(-(t.x - x), -(t.z - z));
    if (s.ctrl === 'local') HUD.center('HALO jump · Space to open your parachute', 2);
    Net.onSpawn(s);
  }
  return r;
};
const _deployUpd51 = HUD.updateDeploy.bind(HUD);
HUD.updateDeploy = function () {
  const L = Game.local; _deployUpd51();
  if (!L || !HALO_MODES.has(Game.mode.id)) return;
  const list = $('spawnlist'); if (!list || list.querySelector('[data-k="halo"]')) return;
  const b = document.createElement('button'); b.className = 'btn sp halo' + (this.deployWhere && this.deployWhere.k === 'halo' ? ' sel' : ''); b.dataset.k = 'halo'; b.textContent = 'HALO jump ⤓';
  b.onclick = () => { this.deployWhere = { k: 'halo', where: { halo: 1 } }; list.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); };
  list.appendChild(b);
};
/* network: canopy state */
const _hostData51 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  if (m && m.t === 'chute') { const p = this.peers.get(id), s = p && p.sid && Game.byId(p.sid); if (s) { s.chute = !!m.on; Net.event({ t: 'chute', id: s.id, on: m.on }); } return; }
  return _hostData51(id, m);
};
const _applyEvent51 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) { if (e && e.t === 'chute') { const s = Game.byId(e.id); if (s && s !== Game.local) s.chute = !!e.on; return; } return _applyEvent51(e); };
const _gupdate51 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate51(dt); if (this.running) Freefall.update(dt); };
/* the camera rolls gently under the canopy */
const _cam51 = Player.camera.bind(Player);
Player.camera = function (s, dt) { const r = _cam51(s, dt); if (s && s.alive && s.chute && !s.vehicle) Game.camera.rotation.z = Math.sin(Game.now * 1.3) * 0.03; return r; };
