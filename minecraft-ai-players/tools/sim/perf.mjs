import { SIM, world } from "@minecraft/server";
let __s = 5; Math.random = () => { __s = (__s * 16807) % 2147483647; return (__s - 1) / 2147483646; };
world.setDynamicProperty("aip:config", JSON.stringify({ maxBots: 20, startingKit: "basic" }));
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
for (let i = 0; i < 30; i++) SIM.spawn("minecraft:cow", { x: (i * 37 % 160) - 80, y: 70, z: (i * 53 % 160) - 80 });
for (let i = 0; i < 5; i++) SIM.step();
for (let i = 0; i < 15; i++) mgr.spawnBot(SIM.dims.overworld, { x: (i % 5) * 40 - 80, y: 72, z: Math.floor(i / 5) * 40 - 40 }, {});
const times = [];
for (let t = 0; t < 1200 * 6; t++) { const s = performance.now(); SIM.step(); times.push(performance.now() - s); }
times.sort((a, b) => a - b);
const areas = SIM.ticking.filter((c) => c.includes("add")).slice(-12).map((c) => c.split(" ").slice(-2).join(" "));
console.log(`15 bots: avg ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)}ms p99 ${times[Math.floor(times.length * 0.99)].toFixed(1)}ms`);
console.log("last ticking-area commands:", [...new Set(areas)].join(", "));
console.log("online:", mgr.onlineBots().length);
