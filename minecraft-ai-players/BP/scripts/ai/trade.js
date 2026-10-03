// Trading: an item value model, haggling with players, bot-to-bot deals and (simulated) villager trading.
import { ItemStack } from "@minecraft/server";
import { cfg } from "../config.js";
import { V, pick, chance, now, prettyItem } from "../util.js";
import { matches, toolInfo, armorInfo } from "../data.js";
import { opinionOf, adjustOpinion, journal } from "./cognition.js";
import { entitiesNear, isAlive } from "./world.js";
import { goTo } from "./movement.js";

// rough worth in emeralds
const VALUES = {
  "minecraft:dirt": 0.02, "minecraft:cobblestone": 0.04, "minecraft:cobbled_deepslate": 0.04, "minecraft:gravel": 0.05, "minecraft:sand": 0.05,
  "minecraft:stick": 0.05, "minecraft:torch": 0.15, "minecraft:coal": 0.4, "minecraft:charcoal": 0.3, "minecraft:raw_iron": 1.2,
  "minecraft:iron_ingot": 1.5, "minecraft:raw_gold": 1.8, "minecraft:gold_ingot": 2, "minecraft:raw_copper": 0.3, "minecraft:copper_ingot": 0.4,
  "minecraft:diamond": 10, "minecraft:emerald": 1, "minecraft:lapis_lazuli": 0.3, "minecraft:redstone": 0.2, "minecraft:obsidian": 1.5,
  "minecraft:bread": 0.5, "minecraft:cooked_beef": 0.7, "minecraft:cooked_porkchop": 0.7, "minecraft:cooked_chicken": 0.5, "minecraft:cooked_mutton": 0.5,
  "minecraft:beef": 0.3, "minecraft:porkchop": 0.3, "minecraft:chicken": 0.2, "minecraft:mutton": 0.2, "minecraft:apple": 0.3, "minecraft:wheat": 0.1,
  "minecraft:wheat_seeds": 0.02, "minecraft:carrot": 0.1, "minecraft:potato": 0.1, "minecraft:string": 0.3, "minecraft:feather": 0.2,
  "minecraft:flint": 0.2, "minecraft:arrow": 0.15, "minecraft:leather": 0.5, "minecraft:bone": 0.2, "minecraft:rotten_flesh": 0.03,
  "minecraft:gunpowder": 0.6, "minecraft:ender_pearl": 4, "minecraft:blaze_rod": 5, "minecraft:ender_eye": 9, "minecraft:bucket": 4.5,
  "minecraft:water_bucket": 4.6, "minecraft:white_wool": 0.3, "minecraft:glass": 0.2, "minecraft:cod": 0.3, "minecraft:salmon": 0.4,
  "minecraft:cooked_cod": 0.5, "minecraft:cooked_salmon": 0.6, "minecraft:bow": 2, "minecraft:shield": 2.5, "minecraft:book": 1, "minecraft:paper": 0.15,
};
const MAT_VALUE = { wooden: 0.3, stone: 0.4, golden: 4, iron: 1.5, diamond: 10, netherite: 40 };
const SHAPE = { pickaxe: 3, axe: 3, sword: 2, shovel: 1, hoe: 2, helmet: 5, chestplate: 8, leggings: 7, boots: 4 };

export function valueOf(id) {
  if (VALUES[id] !== undefined) return VALUES[id];
  if (matches("#logs", id)) return 0.15;
  if (matches("#planks", id)) return 0.04;
  if (matches("#wool", id)) return 0.3;
  const t = toolInfo(id) || armorInfo(id);
  if (t) return (MAT_VALUE[t.material] ?? 1) * (SHAPE[t.kind || t.piece] ?? 2) + 0.2;
  return 0.1;
}

