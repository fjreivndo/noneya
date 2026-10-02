// Static game knowledge: block properties, tools, drops, recipes, food and mobs.
import { strip, randInt, chance } from "./util.js";

const M = (id) => (id.startsWith("minecraft:") || id.startsWith("#") ? id : "minecraft:" + id);

// ---------------------------------------------------------------------------
// Block classification for movement
// ---------------------------------------------------------------------------
export const K_AIR = 0; // walkable through
export const K_SOLID = 1; // can stand on, blocks movement
export const K_WATER = 2;
export const K_LAVA = 3;
export const K_TALL = 4; // fences/walls: blocks movement, can't stand on
export const K_HURT = 5; // solid but hurts to stand on (magma, cactus)
export const K_HAZARD = 6; // passable but harmful (fire, berry bush, powder snow)
export const K_UNLOADED = 7;

const AIR_IDS = new Set([
  "air", "cave_air", "void_air", "structure_void", "light_block", "short_grass", "tall_grass", "fern",
  "large_fern", "dead_bush", "deadbush", "tallgrass", "double_plant", "yellow_flower", "red_flower",
  "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "oxeye_daisy", "cornflower",
  "lily_of_the_valley", "sunflower", "lilac", "rose_bush", "peony", "torchflower", "pitcher_plant",
  "spore_blossom", "reeds", "sugar_cane", "redstone_wire", "tripwire", "trip_wire", "tripwire_hook",
  "lever", "ladder", "web", "cobweb", "snow_layer", "nether_sprouts", "crimson_fungus", "warped_fungus",
  "portal", "end_portal", "end_gateway", "hanging_roots", "glow_lichen", "big_dripleaf", "small_dripleaf_block",
  "mangrove_propagule", "pink_petals", "leaf_litter", "wildflowers", "cactus_flower", "short_dry_grass",
  "tall_dry_grass", "firefly_bush", "bush", "wheat", "carrots", "potatoes", "beetroot", "melon_stem",
  "pumpkin_stem", "torch", "soul_torch", "redstone_torch", "unlit_redstone_torch", "wall_sign",
  "standing_sign", "standing_banner", "wall_banner", "frog_spawn", "sculk_vein", "brown_mushroom",
  "red_mushroom", "seagrass", "kelp", "flower_pot", "moss_carpet", "pale_moss_carpet", "pale_hanging_moss",
  "string", "resin_clump", "eyeblossom", "open_eyeblossom", "closed_eyeblossom",
]);
const AIR_PATTERNS = [
  /_sapling$/, /^sapling$/, /torch$/, /_button$/, /_pressure_plate$/, /rail$/, /_sign$/, /_carpet$/,
  /^carpet$/, /_tulip$/, /_roots$/, /vines/, /_banner$/, /coral_fan/, /_coral$/, /_door$/, /^wooden_door$/,
  /^cave_vines/, /hanging_sign$/, /_petals$/,
];
const WATER_IDS = new Set(["water", "flowing_water", "bubble_column"]);
const LAVA_IDS = new Set(["lava", "flowing_lava"]);
const HURT_IDS = new Set(["magma", "magma_block", "cactus", "pointed_dripstone", "campfire", "soul_campfire"]);
const HAZARD_IDS = new Set(["fire", "soul_fire", "sweet_berry_bush", "powder_snow", "wither_rose"]);
const TALL_PATTERNS = [/fence/, /_wall$/, /^cobblestone_wall$/, /^border_block$/];

const kindCache = new Map();
export function kindOf(typeId) {
  let k = kindCache.get(typeId);
  if (k !== undefined) return k;
  const id = strip(typeId);
  if (HAZARD_IDS.has(id)) k = K_HAZARD;
  else if (AIR_IDS.has(id) || AIR_PATTERNS.some((r) => r.test(id))) k = id === "iron_door" ? K_SOLID : K_AIR;
  else if (WATER_IDS.has(id)) k = K_WATER;
  else if (LAVA_IDS.has(id)) k = K_LAVA;
  else if (HURT_IDS.has(id)) k = K_HURT;
  else if (TALL_PATTERNS.some((r) => r.test(id))) k = K_TALL;
  else k = K_SOLID;
  kindCache.set(typeId, k);
  return k;
}

