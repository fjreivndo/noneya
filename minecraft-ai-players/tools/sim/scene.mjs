import { SIM, world } from "@minecraft/server";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
let __s = 2; Math.random = () => { __s = (__s * 16807) % 2147483647; return (__s - 1) / 2147483646; };
world.setDynamicProperty("aip:config", JSON.stringify({}));
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
for (let i = 0; i < 25; i++) SIM.spawn(i % 5 === 0 ? "minecraft:chicken" : "minecraft:cow", { x: (i * 37 % 80) - 40, y: 70, z: (i * 53 % 80) - 40 });
for (let i = 0; i < 5; i++) SIM.step();
const bot = mgr.spawnBot(SIM.dims.overworld, { x: 3.5, y: 70, z: 3.5 }, { mode: "beat_game" });
for (let t = 0; t < 1200 * 14; t++) SIM.step();
const f = bot.feetBlock();
const d = SIM.dims.overworld;
console.log("bot", JSON.stringify(bot.pos), "feet", JSON.stringify(f), "ground", bot.entity.isOnGround);
for (let y = f.y + 3; y >= f.y - 1; y--) {
  let row = `y${y}: `;
  for (let z = f.z - 1; z <= f.z + 1; z++) { for (let x = f.x - 1; x <= f.x + 1; x++) row += (d._get(x, y, z).replace("minecraft:", "").slice(0, 6)).padEnd(7); row += "| "; }
  console.log(row);
}
// watch 60 ticks of motor
for (let t = 0; t < 60; t++) { SIM.step(); if (t % 6 === 0) console.log(t, bot.pos.y.toFixed(2), bot.entity.v.y.toFixed(3), bot.entity.isOnGround, bot.task); }
