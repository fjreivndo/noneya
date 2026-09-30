/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Sound and radio.
   · Bots talk more: contact calls, reloading, grenade warnings, man down,
     sniper, enemy vehicle, low on health, medic. Your team's lines can be
     spoken aloud (Settings → Radio voices), each bot with its own voice,
     with a radio squelch before and after.
   · Getting hit: a thump panned toward whoever shot you, a different
     sound when your armour takes it, and a heartbeat when you're low.
   · New hit sounds (body, armour, headshot "tink") and a heavier kill
     confirm.
   · Settings → Gameplay also gets switches for revives, destruction and
     radio voices.
   ═══════════════════════════════════════════════════════════════════════════ */
if (Settings.radioVoice == null) Settings.radioVoice = true;
if (Settings.radioVol == null) Settings.radioVol = 0.7;
const _sfxPlay59 = Sfx.play.bind(Sfx);
Sfx.play = function (type, pos, opt = {}) {
  if (!this.ctx || this.ctx.state !== 'running') return;
  const ours = { hit: 1, headshot: 1, kill: 1, armorhit: 1, hurtdir: 1, squelch: 1, heart: 1, nade: 1 };
  if (!ours[type]) return _sfxPlay59(type, pos, opt);
  const sp = type === 'hurtdir' ? this.spatial(pos, 400) : [1, 0]; if (!sp) return;
  const t = this.ctx.currentTime, o = this.out(sp[0] * (opt.vol || 1), type === 'hurtdir' ? sp[1] : 0);
  switch (type) {
    case 'hit': this.burst(o, t, 0.035, 5000, 2500, 3, 0.35, 'bandpass'); this.tone(o, t, 0.06, 420, 180, 0.35, 'sine'); break;
    case 'armorhit': this.tone(o, t, 0.05, 2400, 1900, 0.18, 'square'); this.burst(o, t, 0.06, 7000, 4000, 6, 0.3, 'bandpass'); this.tone(o, t + 0.01, 0.08, 900, 700, 0.12, 'triangle'); break;
    case 'headshot': this.tone(o, t, 0.2, 3100, 2900, 0.28, 'sine'); this.tone(o, t, 0.12, 4650, 4400, 0.12, 'sine'); this.burst(o, t, 0.05, 9000, 6000, 5, 0.3, 'highpass'); this.tone(o, t, 0.08, 300, 120, 0.3, 'sine'); break;
    case 'kill': this.tone(o, t, 0.09, 740, 740, 0.22, 'triangle'); this.tone(o, t + 0.08, 0.2, 1110, 1110, 0.22, 'triangle'); this.tone(o, t, 0.25, 90, 45, 0.5, 'sine'); this.burst(o, t, 0.12, 1800, 400, 1, 0.2); break;
    case 'hurtdir': this.tone(o, t, 0.18, 110, 50, 0.9, 'sine'); this.burst(o, t, 0.14, 900, 150, 1.5, 0.7); break;
    case 'squelch': this.burst(o, t, 0.07, 3000, 2400, 2, 0.12 * Settings.radioVol, 'bandpass'); this.tone(o, t, 0.03, 1900, 1900, 0.04 * Settings.radioVol, 'square'); break;
    case 'heart': this.tone(o, t, 0.1, 70, 40, 0.8, 'sine'); this.tone(o, t + 0.22, 0.1, 65, 38, 0.6, 'sine'); break;
    case 'nade': this.tone(o, t, 0.05, 1500, 1500, 0.12, 'triangle'); break;
  }
};
/* hits: armour or flesh */
const _reportHit59 = Game.reportHit.bind(Game);
Game.reportHit = function (att, vic, dmg, zone, weapon, from) {
  if (att && att.ctrl === 'local' && vic && zone !== 'head' && vic.armor > 0 && this.mode.armor && zone !== 'legs') { const p = Sfx.play; Sfx.play = function (t, a, b) { return p.call(Sfx, t === 'hit' ? 'armorhit' : t, a, b); }; try { return _reportHit59(att, vic, dmg, zone, weapon, from); } finally { Sfx.play = p; } }
  return _reportHit59(att, vic, dmg, zone, weapon, from);
};
/* getting hit: from which side */
const _hurt59 = HUD.hurt.bind(HUD);
HUD.hurt = function (fromPos, d) {
  _hurt59(fromPos, d);
  const L = Game.local; if (!L) return;
  if (fromPos && Math.hypot(fromPos.x - L.pos.x, fromPos.z - L.pos.z) > 1) { const dx = fromPos.x - L.pos.x, dz = fromPos.z - L.pos.z, l = Math.hypot(dx, dz); Sfx.play('hurtdir', { x: L.pos.x + dx / l * 6, y: L.pos.y + 1.4, z: L.pos.z + dz / l * 6 }, { vol: clamp(d / 40, 0.4, 1) }); }
  if (L.armor > 0 && Game.mode.armor) Sfx.play('armorhit', null, { vol: 0.5 });
};
const Heart = { t: 0, update(dt) { const L = Game.local; if (!L || !L.alive || L.hp > 30) { this.t = 0; return; } this.t -= dt; if (this.t <= 0) { this.t = L.hp < 15 ? 0.6 : 0.9; Sfx.play('heart', null, { vol: L.hp < 15 ? 0.9 : 0.6 }); } } };

