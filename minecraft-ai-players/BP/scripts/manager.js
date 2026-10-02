// Keeps track of all AI players: spawning, identity, death/respawn, auto-join.
import { world, system } from "@minecraft/server";
import { cfg, SKIN_COUNT } from "./config.js";
import { randomUsername } from "./names.js";
import { Bot } from "./ai/bot.js";
import { journal, rememberPlace } from "./ai/cognition.js";
import { deliver } from "./society.js";
import { tickEvents } from "./ai/events.js";
import { pickMode, randomPersonality } from "./ai/brain.js";
import { loadRecord, saveRecord, deleteRecord, takenNames, allRecords } from "./registry.js";
import { now, pick, rand, randInt, chance, safe, getDim, debug, prettyItem } from "./util.js";
import { isPassable, isStandable } from "./ai/world.js";

export const TYPE = "aip:ai_player";
export const bots = new Map(); // botId -> Bot
const pendingRespawn = new Map(); // botId -> {at, dim, pos}
let nextAutoJoin = 0;

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

export function botByEntity(e) {
  if (!e) return undefined;
  const id = safe(() => e.getDynamicProperty("aip:id"), undefined);
  return id ? bots.get(id) : undefined;
}

export function onlineBots() {
  return [...bots.values()].filter((b) => b.entity && b.entity.isValid);
}

function applyIdentity(entity, rec) {
  safe(() => entity.setProperty("aip:skin", rec.skin % SKIN_COUNT), null);
  safe(() => entity.setProperty("aip:slim", rec.skin % 3 === 2), null);
  safe(() => {
    entity.nameTag = rec.name;
  }, null);
  safe(() => entity.triggerEvent(cfg().mobsTargetBots ? "aip:set_targetable" : "aip:set_untargetable"), null);
}

function giveStartingKit(bot) {
  const kit = cfg().startingKit;
  if (kit === "basic") {
    for (const [id, n] of [["minecraft:stone_pickaxe", 1], ["minecraft:stone_sword", 1], ["minecraft:stone_axe", 1], ["minecraft:bread", 8], ["minecraft:oak_log", 8], ["minecraft:torch", 8]]) bot.inv.add(id, n);
  } else if (kit === "iron") {
    for (const [id, n] of [["minecraft:iron_pickaxe", 1], ["minecraft:iron_sword", 1], ["minecraft:iron_axe", 1], ["minecraft:cooked_beef", 16], ["minecraft:oak_log", 16], ["minecraft:torch", 16], ["minecraft:iron_chestplate", 1], ["minecraft:iron_helmet", 1], ["minecraft:cobblestone", 32]]) bot.inv.add(id, n);
  }
  bot.equipBest();
}

/** Creates a brand new identity for a freshly spawned entity. */
function initNew(entity, opts = {}) {
  const id = shortId();
  const rec = {
    name: opts.name || randomUsername(takenNames()),
    skin: opts.skin ?? randInt(0, SKIN_COUNT - 1),
    mode: opts.mode || (cfg().defaultMode === "random" ? pickMode() : cfg().defaultMode),
    personality: randomPersonality(),
    mem: { flags: {}, adv: [], dur: {} },
    stats: { kills: 0, deaths: 0, mined: 0, crafted: 0, wins: 0, born: now() },
    worn: {},
  };
  entity.setDynamicProperty("aip:id", id);
  saveRecord(id, rec);
  applyIdentity(entity, rec);
  const bot = new Bot(entity, id);
  bots.set(id, bot);
  giveStartingKit(bot);
  if (cfg().joinLeaveMessages) world.sendMessage(`§e${rec.name} joined the game`);
  system.runTimeout(() => bot.say("join"), randInt(40, 120));
  debug(`${rec.name} spawned as ${rec.mode}`);
  return bot;
}

/** Attaches a Bot to an existing entity (after world load or respawn). */
export function attach(entity) {
  let id = safe(() => entity.getDynamicProperty("aip:id"), undefined);
  if (typeof id !== "string" || !loadRecord(id)) return initNew(entity);
  let bot = bots.get(id);
  if (bot) {
    const same = safe(() => bot.entity.id === entity.id, false);
    if (!same && (!bot.entity || !bot.entity.isValid)) bot.rebind(entity);
    else if (!same) {
      // duplicate (e.g. a copied entity): give it its own identity
      return initNew(entity);
    }
    return bot;
  }
  bot = new Bot(entity, id);
  bots.set(id, bot);
  applyIdentity(entity, loadRecord(id));
  bot.reapplyEquipment();
  return bot;
}

