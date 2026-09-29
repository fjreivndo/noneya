/* Builds the single-file game: node build.js
   Inlines three.js, the Photon Realtime SDK, cannon-es and every src/*.js
   into src/shell.html so the result opens by double-click with no internet
   (internet multiplayer still needs it, to reach Photon Cloud).

   Photon: put your App ID in photon.config.json ({ "appId": "...", "region": "eu" })
   or the PHOTON_APP_ID / PHOTON_REGION environment variables, and it is baked
   into the build. Without one, players paste an App ID in Multiplayer. */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const LIBDIR = { 'three.min.js': 'three/build', 'photon-realtime-module.js': 'photon-realtime', 'cannon-es.cjs.js': 'cannon-es/dist' };
const lib = name => {
  const p = [path.join(root, 'lib', name), path.join(root, 'node_modules', LIBDIR[name], name)].find(fs.existsSync);
  if (!p) throw new Error('missing ' + name + ' — run `npm install` in breachpoint/ first');
  return fs.readFileSync(p, 'utf8');
};
const version = require('./package.json').version;
const src = fs.readdirSync(path.join(root, 'src')).filter(f => /^\d+_.*\.js$/.test(f)).sort()
  .map(f => `/* ── ${f} ── */\n` + fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
(async () => {
// cannon-es ships as CommonJS; wrap it into a CANNON global and minify it
const { minify } = require('terser');
const cannon = (await minify(`var CANNON=(function(){var module={exports:{}},exports=module.exports,require=function(){return {performance:self.performance}};${lib('cannon-es.cjs.js')}\nreturn module.exports})();`, { compress: true, mangle: true })).code;
// Photon Realtime: drop the Node-only websocket shim at the end; browsers use the built-in WebSocket
const photonSrc = lib('photon-realtime-module.js'), cut = photonSrc.indexOf('const wsClass');
const photon = `var Photon=(function(){${cut > 0 ? photonSrc.slice(0, cut) : photonSrc}\nreturn Photon;})();`;
let pcfg = {}; try { pcfg = JSON.parse(fs.readFileSync(path.join(root, 'photon.config.json'), 'utf8')); } catch (e) { /* none */ }
if (process.env.PHOTON_APP_ID) pcfg.appId = process.env.PHOTON_APP_ID; if (process.env.PHOTON_REGION) pcfg.region = process.env.PHOTON_REGION;
const photonCfg = `window.PHOTON_CONFIG=${JSON.stringify({ appId: String(pcfg.appId || ''), region: String(pcfg.region || ''), appVersion: String(pcfg.appVersion || '') })};`;
if (pcfg.appId) console.log('Photon App ID baked in (region ' + (pcfg.region || 'auto') + ')');
let html = fs.readFileSync(path.join(root, 'src', 'shell.html'), 'utf8');
html = html.replace('/*__THREE__*/', () => safe(lib('three.min.js').replace(/^console\.warn\([^\n]*\)/, '0')))
  .replace('/*__PEER__*/', () => safe(photon + '\n' + photonCfg))
  .replace('/*__CANNON__*/', () => safe(cannon))
  .replace('/*__GAME__*/', () => safe(src));
const name = `Breachpoint v${version.split('.').slice(0, 2).join('.')}.html`;
fs.writeFileSync(path.join(root, name), html);
// the same file is what Cloudflare Workers serves (see wrangler.jsonc at the repo root)
const site = path.join(root, '..', 'site'); fs.mkdirSync(site, { recursive: true }); fs.writeFileSync(path.join(site, 'index.html'), html);
console.log('wrote', name, (html.length / 1024).toFixed(0) + ' KB');
})();
