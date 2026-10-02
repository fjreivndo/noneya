// Towns and cities: founding, plots for members' houses, roads, and shared building projects
// (plaza, well, town hall, temple, farm, lamp posts) that several bots build together.
import { world, BlockPermutation } from "@minecraft/server";
import { cfg } from "../config.js";
import { pick, now, V } from "../util.js";
import { soc, newId, markDirty } from "../society.js";
import { surfaceAt, getBlock, typeAt } from "./world.js";
import { findBuildSite, buildStructure, houseBlueprint } from "./build.js";
import { journal } from "./cognition.js";
import { religionOf } from "./religion.js";
import { goTo } from "./movement.js";
import { isReplaceable, matches } from "../data.js";
import { toSurface } from "./mining.js";

const PREFIX = ["New ", "Old ", "Fort ", "Port ", "East ", "West ", "North ", "South ", "Mount ", "Lake ", "", "", "", ""];
const ROOT = ["Cobble", "Oak", "Stone", "Iron", "Creeper", "Pine", "Birch", "Diamond", "Redstone", "Willow", "Copper", "Ember", "Frost", "Moss", "Raven", "Amber"];
const SUFFIX = ["ton", "ville", "burg", "field", "wood", "haven", "ford", "ridge", "brook", "dale", " Falls", " Hollow", "shire", "stead", "port"];

export function townName() {
  return `${pick(PREFIX)}${pick(ROOT)}${pick(SUFFIX)}`;
}

export function townOf(bot) {
  const id = bot.mem.town;
  if (!id) return undefined;
  const t = soc().towns[id];
  if (!t) bot.mem.town = undefined;
  return t;
}

export function townRank(t) {
  const n = t.members.length;
  return n >= 8 ? "city" : n >= 4 ? "town" : "village";
}

// ---------------------------------------------------------------------------
// Blueprints
// ---------------------------------------------------------------------------
function plazaBlueprint() {
  const list = [];
  const R = 4;
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      list.push({ x, y: -1, z, id: "minecraft:cobblestone", alt: "#building", phase: 0, ground: true });
      for (let y = 0; y <= 2; y++) list.push({ x, y, z, id: "air", phase: 0 });
    }
  // well in the middle
  for (const [x, z] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) list.push({ x, y: 0, z, id: "minecraft:cobblestone", alt: "#building", phase: 1 });
  list.push({ x: 0, y: -1, z: 0, id: "minecraft:water", phase: 2, optional: true, needs: "minecraft:water_bucket" });
  // lamp posts at the corners
  for (const [x, z] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
    list.push({ x, y: 0, z, id: "minecraft:cobblestone", alt: "#building", phase: 1 });
    list.push({ x, y: 1, z, id: "minecraft:cobblestone", alt: "#building", phase: 1 });
    list.push({ x, y: 2, z, id: "minecraft:torch", phase: 3, optional: true });
  }
  return { w: 9, d: 9, list, centered: true };
}

function hallBlueprint() {
  const list = [];
  const W = 11;
  const D = 9;
  const H = 4;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) list.push({ x, y: -1, z, id: "minecraft:cobblestone", alt: "#building", fill: true, phase: 0 });
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = 0; y <= H; y++) list.push({ x, y, z, id: "air", phase: 1 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let z = 0; z < D; z++) {
        const ex = x === 0 || x === W - 1;
        const ez = z === 0 || z === D - 1;
        if (!ex && !ez) continue;
        if (z === 0 && (x === 5) && y <= 1) continue; // door
        const corner = ex && ez;
        const win = y === 2 && !corner && (x % 3 === 1 || z % 3 === 1);
        list.push({ x, y, z, id: corner ? "#logs" : y === 0 ? "minecraft:cobblestone" : win ? "minecraft:glass" : "#planks", alt: corner ? "#planks" : "#building", phase: 2 });
      }
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) list.push({ x, y: H, z, id: "#planks", alt: "#building", phase: 3 });
  for (const [x, z] of [[2, 2], [8, 2], [2, 6], [8, 6]]) list.push({ x, y: 0, z, id: "minecraft:torch", phase: 4, optional: true });
  list.push({ x: 5, y: 0, z: 7, id: "minecraft:crafting_table", phase: 4, optional: true });
  list.push({ x: 4, y: 0, z: 7, id: "minecraft:chest", phase: 4, optional: true });
  return { w: W, d: D, list };
}

