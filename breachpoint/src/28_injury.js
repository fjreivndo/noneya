/* ═══════════════════════════════════════════════════════════════════════════
   Injuries (bots and soldier NPCs).
   · Leg hits: a limp. Slower, no sprinting, an uneven gait.
   · Arm hits: worse aim. Bigger aim error, slower turning and settling.
   · Bleeding: heavy hits bleed hit points over time and leave a blood trail,
     until the bot finds a quiet moment to bandage up (or it stops by itself).
   · Downed: a hit that would kill (not a headshot or explosion) can drop a
     bot instead. It crawls toward its squad and bleeds out in 20 s unless a
     teammate revives it: bots come over and revive their friends, and you
     can hold E on a downed teammate. Enemies can finish it off.
   Injuries clear on respawn, medkit, or health regenerating to full.
   ═══════════════════════════════════════════════════════════════════════════ */
const INJ_W = new Set(['fall', 'drown', 'bleed', 'jeep', 'car', 'bike', 'quad', 'apc', 'tank']);
function inj(s) { return s.inj || (s.inj = { leg: 0, arm: 0, bleed: 0 }); }
function injurable(s) { return s.ctrl === 'bot' || (s.ctrl === 'puppet' && s.isBot) || s.npc === 'aegis' || s.npc === 'vanta'; }
const Injury = {
  sendT: new Map(),
  /* tell clients (throttled) */
  sync(s, force) {
    if (Net.role !== 'host') return; const t = this.sendT.get(s.id) || 0; if (!force && Game.now - t < 0.5) return; this.sendT.set(s.id, Game.now);
    const I = inj(s); Net.event({ t: 'inj', id: s.id, l: +I.leg.toFixed(2), a: +I.arm.toFixed(2), b: +I.bleed.toFixed(2), d: s.downed ? 1 : 0 });
  },
  clear(s) { s.inj = { leg: 0, arm: 0, bleed: 0 }; s.downed = false; s.bleedOut = 0; s.reviver = null; s.bandT = 0; this.sync(s, true); },
  down(s, att, weapon) {
    inj(s); s.downed = true; s.hp = 30; s.bleedOut = 20; s.downBy = att ? att.id : null; s.downW = weapon; s.vel.set(0, 0, 0); s.reviver = null;
    if (s.vehicle) Game.exitVehicle(s);
    if (att && att.ctrl === 'local') HUD.center('Enemy down', 0.8);
    if (Game.cmd[s.team] && Game.mode.id !== 'sandbox') Game.cmd[s.team].say(s, "I'm down! Need a revive!", 2);
    this.sync(s, true);
  },
  revive(s, by) {
    if (!s.alive || !s.downed) return; s.downed = false; s.hp = 40; s.bleedOut = 0; s.reviver = null; const I = inj(s); I.bleed = 0;
    s.spawnProt = Game.now + 1; if (by && by.ctrl === 'local') HUD.center(`Revived ${s.name}`, 1); if (by) by.revives = (by.revives || 0) + 1;
    this.sync(s, true);
  },
  update(dt) {
    const host = Game.authority();
    for (const s of Game.soldiers) {
      if (!s.alive) { if (s.downed) s.downed = false; continue; }
      const I = s.inj; if (!I) continue;
      // blood trail
      if ((I.bleed > 0.05 || s.downed) && Math.random() < dt * (s.downed ? 5 : 3)) {
        const y = s.pos.y + (s.downed ? 0.3 : 1.0); FX.emit('norm', s.pos.x + rand(-0.2, 0.2), y, s.pos.z + rand(-0.2, 0.2), 2, 0.5, [0.4, 0.02, 0.02], 0.5, -9, 0.3);
        if (Settings.blood && Math.random() < 0.3) BloodDecals.put(new V3(s.pos.x + rand(-0.3, 0.3), World.floorAt(s.pos.x, s.pos.z) + 0.01, s.pos.z + rand(-0.3, 0.3)), new V3(0, 1, 0), rand(0.15, 0.32));
      }
      if (!host) continue;
      if (s.downed) {
        s.bleedOut -= dt; s.hp = Math.max(1, 30 * s.bleedOut / 20); s.lastDamage = Game.now;
        if (s.reviver && !(s.reviver.alive && !s.reviver.downed && dist2(s.reviver.pos.x, s.reviver.pos.z, s.pos.x, s.pos.z) < 30)) s.reviver = null;
        if (s.bleedOut <= 0) { s.downed = false; s._finish = true; Game.kill(s, Game.byId(s.downBy), s.downW || 'knife', false); s._finish = false; }
        continue;
      }
      if (I.bleed > 0) {
        s.hp -= I.bleed * dt; s.lastDamage = Game.now; I.bleed = Math.max(0, I.bleed - dt * 0.06);   // clots slowly
        if (s.hp < 5) { s.hp = 5; }
        if (I.bleed === 0) this.sync(s, true);
      }
      if (s.hp >= 97 && (I.leg || I.arm || I.bleed)) this.clear(s);
    }
  },
};

