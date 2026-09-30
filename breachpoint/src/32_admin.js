/* ═══════════════════════════════════════════════════════════════════════════
   Admin menu: cheats behind a password.
   F8 in a match (or "Admin" in the pause menu) asks for the password once per
   session. Cheats work in solo games and for the host; a client in someone
   else's game only gets the ones that touch their own screen.
   ═══════════════════════════════════════════════════════════════════════════ */
const Admin = {
  ok: false, el: null,
  opt: { god: false, ammo: false, rapid: false, oneHit: false, speed: false, moon: false, freezeBots: false, slow: 1, thirdOnly: false },
  host() { return Game.authority(); },
  open() {
    if (!Game.running) return;
    if (!this.ok) {
      UI.askText('Admin password', '', v => { if (v === '2224') { this.ok = true; this.show(); } else HUD.center('Wrong password', 1.2); }, { max: 12, hint: 'Enter to unlock · Esc cancels' });
      const inp = document.getElementById('askIn'); if (inp) inp.type = 'password';
      return;
    }
    this.show();
  },
  show() {
    let el = this.el; if (!el) { el = this.el = document.createElement('div'); el.id = 'admin'; el.className = 'ov hidden'; document.body.appendChild(el); }
    const L = Game.local, O = this.opt, H = this.host(), sw = (k, label, hostOnly) => `<label class="adm-sw ${hostOnly && !H ? 'off' : ''}"><input type="checkbox" data-o="${k}" ${O[k] ? 'checked' : ''} ${hostOnly && !H ? 'disabled' : ''}> ${label}</label>`;
    const btn = (id, label, hostOnly) => `<button class="btn ${hostOnly && !H ? 'dis' : ''}" data-a="${id}" ${hostOnly && !H ? 'disabled' : ''}>${label}</button>`;
    const guns = Object.values(WEAPONS).filter(w => w.slot && w.slot <= 5 && !w.hidden).map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    const vehs = Object.entries(VKIND).map(([k, K]) => `<option value="${k}">${K.name}</option>`).join('');
    el.innerHTML = `<div class="pbox adm"><h2>Admin</h2><p class="muted">${H ? 'All cheats available.' : 'You are a client: only your own screen can be changed. The host has the rest.'}</p>
      <div class="adm-grid">
        ${sw('god', 'God mode', true)}${sw('ammo', 'Infinite ammo', true)}${sw('rapid', 'Rapid fire, instant reload', true)}${sw('oneHit', 'One-hit kills', true)}
        ${sw('speed', 'Super speed', true)}${sw('moon', 'Moon gravity (everyone)', true)}${sw('freezeBots', 'Freeze bots', true)}${sw('noclip', 'Noclip (fly)', true)}
      </div>
      <div class="adm-row"><span>Time</span>${[0.25, 0.5, 1, 2].map(k => `<button class="btn ${O.slow === k ? 'on' : ''}" data-slow="${k}" ${!H ? 'disabled' : ''}>${k === 1 ? 'Normal' : k + '×'}</button>`).join('')}</div>
      <div class="adm-row"><span>Give</span><select id="admGun">${guns}</select>${btn('give', 'Give weapon', true)}${btn('heal', 'Full health + armour', true)}${btn('nades', 'Grenades', true)}</div>
      <div class="adm-row"><span>Spawn</span><select id="admVeh">${vehs}</select>${btn('veh', 'Spawn vehicle here', true)}</div>
      <div class="adm-row">${btn('killAll', 'Kill all enemies', true)}${btn('tp', 'Teleport to crosshair', true)}${btn('win', 'Win the match', true)}${Game.mode.id === 'zombies' ? btn('wave', 'Skip wave', true) : ''}${Game.mode.buy ? btn('money', '+$16000', true) : ''}</div>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn big" data-a="close">Close</button></div></div>`;
    el.classList.remove('hidden'); UI.adminOpen = true; if (document.pointerLockElement) document.exitPointerLock();
    el.querySelectorAll('[data-o]').forEach(i => i.onchange = () => { const k = i.dataset.o; if (k === 'noclip') { if (L) { L.noclip = i.checked; L.vel.set(0, 0, 0); } } else O[k] = i.checked; this.apply(); });
    el.querySelectorAll('[data-slow]').forEach(b => b.onclick = () => { O.slow = +b.dataset.slow; this.show(); });
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => this.act(b.dataset.a));
    const nc = el.querySelector('[data-o="noclip"]'); if (nc && L) nc.checked = !!L.noclip;
  },
  close() { if (this.el) this.el.classList.add('hidden'); UI.adminOpen = false; if (Game.running) UI.lock(); },
  apply() {
    const L = Game.local; if (!L) return;
    L.speedK = this.opt.speed ? 2.2 : (L.speedK === 2.2 ? 1 : L.speedK);
    PHYS.gravity = this.opt.moon ? (this._g0 = this._g0 || PHYS.gravity) / 5 : (this._g0 || PHYS.gravity);
  },
  act(a) {
    const L = Game.local, G = Game; if (a === 'close') return this.close();
    if (!this.host() || !L) return;
    switch (a) {
      case 'give': { const id = document.getElementById('admGun').value; L.give(id); L.fillAmmo(id); L.switchTo(id); HUD.center(`Gave ${WEAPONS[id].name}`, 1); break; }
      case 'heal': L.hp = 100; L.armor = 100; L.helmet = true; if (L.inj) Injury.clear(L); L.downed = false; break;
      case 'nades': L.nades.frag = 5; L.nades.flash = 5; L.nades.smoke = 5; break;
      case 'money': L.money = 16000; break;
      case 'veh': {
        const k = document.getElementById('admVeh').value, f = L.forward(new V3()), x = L.pos.x + f.x * 6, z = L.pos.z + f.z * 6;
        if (Sandbox.on) Sandbox.exec({ op: 'veh', k, pos: [x, 0, z], yaw: L.yaw });
        else { const v = new Vehicle('adm' + (this.vn = (this.vn || 0) + 1), L.team, { x, z, yaw: L.yaw, team: L.team, kind: k }); v.noRespawn = true; G.vehicles.push(v); if (Net.role === 'host') HUD.center('Spawned (only you see it in multiplayer)', 1.5); }
        break;
      }
      case 'killAll': for (const e of G.soldiers) if (e.alive && G.hostile(L, e)) { e.downed = false; e._finish = true; e.spawnProt = 0; e.hitLock = null; G.damage(e, 99999, L, 'knife', 'head'); e._finish = false; } break;
      case 'tp': { const e = L.eye(new V3()), d = L.forward(new V3()); let t = World.raycast(e.x, e.y, e.z, d.x, d.y, d.z, 400); if (t < 0) t = 60; const p = e.addScaledVector(d, Math.max(0, t - 1)); L.pos.set(p.x, Math.max(World.floorAt(p.x, p.z), p.y - 1), p.z); L.vel.set(0, 0, 0); break; }
      case 'win': if (G.mode.id === 'defuse') { G.score[L.team] = G.mode.winRounds - 1; G.endRound(L.team, 'elim'); } else if (G.mode.id === 'zombies') { HUD.center('No winning in Zombies. Try "Skip wave".', 1.5); } else G.endMatch(L.team); this.close(); break;
      case 'wave': if (Horde.on()) { for (const z of Horde.zombies()) { z._finish = true; z.spawnProt = 0; z.hitLock = null; G.damage(z, 99999, L, 'knife', 'head'); } Horde.toSpawn = 0; Horde.brutes = 0; } break;
    }
    this.show();
  },
};
UI.adminOpen = false;
const _blocking32 = UI.blocking.bind(UI);
UI.blocking = function () { return this.adminOpen || _blocking32(); };
addEventListener('keydown', e => { if (e.code === 'F8' && Game.running && !Input.typing) { e.preventDefault(); if (UI.adminOpen) Admin.close(); else Admin.open(); } else if (e.code === 'Escape' && UI.adminOpen) Admin.close(); });
/* a button in the pause menu */
const _pause32 = UI.pause.bind(UI);
UI.pause = function (on) {
  const r = _pause32(on); const box = document.querySelector('#pause .row'); if (box && !document.getElementById('pAdmin')) { const b = document.createElement('button'); b.className = 'btn'; b.id = 'pAdmin'; b.textContent = 'Admin'; b.onclick = () => { UI.pause(false); Admin.open(); }; box.appendChild(b); }
  return r;
};
/* the cheats themselves */
const _damage32 = Game.damage.bind(Game);
Game.damage = function (v, dmg, att, weapon, zone, from) {
  const L = this.local, O = Admin.opt;
  if (L && v === L && O.god) return;
  if (L && att === L && O.oneHit && v !== L) dmg = Math.max(dmg, 99999);
  return _damage32(v, dmg, att, weapon, zone, from);
};
const _vdamage32 = Vehicle.prototype.damage;
Vehicle.prototype.damage = function (d, by) { if (Admin.opt.god && Game.local && this.driver === Game.local) return; if (Admin.opt.oneHit && by === Game.local && Game.local) d = Math.max(d, this.maxHp * 5); return _vdamage32.call(this, d, by); };
const _fire32 = fireWeapon;
fireWeapon = function (s, now, rc) {
  const L = Game.local, O = Admin.opt;
  if (s === L && O.rapid) { s.fireCd = 0; s.reloadT = 0; s.boltT = 0; }
  const r = _fire32(s, now, rc);
  if (s === L && r) { const a = s.ammo[s.cur]; if (O.ammo && a) { a.mag = Math.max(a.mag, 1) + 1; a.res = Math.max(a.res, 90); } if (O.rapid) s.fireCd = Math.min(s.fireCd, 0.045); }
  return r;
};
const _aiUpdate32 = AI.update.bind(AI);
AI.update = function (dt) { if (Admin.opt.freezeBots && Game.authority()) { for (const s of Game.soldiers) if (s.ctrl === 'bot') { const m = s.moveIn; m.f = m.s = 0; m.jump = m.sprint = false; } return; } return _aiUpdate32(dt); };
const _gupdate32 = Game.update.bind(Game);
Game.update = function (dt) { return _gupdate32(dt * (Game.authority() ? Admin.opt.slow || 1 : 1)); };
const _stop32 = Game.stop.bind(Game);
Game.stop = function () { Admin.opt.slow = 1; if (Admin.opt.moon) { Admin.opt.moon = false; Admin.apply(); } if (UI.adminOpen) Admin.close(); return _stop32(); };
const _respawn32 = Game.respawn.bind(Game);
Game.respawn = function (s, where) { const r = _respawn32(s, where); if (s === Game.local && Admin.opt.speed) s.speedK = 2.2; return r; };
