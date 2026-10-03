// Building: site selection, blueprints (house, tower) and a generic structure builder.
import { kindOf, K_AIR, K_WATER, isReplaceable, matches } from "../data.js";
import { V, wait, chance, now } from "../util.js";
import { getBlock, typeAt, surfaceAt } from "./world.js";
import { mineBlock, placeBlock, canDig, inProtectedZone, reachOf, inReach } from "./actions.js";
import { goTo, reachGoal, goNear } from "./movement.js";
import { acquire } from "./planner.js";
import { slip, journal } from "./cognition.js";
import { placeBed } from "./life.js";
import { toSurface } from "./mining.js";

/** Find a reasonably flat, dry spot of size w x d near the bot. Returns feet-level origin. */
export function findBuildSite(bot, w, d, maxR = 24, center) {
  const p = center || bot.feetBlock();
  let best = null;
  let bestScore = Infinity;
  for (let r = 0; r <= maxR; r += 4) {
    for (let a = 0; a < 8; a++) {
      const ox = p.x + Math.round(Math.cos((a * Math.PI) / 4) * r) - Math.floor(w / 2);
      const oz = p.z + Math.round(Math.sin((a * Math.PI) / 4) * r) - Math.floor(d / 2);
      const hs = [];
      let bad = false;
      for (let x = 0; x < w && !bad; x += 2) {
        for (let z = 0; z < d && !bad; z += 2) {
          const s = surfaceAt(bot.dim, ox + x, oz + z);
          if (!s || s.water || (s.ground && (s.ground.includes("leaves") || s.ground.includes("lava")))) bad = true;
          else hs.push(s.y);
        }
      }
      if (bad || !hs.length) continue;
      const min = Math.min(...hs);
      const max = Math.max(...hs);
      if (max - min > 2) continue;
      if (inProtectedZone(bot, { x: ox, y: min, z: oz }) || inProtectedZone(bot, { x: ox + w, y: min, z: oz + d })) continue;
      const avg = hs.reduce((a2, b) => a2 + b, 0) / hs.length;
      const score = (max - min) * 10 + r;
      if (score < bestScore) {
        bestScore = score;
        best = { x: ox, y: Math.round(avg), z: oz };
      }
    }
    if (best && bestScore < 12) break;
  }
  return best;
}

export const HOUSE_STYLES = ["cottage", "cabin", "stone", "manor"];

/** Pick a house style that fits the bot's personality (remembered so rebuilds match). */
export function houseStyleFor(bot) {
  if (bot.mode === "beat_game" && !bot.mem.flags.beatGame) return "cottage"; // speedrunners don't build manors
  if (!bot.mem.houseStyle) {
    const p = bot.personality;
    bot.mem.houseStyle = (p.builder ?? 0.5) > 0.75 ? "manor" : (p.bravery ?? 0.5) > 0.65 ? "stone" : (p.curiosity ?? 0.5) > 0.6 ? "cabin" : "cottage";
  }
  return bot.mem.houseStyle;
}

/**
 * Houses in a few styles, with a bed, chest, crafting table, furnace, torches and some decoration.
 * cottage: plank walls, log corners, cobble roof · cabin: log walls, plank roof · stone: cobble walls,
 * plank roof · manor: bigger, two-tone walls, glass windows, tall roof.
 */
