/* ═══════════════════════════════════════════════════════════════════════════
   Weapons, skins, crates, inventory.
   Skins are painted procedurally from (pattern, palette, seed, wear), so two
   copies of the same skin can still look different, the way pattern indexes
   work in CS. Nothing here needs an image file.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── weapons ───────────────────────────────────────────────────────────────
   dmg: body damage at point blank. falloff: multiplier per 12.5m.
   pen: fraction of damage that goes through armor. recoil: degrees scale.
   spread/moveSpread: radians. zoom: ADS field of view (scope when <=30). */
const WEAPONS = {
  knife:  { name: 'Knife', slot: 3, type: 'knife', dmg: 40, rpm: 110, range: 2.2, price: 0, kill: 1500, speed: 1.0, auto: true },
  glock:  { name: 'Glock-18', slot: 2, type: 'pistol', dmg: 30, rpm: 400, mag: 20, reserve: 120, reload: 2.2, spread: 0.010, moveSpread: 0.03, recoil: 0.9, falloff: 0.85, pen: 0.47, price: 200, kill: 300, speed: 1.0, sound: 0.5, zoom: 70, side: 'T' },
  p2000:  { name: 'P2000', slot: 2, type: 'pistol', dmg: 35, rpm: 352, mag: 13, reserve: 52, reload: 2.2, spread: 0.008, moveSpread: 0.03, recoil: 1.0, falloff: 0.91, pen: 0.505, price: 200, kill: 300, speed: 1.0, sound: 0.55, zoom: 70, side: 'CT' },
  deagle: { name: 'Desert Eagle', slot: 2, type: 'pistol', dmg: 63, rpm: 267, mag: 7, reserve: 35, reload: 2.2, spread: 0.006, moveSpread: 0.09, recoil: 3.2, falloff: 0.81, pen: 0.93, price: 700, kill: 300, speed: 0.97, sound: 1.3, zoom: 65, heavyPistol: true },
  mp9:    { name: 'MP9', slot: 1, type: 'smg', dmg: 26, rpm: 857, mag: 30, reserve: 120, reload: 2.1, spread: 0.016, moveSpread: 0.022, recoil: 0.55, falloff: 0.87, pen: 0.6, price: 1250, kill: 600, speed: 0.96, sound: 0.6, zoom: 65, auto: true },
  p90:    { name: 'P90', slot: 1, type: 'smg', dmg: 26, rpm: 857, mag: 50, reserve: 100, reload: 3.3, spread: 0.018, moveSpread: 0.024, recoil: 0.45, falloff: 0.86, pen: 0.69, price: 2350, kill: 300, speed: 0.94, sound: 0.65, zoom: 65, auto: true },
  nova:   { name: 'Nova', slot: 1, type: 'shotgun', dmg: 26, pellets: 9, rpm: 68, mag: 8, reserve: 32, reload: 3.0, spread: 0.055, moveSpread: 0.02, recoil: 4.0, falloff: 0.55, pen: 0.5, price: 1050, kill: 900, speed: 0.93, sound: 1.4, zoom: 70 },
  ak47:   { name: 'AK-47', slot: 1, type: 'rifle', dmg: 36, rpm: 600, mag: 30, reserve: 90, reload: 2.5, spread: 0.004, moveSpread: 0.10, recoil: 1.0, falloff: 0.98, pen: 0.775, price: 2700, kill: 300, speed: 0.86, sound: 1.0, zoom: 55, auto: true, side: 'T' },
  m4a4:   { name: 'M4A4', slot: 1, type: 'rifle', dmg: 33, rpm: 666, mag: 30, reserve: 90, reload: 3.1, spread: 0.0035, moveSpread: 0.085, recoil: 0.85, falloff: 0.97, pen: 0.7, price: 3100, kill: 300, speed: 0.9, sound: 0.9, zoom: 55, auto: true, side: 'CT' },
  scar:   { name: 'SCAR-H', slot: 1, type: 'rifle', dmg: 40, rpm: 560, mag: 20, reserve: 80, reload: 2.6, spread: 0.004, moveSpread: 0.10, recoil: 1.15, falloff: 0.98, pen: 0.8, price: 3300, kill: 300, speed: 0.87, sound: 1.1, zoom: 50, auto: true },
  ssg:    { name: 'SSG 08', slot: 1, type: 'sniper', dmg: 88, rpm: 48, mag: 10, reserve: 90, reload: 3.7, spread: 0.0015, hipSpread: 0.05, moveSpread: 0.06, recoil: 3, falloff: 0.99, pen: 0.85, price: 1700, kill: 300, speed: 0.97, sound: 1.2, zoom: 30, scope: true, bolt: 1.2 },
  awp:    { name: 'AWP', slot: 1, type: 'sniper', dmg: 115, rpm: 41, mag: 5, reserve: 30, reload: 3.6, spread: 0.001, hipSpread: 0.09, moveSpread: 0.15, recoil: 5, falloff: 0.99, pen: 0.975, price: 4750, kill: 100, speed: 0.8, sound: 1.8, zoom: 20, scope: true, bolt: 1.46, nohead: false },
  m249:   { name: 'M249', slot: 1, type: 'lmg', dmg: 32, rpm: 750, mag: 100, reserve: 200, reload: 5.7, spread: 0.010, moveSpread: 0.11, recoil: 0.9, falloff: 0.97, pen: 0.8, price: 5200, kill: 300, speed: 0.8, sound: 1.1, zoom: 55, auto: true },
  rpg:    { name: 'RPG-7', slot: 4, type: 'launcher', dmg: 170, radius: 5.5, rpm: 30, mag: 1, reserve: 3, reload: 3.2, spread: 0.004, moveSpread: 0.04, recoil: 6, falloff: 1, pen: 1, price: 0, kill: 300, speed: 0.85, sound: 1.5, zoom: 50, projectile: 55 },
};
Object.assign(WEAPONS, {
  // pistols
  fiveseven:  { name: 'Five-SeveN', slot: 2, type: 'pistol', dmg: 32, rpm: 400, mag: 20, reserve: 100, reload: 2.2, spread: 0.009, moveSpread: 0.03, recoil: 0.9, falloff: 0.9, pen: 0.91, price: 500, kill: 300, speed: 1.0, sound: 0.6, zoom: 70, side: 'CT' },
  tec9:       { name: 'Tec-9', slot: 2, type: 'pistol', dmg: 33, rpm: 500, mag: 18, reserve: 90, reload: 2.5, spread: 0.014, moveSpread: 0.025, recoil: 1.1, falloff: 0.85, pen: 0.9, price: 500, kill: 300, speed: 1.0, sound: 0.6, zoom: 70, side: 'T' },
  magnum:     { name: '.357 Magnum', slot: 2, type: 'pistol', dmg: 86, rpm: 110, mag: 6, reserve: 24, reload: 2.8, spread: 0.004, moveSpread: 0.08, recoil: 3.8, falloff: 0.9, pen: 0.93, price: 850, kill: 300, speed: 0.96, sound: 1.5, zoom: 64, heavyPistol: true, revolver: true },
  // SMGs
  mac10:      { name: 'MAC-10', slot: 1, type: 'smg', dmg: 29, rpm: 800, mag: 30, reserve: 100, reload: 2.6, spread: 0.02, moveSpread: 0.02, recoil: 0.6, falloff: 0.8, pen: 0.575, price: 1050, kill: 600, speed: 0.97, sound: 0.6, zoom: 66, auto: true, side: 'T', L: 0.6 },
  ump45:      { name: 'UMP-45', slot: 1, type: 'smg', dmg: 35, rpm: 666, mag: 25, reserve: 100, reload: 3.5, spread: 0.016, moveSpread: 0.024, recoil: 0.7, falloff: 0.85, pen: 0.65, price: 1200, kill: 600, speed: 0.95, sound: 0.7, zoom: 64, auto: true, L: 0.8 },
  // shotgun
  xm1014:     { name: 'XM1014', slot: 1, type: 'shotgun', dmg: 20, pellets: 6, rpm: 240, mag: 7, reserve: 32, reload: 3.5, spread: 0.045, moveSpread: 0.02, recoil: 2.4, falloff: 0.6, pen: 0.8, price: 2000, kill: 900, speed: 0.92, sound: 1.2, zoom: 68, auto: true },
  // rifles
  galil:      { name: 'Galil AR', slot: 1, type: 'rifle', dmg: 30, rpm: 666, mag: 35, reserve: 90, reload: 3.0, spread: 0.005, moveSpread: 0.1, recoil: 0.9, falloff: 0.98, pen: 0.775, price: 1800, kill: 300, speed: 0.89, sound: 0.95, zoom: 56, auto: true, side: 'T' },
  famas:      { name: 'FAMAS', slot: 1, type: 'rifle', dmg: 30, rpm: 666, burst: 3, burstRpm: 1100, mag: 25, reserve: 90, reload: 3.3, spread: 0.004, moveSpread: 0.09, recoil: 0.8, falloff: 0.97, pen: 0.7, price: 2050, kill: 300, speed: 0.9, sound: 0.9, zoom: 56, side: 'CT' },
  aug:        { name: 'AUG', slot: 1, type: 'rifle', dmg: 28, rpm: 600, mag: 30, reserve: 90, reload: 3.8, spread: 0.003, moveSpread: 0.085, recoil: 0.75, falloff: 0.98, pen: 0.9, price: 3300, kill: 300, speed: 0.88, sound: 0.9, zoom: 40, auto: true, side: 'CT', builtinScope: true },
  // heavy
  minigun:    { name: 'Minigun', slot: 1, type: 'lmg', dmg: 22, rpm: 1400, mag: 200, reserve: 400, reload: 7, spread: 0.018, moveSpread: 0.08, recoil: 0.35, falloff: 0.95, pen: 0.7, price: 0, kill: 300, speed: 0.72, sound: 0.9, zoom: 62, auto: true, spinup: 0.7, special: true },
  autosniper: { name: 'Auto-Sniper', slot: 1, type: 'sniper', dmg: 80, rpm: 240, mag: 20, reserve: 90, reload: 3.1, spread: 0.002, hipSpread: 0.07, moveSpread: 0.12, recoil: 1.8, falloff: 0.99, pen: 0.82, price: 5000, kill: 300, speed: 0.78, sound: 1.3, zoom: 28, scope: true },
  crossbow:   { name: 'Crossbow', slot: 1, type: 'bow', dmg: 125, rpm: 40, mag: 1, reserve: 20, reload: 2.2, spread: 0.001, hipSpread: 0.02, moveSpread: 0.03, recoil: 2, falloff: 1, pen: 1, price: 0, kill: 300, speed: 0.95, sound: 0.2, zoom: 34, projectile: 95, gravity: 3.5, suppressed: true, special: true },
  m79:        { name: 'M79 Launcher', slot: 4, type: 'launcher', dmg: 115, radius: 4.5, rpm: 60, mag: 1, reserve: 8, reload: 2.4, spread: 0.006, moveSpread: 0.03, recoil: 5, falloff: 1, pen: 1, price: 0, kill: 300, speed: 0.92, sound: 1.1, zoom: 55, projectile: 40, gravity: 9.8, explosive: true },
});
WEAPONS.rpg.gravity = 0.7; WEAPONS.rpg.explosive = true;
for (const id in WEAPONS) WEAPONS[id].id = id;

