import { SIM, world, END_PILLARS } from "@minecraft/server";
const args = Object.fromEntries(process.argv.slice(2).map(a => a.split("=")));
world.setDynamicProperty("aip:config", JSON.stringify({ stuckAssistMinutes: 1, strongholdSearchMinutes: 1, debug: true }));
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
for (let i = 0; i < 20; i++) SIM.spawn(["minecraft:cow","minecraft:chicken","minecraft:spider","minecraft:cow"][i%4], { x: (i * 37 % 80) - 40, y: 70, z: (i * 53 % 80) - 40 });
for (const [x, z] of END_PILLARS) SIM.dims.the_end.spawnEntity("minecraft:ender_crystal", { x: x + 0.5, y: 81, z: z + 0.5 });
for (let i = 0; i < 5; i++) SIM.step();
const bot = mgr.spawnBot(SIM.dims.overworld, { x: 3.5, y: 70, z: 3.5 }, { mode: "beat_game" });
const kit = (args.kit || "full") === "full" ? [["minecraft:diamond_pickaxe",1],["minecraft:diamond_sword",1],["minecraft:iron_helmet",1],["minecraft:iron_chestplate",1],["minecraft:iron_leggings",1],["minecraft:iron_boots",1],["minecraft:bow",1],["minecraft:arrow",64],["minecraft:cobblestone",128],["minecraft:cooked_beef",32],["minecraft:torch",32],["minecraft:iron_sword",1],["minecraft:iron_pickaxe",1],["minecraft:stone_axe",1]] : [];
for (const [id,n] of kit) bot.inv.add(id, n);
if (args.extra === "nether" || args.extra === "end") for (const [id,n] of [["minecraft:obsidian",10],["minecraft:flint_and_steel",1]]) bot.inv.add(id,n);
if (args.extra === "end") for (const [id,n] of [["minecraft:ender_eye",12]]) bot.inv.add(id,n);
if (args.extra === "dragon") for (const [id,n] of [["minecraft:ender_eye",12],["minecraft:blaze_rod",1]]) bot.inv.add(id,n);
if (args.extra === "eyes") for (const [id,n] of [["minecraft:obsidian",10],["minecraft:flint_and_steel",1],["minecraft:blaze_rod",7]]) bot.inv.add(id,n);
bot.equipBest();
let lastTask = "", lastDim = "";
for (let t = 0; t < (Number(args.min||40)) * 1200; t++) {
  SIM.step();
  const b = [...mgr.bots.values()][0];
  if (!b) continue;
  if (b.task !== lastTask) { lastTask = b.task; if (!/crafting (planks|stick)/.test(b.task)) console.log(`[t${SIM.tick}] ${b.dimName} task: ${b.task} @ ${b.pos.x.toFixed(1)},${b.pos.y.toFixed(1)},${b.pos.z.toFixed(1)}`); }
  if (b.mem.flags.beatGame && b.dimName === "overworld") { console.log("VICTORY at tick", SIM.tick); break; }
  if (b.dimName === "the_end" && t % 200 === 0) { const dr = SIM.dims.the_end.getEntities({type:"minecraft:ender_dragon"})[0]; console.log(`   end t${SIM.tick} pos ${b.pos.x.toFixed(1)},${b.pos.y.toFixed(1)},${b.pos.z.toFixed(1)} hp ${b.health} arrows ${b.inv.count("minecraft:arrow")} blocks ${b.inv.buildingCount()} crystals ${SIM.dims.the_end.getEntities({type:"minecraft:ender_crystal"}).length} dragon ${dr ? dr.hp : "none"}`); }
}
const b = [...mgr.bots.values()][0];
console.log("\nLOGS:\n" + SIM.logs.slice(-40).join("\n"));
if (b) console.log(`\nFINAL dim=${b.dimName} hp=${b.health} inv: ${b.inv.summary(30).join(", ")}\ncooldowns=${JSON.stringify(b.cooldowns)} msDone=${JSON.stringify(b.mem.msDone)}`);
