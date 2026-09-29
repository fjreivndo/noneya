/* ═══════════════════════════════════════════════════════════════════════════
   AI. Two layers:
     Commander  one per team. Owns the plan: which site, which routes, who
                entries, who throws utility, when to execute, when to rotate,
                which flags each squad takes. Pools every sighting into shared
                intel and talks on the radio so you can see the plan happen.
     Brain      one per bot. Sees (vision cone + line of sight + smoke),
                hears (footsteps, gunfire), aims like a person (reaction time,
                settling error, recoil control), uses cover, reloads safely,
                throws grenades at enemies it knows are hiding, and follows
                its commander's orders when not fighting.
   ═══════════════════════════════════════════════════════════════════════════ */

const DIFF = {
  easy:   { react: 0.62, err: 6.5, settle: 1.4, turn: 5,  recoil: 0.3,  head: 0.12, fov: 55, range: 55, label: 'Recruit' },
  normal: { react: 0.40, err: 3.6, settle: 0.9, turn: 8,  recoil: 0.55, head: 0.3,  fov: 62, range: 80, label: 'Regular' },
  hard:   { react: 0.27, err: 2.3, settle: 0.6, turn: 12, recoil: 0.75, head: 0.5,  fov: 66, range: 110, label: 'Veteran' },
  elite:  { react: 0.18, err: 1.4, settle: 0.4, turn: 17, recoil: 0.9,  head: 0.68, fov: 70, range: 140, label: 'Elite' },
};
const BOT_NAMES = ['Viper', 'Rook', 'Ghost', 'Kestrel', 'Nomad', 'Havoc', 'Onyx', 'Blitz', 'Saber', 'Wraith', 'Tango', 'Echo', 'Jinx', 'Maverick', 'Talon', 'Reaper', 'Specter', 'Cobra', 'Drift', 'Frost', 'Hex', 'Ranger', 'Slate', 'Vector', 'Zephyr', 'Bishop', 'Crow', 'Dagger', 'Fable', 'Grim', 'Hollow', 'Ion', 'Jackal', 'Knox', 'Lynx', 'Moth'];

/* Grenade throw solver: which pitch lands a throw at a distance. */
function solveThrow(fromY, dist, strong, toY = 0.2) {
  let best = 0.3, bestErr = 1e9; const v = strong ? 17 : 8, up = strong ? 2.2 : 3.2, g = PHYS.gravity * 0.8;
  for (let p = -0.3; p <= 1.2; p += 0.03) {
    let vx = Math.cos(p) * v, vy = Math.sin(p) * v + up, x = 0, y = fromY;
    for (let i = 0; i < 300; i++) { vy -= g * 0.02; x += vx * 0.02; y += vy * 0.02; if (y < toY && vy < 0) break; }
    const e = Math.abs(x - dist * 0.85); if (e < bestErr) { bestErr = e; best = p; }
  }
  return { pitch: best, err: bestErr };
}

/* ── Commander ─────────────────────────────────────────────────────────── */
class Commander {
  constructor(team) {
    this.team = team; this.intel = new Map(); this.plan = null; this.radioCd = 0; this.thinkT = 0; this.squads = [];
    this.memory = Store.get('ai_mem_' + team, { A: { tries: 0, wins: 0 }, B: { tries: 0, wins: 0 }, enemyPref: { A: 0, B: 0 } });
  }
  bots() { return Game.soldiers.filter(s => s.team === this.team && s.isBot && s.ctrl === 'bot'); }
  mates() { return Game.soldiers.filter(s => s.team === this.team); }
  say(from, text, cd = 2.5) { if (this.radioCd > 0 && cd > 0) return; this.radioCd = cd; Game.radio(this.team, from ? from.name : 'Command', text); }
  report(enemy, by) {
    const now = Game.now, prev = this.intel.get(enemy.id);
    const zone = World.zoneAt(enemy.pos.x, enemy.pos.z);
    this.intel.set(enemy.id, { pos: enemy.pos.clone(), t: now, zone, id: enemy.id });
    if (!prev || now - prev.t > 7) {
      const near = this.recentIn(zone, 4);
      if (zone) this.say(by, near > 1 ? `${near} enemies ${zone}!` : `Enemy spotted — ${zone}`, 1.2);
    }
  }
  recentIn(zone, maxAge) { let n = 0; for (const v of this.intel.values()) if (v.zone === zone && Game.now - v.t < maxAge) n++; return n; }
  recentNear(x, z, r, maxAge) { const out = []; for (const v of this.intel.values()) { const e = Game.byId(v.id); if (e && e.alive && Game.now - v.t < maxAge && dist2(v.pos.x, v.pos.z, x, z) < r) out.push(v); } return out; }
  onRoundStart() { this.intel.clear(); this.plan = null; this.radioCd = 0; }
  onRoundEnd(won) {
    if (Game.mode.id !== 'defuse' || !this.plan || !this.plan.site) return;
    if (this.team === 'T') { const m = this.memory[this.plan.site]; m.tries++; if (won) m.wins++; }
    Store.set('ai_mem_' + this.team, this.memory);
  }
  update(dt) {
    this.radioCd -= dt; this.thinkT -= dt;
    if (this.thinkT > 0) return; this.thinkT = 0.5;
    const m = Game.mode.id;
    if (m === 'defuse') this.team === 'T' ? this.thinkAttack() : this.thinkDefend();
    else if (m === 'conquest') this.thinkConquest();
    else if (m === 'sandbox') this.thinkSandbox();
    else this.thinkHunt();
  }

