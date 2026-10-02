// In-game menus: controller item, bot management and settings.
import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { cfg, saveConfig, resetConfig, DEFAULTS, OPTIONS, SKIN_COUNT } from "./config.js";
import { bots, onlineBots, spawnBot, spotNear, removeBot, forgetBot, applyTargetingToAll, respawnPending } from "./manager.js";
import { allRecords } from "./registry.js";
import { progressText, nextMilestone, MILESTONES } from "./ai/brain.js";
import { V, prettyItem } from "./util.js";
import { ItemStack } from "@minecraft/server";

const MODE_LABELS = {
  random: "Random",
  beat_game: "Beat the game",
  survivor: "Survivor",
  builder: "Builder",
  explorer: "Explorer",
  free: "Free will",
};

export function openMainMenu(player) {
  const online = onlineBots();
  const f = new ActionFormData()
    .title("AI Players")
    .body(`§7${online.length}/${cfg().maxBots} AI players online.\nRight-click an AI player to manage it.`)
    .button("Spawn an AI player")
    .button("Spawn with options...")
    .button(`Manage AI players (${online.length})`)
    .button("Command everyone")
    .button("Settings")
    .button("Leaderboard")
    .button("Help");
  f.show(player).then((r) => {
    if (r.canceled) return;
    switch (r.selection) {
      case 0: {
        const b = spawnBot(player.dimension, spotNear(player));
        if (!b) player.sendMessage(`§cCan't spawn: limit of ${cfg().maxBots} reached (change it in Settings).`);
        break;
      }
      case 1:
        openSpawnForm(player);
        break;
      case 2:
        openList(player);
        break;
      case 3:
        openCommandAll(player);
        break;
      case 4:
        openSettings(player);
        break;
      case 5:
        openLeaderboard(player);
        break;
      case 6:
        openHelp(player);
        break;
    }
  });
}

function openSpawnForm(player) {
  const modes = ["random", "beat_game", "survivor", "builder", "explorer", "free"];
  new ModalFormData()
    .title("Spawn AI player")
    .textField("Username (blank = random)", "e.g. CoolMiner42")
    .dropdown("Goal / personality", modes.map((m) => MODE_LABELS[m]), { defaultValueIndex: 0 })
    .slider("Skin (0 = random)", 0, SKIN_COUNT, { valueStep: 1, defaultValue: 0 })
    .slider("How many", 1, 10, { valueStep: 1, defaultValue: 1 })
    .show(player)
    .then((r) => {
      if (r.canceled || !r.formValues) return;
      const [name, modeIdx, skin, count] = r.formValues;
      const mode = modes[Number(modeIdx)];
      let made = 0;
      for (let i = 0; i < Number(count); i++) {
        const b = spawnBot(player.dimension, spotNear(player), {
          name: Number(count) === 1 && String(name).trim() ? String(name).trim().replace(/[^A-Za-z0-9_]/g, "").slice(0, 16) : undefined,
          mode: mode === "random" ? undefined : mode,
          skin: Number(skin) > 0 ? Number(skin) - 1 : undefined,
        });
        if (b) made++;
      }
      if (made < Number(count)) player.sendMessage(`§eSpawned ${made}. Limit is ${cfg().maxBots} (Settings > Max AI players).`);
    });
}

function openList(player) {
  const list = onlineBots().sort((a, b) => V.dist(a.pos, player.location) - V.dist(b.pos, player.location));
  const offline = allRecords().filter((r) => !bots.has(r.id));
  const f = new ActionFormData().title("AI players");
  if (!list.length) f.body("No AI players online.");
  for (const b of list) {
    const d = b.dim.id === player.dimension.id ? `${Math.round(V.dist(b.pos, player.location))}m` : b.dimName;
    f.button(`${b.name} §8(${d})\n§7${b.task}`);
  }
  if (offline.length) f.button(`§8Offline / dead (${offline.length})`);
  f.show(player).then((r) => {
    if (r.canceled || r.selection === undefined) return;
    if (r.selection < list.length) openBotMenu(player, list[r.selection]);
    else openOffline(player, offline);
  });
}

function openOffline(player, offline) {
  const f = new ActionFormData().title("Offline AI players").body("Bring one back into the world:");
  for (const o of offline) f.button(`${o.rec.name}${respawnPending().has(o.id) ? " §8(respawning)" : ""}`);
  f.show(player).then((r) => {
    if (r.canceled || r.selection === undefined) return;
    const o = offline[r.selection];
    if (onlineBots().length >= cfg().maxBots) return player.sendMessage("§cAI player limit reached.");
    try {
      const e = player.dimension.spawnEntity("aip:ai_player", spotNear(player));
      e.setDynamicProperty("aip:id", o.id);
      if (cfg().joinLeaveMessages) world.sendMessage(`§e${o.rec.name} joined the game`);
    } catch (e) {
      player.sendMessage("§cCouldn't spawn here.");
    }
  });
}