/* Effective range by weapon type: full damage up to r0 metres, tapering
   to a floor at r1. Pistols and SMGs stop being lethal at a distance;
   rifles hold up; snipers don't fall off. */
const RANGE = { pistol: [15, 45, 0.45], smg: [18, 55, 0.4], shotgun: [6, 24, 0.08], rifle: [40, 130, 0.62], lmg: [35, 120, 0.6], sniper: [600, 700, 1], bow: [120, 250, 0.8], knife: [3, 3, 1], launcher: [999, 999, 1] };
function weaponRange(w) { return w.range || RANGE[w.type] || [40, 120, 0.5]; }
function rangeMult(w, d) { const r = weaponRange(w); if (d <= r[0]) return 1; if (d >= r[1]) return r[2]; return 1 - (d - r[0]) / (r[1] - r[0]) * (1 - r[2]); }
const GRENADES = {
  frag:  { name: 'HE Grenade', price: 300, fuse: 1.6, max: 1 },
  flash: { name: 'Flashbang', price: 200, fuse: 1.5, max: 2 },
  smoke: { name: 'Smoke', price: 300, fuse: 1.6, max: 1 },
};
const EQUIP = { kevlar: { name: 'Kevlar', price: 650 }, helmet: { name: 'Kevlar + Helmet', price: 1000 }, kit: { name: 'Defuse Kit', price: 400 } };

/* CS-style spray: straight up for the first shots, then a side-to-side walk.
   Returned in degrees. Deterministic per weapon so it can be learned. */
function recoilPattern(w, i) {
  const s = hashStr(w.id) % 7;
  const up = Math.min(i, 9) * 0.55 + Math.max(0, i - 9) * 0.08;
  const side = i < 4 ? 0 : Math.sin((i - 4) * 0.45 + s) * Math.min(1, (i - 4) / 5) * 1.6;
  return { x: side * w.recoil * (w.sideK || 1), y: up * w.recoil * (w.upK || 1) };
}

