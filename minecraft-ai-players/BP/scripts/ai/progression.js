// Beating the game: nether portal, fortress & blaze rods, ender pearls, eyes, stronghold, the End, the dragon.
import { world, BlockPermutation } from "@minecraft/server";
import { cfg } from "../config.js";
import { K_SOLID, K_AIR, K_LAVA } from "../data.js";
import { V, wait, now, rand, pick, getDim } from "../util.js";
import { getBlock, typeAt, kindAt, findBlocks, entitiesNear, isAlive, surfaceAt, isPassable, isStandable } from "./world.js";
import { placeBlock, mineBlock, meleeHit, canShoot, shootArrow, collectNearbyItems, pillarUp } from "./actions.js";
import { goTo, goNear, steer, exploreStep, reachGoal } from "./movement.js";
import { fight } from "./combat.js";
import { acquire } from "./planner.js";
import { findBuildSite } from "./build.js";
import { toSurface, gatherFromBlocks } from "./mining.js";
import { addTickingArea, removeTickingArea, tickingName } from "../registry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setBlock(dim, p, id, states) {
  const b = getBlock(dim, p);
  if (!b) return false;
  try {
    if (states) b.setPermutation(BlockPermutation.resolve(id, states));
    else b.setType(id);
    return true;
  } catch (e) {
    try {
      b.setType(id);
      return true;
    } catch (e2) {
      return false;
    }
  }
}

function spawnNear(bot, type, dist) {
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2);
    const x = Math.floor(bot.pos.x + Math.cos(a) * dist);
    const z = Math.floor(bot.pos.z + Math.sin(a) * dist);
    for (let dy = 4; dy >= -4; dy--) {
      const y = Math.floor(bot.pos.y) + dy;
      if (isPassable(bot.dim, { x, y, z }) && isPassable(bot.dim, { x, y: y + 1, z }) && isPassable(bot.dim, { x, y: y + 2, z }) && isStandable(bot.dim, { x, y: y - 1, z })) {
        try {
          bot.dim.spawnEntity(type, { x: x + 0.5, y, z: z + 0.5 });
          return true;
        } catch (e) {
          return false;
        }
      }
    }
  }
  return false;
}

/** Minutes spent on the current milestone. */
function stuckMinutes(bot) {
  return (bot.msTicks || 0) / 1200;
}

function assistReady(bot) {
  const m = cfg().stuckAssistMinutes;
  return m > 0 && stuckMinutes(bot) >= m;
}

/** Find a safe standing spot near p (2 air above solid, no lava). */
function findSafeSpot(dim, p, yMin, yMax) {
  for (let r = 0; r <= 6; r += 2) {
    for (let dx = -r; dx <= r; dx += 2) {
      for (let dz = -r; dz <= r; dz += 2) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const x = Math.floor(p.x) + dx;
        const z = Math.floor(p.z) + dz;
        // scan from the requested y outward
        for (let o = 0; o < yMax - yMin; o++) {
          for (const y of [Math.floor(p.y) + o, Math.floor(p.y) - o]) {
            if (y < yMin || y > yMax) continue;
            const below = kindAt(dim, { x, y: y - 1, z });
            if (below !== K_SOLID) continue;
            if (kindAt(dim, { x, y, z }) !== K_AIR || kindAt(dim, { x, y: y + 1, z }) !== K_AIR) continue;
            let lava = false;
            for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              if (kindAt(dim, { x: x + ax, y, z: z + az }) === K_LAVA || kindAt(dim, { x: x + ax, y: y - 1, z: z + az }) === K_LAVA) lava = true;
            }
            if (!lava) return { x, y, z };
          }
        }
      }
    }
  }
  return undefined;
}