function templeBlueprint() {
  const list = [];
  const W = 9;
  const D = 13;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) list.push({ x, y: -1, z, id: "minecraft:cobblestone", alt: "#building", fill: true, phase: 0 });
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = 0; y <= 6; y++) list.push({ x, y, z, id: "air", phase: 1 });
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < W; x++)
      for (let z = 0; z < D; z++) {
        const edge = x === 0 || x === W - 1 || z === 0 || z === D - 1;
        if (!edge) continue;
        if (z === 0 && x >= 3 && x <= 5 && y <= 2) continue; // grand entrance
        const win = (y === 2 || y === 3) && (x === 0 || x === W - 1) && z % 3 === 1;
        list.push({ x, y, z, id: win ? "minecraft:glass" : "minecraft:cobblestone", alt: "#building", phase: 2 });
      }
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) list.push({ x, y: 6, z, id: "minecraft:cobblestone", alt: "#building", phase: 3 });
  // altar at the far end
  list.push({ x: 4, y: 0, z: 10, id: "minecraft:gold_block", alt: "minecraft:cobblestone", phase: 4 });
  list.push({ x: 4, y: 1, z: 10, id: "minecraft:torch", phase: 5, optional: true });
  for (const z of [3, 6, 9]) {
    list.push({ x: 1, y: 0, z, id: "minecraft:torch", phase: 5, optional: true });
    list.push({ x: 7, y: 0, z, id: "minecraft:torch", phase: 5, optional: true });
  }
  list.push({ x: 3, y: 0, z: 10, id: "minecraft:chest", phase: 5, optional: true });
  return { w: W, d: D, list, altar: { x: 4, y: 0, z: 10 } };
}

function farmBlueprint() {
  const list = [];
  for (let x = 0; x < 9; x++)
    for (let z = 0; z < 9; z++) {
      for (let y = 0; y <= 1; y++) list.push({ x, y, z, id: "air", phase: 0 });
      const edge = x === 0 || z === 0 || x === 8 || z === 8;
      if (edge) list.push({ x, y: -1, z, id: "#logs", alt: "#building", phase: 1 });
      else if (x === 4 && z === 4) list.push({ x, y: -1, z, id: "minecraft:water", phase: 1, optional: true, needs: "minecraft:water_bucket" });
      else {
        list.push({ x, y: -1, z, id: "minecraft:farmland", phase: 1, till: true, optional: true });
        list.push({ x, y: 0, z, id: "minecraft:wheat", phase: 2, optional: true, needs: "minecraft:wheat_seeds" });
      }
    }
  return { w: 9, d: 9, list };
}

const PROJECTS = {
  plaza: { label: "the town plaza", bp: plazaBlueprint, min: 1 },
  town_hall: { label: "the town hall", bp: hallBlueprint, min: 2 },
  temple: { label: "the temple", bp: templeBlueprint, min: 2, needsReligion: true },
  farm: { label: "the town farm", bp: farmBlueprint, min: 2 },
  roads: { label: "roads", road: true, min: 3 },
};

