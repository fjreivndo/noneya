// Decision making: milestone plans per personality, survival needs, free-will activities, player orders.
import { world } from "@minecraft/server";
import { cfg } from "../config.js";
import { V, wait, now, rand, pick, chance, isNight } from "../util.js";
import { surfaceAt, typeAt } from "./world.js";
import { goTo, steer, exploreStep, goNear } from "./movement.js";
import { acquire, getFood, cookAll } from "./planner.js";
import { buildHouse, buildTower, storeItems, buildStructure, houseBlueprint, houseStyleFor } from "./build.js";
import { oreExpedition, toSurface, mineAt, scanFor } from "./mining.js";
import { placeBlock, mineBlock, eat } from "./actions.js";
import { townOf, buildHouseOnPlot, workOnProject, nextProject, placeTownSign } from "./town.js";
import { religionOf, hasTenet, isHolyDay, obeys, pray } from "./religion.js";
import { askForHelp } from "./social.js";
import { sleepInBed, fish, canBreed, breedAnimals, canEnchant, enchant, placeBed } from "./life.js";
import { wantsVillagerTrade, tradeWithVillagers } from "./trade.js";
import { raid } from "./politics.js";
import {
  enterNether, returnToOverworld, buildNetherPortal, getBlazeRods, getPearls, findStronghold, dragonFight,
} from "./progression.js";

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------
const DIAMOND_ORES = ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"];

function* acquireAll(bot, list) {
  for (const [id, n] of list) {
    if (bot.inv.count(id) >= n) continue;
    const ok = yield* acquire(bot, id, n);
    if (!ok) return false;
    bot.equipBest();
  }
  return true;
}

function armorMissing(bot, material) {
  const out = [];
  for (const piece of ["chestplate", "leggings", "helmet", "boots"]) {
    const id = `minecraft:${material}_${piece}`;
    const slot = { helmet: "slot.armor.head", chestplate: "slot.armor.chest", leggings: "slot.armor.legs", boots: "slot.armor.feet" }[piece];
    const worn = bot.worn[slot];
    const rank = (w) => (!w ? 0 : w.includes("netherite") ? 5 : w.includes("diamond") ? 4 : w.includes("iron") ? 3 : 1);
    const want = material === "diamond" ? 4 : 3;
    if (rank(worn) < want && !bot.inv.has(id)) out.push([id, 1]);
  }
  return out;
}

const eyeCount = (b) => b.inv.count("minecraft:ender_eye");
const portalFound = (b) => !!b.mem.endPortal || b.dimName === "the_end" || !!b.mem.flags.beatGame;
const rodEquivalent = (b) => b.inv.count("minecraft:blaze_rod") + b.inv.count("minecraft:blaze_powder") / 2 + eyeCount(b) / 2;