export function statusText(b) {
  const lines = [];
  const hp = Math.round(b.health);
  lines.push(`§fGoal: §b${MODE_LABELS[b.mode] || b.mode}§f  (${progressText(b)})`);
  const ms = b.currentMs || nextMilestone(b);
  if (ms) lines.push(`§fWorking on: §a${MILESTONES[ms].label}`);
  lines.push(`§fDoing: §7${b.task}`);
  lines.push(`§fHealth: §c${hp}/20§f  Food: §6${Math.round(b.food)}/20§f  Armor: §7${b.armorPoints()}`);
  lines.push(`§fWhere: §7${b.dimName} ${Math.floor(b.pos.x)}, ${Math.floor(b.pos.y)}, ${Math.floor(b.pos.z)}`);
  if (b.mem.home) lines.push(`§fHome: §7${b.mem.home.x}, ${b.mem.home.y}, ${b.mem.home.z}`);
  lines.push(`§fKills: §7${b.stats.kills}§f  Deaths: §7${b.stats.deaths}§f  Blocks mined: §7${b.stats.mined}`);
  if (b.mem.flags.beatGame) lines.push("§6★ Has beaten the game!");
  const p = b.personality;
  lines.push(`§fPersonality: §7brave ${Math.round(p.bravery * 100)}% · curious ${Math.round(p.curiosity * 100)}% · builder ${Math.round(p.builder * 100)}% · social ${Math.round(p.sociability * 100)}%`);
  if (b.mem.adv.length) lines.push(`§fAdvancements: §a${b.mem.adv.slice(-6).join(", ")}`);
  const inv = b.inv.summary(14);
  lines.push(`§fInventory: §7${inv.length ? inv.join(", ") : "empty"}`);
  const worn = Object.values(b.worn).filter(Boolean).map((w) => prettyItem(w));
  if (worn.length) lines.push(`§fWearing: §7${worn.join(", ")}`);
  return lines.join("\n");
}

export function openBotMenu(player, b) {
  if (!b || !b.entity || !b.entity.isValid) return;
  const f = new ActionFormData()
    .title(b.name)
    .body(statusText(b))
    .button("Follow me")
    .button("Stay here")
    .button("Do your own thing")
    .button("Go home")
    .button("Build a house here")
    .button("Give me your items")
    .button("Change goal")
    .button("Rename / change skin")
    .button("Teleport to me")
    .button("Teleport me to them")
    .button("§cKick (leave game)")
    .button("§4Delete forever");
  f.show(player).then((r) => {
    if (r.canceled || r.selection === undefined || !b.entity.isValid) return;
    switch (r.selection) {
      case 0:
        setOrder(b, { type: "follow", player: player.id });
        b.say("follow_ok");
        break;
      case 1:
        setOrder(b, { type: "stay", pos: { ...b.pos } });
        b.say("stay_ok");
        break;
      case 2:
        setOrder(b, null);
        b.say("free_ok");
        break;
      case 3:
        if (!b.mem.home) player.sendMessage(`§7${b.name} doesn't have a home yet.`);
        else {
          setOrder(b, { type: "home" });
          b.say("home_ok");
        }
        break;
      case 4: {
        const p = player.location;
        setOrder(b, { type: "build", pos: { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) } });
        b.say("build_ok");
        break;
      }
      case 5:
        giveAll(player, b);
        break;
      case 6:
        openModeForm(player, b);
        break;
      case 7:
        openRename(player, b);
        break;
      case 8:
        try {
          b.entity.teleport(spotNear(player, 1, 3), { dimension: player.dimension });
          b.tickingDirty = true;
        } catch (e) {
          /* ignore */
        }
        break;
      case 9:
        try {
          player.teleport(b.pos, { dimension: b.dim });
        } catch (e) {
          /* ignore */
        }
        break;
      case 10:
        removeBot(b, false);
        break;
      case 11:
        new MessageFormData()
          .title("Delete forever?")
          .body(`${b.name} and all their memories will be gone.`)
          .button1("Cancel")
          .button2("Delete")
          .show(player)
          .then((m) => {
            if (m.selection === 1) forgetBot(b);
          });
        break;
    }
  });
}

function setOrder(b, order) {
  b.order = order;
  b.clearRoutines(30);
}

function giveAll(player, b) {
  const c = b.inv.container;
  if (!c) return;
  let n = 0;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (!it) continue;
    const pc = player.getComponent("minecraft:inventory")?.container;
    const rest = pc ? pc.addItem(it) : it;
    if (rest) b.dim.spawnItem(rest, player.location);
    c.setItem(i, undefined);
    n++;
  }
  b.chat(n ? `here you go ${player.name}` : "i don't have anything :(");
}