/* ── classes (conquest) ────────────────────────────────────────────────── */
const CLASSES = {
  assault:  { name: 'Assault',  primary: { T: 'ak47', CT: 'm4a4' }, options: ['galil', 'famas', 'aug', 'scar'], secondary: 'glock', nades: { frag: 1, flash: 1 }, gadget: 'medkit', desc: 'Rifle, medic bag (G heals you and squadmates nearby).' },
  engineer: { name: 'Engineer', primary: { T: 'p90', CT: 'mp9' }, options: ['ump45', 'mac10', 'xm1014'], secondary: 'p2000', nades: { frag: 1 }, gadget: 'rpg', gadgets: ['rpg', 'm79'], desc: 'SMG or shotgun, and an RPG or M79 (slot 5).' },
  support:  { name: 'Support',  primary: { T: 'm249', CT: 'm249' }, options: ['minigun', 'nova'], secondary: 'p2000', nades: { smoke: 2, frag: 1 }, gadget: 'ammo', desc: 'LMG or minigun, smokes, ammo box (G refills everyone nearby).' },
  recon:    { name: 'Recon',    primary: { T: 'ssg', CT: 'awp' }, options: ['autosniper', 'crossbow'], secondary: 'deagle', nades: { flash: 1 }, gadget: 'spot', desc: 'Sniper or crossbow. Spotting (Q) marks enemies for your whole team longer.' },
};

/* ── rarity, wear ──────────────────────────────────────────────────────── */
const RARITY = [
  { name: 'Common', color: '#b0c3d9', value: 6 },
  { name: 'Uncommon', color: '#5e98d9', value: 18 },
  { name: 'Rare', color: '#4b69ff', value: 45 },
  { name: 'Epic', color: '#8847ff', value: 140 },
  { name: 'Legendary', color: '#d32ce6', value: 420 },
  { name: 'Mythic', color: '#eb4b4b', value: 1300 },
  { name: 'Exotic', color: '#e4ae39', value: 4200 },
];
const CASE_ODDS = [0, 0.50, 0.28, 0.14, 0.055, 0.02, 0.005]; // by rarity index
const WEARS = [
  { name: 'Factory New', max: 0.07, mult: 1.6 },
  { name: 'Minimal Wear', max: 0.15, mult: 1.25 },
  { name: 'Field-Tested', max: 0.38, mult: 1.0 },
  { name: 'Well-Worn', max: 0.45, mult: 0.85 },
  { name: 'Battle-Scarred', max: 1.0, mult: 0.72 },
];
const wearOf = f => WEARS.find(w => f < w.max) || WEARS[4];
const KNIFE_TYPES = { talon: 'Talon', flipwing: 'Flip-Wing', spike: 'Spike Bayonet', default: 'Knife' };