/* hits cause injuries; a killing hit may down instead */
const _damage28 = Game.damage.bind(Game);
Game.damage = function (v, dmg, att, weapon, zone = 'chest', from) {
  const alive = v && v.alive, hp0 = v && v.hp;
  const r = _damage28(v, dmg, att, weapon, zone, from);
  if (!alive || !v.alive || !injurable(v) || v.hp >= hp0 || INJ_W.has(weapon)) return r;
  v.lastHitT = Game.now;
  const I = inj(v), lost = hp0 - v.hp, boom = EXPLOSIVE_KILLS.includes(weapon) || !!(WEAPONS[weapon] && WEAPONS[weapon].explosive);
  if (zone === 'legs') I.leg = Math.min(1, I.leg + lost / 45);
  else if ((zone === 'chest' || zone === 'stomach') && chance(0.35)) I.arm = Math.min(1, I.arm + lost / 55);
  if (boom) { I.leg = Math.min(1, I.leg + lost / 90); I.arm = Math.min(1, I.arm + lost / 120); }
  if (lost >= 14) I.bleed = Math.min(4, I.bleed + lost / 22);
  if (v.downed) { v.hp = Math.max(1, v.hp); }
  Injury.sync(v);
  return r;
};
const _kill28 = Game.kill.bind(Game);
Game.kill = function (v, att, weapon, hs) {
  if (v && v.alive && !v.downed && !v._finish && !hs && injurable(v) && !v.vehicle && v.hp > -45 && !INJ_W.has(weapon) && weapon !== 'knife'
    && !(EXPLOSIVE_KILLS.includes(weapon) || (WEAPONS[weapon] && WEAPONS[weapon].explosive)) && chance(0.5) && !Game.matchOver) { Injury.down(v, att, weapon); return; }
  if (v) v.downed = false;
  return _kill28(v, att, weapon, hs);
};
const _respawn28 = Game.respawn.bind(Game);
Game.respawn = function (s, where) { const r = _respawn28(s, where); if (s.inj || s.downed) Injury.clear(s); return r; };
const _useMed28 = Game.useMed.bind(Game);
Game.useMed = function (s) { const r = _useMed28(s); if (r && s.inj) Injury.clear(s); return r; };

/* limp, weaker aim */
const _maxSpeed28 = Soldier.prototype.maxSpeed;
Soldier.prototype.maxSpeed = function () {
  if (this.downed) return 0.75;
  const m = _maxSpeed28.call(this), I = this.inj; if (!I || !I.leg) return m;
  return Math.min(m, PHYS.walk * (1 - 0.45 * I.leg));
};
const _dGet28 = Object.getOwnPropertyDescriptor(Brain.prototype, 'd').get;
Object.defineProperty(Brain.prototype, 'd', { configurable: true, get() {
  const b = _dGet28.call(this), I = this.s.inj; if (!I || !I.arm) return b;
  const k = I.arm; return Object.assign({}, b, { err: b.err * (1 + 1.6 * k), turn: b.turn / (1 + 0.8 * k), settle: b.settle * (1 + 0.8 * k), react: b.react * (1 + 0.3 * k), recoil: b.recoil * (1 - 0.4 * k) });
} });
/* downed hitbox: lying on the ground in front of their feet */
const _hitboxes28 = Soldier.prototype.hitboxes;
Soldier.prototype.hitboxes = function () {
  if (!this.downed) return _hitboxes28.call(this);
  const p = this.pos, fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), bxc = p.x + fx * 0.8, bzc = p.z + fz * 0.8, hx = p.x + fx * 1.55, hz = p.z + fz * 1.55;
  return { head: { x0: hx - 0.15, x1: hx + 0.15, y0: p.y, y1: p.y + 0.32, z0: hz - 0.15, z1: hz + 0.15 }, body: { x0: bxc - 0.6, x1: bxc + 0.6, y0: p.y, y1: p.y + 0.4, z0: bzc - 0.6, z1: bzc + 0.6 }, baseY: p.y, h: 0.4 };
};

