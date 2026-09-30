/* ═══════════════════════════════════════════════════════════════════════════
   Boot and main loop.
   ═══════════════════════════════════════════════════════════════════════════ */
/* Each start-up step runs on its own: if one fails (an old save the game
   can't read, no WebGL), the menus still work and the error is shown so it
   can be reported. */
const BootErrors = [];
function bootStep(name, fn) { try { fn(); } catch (e) { console.error('[boot] ' + name, e); BootErrors.push({ name, e }); } }
function showBootErrors() {
  if (!BootErrors.length) return;
  const gl = BootErrors.some(x => x.name === '3D graphics');
  const text = `Breachpoint ${VERSION} · ${navigator.userAgent}\n` + BootErrors.map(x => `${x.name}: ${x.e && (x.e.stack || x.e.message) || x.e}`).join('\n');
  const b = document.createElement('div'); b.id = 'bootErr';
  b.innerHTML = `<b>Something went wrong while starting.</b> ${gl ? '3D graphics (WebGL) couldn\'t start, so matches won\'t run. If you opened the game inside an app\'s file preview, open the .html file in Chrome, Edge or Firefox instead; otherwise turn on hardware acceleration in your browser settings. ' : 'The menus still work. '}Copy the details and send them over so it can be fixed.<pre></pre><button data-a="copy">Copy details</button><button data-a="close">Close</button>`;
  b.querySelector('pre').textContent = text;
  b.querySelector('[data-a="copy"]').onclick = () => { try { navigator.clipboard.writeText(text); } catch (e) { } const r = document.createRange(); r.selectNodeContents(b.querySelector('pre')); getSelection().removeAllRanges(); getSelection().addRange(r); };
  b.querySelector('[data-a="close"]').onclick = () => b.remove();
  document.body.appendChild(b);
}
function boot() {
  bootStep('saved progress', () => Inv.load());
  if (!Inv.data) bootStep('fresh inventory', () => { try { const raw = localStorage.getItem('bp_inv'); if (raw) localStorage.setItem('bp_inv_backup_' + Date.now(), raw); localStorage.removeItem('bp_inv'); } catch (e) { } Inv.load(); });
  bootStep('3D graphics', () => Game.initRenderer());
  bootStep('HUD', () => HUD.init());
  bootStep('menus', () => UI.init());
  bootStep('menu background', () => MenuBG.start());
  bootStep('update log', () => UI.maybeShowNews());
  showBootErrors();
  let last = performance.now();
  const frame = now => {
    requestAnimationFrame(frame);
    // slow machines: take up to three sub-steps so the match still runs in real time
    let dt = Math.min(0.15, Math.max(0, (now - last) / 1000)); last = now;
    try {
      if (Game.running) { while (dt > 0.05) { Game.update(0.05); dt -= 0.05; } Game.update(dt); HUD.update(dt); }
      else MenuBG.update(dt);
      if (Game.scene) Game.render();
    } catch (e) { console.error(e); }
    Input.endFrame();
  };
  requestAnimationFrame(frame);
  /* A hidden tab gets no animation frames. If we're the host, everyone else's
     match would freeze, so keep simulating from a worker's timer (workers
     aren't throttled like the page's own timers are). */
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 33)'], { type: 'text/javascript' })));
    let lastBg = performance.now();
    w.onmessage = () => {
      const now = performance.now(), dt = Math.min(0.1, (now - lastBg) / 1000); lastBg = now;
      if (!document.hidden || !Game.running || Net.role !== 'host') return;
      try { Game.update(dt); } catch (e) { console.error(e); }
      last = now;
    };
  } catch (e) { }
  addEventListener('beforeunload', () => Net.leave());
  window.BP = { Game, World, Net, Inv, UI, HUD, AI, SKINS, CASES, Settings };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
