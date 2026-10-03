// Planned social events: a bot proposes one, others accept or decline, and attendees show up
// (or forget to) and do the activity together. Elections, worship, feasts, festivals, build days...
import { world } from "@minecraft/server";
import { cfg } from "../config.js";
import { V, chance, now, wait, rand } from "../util.js";
import { soc, newId, markDirty } from "../society.js";
import { journal, adjustOpinion, opinionOf, slip } from "./cognition.js";
import { goTo, steer } from "./movement.js";
import { eat } from "./actions.js";
import { surfaceAt } from "./world.js";
import { townOf, nextProject, projectLabel, workOnProject, plan } from "./town.js";
import { religionOf, worshipActivity } from "./religion.js";
import { oreExpedition, toSurface } from "./mining.js";

export const EVENT_TYPES = {
  feast: { title: "feast", minutes: 2.5 },
  festival: { title: "festival", minutes: 2.5 },
  meeting: { title: "town meeting", minutes: 2 },
  worship: { title: "worship service", minutes: 2 },
  build_day: { title: "build day", minutes: 5 },
  expedition: { title: "mining expedition", minutes: 5 },
  hangout: { title: "hangout", minutes: 2 },
};

/** Host creates an event and invites everyone (or a town / congregation). */
export function proposeEvent(host, type, where, inTicks, extra = {}) {
  if (!cfg().events) return undefined;
  const s = soc();
  const live = Object.values(s.events).filter((e) => e.status !== "done");
  if (live.length >= 2 || live.some((e) => e.host === host.id)) return undefined;
  if ((host.cooldowns.host || 0) > now()) return undefined;
  if (live.some((e) => e.type === type)) return undefined;
  host.cooldowns.host = now() + 20 * 60 * 8;
  const def = EVENT_TYPES[type];
  const at = now() + inTicks;
  const ev = {
    id: newId("e"), type, title: extra.title || def.title, host: host.id, hostName: host.name,
    where: { x: Math.floor(where.x), y: Math.floor(where.y), z: Math.floor(where.z), dim: host.dimName },
    placeName: extra.placeName || "my place", at, until: at + Math.round(def.minutes * 1200),
    town: extra.town, religion: extra.religion, accepted: [host.id], declined: [], attended: [], status: "planned",
  };
  s.events[ev.id] = ev;
  markDirty();
  host.mem.commitments.push({ event: ev.id, at });
  host.say("propose_event", { title: ev.title, place: ev.placeName, in: inTicks }, { prio: 3, msgIntent: "propose_event", data: { event: ev.id } });
  return ev;
}

/** A bot heard an invitation. Decide based on personality, opinion, faith and what it's busy with. */
export function considerInvite(bot, ev) {
  if (!ev || ev.status === "done" || ev.accepted.includes(bot.id) || ev.declined.includes(bot.id)) return;
  if (ev.where.dim !== bot.dimName && ev.type !== "worship") {
    ev.declined.push(bot.id);
    return;
  }
  const p = bot.personality;
  let chanceYes = 0.25 + (p.sociability ?? 0.5) * 0.45 + opinionOf(bot, ev.host) / 150;
  if (ev.town && bot.mem.town === ev.town) chanceYes += 0.25;
  if (ev.religion) {
    const r = religionOf(bot);
    chanceYes += r && r.id === ev.religion ? 0.4 : -0.35;
  }
  if (bot.currentMs === "dragon" || bot.dimName === "the_end") chanceYes -= 0.6;
  const dist = V.dist(bot.pos, ev.where);
  if (dist > 400) chanceYes -= 0.5;
  if (chance(Math.max(0.03, Math.min(0.95, chanceYes)))) {
    ev.accepted.push(bot.id);
    const forgot = slip(bot, 0.12 * (0.5 + (p.forgetfulness ?? 0.3)));
    bot.mem.commitments.push({ event: ev.id, at: ev.at, forgot });
    bot.say("accept", { target: ev.hostName }, { prio: 1, to: ev.host, msgIntent: "accept", data: { event: ev.id } });
  } else {
    ev.declined.push(bot.id);
    const busy = bot.task && !/idle|chilling|afk/.test(bot.task) ? bot.task : null;
    bot.say("decline", { reason: busy }, { prio: 0, to: ev.host, msgIntent: "decline", data: { event: ev.id } });
  }
  markDirty();
}

