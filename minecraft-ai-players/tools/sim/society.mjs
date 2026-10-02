// Multi-bot society simulation: prints the chat log and the state of towns, religions and events.
import { SIM, world } from "@minecraft/server";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
let __s = Number(args.seed || 3);
Math.random = () => { __s = (__s * 16807) % 2147483647; return (__s - 1) / 2147483646; };
world.setDynamicProperty("aip:config", JSON.stringify({ debug: true, startingKit: args.kit || "iron", maxBots: 8, ...(args.config ? JSON.parse(args.config) : {}) }));
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
const { soc } = await import("./scripts/society.js");
const player = SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
for (let i = 0; i < 40; i++) SIM.spawn(["minecraft:cow", "minecraft:chicken", "minecraft:sheep", "minecraft:cow", "minecraft:spider"][i % 5], { x: (i * 37 % 120) - 60, y: 70, z: (i * 53 % 120) - 60 });
for (let i = 0; i < 5; i++) SIM.step();
const n = Number(args.bots || 5);
for (let i = 0; i < n; i++) mgr.spawnBot(SIM.dims.overworld, { x: 3.5 + i * 2, y: 70, z: 3.5 }, {});
const bots = [...mgr.bots.values()];
if (args.leader) { bots[0].personality.leadership = 0.95; bots[0].personality.sociability = 0.9; bots[1].personality.spirituality = 0.95; }
const minutes = Number(args.min || 30);
const t0 = Date.now();
let worst = 0;
for (let t = 0; t < minutes * 1200; t++) {
  const s = performance.now();
  SIM.step();
  worst = Math.max(worst, performance.now() - s);
  if (args.talk && t === 6000) (await import("./scripts/main.js")).talkNearby(player, args.talk);
}
const chat = SIM.logs.filter((l) => /<|§[bde6]|sign/.test(l) && !/tickingarea/.test(l));
console.log(chat.slice(-(Number(args.lines || 80))).join("\n"));
const s = soc();
console.log("\n== TOWNS", JSON.stringify(Object.values(s.towns).map((t) => ({ name: t.name, members: t.members.length, mayor: t.mayorName, built: t.built.map((b) => b.type), projects: t.projects.map((p) => p.type), plots: t.plots.filter((p) => p.built).length })), null, 0));
console.log("== RELIGIONS", JSON.stringify(Object.values(s.religions).map((r) => ({ name: r.name, deity: r.deity, members: r.members.length, tenets: r.tenets.map((x) => x.text) }))));
console.log("== EVENTS", JSON.stringify(Object.values(s.events).map((e) => ({ title: e.title, host: e.hostName, status: e.status, accepted: e.accepted.length, attended: e.attended.length }))));
for (const b of mgr.bots.values()) console.log(`${b.name} [${b.mode}] task="${b.task}" town=${b.mem.town || "-"} faith=${b.mem.faith ? b.mem.faith.rel : "-"} mistakes=${b.mem.journal.filter((j) => j.type === "mistake").map((j) => j.kind).join(",")} ms=${(b.mem.msDone || []).length}`);
console.log(`chat lines: ${chat.length}, worst tick ${worst.toFixed(0)}ms, wall ${(Date.now() - t0) / 1000}s`);