export function houseBlueprint(style = "cottage") {
  const big = style === "manor";
  const W = big ? 9 : 7;
  const D = 7;
  const H = big ? 4 : 3;
  const wall = { cottage: "#planks", cabin: "#logs", stone: "minecraft:cobblestone", manor: "#planks" }[style] || "#planks";
  const wallAlt = { cottage: "#building", cabin: "#planks", stone: "#building", manor: "#building" }[style];
  const corner = style === "cabin" ? "#logs" : style === "stone" ? "#logs" : "#logs";
  const roof = { cottage: "minecraft:cobblestone", cabin: "#planks", stone: "#planks", manor: "minecraft:cobblestone" }[style];
  const doorX = Math.floor(W / 2);
  const list = [];
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) list.push({ x, y: -1, z, id: "#building", fill: true, phase: 0 });
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = 0; y <= H + 2; y++) list.push({ x, y, z, id: "air", phase: 1 });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const edgeX = x === 0 || x === W - 1;
        const edgeZ = z === 0 || z === D - 1;
        if (!edgeX && !edgeZ) continue;
        const isCorner = edgeX && edgeZ;
        if (z === 0 && x === doorX && y <= 1) continue; // doorway
        const window = y === 1 && !isCorner && ((edgeX && z === 3) || (z === D - 1 && x % 2 === 1) || (big && z === 0 && (x === 2 || x === W - 3)));
        const base = big && y === 0 && !isCorner;
        list.push({ x, y, z, id: isCorner ? corner : window ? "minecraft:glass" : base ? "minecraft:cobblestone" : wall, alt: window ? wall : isCorner ? "#planks" : wallAlt, phase: 2 });
      }
    }
  }
  // roof: a flat layer plus a stepped ridge
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) list.push({ x, y: H, z, id: roof, alt: "#building", phase: 3 });
  for (let x = 1; x < W - 1; x++) for (let z = 1; z < D - 1; z++) list.push({ x, y: H + 1, z, id: roof, alt: "#building", phase: 3 });
  if (big) for (let x = 2; x < W - 2; x++) for (let z = 2; z < D - 2; z++) list.push({ x, y: H + 2, z, id: roof, alt: "#building", phase: 3 });
  // interior
  const fx = W - 2;
  list.push({ x: fx, y: 0, z: 1, id: "minecraft:crafting_table", phase: 4, optional: true });
  list.push({ x: fx, y: 0, z: D - 2, id: "minecraft:furnace", phase: 4, optional: true });
  list.push({ x: 1, y: 0, z: D - 2, id: "minecraft:chest", phase: 4, optional: true });
  list.push({ x: 1, y: 0, z: 2, id: "minecraft:bed", phase: 4, optional: true, bed: true });
  list.push({ x: 1, y: 0, z: 1, id: "minecraft:torch", phase: 4, optional: true });
  list.push({ x: fx, y: 0, z: D - 3, id: "minecraft:torch", phase: 4, optional: true });
  list.push({ x: fx - 1, y: 0, z: D - 2, id: "minecraft:bookshelf", phase: 4, optional: true });
  list.push({ x: doorX - 1, y: 0, z: -1, id: "minecraft:torch", phase: 4, optional: true });
  list.push({ x: doorX + 1, y: 0, z: -1, id: "minecraft:torch", phase: 4, optional: true });
  list.push({ x: doorX + 2, y: 0, z: -1, id: "minecraft:flower_pot", phase: 4, optional: true });
  return { w: W, d: D, list, door: { x: doorX, y: 0, z: 0 }, inside: { x: doorX, y: 0, z: 3 }, chest: { x: 1, y: 0, z: D - 2 }, bed: { x: 1, y: 0, z: 2 } };
}