/** Upcoming commitment the bot should leave for now (travel time included). */
export function dueCommitment(bot) {
  const s = soc();
  for (const c of bot.mem.commitments) {
    const ev = s.events[c.event];
    if (!ev || ev.status === "done") continue;
    if (c.forgot || c.attended) continue;
    const travel = Math.min(1600, V.dist(bot.pos, ev.where) * 6) + 100;
    if (now() >= ev.at - travel && now() < ev.until) return ev;
  }
  return undefined;
}

/** Clean up and apologize for anything forgotten. */
export function reviewCommitments(bot) {
  const s = soc();
  const keep = [];
  for (const c of bot.mem.commitments) {
    const ev = s.events[c.event];
    if (!ev) continue;
    if (now() > ev.until) {
      if (c.forgot && !c.attended) {
        journal(bot, "missed_event", { what: ev.title });
        bot.say("apologize", { target: ev.hostName, what: ev.title }, { prio: 1 });
        const host = ev.host;
        adjustOpinion(bot, host, -2);
      }
      continue;
    }
    keep.push(c);
  }
  bot.mem.commitments = keep;
}

/** Event state machine (called by the manager a few times per second). */
export function tickEvents(onlineBots) {
  const s = soc();
  for (const ev of Object.values(s.events)) {
    if (ev.status === "planned" && now() >= ev.at) {
      ev.status = "running";
      markDirty();
      if (ev.type === "festival") world.sendMessage(`§6The ${ev.title} hosted by ${ev.hostName} has started!`);
    } else if (ev.status === "running" && now() >= ev.until) {
      ev.status = "done";
      finishEvent(ev, onlineBots);
      markDirty();
    }
  }
}

function finishEvent(ev, onlineBots) {
  const att = ev.attended;
  const byId = new Map(onlineBots.map((b) => [b.id, b]));
  for (const a of att) {
    const b = byId.get(a);
    if (!b) continue;
    for (const o of att) if (o !== a) adjustOpinion(b, o, 3);
    journal(b, "event_good", { what: ev.title });
  }
  const host = byId.get(ev.host);
  if (host) {
    for (const id of ev.accepted) if (!att.includes(id) && id !== ev.host) adjustOpinion(host, id, -5);
  }
  if (ev.type === "meeting" && ev.votes) {
    const tally = {};
    for (const v of Object.values(ev.votes)) tally[v] = (tally[v] || 0) + 1;
    const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    const town = ev.town && soc().towns[ev.town];
    if (winner && town) {
      const w = byId.get(winner[0]);
      const changed = town.mayor !== winner[0];
      town.mayor = winner[0];
      town.mayorName = w ? w.name : town.mayorName;
      world.sendMessage(`§b${town.name} election: ${town.mayorName} is ${changed ? "the new" : "re-elected"} mayor (${winner[1]} vote${winner[1] > 1 ? "s" : ""})`);
      markDirty();
    }
  }
}

