// Generative speech. Sentences are assembled from what the bot is doing, remembers, feels and believes,
// in a personal style (slang, punctuation, verbosity, quirks) with typos that get worse under stress.
import { pick, chance, prettyItem, strip } from "../util.js";
import { moodOf, recentJournal, opinionOf } from "./cognition.js";
import { line } from "./chat.js";

// ---------------------------------------------------------------------------
// Style
// ---------------------------------------------------------------------------
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const QUIRKS = ["bro", "tbh", "ngl", "fr", "lol", "lowkey", "honestly", "like", "~", "xD", ":)", "kinda", "literally", "deadass", "ok so", "hmm"];

export function styleOf(bot) {
  if (bot._style) return bot._style;
  const h = hash(bot.name + bot.id);
  const p = bot.personality;
  const r = (n) => ((h >>> n) & 255) / 255;
  bot._style = {
    lower: r(0) < 0.75,
    formal: (p.leadership ?? 0.5) * 0.5 + r(8) * 0.5 > 0.7,
    slang: r(16) * (1 - ((p.leadership ?? 0.5) * 0.4)),
    verbose: 1 + Math.round(r(24) * 2 * (p.chattiness ?? 0.5) + 0.2),
    emoji: r(4) < 0.35,
    excl: r(12) < 0.3,
    typo: 0.01 + r(20) * 0.05,
    quirks: [QUIRKS[h % QUIRKS.length], QUIRKS[(h >>> 5) % QUIRKS.length]],
  };
  return bot._style;
}

// ---------------------------------------------------------------------------
// Vocabulary helpers
// ---------------------------------------------------------------------------
const item = (id, n) => {
  let s = prettyItem(id).toLowerCase().replace(/^raw /, "");
  if (n !== undefined && n > 1 && !s.endsWith("s")) s += "s";
  return s;
};

const TASK_PHRASES = [
  [/collecting logs|getting wood/, ["chopping trees", "getting some wood", "punching trees like a noob", "collecting logs"]],
  [/mining for (\w+)/, (m) => [`looking for ${m[1]}`, `digging for ${m[1]}`, `on a ${m[1]} hunt`, `strip mining for ${m[1]}`]],
  [/collecting (\w+)/, (m) => [`getting ${m[1].replace(/_/g, " ")}`, `farming ${m[1].replace(/_/g, " ")}`]],
  [/crafting (.+)/, (m) => [`crafting ${m[1]}`, `making ${m[1]}`]],
  [/smelting (.+)/, (m) => [`smelting ${m[1]}`, `waiting on the furnace`, `cooking ${m[1]}`]],
  [/fighting (.+)/, (m) => [`fighting a ${m[1].toLowerCase()}`, `beating up a ${m[1].toLowerCase()}`]],
  [/hunting (.+)/, (m) => [`hunting ${m[1]}s`, `looking for ${m[1]}s to eat`]],
  [/building (.+)/, (m) => [`building ${m[1]}`, `working on ${m[1]}`]],
  [/exploring/, ["exploring", "wandering around", "looking around for stuff"]],
  [/heading to the surface/, ["climbing out of a hole", "going back up", "pillaring up"]],
  [/nether/, ["in the nether", "doing nether stuff"]],
  [/blaze/, ["hunting blazes", "looking for a fortress"]],
  [/stronghold/, ["looking for the stronghold", "following eyes of ender"]],
  [/dragon/, ["fighting the dragon", "in the end"]],
  [/eating/, ["eating", "having a snack"]],
  [/following (.+)/, (m) => [`following ${m[1]}`, `tagging along with ${m[1]}`]],
  [/praying|worship/, ["praying", "at worship"]],
];

export function taskPhrase(task) {
  for (const [re, out] of TASK_PHRASES) {
    const m = task.match(re);
    if (m) return pick(typeof out === "function" ? out(m) : out);
  }
  return task || "nothing much";
}

const MOOD_COMMENTS = {
  great: ["going great", "having a good time", "pretty good actually", "honestly vibing", "best day ever"],
  ok: ["its fine", "going ok", "not bad", "could be worse", "slow but fine"],
  bad: ["going badly", "kinda rough", "not great", "struggling ngl", "i hate this", "everything is going wrong"],
};