  /* ── Defuse: attackers ── */
  pickPlan() {
    const bots = this.bots(); if (!bots.length) return null;
    // learn: sites that have gone badly get picked less
    const score = k => { const m = this.memory[k]; return (m.wins + 1) / (m.tries + 2) + rand(-0.15, 0.15); };
    const site = score('A') >= score('B') ? 'A' : 'B', routes = World.routes[site];
    const kinds = ['split', 'rush', 'default', 'fake', 'split'], kind = pick(kinds);
    const plan = { kind, site, phase: 'stage', t0: Game.now, groups: [], executeAt: 0, calledExec: false };
    const people = shuffle(bots.slice());
    const assign = (route, members, role) => { plan.groups.push({ route, members: members.map(b => b.id), role }); members.forEach(b => { b.brain.role = role; }); };
    if (kind === 'rush') assign(routes[0], people, 'entry');
    else if (kind === 'split') { const h = Math.ceil(people.length / 2); assign(routes[0], people.slice(0, h), 'entry'); assign(routes[1], people.slice(h), 'entry'); }
    else if (kind === 'fake') {
      const other = site === 'A' ? 'B' : 'A'; const fakers = people.slice(0, Math.min(2, people.length - 1));
      assign(World.routes[other][0], fakers, 'fake'); assign(routes[0], people.slice(fakers.length), 'entry');
    } else { // default: spread out, gather intel, decide later
      plan.phase = 'default';
      const spots = [World.routes.A[0], World.routes.B[0], World.routes.A[1], World.routes.B[1]];
      people.forEach((b, i) => assign(spots[i % spots.length], [b], 'default'));
    }
    // support role: whoever holds utility in each group throws it on execute
    plan.groups.forEach(g => { const ms = g.members.map(id => Game.byId(id)).filter(Boolean); const sup = ms.find(b => b.nades.smoke > 0) || ms.find(b => b.nades.flash > 0); if (sup) sup.brain.support = true; });
    return plan;
  }
  thinkAttack() {
    const G = Game.round; if (!G || G.phase === 'freeze' || G.phase === 'over') return;
    if (!this.plan) {
      this.plan = this.pickPlan(); if (!this.plan) return;
      const P = this.plan;
      const words = { rush: `Rush ${P.site} — everyone ${P.groups[0].route.name}, go go go!`, split: `Split ${P.site}: ${P.groups.map(g => g.route.name).join(' + ')}. Wait for my call.`, default: 'Default. Spread out, get me info.', fake: `Fake ${P.site === 'A' ? 'B' : 'A'}, real hit on ${P.site}. Fakers make noise.` };
      this.say(this.bots()[0], words[P.kind], 0);
    }
    const P = this.plan, now = Game.now;
    // bomb logistics
    const B = Game.bomb;
    if (B.state === 'dropped') {
      const bots = this.bots().filter(b => b.alive); let best = null, bd = 1e9;
      for (const b of bots) { const d = dist2(b.pos.x, b.pos.z, B.pos.x, B.pos.z); if (d < bd) { bd = d; best = b; } }
      if (best && best.brain.order.type !== 'getBomb') { best.brain.setOrder({ type: 'getBomb' }); this.say(best, 'Getting the bomb.'); }
    }
    if (B.state === 'planted') {
      if (P.phase !== 'post') { P.phase = 'post'; this.say(null, `Bomb planted ${B.site}. Hold your angles, play the timer.`, 0); }
      const site = World.routes[B.site][0], holds = World.routes[B.site].flatMap(r => r.hold);
      this.bots().forEach((b, i) => { if (b.alive && b.brain.order.type !== 'hold') b.brain.setOrder({ type: 'hold', pos: holds[i % holds.length], look: World.ctApproach(B.site), crouch: chance(0.5) }); });
      return;
    }
    if (P.phase === 'default') {
      // after gathering info, commit to the site where fewer defenders were seen
      if (now - P.t0 > 22 || G.timeLeft < 60) {
        const a = this.recentNear(World.sites.A.cx, World.sites.A.cz, 30, 20).length, b = this.recentNear(World.sites.B.cx, World.sites.B.cz, 30, 20).length;
        P.site = a < b ? 'A' : b < a ? 'B' : P.site; P.kind = 'split';
        const people = this.bots().filter(x => x.alive), routes = World.routes[P.site], h = Math.ceil(people.length / 2);
        P.groups = [{ route: routes[0], members: people.slice(0, h).map(x => x.id), role: 'entry' }, { route: routes[1], members: people.slice(h).map(x => x.id), role: 'entry' }];
        people.forEach(x => x.brain.role = 'entry');
        P.phase = 'stage'; P.t0 = now;
        this.say(people[0], `Info says ${P.site} is light (${Math.min(a, b)} seen). Regroup, split ${P.site}.`, 0);
      } else {
        P.groups.forEach(g => g.members.forEach(id => { const b = Game.byId(id); if (b && b.alive && b.brain.order.type !== 'hold' && b.brain.order.type !== 'getBomb') b.brain.setOrder({ type: 'hold', pos: g.route.stage, look: g.route.entry, crouch: false, avoid: World.dangerFor('T') }); }));
      }
      return;
    }
    if (P.phase === 'stage') {
      let ready = 0, total = 0;
      for (const g of P.groups) for (const id of g.members) {
        const b = Game.byId(id); if (!b || !b.alive || !b.isBot) continue;
        if (b.brain.order.type === 'getBomb') continue;
        if (g.role === 'fake') { if (b.brain.order.type !== 'fake') b.brain.setOrder({ type: 'fake', pos: g.route.stage, target: g.route.entry }); continue; }
        total++;
        const tgt = g.route.stage;
        if (b.brain.order.type !== 'stage') b.brain.setOrder({ type: 'stage', pos: nearbyPoint(tgt, 3), look: g.route.entry, via: g.route.mid, avoid: World.dangerFor('T') });
        if (dist2(b.pos.x, b.pos.z, tgt.x, tgt.z) < 6) ready++;
      }
      const fakeTime = P.kind === 'fake' ? 14 : 0;
      const everyone = total > 0 && ready >= total, timeout = now - P.t0 > 32 + fakeTime, late = G.timeLeft < 45;
      if (P.kind === 'rush' ? ready >= Math.max(1, total - 1) || now - P.t0 > 12 : (everyone && now - P.t0 > fakeTime) || timeout || late) {
        P.phase = 'execute'; P.executeAt = now;
        this.say(this.bots().find(b => b.alive), `Execute ${P.site}! Utility out, go together!`, 0);
        for (const g of P.groups) for (const id of g.members) { const b = Game.byId(id); if (!b || !b.alive || !b.isBot) continue; b.brain.setOrder({ type: 'execute', route: g.route, site: P.site }); }
      }
    }
    if (P.phase === 'execute') {
      const carrier = Game.byId(B.carrier);
      if (carrier && carrier.isBot && carrier.alive && carrier.brain.order.type !== 'plant') carrier.brain.setOrder({ type: 'plant', site: P.site });
      // stragglers from a fake join the execute
      for (const b of this.bots()) if (b.alive && (b.brain.order.type === 'fake' || b.brain.order.type === 'idle')) b.brain.setOrder({ type: 'execute', route: World.routes[P.site][1] || World.routes[P.site][0], site: P.site });
    }
  }