/* ── radio: more lines, and voices ─────────────────────────────────────── */
const RADIO_LINES = {
  contact: ['Contact!', 'Enemy spotted!', 'Contact front!', 'Tango, dead ahead!', 'Eyes on hostiles!', 'I see them!'],
  reload: ['Reloading!', 'Changing mags!', 'Cover me, reloading!', 'Mag out!'],
  nade: ['Grenade!', 'Frag! Move!', 'Nade, get clear!'],
  mandown: ['Man down!', 'We lost one!', "He's down!", 'Friendly down!'],
  sniper: ['Sniper!', 'Sniper, watch the long angles!', 'Glint! Sniper out there!'],
  vehicle: ['Enemy armour!', 'Vehicle incoming!', 'Enemy vehicle spotted!', 'Heads up, vehicle!'],
  air: ['Enemy aircraft!', 'Chopper overhead!', 'Air threat!'],
  hurt: ["I'm hit!", 'Taking fire!', "I'm hurt bad!", 'Need a medic!'],
  kill: ['Got him!', 'Target down.', 'One less.', 'Enemy down!', 'Tango down.'],
};
const Voice = {
  q: [], busy: false, voices: null,
  pick(name) {
    if (!('speechSynthesis' in window)) return null;
    if (!this.voices || !this.voices.length) this.voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    if (!this.voices.length) return null; return this.voices[hashStr(name) % this.voices.length];
  },
  say(from, text) {
    if (!Settings.radioVoice || !('speechSynthesis' in window) || !Game.running || document.hidden) return;
    if (this.q.length > 1) return;
    this.q.push({ from, text }); this.next();
  },
  next() {
    if (this.busy || !this.q.length) return; const { from, text } = this.q.shift();
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g, '')); const v = this.pick(from); if (v) u.voice = v;
      const h = hashStr(from || 'x'); u.pitch = 0.75 + (h % 50) / 100; u.rate = 1.15 + (h % 20) / 100; u.volume = clamp(Settings.radioVol * Settings.vol * 1.4, 0, 1);
      this.busy = true; Sfx.play('squelch');
      u.onend = u.onerror = () => { this.busy = false; Sfx.play('squelch'); setTimeout(() => this.next(), 150); };
      speechSynthesis.speak(u); setTimeout(() => { if (this.busy) { this.busy = false; this.next(); } }, 6000);
    } catch (e) { this.busy = false; }
  },
};
const _radio59 = HUD.radio.bind(HUD);
HUD.radio = function (from, text) { _radio59(from, text); if (from && from !== 'Command' && Game.local && Game.running) Voice.say(from, text); };
/* bots speak up: one line per team every so often, per kind */
const Chatter = {
  cd: {},
  line(s, kind, force) {
    if (!s || !s.alive || !s.isBot || !Game.cmd[s.team] || !Game.authority() || ['sandbox', 'royale', 'editor'].includes(Game.mode.id) || s.team === 'Z' || s.npc) return;
    const k = s.team + kind, now = Game.now; if (!force && now < (this.cd[k] || 0)) return;
    this.cd[k] = now + ({ contact: 9, reload: 12, nade: 5, mandown: 7, sniper: 20, vehicle: 18, air: 20, hurt: 14, kill: 10 }[kind] || 10);
    Game.cmd[s.team].say(s, pick(RADIO_LINES[kind]), 0);
  },
};
const _acquire59 = Brain.prototype.acquire;
Brain.prototype.acquire = function (e, dist) {
  const had = this.target && this.target.alive, r = _acquire59.call(this, e, dist);
  if (!had && e) { const v = e.vehicle; if (v && (v.K.type === 'heli' || v.K.type === 'jet')) Chatter.line(this.s, 'air'); else if (v && v.K.closed) Chatter.line(this.s, 'vehicle'); else if (e.w && e.w.type === 'sniper' && dist > 50) Chatter.line(this.s, 'sniper'); else if (chance(0.5)) Chatter.line(this.s, 'contact'); }
  return r;
};
const _reload59 = Soldier.prototype.startReload;
Soldier.prototype.startReload = function () { const r = _reload59.call(this); if (r && this.ctrl === 'bot' && this.brain && this.brain.target && chance(0.5)) Chatter.line(this, 'reload'); return r; };
const _kill59 = Game.kill.bind(Game);
Game.kill = function (v, att, weapon, hs) {
  const was = v && v.alive, r = _kill59(v, att, weapon, hs);
  if (was && v && !v.alive && this.authority()) {
    const mate = this.soldiers.find(s => s.alive && s.isBot && s.team === v.team && s !== v && dist2(s.pos.x, s.pos.z, v.pos.x, v.pos.z) < 25); if (mate) Chatter.line(mate, 'mandown');
    if (att && att.isBot && att !== v && chance(0.35)) Chatter.line(att, 'kill');
  }
  return r;
};
const _damage59 = Game.damage.bind(Game);
Game.damage = function (v, dmg, att, weapon, zone, from) { const hp0 = v && v.hp, r = _damage59(v, dmg, att, weapon, zone, from); if (v && v.alive && v.isBot && hp0 > 40 && v.hp <= 40 && chance(0.6)) Chatter.line(v, 'hurt'); return r; };
/* grenades landing near bots */
const NadeWatch = { seen: new Set(), update() {
  if (!Game.authority()) return;
  for (const n of Game.nades) { if (n.type !== 'frag' || this.seen.has(n) || !n.pos) continue; if (n.vel && n.vel.length() > 3) continue; this.seen.add(n);
    const s = Game.soldiers.find(x => x.alive && x.isBot && x.team !== (n.owner && n.owner.team) && dist2(x.pos.x, x.pos.z, n.pos.x, n.pos.z) < 7); if (s) Chatter.line(s, 'nade', true); }
  if (this.seen.size > 200) this.seen.clear();
} };
const _gupdate59 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate59(dt); if (!this.running) return; Heart.update(dt); NadeWatch.update(); };
const _stop59 = Game.stop.bind(Game);
Game.stop = function () { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { } Voice.q = []; Voice.busy = false; return _stop59(); };

