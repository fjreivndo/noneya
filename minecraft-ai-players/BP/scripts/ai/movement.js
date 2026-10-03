// Movement: low-level motor, A* path finding (walk / jump / drop / dig / bridge / pillar)
// and path following.
import { cfg } from "../config.js";
import { kindOf, K_AIR, K_SOLID, K_WATER, K_LAVA, K_TALL, K_HURT, K_HAZARD, K_UNLOADED } from "../data.js";
import { V, now, wait, yawTo, pitchTo, rand, chance, safe } from "../util.js";
import { typeAt, getBlock, surfaceAt, kindAt, isPassable } from "./world.js";
import { mineBlock, placeBlock, pillarUp, canDig, lineOfSight, reachOf } from "./actions.js";
import { toSurface } from "./mining.js";
import { slip, journal, recallPlace } from "./cognition.js";
import { onlineSociety } from "../society.js";
import { boatTo, hasBoatMaterials, waterAhead } from "./life.js";

const WALK = 0.2158;
const SPRINT = 0.28;

// ---------------------------------------------------------------------------
// Motor: coroutines set bot.motor.* each tick; applyMotor turns it into physics.
// ---------------------------------------------------------------------------
export function steer(bot, target, opts = {}) {
  bot.motor.target = target;
  bot.motor.sprint = !!opts.sprint;
  bot.motor.slow = !!opts.slow;
  if (opts.jump) bot.motor.jump = true;
}

export function applyMotor(bot) {
  const e = bot.entity;
  const m = bot.motor;
  let v;
  try {
    v = e.getVelocity();
  } catch (err) {
    return;
  }
  const p = e.location;
  const onGround = e.isOnGround;
  const inWater = e.isInWater;
  let ix = 0;
  let iy = 0;
  let iz = 0;
  let face = m.look;

  if (m.target) {
    const dx = m.target.x - p.x;
    const dz = m.target.z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    let speed = m.sprint ? SPRINT : WALK;
    if (inWater) speed *= 0.55;
    if (m.slow) speed = Math.min(speed, d * 0.6 + 0.02);
    // people turn towards where they're going before they walk off
    if (d > 0.3 && !m.look) {
      const off = Math.abs(wrapDeg(yawTo(p, m.target) - bot.yaw));
      if (off > 75) speed *= 0.2;
      else if (off > 40) speed *= 0.6;
    }
    if (d > 0.04) {
      const s = Math.min(speed, d);
      ix = (dx / d) * s - v.x;
      iz = (dz / d) * s - v.z;
      if (!face && d > 0.15) face = { x: m.target.x, y: p.y + 1.62 + (m.target.y - p.y) * 0.5 - 0.15, z: m.target.z };
    } else {
      ix = -v.x * 0.8;
      iz = -v.z * 0.8;
    }
    if (!onGround && !inWater) {
      ix *= 0.5;
      iz *= 0.5;
    }
    // swim up when target is above or we are submerged
    if (inWater && (m.target.y > p.y - 0.3 || bot.isHeadUnderwater())) iy = Math.max(0, 0.06 - v.y * 0.2);

    // auto jump: blocked by a 1-high step
    if (onGround && d > 0.3) {
      const hv = Math.sqrt(v.x * v.x + v.z * v.z);
      const fx = Math.floor(p.x + (dx / d) * 0.65);
      const fz = Math.floor(p.z + (dz / d) * 0.65);
      const fy = Math.floor(p.y + 0.01);
      if (hv < 0.06 || m.target.y > p.y + 0.6) {
        const front = kindAt(bot.dim, { x: fx, y: fy, z: fz });
        const frontUp = kindAt(bot.dim, { x: fx, y: fy + 1, z: fz });
        const headUp = kindAt(bot.dim, { x: Math.floor(p.x), y: fy + 2, z: Math.floor(p.z) });
        if ((front === K_SOLID || front === K_HURT) && (frontUp === K_AIR || frontUp === K_WATER) && headUp !== K_SOLID) m.jump = true;
      }
    }
  } else if (onGround) {
    ix = -v.x * 0.6;
    iz = -v.z * 0.6;
  }

  if (m.jump && onGround) {
    iy = (m.jumpPower || 0.42) - v.y;
    bot.exhaust(0.05);
  }
  if (Math.abs(ix) > 0.001 || Math.abs(iy) > 0.001 || Math.abs(iz) > 0.001) {
    try {
      e.applyImpulse({ x: ix, y: iy, z: iz });
    } catch (err) {
      /* entity may be riding / invalid */
    }
  }
  turnTowards(bot, face, p);
  if (m.target) {
    const moved = Math.sqrt(v.x * v.x + v.z * v.z);
    bot.exhaust(moved * (m.sprint ? 0.1 : 0.01));
  }
  m.target = null;
  m.jump = false;
  m.jumpPower = 0;
  m.look = null;
  m.sprint = false;
  m.slow = false;
}

