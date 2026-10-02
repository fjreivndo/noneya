// Goal planner: recursively figures out how to obtain any item
// (craft -> ingredients, smelt -> input + fuel + furnace, mine -> right tool, kill -> hunt).
import { BlockPermutation } from "@minecraft/server";
import { cfg } from "../config.js";
import { RECIPES, SMELT, SOURCES, FUEL, COOK, FOOD_ANIMALS, logToPlanks, blockInfo, K_WATER } from "../data.js";
import { V, wait, now, prettyItem } from "../util.js";
import { findBlocks, getBlock, isPassable, isStandable, kindAt } from "./world.js";
import { placeBlock, giveItem, mineBlock, reachOf, inReach } from "./actions.js";
import { goNear, exploreStep } from "./movement.js";
import { gatherFromBlocks, oreExpedition, mineAt, scanFor } from "./mining.js";
import { hunt } from "./combat.js";
import { slip, journal } from "./cognition.js";

const PICK_FOR_TIER = { 1: "minecraft:wooden_pickaxe", 2: "minecraft:stone_pickaxe", 3: "minecraft:iron_pickaxe", 4: "minecraft:diamond_pickaxe" };

function methodsFor(item) {
  const out = [];
  if (SOURCES[item]) out.push(...SOURCES[item]);
  if (RECIPES[item]) out.push({ craft: true });
  if (SMELT[item]) out.push({ smelt: item });
  return out;
}

/**
 * Obtain `count` total of item (id or #group). Returns true on success.
 */
export function* acquire(bot, item, count, depth = 0) {
  if (depth > 10) return false;
  let attempts = 0;
  while (bot.inv.count(item) < count) {
    if (attempts++ > 5) return false;
    const need = count - bot.inv.count(item);
    const methods = methodsFor(item);
    if (!methods.length) {
      noteFailure(bot, item, need, depth);
      return false;
    }
    let ok = false;
    for (const m of methods) {
      if (m.craft) ok = yield* craft(bot, item, need, depth);
      else if (m.smelt) ok = yield* smelt(bot, m.smelt, need, depth);
      else if (m.mine) ok = yield* mineFor(bot, item, need, m, depth);
      else if (m.kill) ok = yield* killFor(bot, item, need, m);
      else if (m.special) ok = yield* special(bot, m.special, need, depth);
      if (ok) break;
    }
    if (!ok) {
      noteFailure(bot, item, need, depth);
      return false;
    }
  }
  return true;
}

function noteFailure(bot, item, n, depth) {
  if (item.startsWith("#") && item !== "#logs") return;
  if (!bot.failItem || depth >= bot.failItem.depth) bot.failItem = { item, n, depth };
}

function* mineFor(bot, item, need, m, depth) {
  // make sure we have a good enough tool
  let tier = 0;
  let tool = null;
  for (const t of m.mine) {
    const info = blockInfo(t);
    if (info.tier > tier) {
      tier = info.tier;
      tool = info.tool;
    }
  }
  const needsPick = !m.surface && tool !== "axe" && tool !== "shovel";
  const pickTier = tool === "pickaxe" ? Math.max(1, tier) : needsPick ? 1 : 0;
  if (pickTier > 0 && bot.inv.toolTier("pickaxe") < pickTier) {
    const ok = yield* acquire(bot, PICK_FOR_TIER[pickTier], 1, depth + 1);
    if (!ok) return false;
  }
  m = pickTier > 0 ? { ...m, tool: { kind: "pickaxe", tier: pickTier } } : m;
  // underground trips need some blocks for bridging and lava plugging
  if (!m.surface && bot.inv.buildingCount() < 4 && item !== "minecraft:cobblestone" && item !== "#stone_tool" && item !== "#building") {
    yield* gatherFromBlocks(bot, "#building", 8, { mine: ["minecraft:stone", "minecraft:dirt", "minecraft:grass_block", "minecraft:netherrack", "minecraft:end_stone", "minecraft:deepslate"] }, () => bot.inv.buildingCount());
  }
  return yield* gatherFromBlocks(bot, item, need, m, () => bot.inv.count(item));
}

function* killFor(bot, item, need, m) {
  if (m.dim && bot.dimName !== m.dim) return false;
  return yield* hunt(bot, m.kill, () => bot.inv.count(item), need, { radius: 48, maxIdle: m.night ? 4 : 10 });
}