/** Teleport the bot to another dimension, loading the destination first. */
export function* travel(bot, dimName, pos, prepare) {
  const dest = getDim(dimName);
  const tname = tickingName(bot.id, "t");
  addTickingArea(dest, pos, tname, 2);
  let loaded = false;
  for (let i = 0; i < 300; i++) {
    if (getBlock(dest, pos)) {
      loaded = true;
      break;
    }
    yield;
  }
  let spot = pos;
  if (loaded && prepare) spot = prepare(dest) || pos;
  bot.setTask(`travelling to the ${dimName.replace("the_", "")}`);
  try {
    bot.entity.teleport({ x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 }, { dimension: dest });
  } catch (e) {
    removeTickingArea(dimName, tname);
    return false;
  }
  yield* wait(5);
  bot.refreshEntity();
  bot.tickingDirty = true;
  removeTickingArea(dimName, tname);
  try {
    bot.dim.playSound("portal.travel", bot.pos, { volume: 0.4 });
  } catch (e) {
    /* ignore */
  }
  return true;
}

// ---------------------------------------------------------------------------
// Nether portal
// ---------------------------------------------------------------------------
const FRAME = [
  [1, 0], [2, 0], [0, 1], [0, 2], [0, 3], [3, 1], [3, 2], [3, 3], [1, 4], [2, 4],
];

function portalIntact(dim, inside) {
  const t = typeAt(dim, inside);
  return t === "minecraft:portal";
}

function freePortal(dim, o, axis) {
  // free-build (used for the generated return portal, like the game does)
  for (let x = -1; x <= 4; x++)
    for (let y = 0; y <= 4; y++)
      for (let z = -1; z <= 1; z++) {
        const p = axis === "x" ? { x: o.x + x, y: o.y + y, z: o.z + z } : { x: o.x + z, y: o.y + y, z: o.z + x };
        if (y >= 0 && kindAt(dim, p) !== K_AIR) setBlock(dim, p, "minecraft:air");
      }
  for (let x = -1; x <= 4; x++)
    for (let z = -1; z <= 1; z++) {
      const p = axis === "x" ? { x: o.x + x, y: o.y - 1, z: o.z + z } : { x: o.x + z, y: o.y - 1, z: o.z + x };
      if (kindAt(dim, p) !== K_SOLID) setBlock(dim, p, "minecraft:obsidian");
    }
  for (const [x, y] of FRAME) setBlock(dim, axis === "x" ? { x: o.x + x, y: o.y + y, z: o.z } : { x: o.x, y: o.y + y, z: o.z + x }, "minecraft:obsidian");
  for (let x = 1; x <= 2; x++)
    for (let y = 1; y <= 3; y++) setBlock(dim, axis === "x" ? { x: o.x + x, y: o.y + y, z: o.z } : { x: o.x, y: o.y + y, z: o.z + x }, "minecraft:portal", { portal_axis: axis });
  return axis === "x" ? { x: o.x + 1, y: o.y + 1, z: o.z } : { x: o.x, y: o.y + 1, z: o.z + 1 };
}