export function wrapDeg(a) {
  a = ((a + 180) % 360 + 360) % 360 - 180;
  return a;
}

/**
 * Smoothly turn body and head towards a point. Body yaw goes through setRotation; head pitch is a
 * synced entity property because Bedrock ignores pitch on mobs.
 */
function turnTowards(bot, face, p) {
  const e = bot.entity;
  let wantYaw = bot.yaw;
  let wantPitch = 0;
  if (face) {
    const eye = { x: p.x, y: p.y + 1.62, z: p.z };
    wantYaw = yawTo(eye, face);
    wantPitch = Math.max(-85, Math.min(85, pitchTo(eye, face)));
  } else wantPitch = bot.pitch * 0.85;
  const rate = 22 + cfg().skill * 25;
  const dy = wrapDeg(wantYaw - bot.yaw);
  bot.yaw = wrapDeg(bot.yaw + Math.max(-rate, Math.min(rate, dy)));
  const dp = wantPitch - bot.pitch;
  bot.pitch += Math.max(-rate, Math.min(rate, dp));
  try {
    e.setRotation({ x: bot.pitch, y: bot.yaw });
  } catch (err) {
    /* ignore */
  }
  // Bedrock lets a mob's rendered body drift towards its movement direction, so the model is turned
  // client-side to this synced yaw (see animation.aip.look) and always shows where the bot looks.
  if (Math.abs(wrapDeg(bot.yaw - bot.shownYaw)) > 2) {
    bot.shownYaw = bot.yaw;
    try {
      e.setProperty("aip:yaw", Math.round(bot.yaw * 10) / 10);
    } catch (err) {
      /* ignore */
    }
  }
  if (Math.abs(bot.pitch - bot.shownPitch) > 1.5) {
    bot.shownPitch = bot.pitch;
    try {
      e.setProperty("aip:pitch", Math.round(bot.pitch * 10) / 10);
    } catch (err) {
      /* ignore */
    }
  }
}

/** Degrees between where the bot looks and a point. */
export function facingError(bot, point) {
  const p = bot.pos;
  const eye = { x: p.x, y: p.y + 1.62, z: p.z };
  return Math.max(Math.abs(wrapDeg(yawTo(eye, point) - bot.yaw)), Math.abs(pitchTo(eye, point) - bot.pitch));
}

/** Turn to face a point; returns once roughly facing it (or after a short timeout). */
export function* faceTowards(bot, point, maxTicks = 12) {
  for (let i = 0; i < maxTicks; i++) {
    if (facingError(bot, point) < 12) return true;
    bot.motor.look = point;
    yield;
  }
  return false;
}

// Shared path-finding budget: with many bots online, searches queue up instead of spiking the tick.
const budget = { tick: -1, used: 0 };
const PER_TICK = 2400;
function spend(n) {
  const t = now();
  if (budget.tick !== t) {
    budget.tick = t;
    budget.used = 0;
  }
  budget.used += n;
  return budget.used <= PER_TICK;
}

