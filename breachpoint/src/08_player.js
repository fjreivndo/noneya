/* ═══════════════════════════════════════════════════════════════════════════
   Local player: keyboard/mouse to soldier inputs, the camera, and the
   first-person viewmodel (drawn in its own scene so it never clips walls).
   ═══════════════════════════════════════════════════════════════════════════ */

const Player = {
  specIdx: 0, orbit: 0, shakeT: 0, inspectT: 0, lastUse: 0,
  update(dt) {
    const s = Game.local; if (!s) return;
    const blocked = UI.blocking();
    const in_ = s.moveIn; in_.f = in_.s = 0; in_.jump = in_.crouch = in_.walk = in_.sprint = false;
    if (s.dead) return;
    if (s.alive) {
      if (!blocked) this.controls(s, dt);
      s.tickWeapon(dt, Game.now);
      if (s.planting && Net.role === 'client') { s.planting.t -= dt; if (!Input.down('KeyE')) { s.planting = null; Net.send({ t: 'act', k: 'cancel' }); } }
      if (Game.bomb.localDefuse) { Game.bomb.localDefuse.t -= dt; if (!Input.down('KeyE')) { Game.bomb.localDefuse = null; Net.send({ t: 'act', k: 'cancel' }); } }
      const frozen = Game.round && Game.round.phase === 'freeze' && Game.mode.id === 'defuse';
      if (frozen || s.planting || Game.bomb.defuser === s.id || Game.bomb.localDefuse) { in_.f = in_.s = 0; in_.jump = false; if (!frozen) in_.crouch = true; }
      if (!s.vehicle) s.move(dt);
      else { s.pos.copy(s.vehicle.pos); s.vel.set(0, 0, 0); }
    } else {
      if (s.respawnT != null) s.respawnT -= dt;
      if (!blocked && (Input.mouse.leftPressed || Input.hit('Space'))) this.specIdx++;
    }
    this.camera(s, dt);
  },
  controls(s, dt) {
    const I = Input, now = Game.now, w = s.w;
    // look
    const zoomK = s.ads && w ? Math.tan((w.zoom || Settings.fov) * DEG / 2) / Math.tan(Settings.fov * DEG / 2) : 1;
    const sens = Settings.sens * 0.0022 * (s.adsT > 0.5 ? zoomK * 1.1 : 1);
    s.yaw = angWrap(s.yaw - I.mouse.dx * sens); s.pitch = clamp(s.pitch - I.mouse.dy * sens, -1.52, 1.52);
    if (s.vehicle && s.vehicle.driver === s) { if (I.hit('KeyE')) Game.tryEnterVehicle(s); return; }
    // move
    const m = s.moveIn;
    m.f = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0); m.s = (I.down('KeyD') ? 1 : 0) - (I.down('KeyA') ? 1 : 0);
    m.jump = I.down('Space'); m.crouch = I.down('ControlLeft') || I.down('KeyC');
    if (Game.mode.sprint) m.sprint = I.down('ShiftLeft'); else m.walk = I.down('ShiftLeft');
    if (m.sprint && m.f > 0) s.ads = false;
    // weapons
    for (let k = 1; k <= 5; k++) if (I.hit('Digit' + k)) s.switchSlot(k);
    if (I.mouse.wheel) { const slots = [1, 2, 3, 4].filter(k => k === 4 ? Object.values(s.nades).some(n => n > 0) : s.weapons[k]); const cur = isNade(s.cur) ? 4 : WEAPONS[s.cur] ? WEAPONS[s.cur].slot : 1; let i = slots.indexOf(cur); i = (i + (I.mouse.wheel > 0 ? 1 : -1) + slots.length) % slots.length; s.switchSlot(slots[i]); }
    if (I.hit('KeyX') && s.last) s.switchTo(s.last);
    if (I.hit('KeyR')) s.startReload();
    if (I.hit('KeyF') && !isNade(s.cur)) this.inspectT = 2.6;
    if (isNade(s.cur)) {
      if (s.drawT <= 0 && (I.mouse.leftPressed || I.mouse.rightPressed)) Game.throwNade(s, s.cur, I.mouse.leftPressed);
      s.ads = false;
    } else if (w) {
      const want = w.auto ? I.mouse.left : I.mouse.leftPressed;
      if (want && !(m.sprint && m.f > 0 && Game.mode.sprint)) { if (fireWeapon(s, now, 0)) this.inspectT = 0; }
      if (w.type === 'knife') { if (I.mouse.rightPressed && s.fireCd <= 0) { s.fireCd = 0; const d0 = WEAPONS.knife.dmg; WEAPONS.knife.dmg = 65; fireWeapon(s, now, 0); WEAPONS.knife.dmg = d0; s.fireCd = 1.0; } s.ads = false; }
      else s.ads = I.mouse.right && s.drawT <= 0 && s.reloadT <= 0 && !(m.sprint && m.f > 0);
      if (w.mag && s.ammo[s.cur] && s.ammo[s.cur].mag === 0 && s.ammo[s.cur].res > 0 && s.fireCd <= 0 && s.reloadT <= 0) s.startReload();
    }
    // use: vehicles, plant, defuse
    if (I.hit('KeyE')) {
      if (!Game.tryEnterVehicle(s)) {
        if (Game.bomb.state === 'carried' && Game.bomb.carrier === s.id && World.siteAt(s.pos.x, s.pos.z)) Game.startPlant(s);
        else if (s.team === 'CT' && Game.bomb.state === 'planted') Game.startDefuse(s);
      }
    }
    if (I.hit('KeyQ')) this.spot(s);
    if (I.hit('KeyG')) this.gadget(s);
    if (I.hit('KeyB') && Game.mode.buy) UI.toggleBuy();
  },
  vehicleInput() { const I = Input; return UI.blocking() ? { f: 0, s: 0, brake: true } : { f: (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0), s: (I.down('KeyD') ? 1 : 0) - (I.down('KeyA') ? 1 : 0), brake: I.down('Space') }; },
  /* Battlefield spotting: mark the enemy nearest your crosshair for the team */
  spot(s) {
    const eye = s.eye(new V3()), f = s.forward(new V3()); let best = null, ba = 0.18;
    for (const e of Game.soldiers) {
      if (!e.alive || e.team === s.team) continue;
      const to = new V3(e.pos.x - eye.x, e.eyeY - 0.3 - eye.y, e.pos.z - eye.z), d = to.length(); to.multiplyScalar(1 / d);
      const a = Math.acos(clamp(f.dot(to), -1, 1)); if (a > ba || d > 250) continue;
      if (!World.los(eye.x, eye.y, eye.z, e.pos.x, e.eyeY - 0.2, e.pos.z) || FX.smokeBlocks(eye, e.pos)) continue;
      best = e; ba = a;
    }
    if (!best) return;
    const dur = s.cls === 'recon' && Game.mode.classes ? 10 : 6;
    Game.markSpotted(best, s.team, dur);
    if (Net.role === 'client') Net.send({ t: 'spot', e: best.id, d: dur });
    HUD.radio(s.name, 'Enemy spotted!'); Sfx.play('ui');
  },
  gadget(s) {
    if (!Game.mode.classes || s.gadgetCd > 0) return;
    const c = CLASSES[s.cls];
    if (c.gadget === 'medkit' && s.medkits > 0) { s.medkits--; s.gadgetCd = 1; Game.requestHeal(s); HUD.center('Medkit used', 1); }
    else if (c.gadget === 'ammo' && s.ammoBoxes > 0) { s.ammoBoxes--; s.gadgetCd = 1; Game.requestAmmo(s); HUD.center('Ammo box dropped', 1); }
  },
  camera(s, dt) {
    const cam = Game.camera, V = Game.view;
    let fov = Settings.fov;
    this.inspectT -= dt;
    if (s.alive && s.vehicle && s.vehicle.driver === s) {
      V.third = true; const v = s.vehicle, back = 8, h = 3.6;
      const cx = v.pos.x + Math.sin(v.yaw) * back, cz = v.pos.z + Math.cos(v.yaw) * back;
      cam.position.lerp(new V3(cx, v.pos.y + h, cz), 1 - Math.exp(-dt * 8)); cam.lookAt(v.pos.x, v.pos.y + 1.4, v.pos.z);
    } else if (s.alive) {
      V.third = false;
      const e = s.eye(new V3()); cam.position.copy(e);
      cam.rotation.set(0, 0, 0, 'YXZ');
      let sh = 0; if (this.shakeT > 0) { this.shakeT -= dt; sh = this.shakeT * 0.03; }
      cam.rotation.y = s.yaw + s.punchX * 1.0 + rand(-sh, sh); cam.rotation.x = s.pitch + s.punchY + rand(-sh, sh);
      const w = s.w; if (w && w.zoom) fov = lerp(Settings.fov, w.zoom, s.adsT);
      if (s.moveIn.sprint && Math.hypot(s.vel.x, s.vel.z) > 6) fov += 5;
    } else {
      V.third = true;
      // spectate: killer/teammates in defuse, orbit your body otherwise
      const pool = Game.mode.id === 'defuse' ? Game.soldiers.filter(o => o.alive && o.team === s.team) : [];
      const t = pool.length ? pool[this.specIdx % pool.length] : null;
      if (t) {
        HUD.spectating(t);
        const e = t.eye(new V3()); cam.position.set(e.x + Math.sin(t.yaw) * 2.6, e.y + 0.8, e.z + Math.cos(t.yaw) * 2.6);
        const tgt = new V3(e.x - Math.sin(t.yaw) * 2, e.y + Math.sin(t.pitch) * 2, e.z - Math.cos(t.yaw) * 2); cam.lookAt(tgt);
      } else {
        HUD.spectating(null);
        this.orbit += dt * 0.3; const k = Game.spectate && Game.spectate.alive ? Game.spectate.pos : s.pos;
        cam.position.set(k.x + Math.sin(this.orbit) * 6, k.y + 4, k.z + Math.cos(this.orbit) * 6); cam.lookAt(k.x, k.y + 1, k.z);
      }
    }
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    Sfx.listener.x = cam.position.x; Sfx.listener.y = cam.position.y; Sfx.listener.z = cam.position.z; Sfx.listener.yaw = s.alive ? s.yaw : Math.atan2(cam.position.x, cam.position.z);
    V.update(dt, s);
  },
};

