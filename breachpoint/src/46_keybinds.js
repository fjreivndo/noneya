/* ═══════════════════════════════════════════════════════════════════════════
   Key rebinding (v2.9): Settings → Controls.
   Every action can be moved to another key. Pressing the new key is turned
   into the action's original key before the game sees it, so every part of
   the game (including the Sandbox tools) follows the new layout. Picking a
   key that's already in use swaps the two.
   ═══════════════════════════════════════════════════════════════════════════ */
const KEY_ACTIONS = [
  ['forward', 'Move forward', 'KeyW'], ['back', 'Move back', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
  ['jump', 'Jump', 'Space'], ['crouch', 'Crouch', 'ControlLeft'], ['sprint', 'Sprint / walk', 'ShiftLeft'],
  ['reload', 'Reload', 'KeyR'], ['use', 'Use, enter vehicle, plant', 'KeyE'], ['last', 'Last weapon', 'KeyX'], ['inspect', 'Inspect weapon', 'KeyF'],
  ['buy', 'Buy menu', 'KeyB'], ['spot', 'Spot / spawn menu', 'KeyQ'], ['gadget', 'Gadget', 'KeyG'], ['streak', 'Call in killstreak', 'KeyZ'],
  ['squad', 'Squad marker', 'KeyT'], ['emote', 'Emote wheel', 'KeyN'], ['carcam', 'Vehicle camera', 'KeyC'], ['chat', 'Chat', 'KeyY'], ['scores', 'Scoreboard', 'Tab'],
];
if (!Settings.binds || typeof Settings.binds !== 'object') Settings.binds = {};
const KB = {
  map: {}, capture: null,
  code(a) { const A = KEY_ACTIONS.find(x => x[0] === a); return Settings.binds[a] || A[2]; },
  rebuild() {
    this.map = {};
    const used = new Set(KEY_ACTIONS.map(A => this.code(A[0])));
    for (const [a, , def] of KEY_ACTIONS) { const c = this.code(a); if (c !== def) { this.map[c] = def; if (!used.has(def) && this.map[def] === undefined) this.map[def] = null; } }
  },
  set(a, code) {
    const other = KEY_ACTIONS.find(A => A[0] !== a && this.code(A[0]) === code);
    if (other) Settings.binds[other[0]] = this.code(a);   // swap
    Settings.binds[a] = code;
    for (const [k, , def] of KEY_ACTIONS) if (Settings.binds[k] === def) delete Settings.binds[k];
    saveSettings(); this.rebuild();
  },
  name(c) { return c ? c.replace(/^Key/, '').replace(/^Digit/, '').replace('ControlLeft', 'L-Ctrl').replace('ControlRight', 'R-Ctrl').replace('ShiftLeft', 'L-Shift').replace('ShiftRight', 'R-Shift').replace('AltLeft', 'L-Alt').replace(/^Arrow/, '↑ ').replace('Space', 'Space') : '—'; },
};
KB.rebuild();
function kbTyping(e) { const t = e.target; return Input.typing || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)); }
for (const type of ['keydown', 'keyup']) addEventListener(type, e => {
  if (e.__bp) return;
  if (KB.capture && type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); const cb = KB.capture; KB.capture = null; cb(e.code === 'Escape' ? null : e.code); return; }
  if (kbTyping(e)) return;
  const m = KB.map[e.code]; if (m === undefined) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (!m) return;
  const ne = new KeyboardEvent(type, { code: m, key: e.key, repeat: e.repeat, bubbles: true, cancelable: true, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
  ne.__bp = true; (e.target || window).dispatchEvent(ne);
}, true);
/* Settings → Controls */
const _rs46 = UI.render_settings;
UI.render_settings = function () {
  _rs46.call(this);
  const f = $('setForm'); if (!f) return;
  const old = f.parentElement.querySelector('.keybox'); if (old) old.remove();
  const box = document.createElement('div'); box.className = 'keybox';
  const draw = () => {
    box.innerHTML = `<h3>Controls <button class="btn small ghost" data-kr="1">Reset to defaults</button></h3><p class="muted">Click a key, then press the new one (Esc cancels). A key that's already used swaps with it. Mouse buttons and 1–7 stay as they are.</p>
      <div class="keygrid">${KEY_ACTIONS.map(([a, label, def]) => { const c = KB.code(a); return `<div class="keyrow"><span>${label}</span><button class="kbtn ${c !== def ? 'changed' : ''}" data-ka="${a}">${KB.name(c)}</button></div>`; }).join('')}</div>`;
    box.querySelectorAll('[data-ka]').forEach(b => b.onclick = () => {
      b.textContent = 'Press a key…'; b.classList.add('wait');
      KB.capture = code => { if (code) KB.set(b.dataset.ka, code); draw(); };
    });
    box.querySelector('[data-kr]').onclick = () => { Settings.binds = {}; saveSettings(); KB.rebuild(); draw(); };
  };
  draw(); f.after(box);
};