/** How much the bot wants to keep of something (it won't trade below this). */
export function keepAmount(bot, id) {
  if (toolInfo(id)) return bot.inv.bestTool(toolInfo(id).kind)?.id === id ? 1 : 0;
  if (armorInfo(id)) return 0;
  const keep = { "minecraft:cobblestone": 48, "minecraft:torch": 12, "minecraft:coal": 6, "minecraft:iron_ingot": 6, "minecraft:diamond": 3, "minecraft:arrow": 24, "minecraft:ender_pearl": 12, "minecraft:blaze_rod": 7, "minecraft:ender_eye": 12, "minecraft:obsidian": 10 };
  if (bot.isFood(id)) return 6;
  return keep[id] ?? 1;
}

export function surplus(bot) {
  const out = [];
  const seen = new Set();
  for (const { item } of bot.inv.items()) {
    if (seen.has(item.typeId)) continue;
    seen.add(item.typeId);
    const n = bot.inv.count(item.typeId) - keepAmount(bot, item.typeId);
    if (n > 0) out.push({ id: item.typeId, n, value: valueOf(item.typeId) * n });
  }
  return out.sort((a, b) => b.value - a.value);
}

/** Price multiplier: greedy bots and bots that dislike you charge more. */
function markup(bot, key) {
  const p = bot.personality;
  return Math.max(0.6, 1.25 - (p.generosity ?? 0.5) * 0.35 - opinionOf(bot, key) / 250);
}

// ---------------------------------------------------------------------------
// Player trades
// ---------------------------------------------------------------------------
const pending = new Map(); // `${botId}|${player}` -> offer

function countPlayer(player, id) {
  const c = player.getComponent("minecraft:inventory")?.container;
  if (!c) return 0;
  let n = 0;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it && matches(id, it.typeId)) n += it.amount;
  }
  return n;
}

function takeFromPlayer(player, id, n) {
  const c = player.getComponent("minecraft:inventory")?.container;
  if (!c) return [];
  const got = [];
  let left = n;
  for (let i = 0; i < c.size && left > 0; i++) {
    const it = c.getItem(i);
    if (!it || !matches(id, it.typeId)) continue;
    const take = Math.min(left, it.amount);
    got.push({ id: it.typeId, n: take });
    left -= take;
    if (take >= it.amount) c.setItem(i, undefined);
    else {
      it.amount -= take;
      c.setItem(i, it);
    }
  }
  return got;
}

function giveToPlayer(bot, player, id, n) {
  const moved = bot.inv.remove(id, n);
  const c = player.getComponent("minecraft:inventory")?.container;
  for (const m of moved) {
    try {
      const rest = c ? c.addItem(new ItemStack(m.id, m.n)) : new ItemStack(m.id, m.n);
      if (rest) bot.dim.spawnItem(rest, player.location);
    } catch (e) {
      /* ignore */
    }
  }
  return moved.reduce((a, m) => a + m.n, 0);
}

/** Parse "5 iron for 1 diamond" / "i'll give you 3 coal for a steak" -> {give, want} from the player's side. */
export function parseTrade(text, itemWord) {
  const t = text.toLowerCase().replace(/\ba\b|\ban\b|\bsome\b/g, "1");
  const parts = t.split(/\bfor\b/);
  if (parts.length < 2) return null;
  const read = (s) => {
    const m = s.match(/(\d+)\s*([a-z_]+(?:\s[a-z_]+)?)/);
    if (!m) {
      const id = itemWord(s);
      return id ? { id, n: 1 } : null;
    }
    const id = itemWord(m[2]) || itemWord(s);
    return id ? { id, n: Math.max(1, Math.min(64, parseInt(m[1], 10))) } : null;
  };
  const give = read(parts[0]);
  const want = read(parts.slice(1).join(" for "));
  return give && want ? { give, want } : null;
}

