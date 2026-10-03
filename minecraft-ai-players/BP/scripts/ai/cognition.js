// Cognition: stress, fatigue, memory and the journal. Mistakes are not scripted events; they come out of
// how stressed, tired and careless a bot is at the moment it makes a decision.
import { world } from "@minecraft/server";
import { cfg } from "../config.js";
import { now, chance, isNight, rand } from "../util.js";

export function initCognition(bot) {
  bot.cog = bot.cog || { stress: 0.1, fatigue: 0.1 };
  bot.mem.journal = bot.mem.journal || [];
  bot.mem.places = bot.mem.places || [];
  bot.mem.opinions = bot.mem.opinions || {};
  bot.mem.commitments = bot.mem.commitments || [];
  bot.mem.failures = bot.mem.failures || {};
  const p = bot.personality;
  // traits added in this version; old bots get them lazily
  for (const k of ["spirituality", "leadership", "generosity", "honesty", "forgetfulness", "temper", "carefulness"]) {
    if (p[k] === undefined) p[k] = Math.random();
  }
}

/** Called every second. */
export function updateCognition(bot, threatsNearby) {
  const c = bot.cog;
  const hp = bot.health;
  let target = 0.05;
  if (hp < 10) target += (10 - hp) / 14;
  if (bot.food < 8) target += 0.25;
  if (threatsNearby) target += 0.3;
  if (isNight() && bot.dimName === "overworld" && !bot.isUnderground()) target += 0.1;
  if (bot.dimName !== "overworld") target += 0.15;
  target *= 1.3 - (bot.personality.bravery ?? 0.5) * 0.6;
  c.stress += (Math.min(1, target) - c.stress) * 0.08;
  const resting = /sleeping|chilling|afk|waiting|hiding/.test(bot.task);
  c.fatigue = Math.max(0, Math.min(1, c.fatigue + (resting ? -0.004 : 0.0007)));
}

/**
 * Probability that a given decision goes wrong right now.
 * base = how error-prone that kind of decision is for an average player.
 */
export function errorChance(bot, base) {
  const m = cfg().mistakes;
  if (!m) return 0;
  const p = bot.personality;
  const skill = cfg().skill;
  const care = p.carefulness ?? 0.5;
  const c = bot.cog || { stress: 0, fatigue: 0 };
  return Math.min(0.9, base * m * (1.4 - skill) * (1.3 - care * 0.6) * (0.5 + c.stress * 1.2 + c.fatigue));
}

export function slip(bot, base) {
  return chance(errorChance(bot, base));
}

// ---------------------------------------------------------------------------
// Journal: things that happened to the bot. Speech draws from it.
// ---------------------------------------------------------------------------
export function journal(bot, type, data = {}) {
  bot.mem.journal.push({ type, t: now(), day: Math.floor(world.getAbsoluteTime() / 24000), ...data });
  if (bot.mem.journal.length > 40) bot.mem.journal.splice(0, bot.mem.journal.length - 40);
}

export function recentJournal(bot, maxAgeTicks = 24000 * 3) {
  return bot.mem.journal.filter((j) => now() - j.t < maxAgeTicks || j.t > now());
}

// ---------------------------------------------------------------------------
// Places: remembered (or heard-about) locations of useful things.
// ---------------------------------------------------------------------------
export function rememberPlace(bot, kind, pos, dim, source = "self", trust = 1) {
  const list = bot.mem.places;
  const near = list.find((p) => p.kind === kind && p.dim === dim && Math.abs(p.x - pos.x) + Math.abs(p.z - pos.z) < 24);
  if (near) {
    near.t = now();
    return;
  }
  list.push({ kind, x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z), dim, t: now(), source, trust });
  if (list.length > 30) list.shift();
}

/** Recall a place. Memory fades and is sometimes a bit off. */
export function recallPlace(bot, kind, dim, from) {
  const forget = bot.personality.forgetfulness ?? 0.3;
  const cands = bot.mem.places.filter((p) => p.kind === kind && p.dim === dim);
  let best = null;
  let bestD = Infinity;
  for (const p of cands) {
    const age = (now() - p.t) / 24000;
    if (chance(Math.min(0.5, forget * age * 0.15))) {
      bot.mem.places.splice(bot.mem.places.indexOf(p), 1); // forgot it
      continue;
    }
    const d = Math.abs(p.x - from.x) + Math.abs(p.z - from.z);
    if (d < bestD && d < 600) {
      bestD = d;
      best = p;
    }
  }
  if (!best) return undefined;
  if (slip(bot, 0.15)) {
    // misremembered
    return { ...best, x: best.x + Math.round(rand(-10, 10)), z: best.z + Math.round(rand(-10, 10)), fuzzy: true };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Opinions of other bots and players (-100..100)
// ---------------------------------------------------------------------------
export function opinionOf(bot, key) {
  return bot.mem.opinions[key] ?? 0;
}

export function adjustOpinion(bot, key, delta) {
  if (!key) return;
  const v = Math.max(-100, Math.min(100, (bot.mem.opinions[key] ?? 0) + delta));
  bot.mem.opinions[key] = Math.round(v * 10) / 10;
  const keys = Object.keys(bot.mem.opinions);
  if (keys.length > 40) delete bot.mem.opinions[keys[0]];
}

export function moodOf(bot) {
  const c = bot.cog || { stress: 0, fatigue: 0 };
  const hp = bot.health;
  let m = 0.6 - c.stress * 0.7 - c.fatigue * 0.3;
  if (hp < 8) m -= 0.3;
  if (bot.food < 6) m -= 0.2;
  const recent = recentJournal(bot, 6000);
  for (const j of recent) {
    if (j.type === "died" || j.type === "mistake") m -= 0.15;
    if (j.type === "found" || j.type === "built" || j.type === "victory" || j.type === "event_good") m += 0.15;
  }
  return Math.max(-1, Math.min(1, m));
}