// ---------------------------------------------------------------------------
// A* path finding
// ---------------------------------------------------------------------------
class Heap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(n) {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const DIRS8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

// goal: {x,y,z}; opts: range, goalFn(node) -> bool, maxNodes, allowDig, allowPlace.
// Returns an array of steps (with .partial) or null.
export function* findPath(bot, goal, opts = {}) {
  const dim = bot.dim;
  const c = cfg();
  const start = bot.feetBlock();
  const crowd = onlineSociety().length;
  const maxNodes = opts.maxNodes ?? Math.round(c.pathNodeLimit * (crowd > 8 ? 0.6 : 1));
  const allowDig = (opts.allowDig ?? true) && c.canBreakBlocks;
  const allowPlace = opts.allowPlace ?? true;
  const blocksAvail = allowPlace ? bot.inv.buildingCount() : 0;
  // pillaring keeps failing here: plan without it for a while
  const allowPillar = !(bot.pillarFails >= 2 && now() - (bot.pillarFailAt || 0) < 20 * 60);
  const range = opts.range ?? 1.2;
  const goalFn = opts.goalFn;
  // misjudging heights: a stressed or careless bot sometimes takes drops that will hurt
  const maxDrop = opts.risky ? 6 : 3;
  const gc = { x: goal.x, y: goal.y, z: goal.z };
  const sx = start.x;
  const sz = start.z;

  const tcache = new Map();
  const key = (x, y, z) => ((x - sx + 1024) * 2048 + (z - sz + 1024)) * 1024 + (y + 512);
  const T = (x, y, z) => {
    const k = key(x, y, z);
    let t = tcache.get(k);
    if (t === undefined) {
      t = typeAt(dim, { x, y, z }) ?? null;
      tcache.set(k, t);
    }
    return t;
  };
  const K = (x, y, z) => {
    const t = T(x, y, z);
    return t === null ? K_UNLOADED : kindOf(t);
  };
  const pass = (x, y, z) => {
    const k = K(x, y, z);
    return k === K_AIR || k === K_WATER;
  };
  const stand = (x, y, z) => {
    const k = K(x, y, z);
    return k === K_SOLID || k === K_HURT;
  };
  // cost to clear a block so we can walk through it (0 = already clear, Infinity = impossible)
  const clearCost = (x, y, z) => {
    const t = T(x, y, z);
    if (t === null) return Infinity;
    const k = kindOf(t);
    if (k === K_AIR || k === K_WATER) return 0;
    if (k === K_LAVA || k === K_HAZARD) return Infinity;
    if (!allowDig) return Infinity;
    const p = { x, y, z };
    if (!canDig(bot, t, p)) return Infinity;
    // never open a hole next to lava
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = T(x + dx, y + dy, z + dz);
      if (n === "minecraft:lava" || n === "minecraft:flowing_lava") return Infinity;
    }
    // falling blocks above are annoying but fine; cost by break time
    return 1.5 + bot.inv.ticksToBreak(t) / 10;
  };
  const h = (x, y, z) => {
    const dx = Math.abs(x - gc.x);
    const dz = Math.abs(z - gc.z);
    const dy = y - gc.y;
    return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + (dy > 0 ? dy * 1.2 : -dy * 1.6)) * 1.3;
  };
  const isGoal = (n) => {
    if (goalFn) return goalFn(n);
    const dx = n.x + 0.5 - gc.x;
    const dy = n.y - gc.y;
    const dz = n.z + 0.5 - gc.z;
    return Math.sqrt(dx * dx + dy * dy * 1.0 + dz * dz) <= range;
  };

  const open = new Heap();
  const best = new Map();
  const startNode = { x: start.x, y: start.y, z: start.z, g: 0, f: h(start.x, start.y, start.z), p: null, act: "start", blocks: 0 };
  open.push(startNode);
  best.set(key(start.x, start.y, start.z), 0);
  let closest = startNode;
  let closestH = startNode.f;
  let expanded = 0;
  let found = null;

  const push = (parent, x, y, z, cost, act, dig, place, usesBlock) => {
    const g = parent.g + cost;
    const k = key(x, y, z);
    const prev = best.get(k);
    if (prev !== undefined && prev <= g) return;
    const blocks = parent.blocks + (usesBlock ? 1 : 0);
    if (blocks > blocksAvail) return;
    best.set(k, g);
    const hv = h(x, y, z);
    // bridge / pillar steps put a block under our feet, so the node is supported even though the world says air
    open.push({ x, y, z, g, f: g + hv, p: parent, act, dig, place, blocks, hv, sup: act === "bridge" || act === "pillar" });
  };

  while (open.size) {
    const n = open.pop();
    if (best.get(key(n.x, n.y, n.z)) < n.g) continue;
    if (isGoal(n)) {
      found = n;
      break;
    }
    const hv = n.hv ?? h(n.x, n.y, n.z);
    if (hv < closestH) {
      closestH = hv;
      closest = n;
    }
    if (++expanded > maxNodes) break;
    if (expanded % 60 === 0) {
      yield;
      while (!spend(60)) yield;
    }

    const { x, y, z } = n;
    const inWater = K(x, y, z) === K_WATER;
    const floorK = K(x, y - 1, z);
    const supported = n.sup || floorK === K_SOLID || floorK === K_HURT || inWater || floorK === K_WATER || n.act === "start";

    for (let i = 0; i < 8; i++) {
      const [dx, dz] = DIRS8[i];
      const nx = x + dx;
      const nz = z + dz;
      const diag = i >= 4;
      if (diag) {
        if (!pass(nx, y, nz) || !pass(nx, y + 1, nz) || !pass(x + dx, y, z) || !pass(x + dx, y + 1, z) || !pass(x, y, z + dz) || !pass(x, y + 1, z + dz)) continue;
        if (stand(nx, y - 1, nz)) push(n, nx, y, nz, 1.45 + (K(nx, y - 1, nz) === K_HURT ? 8 : 0), "walk");
        continue;
      }
      const feetK = K(nx, y, nz);
      const headK = K(nx, y + 1, nz);
      if (feetK === K_LAVA || headK === K_LAVA || feetK === K_HAZARD || headK === K_HAZARD || feetK === K_UNLOADED) continue;

      // 1) same level (possibly digging through)
      const cf = feetK === K_TALL ? Infinity : clearCost(nx, y, nz);
      const ch = headK === K_TALL ? Infinity : clearCost(nx, y + 1, nz);
      if (cf !== Infinity && ch !== Infinity) {
        const dig = [];
        if (ch > 0) dig.push({ x: nx, y: y + 1, z: nz });
        if (cf > 0) dig.push({ x: nx, y, z: nz });
        const fk = K(nx, y - 1, nz);
        const waterHere = feetK === K_WATER;
        if (fk === K_SOLID || fk === K_HURT || waterHere) {
          push(n, nx, y, nz, 1 + cf + ch + (fk === K_HURT ? 8 : 0) + (waterHere ? 1.5 : 0), "walk", dig.length ? dig : null);
        } else if (fk === K_AIR || fk === K_WATER || fk === K_LAVA) {
          // drop down (only when we didn't need to dig)
          if (cf === 0 && ch === 0 && fk !== K_LAVA) {
            for (let k = 1; k <= 12; k++) {
              const lk = K(nx, y - k, nz);
              if (lk === K_WATER) {
                push(n, nx, y - k, nz, 1 + k * 0.4 + 1, "drop");
                break;
              }
              if (lk !== K_AIR) break;
              const below = K(nx, y - k - 1, nz);
              if (below === K_SOLID) {
                if (k <= maxDrop) push(n, nx, y - k, nz, 1 + k * 0.5, "drop");
                break;
              }
              if (below === K_LAVA || below === K_HAZARD || below === K_HURT || below === K_UNLOADED) break;
              if (k >= maxDrop && below !== K_WATER && below !== K_AIR) break;
            }
          }
          // bridge: place a block under the next step
          if (supported && allowPlace && blocksAvail > n.blocks && !inWater) {
            push(n, nx, y, nz, 4 + cf + ch, "bridge", dig.length ? dig : null, { x: nx, y: y - 1, z: nz }, true);
          }
        }
      }

      // 2) step up one block
      if (supported && (feetK === K_SOLID || feetK === K_HURT || (allowDig && feetK !== K_TALL))) {
        const c1 = clearCost(x, y + 2, z);
        const c2 = clearCost(nx, y + 1, nz);
        const c3 = clearCost(nx, y + 2, nz);
        const floorOk = stand(nx, y, nz);
        if (floorOk && c1 !== Infinity && c2 !== Infinity && c3 !== Infinity) {
          const dig = [];
          if (c1 > 0) dig.push({ x, y: y + 2, z });
          if (c3 > 0) dig.push({ x: nx, y: y + 2, z: nz });
          if (c2 > 0) dig.push({ x: nx, y: y + 1, z: nz });
          push(n, nx, y + 1, nz, 2 + c1 + c2 + c3, "up", dig.length ? dig : null);
        }
      }

      // 3) dig a step down (staircase)
      if (allowDig && supported && feetK !== K_TALL && headK !== K_TALL) {
        const target = K(nx, y - 1, nz);
        if (target === K_SOLID && stand(nx, y - 2, nz)) {
          const c0 = clearCost(nx, y + 1, nz);
          const c1 = clearCost(nx, y, nz);
          const c2 = clearCost(nx, y - 1, nz);
          if (c0 !== Infinity && c1 !== Infinity && c2 !== Infinity) {
            const dig = [];
            if (c0 > 0) dig.push({ x: nx, y: y + 1, z: nz });
            if (c1 > 0) dig.push({ x: nx, y, z: nz });
            dig.push({ x: nx, y: y - 1, z: nz });
            push(n, nx, y - 1, nz, 2.5 + c0 + c1 + c2, "walk", dig);
          }
        }
      }
    }

    // 4) pillar straight up
    if (supported && !inWater && allowPlace && allowPillar && blocksAvail > n.blocks) {
      const c = clearCost(x, y + 2, z);
      if (c !== Infinity) push(n, x, y + 1, z, 5 + c, "pillar", c > 0 ? [{ x, y: y + 2, z }] : null, null, true);
    }
    // 5) dig straight down
    if (allowDig && supported && floorK === K_SOLID) {
      const c = clearCost(x, y - 1, z);
      const below = K(x, y - 2, z);
      if (c !== Infinity && (below === K_SOLID || below === K_WATER)) push(n, x, y - 1, z, 3 + c, "down", [{ x, y: y - 1, z }]);
    }
    // swim up
    if (inWater && pass(x, y + 1, z)) push(n, x, y + 1, z, 1.5, "swim");
  }

  let end = found;
  if (!end) {
    if (opts.noPartial) return null;
    // partial path towards the closest node, if it actually gets us closer
    const startH = startNode.f;
    if (closest === startNode || closestH > startH - 2) return null;
    end = closest;
  }
  /** @type {any} */
  const path = [];
  for (let n = end; n; n = n.p) path.push(n);
  path.reverse();
  path.partial = !found;
  return path;
}