export const MILESTONES = {
  wood: {
    label: "getting wood",
    done: (b) => b.inv.count("#logs") * 4 + b.inv.count("#planks") >= 16 || b.inv.toolTier("pickaxe") >= 1,
    run: (b) => acquire(b, "#logs", 5),
  },
  wooden_pickaxe: {
    label: "making a wooden pickaxe",
    done: (b) => b.inv.toolTier("pickaxe") >= 1,
    run: (b) => acquire(b, "minecraft:wooden_pickaxe", 1),
  },
  stone_tools: {
    label: "making stone tools",
    done: (b) => b.inv.toolTier("pickaxe") >= 2 && b.inv.bestWeapon().damage >= 5,
    run: (b) => acquireAll(b, [["minecraft:stone_pickaxe", 1], ["minecraft:stone_sword", 1], ["minecraft:stone_axe", 1]]),
  },
  food_supply: {
    label: "getting food",
    done: (b) => b.inv.foodPoints() >= 16,
    run: (b) => getFood(b, 36),
  },
  house: {
    label: "building a home",
    want: (b) => cfg().buildHouses && (b.mode === "builder" || b.mode === "survivor" || b.personality.builder > 0.55),
    done: (b) => !!b.mem.home,
    run: (b) => (townOf(b) ? buildHouseOnPlot(b, townOf(b)) : buildHouse(b)),
  },
  iron_pickaxe: {
    label: "getting an iron pickaxe",
    done: (b) => b.inv.toolTier("pickaxe") >= 3,
    run: (b) => acquire(b, "minecraft:iron_pickaxe", 1),
  },
  iron_sword: {
    label: "getting an iron sword",
    done: (b) => b.inv.bestWeapon().damage >= 6,
    run: (b) => acquire(b, "minecraft:iron_sword", 1),
  },
  torches: {
    label: "making torches",
    done: (b) => b.inv.count("minecraft:torch") >= 12,
    run: (b) => acquire(b, "minecraft:torch", 24),
  },
  iron_armor: {
    label: "making iron armor",
    done: (b) => armorMissing(b, "iron").length === 0,
    run: (b) => acquireAll(b, armorMissing(b, "iron")),
  },
  diamond_pickaxe: {
    label: "getting a diamond pickaxe",
    done: (b) => b.inv.toolTier("pickaxe") >= 4,
    run: (b) => acquire(b, "minecraft:diamond_pickaxe", 1),
  },
  diamond_sword: {
    label: "getting a diamond sword",
    done: (b) => b.inv.bestWeapon().damage >= 7,
    run: (b) => acquire(b, "minecraft:diamond_sword", 1),
  },
  diamond_armor: {
    label: "making diamond armor",
    done: (b) => armorMissing(b, "diamond").length === 0,
    run: (b) => acquireAll(b, armorMissing(b, "diamond")),
  },
  bow_arrows: {
    label: "making a bow and arrows",
    done: (b) => b.inv.has("minecraft:bow") && b.inv.count("minecraft:arrow") >= 16,
    run: (b) => acquireAll(b, [["minecraft:bow", 1], ["minecraft:arrow", 32]]),
  },
  nether_portal: {
    label: "building a nether portal",
    done: (b) => !!(b.mem.portal && b.mem.portal.ow) || b.dimName === "nether" || portalFound(b),
    run: (b) => buildNetherPortal(b),
  },
  blaze_rods: {
    label: "collecting blaze rods",
    dim: "nether",
    ready: (b) => !!(b.mem.portal && b.mem.portal.ow) || b.dimName === "nether",
    done: (b) => rodEquivalent(b) >= 7 || portalFound(b),
    run: (b) => getBlazeRods(b, Math.ceil(7 - rodEquivalent(b))),
  },
  pearls: {
    label: "collecting ender pearls",
    done: (b) => b.inv.count("minecraft:ender_pearl") + eyeCount(b) >= 12 || portalFound(b),
    run: (b) => getPearls(b, 12 - b.inv.count("minecraft:ender_pearl") - eyeCount(b)),
  },
  eyes: {
    label: "crafting eyes of ender",
    done: (b) => eyeCount(b) >= 12 || portalFound(b),
    run: (b) => acquire(b, "minecraft:ender_eye", 12),
  },
  end_prep: {
    label: "preparing for the End",
    ready: (b) => eyeCount(b) >= 12 || !!b.mem.endPortal,
    dim: "overworld",
    done: (b) => b.inv.buildingCount() >= 64 && b.inv.foodPoints() >= 40,
    run: function* (b) {
      if (b.inv.buildingCount() < 64) yield* acquire(b, "#building", 96);
      if (b.inv.foodPoints() < 40) yield* getFood(b, 60);
      return b.inv.buildingCount() >= 48;
    },
  },
  stronghold: {
    label: "finding the stronghold",
    ready: (b) => eyeCount(b) >= 12 || !!b.mem.endPortal,
    done: (b) => b.dimName === "the_end" || !!(b.mem.endPortal && typeAt(b.dim, b.mem.endPortal) === "minecraft:end_portal"),
    run: (b) => findStronghold(b),
  },
  dragon: {
    label: "killing the Ender Dragon",
    ready: (b) => b.dimName === "the_end" || !!b.mem.endPortal,
    done: (b) => !!b.mem.flags.beatGame,
    run: (b) => dragonFight(b),
  },
};