/* ── bot behaviour: crawl when down, bandage, revive friends ───────────── */
const _brainUpdate28 = Brain.prototype.update;
Brain.prototype.update = function (dt) {
  const s = this.s, m = s.moveIn;
  if (!s.alive) return _brainUpdate28.call(this, dt);
  if (s.downed) {
    m.f = m.s = 0; m.jump = m.sprint = m.walk = false; m.crouch = true; this.target = null;
    // crawl toward the nearest friend
    let best = null, bd = 40; for (const e of Game.soldiers) { if (e === s || !e.alive || e.downed || e.team !== s.team) continue; const d = dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z); if (d < bd) { bd = d; best = e; } }
    if (best && bd > 2) { this.moveTo(best.pos, dt, false, true, false); m.sprint = false; m.crouch = true; }
    return;
  }
  // a friend is down: go and pick them up
  const R = this.reviving;
  if (R && (!R.alive || !R.downed || R.reviver !== s || (this.target && this.target.alive))) { if (R.reviver === s) R.reviver = null; this.reviving = null; this.reviveT = 0; }
  if (!this.reviving && !(this.target && this.target.alive) && !s.vehicle && !this.crew && !s.planting && (this.reviveScan = (this.reviveScan || 0) - dt) <= 0) {
    this.reviveScan = 0.5;
    for (const e of Game.soldiers) if (e.downed && e.alive && e.team === s.team && !e.reviver && dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z) < 28) { e.reviver = s; this.reviving = e; this.reviveT = 0; break; }
  }
  if (this.reviving) {
    const e = this.reviving, d = dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z);
    this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.15; this.sense(); }
    if (d > 1.5) { this.moveTo(e.pos, dt, false, false, true); this.reviveT = 0; }
    else { m.f = m.s = 0; m.crouch = true; m.sprint = false; this.reviveT += dt; this.turnTo(Math.atan2(-(e.pos.x - s.pos.x), -(e.pos.z - s.pos.z)), -0.6, dt, 6);
      if (this.reviveT > 3) { Injury.revive(e, s); this.reviving = null; if (Game.cmd[s.team] && Game.mode.id !== 'sandbox') Game.cmd[s.team].say(s, `Got you, ${e.name}. Back in it!`, 2); } }
    return;
  }
  // bandage when it's quiet
  const I = s.inj;
  if (I && I.bleed > 0.3 && !(this.target && this.target.alive) && !s.vehicle && Game.now - (s.lastHitT || -9) > 2.5 && !s.planting) {
    this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.15; this.sense(); }
    if (!(this.target && this.target.alive)) { m.f = m.s = 0; m.crouch = true; m.sprint = false; s.bandT = (s.bandT || 0) + dt; if (s.bandT > 3) { I.bleed = 0; s.bandT = 0; Injury.sync(s, true); } return; }
  } else s.bandT = 0;
  return _brainUpdate28.call(this, dt);
};

