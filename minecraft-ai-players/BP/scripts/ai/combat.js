// Combat: threat assessment, melee with spacing, bows, fleeing and hunting.
import { cfg } from "../config.js";
import { NEUTRAL_MOBS, RANGED_MOBS, EXPLODING } from "../data.js";
import { V, now, wait, rand, chance, prettyItem } from "../util.js";
import { isAlive, healthOf, entitiesNear } from "./world.js";
import { meleeHit, attackCooldown, canShoot, shootArrow, collectNearbyItems, eat, pillarUp } from "./actions.js";
import { steer, goTo, exploreStep, facingError } from "./movement.js";
import { slip, journal } from "./cognition.js";
import { hasTenet, obeys } from "./religion.js";

const FLYING = new Set(["minecraft:ghast", "minecraft:blaze", "minecraft:phantom", "minecraft:ender_dragon", "minecraft:vex", "minecraft:bee", "minecraft:breeze"]);

export function entityName(e) {
  try {
    if (e.typeId === "minecraft:player") return e.name;
    if (e.nameTag) return e.nameTag.split("\n")[0];
    return prettyItem(e.typeId);
  } catch (err) {
    return "something";
  }
}

/** Hostile entities worth fighting right now, nearest first. */
export function findThreats(bot, radius) {
  const c = cfg();
  const out = [];
  const list = entitiesNear(bot.dim, bot.pos, radius, { excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow"] });
  for (const e of list) {
    if (e.id === bot.entity.id) continue;
    const t = e.typeId;
    let hostile = false;
    try {
      if (t === "minecraft:player" && hasTenet(bot, "pacifist") && obeys(bot, 0.5)) {
        hostile = false;
      } else if (t === "minecraft:player") {
        if (c.pvp === "aggressive") hostile = !e.getGameMode || e.getGameMode() === "Survival" || e.getGameMode() === "survival";
        else if (c.pvp === "retaliate") hostile = bot.recentlyHurtBy(e.id);
      } else if (t === "aip:ai_player") {
        hostile = c.botsFightBots ? bot.recentlyHurtBy(e.id) || bot.rivalIds.has(e.id) : false;
      } else if (NEUTRAL_MOBS.has(t)) {
        hostile = bot.recentlyHurtBy(e.id);
      } else if (e.matches({ families: ["monster"] })) {
        hostile = true;
      }
    } catch (err) {
      hostile = false;
    }
    if (!hostile || !isAlive(e)) continue;
    if (t === "minecraft:ender_dragon" || t === "minecraft:wither") continue;
    // ignore things far above/below us that can't reach us
    const dy = Math.abs(e.location.y - bot.pos.y);
    if (dy > 6 && !RANGED_MOBS.has(t)) continue;
    out.push(e);
  }
  out.sort((a, b) => V.dist2(a.location, bot.pos) - V.dist2(b.location, bot.pos));
  return out;
}

/** Should we fight or run? */
export function assess(bot, threats) {
  const hp = bot.health;
  const armor = bot.armorPoints();
  const weapon = bot.inv.bestWeapon().damage;
  const strength = hp + armor * 1.5 + weapon * 2 + bot.personality.bravery * 10;
  let danger = 0;
  for (const t of threats.slice(0, 6)) {
    const d = V.dist(t.location, bot.pos);
    let w = 6;
    if (EXPLODING.has(t.typeId)) w = 10;
    if (t.typeId === "minecraft:player") w = 14;
    if (t.typeId === "minecraft:warden" || t.typeId === "minecraft:ravager" || t.typeId === "minecraft:wither_skeleton") w = 20;
    danger += w * (d < 8 ? 1 : 0.5);
  }
  if (hp <= 5 && danger > 0) return "flee";
  return danger > strength * 1.4 ? "flee" : "fight";
}

/**
 * Fight one target until it dies, we flee, or we give up.
 * @returns "won" | "flee" | "gaveup"
 */
export function* fight(bot, target, opts = {}) {
  const start = now();
  let cooldown = 0;
  let drawing = 0;
  let lastD = Infinity;
  let stuck = 0;
  const maxTicks = opts.maxTicks ?? 20 * 45;
  const name = entityName(target);
  bot.setTask(`fighting ${name}`);
  bot.combatTarget = target;
  try {
    let lastTick = -1;
    while (isAlive(target) && now() - start < maxTicks) {
      if (now() === lastTick) yield;
      lastTick = now();
      if (target.dimension.id !== bot.dim.id) return "gaveup";
      const tp = target.location;
      const d = V.dist(bot.pos, tp);
      if (d > (opts.giveUpDist ?? 32)) return "gaveup";
      if (!opts.noFlee && bot.health <= bot.fleeHealth() && !(opts.hunting && healthOf(target) < 4)) return "flee";

      const flying = FLYING.has(target.typeId);
      // keep arrows for the dragon, and never waste them on endermen (they dodge)
      const reserve = bot.dimName === "the_end" ? 0 : bot.mode === "beat_game" && !opts.preferBow ? 16 : 0;
      const arrowsOk = bot.inv.count("minecraft:arrow") > reserve && target.typeId !== "minecraft:enderman";
      const preferBow = canShoot(bot) && arrowsOk && (flying || (RANGED_MOBS.has(target.typeId) && d > 6) || (opts.preferBow && d > 5) || (d > 12 && !opts.hunting));
      if (preferBow && d < 60) {
        // draw and fire
        bot.hold("minecraft:bow");
        bot.motor.look = { x: tp.x, y: tp.y + 1, z: tp.z };
        if (d < 4 && !flying) steer(bot, V.add(bot.pos, V.sub(bot.pos, tp)), {});
        bot.setAction(2);
        drawing++;
        if (drawing >= Math.round(22 - cfg().skill * 8)) {
          shootArrow(bot, target, opts.aimY ?? (flying ? 0.5 : 1.0));
          drawing = 0;
        }
        yield;
        continue;
      }
      drawing = 0;

      const reach = (opts.reach ?? 2.9) + (target.typeId === "minecraft:ender_dragon" ? 3 : 0);
      const dy = Math.abs(tp.y - bot.pos.y);
      if (d > reach && (d > 6 || dy > 1.2)) {
        // far away or at a different height: use the path finder to close in
        yield* goTo(bot, () => (isAlive(target) ? target.location : undefined), {
          range: Math.max(1.5, reach - 0.6), timeout: 50, sprint: d > 8, allowDig: dy > 2, interrupt: () => !isAlive(target) || V.dist(bot.pos, target.location) <= reach,
        });
        lastD = Infinity;
        stuck = 0;
        continue;
      }
      if (d > reach) {
        // close the distance
        if (d < lastD - 0.05) stuck = 0;
        else stuck++;
        lastD = d;
        if (stuck > 30) {
          yield* goTo(bot, () => (isAlive(target) ? target.location : undefined), { range: reach - 0.4, timeout: 80, allowDig: true });
          stuck = 0;
          lastD = Infinity;
          continue;
        }
        steer(bot, tp, { sprint: d > 4 });
        bot.motor.look = { x: tp.x, y: tp.y + 1.2, z: tp.z };
      } else {
        bot.motor.look = { x: tp.x, y: tp.y + 1.2, z: tp.z };
        if (cooldown <= 0 && facingError(bot, { x: tp.x, y: tp.y + 1.2, z: tp.z }) > 35) {
          // still turning to face it
        } else if (cooldown <= 0) {
          // jump for crits sometimes
          if (bot.entity.isOnGround && chance(cfg().skill * 0.35)) {
            bot.motor.jump = true;
            cooldown = 6;
          } else {
            // in the chaos of a fight you can hit the wrong thing
            const oops = slip(bot, 0.01) ? entitiesNear(bot.dim, bot.pos, 3.5, { excludeTypes: ["minecraft:item", "minecraft:xp_orb"] }).find((e) => NEUTRAL_MOBS.has(e.typeId) && e.typeId !== "minecraft:ender_dragon") : null;
            if (oops) {
              meleeHit(bot, oops);
              journal(bot, "mistake", { kind: "hit_neutral" });
              bot.say("mistake", { kind: "hit_neutral" }, { prio: 1 });
            } else meleeHit(bot, target);
            cooldown = attackCooldown(bot);
            if (EXPLODING.has(target.typeId)) {
              // hit and back off
              for (let i = 0; i < 12; i++) {
                steer(bot, V.add(bot.pos, V.scale(V.norm(V.sub(bot.pos, target.location)), 3)), { sprint: true });
                yield;
              }
            }
          }
        } else if (chance(0.15 * cfg().skill)) {
          // strafe
          const side = V.norm({ x: -(tp.z - bot.pos.z), y: 0, z: tp.x - bot.pos.x });
          const s = chance(0.5) ? 1 : -1;
          steer(bot, V.add(bot.pos, V.scale(side, s * 1.5)), {});
        }
      }
      cooldown--;
      yield;
    }
  } finally {
    bot.combatTarget = null;
  }
  if (!isAlive(target)) {
    bot.stats.kills++;
    bot.onKill(target);
    return "won";
  }
  return "gaveup";
}

/** Run away from threats, eat if possible, maybe pillar up. */
export function* flee(bot, threats) {
  bot.setTask("running away!");
  bot.say("flee");
  const start = now();
  while (now() - start < 20 * 7) {
    const near = threats.filter((t) => isAlive(t) && V.dist(t.location, bot.pos) < 16);
    if (!near.length) break;
    let away = { x: 0, y: 0, z: 0 };
    for (const t of near) away = V.add(away, V.norm(V.sub(bot.pos, t.location)));
    away = V.norm({ x: away.x + rand(-0.2, 0.2), y: 0, z: away.z + rand(-0.2, 0.2) });
    steer(bot, V.add(bot.pos, V.scale(away, 4)), { sprint: bot.food > 6 });
    yield;
  }
  // tower up two blocks to heal if still in danger
  if (bot.health < 10 && bot.inv.buildingCount() >= 3) {
    yield* pillarUp(bot);
    yield* pillarUp(bot);
  }
  if (bot.inv.bestFood() && bot.food < 20) yield* eat(bot);
  return true;
}

/**
 * Hunt mobs of the given types until we have `need` more of `item` (counted by countFn).
 */
export function* hunt(bot, types, countFn, need, opts = {}) {
  // dietary taboos: skip the sacred animal unless we're starving and our faith is weak
  const taboo = hasTenet(bot, "taboo_kill");
  if (taboo && types.includes(taboo.mob) && types.length > 1 && (bot.food > 4 ? obeys(bot, 0.2) : obeys(bot, 0.8))) types = types.filter((t) => t !== taboo.mob);
  const target = countFn() + need;
  const start = now();
  let idle = 0;
  bot.setTask(`hunting ${prettyItem(types[0])}`.toLowerCase());
  let lastTick = -1;
  while (countFn() < target) {
    if (now() === lastTick) yield;
    lastTick = now();
    if (now() - start > (opts.budget ?? 20 * 60 * 5)) return false;
    bot.setTask(`hunting ${prettyItem(types[0])}`.toLowerCase());
    const mobs = entitiesNear(bot.dim, bot.pos, opts.radius ?? 40, { excludeTypes: ["minecraft:item", "minecraft:xp_orb"] })
      .filter((e) => types.includes(e.typeId) && isAlive(e))
      .sort((a, b) => V.dist2(a.location, bot.pos) - V.dist2(b.location, bot.pos));
    if (mobs.length) {
      idle = 0;
      const res = yield* fight(bot, mobs[0], { hunting: true, maxTicks: 20 * 40, giveUpDist: 48 });
      if (res === "flee") return false;
      if (res === "won") yield* collectNearbyItems(bot, 6, 80);
      continue;
    }
    idle++;
    if (idle > (opts.maxIdle ?? 8)) return false;
    if (opts.waitInstead) yield* wait(40);
    else yield* exploreStep(bot, 36);
  }
  return true;
}
