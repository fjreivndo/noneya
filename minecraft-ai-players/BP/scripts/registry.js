// Persistent roster of AI players + chunk loading (ticking areas).
import { world } from "@minecraft/server";
import { cfg } from "./config.js";
import { V, safe } from "./util.js";

const ROSTER_KEY = "aip:roster";

export function rosterIds() {
  try {
    const raw = world.getDynamicProperty(ROSTER_KEY);
    return typeof raw === "string" ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveRoster(ids) {
  world.setDynamicProperty(ROSTER_KEY, JSON.stringify(ids));
}

export function loadRecord(id) {
  try {
    const raw = world.getDynamicProperty(`aip:bot:${id}`);
    return typeof raw === "string" ? JSON.parse(raw) : undefined;
  } catch (e) {
    return undefined;
  }
}

export function saveRecord(id, rec) {
  const ids = rosterIds();
  if (!ids.includes(id)) {
    ids.push(id);
    saveRoster(ids);
  }
  let s = JSON.stringify(rec);
  if (s.length > 30000) {
    // trim memory if it ever grows too large
    rec.mem = { home: rec.mem && rec.mem.home, portal: rec.mem && rec.mem.portal, flags: rec.mem && rec.mem.flags };
    s = JSON.stringify(rec);
  }
  world.setDynamicProperty(`aip:bot:${id}`, s);
}

export function deleteRecord(id) {
  saveRoster(rosterIds().filter((x) => x !== id));
  world.setDynamicProperty(`aip:bot:${id}`, undefined);
}

export function allRecords() {
  return rosterIds()
    .map((id) => ({ id, rec: loadRecord(id) }))
    .filter((r) => r.rec);
}

export function takenNames() {
  return new Set(allRecords().map((r) => (r.rec.name || "").toLowerCase()));
}

// ---------------------------------------------------------------------------
// Ticking areas: keep the chunks around each bot loaded so it keeps living
// when no player is nearby. Bedrock allows 10 ticking areas per world.
// ---------------------------------------------------------------------------
export function tickingName(id, suffix = "") {
  return `aip_${id}${suffix}`;
}

export function addTickingArea(dim, p, name, radius = 2) {
  if (!cfg().keepChunksLoaded) return false;
  const f = V.floor(p);
  safe(() => dim.runCommand(`tickingarea remove ${name}`), null);
  return safe(() => dim.runCommand(`tickingarea add circle ${f.x} ${f.y} ${f.z} ${radius} ${name}`).successCount > 0, false);
}

export function removeTickingArea(dimName, name) {
  for (const d of dimName ? [dimName] : ["overworld", "nether", "the_end"]) {
    safe(() => world.getDimension(d).runCommand(`tickingarea remove ${name}`), null);
  }
}

export function removeAllBotTickingAreas() {
  for (const { id } of allRecords()) {
    removeTickingArea(null, tickingName(id));
    removeTickingArea(null, tickingName(id, "t"));
  }
}

// ---------------------------------------------------------------------------
// Shared ticking areas: bots close to each other share one area, so many bots fit in Bedrock's
// limit of 10 ticking areas per world. Biggest groups get areas first.
// ---------------------------------------------------------------------------
let clusterAreas = []; // [{name, dim}]
let cleanedLegacy = false;

export function updateClusters(bots) {
  if (!cfg().keepChunksLoaded) return { clusters: 0, covered: 0 };
  if (!cleanedLegacy) {
    // older versions used one area per bot
    for (const { id } of allRecords()) removeTickingArea(null, tickingName(id));
    cleanedLegacy = true;
  }
  const groups = [];
  for (const b of bots) {
    const p = b.feetBlock();
    const d = b.dimName;
    let g = groups.find((x) => x.dim === d && Math.hypot(x.cx - p.x, x.cz - p.z) < 48);
    if (!g) {
      g = { dim: d, cx: p.x, cz: p.z, y: p.y, members: [] };
      groups.push(g);
    }
    g.members.push(p);
    g.cx = g.members.reduce((a, m) => a + m.x, 0) / g.members.length;
    g.cz = g.members.reduce((a, m) => a + m.z, 0) / g.members.length;
  }
  groups.sort((a, b) => b.members.length - a.members.length);
  const max = Math.max(1, Math.min(10, cfg().maxTickingAreas));
  const chosen = groups.slice(0, max);
  for (const old of clusterAreas) removeTickingArea(old.dim, old.name);
  clusterAreas = [];
  let covered = 0;
  chosen.forEach((g, i) => {
    const spread = Math.max(...g.members.map((m) => Math.hypot(m.x - g.cx, m.z - g.cz)));
    const radius = Math.max(2, Math.min(4, Math.ceil((spread + 20) / 16)));
    const name = `aip_c${i}`;
    if (addTickingArea(world.getDimension(g.dim), { x: g.cx, y: g.y, z: g.cz }, name, radius)) {
      clusterAreas.push({ name, dim: g.dim });
      covered += g.members.length;
    }
  });
  return { clusters: clusterAreas.length, covered };
}
