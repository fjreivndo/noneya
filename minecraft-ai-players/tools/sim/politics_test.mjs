import { SIM, world } from "@minecraft/server";
let __s = 4; Math.random = () => { __s = (__s * 16807) % 2147483647; return (__s - 1) / 2147483646; };
world.setDynamicProperty("aip:config", JSON.stringify({ townWars: process.argv[2] === "war", startingKit: "iron" }));
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
const town = await import("./scripts/ai/town.js");
const pol = await import("./scripts/ai/politics.js");
const combat = await import("./scripts/ai/combat.js");
SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
for (let i = 0; i < 5; i++) SIM.step();
const bots = [];
for (let i = 0; i < 4; i++) bots.push(mgr.spawnBot(SIM.dims.overworld, { x: (i < 2 ? -30 : 30) + i, y: 70, z: 3.5 }, { mode: "free" }));
for (let i = 0; i < 5; i++) SIM.step();
bots.forEach((b) => b.clearRoutines());
const A = town.foundTown(bots[0]); town.joinTown(bots[1], A);
bots[2].mem.home = null;
const B = (() => { bots[2].entity.location = { x: 260, y: 70, z: 3 }; return town.foundTown(bots[2]); })();
town.joinTown(bots[3], B);
// they can't stand each other
for (const a of [bots[0], bots[1]]) for (const b of [bots[2], bots[3]]) { a.mem.opinions[b.id] = -80; b.mem.opinions[a.id] = -80; }
for (let i = 0; i < 6; i++) pol.updatePolitics(bots);
console.log("relations:", pol.politicsSummary().join(" | "));
bots[3].entity.location = { x: bots[0].pos.x + 3, y: bots[0].pos.y, z: bots[0].pos.z };
const threats = combat.findThreats(bots[0], 10).map((e) => e.nameTag.split("\n")[0]);
console.log("bot0 sees as hostile:", JSON.stringify(threats), "enemies:", pol.enemies(bots[0], bots[3]));
// now they make up
for (const a of [bots[0], bots[1]]) for (const b of [bots[2], bots[3]]) { a.mem.opinions[b.id] = 80; b.mem.opinions[a.id] = 80; }
for (let i = 0; i < 10; i++) pol.updatePolitics(bots);
console.log("after making up:", pol.politicsSummary().join(" | "));
console.log(SIM.logs.filter((l) => /§[abce6]/.test(l) && /war|rival|peace|alliance|founded/.test(l)).join("\n"));
