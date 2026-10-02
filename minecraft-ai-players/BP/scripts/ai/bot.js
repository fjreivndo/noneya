// The Bot: wraps one aip:ai_player entity, its body (vitals, equipment) and its mind (routine stack).
import { world, EntityDamageCause } from "@minecraft/server";
import { cfg } from "../config.js";
import { Inventory } from "../inventory.js";
import { armorInfo, toolInfo, ADVANCEMENTS, FOOD, KILL_BONUS, kindOf, K_WATER } from "../data.js";
import { V, now, chance, rand, prettyItem, dimName, debug, safe, isNight } from "../util.js";
import { loadRecord, saveRecord, addTickingArea, removeTickingArea, tickingName } from "../registry.js";
import { applyMotor } from "./movement.js";
import { skyAbove, typeAt, surfaceAt, isAlive } from "./world.js";
import { decide, onRoutineDone } from "./brain.js";
import { findThreats, assess, fight, flee } from "./combat.js";
import { eat, collectNearbyItems } from "./actions.js";
import { line } from "./chat.js";

const DURABILITY = { wooden: 59, golden: 32, stone: 131, iron: 250, diamond: 1561, netherite: 2031 };

function* combatRoutine(bot, threats) {
  if (assess(bot, threats) === "flee") {
    yield* flee(bot, threats);
    return true;
  }
  for (const t of threats.slice(0, 4)) {
    if (!isAlive(t)) continue;
    const r = yield* fight(bot, t, {});
    if (r === "flee") {
      yield* flee(bot, findThreats(bot, 16));
      return true;
    }
  }
  yield* collectNearbyItems(bot, 5, 60);
  return true;
}

function* eatRoutine(bot) {
  yield* eat(bot);
  return true;
}

export class Bot {
  constructor(entity, id) {
    this.entity = entity;
    this.entityId = entity.id;
    this.id = id;
    this.inv = new Inventory(entity);
    this.motor = { target: null, sprint: false, jump: false, look: null, slow: false };
    this.stack = [];
    this.task = "idle";
    this.shownTag = "";
    this.held = null;
    this.blacklistMap = new Map();
    this.ownBlocks = new Set();
    this.hurtBy = new Map();
    this.rivalIds = new Set();
    this.cooldowns = {};
    this.stuckCount = 0;
    this.ticks = Math.floor(Math.random() * 100);
    this.msTicks = 0;
    this.currentMs = null;
    this.order = null;
    this.tickingDirty = true;
    this.ta = null;
    this.combatTarget = null;
    this.lastChat = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.wasNight = isNight();
    this.lastPos = null;

    const rec = loadRecord(id) || {};
    this.name = rec.name || "Player";
    this.skin = rec.skin ?? 0;
    this.mode = rec.mode || "beat_game";
    this.personality = rec.personality || { bravery: 0.5, curiosity: 0.5, builder: 0.5, ambition: 0.6, sociability: 0.5, chattiness: 0.5 };
    this.mem = rec.mem || {};
    this.mem.flags = this.mem.flags || {};
    this.mem.adv = this.mem.adv || [];
    this.mem.dur = this.mem.dur || {};
    this.stats = Object.assign({ kills: 0, deaths: 0, mined: 0, crafted: 0, wins: 0, born: now() }, rec.stats || {});
    this.worn = rec.worn || {};
    this.food = safe(() => entity.getDynamicProperty("aip:food"), undefined) ?? 20;
    this.sat = safe(() => entity.getDynamicProperty("aip:sat"), undefined) ?? 5;
    this.exh = 0;
  }