/* ── skin catalog ──────────────────────────────────────────────────────── */
const SKINS = {};
const CASES = [];
function defSkin(caseId, rarity, weapon, name, pattern, pal, extra = {}) {
  const id = (weapon + '_' + name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  SKINS[id] = Object.assign({ id, caseId, rarity, weapon, name, pattern, pal }, extra);
  return id;
}
function defKnife(caseId, kt, name, pattern, pal, extra = {}) { return defSkin(caseId, 6, 'knife', KNIFE_TYPES[kt] + ' | ' + name, pattern, pal, Object.assign({ knife: kt }, extra)); }

(function buildCatalog() {
  // Field collection — match drops only, commons and uncommons.
  const F = 'field';
  defSkin(F, 0, 'glock', 'Sand Dune', 'solid', ['#c8b27a', '#b39b62']);
  defSkin(F, 0, 'p2000', 'Olive Drab', 'solid', ['#5b6340', '#4b5234']);
  defSkin(F, 0, 'nova', 'Walnut', 'stripes', ['#6b4a2b', '#5a3c22', '#7a5733']);
  defSkin(F, 0, 'mp9', 'Sandstorm', 'camo', ['#b89a6a', '#8d7550', '#d8c496']);
  defSkin(F, 0, 'ak47', 'Safari Mesh', 'mesh', ['#8a8058', '#3d3a2a']);
  defSkin(F, 0, 'm4a4', 'Urban Grey', 'digital', ['#7b7f84', '#5a5e63', '#a2a6aa']);
  defSkin(F, 0, 'awp', 'Forest Camo', 'camo', ['#3f5a2c', '#2b3d1f', '#6b7f45', '#1d2616']);
  defSkin(F, 0, 'scar', 'Contractor', 'solid', ['#8c8468', '#6c6650']);
  defSkin(F, 1, 'deagle', 'Mudder', 'camo', ['#6e5a3a', '#4a3b24', '#8a7652']);
  defSkin(F, 1, 'p90', 'Swamp', 'digital', ['#3e4a2a', '#5a6b3a', '#2a3120']);
  defSkin(F, 1, 'ssg', 'Tide Line', 'stripes', ['#2d5d6b', '#3f7d8f', '#1d3d47']);
  defSkin(F, 1, 'm249', 'Gator Mesh', 'mesh', ['#4d6b3a', '#1f2a18']);
  defSkin(F, 1, 'ak47', 'Jungle Stripe', 'tiger', ['#4f6b2f', '#1c2412']);
  defSkin(F, 1, 'm4a4', 'Desert Hex', 'hex', ['#b8a076', '#6b5a3c']);

  CASES.push({ id: 'ember', name: 'Ember Case', color: '#ff7a2f', price: 120, desc: 'Heat, ash and dragons.' });
  const E = 'ember';
  defSkin(E, 1, 'glock', 'Rustwire', 'rust', ['#7a3b1c', '#b8612b', '#3b1d0f']);
  defSkin(E, 1, 'nova', 'Kiln', 'fade', ['#ffb347', '#ff5e1a', '#7a1f0a']);
  defSkin(E, 1, 'p90', 'Ashfall', 'camo', ['#4a4a4a', '#2a2a2a', '#ff6a1a', '#6a6a6a']);
  defSkin(E, 1, 'mp9', 'Cinder Grid', 'hex', ['#241a16', '#ff6a1a']);
  defSkin(E, 2, 'p2000', 'Firebrick', 'stripes', ['#a8321c', '#6b1d10', '#e0552b']);
  defSkin(E, 2, 'ssg', 'Magma Vein', 'marble', ['#1a0f0a', '#ff4d00', '#ffb000']);
  defSkin(E, 2, 'm249', 'Scorched', 'camo', ['#1f1a17', '#7a2a0f', '#3d2a1f', '#c44d12']);
  defSkin(E, 2, 'deagle', 'Ember Tiger', 'tiger', ['#ff8a1f', '#1a0e05']);
  defSkin(E, 3, 'm4a4', 'Blaze Circuit', 'circuit', ['#140a06', '#ff7a1a', '#ffd070']);
  defSkin(E, 3, 'awp', 'Heatwave', 'fade', ['#ffe14d', '#ff6a00', '#c2004d', '#3d005c']);
  defSkin(E, 3, 'scar', 'Phoenix Scale', 'scales', ['#5c0f0f', '#ff5a1f', '#ffc04d']);
  defSkin(E, 4, 'ak47', 'Inferno Serpent', 'waves', ['#150606', '#ff3d00', '#ffb300', '#ffe9a0']);
  defSkin(E, 4, 'deagle', 'Solar Flare', 'doppler', ['#ffb300', '#ff3d00', '#ffe066', '#7a1400']);
  defSkin(E, 5, 'awp', 'Wyrmfire', 'flames', ['#120404', '#ff2a00', '#ff9d00', '#fff1a6']);
  defKnife(E, 'talon', 'Fade', 'fade', ['#ffe14d', '#ff4d8d', '#7a3dff']);
  defKnife(E, 'talon', 'Case Hardened', 'case', ['#2b4fbf', '#c9a13b', '#7c7c7c']);
  defKnife(E, 'flipwing', 'Ember Doppler', 'doppler', ['#ff3d00', '#1a0500', '#ffb300', '#6a0f00']);
  defKnife(E, 'spike', 'Crimson Web', 'web', ['#8a0f14', '#0a0a0a']);

  CASES.push({ id: 'glacier', name: 'Glacier Case', color: '#5fd4ff', price: 120, desc: 'Cold steel and aurora light.' });
  const G = 'glacier';
  defSkin(G, 1, 'glock', 'Frostbite', 'digital', ['#d8eef7', '#8ab6cc', '#4f7d96']);
  defSkin(G, 1, 'p90', 'Snowdrift', 'camo', ['#eef4f7', '#b8c8d0', '#8aa0ac']);
  defSkin(G, 1, 'mp9', 'Icicle', 'shards', ['#a8e6ff', '#e8fbff', '#4ab0e0']);
  defSkin(G, 1, 'nova', 'Permafrost', 'marble', ['#e6f2f7', '#7fa8bf', '#b8d6e6']);
  defSkin(G, 2, 'm249', 'Arctic Hex', 'hex', ['#dfeef5', '#3b7fa6']);
  defSkin(G, 2, 'ssg', 'Blizzard', 'stripes', ['#ffffff', '#9fd0ea', '#d6ecf6']);
  defSkin(G, 2, 'p2000', 'Polar Lines', 'lines', ['#0d1d2b', '#6fd6ff']);
  defSkin(G, 2, 'scar', 'Tundra Digital', 'digital', ['#c8d8e0', '#6b8a9a', '#2f4a5a']);
  defSkin(G, 3, 'ak47', 'Frozen Circuit', 'circuit', ['#08131c', '#4fd8ff', '#c8f4ff']);
  defSkin(G, 3, 'deagle', 'Crystal Shard', 'shards', ['#3fa9ff', '#c7ecff', '#0a4f8a']);
  defSkin(G, 3, 'm4a4', 'Aurora', 'aurora', ['#061a24', '#1affb0', '#7a4dff', '#2fd4ff']);
  defSkin(G, 4, 'awp', 'Glacial Marble', 'marble', ['#e8f6ff', '#2a7fd4', '#9fd8ff']);
  defSkin(G, 4, 'm4a4', 'Ice Wraith', 'waves', ['#050d18', '#3fc4ff', '#bff0ff', '#ffffff']);
  defSkin(G, 5, 'ak47', 'Absolute Zero', 'doppler', ['#e8fbff', '#2ab8ff', '#0a2a6b', '#8ae4ff']);
  defKnife(G, 'flipwing', 'Sapphire', 'doppler', ['#0a3dff', '#001a66', '#4f9dff', '#000a33']);
  defKnife(G, 'spike', 'Frost Fade', 'fade', ['#ffffff', '#7fd8ff', '#2a5fff']);
  defKnife(G, 'talon', 'Tiger Ice', 'tiger', ['#dff6ff', '#0a2a4a']);
  defKnife(G, 'flipwing', 'Marble Veil', 'marble', ['#f2f6fa', '#1a2a4a', '#8fb0d6']);

  CASES.push({ id: 'neon', name: 'Neon Case', color: '#ff3df0', price: 120, desc: 'Synthwave, glitches and arcade light.' });
  const N = 'neon';
  defSkin(N, 1, 'glock', 'Pixel Pop', 'digital', ['#ff3df0', '#3df0ff', '#1a0a2a']);
  defSkin(N, 1, 'p2000', 'Grid Runner', 'mesh', ['#0a0a1a', '#ff3df0']);
  defSkin(N, 1, 'nova', 'Static', 'glitch', ['#1a1a1a', '#e0e0e0', '#ff3d6e']);
  defSkin(N, 1, 'mp9', 'Arcade', 'stripes', ['#ff3d6e', '#ffd23d', '#3dd8ff']);
  defSkin(N, 2, 'p90', 'Synthwave', 'fade', ['#ff3df0', '#7a3dff', '#1a0a3d']);
  defSkin(N, 2, 'ssg', 'Laser Lines', 'lines', ['#07020f', '#ff3df0']);
  defSkin(N, 2, 'scar', 'Hot Circuit', 'circuit', ['#0a0612', '#ff3d6e', '#ffd23d']);
  defSkin(N, 2, 'm249', 'Glitch', 'glitch', ['#0a0a14', '#3df0ff', '#ff3df0']);
  defSkin(N, 3, 'deagle', 'Neon Koi', 'scales', ['#140a2a', '#ff6a3d', '#3df0ff']);
  defSkin(N, 3, 'awp', 'Vaporwave', 'aurora', ['#1a0a3d', '#ff71ce', '#01cdfe', '#05ffa1']);
  defSkin(N, 3, 'ak47', 'Hyperdrive', 'lines', ['#0a0014', '#b43dff']);
  defSkin(N, 4, 'm4a4', 'Neon Rider', 'waves', ['#0a0014', '#ff3df0', '#3df0ff', '#ffffff']);
  defSkin(N, 4, 'glock', 'Acid Fade', 'fade', ['#d4ff3d', '#3dffb0', '#ff3df0']);
  defSkin(N, 5, 'awp', 'Prismatic', 'doppler', ['#ff3d3d', '#3dff6e', '#3d6eff', '#ffd23d']);
  defKnife(N, 'talon', 'Gamma Wave', 'doppler', ['#1aff5a', '#003d14', '#8aff3d', '#001a0a']);
  defKnife(N, 'spike', 'Neon Doppler', 'doppler', ['#ff3df0', '#1a003d', '#3df0ff', '#0a0020']);
  defKnife(N, 'flipwing', 'Prism Fade', 'fade', ['#3df0ff', '#ff3df0', '#ffd23d']);
  defKnife(N, 'talon', 'Sakura', 'web', ['#ffb8d8', '#8a1f4a']);

  CASES.push({ id: 'arsenal', name: 'Arsenal Case', color: '#7dff4a', price: 150, desc: 'Finishes for the new guns: miniguns, crossbows and more.' });
  const A = 'arsenal';
  defSkin(A, 1, 'tec9', 'Hazard Stripe', 'stripes', ['#1a1a1a', '#ffd23d']);
  defSkin(A, 1, 'fiveseven', 'Coolant', 'fade', ['#7dffd8', '#1a8aff']);
  defSkin(A, 1, 'mac10', 'Toxic Mesh', 'mesh', ['#1a2a0a', '#7dff4a']);
  defSkin(A, 1, 'ump45', 'Gunmetal Hex', 'hex', ['#3a3f44', '#8a9098']);
  defSkin(A, 2, 'galil', 'Rust Belt', 'rust', ['#5a2a10', '#c86a2a', '#2a1508']);
  defSkin(A, 2, 'xm1014', 'Bone Yard', 'marble', ['#e8e0d0', '#3a3025', '#b8a890']);
  defSkin(A, 2, 'famas', 'Signal Flare', 'lines', ['#1a0a0a', '#ff4a2a']);
  defSkin(A, 2, 'magnum', 'Snakeskin', 'scales', ['#2a3a1a', '#8ab04a', '#d8e08a']);
  defSkin(A, 3, 'aug', 'Chameleon', 'aurora', ['#0a1a0a', '#4aff8a', '#2ad8ff', '#d8ff4a']);
  defSkin(A, 3, 'crossbow', 'Hunter', 'camo', ['#4a3a20', '#2a2010', '#7a6a3a', '#1a1408']);
  defSkin(A, 3, 'm79', 'Bubblegum', 'fade', ['#ff8ad8', '#8ad8ff']);
  defSkin(A, 4, 'minigun', 'Overheat', 'flames', ['#1a0505', '#ff3a00', '#ffb000', '#ffffff']);
  defSkin(A, 4, 'autosniper', 'Night Circuit', 'circuit', ['#05080f', '#3a8aff', '#ff3ad8']);
  defSkin(A, 5, 'minigun', 'Gold Rush', 'doppler', ['#ffe066', '#b8860b', '#fff4c0', '#7a5a00']);
  defKnife(A, 'spike', 'Emerald', 'doppler', ['#0aff6a', '#003d1a', '#6affb0', '#001a0a']);
  defKnife(A, 'flipwing', 'Hazard', 'stripes', ['#1a1a1a', '#ffd23d']);
})();
const SKIN_LIST = Object.values(SKINS);
const skinsIn = (caseId, rarity) => SKIN_LIST.filter(s => s.caseId === caseId && (rarity == null || s.rarity === rarity));

/* ── pattern painter ───────────────────────────────────────────────────── */
function valueNoise(rng, gw) {
  const g = new Float32Array((gw + 1) * (gw + 1));
  for (let i = 0; i < g.length; i++) g[i] = rng();
  for (let i = 0; i <= gw; i++) { g[i * (gw + 1) + gw] = g[i * (gw + 1)]; g[gw * (gw + 1) + i] = g[i]; }
  return (x, y) => { // x,y in 0..1, tiles
    x = ((x % 1) + 1) % 1 * gw; y = ((y % 1) + 1) % 1 * gw;
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a = g[yi * (gw + 1) + xi], b = g[yi * (gw + 1) + xi + 1], c = g[(yi + 1) * (gw + 1) + xi], d = g[(yi + 1) * (gw + 1) + xi + 1];
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  };
}
function fbm(noises, x, y) { let v = 0, a = 0.5, s = 1; for (const n of noises) { v += n(x * s, y * s) * a; a *= 0.5; s *= 2; } return v / (1 - Math.pow(0.5, noises.length)); }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rampRgb(pal, t) { t = clamp(t, 0, 0.9999) * (pal.length - 1); const i = Math.floor(t); return mixRgb(pal[i], pal[Math.min(i + 1, pal.length - 1)], t - i); }

const PATTERNS = {
  solid(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); for (let i = 0; i < 400; i++) { c.fillStyle = p[1]; c.globalAlpha = r() * 0.25; c.fillRect(r() * S, r() * S, 2, 2); } c.globalAlpha = 1; },
  fade(c, S, r, p) { const g = c.createLinearGradient(0, S * r() * 0.2, S, S * (0.8 + r() * 0.2)); p.forEach((col, i) => g.addColorStop(i / (p.length - 1), col)); c.fillStyle = g; c.fillRect(0, 0, S, S); },
  stripes(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); c.save(); c.translate(S / 2, S / 2); c.rotate(-0.6 + r() * 0.3); for (let x = -S; x < S; x += 10 + r() * 22) { c.fillStyle = p[1 + Math.floor(r() * (p.length - 1))]; c.fillRect(x, -S, 4 + r() * 12, S * 2); } c.restore(); },
  camo(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); for (let k = 1; k < p.length; k++) for (let i = 0; i < 14; i++) { c.fillStyle = p[k]; c.beginPath(); const cx = r() * S, cy = r() * S, rad = 12 + r() * 30; for (let a = 0; a < TAU; a += 0.5) { const rr = rad * (0.6 + r() * 0.6); c.lineTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr); } c.fill(); } },
  digital(c, S, r, p) { const s = 8; for (let y = 0; y < S; y += s) for (let x = 0; x < S; x += s) { c.fillStyle = p[Math.floor(r() * r() * p.length * 1.2) % p.length]; c.fillRect(x, y, s, s); } for (let i = 0; i < 40; i++) { c.fillStyle = p[Math.floor(r() * p.length)]; c.fillRect(Math.floor(r() * 32) * s, Math.floor(r() * 32) * s, s * (1 + Math.floor(r() * 4)), s * (1 + Math.floor(r() * 2))); } },
  mesh(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); c.strokeStyle = p[1]; c.lineWidth = 2; const g = 12 + Math.floor(r() * 8); for (let i = -S; i < S * 2; i += g) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + S, S); c.stroke(); c.beginPath(); c.moveTo(i + S, 0); c.lineTo(i, S); c.stroke(); } },
  tiger(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); c.fillStyle = p[1]; for (let i = 0; i < 16; i++) { const y = r() * S, amp = 6 + r() * 10, th = 3 + r() * 9; c.beginPath(); c.moveTo(-10, y); for (let x = 0; x <= S + 10; x += 8) c.lineTo(x, y + Math.sin(x * 0.05 + i) * amp); for (let x = S + 10; x >= -10; x -= 8) c.lineTo(x, y + Math.sin(x * 0.05 + i) * amp + th * (0.4 + Math.abs(Math.sin(x * 0.03 + i)))); c.fill(); } },
  hex(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); c.strokeStyle = p[1]; c.lineWidth = 2; const R = 12; for (let y = 0, row = 0; y < S + R; y += R * 1.5, row++) for (let x = (row % 2) * R * 0.866; x < S + R; x += R * 1.732) { c.globalAlpha = 0.4 + r() * 0.6; c.beginPath(); for (let a = 0; a < 6; a++) c.lineTo(x + Math.cos(a * TAU / 6 + 0.52) * R, y + Math.sin(a * TAU / 6 + 0.52) * R); c.closePath(); c.stroke(); if (r() < 0.1) { c.fillStyle = p[1]; c.fill(); } } c.globalAlpha = 1; },
  circuit(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); c.lineWidth = 2; c.shadowBlur = 6; for (let i = 0; i < 38; i++) { const col = p[1 + (i % (p.length - 1))]; c.strokeStyle = col; c.shadowColor = col; let x = Math.floor(r() * 16) * 16, y = Math.floor(r() * 16) * 16; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { if (r() < 0.5) x += (r() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(r() * 3)); else y += (r() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(r() * 3)); c.lineTo(x, y); } c.stroke(); c.fillStyle = col; c.fillRect(x - 3, y - 3, 6, 6); } c.shadowBlur = 0; },
  marble(c, S, r, p) { const n = [valueNoise(r, 4), valueNoise(r, 8), valueNoise(r, 16)], P = p.map(hexToRgb), img = c.createImageData(S, S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = Math.abs(Math.sin((x / S * 3 + fbm(n, x / S, y / S) * 6) * Math.PI)); const col = v < 0.12 ? rampRgb([P[1], P[2] || P[1]], v / 0.12) : mixRgb(P[0], P[2] || P[0], (1 - v) * 0.3); const i = (y * S + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; } c.putImageData(img, 0, 0); },
  rust(c, S, r, p) { const n = [valueNoise(r, 6), valueNoise(r, 12), valueNoise(r, 24)], P = p.map(hexToRgb), img = c.createImageData(S, S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = fbm(n, x / S, y / S); const col = rampRgb(P, v * v * 1.4); const i = (y * S + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; } c.putImageData(img, 0, 0); },
  case(c, S, r, p) { // case hardened: seed decides how much blue — a high-blue seed is the jackpot
    const n = [valueNoise(r, 5), valueNoise(r, 10), valueNoise(r, 20)], P = p.map(hexToRgb), bias = r() * 0.5 + 0.25, img = c.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = fbm(n, x / S, y / S) + (bias - 0.5); const col = v > 0.55 ? mixRgb(P[1], P[2], (v - 0.55) * 2) : mixRgb(P[0], P[2], clamp((0.55 - v) * 1.5, 0, 0.6)); const i = (y * S + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; }
    c.putImageData(img, 0, 0);
  },
  doppler(c, S, r, p) { const n = [valueNoise(r, 3), valueNoise(r, 6), valueNoise(r, 12)], P = p.map(hexToRgb), img = c.createImageData(S, S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = fbm(n, x / S, y / S); const sw = (Math.sin(v * 14 + x / S * 4) + 1) / 2; const col = rampRgb(P, sw); const i = (y * S + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; } c.putImageData(img, 0, 0); for (let i = 0; i < 90; i++) { c.fillStyle = 'rgba(255,255,255,' + r() * 0.8 + ')'; c.fillRect(r() * S, r() * S, 1.5, 1.5); } },
  waves(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); c.lineCap = 'round'; for (let i = 0; i < 26; i++) { c.strokeStyle = p[1 + (i % (p.length - 1))]; c.lineWidth = 2 + r() * 9; c.shadowColor = c.strokeStyle; c.shadowBlur = 8; const y0 = r() * S, f = 0.02 + r() * 0.03, ph = r() * 9; c.beginPath(); for (let x = -10; x <= S + 10; x += 6) c.lineTo(x, y0 + Math.sin(x * f + ph) * 30 + Math.sin(x * f * 2.3) * 10); c.stroke(); } c.shadowBlur = 0; },
  flames(c, S, r, p) { const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, p[0]); g.addColorStop(1, p[1]); c.fillStyle = g; c.fillRect(0, 0, S, S); for (let k = 1; k < p.length; k++) for (let i = 0; i < 18; i++) { c.fillStyle = p[k]; c.globalAlpha = 0.85; const x = r() * S, w = 12 + r() * 26, h = S * (0.3 + r() * 0.5) / k; c.beginPath(); c.moveTo(x - w, S); c.quadraticCurveTo(x - w * 0.6, S - h * 0.6, x + (r() - 0.5) * w, S - h); c.quadraticCurveTo(x + w * 0.4, S - h * 0.5, x + w, S); c.fill(); } c.globalAlpha = 1; },
  web(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); c.strokeStyle = p[1]; c.lineWidth = 1.6; const cx = S * (0.3 + r() * 0.4), cy = S * (0.3 + r() * 0.4); for (let a = 0; a < TAU; a += TAU / 14) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * S, cy + Math.sin(a) * S); c.stroke(); } for (let rr = 14; rr < S; rr += 16) { c.beginPath(); for (let a = 0; a <= TAU + 0.01; a += TAU / 14) { const m = a + TAU / 28; c.quadraticCurveTo(cx + Math.cos(m) * rr * 0.85, cy + Math.sin(m) * rr * 0.85, cx + Math.cos(a + TAU / 14) * rr, cy + Math.sin(a + TAU / 14) * rr); } c.stroke(); } },
  scales(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); const R = 14; for (let y = -R, row = 0; y < S + R; y += R * 0.7, row++) for (let x = (row % 2) * R - R; x < S + R; x += R * 2) { const g = c.createRadialGradient(x, y, 1, x, y, R); g.addColorStop(0, p[1 + Math.floor(r() * (p.length - 1))]); g.addColorStop(1, p[0]); c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, Math.PI); c.fill(); } },
  shards(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); for (let i = 0; i < 60; i++) { c.fillStyle = p[Math.floor(r() * p.length)]; c.globalAlpha = 0.5 + r() * 0.5; c.beginPath(); const x = r() * S, y = r() * S; c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 70, y + (r() - 0.5) * 70); c.lineTo(x + (r() - 0.5) * 70, y + (r() - 0.5) * 70); c.fill(); } c.globalAlpha = 1; },
  lines(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); c.strokeStyle = p[1]; c.shadowColor = p[1]; c.shadowBlur = 10; for (let i = 0; i < 30; i++) { c.lineWidth = 1 + r() * 3; c.beginPath(); const y = r() * S; c.moveTo(0, y); c.lineTo(S, y + (r() - 0.5) * 80); c.stroke(); } c.shadowBlur = 0; },
  glitch(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); for (let i = 0; i < 70; i++) { c.fillStyle = p[1 + Math.floor(r() * (p.length - 1))]; c.globalAlpha = 0.3 + r() * 0.7; c.fillRect(r() * S, r() * S, 10 + r() * 80, 1 + r() * 6); } c.globalAlpha = 1; },
  aurora(c, S, r, p) { c.fillStyle = p[0]; c.fillRect(0, 0, S, S); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const col = p[1 + (i % (p.length - 1))]; const y0 = r() * S; const g = c.createLinearGradient(0, y0 - 40, 0, y0 + 40); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.globalAlpha = 0.45; c.beginPath(); c.moveTo(0, y0); for (let x = 0; x <= S; x += 8) c.lineTo(x, y0 - 30 + Math.sin(x * 0.03 + i) * 25); for (let x = S; x >= 0; x -= 8) c.lineTo(x, y0 + 30 + Math.sin(x * 0.025 + i * 2) * 25); c.fill(); } c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; },
};