function openModeForm(player, b) {
  const modes = ["beat_game", "survivor", "builder", "explorer", "free"];
  new ModalFormData()
    .title(`${b.name}'s goal`)
    .dropdown("Goal", modes.map((m) => MODE_LABELS[m]), { defaultValueIndex: Math.max(0, modes.indexOf(b.mode)) })
    .show(player)
    .then((r) => {
      if (r.canceled || !r.formValues) return;
      b.mode = modes[Number(r.formValues[0])];
      b.cooldowns = {};
      b.clearRoutines(30);
      b.save();
      b.chat(`ok, new goal: ${MODE_LABELS[b.mode].toLowerCase()}`);
    });
}

function openRename(player, b) {
  new ModalFormData()
    .title(`Edit ${b.name}`)
    .textField("Username", b.name, { defaultValue: b.name })
    .slider("Skin", 0, SKIN_COUNT - 1, { valueStep: 1, defaultValue: b.skin })
    .show(player)
    .then((r) => {
      if (r.canceled || !r.formValues) return;
      const name = String(r.formValues[0]).replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
      if (name.length >= 3) b.name = name;
      b.skin = Number(r.formValues[1]);
      try {
        b.entity.setProperty("aip:skin", b.skin);
        b.entity.setProperty("aip:slim", b.skin % 3 === 2);
      } catch (e) {
        /* ignore */
      }
      b.shownTag = "";
      b.save();
    });
}

function openCommandAll(player) {
  new ActionFormData()
    .title("Command everyone")
    .button("Everyone follow me")
    .button("Everyone do your own thing")
    .button("Everyone go home")
    .button("Everyone come here")
    .button("§cKick everyone")
    .show(player)
    .then((r) => {
      if (r.canceled) return;
      for (const b of onlineBots()) {
        if (r.selection === 0) setOrder(b, { type: "follow", player: player.id });
        if (r.selection === 1) setOrder(b, null);
        if (r.selection === 2) setOrder(b, b.mem.home ? { type: "home" } : null);
        if (r.selection === 3) setOrder(b, { type: "stay", pos: spotNear(player, 1, 4) });
        if (r.selection === 4) removeBot(b, false);
      }
    });
}

function openLeaderboard(player) {
  const recs = allRecords().map((r) => r.rec);
  recs.sort((a, b) => (b.stats?.wins || 0) - (a.stats?.wins || 0) || (b.stats?.kills || 0) - (a.stats?.kills || 0));
  const lines = recs.slice(0, 15).map((r, i) => {
    const s = r.stats || {};
    return `${i + 1}. §b${r.name}§r  ${s.wins ? "§6★" + s.wins + "§r " : ""}kills ${s.kills || 0} · deaths ${s.deaths || 0} · mined ${s.mined || 0} · ${(r.mem?.adv || []).length} adv`;
  });
  new ActionFormData().title("Leaderboard").body(lines.join("\n") || "Nobody yet.").button("Close").show(player);
}