/** Blocks that a placed block may replace. */
export function isReplaceable(typeId) {
  const id = strip(typeId);
  if (id.includes("door") || id.includes("torch") || id.includes("rail") || id.includes("sign")) return false;
  const k = kindOf(typeId);
  return k === K_AIR || k === K_WATER || k === K_LAVA || id === "fire" || id === "soul_fire";
}

// ---------------------------------------------------------------------------
// Mining knowledge
// ---------------------------------------------------------------------------
// tier: 0 = hand ok, 1 = wooden, 2 = stone, 3 = iron, 4 = diamond
const one = (id) => () => [{ id: M(id), n: 1 }];
const range = (id, a, b) => () => [{ id: M(id), n: randInt(a, b) }];
const none = () => [];

const LEAF_SAPLING = {
  oak: "oak_sapling", birch: "birch_sapling", spruce: "spruce_sapling", jungle: "jungle_sapling",
  acacia: "acacia_sapling", dark_oak: "dark_oak_sapling", mangrove: "mangrove_propagule",
  cherry: "cherry_sapling", azalea: "azalea", pale_oak: "pale_oak_sapling",
};

function leafDrop(id) {
  const type = id.replace("_leaves", "").replace("flowering_", "");
  const out = [];
  if (chance(0.06) && LEAF_SAPLING[type]) out.push({ id: M(LEAF_SAPLING[type]), n: 1 });
  if ((type === "oak" || type === "dark_oak") && chance(0.02)) out.push({ id: M("apple"), n: 1 });
  if (chance(0.03)) out.push({ id: M("stick"), n: randInt(1, 2) });
  return out;
}

const ORE_TIER = { coal: 1, iron: 2, copper: 2, lapis: 2, gold: 3, redstone: 3, lit_redstone: 3, diamond: 3, emerald: 3 };
const ORE_DROP = {
  coal: () => [{ id: M("coal"), n: 1 }],
  iron: () => [{ id: M("raw_iron"), n: 1 }],
  copper: () => [{ id: M("raw_copper"), n: randInt(2, 5) }],
  gold: () => [{ id: M("raw_gold"), n: 1 }],
  lapis: () => [{ id: M("lapis_lazuli"), n: randInt(4, 9) }],
  redstone: () => [{ id: M("redstone"), n: randInt(4, 5) }],
  lit_redstone: () => [{ id: M("redstone"), n: randInt(4, 5) }],
  diamond: () => [{ id: M("diamond"), n: 1 }],
  emerald: () => [{ id: M("emerald"), n: 1 }],
};

