/* ═══════════════════════════════════════════════════════════════════════════
   Helicopter pilots and armour.
   · Bots fly attack helicopters: a free one is handed to a nearby bot, who
     takes off, cruises to the objective, and when it finds enemies circles
     them, nose on, firing the minigun and rockets. Everyone shoots back.
   · Body armour in every mode: a plate carrier and helmet per class, worn
     on the model (and gone when it's shot off), with an armour bar.
   · Vehicle armour zones: tanks and APCs are tough from the front, weaker
     from the sides, and weakest from the rear and from above.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── helicopter pilots ─────────────────────────────────────────────────── */
const HeliAI = {
  t: 0,
  update(dt) {
    if (!Game.authority() || !Game.running) return;
    this.t -= dt; if (this.t > 0) return; this.t = 2;
    const sbx = Game.mode.id === 'sandbox'; if (!Game.mode.vehicles && !sbx) return;
    for (const v of Game.vehicles) {
      if (v.K.type !== 'heli' || !v.K.guns || !v.alive || v.driver || v.held || v.frozen) continue;
      if (v.crew && v.crew.alive && v.crew.brain && v.crew.brain.crew === v && !v.crew.vehicle) {
        if (Game.now - (v.crewT || 0) < 25) continue;
        v.crew.brain.crew = null; v.crew = null;   // taking too long to get there: someone else
      }
      let best = null, bd = sbx ? 45 : 110;
      for (const s of Game.soldiers) {
        if (s.ctrl !== 'bot' || !s.alive || s.vehicle || !s.brain || s.brain.constructor !== Brain || s.brain.crew || s.heldBy) continue;
        if (sbx ? !(s.team === 'T' || s.team === 'CT') : (s.team !== v.team || s.cls === 'engineer')) continue;
        const d = dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = s; }
      }
      if (best) { best.brain.crew = v; v.crew = best; v.crewT = Game.now; if (!sbx && Game.cmd[best.team]) Game.cmd[best.team].say(best, 'Taking the chopper up!', 4); }
    }
  },
};
const _aiUpdate24 = AI.update.bind(AI);
AI.update = function (dt) { _aiUpdate24(dt); HeliAI.update(dt); };
const _brainUpdate24 = Brain.prototype.update;
Brain.prototype.update = function (dt) {
  const s = this.s;
  if (s.alive && s.vehicle && s.vehicle.driver === s && s.vehicle.K.type === 'heli') return this.driveHeli(dt);
  return _brainUpdate24.call(this, dt);
};
const _brainReset24 = Brain.prototype.reset;
Brain.prototype.reset = function () { _brainReset24.call(this); this.heli = null; };
/* height of whatever is under (x, z) */
function groundUnder(x, z, fromY) { const t = World.raycast(x, fromY, z, 0, -1, 0, fromY + 5); return t >= 0 ? fromY - t : 0; }
Brain.prototype.driveHeli = function (dt) {
  const s = this.s, v = s.vehicle, now = Game.now, H = this.heli || (this.heli = { orbit: rand(0, TAU), dir: chance(0.5) ? 1 : -1, senseT: 0, errT: 0, ex: 0, ey: 0, rkT: 0, home: v.pos.clone() });
  s.pos.set(v.pos.x, v.pos.y, v.pos.z); s.vel.set(0, 0, 0); s.moveIn.f = s.moveIn.s = 0;
  if (!v.alive) return;
  if (v.hp < v.maxHp * 0.15 && v.pos.y < 3) { Game.exitVehicle(s); return; }
  // find something to shoot: soldiers and vehicles we can see from the cockpit
  H.senseT -= dt;
  if (H.senseT <= 0) {
    H.senseT = 0.4; const e0 = new V3(v.pos.x, v.pos.y + 1.2, v.pos.z); let best = null, bd = 170;
    for (const e of Game.soldiers) {
      if (!e.alive || !Game.hostile(s, e)) continue;
      const p = e.vehicle ? e.vehicle.pos : e.pos, d = Math.hypot(p.x - v.pos.x, p.z - v.pos.z); if (d > bd) continue;
      if (!World.los(e0.x, e0.y, e0.z, p.x, p.y + 1.1, p.z)) continue;
      best = e; bd = d * (e.vehicle ? 0.7 : 1);
    }
    H.tgt = best;
  }
  const tgt = H.tgt && H.tgt.alive ? H.tgt : null, tp = tgt ? (tgt.vehicle ? tgt.vehicle.pos : tgt.pos) : null;
  // where to be: circling the target, or cruising to the objective
  let P, alt, face;
  if (tgt) {
    H.orbit += H.dir * dt * 0.28; const R = tgt.vehicle ? 60 : 48;
    P = { x: tp.x + Math.cos(H.orbit) * R, z: tp.z + Math.sin(H.orbit) * R }; alt = 24; face = Math.atan2(-(tp.x - v.pos.x), -(tp.z - v.pos.z));
  } else {
    let f = null;
    if (Game.mode.id === 'conquest') { const q = this.order && this.order.flag; f = q || World.flags.filter(x => x.owner !== s.team).sort((a, b) => dist2(a.x, a.z, v.pos.x, v.pos.z) - dist2(b.x, b.z, v.pos.x, v.pos.z))[0] || null; }
    else { const cmd = Game.cmd[s.team], it = cmd && [...cmd.intel.values()].filter(i => now - i.t < 20).sort((a, b) => b.t - a.t)[0]; if (it) f = it.pos; }
    const T = f || H.home; H.orbit += H.dir * dt * 0.15;
    P = { x: T.x + Math.cos(H.orbit) * 35, z: T.z + Math.sin(H.orbit) * 35 }; alt = 32; face = Math.atan2(-(P.x - v.pos.x), -(P.z - v.pos.z));
  }
  const B = World.bounds; P.x = clamp(P.x, B.x0 + 12, B.x1 - 12); P.z = clamp(P.z, B.z0 + 12, B.z1 - 12);
  // stay clear of the ground and of anything ahead
  const fwdX = -Math.sin(v.yaw), fwdZ = -Math.cos(v.yaw), ahead = World.raycast(v.pos.x, v.pos.y + 1, v.pos.z, fwdX, 0, fwdZ, 30);
  const floor = Math.max(groundUnder(v.pos.x, v.pos.z, v.pos.y + 1), groundUnder(v.pos.x + fwdX * 20, v.pos.z + fwdZ * 20, 80));
  let wantY = floor + alt; if (ahead >= 0) wantY = Math.max(wantY, v.pos.y + 8);
  const dx = P.x - v.pos.x, dz = P.z - v.pos.z, dist = Math.hypot(dx, dz), k = Math.min(1, dist / 18);
  const mx = dist > 0.1 ? dx / dist * k : 0, mz = dist > 0.1 ? dz / dist * k : 0;
  const rise = v.pos.y < 2.5 && v.rotorK < 0.95;   // spin up before moving off the pad
  v.inp = { f: rise ? 0 : mx * fwdX + mz * fwdZ, s: rise ? 0 : mx * Math.cos(v.yaw) - mz * Math.sin(v.yaw), up: v.pos.y < wantY - 1 ? 1 : 0, down: v.pos.y > wantY + 2 ? 1 : 0 };
  if (ahead >= 0 && ahead < 14) v.inp.f = Math.min(v.inp.f, 0);
  s.yaw = angWrap(face);
  // guns: nose on, a little wobble by skill
  if (tgt) {
    const m = new V3(v.pos.x, v.pos.y + 0.8, v.pos.z), hd = Math.hypot(tp.x - m.x, tp.z - m.z);
    H.errT -= dt; if (H.errT <= 0) { H.errT = 0.8; const e = this.d.err * 0.012 + (tgt.vehicle ? 0 : 0.02); H.ex = rand(-e, e); H.ey = rand(-e, e); }
    s.yaw = angWrap(face + H.ex); s.pitch = Math.atan2(tp.y + 1 - m.y, hd) + H.ey;
    const aligned = Math.abs(angDiff(v.yaw, face)) < 0.1;
    H.burst = (H.burst || 0) + dt; const on = H.burst % 3 < 1.4;   // fire in bursts
    if (aligned && on && hd < 150 && !rise) v.shoot(s, 'lmb');
    H.rkT -= dt; if (aligned && hd < 110 && H.rkT <= 0 && (tgt.vehicle || hd < 70)) { if (v.shoot(s, 'rmb')) H.rkT = tgt.vehicle ? 0.4 : 3.5; }
  } else s.pitch = 0;
};

