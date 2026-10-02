// Social brain: reading messages from other bots and players, replying, and turning what was said into
// actions (helping, trading, joining towns, converting, attending events, sharing knowledge).
import { ItemStack } from "@minecraft/server";
import { cfg } from "../config.js";
import { V, pick, chance, now, prettyItem, isNight } from "../util.js";
import { soc } from "../society.js";
import { adjustOpinion, opinionOf, rememberPlace, recallPlace, journal, slip } from "./cognition.js";
import { goTo } from "./movement.js";
import { considerInvite, proposeEvent } from "./events.js";
import { townOf, joinTown, foundTown, nextProject, projectLabel, adoptReligion } from "./town.js";
import { religionOf, considerConversion, foundReligion, hasTenet, isHolyDay, pickPreachTarget, devotion } from "./religion.js";
import { directionWords } from "./speech.js";
import { llmRequest, llmReady } from "./llm.js";

// ---------------------------------------------------------------------------
// Incoming messages
// ---------------------------------------------------------------------------
export function processInbox(bot, online) {
  if (!bot.inbox.length) return;
  const msg = bot.inbox[0];
  if (msg.readAt > now()) return;
  bot.inbox.shift();
  const forMe = !msg.to || msg.to === bot.id || (msg.text && msg.text.toLowerCase().includes(bot.name.toLowerCase()));
  if (!forMe && chance(0.85)) return;
  // misunderstandings happen
  if (slip(bot, 0.04) && msg.intent !== "smalltalk") {
    if (msg.to === bot.id) bot.say("confused", {}, { prio: 0, to: msg.from });
    return;
  }
  const sender = online.find((b) => b.id === msg.from);
  handle(bot, msg, sender, online);
}