// [regex, hardness, tool, tier, drop(id) | null(self), natural]
/** @type {any[]} */
const RULES = [
  [/^(deepslate_|lit_deepslate_)?(coal|iron|copper|gold|lapis|redstone|lit_redstone|diamond|emerald)_ore$/, null, "pickaxe", null, null, true],
  [/^nether_gold_ore$/, 3, "pickaxe", 1, () => range("gold_nugget", 2, 6), true],
  [/^(nether_)?quartz_ore$/, 3, "pickaxe", 1, () => one("quartz"), true],
  [/^ancient_debris$/, 30, "pickaxe", 4, null, true],
  [/^(crying_)?obsidian$/, 50, "pickaxe", 4, null, true],
  [/^stone$/, 1.5, "pickaxe", 1, () => one("cobblestone"), true],
  [/^deepslate$/, 3, "pickaxe", 1, () => one("cobbled_deepslate"), true],
  [/^mossy_cobblestone$/, 2, "pickaxe", 1, null, true],
  [/^(cobblestone|cobbled_deepslate)$/, 2, "pickaxe", 1, null, false],
  [/^(granite|diorite|andesite|tuff|calcite|dripstone_block|smooth_basalt)$/, 1.5, "pickaxe", 1, null, true],
  [/^(red_)?sandstone$/, 0.8, "pickaxe", 1, null, true],
  [/^(.*_)?terracotta$|^hardened_clay$|^stained_hardened_clay$/, 1.25, "pickaxe", 1, null, true],
  [/^netherrack$/, 0.4, "pickaxe", 1, null, true],
  [/^(crimson|warped)_nylium$/, 0.4, "pickaxe", 1, () => one("netherrack"), true],
  [/^(polished_)?basalt$|^blackstone$/, 1.25, "pickaxe", 1, null, true],
  [/^end_stone$/, 3, "pickaxe", 1, null, true],
  [/^magma(_block)?$/, 0.5, "pickaxe", 1, null, true],
  [/^nether_brick$|^nether_bricks$/, 2, "pickaxe", 1, null, false],
  [/^(packed_|blue_)?ice$/, 0.5, "pickaxe", 0, () => none, true],
  [/^grass_block$|^grass$|^grass_path$|^dirt_path$|^farmland$|^mycelium$|^podzol$/, 0.6, "shovel", 0, () => one("dirt"), true],
  [/^(coarse_|rooted_)?dirt$|^mud$|^dirt_with_roots$/, 0.5, "shovel", 0, null, true],
  [/^clay$/, 0.6, "shovel", 0, () => range("clay_ball", 4, 4), true],
  [/^(red_)?sand$|^suspicious_sand$/, 0.5, "shovel", 0, null, true],
  [/^gravel$|^suspicious_gravel$/, 0.6, "shovel", 0, () => () => (chance(0.12) ? [{ id: M("flint"), n: 1 }] : [{ id: M("gravel"), n: 1 }]), true],
  [/^soul_(sand|soil)$/, 0.5, "shovel", 0, null, true],
  [/^snow$/, 0.2, "shovel", 0, () => range("snowball", 4, 4), true],
  [/^snow_layer$/, 0.1, "shovel", 0, () => one("snowball"), true],
  [/_log$|_stem$|_wood$|_hyphae$|^log2?$/, 2, "axe", 0, null, true],
  [/^(muddy_)?mangrove_roots$/, 0.7, "axe", 0, null, true],
  [/leaves/, 0.2, "hoe", 0, (id) => () => leafDrop(id), true],
  [/^(nether|warped)_wart_block$|^shroomlight$/, 1, "hoe", 0, null, true],
  [/^glowstone$/, 0.3, null, 0, () => range("glowstone_dust", 2, 4), true],
  [/^(pumpkin|melon_block|melon)$/, 1, "axe", 0, null, true],
  [/^moss_block$|^pale_moss_block$/, 0.1, "hoe", 0, null, true],
  [/_planks$|^planks$/, 2, "axe", 0, null, false],
  [/^crafting_table$|^chest$|^barrel$|^bookshelf$/, 2.5, "axe", 0, null, false],
  [/^(lit_)?furnace$/, 3.5, "pickaxe", 1, () => one("furnace"), false],
  [/^iron_bars$/, 5, "pickaxe", 1, null, false],
  [/^(bedrock|barrier|end_portal_frame|portal|end_portal|end_gateway|command_block|repeating_command_block|chain_command_block|structure_block|jigsaw|reinforced_deepslate|allow|deny|border_block|light_block|mob_spawner|spawner|trial_spawner|vault)$/, -1, null, 0, () => none, false],
];

// plants that break instantly
const INSTANT = [/^short_grass$|^tall_grass$|^tallgrass$|^fern$|^large_fern$/, /flower|tulip|poppy|dandelion|orchid|allium|bluet|daisy|lily|rose|peony|lilac|sapling|mushroom$|bush$|petals|roots$|sprouts|torch$/];

const infoCache = new Map();

/** @returns {{hardness:number, tool:string|null, tier:number, drop:() => {id:string,n:number}[], natural:boolean}} */
export function blockInfo(typeId) {
  let info = infoCache.get(typeId);
  if (info) return info;
  const id = strip(typeId);
  info = null;
  for (const [re, h, tool, tier, drop, natural] of RULES) {
    if (!re.test(id)) continue;
    if (h === null) {
      // ore
      const m = id.match(re);
      const ore = m[2];
      const deep = id.startsWith("deepslate_") || id.startsWith("lit_deepslate_");
      info = { hardness: deep ? 4.5 : 3, tool, tier: ORE_TIER[ore], drop: ORE_DROP[ore], natural };
    } else {
      info = { hardness: h, tool, tier, drop: drop ? drop(id) : one(id), natural };
    }
    break;
  }
  if (!info) {
    if (INSTANT.some((r) => r.test(id))) {
      const seeds = id === "short_grass" || id === "tall_grass" || id === "tallgrass";
      info = {
        hardness: 0, tool: null, tier: 0, natural: true,
        drop: seeds ? () => (chance(0.12) ? [{ id: M("wheat_seeds"), n: 1 }] : []) : id.includes("torch") ? one(id) : one(id),
      };
      if (id.endsWith("bush") || id.includes("roots") || id.includes("sprouts")) info.drop = none;
    } else {
      info = { hardness: 1.5, tool: null, tier: 0, drop: one(id), natural: false };
    }
  }
  infoCache.set(typeId, info);
  return info;
}

