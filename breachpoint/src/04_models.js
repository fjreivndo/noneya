/* ═══════════════════════════════════════════════════════════════════════════
   Models and effects. Everything is built from boxes and cylinders at load
   time; guns take a skin texture on their painted parts.
   ═══════════════════════════════════════════════════════════════════════════ */

const TEAM_STYLE = {
  T: { name: 'Vanta', short: 'VAN', color: '#e0a040', uniform: '#8a7a5a', accent: '#b8402b', skin: '#c89a78', helmet: '#4a4232', glove: '#3a3024' },
  CT: { name: 'Aegis', short: 'AEG', color: '#5aa0ff', uniform: '#3a4a60', accent: '#2e86de', skin: '#e0b494', helmet: '#26303e', glove: '#1e2530' },
};
const other = t => t === 'T' ? 'CT' : 'T';
const _lam = {};
function lam(color) { return _lam[color] || (_lam[color] = new THREE.MeshLambertMaterial({ color })); }
function bx(w, h, d, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; }
function cyl(r, len, m, x = 0, y = 0, z = 0, seg = 8) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); return o; }

/* ── guns ──────────────────────────────────────────────────────────────── */
const DEFAULT_FINISH = { ak47: '#6b4a2b', m4a4: '#2e3236', scar: '#8a7a5a', awp: '#3d5a3a', ssg: '#3a3f44', m249: '#34383c', mp9: '#2a2c2e', p90: '#3a3c3a', nova: '#5a4028', glock: '#2a2c2e', p2000: '#2e3032', deagle: '#9a9a9a', rpg: '#4a5a3a', knife: '#8a9096', fiveseven: '#3a3c40', tec9: '#2a2a2a', magnum: '#b8b8b8', mac10: '#2a2c2e', ump45: '#3a3c3a', xm1014: '#2a2c2e', galil: '#5a4a30', famas: '#3a3f44', aug: '#4a5a3a', minigun: '#34383c', autosniper: '#2e3236', crossbow: '#5a4028', m79: '#6a5030' };
function skinMat(weaponId, item) {
  const t = item ? skinTexture(item) : null;
  if (t) return new THREE.MeshLambertMaterial({ map: t });
  return lam(DEFAULT_FINISH[weaponId] || '#333');
}
/* Guns are modelled pointing down -Z with the grip at the origin. Each one
   records where its sights, rail, under-barrel mount, muzzle and magazine
   are, so attachments snap on and the viewmodel can aim down the sights. */