  /* ── Defuse: defenders ── */
  thinkDefend() {
    const G = Game.round; if (!G || G.phase === 'over') return;
    const now = Game.now, bots = this.bots().filter(b => b.alive), B = Game.bomb;
    if (!this.plan) {
      const holds = World.ctHolds.slice();
      // stack the site attackers have preferred in earlier rounds
      const pref = this.memory.enemyPref, stack = pref.A > pref.B + 1 ? 'A' : pref.B > pref.A + 1 ? 'B' : null;
      let order = shuffle(holds.slice());
      if (stack) { order.sort((a, b) => (b.site === stack) - (a.site === stack)); this.say(bots[0], `They love ${stack}. Stacking ${stack}.`, 0); }
      else order.sort((a, b) => (a.site === 'mid') - (b.site === 'mid'));
      this.plan = { phase: 'hold', rotated: null, retakeT: 0, holds: order };
      bots.forEach((b, i) => { const h = order[i % order.length]; b.brain.home = h; b.brain.setOrder({ type: 'hold', pos: nearbyPoint(h.pos, 1.5), look: h.look, crouch: chance(0.4) }); });
      return;
    }
    const P = this.plan;
    if (B.state === 'planted') {
      if (P.phase !== 'retake') {
        P.phase = 'retake'; P.retakeT = now; this.say(bots[0], `Bomb down on ${B.site}. Group up and retake together!`, 0);
        this.memory.enemyPref[B.site]++; Store.set('ai_mem_' + this.team, this.memory);
      }
      const timeLeft = B.timer, gather = World.retakeGather(B.site);
      const gathered = bots.filter(b => dist2(b.pos.x, b.pos.z, gather.x, gather.z) < 9).length;
      const go = gathered >= Math.min(3, bots.length) || now - P.retakeT > 9 || timeLeft < 22;
      const enemiesHere = this.recentNear(B.pos.x, B.pos.z, 14, 3).length;
      const hopeless = timeLeft < (this.anyKit(bots) ? 5.5 : 10.5) && bots.every(b => dist2(b.pos.x, b.pos.z, B.pos.x, B.pos.z) > 8);
      if (hopeless && P.phase !== 'save') { P.phase = 'save'; this.say(bots[0], 'No time. Save your guns!', 0); }
      bots.forEach(b => {
        if (P.phase === 'save') { if (b.brain.order.type !== 'hide') b.brain.setOrder({ type: 'hide' }); return; }
        if (!go) { if (b.brain.order.type !== 'stage') b.brain.setOrder({ type: 'stage', pos: nearbyPoint(gather, 3), look: B.pos }); return; }
        if (b.brain.order.type !== 'retake' && b.brain.order.type !== 'defuse') b.brain.setOrder({ type: 'retake', pos: B.pos });
      });
      // the closest one defuses once the area looks clear
      if (go && !enemiesHere && !Game.bomb.defuser) {
        let best = null, bd = 1e9; for (const b of bots) { const d = dist2(b.pos.x, b.pos.z, B.pos.x, B.pos.z); if (d < bd) { bd = d; best = b; } }
        if (best && best.brain.order.type !== 'defuse') { best.brain.setOrder({ type: 'defuse' }); this.say(best, 'Defusing, cover me!'); }
      }
      return;
    }
    // rotations: two or more attackers seen on a site pulls help from mid and the other site
    for (const site of ['A', 'B']) {
      const s = World.sites[site], n = this.recentNear(s.cx, s.cz, 34, 5).length;
      if (n >= 2 && P.rotated !== site) {
        P.rotated = site; this.say(bots.find(b => b.brain.home && b.brain.home.site === site) || bots[0], `${n} on ${site}! Rotate ${site}!`, 0);
        const others = bots.filter(b => b.brain.home && b.brain.home.site !== site);
        const keep = others.find(b => b.brain.home.site !== 'mid'); // leave one anchor in case it's a fake
        others.forEach(b => { if (b !== keep) b.brain.setOrder({ type: 'rotate', pos: nearbyPoint(World.retakeGather(site), 4), look: { x: s.cx, z: s.cz }, site }); });
      }
    }
  }
  anyKit(bots) { return bots.some(b => b.kit); }

