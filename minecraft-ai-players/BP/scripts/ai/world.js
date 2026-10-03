// World access helpers: safe block reads, block searches and surface lookups.
import { BlockVolume } from "@minecraft/server";
import { kindOf, K_AIR, K_WATER, K_UNLOADED, K_SOLID, K_HURT } from "../data.js";
import { V } from "../util.js";

export function getBlock(dim, p) {
  try {
    const r = dim.heightRange;
    if (p.y < r.min || p.y >= r.max) return undefined;
    return dim.getBlock({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
  } catch (e) {
    return undefined;
  }
}

export function typeAt(dim, p) {
  const b = getBlock(dim, p);
  return b ? b.typeId : undefined;
}

export function kindAt(dim, p) {
  const t = typeAt(dim, p);
  return t === undefined ? K_UNLOADED : kindOf(t);
}

export function isPassable(dim, p) {
  const k = kindAt(dim, p);
  return k === K_AIR || k === K_WATER;
}

export function isStandable(dim, p) {
  const k = kindAt(dim, p);
  return k === K_SOLID || k === K_HURT;
}

/** True if any of the 6 neighbours is air/water (block can be seen by an honest player). */
export function isExposed(dim, p) {
  const n = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  for (const [dx, dy, dz] of n) {
    const k = kindAt(dim, { x: p.x + dx, y: p.y + dy, z: p.z + dz });
    if (k === K_AIR || k === K_WATER) return true;
  }
  return false;
}

export function lavaNear(dim, p) {
  const n = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0],
  ];
  for (const [dx, dy, dz] of n) {
    const t = typeAt(dim, { x: p.x + dx, y: p.y + dy, z: p.z + dz });
    if (t === "minecraft:lava" || t === "minecraft:flowing_lava") return { x: p.x + dx, y: p.y + dy, z: p.z + dz };
  }
  return undefined;
}

/**
 * Finds blocks of the given types near `center`.
 * @returns {{x:number,y:number,z:number}[]} sorted by distance
 */
export function findBlocks(dim, center, types, opts = {}) {
  const r = opts.radius ?? 16;
  const up = opts.up ?? 8;
  const down = opts.down ?? 8;
  const hr = dim.heightRange;
  const c = V.floor(center);
  const minY = Math.max(hr.min, c.y - down);
  const maxY = Math.min(hr.max - 1, c.y + up);
  if (minY > maxY) return [];
  const found = [];
  const reject = opts.reject;
  try {
    const vol = new BlockVolume({ x: c.x - r, y: minY, z: c.z - r }, { x: c.x + r, y: maxY, z: c.z + r });
    const list = dim.getBlocks(vol, { includeTypes: types }, true);
    for (const loc of list.getBlockLocationIterator()) {
      if (reject && reject(loc)) continue;
      if (opts.exposed && !isExposed(dim, loc)) continue;
      found.push({ x: loc.x, y: loc.y, z: loc.z });
      if (found.length > (opts.cap ?? 400)) break;
    }
  } catch (e) {
    // fall back to manual sampling, but only for small volumes
    if ((2 * r + 1) * (2 * r + 1) * (maxY - minY + 1) > 20000) return [];
    const set = new Set(types);
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++)
        for (let y = minY; y <= maxY; y++) {
          const p = { x: c.x + x, y, z: c.z + z };
          const t = typeAt(dim, p);
          if (t && set.has(t) && (!reject || !reject(p)) && (!opts.exposed || isExposed(dim, p))) found.push(p);
        }
  }
  found.sort((a, b) => V.dist2(a, center) - V.dist2(b, center));
  return found;
}

/** Highest standable block at x,z (ignoring leaves). Returns feet position on top of it. */
export function surfaceAt(dim, x, z) {
  try {
    let b = dim.getTopmostBlock({ x, z });
    if (!b) return undefined;
    let y = b.y;
    for (let i = 0; i < 40; i++) {
      const t = typeAt(dim, { x, y, z });
      if (!t) return undefined;
      const k = kindOf(t);
      if ((k === K_SOLID || k === K_HURT) && !t.includes("leaves") && !t.endsWith("_log")) {
        return { x, y: y + 1, z, ground: t };
      }
      if (k === K_WATER) return { x, y: y + 1, z, ground: t, water: true };
      y--;
    }
    return { x, y: b.y + 1, z, ground: b.typeId };
  } catch (e) {
    return undefined;
  }
}

/** Has open sky above (roughly: on the surface) */
export function skyAbove(dim, p) {
  try {
    const top = dim.getTopmostBlock({ x: Math.floor(p.x), z: Math.floor(p.z) });
    return !top || top.y < p.y + 1;
  } catch (e) {
    return true;
  }
}

export function entitiesNear(dim, center, radius, query = {}) {
  try {
    return dim.getEntities({ location: center, maxDistance: radius, ...query });
  } catch (e) {
    return [];
  }
}

export function isAlive(e) {
  try {
    if (!e || !e.isValid) return false;
    const h = e.getComponent("minecraft:health");
    return !h || h.currentValue > 0;
  } catch (err) {
    return false;
  }
}

export function healthOf(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return h ? h.currentValue : 0;
  } catch (err) {
    return 0;
  }
}
