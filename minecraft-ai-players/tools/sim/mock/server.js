// Minimal mock of @minecraft/server for headless simulation of the AI.
import { kindOf } from "../scripts/data.js"; // scripts/ is a copy of BP/scripts made by setup.sh

export const EntityDamageCause = { entityAttack: "entityAttack", starve: "starve", fall: "fall", projectile: "projectile" };

let TICK = 0;
const intervals = [];
const timeouts = [];
let nextUid = 1;

function rnd(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const R = rnd(12345);
export const END_PILLARS = [[40, 0], [-40, 0], [0, 40], [0, -40], [28, 28]];
function hash(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export class ItemStack {
  constructor(typeId, amount = 1) {
    if (typeof typeId !== "string" || !typeId.includes(":")) throw new Error("bad item " + typeId);
    this.typeId = typeId;
    this.amount = amount;
  }
  get maxAmount() {
    return /pickaxe|_axe|sword|shovel|hoe|bow|helmet|chestplate|leggings|boots|bucket|flint_and_steel|shield/.test(this.typeId) && !this.typeId.endsWith("bucket_x") ? 1 : this.typeId.includes("ender_pearl") ? 16 : 64;
  }
  clone() {
    return new ItemStack(this.typeId, this.amount);
  }
}

class Container {
  constructor(size) {
    this.size = size;
    this.slots = new Array(size).fill(undefined);
  }
  get emptySlotsCount() {
    return this.slots.filter((s) => !s).length;
  }
  getItem(i) {
    return this.slots[i] ? this.slots[i].clone() : undefined;
  }
  setItem(i, it) {
    this.slots[i] = it ? it.clone() : undefined;
  }
  addItem(it) {
    let left = it.amount;
    const max = it.maxAmount;
    for (let i = 0; i < this.size && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.typeId === it.typeId && s.amount < max) {
        const t = Math.min(left, max - s.amount);
        s.amount += t;
        left -= t;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const t = Math.min(left, max);
        this.slots[i] = new ItemStack(it.typeId, t);
        left -= t;
      }
    }
    return left > 0 ? new ItemStack(it.typeId, left) : undefined;
  }
}

export class BlockPermutation {
  constructor(type, states = {}) {
    this.type = type;
    this.states = states;
  }
  static resolve(type, states = {}) {
    return new BlockPermutation(type, { ...states });
  }
  getState(k) {
    return this.states[k];
  }
  getAllStates() {
    return { ...this.states };
  }
  withState(k, v) {
    return new BlockPermutation(this.type, { ...this.states, [k]: v });
  }
}

export class BlockVolume {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }
}

class Block {
  constructor(dim, x, y, z) {
    this.dimension = dim;
    this.x = x;
    this.y = y;
    this.z = z;
  }
  get typeId() {
    return this.dimension._get(this.x, this.y, this.z);
  }
  get location() {
    return { x: this.x, y: this.y, z: this.z };
  }
  get isValid() {
    return true;
  }
  get permutation() {
    return new BlockPermutation(this.typeId, this.dimension._states.get(`${this.x},${this.y},${this.z}`) || { liquid_depth: 0 });
  }
  setType(id) {
    if (!id.includes(":")) throw new Error("bad block " + id);
    this.dimension._set(this.x, this.y, this.z, id);
  }
  setPermutation(p) {
    this.dimension._set(this.x, this.y, this.z, p.type);
    this.dimension._states.set(`${this.x},${this.y},${this.z}`, p.states);
  }
  getComponent(name) {
    if (name === "minecraft:sign") return { setText: (t) => SIM.log(`[sign] ${t.replace(/\n/g, " / ")}`) };
    if (name === "minecraft:inventory" && this.typeId === "minecraft:chest") {
      const k = `${this.x},${this.y},${this.z}`;
      if (!this.dimension._chests.has(k)) this.dimension._chests.set(k, new Container(27));
      return { container: this.dimension._chests.get(k) };
    }
    return undefined;
  }
}

function solid(t) {
  const k = kindOf(t);
  return k === 1 || k === 4 || k === 5;
}

