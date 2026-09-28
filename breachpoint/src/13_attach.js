/* ═══════════════════════════════════════════════════════════════════════════
   Attachments. Four slots per gun (optic, muzzle, under-barrel, magazine).
   Each one changes the gun's stats and bolts a model onto its mount points.
   Unlocked once with credits in the Gunsmith, then fitted per weapon.
   ═══════════════════════════════════════════════════════════════════════════ */

const ATT_SLOTS = ['optic', 'muzzle', 'under', 'mag'];
const ATT_SLOT_NAMES = { optic: 'Optic', muzzle: 'Muzzle', under: 'Underbarrel', mag: 'Magazine' };
const ATTACH = {
  reddot:      { slot: 'optic', name: 'Red Dot', price: 150, desc: 'Clean dot, slight zoom. Faster to aim than irons.', types: ['rifle', 'smg', 'lmg', 'shotgun', 'pistol'] },
  holo:        { slot: 'optic', name: 'Holographic', price: 220, desc: 'Wide window with a ring reticle.', types: ['rifle', 'smg', 'lmg', 'shotgun'] },
  acog:        { slot: 'optic', name: '4x ACOG', price: 420, desc: 'Magnified optic for long lanes. Slower to aim.', types: ['rifle', 'lmg'] },
  suppressor:  { slot: 'muzzle', name: 'Suppressor', price: 380, desc: 'Quiet shots, no tracer, tiny flash. Bots hear you from much closer. -5% damage.', types: ['rifle', 'smg', 'lmg', 'pistol', 'sniper'] },
  compensator: { slot: 'muzzle', name: 'Compensator', price: 220, desc: '-30% horizontal recoil.', types: ['rifle', 'smg', 'lmg', 'pistol'] },
  grip:        { slot: 'under', name: 'Vertical Grip', price: 240, desc: '-22% vertical recoil, steadier on the move.', types: ['rifle', 'smg', 'lmg', 'shotgun'] },
  laser:       { slot: 'under', name: 'Laser Sight', price: 260, desc: '-35% hip-fire spread. Everyone can see the dot.', types: ['rifle', 'smg', 'lmg', 'shotgun', 'pistol'] },
  extmag:      { slot: 'mag', name: 'Extended Mag', price: 320, desc: '+50% magazine, +15% reload time.', types: ['rifle', 'smg', 'pistol', 'lmg', 'sniper'] },
};
function attachAllowed(wid, aid) {
  const w = WEAPONS[wid], a = ATTACH[aid]; if (!w || !a || w.special) return false;
  if (!a.types.includes(w.type)) return false;
  if (aid === 'extmag' && wid === 'p90') return false;
  if (a.slot === 'under' && w.type === 'pistol' && aid !== 'laser') return false;
  return true;
}
const attSig = a => a ? ATT_SLOTS.map(k => a[k] || '').join(',') : '';

/* A soldier's copy of a gun with its attachments applied. */
function modWeapon(base, att) {
  if (!att || !attSig(att).replace(/,/g, '')) return base;
  const w = Object.assign({}, base); w.att = att;
  const has = id => ATT_SLOTS.some(k => att[k] === id && attachAllowed(base.id, id));
  if (has('reddot')) w.zoom = Math.min(w.zoom || 70, base.type === 'pistol' ? 62 : 60);
  if (has('holo')) w.zoom = Math.min(w.zoom || 70, 58);
  if (has('acog')) { w.zoom = 34; w.adsSlow = 0.8; }
  if (has('suppressor')) { w.suppressed = true; w.dmg *= 0.95; w.sound = (w.sound || 1) * 0.35; }
  if (has('compensator')) w.sideK = 0.7;
  if (has('grip')) { w.upK = 0.78; w.moveSpread *= 0.88; }
  if (has('laser')) { w.hipK = 0.65; w.moveSpread *= 0.85; w.laser = true; }
  if (has('extmag')) { w.mag = Math.round(w.mag * 1.5); w.reload *= 1.15; }
  return w;
}
function randomAttach(wid) { // bots get a plausible kit
  const o = {}; for (const k of ATT_SLOTS) { const ids = Object.keys(ATTACH).filter(a => ATTACH[a].slot === k && attachAllowed(wid, a)); if (ids.length && chance(0.45)) o[k] = pick(ids); }
  return o;
}