// ---------------------------------------------------------------------------
// Tools, weapons and armor
// ---------------------------------------------------------------------------
export const MATERIAL_TIER = { wooden: 1, golden: 1, stone: 2, iron: 3, diamond: 4, netherite: 5 };
export const MATERIAL_SPEED = { wooden: 2, golden: 12, stone: 4, iron: 6, diamond: 8, netherite: 9 };
const SWORD_DMG = { wooden: 4, golden: 4, stone: 5, iron: 6, diamond: 7, netherite: 8 };

/** Parses "minecraft:iron_pickaxe" -> {material:'iron', kind:'pickaxe'} */
export function toolInfo(itemId) {
  const m = strip(itemId).match(/^(wooden|stone|iron|golden|diamond|netherite)_(pickaxe|axe|shovel|hoe|sword)$/);
  if (!m) return null;
  return { material: m[1], kind: m[2], tier: MATERIAL_TIER[m[1]], speed: MATERIAL_SPEED[m[1]] };
}

export function weaponDamage(itemId) {
  const t = itemId ? toolInfo(itemId) : null;
  if (!t) return 1;
  const base = SWORD_DMG[t.material];
  if (t.kind === "sword") return base;
  if (t.kind === "axe") return base - 0.5;
  if (t.kind === "pickaxe") return base - 2;
  if (t.kind === "shovel") return base - 2.5;
  return 1;
}

/** Break time in ticks for a block with the best tool we hold (null tool = hand). */
export function breakTicks(typeId, tool) {
  const info = blockInfo(typeId);
  if (info.hardness < 0) return Infinity;
  if (info.hardness === 0) return 1;
  const t = tool ? toolInfo(tool) : null;
  const right = !!(t && info.tool && t.kind === info.tool);
  const canHarvest = info.tier === 0 || (right && t.tier >= info.tier);
  let speed = right ? t.speed : 1;
  if (info.tool === "hoe" && !right) speed = 1;
  const seconds = (info.hardness * (canHarvest ? 1.5 : 5)) / speed;
  return Math.max(1, Math.ceil(seconds * 20));
}

export function canHarvest(typeId, tool) {
  const info = blockInfo(typeId);
  if (info.hardness < 0) return false;
  if (info.tier === 0) return true;
  const t = tool ? toolInfo(tool) : null;
  return !!(t && t.kind === info.tool && t.tier >= info.tier);
}

export const ARMOR_SLOTS = { helmet: "slot.armor.head", chestplate: "slot.armor.chest", leggings: "slot.armor.legs", boots: "slot.armor.feet" };
export const ARMOR_VALUE = {
  leather: [1, 3, 2, 1], golden: [2, 5, 3, 1], chainmail: [2, 5, 4, 1], iron: [2, 6, 5, 2], diamond: [3, 8, 6, 3], netherite: [3, 8, 6, 3],
};
export function armorInfo(itemId) {
  const m = strip(itemId).match(/^(leather|golden|chainmail|iron|diamond|netherite)_(helmet|chestplate|leggings|boots)$/);
  if (!m) return null;
  const idx = ["helmet", "chestplate", "leggings", "boots"].indexOf(m[2]);
  return { material: m[1], piece: m[2], slot: ARMOR_SLOTS[m[2]], points: ARMOR_VALUE[m[1]][idx] };
}

// ---------------------------------------------------------------------------
// Item groups
// ---------------------------------------------------------------------------
const WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"];
export const LOG_IDS = [...WOODS.map((w) => M(`${w}_log`)), M("crimson_stem"), M("warped_stem")];
export const PLANK_IDS = [...WOODS.map((w) => M(`${w}_planks`)), M("crimson_planks"), M("warped_planks"), M("bamboo_planks")];

