// Primitive actions: mine, place, pillar, eat, attack, shoot.
import { world, EntityDamageCause, ItemStack } from "@minecraft/server";
import { cfg } from "../config.js";
import { blockInfo, canHarvest, kindOf, isReplaceable, K_AIR, K_WATER, K_LAVA, K_SOLID, K_HURT, K_TALL, FOOD, toolInfo } from "../data.js";
import { V, wait, chance, rand, now, safe, debug } from "../util.js";
import { getBlock, typeAt, lavaNear, kindAt } from "./world.js";
import { goTo, faceTowards } from "./movement.js";

const PROTECTED = /chest|barrel|shulker|furnace|crafting_table|bed$|door|sign|banner|glass|wool|carpet|torch|lantern|rail|spawner|portal|frame|beacon|anvil|enchant|brewing|smoker|hopper|dropper|dispenser|lectern|bookshelf|note|jukebox|bell|chain/;

/** May this bot break this block? (only natural blocks, protections respected) */
export function canDig(bot, typeId, p) {
  const c = cfg();
  if (!c.canBreakBlocks) return false;
  const info = blockInfo(typeId);
  if (info.hardness < 0) return false;
  if (PROTECTED.test(typeId)) return !!(bot.ownBlocks && bot.ownBlocks.has(V.key(p)));
  if (!info.natural && !(bot.ownBlocks && bot.ownBlocks.has(V.key(p)))) {
    // things the bot placed itself (pillars, bridges) are fine
    if (!bot.extraDiggable || !bot.extraDiggable.test(typeId)) return false;
  }
  if (info.tier >= 4 && bot.inv.toolTier("pickaxe") < 4 && info.hardness >= 30) return false; // obsidian by hand takes forever
  if (inProtectedZone(bot, p)) return false;
  if (/_log$|_stem$/.test(typeId) && !isTreeLog(bot.dim, p)) return false;
  if (typeId === "minecraft:obsidian" && nextToPortal(bot.dim, p)) return false;
  return true;
}

function nextToPortal(dim, p) {
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const t = typeAt(dim, { x: p.x + dx, y: p.y + dy, z: p.z + dz });
    if (t === "minecraft:portal" || t === "minecraft:end_portal") return true;
  }
  return false;
}

const treeCache = new Map();
/** Logs only count as natural when they belong to a tree (leaves above), so log cabins are safe. */
export function isTreeLog(dim, p) {
  const k = `${dim.id}|${p.x},${p.y},${p.z}`;
  const c = treeCache.get(k);
  if (c !== undefined) return c;
  let res = false;
  let y = p.y;
  for (let i = 0; i < 14; i++) {
    y++;
    const t = typeAt(dim, { x: p.x, y, z: p.z });
    if (!t) break;
    if (/_log$|_stem$/.test(t)) continue;
    if (t.includes("leaves") || t.includes("wart_block") || t === "minecraft:shroomlight") res = true;
    else {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = typeAt(dim, { x: p.x + dx, y: y - 1, z: p.z + dz });
        if (n && (n.includes("leaves") || n.includes("wart_block"))) res = true;
      }
    }
    break;
  }
  if (treeCache.size > 5000) treeCache.clear();
  treeCache.set(k, res);
  return res;
}

export function inProtectedZone(bot, p) {
  const r = cfg().protectSpawnRadius;
  if (!r || bot.dimName !== "overworld") return false;
  try {
    const s = world.getDefaultSpawnLocation();
    return Math.abs(p.x - s.x) <= r && Math.abs(p.z - s.z) <= r;
  } catch (e) {
    return false;
  }
}

function digSound(typeId) {
  const info = blockInfo(typeId);
  if (typeId.includes("leaves") || (typeId.includes("grass") && !typeId.includes("block"))) return "dig.grass";
  if (info.tool === "axe") return "dig.wood";
  if (typeId.includes("sand")) return "dig.sand";
  if (typeId.includes("gravel")) return "dig.gravel";
  if (info.tool === "shovel") return "dig.grass";
  return "dig.stone";
}

/** Gives an item to the bot, dropping it on the ground if the inventory is full. */
export function giveItem(bot, id, n) {
  const left = bot.inv.add(id, n);
  if (left > 0) {
    bot.inv.tidy();
    const left2 = bot.inv.add(id, left);
    if (left2 > 0) {
      try {
        bot.dim.spawnItem(new ItemStack(id, left2), bot.pos);
      } catch (e) {
        /* ignore */
      }
    }
  }
  bot.onGotItem(id, n);
}

/** Survival-like reach (eye to block centre). */
export function reachOf() {
  return Math.max(2.5, Math.min(cfg().reach, 4.5));
}

/**
 * Line of sight from an eye position to a block: the first solid block the ray hits must be the target.
 * Passable targets (crops, grass) only need a clear line.
 */
