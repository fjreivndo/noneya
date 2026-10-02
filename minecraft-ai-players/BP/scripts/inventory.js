import { ItemStack } from "@minecraft/server";
import { matches, toolInfo, armorInfo, weaponDamage, FOOD, blockInfo, breakTicks } from "./data.js";

/** Thin wrapper around an entity's 36-slot inventory container. */
export class Inventory {
  constructor(entity) {
    this.entity = entity;
  }

  get container() {
    const inv = this.entity.getComponent("minecraft:inventory");
    return inv ? inv.container : undefined;
  }

  /** @returns {{slot:number, item:import("@minecraft/server").ItemStack}[]} */
  items() {
    const c = this.container;
    const out = [];
    if (!c) return out;
    for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it) out.push({ slot: i, item: it });
    }
    return out;
  }

  count(idOrGroup) {
    let n = 0;
    for (const { item } of this.items()) if (matches(idOrGroup, item.typeId)) n += item.amount;
    return n;
  }

  has(idOrGroup, n = 1) {
    return this.count(idOrGroup) >= n;
  }

  /** first concrete item id matching a group */
  firstOf(idOrGroup) {
    for (const { item } of this.items()) if (matches(idOrGroup, item.typeId)) return item.typeId;
    return undefined;
  }

  freeSlots() {
    const c = this.container;
    return c ? c.emptySlotsCount : 0;
  }

  /** Adds items; returns how many did not fit. */
  add(id, n = 1) {
    const c = this.container;
    if (!c || n <= 0) return n;
    let left = n;
    let max = 64;
    try {
      max = new ItemStack(id, 1).maxAmount;
    } catch (e) {
      return n; // unknown item id in this version
    }
    while (left > 0) {
      const amt = Math.min(left, max);
      const rest = c.addItem(new ItemStack(id, amt));
      if (rest) {
        left -= amt - rest.amount;
        break;
      }
      left -= amt;
    }
    return left;
  }

  /** Removes n of an item/group. Returns list of removed concrete ids (with repetition by stack). */
  remove(idOrGroup, n = 1) {
    const c = this.container;
    const removed = [];
    if (!c) return removed;
    let left = n;
    for (let i = 0; i < c.size && left > 0; i++) {
      const it = c.getItem(i);
      if (!it || !matches(idOrGroup, it.typeId)) continue;
      const take = Math.min(left, it.amount);
      removed.push({ id: it.typeId, n: take });
      left -= take;
      if (take >= it.amount) c.setItem(i, undefined);
      else {
        it.amount -= take;
        c.setItem(i, it);
      }
    }
    return removed;
  }

  bestTool(kind) {
    let best = null;
    for (const { item } of this.items()) {
      const t = toolInfo(item.typeId);
      if (t && t.kind === kind && (!best || t.speed > best.speed || t.tier > best.tier)) best = { ...t, id: item.typeId };
    }
    return best;
  }

  toolTier(kind) {
    const t = this.bestTool(kind);
    return t ? t.tier : 0;
  }

  /** item id best suited to break this block (or undefined for hand) */
  toolFor(typeId) {
    const info = blockInfo(typeId);
    if (!info.tool) return undefined;
    const t = this.bestTool(info.tool);
    return t ? t.id : undefined;
  }

  ticksToBreak(typeId) {
    return breakTicks(typeId, this.toolFor(typeId));
  }

  bestWeapon() {
    let best;
    let dmg = 1;
    for (const { item } of this.items()) {
      const d = weaponDamage(item.typeId);
      if (d > dmg) {
        dmg = d;
        best = item.typeId;
      }
    }
    return { id: best, damage: dmg };
  }

  bestFood() {
    let best;
    let score = -1;
    for (const { item } of this.items()) {
      const f = FOOD[item.typeId];
      if (!f) continue;
      let s = f[0] + f[1];
      if (item.typeId === "minecraft:rotten_flesh") s = 0.5;
      if (item.typeId === "minecraft:chicken") s -= 2;
      if (s > score) {
        score = s;
        best = item.typeId;
      }
    }
    return best;
  }

  foodPoints() {
    let n = 0;
    for (const { item } of this.items()) {
      const f = FOOD[item.typeId];
      if (f && item.typeId !== "minecraft:rotten_flesh") n += f[0] * item.amount;
    }
    return n;
  }

  buildingBlock() {
    const order = [
      "minecraft:cobblestone", "minecraft:cobbled_deepslate", "minecraft:netherrack", "minecraft:dirt", "minecraft:end_stone",
      "minecraft:blackstone", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff",
    ];
    for (const id of order) if (this.has(id)) return id;
    const plank = this.firstOf("#planks");
    if (plank && this.count("#planks") > 16) return plank;
    return undefined;
  }

  buildingCount() {
    return this.count("#building");
  }

  /** Armor pieces in the inventory that are better than what's worn. */
  armorUpgrades(worn) {
    const out = [];
    for (const { item } of this.items()) {
      const a = armorInfo(item.typeId);
      if (!a) continue;
      const cur = worn[a.slot] ? armorInfo(worn[a.slot]) : null;
      if (!cur || a.points > cur.points) out.push({ id: item.typeId, info: a });
    }
    return out;
  }

  summary(max = 12) {
    const totals = new Map();
    for (const { item } of this.items()) totals.set(item.typeId, (totals.get(item.typeId) || 0) + item.amount);
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([id, n]) => `${n}x ${id.replace("minecraft:", "")}`);
  }

  /** Drops/discards junk when nearly full. Returns the number of stacks freed. */
  tidy(keep) {
    const c = this.container;
    if (!c || c.emptySlotsCount > 3) return 0;
    const JUNK = {
      "minecraft:dirt": 64, "minecraft:cobblestone": 192, "minecraft:cobbled_deepslate": 64, "minecraft:netherrack": 64,
      "minecraft:gravel": 16, "minecraft:andesite": 0, "minecraft:diorite": 0, "minecraft:granite": 0, "minecraft:tuff": 0,
      "minecraft:rotten_flesh": 8, "minecraft:wheat_seeds": 0, "minecraft:sand": 16, "minecraft:red_sand": 0,
      "minecraft:snowball": 0, "minecraft:bone": 8, "minecraft:arrow": 128, "minecraft:clay_ball": 0, "minecraft:blackstone": 32,
      "minecraft:end_stone": 128, "minecraft:spider_eye": 0, "minecraft:poppy": 0, "minecraft:dandelion": 0, "minecraft:stick": 32,
      "minecraft:raw_copper": 0, "minecraft:gold_nugget": 16, "minecraft:flint": 32, "minecraft:basalt": 0, "minecraft:soul_sand": 0,
    };
    let freed = 0;
    for (const [id, limit] of Object.entries(JUNK)) {
      const lim = keep && keep[id] !== undefined ? keep[id] : limit;
      const have = this.count(id);
      if (have > lim) {
        this.remove(id, have - lim);
        freed++;
      }
    }
    return freed;
  }
}
