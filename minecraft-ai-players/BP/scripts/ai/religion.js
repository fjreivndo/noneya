// Religions: generated faiths whose tenets change how members behave (diet, rest days, offerings,
// mining depth, prayer, charity), spread by preaching, and practiced at worship events.
import { world } from "@minecraft/server";
import { cfg } from "../config.js";
import { pick, chance, now, wait } from "../util.js";
import { soc, newId, markDirty } from "../society.js";
import { journal, opinionOf, adjustOpinion } from "./cognition.js";

const DEITIES = [
  ["Notch", ["the Builder", "the Creator", "of the First Block"]],
  ["Herobrine", ["the Unseen", "of the White Eyes", "the Watcher"]],
  ["the Ender Dragon", ["Devourer of Light", "of the Void", "the Eternal"]],
  ["the Great Creeper", ["the Silent One", "who Explodes", "the Green"]],
  ["the Sun", ["the Burner of the Undead", "the Bright", "the Daybringer"]],
  ["the Diamond", ["the Shining", "of the Deep", "the Precious"]],
  ["Steve", ["the First Player", "the Wanderer", "Saint of Pickaxes"]],
  ["the Moon", ["Mother of Slimes", "the Pale", "the Nightwatcher"]],
  ["the Void", ["Below All", "the Endless", "the Hungry"]],
  ["the Old Oak", ["Father of Forests", "the Rooted", "the Green Crown"]],
];
const GROUPS = ["Church", "Order", "Temple", "Way", "Brotherhood", "Cult", "Path", "Fellowship", "Disciples"];

const TENET_POOL = [
  () => {
    const mob = pick(["cow", "pig", "chicken", "sheep"]);
    return { type: "taboo_kill", mob: `minecraft:${mob}`, text: `never kill a ${mob}` };
  },
  () => ({ type: "rest_day", text: "never mine on the holy day" }),
  () => {
    const it = pick([["minecraft:bread", "bread"], ["minecraft:coal", "coal"], ["minecraft:iron_ingot", "iron"], ["minecraft:cooked_beef", "steak"], ["minecraft:torch", "torches"]]);
    return { type: "offering", item: it[0], text: `offer ${it[1]} at worship` };
  },
  () => ({ type: "dawn_prayer", text: "pray every morning at sunrise" }),
  () => {
    const y = pick([0, -16, 16]);
    return { type: "no_deep", y, text: `never dig below Y ${y}` };
  },
  () => ({ type: "charity", text: "always help those who ask" }),
  () => ({ type: "torchlight", text: "keep the darkness away with torches" }),
  () => ({ type: "pacifist", text: "never strike another player" }),
  () => ({ type: "build_shrine", text: "build a temple in every town" }),
];

export function religionOf(bot) {
  const f = bot.mem.faith;
  if (!f) return undefined;
  const r = soc().religions[f.rel];
  if (!r) {
    bot.mem.faith = undefined;
    return undefined;
  }
  return r;
}

export function hasTenet(bot, type) {
  const r = religionOf(bot);
  return r ? r.tenets.find((t) => t.type === type) : undefined;
}

export function devotion(bot) {
  return bot.mem.faith ? bot.mem.faith.devotion : 0;
}

export function isHolyDay(rel) {
  return Math.floor(world.getAbsoluteTime() / 24000) % 7 === rel.holyDay;
}

/** Does the bot obey a rule right now, or give in to temptation? */
export function obeys(bot, strength = 0.5) {
  const d = devotion(bot);
  const temptation = (bot.personality.ambition ?? 0.5) * strength;
  if (d >= temptation) return true;
  // breaking a rule: guilt
  if (chance(0.3)) bot.speak("sin", {});
  bot.mem.faith.devotion = Math.max(0, d - 0.05);
  return false;
}

