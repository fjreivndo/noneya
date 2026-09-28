/* ═══════════════════════════════════════════════════════════════════════════
   Soldiers, weapons in hand, hit detection, grenades, rockets, vehicles.
   A Soldier is the same object whether a person, a bot, or a network puppet
   drives it; only its `ctrl` changes who writes its inputs.
   ═══════════════════════════════════════════════════════════════════════════ */

const PHYS = { gravity: 16, jump: 5.3, walk: 5.2, accel: 55, air: 9, friction: 9, crouchH: 1.25, standH: 1.8, radius: 0.34 };
const isNade = id => id === 'frag' || id === 'flash' || id === 'smoke';

class Soldier {
  constructor(o) {
    this.id = o.id; this.name = o.name; this.team = o.team; this.ctrl = o.ctrl || 'bot';
    this.skins = o.skins || {}; this.isBot = this.ctrl === 'bot' || !!o.isBot;
    this.pos = new V3(); this.vel = new V3(); this.yaw = 0; this.pitch = 0; this.crouch = 0; this.grounded = true;
    this.hp = 100; this.armor = 0; this.helmet = false; this.kit = false; this.alive = false; this.money = 800;
    this.kills = 0; this.deaths = 0; this.assists = 0; this.score = 0; this.dmgBy = {}; this.mvps = 0;
    this.weapons = { 1: null, 2: null, 3: 'knife', 4: null }; this.ammo = {}; this.nades = { frag: 0, flash: 0, smoke: 0 };
    this.attach = o.att || {};
    this.cur = 'knife'; this.last = null; this.fireCd = 0; this.reloadT = 0; this.drawT = 0; this.boltT = 0;
    this.recoilIdx = 0; this.lastShot = -9; this.punchX = 0; this.punchY = 0; this.ads = false; this.adsT = 0;
    this.blind = 0; this.blindMax = 0; this.spottedUntil = 0; this.lastDamage = -9; this.lastHurtDir = 0;
    this.meds = 0; this.healT = 0; this.spin = 0; this.spinT = -9; this.burstLeft = 0;
    this.cls = 'assault'; this.squad = null; this.vehicle = null; this.walkPhase = 0; this.stepT = 0;
    this.moveIn = { f: 0, s: 0, jump: false, crouch: false, walk: false, sprint: false };
    this.model = null; this.tag = null; this.deadT = 0; this.gadgetCd = 0; this.medkits = 0;
    this.net = { tx: 0, ty: 0, tz: 0, tyaw: 0, tpitch: 0 };
  }
  get w() { return this.stat(this.cur); }
  /* this soldier's version of a gun, with their attachments applied */
  stat(id) {
    const b = WEAPONS[id]; if (!b) return null;
    const a = this.attach && this.attach[id], key = attSig(a);
    const c = this._stat || (this._stat = {});
    if (!c[id] || c[id].key !== key) c[id] = { key, w: modWeapon(b, a) };
    return c[id].w;
  }
  get height() { return lerp(PHYS.standH, PHYS.crouchH, this.crouch); }
  get eyeY() { return this.pos.y + this.height - 0.12; }
  eye(out = new V3()) { if (this.vehicle) return this.vehicle.seatPos(out, this); return out.set(this.pos.x, this.eyeY, this.pos.z); }
  forward(out = new V3()) { const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
  maxSpeed() {
    const w = this.w; let s = PHYS.walk * (w ? w.speed : 1);
    if (isNade(this.cur)) s = PHYS.walk * 0.98;
    if (this.crouch > 0.5) s *= 0.36; else if (this.moveIn.walk) s *= 0.52; else if (this.moveIn.sprint && this.moveIn.f > 0 && !this.ads) s *= 1.38;
    if (this.ads) s *= 0.7;
    return s * (this.speedK || 1);
  }
  /* ── inventory ── */
  resetLoadout(side) {
    this.weapons = { 1: null, 2: side === 'T' ? 'glock' : 'p2000', 3: 'knife', 4: null };
    this.ammo = {}; this.nades = { frag: 0, flash: 0, smoke: 0 };
    this.fillAmmo(this.weapons[2]); this.cur = this.weapons[2]; this.drawT = 0.4;
  }
  fillAmmo(id) { const w = this.stat(id); if (w && w.mag) this.ammo[id] = { mag: w.mag, res: w.reserve }; }
  give(id) {
    if (isNade(id)) { this.nades[id] = Math.min(GRENADES[id].max, this.nades[id] + 1); return; }
    const w = WEAPONS[id]; this.weapons[w.slot] = id; this.fillAmmo(id); this.switchTo(id);
  }
  has(id) { return isNade(id) ? this.nades[id] > 0 : Object.values(this.weapons).includes(id); }
  switchTo(id) {
    if (!id || id === this.cur) return;
    if (!isNade(id) && !this.has(id)) return;
    if (isNade(id) && this.nades[id] <= 0) return;
    this.last = this.cur; this.cur = id; this.reloadT = 0; this.boltT = 0; this.ads = false;
    this.drawT = id === 'knife' ? 0.3 : isNade(id) ? 0.35 : (WEAPONS[id].type === 'sniper' ? 0.8 : 0.55);
    this.recoilIdx = 0;
  }
  switchSlot(slot) {
    if (slot === 4) { const order = ['frag', 'flash', 'smoke'], avail = order.filter(n => this.nades[n] > 0); if (!avail.length) return; const i = avail.indexOf(this.cur); this.switchTo(avail[(i + 1) % avail.length]); return; }
    if (slot === 5) { if (this.weapons[4]) this.switchTo(this.weapons[4]); return; }
    if (slot >= 6) { if (this.weapons[slot]) this.switchTo(this.weapons[slot]); return; }
    this.switchTo(this.weapons[slot]);
  }
  bestWeapon() { return this.weapons[1] || this.weapons[2] || 'knife'; }
  startReload() {
    const w = this.w; if (!w || !w.mag) return false; const a = this.ammo[this.cur];
    if (!a || a.mag >= w.mag || a.res <= 0 || this.reloadT > 0) return false;
    this.reloadT = w.reload; this.ads = false; this.recoilIdx = 0;
    if (this.ctrl === 'local' || this.ctrl === 'bot') Sfx.play('reload', this.pos);
    return true;
  }
  /* ── timers, called every frame for local and bot soldiers ── */
  tickWeapon(dt, now) {
    this.fireCd -= dt; this.drawT -= dt; this.boltT -= dt; this.gadgetCd -= dt;
    // minigun barrels spin up while the trigger is held, and wind down after
    const sw = this.w; if (sw && sw.spinup) this.spin = clamp(this.spin + (now - this.spinT < 0.15 ? dt / sw.spinup : -dt / (sw.spinup * 1.5)), 0, 1); else this.spin = 0;
    // medkit: heal over two seconds (the authority owns the real HP)
    if (this.healT > 0) { this.healT -= dt; if (Game.authority()) this.hp = Math.min(100, this.hp + 25 * dt); }
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { const w = this.w, a = this.ammo[this.cur]; if (w && a) { const need = w.mag - a.mag, take = Math.min(need, a.res); a.mag += take; a.res -= take; } }
    }
    const w = this.w;
    if (now - this.lastShot > (w && w.rpm ? 60 / w.rpm * 1.4 : 0.3)) this.recoilIdx = Math.max(0, this.recoilIdx - dt * (w && w.type === 'pistol' ? 10 : 14));
    const target = this.recoilIdx > 0 && w && w.recoil ? recoilPattern(w, Math.floor(this.recoilIdx)) : { x: 0, y: 0 };
    this.punchX = lerp(this.punchX, target.x * 0.45 * DEG, 1 - Math.exp(-dt * 25));
    this.punchY = lerp(this.punchY, target.y * 0.45 * DEG, 1 - Math.exp(-dt * 25));
    this.adsT = lerp(this.adsT, this.ads ? 1 : 0, 1 - Math.exp(-dt * 16));
    if (this.blind > 0) this.blind -= dt;
  }
  spread() {
    const w = this.w; if (!w) return 0;
    let sp = w.type === 'sniper' ? (this.ads && this.adsT > 0.8 ? w.spread : w.hipSpread) : w.spread * (this.ads ? 0.6 : (w.hipK || 1));
    const hs = Math.hypot(this.vel.x, this.vel.z), frac = hs / (PHYS.walk * w.speed);
    if (frac > 0.34) sp += w.moveSpread * Math.pow(frac, 1.4) * (this.ads ? 0.6 : 1);
    if (!this.grounded) sp += 0.14;
    if (this.crouch > 0.5 && this.grounded) sp *= 0.75;
    if (w.type !== 'sniper' && w.type !== 'shotgun') sp += Math.min(this.recoilIdx, 12) * 0.0012 * w.recoil;
    return sp;
  }
  /* ── movement ── */
  move(dt) {
    const m = this.moveIn;
    if (this.noclip) { // fly where you look, through everything
      const f = this.forward(new V3()), r = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), sp = m.sprint ? 30 : 11;
      const v = f.multiplyScalar(m.f).add(r.multiplyScalar(m.s)); if (m.jump) v.y += 1; if (m.crouch) v.y -= 1;
      this.vel.copy(v.multiplyScalar(sp)); this.pos.addScaledVector(this.vel, dt); this.pos.y = Math.max(0, this.pos.y); this.grounded = false; this.crouch = 0; return;
    }
    const wantCrouch = m.crouch ? 1 : 0;
    if (wantCrouch < this.crouch && !World.bodyFree(this.pos.x, this.pos.y, this.pos.z, PHYS.radius, PHYS.standH)) { /* no room to stand */ }
    else this.crouch = lerp(this.crouch, wantCrouch, 1 - Math.exp(-dt * 14));
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * m.f + cy * m.s, wz = -cy * m.f - sy * m.s; const l = Math.hypot(wx, wz); if (l > 1) { wx /= l; wz /= l; }
    const max = this.maxSpeed();
    if (this.grounded) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) { const drop = sp * PHYS.friction * dt; const ns = Math.max(0, sp - Math.max(drop, 0.5 * dt)); this.vel.x *= ns / sp; this.vel.z *= ns / sp; }
      this.accelerate(wx, wz, max, PHYS.accel, dt);
      if (m.jump && this.crouch < 0.5) { this.vel.y = PHYS.jump; this.grounded = false; }
    } else this.accelerate(wx, wz, max, PHYS.air, dt);
    this.vel.y -= PHYS.gravity * dt;
    const r = moveBody(this.pos, this.vel, dt, PHYS.radius, this.height, this.grounded);
    if (r.landed > 7 && this.ctrl !== 'puppet') { const dmg = Math.floor((r.landed - 7) * 9); if (dmg > 0 && Game.authority()) Game.damage(this, dmg, null, 'fall', 'body'); if (this.ctrl === 'local') Sfx.play('land', this.pos); }
    this.grounded = r.grounded;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += hs * dt * 1.7;
    this.stepT -= dt * hs;
    if (this.grounded && this.stepT <= 0 && hs > 3.2 && !m.walk && this.crouch < 0.5) { this.stepT = 2.2; Sfx.play('step', this.pos, { vol: this.ctrl === 'local' ? 0.6 : 1 }); Game.noise(this, 18); }
  }
  accelerate(wx, wz, max, acc, dt) {
    const cur = this.vel.x * wx + this.vel.z * wz, add = max - cur; if (add <= 0) return;
    const a = Math.min(acc * max * dt, add); this.vel.x += wx * a; this.vel.z += wz * a;
  }
  /* ── body for rays ── */
  hitboxes() {
    const p = this.vehicle ? this.vehicle.seatPos(_hbSeat, this).setY(this.vehicle.pos.y + 0.9) : this.pos, h = this.vehicle ? 1.0 : this.height;
    const baseY = this.vehicle ? p.y : p.y;
    const topY = this.vehicle ? p.y + 1.1 : p.y + h;
    return { head: { x0: p.x - 0.14, x1: p.x + 0.14, y0: topY - 0.3, y1: topY, z0: p.z - 0.14, z1: p.z + 0.14 }, body: { x0: p.x - 0.27, x1: p.x + 0.27, y0: this.vehicle ? baseY + 0.3 : baseY, y1: topY - 0.3, z0: p.z - 0.27, z1: p.z + 0.27 }, baseY, h: topY - baseY };
  }
  buildModel(scene) {
    if (this.model) scene.remove(this.model);
    this.model = buildSoldierModel(this.team); scene.add(this.model);
    this.tag = nameSprite(this.name, TEAM_STYLE[this.team].color); this.tag.position.y = 2.15; this.model.add(this.tag);
    this.skinKey = null;
  }
  syncModel(dt, localTeam, viewer) {
    const M = this.model; if (!M) return;
    const u = M.userData;
    M.visible = (this.alive || this.deadT < 8) && this !== viewer && !(this.vehicle && this.vehicle.driver === this && false);
    if (!M.visible) return;
    if (this.vehicle) { this.vehicle.seatPos(M.position, this); M.position.y = this.vehicle.pos.y + 0.35; M.rotation.y = this.vehicle.yaw; }
    else { M.position.copy(this.pos); M.rotation.y = this.yaw; }
    const gid = isNade(this.cur) || !WEAPONS[this.cur] ? 'knife' : this.cur;
    setSoldierGun(M, gid, this.skinItem(gid), this.attach && this.attach[gid]);
    if (!this.alive) {
      this.deadT += dt; u.body.rotation.x = lerp(u.body.rotation.x, -Math.PI / 2, 1 - Math.exp(-dt * 8)); u.body.position.y = lerp(u.body.position.y, 0.2, 1 - Math.exp(-dt * 8));
      this.tag.visible = false; return;
    }
    u.body.rotation.x = 0; u.body.position.y = -this.crouch * 0.5;
    const hs = Math.hypot(this.vel.x, this.vel.z), sw = Math.sin(this.walkPhase * 2) * Math.min(hs / 5, 1) * 0.6;
    u.legL.rotation.x = sw - this.crouch * 0.9; u.legR.rotation.x = -sw - this.crouch * 0.9;
    u.upper.rotation.x = this.pitch * 0.6; u.arms.rotation.x = this.pitch * 0.4;
    this.tag.visible = this.team === localTeam && !this.vehicle;
  }
  skinItem(weaponId) {
    if (!weaponId) return null;
    if (this.ctrl === 'local') return Inv.equippedItem(weaponId);
    const s = this.skins[weaponId]; return s ? { skinId: s.s, float: s.f, seed: s.d, st: s.st >= 0, kills: s.st } : null;
  }
}
const _hbSeat = new V3();