/* ── models ────────────────────────────────────────────────────────────── */
function addAttachments(g, wid, att) {
  const U = g.userData, K = lam('#141516'), M = lam('#2e3134'), R = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const glass = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.18, depthWrite: false });
  const ok = id => attachAllowed(wid, id);
  const o = att.optic, rail = U.rail;
  if (o && ok(o) && rail) {
    const y = rail.y, z = rail.z;
    if (o === 'reddot') {
      g.add(bx(0.026, 0.006, 0.05, K, 0, y + 0.003, z));
      g.add(bx(0.004, 0.03, 0.03, K, -0.013, y + 0.018, z)); g.add(bx(0.004, 0.03, 0.03, K, 0.013, y + 0.018, z)); g.add(bx(0.026, 0.004, 0.03, K, 0, y + 0.034, z));
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.026), glass); lens.position.set(0, y + 0.02, z); g.add(lens);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 6, 4), R); dot.position.set(0, y + 0.02, z - 0.005); g.add(dot);
      U.sight = { y: y + 0.02 };
    } else if (o === 'holo') {
      g.add(bx(0.032, 0.008, 0.07, K, 0, y + 0.004, z));
      g.add(bx(0.004, 0.036, 0.012, K, -0.016, y + 0.024, z - 0.02)); g.add(bx(0.004, 0.036, 0.012, K, 0.016, y + 0.024, z - 0.02)); g.add(bx(0.034, 0.005, 0.03, K, 0, y + 0.043, z - 0.02));
      g.add(bx(0.03, 0.012, 0.03, M, 0, y + 0.014, z + 0.02));
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.03), glass); lens.position.set(0, y + 0.026, z - 0.02); g.add(lens);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.0035, 0.0045, 20), R); ring.position.set(0, y + 0.026, z - 0.021); g.add(ring);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0008, 8), R); dot.position.set(0, y + 0.026, z - 0.021); g.add(dot);
      U.sight = { y: y + 0.026 };
    } else if (o === 'acog') {
      g.add(bx(0.022, 0.012, 0.05, K, 0, y + 0.006, z));
      g.add(cyl(0.017, 0.11, M, 0, y + 0.03, z, 12)); g.add(cyl(0.021, 0.025, K, 0, y + 0.03, z - 0.06, 12)); g.add(cyl(0.019, 0.02, K, 0, y + 0.03, z + 0.055, 12));
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.016, 16), glass); lens.position.set(0, y + 0.03, z + 0.066); g.add(lens);
      const chev = new THREE.Mesh(new THREE.ConeGeometry(0.0022, 0.004, 3), R); chev.position.set(0, y + 0.0285, z + 0.064); g.add(chev);
      U.sight = { y: y + 0.03 };
    }
    // flip the iron posts down under an optic
    g.children.forEach(c => { if (c.geometry && c.geometry.parameters && c.geometry.parameters.width === 0.005 && c.position.y > U.sight.y - 0.05) c.visible = false; });
  }
  const m = att.muzzle, mz = U.muzzle;
  if (m && ok(m)) {
    const p = mz.position;
    if (m === 'suppressor') { const len = WEAPONS[wid].type === 'pistol' ? 0.12 : 0.17; g.add(cyl(0.019, len, K, p.x, p.y, p.z - len / 2, 12)); g.add(cyl(0.02, 0.01, M, p.x, p.y, p.z - len + 0.005, 12)); mz.position.z -= len; }
    else if (m === 'compensator') { g.add(cyl(0.016, 0.05, M, p.x, p.y, p.z - 0.025, 8)); g.add(bx(0.034, 0.006, 0.008, K, p.x, p.y + 0.008, p.z - 0.02)); g.add(bx(0.034, 0.006, 0.008, K, p.x, p.y + 0.008, p.z - 0.035)); mz.position.z -= 0.05; }
  }
  const u = att.under;
  if (u && ok(u)) {
    const ub = U.under || (WEAPONS[wid].type === 'pistol' ? { y: -0.02, z: -0.08 } : null);
    if (ub) {
      if (u === 'grip') { g.add(bx(0.024, 0.008, 0.04, K, 0, ub.y - 0.004, ub.z)); const gp = bx(0.022, 0.07, 0.026, K, 0, ub.y - 0.04, ub.z); gp.rotation.x = 0.12; g.add(gp); U.leftGrip = { y: ub.y - 0.045, z: ub.z }; }
      else if (u === 'laser') {
        const side = WEAPONS[wid].type === 'pistol' ? 0 : 0.034;
        g.add(bx(0.018, 0.02, 0.05, K, side, ub.y + (side ? 0.03 : -0.01), ub.z));
        const em = new THREE.Mesh(new THREE.CircleGeometry(0.004, 8), R); em.position.set(side, ub.y + (side ? 0.03 : -0.01), ub.z - 0.026); em.rotation.y = Math.PI; g.add(em);
        U.laser = em;
      }
    }
  }
  if (att.mag === 'extmag' && ok('extmag') && U.mag) {
    const mg = U.mag, b = U.magBase;
    if (WEAPONS[wid].type === 'pistol') g.add(bx(0.03, 0.03, 0.045, K, 0, b.y - 0.01, b.z));
    else if (WEAPONS[wid].type === 'lmg') { mg.scale.set(1.15, 1.3, 1.1); mg.position.y -= 0.012; }
    else { mg.scale.y = 1.45; mg.position.y -= 0.03; }
  }
  return g;
}