export function lineOfSight(dim, eye, p) {
  // aim at the centre and at the faces turned towards us, like a player picking a visible face
  const pts = [V.center(p)];
  if (eye.y > p.y + 1) pts.push({ x: p.x + 0.5, y: p.y + 0.98, z: p.z + 0.5 });
  if (eye.y < p.y) pts.push({ x: p.x + 0.5, y: p.y + 0.02, z: p.z + 0.5 });
  if (eye.x < p.x) pts.push({ x: p.x + 0.02, y: p.y + 0.5, z: p.z + 0.5 });
  if (eye.x > p.x + 1) pts.push({ x: p.x + 0.98, y: p.y + 0.5, z: p.z + 0.5 });
  if (eye.z < p.z) pts.push({ x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.02 });
  if (eye.z > p.z + 1) pts.push({ x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.98 });
  for (const pt of pts) if (rayReaches(dim, eye, p, pt)) return true;
  return false;
}

function rayReaches(dim, eye, p, aim) {
  const d = V.sub(aim, eye);
  const dist = V.len(d);
  if (dist < 0.9) return true;
  const t = typeAt(dim, p);
  const k = t ? kindOf(t) : K_AIR;
  const passable = k !== K_SOLID && k !== K_HURT && k !== K_TALL;
  const ec = V.floor(eye);
  const isTarget = (q) => q.x === p.x && q.y === p.y && q.z === p.z;
  const ek = kindAt(dim, ec);
  const eyeBlocked = ek === K_SOLID || ek === K_HURT || ek === K_TALL;
  if (!eyeBlocked) {
    try {
      const hit = dim.getBlockFromRay(eye, V.norm(d), { maxDistance: dist + 0.6, includeLiquidBlocks: false, includePassableBlocks: passable });
      if (!hit) return passable;
      if (isTarget(hit.block)) return true;
      // something solid *behind* an empty/passable target doesn't block the view of it
      return passable && V.dist(eye, V.center(hit.block)) > dist + 0.2;
    } catch (e) {
      /* fall through to stepping */
    }
  }
  // head inside a block (leaves, a fresh spawn) or no raycast: step along the line, ignoring our own cell
  const n = Math.ceil(dist / 0.2);
  for (let i = 1; i <= n + 1; i++) {
    const q = V.floor(V.add(eye, V.scale(d, Math.min(1.02, i / n))));
    if (isTarget(q)) return true;
    if (q.x === ec.x && q.y === ec.y && q.z === ec.z) continue;
    const qk = kindAt(dim, q);
    if (qk === K_SOLID || qk === K_HURT || qk === K_TALL) return false;
  }
  return true;
}

export function inReach(bot, p, extra = 0) {
  return V.dist(bot.eye, V.center(p)) <= reachOf() + extra && lineOfSight(bot.dim, bot.eye, p);
}