/* ── rays against soldiers ─────────────────────────────────────────────── */
function raySoldiers(o, d, maxT, exclude, list) {
  let best = maxT, hit = null, zone = null;
  for (const s of list) {
    if (!s.alive || s === exclude) continue;
    const dx = s.pos.x - o.x, dz = s.pos.z - o.z; if (dx * dx + dz * dz > (best + 2) * (best + 2)) continue;
    const hb = s.hitboxes();
    let t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, hb.head);
    if (t >= 0 && t < best) { best = t; hit = s; zone = 'head'; }
    t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, hb.body);
    if (t >= 0 && t < best) {
      best = t; hit = s; const y = o.y + d.y * t - hb.baseY, rel = y / hb.h;
      zone = rel < 0.45 ? 'legs' : rel < 0.6 ? 'stomach' : 'chest';
    }
  }
  return hit ? { s: hit, t: best, zone } : null;
}

/* Shoot the soldier's current weapon along its aim. Works for every
   controller; damage is routed through Game so the host stays in charge. */
const _o = new V3(), _d = new V3(), _e = new V3(), _mz = new V3();
function fireWeapon(s, now, recoilControl = 0) {
  const w = s.w; if (!w || !s.alive) return false;
  if (s.fireCd > 0 || s.drawT > 0 || s.reloadT > 0 || s.boltT > 0) return false;
  if (w.type === 'knife') return knifeAttack(s, now);
  const a = s.ammo[s.cur]; if (!a) return false;
  if (a.mag <= 0) { if (s.ctrl === 'local') Sfx.play('empty'); s.fireCd = 0.2; if (!s.startReload() && s.ctrl === 'bot') s.switchTo(s.weapons[2] || 'knife'); return false; }
  if (w.spinup) { s.spinT = now; if (s.spin < 1) return false; }
  if (s.healT > 0) return false;
  a.mag--; s.fireCd = 60 / w.rpm; s.lastShot = now;
  if (w.bolt) { s.boltT = w.bolt; }
  const eye = s.eye(_o);
  const idx = Math.floor(s.recoilIdx), rp = w.recoil ? recoilPattern(w, idx) : { x: 0, y: 0 };
  s.recoilIdx += 1;
  const rc = 1 - recoilControl;
  const baseYaw = s.yaw - rp.x * DEG * rc, basePitch = s.pitch + rp.y * DEG * rc;
  const sp = s.spread(), pellets = w.pellets || 1;
  const shotEnds = [];
  if (w.projectile) {
    const cp = Math.cos(basePitch); _d.set(-Math.sin(baseYaw) * cp, Math.sin(basePitch), -Math.cos(baseYaw) * cp);
    Game.spawnRocket(s, eye.clone().addScaledVector(_d, 0.8), _d.clone(), true, s.cur);
    s.fireCd = 60 / w.rpm; Sfx.play('shot', eye, { w });
    if (a.mag <= 0 && a.res > 0) s.startReload();
    return true;
  }
  for (let p = 0; p < pellets; p++) {
    const r = Math.sqrt(Math.random()) * sp, th = Math.random() * TAU;
    const yaw = baseYaw + Math.cos(th) * r, pitch = basePitch + Math.sin(th) * r, cp = Math.cos(pitch);
    _d.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    const range = w.pellets ? 60 : 400;
    let wt = World.raycast(eye.x, eye.y, eye.z, _d.x, _d.y, _d.z, range); const wallN = { x: World.hit.nx, y: World.hit.ny, z: World.hit.nz };
    if (wt < 0) wt = range;
    const ph = Phys.active ? Phys.ray(eye, _d, wt) : null; if (ph) { wt = ph.t; wallN.x = ph.n.x; wallN.y = ph.n.y; wallN.z = ph.n.z; }
    const sh = raySoldiers(eye, _d, wt, s, Game.soldiers);
    let vehHit = null;
    if (!sh) vehHit = Game.rayVehicles(eye, _d, wt);
    const endT = sh ? sh.t : vehHit ? vehHit.t : wt;
    _e.copy(eye).addScaledVector(_d, endT);
    if (sh) {
      const falloff = rangeMult(w, sh.t);
      const mult = { head: Game.mode.headMult, chest: 1, stomach: 1.25, legs: 0.75 }[sh.zone];
      Game.reportHit(s, sh.s, w.dmg * falloff * mult, sh.zone, s.cur, eye);
      FX.impact(_e, { x: -_d.x, y: -_d.y, z: -_d.z }, true);
    } else if (vehHit) { Game.reportVehicleHit(s, vehHit.v, w.dmg * 0.15, s.cur); FX.impact(_e, { x: -_d.x, y: -_d.y, z: -_d.z }); }
    else if (wt < range) {
      FX.impact(_e, wallN); if (p === 0) Sfx.play('impact', _e);
      if (ph && (s.ctrl === 'local' || s.ctrl === 'bot')) Game.propHit(s, ph.p, _e, _d, w.dmg);
    }
    shotEnds.push(_e.clone());
  }
  // muzzle position for tracers: use the view model when it's ours
  const mz = s.ctrl === 'local' && Game.view && !Game.view.third ? Game.view.muzzleWorld(_mz) : _mz.copy(eye).add(new V3(0, -0.15, 0));
  if (!(s.ctrl === 'local' && s.ads && w.scope) && !w.suppressed) for (const e of shotEnds) if (Math.random() < (pellets > 1 ? 0.3 : 0.7)) FX.tracer(mz, e);
  if (!w.suppressed) FX.muzzle(mz);
  Sfx.play('shot', eye, { w });
  Game.noise(s, w.suppressed ? 15 : 45 + (w.sound || 1) * 20);
  Game.onShot(s, shotEnds[0], eye);
  if (a.mag <= 0 && a.res > 0 && s.ctrl !== 'local') s.startReload();
  return true;
}
function knifeAttack(s, now) {
  s.fireCd = 60 / WEAPONS.knife.rpm; s.lastShot = now;
  const eye = s.eye(_o), d = s.forward(_d); Sfx.play('knife', eye);
  const sh = raySoldiers(eye, d, WEAPONS.knife.range, s, Game.soldiers);
  if (sh) {
    // backstab: facing the same way as the victim
    const back = Math.abs(angDiff(s.yaw, sh.s.yaw)) < 0.9;
    Game.reportHit(s, sh.s, back ? 180 : WEAPONS.knife.dmg * (sh.zone === 'head' ? 1.3 : 1), sh.zone, 'knife', eye);
  } else { const t = World.raycast(eye.x, eye.y, eye.z, d.x, d.y, d.z, WEAPONS.knife.range); if (t >= 0) { _e.copy(eye).addScaledVector(d, t); FX.impact(_e, { x: World.hit.nx, y: World.hit.ny, z: World.hit.nz }); } }
  return true;
}

