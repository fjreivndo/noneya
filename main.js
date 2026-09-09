/* ═══════════════════════════════════════════════════════════════════════════
   HOLLOWREACH DESKTOP
   Electron wrapper. Two jobs:

     1. run the relay, so this machine can be the server
     2. open the game and hand it a socket to that relay

   The game HTML is not modified in any way. Everything multiplayer happens
   in an injected bootstrap after the page loads, which means you can drop a
   newer Hollowreach build in beside this file and it keeps working.

   Usage:
     npm start                    host on 8080, you're the server
     npm start -- --port 9000     host on a different port
     npm start -- --join ws://192.168.1.14:8080    connect to a friend
     npm start -- --solo          no networking at all
     npm start -- --name koda     what other players see
   ═══════════════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, Menu, shell, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createRelay, addresses } = require('./relay.js');

/* ── arguments ────────────────────────────────────────────────────────────
   Electron passes its own flags too, so read only the ones we know. */
function readArgs(argv) {
  const a = { port: 8080, join: null, solo: false, name: os.userInfo().username || 'player', html: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i], next = argv[i + 1];
    if (v === '--port' && next) { a.port = +next || a.port; i++; }
    else if (v === '--join' && next) { a.join = next; i++; }
    else if (v === '--name' && next) { a.name = next; i++; }
    else if (v === '--html' && next) { a.html = next; i++; }
    else if (v === '--solo') a.solo = true;
  }
  return a;
}
const ARGS = readArgs(process.argv.slice(1));

/* ── finding the game ─────────────────────────────────────────────────────
   Whatever Hollowreach html sits next to this file. If there are several,
   take the newest, so dropping in a new build just works. */
