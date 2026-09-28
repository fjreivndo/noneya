/* ═══════════════════════════════════════════════════════════════════════════
   Boot and main loop.
   ═══════════════════════════════════════════════════════════════════════════ */
function boot() {
  Inv.load();
  Game.initRenderer();
  HUD.init();
  UI.init();
  MenuBG.start();
  UI.maybeShowNews();
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