// ---------------------------------------------------------------------------
// Path following
// ---------------------------------------------------------------------------
function openDoorAt(bot, p) {
  for (const q of [p, { x: p.x, y: p.y + 1, z: p.z }]) {
    const b = getBlock(bot.dim, q);
    if (b && b.typeId.includes("door") && !b.typeId.includes("trapdoor") && !b.typeId.includes("iron")) {
      try {
        if (!b.permutation.getState("open_bit")) b.setPermutation(b.permutation.withState("open_bit", true));
      } catch (e) {
        /* ignore */
      }
    }
  }
}

function arrived(bot, step, last) {
  const p = bot.pos;
  const dx = p.x - (step.x + 0.5);
  const dz = p.z - (step.z + 0.5);
  const hd = Math.sqrt(dx * dx + dz * dz);
  const dy = p.y - step.y;
  const tol = last ? 0.35 : 0.5;
  if (hd > tol) return false;
  if (Math.abs(dy) < 0.6) return true;
  if (bot.entity.isInWater && Math.abs(dy) < 1.2) return true;
  return false;
}

/**
 * Executes a path. Returns "done" | "replan" | "fail".
 */
export function* followPath(bot, path, movingTarget, opts = {}) {
  const startTick = now();
  for (let i = 1; i < path.length; i++) {
    const step = path[i];
    const last = i === path.length - 1;
    // dig obstacles
    if (step.dig) {
      for (const d of step.dig) {
        if (isPassable(bot.dim, d)) continue;
        const ok = yield* mineBlock(bot, d);
        if (!ok) return "fail";
      }
    }
    if (step.act === "pillar") {
      const ok = yield* pillarUp(bot);
      if (!ok) {
        bot.pillarFailAt = now();
        bot.pillarFails = (bot.pillarFails || 0) + 1;
        return "fail";
      }
      bot.pillarFails = 0;
      continue;
    }
    if (step.act === "down") {
      let t = 0;
      while (bot.pos.y > step.y + 0.2 && t < 30) {
        steer(bot, { x: step.x + 0.5, y: step.y, z: step.z + 0.5 }, { slow: true });
        yield;
        t++;
      }
      continue;
    }
    if (step.place) {
      const ok = yield* placeBlock(bot, step.place, undefined, { bridge: true });
      if (!ok && !isStandableNow(bot, step.place)) return "fail";
    }
    openDoorAt(bot, step);

    let t = 0;
    let bestD = Infinity;
    let stall = 0;
    const target = { x: step.x + 0.5, y: step.y, z: step.z + 0.5 };
    while (!arrived(bot, step, last)) {
      const p = bot.pos;
      const hd = V.hdist(p, target);
      const needJump = (step.act === "up" || step.y > Math.floor(p.y + 0.01)) && hd < 1.4 && step.act !== "swim";
      steer(bot, target, { sprint: opts.sprint && !last && step.act === "walk", slow: last || step.act === "bridge", jump: needJump });
      if (step.act === "bridge" || (step.act === "drop" && hd < 1)) bot.setSneak(true);
      if (step.act === "bridge" && hd < 1.2) bot.motor.slow = true;
      yield;
      t++;
      if (hd < bestD - 0.05) {
        bestD = hd;
        stall = 0;
      } else stall++;
      if (stall === 20) bot.motor.jump = true;
      if (stall > 45 || t > 160) {
        bot.stuckCount++;
        return "replan";
      }
      if (bot.pos.y < step.y - 4) return "replan"; // fell
    }
    bot.stuckCount = 0;
    if (movingTarget && now() - startTick > 30) {
      const mt = movingTarget();
      const lastStep = path[path.length - 1];
      if (mt && V.dist(mt, { x: lastStep.x + 0.5, y: lastStep.y, z: lastStep.z + 0.5 }) > 3) return "replan";
    }
    if (opts.interrupt && opts.interrupt()) return "done";
  }
  return path.partial ? "replan" : "done";
}