// ---------------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------------
export function* craft(bot, item, need, depth = 0) {
  const r = RECIPES[item];
  if (!r) return false;
  const times = Math.ceil(need / r.n);
  for (let pass = 0; pass < 3; pass++) {
    for (const [ing, n] of Object.entries(r.needs)) {
      const ok = yield* acquire(bot, ing, n * times, depth + 1);
      if (!ok) return false;
    }
    if (r.table) {
      const ok = yield* ensureStation(bot, "minecraft:crafting_table", depth);
      if (!ok) return false;
    }
    // placing a table may have used planks: re-check
    if (Object.entries(r.needs).every(([ing, n]) => bot.inv.count(ing) >= n * times)) break;
    if (pass === 2) return false;
  }
  bot.setTask(`crafting ${prettyItem(item)}`.toLowerCase());
  const ticks = Math.ceil((10 + 6 * Math.min(times, 8)) / Math.max(0.1, cfg().craftSpeed));
  for (let i = 0; i < ticks; i++) {
    if (i % 8 === 0) bot.swing();
    yield;
  }
  if (!Object.entries(r.needs).every(([ing, n]) => bot.inv.count(ing) >= n * times)) return false;
  if (r.special === "planks") {
    const logs = bot.inv.remove("#logs", times);
    for (const l of logs) giveItem(bot, logToPlanks(l.id), l.n * 4);
  } else {
    for (const [ing, n] of Object.entries(r.needs)) bot.inv.remove(ing, n * times);
    giveItem(bot, item, r.n * times);
  }
  bot.stats.crafted += times;
  // misclicks: occasionally craft something extra and waste the materials
  if (slip(bot, 0.04) && bot.inv.count("#planks") >= 2 && item !== "minecraft:stick") {
    bot.inv.remove("#planks", 2);
    giveItem(bot, "minecraft:stick", 4);
    journal(bot, "mistake", { kind: "craft", what: "planks" });
    bot.say("mistake", { kind: "craft", what: "planks" }, { prio: 0 });
  }
  try {
    bot.dim.playSound("random.click", bot.pos, { volume: 0.3 });
  } catch (e) {
    /* ignore */
  }
  return true;
}

/** Make sure a crafting table / furnace is within reach, placing one if needed. */
export function* ensureStation(bot, id, depth = 0) {
  const near = findBlocks(bot.dim, bot.pos, id === "minecraft:furnace" ? ["minecraft:furnace", "minecraft:lit_furnace"] : [id], { radius: 12, up: 4, down: 4, cap: 10 });
  if (near.length) {
    const p = near[0];
    if (inReach(bot, p)) return true;
    const ok = yield* goNear(bot, p, reachOf() - 0.6);
    if (ok) return true;
  }
  if (!bot.inv.has(id)) {
    const ok = yield* acquire(bot, id, 1, depth + 1);
    if (!ok) return false;
  }
  let spot = findPlaceSpot(bot);
  if (!spot) {
    // cramped (e.g. in a tunnel): carve a slot into the wall at head height
    const f = bot.feetBlock();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const p = { x: f.x + dx, y: f.y + 1, z: f.z + dz };
      if (yield* mineBlock(bot, p)) {
        spot = p;
        break;
      }
    }
  }
  if (!spot) return false;
  const ok = yield* placeBlock(bot, spot, id);
  if (ok) bot.ownBlocks.add(V.key(spot));
  return ok;
}

