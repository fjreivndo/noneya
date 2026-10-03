// Focused tests for 1.3 features: bed + sleep, fishing, breeding, villager trading, boat, enchanting, player trading.
import { SIM, world } from "@minecraft/server";
let __s = 9; Math.random = () => { __s = (__s * 16807) % 2147483647; return (__s - 1) / 2147483646; };
world.setDynamicProperty("aip:config", JSON.stringify({ debug: true, startingKit: "iron" }));
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
const life = await import("./scripts/ai/life.js");
const trade = await import("./scripts/ai/trade.js");
const social = await import("./scripts/ai/social.js");
const ui = await import("./scripts/ui.js");
const player = SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
player.name = "Tester";
for (let i = 0; i < 5; i++) SIM.step();
const bot = mgr.spawnBot(SIM.dims.overworld, { x: 3.5, y: 70, z: 3.5 }, { mode: "free" });
for (let i = 0; i < 3; i++) SIM.step();
bot.clearRoutines();
async function run(name, gen, maxTicks = 20 * 300) {
  bot.clearRoutines();
  bot.push(gen, 95, name);
  let t = 0;
  for (; t < maxTicks && bot.stack.some((e) => e.name === name); t++) SIM.step();
  return t;
}
const results = {};
// fishing
bot.inv.add("minecraft:fishing_rod", 1);
let t = await run("fish", life.fish(bot));
results.fishing = `${t} ticks, cod=${bot.inv.count("minecraft:cod")} salmon=${bot.inv.count("minecraft:salmon")}`;
// breeding
bot.inv.add("minecraft:wheat", 6);
SIM.spawn("minecraft:cow", { x: bot.pos.x + 3, y: bot.pos.y + 1, z: bot.pos.z }); SIM.spawn("minecraft:cow", { x: bot.pos.x - 3, y: bot.pos.y + 1, z: bot.pos.z });
const cowsBefore = SIM.dims.overworld.getEntities({ type: "minecraft:cow" }).length;
t = await run("breed", life.breedAnimals(bot));
results.breeding = `${t} ticks, cows ${cowsBefore} -> ${SIM.dims.overworld.getEntities({ type: "minecraft:cow" }).length}`;
// villager trading
bot.inv.add("minecraft:coal", 40); bot.inv.add("minecraft:wheat", 40);
SIM.spawn("minecraft:villager_v2", { x: bot.pos.x + 5, y: bot.pos.y + 1, z: bot.pos.z + 2 });
t = await run("villager", trade.tradeWithVillagers(bot));
results.villagers = `${t} ticks, emeralds=${bot.inv.count("minecraft:emerald")} bread=${bot.inv.count("minecraft:bread")} coal left=${bot.inv.count("minecraft:coal")}`;
// bed
bot.inv.add("minecraft:white_wool", 3); bot.inv.add("minecraft:oak_planks", 3);
const f = bot.feetBlock();
const placed = life.placeBed(bot, { x: f.x + 2, y: f.y, z: f.z });
results.bed = `placed=${placed} block=${SIM.dims.overworld._get(f.x + 2, f.y, f.z)} head=${SIM.dims.overworld._get(f.x + 2, f.y, f.z + 1)}`;
SIM.time = 13000 - SIM.tick; // nightfall
t = await run("sleep", life.sleepInBed(bot), 20 * 600);
results.sleep = `${t} ticks asleep-until-morning, action prop now=${bot.entity.props["aip:action"]}`;
SIM.time = 1000 - SIM.tick;
// enchanting
bot.mem.xp = 40; bot.inv.add("minecraft:lapis_lazuli", 6);
SIM.dims.overworld._set(f.x - 2, f.y, f.z, "minecraft:enchanting_table");
t = await run("enchant", life.enchant(bot));
results.enchant = `${t} ticks, enchants=${JSON.stringify(bot.mem.enchants)} xp=${bot.mem.xp}`;
// boat across the lake (x 70..150)
bot.entity.location = { x: 66.5, y: 66, z: 0.5 };
for (let i = 0; i < 20; i++) SIM.step();
bot.inv.add("minecraft:oak_planks", 10);
t = await run("boat", life.boatTo(bot, { x: 156.5, y: 64, z: 0.5 }), 20 * 200);
results.boat = `${t} ticks, now at x=${bot.pos.x.toFixed(1)} (lake ends at 150), boats=${bot.mem.boats}`;
// player trade talk
bot.entity.location = { x: 3.5, y: 70, z: 3.5 };
for (let i = 0; i < 30; i++) SIM.step();
player.inv.addItem(new (await import("@minecraft/server")).ItemStack("minecraft:iron_ingot", 20));
bot.inv.add("minecraft:diamond", 6);
const say = (txt) => { social.handlePlayerTalk(bot, player, txt, ui.setOrder); for (let i = 0; i < 120; i++) SIM.step(); };
say("what do you have for sale?");
say("i'll trade 3 iron for 1 diamond");
say("deal");
results.player_trade = `player diamonds=${player.inv.slots.filter(Boolean).filter((s) => s.typeId === "minecraft:diamond").reduce((a, s) => a + s.amount, 0)} iron=${player.inv.slots.filter(Boolean).filter((s) => s.typeId === "minecraft:iron_ingot").reduce((a, s) => a + s.amount, 0)}`;
console.log(JSON.stringify(results, null, 1));
console.log(SIM.logs.filter((l) => l.includes("<") && !l.includes("AIP")).slice(-8).join("\n"));
console.log("same-dimension teleports:", SIM.teleports.length);