export function spawnBot(dim, pos, opts = {}) {
  if (onlineBots().length >= cfg().maxBots) return undefined;
  let entity;
  try {
    entity = dim.spawnEntity(TYPE, pos);
  } catch (e) {
    return undefined;
  }
  return initNew(entity, opts);
}

/** Find a spawn spot near a player (not on top of them). */
export function spotNear(player, min = 3, max = 8) {
  const dim = player.dimension;
  const p = player.location;
  for (let i = 0; i < 20; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(min, max);
    const x = Math.floor(p.x + Math.cos(a) * r);
    const z = Math.floor(p.z + Math.sin(a) * r);
    for (let dy = 3; dy >= -3; dy--) {
      const y = Math.floor(p.y) + dy;
      if (isPassable(dim, { x, y, z }) && isPassable(dim, { x, y: y + 1, z }) && isStandable(dim, { x, y: y - 1, z })) return { x: x + 0.5, y, z: z + 0.5 };
    }
  }
  return { x: p.x + 1, y: p.y, z: p.z + 1 };
}

export function removeBot(bot, silent) {
  bot.destroy();
  if (!silent && cfg().joinLeaveMessages) world.sendMessage(`§e${bot.name} left the game`);
  safe(() => bot.entity.remove(), null);
  bots.delete(bot.id);
}

export function forgetBot(bot) {
  removeBot(bot, false);
  deleteRecord(bot.id);
}

// ---------------------------------------------------------------------------
// Death & respawn
// ---------------------------------------------------------------------------
const CAUSE_TEXT = {
  fall: "fell from a high place", lava: "tried to swim in lava", fire: "went up in flames", fireTick: "burned to death",
  drowning: "drowned", suffocation: "suffocated in a wall", starve: "starved to death", void: "fell out of the world",
  blockExplosion: "blew up", entityExplosion: "was blown up", magic: "was killed by magic", wither: "withered away",
  freezing: "froze to death", contact: "was pricked to death", lightning: "was struck by lightning", projectile: "was shot",
};

export function onBotDeath(entity, source) {
  const bot = botByEntity(entity);
  if (!bot) return;
  let msg;
  const killer = source && source.damagingEntity;
  if (killer) {
    let kname;
    try {
      kname = killer.typeId === "minecraft:player" ? killer.name : killer.nameTag ? killer.nameTag.split("\n")[0] : prettyItem(killer.typeId);
    } catch (e) {
      kname = "something";
    }
    msg = source.cause === "projectile" ? `${bot.name} was shot by ${kname}` : `${bot.name} was slain by ${kname}`;
  } else msg = `${bot.name} ${CAUSE_TEXT[source && source.cause] || "died"}`;
  world.sendMessage(msg);
  bot.stats.deaths++;
  const by = killer ? safe(() => (killer.typeId === "minecraft:player" ? killer.name : prettyItem(killer.typeId).toLowerCase()), "something") : CAUSE_TEXT[source && source.cause] ? (source.cause === "fall" ? "fall damage" : source.cause) : "something";
  journal(bot, "died", { by });
  rememberPlace(bot, "danger", bot.pos, bot.dimName);
  deliver({ from: bot.id, fromName: bot.name, intent: "died", data: {}, text: msg, depth: 0 });
  bot.say("died");
  // armor is dropped by the equipment component; forget what we wore
  bot.worn = {};
  bot.mem.dur = {};
  bot.food = 20;
  bot.sat = 5;
  bot.save();
  bot.destroy();
  bots.delete(bot.id);
  for (const other of onlineBots()) if (chance(0.3)) system.runTimeout(() => other.say("bot_died", bot.name), randInt(20, 80));
  if (cfg().respawn) {
    pendingRespawn.set(bot.id, { at: now() + cfg().respawnSeconds * 20 });
  }
}