/* ── Settings: the v3.0 switches ───────────────────────────────────────── */
const _rs59 = UI.render_settings;
UI.render_settings = function () {
  _rs59.call(this);
  const f = $('setForm'); if (!f) return;
  const old = f.parentElement.querySelector('.v3box'); if (old) old.remove();
  const box = document.createElement('div'); box.className = 'keybox v3box';
  const row = (k, label, sub) => `<div class="keyrow"><span>${label}<small class="muted" style="display:block">${sub}</small></span><button class="kbtn ${Settings[k] !== false ? 'changed' : ''}" data-v3="${k}">${Settings[k] !== false ? 'On' : 'Off'}</button></div>`;
  const draw = () => {
    box.innerHTML = `<h3>Gameplay</h3><div class="keygrid">${row('revives', 'Revives', 'Get downed instead of killed; teammates pick you up')}${row('destruction', 'Destruction', 'Explosions wreck cover and blow holes in walls')}${row('radioVoice', 'Radio voices', "Your team's radio calls read aloud")}${row('killcam', 'Killcam', 'Replay of how you died')}</div>`;
    box.querySelectorAll('[data-v3]').forEach(b => b.onclick = () => { const k = b.dataset.v3; Settings[k] = Settings[k] === false; saveSettings(); Sfx.play('ui'); draw(); });
  };
  draw(); const kb = f.parentElement.querySelector('.keybox'); (kb || f).before(box);
};