/* ── grenades ──────────────────────────────────────────────────────────── */
class Nade {
  constructor(type, pos, vel, owner, id) {
    this.type = type; this.pos = pos; this.vel = vel; this.owner = owner; this.t = 0; this.id = id; this.done = false; this.rest = false;
    const col = type === 'frag' ? '#3a4a2a' : type === 'flash' ? '#aaaaaa' : '#556677';
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lam(col)); Game.scene.add(this.mesh);
  }
  update(dt) {
    this.t += dt;
    if (!this.rest) {
      this.vel.y -= PHYS.gravity * 0.8 * dt;
      const sp = this.vel.length(), step = sp * dt;
      if (step > 0) {
        const d = this.vel.clone().multiplyScalar(1 / sp);
        const t = World.raycast(this.pos.x, this.pos.y, this.pos.z, d.x, d.y, d.z, step + 0.07);
        if (t >= 0) {
          const H = World.hit; this.pos.addScaledVector(d, Math.max(0, t - 0.07));
          const vn = this.vel.x * H.nx + this.vel.y * H.ny + this.vel.z * H.nz;
          this.vel.x -= 2 * vn * H.nx; this.vel.y -= 2 * vn * H.ny; this.vel.z -= 2 * vn * H.nz; this.vel.multiplyScalar(0.42);
          if (sp > 2) Sfx.play('bounce', this.pos);
          if (H.ny > 0.5 && this.vel.length() < 1.2) { this.rest = true; this.vel.set(0, 0, 0); }
        } else this.pos.addScaledVector(this.vel, dt);
      }
    }
    this.mesh.position.copy(this.pos);
    if (this.t >= GRENADES[this.type].fuse && !(this.type === 'smoke' && !this.rest && this.t < 3.5)) this.detonate();
  }
  detonate() {
    this.done = true; Game.scene.remove(this.mesh);
    const p = this.pos;
    if (this.type === 'frag') { FX.explosion(p); Sfx.play('explode', p); Game.explosion(p, 98, 6.5, this.owner, 'frag'); }
    else if (this.type === 'smoke') { FX.smoke(p); Sfx.play('smoke', p); }
    else if (this.type === 'flash') { Sfx.play('flash', p); FX.emit('add', p.x, p.y, p.z, 30, 8, [1, 1, 1], 0.25, 0, 1); Game.flashbang(p, this.owner); }
  }
}
function throwVelocity(s, strong) {
  const f = s.forward(new V3()); const sp = strong ? 17 : 8;
  return f.multiplyScalar(sp).add(new V3(0, strong ? 2.2 : 3.2, 0)).add(s.vel.clone().multiplyScalar(0.8));
}

