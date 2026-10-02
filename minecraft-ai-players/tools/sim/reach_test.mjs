// Checks reach, line of sight and facing at the moment each block is broken.
import { SIM, world } from "@minecraft/server";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
let __s = Number(args.seed || 3);
Math.random = () => { __s = (__s * 16807) % 2147483647; return (__s - 1) / 2147483646; };
world.setDynamicProperty("aip:config", JSON.stringify({ reach: 5, configVersion: 1, debug: true })); // old saved config: must be migrated to 4
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
const { facingError } = await import("./scripts/ai/movement.js");
const { cfg } = await import("./scripts/config.js");
SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
for (let i = 0; i < 20; i++) SIM.spawn("minecraft:cow", { x: (i * 37 % 80) - 40, y: 70, z: (i * 53 % 80) - 40 });
for (let i = 0; i < 5; i++) SIM.step();
const bot = mgr.spawnBot(SIM.dims.overworld, { x: 3.5, y: 70, z: 3.5 }, { mode: args.mode || "beat_game" });
const samples = [];
let seen = 0;
for (let t = 0; t < Number(args.min || 8) * 1200; t++) {
  SIM.step();
  while (seen < SIM.breaks.length) {
    const b = SIM.breaks[seen++];
    if (!bot.entity.isValid) continue;
    const c = { x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 };
    const e = bot.eye;
    samples.push({ d: Math.hypot(c.x - e.x, c.y - e.y, c.z - e.z), f: facingError(bot, c), type: b.type });
  }
}
const items = SIM.dims.overworld.getEntities({ type: "minecraft:item" }).length;
samples.sort((a, b) => b.d - a.d);
const avg = (k) => (samples.reduce((s, x) => s + x[k], 0) / samples.length).toFixed(2);
console.log(`config reach after migration: ${cfg().reach}`);
console.log(`blocks broken: ${samples.length}, mined stat: ${bot.stats.mined}`);
console.log(`distance eye->block: max ${samples[0]?.d.toFixed(2)} avg ${avg("d")}`);
console.log(`facing error deg: max ${Math.max(...samples.map((s) => s.f)).toFixed(1)} avg ${avg("f")}, >20deg: ${samples.filter((s) => s.f > 20).length}`);
console.log(`leftover vanilla drop entities: ${items}`);
console.log(`worst samples: ${samples.slice(0, 3).map((s) => `${s.type.replace("minecraft:", "")} ${s.d.toFixed(2)}m ${s.f.toFixed(0)}deg`).join(" | ")}`);
console.log(`inventory: ${bot.inv.summary(8).join(", ")}`);
console.log(SIM.logs.filter((l) => l.includes("AIP")).slice(0, 15).join("\n"));
console.log("task:", bot.task, "pos", JSON.stringify(bot.pos), "valid", bot.entity.isValid);
