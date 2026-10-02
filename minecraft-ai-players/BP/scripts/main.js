// AI Players - entry point: wires world events to the bot manager and menus.
import { world, system } from "@minecraft/server";
import { cfg } from "./config.js";
import { TYPE, attach, botByEntity, onBotDeath, startLoop, spawnBot, spotNear, onlineBots, removeBot, greetPlayer, onPlayerDeath } from "./manager.js";
import { openMainMenu, openBotMenu, setConfigValue, giveController, statusText } from "./ui.js";
import { safe, chance, now } from "./util.js";
import { removeAllBotTickingAreas } from "./registry.js";

// --- spawning (spawn egg, /summon, our own spawns) -------------------------
world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (!safe(() => e.typeId === TYPE, false)) return;
  system.run(() => {
    if (e.isValid) attach(e);
  });
});

// --- deaths ----------------------------------------------------------------
world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  let type;
  try {
    type = dead.typeId;
  } catch (e) {
    return;
  }
  if (type === TYPE) {
    onBotDeath(dead, ev.damageSource);
    return;
  }
  if (type === "minecraft:player") {
    onPlayerDeath(dead);
    return;
  }
  if (type === "minecraft:ender_dragon") {
    world.setDynamicProperty("aip:dragonDead", true);
  }
});

// --- getting hurt: remember who did it ---------------------------------------
world.afterEvents.entityHurt.subscribe((ev) => {
  const hurt = ev.hurtEntity;
  if (!safe(() => hurt.typeId === TYPE, false)) return;
  const bot = botByEntity(hurt);
  if (!bot) return;
  bot.exhaust(0.1);
  const src = ev.damageSource.damagingEntity;
  if (src && src.isValid && src.id !== hurt.id) {
    bot.hurtBy.set(src.id, now());
    if (src.typeId === "minecraft:player" && cfg().pvp !== "off" && chance(0.5)) bot.say("hurt_by_player");
    if (src.typeId === TYPE && cfg().botsFightBots) bot.rivalIds.add(src.id);
  }
});

// --- players -----------------------------------------------------------------
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  system.runTimeout(() => {
    if (!p.isValid) return;
    if (!p.hasTag("aip_has_controller")) {
      giveController(p);
      p.addTag("aip_has_controller");
      p.sendMessage("§a[AI Players]§r You got an §bAI Player Controller§r. Use it to spawn and manage AI players.");
    }
    greetPlayer(p);
  }, 60);
});

// --- the controller item ---------------------------------------------------
world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack.typeId !== "aip:controller") return;
  const p = ev.source;
  // looking at a bot? open its menu, otherwise the main menu
  const hit = safe(() => p.getEntitiesFromViewDirection({ maxDistance: 12 }), []).find((h) => h.entity.typeId === TYPE);
  const bot = hit ? botByEntity(hit.entity) : undefined;
  system.run(() => (bot ? openBotMenu(p, bot) : openMainMenu(p)));
});

// --- right-clicking a bot ---------------------------------------------------
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  const target = ev.target;
  if (target.typeId !== TYPE) return;
  ev.cancel = true;
  const p = ev.player;
  system.run(() => {
    const bot = botByEntity(target);
    if (bot) openBotMenu(p, bot);
  });
});

// --- /scriptevent commands -------------------------------------------------
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (!ev.id.startsWith("aip:")) return;
  const cmd = ev.id.slice(4);
  const arg = (ev.message || "").trim();
  const src = ev.sourceEntity;
  /** @type {any} */
  const player = src && src.typeId === "minecraft:player" ? src : world.getAllPlayers()[0];
  const reply = (m) => (player ? player.sendMessage(`§a[AI Players]§r ${m}`) : world.sendMessage(`§a[AI Players]§r ${m}`));
  switch (cmd) {
    case "spawn": {
      if (!player) return reply("no player to spawn near");
      const n = Math.max(1, Math.min(20, parseInt(arg || "1", 10) || 1));
      let made = 0;
      for (let i = 0; i < n; i++) if (spawnBot(player.dimension, spotNear(player))) made++;
      reply(`spawned ${made} AI player(s)`);
      break;
    }
    case "menu":
      if (player) system.run(() => openMainMenu(player));
      break;
    case "list": {
      const list = onlineBots();
      reply(list.length ? list.map((b) => `§b${b.name}§r [${b.mode}] ${b.task} (${b.dimName} ${Math.floor(b.pos.x)} ${Math.floor(b.pos.y)} ${Math.floor(b.pos.z)})`).join("\n") : "no AI players online");
      break;
    }
    case "status": {
      const b = onlineBots().find((x) => x.name.toLowerCase() === arg.toLowerCase());
      reply(b ? `\n${statusText(b)}` : `no AI player named "${arg}"`);
      break;
    }
    case "kickall":
      for (const b of onlineBots()) removeBot(b, false);
      reply("all AI players left");
      break;
    case "config": {
      const m = arg.match(/^(\w+)\s*=\s*(.+)$/);
      if (!m) return reply(`current settings: ${JSON.stringify(cfg())}`);
      reply(setConfigValue(m[1], m[2].trim()));
      break;
    }
    case "cleanup":
      removeAllBotTickingAreas();
      reply("removed AI player ticking areas");
      break;
    case "controller":
      if (player) giveController(player);
      break;
    default:
      reply("commands: spawn [n], menu, list, status <name>, kickall, config [key=value], cleanup, controller");
  }
});

startLoop();