export function* buildNetherPortal(bot) {
  let ok = yield* acquire(bot, "minecraft:obsidian", 10);
  if (!ok) return false;
  ok = yield* acquire(bot, "minecraft:flint_and_steel", 1);
  if (!ok) return false;
  if (bot.isUnderground()) yield* toSurface(bot);
  bot.setTask("building a nether portal");
  const site = findBuildSite(bot, 6, 3, 20) || { x: bot.feetBlock().x + 2, y: bot.feetBlock().y, z: bot.feetBlock().z };
  const o = { x: site.x + 1, y: site.y, z: site.z + 1 };
  // clear the frame volume
  for (let x = 0; x <= 3; x++)
    for (let y = 0; y <= 4; y++) {
      const p = { x: o.x + x, y: o.y + y, z: o.z };
      const k = kindAt(bot.dim, p);
      if (k !== K_AIR && !(FRAME.some(([fx, fy]) => fx === x && fy === y) && typeAt(bot.dim, p) === "minecraft:obsidian")) {
        yield* goNear(bot, p, cfg().reach - 1);
        const mined = yield* mineBlock(bot, p);
        if (!mined) setBlock(bot.dim, p, "minecraft:air");
      }
    }
  for (const [x, y] of FRAME) {
    const p = { x: o.x + x, y: o.y + y, z: o.z };
    if (typeAt(bot.dim, p) === "minecraft:obsidian") continue;
    if (V.dist(bot.eye, V.center(p)) > cfg().reach - 0.5) yield* goTo(bot, V.feet(p), { goalFn: reachGoal(p, cfg().reach - 0.5), allowDig: false, timeout: 400 });
    let placed = yield* placeBlock(bot, p, "minecraft:obsidian", { permanent: true });
    if (!placed) {
      // corner case: something is in the way, place it anyway from where we stand
      if (bot.inv.has("minecraft:obsidian")) {
        placed = setBlock(bot.dim, p, "minecraft:obsidian");
        if (placed) bot.inv.remove("minecraft:obsidian", 1);
      }
    }
    if (!placed) return false;
  }
  // light it
  bot.hold("minecraft:flint_and_steel");
  bot.motor.look = { x: o.x + 1.5, y: o.y + 1, z: o.z + 0.5 };
  bot.swing();
  yield* wait(6);
  for (let x = 1; x <= 2; x++) for (let y = 1; y <= 3; y++) setBlock(bot.dim, { x: o.x + x, y: o.y + y, z: o.z }, "minecraft:portal", { portal_axis: "x" });
  try {
    bot.dim.playSound("fire.ignite", { x: o.x + 1.5, y: o.y + 1, z: o.z + 0.5 });
  } catch (e) {
    /* ignore */
  }
  bot.damageTool("minecraft:flint_and_steel");
  bot.mem.portal = { ow: { x: o.x + 1, y: o.y + 1, z: o.z } };
  bot.save();
  bot.announce("built a nether portal");
  return true;
}

export function* enterNether(bot) {
  if (bot.dimName === "nether") return true;
  if (bot.dimName === "the_end") return false;
  const portal = bot.mem.portal;
  if (!portal || !portal.ow || (getBlock(bot.dim, portal.ow) && !portalIntact(bot.dim, portal.ow))) {
    const ok = yield* buildNetherPortal(bot);
    if (!ok) return false;
  }
  const ow = bot.mem.portal.ow;
  const ok = yield* goTo(bot, { x: ow.x + 0.5, y: ow.y, z: ow.z + 0.5 }, { range: 0.8, timeout: 20 * 240, allowDig: true });
  if (!ok) return false;
  bot.setTask("entering the nether");
  yield* wait(40);
  const target = bot.mem.portal.nether || { x: Math.floor(ow.x / 8), y: 70, z: Math.floor(ow.z / 8) };
  const done = yield* travel(bot, "nether", target, (dim) => {
    if (bot.mem.portal.nether && portalIntact(dim, bot.mem.portal.nether)) return { x: bot.mem.portal.nether.x, y: bot.mem.portal.nether.y, z: bot.mem.portal.nether.z + 2 };
    let spot = findSafeSpot(dim, target, 32, 110);
    if (!spot) {
      // carve a small room like the game does
      spot = { x: target.x, y: 70, z: target.z };
      for (let x = -2; x <= 4; x++) for (let y = 0; y <= 4; y++) for (let z = -2; z <= 3; z++) setBlock(dim, { x: spot.x + x, y: spot.y + y, z: spot.z + z }, "minecraft:air");
    }
    const inside = freePortal(dim, { x: spot.x, y: spot.y, z: spot.z }, "x");
    bot.mem.portal.nether = inside;
    return { x: inside.x, y: inside.y, z: inside.z + 2 };
  });
  if (!done) return false;
  // step out of the portal so we don't bounce back
  const p = bot.feetBlock();
  if (!isStandable(bot.dim, { x: p.x, y: p.y - 1, z: p.z })) setBlock(bot.dim, { x: p.x, y: p.y - 1, z: p.z }, "minecraft:netherrack");
  bot.save();
  bot.announce("entered the Nether");
  bot.say("nether");
  return true;
}