// ---------------------------------------------------------------------------
// Founding and membership
// ---------------------------------------------------------------------------
export function foundTown(bot) {
  if (!cfg().towns || bot.mem.town || bot.dimName !== "overworld") return undefined;
  if (!bot.mem.home && bot.isUnderground()) return undefined;
  const s = soc();
  if (Object.keys(s.towns).length >= cfg().maxTowns) return undefined;
  const f = bot.feetBlock();
  const h = bot.mem.home || { x: f.x - 14, y: f.y, z: f.z };
  for (const t of Object.values(s.towns)) if (Math.abs(t.center.x - h.x) + Math.abs(t.center.z - h.z) < 200) return undefined; // too close to another town
  const c = { x: h.x + 14, y: h.y, z: h.z };
  const sf = surfaceAt(bot.dim, c.x, c.z);
  if (sf) c.y = sf.y;
  const town = {
    id: newId("t"), name: townName(), founder: bot.id, founderName: bot.name, mayor: bot.id, mayorName: bot.name,
    center: c, members: [bot.id], plots: bot.mem.home ? [{ x: h.x, z: h.z, owner: bot.id, built: true }] : [], projects: [], built: [], founded: now(), religion: null,
  };
  s.towns[town.id] = town;
  bot.mem.town = town.id;
  addProject(town, "plaza");
  markDirty();
  journal(bot, "founded_town", { town: town.name });
  world.sendMessage(`§b${bot.name} founded the village of ${town.name}`);
  bot.speak("found_town", { town: town.name }, 3);
  return town;
}

export function joinTown(bot, town) {
  if (!town.members.includes(bot.id)) town.members.push(bot.id);
  bot.mem.town = town.id;
  journal(bot, "joined_town", { town: town.name });
  const before = townRank(town);
  markDirty();
  if (town.members.length === 4 || town.members.length === 8) world.sendMessage(`§b${town.name} has grown into a ${townRank(town)}! (${town.members.length} residents)`);
  else if (before) world.sendMessage(`§b${bot.name} moved to ${town.name}`);
  plan(town);
}

export function leaveTown(bot) {
  const t = townOf(bot);
  if (!t) return;
  t.members = t.members.filter((m) => m !== bot.id);
  for (const p of t.plots) if (p.owner === bot.id && !p.built) p.owner = null;
  bot.mem.town = undefined;
  markDirty();
}