  /* ── Conquest ── */
  thinkConquest() {
    const bots = this.bots(); if (!bots.length) return;
    // form squads of four; leaders are the first alive member
    const size = 4, nSq = Math.ceil(bots.length / size);
    if (this.squads.length !== nSq || this.squads.some(q => q.members.some(id => !Game.byId(id)))) {
      this.squads = []; const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
      for (let i = 0; i < nSq; i++) this.squads.push({ name: names[i], members: bots.slice(i * size, i * size + size).map(b => b.id), target: null, since: 0 });
      this.squads.forEach(q => q.members.forEach(id => { const b = Game.byId(id); b.squad = q; }));
    }
    const flags = World.flags, hq = World.hq[this.team];
    const threat = f => this.recentNear(f.x, f.z, 22, 6).length;
    const scored = flags.map(f => {
      const d = dist2(f.x, f.z, hq.x, hq.z), mine = f.owner === this.team;
      let v = mine ? (threat(f) > 0 || (f.prog * (this.team === 'CT' ? 1 : -1)) < 0.99 ? 13 : 2) : f.owner ? 10 : 12;
      v -= d / 40; v += rand(0, 1.5);
      return { f, v, want: mine ? (threat(f) > 1 ? 2 : 1) : 2 };
    }).sort((a, b) => b.v - a.v);
    const load = new Map(flags.map(f => [f, 0]));
    for (const q of this.squads) {
      const alive = q.members.map(id => Game.byId(id)).filter(b => b && b.alive); if (!alive.length) continue;
      const cur = q.target; const keep = cur && Game.now - q.since < 25 && !(cur.owner === this.team && threat(cur) === 0 && scored.find(s => s.f === cur).v < 5);
      let pickF = keep ? cur : null;
      if (!pickF) for (const s of scored) { if (load.get(s.f) < s.want) { pickF = s.f; break; } }
      if (!pickF) pickF = scored[0].f;
      load.set(pickF, load.get(pickF) + 1);
      if (pickF !== q.target) {
        q.target = pickF; q.since = Game.now;
        const verb = pickF.owner === this.team ? 'Defend' : pickF.owner ? 'Attack' : 'Capture';
        this.say(alive[0], `${q.name} squad: ${verb} ${pickF.name} (${pickF.label}).`, 1.5);
      }
      const leader = alive[0];
      alive.forEach((b, i) => {
        const o = b.brain.order;
        if (o.type === 'flank' && Game.now < o.until) return;
        if (o.type === 'flag' && o.flag === q.target && Game.now - (o.at || 0) < 20) return;
        b.brain.setOrder({ type: 'flag', flag: q.target, leader: i === 0 ? null : leader, slot: i, at: Game.now });
      });
      // flank: when the squad is pinned on something they can see, one member goes wide
      const seen = alive.map(b => b.brain.target).find(Boolean);
      if (seen && alive.length >= 3 && !alive.some(b => b.brain.order.type === 'flank') && Game.now > (q.flankCd || 0)) {
        const fl = alive[alive.length - 1], p = flankPoint(fl, seen);
        if (p) { q.flankCd = Game.now + 20; fl.brain.setOrder({ type: 'flank', pos: p, target: seen.id, until: Game.now + 12 }); this.say(fl, `Flanking ${p.side > 0 ? 'right' : 'left'}, keep them busy!`); }
      }
    }
  }
  /* ── Team deathmatch: hunt in groups toward the freshest intel ── */
  thinkHunt() {
    const bots = this.bots().filter(b => b.alive); if (!bots.length) return;
    const intel = [...this.intel.values()].filter(v => Game.now - v.t < 10).sort((a, b) => b.t - a.t);
    bots.forEach((b, i) => {
      if (b.brain.order.type === 'hunt' && Game.now - b.brain.order.at < 12 && dist2(b.pos.x, b.pos.z, b.brain.order.pos.x, b.brain.order.pos.z) > 4) return;
      const tgt = intel.length ? intel[i % intel.length].pos : World.nav.randomNear(rand(World.bounds.x0, World.bounds.x1) * 0.8, rand(World.bounds.z0, World.bounds.z1) * 0.8, 10);
      b.brain.setOrder({ type: 'hunt', pos: nearbyPoint(tgt, 5), at: Game.now });
    });
  }
}
function nearbyPoint(p, r) { return World.nav.randomNear(p.x, p.z, r); }
function flankPoint(s, enemy) {
  const dx = enemy.pos.x - s.pos.x, dz = enemy.pos.z - s.pos.z, d = Math.hypot(dx, dz) || 1;
  const side = chance(0.5) ? 1 : -1, px = -dz / d * side, pz = dx / d * side;
  for (const k of [16, 12, 9]) { const x = enemy.pos.x + px * k - dx / d * 4, z = enemy.pos.z + pz * k - dz / d * 4; if (World.nav.walkableAt(x, z)) return { x, z, side }; }
  return null;
}
World.ctApproach = site => { const s = World.sites[site]; return { x: s.cx, z: s.z0 - 6 }; };
World.dangerFor = team => team === 'T' ? Object.values(World.sites).concat(World.zones.filter(z => z.name === 'CT Spawn')) : [];
World.retakeGather = site => site === 'A' ? { x: World.sites.A.x0 - 8, z: World.sites.A.z0 + 8 } : { x: World.sites.B.x1 + 10, z: World.sites.B.z0 + 10 };

const OBJECTIVE_ORDERS = new Set(['plant', 'execute', 'retake', 'defuse', 'getBomb', 'flag', 'rotate', 'stage', 'hunt']);
/* ── Brain ─────────────────────────────────────────────────────────────── */
class Brain {
  constructor(s) {
    this.s = s; this.order = { type: 'idle' }; this.path = null; this.pi = 0; this.goal = null; this.repathT = 0;
    this.mem = new Map(); this.target = null; this.reactT = 0; this.errX = 0; this.errY = 0; this.aimHead = false;
    this.senseT = rand(0, 0.15); this.stuckT = 0; this.lastP = new V3(); this.strafeT = 0; this.strafe = 1; this.burst = 0; this.burstRest = 0;
    this.nadeCd = rand(4, 9); this.heard = null; this.role = 'entry'; this.support = false; this.home = null; this.lookYaw = 0; this.utilDone = false;
    this.coverT = 0; this.cover = null; this.planting = false; this.fakeShots = 0; this.prefire = null; this.lastSeenAny = -9;
  }
  get d() { const base = DIFF[(Sandbox.on ? Sandbox.opts.npcSkill : Game.botDiff) || Settings.diff] || DIFF.normal; const k = (Game.mode.id === 'conquest' ? 1.5 : 1) * (Settings.botSight || 1); return k === 1 ? base : Object.assign({}, base, { range: base.range * k }); }
  setOrder(o) { this.order = o; this.goal = null; this.path = null; this.utilDone = false; this.planting = false; }
  reset() { this.mem.clear(); this.target = null; this.path = null; this.goal = null; this.order = { type: 'idle' }; this.cover = null; this.planting = false; this.utilDone = false; this.support = false; this.role = 'entry'; }
  /* tank crews can't be shot, so only bots carrying a launcher bother with them */
  enemies() { const at = !!this.s.weapons[4]; return Game.soldiers.filter(e => e.alive && Game.hostile(this.s, e) && (at || !(e.vehicle && e.vehicle.K.closed) || e.vehicle.K.type === 'heli' || (e.vehicle.K.pguns && e.vehicle.passenger === e))); }   // anyone can shoot at a helicopter