function findPlaceSpot(bot) {
  const f = bot.feetBlock();
  const grounded = [];
  const floating = [];
  for (const [dx, dz] of [[1, 1], [-1, -1], [1, -1], [-1, 1], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
    for (const dy of [0, 1, -1]) {
      const p = { x: f.x + dx, y: f.y + dy, z: f.z + dz };
      if (!isPassable(bot.dim, p) || bot.occupies(p) || kindAt(bot.dim, p) === K_WATER) continue;
      if (!inReach(bot, p, 0.3)) continue;
      if (isStandable(bot.dim, { x: p.x, y: p.y - 1, z: p.z })) grounded.push(p);
      else floating.push(p); // blocks can float in Bedrock
    }
  }
  return grounded[0] || floating[0];
}

// ---------------------------------------------------------------------------
// Smelting (simulated furnace time, real furnace block)
// ---------------------------------------------------------------------------
export function* smelt(bot, output, need, depth = 0) {
  const input = SMELT[output];
  if (!input) return false;
  let ok = yield* acquire(bot, input, need, depth + 1);
  if (!ok) return false;
  // fuel
  const coalNeeded = Math.ceil(need / FUEL["#coal"]);
  const plankNeeded = Math.ceil(need / FUEL["#planks"]);
  let fuel = null;
  let fuelN = 0;
  if (output !== "minecraft:charcoal" && bot.inv.count("#coal") >= coalNeeded + (bot.reserveCoal ? 2 : 0)) {
    fuel = "#coal";
    fuelN = coalNeeded;
  } else if (bot.inv.count("#planks") >= plankNeeded) {
    fuel = "#planks";
    fuelN = plankNeeded;
  } else if (bot.inv.count("#logs") >= Math.ceil(need / FUEL["#logs"]) + (input === "#logs" ? need : 0)) {
    fuel = "#logs";
    fuelN = Math.ceil(need / FUEL["#logs"]);
  } else {
    ok = yield* acquire(bot, "#planks", plankNeeded, depth + 1);
    if (!ok) return false;
    fuel = "#planks";
    fuelN = plankNeeded;
  }
  ok = yield* ensureStation(bot, "minecraft:furnace", depth);
  if (!ok) return false;
  if (bot.inv.count(input) < need) return false;
  const furnace = findBlocks(bot.dim, bot.pos, ["minecraft:furnace", "minecraft:lit_furnace"], { radius: 6, up: 3, down: 3, cap: 3 })[0];
  bot.setTask(`smelting ${prettyItem(output)}`.toLowerCase());
  bot.inv.remove(input, need);
  bot.inv.remove(fuel, fuelN);
  setFurnaceLit(bot, furnace, true);
  const ticks = Math.ceil((need * 200) / Math.max(0.1, cfg().smeltSpeed));
  for (let i = 0; i < ticks; i++) {
    if (furnace) bot.motor.look = V.center(furnace);
    yield;
  }
  setFurnaceLit(bot, furnace, false);
  giveItem(bot, output, need);
  return true;
}

function setFurnaceLit(bot, p, lit) {
  if (!p) return;
  const b = getBlock(bot.dim, p);
  if (!b || !b.typeId.includes("furnace")) return;
  try {
    const states = b.permutation.getAllStates();
    b.setPermutation(BlockPermutation.resolve(lit ? "minecraft:lit_furnace" : "minecraft:furnace", states));
  } catch (e) {
    /* cosmetic only */
  }
}

// ---------------------------------------------------------------------------
// Food
// ---------------------------------------------------------------------------
/** Get at least `points` of food value, cooking what we hunt. */
export function* getFood(bot, points = 30) {
  bot.setTask("getting food");
  let rounds = 0;
  while (bot.inv.foodPoints() < points && rounds++ < 6) {
    const rawBefore = bot.inv.count("#raw_meat");
    if (rawBefore * 3 + bot.inv.foodPoints() < points) {
      const got = yield* hunt(bot, FOOD_ANIMALS, () => bot.inv.count("#raw_meat"), Math.max(2, Math.ceil((points - bot.inv.foodPoints()) / 7)), { radius: 48, maxIdle: 6 });
      if (!got && bot.inv.count("#raw_meat") === rawBefore) {
        // try apples from leaves as a last resort
        const leaves = scanFor(bot, ["minecraft:oak_leaves", "minecraft:dark_oak_leaves"], { radius: 16, up: 12, down: 4 });
        for (let i = 0; i < Math.min(6, leaves.length); i++) yield* mineAt(bot, leaves[i], { vein: false, timeout: 200 });
        if (bot.inv.foodPoints() === 0) return false;
      }
    }
    yield* cookAll(bot, 0);
  }
  return bot.inv.foodPoints() >= Math.min(points, 12);
}

export function* cookAll(bot, depth) {
  for (const raw of Object.keys(COOK)) {
    const n = bot.inv.count(raw);
    if (n > 0) yield* smelt(bot, COOK[raw], n, depth + 1);
  }
}

// ---------------------------------------------------------------------------
// Special acquisitions
// ---------------------------------------------------------------------------
function* special(bot, kind, need, depth) {
  if (kind === "obsidian") return yield* makeObsidian(bot, need, depth);
  if (kind === "water_bucket") return yield* fillBucket(bot, "water", depth);
  if (kind === "lava_bucket") return yield* fillBucket(bot, "lava", depth);
  return false;
}

function isSource(bot, p) {
  const b = getBlock(bot.dim, p);
  if (!b) return false;
  try {
    return b.permutation.getState("liquid_depth") === 0;
  } catch (e) {
    return false;
  }
}

function* fillBucket(bot, liquid, depth) {
  const ok = yield* acquire(bot, "minecraft:bucket", 1, depth + 1);
  if (!ok) return false;
  bot.setTask(`looking for ${liquid}`);
  for (let tries = 0; tries < 8; tries++) {
    const found = findBlocks(bot.dim, bot.pos, [`minecraft:${liquid}`], { radius: 40, up: 10, down: liquid === "lava" ? 24 : 12, cap: 300 }).filter((p) => isSource(bot, p));
    if (found.length) {
      const p = found[0];
      const ok2 = yield* goNear(bot, p, reachOf() - 0.6);
      if (!ok2) continue;
      bot.motor.look = V.center(p);
      yield* wait(5);
      if (liquid === "lava") {
        try {
          getBlock(bot.dim, p)?.setType("minecraft:air");
        } catch (e) {
          /* ignore */
        }
      }
      bot.inv.remove("minecraft:bucket", 1);
      giveItem(bot, `minecraft:${liquid}_bucket`, 1);
      try {
        bot.dim.playSound(liquid === "lava" ? "bucket.fill_lava" : "bucket.fill_water", bot.pos);
      } catch (e) {
        /* ignore */
      }
      return true;
    }
    yield* exploreStep(bot, 40);
  }
  return false;
}

/** Obsidian: mine natural obsidian, or make it by pouring water onto lava sources. */
export function* makeObsidian(bot, need, depth) {
  let ok = yield* acquire(bot, "minecraft:diamond_pickaxe", 1, depth + 1);
  if (!ok) return false;
  const target = bot.inv.count("minecraft:obsidian") + need;
  const start = now();
  bot.setTask("getting obsidian");
  let lastTick = -1;
  while (bot.inv.count("minecraft:obsidian") < target) {
    if (now() === lastTick) yield;
    lastTick = now();
    if (now() - start > 20 * 60 * 12) return false;
    // natural obsidian first
    const obs = scanFor(bot, ["minecraft:obsidian"], { radius: 20, up: 10, down: 10 });
    if (obs.length) {
      yield* mineAt(bot, obs[0], { vein: false });
      continue;
    }
    if (!bot.inv.has("minecraft:water_bucket")) {
      ok = yield* fillBucket(bot, "water", depth);
      if (!ok) return false;
    }
    const lava = findBlocks(bot.dim, bot.pos, ["minecraft:lava"], { radius: 20, up: 6, down: 12, cap: 200 }).filter((p) => isSource(bot, p));
    if (lava.length) {
      const p = lava[0];
      ok = yield* goNear(bot, p, reachOf() - 0.6);
      if (!ok) {
        bot.blacklist(p, 20 * 120);
        continue;
      }
      // "pour" the water: the lava source turns into obsidian
      bot.motor.look = V.center(p);
      bot.placeAnim();
      yield* wait(6);
      const b = getBlock(bot.dim, p);
      if (b && (b.typeId === "minecraft:lava" || b.typeId === "minecraft:flowing_lava")) {
        try {
          b.setType("minecraft:obsidian");
          bot.dim.playSound("random.fizz", V.center(p));
        } catch (e) {
          /* ignore */
        }
        // convert neighbouring sources too (like spreading water would)
        for (const q of lava.slice(1, 12)) {
          if (V.dist(q, p) < 3 && q.y <= p.y) {
            try {
              getBlock(bot.dim, q)?.setType("minecraft:obsidian");
            } catch (e) {
              /* ignore */
            }
          }
        }
      }
      continue;
    }
    // go deep where lava lakes are common
    yield* oreExpedition(bot, ["minecraft:obsidian"], -54, () => scanFor(bot, ["minecraft:obsidian"], { radius: 12 }).length > 0 || findBlocks(bot.dim, bot.pos, ["minecraft:lava"], { radius: 14, up: 4, down: 8, cap: 5 }).length > 0, 20 * 150);
  }
  return true;
}