/* Anything that flies instead of hitting instantly: RPG rockets, M79
   grenades (a real arc), crossbow bolts (stick where they land). */
class Rocket {
  constructor(owner, pos, dir, wid = 'rpg') {
    this.owner = owner; this.pos = pos; this.w = WEAPONS[wid] || WEAPONS.rpg; this.wid = this.w.id; this.vel = dir.clone().multiplyScalar(this.w.projectile); this.dir = dir; this.t = 0; this.done = false;
    if (this.w.type === 'bow') { this.mesh = new THREE.Group(); this.mesh.add(cyl(0.008, 0.45, lam('#c8b890'))); this.mesh.add(bx(0.03, 0.002, 0.05, lam('#c83a2a'), 0, 0, 0.2)); }
    else this.mesh = this.w.id === 'm79' ? new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lam('#4a5a2a')) : new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 6), lam('#5a6a3a'));
    Game.scene.add(this.mesh);
  }
  update(dt) {
    if (this.stuck) { this.stuck -= dt; if (this.stuck <= 0) { this.done = true; Game.scene.remove(this.mesh); } return; }
    this.t += dt; this.vel.y -= (this.w.gravity || 0) * dt;
    const sp = this.vel.length(), step = sp * dt; this.dir.copy(this.vel).multiplyScalar(1 / sp);
    let t = World.raycast(this.pos.x, this.pos.y, this.pos.z, this.dir.x, this.dir.y, this.dir.z, step);
    const sh = raySoldiers(this.pos, this.dir, t >= 0 ? t : step, this.owner, Game.soldiers);
    const vh = Game.rayVehicles(this.pos, this.dir, t >= 0 ? t : step);
    const ph = Phys.active ? Phys.ray(this.pos, this.dir, t >= 0 ? t : step) : null;
    if (sh) t = sh.t; else if (vh) t = vh.t; else if (ph) t = ph.t;
    if (t >= 0 || this.t > 6) {
      this.pos.addScaledVector(this.dir, Math.max(0, t - 0.1));
      if (this.w.explosive) return this.explode();
      // a bolt: hurt whoever it hit, then stay stuck in the wall for a while
      if (sh && (this.owner.ctrl === 'local' || (this.owner.ctrl === 'bot' && Game.authority()))) Game.reportHit(this.owner, sh.s, this.w.dmg * { head: 2, chest: 1, stomach: 1.1, legs: 0.7 }[sh.zone], sh.zone, this.wid, this.pos);
      if (ph && !sh && (this.owner.ctrl === 'local' || this.owner.ctrl === 'bot')) Game.propHit(this.owner, ph.p, this.pos, this.dir, 60);
      Sfx.play('impact', this.pos); this.stuck = sh ? 0.01 : 12; this.orient(); return;
    }
    this.pos.addScaledVector(this.dir, step); this.orient();
    if (this.w.type === 'bow') return;
    FX.emit('big', this.pos.x, this.pos.y, this.pos.z, 1, 0.3, [0.5, 0.5, 0.5], 0.8, 0.5, 0.3);
    if (this.w.id === 'rpg') FX.emit('add', this.pos.x, this.pos.y, this.pos.z, 2, 1, [1, 0.6, 0.2], 0.1, 0, 0.5);
  }
  orient() { this.mesh.position.copy(this.pos); this.mesh.quaternion.setFromUnitVectors(this.w.type === 'bow' ? new V3(0, 0, -1) : new V3(0, 1, 0), this.dir); }
  explode() { this.done = true; Game.scene.remove(this.mesh); FX.explosion(this.pos); Sfx.play('explode', this.pos); Game.explosion(this.pos, this.w.dmg, this.w.radius, this.owner, this.wid); }
}

