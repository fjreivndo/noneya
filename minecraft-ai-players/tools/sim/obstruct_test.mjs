// A block hidden behind another (stone corner / leaves): the bot must clear the blocker and face what it mines.
import { SIM, world } from "@minecraft/server";
let __s = 7; Math.random = () => { __s = (__s * 16807) % 2147483647; return (__s - 1) / 2147483646; };
world.setDynamicProperty("aip:config", JSON.stringify({ debug: true }));
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
const act = await import("./scripts/ai/actions.js");
const { facingError } = await import("./scripts/ai/movement.js");
SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
for (let i = 0; i < 5; i++) SIM.step();
const d = SIM.dims.overworld;
const bot = mgr.spawnBot(d, { x: 3.5, y: 70, z: 3.5 }, { mode: "survivor" });
for (let i = 0; i < 40; i++) SIM.step();
bot.stack.length = 0; // no own routines, we drive it
const f = bot.feetBlock();
// target: iron ore 3 blocks ahead at eye level, with dirt then leaves in between
const target = { x: f.x + 3, y: f.y + 1, z: f.z };
d._set(target.x, target.y, target.z, "minecraft:iron_ore");
d._set(f.x + 2, f.y + 1, f.z, "minecraft:dirt");
d._set(f.x + 1, f.y + 1, f.z, "minecraft:oak_leaves");
bot.inv.add("minecraft:stone_pickaxe", 1);
console.log("visible before:", act.lineOfSight(d, bot.eye, target), "clearable:", act.inReachOrClearable(bot, target));
let done = null, facing = [];
const gen = act.mineBlock(bot, target);
for (let t = 0; t < 400 && done === null; t++) {
  const r = gen.next();
  if (r.done) done = r.value;
  if (bot.action === 1) facing.push(facingError(bot, { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 }));
  SIM.step();
}
console.log("mined:", done, "now:", d._get(target.x, target.y, target.z), "blockers:", d._get(f.x + 2, f.y + 1, f.z), d._get(f.x + 1, f.y + 1, f.z));
console.log("facing err while mining: max", Math.max(...facing).toFixed(1), "samples", facing.length);
console.log("yaw property:", bot.entity.getProperty("aip:yaw"), "bot.yaw", bot.yaw.toFixed(1));
console.log(SIM.logs.filter((l) => l.includes("AIP")).slice(-6).join("\n"));
