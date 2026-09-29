/* ═══════════════════════════════════════════════════════════════════════════
   Performance (v2.9).
   · Every static wall, floor, crate and rock used to be its own mesh (one
     draw call each; the City alone has thousands). After a map loads they
     are merged into one mesh per material per 48 m cell, so the GPU draws a
     few hundred batches instead, and far cells are still culled.
   ═══════════════════════════════════════════════════════════════════════════ */
const Perf = {
  CELL: 48, merged: 0, before: 0,
  mergeWorld() {
    const g = World.group; if (!g) return;
    const groups = new Map(), _v = new V3(), nm = new THREE.Matrix3();
    for (const m of g.children) {
      if (!m.isMesh || !m.geometry || m.geometry.type !== 'BoxGeometry' || !m.material || m.material.transparent || m.userData.keep || Array.isArray(m.material)) continue;
      const a = m.geometry.attributes, sig = Object.keys(a).sort().join(',');
      const cx = Math.floor(m.position.x / this.CELL), cz = Math.floor(m.position.z / this.CELL), k = m.material.uuid + '|' + sig + '|' + cx + ',' + cz;
      let list = groups.get(k); if (!list) groups.set(k, list = []); list.push(m);
    }
    this.before = g.children.length; let removed = 0;
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const names = Object.keys(list[0].geometry.attributes); let nv = 0, ni = 0;
      for (const m of list) { nv += m.geometry.attributes.position.count; ni += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count; }
      const out = {}; for (const n of names) out[n] = new Float32Array(nv * list[0].geometry.attributes[n].itemSize);
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let vo = 0, io = 0;
      for (const m of list) {
        m.updateMatrix(); const G = m.geometry, M = m.matrix; nm.getNormalMatrix(M);
        const P = G.attributes.position, n = P.count;
        for (const name of names) {
          const A = G.attributes[name], sz = A.itemSize, dst = out[name];
          for (let i = 0; i < n; i++) {
            if (name === 'position') { _v.fromBufferAttribute(A, i).applyMatrix4(M); dst[(vo + i) * 3] = _v.x; dst[(vo + i) * 3 + 1] = _v.y; dst[(vo + i) * 3 + 2] = _v.z; }
            else if (name === 'normal') { _v.fromBufferAttribute(A, i).applyMatrix3(nm).normalize(); dst[(vo + i) * 3] = _v.x; dst[(vo + i) * 3 + 1] = _v.y; dst[(vo + i) * 3 + 2] = _v.z; }
            else for (let c = 0; c < sz; c++) dst[(vo + i) * sz + c] = A.array[i * sz + c];
          }
        }
        if (G.index) for (let i = 0; i < G.index.count; i++) idx[io++] = G.index.array[i] + vo; else for (let i = 0; i < n; i++) idx[io++] = vo + i;
        vo += n;
      }
      const geo = new THREE.BufferGeometry();
      for (const n of names) geo.setAttribute(n, new THREE.BufferAttribute(out[n], list[0].geometry.attributes[n].itemSize));
      geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mm = new THREE.Mesh(geo, list[0].material); mm.castShadow = list.some(x => x.castShadow); mm.receiveShadow = true; mm.userData.merged = list.length;
      mm.matrixAutoUpdate = false; mm.updateMatrix(); g.add(mm);
      for (const m of list) { g.remove(m); m.geometry.dispose(); removed++; }
      this.merged++;
    }
    this.after = g.children.length;
  },
};
/* far soldiers and vehicles drop their small parts (pouches, buckles,
   wheel nuts...): moved to a layer the camera doesn't draw, so nothing that
   hides or shows parts for other reasons is disturbed */
Perf.lod = function () {
  const cam = Game.camera; if (!cam) return; const cp = cam.position, now = Game.now, zoom = Settings.fov / Math.max(10, cam.fov);
  const one = (m, far, small) => {
    const u = m.userData; if (!u) return;
    if (!u.lodList || now - (u.lodT || 0) > 3) {
      if (u.lodList && u.lodFar) for (const o of u.lodList) o.layers.set(0);
      u.lodT = now; u.lodList = []; u.lodFar = null;
      m.traverse(o => { if (o.isMesh && o.geometry && o !== m) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); if (o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) < small) u.lodList.push(o); } });
    }
    const f = m.position.distanceTo(cp) > far * zoom;
    if (f !== u.lodFar) { u.lodFar = f; for (const o of u.lodList) o.layers.set(f ? 1 : 0); }
  };
  for (const s of Game.soldiers) if (s.model && s.model.visible) one(s.model, 38, 0.1);
  for (const v of Game.vehicles) if (v.model && v.model.visible) one(v.model, 70, 0.22);
};
const _gupdate47 = Game.update.bind(Game);
Game.update = function (dt) { _gupdate47(dt); if (this.running && Settings.lod !== false) try { Perf.lod(); } catch (e) { } };
const _loadMap47 = loadMap;
loadMap = function (id, scene) { _loadMap47(id, scene); if (!window.__noMerge) try { Perf.mergeWorld(); } catch (e) { console.warn('merge', e); } };