/* ── vehicles ──────────────────────────────────────────────────────────── */
class Vehicle {
  constructor(id, team, spawn) {
    this.id = id; this.team = team; this.spawn = spawn; this.pos = new V3(); this.vel = new V3(); this.yaw = 0; this.speed = 0; this.steer = 0;
    this.hp = 500; this.maxHp = 500; this.driver = null; this.passenger = null; this.alive = true; this.respawnT = 0; this.lastSync = 0;
    this.model = buildJeep(team); Game.scene.add(this.model); this.reset();
  }
  reset() { this.pos.set(this.spawn.x, 0, this.spawn.z); this.yaw = this.spawn.yaw; this.speed = 0; this.hp = this.maxHp; this.alive = true; this.model.visible = true; this.model.rotation.set(0, this.yaw, 0); }
  seatPos(out, s) { const side = s === this.passenger ? 0.45 : -0.45; const c = Math.cos(this.yaw), sn = Math.sin(this.yaw); return out.set(this.pos.x + c * side + sn * 0.1, this.pos.y + 1.65, this.pos.z - sn * side + c * 0.1); }
  drive(inp, dt) {
    const acc = inp.f * 14, max = 22;
    this.speed += acc * dt; if (!inp.f) this.speed *= Math.exp(-dt * 0.8); if (inp.brake) this.speed *= Math.exp(-dt * 4);
    this.speed = clamp(this.speed, -8, max);
    this.steer = lerp(this.steer, inp.s, 1 - Math.exp(-dt * 6));
    this.yaw -= this.steer * dt * clamp(this.speed / 6, -1.2, 1.2) * 0.9;
  }
  physics(dt) {
    if (!this.alive) { this.respawnT -= dt; if (this.respawnT <= 0 && Game.authority()) { if (this.noRespawn) { Sandbox.emit({ e: 'vehdel', id: this.id }); return; } this.reset(); Game.broadcastVehicle(this); } return; }
    this.vel.set(-Math.sin(this.yaw) * this.speed, this.vel.y - PHYS.gravity * dt, -Math.cos(this.yaw) * this.speed);
    const before = this.speed; const r = moveBody(this.pos, this.vel, dt, 1.25, 1.7, true);
    if (r.hitWall) { if (Math.abs(before) > 8 && Game.authority()) this.damage(Math.abs(before) * 3, null); this.speed *= -0.25; }
    if (Math.abs(this.speed) > 5 && Game.authority()) {
      for (const s of Game.soldiers) if (s.alive && !s.vehicle && dist2(s.pos.x, s.pos.z, this.pos.x, this.pos.z) < 2.0 && s.team !== this.team) Game.damage(s, Math.abs(this.speed) * 9, this.driver, 'jeep', 'chest');
    }
    this.model.position.copy(this.pos); this.model.rotation.y = this.yaw;
    this.model.userData.wheels.forEach(w => w.rotation.x += this.speed * dt / 0.42);
    if (this.driver && Math.abs(this.speed) > 0.5 && Math.random() < 0.3) Sfx.play('vehicle', this.pos, { f: 50 + Math.abs(this.speed) * 4, dur: 0.12 });
  }
  damage(d, by) {
    if (!this.alive) return; this.hp -= d;
    if (this.hp <= 0) {
      this.alive = false; this.respawnT = 25; FX.explosion(this.pos.clone().setY(1)); Sfx.play('explode', this.pos);
      for (const s of [this.driver, this.passenger]) if (s) { const occ = s; Game.exitVehicle(occ, true); if (Game.authority()) Game.damage(occ, 999, by, 'jeep', 'chest'); }
      Game.explosion(this.pos.clone().setY(1), 60, 5, by, 'jeep');
      this.model.visible = false; Game.broadcastVehicle(this);
    }
  }
  box() { return { x0: this.pos.x - 1.1, x1: this.pos.x + 1.1, y0: this.pos.y + 0.2, y1: this.pos.y + 1.6, z0: this.pos.z - 1.1, z1: this.pos.z + 1.1 }; }
}
