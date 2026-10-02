# AI Players: a Minecraft Bedrock add-on

AI Players adds autonomous AI players to your world. Each one has a random username and skin, a personality and a goal. They gather wood, craft tools, mine, smelt, hunt, build houses, fight mobs, travel to the Nether, find the stronghold and try to **beat the game** by killing the Ender Dragon. Nobody controls them. When they have nothing specific to do, they explore, build, go mining, hang out with players and chat.

* **Install:** double-click `release/AIPlayers.mcaddon`. Then create or edit a world and enable both packs: **AI Players BP** and **AI Players RP**.
* **Requires:** Minecraft Bedrock **1.21.90 or newer** (Script API `@minecraft/server` 2.0.0). Works on Windows, mobile, console and Realms or servers that allow add-ons. No experimental toggles are needed.

---

## Getting started

1. Join the world. You get an **AI Player Controller** automatically. You can also craft one from a book and redstone, or use `/give @s aip:controller`.
2. Use the controller and pick **Spawn an AI player**. You can also use the **Spawn AI Player** egg from the creative inventory, or `/scriptevent aip:spawn 3`.
3. A new player joins with a random username (for example `SneakyCreeper42`, `ItzRuby` or `dirt_lord_09`) and a random skin. Their current activity shows under their name.
4. Right-click (or long-press) an AI player to see their status and give orders.

## What they can do

| Area | Behaviour |
|---|---|
| **Crafting planner** | Works out how to get any item. For example, an iron pickaxe needs iron ingots, which need smelting raw iron with fuel in a furnace, which needs mining iron with a stone pickaxe, and so on. Each step is done for real: real furnaces and crafting tables are placed, and crafting takes time. |
| **Mining** | Fells trees, digs staircases down, branch-mines at the right Y level for each ore, mines whole ore veins, places torches, plugs lava before digging into it, and pillars back up to the surface. |
| **Movement** | A* pathfinding with walking, jumping, dropping, swimming, digging through obstacles, bridging gaps, pillaring up and opening doors. If they get stuck they wiggle free. |
| **Combat** | Picks targets by threat level and fights with spacing, jump-crits and strafing. Backs off from creepers, uses a bow on flyers and ranged mobs (with aim lead and drop compensation) and runs away when outmatched. Hunger, health regeneration, armor and tool durability all work like they do for players. |
| **Building** | Finds flat land and builds a house with log corners, plank walls, a cobblestone roof, windows, torches, a chest, a crafting table and a furnace. Builders also put up lookout towers. They store spare loot in their home chest and plant trees. |
| **Beating the game** | Iron gear, diamonds, a bow and arrows, then obsidian (made with a water bucket on lava). Next they build and light a Nether portal, search the Nether for a fortress and blazes, and hunt endermen for pearls (in warped forests or at night). Then they craft eyes of ender, find the stronghold, fill the portal and go to the End. There they bridge to the island, destroy the crystals (with arrows, or by pillaring up), fight the dragon and come home. |
| **Free will** | Explores, goes on mining trips, builds, hunts, socializes with nearby players, idles and chats. Every bot has its own bravery, curiosity, builder, ambition and sociability levels, which change how it plays. Cautious bots hide at night. |
| **Life cycle** | Join and leave messages, death messages ("X was slain by Zombie"), advancement announcements, and respawning at home with their name, skin and memories intact (but not their items). |

### Goals (personalities)

* **Beat the game**: goes all the way to the Ender Dragon.
* **Survivor**: home, full iron and then diamond gear.
* **Builder**: basics, then a house, then more building.
* **Explorer**: gears up and wanders far.
* **Free will**: does whatever it feels like.
* **Random** (the default): beat the game 45%, survivor 25%, builder 15%, explorer 15%.

After beating the game, a bot switches to free will.

### Orders (right-click a bot)

Follow me · Stay here · Do your own thing · Go home · Build a house here · Give me your items · Change goal · Rename / change skin · Teleport · Kick · Delete forever

## Settings

Open **Controller → Settings**, or use `/scriptevent aip:config key=value`. Every setting is saved in the world.

