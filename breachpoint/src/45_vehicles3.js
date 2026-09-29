/* ═══════════════════════════════════════════════════════════════════════════
   Vehicles, part three (v2.9).
   · Tanks carry a second crew member on the roof: a pintle machine gun that
     swings with the gunner's aim. The gunner is exposed (can be shot) and
     can be a bot: squadmates and nearby teammates hop on.
   · Dockyard: two patrol boats in the harbour basin (TDM and Zombies).
   ═══════════════════════════════════════════════════════════════════════════ */
Object.assign(VKIND.tank, { seats: 2, seatAt: [0, 2.3, 0], seatAt2: [0.55, 2.75, 0.75], pguns: { wid: 'hmg', rpm: 600, dmg: 32, spread: 0.014 } });
const _buildTank45 = VKIND.tank.build;
VKIND.tank.build = function (team) {
  const g = _buildTank45(team), K = lam('#1c1c1c'), M = lam('#3a3a3a');
  const pin = new THREE.Group(); pin.position.set(0.55, 2.55, 0.35);
  pin.add(bx(0.06, 0.35, 0.06, M, 0, 0.1, 0)); const gun = new THREE.Group(); gun.position.y = 0.3; pin.add(gun);
  gun.add(bx(0.12, 0.12, 0.5, K, 0, 0, -0.1)); gun.add(cyl(0.025, 0.7, K, 0, 0, -0.65)); gun.add(bx(0.4, 0.3, 0.03, M, 0, 0.05, -0.28));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -1.0); gun.add(muzzle);
  g.add(pin); g.userData.pintle = pin; g.userData.pintleGun = gun; g.userData.pintleMuzzle = muzzle;
  return g;
};
/* the roof gun, fired from wherever the gunner is looking */
function pintleFire(s, v) {
  const G = v.K.pguns, st = v.gunState('pintle'); if (st.cd > 0) return false; st.cd = 60 / G.rpm;
  v.model.updateMatrixWorld(true); const from = v.model.userData.pintleMuzzle.getWorldPosition(new V3());
  const dir = aimPoint(s, v).sub(from).normalize(); dir.add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(G.spread)).normalize();
  vehHitscan(v, s, from, dir, { dmg: G.dmg, wid: G.wid }); return true;
}
const _fire45 = fireWeapon;
fireWeapon = function (s, now, rc) {
  const v = s.vehicle; if (v && v.passenger === s && v.K.pguns) return pintleFire(s, v);
  return _fire45(s, now, rc);
};
/* the gun follows the gunner; cooldowns tick */
function posePintle(v, dt) {
  const u = v.model.userData; if (!u.pintle) return; const p = v.passenger;
  if (p) { u.pintle.rotation.y = angDiff(v.yaw, p.yaw); u.pintleGun.rotation.x = clamp(p.pitch, -0.3, 0.6); }
  const st = v.guns && v.guns.pintle; if (st) st.cd -= dt;
}
const _pcam45 = Player.camera;
Player.camera = function (s, dt) {
  const v = s.vehicle;
  if (s.alive && v && v.passenger === s && v.K.pguns) {
    const V = Game.view, cam = Game.camera, f = s.forward(new V3()); V.third = true;
    const e = v.seatPos(new V3(), s), c = e.clone().addScaledVector(new V3(f.x, 0, f.z).normalize(), -1.9).add(new V3(0, 0.75, 0));
    cam.position.lerp(c, 1 - Math.exp(-dt * 16)); cam.lookAt(e.clone().addScaledVector(f, 40)); cam.fov = Settings.fov; cam.updateProjectionMatrix(); return;
  }
  return _pcam45.call(this, s, dt);
};
const _vehicleHint45 = vehicleHint;
vehicleHint = function (L) { const v = L.vehicle; if (v && v.passenger === L && v.K.pguns) return `${v.K.name} gunner · LMB roof MG · E get off`; return _vehicleHint45(L); };
const _hud45 = HUD.update.bind(HUD);
HUD.update = function (dt) { _hud45(dt); const L = Game.local; if (L && L.alive && L.vehicle && L.vehicle.passenger === L && L.vehicle.K.pguns) this.el.xh.classList.remove('hidden'); };
/* bot gunners: the ride-along code already aims; let it through for tanks */
const _ride45 = Brain.prototype.rideAlong;
Brain.prototype.rideAlong = function (dt) {
  const s = this.s, v = s.vehicle; if (!v || !v.K.pguns) return _ride45.call(this, dt);
  const now = Game.now, coming = !v.driver && v.crew && v.crew.alive && v.crew.brain && v.crew.brain.crew === v && now - (v.crewT || 0) < 20;
  if (!v.alive || (!coming && (!v.driver || !v.driver.alive))) { Game.exitVehicle(s); return; }
  s.pos.set(v.pos.x, v.pos.y, v.pos.z); s.vel.set(0, 0, 0); s.moveIn.f = s.moveIn.s = 0;
  this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.15; this.sense(); }
  const e = this.target && this.target.alive ? this.target : null, m = e && this.mem.get(e.id);
  if (!e || !m || !m.vis) { this.turnTo(v.yaw + v.tYaw, 0, dt, 2); return; }
  const eye = s.eye(new V3()), p = e.vehicle ? e.vehicle.pos : e.pos, hb = e.hitboxes(), ay = e.vehicle ? p.y + 1.1 : hb.baseY + hb.h * 0.6, hd = Math.hypot(p.x - eye.x, p.z - eye.z);
  const wy = Math.atan2(-(p.x - eye.x), -(p.z - eye.z)) + rand(-0.02, 0.02), wp = Math.atan2(ay - eye.y, hd) + rand(-0.02, 0.02);
  this.turnTo(wy, wp, dt, this.d.turn * 1.2);
  this.burst = (this.burst || 0) + dt;
  if (this.burst % 1.6 < 0.9 && hd < 140 && Math.abs(angDiff(s.yaw, wy)) + Math.abs(s.pitch - wp) < 0.1) pintleFire(s, v);
};
const _pickBuddy45 = pickBuddy;
pickBuddy = function (v, driver) { if (v.K.pguns && !v.passenger) { const c = v.K.closed; v.K.closed = false; try { return _pickBuddy45(v, driver); } finally { v.K.closed = c; } } return _pickBuddy45(v, driver); };
/* bot tank drivers wait a moment for their gunner and pick one up */
const _tankUpdate45 = TankAI.update.bind(TankAI);
TankAI.update = function (dt) {
  const before = new Map(Game.vehicles.map(v => [v, v.crew]));
  _tankUpdate45(dt);
  for (const v of Game.vehicles) if (v.K.pguns && v.crew && before.get(v) !== v.crew && !v.passenger && !v.buddy) pickBuddy(v, v.crew);
};
const _driveTank45 = Brain.prototype.driveTank;
Brain.prototype.driveTank = function (dt) {
  const s = this.s, v = s.vehicle, now = Game.now;
  if (v && v.K.pguns) {
    if (!this.tankBoard) this.tankBoard = now;
    const b = v.buddy; if (b && b.alive && b.brain && b.brain.ride2 === v && !b.vehicle && !v.passenger && now - this.tankBoard < 7) { v.drive({ f: 0, s: 0, brake: true }, dt); return; }
  }
  return _driveTank45.call(this, dt);
};
const _reset45 = Brain.prototype.reset;
Brain.prototype.reset = function () { _reset45.call(this); this.tankBoard = 0; };
const _gupdate45 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate45(dt); if (!this.running) return; for (const v of this.vehicles) if (v.K.pguns && v.alive) posePintle(v, dt); };

/* Dockyard boats */
{ const b = MAPS.dockyard.build; MAPS.dockyard.build = function () { const r = b.apply(this, arguments); World.vehicleSpawns.push({ team: 'CT', x: -20, z: -43, yaw: -Math.PI / 2, kind: 'boat' }, { team: 'T', x: 20, z: -43, yaw: Math.PI / 2, kind: 'boat' }); return r; }; }
