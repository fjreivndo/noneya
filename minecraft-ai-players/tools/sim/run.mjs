import { SIM, world } from "@minecraft/server";
const __seed = Number((process.argv.find(a=>a.startsWith("seed="))||"seed=1").slice(5)); let __s = __seed; Math.random = () => { __s = (__s * 16807) % 2147483647; return (__s - 1) / 2147483646; };
const args = Object.fromEntries(process.argv.slice(2).map(a => a.split("=")));
SIM.echo = args.echo === "1";
const minutes = Number(args.min || 10);
if (args.config) world.setDynamicProperty("aip:config", args.config);
await import("./scripts/main.js");
const mgr = await import("./scripts/manager.js");
const player = SIM.addPlayer({ x: 0.5, y: 66, z: 0.5 });
for (let i = 0; i < 25; i++) SIM.spawn(i % 5 === 0 ? "minecraft:chicken" : "minecraft:cow", { x: (i * 37 % 80) - 40, y: 70, z: (i * 53 % 80) - 40 });
if (args.zombie) SIM.spawn("minecraft:zombie", { x: 8, y: 70, z: 8 });
for (let i = 0; i < 5; i++) SIM.step();
const opts = args.mode ? { mode: args.mode } : {};
const bot = mgr.spawnBot(SIM.dims.overworld, { x: 3.5, y: 70, z: 3.5 }, opts);
let lastTask = "";
const t0 = Date.now();
let slow = 0;
for (let t = 0; t < minutes * 1200; t++) {
  const s = Date.now();
  SIM.step();
  const dt = Date.now() - s;
  if (dt > 50) slow++;
  const b = [...mgr.bots.values()][0];
  if (!b) continue;
  if (b.task !== lastTask) { lastTask = b.task; if (args.tasks !== "0") console.log(`[t${SIM.tick}] task: ${b.task}  @ ${b.pos.x.toFixed(1)},${b.pos.y.toFixed(1)},${b.pos.z.toFixed(1)}`); }
  if (t % 1200 === 0 && args.stack) console.log(`   stack: ${b.stack.map((e) => e.name).join(">")} pos ${b.pos.x.toFixed(1)},${b.pos.y.toFixed(1)},${b.pos.z.toFixed(1)} v ${JSON.stringify(b.entity.v)} ground ${b.entity.isOnGround} ms=${b.currentMs}`);
  if (t % 1200 === 0) console.log(`== min ${t/1200}: hp ${b.health} food ${b.food} inv: ${b.inv.summary(20).join(", ")}`);
}
const b = [...mgr.bots.values()][0];
console.log("\nLOGS:\n" + SIM.logs.filter(l => !l.includes("tickingarea")).slice(-60).join("\n"));
if (b) { console.log(`\nFINAL ${b.name} mode=${b.mode} hp=${b.health} food=${b.food} worn=${JSON.stringify(b.worn)}\ninv: ${b.inv.summary(30).join(", ")}\nstats ${JSON.stringify(b.stats)} msDone=${JSON.stringify(b.mem.msDone)} cooldowns=${JSON.stringify(b.cooldowns)}`); }
console.log(`wall ${(Date.now()-t0)/1000}s, slow ticks ${slow}`);

console.log(`same-dimension teleports: ${SIM.teleports.length}`, SIM.teleports.slice(0, 3).map((t) => t.stack).join(" | "));