/* Paints wear on top: scratches and a desaturating scuff that grow with float. */
function paintWear(c, S, r, f) {
  const n = Math.floor(f * 260);
  for (let i = 0; i < n; i++) {
    c.strokeStyle = r() < 0.6 ? 'rgba(200,200,200,' + (0.2 + r() * 0.4) + ')' : 'rgba(20,20,20,' + (0.2 + r() * 0.3) + ')';
    c.lineWidth = 0.6 + r() * 1.4; c.beginPath(); const x = r() * S, y = r() * S; c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 14); c.stroke();
  }
  if (f > 0.3) { c.fillStyle = 'rgba(120,120,110,' + (f - 0.3) * 0.5 + ')'; c.fillRect(0, 0, S, S); }
}

const _texCache = new Map();
function skinCanvas(skin, seed = 0, flt = 0.1, size = 256) {
  const key = skin.id + ':' + seed + ':' + Math.round(flt * 20) + ':' + size;
  if (_texCache.has(key)) return _texCache.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d'), r = mulberry(hashStr(skin.id) ^ (seed * 2654435761));
  (PATTERNS[skin.pattern] || PATTERNS.solid)(c, size, r, skin.pal);
  paintWear(c, size, mulberry(seed + 7), flt);
  _texCache.set(key, cv);
  return cv;
}
const _threeTexCache = new Map();
function skinTexture(item) {
  if (!item) return null;
  const skin = SKINS[item.skinId]; if (!skin) return null;
  const key = item.skinId + ':' + item.seed + ':' + Math.round(item.float * 20);
  if (_threeTexCache.has(key)) return _threeTexCache.get(key);
  const t = new THREE.CanvasTexture(skinCanvas(skin, item.seed, item.float));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  _threeTexCache.set(key, t);
  return t;
}

