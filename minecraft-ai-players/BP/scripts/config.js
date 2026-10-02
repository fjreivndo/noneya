import { world } from "@minecraft/server";

// Number of skins shipped in the resource pack (RP/textures/entity/aip_skins).
// Skins whose index % 3 == 2 use slim (Alex-style) arms.
export const SKIN_COUNT = 48;

/**
 * Default configuration. Everything here can also be changed in-game with the
 * AI Player Controller item (Settings), which saves to the world.
 * Editing these values changes the defaults for new worlds.
 */
export const DEFAULTS = {
  // --- population ---
  maxBots: 6, // hard cap of AI players alive at once
  autoJoin: false, // AI players "join the server" by themselves
  autoJoinMinutes: 8, // average minutes between automatic joins
  targetPopulation: 3, // auto-join stops once this many bots are online
  respawn: true, // bots respawn (keeping their name, skin and memories) after dying
  respawnSeconds: 8,
  keepChunksLoaded: true, // each bot keeps a small ticking area around itself (max 10 per world)

  // --- behaviour ---
  defaultMode: "random", // random | beat_game | survivor | builder | explorer
  pvp: "retaliate", // off | retaliate | aggressive
  botsFightBots: false,
  mobsTargetBots: true, // hostile mobs treat bots like players
  canBreakBlocks: true, // bots only ever mine natural blocks (stone, dirt, ores, logs...)
  protectSpawnRadius: 0, // bots won't break or place blocks this close to world spawn (0 = off)
  buildHouses: true,
  oreVision: "honest", // honest = only sees exposed ores, xray = sees ores through walls
  skill: 0.7, // 0..1 aim, reaction time and combat smarts

  // --- speed ---
  miningSpeed: 1.0, // multiplier on block breaking speed
  craftSpeed: 2.0, // multiplier on crafting speed
  smeltSpeed: 4.0, // multiplier on furnace speed
  reach: 5,

  // --- progression help (bots can't read /locate output) ---
  stuckAssistMinutes: 20, // after this long stuck on a step, the bot gets a small nudge (0 = never)
  endPortalAssist: true, // if no stronghold is found in time, the bot builds its own end portal
  strongholdSearchMinutes: 25,
  summonDragonIfMissing: true,
  stuckTeleport: true, // tiny teleports when physically stuck for a long time
  startingKit: "none", // none | basic | iron

  // --- society ---
  botChat: true, // bots talk to each other and act on what they hear
  speechMode: "auto", // auto = Claude via the BDS bridge pack when present, otherwise generated speech; generated = never use the LLM
  towns: true, // bots found towns that grow into cities
  maxTowns: 4,
  religions: true, // bots found and spread religions
  maxReligions: 3,
  events: true, // bots plan feasts, festivals, worship, elections, build days...
  mistakes: 1.0, // how error-prone bots are (0 = never make mistakes)

  // --- chat / display ---
  chat: true,
  chatFrequency: 1.0, // 0..3
  announceAdvancements: true,
  showTaskInName: true,
  joinLeaveMessages: true,
  debug: false,

  // --- performance ---
  pathNodeLimit: 1500,
};

export const OPTIONS = {
  defaultMode: ["random", "beat_game", "survivor", "builder", "explorer"],
  pvp: ["off", "retaliate", "aggressive"],
  oreVision: ["honest", "xray"],
  startingKit: ["none", "basic", "iron"],
  speechMode: ["auto", "generated"],
};

let cache = null;

export function cfg() {
  if (cache) return cache;
  let saved = {};
  try {
    const raw = world.getDynamicProperty("aip:config");
    if (typeof raw === "string") saved = JSON.parse(raw);
  } catch (e) {
    saved = {};
  }
  cache = Object.assign({}, DEFAULTS, saved);
  return cache;
}

export function saveConfig(next) {
  cache = Object.assign({}, DEFAULTS, next);
  world.setDynamicProperty("aip:config", JSON.stringify(cache));
  return cache;
}

export function resetConfig() {
  world.setDynamicProperty("aip:config", undefined);
  cache = null;
  return cfg();
}