/* ── the player revives teammates: hold E ──────────────────────────────── */
const Revive = { tgt: null, t: 0 };
function downedNear(s) { let best = null, bd = 2.2; for (const e of Game.soldiers) { if (!e.alive || !e.downed || e.team !== s.team || e === s) continue; const d = dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z); if (d < bd) { bd = d; best = e; } } return best; }
const _pcontrols28 = Player.controls.bind(Player);
Player.controls = function (s, dt) {
  const I = Input;
  if (!s.vehicle && (Revive.tgt || I.hit('KeyE'))) {
    const e = Revive.tgt || downedNear(s);
    if (e && I.down('KeyE') && e.alive && e.downed && dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z) < 2.6) {
      Revive.tgt = e; Revive.t += dt; s.moveIn.crouch = true; HUD.center(`Reviving ${e.name}… ${Math.min(100, Math.round(Revive.t / 2.5 * 100))}%`, 0.2);
      if (Revive.t >= 2.5) { if (Game.authority()) Injury.revive(e, s); else Net.send({ t: 'revive', id: e.id }); Revive.tgt = null; Revive.t = 0; }
      const yaw = s.yaw, pitch = s.pitch; _pcontrols28(s, dt); s.yaw = yaw; s.pitch = pitch; s.moveIn.f = s.moveIn.s = 0; return;   // stay put while reviving
    }
    Revive.tgt = null; Revive.t = 0;
  }
  return _pcontrols28(s, dt);
};
/* E on a downed friend shouldn't also get into a nearby jeep */
const _tryEnter28 = Game.tryEnterVehicle.bind(Game);
Game.tryEnterVehicle = function (s) { if (s.ctrl === 'local' && !s.vehicle && Revive.tgt) return true; return _tryEnter28(s); };
const _hostData28 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  if (m && m.t === 'revive') { const p = this.peers.get(id), s = p && p.sid && Game.byId(p.sid), e = Game.byId(m.id); if (s && e && e.downed && e.team === s.team && dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z) < 3.5) Injury.revive(e, s); return; }
  return _hostData28(id, m);
};
const _applyEvent28 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  if (e && e.t === 'inj') { const s = Game.byId(e.id); if (s) { s.inj = { leg: e.l, arm: e.a, bleed: e.b }; s.downed = !!e.d; } return; }
  return _applyEvent28(e);
};
const _gupdate28 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate28(dt); if (this.running) Injury.update(dt); };
/* HUD hint for the player */
const _hud28 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hud28(dt); const L = Game.local; if (!L || !L.alive || L.vehicle) return;
  const e = !Revive.tgt && downedNear(L); if (e && this.el.hint) { this.el.hint.textContent = `Hold E — revive ${e.name}`; this.el.hint.style.opacity = 1; }
};

/* ── how injuries look ─────────────────────────────────────────────────── */
const _sync28 = Soldier.prototype.syncModel;
Soldier.prototype.syncModel = function (dt, localTeam, viewer) {
  const r = _sync28.call(this, dt, localTeam, viewer);
  if (!this.alive || !this.model || !this.model.visible || this.rag || this.vehicle) return r;
  const u = this.model.userData, I = this.inj;
  if (this.downed) {
    // prone, crawling
    const sp = Math.hypot(this.vel.x, this.vel.z), ph = Game.now * 5 * Math.min(1, sp);
    u.body.rotation.x = -Math.PI / 2 + 0.08; u.body.position.y = 0.14;
    u.legL.rotation.x = Math.sin(ph) * 0.35; u.legR.rotation.x = -Math.sin(ph) * 0.35;
    u.upper.rotation.x = 0.35; u.head.rotation.x = 0.5; u.arms.rotation.x = 1.0 + Math.sin(ph) * 0.3;
    if (u.gunMount) u.gunMount.visible = false;
    return r;
  }
  if (u.gunMount && !this.emote) u.gunMount.visible = true;
  if (!I) return r;
  if (I.leg > 0.1) {   // limp: the hurt leg barely bends and the body dips on it
    const hs = Math.hypot(this.vel.x, this.vel.z), k = Math.min(hs / 3, 1) * I.leg, ph = this.walkPhase * 2;
    u.legR.rotation.x *= 1 - 0.7 * I.leg; u.body.position.y -= Math.max(0, Math.sin(ph)) * 0.08 * k; u.upper.rotation.z += Math.sin(ph) * 0.12 * k;
  }
  if (this.bandT > 0.2) { u.arms.rotation.x = -0.9; u.upper.rotation.x = 0.4; u.head.rotation.x = 0.5; }
  return r;
};