/* ── 2D previews: a weapon silhouette filled with the skin ─────────────── */
const SILHOUETTES = {
  pistol: [[0.08, 0.2], [0.72, 0.2], [0.72, 0.36], [0.46, 0.4], [0.42, 0.85], [0.26, 0.85], [0.3, 0.42], [0.08, 0.38]],
  rifle: [[0.0, 0.34], [0.06, 0.3], [0.2, 0.3], [0.24, 0.26], [0.62, 0.26], [0.64, 0.33], [0.95, 0.33], [0.95, 0.38], [0.62, 0.4], [0.58, 0.55], [0.52, 0.72], [0.47, 0.7], [0.5, 0.48], [0.4, 0.48], [0.36, 0.6], [0.3, 0.6], [0.31, 0.46], [0.22, 0.44], [0.05, 0.56], [0.0, 0.5]],
  smg: [[0.05, 0.3], [0.7, 0.3], [0.7, 0.36], [0.85, 0.36], [0.85, 0.4], [0.6, 0.44], [0.56, 0.8], [0.48, 0.8], [0.48, 0.46], [0.36, 0.46], [0.34, 0.6], [0.26, 0.6], [0.28, 0.46], [0.12, 0.44], [0.05, 0.5]],
  sniper: [[0.0, 0.36], [0.2, 0.34], [0.28, 0.3], [0.3, 0.2], [0.58, 0.2], [0.58, 0.3], [0.99, 0.32], [0.99, 0.36], [0.58, 0.38], [0.5, 0.42], [0.42, 0.62], [0.36, 0.6], [0.38, 0.44], [0.22, 0.44], [0.04, 0.58], [0.0, 0.52]],
  shotgun: [[0.0, 0.38], [0.2, 0.32], [0.95, 0.32], [0.95, 0.38], [0.7, 0.4], [0.7, 0.46], [0.45, 0.46], [0.36, 0.44], [0.33, 0.6], [0.27, 0.58], [0.28, 0.44], [0.18, 0.44], [0.04, 0.58], [0.0, 0.52]],
  lmg: [[0.0, 0.36], [0.08, 0.28], [0.62, 0.26], [0.66, 0.32], [0.98, 0.33], [0.98, 0.38], [0.62, 0.42], [0.56, 0.44], [0.54, 0.66], [0.4, 0.66], [0.4, 0.48], [0.34, 0.6], [0.28, 0.58], [0.3, 0.46], [0.08, 0.46], [0.0, 0.52]],
  knife: [[0.05, 0.45], [0.38, 0.4], [0.42, 0.34], [0.55, 0.36], [0.95, 0.46], [0.6, 0.56], [0.42, 0.52], [0.38, 0.56], [0.05, 0.56]],
  talon: [[0.05, 0.5], [0.4, 0.46], [0.5, 0.4], [0.7, 0.34], [0.9, 0.44], [0.78, 0.46], [0.62, 0.46], [0.52, 0.56], [0.4, 0.58], [0.05, 0.6]],
  flipwing: [[0.05, 0.44], [0.45, 0.44], [0.48, 0.38], [0.95, 0.44], [0.48, 0.52], [0.45, 0.56], [0.05, 0.56]],
  spike: [[0.05, 0.44], [0.3, 0.42], [0.34, 0.36], [0.4, 0.42], [0.98, 0.48], [0.4, 0.54], [0.34, 0.6], [0.3, 0.56], [0.05, 0.56]],
};
function silhouetteFor(skin) { if (skin.weapon === 'knife') return SILHOUETTES[skin.knife] || SILHOUETTES.knife; const t = WEAPONS[skin.weapon].type; return SILHOUETTES[t] || SILHOUETTES.rifle; }
function drawSkinPreview(canvas, item, skinOverride) {
  const skin = skinOverride || SKINS[item.skinId]; const c = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
  c.clearRect(0, 0, W, H);
  const poly = silhouetteFor(skin);
  const pat = c.createPattern(skinCanvas(skin, item ? item.seed : 0, item ? item.float : 0.05), 'repeat');
  c.save(); c.beginPath(); poly.forEach(([x, y], i) => i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H)); c.closePath();
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 10; c.shadowOffsetY = 4; c.fillStyle = '#222'; c.fill(); c.shadowColor = 'transparent';
  c.clip(); c.fillStyle = pat; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.2; c.beginPath(); poly.forEach(([x, y], i) => i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H)); c.closePath(); c.stroke();
}