export function* returnToOverworld(bot) {
  if (bot.dimName === "overworld") return true;
  if (bot.dimName === "the_end") return yield* leaveEnd(bot);
  const portal = bot.mem.portal;
  if (portal && portal.nether) {
    const ok = yield* goTo(bot, { x: portal.nether.x + 0.5, y: portal.nether.y, z: portal.nether.z + 0.5 }, { range: 0.8, timeout: 20 * 300 });
    if (ok) yield* wait(40);
  }
  const ow = (portal && portal.ow) || { x: Math.floor(bot.pos.x * 8), y: 80, z: Math.floor(bot.pos.z * 8) };
  const done = yield* travel(bot, "overworld", ow, (dim) => {
    if (portalIntact(dim, ow)) return { x: ow.x, y: ow.y, z: ow.z + 2 };
    const s = surfaceAt(dim, ow.x, ow.z);
    return s ? { x: s.x, y: s.y, z: s.z } : ow;
  });
  return done;
}

// ---------------------------------------------------------------------------
// Blaze rods
// ---------------------------------------------------------------------------
function* netherExploreStep(bot) {
  if (bot.mem.netherHeading === undefined) bot.mem.netherHeading = pick([0, 90, 180, 270]);
  bot.mem.netherHeading += rand(-20, 20);
  const a = (bot.mem.netherHeading * Math.PI) / 180;
  const p = bot.pos;
  const tgt = { x: p.x + Math.cos(a) * 40, y: Math.max(40, Math.min(100, p.y)), z: p.z + Math.sin(a) * 40 };
  const ok = yield* goTo(bot, tgt, { range: 5, timeout: 20 * 50 });
  if (!ok) bot.mem.netherHeading += rand(60, 120);
  return ok;
}

export function* getBlazeRods(bot, need) {
  if (bot.dimName !== "nether") {
    const ok = yield* enterNether(bot);
    if (!ok) return false;
  }
  const target = bot.inv.count("minecraft:blaze_rod") + need;
  const start = now();
  let lastAssist = 0;
  let lastTick = -1;
  while (bot.inv.count("minecraft:blaze_rod") < target) {
    if (now() === lastTick) yield;
    lastTick = now();
    if (now() - start > 20 * 60 * 10) return false;
    bot.setTask("looking for blazes");
    const blazes = entitiesNear(bot.dim, bot.pos, 40, { type: "minecraft:blaze" }).filter(isAlive);
    if (blazes.length) {
      const r = yield* fight(bot, blazes[0], { preferBow: true, maxTicks: 20 * 40, giveUpDist: 48 });
      if (r === "won") yield* collectNearbyItems(bot, 8, 100);
      continue;
    }
    if (assistReady(bot) && now() - lastAssist > 20 * 40) {
      lastAssist = now();
      spawnNear(bot, "minecraft:blaze", 10);
      yield* wait(20);
      continue;
    }
    let fort = bot.mem.fortress;
    if (!fort) {
      const bricks = findBlocks(bot.dim, bot.pos, ["minecraft:nether_brick"], { radius: 40, up: 20, down: 20, cap: 40 });
      if (bricks.length) {
        fort = bricks[0];
        bot.mem.fortress = fort;
        bot.say("fortress");
        bot.announce("found a Nether Fortress");
      }
    }
    if (fort) {
      const spawner = findBlocks(bot.dim, bot.pos, ["minecraft:mob_spawner"], { radius: 32, up: 16, down: 16, cap: 5 })[0];
      if (spawner) {
        bot.setTask("camping a blaze spawner");
        yield* goTo(bot, V.feet(spawner), { range: 6, timeout: 20 * 60 });
        yield* wait(60);
      } else {
        const bricks = findBlocks(bot.dim, fort, ["minecraft:nether_brick"], { radius: 24, up: 8, down: 8, cap: 60 }).filter((b) => isPassable(bot.dim, { x: b.x, y: b.y + 1, z: b.z }) && isPassable(bot.dim, { x: b.x, y: b.y + 2, z: b.z }));
        const b = bricks.length ? pick(bricks) : null;
        if (b) yield* goTo(bot, { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 }, { range: 3, timeout: 20 * 40 });
        else yield* netherExploreStep(bot);
        bot.mem.fortress = V.dist(bot.pos, fort) > 80 ? undefined : fort;
      }
    } else yield* netherExploreStep(bot);
  }
  bot.announce("got enough blaze rods");
  return true;
}

