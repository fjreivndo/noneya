/* ═══════════════════════════════════════════════════════════════════════════
   BREACHPOINT DESKTOP
   Electron wrapper. Opens the newest Breachpoint build as a real window and
   runs a LAN relay beside it, so friends on your network can play with no
   internet at all (Multiplayer → Host on LAN).

   Internet play doesn't need any of this — the game's room codes go
   peer-to-peer on their own. The relay is only for LAN / offline.

   Usage:
     npm start                    window + LAN relay on 8080
     npm start -- --port 9000     relay on a different port
     npm start -- --no-relay      just the game
     npm start -- --html "Breachpoint v1.0.html"
   ═══════════════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, Menu, clipboard, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { createRelay, addresses } = require('./relay.js');

function readArgs(argv) {
  const a = { port: 8080, relay: true, html: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i], next = argv[i + 1];
    if (v === '--port' && next) { a.port = +next || a.port; i++; }
    else if (v === '--html' && next) { a.html = next; i++; }
    else if (v === '--no-relay') a.relay = false;
  }
  return a;
}
const ARGS = readArgs(process.argv.slice(1));

/* The newest Breachpoint build next to this file, or one folder up (where
   the build script writes it). Dropping in a new build just works. */
function findGame() {
  if (ARGS.html) return path.resolve(ARGS.html);
  for (const dir of [__dirname, path.join(__dirname, '..')]) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { continue; }
    const cands = files.filter(f => /^breachpoint.*\.html?$/i.test(f))
      .map(f => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (cands.length) return cands[0].f;
  }
  return null;
}

let win = null, relayInfo = null;

function makeWindow(gamePath) {
  win = new BrowserWindow({
    width: 1400, height: 860, backgroundColor: '#0e1013', title: 'Breachpoint',
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.loadFile(gamePath);
  // tell the page about the LAN relay; the Multiplayer screen shows a "Host on LAN" button
  win.webContents.on('did-finish-load', () => {
    if (!relayInfo) return;
    win.webContents.executeJavaScript(`window.__breachDesktop = ${JSON.stringify(relayInfo)};`).catch(() => { });
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function buildMenu() {
  const lan = relayInfo ? relayInfo.lan : [];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Game', submenu: [
      { label: 'Fullscreen', accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
      { type: 'separator' },
      { label: 'Developer tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => win && win.webContents.toggleDevTools() },
      { role: 'quit' },
    ] },
    { label: 'LAN', submenu: relayInfo ? [
      ...lan.map(a => ({ label: 'Copy ' + a, click: () => clipboard.writeText(a) })),
      { type: 'separator' },
      { label: `Relay running on port ${ARGS.port}`, enabled: false },
    ] : [{ label: 'No LAN relay (started with --no-relay or the port was busy)', enabled: false }] },
  ]));
}

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.whenReady().then(async () => {
  const game = findGame();
  if (!game) {
    dialog.showErrorBox('Breachpoint', 'No "Breachpoint vX.html" found next to this app.\nPut the game file in this folder and start again.');
    return app.quit();
  }
  if (ARGS.relay) {
    try {
      const relay = createRelay({ port: ARGS.port, log: m => console.log('[relay]', m) });
      const addrs = await relay.listen();
      relayInfo = { relay: `ws://localhost:${ARGS.port}`, lan: addrs.filter(a => !/localhost/.test(a)) };
      console.log(`LAN relay on ${ARGS.port}. Friends join with:\n  ` + (relayInfo.lan.join('\n  ') || relayInfo.relay));
    } catch (e) { console.warn('LAN relay not started:', e.message); }
  }
  buildMenu();
  makeWindow(game);
});
app.on('window-all-closed', () => app.quit());