/* ── inventory ─────────────────────────────────────────────────────────── */
const Inv = {
  data: null,
  load() {
    this.data = Store.get('inv', null);
    if (!this.data) {
      this.data = { credits: 1500, items: [], cases: { ember: 1, glacier: 1, neon: 0, arsenal: 1 }, keys: 2, equipped: {}, stats: { kills: 0, deaths: 0, wins: 0, matches: 0, opened: 0 }, history: [] };
      // a starter so the armory isn't empty
      const s = this.newItem('ak47_safari_mesh'); this.data.items.push(s); this.data.equipped.ak47 = s.uid;
    }
    this.data.cases = Object.assign({ ember: 0, glacier: 0, neon: 0, arsenal: 0 }, this.data.cases);
    this.data.stats = Object.assign({ kills: 0, deaths: 0, wins: 0, matches: 0, opened: 0 }, this.data.stats);
    this.data.attach = this.data.attach || {}; this.data.unlocked = this.data.unlocked || ['reddot'];
    this.save();
  },
  save() { Store.set('inv', this.data); },
  newItem(skinId, opts = {}) {
    const f = opts.float != null ? opts.float : Math.pow(Math.random(), 1.4) * 0.8 + Math.random() * 0.05;
    return { uid: uid(10), skinId, float: +clamp(f, 0.0001, 0.9999).toFixed(4), seed: opts.seed != null ? opts.seed : randi(0, 999), st: opts.st != null ? opts.st : (SKINS[skinId].rarity >= 1 && chance(0.1)), kills: 0, t: Date.now() };
  },
  byUid(u) { return this.data.items.find(i => i.uid === u); },
  value(item) {
    const s = SKINS[item.skinId]; let v = RARITY[s.rarity].value * wearOf(item.float).mult;
    if (item.st) v *= 1.8;
    if (s.pattern === 'case' && caseBlue(item) > 0.5) v *= 3;
    if (s.pattern === 'doppler' && item.seed % 97 === 0) v *= 4;
    return Math.round(v);
  },
  displayName(item) { const s = SKINS[item.skinId]; const wn = s.weapon === 'knife' ? '★ ' : ''; return (item.st ? 'StatTrak™ ' : '') + wn + (s.weapon === 'knife' ? s.name : WEAPONS[s.weapon].name + ' | ' + s.name); },
  equip(item) { const s = SKINS[item.skinId]; this.data.equipped[s.weapon] = item.uid; this.save(); },
  unequip(weapon) { delete this.data.equipped[weapon]; this.save(); },
  equippedItem(weapon) { const u = this.data.equipped[weapon]; return u ? this.byUid(u) : null; },
  isEquipped(item) { return this.data.equipped[SKINS[item.skinId].weapon] === item.uid; },
  sell(item) {
    const v = this.value(item); this.data.credits += v;
    if (this.isEquipped(item)) this.unequip(SKINS[item.skinId].weapon);
    this.data.items = this.data.items.filter(i => i !== item); this.save(); return v;
  },
  /* equipped skins as a compact map sent to other players */
  loadoutSkins() { const o = {}; for (const w in this.data.equipped) { const it = this.equippedItem(w); if (it) o[w] = { s: it.skinId, f: it.float, d: it.seed, st: it.st ? it.kills : -1 }; } return o; },
  addKill(weapon) { const it = this.equippedItem(weapon); if (it && it.st) it.kills++; },
};
function caseBlue(item) { // fraction of blue on a case-hardened item, computed from its seed
  const r = mulberry(hashStr(item.skinId) ^ (item.seed * 2654435761)); valueNoise(r, 5); valueNoise(r, 10); valueNoise(r, 20);
  return r() * 0.5 + 0.25 < 0.3 ? 0.7 : 0.3; // low bias paints mostly blue: the "blue gem"
}

