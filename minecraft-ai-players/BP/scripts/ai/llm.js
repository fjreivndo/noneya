// Optional real-language-model speech. Talks to the separate "AI Players LLM Bridge" pack (Bedrock
// Dedicated Server only) through /scriptevent, because the stable API has no direct HTTP access.
import { world, system } from "@minecraft/server";
import { cfg } from "../config.js";
import { now, safe } from "../util.js";

let bridgeSeen = 0;
let nextId = 1;
const pending = new Map(); // id -> {cb, at}
let inflight = 0;

function send(eventId, payload) {
  const msg = JSON.stringify(payload).replace(/[\n\r]/g, " ");
  return safe(() => {
    world.getDimension("overworld").runCommand(`scriptevent ${eventId} ${msg}`);
    return true;
  }, false);
}

export function pingBridge() {
  send("aip:llm_ping", { t: now() });
}

export function llmReady() {
  return cfg().speechMode !== "generated" && bridgeSeen > 0 && now() - bridgeSeen < 20 * 600;
}

/**
 * Ask the model for a line. persona/ctx are small objects; cb(text|null) is always called once.
 */
export function llmRequest(kind, persona, ctx, cb, timeoutTicks = 160) {
  if (!llmReady() || inflight >= 3) {
    cb(null);
    return;
  }
  const id = String(nextId++);
  inflight++;
  pending.set(id, { cb, at: now() + timeoutTicks });
  const ok = send("aip:llm_req", { id, kind, persona, ctx });
  if (!ok) finish(id, null);
}

function finish(id, text) {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  inflight = Math.max(0, inflight - 1);
  safe(() => p.cb(text), null);
}

export function onScriptEvent(id, message) {
  if (id === "aip:llm_pong") {
    if (!bridgeSeen) world.sendMessage("§a[AI Players]§r LLM bridge connected - bots can now talk freely.");
    bridgeSeen = now();
    return true;
  }
  if (id === "aip:llm_res") {
    const data = safe(() => JSON.parse(message), null);
    if (data && data.id) finish(String(data.id), data.text ? String(data.text) : null);
    return true;
  }
  return false;
}

system.runInterval(() => {
  for (const [id, p] of pending) if (now() > p.at) finish(id, null);
}, 20);
system.runInterval(() => pingBridge(), 20 * 300);
system.runTimeout(() => pingBridge(), 100);