  // ----------------------------------------------------------------- basics
  get pos() {
    return this.entity.location;
  }
  get dim() {
    return this.entity.dimension;
  }
  get dimName() {
    return dimName(this.entity.dimension);
  }
  get eye() {
    const p = this.entity.location;
    return { x: p.x, y: p.y + 1.62, z: p.z };
  }
  get health() {
    return safe(() => this.entity.getComponent("minecraft:health").currentValue, 0);
  }
  feetBlock() {
    const p = this.entity.location;
    return { x: Math.floor(p.x), y: Math.floor(p.y + 0.02), z: Math.floor(p.z) };
  }
  occupies(p) {
    const f = this.feetBlock();
    return f.x === p.x && f.z === p.z && (f.y === p.y || f.y + 1 === p.y);
  }
  isUnderground() {
    if (this.dimName !== "overworld") return false;
    if (skyAbove(this.dim, this.pos)) return false;
    const f = this.feetBlock();
    const s = surfaceAt(this.dim, f.x, f.z);
    return !!s && s.y - f.y > 3;
  }
  isHeadUnderwater() {
    const t = typeAt(this.dim, this.eye);
    return !!t && kindOf(t) === K_WATER;
  }
  isFood(id) {
    return !!FOOD[id];
  }
  refreshEntity() {
    if (this.entity && this.entity.isValid) return true;
    const e = safe(() => world.getEntity(this.entityId), undefined);
    if (e && e.isValid) {
      this.entity = e;
      this.inv.entity = e;
      return true;
    }
    return false;
  }
  rebind(entity) {
    this.entity = entity;
    this.entityId = entity.id;
    this.inv.entity = entity;
    this.held = null;
  }

  // ----------------------------------------------------------------- persistence
  record() {
    return { name: this.name, skin: this.skin, mode: this.mode, personality: this.personality, mem: this.mem, stats: this.stats, worn: this.worn };
  }
  save() {
    safe(() => saveRecord(this.id, this.record()), null);
    safe(() => {
      this.entity.setDynamicProperty("aip:food", this.food);
      this.entity.setDynamicProperty("aip:sat", this.sat);
    }, null);
  }