/** Free plot for a resident's house, laid out in rings around the plaza. */
export function claimPlot(bot, town) {
  const mine = town.plots.find((p) => p.owner === bot.id);
  if (mine) return mine;
  const c = town.center;
  for (let ring = 1; ring <= 4; ring++) {
    const r = ring * 16;
    for (let a = 0; a < 8 * ring; a++) {
      const ang = (a / (8 * ring)) * Math.PI * 2;
      const x = Math.round(c.x + Math.cos(ang) * r);
      const z = Math.round(c.z + Math.sin(ang) * r);
      if (town.plots.some((p) => Math.abs(p.x - x) < 11 && Math.abs(p.z - z) < 11)) continue;
      if (town.projects.concat(town.built).some((p) => p.x !== undefined && Math.abs(p.x - x) < 14 && Math.abs(p.z - z) < 14)) continue;
      const plot = { x, z, owner: bot.id, built: false };
      town.plots.push(plot);
      markDirty();
      return plot;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
function addProject(town, type) {
  if (town.projects.some((p) => p.type === type) || town.built.some((b) => b.type === type && type !== "roads")) return;
  const def = PROJECTS[type];
  let pos = null;
  if (!def.road) {
    if (type === "plaza") pos = { ...town.center };
    else {
      const ang = { town_hall: 0.5, temple: 2.2, farm: 4.0 }[type] ?? Math.random() * 6;
      pos = { x: Math.round(town.center.x + Math.cos(ang) * 10), y: town.center.y, z: Math.round(town.center.z + Math.sin(ang) * 10) };
      // keep it off the plaza
      pos.x += Math.sign(pos.x - town.center.x) * 2;
      pos.z += Math.sign(pos.z - town.center.z) * 2;
    }
  }
  town.projects.push({ id: newId("p"), type, ...(pos || {}), started: now() });
  markDirty();
}

/** Decide which projects the town needs next. */
export function plan(town) {
  const n = town.members.length;
  const has = (t) => town.built.some((b) => b.type === t) || town.projects.some((p) => p.type === t);
  if (!has("plaza")) addProject(town, "plaza");
  if (n >= 2 && !has("town_hall")) addProject(town, "town_hall");
  if (n >= 2 && !has("farm")) addProject(town, "farm");
  if (town.religion && soc().religions[town.religion] && !has("temple")) addProject(town, "temple");
  if (n >= 3 && town.plots.filter((p) => p.built).length >= 3 && !town.projects.some((p) => p.type === "roads")) {
    const last = town.built.filter((b) => b.type === "roads").pop();
    if (!last || now() - last.done > 24000) addProject(town, "roads");
  }
}

export function projectLabel(p) {
  return PROJECTS[p.type] ? PROJECTS[p.type].label : p.type;
}

export function nextProject(town) {
  return town.projects[0];
}

function completeProject(town, p, bot) {
  town.projects = town.projects.filter((q) => q.id !== p.id);
  town.built.push({ type: p.type, x: p.x, y: p.y, z: p.z, done: now(), by: bot.name, altar: p.altar });
  if (p.type === "temple" && town.religion) {
    const r = soc().religions[town.religion];
    if (r) r.temple = { town: town.id, x: p.altar ? p.altar.x : p.x, y: p.y, z: p.altar ? p.altar.z : p.z };
  }
  markDirty();
  world.sendMessage(`§b${town.name} finished ${projectLabel(p)}!`);
  journal(bot, "built", { what: projectLabel(p) });
  plan(town);
}

/** Work on the town's current project. Several bots can do this at once. */
export function* workOnProject(bot, town) {
  const p = nextProject(town);
  if (!p) return false;
  if (bot.dimName !== "overworld") return false;
  if (bot.isUnderground()) yield* toSurface(bot);
  if (PROJECTS[p.type].road) {
    const ok = yield* buildRoads(bot, town);
    if (ok) completeProject(town, p, bot);
    return ok;
  }
  const def = PROJECTS[p.type];
  const bp = def.bp();
  let origin;
  if (bp.centered) origin = { x: p.x, y: p.y, z: p.z };
  else origin = { x: p.x - Math.floor(bp.w / 2), y: p.y, z: p.z - Math.floor(bp.d / 2) };
  // settle the ground height the first time someone looks at the site
  if (!p.settled) {
    const s = surfaceAt(bot.dim, p.x, p.z);
    if (s && !s.water) {
      p.y = s.y;
      origin.y = s.y;
    }
    p.settled = true;
    if (bp.altar) p.altar = { x: origin.x + bp.altar.x, y: origin.y, z: origin.z + bp.altar.z };
    markDirty();
  }
  if (V.dist(bot.pos, origin) > 24) yield* goTo(bot, { x: p.x + 0.5, y: p.y, z: p.z + 0.5 }, { range: 8, timeout: 20 * 120 });
  // farmland / water / crops need special handling
  bp.list = bp.list.filter((b) => !b.needs || bot.inv.has(b.needs));
  for (const b of bp.list) if (b.till) b.id = "minecraft:farmland";
  const ok = yield* buildStructure(bot, origin, bp, `building ${projectLabel(p)}`);
  if (ok && soc().towns[town.id] && town.projects.some((q) => q.id === p.id) && completeness(bot, origin, bp) > 0.9) completeProject(town, p, bot);
  return ok;
}

function completeness(bot, origin, bp) {
  let total = 0;
  let good = 0;
  for (const b of bp.list) {
    if (b.id === "air" || b.optional || b.fill) continue;
    total++;
    const t = typeAt(bot.dim, { x: origin.x + b.x, y: origin.y + b.y, z: origin.z + b.z });
    if (t && (b.id.startsWith("#") ? matches(b.id, t) || (b.alt && matches(b.alt, t)) : t === b.id || (b.alt && (b.alt.startsWith("#") ? matches(b.alt, t) : t === b.alt)))) good++;
  }
  return total ? good / total : 1;
}

/** Gravel roads from the plaza to every built house. */
function* buildRoads(bot, town) {
  const c = town.center;
  const targets = town.plots.filter((p) => p.built).concat(town.built.filter((b) => b.x !== undefined && b.type !== "plaza"));
  bot.setTask(`building roads in ${town.name}`);
  for (const t of targets) {
    const dx = t.x - c.x;
    const dz = t.z - c.z;
    const steps = Math.floor(Math.sqrt(dx * dx + dz * dz));
    for (let i = 6; i < steps - 4; i++) {
      const x = Math.round(c.x + (dx * i) / steps);
      const z = Math.round(c.z + (dz * i) / steps);
      const s = surfaceAt(bot.dim, x, z);
      if (!s || s.water) continue;
      const g = { x, y: s.y - 1, z };
      const gt = typeAt(bot.dim, g);
      if (!gt || !/grass_block|dirt|sand|podzol/.test(gt)) continue;
      if (!bot.inv.has("minecraft:gravel") && !bot.inv.has("minecraft:cobblestone")) return i > 6;
      if (V.dist(bot.pos, g) > 4) {
        const ok = yield* goTo(bot, { x: x + 0.5, y: s.y, z: z + 0.5 }, { range: 2.5, timeout: 200 });
        if (!ok) continue;
      }
      const b = getBlock(bot.dim, g);
      if (!b) continue;
      const id = bot.inv.has("minecraft:gravel") ? "minecraft:gravel" : "minecraft:cobblestone";
      try {
        b.setType(id);
        bot.inv.remove(id, 1);
        bot.placeAnim();
      } catch (e) {
        /* ignore */
      }
      yield;
      yield;
    }
  }
  return true;
}

/** Build this resident's house on their plot. */
export function* buildHouseOnPlot(bot, town) {
  const plot = claimPlot(bot, town);
  if (!plot) return false;
  const bp = houseBlueprint();
  const site = findBuildSite(bot, bp.w + 2, bp.d + 2, 6, { x: plot.x, y: bot.feetBlock().y, z: plot.z });
  const origin = site ? { x: site.x + 1, y: site.y, z: site.z + 1 } : { x: plot.x - 3, y: (surfaceAt(bot.dim, plot.x, plot.z) || { y: town.center.y }).y, z: plot.z - 3 };
  if (V.dist(bot.pos, origin) > 30) yield* goTo(bot, { x: origin.x + 3.5, y: origin.y, z: origin.z + 3.5 }, { range: 6, timeout: 20 * 120 });
  const ok = yield* buildStructure(bot, origin, bp, `building my house in ${town.name}`);
  if (!ok) return false;
  plot.built = true;
  bot.mem.home = { x: origin.x + bp.inside.x, y: origin.y, z: origin.z + bp.inside.z, dim: "overworld", chest: { x: origin.x + bp.chest.x, y: origin.y, z: origin.z + bp.chest.z } };
  markDirty();
  journal(bot, "built", { what: "my house" });
  bot.save();
  plan(town);
  return true;
}

export function placeTownSign(bot, town) {
  if (town.signDone) return;
  const p = { x: town.center.x + 2, y: town.center.y, z: town.center.z - 5 };
  const b = getBlock(bot.dim, p);
  if (!b || !isReplaceable(b.typeId)) return;
  try {
    b.setPermutation(BlockPermutation.resolve("minecraft:standing_sign"));
    const sign = b.getComponent("minecraft:sign");
    if (sign) sign.setText(`${town.name}\nfounded by\n${town.founderName}`);
    town.signDone = true;
    markDirty();
  } catch (e) {
    town.signDone = true;
  }
}

export function townSummary(t) {
  const rel = t.religion && soc().religions[t.religion];
  return `${t.name} (${townRank(t)}, ${t.members.length} residents, mayor ${t.mayorName}${rel ? `, faith: ${rel.name}` : ""})` +
    `\n  built: ${t.built.map((b) => projectLabel(b)).join(", ") || "nothing yet"}\n  working on: ${t.projects.map((p) => projectLabel(p)).join(", ") || "-"}`;
}

export function adoptReligion(town, rel) {
  if (town.religion) return;
  town.religion = rel.id;
  markDirty();
  plan(town);
}

export { religionOf };