| Setting | Default | What it does |
|---|---|---|
| `maxBots` | 6 | Most AI players allowed at once. |
| `autoJoin` / `autoJoinMinutes` / `targetPopulation` | off / 8 / 3 | Bots join on their own, like players joining a server. |
| `respawn` / `respawnSeconds` | on / 8 | Respawn after death. |
| `keepChunksLoaded` | on | Each bot keeps a small ticking area around itself so it keeps playing when you're far away. Bedrock allows 10 ticking areas per world. |
| `defaultMode` | random | Goal for new bots. |
| `pvp` | retaliate | `off`, `retaliate` or `aggressive` toward players. |
| `botsFightBots` | off | Bots fight back against other bots that hit them. |
| `mobsTargetBots` | on | Hostile mobs treat bots like players. |
| `canBreakBlocks` | on | Bots only ever mine natural blocks. Logs only count when they belong to a tree, so log cabins are safe. Planks, cobblestone, glass, chests, doors and other built blocks are never broken. |
| `protectSpawnRadius` | 0 | No breaking or placing near world spawn. |
| `buildHouses` | on | Bots build houses and towers. |
| `oreVision` | honest | `honest`: only sees exposed ores. `xray`: sees ores through walls. |
| `skill` | 0.7 | Aim, reaction time and fighting smarts. |
| `miningSpeed` / `craftSpeed` / `smeltSpeed` | 1 / 2 / 4 | Speed multipliers. |
| `stuckAssistMinutes` | 20 | After this long stuck on blaze rods or pearls, a blaze or enderman spawns near the bot. 0 turns this off. |
| `endPortalAssist` / `strongholdSearchMinutes` | on / 25 | If no stronghold is found in time, the bot builds its own End portal. |
| `summonDragonIfMissing` | on | Summons a dragon if the End has none and it was never killed. |
| `stuckTeleport` | on | Tiny teleports when physically stuck for a long time. |
| `startingKit` | none | `none`, `basic` or `iron`. |
| `chat` / `chatFrequency` | on / 1.0 | Chatter. |
| `announceAdvancements`, `showTaskInName`, `joinLeaveMessages` | on | Display options. |
| `pathNodeLimit` | 1500 | Path search budget (performance). |

To change the defaults for new worlds, edit `BP/scripts/config.js`.

### Commands

```
/scriptevent aip:spawn 3          spawn 3 AI players near you
/scriptevent aip:menu             open the menu
/scriptevent aip:list             list AI players and what they're doing
/scriptevent aip:status <name>    detailed status
/scriptevent aip:config           show settings; aip:config pvp=off to change one
/scriptevent aip:kickall          make everyone leave
/scriptevent aip:cleanup          remove the bots' ticking areas
/scriptevent aip:controller       get a controller
```

## Honest limitations

* The Bedrock Script API can't read `/locate` output or how an eye of ender flies, so bots search for strongholds and fortresses by exploring. The *assist* settings exist so a bot can still finish the game in reasonable time. Turn them off for a fully legit run.
* Bots are simulated by the add-on: crafting and smelting are timed, and blocks are mined block by block. They aren't real client connections, so they don't count toward sleeping and don't appear in the player list.
* Bedrock only simulates chunks near players or ticking areas. With `keepChunksLoaded` on, each bot uses one of the world's 10 ticking areas. Bots beyond that freeze when no player is nearby.

## Building from source

```
python3 tools/gen_assets.py   # regenerates skins, models and icons (needs Pillow)
./build.sh                    # writes dist/AIPlayers.mcaddon
```

`tools/sim` is a headless simulator. It runs the real AI scripts against a mocked `@minecraft/server` voxel world, so behaviour can be tested without the game: `cd tools/sim && ./setup.sh && node run.mjs min=20 mode=beat_game`.

The project is laid out like this:

* `BP/scripts`: all of the AI.
  * `ai/movement.js`: pathfinding.
  * `ai/planner.js`: crafting and smelting plans.
  * `ai/mining.js`, `ai/combat.js`, `ai/build.js`: mining, combat and building.
  * `ai/progression.js`: the Nether and the End.
  * `ai/brain.js`: decisions.
  * `ai/bot.js`: body and vitals.
* `RP`: the model, 48 generated skins, animations and the render controller.