function handle(bot, msg, sender, online) {
  const from = msg.from;
  const d = msg.data || {};
  const op = opinionOf(bot, from);
  switch (msg.intent) {
    case "greet":
      adjustOpinion(bot, from, 1);
      if (msg.depth < 1 && chance(0.4 + bot.personality.sociability * 0.4)) bot.say("greet", { target: msg.fromName }, { prio: 0, to: from, msgIntent: "greet", depth: (msg.depth || 0) + 1 });
      break;
    case "smalltalk":
      if ((msg.depth || 0) < 2 && chance(0.15 + bot.personality.sociability * 0.35) && (msg.to === bot.id || chance(0.3))) {
        bot.say("reply_smalltalk", {}, { prio: 0, to: from, msgIntent: "smalltalk", depth: (msg.depth || 0) + 1 });
        adjustOpinion(bot, from, 0.5);
      }
      break;
    case "ask_help":
      considerHelp(bot, msg, sender);
      break;
    case "offer_help":
      if (msg.to === bot.id) adjustOpinion(bot, from, 5);
      break;
    case "share_place":
      if (d.kind && d.pos) {
        const trust = op > -20 ? 1 : 0.4;
        if (trust > 0.5 || chance(0.4)) rememberPlace(bot, d.kind, d.pos, d.dim || "overworld", msg.fromName, trust);
      }
      break;
    case "warn":
      if (d.pos) rememberPlace(bot, "danger", d.pos, d.dim || "overworld", msg.fromName);
      break;
    case "ask_place": {
      if (!d.kind) break;
      const p = recallPlace(bot, d.kind, d.dim || "overworld", sender ? sender.pos : bot.pos);
      // dishonest bots that dislike you might send you the wrong way
      const lie = p && op < -30 && (bot.personality.honesty ?? 0.5) < 0.3;
      const ans = p ? (lie ? { ...p, x: p.x + 200, z: p.z - 150 } : p) : null;
      if (p || chance(0.3)) {
        bot.say("answer_place", { where: ans && sender ? directionWords(sender.pos, ans) : null, coords: ans ? `${ans.x} ${ans.y} ${ans.z}` : null }, {
          prio: 1, to: from, msgIntent: "share_place", data: ans ? { kind: d.kind, pos: ans, dim: ans.dim } : {},
        });
      }
      break;
    }
    case "propose_event": {
      const ev = soc().events[d.event];
      if (ev) considerInvite(bot, ev);
      break;
    }
    case "invite_town": {
      if (msg.to !== bot.id || bot.mem.town) break;
      const town = soc().towns[d.town];
      if (!town) break;
      const yes = 0.2 + bot.personality.sociability * 0.4 + op / 120 + (bot.mem.home ? -0.15 : 0.2);
      if (chance(yes)) {
        joinTown(bot, town);
        bot.say("accept", { target: msg.fromName }, { prio: 2, to: from, msgIntent: "accept" });
        adjustOpinion(bot, from, 8);
      } else bot.say("decline", { reason: bot.mem.home ? "happy where i live" : null }, { prio: 0, to: from, msgIntent: "decline" });
      break;
    }
    case "preach": {
      if (msg.to && msg.to !== bot.id) break;
      const rel = soc().religions[d.rel];
      if (sender && considerConversion(bot, rel, sender)) {
        const t = townOf(bot);
        if (t && t.mayor === bot.id) adoptReligion(t, rel);
      }
      break;
    }
    case "gift":
      if (msg.to === bot.id) {
        adjustOpinion(bot, from, 10);
        journal(bot, "helped", { who: msg.fromName, item: d.item });
        bot.say("thanks", { target: msg.fromName }, { prio: 1, to: from, msgIntent: "thanks" });
      }
      break;
    case "insult":
      if (msg.to === bot.id) {
        adjustOpinion(bot, from, -8);
        if (chance(bot.personality.temper ?? 0.5)) bot.say("insult", { target: msg.fromName }, { prio: 1, to: from, msgIntent: "insult", depth: (msg.depth || 0) + 1 });
      }
      break;
    case "compliment":
      if (msg.to === bot.id) {
        adjustOpinion(bot, from, 6);
        if (chance(0.5)) bot.say("thanks", { target: msg.fromName }, { prio: 0, to: from, msgIntent: "thanks" });
      }
      break;
    case "thanks":
      if (msg.to === bot.id) adjustOpinion(bot, from, 3);
      break;
    case "died":
      if (op > 10 && chance(0.4)) bot.say("react_death", { target: msg.fromName }, { prio: 0 });
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Helping each other
// ---------------------------------------------------------------------------
const KEEP = { "minecraft:iron_ingot": 6, "minecraft:diamond": 3, "minecraft:cobblestone": 32, "minecraft:coal": 4 };

function considerHelp(bot, msg, requester) {
  const d = msg.data || {};
  if (!d.item || !requester || bot.helping) return;
  const have = bot.inv.count(d.item);
  const spare = have - (KEEP[d.item] ?? 2);
  if (spare <= 0) return;
  const n = Math.min(spare, d.n || 1);
  let p = 0.15 + (bot.personality.generosity ?? 0.5) * 0.5 + opinionOf(bot, msg.from) / 100;
  if (hasTenet(bot, "charity")) p += 0.35 * devotion(bot);
  if (requester.dimName !== bot.dimName || V.dist(requester.pos, bot.pos) > 250) p -= 0.6;
  if (!chance(p)) return;
  bot.helping = { to: requester.id, item: d.item, n, until: now() + 20 * 120 };
  bot.say("offer_help", { item: d.item, n, target: msg.fromName }, { prio: 2, to: msg.from, msgIntent: "offer_help" });
}

/** Routine: deliver promised items. */
export function* deliverHelp(bot, online) {
  const h = bot.helping;
  const target = online.find((b) => b.id === h.to);
  if (!target) {
    bot.helping = null;
    return false;
  }
  bot.setTask(`bringing ${prettyItem(h.item).toLowerCase()} to ${target.name}`);
  const ok = yield* goTo(bot, () => (target.entity.isValid ? target.pos : undefined), { range: 2.5, timeout: 20 * 120, sprint: true });
  if (ok && target.entity.isValid) {
    const moved = bot.inv.remove(h.item, h.n);
    let n = 0;
    for (const m of moved) {
      target.inv.add(m.id, m.n);
      n += m.n;
    }
    if (n > 0) {
      bot.swing();
      bot.say("give_ok", { target: target.name, item: h.item, n }, { prio: 1, to: target.id, msgIntent: "gift", data: { item: h.item, n } });
      adjustOpinion(bot, target.id, 3);
    }
  }
  bot.helping = null;
  return ok;
}

/** Ask everyone for something we failed to get. */
export function askForHelp(bot, item, n, reason) {
  const key = `ask:${item}`;
  if ((bot.cooldowns[key] || 0) > now()) return;
  bot.cooldowns[key] = now() + 20 * 300;
  bot.say("ask_help", { item, n, reason }, { prio: 2, msgIntent: "ask_help", data: { item, n } });
}

// ---------------------------------------------------------------------------
// Proactive social behaviour (called every ~20s per bot)
// ---------------------------------------------------------------------------
export function socialThink(bot, online) {
  const p = bot.personality;
  const others = online.filter((o) => o.id !== bot.id && o.dimName === bot.dimName);
  const town = townOf(bot);
  const rel = religionOf(bot);

  // found a town
  if (cfg().towns && !town && (p.leadership ?? 0.5) > 0.55 && others.length >= 1 && chance(bot.mem.home ? 0.15 : 0.06)) {
    const t = foundTown(bot);
    if (t) return;
  }
  // invite someone to my town
  if (town && (town.mayor === bot.id || p.sociability > 0.6) && chance(0.25)) {
    const homeless = others.filter((o) => !o.mem.town);
    if (homeless.length) {
      const o = pick(homeless);
      bot.say("invite_town", { target: o.name, town: town.name }, { prio: 2, to: o.id, msgIntent: "invite_town", data: { town: town.id } });
      return;
    }
  }
  // found a religion (more likely after something dramatic happened)
  if (cfg().religions && !rel && (p.spirituality ?? 0.5) > 0.7) {
    const dramatic = bot.mem.journal.slice(-8).some((j) => ["died", "victory", "found"].includes(j.type));
    if (chance(dramatic ? 0.08 : 0.015)) {
      const r = foundReligion(bot);
      if (r && town && town.mayor === bot.id) adoptReligion(town, r);
      if (r) return;
    }
  }
  // preach
  if (rel && devotion(bot) > 0.5 && chance(0.12 + (p.spirituality ?? 0.5) * 0.15)) {
    const target = pickPreachTarget(bot, others);
    if (target) {
      const tenet = pick(rel.tenets).text;
      bot.say("preach", { deity: rel.deity, rel: rel.name, target: target.name, tenet }, { prio: 1, to: target.id, msgIntent: "preach", data: { rel: rel.id } });
      return;
    }
  }
  // plan events
  if (cfg().events && others.length >= 1 && chance(0.1)) {
    const ev = planSomething(bot, town, rel);
    if (ev) return;
  }
  // chit-chat
  if (cfg().botChat && chance(0.06 + (p.chattiness ?? 0.5) * 0.08)) {
    const target = others.length && chance(0.5) ? pick(others) : null;
    const ctx = smalltalkContext(bot, target, town, rel);
    bot.say(target && chance(0.3) ? "greet" : "smalltalk", ctx, { prio: 0, to: target ? target.id : undefined, msgIntent: target && chance(0.3) ? "greet" : "smalltalk" });
    return;
  }
  // compliments / insults depending on how we feel about someone
  if (others.length && chance(0.03)) {
    const o = pick(others);
    const op = opinionOf(bot, o.id);
    if (op > 40) bot.say("compliment", { target: o.name }, { prio: 0, to: o.id, msgIntent: "compliment" });
    else if (op < -40 && chance(bot.personality.temper ?? 0.5)) bot.say("insult", { target: o.name }, { prio: 0, to: o.id, msgIntent: "insult" });
  }
}

function smalltalkContext(bot, target, town, rel) {
  const ctx = {};
  if (target) {
    ctx.other = target.name;
    ctx.otherId = target.id;
    ctx.target = target.name;
  }
  if (town) ctx.town = town.name;
  if (rel) ctx.deity = rel.deity;
  return ctx;
}

function planSomething(bot, town, rel) {
  const p = bot.personality;
  const day = !isNight();
  // worship on the holy day, at the temple if there is one
  if (rel && (rel.founder === bot.id || (devotion(bot) > 0.8 && chance(0.4)))) {
    if (isHolyDay(rel) || chance(0.25)) {
      const where = rel.temple ? { x: rel.temple.x, y: rel.temple.y, z: rel.temple.z + 4 } : bot.pos;
      return proposeEvent(bot, "worship", where, 1200 + Math.round(Math.random() * 1200), { religion: rel.id, placeName: rel.temple ? "the temple" : coords(bot.pos), title: `${rel.name.split(" ")[0].toLowerCase()} service` });
    }
  }
  if (town && town.mayor === bot.id) {
    const plaza = town.center;
    const r = Math.random();
    if (r < 0.3) return proposeEvent(bot, "meeting", plaza, 1500, { town: town.id, placeName: `the ${town.name} plaza` });
    if (r < 0.6 && nextProject(town)) return proposeEvent(bot, "build_day", plaza, 1200, { town: town.id, placeName: town.name, title: `build day for ${projectLabel(nextProject(town))}` });
    if (r < 0.8 && day) return proposeEvent(bot, "festival", plaza, 2400, { town: town.id, placeName: `the ${town.name} plaza`, title: `${town.name} festival` });
    return proposeEvent(bot, "feast", plaza, 1800, { town: town.id, placeName: `the ${town.name} plaza` });
  }
  if ((p.sociability ?? 0.5) > 0.6 && day) {
    const home = bot.mem.home && bot.dimName === "overworld" ? bot.mem.home : bot.pos;
    const type = bot.inv.toolTier("pickaxe") >= 3 && chance(0.4) ? "expedition" : bot.inv.foodPoints() > 40 && chance(0.5) ? "feast" : "hangout";
    return proposeEvent(bot, type, home, 1600, { placeName: bot.mem.home ? "my house" : coords(home) });
  }
  return undefined;
}

const coords = (p) => `${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`;

/** Tell others about something worth knowing. */
export function shareDiscovery(bot, kind, pos) {
  if (!cfg().botChat) return;
  const key = `share:${kind}`;
  if ((bot.cooldowns[key] || 0) > now()) return;
  bot.cooldowns[key] = now() + 20 * 600;
  const p = bot.personality;
  if (!chance(0.25 + (p.generosity ?? 0.5) * 0.4)) return;
  rememberPlace(bot, kind, pos, bot.dimName);
  bot.say("share_place", { kind, where: directionWords(bot.mem.home || bot.pos, pos), coords: `${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}` }, {
    prio: 1, msgIntent: "share_place", data: { kind, pos: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) }, dim: bot.dimName },
  });
}