  // ----------------------------------------------------------------- body
  hold(id) {
    const want = id || "air";
    if (this.held === want) return;
    this.held = want;
    safe(() => this.entity.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${want}`), null);
  }
  swing() {
    safe(() => this.entity.playAnimation("animation.aip.swing", { blendOutTime: 0.05 }), null);
  }
  placeAnim() {
    safe(() => this.entity.playAnimation("animation.aip.place", { blendOutTime: 0.05 }), null);
  }
  exhaust(x) {
    this.exh += x;
  }
  armorPoints() {
    let n = 0;
    for (const id of Object.values(this.worn)) {
      const a = id ? armorInfo(id) : null;
      if (a) n += a.points;
    }
    return n;
  }
  fleeHealth() {
    return Math.max(3, 7 - this.personality.bravery * 4);
  }
  equipBest() {
    for (const up of this.inv.armorUpgrades(this.worn)) {
      if (this.inv.remove(up.id, 1).length === 0) continue;
      const old = this.worn[up.info.slot];
      this.worn[up.info.slot] = up.id;
      if (old) this.inv.add(old, 1);
      safe(() => this.entity.runCommand(`replaceitem entity @s ${up.info.slot} 0 ${up.id}`), null);
      safe(() => this.dim.playSound("armor.equip_iron", this.pos, { volume: 0.6 }), null);
    }
    if (!this.combatTarget) {
      const w = this.inv.bestWeapon();
      if (w.id && (this.held === null || this.held === "air")) this.hold(w.id);
    }
  }
  reapplyEquipment() {
    this.held = null;
    for (const [slot, id] of Object.entries(this.worn)) if (id) safe(() => this.entity.runCommand(`replaceitem entity @s ${slot} 0 ${id}`), null);
  }
  damageTool(id) {
    if (!id) return;
    const t = toolInfo(id);
    if (!t && id !== "minecraft:flint_and_steel") return;
    const max = t ? DURABILITY[t.material] : 64;
    this.mem.dur[id] = (this.mem.dur[id] || 0) + 1;
    if (this.mem.dur[id] >= max) {
      this.mem.dur[id] = 0;
      this.inv.remove(id, 1);
      safe(() => this.dim.playSound("random.break", this.pos), null);
      if (this.held === id) this.hold(this.inv.bestWeapon().id);
      if (chance(0.5)) this.chat(`my ${prettyItem(id).toLowerCase()} broke`);
    }
  }

  // ----------------------------------------------------------------- memory helpers
  blacklist(p, ticks) {
    this.blacklistMap.set(V.key(p), now() + ticks);
    if (this.blacklistMap.size > 500) {
      const t = now();
      for (const [k, v] of this.blacklistMap) if (v < t) this.blacklistMap.delete(k);
    }
  }
  isBlacklisted(p) {
    const t = this.blacklistMap.get(V.key(p));
    return t !== undefined && t > now();
  }
  rememberOwnBlock(p) {
    this.ownBlocks.add(V.key(p));
    if (this.ownBlocks.size > 3000) {
      const first = this.ownBlocks.values().next().value;
      this.ownBlocks.delete(first);
    }
  }
  recentlyHurtBy(id) {
    const t = this.hurtBy.get(id);
    return t !== undefined && now() - t < 20 * 30;
  }

  // ----------------------------------------------------------------- talking
  setTask(t) {
    this.task = t;
  }
  chat(text) {
    if (!cfg().chat || !text) return;
    world.sendMessage(`<${this.name}> ${text}`);
    this.lastChat = now();
  }
  say(kind, p) {
    const c = cfg();
    if (!c.chat || c.chatFrequency <= 0) return;
    const gap = 20 * 20 / c.chatFrequency;
    const important = ["victory", "diamonds", "died", "follow_ok", "stay_ok", "free_ok", "home_ok", "build_ok", "join", "leave", "hurt_by_player", "thanks"].includes(kind);
    if (!important && now() - this.lastChat < gap) return;
    if (!important && !chance(Math.min(1, (0.25 + this.personality.chattiness * 0.6) * c.chatFrequency))) return;
    this.chat(line(kind, p));
  }
  announce(text) {
    if (!cfg().announceAdvancements) return;
    world.sendMessage(`§e${this.name} ${text}`);
  }
  onGotItem(id, n) {
    const adv = ADVANCEMENTS[id];
    if (adv && !this.mem.adv.includes(adv)) {
      this.mem.adv.push(adv);
      if (cfg().announceAdvancements) world.sendMessage(`${this.name} has made the advancement §a[${adv}]`);
      if (id === "minecraft:diamond") this.say("diamonds");
      if (id === "minecraft:iron_ingot") this.say("iron");
    }
  }
  onKill(target) {
    const bonus = KILL_BONUS[target.typeId];
    if (bonus) for (const d of bonus()) this.inv.add(d.id, d.n);
    if (target.typeId === "minecraft:player" || target.typeId === "aip:ai_player" || chance(0.08)) this.say("kill");
  }

  // ----------------------------------------------------------------- routines
  push(gen, prio, name, ms) {
    this.stack.push({ gen, prio, name, ms });
  }
  clearRoutines(maxPrio = 1000) {
    while (this.stack.length && this.stack[this.stack.length - 1].prio <= maxPrio) {
      const e = this.stack.pop();
      safe(() => e.gen.return(undefined), null);
      onRoutineDone(this, e, false);
    }
  }
  topPrio() {
    return this.stack.length ? this.stack[this.stack.length - 1].prio : 0;
  }

  // ----------------------------------------------------------------- per tick
  tick() {
    if (!this.refreshEntity()) return;
    this.ticks++;
    if (this.ticks % 20 === 0) this.vitals();
    if (this.ticks % 4 === 0) this.vacuum();
    if (this.ticks % 100 === 0) {
      this.updateTicking();
      this.equipBest();
      this.inv.tidy();
    }
    if (this.ticks % 600 === 0) this.save();
    if (this.ticks % 10 === 0) this.interrupts();

    let top = this.stack[this.stack.length - 1];
    if (!top) {
      const next = decide(this);
      if (next) this.push(next.gen, 10, next.name, next.ms);
      top = this.stack[this.stack.length - 1];
    }
    if (top) {
      try {
        const r = top.gen.next();
        if (r.done) {
          this.stack.splice(this.stack.indexOf(top), 1);
          onRoutineDone(this, top, r.value);
        }
      } catch (e) {
        debug(`${this.name}: ${top.name} crashed: ${e}`);
        const i = this.stack.indexOf(top);
        if (i >= 0) this.stack.splice(i, 1);
        onRoutineDone(this, top, false);
      }
    }
    if (this.currentMs) this.msTicks++;
    applyMotor(this);
    this.updateNameTag();
  }

  interrupts() {
    const prio = this.topPrio();
    // fight / flee
    if (prio < 50) {
      const hurtRecently = [...this.hurtBy.values()].some((t) => now() - t < 100);
      const radius = 8 + this.personality.bravery * 8 + (hurtRecently ? 8 : 0);
      const threats = findThreats(this, radius);
      if (threats.length) {
        this.push(combatRoutine(this, threats), 50, "combat");
        return;
      }
    }
    // eat
    if (prio < 40 && this.inv.bestFood()) {
      const hp = this.health;
      if (this.food <= 14 || (hp < 14 && this.food < 20) || (hp < 8 && this.food < 20)) {
        this.push(eatRoutine(this), 40, "eat");
        return;
      }
    }
    // day / night chatter
    const night = isNight();
    if (night !== this.wasNight) {
      this.wasNight = night;
      if (night && this.dimName === "overworld" && chance(0.3)) this.say("night");
    }
  }

  vitals() {
    // hunger
    while (this.exh >= 4) {
      this.exh -= 4;
      if (this.sat > 0) this.sat = Math.max(0, this.sat - 1);
      else this.food = Math.max(0, this.food - 1);
    }
    this.exh += 0.04; // being alive and busy
    const hpComp = safe(() => this.entity.getComponent("minecraft:health"), undefined);
    if (!hpComp) return;
    const hp = hpComp.currentValue;
    const max = hpComp.effectiveMax;
    if (this.food >= 18 && hp < max) {
      this.regenTimer += this.food >= 20 && this.sat > 0 ? 4 : 1;
      if (this.regenTimer >= 4) {
        this.regenTimer = 0;
        hpComp.setCurrentValue(Math.min(max, hp + 1));
        this.exh += 3;
      }
    }
    if (this.food <= 0) {
      this.starveTimer++;
      if (this.starveTimer >= 4 && hp > 1) {
        this.starveTimer = 0;
        safe(() => this.entity.applyDamage(1, { cause: EntityDamageCause.starve }), null);
        if (chance(0.2)) this.say("hungry");
      }
    }
    if (hp <= 6 && chance(0.05)) this.say("low_health");
  }

  vacuum() {
    let items;
    try {
      items = this.dim.getEntities({ type: "minecraft:item", location: this.pos, maxDistance: 1.9 });
    } catch (e) {
      return;
    }
    if (!items.length) return;
    const c = this.inv.container;
    if (!c) return;
    for (const it of items) {
      try {
        const comp = it.getComponent("minecraft:item");
        if (!comp) continue;
        const stack = comp.itemStack;
        if (c.emptySlotsCount === 0) this.inv.tidy();
        const rest = c.addItem(stack);
        if (rest && rest.amount === stack.amount) continue;
        it.remove();
        this.onGotItem(stack.typeId, stack.amount);
        safe(() => this.dim.playSound("random.pop", this.pos, { volume: 0.3, pitch: rand(1.4, 2) }), null);
        if (rest) safe(() => this.dim.spawnItem(rest, this.pos), null);
      } catch (e) {
        /* item vanished */
      }
    }
  }

  updateTicking(force) {
    if (!cfg().keepChunksLoaded) return;
    const p = this.feetBlock();
    const d = this.dimName;
    if (!force && !this.tickingDirty && this.ta && this.ta.dim === d && Math.abs(this.ta.x - p.x) + Math.abs(this.ta.z - p.z) < 20) return;
    const name = tickingName(this.id);
    if (this.ta && this.ta.dim !== d) removeTickingArea(this.ta.dim, name);
    const ok = addTickingArea(this.dim, p, name, 2);
    this.ta = ok ? { x: p.x, z: p.z, dim: d } : null;
    this.tickingDirty = false;
  }

  updateNameTag() {
    if (this.ticks % 10 !== 0) return;
    const tag = cfg().showTaskInName ? `${this.name}\n§7${this.task}` : this.name;
    if (tag !== this.shownTag) {
      this.shownTag = tag;
      safe(() => {
        this.entity.nameTag = tag;
      }, null);
    }
  }

  destroy() {
    this.clearRoutines();
    removeTickingArea(null, tickingName(this.id));
  }
}