const OPINION_ADJ = [
  [60, ["the best", "awesome", "a legend", "my best friend", "super nice"]],
  [25, ["cool", "nice", "alright", "pretty chill", "helpful"]],
  [-25, ["ok i guess", "fine", "whatever", "kinda quiet"]],
  [-60, ["annoying", "sus", "not my favorite", "kinda rude"]],
  [-101, ["the worst", "a menace", "a griefer probably", "someone i don't trust"]],
];

function opinionWord(v) {
  for (const [min, words] of OPINION_ADJ) if (v >= min) return pick(words);
  return "ok";
}

function timeWords(ticks) {
  if (ticks < 1200) return pick(["in a minute", "soon", "right now", "in a sec"]);
  if (ticks < 3600) return pick(["in a few minutes", "shortly", "in a bit"]);
  if (ticks < 12000) return pick(["later today", "in a while", "before sunset"]);
  return pick(["tomorrow", "later", "next day"]);
}

export function directionWords(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.round(Math.sqrt(dx * dx + dz * dz));
  if (d < 12) return "right here";
  const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "east" : "west") : dz > 0 ? "south" : "north";
  return `${d} blocks ${dir}`;
}

// ---------------------------------------------------------------------------
// Journal -> sentences
// ---------------------------------------------------------------------------
function journalSentence(j) {
  switch (j.type) {
    case "died":
      return pick([`still mad i died to ${j.by || "something dumb"}`, `i lost all my stuff to ${j.by || "lag"}`, `dying to ${j.by || "that"} was so embarrassing`]);
    case "found":
      return pick([`found ${j.n || "some"} ${item(j.item, j.n)} earlier`, `i got ${item(j.item, j.n)}!`, `scored some ${item(j.item, j.n)}`]);
    case "built":
      return pick([`finished building ${j.what}`, `my ${j.what} came out nice`, `built ${j.what} today`]);
    case "mistake":
      return mistakeSentence(j.kind, j);
    case "joined_town":
      return pick([`i live in ${j.town} now`, `moved to ${j.town}`, `${j.town} is my home now`]);
    case "founded_town":
      return pick([`i founded ${j.town}`, `${j.town} was my idea btw`]);
    case "converted":
      return pick([`i follow ${j.rel} now`, `${j.deity} showed me the way`, `joined ${j.rel}`]);
    case "event_good":
      return pick([`that ${j.what} was fun`, `loved the ${j.what}`, `the ${j.what} was great`]);
    case "missed_event":
      return pick([`i totally forgot about the ${j.what}`, `missed the ${j.what}, my bad`]);
    case "victory":
      return pick(["i killed the ender dragon!!", "the dragon is dead, i did it", "beat the game btw"]);
    case "helped":
      return pick([`${j.who} helped me out`, `${j.who} gave me ${item(j.item)}`]);
    default:
      return null;
  }
}

export function mistakeSentence(kind, j = {}) {
  const lines = {
    fall: ["ouch i misjudged that jump", "fell down a hole lol", "why did i jump off that", "my legs hurt"],
    dig_down: ["dug straight down like an idiot", "never dig straight down they said", "oops fell into a cave"],
    lava: ["LAVA", "almost burned to death", "lava came out of nowhere"],
    craft: [`crafted the wrong thing oops`, `wasted my ${j.what || "materials"}`, "misclicked in the crafting table"],
    build: ["placed a block wrong", "this wall looks weird now", "oops wrong block"],
    forgot_eat: ["forgot to eat lol", "so hungry, forgot food", "i should eat more"],
    lost: ["i think im lost", "where am i", "ok which way was home"],
    hit_neutral: ["oops hit the wrong mob", "sorry mr enderman", "that was an accident i swear"],
    forgot_event: [`forgot the ${j.what || "meeting"}`, "i completely forgot, sorry"],
    misremember: ["i swear it was here", "wait wrong place", "my memory is so bad"],
    dropped: [`lost my ${j.what || "stuff"}`, "where did my items go"],
  };
  return pick(lines[kind] || ["oops"]);
}

// ---------------------------------------------------------------------------
// Sentence builders per intent
// ---------------------------------------------------------------------------
function moodBucket(bot) {
  const m = moodOf(bot);
  return m > 0.35 ? "great" : m > -0.2 ? "ok" : "bad";
}

