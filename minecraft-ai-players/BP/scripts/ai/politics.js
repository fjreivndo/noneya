// Politics between towns: relations come from how residents feel about each other and their faiths.
// Good relations become alliances (joint festivals); bad ones become rivalries, and, if townWars is on,
// wars with skirmishes and raids on town-built chests. Player builds are never touched.
import { world } from "@minecraft/server";
import { cfg } from "../config.js";
import { pick, now } from "../util.js";
import { soc, markDirty } from "../society.js";
import { opinionOf, adjustOpinion, journal } from "./cognition.js";
import { getBlock } from "./world.js";
import { goTo } from "./movement.js";
import { proposeEvent } from "./events.js";

const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function relations() {
  const s = soc();
  s.relations = s.relations || {};
  s.wars = s.wars || {};
  s.alliances = s.alliances || {};
  return s;
}

export function relation(a, b) {
  return relations().relations[key(a, b)] ?? 0;
}

export function atWar(a, b) {
  return !!relations().wars[key(a, b)];
}

export function allied(a, b) {
  return !!relations().alliances[key(a, b)];
}

/** Are these two bots enemies because their towns are at war? */
export function enemies(botA, botB) {
  return !!(botA.mem.town && botB.mem.town && botA.mem.town !== botB.mem.town && atWar(botA.mem.town, botB.mem.town));
}

/** Recompute relations and react: alliances, rivalries, wars, peace. Called every ~2 minutes. */
export function updatePolitics(online) {
  const s = relations();
  const towns = Object.values(s.towns);
  if (towns.length < 2) return;
  const byId = new Map(online.map((b) => [b.id, b]));
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      const A = towns[i];
      const B = towns[j];
      const k = key(A.id, B.id);
      // average opinion of each other's residents
      let sum = 0;
      let n = 0;
      for (const a of A.members) {
        const ba = byId.get(a);
        if (!ba) continue;
        for (const b of B.members) {
          sum += opinionOf(ba, b);
          n++;
        }
      }
      for (const b of B.members) {
        const bb = byId.get(b);
        if (!bb) continue;
        for (const a of A.members) {
          sum += opinionOf(bb, a);
          n++;
        }
      }
      let target = n ? sum / n : 0;
      if (A.religion && B.religion) target += A.religion === B.religion ? 15 : -12;
      const old = s.relations[k] ?? 0;
      const incidents = (s.incidents && s.incidents[k]) || 0;
      const val = Math.max(-100, Math.min(100, old + (target - old) * 0.3 + incidents));
      if (s.incidents) s.incidents[k] = 0;
      s.relations[k] = Math.round(val);
      react(A, B, k, val, online);
    }
  }
  markDirty();
}

function react(A, B, k, val, online) {
  const s = relations();
  if (s.wars[k]) {
    const w = s.wars[k];
    if (val > -15 || now() - w.since > 48000) {
      delete s.wars[k];
      world.sendMessage(`§a${A.name} and ${B.name} have made peace.`);
      const mayor = online.find((b) => b.id === A.mayor);
      if (mayor) proposeEvent(mayor, "feast", A.center, 2400, { town: A.id, placeName: `the ${A.name} plaza`, title: "peace feast" });
    }
    return;
  }
  if (s.alliances[k]) {
    if (val < 15) {
      delete s.alliances[k];
      world.sendMessage(`§e${A.name} and ${B.name} ended their alliance.`);
    }
    return;
  }
  if (val > 40) {
    s.alliances[k] = { since: now() };
    world.sendMessage(`§b${A.name} and ${B.name} formed an alliance!`);
    const mayor = online.find((b) => b.id === A.mayor);
    if (mayor) proposeEvent(mayor, "festival", A.center, 2400, { town: A.id, placeName: `the ${A.name} plaza`, title: `${A.name}-${B.name} festival` });
  } else if (val < -40) {
    if (cfg().townWars) {
      s.wars[k] = { since: now() };
      world.sendMessage(`§c${A.name} has declared war on ${B.name}!`);
    } else if (!s.rivals || !s.rivals[k]) {
      s.rivals = s.rivals || {};
      s.rivals[k] = { since: now() };
      world.sendMessage(`§6${A.name} and ${B.name} have become bitter rivals.`);
    }
  }
}

export function addIncident(townA, townB, amount) {
  if (!townA || !townB || townA === townB) return;
  const s = relations();
  s.incidents = s.incidents || {};
  const k = key(townA, townB);
  s.incidents[k] = (s.incidents[k] || 0) + amount;
}

/** Talk trash about rival towns / faiths (no fighting). */
export function rivalryTalk(bot, online) {
  const s = relations();
  if (!bot.mem.town) return false;
  const myTown = s.towns[bot.mem.town];
  if (!myTown) return false;
  const rivals = Object.keys({ ...(s.rivals || {}), ...s.wars }).filter((k) => k.includes(bot.mem.town)).map((k) => k.split("|").find((t) => t !== bot.mem.town));
  if (!rivals.length) return false;
  const other = s.towns[pick(rivals)];
  if (!other) return false;
  const target = online.find((b) => b.mem.town === other.id);
  bot.say("insult", { target: target ? target.name : other.name }, { prio: 0, to: target ? target.id : undefined, msgIntent: "insult" });
  if (target) adjustOpinion(bot, target.id, -2);
  return true;
}

/** Wartime raid: sneak into the enemy town and take a few items from its town-built chests. */
export function* raid(bot) {
  if (!cfg().townWars || !bot.mem.town) return false;
  const s = relations();
  const enemyKeys = Object.keys(s.wars).filter((k) => k.includes(bot.mem.town));
  if (!enemyKeys.length) return false;
  const enemy = s.towns[enemyKeys[0].split("|").find((t) => t !== bot.mem.town)];
  if (!enemy) return false;
  const chests = enemy.built.filter((b) => b.chest).map((b) => b.chest);
  if (!chests.length) return false;
  const c = pick(chests);
  bot.setTask(`raiding ${enemy.name}`);
  const ok = yield* goTo(bot, { x: c.x + 0.5, y: c.y, z: c.z + 0.5 }, { range: 3, timeout: 20 * 180, sprint: true });
  if (!ok) return false;
  const blk = getBlock(bot.dim, c);
  const inv = blk && blk.typeId === "minecraft:chest" ? blk.getComponent("minecraft:inventory") : null;
  const cont = inv && inv.container;
  if (!cont) return false;
  let taken = 0;
  for (let i = 0; i < cont.size && taken < 3; i++) {
    const it = cont.getItem(i);
    if (!it) continue;
    cont.setItem(i, undefined);
    bot.inv.add(it.typeId, it.amount);
    taken++;
  }
  if (taken) {
    world.sendMessage(`§c${bot.name} raided ${enemy.name}!`);
    journal(bot, "raided", { what: enemy.name });
    addIncident(bot.mem.town, enemy.id, -10);
  }
  return taken > 0;
}

export function politicsSummary() {
  const s = relations();
  const name = (id) => (s.towns[id] ? s.towns[id].name : "?");
  const lines = [];
  for (const [k, v] of Object.entries(s.relations || {})) {
    const [a, b] = k.split("|");
    const tag = s.wars[k] ? "§cAT WAR§r" : s.alliances[k] ? "§ballied§r" : s.rivals && s.rivals[k] ? "§6rivals§r" : v > 15 ? "friendly" : v < -15 ? "tense" : "neutral";
    lines.push(`${name(a)} - ${name(b)}: ${v} (${tag})`);
  }
  return lines;
}