/* ── body armour for everyone ──────────────────────────────────────────── */
for (const m of ['conquest', 'tdm', 'sandbox']) if (MODES[m]) MODES[m].armor = true;
const CLASS_ARMOUR = { assault: [75, true], engineer: [50, true], support: [100, true], recon: [25, false] };
const _giveClass24 = Game.giveClass.bind(Game);
Game.giveClass = function (s) { _giveClass24(s); const a = CLASS_ARMOUR[s.cls] || [50, true]; s.armor = a[0]; s.helmet = a[1]; };
const _sbxLoadout24 = Sandbox.loadout.bind(Sandbox);
Sandbox.loadout = function (s) { _sbxLoadout24(s); s.armor = 50; s.helmet = true; };
const _sbxApply24 = Sandbox.apply.bind(Sandbox);
Sandbox.apply = function (ev) { const r = _sbxApply24(ev); if (ev.e === 'npc') { const s = Game.byId(ev.id); if (s && (ev.k === 'aegis' || ev.k === 'vanta')) { s.armor = 50; s.helmet = true; } } return r; };
Object.assign(CLASSES.assault, { desc: CLASSES.assault.desc + ' Medium armour.' }); Object.assign(CLASSES.engineer, { desc: CLASSES.engineer.desc + ' Light armour.' });
Object.assign(CLASSES.support, { desc: CLASSES.support.desc + ' Heavy armour.' }); Object.assign(CLASSES.recon, { desc: CLASSES.recon.desc + ' Barely any armour, no helmet.' });
/* worn on the model */
const _sync24 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) {
  const u = this.model && this.model.userData;
  if (u && u.vest) { const armoured = Game.mode && Game.mode.armor && !this.npc || this.armor > 0; u.vest.visible = armoured && this.armor > 0; u.helmet.visible = !!this.helmet || !(Game.mode && Game.mode.armor); }
  return _sync24.call(this, dt, localTeam, viewer);
};
/* armour bar */
const _hudUpdate24 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hudUpdate24(dt);
  const L = Game.local; if (!L || !Game.running) return;
  let bar = document.getElementById('armorbar');
  if (!bar) { const hw = this.el.hpbar && this.el.hpbar.parentElement; if (!hw) return; const w = document.createElement('div'); w.className = 'hpwrap armwrap'; bar = document.createElement('div'); bar.id = 'armorbar'; w.appendChild(bar); hw.after(w); }
  bar.parentElement.style.display = Game.mode.armor ? '' : 'none'; bar.style.width = clamp(L.armor, 0, 100) + '%';
  if (Game.mode.armor && Game.mode.classes) this.el.armor.textContent = `${CLASSES[L.cls].name} · 🛡 ${Math.ceil(L.armor)}${L.helmet ? ' +H' : ''}` + (L.medkits ? ` · ✚${L.medkits}` : '') + (L.ammoBoxes ? ` · ▣${L.ammoBoxes}` : '');
};