function findGame() {
  if (ARGS.html) return path.resolve(ARGS.html);
  const here = __dirname;
  const cands = fs.readdirSync(here)
    .filter(f => /\.html?$/i.test(f) && /hollow/i.test(f))
    .map(f => ({ f, t: fs.statSync(path.join(here, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!cands.length) return null;
  return path.join(here, cands[0].f);
}

let win = null;
let relay = null;
let netURL = null;          // what the game will connect to
let netAddrs = [];          // what to tell friends

/* ── the bootstrap ────────────────────────────────────────────────────────
   Runs inside the page. It waits for the game to finish booting (HollowNet
   only exists once the script has run), opens the socket, and reconnects if
   the server goes away. Written as a string because that is what
   executeJavaScript takes; it never touches the game's own source. */
function bootstrap(url, name, isHost) {
  return `(() => {
  const URL_ = ${JSON.stringify(url)}, NAME = ${JSON.stringify(name)}, HOST = ${isHost ? 'true' : 'false'};
  let sock = null, tries = 0, dead = false;

  /* The game keeps everything in one closure and puts exactly one thing on
     window: HollowNet. That is the whole surface this needs, which is why the
     game file itself does not have to change. */
  const wait = (fn) => window.HollowNet ? fn() : setTimeout(() => wait(fn), 120);

  function connect() {
    if (dead) return;
    try { sock = new WebSocket(URL_); } catch (e) { return retry(); }
    sock.onopen = () => {
      tries = 0;
      /* attach() prints "Net attached as <name>" in the game's own console
         and toasts it, so there is nothing to announce from out here */
      try {
        window.HollowNet.attach({
          send: t => { if (sock && sock.readyState === 1) sock.send(t); },
          close: () => { dead = true; try { sock.close(); } catch (e) {} }
        }, { name: NAME, host: HOST });
      } catch (e) { console.error('[desktop] attach failed:', e); }
    };
    sock.onmessage = e => { try { window.HollowNet.receive(e.data); } catch (err) {} };
    sock.onclose = () => {
      if (dead) return;
      try { window.HollowNet.connected = false; } catch (e) {}
      retry();
    };
    sock.onerror = () => { /* onclose always follows */ };
  }

  function retry() {
    if (dead) return;
    tries++;
    if (tries > 40) { console.warn('[desktop] gave up reconnecting to ' + URL_); return; }
    setTimeout(connect, Math.min(500 * tries, 5000));
  }

  wait(connect);
  window.__hollowDesktop = {
    url: URL_, name: NAME,
    status: () => ({ url: URL_, socket: sock ? sock.readyState : -1,
                     attached: !!(window.HollowNet && window.HollowNet.connected),
                     host: !!(window.HollowNet && window.HollowNet.isHost && window.HollowNet.isHost()) }),
    stop: () => { dead = true; sock && sock.close(); }
  };
})();`;
}

/* ── window ───────────────────────────────────────────────────────────── */
function makeWindow(gamePath) {
  win = new BrowserWindow({
    width: 1280, height: 800, backgroundColor: '#0b0d12',
    title: 'Hollowreach',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,       // the page gets no node, only the socket
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false   // keep simulating when the window is behind
    }
  });

  win.loadFile(gamePath);

  win.webContents.on('did-finish-load', () => {
    if (ARGS.solo || !netURL) return;
    /* this process started the relay, so this window is the authority for
       creatures and chest contents; a --join window is not */
    win.webContents.executeJavaScript(bootstrap(netURL, ARGS.name, !!relay))
      .catch(e => console.error('bootstrap failed:', e.message));
  });

  /* links in the changelog etc. open in the real browser, not in the game */
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  win.on('closed', () => { win = null; });
  return win;
}

/* ── menu ─────────────────────────────────────────────────────────────── */
function makeMenu() {
  const template = [
    { label: 'Game', submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
        { label: 'Fullscreen', accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ] },
    { label: 'Multiplayer', submenu: [
        { label: relay ? 'Hosting — show address' : (ARGS.solo ? 'Solo (no networking)' : 'Joined a game'),
          click: () => showAddress() },
        { label: 'Copy invite address', enabled: !!netAddrs.length,
          click: () => { clipboard.writeText(netAddrs[0] || ''); } },
        { type: 'separator' },
        { label: 'Open the chat console', accelerator: 'CmdOrCtrl+T', click: () => {
            if (!win) return;
            /* the console lives inside the game's closure, so ask for it the
               way a player would: press T */
            win.webContents.focus();
            win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'T' });
            win.webContents.sendInputEvent({ type: 'char', keyCode: 't' });
            win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'T' });
          } },
        { label: 'Connection status', click: async () => {
            if (!win) return;
            let st = null;
            try { st = await win.webContents.executeJavaScript(
              'window.__hollowDesktop ? window.__hollowDesktop.status() : null'); } catch (e) {}
            const states = ['connecting', 'open', 'closing', 'closed'];
            dialog.showMessageBox(win, { type: 'info', title: 'Connection',
              message: st ? (st.attached ? 'Connected' : 'Not connected') : 'Networking is off',
              detail: st ? `${st.url}\nsocket: ${states[st.socket] || 'none'}` : 'Started with --solo, or no server was reachable.' });
          } }
      ] },
    { label: 'Help', submenu: [
        { label: 'Developer tools', accelerator: 'F12', click: () => win && win.webContents.toggleDevTools() },
        { label: 'Where are my saves?', click: () => {
            dialog.showMessageBox(win, { type: 'info', title: 'Saves',
              message: 'Worlds live in this app’s local storage.',
              detail: 'Use the in-game Export button on a world to write it out as a file you can back up or move.' });
          } }
      ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showAddress() {
  const lines = ARGS.solo
    ? ['Running solo — no networking.']
    : relay
      ? ['You are hosting. Friends on your network join with:', '', ...netAddrs.map(a => '  ' + a), '',
         'For friends outside your network, forward port ' + ARGS.port + ' on your router, or use a tunnel.']
      : ['Joined: ' + netURL];
  dialog.showMessageBox(win, { type: 'info', title: 'Multiplayer', message: lines[0], detail: lines.slice(1).join('\n') });
}

/* ── start ────────────────────────────────────────────────────────────── */
app.whenReady().then(async () => {
  const gamePath = findGame();
  if (!gamePath) {
    dialog.showErrorBox('No game found',
      'Put a Hollowreach .html file next to main.js (any name containing "hollow"), or pass --html <file>.');
    app.quit(); return;
  }

  if (!ARGS.solo) {
    if (ARGS.join) {
      netURL = ARGS.join;
      netAddrs = [ARGS.join];
      console.log('joining ' + netURL);
    } else {
      relay = createRelay({ port: ARGS.port, log: m => console.log('  ' + m) });
      try {
        netAddrs = await relay.listen();
        netURL = 'ws://localhost:' + ARGS.port;
        console.log('hosting on port ' + ARGS.port + ' — friends connect to:');
        for (const a of netAddrs) console.log('  ' + a);
      } catch (e) {
        relay = null;
        console.error('could not open port ' + ARGS.port + ': ' + e.message + ' — starting solo');
      }
    }
  }

  makeMenu();
  makeWindow(gamePath);
  console.log('game: ' + gamePath);
});

app.on('window-all-closed', () => { if (relay) relay.close(); app.quit(); });
app.on('activate', () => { const g = findGame(); if (!win && g) makeWindow(g); });
