import { world, system } from "@minecraft/server";

export const V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  dist: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2),
  dist2: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2,
  hdist: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2),
  floor: (a) => ({ x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) }),
  center: (b) => ({ x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 }),
  feet: (b) => ({ x: b.x + 0.5, y: b.y, z: b.z + 0.5 }),
  eq: (a, b) => a.x === b.x && a.y === b.y && a.z === b.z,
  key: (b) => `${b.x},${b.y},${b.z}`,
  norm: (a) => {
    const l = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) || 1;
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  },
};

export const DIRS4 = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function* wait(ticks) {
  for (let i = 0; i < ticks; i++) yield;
}

export const now = () => system.currentTick;

export function safe(fn, fallback) {
  try {
    return fn();
  } catch (e) {
    return fallback;
  }
}

export function dimName(dim) {
  const id = dim.id.replace("minecraft:", "");
  if (id === "nether") return "nether";
  if (id === "the_end") return "the_end";
  return "overworld";
}

export const getDim = (name) => world.getDimension(name);

export function isNight() {
  const t = world.getTimeOfDay();
  return t >= 12542 && t <= 23459;
}

export function strip(id) {
  return id ? id.replace("minecraft:", "") : "";
}

export function prettyItem(id) {
  return strip(id)
    .replace(/^#/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function yawTo(from, to) {
  return (Math.atan2(-(to.x - from.x), to.z - from.z) * 180) / Math.PI;
}

export function pitchTo(from, to) {
  const h = Math.sqrt((to.x - from.x) ** 2 + (to.z - from.z) ** 2);
  return (-Math.atan2(to.y - from.y, h) * 180) / Math.PI;
}

export function debug(msg) {
  try {
    // imported lazily to avoid a cycle with config.js
    const raw = world.getDynamicProperty("aip:config");
    if (typeof raw === "string" && JSON.parse(raw).debug) world.sendMessage(`§8[AIP] ${msg}`);
  } catch (e) {
    /* ignore */
  }
}

export function fmtTime(ticks) {
  const s = Math.floor(ticks / 20);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
