// Mining strategies: mining visible blocks, tree felling, staircases, branch mines, getting back up.
import { cfg } from "../config.js";
import { K_AIR, K_WATER, K_LAVA, K_SOLID, K_HURT } from "../data.js";
import { V, pick, now } from "../util.js";
import { findBlocks, typeAt, kindAt, isPassable, isStandable, skyAbove, surfaceAt, lavaNear } from "./world.js";
import { mineBlock, placeBlock, pillarUp, canDig } from "./actions.js";
import { goTo, steer, reachGoal, exploreStep } from "./movement.js";

const ORE_RE = /_ore$/;

/** Finds the best visible target among block types. */
export function scanFor(bot, types, opts = {}) {
  const honest = cfg().oreVision !== "xray";
  const isOre = types.some((t) => ORE_RE.test(t));
  const found = findBlocks(bot.dim, bot.pos, types, {
    radius: opts.radius ?? 20,
    up: opts.up ?? 10,
    down: opts.down ?? 10,
    exposed: opts.exposed ?? (honest || !isOre),
    reject: (p) => bot.isBlacklisted(p) || !canDig(bot, typeAt(bot.dim, p) ?? "minecraft:air", p),
    cap: 200,
  });
  return found;
}

/** Walk within reach of a block and mine it (plus connected blocks of the same type for ores/logs). */
export function* mineAt(bot, p, opts = {}) {
  const t = typeAt(bot.dim, p);
  if (!t) return false;
  const reach = cfg().reach - 0.5;
  if (V.dist(bot.eye, V.center(p)) > reach) {
    const ok = yield* goTo(bot, { x: p.x + 0.5, y: p.y, z: p.z + 0.5 }, { goalFn: reachGoal(p, reach), range: reach, timeout: opts.timeout ?? 20 * 60 });
    if (!ok) {
      bot.blacklist(p, 20 * 120);
      return false;
    }
  }
  const ok = yield* mineBlock(bot, p);
  if (!ok) {
    bot.blacklist(p, 20 * 300);
    return false;
  }
  // vein / tree follow-up
  if (opts.vein !== false && (ORE_RE.test(t) || /_log$|_stem$/.test(t))) {
    const isLog = /_log$|_stem$/.test(t);
    for (let i = 0; i < (isLog ? 8 : 10); i++) {
      const next = findBlocks(bot.dim, p, [t], { radius: isLog ? 1 : 1, up: isLog ? 6 : 1, down: 1, cap: 12 })
        .filter((q) => !bot.isBlacklisted(q))
        .filter((q) => V.dist(bot.eye, V.center(q)) <= reach + 0.8);
      if (!next.length) break;
      const q = next[0];
      const ok2 = yield* mineBlock(bot, q);
      if (!ok2) {
        bot.blacklist(q, 20 * 120);
        break;
      }
    }
  }
  return true;
}

/** Is the bot below ground? */
export function depthBelowSurface(bot) {
  const p = bot.feetBlock();
  const s = surfaceAt(bot.dim, p.x, p.z);
  if (!s) return 0;
  return s.y - p.y;
}

/** Climb back to the open sky by pillaring (or staircasing if out of blocks). */
export function* toSurface(bot) {
  bot.setTask("heading to the surface");
  for (let i = 0; i < 200; i++) {
    if (skyAbove(bot.dim, bot.pos) || bot.dimName !== "overworld") return true;
    if (bot.inv.buildingCount() > 0) {
      const ok = yield* pillarUp(bot);
      if (!ok) {
        const ok2 = yield* stairStep(bot, +1);
        if (!ok2) return false;
      }
    } else {
      const ok = yield* stairStep(bot, +1);
      if (!ok) return false;
    }
  }
  return skyAbove(bot.dim, bot.pos);
}

