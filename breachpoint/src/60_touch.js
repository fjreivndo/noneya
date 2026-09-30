/* ═══════════════════════════════════════════════════════════════════════════
   v3.0 · Touch controls (tablets and phones).
   Turned on automatically on touch screens (Settings → Gameplay → Touch
   controls: Auto / On / Off). Left thumb: a stick that moves you (push it
   all the way to sprint). Right thumb: drag anywhere to look. Buttons for
   fire, aim, jump, crouch, reload, use/enter, grenade, switch weapon,
   gadget, scoreboard and the menu. In vehicles the stick drives and jump /
   crouch climb and descend.
   ═══════════════════════════════════════════════════════════════════════════ */
if (Settings.touch == null) Settings.touch = 'auto';
const TouchUI = {
  el: null, stick: null, look: null, on: false,
  want() { return Settings.touch === 'on' || (Settings.touch !== 'off' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches); },
  key(code, down) { if (down) { if (!Input.keys[code]) Input.pressed[code] = true; Input.keys[code] = true; } else if (Input.keys[code]) { Input.keys[code] = false; Input.released[code] = true; } },
  build() {
    if (this.el) return;
    const el = this.el = document.createElement('div'); el.id = 'touch';
    const B = (k, label, cls = '') => `<button class="tbtn ${cls}" data-k="${k}">${label}</button>`;
    el.innerHTML = `<div class="tlook"></div><div class="tstick"><div class="tknob"></div></div>
      <div class="tright">${B('fire', '●', 'fire')}${B('ads', '◎', 'ads')}${B('Space', 'JUMP')}${B('ControlLeft', 'CROUCH')}${B('KeyR', 'RELOAD')}${B('KeyE', 'USE')}${B('nade', 'NADE')}${B('swap', 'SWAP')}${B('KeyG', 'GADGET')}</div>
      <div class="ttop">${B('Tab', 'SCORES', 'small')}${B('KeyL', 'LIGHT', 'small')}${B('Escape', 'MENU', 'small')}</div>`;
    document.body.appendChild(el);
    const stick = el.querySelector('.tstick'), knob = el.querySelector('.tknob'), look = el.querySelector('.tlook');
    const S = this.stick = { id: null, x: 0, y: 0 }, Lk = this.look = { id: null, x: 0, y: 0 };
    const setStick = (dx, dy) => {
      const R = 55, l = Math.hypot(dx, dy), k = l > R ? R / l : 1; dx *= k; dy *= k; knob.style.transform = `translate(${dx}px,${dy}px)`;
      const nx = dx / R, ny = dy / R; this.key('KeyW', ny < -0.35); this.key('KeyS', ny > 0.35); this.key('KeyA', nx < -0.35); this.key('KeyD', nx > 0.35); this.key('ShiftLeft', Math.hypot(nx, ny) > 0.95 && ny < -0.5);
    };
    this.setStick = setStick;
    stick.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0], r = stick.getBoundingClientRect(); S.id = t.identifier; S.cx = r.left + r.width / 2; S.cy = r.top + r.height / 2; setStick(t.clientX - S.cx, t.clientY - S.cy); }, { passive: false });
    const moveStick = e => { for (const t of e.changedTouches) if (t.identifier === S.id) { e.preventDefault(); setStick(t.clientX - S.cx, t.clientY - S.cy); } };
    const endStick = e => { for (const t of e.changedTouches) if (t.identifier === S.id) { S.id = null; setStick(0, 0); } };
    stick.addEventListener('touchmove', moveStick, { passive: false }); stick.addEventListener('touchend', endStick); stick.addEventListener('touchcancel', endStick);
    look.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; Lk.id = t.identifier; Lk.x = t.clientX; Lk.y = t.clientY; }, { passive: false });
    look.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === Lk.id) { e.preventDefault(); const k = 1.6 * (Settings.touchSens || 1); Input.mouse.dx += (t.clientX - Lk.x) * k; Input.mouse.dy += (t.clientY - Lk.y) * k; Lk.x = t.clientX; Lk.y = t.clientY; } }, { passive: false });
    const endLook = e => { for (const t of e.changedTouches) if (t.identifier === Lk.id) Lk.id = null; };
    look.addEventListener('touchend', endLook); look.addEventListener('touchcancel', endLook);
    el.querySelectorAll('.tbtn').forEach(b => {
      const k = b.dataset.k;
      const down = e => {
        e.preventDefault(); b.classList.add('on');
        if (k === 'fire') { Input.mouse.left = true; Input.mouse.leftPressed = true; }
        else if (k === 'ads') { Input.mouse.right = true; Input.mouse.rightPressed = true; }
        else if (k === 'nade') { const L = Game.local; const n = L && ['frag', 'flash', 'smoke'].find(x => L.nades && L.nades[x] > 0); if (n) { L.switchTo(n); } else HUD.center('No grenades', 0.6); }
        else if (k === 'swap') { Input.mouse.wheel += 1; }
        else if (k === 'Escape') { if (Game.running) UI.pause(!UI.pauseOpen); }
        else this.key(k, true);
      };
      const up = e => { e.preventDefault(); b.classList.remove('on'); if (k === 'fire') Input.mouse.left = false; else if (k === 'ads') Input.mouse.right = false; else if (!['nade', 'swap', 'Escape'].includes(k)) this.key(k, false); };
      b.addEventListener('touchstart', down, { passive: false }); b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    });
  },
  show(on) {
    this.on = on && this.want(); if (this.on) this.build();
    if (this.el) this.el.style.display = this.on ? '' : 'none';
    document.body.classList.toggle('touchmode', this.on);
    if (!this.on && this.setStick) this.setStick(0, 0);
  },
};
/* no pointer lock on touch screens: don't pause when there isn't one */
const _lock60 = UI.lock.bind(UI);
UI.lock = function () { if (TouchUI.on) { Input.locked = true; return; } return _lock60(); };
document.addEventListener('pointerlockchange', () => { if (TouchUI.on && Game.running) Input.locked = true; }, true);
const _pause60 = UI.pause.bind(UI);
UI.pause = function (on) { const r = _pause60(on); if (TouchUI.on && Game.running) Input.locked = true; return r; };
const _start60 = Game.start.bind(Game);
Game.start = function (cfg) { const r = _start60(cfg); TouchUI.show(true); if (TouchUI.on) Input.locked = true; return r; };
const _stop60 = Game.stop.bind(Game);
Game.stop = function () { TouchUI.show(false); return _stop60(); };
/* the deploy screen, menus and results stay usable: hide the controls while they're up */
const _hud60 = HUD.update.bind(HUD);
HUD.update = function (dt) { _hud60(dt); if (TouchUI.el && TouchUI.on) TouchUI.el.classList.toggle('dim', UI.blocking()); };
/* Settings → Gameplay: Auto / On / Off */
const _rs60 = UI.render_settings;
UI.render_settings = function () {
  _rs60.call(this);
  const box = document.querySelector('.v3box .keygrid'); if (!box) return;
  const row = document.createElement('div'); row.className = 'keyrow';
  const lab = { auto: 'Auto', on: 'On', off: 'Off' };
  row.innerHTML = `<span>Touch controls<small class="muted" style="display:block">On-screen stick and buttons for tablets and phones</small></span><button class="kbtn changed">${lab[Settings.touch] || 'Auto'}</button>`;
  row.querySelector('button').onclick = () => { Settings.touch = Settings.touch === 'auto' ? 'on' : Settings.touch === 'on' ? 'off' : 'auto'; saveSettings(); Sfx.play('ui'); row.querySelector('button').textContent = lab[Settings.touch]; };
  box.appendChild(row);
};