  /* ── senses ── */
  sense() {
    const s = this.s, d = this.d, eye = s.eye(new V3()), fwdYaw = s.yaw, now = Game.now;
    if (s.blind > 0.4) { this.target = null; return; }
    const cmd = Game.cmd[s.team];
    for (const e of this.enemies()) {
      const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, dist = Math.hypot(dx, dz);
      const m = this.mem.get(e.id);
      if (dist > d.range && !(m && m.vis && dist < d.range * 1.3)) { if (m) m.vis = false; continue; }
      const ang = Math.abs(angDiff(fwdYaw, Math.atan2(-dx, -dz)));
      const fov = (m && m.vis ? d.fov + 30 : d.fov) * DEG;
      if (ang > fov && dist > 2.5) { if (m) m.vis = false; continue; }
      const hb = e.hitboxes(); const hy = (hb.head.y0 + hb.head.y1) / 2, cyy = hb.baseY + hb.h * 0.55;
      let vis = false;
      for (const ty of [hy, cyy]) {
        const tp = { x: e.pos.x, y: ty, z: e.pos.z };
        if (World.los(eye.x, eye.y, eye.z, tp.x, tp.y, tp.z) && !FX.smokeBlocks(eye, tp)) { vis = true; break; }
      }
      // a crouched enemy in the dark at range is harder to notice
      if (vis && !(m && m.vis) && dist > 30 && e.crouch > 0.5 && Math.hypot(e.vel.x, e.vel.z) < 1 && chance(0.5)) vis = false;
      if (vis) {
        const wasVis = m && m.vis;
        this.mem.set(e.id, { pos: e.pos.clone(), t: now, vis: true, id: e.id });
        this.lastSeenAny = now;
        cmd && cmd.report(e, s);
        if (!wasVis && (!this.target || !this.target.alive)) this.acquire(e, dist);
      } else if (m) m.vis = false;
    }
    // choose the most urgent visible enemy
    let best = null, bs = 1e9;
    for (const [id, m] of this.mem) {
      const e = Game.byId(id); if (!e || !e.alive) { this.mem.delete(id); continue; }
      if (!m.vis) continue;
      const dist = dist2(e.pos.x, e.pos.z, s.pos.x, s.pos.z), ang = Math.abs(angDiff(s.yaw, Math.atan2(-(e.pos.x - s.pos.x), -(e.pos.z - s.pos.z))));
      const sc = dist + ang * 12 + (e === this.target ? -8 : 0) + (e.brain && e.brain.target === s ? -6 : 0);
      if (sc < bs) { bs = sc; best = e; }
    }
    if (best !== this.target) { if (best) this.acquire(best, dist2(best.pos.x, best.pos.z, s.pos.x, s.pos.z)); else this.target = null; }
  }
  acquire(e, dist) {
    const d = this.d; this.target = e;
    // far-away targets take longer to recognise and react to
    this.reactT = d.react * rand(0.8, 1.35) * (this.s.blind > 0 ? 2 : 1) * (1 + dist / 70);
    const mag = d.err * DEG * (1 + dist / 35) * rand(0.6, 1.3), a = rand(0, TAU);
    this.errX = Math.cos(a) * mag; this.errY = Math.sin(a) * mag * 0.6;
    this.aimHead = chance(d.head);
  }
  hear(src, radius) {
    const s = this.s; if (src.team === s.team || !s.alive) return;
    const d = dist2(src.pos.x, src.pos.z, s.pos.x, s.pos.z); if (d > radius) return;
    this.heard = { x: src.pos.x + rand(-2, 2), z: src.pos.z + rand(-2, 2), t: Game.now };
  }