const B = {
  greet: (bot, c) => {
    const st = styleOf(bot);
    const op = st.formal ? ["hello", "greetings", "good day", "hey there"] : ["hi", "hey", "yo", "sup", "hiii", "heyy", "o/"];
    let s = pick(op);
    if (c.target && chance(0.7)) s += ` ${c.target}`;
    if (chance(0.4)) s += pick(["! how's it going", ", what are you up to", ", long time no see", "", ", whats new"]);
    return [s];
  },
  status: (bot, c) => {
    const out = [`${pick(["im", "i'm", "currently", "just"])} ${taskPhrase(bot.task)}`];
    if (chance(0.6)) out.push(pick(MOOD_COMMENTS[moodBucket(bot)]));
    if (c.reason) out.push(`need it for ${c.reason}`);
    return out;
  },
  smalltalk: (bot, c) => {
    const opts = [];
    const j = recentJournal(bot).slice(-6);
    for (const e of j) {
      const s = journalSentence(e);
      if (s) opts.push(s);
    }
    opts.push(`${pick(["im", "just"])} ${taskPhrase(bot.task)}`);
    if (c.other) opts.push(`${c.other} is ${opinionWord(opinionOf(bot, c.otherId))}`);
    if (bot.faith && c.deity) opts.push(pick([`praise ${c.deity}`, `${c.deity} watches over us`, `has anyone thanked ${c.deity} today`]));
    if (c.town) opts.push(pick([`${c.town} is growing`, `we should build more in ${c.town}`, `i like living in ${c.town}`]));
    opts.push(pick(MOOD_COMMENTS[moodBucket(bot)]));
    const n = Math.min(opts.length, styleOf(bot).verbose);
    const chosen = [];
    for (let i = 0; i < n; i++) chosen.push(opts.splice(Math.floor(Math.random() * opts.length), 1)[0]);
    return chosen;
  },
  reply_smalltalk: (bot, c) => {
    const agree = chance(0.6);
    const out = [pick(agree ? ["same", "true", "fr", "nice", "lol yeah", "oh cool", "ayy"] : ["really?", "hmm", "idk about that", "wait what", "no way"])];
    if (chance(0.5)) out.push(`${pick(["im", "i'm"])} ${taskPhrase(bot.task)}`);
    return out;
  },
  ask_help: (bot, c) => {
    const st = styleOf(bot);
    const please = st.formal || chance(0.3) ? " please" : "";
    return [
      pick([`does anyone have ${c.n} ${item(c.item, c.n)}${please}`, `can someone give me ${item(c.item, c.n)}${please}`, `need ${c.n} ${item(c.item, c.n)}, anyone?`, `help, i cant find any ${item(c.item)}`]),
      c.reason ? `its for ${c.reason}` : "",
    ];
  },
  offer_help: (bot, c) => [pick([`i got ${item(c.item, c.n)}, coming ${c.target}`, `${c.target} i can bring you some`, `on my way with ${item(c.item, c.n)}`, `hold on ${c.target} ill bring it`])],
  thanks: (bot, c) => [pick([`thanks ${c.target}!`, "ty", "thank you so much", `${c.target} you're the best`, "appreciate it"])],
  accept: (bot, c) => [pick([`sure ${c.target || ""}`, "count me in", "ok ill be there", "yes!", "sounds fun", "im down"])],
  decline: (bot, c) => [pick(["cant, busy", "nah", "maybe next time", "sorry im busy", "not feeling it", "pass"]), c.reason ? `im ${c.reason}` : ""],
  propose_event: (bot, c) => {
    const what = c.title;
    return [
      pick([`who wants to come to a ${what}`, `${what} at ${c.place} ${timeWords(c.in)}!`, `everyone, ${what} ${timeWords(c.in)} at ${c.place}`, `im hosting a ${what}, ${c.place}, ${timeWords(c.in)}`]),
      chance(0.4) ? pick(["bring food", "be there", "dont be late", "it'll be fun", "everyone welcome"]) : "",
    ];
  },
  event_chat: (bot, c) => {
    const lines = {
      feast: ["this food is so good", "pass the steak", "cheers everyone", "best feast ever", "who cooked this"],
      festival: ["woooo", "happy festival!", "this is awesome", "party time", "fireworks!!"],
      meeting: ["so what are we building next", "i think we need more houses", "we need a farm", "lets vote"],
      hangout: ["this is nice", "chilling with the squad", "we should do this more"],
      build_day: ["lets get this built", "who has more planks", "almost done", "teamwork"],
      expedition: ["stay together", "anyone found anything", "watch out for lava"],
      worship: ["amen", "praise be", "so peaceful", "blessed"],
    };
    return [pick(lines[c.kind] || lines.hangout)];
  },
  invite_town: (bot, c) => [pick([`${c.target} wanna move to ${c.town}?`, `${c.target} come live in ${c.town}, we have space`, `join ${c.town} ${c.target}!`])],
  found_town: (bot, c) => [pick([`i'm starting a town called ${c.town}`, `welcome to ${c.town}, everyone can join`, `founding ${c.town} here, who wants to live here?`])],
  preach: (bot, c) => [
    pick([`have you heard of ${c.deity}?`, `${c.deity} is real ${c.target || ""}`, `join ${c.rel} ${c.target || ""}`, `the ${c.rel} welcomes everyone`]),
    c.tenet ? pick([`we believe you should ${c.tenet}`, `our rule: ${c.tenet}`]) : "",
  ],
  found_religion: (bot, c) => [pick([`i've had a vision. ${c.deity} is watching us`, `i'm founding ${c.rel}. ${c.deity} guides us`, `listen everyone, ${c.deity} spoke to me`]), `${pick(["rule one", "first", "we must"])}: ${c.tenet}`],
  convert: (bot, c) => [pick([`ok i'll join ${c.rel}`, `${c.deity} it is`, `i believe now`, `sign me up`])],
  reject_faith: (bot, c) => [pick(["no thanks", "i dont believe in that", "nah im good", `${c.deity}? lol no`, "maybe later"])],
  sermon: (bot, c) => [pick([`${c.deity} gave us this world`, `remember: ${c.tenet}`, `we gather today for ${c.deity}`, `thank ${c.deity} for the diamonds`, `may ${c.deity} protect our town`])],
  blessing: (bot, c) => [pick([`praise ${c.deity}`, `${c.deity} be with you`, `thank you ${c.deity}`])],
  pray: (bot, c) => [pick([`${c.deity}, guide me`, `morning prayer to ${c.deity}`, `${c.deity} keep me safe today`])],
  sin: (bot, c) => [pick([`forgive me ${c.deity}`, "i broke a rule, oops", `${c.deity} please dont be mad`])],
  warn: (bot, c) => [pick([`careful, ${c.threat} ${c.where}`, `watch out ${c.where}, ${c.threat}`, `there's a ${c.threat} ${c.where}`])],
  share_place: (bot, c) => [pick([`found ${c.kind} ${c.where}`, `there's ${c.kind} at ${c.coords}`, `if anyone needs ${c.kind}, ${c.where}`])],
  answer_place: (bot, c) => [c.where ? pick([`try ${c.where}`, `i saw some ${c.where}`, `${c.coords} i think`]) : pick(["no idea sorry", "dunno", "haven't seen any"])],
  compliment: (bot, c) => [pick([`${c.target} nice build`, `${c.target} you're cool`, `gg ${c.target}`, `love what you did ${c.target}`])],
  insult: (bot, c) => [pick([`${c.target} stop it`, `${c.target} ur so annoying`, `go away ${c.target}`, `${c.target} rude`])],
  apologize: (bot, c) => [pick([`sorry ${c.target || "guys"}`, "my bad", "oops sorry", `sorry about the ${c.what || "thing"}`])],
  mistake: (bot, c) => [mistakeSentence(c.kind, c)],
  tool_broke: (bot, c) => [pick([`my ${item(c.item)} broke`, `rip my ${item(c.item)}`, `need a new ${item(c.item)}`, `${item(c.item)} just snapped`]), chance(0.4) ? pick(["again", "ugh", "lol", "time to craft another"]) : ""],
  election: (bot, c) => [pick([`vote for me! ill build ${c.project}`, `i'll make ${c.town} great`, `${c.town} needs a ${c.project}, vote me`])],
  vote: (bot, c) => [pick([`i vote ${c.target}`, `${c.target} for mayor`, `my vote: ${c.target}`])],
  mayor: (bot, c) => [pick([`${c.target} is our new mayor!`, `congrats ${c.target}`, `long live mayor ${c.target}`])],
  react_death: (bot, c) => [pick([`rip ${c.target}`, `F ${c.target}`, `noo ${c.target}`, `${c.target} died lol`])],
  confused: (bot, c) => [pick(["what?", "huh", "idk what you mean", "say that again?", "?"])],
  follow_ok: () => [pick(["ok im following", "lead the way", "coming!", "right behind you"])],
  stay_ok: () => [pick(["ok ill wait", "staying here", "ok"])],
  free_ok: () => [pick(["ok back to my stuff", "cya", "alright"])],
  come_ok: (bot, c) => [pick([`coming ${c.target}`, "omw", "on my way"])],
  give_ok: (bot, c) => [pick([`here ${c.target}`, `take it`, `sure, here's ${item(c.item, c.n)}`])],
  give_no: (bot, c) => [pick([`i dont have ${item(c.item)}`, "nope, dont have any", `no ${item(c.item)} sorry`])],
  how_are_you: (bot) => [pick(MOOD_COMMENTS[moodBucket(bot)]), `${pick(["just", "im"])} ${taskPhrase(bot.task)}`],
};