function chooseHeading(bot) {
  if (!bot.mem.mineDir) bot.mem.mineDir = pick([{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]);
  return bot.mem.mineDir;
}

function turn(bot) {
  const d = bot.mem.mineDir || { x: 1, z: 0 };
  bot.mem.mineDir = Math.random() < 0.5 ? { x: -d.z, z: d.x } : { x: d.z, z: -d.x };
}

/** One step of a 1-wide staircase. dir=-1 down, +1 up. */
export function* stairStep(bot, dir) {
  const f = bot.feetBlock();
  for (let attempt = 0; attempt < 4; attempt++) {
    const h = chooseHeading(bot);
    const nx = f.x + h.x;
    const nz = f.z + h.z;
    const ny = f.y + dir;
    // blocks to clear: target feet + head, and the gap we pass through
    const clear = dir < 0
      ? [{ x: nx, y: f.y + 1, z: nz }, { x: nx, y: f.y, z: nz }, { x: nx, y: f.y - 1, z: nz }]
      : [{ x: f.x, y: f.y + 2, z: f.z }, { x: nx, y: f.y + 2, z: nz }, { x: nx, y: f.y + 1, z: nz }];
    const floor = { x: nx, y: ny - 1, z: nz };
    let blocked = false;
    for (const c of clear) {
      const k = kindAt(bot.dim, c);
      if (k === K_LAVA) blocked = true;
      else if (k === K_SOLID || k === K_HURT) {
        const t = typeAt(bot.dim, c);
        if (!t || !canDig(bot, t, c)) blocked = true;
      }
      if (!blocked && (k === K_SOLID || k === K_HURT) && lavaNear(bot.dim, c) && !bot.inv.buildingBlock()) blocked = true;
    }
    if (dir < 0 && ny <= bot.dim.heightRange.min + 4) blocked = true;
    if (blocked) {
      turn(bot);
      continue;
    }
    for (const c of clear) {
      if (isPassable(bot.dim, c)) continue;
      const ok = yield* mineBlock(bot, c);
      if (!ok) {
        turn(bot);
        return false;
      }
    }
    // make sure there's a floor
    const fk = kindAt(bot.dim, floor);
    if (fk === K_LAVA || fk === K_AIR || fk === K_WATER) {
      // check how deep the hole is
      let depth = 0;
      while (depth < 5 && isPassable(bot.dim, { x: floor.x, y: floor.y - depth, z: floor.z })) depth++;
      if (fk === K_LAVA || depth >= 3) {
        const ok = yield* placeBlock(bot, floor, undefined, { force: true });
        if (!ok) {
          turn(bot);
          return false;
        }
      }
    }
    const target = { x: nx + 0.5, y: ny, z: nz + 0.5 };
    for (let t = 0; t < 40; t++) {
      const p = bot.pos;
      if (V.hdist(p, target) < 0.35 && Math.abs(p.y - ny) < 0.6) break;
      steer(bot, target, { jump: dir > 0, slow: true });
      yield;
      if (t === 39) return false;
    }
    bot.stepsDug = (bot.stepsDug || 0) + 1;
    return true;
  }
  return false;
}

/** Torch every ~10 blocks underground */
function* maybeTorch(bot) {
  bot.torchCounter = (bot.torchCounter || 0) + 1;
  if (bot.torchCounter < 10 || !bot.inv.has("minecraft:torch")) return;
  const f = bot.feetBlock();
  if (isStandable(bot.dim, { x: f.x, y: f.y - 1, z: f.z }) && kindAt(bot.dim, f) === K_AIR) {
    // place behind us so we don't stand in it
    const h = bot.mem.mineDir || { x: 1, z: 0 };
    const back = { x: f.x - h.x, y: f.y, z: f.z - h.z };
    if (kindAt(bot.dim, back) === K_AIR && isStandable(bot.dim, { x: back.x, y: back.y - 1, z: back.z })) {
      const ok = yield* placeBlock(bot, back, "minecraft:torch");
      if (ok) bot.torchCounter = 0;
    }
  }
}

/** Mine anything valuable we can currently see. Returns number mined. */
export function* mineVisibleOres(bot, types, radius = 7) {
  let n = 0;
  for (let i = 0; i < 6; i++) {
    const found = scanFor(bot, types, { radius, up: 5, down: 5 });
    if (!found.length) break;
    const ok = yield* mineAt(bot, found[0], { timeout: 20 * 25 });
    if (ok) n++;
  }
  return n;
}

const VALUABLE_ORES = [
  "minecraft:diamond_ore", "minecraft:deepslate_diamond_ore", "minecraft:iron_ore", "minecraft:deepslate_iron_ore",
  "minecraft:coal_ore", "minecraft:deepslate_coal_ore", "minecraft:gold_ore", "minecraft:deepslate_gold_ore",
];

/**
 * Go to a Y level and branch-mine, mining the requested ores (plus other useful ores) on the way.
 * Returns when `doneFn()` is true or the budget runs out.
 */
export function* oreExpedition(bot, wantTypes, targetY, doneFn, budgetTicks = 20 * 240) {
  const start = now();
  const extra = VALUABLE_ORES.filter((t) => !wantTypes.includes(t));
  bot.setTask(`mining for ${wantTypes[0].replace("minecraft:", "").replace("_ore", "")}`);
  let steps = 0;
  let lastTick = -1;
  while (now() - start < budgetTicks) {
    if (now() === lastTick) yield;
    lastTick = now();
    if (doneFn()) return true;
    if (bot.inv.toolTier("pickaxe") < 1) return false; // no pickaxe: digging by hand is hopeless
    const y = bot.feetBlock().y;
    // look around every few steps
    if (steps % 3 === 0) {
      const visible = scanFor(bot, wantTypes, { radius: 8, up: 4, down: 4 });
      if (visible.length) {
        yield* mineAt(bot, visible[0], { timeout: 20 * 30 });
        continue;
      }
      if (steps % 6 === 0) yield* mineVisibleOres(bot, extra, 5);
    }
    let ok;
    if (y > targetY + 2) ok = yield* stairStep(bot, -1);
    else if (y < targetY - 6) ok = yield* stairStep(bot, +1);
    else ok = yield* tunnelStep(bot);
    if (!ok) {
      turn(bot);
      bot.failSteps = (bot.failSteps || 0) + 1;
      if (bot.failSteps > 12) {
        bot.failSteps = 0;
        return false;
      }
    } else bot.failSteps = 0;
    steps++;
    if (steps % 32 === 0 && y <= targetY + 2) turn(bot);
    yield* maybeTorch(bot);
    if (!bot.inv.buildingBlock() && bot.inv.freeSlots() === 0) bot.inv.tidy();
  }
  return doneFn();
}

/** Dig 1x2 tunnel forward one block. */
export function* tunnelStep(bot) {
  const f = bot.feetBlock();
  const h = chooseHeading(bot);
  const nx = f.x + h.x;
  const nz = f.z + h.z;
  const feet = { x: nx, y: f.y, z: nz };
  const head = { x: nx, y: f.y + 1, z: nz };
  for (const c of [head, feet]) {
    const k = kindAt(bot.dim, c);
    if (k === K_LAVA) return false;
    if (k === K_SOLID || k === K_HURT) {
      const ok = yield* mineBlock(bot, c);
      if (!ok) return false;
    }
  }
  const floor = { x: nx, y: f.y - 1, z: nz };
  const fk = kindAt(bot.dim, floor);
  if (fk !== K_SOLID && fk !== K_HURT) {
    const ok = yield* placeBlock(bot, floor, undefined, { force: true });
    if (!ok && fk !== K_WATER) return false;
  }
  const target = { x: nx + 0.5, y: f.y, z: nz + 0.5 };
  for (let t = 0; t < 30; t++) {
    if (V.hdist(bot.pos, target) < 0.35) return true;
    steer(bot, target, { slow: true });
    yield;
  }
  return false;
}

/**
 * Collect `need` more of an item from blocks of the given types.
 * method: {mine: types[], y?: preferred Y, surface?: bool}
 */
export function* gatherFromBlocks(bot, item, need, method, countFn) {
  const target = countFn() + need;
  const types = method.mine;
  let idle = 0;
  const start = now();
  bot.setTask(`collecting ${item.replace("minecraft:", "").replace("#", "")}`);
  let lastTick = -1;
  while (countFn() < target) {
    if (now() === lastTick) yield;
    lastTick = now();
    if (now() - start > 20 * 60 * 6) return countFn() > target - need;
    if (method.tool && bot.inv.toolTier(method.tool.kind) < method.tool.tier) return false; // tool broke: re-plan
    const radius = method.surface ? 28 : 18;
    const found = scanFor(bot, types, { radius, up: method.surface ? 20 : 10, down: method.surface ? 12 : 10 });
    if (found.length) {
      idle = 0;
      yield* mineAt(bot, found[0]);
      continue;
    }
    idle++;
    if (idle > 12) return false;
    if (method.surface) {
      yield* exploreStep(bot, 40);
    } else if (method.y !== undefined && method.y !== null) {
      yield* oreExpedition(bot, types, method.y, () => countFn() >= target, 20 * 120);
    } else {
      // e.g. stone: dig down until we hit it
      const y = bot.feetBlock().y;
      yield* oreExpedition(bot, types, y - 10, () => countFn() >= target, 20 * 40);
    }
  }
  return true;
}
