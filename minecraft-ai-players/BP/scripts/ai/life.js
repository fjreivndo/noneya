// Everyday life: sleeping in a real bed, fishing, breeding animals, enchanting and travelling by boat.
import { world, BlockPermutation } from "@minecraft/server";
import { cfg } from "../config.js";
import { V, pick, chance, now, wait, rand, isNight, safe } from "../util.js";
import { kindOf, K_WATER } from "../data.js";
import { findBlocks, getBlock, typeAt, isPassable, isStandable, entitiesNear, isAlive, surfaceAt } from "./world.js";
import { goTo, steer, faceTowards } from "./movement.js";
import { acquire } from "./planner.js";
import { journal } from "./cognition.js";
import { giveItem } from "./actions.js";

// ---------------------------------------------------------------------------
// Beds
// ---------------------------------------------------------------------------
/** Place a bed (two blocks) at foot position p, head towards +z. Needs 3 wool + 3 planks (consumed). */
export function placeBed(bot, foot) {
  if (bot.inv.count("#wool") < 3 || bot.inv.count("#planks") < 3) return false;
  const head = { x: foot.x, y: foot.y, z: foot.z + 1 };
  const fb = getBlock(bot.dim, foot);
  const hb = getBlock(bot.dim, head);
  if (!fb || !hb) return false;
  try {
    fb.setPermutation(BlockPermutation.resolve("minecraft:bed", { direction: 0, head_piece_bit: false }));
    hb.setPermutation(BlockPermutation.resolve("minecraft:bed", { direction: 0, head_piece_bit: true }));
  } catch (e) {
    try {
      fb.setType("minecraft:bed");
    } catch (e2) {
      return false;
    }
  }
  bot.inv.remove("#wool", 3);
  bot.inv.remove("#planks", 3);
  bot.mem.bed = { ...foot, dim: bot.dimName };
  return true;
}

/** Sleep in our bed until morning (lying-down pose). */
export function* sleepInBed(bot) {
  const bed = bot.mem.bed;
  if (!bed || bed.dim !== bot.dimName || !String(typeAt(bot.dim, bed)).includes("bed")) return false;
  bot.setTask("going to bed");
  const ok = yield* goTo(bot, { x: bed.x + 0.5, y: bed.y, z: bed.z + 0.5 }, { range: 1.3, timeout: 20 * 120 });
  if (!ok) return false;
  bot.setTask("sleeping");
  while (isNight()) {
    steer(bot, { x: bed.x + 0.5, y: bed.y, z: bed.z + 1 }, { slow: true });
    bot.setAction(4, 5);
    bot.cog.fatigue = Math.max(0, bot.cog.fatigue - 0.002);
    yield;
  }
  bot.setAction(0);
  bot.cog.fatigue = 0;
  return true;
}

// ---------------------------------------------------------------------------
// Fishing
// ---------------------------------------------------------------------------
export function* fish(bot) {
  if (bot.dimName !== "overworld") return false;
  if (!bot.inv.has("minecraft:fishing_rod")) {
    const ok = yield* acquire(bot, "minecraft:fishing_rod", 1);
    if (!ok) return false;
  }
  const water = findBlocks(bot.dim, bot.pos, ["minecraft:water"], { radius: 32, up: 4, down: 6, cap: 200 }).filter(
    (p) => kindOf(typeAt(bot.dim, { x: p.x, y: p.y + 1, z: p.z }) || "") !== K_WATER && isPassable(bot.dim, { x: p.x, y: p.y + 1, z: p.z }),
  );
  if (!water.length) return false;
  const w = water[0];
  // stand on dry land next to it
  let spot = null;
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const q = { x: w.x + dx, y: w.y + 1, z: w.z + dz };
    if (isPassable(bot.dim, q) && isPassable(bot.dim, { x: q.x, y: q.y + 1, z: q.z }) && isStandable(bot.dim, { x: q.x, y: q.y - 1, z: q.z })) {
      spot = q;
      break;
    }
  }
  if (!spot) return false;
  bot.setTask("fishing");
  const ok = yield* goTo(bot, { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 }, { range: 0.8, timeout: 20 * 90 });
  if (!ok) return false;
  bot.hold("minecraft:fishing_rod");
  const bobber = { x: w.x + 0.5, y: w.y + 0.9, z: w.z + 0.5 };
  let caught = 0;
  for (let cast = 0; cast < 6; cast++) {
    bot.swing();
    safe(() => bot.dim.playSound("random.bow", bot.pos, { volume: 0.4, pitch: 0.6 }), null);
    const waitT = Math.floor(rand(100, 420));
    for (let t = 0; t < waitT; t++) {
      bot.motor.look = bobber;
      if (t % 40 === 0) safe(() => bot.dim.spawnParticle("minecraft:water_wake_particle", bobber), null);
      yield;
    }
    safe(() => bot.dim.playSound("random.splash", bobber, { volume: 0.6 }), null);
    bot.swing();
    const r = Math.random();
    const loot = r < 0.6 ? "minecraft:cod" : r < 0.85 ? "minecraft:salmon" : r < 0.95 ? pick(["minecraft:stick", "minecraft:string", "minecraft:bone", "minecraft:leather"]) : pick(["minecraft:bow", "minecraft:name_tag", "minecraft:saddle"]);
    giveItem(bot, loot, 1);
    caught++;
    bot.damageTool("minecraft:fishing_rod");
    yield* wait(10);
  }
  journal(bot, "found", { item: "minecraft:cod", n: caught });
  return true;
}