const PLANS = {
  beat_game: [
    "wood", "wooden_pickaxe", "stone_tools", "food_supply", "house", "iron_pickaxe", "iron_sword", "torches", "iron_armor",
    "diamond_pickaxe", "diamond_sword", "bow_arrows", "nether_portal", "blaze_rods", "pearls", "eyes", "end_prep", "stronghold", "dragon",
  ],
  survivor: ["wood", "wooden_pickaxe", "stone_tools", "food_supply", "house", "iron_pickaxe", "iron_sword", "torches", "iron_armor", "diamond_pickaxe", "diamond_sword", "diamond_armor"],
  builder: ["wood", "wooden_pickaxe", "stone_tools", "food_supply", "house", "iron_pickaxe", "torches"],
  explorer: ["wood", "wooden_pickaxe", "stone_tools", "food_supply", "iron_pickaxe", "iron_sword", "iron_armor", "bow_arrows"],
  free: [],
};

export function planFor(bot) {
  return PLANS[bot.mode] || PLANS.free;
}

export function nextMilestone(bot) {
  for (const id of planFor(bot)) {
    const ms = MILESTONES[id];
    if (ms.want && !ms.want(bot)) continue;
    if (ms.done(bot)) continue;
    if (ms.ready && !ms.ready(bot)) continue;
    if ((bot.cooldowns[id] || 0) > now()) continue;
    return id;
  }
  return null;
}

export function progressText(bot) {
  const plan = planFor(bot);
  if (!plan.length) return bot.mem.flags.beatGame ? "beat the game - living freely" : "living freely";
  const done = plan.filter((id) => MILESTONES[id].done(bot) || (MILESTONES[id].want && !MILESTONES[id].want(bot))).length;
  return `${done}/${plan.length} milestones`;
}

function* runMilestone(bot, id) {
  const ms = MILESTONES[id];
  bot.currentMs = id;
  bot.mem.msTime = bot.mem.msTime || {};
  bot.msTicks = bot.mem.msTime[id] || 0;
  bot.setTask(ms.label);
  if (ms.dim === "nether" && bot.dimName !== "nether") {
    const ok = yield* enterNether(bot);
    if (!ok) return false;
  } else if (ms.dim === "overworld" && bot.dimName === "nether") {
    const ok = yield* returnToOverworld(bot);
    if (!ok) return false;
  } else if (!ms.dim && bot.dimName === "nether" && !["pearls", "blaze_rods"].includes(id)) {
    const ok = yield* returnToOverworld(bot);
    if (!ok) return false;
  }
  const ok = yield* ms.run(bot);
  bot.mem.msTime[id] = bot.msTicks;
  return ok && ms.done(bot);
}

// ---------------------------------------------------------------------------
// Free-will activities
// ---------------------------------------------------------------------------
function* explore(bot) {
  bot.setTask("exploring");
  for (let i = 0; i < randIntLocal(2, 5); i++) {
    yield* exploreStep(bot, 48);
    // pick up interesting things on the way
    if (chance(0.3)) {
      const logs = scanFor(bot, ["minecraft:oak_log", "minecraft:birch_log", "minecraft:spruce_log"], { radius: 10, up: 6, down: 3 });
      if (logs.length && bot.inv.count("#logs") < 32) yield* mineAt(bot, logs[0]);
    }
  }
  return true;
}