function respawnPoint(rec) {
  const home = rec.mem && rec.mem.home;
  const ow = getDim("overworld");
  if (home) return { dim: ow, pos: { x: home.x + 0.5, y: home.y, z: home.z + 0.5 } };
  const players = world.getAllPlayers();
  if (players.length) {
    const p = pick(players);
    return { dim: p.dimension, pos: spotNear(p, 8, 20) };
  }
  return undefined;
}

function processRespawns() {
  for (const [id, r] of pendingRespawn) {
    if (now() < r.at) continue;
    const rec = loadRecord(id);
    if (!rec) {
      pendingRespawn.delete(id);
      continue;
    }
    const sp = respawnPoint(rec);
    if (!sp) continue;
    let entity;
    try {
      entity = sp.dim.spawnEntity(TYPE, sp.pos);
    } catch (e) {
      // chunk not loaded yet; try near a player instead next time
      const players = world.getAllPlayers();
      if (!players.length) continue;
      const p = pick(players);
      try {
        entity = p.dimension.spawnEntity(TYPE, spotNear(p, 6, 14));
      } catch (e2) {
        continue;
      }
    }
    pendingRespawn.delete(id);
    entity.setDynamicProperty("aip:id", id);
    entity.setDynamicProperty("aip:food", 20);
    const bot = attach(entity);
    system.runTimeout(() => bot.say("respawn"), 40);
  }
}

// ---------------------------------------------------------------------------
// Auto join / leave
// ---------------------------------------------------------------------------
function autoJoin() {
  const c = cfg();
  if (!c.autoJoin) return;
  const players = world.getAllPlayers();
  if (!players.length) return;
  if (nextAutoJoin === 0) nextAutoJoin = now() + 20 * 60 * c.autoJoinMinutes * rand(0.3, 1);
  if (now() < nextAutoJoin) return;
  nextAutoJoin = now() + 20 * 60 * c.autoJoinMinutes * rand(0.5, 1.5);
  if (onlineBots().length >= Math.min(c.maxBots, c.targetPopulation)) return;
  // returning players come back sometimes
  const offline = allRecords().filter((r) => !bots.has(r.id) && !pendingRespawn.has(r.id));
  const p = pick(players);
  const pos = spotNear(p, 12, 24);
  if (offline.length && chance(0.4)) {
    const r = pick(offline);
    try {
      const e = p.dimension.spawnEntity(TYPE, pos);
      e.setDynamicProperty("aip:id", r.id);
      attach(e);
      if (c.joinLeaveMessages) world.sendMessage(`§e${r.rec.name} joined the game`);
    } catch (e) {
      /* ignore */
    }
    return;
  }
  spawnBot(p.dimension, pos);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
function discover() {
  for (const d of ["overworld", "nether", "the_end"]) {
    let list = [];
    try {
      list = getDim(d).getEntities({ type: TYPE });
    } catch (e) {
      continue;
    }
    for (const e of list) {
      const b = botByEntity(e);
      if (!b || !safe(() => b.entity.id === e.id, false)) attach(e);
    }
  }
  // enforce cap (e.g. spawn eggs)
  const online = onlineBots();
  if (online.length > cfg().maxBots) {
    for (const b of online.slice(cfg().maxBots)) removeBot(b, false);
  }
}

export function startLoop() {
  system.runInterval(() => {
    for (const bot of bots.values()) {
      try {
        bot.tick();
      } catch (e) {
        debug(`tick error ${bot.name}: ${e}`);
      }
    }
  }, 1);
  system.runInterval(() => {
    try {
      discover();
      processRespawns();
      autoJoin();
      tickEvents(onlineBots());
    } catch (e) {
      debug(`manager error: ${e}`);
    }
  }, 40);
}

export function respawnPending() {
  return pendingRespawn;
}

export function greetPlayer(player) {
  for (const b of onlineBots()) if (chance(0.5)) system.runTimeout(() => b.say("greet_player", player.name), randInt(30, 120));
}

export function onPlayerDeath(player) {
  for (const b of onlineBots()) if (chance(0.35)) system.runTimeout(() => b.say("player_died", player.name), randInt(20, 80));
}

export function applyTargetingToAll() {
  for (const b of onlineBots()) safe(() => b.entity.triggerEvent(cfg().mobsTargetBots ? "aip:set_targetable" : "aip:set_untargetable"), null);
}