// ---------------------------------------------------------------------------
// Breeding
// ---------------------------------------------------------------------------
const FEED = {
  "minecraft:cow": "minecraft:wheat", "minecraft:sheep": "minecraft:wheat", "minecraft:pig": "minecraft:carrot",
  "minecraft:chicken": "minecraft:wheat_seeds",
};

export function canBreed(bot) {
  if ((bot.cooldowns.breed || 0) > now()) return false;
  for (const [type, food] of Object.entries(FEED)) {
    if (bot.inv.count(food) < 2) continue;
    const near = entitiesNear(bot.dim, bot.pos, 24, { type }).filter(isAlive);
    if (near.length >= 2 && near.length < 10) return true;
  }
  return false;
}

export function* breedAnimals(bot) {
  bot.cooldowns.breed = now() + 20 * 300;
  for (const [type, food] of Object.entries(FEED)) {
    if (bot.inv.count(food) < 2) continue;
    const near = entitiesNear(bot.dim, bot.pos, 24, { type }).filter(isAlive);
    if (near.length < 2) continue;
    bot.setTask(`breeding ${type.replace("minecraft:", "")}s`);
    bot.hold(food);
    for (const a of near.slice(0, 2)) {
      const ok = yield* goTo(bot, () => (a.isValid ? a.location : undefined), { range: 2, timeout: 20 * 30 });
      if (!ok || !a.isValid) return false;
      yield* faceTowards(bot, { x: a.location.x, y: a.location.y + 0.8, z: a.location.z });
      bot.swing();
      bot.inv.remove(food, 1);
      safe(() => bot.dim.spawnParticle("minecraft:heart_particle", { x: a.location.x, y: a.location.y + 1.2, z: a.location.z }), null);
      yield* wait(10);
    }
    yield* wait(60);
    const p = near[0].isValid ? near[0].location : bot.pos;
    safe(() => bot.dim.spawnEntity(type, p, { spawnEvent: "minecraft:entity_born" }), null);
    journal(bot, "bred", { what: type.replace("minecraft:", "") });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Enchanting (bots don't have real XP; they earn "experience" from mining ores and fighting)
// ---------------------------------------------------------------------------
export function enchantLevel(bot, slot, kind) {
  const e = bot.mem.enchants && bot.mem.enchants[slot];
  return e && e.kind === kind ? e.level : 0;
}

export function canEnchant(bot) {
  if ((bot.mem.xp || 0) < 30 || bot.inv.count("minecraft:lapis_lazuli") < 3) return false;
  return findBlocks(bot.dim, bot.pos, ["minecraft:enchanting_table"], { radius: 48, up: 10, down: 10, cap: 2 }).length > 0;
}

export function* enchant(bot) {
  const table = findBlocks(bot.dim, bot.pos, ["minecraft:enchanting_table"], { radius: 48, up: 10, down: 10, cap: 2 })[0];
  if (!table) return false;
  bot.setTask("enchanting");
  const ok = yield* goTo(bot, { x: table.x + 0.5, y: table.y, z: table.z + 0.5 }, { range: 2.5, timeout: 20 * 90 });
  if (!ok) return false;
  yield* faceTowards(bot, { x: table.x + 0.5, y: table.y + 0.75, z: table.z + 0.5 });
  for (let i = 0; i < 40; i++) {
    if (i % 8 === 0) safe(() => bot.dim.spawnParticle("minecraft:enchanting_table_particle", { x: table.x + 0.5, y: table.y + 1.2, z: table.z + 0.5 }), null);
    yield;
  }
  bot.mem.enchants = bot.mem.enchants || {};
  const options = [
    { slot: "pickaxe", kind: "efficiency" },
    { slot: "sword", kind: "sharpness" },
    { slot: "armor", kind: "protection" },
  ].filter((o) => (bot.mem.enchants[o.slot]?.level || 0) < 4);
  if (!options.length) return false;
  const o = pick(options);
  const level = Math.min(4, (bot.mem.enchants[o.slot]?.level || 0) + 1 + (chance(0.3) ? 1 : 0));
  bot.mem.enchants[o.slot] = { kind: o.kind, level };
  bot.mem.xp -= 30;
  bot.inv.remove("minecraft:lapis_lazuli", 3);
  safe(() => bot.dim.playSound("random.levelup", bot.pos, { volume: 0.6 }), null);
  journal(bot, "enchanted", { what: `${o.slot} with ${o.kind} ${level}` });
  if (cfg().announceAdvancements && level === 1) world.sendMessage(`${bot.name} has made the advancement §a[Enchanter]`);
  bot.save();
  return true;
}

// ---------------------------------------------------------------------------
// Boats
// ---------------------------------------------------------------------------
export function hasBoatMaterials(bot) {
  return bot.mem.boats > 0 || bot.inv.count("#planks") >= 5 || bot.inv.count("#logs") >= 2;
}

/** Cross water towards a target by boat. Returns true if we landed somewhere closer. */
export function* boatTo(bot, target) {
  if (!bot.mem.boats) {
    if (bot.inv.count("#planks") < 5) {
      const ok = yield* acquire(bot, "#planks", 5);
      if (!ok) return false;
    }
    bot.inv.remove("#planks", 5);
    bot.mem.boats = 1;
  }
  // find the water's edge in the direction of the target
  const water = findBlocks(bot.dim, bot.pos, ["minecraft:water"], { radius: 8, up: 2, down: 3, cap: 60 }).filter((p) => isPassable(bot.dim, { x: p.x, y: p.y + 1, z: p.z }));
  if (!water.length) return false;
  water.sort((a, b) => V.dist2(a, target) - V.dist2(b, target));
  const w = water[0];
  yield* goTo(bot, { x: w.x + 0.5, y: w.y + 1, z: w.z + 0.5 }, { range: 2, timeout: 200, allowDig: false });
  let boat;
  try {
    boat = bot.dim.spawnEntity("minecraft:boat", { x: w.x + 0.5, y: w.y + 1, z: w.z + 0.5 });
  } catch (e) {
    return false;
  }
  bot.mem.boats--;
  const ride = boat.getComponent("minecraft:rideable");
  if (!ride || !ride.addRider(bot.entity)) {
    safe(() => boat.remove(), null);
    bot.mem.boats++;
    return false;
  }
  bot.setTask("sailing");
  const start = V.dist(bot.pos, target);
  let stuck = 0;
  let last = bot.pos;
  for (let t = 0; t < 20 * 180; t++) {
    if (!boat.isValid) break;
    const bp = boat.location;
    const d = V.hdist(bp, target);
    if (d < 4) break;
    const dir = V.norm({ x: target.x - bp.x, y: 0, z: target.z - bp.z });
    const v = boat.getVelocity();
    safe(() => boat.applyImpulse({ x: dir.x * 0.32 - v.x * 0.5, y: 0, z: dir.z * 0.32 - v.z * 0.5 }), null);
    safe(() => boat.setRotation({ x: 0, y: (Math.atan2(-dir.x, dir.z) * 180) / Math.PI }), null);
    bot.motor.look = { x: target.x, y: bp.y + 1.5, z: target.z };
    if (t % 20 === 0) {
      if (V.hdist(bp, last) < 0.5) stuck++;
      else stuck = 0;
      last = { ...bp };
      if (stuck > 2) break; // ran aground: hop out here
    }
    yield;
  }
  safe(() => ride.ejectRider(bot.entity), null);
  safe(() => boat.remove(), null);
  bot.mem.boats++;
  yield* wait(5);
  return V.dist(bot.pos, target) < start - 8;
}

/** Is there open water between us and the target (an ocean or lake in the way)? */
export function waterAhead(bot, target) {
  const p = bot.pos;
  let wet = 0;
  for (let i = 1; i <= 8; i++) {
    const x = Math.floor(p.x + ((target.x - p.x) * i) / 8);
    const z = Math.floor(p.z + ((target.z - p.z) * i) / 8);
    const s = surfaceAt(bot.dim, x, z);
    if (s && s.water) wet++;
  }
  return wet >= 3;
}
