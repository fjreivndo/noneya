'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   BREACHPOINT — core
   Math helpers, persistent storage, settings, input and synthesized audio.
   Everything in src/ is concatenated into one <script>, so top-level names
   are shared across files in load order.
   ═══════════════════════════════════════════════════════════════════════════ */

const VERSION = '1.3';
const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;
const angWrap = a => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const angDiff = (a, b) => angWrap(b - a);
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function uid(n = 6) { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

/* Seeded RNG so procedural skin textures look identical on every machine. */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ── storage ───────────────────────────────────────────────────────────── */
const Store = {
  get(k, d) { try { const v = localStorage.getItem('bp_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('bp_' + k, JSON.stringify(v)); } catch (e) { } },
};

const Settings = Object.assign({
  name: 'Player' + randi(100, 999),
  sens: 1.0, fov: 85, vol: 0.55, diff: 'normal',
  xhColor: '#4dff88', xhSize: 6, xhGap: 4, xhDot: false,
  showFps: false, viewDist: 1, botSight: 1,
}, Store.get('settings', {}));
function saveSettings() { Store.set('settings', Settings); if (Sfx.master) Sfx.master.gain.value = Settings.vol; }

/* ── input ─────────────────────────────────────────────────────────────── */
const Input = {
  keys: {}, pressed: {}, released: {},
  mouse: { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 },
  locked: false, typing: false,
  down(k) { return !!this.keys[k]; },
  hit(k) { return !!this.pressed[k]; },
  endFrame() { this.pressed = {}; this.released = {}; const m = this.mouse; m.dx = m.dy = 0; m.leftPressed = m.rightPressed = false; m.wheel = 0; },
  clear() { this.keys = {}; this.mouse.left = this.mouse.right = false; },
};
addEventListener('keydown', e => {
  if (Input.typing) return;
  const k = e.code;
  if (!Input.keys[k]) Input.pressed[k] = true;
  Input.keys[k] = true;
  if (['Tab', 'Space', 'KeyB', 'Quote', 'Backquote', 'F1'].includes(k) || (e.ctrlKey && k === 'KeyS')) e.preventDefault();
});
addEventListener('keyup', e => { Input.keys[e.code] = false; Input.released[e.code] = true; });
addEventListener('mousemove', e => { if (Input.locked) { Input.mouse.dx += e.movementX; Input.mouse.dy += e.movementY; } });
addEventListener('mousedown', e => {
  if (e.button === 0) { Input.mouse.left = true; Input.mouse.leftPressed = true; }
  if (e.button === 2) { Input.mouse.right = true; Input.mouse.rightPressed = true; }
});
addEventListener('mouseup', e => { if (e.button === 0) Input.mouse.left = false; if (e.button === 2) Input.mouse.right = false; });
addEventListener('wheel', e => { Input.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => Input.clear());
document.addEventListener('pointerlockchange', () => { Input.locked = document.pointerLockElement != null; });

/* ── audio ─────────────────────────────────────────────────────────────────
   Every sound is synthesized: filtered noise for gunfire and explosions,
   oscillators for UI blips. Positional sounds are attenuated by distance
   and panned by angle relative to the listener's yaw. */
const Sfx = {
  ctx: null, master: null, noise: null, listener: { x: 0, y: 0, z: 0, yaw: 0 }, lastStep: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = Settings.vol;
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -12;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch (e) { this.ctx = null; }
  },
  /* returns [gain, pan] for a world position, or null when inaudible */
  spatial(pos, range) {
    if (!pos) return [1, 0];
    const L = this.listener, dx = pos.x - L.x, dz = pos.z - L.z, dy = pos.y - L.y;
    const d = Math.hypot(dx, dy, dz);
    if (d > range) return null;
    const g = Math.pow(1 - d / range, 1.6) / (1 + d * 0.02);
    const ang = Math.atan2(dx, dz); // world angle of source
    const rel = angDiff(L.yaw + Math.PI, ang);
    return [g, clamp(Math.sin(rel) * -0.8, -0.8, 0.8)];
  },
  out(gain, pan) {
    const g = this.ctx.createGain(); g.gain.value = gain;
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.master); }
    else g.connect(this.master);
    return g;
  },
  burst(dest, t0, dur, f0, f1, q, vol, type = 'lowpass') {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = rand(0.9, 1.1);
    const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  },
  tone(dest, t0, dur, f0, f1, vol, type = 'square') {
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  play(type, pos, opt = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ranges = { shot: 140, explode: 200, step: 18, reload: 14, beep: 40, plant: 30, flash: 60, knife: 10, vehicle: 50, impact: 25, whiz: 6 };
    const sp = this.spatial(pos, ranges[type] || 60);
    if (!sp) return;
    const t = this.ctx.currentTime, o = this.out(sp[0] * (opt.vol || 1), sp[1]);
    switch (type) {
      case 'shot': {
        const w = opt.w || {}; const heavy = w.sound || 1;
        this.burst(o, t, 0.08 + heavy * 0.12, 4000 + heavy * 1500, 300, 0.7, 0.9);
        this.burst(o, t, 0.25 + heavy * 0.25, 900, 60, 1, 0.6 * heavy);
        this.tone(o, t, 0.06, 150 + 80 / heavy, 40, 0.5, 'sine');
        if (w.suppressed) break;
        this.burst(o, t + 0.02, 0.5 + heavy * 0.3, 500, 80, 0.5, 0.18 * heavy);
        break;
      }
      case 'empty': this.tone(o, t, 0.03, 2200, 1800, 0.2); break;
      case 'reload': this.burst(o, t, 0.05, 3000, 2000, 4, 0.4, 'bandpass'); this.burst(o, t + 0.35, 0.06, 2500, 1500, 4, 0.5, 'bandpass'); break;
      case 'bolt': this.burst(o, t, 0.08, 2000, 1200, 3, 0.5, 'bandpass'); this.burst(o, t + 0.18, 0.06, 2600, 1800, 3, 0.4, 'bandpass'); break;
      case 'step': this.burst(o, t, 0.06, 900, 200, 1, 0.25 * (opt.vol || 1)); break;
      case 'land': this.burst(o, t, 0.1, 600, 100, 1, 0.5); break;
      case 'hit': this.tone(o, t, 0.05, 1800, 1400, 0.25, 'triangle'); break;
      case 'headshot': this.tone(o, t, 0.12, 3200, 2400, 0.3, 'triangle'); this.burst(o, t, 0.08, 6000, 3000, 2, 0.3, 'highpass'); break;
      case 'hurt': this.burst(o, t, 0.15, 400, 100, 2, 0.6); break;
      case 'kill': this.tone(o, t, 0.08, 880, 880, 0.25, 'triangle'); this.tone(o, t + 0.09, 0.14, 1320, 1320, 0.25, 'triangle'); break;
      case 'explode': this.burst(o, t, 1.4, 2400, 40, 0.8, 1.2); this.tone(o, t, 0.6, 90, 25, 0.9, 'sine'); break;
      case 'flash': this.burst(o, t, 0.4, 7000, 2000, 0.6, 0.8, 'highpass'); break;
      case 'smoke': this.burst(o, t, 1.6, 2500, 800, 0.4, 0.35, 'bandpass'); break;
      case 'bounce': this.tone(o, t, 0.04, 1500, 900, 0.2, 'triangle'); break;
      case 'pin': this.tone(o, t, 0.05, 3500, 3000, 0.15, 'triangle'); break;
      case 'knife': this.burst(o, t, 0.12, 5000, 1500, 1, 0.3, 'highpass'); break;
      case 'impact': this.burst(o, t, 0.05, 3500, 1000, 1.5, 0.25, 'bandpass'); break;
      case 'whiz': this.burst(o, t, 0.12, 3000, 6000, 3, 0.4, 'bandpass'); break;
      case 'beep': this.tone(o, t, 0.09, 2600, 2600, 0.25, 'sine'); break;
      case 'plant': this.tone(o, t, 0.05, 1200, 1200, 0.2); this.tone(o, t + 0.1, 0.05, 1500, 1500, 0.2); break;
      case 'buy': this.burst(o, t, 0.05, 3000, 2000, 4, 0.3, 'bandpass'); break;
      case 'ui': this.tone(o, t, 0.04, 900, 1200, 0.15, 'triangle'); break;
      case 'tick': this.tone(o, t, 0.025, 2400 + (opt.p || 0), 1800, 0.18, 'square'); break;
      case 'reveal': [523, 659, 784, 1047].forEach((f, i) => this.tone(o, t + i * 0.07, 0.35, f, f, 0.18, 'triangle')); break;
      case 'rare': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(o, t + i * 0.08, 0.6, f, f * 1.01, 0.2, 'sawtooth')); this.burst(o, t, 1.2, 8000, 2000, 0.5, 0.2, 'highpass'); break;
      case 'win': [523, 659, 784].forEach((f, i) => this.tone(o, t + i * 0.12, 0.4, f, f, 0.2, 'triangle')); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(o, t + i * 0.14, 0.4, f, f, 0.2, 'triangle')); break;
      case 'capture': this.tone(o, t, 0.2, 660, 990, 0.2, 'triangle'); break;
      case 'vehicle': this.tone(o, t, opt.dur || 0.2, opt.f || 60, (opt.f || 60) * 1.05, 0.25, 'sawtooth'); break;
    }
  },
};