function randIntLocal(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

function* mineTrip(bot) {
  if (bot.dimName !== "overworld") return false;
  if (bot.inv.toolTier("pickaxe") < 2) return false;
  const tier = bot.inv.toolTier("pickaxe");
  const ores = tier >= 3 ? DIAMOND_ORES : ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"];
  const y = tier >= 3 ? -54 : 16;
  const before = bot.inv.count(tier >= 3 ? "minecraft:diamond" : "minecraft:raw_iron");
  yield* oreExpedition(bot, ores, y, () => bot.inv.count(tier >= 3 ? "minecraft:diamond" : "minecraft:raw_iron") >= before + 5, 20 * 150);
  yield* toSurface(bot);
  return true;
}

function* idle(bot) {
  bot.setTask(pick(["chilling", "looking around", "afk", "thinking"]));
  const center = bot.mem.home && bot.dimName === "overworld" && V.dist(bot.mem.home, bot.pos) < 40 ? bot.mem.home : bot.pos;
  for (let i = 0; i < randIntLocal(2, 4); i++) {
    const p = { x: center.x + rand(-8, 8), y: center.y, z: center.z + rand(-8, 8) };
    const s = surfaceAt(bot.dim, Math.floor(p.x), Math.floor(p.z));
    if (s && !s.water && Math.abs(s.y - bot.pos.y) < 6) yield* goTo(bot, { x: s.x + 0.5, y: s.y, z: s.z + 0.5 }, { range: 1.5, timeout: 200, allowDig: false, allowPlace: false });
    for (let t = 0; t < randIntLocal(40, 120); t++) {
      if (t % 30 === 0) {
        const pl = world.getAllPlayers().find((pp) => pp.dimension.id === bot.dim.id && V.dist(pp.location, bot.pos) < 10);
        if (pl) bot.motor.look = pl.getHeadLocation();
      }
      yield;
    }
  }
  if (chance(0.15 * cfg().chatFrequency)) bot.say("bored");
  return true;
}

function* socialize(bot) {
  const players = world.getAllPlayers().filter((p) => p.dimension.id === bot.dim.id && V.dist(p.location, bot.pos) < 96);
  if (!players.length) return false;
  const p = pick(players);
  bot.setTask(`hanging out with ${p.name}`);
  const ok = yield* goTo(bot, () => (p.isValid ? p.location : undefined), { range: 3.5, timeout: 20 * 40 });
  if (!ok) return false;
  bot.chat(pick([`hey ${p.name}`, `${p.name} what are you doing`, `nice base ${p.name}`, `wanna team ${p.name}?`, `hi ${p.name}!`]));
  for (let t = 0; t < 20 * 20 && p.isValid; t++) {
    const d = V.dist(p.location, bot.pos);
    if (d > 6) steer(bot, p.location, { sprint: d > 10 });
    else bot.motor.look = p.getHeadLocation();
    if (t % 60 === 30 && chance(0.2)) bot.motor.jump = true; // say hi by jumping
    yield;
  }
  return true;
}

function* shelterForNight(bot) {
  bot.say("night");
  if (bot.mem.bed && bot.dimName === "overworld" && V.dist(bot.mem.bed, bot.pos) < 120) {
    const slept = yield* sleepInBed(bot);
    if (slept) {
      bot.say("morning");
      return true;
    }
  }
  const home = bot.mem.home;
  if (home && bot.dimName === "overworld" && V.dist(home, bot.pos) < 120) {
    bot.setTask("going home for the night");
    const ok = yield* goTo(bot, { x: home.x + 0.5, y: home.y, z: home.z + 0.5 }, { range: 1.5, timeout: 20 * 120 });
    if (ok) {
      bot.setTask("sleeping");
      while (isNight()) {
        yield* wait(20);
      }
      bot.say("morning");
      return true;
    }
  }
  // dig a quick hole and cover it
  bot.setTask("hiding for the night");
  const f = bot.feetBlock();
  for (const y of [f.y - 1, f.y - 2]) {
    const ok = yield* mineBlock(bot, { x: f.x, y, z: f.z });
    if (!ok) return false;
    yield* wait(8);
  }
  const nf = bot.feetBlock();
  yield* placeBlock(bot, { x: nf.x, y: nf.y + 2, z: nf.z }, undefined, { force: true });
  while (isNight()) {
    yield* wait(20);
    if (bot.food < 14 && bot.inv.bestFood()) yield* eat(bot);
  }
  yield* mineBlock(bot, { x: nf.x, y: nf.y + 2, z: nf.z });
  bot.say("morning");
  return true;
}

function* plantTrees(bot) {
  const sap = bot.inv.firstOf("minecraft:oak_sapling") || bot.inv.items().find((i) => i.item.typeId.endsWith("_sapling"))?.item.typeId;
  if (!sap) return false;
  bot.setTask("planting trees");
  for (let i = 0; i < Math.min(4, bot.inv.count(sap)); i++) {
    const p = bot.pos;
    const x = Math.floor(p.x + rand(-8, 8));
    const z = Math.floor(p.z + rand(-8, 8));
    const s = surfaceAt(bot.dim, x, z);
    if (!s || s.water || !(s.ground.includes("grass") || s.ground.includes("dirt"))) continue;
    yield* goNear(bot, { x, y: s.y, z }, 3.5);
    yield* placeBlock(bot, { x, y: s.y, z }, sap, { permanent: true });
  }
  return true;
}

function* townWork(bot) {
  const town = townOf(bot);
  if (!town || !nextProject(town)) return false;
  placeTownSign(bot, town);
  return yield* workOnProject(bot, town);
}

function* moveIntoTown(bot) {
  const town = townOf(bot);
  if (!town) return false;
  return yield* buildHouseOnPlot(bot, town);
}

/** Harvest ripe wheat on the town farm and replant it. */
function* harvestFarm(bot) {
  const town = townOf(bot);
  const farm = town && town.built.find((b) => b.type === "farm");
  if (!farm || bot.dimName !== "overworld") return false;
  bot.setTask("harvesting wheat");
  yield* goTo(bot, { x: farm.x + 0.5, y: farm.y, z: farm.z + 0.5 }, { range: 6, timeout: 20 * 90 });
  const wheat = scanFor(bot, ["minecraft:wheat"], { radius: 8, up: 2, down: 2 }).filter((p) => {
    try {
      const b = bot.dim.getBlock(p);
      return b && b.permutation.getState("growth") >= 7;
    } catch (e) {
      return false;
    }
  });
  for (const p of wheat.slice(0, 20)) {
    yield* mineAt(bot, p, { vein: false, timeout: 100 });
    if (bot.inv.has("minecraft:wheat_seeds") && typeAt(bot.dim, { x: p.x, y: p.y - 1, z: p.z }) === "minecraft:farmland") {
      const ok = yield* placeBlock(bot, p, "minecraft:wheat", { free: true, permanent: true });
      if (ok) bot.inv.remove("minecraft:wheat_seeds", 1);
    }
  }
  if (bot.inv.count("minecraft:wheat") >= 3) yield* acquire(bot, "minecraft:bread", Math.floor(bot.inv.count("minecraft:wheat") / 3));
  return true;
}

/** Get wool and put a bed in our house. */
function* furnishBed(bot) {
  const spot = bot.mem.home && bot.mem.home.bed;
  if (!spot || bot.dimName !== "overworld") return false;
  bot.setTask("getting a bed");
  if (bot.inv.count("#wool") < 3) {
    const ok = yield* acquire(bot, "#wool", 3);
    if (!ok) return false;
  }
  if (bot.inv.count("#planks") < 3) yield* acquire(bot, "#planks", 3);
  const ok = yield* goTo(bot, { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 }, { range: 3, timeout: 20 * 120 });
  if (!ok) return false;
  bot.placeAnim();
  return placeBed(bot, spot);
}

const FREE = [
  { id: "explore", w: (b) => 0.6 + b.personality.curiosity * 2 + (b.mode === "explorer" ? 2.5 : 0), run: explore },
  { id: "house", w: (b) => (cfg().buildHouses && !b.mem.home && b.dimName === "overworld" ? 1.5 + b.personality.builder * 2 : 0), run: buildHouse },
  { id: "tower", w: (b) => (cfg().buildHouses && b.mem.home && b.dimName === "overworld" ? b.personality.builder * 1.2 + (b.mode === "builder" ? 2 : 0) : 0), run: buildTower },
  { id: "mine", w: (b) => (b.dimName === "overworld" ? 0.6 + b.personality.ambition * 1.5 : 0), run: mineTrip },
  { id: "hunt", w: (b) => (b.inv.foodPoints() < 30 ? 1.5 : 0.2), run: (b) => getFood(b, 40) },
  { id: "social", w: (b) => (world.getAllPlayers().length ? b.personality.sociability * 1.5 : 0), run: socialize },
  { id: "store", w: (b) => (b.mem.home && b.inv.freeSlots() < 10 ? 2.5 : 0), run: storeItems },
  { id: "plant", w: (b) => (b.inv.items().some((i) => i.item.typeId.endsWith("_sapling")) ? 0.4 : 0), run: plantTrees },
  { id: "diamond_gear", w: (b) => (b.mode === "free" && !MILESTONES.diamond_armor.done(b) ? 0.6 * b.personality.ambition : 0), run: (b) => runMilestone(b, "diamond_armor") },
  { id: "town_work", w: (b) => (townOf(b) && nextProject(townOf(b)) ? 1 + b.personality.builder * 2 + b.personality.sociability : 0), run: townWork },
  { id: "move_in", w: (b) => (townOf(b) && !townOf(b).plots.some((p) => p.owner === b.id && p.built) ? 2.5 : 0), run: moveIntoTown },
  { id: "harvest", w: (b) => (townOf(b) && townOf(b).built.some((x) => x.type === "farm") ? 0.8 + (b.inv.foodPoints() < 30 ? 1.5 : 0) : 0), run: harvestFarm },
  { id: "fish", w: (b) => (b.dimName === "overworld" ? 0.3 + (b.personality.curiosity < 0.4 ? 0.4 : 0) + (b.inv.foodPoints() < 30 ? 0.5 : 0) : 0), run: fish },
  { id: "breed", w: (b) => (canBreed(b) ? 0.8 : 0), run: breedAnimals },
  { id: "enchant", w: (b) => (canEnchant(b) ? 2 : 0), run: enchant },
  { id: "villagers", w: (b) => (wantsVillagerTrade(b) ? 1.2 : 0), run: tradeWithVillagers },
  { id: "bed", w: (b) => (b.mem.home && b.mem.home.bed && !b.mem.bed ? 1.2 : 0), run: furnishBed },
  { id: "raid", w: (b) => (cfg().townWars && b.mem.town && (b.personality.bravery ?? 0.5) > 0.6 ? 0.4 : 0), run: raid },
  { id: "idle", w: () => 0.5, run: idle },
];

function pickFree(bot) {
  const scored = FREE.map((a) => ({ a, w: Math.max(0, a.w(bot)) * rand(0.6, 1.4) })).filter((x) => x.w > 0);
  let total = scored.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of scored) {
    r -= x.w;
    if (r <= 0) return x.a;
  }
  return FREE[FREE.length - 1];
}

