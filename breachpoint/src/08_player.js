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
      if (Sandbox.on && Game.authority() && (s.respawnT == null || s.respawnT <= 0) && s.deadT > 0.5) Game.respawn(s);
      if (!blocked && (Input.mouse.leftPressed || Input.hit('Space'))) this.specIdx++;
    }
    this.camera(s, dt);
  },
  controls(s, dt) {
    const I = Input, now = Game.now, w = s.w;
    // look
    const zoomK = s.ads && w ? Math.tan((w.zoom || Settings.fov) * DEG / 2) / Math.tan(Settings.fov * DEG / 2) : 1;
    const sens = Settings.sens * 0.0022 * (s.adsT > 0.5 ? zoomK * 1.1 : 1);
    if (!(Sandbox.on && Sandbox.rotating(s))) { s.yaw = angWrap(s.yaw - I.mouse.dx * sens); s.pitch = clamp(s.pitch - I.mouse.dy * sens, -1.52, 1.52); }
    if (Sandbox.on) {
      if (I.hit('KeyQ')) { UI.toggleSpawnMenu(true); return; }
      if (I.hit('KeyZ')) Sandbox.exec({ op: 'undo' });
      if (I.hit('KeyV')) { s.noclip = !s.noclip; s.vel.set(0, 0, 0); HUD.center(s.noclip ? 'Noclip on' : 'Noclip off', 0.6); }
      for (const k of ['KeyT', 'KeyK']) { if (I.hit(k)) Sandbox.onKey(k, true); if (I.released[k]) Sandbox.onKey(k, false); }
    }
    if (s.vehicle && s.vehicle.driver === s) { if (I.hit('KeyE')) Game.tryEnterVehicle(s); return; }
    // move
    const m = s.moveIn;
    m.f = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0); m.s = (I.down('KeyD') ? 1 : 0) - (I.down('KeyA') ? 1 : 0);
    m.jump = I.down('Space'); m.crouch = I.down('ControlLeft') || I.down('KeyC');
    if (Game.mode.sprint) m.sprint = I.down('ShiftLeft'); else m.walk = I.down('ShiftLeft');
    if (m.sprint && m.f > 0) s.ads = false;
    // weapons
    for (let k = 1; k <= 5; k++) if (I.hit('Digit' + k)) s.switchSlot(k);
    for (const k of [6, 7]) if (I.hit('Digit' + k)) s.switchSlot(k);
    if (I.mouse.wheel && !(Sandbox.on && Sandbox.wheelUsed(s))) { const slots = [1, 2, 3, 4, 5, 6, 7].filter(k => k === 4 ? Object.values(s.nades).some(n => n > 0) : k === 5 ? s.weapons[4] : s.weapons[k]); const cur = isNade(s.cur) ? 4 : WEAPONS[s.cur] ? (WEAPONS[s.cur].slot === 4 ? 5 : WEAPONS[s.cur].slot) : 1; let i = slots.indexOf(cur); i = (i + (I.mouse.wheel > 0 ? 1 : -1) + slots.length) % slots.length; s.switchSlot(slots[i]); }
    if (I.hit('KeyX') && s.last) s.switchTo(s.last);
    if (I.hit('KeyR') && !(w && (w.type === 'physgun' || w.type === 'tool'))) s.startReload();
    if (I.hit('KeyF') && !isNade(s.cur)) this.inspectT = 2.6;
    if (w && (w.type === 'physgun' || w.type === 'tool')) { if (s.drawT <= 0) Sandbox.useTool(s, 1 / 60); s.ads = false; }
    else if (isNade(s.cur)) {
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
    if (I.hit('KeyQ') && !Sandbox.on) this.spot(s);
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
/* Where each kind of weapon sits in the view, and where the hands hold it
   (in the gun's own space). Forearms run from the hands to elbows placed
   below the screen edge, so you only ever see hands, sleeves and the gun. */
const VM_POSE = {
  rifle:    { hip: [0.14, -0.15, -0.44], rot: [-0.045, 0.035, 0], rh: [0, -0.075, 0.1], lh: [0, -0.042, -0.29], rel: [0.13, -0.3, 0.32], lel: [-0.17, -0.3, 0.02], ads: -0.3 },
  smg:      { hip: [0.13, -0.14, -0.4], rot: [-0.045, 0.035, 0], rh: [0, -0.072, 0.075], lh: [0, -0.04, -0.2], rel: [0.13, -0.3, 0.3], lel: [-0.16, -0.3, 0.04], ads: -0.3 },
  lmg:      { hip: [0.145, -0.155, -0.44], rot: [-0.045, 0.035, 0], rh: [0, -0.075, 0.1], lh: [0, -0.045, -0.27], rel: [0.14, -0.3, 0.32], lel: [-0.18, -0.3, 0.02], ads: -0.3 },
  sniper:   { hip: [0.14, -0.15, -0.44], rot: [-0.045, 0.03, 0], rh: [0, -0.075, 0.13], lh: [0, -0.05, -0.16], rel: [0.13, -0.3, 0.34], lel: [-0.17, -0.3, 0.06], ads: -0.3 },
  shotgun:  { hip: [0.14, -0.145, -0.44], rot: [-0.045, 0.035, 0], rh: [0, -0.07, 0.09], lh: [0, -0.04, -0.34], rel: [0.13, -0.3, 0.3], lel: [-0.16, -0.3, -0.02], ads: -0.3, pump: true },
  pistol:   { hip: [0.11, -0.125, -0.36], rot: [0, 0.05, 0], rh: [0.004, -0.06, 0.035], lh: [-0.02, -0.07, 0.025], rel: [0.1, -0.3, 0.26], lel: [-0.1, -0.3, 0.24], ads: -0.38 },
  launcher: { hip: [0.13, -0.06, -0.22], rot: [0, 0.03, 0], rh: [0, -0.1, 0.02], lh: [0, -0.1, -0.2], rel: [0.13, -0.32, 0.26], lel: [-0.14, -0.32, -0.02], ads: -0.3 },
  knife:    { hip: [0.11, -0.11, -0.26], rot: [0.15, -0.35, 0.35], rh: [0, 0, 0.05], rel: [0.12, -0.28, 0.25], ads: -0.26 },
  nade:     { hip: [0.12, -0.11, -0.26], rot: [0.1, 0, 0.1], rh: [0, -0.02, 0.02], rel: [0.1, -0.28, 0.24], ads: -0.26 },
  tool:     { hip: [0.13, -0.14, -0.4], rot: [0, 0.04, 0], rh: [0, -0.065, 0.05], lh: [0, -0.04, -0.12], rel: [0.12, -0.3, 0.28], lel: [-0.15, -0.3, 0.06], ads: -0.22 },
};
function limb(a, b, w, m) {
  const d = new V3().subVectors(b, a), len = d.length();
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.9, len), m);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new V3(0, 0, 1), d.normalize());
  return o;
}
class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xfff4e8, 0x4a4a44, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(0.6, 1.4, 0.8); this.scene.add(d);
    const r = new THREE.DirectionalLight(0x9ab8ff, 0.5); r.position.set(-1, 0.2, -0.5); this.scene.add(r);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(255,210,120,1)', 'rgba(255,120,20,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.visible = false; this.scene.add(this.flash);
    this.key = null; this.gun = null; this.kick = 0; this.lastShot = -1; this.sway = { x: 0, y: 0 }; this.third = false; this.slash = 0; this.flashT = 0; this.pumpT = 0;
  }
  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  visible() { const s = Game.local; return s && s.alive && !this.third && !(s.w && s.w.scope && s.adsT > 0.85); }
  rebuild(s) {
    const it = isNade(s.cur) ? null : s.skinItem(s.cur), att = s.attach && s.attach[s.cur];
    const key = s.cur + ':' + (it ? it.uid || it.skinId + it.seed : '') + s.team + attSig(att);
    if (key === this.key) return; this.key = key;
    this.root.clear();
    const st = TEAM_STYLE[s.team] || TEAM_STYLE.CT, G = lam(st.glove), U = lam(st.uniform), C = lam(st.accent);
    const w = WEAPONS[s.cur];
    if (isNade(s.cur)) {
      const col = s.cur === 'frag' ? '#3a4a2a' : s.cur === 'flash' ? '#b8b8b8' : '#5a6a7a';
      this.gun = new THREE.Group(); this.gun.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.085, 12), lam(col))); this.gun.add(bx(0.012, 0.028, 0.012, lam('#999'), 0.014, 0.05, 0));
      this.gun.userData.muzzle = new THREE.Object3D(); this.gun.add(this.gun.userData.muzzle); this.gun.userData.sight = { y: 0 };
    } else this.gun = buildGun(s.cur, it, att);
    const type = isNade(s.cur) ? 'nade' : w.type === 'physgun' ? 'tool' : w.type;
    const P = this.pose = VM_POSE[type] || VM_POSE.rifle, L = w && w.type === 'smg' ? 0.72 : 1;
    const hand = (p, el) => {
      const h = new THREE.Group(), a = new V3(...p), e = new V3(...el);
      const glove = bx(0.044, 0.04, 0.07, G); glove.position.copy(a); h.add(glove);
      const cuff = a.clone().lerp(e, 0.16); h.add(limb(a.clone().lerp(e, 0.05), cuff, 0.034, C));
      h.add(limb(cuff, e, 0.042, U));
      return h;
    };
    const lhp = P.lh && (this.gun.userData.leftGrip ? [0, this.gun.userData.leftGrip.y, this.gun.userData.leftGrip.z] : P.lh);
    this.gun.add(hand(P.rh, P.rel));
    if (lhp) { this.leftHand = hand(lhp, P.lel); this.gun.add(this.leftHand); } else this.leftHand = null;
    this.root.add(this.gun);
    this.hip = new V3(...P.hip); this.hipRot = new THREE.Euler(...P.rot);
    const sy = this.gun.userData.sight || { y: 0.06 };
    this.adsPos = new V3(-(sy.x || 0), -sy.y, P.ads);
    this.laser = this.gun.userData.laser || null;
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
    if (s.lastShot !== this.lastShot) {
      this.lastShot = s.lastShot; this.kick = 1;
      if (w && w.type === 'knife') this.slash = 1;
      else if (w && w.mag) { this.flashT = w.suppressed ? 0.02 : 0.05; if (this.pose.pump || w.bolt) this.pumpT = 1; }
    }
    this.kick = Math.max(0, this.kick - dt * (w && w.type === 'sniper' ? 5 : 14)); this.slash = Math.max(0, this.slash - dt * 4); this.pumpT = Math.max(0, this.pumpT - dt * 2.2);
    this.sway.x = lerp(this.sway.x, clamp(-Input.mouse.dx * 0.00045, -0.03, 0.03), 1 - Math.exp(-dt * 10));
    this.sway.y = lerp(this.sway.y, clamp(Input.mouse.dy * 0.00045, -0.03, 0.03), 1 - Math.exp(-dt * 10));
    const hs = Math.hypot(s.vel.x, s.vel.z), a = s.adsT, bobA = Math.min(hs / 5, 1.3) * (s.grounded ? 1 : 0.25) * (1 - a * 0.9);
    const bx_ = Math.sin(s.walkPhase) * 0.009 * bobA, by = -Math.abs(Math.cos(s.walkPhase)) * 0.008 * bobA;
    const idle = Math.sin(Game.now * 1.6) * 0.0015 * (1 - a);
    const p = new V3().lerpVectors(this.hip, this.adsPos, a);
    let rx = lerp(this.hipRot.x, 0, a), ry = lerp(this.hipRot.y, 0, a), rz = lerp(this.hipRot.z, 0, a), oy = 0, oz = 0, ox = 0;
    if (s.drawT > 0) { const k = clamp(s.drawT / 0.5, 0, 1); oy -= k * 0.2; rx -= k * 0.7; }
    if (s.reloadT > 0 && w && w.reload) {
      const q = 1 - s.reloadT / w.reload, k = Math.sin(q * Math.PI);
      oy -= 0.05 * k; rz += 0.5 * k; rx += 0.18 * k; ox -= 0.02 * k;
      if (this.leftHand) this.leftHand.position.y = -Math.sin(clamp(q * 2, 0, 1) * Math.PI) * 0.08;   // hand drops to swap the mag
      if (g.userData.mag) g.userData.mag.visible = !(q > 0.25 && q < 0.55);
    } else { if (this.leftHand) this.leftHand.position.y = 0; if (g.userData.mag) g.userData.mag.visible = true; }
    if (this.pumpT > 0 && this.leftHand && this.pose.pump) this.leftHand.position.z = Math.sin(this.pumpT * Math.PI) * 0.06;
    if (this.pumpT > 0 && w && w.bolt) { const k = Math.sin(this.pumpT * Math.PI); rz += 0.2 * k; oy -= 0.015 * k; }
    if (Player.inspectT > 0) { const q = 1 - Player.inspectT / 2.6, k = Math.sin(q * Math.PI); ry += 1.1 * k; rz += 0.4 * Math.sin(q * Math.PI * 2); ox -= 0.03 * k; oy += 0.02 * k; }
    if (this.slash > 0) { const k = Math.sin((1 - this.slash) * Math.PI); ry -= 1.1 * k; rx -= 0.4 * k; ox -= 0.05 * k; }
    if (s.moveIn.sprint && hs > 6 && Game.mode.sprint) { rz += 0.35; ry += 0.55; oy -= 0.04; ox -= 0.02; }
    const kickK = w && w.recoil ? Math.min(1.4, 0.4 + w.recoil * 0.5) : 0.5, ak = 1 - a * 0.6;
    g.position.set(p.x + (bx_ + this.sway.x) * (1 - a * 0.7) + ox, p.y + by + idle + this.sway.y * (1 - a * 0.7) + oy, p.z + this.kick * 0.035 * kickK * ak + oz);
    g.rotation.set(rx + this.kick * 0.05 * kickK * ak, ry + this.sway.x * 1.5, rz);
    const fov = 62 - a * 10;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    // muzzle flash sprite
    this.flashT -= dt;
    if (this.flashT > 0) { g.updateMatrixWorld(true); g.userData.muzzle.getWorldPosition(this.flash.position); this.flash.scale.setScalar((w && w.suppressed ? 0.05 : 0.14) * rand(0.8, 1.2)); this.flash.material.rotation = rand(0, TAU); this.flash.visible = true; }
    else this.flash.visible = false;
  }
}