/** Breaks a block with the vanilla particles and sound, then removes the vanilla drops (we hand out our own). */
function* breakWithEffects(bot, p) {
  const dim = bot.dim;
  const c = V.center(p);
  const before = new Set(safe(() => dim.getEntities({ type: "minecraft:item", location: c, maxDistance: 2 }).map((e) => e.id), []));
  let ok = safe(() => {
    dim.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`);
    return true;
  }, false);
  if (!ok || typeAt(dim, p) !== "minecraft:air") {
    const b = getBlock(dim, p);
    ok = !!b && safe(() => {
      b.setType("minecraft:air");
      return true;
    }, false);
  }
  if (!ok) return false;
  // vanilla "destroy" drops loot without knowing our tool; swap it for the correct drops
  for (let i = 0; i < 3; i++) {
    for (const e of safe(() => dim.getEntities({ type: "minecraft:item", location: c, maxDistance: 1.6 }), [])) if (!before.has(e.id)) safe(() => e.remove(), null);
    if (i < 2) yield;
  }
  return true;
}

/** Mines one block. The bot must be within reach and able to see it. */
export function* mineBlock(bot, p, opts = {}) {
  const dim = bot.dim;
  let b = getBlock(dim, p);
  if (!b) return false;
  const t = b.typeId;
  const k = kindOf(t);
  if (k === K_AIR && blockInfo(t).hardness !== 0) return true;
  if (k === K_WATER || k === K_LAVA) return true;
  if (t === "minecraft:air" || t === "minecraft:cave_air") return true;
  if (!opts.force && !canDig(bot, t, p)) {
    debug(`${bot.name}: won't dig ${t}`);
    return false;
  }
  if (!inReach(bot, p, 0.4)) {
    debug(`${bot.name}: ${t} at ${p.x} ${p.y} ${p.z} is out of reach or not visible`);
    return false;
  }

  // plug lava next to the block before opening it up
  if (!opts.ignoreLava) {
    const lava = lavaNear(dim, p);
    if (lava) {
      const id = bot.inv.buildingBlock();
      if (!id || V.dist(bot.eye, V.center(lava)) > reachOf() + 0.5) return false;
      const ok = yield* placeBlock(bot, lava, id, { force: true });
      if (!ok) return false;
    }
  }

  const tool = bot.inv.toolFor(t);
  bot.hold(tool);
  const c = V.center(p);
  yield* faceTowards(bot, c);
  const ticks = Math.max(1, Math.ceil(bot.inv.ticksToBreak(t) / Math.max(0.05, cfg().miningSpeed)));
  for (let i = 0; i < ticks; i++) {
    bot.motor.look = c;
    bot.setAction(1);
    if (i % 5 === 0) {
      safe(() => dim.playSound(digSound(t), c, { volume: 0.45, pitch: 0.75 }), null);
    }
    yield;
    if (i % 4 === 0 && typeAt(dim, p) !== t) {
      bot.setAction(0);
      return true;
    }
  }
  b = getBlock(dim, p);
  if (!b || b.typeId !== t) return true;
  let drops = canHarvest(t, tool) ? blockInfo(t).drop() : [];
  if (t === "minecraft:wheat") {
    let growth = 0;
    try {
      growth = Number(b.permutation.getState("growth")) || 0;
    } catch (e) {
      growth = 0;
    }
    drops = growth >= 7 ? [{ id: "minecraft:wheat", n: 1 }, { id: "minecraft:wheat_seeds", n: 1 + Math.floor(Math.random() * 3) }] : [{ id: "minecraft:wheat_seeds", n: 1 }];
  }
  const broke = yield* breakWithEffects(bot, p);
  bot.setAction(0);
  if (!broke) return false;
  if (bot.ownBlocks) bot.ownBlocks.delete(V.key(p));
  for (const d of drops) giveItem(bot, d.id, d.n);
  bot.stats.mined++;
  bot.exhaust(0.005);
  bot.damageTool(tool);
  return true;
}

/** Places a block. opts: perm (BlockPermutation), force (allow over lava / near self, skip sight check), bridge */
export function* placeBlock(bot, p, id, opts = {}) {
  id = id ?? bot.inv.buildingBlock();
  if (!id) return false;
  if (!opts.free && !bot.inv.has(id)) return false;
  const b = getBlock(bot.dim, p);
  if (!b) return false;
  if (!isReplaceable(b.typeId)) return b.typeId === id;
  if (inProtectedZone(bot, p)) return false;
  if (!opts.force && bot.occupies(p)) return false;
  if (V.dist(bot.eye, V.center(p)) > reachOf() + 0.6) return false;
  if (!opts.force && !opts.bridge && !lineOfSight(bot.dim, bot.eye, p)) return false;
  bot.hold(id);
  const c = V.center(p);
  // aim at the face we're placing against
  yield* faceTowards(bot, { x: c.x, y: c.y - 0.4, z: c.z }, 8);
  if (opts.bridge) bot.setSneak(true, 10);
  bot.placeAnim();
  try {
    if (opts.perm) b.setPermutation(opts.perm);
    else b.setType(id);
  } catch (e) {
    return false;
  }
  if (!opts.free) bot.inv.remove(id, 1);
  if (bot.ownBlocks && !opts.permanent) bot.rememberOwnBlock(p);
  safe(() => bot.dim.playSound(id.includes("planks") || id.includes("log") ? "dig.wood" : "dig.stone", c, { volume: 0.7 }), null);
  yield* wait(opts.delay ?? 3);
  return true;
}

/** Jump and place a block underneath. */
export function* pillarUp(bot) {
  const f = bot.feetBlock();
  const above = { x: f.x, y: f.y + 2, z: f.z };
  if (kindAt(bot.dim, above) !== K_AIR && kindAt(bot.dim, above) !== K_WATER) {
    const ok = yield* mineBlock(bot, above);
    if (!ok) return false;
  }
  const id = bot.inv.buildingBlock();
  if (!id) return false;
  bot.hold(id);
  let t = 0;
  bot.motor.jump = true;
  bot.motor.look = { x: f.x + 0.5, y: f.y - 1, z: f.z + 0.5 };
  yield;
  while (bot.pos.y < f.y + 1.02 && t < 10) {
    bot.motor.look = { x: f.x + 0.5, y: f.y - 1, z: f.z + 0.5 };
    yield;
    t++;
  }
  if (bot.pos.y < f.y + 1.0) {
    try {
      bot.entity.teleport({ x: f.x + 0.5, y: f.y + 1.05, z: f.z + 0.5 });
    } catch (e) {
      return false;
    }
  }
  const ok = yield* placeBlock(bot, f, id, { force: true, delay: 3 });
  return ok;
}

/** Eat the best food we carry. */
export function* eat(bot) {
  const food = bot.inv.bestFood();
  if (!food) return false;
  bot.setTask("eating");
  bot.hold(food);
  for (let i = 0; i < 32; i++) {
    bot.setAction(3);
    if (i % 4 === 0) {
      try {
        bot.dim.playSound("random.eat", bot.pos, { volume: 0.5, pitch: rand(0.8, 1.2) });
      } catch (e) {
        /* ignore */
      }
    }
    yield;
  }
  if (bot.inv.remove(food, 1).length === 0) return false;
  const [hunger, sat] = FOOD[food];
  bot.food = Math.min(20, bot.food + hunger);
  bot.sat = Math.min(bot.food, bot.sat + sat);
  try {
    bot.dim.playSound("random.burp", bot.pos, { volume: 0.5 });
  } catch (e) {
    /* ignore */
  }
  return true;
}

/** Instant melee hit. */
export function meleeHit(bot, target) {
  const w = bot.inv.bestWeapon();
  bot.hold(w.id);
  bot.swing();
  let dmg = w.damage;
  const crit = !bot.entity.isOnGround && bot.entity.getVelocity().y < 0;
  if (crit || chance(cfg().skill * 0.15)) dmg *= 1.5;
  if (chance((1 - cfg().skill) * 0.15)) return false; // whiff
  let hit = false;
  try {
    hit = target.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: bot.entity });
  } catch (e) {
    hit = false;
  }
  if (hit) {
    const d = V.norm(V.sub(target.location, bot.pos));
    try {
      target.applyKnockback({ x: d.x * 0.45, z: d.z * 0.45 }, 0.3);
    } catch (e) {
      /* some entities can't be knocked back */
    }
    bot.damageTool(w.id);
  }
  bot.exhaust(0.1);
  return hit;
}

