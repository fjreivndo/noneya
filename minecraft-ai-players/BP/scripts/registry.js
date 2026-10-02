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