// ---------------------------------------------------------------------------
// Orders from players
// ---------------------------------------------------------------------------
function* followOrder(bot, order) {
  for (;;) {
    /** @type {any} */
    const p = world.getEntity(order.player);
    if (!p || !p.isValid) {
      bot.order = null;
      return true;
    }
    if (p.dimension.id !== bot.dim.id) {
      bot.setTask(`waiting for ${p.name}`);
      yield* wait(20);
      continue;
    }
    bot.setTask(`following ${p.name}`);
    const d = V.dist(p.location, bot.pos);
    if (d > 96 && cfg().stuckTeleport) {
      try {
        bot.entity.teleport(p.location);
      } catch (e) {
        /* ignore */
      }
    } else if (d > 4) yield* goTo(bot, () => (p.isValid ? p.location : undefined), { range: 2.5, timeout: 60, sprint: d > 8 });
    else {
      bot.motor.look = p.getHeadLocation();
      yield;
    }
    if (bot.order !== order) return true;
  }
}

function* stayOrder(bot, order) {
  bot.setTask("waiting here");
  for (;;) {
    if (bot.order !== order) return true;
    if (V.dist(order.pos, bot.pos) > 2) yield* goTo(bot, order.pos, { range: 1, timeout: 200 });
    yield* wait(10);
  }
}