export function foundReligion(bot) {
  const s = soc();
  if (!cfg().religions || Object.keys(s.religions).length >= cfg().maxReligions || bot.mem.faith) return undefined;
  const [god, epithets] = pick(DEITIES);
  const ep = pick(epithets);
  const deity = ep.startsWith("the ") && god.startsWith("the ") ? `${god}, ${ep}` : `${god} ${ep}`;
  const core = god.replace(/^the /, "");
  const name = `${pick(GROUPS)} of ${pick([`the ${core}`, `${core}'s Light`, `the ${pick(["Holy", "Sacred", "Deep", "Eternal"])} ${core}`, `the ${core} Within`])}`;
  const tenets = [];
  const pool = TENET_POOL.slice();
  for (let i = 0; i < 3; i++) tenets.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]());
  const rel = { id: newId("r"), name, deity, god, tenets, founder: bot.id, founderName: bot.name, members: [bot.id], holyDay: Math.floor(Math.random() * 7), temple: null, founded: now() };
  s.religions[rel.id] = rel;
  markDirty();
  bot.mem.faith = { rel: rel.id, devotion: 0.9 };
  journal(bot, "converted", { rel: rel.name, deity });
  world.sendMessage(`§d${bot.name} founded a new religion: ${rel.name}`);
  bot.speak("found_religion", { deity, rel: rel.name, tenet: tenets[0].text }, 3);
  return rel;
}

/** Someone preached to this bot. Returns true if they converted. */
export function considerConversion(bot, rel, preacher) {
  if (!rel) return false;
  const op = opinionOf(bot, preacher.id);
  const cur = religionOf(bot);
  if (cur && cur.id === rel.id) return false;
  let p = (bot.personality.spirituality ?? 0.5) * 0.5 + op / 200;
  if (cur) p -= devotion(bot) * 0.8;
  if (chance(Math.max(0.02, p))) {
    joinReligion(bot, rel);
    adjustOpinion(bot, preacher.id, 10);
    bot.speak("convert", { rel: rel.name, deity: rel.deity }, 2);
    return true;
  }
  if (chance(0.5)) bot.speak("reject_faith", { deity: rel.deity });
  if (cur && devotion(bot) > 0.6) adjustOpinion(bot, preacher.id, -4);
  return false;
}

export function joinReligion(bot, rel) {
  const old = religionOf(bot);
  if (old) {
    old.members = old.members.filter((m) => m !== bot.id);
  }
  if (!rel.members.includes(bot.id)) rel.members.push(bot.id);
  bot.mem.faith = { rel: rel.id, devotion: 0.4 + (bot.personality.spirituality ?? 0.5) * 0.4 };
  journal(bot, "converted", { rel: rel.name, deity: rel.deity });
  markDirty();
}

/** Short morning prayer. */
export function* pray(bot) {
  const rel = religionOf(bot);
  if (!rel) return false;
  bot.setTask("praying");
  bot.speak("pray", { deity: rel.deity });
  const p = bot.pos;
  for (let i = 0; i < 60; i++) {
    bot.motor.look = { x: p.x, y: p.y + 20, z: p.z };
    yield;
  }
  bot.mem.faith.devotion = Math.min(1, bot.mem.faith.devotion + 0.03);
  bot.mem.lastPrayDay = Math.floor(world.getAbsoluteTime() / 24000);
  return true;
}

/** Walk around and preach to bots of other (or no) faith. */
export function pickPreachTarget(bot, online) {
  const rel = religionOf(bot);
  if (!rel) return undefined;
  const cands = online.filter((o) => o.id !== bot.id && (!o.mem.faith || o.mem.faith.rel !== rel.id));
  return cands.length ? pick(cands) : undefined;
}

export function faithSummary(bot) {
  const r = religionOf(bot);
  if (!r) return "none";
  return `${r.name} (devotion ${Math.round(devotion(bot) * 100)}%)`;
}

export function tenetTexts(rel) {
  return rel.tenets.map((t) => t.text);
}

export function* worshipActivity(bot, rel, host, until) {
  const center = bot.eventSpot;
  let said = 0;
  while (now() < until) {
    if (center) bot.motor.look = { x: center.x, y: center.y + 1.5, z: center.z };
    if (host && chance(0.012) && said < 4) {
      bot.speak("sermon", { deity: rel.deity, tenet: pick(rel.tenets).text });
      said++;
    } else if (!host && chance(0.004)) bot.say(chance(0.5) ? "event_chat" : "blessing", { kind: "worship", deity: rel.deity }, { prio: 0 });
    yield;
  }
  // offerings
  const off = rel.tenets.find((t) => t.type === "offering");
  if (off && bot.inv.has(off.item)) bot.inv.remove(off.item, 1);
  if (bot.mem.faith) bot.mem.faith.devotion = Math.min(1, bot.mem.faith.devotion + 0.1);
  yield* wait(5);
}