function buildGun(weaponId, item, att) {
  const g = new THREE.Group(), w = WEAPONS[weaponId], S = skinMat(weaponId, item), D = lam('#1c1d1f'), M = lam('#3a3c40'), K = lam('#101112');
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  const knifeType = item && SKINS[item.skinId] ? SKINS[item.skinId].knife : null;
  const U = g.userData; U.sight = { y: 0.06 }; U.rail = null; U.under = null; U.mag = null; U.muzzle = muzzle;
  const add = o => (g.add(o), o);
  const post = (x, y, z, h) => add(bx(0.005, h, 0.006, K, x, y + h / 2, z));
  switch (w.type) {
    case 'pistol': {
      const k = w.heavyPistol ? 1.2 : 1;
      add(bx(0.03 * k, 0.032 * k, 0.19 * k, S, 0, 0.016 * k, -0.035 * k));             // slide
      add(bx(0.028 * k, 0.022 * k, 0.15 * k, D, 0, -0.01 * k, -0.03 * k));             // frame
      add(bx(0.006, 0.006, 0.04, M, 0.012 * k, 0.02 * k, -0.02));                       // ejection port
      const gr = add(bx(0.028 * k, 0.105 * k, 0.045 * k, D, 0, -0.06 * k, 0.03 * k)); gr.rotation.x = -0.22;
      add(bx(0.012, 0.02, 0.03, K, 0, -0.026 * k, -0.005));                              // trigger guard
      post(-0.007, 0.032 * k, 0.05 * k, 0.008); post(0.007, 0.032 * k, 0.05 * k, 0.008); // rear notch
      post(0, 0.032 * k, -0.12 * k, 0.008);                                              // front post
      if (w.revolver) { add(cyl(0.024, 0.045, M, 0, 0.005, -0.005, 8)).rotation.x = Math.PI / 2; add(cyl(0.008, 0.1, D, 0, 0.022, -0.1)); }
      U.sight = { y: 0.032 * k + 0.0065 }; U.rail = { y: 0.032 * k, z: -0.01 }; U.mag = gr; U.magBase = { y: -0.115 * k, z: 0.045 * k };
      muzzle.position.set(0, 0.016 * k, -0.13 * k);
      break;
    }
    case 'rifle': case 'smg': case 'lmg': {
      if (weaponId === 'minigun') { // six barrels on a spinning drum, carried from the hip
        add(bx(0.11, 0.12, 0.3, S, 0, -0.01, 0.02)); add(bx(0.13, 0.13, 0.12, M, 0.08, -0.07, 0.02));
        const spin = new THREE.Group(); spin.position.set(0, 0, -0.35); g.add(spin);
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; spin.add(cyl(0.011, 0.55, D, Math.cos(a) * 0.03, Math.sin(a) * 0.03, -0.1)); }
        spin.add(cyl(0.045, 0.03, M, 0, 0, 0.1, 12)); spin.add(cyl(0.045, 0.03, M, 0, 0, -0.33, 12));
        const h = add(bx(0.03, 0.03, 0.2, K, 0, 0.09, 0.0)); h.rotation.x = 0.1;
        const gr = add(bx(0.03, 0.09, 0.04, D, 0, -0.1, 0.12)); gr.rotation.x = -0.28;
        U.spin = spin; U.sight = { y: 0.085 }; U.mag = null; muzzle.position.set(0, 0, -0.72);
        break;
      }
      const L = w.L || (w.type === 'smg' ? 0.72 : 1), lmg = w.type === 'lmg', ak = weaponId === 'ak47' || weaponId === 'galil', p90 = weaponId === 'p90';
      add(bx(0.05, 0.07, 0.36 * L, S, 0, 0, -0.02));                                    // receiver
      add(bx(0.056, 0.058, 0.24 * L, S, 0, -0.002, -0.31 * L));                         // handguard
      for (let i = 0; i < 4; i++) add(bx(0.058, 0.006, 0.012, K, 0, 0.025, -0.22 * L - i * 0.05 * L)); // vents
      add(cyl(0.011, 0.24 * L, D, 0, 0.008, -0.54 * L));                                // barrel
      add(bx(0.045, 0.072, 0.24 * L, S, 0, -0.016, 0.28 * L));                          // stock
      add(bx(0.05, 0.085, 0.02, K, 0, -0.02, 0.4 * L));                                 // butt pad
      const grip = add(bx(0.03, 0.085, 0.04, D, 0, -0.07, 0.09 * L)); grip.rotation.x = -0.28;
      add(bx(0.012, 0.022, 0.035, K, 0, -0.045, 0.045 * L));                            // trigger guard
      add(bx(0.008, 0.01, 0.02, M, 0.028, 0.018, 0.02));                                // charging handle
      if (!ak && !p90) add(bx(0.022, 0.01, 0.22 * L, K, 0, 0.04, -0.03));               // picatinny rail
      if (p90) add(bx(0.045, 0.028, 0.26, S, 0, 0.049, -0.06));
      // irons: rear aperture on the receiver, front post near the muzzle
      post(-0.008, 0.035, 0.1 * L, 0.024); post(0.008, 0.035, 0.1 * L, 0.024);
      add(bx(0.02, 0.012, 0.012, K, 0, 0.041, -0.58 * L)); post(0, 0.047, -0.58 * L, 0.014);
      U.sight = { y: 0.058 }; U.rail = { y: 0.045, z: -0.02 }; U.under = { y: -0.031, z: -0.3 * L };
      if (w.builtinScope) { add(bx(0.02, 0.02, 0.06, K, 0, 0.048, -0.02)); add(cyl(0.02, 0.14, M, 0, 0.074, -0.02, 12)); const r = add(new THREE.Mesh(new THREE.RingGeometry(0.004, 0.005, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }))); r.position.set(0, 0.074, 0.051); r.rotation.y = Math.PI; U.sight = { y: 0.074 }; U.rail = null; }
      if (lmg) { U.mag = add(bx(0.085, 0.085, 0.11, M, 0.02, -0.075, -0.07)); add(bx(0.008, 0.11, 0.008, D, 0.02, -0.075, -0.5)); add(bx(0.008, 0.11, 0.008, D, -0.02, -0.075, -0.5)); U.under = null; U.magBase = { y: -0.12, z: -0.07 }; }
      else if (!p90) { const mag = add(bx(0.032, 0.14, 0.065, ak ? S : D, 0, -0.1, -0.085 * L)); mag.rotation.x = ak ? 0.32 : 0.1; U.mag = mag; U.magBase = { y: -0.17, z: -0.07 * L }; }
      muzzle.position.set(0, 0.008, -0.66 * L);
      break;
    }
    case 'sniper': {
      add(bx(0.05, 0.068, 0.44, S, 0, 0, -0.02));
      add(cyl(0.014, 0.52, D, 0, 0.01, -0.5));
      add(bx(0.045, 0.095, 0.28, S, 0, -0.018, 0.33));
      add(bx(0.05, 0.1, 0.02, K, 0, -0.02, 0.47));
      add(cyl(0.022, 0.3, M, 0, 0.078, -0.02, 12));
      add(cyl(0.03, 0.06, D, 0, 0.078, -0.19, 12)); add(cyl(0.027, 0.05, D, 0, 0.078, 0.13, 12));
      add(bx(0.012, 0.03, 0.03, K, 0, 0.05, -0.1)); add(bx(0.012, 0.03, 0.03, K, 0, 0.05, 0.06));
      const gr = add(bx(0.03, 0.085, 0.045, D, 0, -0.07, 0.12)); gr.rotation.x = -0.28;
      add(bx(0.012, 0.012, 0.04, M, 0.03, 0.02, 0.1));                                   // bolt handle
      U.mag = add(bx(0.034, 0.06, 0.07, D, 0, -0.055, -0.07)); U.magBase = { y: -0.09, z: -0.07 };
      U.sight = { y: 0.078 };
      muzzle.position.set(0, 0.01, -0.77);
      break;
    }
    case 'shotgun': {
      add(bx(0.05, 0.068, 0.3, S, 0, 0, -0.02));
      add(cyl(0.016, 0.55, D, 0, 0.018, -0.42)); add(cyl(0.013, 0.42, M, 0, -0.014, -0.36));
      add(bx(0.056, 0.048, 0.15, S, 0, -0.016, -0.34));                                  // pump
      add(bx(0.045, 0.08, 0.26, S, 0, -0.02, 0.25)); add(bx(0.05, 0.09, 0.02, K, 0, -0.022, 0.38));
      const gr = add(bx(0.03, 0.08, 0.04, D, 0, -0.065, 0.08)); gr.rotation.x = -0.3;
      post(0, 0.034, -0.68, 0.008);                                                        // bead
      add(bx(0.02, 0.006, 0.12, K, 0, 0.037, 0.0));                                      // receiver rib
      U.sight = { y: 0.041 }; U.rail = { y: 0.04, z: 0.0 }; U.under = { y: -0.04, z: -0.34 }; U.pump = true;
      muzzle.position.set(0, 0.018, -0.7);
      break;
    }
    case 'bow': {
      add(bx(0.04, 0.05, 0.5, S, 0, 0, -0.05));                                           // stock
      const limbL = add(bx(0.3, 0.018, 0.03, S, -0.15, 0.015, -0.3)); limbL.rotation.y = 0.35;
      const limbR = add(bx(0.3, 0.018, 0.03, S, 0.15, 0.015, -0.3)); limbR.rotation.y = -0.35;
      const str = new THREE.LineBasicMaterial({ color: 0xdddddd }), sg = new THREE.BufferGeometry().setFromPoints([new V3(-0.29, 0.015, -0.2), new V3(0, 0.02, -0.08), new V3(0.29, 0.015, -0.2)]); add(new THREE.Line(sg, str));
      const bolt = add(cyl(0.006, 0.36, lam('#c8b890'), 0, 0.03, -0.24)); U.bolt = bolt;
      add(cyl(0.012, 0.12, M, 0, 0.06, -0.04, 10)); U.sight = { y: 0.06 };
      const gr = add(bx(0.03, 0.08, 0.04, D, 0, -0.06, 0.1)); gr.rotation.x = -0.3;
      muzzle.position.set(0, 0.03, -0.44);
      break;
    }
    case 'launcher': {
      if (weaponId === 'm79') {
        add(cyl(0.03, 0.34, S, 0, 0.01, -0.25, 12)); add(bx(0.05, 0.06, 0.12, D, 0, -0.005, -0.03));
        add(bx(0.045, 0.08, 0.26, lam('#7a5a36'), 0, -0.02, 0.15)); const gr = add(bx(0.03, 0.08, 0.04, D, 0, -0.06, 0.03)); gr.rotation.x = -0.3;
        add(bx(0.02, 0.03, 0.01, K, 0, 0.055, -0.06)); post(0, 0.04, -0.4, 0.012);
        U.sight = { y: 0.052 }; muzzle.position.set(0, 0.01, -0.43); break;
      }
      add(cyl(0.042, 0.9, S, 0, 0, -0.12, 12));
      const war = add(new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 10), lam('#5a6a3a'))); war.rotation.x = -Math.PI / 2; war.position.set(0, 0, -0.67);
      add(bx(0.03, 0.1, 0.04, D, 0, -0.08, 0.02)); add(bx(0.03, 0.09, 0.04, D, 0, -0.075, -0.18));
      add(bx(0.01, 0.04, 0.03, K, -0.045, 0.045, -0.05)); post(-0.045, 0.065, -0.35, 0.01);
      U.sight = { y: 0.072, x: -0.045 };
      muzzle.position.set(0, 0, -0.76);
      break;
    }
    case 'knife': {
      const kt = knifeType || 'default';
      add(bx(0.026, 0.03, 0.11, D, 0, 0, 0.055));
      if (kt === 'talon') { const b1 = add(bx(0.007, 0.034, 0.1, S, 0, 0.02, -0.04)); b1.rotation.x = 0.5; const b2 = add(bx(0.007, 0.03, 0.08, S, 0, 0.055, -0.1)); b2.rotation.x = 1.2; add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 12), M)).position.z = 0.12; }
      else if (kt === 'flipwing') { add(bx(0.007, 0.03, 0.17, S, 0, 0.004, -0.085)); add(bx(0.03, 0.034, 0.12, M, 0.004, 0, 0.055)); }
      else if (kt === 'spike') { add(bx(0.007, 0.034, 0.2, S, 0, 0.006, -0.1)); add(bx(0.06, 0.012, 0.012, M, 0, 0, 0)); }
      else { add(bx(0.007, 0.034, 0.15, S, 0, 0.006, -0.075)); add(bx(0.05, 0.01, 0.012, M, 0, 0, 0)); }
      muzzle.position.set(0, 0, -0.18);
      break;
    }
    default: if (w.build) w.build(g, S); break;   // sandbox tools bring their own model
  }
  U.muzzle = muzzle;
  if (att && typeof addAttachments === 'function') addAttachments(g, weaponId, att);
  return g;
}