class Entity {
  constructor(dim, typeId, loc) {
    this.dimension = dim;
    this.typeId = typeId;
    this.id = String(nextUid++);
    this.location = { ...loc };
    this.v = { x: 0, y: 0, z: 0 };
    this.isValid = true;
    this.nameTag = "";
    this.dyn = {};
    this.props = {};
    this.tags = new Set();
    this.hp = { "minecraft:cow": 10, "minecraft:chicken": 4, "minecraft:spider": 16, "minecraft:ender_dragon": 200, "minecraft:ender_crystal": 1, "minecraft:enderman": 40 }[typeId] ?? 20;
    this.maxHp = this.hp;
    this.isOnGround = false;
    this.inv = new Container(36);
    this.equip = {};
    this.rotation = { x: 0, y: 0 };
  }
  get isInWater() {
    const t = this.dimension._get(Math.floor(this.location.x), Math.floor(this.location.y), Math.floor(this.location.z));
    return t === "minecraft:water";
  }
  getComponent(n) {
    if (n === "minecraft:inventory") return { container: this.inv };
    if (n === "minecraft:health") {
      const e = this;
      return {
        get currentValue() {
          return e.hp;
        },
        effectiveMax: this.maxHp,
        setCurrentValue(v) {
          e.hp = v;
          return true;
        },
        resetToMaxValue() {
          e.hp = e.maxHp;
        },
      };
    }
    if (n === "minecraft:item") return this.item ? { itemStack: this.item } : undefined;
    if (n === "minecraft:projectile") {
      const e = this;
      return { set owner(o) { e.owner = o; }, get owner() { return e.owner; }, shoot(v) { e.v = { ...v }; } };
    }
    return undefined;
  }
  getDynamicProperty(k) {
    return this.dyn[k];
  }
  setDynamicProperty(k, v) {
    if (v === undefined) delete this.dyn[k];
    else this.dyn[k] = v;
  }
  setProperty(k, v) {
    this.props[k] = v;
  }
  getProperty(k) {
    return this.props[k];
  }
  triggerEvent() {}
  getVelocity() {
    return { ...this.v };
  }
  applyImpulse(i) {
    this.v.x += i.x;
    this.v.y += i.y;
    this.v.z += i.z;
  }
  applyKnockback(h, vs) {
    this.v.x += h.x;
    this.v.z += h.z;
    this.v.y += vs;
  }
  clearVelocity() {
    this.v = { x: 0, y: 0, z: 0 };
  }
  setRotation(r) {
    this.rotation = r;
  }
  getRotation() {
    return this.rotation;
  }
  getHeadLocation() {
    return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z };
  }
  teleport(loc, opts = {}) {
    if (this.typeId === "aip:ai_player" && (!opts.dimension || opts.dimension === this.dimension)) {
      SIM.teleports.push({ t: TICK, from: { ...this.location }, to: { ...loc }, stack: new Error().stack.split("\n")[2].trim() });
    }
    if (opts.dimension && opts.dimension !== this.dimension) {
      this.dimension._entities.delete(this);
      this.dimension = opts.dimension;
      this.dimension._entities.add(this);
      SIM.log(`[teleport] ${this.nameTag.split("\n")[0]} -> ${this.dimension.id}`);
    }
    this.location = { ...loc };
    this.v = { x: 0, y: 0, z: 0 };
  }
  tryTeleport(loc, o) {
    this.teleport(loc, o);
    return true;
  }
  playAnimation() {}
  runCommand(cmd) {
    const m = cmd.match(/replaceitem entity @s (\S+) 0 (\S+)/);
    if (m) this.equip[m[1]] = m[2];
    return { successCount: 1 };
  }
  matches(opts) {
    if (opts.families) return opts.families.includes("monster") && ["minecraft:zombie", "minecraft:skeleton", "minecraft:blaze", "minecraft:enderman", "minecraft:spider"].includes(this.typeId);
    return true;
  }
  applyDamage(amount, opts = {}) {
    if (!this.isValid || this.hp <= 0) return false;
    this.hp -= amount;
    SIM.emit("entityHurt", { hurtEntity: this, damage: amount, damageSource: { cause: opts.cause, damagingEntity: opts.damagingEntity } });
    if (this.hp <= 0) this.die(opts);
    return true;
  }
  die(opts = {}) {
    this.hp = 0;
    const drops = {
      "minecraft:cow": [["minecraft:beef", 1 + Math.floor(R() * 3)], ["minecraft:leather", Math.floor(R() * 2)]],
      "minecraft:chicken": [["minecraft:chicken", 1], ["minecraft:feather", 1 + Math.floor(R() * 2)]],
      "minecraft:zombie": [["minecraft:rotten_flesh", 1]],
      "minecraft:spider": [["minecraft:string", 1 + Math.floor(R() * 2)]],
      "minecraft:sheep": [["minecraft:mutton", 1], ["minecraft:white_wool", 1]],
      "minecraft:enderman": [["minecraft:ender_pearl", R() < 0.7 ? 1 : 0]],
      "minecraft:skeleton": [["minecraft:bone", 1], ["minecraft:arrow", 2]],
    }[this.typeId] || [];
    for (const [id, n] of drops) if (n > 0) this.dimension.spawnItem(new ItemStack(id, n), this.location);
    if (this.typeId === "aip:ai_player") for (const s of this.inv.slots) if (s) this.dimension.spawnItem(s, this.location);
    SIM.emit("entityDie", { deadEntity: this, damageSource: { cause: opts.cause || "none", damagingEntity: opts.damagingEntity } });
    this.remove();
  }
  kill() {
    this.die();
    return true;
  }
  remove() {
    this.isValid = false;
    this.dimension._entities.delete(this);
  }
  getEntitiesFromViewDirection() {
    return [];
  }
  hasTag(t) {
    return this.tags.has(t);
  }
  addTag(t) {
    this.tags.add(t);
  }
  sendMessage(m) {
    SIM.log(`[to ${this.name}] ${m}`);
  }
  playSound() {}
  getGameMode() {
    return "survival";
  }

  physics() {
    const d = this.dimension;
    const p = this.location;
    const water = this.isInWater;
    const hw = 0.3;
    const collide = (x, y, z) => {
      for (const dx of [-hw, hw])
        for (const dz of [-hw, hw])
          for (const dy of [0.01, 0.9, 1.79]) {
            if (solid(d._get(Math.floor(x + dx), Math.floor(y + dy), Math.floor(z + dz)))) return true;
          }
      return false;
    };
    // y: sweep against blocks under/over the footprint
    let ny = p.y + this.v.y;
    this.isOnGround = false;
    const cols = [];
    for (const dx of [-hw + 0.001, hw - 0.001]) for (const dz of [-hw + 0.001, hw - 0.001]) cols.push([Math.floor(p.x + dx), Math.floor(p.z + dz)]);
    if (this.v.y <= 0) {
      let top = -Infinity;
      for (const [cx, cz] of cols) for (let by = Math.floor(ny); by <= Math.floor(p.y + 0.0001); by++) if (solid(d._get(cx, by, cz)) && by + 1 <= p.y + 0.0001) top = Math.max(top, by + 1);
      if (top > -Infinity && ny < top) {
        ny = top;
        this.isOnGround = true;
        this.v.y = 0;
      }
    } else {
      let bottom = Infinity;
      for (const [cx, cz] of cols) for (let by = Math.floor(p.y + 1.8); by <= Math.floor(ny + 1.8); by++) if (solid(d._get(cx, by, cz))) bottom = Math.min(bottom, by);
      if (bottom < Infinity && ny + 1.8 > bottom) {
        ny = bottom - 1.8;
        this.v.y = 0;
      }
    }
    p.y = ny;
    // x / z
    const nx = p.x + this.v.x;
    if (!collide(nx, p.y, p.z)) p.x = nx;
    else this.v.x = 0;
    const nz = p.z + this.v.z;
    if (!collide(p.x, p.y, nz)) p.z = nz;
    else this.v.z = 0;
    const f = water ? 0.8 : this.isOnGround ? 0.546 : 0.91;
    this.v.x *= f;
    this.v.z *= f;
    this.v.y = (this.v.y - (water ? 0.02 : 0.08)) * 0.98;
    if (water) this.v.y *= 0.8;
    if (p.y < -70) this.die({ cause: "void" });
    // fall damage
    if (this.isOnGround && this.fallStart !== undefined) {
      const dist = this.fallStart - p.y;
      if (dist > 3.5 && this.typeId === "aip:ai_player") this.applyDamage(Math.floor(dist - 3), { cause: "fall" });
      this.fallStart = undefined;
    } else if (!this.isOnGround && !water) {
      if (this.fallStart === undefined || p.y > this.fallStart) this.fallStart = p.y;
    } else this.fallStart = undefined;
  }
}

