/* Builds the single-file game: node build.js
   Inlines three.js, PeerJS and every src/*.js into src/shell.html so the
   result opens by double-click with no internet (multiplayer over the
   internet still needs it, for the PeerJS broker). */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const LIBDIR = { 'three.min.js': 'three/build', 'peerjs.min.js': 'peerjs/dist', 'cannon-es.cjs.js': 'cannon-es/dist' };
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
let html = fs.readFileSync(path.join(root, 'src', 'shell.html'), 'utf8');
html = html.replace('/*__THREE__*/', () => safe(lib('three.min.js').replace(/^console\.warn\([^\n]*\)/, '0')))
  .replace('/*__PEER__*/', () => safe(lib('peerjs.min.js')))
  .replace('/*__CANNON__*/', () => safe(cannon))
  .replace('/*__GAME__*/', () => safe(src));
const name = `Breachpoint v${version.split('.').slice(0, 2).join('.')}.html`;
fs.writeFileSync(path.join(root, name), html);
console.log('wrote', name, (html.length / 1024).toFixed(0) + ' KB');
})();