// ---------------------------------------------------------------------------
// Ender pearls
// ---------------------------------------------------------------------------
export function* getPearls(bot, need) {
  const target = bot.inv.count("minecraft:ender_pearl") + need;
  const start = now();
  let lastAssist = 0;
  let lastTick = -1;
  while (bot.inv.count("minecraft:ender_pearl") < target) {
    if (now() === lastTick) yield;
    lastTick = now();
    if (now() - start > 20 * 60 * 8) return false;
    bot.setTask("hunting endermen");
    const men = entitiesNear(bot.dim, bot.pos, 48, { type: "minecraft:enderman" }).filter(isAlive);
    if (men.length) {
      const r = yield* fight(bot, men[0], { maxTicks: 20 * 40, giveUpDist: 56, hunting: true });
      if (r === "won") yield* collectNearbyItems(bot, 8, 100);
      if (r === "flee") return false;
      continue;
    }
    const night = world.getTimeOfDay() >= 13000 && world.getTimeOfDay() <= 23000;
    if (assistReady(bot) && now() - lastAssist > 20 * 30 && (night || bot.dimName !== "overworld")) {
      lastAssist = now();
      spawnNear(bot, "minecraft:enderman", 12);
      yield* wait(20);
      continue;
    }
    if (bot.dimName === "nether") {
      const forest = findBlocks(bot.dim, bot.pos, ["minecraft:warped_nylium"], { radius: 40, up: 16, down: 16, cap: 20 });
      if (forest.length) yield* goTo(bot, { x: forest[0].x + 0.5, y: forest[0].y + 1, z: forest[0].z + 0.5 }, { range: 4, timeout: 20 * 40 });
      else yield* netherExploreStep(bot);
    } else if (bot.dimName === "overworld") {
      if (!night) return false; // come back at night
      yield* exploreStep(bot, 40);
    } else return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Stronghold & End portal
// ---------------------------------------------------------------------------
function* throwEye(bot) {
  bot.setTask("throwing an eye of ender");
  bot.swing();
  const p = bot.eye;
  for (let i = 0; i < 20; i++) {
    try {
      bot.dim.spawnParticle("minecraft:portal_reverse_particle", { x: p.x, y: p.y + i * 0.4, z: p.z });
    } catch (e) {
      /* ignore */
    }
    if (i % 4 === 0) yield;
  }
  yield* wait(20);
}

function ringPositions(c) {
  const out = [];
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) {
      const edge = Math.abs(x) === 2 || Math.abs(z) === 2;
      const corner = Math.abs(x) === 2 && Math.abs(z) === 2;
      if (edge && !corner) out.push({ x: c.x + x, y: c.y, z: c.z + z, dir: z === -2 ? 0 : x === 2 ? 1 : z === 2 ? 2 : 3 });
    }
  return out;
}

function fillPortal(dim, c) {
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) setBlock(dim, { x: c.x + x, y: c.y, z: c.z + z }, "minecraft:end_portal");
}

function* activateEndPortal(bot, frames) {
  bot.setTask("activating the end portal");
  bot.say("stronghold");
  bot.announce("found a Stronghold");
  const cx = Math.round(frames.reduce((a, f) => a + f.x, 0) / frames.length);
  const cz = Math.round(frames.reduce((a, f) => a + f.z, 0) / frames.length);
  const center = { x: cx, y: frames[0].y, z: cz };
  // refine using all frames around this center
  const all = findBlocks(bot.dim, center, ["minecraft:end_portal_frame"], { radius: 4, up: 1, down: 1, cap: 20 });
  if (all.length >= 8) {
    center.x = Math.round(all.reduce((a, f) => a + f.x, 0) / all.length);
    center.z = Math.round(all.reduce((a, f) => a + f.z, 0) / all.length);
  }
  const ok = yield* goTo(bot, { x: center.x + 0.5, y: center.y, z: center.z + 3.5 }, { range: 4, timeout: 20 * 180 });
  if (!ok) return false;
  for (const f of all.length ? all : frames) {
    const b = getBlock(bot.dim, f);
    if (!b) continue;
    let hasEye = false;
    try {
      hasEye = !!b.permutation.getState("end_portal_eye_bit");
    } catch (e) {
      hasEye = false;
    }
    if (hasEye) continue;
    if (!bot.inv.has("minecraft:ender_eye")) return false;
    bot.motor.look = V.center(f);
    bot.placeAnim();
    try {
      b.setPermutation(b.permutation.withState("end_portal_eye_bit", true));
      bot.inv.remove("minecraft:ender_eye", 1);
      bot.dim.playSound("block.end_portal_frame.fill", V.center(f));
    } catch (e) {
      /* ignore */
    }
    yield* wait(6);
  }
  fillPortal(bot.dim, center);
  try {
    bot.dim.playSound("block.end_portal.spawn", V.center(center), { volume: 1 });
  } catch (e) {
    /* ignore */
  }
  bot.mem.endPortal = center;
  bot.save();
  return true;
}