// ---------------------------------------------------------------------------
// Players talking to bots (menu text box or /scriptevent aip:say)
// ---------------------------------------------------------------------------
/** @type {[string, RegExp][]} */
const PLAYER_INTENTS = [
  ["follow", /\b(follow|come with|tag along)\b/],
  ["stay", /\b(stay|wait|stop|halt)\b/],
  ["come", /\b(come here|come to me|over here|get over)\b/],
  ["give", /\b(give|can i have|need some|got any|share)\b/],
  ["free", /\b(do your (own )?thing|go away|leave me|you can go|dismiss)\b/],
  ["home", /\b(go home|head home)\b/],
  ["join_town", /\b(join|move to|live in)\b.*\b(town|city|village)\b/],
  ["event", /\b(party|feast|festival|meeting|event|hang ?out)\b/],
  ["faith", /\b(god|pray|religion|believe|church|temple|deity)\b/],
  ["where", /\bwhere\b.*\b(is|are|can i find|to find)\b/],
  ["how", /\bhow are (you|u)|how's it going|you ok|wyd|what are you doing|what r u doing|doing\b/],
  ["thanks", /\b(thanks|thank you|ty|thx)\b/],
  ["insult", /\b(noob|trash|bad|stupid|dumb|idiot|loser|suck)\b/],
  ["compliment", /\b(nice|cool|awesome|great|good job|gg|love|amazing)\b/],
  ["greet", /\b(hi|hello|hey|yo|sup|greetings|morning)\b/],
];

const ITEM_WORDS = {
  wood: "#logs", logs: "#logs", log: "#logs", planks: "#planks", iron: "minecraft:iron_ingot", diamond: "minecraft:diamond", diamonds: "minecraft:diamond",
  coal: "minecraft:coal", food: "#food", steak: "minecraft:cooked_beef", beef: "minecraft:cooked_beef", bread: "minecraft:bread", cobble: "minecraft:cobblestone",
  cobblestone: "minecraft:cobblestone", stone: "minecraft:cobblestone", torch: "minecraft:torch", torches: "minecraft:torch", gold: "minecraft:gold_ingot",
  arrows: "minecraft:arrow", pearl: "minecraft:ender_pearl", pearls: "minecraft:ender_pearl",
};
const PLACE_WORDS = { iron: "iron", diamond: "diamonds", diamonds: "diamonds", water: "water", lava: "lava", village: "village", fortress: "fortress", town: "town" };

export function classifyPlayer(text) {
  const t = ` ${text.toLowerCase()} `;
  for (const [intent, re] of PLAYER_INTENTS) if (re.test(t)) return intent;
  return "chat";
}

function findItemWord(text) {
  for (const w of text.toLowerCase().split(/[^a-z]+/)) if (ITEM_WORDS[w]) return ITEM_WORDS[w];
  return undefined;
}

export function handlePlayerTalk(bot, player, text, setOrder) {
  const key = `p:${player.name}`;
  const facts = {
    task: bot.task, health: Math.round(bot.health), food: Math.round(bot.food),
    town: townOf(bot) ? townOf(bot).name : null, religion: religionOf(bot) ? religionOf(bot).name : null,
    opinionOfPlayer: opinionOf(bot, key), inventory: bot.inv.summary(6).join(", "),
  };
  const act = (intent, item, spoken) => applyPlayerIntent(bot, player, key, intent, item, setOrder, text, spoken);
  if (llmReady()) {
    llmRequest("player_talk", bot.persona(), { player: player.name, text, facts }, (res) => {
      const parsed = res && safeJson(res);
      if (parsed && parsed.say) {
        bot.chatNow(String(parsed.say));
        act(String(parsed.action || "none"), parsed.item ? String(parsed.item) : undefined, true);
      } else act(classifyPlayer(text), findItemWord(text));
    });
    return;
  }
  act(classifyPlayer(text), findItemWord(text));
}

function safeJson(s) {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    return null;
  }
}

