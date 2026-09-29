/* ═══════════════════════════════════════════════════════════════════════════
   Zombies, part two (v2.9).
   · Points: 500 to start, +50 a zombie, +150 a brute, +1000 for a boss,
     +10 for every plank you put back.
   · Weapon lockers around the start: walk up and press E to buy the gun
     on the sign, or refill its ammo for half the price if you have it.
   · Barricades: four plank walls around the start. Zombies tear planks off
     to get through; hold E next to one to board it back up.
   · Boss waves: every fifth wave brings an Abomination: huge, slow, with a
     ground slam that throws you back.
   ═══════════════════════════════════════════════════════════════════════════ */
ZTYPE.boss = { hp: w => 2600 + w * 380, speed: 0.72, bite: 55, scale: 1.9, tint: '#6a2020' };
const ZBUY = [['mp9', 750], ['nova', 900], ['ak47', 1500], ['m4a4', 1500], ['m249', 2200], ['awp', 2500], ['mg42', 2800], ['flamer', 3000], ['mgl', 3500], ['railgun', 4000]].filter(x => WEAPONS[x[0]]);
const Z2 = {
  lockers: [], bars: [], pts: {}, syncT: 0, fixT: 0, bossHud: null,
  on() { return Horde.on() && Game.running; },
  center() { const sp = World.spawns.CT.length ? World.spawns.CT : World.spawns.T; let x = 0, z = 0; for (const p of sp) { x += p.x; z += p.z; } return { x: x / sp.length, z: z / sp.length }; },
  clearAt(x, z, r) { return World.nav.walkableAt(x, z) && !World.boxes.some(b => b.y1 > 0.2 && b.y0 < 2 && b.x0 < x + r && b.x1 > x - r && b.z0 < z + r && b.z1 > z - r); },
  /* lockers and barricades, placed the same way on every peer */
  setup() {
    this.lockers = []; this.bars = []; this.pts = {};
    if (!Horde.on()) return;
    const c = this.center(), r = mulberry(hashStr(World.id + 'zlock'));
    const picks = ZBUY.slice().sort(() => r() - 0.5).slice(0, 6).sort((a, b) => a[1] - b[1]);
    let i = 0;
    for (let ring = 7; ring <= 22 && i < picks.length; ring += 3) for (let k = 0; k < 16 && i < picks.length; k++) {
      const a = k / 16 * TAU + ring, x = c.x + Math.cos(a) * ring, z = c.z + Math.sin(a) * ring;
      if (!this.clearAt(x, z, 1.2) || this.lockers.some(l => dist2(l.x, l.z, x, z) < 7)) continue;
      this.lockers.push(this.makeLocker(i, x, z, picks[i][0], picks[i][1], Math.atan2(c.x - x, c.z - z))); i++;
    }
    for (let k = 0; k < 4; k++) {
      for (const [ring, da] of [[12, 0], [15, 0], [10, 0], [18, 0], [12, 0.4], [12, -0.4], [8, 0], [21, 0], [15, 0.5], [15, -0.5]]) {
        const a = k / 4 * TAU + Math.PI / 4 + da, x = c.x + Math.cos(a) * ring, z = c.z + Math.sin(a) * ring;
        const alongX = Math.abs(Math.cos(a)) < Math.abs(Math.sin(a)), hw = 1.6, hd = 0.25, bx0 = alongX ? x - hw : x - hd, bx1 = alongX ? x + hw : x + hd, bz0 = alongX ? z - hd : z - hw, bz1 = alongX ? z + hd : z + hw;
        if (!this.clearAt(x, z, 1.8) || this.lockers.some(l => dist2(l.x, l.z, x, z) < 4) || this.bars.some(o => dist2(o.x, o.z, x, z) < 6)) continue;
        this.bars.push(this.makeBar(this.bars.length, bx0, bz0, bx1, bz1, alongX)); break;
      }
    }
  },
  makeLocker(i, x, z, w, price, yaw) {
    const g = new THREE.Group(); g.add(bx(1.1, 2.0, 0.55, lam('#3a4a3a'), 0, 1.0, 0)); g.add(bx(1.0, 1.7, 0.02, lam('#1a2a1a'), 0, 1.05, 0.28));
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d');
    c.fillStyle = '#10180f'; c.fillRect(0, 0, 256, 96); c.strokeStyle = '#7aff6a'; c.lineWidth = 4; c.strokeRect(3, 3, 250, 90);
    c.fillStyle = '#dfffd8'; c.font = 'bold 34px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText(WEAPONS[w].name, 128, 42); c.fillStyle = '#7aff6a'; c.font = 'bold 28px system-ui,sans-serif'; c.fillText(price + ' pts', 128, 80);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.42), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) })); sign.position.set(0, 2.25, 0.29); g.add(sign);
    const glow = new THREE.PointLight(0x7aff6a, 1.2, 4); glow.position.set(0, 1.6, 0.8); g.add(glow);
    g.position.set(x, World.floorAt(x, z), z); g.rotation.y = yaw; Game.scene.add(g);
    this.live(World.add(x - 0.5, 0, z - 0.5, x + 0.5, 2, z + 0.5, 'metal', '#333', { invisible: true }));
    return { i, x, z, w, price, mesh: g };
  },
  makeBar(i, x0, z0, x1, z1, alongX) {
    const g = new THREE.Group(), planks = [], L = alongX ? x1 - x0 : z1 - z0;
    for (let k = 0; k < 5; k++) { const p = bx(alongX ? L : 0.12, 0.2, alongX ? 0.12 : L, lam(k % 2 ? '#8a6a44' : '#7a5a38'), 0, 0.3 + k * 0.24, 0); p.rotation[alongX ? 'z' : 'x'] = (k % 2 ? 1 : -1) * 0.05; g.add(p); planks.push(p); }
    for (const s of [-1, 1]) g.add(bx(0.18, 1.6, 0.18, lam('#5a4028'), alongX ? s * L / 2 : 0, 0.8, alongX ? 0 : s * L / 2));
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); Game.scene.add(g);
    const box = { x0, y0: 0, z0, x1, y1: 1.5, z1, stamp: 0, tex: 'wood' }; World.boxes.push(box); this.live(box);
    return { i, x: (x0 + x1) / 2, z: (z0 + z1) / 2, box, planks, hp: 5, mesh: g };
  },
  /* put a box made after the map loaded into the collision grid */
  live(b) {
    const cs = World.cell, cx0 = clamp(Math.floor((b.x0 - World.gx0) / cs), 0, World.gw - 1), cx1 = clamp(Math.floor((b.x1 - World.gx0) / cs), 0, World.gw - 1), cz0 = clamp(Math.floor((b.z0 - World.gz0) / cs), 0, World.gh - 1), cz1 = clamp(Math.floor((b.z1 - World.gz0) / cs), 0, World.gh - 1);
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) World.grid[z * World.gw + x].push(b);
  },
  setPlanks(bar, n) { bar.hp = clamp(n, 0, 5); bar.planks.forEach((p, k) => p.visible = k < bar.hp); bar.box.y1 = bar.hp > 0 ? 1.5 : 0; },
  add(s, n) { if (!s) return; this.pts[s.id] = (this.pts[s.id] || 500) + n; },
  mine() { const L = Game.local; return L ? (this.pts[L.id] != null ? this.pts[L.id] : 500) : 0; },
  near(list, s, r) { let best = null, bd = r; for (const o of list) { const d = dist2(o.x, o.z, s.pos.x, s.pos.z); if (d < bd) { bd = d; best = o; } } return best; },
  /* host: buying */
  buy(s, i) {
    const L = this.lockers[i]; if (!L || !s || !s.alive || dist2(L.x, L.z, s.pos.x, s.pos.z) > 2.6) return;
    const have = Object.values(s.weapons || {}).includes(L.w), cost = have ? Math.round(L.price / 2) : L.price, p = this.pts[s.id] != null ? this.pts[s.id] : 500;
    if (p < cost) { if (s.ctrl === 'local') HUD.center(`Need ${cost} points`, 1); return; }
    this.pts[s.id] = p - cost;
    if (s.ctrl === 'local' || s.ctrl === 'bot') this.arm(s, L.w, have);
    else { const pr = Net.peerOf(s.id); if (pr) Net.to(pr.id, { t: 'ev', e: { t: 'zgive', s: s.id, w: L.w, have } }); }
    this.syncT = 0;
  },
  arm(s, w, have) { if (!have) { s.give(w); s.switchTo(w); } s.fillAmmo(w); if (s.ctrl === 'local') { HUD.center(have ? `${WEAPONS[w].name} ammo refilled` : `Bought ${WEAPONS[w].name}`, 1.4); Sfx.play('buy'); } },
  fix(s, i) {
    const B = this.bars[i]; if (!B || !s || !s.alive || B.hp >= 5 || dist2(B.x, B.z, s.pos.x, s.pos.z) > 3.2) return;
    this.setPlanks(B, B.hp + 1); this.add(s, 10); Sfx.play('impact', new V3(B.x, 1, B.z)); if (Net.role === 'host') Net.event({ t: 'zbar', i, h: B.hp });
  },
  update(dt) {
    if (!this.on()) return;
    const L = Game.local, H = Game.authority();
    // the local player: hold E next to a broken barricade
    if (L && L.alive && !L.vehicle && Input.down('KeyE')) {
      const B = this.near(this.bars.filter(b => b.hp < 5), L, 2.8);
      if (B) { this.fixT -= dt; if (this.fixT <= 0) { this.fixT = 0.9; if (H) this.fix(L, B.i); else Net.send({ t: 'zfix', i: B.i }); } } else this.fixT = 0.3;
    } else this.fixT = 0.3;
    if (!H) return;
    // zombies claw at barricades in their way
    for (const z of Horde.zombies()) {
      const B = this.near(this.bars.filter(b => b.hp > 0), z, 2.1); if (!B || !z.brain) continue;
      z.brain.barT = (z.brain.barT || 0) - dt;
      if (z.brain.barT <= 0 && Math.hypot(z.vel.x, z.vel.z) < 1.2) { z.brain.barT = z.zt === 'boss' ? 0.8 : 1.6; this.setPlanks(B, B.hp - (z.zt === 'boss' || z.zt === 'brute' ? 2 : 1)); Sfx.play('impact', new V3(B.x, 1, B.z)); if (Net.role === 'host') Net.event({ t: 'zbar', i: B.i, h: B.hp }); }
    }
    this.syncT -= dt; if (this.syncT <= 0 && Net.role === 'host') { this.syncT = 1; Net.event({ t: 'zpts', m: this.pts }); }
  },
};
/* points for kills */
const _onKill44 = Game.onKillEvent.bind(Game);
Game.onKillEvent = function (ev) {
  _onKill44(ev); if (!Horde.on() || !this.authority()) return;
  const v = this.byId(ev.v), a = this.byId(ev.a); if (!v || v.team !== 'Z' || !a || a.team === 'Z') return;
  Z2.add(a, v.zt === 'boss' ? 1000 : v.zt === 'brute' ? 150 : 50);
  if (v.zt === 'boss') Horde.banner('ABOMINATION DOWN', `${a.name} +1000`);
};
/* boss waves */
const _startWave44 = Horde.startWave.bind(Horde);
Horde.startWave = function () {
  _startWave44();
  if (this.wave % 5 === 0) { this.spawn('boss'); this.banner(`WAVE ${this.wave}: BOSS`, 'An Abomination is coming'); }
};
const _apply44 = Horde.apply.bind(Horde);
Horde.apply = function (ev) { _apply44(ev); const s = Game.byId(ev.id); if (s && ev.zt === 'boss') { s.name = 'Abomination'; s.isBoss = true; } };
/* the boss slams the ground */
const _hb44 = HordeBrain.prototype.update;
HordeBrain.prototype.update = function (dt) {
  _hb44.call(this, dt);
  const s = this.s; if (this.type !== 'boss' || !s.alive || !Game.authority()) return;
  this.slamT = (this.slamT == null ? 4 : this.slamT) - dt;
  const e = this.target; if (!e || !e.alive || this.slamT > 0 || dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z) > 5) return;
  this.slamT = 6; FX.explosion(s.pos.clone().setY(s.pos.y + 0.3)); Sfx.play('explode', s.pos);
  for (const h of Game.soldiers) { if (!h.alive || h.team === 'Z') continue; const dx = h.pos.x - s.pos.x, dz = h.pos.z - s.pos.z, d = Math.hypot(dx, dz); if (d > 4.8) continue; Game.damage(h, 35 * (1 - d / 6), s, 'zombie', 'chest'); if (h.vel) { h.vel.x += dx / (d || 1) * 9; h.vel.z += dz / (d || 1) * 9; h.vel.y = 5; } }
};
/* setup, per frame, keys */
const _start44 = Game.start.bind(Game);
Game.start = function (cfg) { const r = _start44(cfg); try { Z2.setup(); } catch (e) { console.warn('zombies setup', e); } return r; };
const _gupdate44 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate44(dt); if (this.running) Z2.update(dt); };
addEventListener('keydown', e => {
  if (e.code !== 'KeyE' || !Z2.on() || Input.typing) return;
  const L = Game.local; if (!L || !L.alive || L.vehicle) return;
  const K = Z2.near(Z2.lockers, L, 2.4); if (!K) return;
  if (Game.authority()) Z2.buy(L, K.i); else Net.send({ t: 'zbuy', i: K.i });
});
const _hostData44 = Net.hostData.bind(Net);
Net.hostData = function (id, m) {
  if (m && (m.t === 'zbuy' || m.t === 'zfix')) { const p = this.peers.get(id), s = p && p.sid && Game.byId(p.sid); if (s) (m.t === 'zbuy' ? Z2.buy(s, m.i | 0) : Z2.fix(s, m.i | 0)); return; }
  return _hostData44(id, m);
};
const _applyEvent44 = Net.applyEvent.bind(Net);
Net.applyEvent = function (e) {
  if (e && e.t === 'zbar') { const B = Z2.bars[e.i]; if (B) Z2.setPlanks(B, e.h); return; }
  if (e && e.t === 'zpts') { Z2.pts = e.m || {}; return; }
  if (e && e.t === 'zgive') { const L = Game.local; if (L && e.s === L.id) Z2.arm(L, e.w, e.have); return; }
  return _applyEvent44(e);
};
/* HUD: points, prompts, the boss's health */
const _hud44 = HUD.update.bind(HUD);
HUD.update = function (dt) {
  _hud44(dt); if (!Z2.on()) { const x = document.getElementById('zpts'); if (x) x.style.display = 'none'; return; }
  let el = document.getElementById('zpts'); if (!el) { el = document.createElement('div'); el.id = 'zpts'; this.el.hud.appendChild(el); }
  el.style.display = ''; el.textContent = `${Z2.mine()} pts`;
  const L = Game.local;
  if (L && L.alive && !L.vehicle) {
    const K = Z2.near(Z2.lockers, L, 2.4), B = Z2.near(Z2.bars.filter(b => b.hp < 5), L, 2.8);
    if (K) { const have = Object.values(L.weapons || {}).includes(K.w); this.el.hint.textContent = `E: ${have ? 'refill ' + WEAPONS[K.w].name + ' ammo' : 'buy ' + WEAPONS[K.w].name} · ${have ? Math.round(K.price / 2) : K.price} pts`; this.el.hint.classList.remove('hidden'); }
    else if (B) { this.el.hint.textContent = `Hold E: repair barricade (${B.hp}/5) · +10 pts a plank`; this.el.hint.classList.remove('hidden'); }
  }
  const boss = Game.soldiers.find(s => s.isBoss && s.alive);
  let bh = document.getElementById('bossbar');
  if (!boss) { if (bh) bh.style.display = 'none'; return; }
  if (!bh) { bh = document.createElement('div'); bh.id = 'bossbar'; bh.innerHTML = '<b>ABOMINATION</b><div><i></i></div>'; this.el.hud.appendChild(bh); }
  bh.style.display = ''; bh.querySelector('i').style.width = clamp(boss.hp / (boss.maxHp || 1), 0, 1) * 100 + '%';
};
