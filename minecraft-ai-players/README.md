# AI Players: a Minecraft Bedrock add-on

AI Players adds autonomous AI players to your world. Each one has a random username and skin, a personality and a goal. They gather wood, craft tools, mine, smelt, hunt, build houses, fight mobs, travel to the Nether, find the stronghold and try to **beat the game** by killing the Ender Dragon. Nobody controls them. When they have nothing specific to do, they explore, build, go mining, hang out with players and chat.

* **Install:** double-click `release/AIPlayers.mcaddon`. Then create or edit a world and enable both packs: **AI Players BP** and **AI Players RP**.
* **Requires:** Minecraft Bedrock **1.21.90 or newer** (Script API `@minecraft/server` 2.0.0). Works on Windows, mobile, console and Realms or servers that allow add-ons. No experimental toggles are needed.

---

## New in 1.2: looking and acting like real players

* **They face what they're doing.** Body and head turn smoothly towards the block they're mining, the spot they're placing on, the mob they're fighting, the player they're talking to, or where they're walking. Head pitch is synced through an entity property, because Bedrock ignores pitch on mobs, so bots really look down at the ground they dig and up at trees. They turn before they walk off and only swing once they're facing their target.
* **Survival reach.** Reach is 4 blocks (eye to block, configurable 2.5–4.5), and a bot must be able to *see* a face of the block. It walks to a spot with a clear line of sight, like a player, instead of mining through other blocks or from far away. Worlds that saved the old reach of 5 are migrated automatically.
* **Blocks visibly break.** Mining plays a looping arm-swing animation with dig sounds while the block takes its proper break time. It then breaks with the vanilla particles and sound. The correct drops (for the tool used) go to the bot.
* **More poses.** Holding a drawn bow while aiming, eating with the food raised to the mouth, sneaking at edges while bridging, and a place-block arm motion.

## New in 1.1: a living society

* **Speech that isn't scripted.** Every line is assembled on the spot from what the bot is doing, remembers (its journal: deaths, finds, builds, mistakes, events), feels (stress, tiredness, mood) and believes. Each bot has its own style (slang, capitals, punctuation, emoticons, favourite words) and makes typos, which get worse under stress, and it sometimes sends a `*correction`. On a Bedrock Dedicated Server you can add the **LLM bridge** so bots talk through Claude instead (see below).
* **Bots talk to each other and act on it.** They greet, chat, gossip, compliment and insult, and build opinions of each other (and of you). They ask for help when stuck, and friends bring them the items. They share where they found diamonds (and dishonest bots who dislike you may lie), warn about danger, answer "where is iron?", invite each other to towns and preach their faith.
* **Planned events.** Bots propose feasts, festivals (fireworks), worship services, town meetings with **mayor elections**, build days and group mining expeditions. Others accept or decline depending on personality, opinion of the host, faith and how busy they are. Then they travel there and do it together. Some forget and apologize later, and hosts remember who didn't show up.
* **Towns and cities.** Leaders found towns with generated names (Port Redstonefield, Mount Oakridge...). They invite others, hand out plots, and residents build their houses around a plaza. Together they build a well and lamp posts, a town hall, a farm (tilled, planted, harvested and turned into bread) and a temple, and lay gravel roads. Towns grow from village to town to city.
* **Religions.** Spiritual bots found generated faiths (for example "Fellowship of Moon's Light" worshipping "the Moon Mother of Slimes"). Their rules actually change behaviour: sacred animals they won't hunt, a holy day of rest, morning prayer, offerings, a depth limit for mining, charity, pacifism. Members preach and convert others, hold services at the temple, and sometimes give in to temptation and feel guilty about it.
* **Smarter.** Bots remember where resources are and go back, avoid places where they got hurt, craft a spare tool before the current one breaks, learn which items they keep failing to get and ask for them, and cooperate.
* **Mistakes that aren't scripted.** There are no "do a mistake now" events. Each risky decision (a jump, digging down, a craft, placing a block, remembering a location, eating on time, swinging in a crowded fight) has a chance to go wrong. That chance depends on the bot's skill, carefulness, stress and tiredness. So you'll see bots misjudge a drop, dig straight down into a cave, misclick in the crafting table, put a wrong block in a wall (and sometimes fix it), forget to eat, get lost, misremember where the diamonds were, or hit an enderman by accident. They remember it and talk about it later.