/** Routine: go to the event and take part. */
export function* attendEvent(bot, ev) {
  const c = bot.mem.commitments.find((x) => x.event === ev.id);
  if (c) c.attended = true;
  bot.setTask(`going to the ${ev.title}`);
  if (ev.where.dim !== bot.dimName) return false;
  if (bot.isUnderground()) yield* toSurface(bot);
  const spot = { x: ev.where.x + rand(-3, 3), y: ev.where.y, z: ev.where.z + rand(-3, 3) };
  const s = surfaceAt(bot.dim, Math.floor(spot.x), Math.floor(spot.z));
  if (s && Math.abs(s.y - spot.y) < 6) spot.y = s.y;
  const ok = yield* goTo(bot, spot, { range: 3, timeout: Math.max(400, ev.until - now()), sprint: true });
  if (!ok && V.dist(bot.pos, ev.where) > 16) return false;
  if (!ev.attended.includes(bot.id)) ev.attended.push(bot.id);
  bot.eventSpot = ev.where;
  // wait for it to start
  while (now() < ev.at && ev.status !== "done") {
    bot.setTask(`waiting for the ${ev.title}`);
    bot.motor.look = { x: ev.where.x, y: ev.where.y + 1.5, z: ev.where.z };
    if (chance(0.004)) bot.say("smalltalk", {}, { prio: 0 });
    yield;
  }
  bot.setTask(`at the ${ev.title}`);
  const host = ev.host === bot.id;
  switch (ev.type) {
    case "worship": {
      const rel = soc().religions[ev.religion];
      bot.setTask("at worship");
      if (rel) yield* worshipActivity(bot, rel, host, ev.until);
      break;
    }
    case "build_day": {
      const town = townOf(bot);
      while (now() < ev.until && town && nextProject(town)) {
        yield* workOnProject(bot, town);
        if (chance(0.3)) bot.say("event_chat", { kind: "build_day" }, { prio: 0 });
      }
      break;
    }
    case "expedition": {
      yield* oreExpedition(bot, ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore", "minecraft:iron_ore", "minecraft:deepslate_iron_ore"], 12, () => now() > ev.until, ev.until - now());
      yield* toSurface(bot);
      break;
    }
    case "meeting": {
      yield* meeting(bot, ev, host);
      break;
    }
    default:
      yield* socialActivity(bot, ev);
  }
  bot.eventSpot = null;
  return true;
}

function* socialActivity(bot, ev) {
  let fed = false;
  while (now() < ev.until && ev.status !== "done") {
    const t = now();
    if (ev.type === "feast" && !fed && bot.inv.bestFood() && bot.food < 20) {
      yield* eat(bot);
      fed = true;
    }
    if (ev.type === "festival" && chance(0.01)) {
      try {
        bot.dim.spawnEntity("minecraft:fireworks_rocket", { x: ev.where.x + rand(-4, 4), y: ev.where.y + 1, z: ev.where.z + rand(-4, 4) });
      } catch (e) {
        /* ignore */
      }
    }
    if (ev.type === "festival" && chance(0.03)) bot.motor.jump = true;
    if (chance(0.006)) bot.say(chance(0.6) ? "event_chat" : "smalltalk", { kind: ev.type }, { prio: 0 });
    // mill around
    if (V.dist(bot.pos, ev.where) > 6) steer(bot, ev.where, {});
    else if (chance(0.01)) bot.wander = { x: ev.where.x + rand(-4, 4), y: ev.where.y, z: ev.where.z + rand(-4, 4) };
    if (bot.wander && V.hdist(bot.pos, bot.wander) > 0.6) steer(bot, bot.wander, { slow: true });
    else bot.motor.look = { x: ev.where.x, y: ev.where.y + 1.6, z: ev.where.z };
    if (now() === t) yield;
  }
  bot.wander = null;
}

function* meeting(bot, ev, host) {
  const town = ev.town && soc().towns[ev.town];
  if (!town) return yield* socialActivity(bot, ev);
  ev.votes = ev.votes || {};
  const candidates = ev.candidates || (ev.candidates = [town.mayor]);
  // ambitious leaders run for mayor
  if (!candidates.includes(bot.id) && (bot.personality.leadership ?? 0.5) > 0.65 && chance(0.6)) {
    candidates.push(bot.id);
    const p = nextProject(town);
    bot.say("election", { town: town.name, project: p ? projectLabel(p) : "more houses" }, { prio: 2 });
  }
  yield* wait(200);
  // vote for the candidate we like most
  let best = candidates[0];
  let bestOp = -Infinity;
  for (const c of candidates) {
    const op = c === bot.id ? 30 + (bot.personality.leadership ?? 0.5) * 30 : opinionOf(bot, c);
    if (op > bestOp) {
      bestOp = op;
      best = c;
    }
  }
  ev.votes[bot.id] = best;
  markDirty();
  const name = best === bot.id ? bot.name : (soc().towns[ev.town] && best === town.mayor ? town.mayorName : null) || bot.nameOf(best);
  if (chance(0.6)) bot.say("vote", { target: name }, { prio: 1 });
  if (host) plan(town);
  yield* socialActivity(bot, ev);
}