function isStandableNow(bot, p) {
  const k = kindAt(bot.dim, p);
  return k === K_SOLID || k === K_HURT;
}

/** Point up to `dist` blocks towards target, on the surface if we're on the surface. */
function waypointTowards(bot, tgt, dist) {
  const p = bot.pos;
  const dx = tgt.x - p.x;
  const dz = tgt.z - p.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  const x = Math.floor(p.x + (dx / d) * dist);
  const z = Math.floor(p.z + (dz / d) * dist);
  const underground = bot.isUnderground();
  if (!underground || tgt.surface) {
    const s = surfaceAt(bot.dim, x, z);
    if (s && !(s.water && dist > 12)) return { x: s.x + 0.5, y: s.y, z: s.z + 0.5 };
  }
  const t = dist / d;
  return { x: x + 0.5, y: Math.round(p.y + (tgt.y - p.y) * Math.min(1, t)), z: z + 0.5 };
}

/**
 * Walks to a target position (or a function returning one).
 * opts: range, goalFn, timeout (ticks), sprint, allowDig, allowPlace, interrupt()
 */
export function* goTo(bot, target, opts = {}) {
  const range = opts.range ?? 1.2;
  const deadline = now() + (opts.timeout ?? 20 * 180);
  let fails = 0;
  let segDist = 36;
  let lastTick = -1;
  for (;;) {
    // never spin inside a single game tick
    if (now() === lastTick) yield;
    lastTick = now();
    const tgt = typeof target === "function" ? target() : target;
    if (!tgt) return false;
    const here = bot.feetBlock();
    const done = opts.goalFn ? opts.goalFn(here) : V.dist({ x: here.x + 0.5, y: here.y, z: here.z + 0.5 }, tgt) <= range + 0.3;
    if (done) return true;
    if (now() > deadline) return false;
    if (opts.interrupt && opts.interrupt()) return false;

    let goal = tgt;
    let segOpts = opts;
    if (V.hdist(bot.pos, tgt) > segDist + 4) {
      goal = waypointTowards(bot, tgt, segDist);
      segOpts = { ...opts, range: 3, goalFn: undefined };
    }
    const path = yield* findPath(bot, goal, slip(bot, 0.06) ? { ...segOpts, risky: true } : segOpts);
    if (!path || path.length < 2) {
      fails++;
      segDist = Math.max(10, segDist * 0.6);
      if (fails >= 3) {
        const ok = yield* unstick(bot, tgt, fails);
        if (!ok || fails > 6) return false;
      } else yield* wait(4);
      continue;
    }
    const res = yield* followPath(bot, path, typeof target === "function" ? target : null, opts);
    if (res === "fail") {
      fails++;
      if (fails > 6) return false;
    } else if (res === "replan") {
      if (bot.stuckCount > 3) {
        yield* unstick(bot, tgt, bot.stuckCount);
        bot.stuckCount = 0;
      }
    } else {
      fails = 0;
      segDist = 36;
    }
  }
}