export function attackCooldown(bot) {
  const w = bot.inv.bestWeapon();
  const t = w.id ? toolInfo(w.id) : null;
  const base = !t ? 8 : t.kind === "sword" ? 12 : t.kind === "axe" ? 20 : 16;
  return Math.max(6, Math.round(base - cfg().skill * 3));
}

export function canShoot(bot) {
  return bot.inv.has("minecraft:bow") && bot.inv.has("minecraft:arrow");
}

/** Fires an arrow at a target with ballistic compensation and lead. */
export function shootArrow(bot, target, aimY = 1.0) {
  if (!canShoot(bot)) return false;
  let tp;
  let tv = { x: 0, y: 0, z: 0 };
  try {
    tp = target.location;
    tv = target.getVelocity();
  } catch (e) {
    return false;
  }
  const eye = bot.eye;
  const aim = { x: tp.x, y: tp.y + aimY, z: tp.z };
  const speed = 3.0;
  const dist = V.dist(eye, aim);
  const t = dist / speed;
  aim.x += tv.x * t;
  aim.z += tv.z * t;
  aim.y += tv.y * t * 0.5;
  // gravity 0.05/tick with drag: aim up by the expected drop
  aim.y += 0.5 * 0.05 * t * t * 1.1;
  const skill = cfg().skill;
  const err = (1 - skill) * 0.08;
  let dir = V.norm(V.sub(aim, eye));
  dir = V.norm({ x: dir.x + rand(-err, err), y: dir.y + rand(-err, err), z: dir.z + rand(-err, err) });
  const spawnAt = V.add(eye, V.scale(dir, 1.0));
  try {
    const arrow = bot.dim.spawnEntity("minecraft:arrow", spawnAt);
    const proj = arrow.getComponent("minecraft:projectile");
    if (proj) {
      proj.owner = bot.entity;
      proj.shoot(V.scale(dir, speed), { uncertainty: (1 - skill) * 1.5 });
    } else arrow.applyImpulse(V.scale(dir, speed));
  } catch (e) {
    return false;
  }
  bot.inv.remove("minecraft:arrow", 1);
  try {
    bot.dim.playSound("random.bow", bot.pos, { volume: 0.8, pitch: rand(0.9, 1.2) });
  } catch (e) {
    /* ignore */
  }
  return true;
}

/** Walk over nearby dropped items so the vacuum picks them up. */
export function* collectNearbyItems(bot, radius = 6, maxTicks = 120) {
  let t = 0;
  let lastTick = -1;
  while (t < maxTicks) {
    if (now() === lastTick) yield;
    lastTick = now();
    let items = [];
    try {
      items = bot.dim.getEntities({ type: "minecraft:item", location: bot.pos, maxDistance: radius });
    } catch (e) {
      return;
    }
    if (!items.length) return;
    const it = items[0];
    const start = t;
    const ok = yield* goTo(bot, () => (it.isValid ? it.location : undefined), { range: 0.8, timeout: 60, allowDig: false });
    t += 20;
    if (!ok) return;
    if (t === start) yield;
  }
}