class Dimension {
  constructor(id) {
    this.id = id;
    this.heightRange = { min: -64, max: 320 };
    this._blocks = new Map();
    this._states = new Map();
    this._chests = new Map();
    this._entities = new Set();
  }
  _gen(x, y, z) {
    if (this.id !== "minecraft:overworld") {
      if (this.id === "minecraft:nether") return y < 32 ? "minecraft:lava" : y < 64 ? "minecraft:netherrack" : "minecraft:air";
      for (const [px, pz] of END_PILLARS) if (Math.abs(x - px) <= 1 && Math.abs(z - pz) <= 1 && y > 60 && y <= 80) return "minecraft:obsidian";
      return y <= 60 && y >= 56 && Math.abs(x) < 60 && Math.abs(z) < 60 ? "minecraft:end_stone" : "minecraft:air";
    }
    if (y <= -64) return "minecraft:bedrock";
    const h = 63 + Math.floor(Math.sin(x / 13) * 2 + Math.cos(z / 17) * 2);
    if (x >= 20 && x <= 26 && z >= -10 && z <= -4 && y <= h && y >= h - 2) return y === h - 2 ? "minecraft:sand" : "minecraft:water";
    if (x >= -30 && x <= -27 && z >= 20 && z <= 23 && y === h) return "minecraft:lava";
    if (y > h) {
      // trees
      const tx = Math.floor(x / 9) * 9 + 4;
      const tz = Math.floor(z / 9) * 9 + 4;
      if (hash(tx, tz) < 0.45) {
        const th = 63 + Math.floor(Math.sin(tx / 13) * 2 + Math.cos(tz / 17) * 2);
        if (x === tx && z === tz && y > th && y <= th + 5) return "minecraft:oak_log";
        if (Math.abs(x - tx) <= 2 && Math.abs(z - tz) <= 2 && y >= th + 4 && y <= th + 6 && !(x === tx && z === tz && y <= th + 5)) return "minecraft:oak_leaves";
      }
      return "minecraft:air";
    }
    if (y === h) return "minecraft:grass_block";
    if (y > h - 4) return "minecraft:dirt";
    const r = hash(x * 31 + y * 7, z * 13 - y);
    // caves: sparse air pockets
    if (y < 40 && hash(Math.floor(x / 4) + y * 3, Math.floor(z / 4)) < 0.05) return "minecraft:air";
    if (y < -50 && r < 0.004) return "minecraft:lava";
    if (r < 0.012 && y < 60 && y > 0) return "minecraft:coal_ore";
    if (r < 0.02 && y < 40) return y < 0 ? "minecraft:deepslate_iron_ore" : "minecraft:iron_ore";
    if (r < 0.023 && y < -40) return "minecraft:deepslate_diamond_ore";
    if (r < 0.026 && y < 20 && y > -20) return "minecraft:gravel";
    return y < 0 ? "minecraft:deepslate" : "minecraft:stone";
  }
  _get(x, y, z) {
    if (y < this.heightRange.min || y >= this.heightRange.max) return "minecraft:air";
    const k = `${x},${y},${z}`;
    const v = this._blocks.get(k);
    return v !== undefined ? v : this._gen(x, y, z);
  }
  _set(x, y, z, id) {
    this._blocks.set(`${x},${y},${z}`, id);
    // falling gravel/sand
  }
  getBlock(p) {
    if (p.y < -64 || p.y >= 320) throw new Error("out of bounds");
    return new Block(this, Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
  }
  getBlocks(vol, filter) {
    const out = [];
    const set = new Set(filter.includeTypes);
    const f = vol.from;
    const t = vol.to;
    for (let x = Math.min(f.x, t.x); x <= Math.max(f.x, t.x); x++)
      for (let y = Math.min(f.y, t.y); y <= Math.max(f.y, t.y); y++)
        for (let z = Math.min(f.z, t.z); z <= Math.max(f.z, t.z); z++) if (set.has(this._get(x, y, z))) out.push({ x, y, z });
    return { getBlockLocationIterator: () => out[Symbol.iterator]() };
  }
  getTopmostBlock({ x, z }) {
    for (let y = 200; y > -64; y--) if (this._get(x, y, z) !== "minecraft:air") return new Block(this, x, y, z);
    return undefined;
  }
  getEntities(o = {}) {
    let list = [...this._entities].filter((e) => e.isValid);
    if (o.type) list = list.filter((e) => e.typeId === o.type);
    if (o.excludeTypes) list = list.filter((e) => !o.excludeTypes.includes(e.typeId));
    if (o.families) list = list.filter((e) => e.matches({ families: o.families }));
    if (o.location && o.maxDistance !== undefined) {
      list = list.filter((e) => Math.hypot(e.location.x - o.location.x, e.location.y - o.location.y, e.location.z - o.location.z) <= o.maxDistance);
    }
    return list;
  }
  spawnEntity(type, loc) {
    const e = new Entity(this, type, loc);
    this._entities.add(e);
    SIM.queue("entitySpawn", { entity: e });
    return e;
  }
  spawnItem(stack, loc) {
    const e = new Entity(this, "minecraft:item", { x: loc.x + (R() - 0.5), y: loc.y + 0.2, z: loc.z + (R() - 0.5) });
    e.item = stack.clone();
    this._entities.add(e);
    return e;
  }
  playSound() {}
  spawnParticle() {}
  runCommand(cmd) {
    if (cmd.startsWith("tickingarea")) SIM.ticking.push(cmd);
    const m = cmd.match(/^setblock (-?\d+) (-?\d+) (-?\d+) air destroy$/);
    if (m) {
      const [x, y, z] = [Number(m[1]), Number(m[2]), Number(m[3])];
      SIM.breaks.push({ x, y, z, t: TICK, type: this._get(x, y, z) });
      this._set(x, y, z, "minecraft:air");
      this.spawnItem(new ItemStack("minecraft:cobblestone", 1), { x: x + 0.5, y: y + 0.5, z: z + 0.5 }); // vanilla drop to be cleaned up
    }
    return { successCount: 1 };
  }
  getBlockFromRay(from, dir, opts = {}) {
    const max = opts.maxDistance ?? 64;
    let last = null;
    for (let d = 0; d <= max; d += 0.05) {
      const x = Math.floor(from.x + dir.x * d);
      const y = Math.floor(from.y + dir.y * d);
      const z = Math.floor(from.z + dir.z * d);
      const k = `${x},${y},${z}`;
      if (k === last) continue;
      last = k;
      const t = this._get(x, y, z);
      const kind = kindOf(t);
      const hit = kind === 1 || kind === 4 || kind === 5 || (opts.includePassableBlocks && kind === 0 && t !== "minecraft:air") || (opts.includeLiquidBlocks && (kind === 2 || kind === 3));
      if (hit) return { block: new Block(this, x, y, z), face: "Up", faceLocation: { x: 0, y: 0, z: 0 } };
    }
    return undefined;
  }
}

const dims = {
  overworld: new Dimension("minecraft:overworld"),
  nether: new Dimension("minecraft:nether"),
  the_end: new Dimension("minecraft:the_end"),
};

const handlers = {};
function signal(name) {
  return {
    subscribe(fn) {
      (handlers[name] = handlers[name] || []).push(fn);
      return fn;
    },
    unsubscribe() {},
  };
}

const worldDyn = {};
export const world = {
  getDimension: (n) => dims[n.replace("minecraft:", "")],
  getDynamicProperty: (k) => worldDyn[k],
  setDynamicProperty: (k, v) => {
    if (v === undefined) delete worldDyn[k];
    else worldDyn[k] = v;
  },
  sendMessage: (m) => SIM.log(String(m)),
  getAllPlayers: () => SIM.players,
  getTimeOfDay: () => (SIM.time + TICK) % 24000,
  getAbsoluteTime: () => SIM.time + TICK,
  getEntity: (id) => {
    for (const d of Object.values(dims)) for (const e of d._entities) if (e.id === id && e.isValid) return e;
    return undefined;
  },
  getDefaultSpawnLocation: () => ({ x: 0, y: 32767, z: 0 }),
  afterEvents: new Proxy({}, { get: (_, n) => signal(String(n)) }),
  beforeEvents: new Proxy({}, { get: (_, n) => signal("before:" + String(n)) }),
};

export const system = {
  get currentTick() {
    return TICK;
  },
  runInterval(fn, n = 1) {
    intervals.push({ fn, n });
    return intervals.length;
  },
  runTimeout(fn, n = 1) {
    timeouts.push({ fn, at: TICK + n });
    return timeouts.length;
  },
  run(fn) {
    timeouts.push({ fn, at: TICK });
  },
  afterEvents: new Proxy({}, { get: (_, n) => signal("system:" + String(n)) }),
  beforeEvents: new Proxy({}, { get: (_, n) => signal("system-before:" + String(n)) }),
};

export const SIM = {
  time: 1000,
  players: [],
  ticking: [],
  breaks: [],
  teleports: [],
  logs: [],
  pending: [],
  dims,
  log(m) {
    this.logs.push(`[t${TICK}] ${m}`);
    if (this.echo) console.log(`[t${TICK}] ${m}`);
  },
  emit(name, ev) {
    for (const h of handlers[name] || []) h(ev);
  },
  queue(name, ev) {
    this.pending.push([name, ev]);
  },
  addPlayer(loc) {
    const p = new Entity(dims.overworld, "minecraft:player", loc);
    p.name = "Tester";
    dims.overworld._entities.add(p);
    this.players.push(p);
    return p;
  },
  spawn(type, loc) {
    return dims.overworld.spawnEntity(type, loc);
  },
  step() {
    TICK++;
    for (const [n, ev] of this.pending.splice(0)) this.emit(n, ev);
    for (const t of timeouts.filter((t) => t.at <= TICK)) {
      timeouts.splice(timeouts.indexOf(t), 1);
      t.fn();
    }
    for (const i of intervals) if (TICK % i.n === 0) i.fn();
    for (const d of Object.values(dims))
      for (const e of [...d._entities]) {
        if (e.typeId === "minecraft:player") continue;
        if (e.typeId === "minecraft:ender_dragon") {
          const ph = TICK % 1200;
          if (ph < 300) e.location = { x: 0.5, y: 62, z: 0.5 }; // perched on the fountain
          else {
            const a = TICK / 60;
            e.location = { x: Math.cos(a) * 30, y: 75, z: Math.sin(a) * 30 };
          }
          continue;
        }
        if (e.typeId === "minecraft:ender_crystal") continue;
        if (e.typeId === "minecraft:arrow") {
          e.physics();
          e.age = (e.age || 0) + 1;
          const hit = [...d._entities].find((o) => o !== e && o.isValid && o.typeId !== "minecraft:item" && o.typeId !== "minecraft:arrow" && o !== e.owner && Math.hypot(o.location.x - e.location.x, o.location.y + 0.8 - e.location.y, o.location.z - e.location.z) < 1.6);
          if (hit) {
            hit.applyDamage(6, { cause: "projectile", damagingEntity: e.owner });
            e.remove();
          } else if (e.age > 60) e.remove();
          continue;
        }
        if (e.typeId === "minecraft:item") {
          if (TICK % 5 === 0) e.physics();
          continue;
        }
        if (e.typeId === "minecraft:cow" && TICK % 40 === 0) {
          e.v.x += (R() - 0.5) * 0.3;
          e.v.z += (R() - 0.5) * 0.3;
        }
        if (e.typeId === "minecraft:zombie") {
          const t = [...d._entities].find((o) => o.typeId === "aip:ai_player" && o.isValid);
          if (t) {
            const dx = t.location.x - e.location.x;
            const dz = t.location.z - e.location.z;
            const dd = Math.hypot(dx, dz);
            if (dd < 16 && dd > 1) {
              e.v.x = (dx / dd) * 0.1;
              e.v.z = (dz / dd) * 0.1;
            }
            if (dd < 1.5 && TICK % 20 === 0) t.applyDamage(2, { cause: "entityAttack", damagingEntity: e });
          }
        }
        e.physics();
      }
  },
  get tick() {
    return TICK;
  },
};