/* ── soldier (third person) ────────────────────────────────────────────── */
function nameSprite(text, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48; const c = cv.getContext('2d');
  c.font = 'bold 28px Segoe UI, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.55)'; const w = c.measureText(text).width + 16; c.fillRect(128 - w / 2, 4, w, 38);
  c.fillStyle = color; c.fillText(text, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.3, 1); s.renderOrder = 999; return s;
}
function buildSoldierModel(team) {
  const st = TEAM_STYLE[team], U = lam(st.uniform), A = lam(st.accent), Sk = lam(st.skin), H = lam(st.helmet), Dk = lam('#222'), G = lam(st.glove);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.12, 0.88, 0); legR.position.set(0.12, 0.88, 0);
  legL.add(bx(0.17, 0.88, 0.2, U, 0, -0.44, 0)); legR.add(bx(0.17, 0.88, 0.2, U, 0, -0.44, 0));
  legL.add(bx(0.18, 0.12, 0.28, Dk, 0, -0.84, -0.04)); legR.add(bx(0.18, 0.12, 0.28, Dk, 0, -0.84, -0.04));
  body.add(legL, legR);
  const upper = new THREE.Group(); upper.position.y = 0.9; body.add(upper);
  upper.add(bx(0.48, 0.58, 0.27, U, 0, 0.3, 0));
  upper.add(bx(0.5, 0.36, 0.31, A, 0, 0.34, 0)); // vest
  const head = new THREE.Group(); head.position.y = 0.72; upper.add(head);
  head.add(bx(0.22, 0.24, 0.24, Sk, 0, 0, 0));
  head.add(bx(0.26, 0.1, 0.28, H, 0, 0.11, 0));
  head.add(bx(0.2, 0.06, 0.02, Dk, 0, 0.02, -0.125)); // goggles strip
  const arms = new THREE.Group(); arms.position.set(0, 0.45, 0); upper.add(arms);
  const armR = bx(0.12, 0.12, 0.5, U, 0.2, -0.05, -0.2); armR.rotation.y = 0.3; arms.add(armR);
  const armL = bx(0.12, 0.12, 0.55, U, -0.14, -0.05, -0.3); armL.rotation.y = -0.4; arms.add(armL);
  arms.add(bx(0.1, 0.1, 0.1, G, 0.1, -0.05, -0.45));
  const gunMount = new THREE.Group(); gunMount.position.set(0.12, -0.02, -0.35); arms.add(gunMount);
  root.userData = { body, legL, legR, upper, head, arms, gunMount, gunId: null, skinKey: null };
  return root;
}
function setSoldierGun(model, weaponId, item, att) {
  const u = model.userData, key = weaponId + ':' + (item ? item.skinId + item.seed : '') + attSig(att);
  if (u.skinKey === key) return; u.skinKey = key;
  u.gunMount.clear();
  const g = buildGun(weaponId, item, att); g.scale.setScalar(1.25); u.gunMount.add(g); u.gun = g;
}