function* homeOrder(bot) {
  const home = bot.mem.home;
  if (!home) {
    bot.order = null;
    return false;
  }
  if (bot.dimName !== "overworld") yield* returnToOverworld(bot);
  bot.setTask("going home");
  yield* goTo(bot, { x: home.x + 0.5, y: home.y, z: home.z + 0.5 }, { range: 1.5, timeout: 20 * 300 });
  bot.order = null;
  return true;
}

function* buildHereOrder(bot, order) {
  const bp = houseBlueprint(houseStyleFor(bot));
  const ok = yield* buildStructure(bot, { x: order.pos.x - 3, y: order.pos.y, z: order.pos.z - 3 }, bp, "building a house (requested)");
  if (ok) {
    bot.mem.home = { x: order.pos.x, y: order.pos.y, z: order.pos.z, dim: "overworld", chest: { x: order.pos.x - 2, y: order.pos.y, z: order.pos.z + 2 } };
    bot.save();
    bot.say("build_done");
  }
  bot.order = null;
  return ok;
}

// ---------------------------------------------------------------------------
// Main decision
// ---------------------------------------------------------------------------
export function decide(bot) {
  // 1) orders
  const o = bot.order;
  if (o) {
    if (o.type === "follow") return { gen: followOrder(bot, o), name: "order" };
    if (o.type === "stay") return { gen: stayOrder(bot, o), name: "order" };
    if (o.type === "home") return { gen: homeOrder(bot), name: "order" };
    if (o.type === "build") return { gen: buildHereOrder(bot, o), name: "order" };
  }

  // 2) night shelter for the cautious and under-equipped
  if (isNight() && bot.dimName === "overworld" && !bot.isUnderground() && bot.personality.bravery < 0.55 && bot.armorPoints() < 8 && bot.currentMs !== "dragon" && chance(0.7)) {
    return { gen: shelterForNight(bot), name: "shelter" };
  }

  // 2b) morning prayer for the faithful
  const rel = religionOf(bot);
  const today = Math.floor(world.getAbsoluteTime() / 24000);
  if (rel && hasTenet(bot, "dawn_prayer") && world.getTimeOfDay() < 2000 && bot.mem.lastPrayDay !== today) {
    bot.mem.lastPrayDay = today;
    if (obeys(bot, 0.3)) return { gen: pray(bot), name: "pray" };
  }

  // 2c) a spare tool before the current one breaks
  if (bot.wantSpare) {
    const id = bot.wantSpare;
    bot.wantSpare = null;
    return { gen: acquire(bot, id, bot.inv.count(id) + 1), name: "spare" };
  }

  // 3) food emergencies
  if (bot.inv.foodPoints() < 8 && bot.food < 15) return { gen: getFood(bot, 30), name: "food" };

  // 4) cooking raw food we're carrying
  if (bot.inv.count("#raw_meat") >= 4 && chance(0.5)) return { gen: cookAll(bot, 0), name: "cook" };

  // 5) storage
  if (bot.inv.freeSlots() <= 2 && bot.mem.home) return { gen: storeItems(bot), name: "store" };

  // 6) milestones (with occasional whims). The holy day of rest means no mining for the devout.
  const restDay = rel && hasTenet(bot, "rest_day") && isHolyDay(rel) && obeys(bot, 0.4);
  const ms = restDay ? null : nextMilestone(bot);
  bot.failItem = null;
  const whim = chance(0.1 * (1.2 - bot.personality.ambition));
  if (ms && !whim) {
    return { gen: runMilestone(bot, ms), name: "milestone", ms };
  }

  // 7) free will
  const act = pickFree(bot);
  return { gen: act.run(bot), name: `free:${act.id}` };
}