Game.markSpotted = function (e, team, dur) { e['spot' + team] = this.now + dur; if (this.authority()) this.cmd[team].report(e, null); };
Game.requestHeal = function (s) {
  if (!this.authority()) { Net.send({ t: 'gadget', k: 'heal' }); return; }
  for (const o of this.soldiers) if (o.alive && o.team === s.team && dist2(o.pos.x, o.pos.z, s.pos.x, s.pos.z) < 5) o.hp = Math.min(100, o.hp + 60);
  Net.syncHp();
};
Game.requestAmmo = function (s) {
  if (!this.authority()) { Net.send({ t: 'gadget', k: 'ammo' }); }
  for (const o of this.soldiers) if (o.alive && o.team === s.team && dist2(o.pos.x, o.pos.z, s.pos.x, s.pos.z) < 6) { for (const id in o.ammo) { const w = WEAPONS[id]; o.ammo[id].res = Math.min(w.reserve * 1.5, o.ammo[id].res + w.mag * 2); } for (const n in o.nades) if (n === 'frag') o.nades[n] = Math.max(o.nades[n], 1); }
  if (this.authority()) Net.event({ t: 'ammo', s: s.id });
};

/* ── viewmodel ─────────────────────────────────────────────────────────── */
class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x666655, 1.8)); const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(1, 2, 1); this.scene.add(d);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.key = null; this.gun = null; this.hands = null; this.kick = 0; this.lastShot = -1; this.sway = { x: 0, y: 0 }; this.third = false; this.slash = 0; this.team = null;
  }
  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  visible() { const s = Game.local; return s && s.alive && !this.third && !(s.w && s.w.scope && s.adsT > 0.85); }
  rebuild(s) {
    const it = isNade(s.cur) ? null : s.skinItem(s.cur);
    const key = s.cur + ':' + (it ? it.uid || it.skinId + it.seed : '') + s.team;
    if (key === this.key) return; this.key = key;
    this.root.clear();
    const st = TEAM_STYLE[s.team], G = lam(st.glove), U = lam(st.uniform);
    if (isNade(s.cur)) {
      const col = s.cur === 'frag' ? '#3a4a2a' : s.cur === 'flash' ? '#b8b8b8' : '#5a6a7a';
      this.gun = new THREE.Group(); const n = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10), lam(col)); this.gun.add(n); this.gun.add(bx(0.012, 0.03, 0.012, lam('#999'), 0.015, 0.055, 0));
      this.gun.userData.muzzle = new THREE.Object3D(); this.gun.add(this.gun.userData.muzzle);
    } else this.gun = buildGun(s.cur, it);
    const w = WEAPONS[s.cur], long = w && !['pistol', 'knife'].includes(w.type);
    // hands with sleeves
    const hands = new THREE.Group();
    const rh = new THREE.Group(); rh.add(bx(0.05, 0.055, 0.09, G, 0, 0, 0)); rh.add(bx(0.06, 0.06, 0.2, U, 0.01, -0.02, 0.14)); rh.position.set(0.005, -0.07, 0.07); rh.rotation.set(-0.5, 0.25, 0); hands.add(rh);
    const lh = new THREE.Group(); lh.add(bx(0.05, 0.045, 0.09, G, 0, 0, 0)); lh.add(bx(0.06, 0.06, 0.22, U, -0.01, -0.03, 0.14)); lh.position.set(-0.015, long ? -0.045 : -0.075, long ? -0.24 : 0.05); lh.rotation.set(-0.6, long ? -0.7 : 0.2, 0); hands.add(lh);
    this.gun.add(hands); this.root.add(this.gun);
    const scale = w && ['rifle', 'lmg', 'sniper', 'shotgun', 'launcher'].includes(w.type) ? 0.78 : w && w.type === 'smg' ? 0.85 : 1;
    this.gun.scale.setScalar(scale);
    this.hip = w && w.type === 'knife' ? new V3(0.2, -0.2, -0.38) : w && w.type === 'pistol' ? new V3(0.15, -0.16, -0.42) : isNade(s.cur) ? new V3(0.2, -0.2, -0.38) : new V3(0.16, -0.17, -0.5);
    const sightY = (w && w.type === 'pistol' ? -0.055 : w && w.type === 'sniper' ? -0.078 : -0.072) * scale;
    this.adsPos = new V3(0, sightY, w && w.type === 'pistol' ? -0.36 : -0.34);
  }
  muzzleWorld(out) {
    if (!this.gun) return out.copy(Game.camera.position);
    this.root.updateMatrixWorld(true); this.gun.userData.muzzle.getWorldPosition(out);
    return out.applyQuaternion(Game.camera.quaternion).add(Game.camera.position);
  }
  update(dt, s) {
    if (!s || !s.alive || this.third) return;
    this.rebuild(s);
    const w = s.w, g = this.gun; if (!g) return;
    if (s.lastShot !== this.lastShot) { this.lastShot = s.lastShot; this.kick = 1; if (w && w.type === 'knife') this.slash = 1; }
    this.kick = Math.max(0, this.kick - dt * (w && w.type === 'sniper' ? 4 : 12)); this.slash = Math.max(0, this.slash - dt * 4);
    this.sway.x = lerp(this.sway.x, clamp(-Input.mouse.dx * 0.0006, -0.04, 0.04), 1 - Math.exp(-dt * 10));
    this.sway.y = lerp(this.sway.y, clamp(Input.mouse.dy * 0.0006, -0.04, 0.04), 1 - Math.exp(-dt * 10));
    const hs = Math.hypot(s.vel.x, s.vel.z), bobA = Math.min(hs / 5, 1.3) * (s.grounded ? 1 : 0.2) * (1 - s.adsT * 0.85);
    const bx_ = Math.sin(s.walkPhase * 1) * 0.012 * bobA, by = -Math.abs(Math.cos(s.walkPhase * 1)) * 0.012 * bobA;
    const p = new V3().lerpVectors(this.hip, this.adsPos, s.adsT);
    let rx = 0, ry = 0, rz = 0, oy = 0, oz = 0;
    if (s.drawT > 0) { const k = clamp(s.drawT / 0.5, 0, 1); oy -= k * 0.25; rx -= k * 0.8; }
    if (s.reloadT > 0 && w) { const q = 1 - s.reloadT / w.reload, k = Math.sin(q * Math.PI); oy -= 0.08 * k; rz += 0.55 * k; rx += 0.25 * k; }
    if (s.boltT > 0 && w && w.bolt) { const k = Math.sin((1 - s.boltT / w.bolt) * Math.PI); rz += 0.3 * k; oy -= 0.03 * k; }
    if (Player.inspectT > 0) { const q = 1 - Player.inspectT / 2.6, k = Math.sin(q * Math.PI); ry += 1.3 * k; rz += 0.35 * Math.sin(q * Math.PI * 2); oy += 0.02 * k; }
    if (this.slash > 0) { const k = Math.sin((1 - this.slash) * Math.PI); ry -= 1.2 * k; rx -= 0.5 * k; }
    if (s.moveIn.sprint && hs > 6 && Game.mode.sprint) { rz += 0.4; ry += 0.5; oy -= 0.05; }
    const kickK = w && w.recoil ? Math.min(1.5, w.recoil) : 0.5;
    g.position.set(p.x + bx_ + this.sway.x, p.y + by + this.sway.y + oy, p.z + this.kick * 0.04 * kickK + oz);
    g.rotation.set(rx + this.kick * 0.06 * kickK, ry + this.sway.x * 2, rz);
    if (Math.abs(this.camera.fov - (60 - s.adsT * 8)) > 0.01) { this.camera.fov = 60 - s.adsT * 8; this.camera.updateProjectionMatrix(); }
  }
}