/** Player proposes a trade. Returns a line to say. */
export function playerOffer(bot, player, offer) {
  if (!cfg().trading) return bot.line("decline", { reason: "not trading right now" });
  const key = `p:${player.name}`;
  const { give, want } = offer; // give = what the player gives, want = what the player wants
  const have = bot.inv.count(want.id);
  const spare = have - keepAmount(bot, want.id);
  if (spare <= 0) return bot.line("give_no", { item: want.id });
  if (countPlayer(player, give.id) < give.n) return bot.line("confused", {}) + ` you dont have ${give.n} ${prettyItem(give.id).toLowerCase()}`;
  const wantN = Math.min(want.n, spare);
  const price = valueOf(want.id) * wantN * markup(bot, key);
  const paid = valueOf(give.id) * give.n;
  if (paid >= price) return completeTrade(bot, player, give, { id: want.id, n: wantN }, key);
  // counter-offer: ask for more of what they offered
  const needN = Math.ceil(price / Math.max(0.01, valueOf(give.id)));
  if (needN > 64 * 4) return bot.line("decline", { reason: "thats a terrible deal" });
  pending.set(`${bot.id}|${player.name}`, { give: { id: give.id, n: needN }, want: { id: want.id, n: wantN }, until: now() + 20 * 60 });
  return `${pick(["hmm", "nah", "no way", "lol no"])}, ${needN} ${prettyItem(give.id).toLowerCase()} for ${wantN} ${prettyItem(want.id).toLowerCase()}? say deal`;
}

export function playerAccepts(bot, player) {
  const k = `${bot.id}|${player.name}`;
  const o = pending.get(k);
  if (!o || now() > o.until) return null;
  pending.delete(k);
  if (countPlayer(player, o.give.id) < o.give.n) return bot.line("confused", {}) + " you dont have enough";
  return completeTrade(bot, player, o.give, o.want, `p:${player.name}`);
}

function completeTrade(bot, player, give, want, key) {
  const got = takeFromPlayer(player, give.id, give.n);
  for (const g of got) bot.inv.add(g.id, g.n);
  const n = giveToPlayer(bot, player, want.id, want.n);
  adjustOpinion(bot, key, 3);
  journal(bot, "traded", { who: player.name, item: want.id });
  bot.swing();
  return `${pick(["deal", "pleasure doing business", "done", "ok here"])}: ${n} ${prettyItem(want.id).toLowerCase()} for ${give.n} ${prettyItem(give.id).toLowerCase()}`;
}