/** Called when a top-level routine ends. */
export function onRoutineDone(bot, entry, result) {
  if (entry.ms) {
    bot.currentMs = null;
    if (!result) {
      bot.cooldowns[entry.ms] = now() + 20 * Math.floor(rand(90, 240));
      // stuck on something? learn from it and ask around
      const f = bot.failItem;
      if (f) {
        bot.mem.failures[f.item] = (bot.mem.failures[f.item] || 0) + 1;
        if (bot.mem.failures[f.item] >= 2) askForHelp(bot, f.item, Math.min(16, f.n || 1), MILESTONES[entry.ms] && MILESTONES[entry.ms].label.replace(/^(getting|making) /, ""));
      }
    } else {
      bot.mem.msDone = bot.mem.msDone || [];
      if (!bot.mem.msDone.includes(entry.ms)) bot.mem.msDone.push(entry.ms);
    }
    bot.save();
  }
}

export function pickMode() {
  const r = Math.random();
  if (r < 0.45) return "beat_game";
  if (r < 0.7) return "survivor";
  if (r < 0.85) return "builder";
  return "explorer";
}

export function randomPersonality() {
  return {
    bravery: Math.random(),
    curiosity: Math.random(),
    builder: Math.random(),
    ambition: 0.3 + Math.random() * 0.7,
    sociability: Math.random(),
    chattiness: Math.random(),
  };
}