  /* ── main tick ── */
  update(dt) {
    const s = this.s; if (!s.alive) return;
    const now = Game.now, in_ = s.moveIn; in_.f = in_.s = 0; in_.jump = in_.crouch = in_.walk = in_.sprint = false;
    this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.12; this.sense(); }
    this.nadeCd -= dt; this.coverT -= dt;
    if (Game.round && Game.round.phase === 'freeze') { this.lookAround(dt, null); return; }
    if (this.target && this.target.alive) this.combat(dt, now);
    else if (s.hp < 60 && this.nearPack()) { this.target = null; this.moveTo(this.pack.pos, dt, false, false, true); this.lookAround(dt, null); }
    else { this.target = null; this.peace(dt, now); }
    // patch up: in cover, or when nobody's shooting at us
    if (s.meds > 0 && s.hp < 55 && s.healT <= 0 && (!this.target || (this.cover && dist2(s.pos.x, s.pos.z, this.cover.x, this.cover.z) < 1.5))) Game.useMed(s);
    // utility reload when calm
    const w = s.w, a = s.ammo[s.cur];
    if (!this.target && w && a && a.mag < w.mag * 0.45 && a.res > 0 && now - this.lastSeenAny > 2) s.startReload();
    if (!this.target && s.cur !== s.bestWeapon() && !isNade(s.cur) && s.reloadT <= 0) s.switchTo(s.bestWeapon());
  }

  combat(dt, now) {
    const s = this.s, e = this.target, d = this.d, w = s.w;
    const eye = s.eye(new V3());
    const hb = e.hitboxes();
    const ay = this.aimHead ? (hb.head.y0 + hb.head.y1) / 2 : hb.baseY + hb.h * 0.62;
    const dx = e.pos.x - eye.x, dz = e.pos.z - eye.z, dy = ay - eye.y, dist = Math.hypot(dx, dz);
    // lead slightly toward where they're moving — better bots lead better
    const lead = dist / 300 * (1 - d.react);
    const tx = dx + e.vel.x * lead, tz = dz + e.vel.z * lead;
    this.errX *= Math.exp(-dt / d.settle); this.errY *= Math.exp(-dt / d.settle);
    const jitter = Math.hypot(s.vel.x, s.vel.z) > 2 ? 0.012 : 0.003;
    const wantYaw = Math.atan2(-tx, -tz) + this.errX + rand(-jitter, jitter), wantPitch = Math.atan2(dy, Math.hypot(tx, tz)) + this.errY;
    this.turnTo(wantYaw, wantPitch, dt, d.turn * 1.5);
    this.reactT -= dt;
    const m = this.mem.get(e.id), visible = m && m.vis;
    const lowHp = s.hp < 35 && this.role !== 'entry';
    // weapon choice
    if (w && s.ammo[s.cur] && s.ammo[s.cur].mag === 0 && s.ammo[s.cur].res === 0) s.switchTo(s.weapons[2] || 'knife');
    if (e.vehicle && e.vehicle.K.closed && s.weapons[4] && s.ammo[s.weapons[4]] && (s.ammo[s.weapons[4]].mag + s.ammo[s.weapons[4]].res) > 0) { if (s.cur !== s.weapons[4]) s.switchTo(s.weapons[4]); }
    else if (isNade(s.cur) || (w && w.projectile && w.explosive && dist < 8)) s.switchTo(s.bestWeapon());
    if (s.cur === 'knife' && s.bestWeapon() !== 'knife' && dist > 2) s.switchTo(s.bestWeapon());
    if (w && w.type === 'sniper') s.ads = visible && this.reactT < 0.25 && dist > 6;
    else s.ads = Game.mode.id !== 'defuse' && visible && dist > 25;
    const a = s.ammo[s.cur];
    if (a && a.mag === 0 && dist < 9 && s.weapons[2] && s.cur !== s.weapons[2] && s.ammo[s.weapons[2]] && s.ammo[s.weapons[2]].mag > 0) s.switchTo(s.weapons[2]);
    // movement while fighting
    const yawErr = Math.abs(angDiff(s.yaw, wantYaw)), pitchErr = Math.abs(s.pitch - wantPitch);
    const size = Math.atan2(this.aimHead ? 0.15 : 0.3, dist);
    const precise = w && (w.type === 'rifle' || w.type === 'sniper' || w.type === 'lmg' || (w.type === 'pistol' && dist > 12));
    if (lowHp && this.coverT <= 0 && !this.cover) { this.cover = findCover(s, e.pos); this.coverT = 3; if (this.cover && chance(0.5)) Game.cmd[s.team].say(s, 'Taking fire, falling back!'); }
    if (this.cover) {
      this.moveTo(this.cover, dt, false);
      if (dist2(s.pos.x, s.pos.z, this.cover.x, this.cover.z) < 1.2 || this.coverT < -3) { this.cover = null; if (a && a.mag < (w.mag || 1) * 0.6) s.startReload(); }
    } else if (visible && dist > 28 && OBJECTIVE_ORDERS.has(this.order.type) && !(w && w.type === 'sniper')) {
      // far fight while on an objective: keep advancing instead of trading pot-shots forever
      this.peace(dt, now, true);
    } else if (visible) {
      if (precise && dist > 14) { /* counter-strafe: stand still to shoot accurately, sometimes crouched */ if (this.crouchShoot === undefined) this.crouchShoot = chance(0.3); s.moveIn.crouch = this.crouchShoot; }
      else { this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = rand(0.25, 0.7); this.strafe = -this.strafe; } s.moveIn.s = this.strafe; if (w && w.type === 'knife' || (w && w.type === 'shotgun' && dist > 7)) s.moveIn.f = 1; }
    } else {
      // lost sight: push the last known spot or hold the angle
      const aggressive = this.role === 'entry' || Game.mode.id !== 'defuse' || this.order.type === 'retake';
      if (m && now - m.t < 3.5) {
        if (aggressive) this.moveTo(m.pos, dt, true);
        this.maybeNade(m.pos, now - m.t);
      } else { this.target = null; this.crouchShoot = undefined; return; }
    }
    // fire
    if (!visible || this.reactT > 0 || !w) return;
    // out of this gun's effective range: close the distance instead of wasting ammo
    if (w.type !== 'sniper' && w.type !== 'bow' && !w.projectile && dist > weaponRange(w)[1] * 1.1) { this.moveTo(e.pos, dt, false); return; }
    const tol = size * 1.6 + (w.type === 'shotgun' ? 0.05 : 0) + (dist < 6 ? 0.08 : 0);
    if (yawErr + pitchErr > tol) return;
    if (w.type === 'sniper' && (s.adsT < 0.8 || Math.hypot(s.vel.x, s.vel.z) > 1.5)) return;
    if (precise && dist > 14 && Math.hypot(s.vel.x, s.vel.z) > PHYS.walk * 0.4) return;
    if (w.auto && dist > 22 && w.type !== 'lmg') {
      if (this.burstRest > 0) { this.burstRest -= dt; return; }
      if (s.recoilIdx >= (dist > 40 ? 1.5 : 3.5)) { this.burstRest = rand(0.18, 0.35); return; }
    }
    if (!w.auto && s.fireCd > -rand(0, 0.08)) return;
    fireWeapon(s, now, d.recoil);
  }

  /* ── everything that isn't a firefight ── */
  peace(dt, now, noLook) {
    const s = this.s, o = this.order; if (!noLook) this.crouchShoot = undefined;
    let look = null;
    // recent memory of an enemy we lost: pre-aim where they were
    for (const m of this.mem.values()) if (now - m.t < 6) { look = m.pos; break; }
    if (!look && this.heard && now - this.heard.t < 4) look = this.heard;
    switch (o.type) {
      case 'hold': {
        const far = dist2(s.pos.x, s.pos.z, o.pos.x, o.pos.z) > 1.5;
        if (far) this.moveTo(o.pos, dt, false); else { s.moveIn.crouch = !!o.crouch; look = look || o.look; }
        break;
      }
      case 'stage': case 'rotate': {
        const via = o.via && !o.passedVia ? o.via : null;
        if (via) { if (this.moveTo(via, dt, false)) o.passedVia = true; }
        else if (dist2(s.pos.x, s.pos.z, o.pos.x, o.pos.z) > 2) this.moveTo(o.pos, dt, false, o.type === 'stage' && Game.mode.id === 'defuse' && s.team === 'T' && dist2(s.pos.x, s.pos.z, o.pos.x, o.pos.z) < 14);
        else { look = look || o.look; s.moveIn.crouch = o.type === 'rotate'; }
        break;
      }
      case 'fake': {
        if (dist2(s.pos.x, s.pos.z, o.pos.x, o.pos.z) > 2) this.moveTo(o.pos, dt, false);
        else { look = o.target; if (this.fakeShots < 8 && chance(dt * 2)) { this.fakeShots++; this.turnTo(Math.atan2(-(o.target.x - s.pos.x), -(o.target.z - s.pos.z)), 0.02, dt, 20); fireWeapon(s, now, 1); } if (this.nadeCd <= 0 && s.nades.flash > 0) this.throwAt(o.target, 'flash'); }
        break;
      }
      case 'execute': {
        const R = o.route;
        if (this.support && !this.utilDone) {
          const tgt = (s.nades.smoke > 0 && R.smoke[0]) || (s.nades.flash > 0 && R.flash[0]);
          if (tgt && this.throwAt(tgt, s.nades.smoke > 0 ? 'smoke' : 'flash', true)) { this.utilDone = !(s.nades.flash > 0 && s.nades.smoke === 0 && R.flash[0]); break; }
          this.utilDone = true;
        }
        if (Game.now - Game.cmd[s.team].plan.executeAt < 1.2 && this.support) break; // let the smoke bloom
        if (o.route.mid && !o.passedMid) { if (this.moveTo(o.route.mid, dt, false)) o.passedMid = true; }
        else if (!o.at) { if (this.moveTo(o.pos || (o.pos = nearbyPoint(R.entry, 3)), dt, false)) o.at = true; }
        else { const h = o.hold || (o.hold = pick(R.hold)); if (dist2(s.pos.x, s.pos.z, h.x, h.z) > 1.5) this.moveTo(h, dt, false); else look = look || World.ctApproach(o.site); }
        break;
      }
      case 'plant': {
        const site = World.sites[o.site];
        if (!World.siteAt(s.pos.x, s.pos.z)) { this.moveTo(o.spot || (o.spot = nearbyPoint({ x: site.cx + rand(-3, 3), z: site.cz + rand(-3, 3) }, 3)), dt, false); }
        else if (Game.bomb.carrier === s.id) {
          if (this.planting && !s.planting) this.planting = false; // interrupted: try again
          if (!this.planting && !this.lastSeenRecent(2) && Math.hypot(s.vel.x, s.vel.z) < 0.8) { this.planting = true; Game.startPlant(s); }
          s.moveIn.crouch = true; look = World.ctApproach(o.site);
        }
        break;
      }
      case 'getBomb': { const B = Game.bomb; if (B.state !== 'dropped') { this.setOrder({ type: 'idle' }); break; } this.moveTo(B.pos, dt, false); break; }
      case 'retake': { this.moveTo(nearbyPoint(o.pos, 5), dt, false); look = look || o.pos; break; }
      case 'defuse': {
        const B = Game.bomb; if (B.state !== 'planted') { this.setOrder({ type: 'idle' }); break; }
        if (dist2(s.pos.x, s.pos.z, B.pos.x, B.pos.z) > 1.3) this.moveTo(B.pos, dt, false);
        else { if (this.planting && Game.bomb.defuser !== s.id) this.planting = false; if (!this.planting && Math.hypot(s.vel.x, s.vel.z) < 0.8) { this.planting = true; Game.startDefuse(s); } }
        s.moveIn.crouch = dist2(s.pos.x, s.pos.z, B.pos.x, B.pos.z) <= 1.3;
        break;
      }
      case 'hide': { if (!o.pos) o.pos = findCover(s, Game.bomb.pos || s.pos) || s.pos.clone(); this.moveTo(o.pos, dt, false); s.moveIn.crouch = true; break; }
      case 'flag': {
        const f = o.flag;
        if (o.leader && o.leader.alive && dist2(s.pos.x, s.pos.z, f.x, f.z) > 26) {
          // follow the squad leader in a loose wedge
          const L = o.leader, side = o.slot % 2 ? 1 : -1, back = 2 + Math.floor(o.slot / 2) * 2;
          const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw);
          const p = { x: L.pos.x - fx * back + fz * side * 2.5, z: L.pos.z - fz * back - fx * side * 2.5 };
          if (dist2(s.pos.x, s.pos.z, p.x, p.z) > 2.5) this.moveTo(p, dt, false, false, true);
        } else {
          if (!o.spot || (o.arrived && Game.now - o.arrived > rand(8, 14))) { o.spot = nearbyPoint({ x: f.x + rand(-f.radius, f.radius) * 0.7, z: f.z + rand(-f.radius, f.radius) * 0.7 }, 4); o.arrived = 0; }
          if (dist2(s.pos.x, s.pos.z, o.spot.x, o.spot.z) > 1.5) this.moveTo(o.spot, dt, false, false, dist2(s.pos.x, s.pos.z, f.x, f.z) > 30);
          else { if (!o.arrived) o.arrived = Game.now; s.moveIn.crouch = chance(0.5) ? s.moveIn.crouch : true; }
        }
        break;
      }
      case 'flank': {
        if (Game.now > o.until) { this.setOrder({ type: 'idle' }); break; }
        if (this.moveTo(o.pos, dt, false, false, true)) { const e = Game.byId(o.target); look = e ? e.pos : look; }
        break;
      }
      case 'hunt': this.moveTo(o.pos, dt, false, false, true); break;
      default: {
        if (Game.mode.id === 'defuse' && s.team === 'CT' && this.home) this.setOrder({ type: 'hold', pos: this.home.pos, look: this.home.look });
        break;
      }
    }
    if (!noLook) this.lookAround(dt, look);
  }
  /* a dropped health pack close enough to be worth the detour */
  nearPack() {
    const s = this.s; this.pack = null; let bd = 14;
    for (const k of Game.pickups) if (k.kind === 'hp') { const d = dist2(k.pos.x, k.pos.z, s.pos.x, s.pos.z); if (d < bd) { bd = d; this.pack = k; } }
    return !!this.pack;
  }
  lastSeenRecent(t) { return Game.now - this.lastSeenAny < t; }
  lookAround(dt, look) {
    const s = this.s;
    let yaw = null;
    if (look) yaw = Math.atan2(-(look.x - s.pos.x), -(look.z - s.pos.z));
    else if (Math.hypot(s.vel.x, s.vel.z) > 1) yaw = Math.atan2(-s.vel.x, -s.vel.z);
    if (yaw != null) this.turnTo(yaw, 0, dt, 5);
    else { this.lookYaw += dt * 0.4; this.turnTo(s.yaw + Math.sin(this.lookYaw) * 0.01, 0, dt, 2); }
  }
  turnTo(yaw, pitch, dt, speed) {
    const s = this.s, dy = angDiff(s.yaw, yaw), dp = pitch - s.pitch;
    const k = 1 - Math.exp(-dt * speed);
    s.yaw = angWrap(s.yaw + clamp(dy * k * 1.5, -speed * dt, speed * dt) + dy * k * 0.3);
    s.pitch = clamp(s.pitch + dp * k * 1.6, -1.4, 1.4);
  }
  /* path following; returns true when arrived */
  moveTo(p, dt, careful, walkQuiet = false, sprint = false) {
    const s = this.s, now = Game.now;
    if (!p) return true;
    const dGoal = dist2(s.pos.x, s.pos.z, p.x, p.z);
    if (dGoal < 0.9) return true;
    if (!this.goal || dist2(this.goal.x, this.goal.z, p.x, p.z) > 1.5 || now > this.repathT) {
      if (AI.budget > 0) {
        AI.budget--; this.goal = { x: p.x, z: p.z }; this.pi = 0;
        this.path = World.nav.find(s.pos.x, s.pos.z, p.x, p.z, this.order.avoid);
        this.repathT = now + (this.path ? rand(2.5, 4) : rand(1, 2)); // failed searches back off
      }
    }
    if (!this.path || !this.path.length) { this.steer(p.x - s.pos.x, p.z - s.pos.z, careful, walkQuiet, sprint); return false; }
    let wp = this.path[this.pi];
    while (wp && dist2(s.pos.x, s.pos.z, wp.x, wp.z) < 0.8 && this.pi < this.path.length - 1) wp = this.path[++this.pi];
    this.steer(wp.x - s.pos.x, wp.z - s.pos.z, careful, walkQuiet, sprint);
    // stuck? re-plan and hop
    if (this.lastP.distanceToSquared(s.pos) < 0.0025 * 60 * dt) { this.stuckT += dt; if (this.stuckT > 0.8) { this.stuckT = 0; this.path = null; this.goal = null; s.moveIn.jump = true; s.moveIn.s = chance(0.5) ? 1 : -1; } } else this.stuckT = 0;
    this.lastP.copy(s.pos);
    return false;
  }
  steer(dx, dz, careful, walkQuiet, sprint) {
    const s = this.s, l = Math.hypot(dx, dz) || 1; let mx = dx / l, mz = dz / l;
    // keep a little space from teammates so they don't stack in doors
    for (const o of Game.soldiers) { if (o === s || !o.alive || o.team !== s.team) continue; const ox = s.pos.x - o.pos.x, oz = s.pos.z - o.pos.z, d = Math.hypot(ox, oz); if (d < 1.1 && d > 0.01) { mx += ox / d * 0.6; mz += oz / d * 0.6; } }
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
    const n = Math.hypot(mx, mz) || 1; mx /= n; mz /= n;
    s.moveIn.f = mx * fx + mz * fz; s.moveIn.s = mx * rx + mz * rz;
    s.moveIn.walk = !!walkQuiet || !!careful; s.moveIn.sprint = !!sprint && s.moveIn.f > 0.6;
  }
  maybeNade(pos, age) {
    const s = this.s; if (this.nadeCd > 0 || age < 0.8) return;
    const d = dist2(s.pos.x, s.pos.z, pos.x, pos.z); if (d < 7 || d > 26) return;
    if (s.nades.frag > 0 && chance(0.6)) { if (this.throwAt(pos, 'frag')) Game.cmd[s.team].say(s, 'Frag out!'); }
    else if (s.nades.flash > 0 && chance(0.4)) this.throwAt(pos, 'flash');
    this.nadeCd = rand(6, 12);
  }
  /* Pick the grenade, face the target, pitch for the arc, throw. */
  throwAt(p, type, strict) {
    const s = this.s; if (s.nades[type] <= 0) return false;
    if (s.cur !== type) { s.switchTo(type); return false; }
    if (s.drawT > 0) return false;
    const d = dist2(s.pos.x, s.pos.z, p.x, p.z), strong = d > 10, sol = solveThrow(s.eyeY, d, strong);
    const yaw = Math.atan2(-(p.x - s.pos.x), -(p.z - s.pos.z));
    this.turnTo(yaw, sol.pitch, 1 / 60, 30);
    if (Math.abs(angDiff(s.yaw, yaw)) > 0.05 || Math.abs(s.pitch - sol.pitch) > 0.05) return false;
    s.vel.set(0, s.vel.y, 0);
    Game.throwNade(s, type, strong);
    this.nadeCd = rand(3, 6);
    return true;
  }
}
/* A spot near us that an enemy position can't see — for retreating/reloading. */
function findCover(s, from) {
  let best = null, bd = 1e9; const nav = World.nav;
  for (let i = 0; i < 28; i++) {
    const a = rand(0, TAU), r = rand(2, 9), x = s.pos.x + Math.cos(a) * r, z = s.pos.z + Math.sin(a) * r;
    if (!nav.walkableAt(x, z)) continue;
    if (World.los(from.x, 1.5, from.z, x, 1.3, z)) continue;
    const toward = dist2(x, z, from.x, from.z) < dist2(s.pos.x, s.pos.z, from.x, from.z) ? 5 : 0;
    const sc = r + toward; if (sc < bd) { bd = sc; best = { x, z }; }
  }
  return best;
}

