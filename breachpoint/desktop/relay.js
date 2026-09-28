/* ═══════════════════════════════════════════════════════════════════════════
   HOLLOWREACH RELAY
   A WebSocket server in about two hundred lines and no dependencies. It does
   one thing: whatever one client sends, every other client receives. That is
   the entire contract HollowNet expects of a transport.

   Written against RFC 6455 directly rather than pulling in `ws`, so the whole
   desktop build needs nothing from npm except Electron itself.
   ═══════════════════════════════════════════════════════════════════════════ */

const http = require('http');
const crypto = require('crypto');
const os = require('os');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/* ── frames ───────────────────────────────────────────────────────────────
   A frame is a header of two to fourteen bytes and then the payload. The
   length is encoded in one of three widths depending on how big it is, and
   everything a client sends is masked with a rolling four-byte key. */
function encode(text) {
  const body = Buffer.from(text, 'utf8');
  const n = body.length;
  let head;
  if (n < 126) {
    head = Buffer.alloc(2);
    head[1] = n;
  } else if (n < 65536) {
    head = Buffer.alloc(4);
    head[1] = 126;
    head.writeUInt16BE(n, 2);
  } else {
    head = Buffer.alloc(10);
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(n), 2);
  }
  head[0] = 0x81;                       // FIN + text opcode
  return Buffer.concat([head, body]);
}

function ctlFrame(opcode, payload) {
  const body = payload ? Buffer.from(payload) : Buffer.alloc(0);
  const head = Buffer.alloc(2);
  head[0] = 0x80 | opcode;
  head[1] = body.length;                // control frames are always short
  return Buffer.concat([head, body]);
}

/* Pulls whole frames out of a growing buffer. Returns what it could not yet
   parse, because TCP will happily hand you half a frame. */
function drain(buf, onMessage, onClose, onPing) {
  let off = 0;
  for (;;) {
    if (buf.length - off < 2) break;
    const b0 = buf[off], b1 = buf[off + 1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let p = off + 2;

    if (len === 126) {
      if (buf.length < p + 2) break;
      len = buf.readUInt16BE(p); p += 2;
    } else if (len === 127) {
      if (buf.length < p + 8) break;
      const big = buf.readBigUInt64BE(p); p += 8;
      if (big > 8n * 1024n * 1024n) { onClose(1009, 'frame too large'); return Buffer.alloc(0); }
      len = Number(big);
    }
    let mask = null;
    if (masked) {
      if (buf.length < p + 4) break;
      mask = buf.subarray(p, p + 4); p += 4;
    }
    if (buf.length < p + len) break;    // the rest has not arrived yet

    const body = Buffer.from(buf.subarray(p, p + len));
    if (mask) for (let i = 0; i < body.length; i++) body[i] ^= mask[i & 3];
    off = p + len;

    if (opcode === 0x8) { onClose(1000, 'client closed'); return Buffer.alloc(0); }
    else if (opcode === 0x9) onPing(body);
    else if (opcode === 0xA) { /* pong — nothing to do */ }
    else if (opcode === 0x1 && fin) onMessage(body.toString('utf8'));
    /* fragmented text is not something HollowNet ever sends: every message is
       one small JSON object. A continuation frame is dropped rather than
       mis-assembled, which is the safer of the two failures. */
  }
  return buf.subarray(off);
}

/* ── the relay ────────────────────────────────────────────────────────── */
function createRelay({ port = 8080, host = '0.0.0.0', log = () => {} } = {}) {
  const clients = new Set();
  let nextId = 1;

  const server = http.createServer((req, res) => {
    /* a plain GET is somebody checking the address by hand */
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(`Hollowreach relay — ${clients.size} connected\n`);
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.setNoDelay(true);

    const client = { id: nextId++, socket, alive: true };
    clients.add(client);
    log(`peer ${client.id} joined · ${clients.size} connected`);

    /* v1.4: the same room hint the Cloudflare relay sends, so a game behaves
       identically whichever relay it is talking to. Whoever walked in first
       owns the world; without this the game falls back to sorting connection
       ids, which hands authority to whoever happens to sort lowest. */
    try {
      socket.write(encode(JSON.stringify(
        { t:'__room', first: clients.size <= 1, n: clients.size })));
    } catch (e) { /* it will error out below */ }

    let buf = Buffer.alloc(0);
    const gone = (why) => {
      if (!clients.delete(client)) return;
      log(`peer ${client.id} left (${why}) · ${clients.size} connected`);
      try { socket.destroy(); } catch (e) { /* already gone */ }
      /* the last one standing inherits the world, otherwise a room whose first
         player left has nobody simulating anything */
      if (clients.size === 1) {
        const [only] = clients;
        try { only.socket.write(encode(JSON.stringify(
          { t:'__room', first:true, n:1, promoted:true }))); } catch (e) {}
      }
    };

    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      buf = drain(buf,
        text => {
          /* the whole job: say it to everyone else */
          const frame = encode(text);
          for (const c of clients) if (c !== client) {
            try { c.socket.write(frame); } catch (e) { /* it will error out below */ }
          }
        },
        (code, why) => gone(why),
        payload => { try { socket.write(ctlFrame(0xA, payload)); } catch (e) {} });
    });
    socket.on('error', () => gone('error'));
    socket.on('close', () => gone('closed'));
  });

  /* a ping every twenty seconds, so a peer that vanished without closing is
     noticed rather than counted forever */
  const beat = setInterval(() => {
    for (const c of clients) {
      try { c.socket.write(ctlFrame(0x9)); } catch (e) { clients.delete(c); }
    }
  }, 20000);
  beat.unref && beat.unref();

  return {
    server,
    listen: () => new Promise((res, rej) => {
      server.once('error', rej);
      server.listen(port, host, () => res(addresses(port)));
    }),
    close: () => { clearInterval(beat); for (const c of clients) c.socket.destroy(); server.close(); },
    count: () => clients.size
  };
}

/* every address a friend on the same network could reach this on */
function addresses(port) {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) {
    for (const ni of ifaces[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(`ws://${ni.address}:${port}`);
    }
  }
  out.push(`ws://localhost:${port}`);
  return out;
}

module.exports = { createRelay, addresses, encode, drain };

/* run it on its own: node relay.js [port] */
if (require.main === module) {
  const port = +process.argv[2] || 8080;
  const relay = createRelay({ port, log: m => console.log(m) });
  relay.listen().then(addrs => {
    console.log(`Breachpoint relay listening on ${port}`);
    console.log('Friends on your network connect to:');
    for (const a of addrs) console.log('  ' + a);
  }).catch(e => { console.error('could not listen:', e.message); process.exit(1); });
}