/** A small lookout tower: 5x5 hollow cobblestone, 8 tall, with crenellations and a torch on top. */
export function towerBlueprint() {
  const list = [];
  const S = 5;
  const H = 8;
  for (let x = 0; x < S; x++) for (let z = 0; z < S; z++) list.push({ x, y: -1, z, id: "#building", fill: true, phase: 0 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < S; x++)
      for (let z = 0; z < S; z++) {
        const edge = x === 0 || z === 0 || x === S - 1 || z === S - 1;
        if (!edge) {
          if (y < H - 1) list.push({ x, y, z, id: "air", phase: 1 });
          continue;
        }
        if (z === 0 && x === 2 && y <= 1) continue; // doorway
        list.push({ x, y, z, id: "minecraft:cobblestone", alt: "#building", phase: 2 });
      }
  for (let x = 1; x < S - 1; x++) for (let z = 1; z < S - 1; z++) list.push({ x, y: H - 1, z, id: "#planks", alt: "#building", phase: 3 });
  for (let x = 0; x < S; x++)
    for (let z = 0; z < S; z++) {
      const edge = x === 0 || z === 0 || x === S - 1 || z === S - 1;
      if (edge && (x + z) % 2 === 0) list.push({ x, y: H, z, id: "minecraft:cobblestone", alt: "#building", phase: 4 });
    }
  list.push({ x: 2, y: H, z: 2, id: "minecraft:torch", phase: 5, optional: true });
  return { w: S, d: S, list, door: { x: 2, y: 0, z: 0 }, inside: { x: 2, y: 0, z: 2 } };
}

/** Count materials (groups resolved by `id`; alt used as fallback). */
export function materialsFor(bp) {
  const need = {};
  for (const b of bp.list) {
    if (b.id === "air" || b.fill || b.optional) continue;
    need[b.id] = (need[b.id] || 0) + 1;
  }
  return need;
}

function resolveMaterial(bot, b) {
  for (const cand of [b.id, b.alt]) {
    if (!cand) continue;
    if (cand.startsWith("#")) {
      const c = bot.inv.firstOf(cand);
      if (c) return c;
    } else if (bot.inv.has(cand)) return cand;
  }
  return undefined;
}

/**
 * Gathers materials, clears the site and builds a blueprint at origin.
 */
export function* buildStructure(bot, origin, bp, label = "building") {
  bot.setTask(label);
  // gather materials first
  const need = materialsFor(bp);
  if (need["#logs"]) need["#logs"] += 0;
  for (const [id, n] of Object.entries(need)) {
    if (id === "minecraft:glass") continue; // optional luxury
    const alt = bp.list.find((b) => b.id === id && b.alt)?.alt;
    if (bot.inv.count(id) + (alt ? bot.inv.count(alt) : 0) >= n) continue;
    bot.setTask(`gathering ${id.replace("minecraft:", "").replace("#", "")} for ${label}`);
    let ok = yield* acquire(bot, id, n);
    if (!ok && alt) ok = yield* acquire(bot, alt, n);
    if (!ok) return false;
  }
  bot.setTask(label);
  if (bot.isUnderground()) yield* toSurface(bot);

  const reach = reachOf() - 0.3;
  const phases = [...new Set(bp.list.map((b) => b.phase))].sort((a, b) => a - b);
  for (const ph of phases) {
    let pending = bp.list.filter((b) => b.phase === ph).map((b) => ({ ...b, p: { x: origin.x + b.x, y: origin.y + b.y, z: origin.z + b.z } }));
    let guard = 0;
    while (pending.length && guard++ < 2000) {
      // nearest first
      pending.sort((a, b) => V.dist2(a.p, bot.pos) - V.dist2(b.p, bot.pos));
      const b = pending.shift();
      const t = typeAt(bot.dim, b.p);
      if (!t) continue;
      if (b.id === "air") {
        const k = kindOf(t);
        if (k === K_AIR || k === K_WATER) continue;
        if (!canDig(bot, t, b.p)) continue;
        if (!inReach(bot, b.p)) {
          const ok = yield* goTo(bot, V.feet(b.p), { goalFn: reachGoal(b.p, reach, bot.dim), timeout: 20 * 20 });
          if (!ok) continue;
        }
        yield* mineBlock(bot, b.p);
        continue;
      }
      if (b.enchantTable) {
        if (isReplaceable(t) && bot.inv.count("minecraft:diamond") >= 2 && bot.inv.count("minecraft:obsidian") >= 4) {
          if (!inReach(bot, b.p, 0.3)) yield* goTo(bot, V.feet(b.p), { goalFn: reachGoal(b.p, reach, bot.dim), timeout: 20 * 20, allowDig: false });
          const blk = getBlock(bot.dim, b.p);
          try {
            blk.setType("minecraft:enchanting_table");
            bot.inv.remove("minecraft:diamond", 2);
            bot.inv.remove("minecraft:obsidian", 4);
            bot.placeAnim();
          } catch (e) {
            /* ignore */
          }
        }
        continue;
      }
      if (b.bed) {
        if (isReplaceable(t) && isReplaceable(typeAt(bot.dim, { x: b.p.x, y: b.p.y, z: b.p.z + 1 }) || "minecraft:stone") && bot.inv.count("#wool") >= 3 && bot.inv.count("#planks") >= 3) {
          if (!inReach(bot, b.p, 0.3)) yield* goTo(bot, V.feet(b.p), { goalFn: reachGoal(b.p, reach, bot.dim), timeout: 20 * 20, allowDig: false });
          bot.placeAnim();
          placeBed(bot, b.p);
          yield* wait(3);
        }
        continue;
      }
      if (b.till || b.needs) {
        // tilling soil, pouring water, planting seeds: uses a tool or item, not a block from the inventory
        if (b.till ? !/grass_block|dirt/.test(t) || /path/.test(t) : t === b.id || !isReplaceable(t)) continue;
        if (b.needs && !bot.inv.has(b.needs)) continue;
        if (V.dist(bot.eye, V.center(b.p)) > reach) {
          const ok = yield* goTo(bot, V.feet(b.p), { goalFn: reachGoal(b.p, reach, bot.dim), timeout: 20 * 20, allowDig: false });
          if (!ok) continue;
        }
        bot.motor.look = V.center(b.p);
        bot.placeAnim();
        const blk = getBlock(bot.dim, b.p);
        if (!blk) continue;
        try {
          blk.setType(b.id);
        } catch (e) {
          continue;
        }
        if (b.needs === "minecraft:water_bucket") {
          bot.inv.remove("minecraft:water_bucket", 1);
          bot.inv.add("minecraft:bucket", 1);
        } else if (b.needs) bot.inv.remove(b.needs, 1);
        yield* wait(2);
        continue;
      }
      if (b.fill) {
        // foundation: only fill holes
        if (!isReplaceable(t)) continue;
      } else if (!isReplaceable(t)) {
        if (b.id.startsWith("#") ? matches(b.id, t) : t === b.id) continue;
        if (canDig(bot, t, b.p) && kindOf(t) !== K_AIR) {
          if (!inReach(bot, b.p)) yield* goTo(bot, V.feet(b.p), { goalFn: reachGoal(b.p, reach, bot.dim), timeout: 20 * 20 });
          yield* mineBlock(bot, b.p);
        } else continue;
      }
      const mat = resolveMaterial(bot, b);
      if (!mat) {
        if (b.optional || b.id === "minecraft:glass") {
          if (b.alt) {
            const m2 = resolveMaterial(bot, { id: b.alt });
            if (m2) pending.push({ ...b, id: b.alt, alt: undefined });
          }
          continue;
        }
        const ok = yield* acquire(bot, b.id, 4);
        if (!ok) return false;
        pending.push(b);
        continue;
      }
      if (!inReach(bot, b.p, 0.3) || bot.occupies(b.p)) {
        const ok = yield* goTo(bot, V.feet(b.p), { goalFn: reachGoal(b.p, reach, bot.dim), timeout: 20 * 20, allowDig: false });
        if (!ok) {
          b.tries = (b.tries || 0) + 1;
          if (b.tries < 3) pending.push(b);
          continue;
        }
      }
      if (bot.occupies(b.p)) {
        b.tries = (b.tries || 0) + 1;
        if (b.tries < 4) pending.push(b);
        continue;
      }
      // people misplace blocks; sometimes they notice and fix it, sometimes the house just ends up a bit wonky
      if (!b.fill && slip(bot, 0.006)) {
        const wrong = bot.inv.buildingBlock();
        if (wrong && wrong !== mat && (yield* placeBlock(bot, b.p, wrong, { permanent: true, delay: 3 }))) {
          journal(bot, "mistake", { kind: "build" });
          if (chance(0.55)) {
            yield* wait(20);
            if ((bot.cooldowns.buildOops || 0) < now()) {
              bot.cooldowns.buildOops = now() + 20 * 300;
              bot.say("mistake", { kind: "build" }, { prio: 0 });
            }
            bot.rememberOwnBlock(b.p);
            yield* mineBlock(bot, b.p);
            pending.push(b);
          }
          continue;
        }
      }
      const ok = yield* placeBlock(bot, b.p, mat, { permanent: true, delay: 3 });
      if (!ok) {
        b.tries = (b.tries || 0) + 1;
        if (b.tries < 3) pending.push(b);
      }
    }
  }
  return true;
}

export function* buildHouse(bot) {
  if (bot.dimName !== "overworld") return false;
  const bp = houseBlueprint(houseStyleFor(bot));
  if (bot.isUnderground()) yield* toSurface(bot);
  const site = findBuildSite(bot, bp.w + 2, bp.d + 2, 32);
  if (!site) return false;
  const origin = { x: site.x + 1, y: site.y, z: site.z + 1 };
  bot.say("build_start");
  const ok = yield* buildStructure(bot, origin, bp, "building a house");
  if (!ok) return false;
  bot.mem.home = {
    x: origin.x + bp.inside.x, y: origin.y, z: origin.z + bp.inside.z, dim: "overworld",
    chest: { x: origin.x + bp.chest.x, y: origin.y + bp.chest.y, z: origin.z + bp.chest.z },
    bed: { x: origin.x + bp.bed.x, y: origin.y, z: origin.z + bp.bed.z },
  };
  bot.save();
  bot.say("build_done");
  bot.announce("built a house");
  return true;
}

export function* buildTower(bot) {
  if (bot.dimName !== "overworld") return false;
  const bp = towerBlueprint();
  const site = findBuildSite(bot, bp.w + 2, bp.d + 2, 28);
  if (!site) return false;
  bot.say("build_start");
  const ok = yield* buildStructure(bot, { x: site.x + 1, y: site.y, z: site.z + 1 }, bp, "building a tower");
  if (ok) bot.say("build_done");
  return ok;
}

/** Put spare items in the home chest. */
export function* storeItems(bot) {
  const home = bot.mem.home;
  if (!home || !home.chest || bot.dimName !== "overworld") return false;
  const ok = yield* goNear(bot, home.chest, reachOf() - 0.6);
  if (!ok) return false;
  const b = getBlock(bot.dim, home.chest);
  if (!b || b.typeId !== "minecraft:chest") return false;
  const inv = b.getComponent("minecraft:inventory");
  const chest = inv && inv.container;
  if (!chest) return false;
  bot.setTask("storing items");
  const KEEP = /pickaxe|_axe|sword|shovel|bow|arrow|shield|bucket|flint_and_steel|torch|crafting_table|furnace|ender_eye|ender_pearl|blaze|helmet|chestplate|leggings|boots/;
  const items = bot.inv.items();
  let moved = 0;
  for (const { slot, item } of items) {
    const id = item.typeId;
    if (KEEP.test(id)) continue;
    if (bot.isFood(id) && bot.inv.foodPoints() < 40) continue;
    if (matches("#building", id) && bot.inv.count("#building") <= 64) continue;
    if (id === "minecraft:iron_ingot" || id === "minecraft:diamond" || id === "minecraft:obsidian" || id === "minecraft:coal") continue;
    const rest = chest.addItem(item);
    bot.inv.container.setItem(slot, rest);
    moved++;
    if (moved % 3 === 0) yield;
  }
  try {
    bot.dim.playSound("random.chestopen", V.center(home.chest));
  } catch (e) {
    /* ignore */
  }
  yield* wait(10);
  return true;
}
