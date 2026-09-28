/* ═══════════════════════════════════════════════════════════════════════════
   Physics for sandbox props (cannon-es). The level's static boxes are added
   as static bodies; props are dynamic bodies with box / sphere / cylinder
   shapes (compounds allowed). Soldiers don't live in cannon — they collide
   with each prop's bounding box through moveBody, and push the ones they
   walk into. Bullets hit props exactly (ray vs oriented shapes).
   Only the authority (solo / host) steps the simulation; clients just show
   the transforms they're sent.
   ═══════════════════════════════════════════════════════════════════════════ */

const Phys = {
  world: null, props: [], byId: new Map(), nextId: 1, dyn: [], constraints: [], ropes: [], active: false, gravity: -14,
  init() {
    this.clear();
    const w = this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, this.gravity, 0) });
    w.broadphase = new CANNON.SAPBroadphase(w); w.allowSleep = true; w.solver.iterations = 8;
    w.defaultContactMaterial.friction = 0.45; w.defaultContactMaterial.restitution = 0.15;
    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); w.addBody(ground);
    for (const b of World.boxes) {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2)) });
      body.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); w.addBody(body);
    }
    this.active = true;
  },
  clear() {
    for (const p of this.props) { if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh); }
    for (const r of this.ropes) if (r.line && r.line.parent) r.line.parent.remove(r.line);
    this.props = []; this.byId.clear(); this.dyn = []; this.constraints = []; this.ropes = []; this.world = null; this.active = false; this.nextId = 1;
  },
  /* def: { kind, shapes:[{t:'box',h:[x,y,z]}|{t:'sphere',r}|{t:'cyl',r,h}, off:[x,y,z]] , mass, color, mat } */
  makeBody(def, scale = 1) {
    const body = new CANNON.Body({ mass: def.mass * scale * scale * scale, linearDamping: def.damping || 0.05, angularDamping: def.damping || 0.15 });
    for (const sh of def.shapes) {
      const off = new CANNON.Vec3(...(sh.off || [0, 0, 0]).map(v => v * scale));
      let shape;
      if (sh.t === 'box') shape = new CANNON.Box(new CANNON.Vec3(sh.h[0] * scale, sh.h[1] * scale, sh.h[2] * scale));
      else if (sh.t === 'sphere') shape = new CANNON.Sphere(sh.r * scale);
      else shape = new CANNON.Cylinder(sh.r * scale, sh.r * scale, sh.h * scale, 12);
      body.addShape(shape, off);
    }
    if (def.bouncy) body.material = Phys.bouncyMat || (Phys.bouncyMat = new CANNON.Material({ restitution: 0.8 }));
    body.sleepSpeedLimit = 0.15; body.sleepTimeLimit = 0.6;
    return body;
  },
  add(p) {
    // p: { id, def, pos:[..], quat:[..], scale, color, mat, frozen, owner }
    p.id = p.id || 'e' + (this.nextId++);
    p.scale = p.scale || 1;
    p.mesh = buildPropMesh(p.def, p);
    Game.scene.add(p.mesh);
    if (Game.authority()) {
      p.body = this.makeBody(p.def, p.scale); p.body.position.set(...p.pos); if (p.quat) p.body.quaternion.set(...p.quat);
      p.body.userData = p; if (p.frozen) this.setFrozen(p, true);
      this.world.addBody(p.body);
    }
    p.x = p.pos[0]; p.y = p.pos[1]; p.z = p.pos[2]; p.q = new THREE.Quaternion(...(p.quat || [0, 0, 0, 1]));
    p.hp = p.def.hp || 0;
    this.props.push(p); this.byId.set(p.id, p);
    this.syncMesh(p);
    return p;
  },
  remove(p) {
    if (!p || p.dead) return; p.dead = true;
    if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    if (p.body && this.world) this.world.removeBody(p.body);
    this.props = this.props.filter(x => x !== p); this.byId.delete(p.id);
    for (const c of this.constraints.filter(c => c.a === p || c.b === p)) this.removeConstraint(c);
  },
  setFrozen(p, on) {
    p.frozen = on; if (!p.body) return;
    p.body.type = on ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC;
    p.body.mass = on ? 0 : p.def.mass * p.scale ** 3; p.body.updateMassProperties();
    p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0); p.body.wakeUp();
  },
  setScale(p, sc) {
    p.scale = clamp(sc, 0.25, 4);
    p.mesh.scale.setScalar(p.scale);
    if (p.body) {
      const nb = this.makeBody(p.def, p.scale); nb.position.copy(p.body.position); nb.quaternion.copy(p.body.quaternion); nb.userData = p;
      for (const c of this.constraints.filter(c => c.a === p || c.b === p)) if (c.cn) this.world.removeConstraint(c.cn);
      this.world.removeBody(p.body); p.body = nb; this.world.addBody(nb); if (p.frozen) this.setFrozen(p, true);
      for (const c of this.constraints.filter(c => c.a === p || c.b === p)) this.rebuildConstraint(c);
    }
  },
  syncMesh(p) {
    p.mesh.position.set(p.x, p.y, p.z); p.mesh.quaternion.copy(p.q); p.mesh.scale.setScalar(p.scale);
  },
  /* constraints: weld (rigid), rope (max length), keep a visual line for ropes */
  addConstraint(c) {
    c.id = c.id || 'c' + (this.nextId++);
    this.constraints.push(c);
    if (c.type === 'rope' || c.type === 'balloon') {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      c.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c.type === 'balloon' ? 0xdddddd : 0x6a4a2a })); c.line.frustumCulled = false; Game.scene.add(c.line);
      this.ropes.push(c);
    }
    this.rebuildConstraint(c);
    return c;
  },
  rebuildConstraint(c) {
    if (!Game.authority() || !this.world) return;
    if (c.type === 'weld' && c.a.body && c.b.body) { c.cn = new CANNON.LockConstraint(c.a.body, c.b.body, { maxForce: 1e6 }); this.world.addConstraint(c.cn); }
  },
  removeConstraint(c) {
    if (c.cn && this.world) this.world.removeConstraint(c.cn);
    if (c.line && c.line.parent) c.line.parent.remove(c.line);
    this.constraints = this.constraints.filter(x => x !== c); this.ropes = this.ropes.filter(x => x !== c);
    if (c.type === 'balloon' && c.balloon) this.remove(c.balloon);
  },
  /* world-space anchor of a constraint end */
  anchor(p, local, out = new V3()) {
    if (!p) return out.set(local[0], local[1], local[2]);
    return out.set(local[0] * p.scale, local[1] * p.scale, local[2] * p.scale).applyQuaternion(p.q).add(new V3(p.x, p.y, p.z));
  },
  worldToLocal(p, w) { const v = new V3(w.x - p.x, w.y - p.y, w.z - p.z).applyQuaternion(p.q.clone().invert()); return [v.x / p.scale, v.y / p.scale, v.z / p.scale]; },

  step(dt) {
    if (!this.active) return;
    const auth = Game.authority();
    if (auth && this.world) {
      // ropes: soft max-length springs; thrusters, balloons: forces
      for (const c of this.constraints) {
        if (c.type === 'rope' || c.type === 'balloon') {
          const A = this.anchor(c.a, c.la), B = this.anchor(c.b, c.lb), d = B.clone().sub(A), L = d.length();
          if (L > c.len && L > 0.001) {
            d.multiplyScalar(1 / L); const stretch = L - c.len, k = 60 * stretch;
            const pull = (p, anchor, dir) => { if (!p || !p.body || p.frozen) return; const f = new CANNON.Vec3(dir.x * k * p.body.mass, dir.y * k * p.body.mass, dir.z * k * p.body.mass); p.body.applyForce(f, new CANNON.Vec3(anchor.x, anchor.y, anchor.z)); p.body.velocity.scale(0.98, p.body.velocity); p.body.wakeUp(); };
            pull(c.a, A, d); pull(c.b, B, d.clone().negate());
            if (c.type === 'balloon' && c.a && c.a.body && c.a.body.velocity.y > 5) c.a.body.velocity.y = 5;
          }
        }
      }
      for (const p of this.props) {
        if (!p.body || p.frozen) continue;
        if (p.def.lift) { // lift in kg, fading out high in the sky so balloons don't leave the map
          const f = p.def.lift * (p.liftK || 1) * clamp((120 - p.y) / 40, 0, 1) + p.body.mass * -this.gravity;
          p.body.applyForce(new CANNON.Vec3(0, f, 0), p.body.position); p.body.wakeUp();
          if (p.body.velocity.y > 5) p.body.velocity.y = 5;   // balloons drift up, they don't launch
        }
        if (p.thrusters) for (const t of p.thrusters) if (t.on) {
          const A = this.anchor(p, t.at), dir = new V3(...t.dir).applyQuaternion(p.q).multiplyScalar(t.force);
          p.body.applyForce(new CANNON.Vec3(dir.x, dir.y, dir.z), new CANNON.Vec3(A.x, A.y, A.z)); p.body.wakeUp();
        }
      }
      this.world.step(1 / 60, dt, 4);
      for (const p of this.props) {
        if (!p.body) continue; const b = p.body;
        p.x = b.position.x; p.y = b.position.y; p.z = b.position.z; p.q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        if (p.y < -50) { Sandbox.removeEntity(p.id); continue; }
      }
    } else {
      for (const p of this.props) if (p.net) { const k = 1 - Math.exp(-dt * 15); p.x = lerp(p.x, p.net[0], k); p.y = lerp(p.y, p.net[1], k); p.z = lerp(p.z, p.net[2], k); p.q.slerp(_q.set(p.net[3], p.net[4], p.net[5], p.net[6]), k); }
    }
    this.dyn.length = 0;
    for (const p of this.props) {
      this.syncMesh(p);
      if (p.def.noCollide || p.held) continue;
      const bb = this.aabb(p); bb.prop = p; this.dyn.push(bb);
    }
    for (const c of this.ropes) {
      const A = this.anchor(c.a, c.la), B = this.anchor(c.b, c.lb), a = c.line.geometry.attributes.position.array;
      a[0] = A.x; a[1] = A.y; a[2] = A.z; a[3] = B.x; a[4] = B.y; a[5] = B.z; c.line.geometry.attributes.position.needsUpdate = true;
    }
  },
  /* world AABB from the mesh's bounds (works on clients too) */
  aabb(p) {
    const r = p.def.radius * p.scale, o = p._bb || (p._bb = { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0, stamp: 0 });
    if (!p._box3) p._box3 = new THREE.Box3();
    if (p.frozen || !p._lastBB || Math.abs(p._lastBB[0] - p.x) + Math.abs(p._lastBB[1] - p.y) + Math.abs(p._lastBB[2] - p.z) > 0.001 || p._lastBB[3] !== p.q.w) {
      p.mesh.updateMatrixWorld(true); p._box3.setFromObject(p.mesh, false); p._lastBB = [p.x, p.y, p.z, p.q.w];
    }
    const b = p._box3; o.x0 = b.min.x; o.y0 = b.min.y; o.z0 = b.min.z; o.x1 = b.max.x; o.y1 = b.max.y; o.z1 = b.max.z;
    return o;
  },
  /* exact ray vs every prop shape. returns { p, t, n } or null */
  ray(o, d, maxT, skip) {
    let best = maxT, hit = null, nrm = null;
    const lo = new V3(), ld = new V3(), iq = new THREE.Quaternion();
    for (const p of this.props) {
      if (p === skip || p.def.noRay) continue;
      const cx = p.x - o.x, cy = p.y - o.y, cz = p.z - o.z, rad = p.def.radius * p.scale + 0.5;
      const tc = cx * d.x + cy * d.y + cz * d.z; if (tc < -rad || tc > best + rad) continue;
      const px = cx - d.x * tc, py = cy - d.y * tc, pz = cz - d.z * tc; if (px * px + py * py + pz * pz > rad * rad) continue;
      iq.copy(p.q).invert();
      lo.set(o.x - p.x, o.y - p.y, o.z - p.z).applyQuaternion(iq).multiplyScalar(1 / p.scale); ld.copy(d).applyQuaternion(iq);
      for (const sh of p.def.shapes) {
        const off = sh.off || [0, 0, 0], ox = lo.x - off[0], oy = lo.y - off[1], oz = lo.z - off[2];
        let t = -1, n = null;
        if (sh.t === 'sphere') {
          const b = ox * ld.x + oy * ld.y + oz * ld.z, c = ox * ox + oy * oy + oz * oz - sh.r * sh.r, disc = b * b - c;
          if (disc >= 0) { t = -b - Math.sqrt(disc); if (t < 0) t = 0; n = new V3(ox + ld.x * t, oy + ld.y * t, oz + ld.z * t).normalize(); }
        } else {
          const h = sh.t === 'box' ? sh.h : [sh.r, sh.h / 2, sh.r];
          t = rayBox(ox, oy, oz, ld.x, ld.y, ld.z, { x0: -h[0], x1: h[0], y0: -h[1], y1: h[1], z0: -h[2], z1: h[2] });
          if (t >= 0) n = new V3(_rbAxis === 0 ? _rbSign : 0, _rbAxis === 1 ? _rbSign : 0, _rbAxis === 2 ? _rbSign : 0);
        }
        if (t >= 0) { const tw = t * p.scale; if (tw < best) { best = tw; hit = p; nrm = n.applyQuaternion(p.q); } }
      }
    }
    return hit ? { p: hit, t: best, n: nrm } : null;
  },
  /* shoot / hit a prop: push it, and damage breakables */
  impulse(p, point, dir, force) {
    if (!p || !p.body || p.frozen) return;
    p.body.applyImpulse(new CANNON.Vec3(dir.x * force, dir.y * force, dir.z * force), new CANNON.Vec3(point.x, point.y, point.z)); p.body.wakeUp();
  },
  damage(p, dmg, att, point) {
    if (!Game.authority() || !p || p.dead) return;
    if (p.def.explosive) { p.hp -= dmg; if (p.hp <= 0) { const pos = new V3(p.x, p.y, p.z); Sandbox.removeEntity(p.id); Sandbox.explode(pos, p.def.explosive, 7, att); } }
  },
  /* an explosion shoves every prop near it */
  blast(pos, radius, power) {
    if (!Game.authority()) return;
    for (const p of this.props) {
      if (!p.body || p.frozen) continue;
      const d = new V3(p.x - pos.x, p.y - pos.y + 0.3, p.z - pos.z), L = d.length(); if (L > radius) continue;
      const f = power * (1 - L / radius); d.normalize();
      p.body.applyImpulse(new CANNON.Vec3(d.x * f * Math.min(p.body.mass, 80), d.y * f * Math.min(p.body.mass, 80), d.z * f * Math.min(p.body.mass, 80)), p.body.position); p.body.wakeUp();
    }
  },
};
const _q = new THREE.Quaternion();