/**
 * Gets a stuck bot moving again the way a player would: swim up, dig through what's in the way,
 * hop up a step, pillar out of a hole, or walk off in another direction. Teleporting is only a last
 * resort, and only if the stuckTeleport setting is switched on.
 */
export function* unstick(bot, tgt, severity) {
  const dim = bot.dim;
  const f = bot.feetBlock();
  const p = bot.pos;
  // 1) in water: swim up
  if (bot.entity.isInWater) {
    for (let i = 0; i < 20 && bot.entity.isInWater; i++) {
      steer(bot, tgt || p, { jump: true });
      yield;
    }
    return true;
  }
  // 2) blocked towards the target: dig through, or hop up a one-block step
  if (tgt) {
    const dx = tgt.x - p.x;
    const dz = tgt.z - p.z;
    const step = Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
    const feet = { x: f.x + step.x, y: f.y, z: f.z + step.z };
    const head = { x: f.x + step.x, y: f.y + 1, z: f.z + step.z };
    const above = { x: f.x + step.x, y: f.y + 2, z: f.z + step.z };
    const solid = (q) => {
      const k = kindAt(dim, q);
      return k === K_SOLID || k === K_HURT || k === K_TALL;
    };
    if (solid(feet) && !solid(head) && !solid(above) && !solid({ x: f.x, y: f.y + 2, z: f.z }) && kindAt(dim, feet) !== K_TALL) {
      for (let i = 0; i < 14; i++) {
        steer(bot, { x: feet.x + 0.5, y: f.y + 1, z: feet.z + 0.5 }, { jump: i % 5 === 0 });
        yield;
      }
      if (bot.feetBlock().y > f.y) return true;
    }
    let dug = false;
    for (const q of [head, feet]) {
      if (!solid(q)) continue;
      const t = typeAt(dim, q);
      if (t && canDig(bot, t, q) && (yield* mineBlock(bot, q))) dug = true;
    }
    if (dug) {
      for (let i = 0; i < 12; i++) {
        steer(bot, { x: feet.x + 0.5, y: f.y, z: feet.z + 0.5 }, {});
        yield;
      }
      return true;
    }
  }
  // 3) boxed in a hole: pillar out
  let exits = 0;
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (isPassable(dim, { x: f.x + ax, y: f.y, z: f.z + az }) && isPassable(dim, { x: f.x + ax, y: f.y + 1, z: f.z + az })) exits++;
  }
  if (!exits && bot.inv.buildingCount() > 0) {
    for (let i = 0; i < 3; i++) if (!(yield* pillarUp(bot))) break;
    return true;
  }
  // 4) walk off in a fresh direction, hopping over small things
  const a = rand(0, Math.PI * 2);
  for (let i = 0; i < 20; i++) {
    steer(bot, { x: p.x + Math.cos(a) * 4, y: p.y, z: p.z + Math.sin(a) * 4 }, { jump: i % 6 === 0 });
    yield;
  }
  // 5) last resort, opt-in only, after being stuck for a long time
  if (severity >= 8 && cfg().stuckTeleport && tgt) {
    const dx = tgt.x - p.x;
    const dz = tgt.z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    for (let s = 2; s >= 1; s--) {
      const x = Math.floor(p.x + (dx / d) * s);
      const z = Math.floor(p.z + (dz / d) * s);
      for (let dy = 1; dy >= -1; dy--) {
        const y = Math.floor(p.y) + dy;
        if (isPassable(dim, { x, y, z }) && isPassable(dim, { x, y: y + 1, z }) && isStandableNow(bot, { x, y: y - 1, z })) {
          return safe(() => {
            bot.entity.teleport({ x: x + 0.5, y, z: z + 0.5 });
            return true;
          }, false);
        }
      }
    }
  }
  return true;
}

