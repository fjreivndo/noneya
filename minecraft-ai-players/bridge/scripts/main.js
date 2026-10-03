// AI Players LLM Bridge: turns /scriptevent requests from the AI Players pack into Claude API calls.
// Runs only on Bedrock Dedicated Server (server-net / server-admin are BDS-only beta modules).
import { world, system } from "@minecraft/server";
import { http, HttpRequest, HttpRequestMethod } from "@minecraft/server-net";
import { secrets, variables } from "@minecraft/server-admin";

const API_KEY = secrets.get("ANTHROPIC_API_KEY");
const MODEL = String(variables.get("model") ?? "claude-opus-5-5");
const EFFORT = String(variables.get("effort") ?? "low");

const STYLE =
  "You are role-playing a player in a Minecraft Bedrock world. Write exactly one chat message as that player would type it: " +
  "short (usually under 20 words), casual, in their personal style, no quotation marks, no narration, no emoji unless their style says so. " +
  "Stay grounded in the facts given; do not invent items, places or events you weren't told about.";

function reply(id, text) {
  const payload = JSON.stringify({ id, text }).replace(/[\n\r]/g, " ");
  try {
    world.getDimension("overworld").runCommand(`scriptevent aip:llm_res ${payload}`);
  } catch (e) {
    console.warn(`[aip bridge] could not reply: ${e}`);
  }
}

function buildPrompt(kind, persona, ctx) {
  const who =
    `You are ${persona.name}. Personality: ${persona.traits}. Speaking style: ${persona.style}. ` +
    `Mood: ${persona.mood}. Currently: ${persona.task}.` +
    (persona.town ? ` You live in the town of ${persona.town}.` : "") +
    (persona.faith ? ` Your religion: ${persona.faith}.` : "") +
    (persona.memory ? ` Recent memories: ${persona.memory}.` : "");
  if (kind === "player_talk") {
    return {
      system:
        `${STYLE} ${who} A player is talking to you. Reply in character, then decide what you will do. ` +
        `Respond with only a JSON object: {"say": "<your chat message>", "action": "<one of: none, follow, stay, come, give, free, home, join_town, attend_event, help>", "item": "<minecraft item id if action is give, else empty>"}.`,
      user: `${ctx.player} says to you: "${ctx.text}". Facts you may use: ${JSON.stringify(ctx.facts || {})}`,
    };
  }
  return {
    system: `${STYLE} ${who}`,
    user: `What you want to say (intent): ${kind}. Facts: ${JSON.stringify(ctx)}. Write the message.`,
  };
}

async function handle(data) {
  if (!API_KEY) {
    reply(data.id, null);
    return;
  }
  const p = buildPrompt(data.kind, data.persona || {}, data.ctx || {});
  const body = {
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: EFFORT },
    // re-route automatically if a safety classifier declines
    fallbacks: "default",
    system: p.system,
    messages: [{ role: "user", content: p.user }],
  };
  const req = new HttpRequest("https://api.anthropic.com/v1/messages")
    .setMethod(HttpRequestMethod.Post)
    .addHeader("content-type", "application/json")
    .addHeader("anthropic-version", "2023-06-01")
    .addHeader("anthropic-beta", "server-side-fallback-2026-07-01")
    .addHeader("x-api-key", API_KEY)
    .setBody(JSON.stringify(body))
    .setTimeout(20);
  try {
    const res = await http.request(req);
    if (res.status !== 200) {
      console.warn(`[aip bridge] HTTP ${res.status}: ${res.body.slice(0, 200)}`);
      reply(data.id, null);
      return;
    }
    const msg = JSON.parse(res.body);
    if (msg.stop_reason === "refusal") {
      reply(data.id, null);
      return;
    }
    const text = (msg.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    reply(data.id, text.slice(0, 400) || null);
  } catch (e) {
    console.warn(`[aip bridge] request failed: ${e}`);
    reply(data.id, null);
  }
}

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "aip:llm_ping") {
    if (API_KEY) world.getDimension("overworld").runCommand(`scriptevent aip:llm_pong {"model":"${MODEL}"}`);
    else console.warn("[aip bridge] no ANTHROPIC_API_KEY secret configured");
    return;
  }
  if (ev.id !== "aip:llm_req") return;
  let data;
  try {
    data = JSON.parse(ev.message);
  } catch (e) {
    return;
  }
  handle(data);
});