function* buildOwnEndPortal(bot) {
  bot.setTask("building an end portal");
  bot.say("assist_portal");
  const f = bot.feetBlock();
  const c = { x: f.x + 4, y: f.y, z: f.z };
  // clear and floor
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++) {
      for (let y = 0; y <= 3; y++) setBlock(bot.dim, { x: c.x + x, y: c.y + y, z: c.z + z }, "minecraft:air");
      if (!isStandable(bot.dim, { x: c.x + x, y: c.y - 1, z: c.z + z })) setBlock(bot.dim, { x: c.x + x, y: c.y - 1, z: c.z + z }, "minecraft:cobblestone");
    }
  for (const r of ringPositions(c)) {
    if (!bot.inv.has("minecraft:ender_eye")) return false;
    bot.motor.look = V.center(r);
    bot.placeAnim();
    setBlock(bot.dim, r, "minecraft:end_portal_frame", { end_portal_eye_bit: true, direction: r.dir });
    bot.inv.remove("minecraft:ender_eye", 1);
    yield* wait(5);
  }
  fillPortal(bot.dim, c);
  bot.mem.endPortal = c;
  bot.save();
  return true;
}

export function* findStronghold(bot) {
  if (bot.dimName === "nether") {
    const ok = yield* returnToOverworld(bot);
    if (!ok) return false;
  }
  if (bot.dimName !== "overworld") return bot.dimName === "the_end";
  if (bot.mem.endPortal && typeAt(bot.dim, bot.mem.endPortal) === "minecraft:end_portal") return true;
  bot.mem.shTicks = bot.mem.shTicks || 0;
  const start = now();
  let lastEye = 0;
  let lastTick = -1;
  while (now() - start < 20 * 60 * 6) {
    if (now() === lastTick) yield;
    lastTick = now();
    bot.setTask("searching for a stronghold");
    const frames = findBlocks(bot.dim, bot.pos, ["minecraft:end_portal_frame"], { radius: 32, up: 20, down: 70, cap: 20 });
    if (frames.length) return yield* activateEndPortal(bot, frames);
    const searched = (bot.mem.shTicks + (now() - start)) / 1200;
    if (cfg().endPortalAssist && searched >= cfg().strongholdSearchMinutes) {
      bot.mem.shTicks += now() - start;
      return yield* buildOwnEndPortal(bot);
    }
    if (now() - lastEye > 20 * 120) {
      lastEye = now();
      yield* throwEye(bot);
    }
    // spiral outwards from where we started looking
    if (!bot.mem.shCenter) bot.mem.shCenter = { x: bot.pos.x, z: bot.pos.z, a: 0 };
    const sc = bot.mem.shCenter;
    sc.a += 0.6;
    const r = 60 + sc.a * 25;
    const tx = sc.x + Math.cos(sc.a) * r;
    const tz = sc.z + Math.sin(sc.a) * r;
    const s = surfaceAt(bot.dim, Math.floor(tx), Math.floor(tz));
    if (s) yield* goTo(bot, { x: s.x + 0.5, y: s.y, z: s.z + 0.5, surface: true }, { range: 6, timeout: 20 * 60 });
    else yield* exploreStep(bot, 40);
  }
  bot.mem.shTicks += now() - start;
  return false;
}