/* ── vehicle armour zones ──────────────────────────────────────────────── */
let _blastAt = null;
const _explosion24 = Game.explosion.bind(Game);
Game.explosion = function (p, dmg, radius, owner, weapon) { _blastAt = p; try { return _explosion24(p, dmg, radius, owner, weapon); } finally { _blastAt = null; } };
function armourZone(v, from) {
  if (!v.K.turret || !from) return { k: 1, z: '' };
  const dx = from.x - v.pos.x, dy = from.y - (v.pos.y + 1.2), dz = from.z - v.pos.z, l = Math.hypot(dx, dy, dz) || 1;
  if (dy / l > 0.6) return { k: 1.5, z: 'top' };
  const f = (dx * -Math.sin(v.yaw) + dz * -Math.cos(v.yaw)) / (Math.hypot(dx, dz) || 1);   // +1 in front, -1 behind
  return f > 0.5 ? { k: 0.6, z: 'front' } : f < -0.5 ? { k: 1.7, z: 'rear' } : { k: 1, z: 'side' };
}
const _vdamage24 = Vehicle.prototype.damage;
Vehicle.prototype.damage = function (d, by) {
  const from = _blastAt || (by && by.pos ? new V3(by.pos.x, (by.eyeY != null ? by.eyeY : by.pos.y + 1.6), by.pos.z) : null), Z = armourZone(this, from);
  if (Z.k > 1.2 && by && by.ctrl === 'local' && this.alive) HUD.center(Z.z === 'rear' ? 'Rear armour hit!' : 'Top armour hit!', 0.6);
  return _vdamage24.call(this, d * Z.k, by);
};