function applyPlayerIntent(bot, player, key, intent, item, setOrder, text, spoken) {
  const op = opinionOf(bot, key);
  const say = (i, c = {}) => {
    if (!spoken) bot.chatNow(bot.line(i, { target: player.name, ...c }));
  };
  const willing = op > -40 || chance(0.2);
  switch (intent) {
    case "follow":
      if (willing) {
        setOrder(bot, { type: "follow", player: player.id });
        say("follow_ok");
      } else say("decline", { reason: "not doing that for you" });
      break;
    case "stay":
      setOrder(bot, { type: "stay", pos: { ...bot.pos } });
      say("stay_ok");
      break;
    case "come":
      if (willing) {
        setOrder(bot, { type: "stay", pos: { ...player.location } });
        say("come_ok");
      }
      break;
    case "free":
      setOrder(bot, null);
      say("free_ok");
      break;
    case "home":
      if (bot.mem.home) setOrder(bot, { type: "home" });
      say(bot.mem.home ? "free_ok" : "confused");
      break;
    case "give": {
      const it = item && (item.startsWith("minecraft:") || item.startsWith("#")) ? item : findItemWord(text);
      const generous = (bot.personality.generosity ?? 0.5) + op / 100 > 0.35;
      const have = it ? bot.inv.count(it) : 0;
      if (it && have > 0 && generous) {
        const n = Math.max(1, Math.min(have, Math.ceil(have / 3)));
        const moved = bot.inv.remove(it, n);
        const pc = player.getComponent("minecraft:inventory");
        for (const m of moved) safeGive(pc, bot, player, m);
        say("give_ok", { item: moved[0].id, n });
        adjustOpinion(bot, key, -1);
      } else say(have ? "decline" : "give_no", { item: it || "that" });
      break;
    }
    case "join_town": {
      const t = townOf(bot);
      say(t ? "invite_town" : "confused", { town: t ? t.name : "" });
      break;
    }
    case "event": {
      const ev = proposeEvent(bot, /feast/.test(text) ? "feast" : /festival/.test(text) ? "festival" : "hangout", player.location, 1200, { placeName: coords(player.location) });
      if (!ev) say("decline", { reason: "already planning something" });
      break;
    }
    case "faith": {
      const r = religionOf(bot);
      if (r) bot.chatNow(bot.line("preach", { deity: r.deity, rel: r.name, target: player.name, tenet: pick(r.tenets).text }));
      else say("reject_faith", { deity: "god" });
      break;
    }
    case "where": {
      const w = Object.keys(PLACE_WORDS).find((k) => text.toLowerCase().includes(k));
      if (w === "town") {
        const t = townOf(bot) || Object.values(soc().towns)[0];
        say("answer_place", t ? { where: directionWords(player.location, t.center), coords: `${t.center.x} ${t.center.y} ${t.center.z}` } : {});
      } else {
        const p = w ? recallPlace(bot, PLACE_WORDS[w], bot.dimName, player.location) : null;
        say("answer_place", p ? { where: directionWords(player.location, p), coords: `${p.x} ${p.y} ${p.z}` } : {});
      }
      break;
    }
    case "how":
      say("how_are_you");
      break;
    case "thanks":
      adjustOpinion(bot, key, 2);
      say(chance(0.5) ? "free_ok" : "greet");
      break;
    case "insult":
      adjustOpinion(bot, key, -10);
      say(chance(bot.personality.temper ?? 0.5) ? "insult" : "apologize");
      break;
    case "compliment":
      adjustOpinion(bot, key, 6);
      say("thanks");
      break;
    case "greet":
      adjustOpinion(bot, key, 1);
      say("greet");
      break;
    case "none":
      break;
    default:
      say(chance(0.5) ? "how_are_you" : "smalltalk");
  }
}

function safeGive(pc, bot, player, m) {
  try {
    const rest = pc && pc.container ? pc.container.addItem(new ItemStack(m.id, m.n)) : new ItemStack(m.id, m.n);
    if (rest) bot.dim.spawnItem(rest, player.location);
  } catch (e) {
    /* ignore */
  }
}