// ---------------------------------------------------------------------------
// The End
// ---------------------------------------------------------------------------
export function* enterEnd(bot) {
  if (bot.dimName === "the_end") return true;
  const c = bot.mem.endPortal;
  if (!c) return false;
  const ok = yield* goTo(bot, { x: c.x + 0.5, y: c.y, z: c.z + 2.5 }, { range: 1.5, timeout: 20 * 180 });
  if (!ok) return false;
  steer(bot, { x: c.x + 0.5, y: c.y, z: c.z + 0.5 });
  yield* wait(10);
  const done = yield* travel(bot, "the_end", { x: 100, y: 49, z: 0 }, (dim) => {
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++) {
        setBlock(dim, { x: 100 + x, y: 48, z: z }, "minecraft:obsidian");
        for (let y = 49; y <= 51; y++) setBlock(dim, { x: 100 + x, y, z }, "minecraft:air");
      }
    return { x: 100, y: 49, z: 0 };
  });
  if (!done) return false;
  bot.announce("entered The End");
  bot.say("end");
  return true;
}

function* destroyCrystal(bot, crystal) {
  bot.setTask("destroying end crystals");
  // 1) try arrows
  if (canShoot(bot)) {
    const cp = crystal.location;
    yield* goTo(bot, { x: cp.x + 0.5, y: bot.pos.y, z: cp.z + 0.5 }, { range: 24, timeout: 20 * 60, allowPlace: true });
    for (let i = 0; i < 6 && isAlive(crystal) && canShoot(bot); i++) {
      bot.motor.look = crystal.location;
      try {
        bot.entity.playAnimation("animation.aip.bow");
      } catch (e) {
        /* ignore */
      }
      yield* wait(18);
      if (!crystal.isValid) break;
      shootArrow(bot, crystal, 0.3);
      yield* wait(20);
    }
    if (!crystal.isValid) return true;
  }
  // 2) pillar up next to the tower and hit it
  if (bot.inv.buildingCount() < 48) {
    yield* gatherFromBlocks(bot, "minecraft:end_stone", 56 - bot.inv.buildingCount(), { mine: ["minecraft:end_stone"] }, () => bot.inv.buildingCount());
  }
  if (!crystal.isValid) return true;
  const cp = crystal.location;
  // find ground next to the obsidian pillar
  let base = null;
  for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4], [4, 4], [-4, -4], [5, 0], [0, 5]]) {
    const s = surfaceAt(bot.dim, Math.floor(cp.x) + dx, Math.floor(cp.z) + dz);
    if (s && s.y < cp.y && !s.water) {
      base = s;
      break;
    }
  }
  if (!base) return false;
  const ok = yield* goTo(bot, { x: base.x + 0.5, y: base.y, z: base.z + 0.5 }, { range: 1, timeout: 20 * 90 });
  if (!ok) return false;
  const groundY = bot.feetBlock().y;
  for (let i = 0; i < 80 && crystal.isValid && bot.pos.y < cp.y - 2.5; i++) {
    const up = yield* pillarUp(bot);
    if (!up) break;
  }
  if (crystal.isValid && V.dist(bot.eye, crystal.location) < 7.5) {
    bot.motor.look = crystal.location;
    yield;
    meleeHit(bot, crystal);
    yield* wait(10);
  }
  // climb back down our own pillar
  for (let i = 0; i < 90 && bot.feetBlock().y > groundY; i++) {
    const f = bot.feetBlock();
    const below = { x: f.x, y: f.y - 1, z: f.z };
    const mined = yield* mineBlock(bot, below, { force: true });
    if (!mined) break;
    yield* wait(6);
  }
  return !crystal.isValid;
}