export const GROUPS = {
  "#logs": (id) => /_(log|stem)$/.test(id),
  "#planks": (id) => /_planks$/.test(id),
  "#stone_tool": (id) => id === "minecraft:cobblestone" || id === "minecraft:cobbled_deepslate" || id === "minecraft:blackstone",
  "#coal": (id) => id === "minecraft:coal" || id === "minecraft:charcoal",
  "#wool": (id) => /_wool$/.test(id),
  "#sand": (id) => id === "minecraft:sand" || id === "minecraft:red_sand",
  "#building": (id) =>
    ["minecraft:cobblestone", "minecraft:cobbled_deepslate", "minecraft:dirt", "minecraft:netherrack", "minecraft:blackstone",
      "minecraft:end_stone", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff", "minecraft:sandstone"].includes(id) ||
    /_planks$/.test(id),
  "#food": (id) => !!FOOD[id],
  "#raw_meat": (id) => !!COOK[id],
};

export function matches(group, id) {
  if (!group.startsWith("#")) return group === id;
  const f = GROUPS[group];
  return f ? f(id) : false;
}

export function logToPlanks(logId) {
  const id = strip(logId).replace("stripped_", "");
  if (id === "crimson_stem") return M("crimson_planks");
  if (id === "warped_stem") return M("warped_planks");
  if (id === "log" || id === "log2") return M("oak_planks");
  return M(id.replace(/_log$|_wood$/, "_planks"));
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------
/** out: item -> {n: produced, needs: {item|group: count}, table: needs crafting table} */
export const RECIPES = {
  "#planks": { n: 4, needs: { "#logs": 1 }, table: false, special: "planks" },
  "minecraft:stick": { n: 4, needs: { "#planks": 2 }, table: false },
  "minecraft:crafting_table": { n: 1, needs: { "#planks": 4 }, table: false },
  "minecraft:chest": { n: 1, needs: { "#planks": 8 }, table: true },
  "minecraft:furnace": { n: 1, needs: { "#stone_tool": 8 }, table: true },
  "minecraft:torch": { n: 4, needs: { "#coal": 1, "minecraft:stick": 1 }, table: false },
  "minecraft:bucket": { n: 1, needs: { "minecraft:iron_ingot": 3 }, table: true },
  "minecraft:shield": { n: 1, needs: { "#planks": 6, "minecraft:iron_ingot": 1 }, table: true },
  "minecraft:flint_and_steel": { n: 1, needs: { "minecraft:iron_ingot": 1, "minecraft:flint": 1 }, table: false },
  "minecraft:bow": { n: 1, needs: { "minecraft:stick": 3, "minecraft:string": 3 }, table: true },
  "minecraft:arrow": { n: 4, needs: { "minecraft:flint": 1, "minecraft:stick": 1, "minecraft:feather": 1 }, table: true },
  "minecraft:blaze_powder": { n: 2, needs: { "minecraft:blaze_rod": 1 }, table: false },
  "minecraft:ender_eye": { n: 1, needs: { "minecraft:blaze_powder": 1, "minecraft:ender_pearl": 1 }, table: false },
  "minecraft:bread": { n: 1, needs: { "minecraft:wheat": 3 }, table: true },
  "minecraft:ladder": { n: 3, needs: { "minecraft:stick": 7 }, table: true },
};
const TOOL_SHAPES = { pickaxe: [3, 2], axe: [3, 2], shovel: [1, 2], sword: [2, 1], hoe: [2, 2] };
const TOOL_MATS = { wooden: "#planks", stone: "#stone_tool", iron: "minecraft:iron_ingot", diamond: "minecraft:diamond", golden: "minecraft:gold_ingot" };
for (const [mat, ing] of Object.entries(TOOL_MATS)) {
  for (const [kind, [a, s]] of Object.entries(TOOL_SHAPES)) {
    RECIPES[M(`${mat}_${kind}`)] = { n: 1, needs: { [ing]: a, "minecraft:stick": s }, table: true };
  }
}
const ARMOR_COST = { helmet: 5, chestplate: 8, leggings: 7, boots: 4 };
for (const [mat, ing] of [["iron", "minecraft:iron_ingot"], ["diamond", "minecraft:diamond"], ["golden", "minecraft:gold_ingot"]]) {
  for (const [piece, c] of Object.entries(ARMOR_COST)) RECIPES[M(`${mat}_${piece}`)] = { n: 1, needs: { [ing]: c }, table: true };
}

/** smelting: output -> input */
export const SMELT = {
  "minecraft:iron_ingot": "minecraft:raw_iron",
  "minecraft:gold_ingot": "minecraft:raw_gold",
  "minecraft:copper_ingot": "minecraft:raw_copper",
  "minecraft:charcoal": "#logs",
  "minecraft:glass": "#sand",
  "minecraft:stone": "minecraft:cobblestone",
};
export const COOK = {
  "minecraft:beef": "minecraft:cooked_beef",
  "minecraft:porkchop": "minecraft:cooked_porkchop",
  "minecraft:chicken": "minecraft:cooked_chicken",
  "minecraft:mutton": "minecraft:cooked_mutton",
  "minecraft:rabbit": "minecraft:cooked_rabbit",
  "minecraft:cod": "minecraft:cooked_cod",
  "minecraft:salmon": "minecraft:cooked_salmon",
  "minecraft:potato": "minecraft:baked_potato",
};
for (const [raw, cooked] of Object.entries(COOK)) SMELT[cooked] = raw;

export const FUEL = { "#coal": 8, "#logs": 1.5, "#planks": 1.5, "minecraft:stick": 0.5, "minecraft:blaze_rod": 12, "minecraft:lava_bucket": 100 };

// ---------------------------------------------------------------------------
// Food
// ---------------------------------------------------------------------------
export const FOOD = {
  "minecraft:cooked_beef": [8, 12.8], "minecraft:cooked_porkchop": [8, 12.8], "minecraft:cooked_mutton": [6, 9.6],
  "minecraft:cooked_salmon": [6, 9.6], "minecraft:cooked_chicken": [6, 7.2], "minecraft:cooked_rabbit": [5, 6],
  "minecraft:cooked_cod": [5, 6], "minecraft:bread": [5, 6], "minecraft:baked_potato": [5, 6],
  "minecraft:golden_carrot": [6, 14.4], "minecraft:golden_apple": [4, 9.6], "minecraft:apple": [4, 2.4],
  "minecraft:carrot": [3, 3.6], "minecraft:beef": [3, 1.8], "minecraft:porkchop": [3, 1.8], "minecraft:mutton": [2, 1.2],
  "minecraft:chicken": [2, 1.2], "minecraft:rabbit": [3, 1.8], "minecraft:cod": [2, 0.4], "minecraft:salmon": [2, 0.4],
  "minecraft:melon_slice": [2, 1.2], "minecraft:sweet_berries": [2, 0.4], "minecraft:potato": [1, 0.6],
  "minecraft:rotten_flesh": [4, 0.8], "minecraft:cookie": [2, 0.4], "minecraft:pumpkin_pie": [8, 4.8],
};

// ---------------------------------------------------------------------------
// Mobs
// ---------------------------------------------------------------------------
export const FOOD_ANIMALS = ["minecraft:cow", "minecraft:pig", "minecraft:sheep", "minecraft:chicken", "minecraft:rabbit", "minecraft:mooshroom"];
export const NEUTRAL_MOBS = new Set([
  "minecraft:enderman", "minecraft:zombie_pigman", "minecraft:piglin", "minecraft:wolf", "minecraft:iron_golem",
  "minecraft:bee", "minecraft:llama", "minecraft:trader_llama", "minecraft:panda", "minecraft:polar_bear",
  "minecraft:dolphin", "minecraft:goat", "minecraft:ender_dragon", "minecraft:wither", "minecraft:snow_golem",
]);
export const RANGED_MOBS = new Set([
  "minecraft:skeleton", "minecraft:stray", "minecraft:bogged", "minecraft:blaze", "minecraft:ghast", "minecraft:pillager",
  "minecraft:witch", "minecraft:ender_dragon", "minecraft:phantom", "minecraft:breeze",
]);
export const EXPLODING = new Set(["minecraft:creeper"]);

/** Drops we hand out when a bot kills something (bots pick up the vanilla drops too). */
export const KILL_BONUS = {
  "minecraft:blaze": () => (chance(0.5) ? [{ id: M("blaze_rod"), n: 1 }] : []),
};

// ---------------------------------------------------------------------------
// Where items come from (used by the planner)
// ---------------------------------------------------------------------------
const ORES = (name) => [M(`${name}_ore`), M(`deepslate_${name}_ore`)];
export const SOURCES = {
  "#logs": [{ mine: LOG_IDS, surface: true }],
  "minecraft:cobblestone": [{ mine: [M("stone"), M("cobblestone")], y: null }],
  "#stone_tool": [{ mine: [M("stone"), M("cobblestone"), M("deepslate"), M("cobbled_deepslate"), M("blackstone")] }],
  "minecraft:cobbled_deepslate": [{ mine: [M("deepslate")] }],
  "minecraft:dirt": [{ mine: [M("dirt"), M("grass_block")], surface: true }],
  "minecraft:netherrack": [{ mine: [M("netherrack")] }],
  "minecraft:end_stone": [{ mine: [M("end_stone")] }],
  "#building": [{ mine: [M("stone"), M("cobblestone"), M("deepslate"), M("netherrack"), M("end_stone"), M("dirt"), M("grass_block")] }],
  "minecraft:coal": [{ mine: ORES("coal"), y: 40 }],
  "#coal": [{ mine: ORES("coal"), y: 40 }, { smelt: "minecraft:charcoal" }],
  "minecraft:raw_iron": [{ mine: ORES("iron"), y: 16 }],
  "minecraft:raw_gold": [{ mine: ORES("gold"), y: -16 }],
  "minecraft:raw_copper": [{ mine: ORES("copper"), y: 48 }],
  "minecraft:diamond": [{ mine: ORES("diamond"), y: -54 }],
  "minecraft:redstone": [{ mine: [...ORES("redstone"), M("lit_redstone_ore"), M("lit_deepslate_redstone_ore")], y: -54 }],
  "minecraft:lapis_lazuli": [{ mine: ORES("lapis"), y: 0 }],
  "minecraft:flint": [{ mine: [M("gravel")], chancey: true }],
  "minecraft:gravel": [{ mine: [M("gravel")] }],
  "#sand": [{ mine: [M("sand"), M("red_sand")], surface: true }],
  "minecraft:obsidian": [{ special: "obsidian" }],
  "minecraft:string": [{ kill: [M("spider"), M("cave_spider")] }],
  "minecraft:feather": [{ kill: [M("chicken")] }],
  "minecraft:leather": [{ kill: [M("cow")] }],
  "#wool": [{ kill: [M("sheep")] }],
  "minecraft:white_wool": [{ kill: [M("sheep")] }],
  "minecraft:bone": [{ kill: [M("skeleton")] }],
  "minecraft:gunpowder": [{ kill: [M("creeper")] }],
  "minecraft:ender_pearl": [{ kill: [M("enderman")], night: true }],
  "minecraft:blaze_rod": [{ kill: [M("blaze")], dim: "nether" }],
  "minecraft:beef": [{ kill: [M("cow"), M("mooshroom")] }],
  "minecraft:porkchop": [{ kill: [M("pig")] }],
  "minecraft:chicken": [{ kill: [M("chicken")] }],
  "minecraft:mutton": [{ kill: [M("sheep")] }],
  "#raw_meat": [{ kill: FOOD_ANIMALS }],
  "minecraft:wheat": [{ mine: [M("wheat")], surface: true }],
  "minecraft:water_bucket": [{ special: "water_bucket" }],
  "minecraft:lava_bucket": [{ special: "lava_bucket" }],
};

export const ADVANCEMENTS = {
  "minecraft:crafting_table": "Benchmarking",
  "minecraft:wooden_pickaxe": "Getting Wood",
  "minecraft:stone_pickaxe": "Stone Age",
  "minecraft:furnace": "Hot Topic",
  "minecraft:iron_ingot": "Acquire Hardware",
  "minecraft:iron_pickaxe": "Isn't It Iron Pick",
  "minecraft:diamond": "Diamonds!",
  "minecraft:obsidian": "Ice Bucket Challenge",
  "minecraft:blaze_rod": "Into Fire",
  "minecraft:ender_eye": "Eye Spy",
  "minecraft:bow": "Ol' Betsy",
  "minecraft:shield": "Not Today, Thank You",
  "minecraft:diamond_pickaxe": "Diamonds to you!",
  "minecraft:iron_chestplate": "Suit Up",
  "minecraft:diamond_chestplate": "Cover Me with Diamonds",
};