/** goal function: within reach of a block, not standing inside it */
export function reachGoal(p, reach, dim) {
  const cx = p.x + 0.5;
  const cy = p.y + 0.5;
  const cz = p.z + 0.5;
  return (n) => {
    if (n.x === p.x && n.z === p.z && (n.y === p.y || n.y + 1 === p.y)) return false;
    const dx = n.x + 0.5 - cx;
    const dy = n.y + 1.62 - cy;
    const dz = n.z + 0.5 - cz;
    if (dx * dx + dy * dy + dz * dz > reach * reach) return false;
    // must be able to actually see the block from there
    return !dim || lineOfSight(dim, { x: n.x + 0.5, y: n.y + 1.62, z: n.z + 0.5 }, p);
  };
}

export function* goNear(bot, p, reach) {
  const r = reach ?? reachOf() - 0.3;
  return yield* goTo(bot, { x: p.x + 0.5, y: p.y, z: p.z + 0.5 }, { goalFn: reachGoal(p, r, bot.dim), range: r });
}

/** Explore the surface: walk ~dist blocks in a slowly drifting direction. */
export function* exploreStep(bot, dist = 40) {
  if (bot.isUnderground()) {
    const ok = yield* toSurface(bot);
    if (!ok) return false;
  }
  bot.mem.heading = (bot.mem.heading ?? rand(0, 360)) + rand(-35, 35);
  if (slip(bot, 0.05)) {
    // wandered off the wrong way
    bot.mem.heading += rand(90, 200);
    journal(bot, "mistake", { kind: "lost" });
    if (chance(0.3)) bot.say("mistake", { kind: "lost" }, { prio: 0 });
  }
  // avoid places where we (or friends) got hurt
  const danger = recallPlace(bot, "danger", bot.dimName, bot.pos);
  if (danger && V.hdist(danger, bot.pos) < 64) bot.mem.heading = (Math.atan2(bot.pos.z - danger.z, bot.pos.x - danger.x) * 180) / Math.PI + rand(-40, 40);
  for (let tries = 0; tries < 4; tries++) {
    const a = (bot.mem.heading * Math.PI) / 180;
    const p = bot.pos;
    const x = Math.floor(p.x + Math.cos(a) * dist);
    const z = Math.floor(p.z + Math.sin(a) * dist);
    const s = surfaceAt(bot.dim, x, z);
    if (!s) {
      dist = Math.max(12, dist / 2);
      continue;
    }
    if (s.water && cfg().boats && hasBoatMaterials(bot) && (bot.mode === "explorer" || chance(0.35))) {
      // look for land on the other side and sail there
      for (let far = dist + 16; far <= 160; far += 16) {
        const lx = Math.floor(p.x + Math.cos(a) * far);
        const lz = Math.floor(p.z + Math.sin(a) * far);
        const land = surfaceAt(bot.dim, lx, lz);
        if (land && !land.water) {
          if (waterAhead(bot, land)) {
            const ok = yield* boatTo(bot, { x: lx + 0.5, y: land.y, z: lz + 0.5 });
            if (ok) return true;
          }
          break;
        }
      }
    }
    if (s.water && chance(0.8)) {
      bot.mem.heading += rand(70, 150);
      continue;
    }
    return yield* goTo(bot, { x: s.x + 0.5, y: s.y, z: s.z + 0.5, surface: true }, { range: 4, timeout: 20 * 45 });
  }
  return false;
}