/* ── opening ───────────────────────────────────────────────────────────── */
function rollRarity() {
  let x = Math.random(), acc = 0;
  for (let r = 6; r >= 1; r--) { acc += CASE_ODDS[r]; if (x < acc) return r; }
  return 1;
}
function rollCase(caseId) {
  let r = rollRarity(), pool = skinsIn(caseId, r);
  while (!pool.length && r > 1) pool = skinsIn(caseId, --r);
  const skin = pick(pool);
  return Inv.newItem(skin.id, { st: skin.rarity < 6 ? chance(0.1) : chance(0.1) });
}
/* Reel filler: what the strip shows scrolling past, weighted like real odds */
function reelFiller(caseId) { const r = Math.random() < 0.02 ? 6 : rollRarity(); const pool = skinsIn(caseId, r); return pick(pool.length ? pool : skinsIn(caseId, 1)); }

/* Trade-up: ten of one rarity for one of the next, from the same collections. */
function tradeUp(items) {
  if (items.length !== 10) return null;
  const r = SKINS[items[0].skinId].rarity;
  if (r >= 5 || items.some(i => SKINS[i.skinId].rarity !== r)) return null;
  const st = items[0].st; if (items.some(i => i.st !== st)) return null;
  const cols = items.map(i => SKINS[i.skinId].caseId);
  let pool = [];
  cols.forEach(cid => { const p = SKIN_LIST.filter(s => s.caseId === cid && s.rarity === r + 1 && s.weapon !== 'knife'); p.forEach(s => pool.push(s)); });
  if (!pool.length) pool = SKIN_LIST.filter(s => s.rarity === r + 1 && s.weapon !== 'knife');
  if (!pool.length) return null;
  const avg = items.reduce((a, i) => a + i.float, 0) / 10;
  return Inv.newItem(pick(pool).id, { float: avg, st });
}

/* Match reward: credits plus a chance at a drop (field skin or a case). */
function matchDrop() {
  const x = Math.random();
  if (x < 0.35) { const c = pick(CASES); return { kind: 'case', caseId: c.id }; }
  if (x < 0.8) { const pool = SKIN_LIST.filter(s => s.caseId === 'field'); return { kind: 'item', item: Inv.newItem(pick(pool).id, { st: false }) }; }
  return null;
}