/** "what do you have" / "sell me something": list a few offers with prices. */
export function shopList(bot, player) {
  const s = surplus(bot).filter((x) => x.value > 0.3).slice(0, 3);
  if (!s.length) return bot.line("give_no", { item: "anything to sell" });
  const m = markup(bot, `p:${player.name}`);
  const offers = s.map((x) => {
    const n = Math.min(x.n, valueOf(x.id) >= 1 ? x.n : 16);
    const priceEm = valueOf(x.id) * n * m;
    // ask to be paid in something other than what we're selling
    /** @type {[string, number, string][]} */
    const all = [["minecraft:diamond", 10, "diamond"], ["minecraft:iron_ingot", 1.5, "iron"], ["minecraft:emerald", 1, "emerald"], ["minecraft:coal", 0.4, "coal"]];
    const currencies = all.filter(([cid, v]) => cid !== x.id && priceEm >= v * 0.9);
    const [, cv, cname] = currencies[0] || all[3];
    const pay = `${Math.max(1, Math.ceil(priceEm / cv))} ${cname}`;
    return `${n} ${prettyItem(x.id).toLowerCase()} for ${pay}`;
  });
  return `i can do ${offers.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Bot to bot: offer a trade instead of a gift
// ---------------------------------------------------------------------------
export function proposeBotTrade(bot, requester, item, n) {
  // what could they pay with? something we value that they have spare
  const theirs = surplus(requester).filter((x) => x.id !== item && valueOf(x.id) > 0.1);
  if (!theirs.length) return null;
  const price = valueOf(item) * n * markup(bot, requester.id);
  const pay = theirs.find((x) => x.value >= price) || theirs[0];
  const payN = Math.min(pay.n, Math.max(1, Math.ceil(price / valueOf(pay.id))));
  return { item, n, pay: { id: pay.id, n: payN } };
}

// ---------------------------------------------------------------------------
// Villagers (the stable API can't read villager offers, so trades follow vanilla-like rates)
// ---------------------------------------------------------------------------
/** @type {[string, number][]} */
const SELL = [
  ["minecraft:coal", 15], ["minecraft:wheat", 20], ["minecraft:string", 14], ["minecraft:rotten_flesh", 32], ["minecraft:raw_iron", 4],
  ["minecraft:iron_ingot", 4], ["minecraft:paper", 24], ["minecraft:feather", 24], ["minecraft:flint", 26], ["minecraft:leather", 6],
];
/** @type {[string, number, number, (b: any) => boolean][]} */
const BUY = [
  ["minecraft:bread", 6, 1, (b) => b.inv.foodPoints() < 40],
  ["minecraft:arrow", 16, 1, (b) => b.inv.has("minecraft:bow") && b.inv.count("minecraft:arrow") < 32],
  ["minecraft:cooked_porkchop", 5, 1, (b) => b.inv.foodPoints() < 30],
  ["minecraft:bookshelf", 1, 9, (b) => false],
  ["minecraft:iron_pickaxe", 1, 7, (b) => b.inv.toolTier("pickaxe") < 3],
  ["minecraft:iron_sword", 1, 6, (b) => b.inv.bestWeapon().damage < 6],
  ["minecraft:shield", 1, 5, (b) => !b.inv.has("minecraft:shield")],
];

export function wantsVillagerTrade(bot) {
  if (!cfg().villagerTrading || bot.dimName !== "overworld") return false;
  return SELL.some(([id, n]) => bot.inv.count(id) - keepAmount(bot, id) >= n) || (bot.inv.count("minecraft:emerald") > 0 && BUY.some((b) => b[3](bot)));
}

export function* tradeWithVillagers(bot) {
  const vill = entitiesNear(bot.dim, bot.pos, 80, {}).filter((e) => (e.typeId === "minecraft:villager_v2" || e.typeId === "minecraft:villager") && isAlive(e));
  if (!vill.length) return false;
  const v = vill.sort((a, b) => V.dist2(a.location, bot.pos) - V.dist2(b.location, bot.pos))[0];
  bot.setTask("trading with a villager");
  const ok = yield* goTo(bot, () => (v.isValid ? v.location : undefined), { range: 2.5, timeout: 20 * 90 });
  if (!ok || !v.isValid) return false;
  let earned = 0;
  for (const [id, n] of SELL) {
    while (bot.inv.count(id) - keepAmount(bot, id) >= n && earned < 12) {
      for (let i = 0; i < 25; i++) {
        bot.motor.look = { x: v.location.x, y: v.location.y + 1.6, z: v.location.z };
        yield;
      }
      bot.inv.remove(id, n);
      bot.inv.add("minecraft:emerald", 1);
      earned++;
      try {
        bot.dim.playSound("mob.villager.yes", v.location);
        bot.dim.spawnParticle("minecraft:villager_happy", { x: v.location.x, y: v.location.y + 2, z: v.location.z });
      } catch (e) {
        /* ignore */
      }
    }
  }
  for (const [id, n, cost, want] of BUY) {
    if (!want(bot) || bot.inv.count("minecraft:emerald") < cost) continue;
    for (let i = 0; i < 25; i++) {
      bot.motor.look = { x: v.location.x, y: v.location.y + 1.6, z: v.location.z };
      yield;
    }
    bot.inv.remove("minecraft:emerald", cost);
    bot.inv.add(id, n);
    bot.equipBest();
  }
  if (earned && chance(0.4)) bot.say("smalltalk", {}, { prio: 0 });
  journal(bot, "traded", { who: "a villager", item: "minecraft:emerald" });
  return true;
}