/* ── bot purchases in defuse ───────────────────────────────────────────── */
function botBuy(s, stance, isAwper) {
  const side = s.team, buy = (id, cost) => { if (s.money >= cost) { s.money -= cost; s.give(id); return true; } return false; };
  const rifle = side === 'T' ? 'ak47' : 'm4a4';
  if (stance === 'pistol') { if (chance(0.5)) { if (s.money >= 650) { s.money -= 650; s.armor = 100; } } else { buy('flash', 200); buy('smoke', 300); } }
  else if (stance === 'eco') { if (s.money > 1500 && chance(0.4)) buy('deagle', 700); }
  else if (stance === 'force') { if (!s.weapons[1]) { if (!buy(pick(side === 'T' ? ['p90', 'nova', 'mp9'] : ['mp9', 'nova', 'ssg']), 1700) && !buy('mp9', 1250)) buy('deagle', 700); } if (s.money >= 650 && s.armor < 50) { s.money -= 650; s.armor = 100; } }
  else {
    if (!s.weapons[1] || WEAPONS[s.weapons[1]].price < 2000) { if (isAwper && s.money >= 5900) buy('awp', 4750); else if (!buy(rifle, WEAPONS[rifle].price)) buy('scar', 3300); }
    if (s.money >= 1000 && (!s.helmet || s.armor < 60)) { s.money -= 1000; s.armor = 100; s.helmet = true; }
    buy('smoke', 300); buy('flash', 200); if (chance(0.6)) buy('frag', 300);
    if (side === 'CT' && s.money >= 400 && !s.kit) { s.money -= 400; s.kit = true; }
    if (s.money >= 900 && s.meds < 1 && chance(0.4)) { s.money -= 400; s.meds++; }
  }
  s.switchTo(s.bestWeapon());
}

/* ── AI manager ────────────────────────────────────────────────────────── */
const AI = {
  budget: 4,
  update(dt) {
    this.budget = Game.mode.id === 'conquest' ? 3 : 4;
    if (!Game.authority()) return;
    for (const t of ['T', 'CT']) Game.cmd[t].update(dt);
    for (const s of Game.soldiers) if (s.ctrl === 'bot' && s.alive && s.brain && !s.heldBy) s.brain.update(dt);
  },
};