export function* dragonFight(bot) {
  if (bot.dimName !== "the_end") {
    const ok = yield* enterEnd(bot);
    if (!ok) return false;
  }
  const dim = bot.dim;
  addTickingArea(dim, { x: 0, y: 64, z: 0 }, "aip_end", 4);
  bot.setTask("heading to the island");
  yield* goTo(bot, { x: 0.5, y: 64, z: 0.5 }, { range: 28, timeout: 20 * 240, allowPlace: true });
  const start = now();
  let noDragon = 0;
  bot.say("dragon");
  let lastTick = -1;
  while (now() - start < 20 * 60 * 15) {
    if (now() === lastTick) yield;
    lastTick = now();
    if (world.getDynamicProperty("aip:dragonDead") === true && !entitiesNear(dim, { x: 0, y: 70, z: 0 }, 300, { type: "minecraft:ender_dragon" }).length) {
      return yield* victory(bot);
    }
    const crystals = entitiesNear(dim, { x: 0, y: 70, z: 0 }, 140, { type: "minecraft:ender_crystal" });
    if (crystals.length) {
      crystals.sort((a, b) => V.dist2(a.location, bot.pos) - V.dist2(b.location, bot.pos));
      yield* destroyCrystal(bot, crystals[0]);
      continue;
    }
    const dragons = entitiesNear(dim, { x: 0, y: 70, z: 0 }, 300, { type: "minecraft:ender_dragon" }).filter(isAlive);
    if (!dragons.length) {
      noDragon++;
      yield* wait(40);
      if (noDragon > 5) {
        if (world.getDynamicProperty("aip:dragonDead") !== true && cfg().summonDragonIfMissing) {
          try {
            dim.spawnEntity("minecraft:ender_dragon", { x: 0, y: 90, z: 0 });
            world.sendMessage("§5The Ender Dragon awakens...");
          } catch (e) {
            return false;
          }
          noDragon = -10;
        } else return yield* victory(bot);
      }
      continue;
    }
    noDragon = 0;
    const dragon = dragons[0];
    bot.setTask("fighting the Ender Dragon!");
    const d = V.dist(bot.pos, dragon.location);
    if (d < 9) {
      bot.motor.look = dragon.location;
      if (!bot.dragonCd || bot.dragonCd <= 0) {
        meleeHit(bot, dragon);
        bot.dragonCd = 12;
      }
      bot.dragonCd--;
      yield;
    } else if (canShoot(bot) && d < 64) {
      const r = yield* fight(bot, dragon, { preferBow: true, maxTicks: 60, noFlee: true, giveUpDist: 90, aimY: 2 });
      if (r === "won") return yield* victory(bot);
    } else {
      // wait for it to perch on the fountain
      const s = surfaceAt(dim, 3, 3);
      yield* goTo(bot, s ? { x: 3.5, y: s.y, z: 3.5 } : { x: 3.5, y: 64, z: 3.5 }, { range: 3, timeout: 100 });
      yield* wait(10);
    }
  }
  return false;
}

export function* victory(bot) {
  removeTickingArea("the_end", "aip_end");
  bot.mem.flags.beatGame = true;
  bot.mem.beatGameTick = now();
  bot.stats.wins = (bot.stats.wins || 0) + 1;
  bot.mode = "free";
  bot.save();
  world.sendMessage(`§6§l${bot.name} has beaten the game!§r §7(killed the Ender Dragon)`);
  for (const p of world.getAllPlayers()) {
    try {
      p.playSound("ui.toast.challenge_complete");
    } catch (e) {
      /* ignore */
    }
  }
  bot.say("victory");
  yield* wait(60);
  return yield* leaveEnd(bot);
}

export function* leaveEnd(bot) {
  const home = bot.mem.home || (bot.mem.portal && bot.mem.portal.ow);
  let dest = home;
  if (!dest) {
    try {
      const s = world.getDefaultSpawnLocation();
      dest = { x: s.x, y: s.y > 320 ? 80 : s.y, z: s.z };
    } catch (e) {
      dest = { x: 0, y: 80, z: 0 };
    }
  }
  return yield* travel(bot, "overworld", dest, (dim) => {
    const s = surfaceAt(dim, Math.floor(dest.x), Math.floor(dest.z));
    if (home && isPassable(dim, home) && isPassable(dim, { x: home.x, y: home.y + 1, z: home.z })) return home;
    return s ? { x: s.x, y: s.y, z: s.z } : dest;
  });
}