/* ── jeep ──────────────────────────────────────────────────────────────── */
function buildJeep(team) {
  const g = new THREE.Group(), C = lam(team === 'CT' ? '#44556a' : '#6a5a3a'), D = lam('#1a1a1a'), M = lam('#555');
  g.add(bx(2.0, 0.6, 4.0, C, 0, 0.75, 0)); g.add(bx(1.9, 0.5, 1.4, C, 0, 1.25, -1.2));
  g.add(bx(1.9, 0.08, 0.06, M, 0, 1.9, -0.2)); g.add(bx(0.06, 0.8, 0.06, M, -0.9, 1.5, -0.2)); g.add(bx(0.06, 0.8, 0.06, M, 0.9, 1.5, -0.2));
  g.add(bx(1.9, 0.5, 0.05, lam('#88aacc'), 0, 1.35, -0.45));
  const wheels = [];
  [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), D); w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); wheels.push(w); });
  g.add(bx(0.4, 0.3, 0.3, lam('#ffffaa'), -0.6, 0.85, -2.0)); g.add(bx(0.4, 0.3, 0.3, lam('#ffffaa'), 0.6, 0.85, -2.0));
  g.userData.wheels = wheels;
  return g;
}

/* ── effects ───────────────────────────────────────────────────────────── */
function softDot(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
const FX = {
  scene: null, tracers: [], decals: [], decalIdx: 0, parts: [], smokes: [], flashes: [], lights: [],
  init(scene) {
    this.scene = scene; this.dot = softDot(); this.smokeTex = softDot('rgba(200,200,200,1)', 'rgba(200,200,200,0)');
    for (const t of this.tracers) scene.remove(t); for (const d of this.decals) scene.remove(d);
    for (const s of this.smokes) s.sprites.forEach(sp => scene.remove(sp));
    this.tracers = []; this.decals = []; this.smokes = []; this.parts = []; this.decalIdx = 0;
    const tg = new THREE.BoxGeometry(0.02, 0.02, 1); tg.translate(0, 0, -0.5);
    for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; m.userData.life = 0; scene.add(m); this.tracers.push(m); }
    const dg = new THREE.PlaneGeometry(0.12, 0.12), dm = new THREE.MeshBasicMaterial({ color: 0x151515, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < 120; i++) { const m = new THREE.Mesh(dg, dm); m.visible = false; scene.add(m); this.decals.push(m); }
    // particles: one additive (sparks, fire), one normal (dust, blood)
    this.pools = {};
    for (const [k, blend, size] of [['add', THREE.AdditiveBlending, 0.12], ['norm', THREE.NormalBlending, 0.25], ['big', THREE.NormalBlending, 1.4]]) {
      const N = 700, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const pm = new THREE.PointsMaterial({ size, map: this.dot, vertexColors: true, transparent: true, depthWrite: false, blending: blend, opacity: k === 'add' ? 1 : 0.85 });
      const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; scene.add(pts);
      this.pools[k] = { pts, geo, N, list: [] };
    }
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 12); scene.add(this.flashLight); this.flashT = 0;
  },
  tracer(o, e, color = 0xffe9a0) {
    const m = this.tracers.find(t => !t.visible); if (!m) return;
    const d = Math.hypot(e.x - o.x, e.y - o.y, e.z - o.z); if (d < 1) return;
    m.position.set(o.x, o.y, o.z); m.lookAt(e.x, e.y, e.z); m.rotateY(Math.PI); // lookAt points +z at target; geometry extends -z
    m.scale.set(1, 1, Math.min(d, 40)); m.material.color.setHex(color); m.material.opacity = 0.9; m.visible = true; m.userData.life = 0.06;
    m.userData.v = new V3(e.x - o.x, e.y - o.y, e.z - o.z).multiplyScalar(1 / d);
    m.userData.len = d;
  },
  decal(p, n) {
    const m = this.decals[this.decalIdx++ % this.decals.length];
    m.position.set(p.x + n.x * 0.01, p.y + n.y * 0.01, p.z + n.z * 0.01);
    m.lookAt(p.x + n.x, p.y + n.y, p.z + n.z); m.visible = true; m.updateMatrix();
  },
  emit(pool, x, y, z, n, spd, col, life = 0.5, grav = -9, spread = 1, dir) {
    const P = this.pools[pool]; if (!P) return;
    for (let i = 0; i < n; i++) {
      if (P.list.length >= P.N) P.list.shift();
      let vx = rand(-1, 1) * spread, vy = rand(-1, 1) * spread, vz = rand(-1, 1) * spread;
      if (dir) { vx += dir.x; vy += dir.y; vz += dir.z; }
      const l = Math.hypot(vx, vy, vz) || 1, s = spd * rand(0.4, 1);
      P.list.push({ x, y, z, vx: vx / l * s, vy: vy / l * s, vz: vz / l * s, life: life * rand(0.6, 1.2), max: life, r: col[0], g: col[1], b: col[2], grav });
    }
  },
  impact(p, n, soft) {
    if (soft) { this.emit('norm', p.x, p.y, p.z, 8, 3, [0.6, 0.05, 0.05], 0.45, -6, 0.8, n); return; }
    this.decal(p, n);
    this.emit('add', p.x, p.y, p.z, 5, 5, [1, 0.8, 0.4], 0.18, -12, 0.6, n);
    this.emit('norm', p.x, p.y, p.z, 4, 1.5, [0.55, 0.5, 0.42], 0.6, -2, 0.6, n);
  },
  explosion(p) {
    this.emit('add', p.x, p.y + 0.3, p.z, 70, 11, [1, 0.6, 0.2], 0.5, -4, 1);
    this.emit('big', p.x, p.y + 0.5, p.z, 26, 3, [0.25, 0.23, 0.2], 1.6, 1, 1);
    this.emit('norm', p.x, p.y + 0.2, p.z, 40, 9, [0.35, 0.3, 0.25], 1.0, -12, 1);
    this.flashLight.position.set(p.x, p.y + 1, p.z); this.flashLight.intensity = 60; this.flashLight.distance = 18; this.flashT = 0.25;
  },
  muzzle(p) { this.emit('add', p.x, p.y, p.z, 3, 1.5, [1, 0.75, 0.3], 0.05, 0, 0.5); this.flashLight.position.set(p.x, p.y, p.z); this.flashLight.intensity = Math.max(this.flashLight.intensity, 8); this.flashLight.distance = 6; this.flashT = Math.max(this.flashT, 0.04); },
  smoke(p, dur = 18) {
    const s = { x: p.x, y: 1.4, z: p.z, r: 0, maxR: 4.6, t: 0, dur, sprites: [] };
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0xbfbfbf }));
      sp.userData.off = new V3(rand(-1, 1), rand(-0.2, 0.9), rand(-1, 1)).normalize().multiplyScalar(rand(0.2, 1)); sp.userData.sc = rand(3.5, 5.5);
      this.scene.add(sp); s.sprites.push(sp);
    }
    this.smokes.push(s);
  },
  /* does a segment pass through any deployed smoke? */
  smokeBlocks(a, b) {
    for (const s of this.smokes) {
      if (s.r < 1.5) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L2 = dx * dx + dy * dy + dz * dz;
      let t = ((s.x - a.x) * dx + (s.y - a.y) * dy + (s.z - a.z) * dz) / (L2 || 1); t = clamp(t, 0, 1);
      const px = a.x + dx * t - s.x, py = a.y + dy * t - s.y, pz = a.z + dz * t - s.z;
      if (px * px + py * py * 2.5 + pz * pz < s.r * s.r * 0.8) return true;
    }
    return false;
  },
  update(dt) {
    for (const m of this.tracers) if (m.visible) {
      m.userData.life -= dt; const v = m.userData.v;
      m.position.x += v.x * dt * 300; m.position.y += v.y * dt * 300; m.position.z += v.z * dt * 300;
      m.userData.len -= dt * 300; m.scale.z = Math.max(0.1, Math.min(m.userData.len, m.scale.z));
      m.material.opacity = Math.max(0, m.userData.life / 0.06) * 0.9; if (m.userData.life <= 0 || m.userData.len <= 0) m.visible = false;
    }
    for (const k in this.pools) {
      const P = this.pools[k], pos = P.geo.attributes.position.array, col = P.geo.attributes.color.array; let n = 0;
      for (let i = P.list.length - 1; i >= 0; i--) { const q = P.list[i]; q.life -= dt; if (q.life <= 0) { P.list.splice(i, 1); continue; } }
      for (const q of P.list) {
        q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.y < 0.02) { q.y = 0.02; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
        const f = k === 'add' ? q.life / q.max : 1;
        pos[n * 3] = q.x; pos[n * 3 + 1] = q.y; pos[n * 3 + 2] = q.z; col[n * 3] = q.r * f; col[n * 3 + 1] = q.g * f; col[n * 3 + 2] = q.b * f; n++;
      }
      P.geo.setDrawRange(0, n); P.geo.attributes.position.needsUpdate = true; P.geo.attributes.color.needsUpdate = true;
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.t += dt; s.r = s.maxR * clamp(s.t / 1.6, 0, 1) * (s.t > s.dur - 2 ? clamp((s.dur - s.t) / 2, 0, 1) : 1);
      const op = clamp(s.t / 1.2, 0, 1) * clamp((s.dur - s.t) / 2.5, 0, 1) * 0.9;
      s.sprites.forEach((sp, k) => { const o = sp.userData.off; sp.position.set(s.x + o.x * s.r, s.y + o.y * s.r * 0.6, s.z + o.z * s.r); sp.scale.setScalar(sp.userData.sc * (0.4 + 0.6 * s.r / s.maxR)); sp.material.opacity = op; sp.material.rotation += dt * 0.05 * (k % 2 ? 1 : -1); });
      if (s.t > s.dur) { s.sprites.forEach(sp => { this.scene.remove(sp); sp.material.dispose(); }); this.smokes.splice(i, 1); }
    }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flashLight.intensity = 0; else this.flashLight.intensity *= 0.8; }
  },
};
