import { SIM, world } from "@minecraft/server";
let __s = 7; Math.random = () => { __s = (__s * 16807) % 2147483647; return (__s - 1) / 2147483646; };
world.setDynamicProperty("aip:config", JSON.stringify({ startingKit: "iron", debug: true }));
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
const town = await import("./scripts/ai/town.js");
const build = await import("./scripts/ai/build.js");
SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
for (let i = 0; i < 5; i++) SIM.step();
const bot = mgr.spawnBot(SIM.dims.overworld, { x: 3.5, y: 70, z: 3.5 }, { mode: "free" });
bot.inv.add("minecraft:cobblestone", 200); bot.inv.add("minecraft:oak_planks", 128); bot.inv.add("minecraft:oak_log", 32); bot.inv.add("minecraft:torch", 16);
for (let i = 0; i < 3; i++) SIM.step();
bot.clearRoutines();
const kind = process.argv[2] || "house";
let gen;
if (kind === "house") gen = build.buildHouse(bot);
else { const t = town.foundTown(bot); gen = town.workOnProject(bot, t); globalThis.T = t; }
bot.push(gen, 90, "test");
let t = 0, last = "";
for (; t < 20 * 600 && bot.stack.some((e) => e.name === "test"); t++) { SIM.step(); if (bot.task !== last) { last = bot.task; } }
if (globalThis.T && process.argv[3]) {
  globalThis.T.members.push("x1", "x2"); town.plan(globalThis.T);
  bot.push(town.workOnProject(bot, globalThis.T), 90, "test");
  const t1 = t;
  for (; t < t1 + 20 * 900 && bot.stack.some((e) => e.name === "test"); t++) SIM.step();
  console.log("second project took", t - t1, "ticks");
}
console.log("finished after", t, "ticks; task", bot.task, "home", JSON.stringify(bot.mem.home));
if (globalThis.T) console.log("town built", JSON.stringify(globalThis.T.built.map(b=>b.type)), "projects", JSON.stringify(globalThis.T.projects.map(p=>p.type)));
const logs = SIM.logs.filter((l) => l.includes("AIP"));
console.log(logs.length, "debug lines;", logs.slice(0, 8).join("\n"));