function openHelp(player) {
  new ActionFormData()
    .title("AI Players - Help")
    .body(
      [
        "§lSpawning§r: use this controller, the AI Player spawn egg, or §7/scriptevent aip:spawn 3§r.",
        "§lManaging§r: right-click (or long-press) an AI player to see their status and give orders.",
        "§lWhat they do§r: each AI has a goal (beat the game, survive, build, explore) and a personality. They gather wood, craft tools, mine, smelt, hunt, build houses, fight mobs, travel to the Nether, find the stronghold and fight the Ender Dragon. When idle they explore, chat, build and hang out.",
        "§lChunks§r: each AI keeps a small ticking area loaded so they keep playing when you're far away (Bedrock allows 10 ticking areas per world).",
        "§lCommands§r: /scriptevent aip:spawn [n] · aip:menu · aip:list · aip:kickall · aip:config key=value",
        "§lGet a controller§r: craft a book + redstone, or /give @s aip:controller.",
      ].join("\n\n"),
    )
    .button("OK")
    .show(player);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
/** @type {any[]} */
const SETTINGS = [
  ["maxBots", "Max AI players", "slider", 1, 20, 1],
  ["autoJoin", "AI players join on their own", "toggle"],
  ["autoJoinMinutes", "Minutes between auto-joins", "slider", 1, 60, 1],
  ["targetPopulation", "Auto-join stops at", "slider", 1, 20, 1],
  ["respawn", "Respawn after dying", "toggle"],
  ["respawnSeconds", "Respawn delay (s)", "slider", 1, 120, 1],
  ["keepChunksLoaded", "Keep chunks loaded around bots", "toggle"],
  ["defaultMode", "Default goal for new bots", "dropdown"],
  ["pvp", "PvP against players", "dropdown"],
  ["botsFightBots", "Bots fight each other (when provoked)", "toggle"],
  ["mobsTargetBots", "Hostile mobs attack bots", "toggle"],
  ["canBreakBlocks", "Bots may break (natural) blocks", "toggle"],
  ["protectSpawnRadius", "No-grief radius around world spawn", "slider", 0, 200, 10],
  ["buildHouses", "Bots build houses", "toggle"],
  ["oreVision", "Ore vision", "dropdown"],
  ["skill", "Skill (x100)", "slider100", 0, 100, 5],
  ["miningSpeed", "Mining speed (x10)", "slider10", 1, 50, 1],
  ["craftSpeed", "Crafting speed (x10)", "slider10", 1, 100, 1],
  ["smeltSpeed", "Smelting speed (x10)", "slider10", 1, 200, 5],
  ["stuckAssistMinutes", "Stuck assist after N minutes (0 = off)", "slider", 0, 120, 5],
  ["endPortalAssist", "Build own end portal if no stronghold found", "toggle"],
  ["strongholdSearchMinutes", "Stronghold search minutes", "slider", 5, 120, 5],
  ["summonDragonIfMissing", "Summon dragon if missing", "toggle"],
  ["stuckTeleport", "Tiny teleports when physically stuck", "toggle"],
  ["startingKit", "Starting kit", "dropdown"],
  ["chat", "Bots chat", "toggle"],
  ["chatFrequency", "Chat frequency (x10)", "slider10", 0, 30, 1],
  ["announceAdvancements", "Announce advancements", "toggle"],
  ["showTaskInName", "Show current task under name", "toggle"],
  ["joinLeaveMessages", "Join/leave messages", "toggle"],
  ["pathNodeLimit", "Path search limit (performance)", "slider", 300, 4000, 100],
  ["debug", "Debug messages", "toggle"],
];

export function openSettings(player) {
  const c = cfg();
  const f = new ModalFormData().title("AI Players - Settings");
  for (const [key, label, kind, min, max, step] of SETTINGS) {
    if (kind === "toggle") f.toggle(label, { defaultValue: !!c[key] });
    else if (kind === "dropdown") f.dropdown(label, OPTIONS[key], { defaultValueIndex: Math.max(0, OPTIONS[key].indexOf(c[key])) });
    else if (kind === "slider") f.slider(label, min, max, { valueStep: step, defaultValue: Math.max(min, Math.min(max, c[key])) });
    else if (kind === "slider10") f.slider(label, min, max, { valueStep: step, defaultValue: Math.round(c[key] * 10) });
    else if (kind === "slider100") f.slider(label, min, max, { valueStep: step, defaultValue: Math.round(c[key] * 100) });
  }
  f.toggle("§cReset everything to defaults", { defaultValue: false });
  f.show(player).then((r) => {
    if (r.canceled || !r.formValues) return;
    const v = r.formValues;
    if (v[SETTINGS.length]) {
      resetConfig();
      applyTargetingToAll();
      player.sendMessage("§aAI Players settings reset.");
      return;
    }
    const next = { ...c };
    SETTINGS.forEach(([key, , kind], i) => {
      const val = v[i];
      if (kind === "toggle") next[key] = !!val;
      else if (kind === "dropdown") next[key] = OPTIONS[key][Number(val)];
      else if (kind === "slider") next[key] = Number(val);
      else if (kind === "slider10") next[key] = Number(val) / 10;
      else if (kind === "slider100") next[key] = Number(val) / 100;
    });
    saveConfig(next);
    applyTargetingToAll();
    player.sendMessage("§aAI Players settings saved.");
  });
}

/** /scriptevent aip:config key=value */
export function setConfigValue(key, raw) {
  if (!(key in DEFAULTS)) return `unknown setting "${key}"`;
  const d = DEFAULTS[key];
  let val = raw;
  if (typeof d === "boolean") val = raw === "true" || raw === "1" || raw === "on";
  else if (typeof d === "number") {
    val = Number(raw);
    if (Number.isNaN(val)) return `"${raw}" is not a number`;
  } else if (OPTIONS[key] && !OPTIONS[key].includes(raw)) return `${key} must be one of: ${OPTIONS[key].join(", ")}`;
  saveConfig({ ...cfg(), [key]: val });
  applyTargetingToAll();
  return `${key} = ${JSON.stringify(val)}`;
}

export function giveController(player) {
  try {
    const inv = player.getComponent("minecraft:inventory").container;
    inv.addItem(new ItemStack("aip:controller", 1));
  } catch (e) {
    /* ignore */
  }
}