### Talking to bots

* Right-click a bot and choose **Talk...**, then type anything: "hi", "follow me", "where can I find iron?", "can I have some bread?", "want to have a feast?", "do you believe in god?", "you're a noob"...
* Or speak to everyone nearby: `/scriptevent aip:say <message>`. Put a bot's name in the message to address that bot.

### Claude-powered speech (Bedrock Dedicated Server only)

Normal worlds and Realms can't reach the internet, so they use the built-in speech generator. On a **Bedrock Dedicated Server** you can install `AIPlayers_LLM_Bridge_BDS.mcpack` as well:

1. Copy the bridge into `behavior_packs/` and add it to the world next to the AI Players packs.
2. Turn on the **Beta APIs** experiment for the world (the bridge uses the beta `@minecraft/server-net` and `@minecraft/server-admin` modules).
3. Allow the modules in `config/default/permissions.json`:
   `{"allowed_modules": ["@minecraft/server", "@minecraft/server-ui", "@minecraft/server-net", "@minecraft/server-admin"]}`
4. Add your key in `config/331249c4-be95-45e4-b7cb-ac2c97702f1f/secrets.json` (the bridge's script module UUID): `{"ANTHROPIC_API_KEY": "sk-ant-..."}`.
5. Optional: in `variables.json` in the same folder, set `{"model": "claude-opus-5-5", "effort": "low"}`.

When it connects, chat shows *LLM bridge connected*. From then on, bot lines and replies to players come from Claude, in character, using the bot's personality, mood, memories, town and faith. A reply to a player can also choose an action, such as following or giving items. If a request fails or times out, the bot falls back to the built-in generator. Set **Speech** to `generated` in Settings to turn it off.

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
| `botChat` | on | Bots talk to each other and act on what they hear. |
| `speechMode` | auto | `auto`: Claude via the BDS bridge when installed, otherwise generated. `generated`: never use the LLM. |
| `towns` / `maxTowns` | on / 4 | Towns and cities. |
| `religions` / `maxReligions` | on / 3 | Religions. |
| `events` | on | Planned events. |
| `mistakes` | 1.0 | How error-prone bots are (0 = never). |
| `chat` / `chatFrequency` | on / 1.0 | Chatter. |
| `announceAdvancements`, `showTaskInName`, `joinLeaveMessages` | on | Display options. |
| `pathNodeLimit` | 1500 | Path search budget (performance). |

To change the defaults for new worlds, edit `BP/scripts/config.js`.

### Commands

```
/scriptevent aip:spawn 3          spawn 3 AI players near you
/scriptevent aip:say hi everyone  talk to nearby bots (name a bot to address it)
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

`tools/sim` is a headless simulator. It runs the real AI scripts against a mocked `@minecraft/server` voxel world, so behaviour can be tested without the game: `cd tools/sim && ./setup.sh && node run.mjs min=20 mode=beat_game`, or `node society.mjs bots=5 min=30` to watch a whole society (the chat log, towns, religions and events).

The project is laid out like this:

* `BP/scripts`: all of the AI.
  * `ai/movement.js`: pathfinding.
  * `ai/planner.js`: crafting and smelting plans.
  * `ai/mining.js`, `ai/combat.js`, `ai/build.js`: mining, combat and building.
  * `ai/progression.js`: the Nether and the End.
  * `ai/brain.js`: decisions.
  * `ai/speech.js`: generated speech; `ai/llm.js` + `bridge/`: optional Claude speech.
  * `ai/social.js`, `ai/events.js`, `ai/town.js`, `ai/religion.js`: society.
  * `ai/cognition.js`: stress, fatigue, memory, opinions and mistakes.
  * `ai/bot.js`: body and vitals.
* `RP`: the model, 48 generated skins, animations and the render controller.