// ---------------------------------------------------------------------------
// Surface realisation: style, joining and typos
// ---------------------------------------------------------------------------
const CONNECT = [", ", ". ", " and ", ", also ", " btw ", ". anyway ", " - "];

function typo(word, rate) {
  if (word.length < 4 || !chance(rate)) return word;
  const i = 1 + Math.floor(Math.random() * (word.length - 2));
  const r = Math.random();
  if (r < 0.4) return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2); // swap
  if (r < 0.7) return word.slice(0, i) + word.slice(i + 1); // drop
  return word.slice(0, i) + word[i] + word.slice(i); // double
}

export function realize(bot, parts) {
  const st = styleOf(bot);
  const clean = parts.filter((p) => p && p.trim());
  if (!clean.length) return "";
  let s = clean[0];
  for (let i = 1; i < clean.length; i++) s += pick(CONNECT) + clean[i];
  s = s.replace(/\s+/g, " ").trim();
  if (st.slang > 0.6) s = s.replace(/\byou\b/g, "u").replace(/\byour\b/g, "ur").replace(/\bbecause\b/g, "cuz");
  const stress = bot.cog ? bot.cog.stress + bot.cog.fatigue * 0.5 : 0;
  let typed = null;
  s = s
    .split(" ")
    .map((w) => {
      const t = typo(w, st.typo * (1 + stress * 2));
      if (t !== w && !typed) typed = w;
      return t;
    })
    .join(" ");
  if (st.lower) s = s.toLowerCase();
  else s = s.charAt(0).toUpperCase() + s.slice(1);
  if (st.slang > 0.5 && chance(st.slang * 0.6)) {
    const q = pick(st.quirks);
    s = q === "~" || q === ":)" || q === "xD" ? `${s} ${q}` : chance(0.5) ? `${st.lower ? q : q.charAt(0).toUpperCase() + q.slice(1)} ${st.lower ? s : s.charAt(0).toLowerCase() + s.slice(1)}` : `${s} ${q}`;
  }
  if (st.emoji && chance(0.3)) s += pick([" :)", " :D", " xD", " :P", " <3"]);
  else if (st.excl && chance(0.3)) s += "!";
  else if (st.formal && !/[.!?)]$/.test(s)) s += ".";
  bot._lastTypo = typed;
  return s.slice(0, 160);
}

/** Build a line for an intent. ctx carries the facts to talk about. */
export function generate(bot, intent, ctx = {}) {
  if (!B[intent]) {
    // older event kinds (join, died, night...) start from a seed phrase and get the bot's own style
    const seed = line(intent, ctx.target);
    if (seed) return realize(bot, [seed, chance(0.25) ? pick(MOOD_COMMENTS[moodBucket(bot)]) : ""]);
  }
  const b = B[intent] || B.smalltalk;
  return realize(bot, b(bot, ctx));
}

export function hasIntent(intent) {
  return !!B[intent];
}

export { item as itemWord, strip };
