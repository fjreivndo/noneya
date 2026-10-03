// Shared world state for AI society: towns, religions, planned events, the message bus and the chat queue.
import { world, system } from "@minecraft/server";
import { cfg } from "./config.js";
import { now, safe, randInt } from "./util.js";

let S = null;
let dirty = false;

function load() {
  const read = (k) => safe(() => JSON.parse(String(world.getDynamicProperty(k) ?? "null")), null);
  const idx = read("aip:soc") || { towns: [], religions: [], events: {}, next: 1 };
  S = { towns: {}, religions: {}, events: idx.events || {}, next: idx.next || 1 };
  for (const id of idx.towns || []) {
    const t = read(`aip:town:${id}`);
    if (t) S.towns[id] = t;
  }
  for (const id of idx.religions || []) {
    const r = read(`aip:rel:${id}`);
    if (r) S.religions[id] = r;
  }
}

export function soc() {
  if (!S) load();
  return S;
}

export function markDirty() {
  dirty = true;
}

export function newId(prefix) {
  const s = soc();
  s.next++;
  markDirty();
  return `${prefix}${s.next.toString(36)}`;
}

export function flushSociety() {
  if (!dirty || !S) return;
  dirty = false;
  // drop finished events older than ~2 in-game days
  for (const [id, e] of Object.entries(S.events)) if (e.status === "done" && now() - e.until > 48000) delete S.events[id];
  safe(() => {
    world.setDynamicProperty("aip:soc", JSON.stringify({ towns: Object.keys(S.towns), religions: Object.keys(S.religions), events: S.events, next: S.next }));
    for (const t of Object.values(S.towns)) world.setDynamicProperty(`aip:town:${t.id}`, JSON.stringify(t));
    for (const r of Object.values(S.religions)) world.setDynamicProperty(`aip:rel:${r.id}`, JSON.stringify(r));
  }, null);
}

// ---------------------------------------------------------------------------
// Message bus. Bots "hear" every chat message (it's server chat), after a human-like delay.
// msg: {from, fromName, to?, intent, data, text, depth}
// ---------------------------------------------------------------------------
const listeners = new Map(); // botId -> bot

export function registerListener(bot) {
  listeners.set(bot.id, bot);
}
export function unregisterListener(id) {
  listeners.delete(id);
}

export function onlineSociety() {
  return [...listeners.values()].filter((b) => b.entity && b.entity.isValid);
}

export function deliver(msg) {
  if (!cfg().botChat && msg.fromKind !== "player") return;
  for (const bot of listeners.values()) {
    if (bot.id === msg.from) continue;
    if (!bot.entity || !bot.entity.isValid) continue;
    const delay = randInt(15, 60) + (msg.to && msg.to !== bot.id ? 40 : 0);
    bot.inbox.push({ ...msg, readAt: now() + delay });
    if (bot.inbox.length > 12) bot.inbox.shift();
  }
}

// ---------------------------------------------------------------------------
// Chat queue: keeps the chat readable when many bots want to talk.
// ---------------------------------------------------------------------------
const queue = [];
let nextSend = 0;

export function enqueueChat(name, text, prio = 1, onSent) {
  if (!text) return;
  queue.push({ name, text, prio, onSent, t: now() });
  if (queue.length > 8) {
    queue.sort((a, b) => b.prio - a.prio || a.t - b.t);
    queue.length = 8;
  }
}

export function pumpChat() {
  if (!queue.length || now() < nextSend) return;
  queue.sort((a, b) => b.prio - a.prio || a.t - b.t);
  const m = queue.shift();
  if (now() - m.t > 400 && m.prio < 2) return; // stale smalltalk
  world.sendMessage(`<${m.name}> ${m.text}`);
  if (m.onSent) safe(() => m.onSent(), null);
  const f = Math.max(0.2, cfg().chatFrequency);
  nextSend = now() + Math.round(25 / f + m.text.length / 3);
}

system.runInterval(() => {
  pumpChat();
  if (now() % 200 === 0) flushSociety();
}, 1);
