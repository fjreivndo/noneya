import { pick, randInt, chance } from "./util.js";

const ADJ = [
  "Sneaky", "Epic", "Silent", "Crazy", "Lazy", "Swift", "Dark", "Golden", "Frosty", "Toxic",
  "Mighty", "Lucky", "Salty", "Cosmic", "Rusty", "Fuzzy", "Brave", "Shadow", "Turbo", "Pixel",
  "Hyper", "Wild", "Tiny", "Mega", "Ultra", "Nova", "Blazing", "Iron", "Diamond", "Emerald",
  "Spicy", "Chill", "Grumpy", "Happy", "Noble", "Rapid", "Stealthy", "Wobbly", "Cursed", "Neon",
];
const NOUN = [
  "Creeper", "Miner", "Builder", "Wolf", "Fox", "Ninja", "Knight", "Pickaxe", "Dragon", "Blaze",
  "Steve", "Pig", "Llama", "Panda", "Gamer", "Slayer", "Hunter", "Crafter", "Golem", "Phantom",
  "Ghast", "Enderman", "Axolotl", "Bee", "Taco", "Potato", "Noob", "Pro", "Wizard", "Pirate",
  "Viking", "Tiger", "Raven", "Falcon", "Cookie", "Waffle", "Pancake", "Nugget", "Bandit", "Rogue",
];
const WORDS = [
  "dirt", "cobble", "block", "craft", "mine", "pvp", "redstone", "lava", "nether", "ender",
  "sky", "cave", "spud", "frog", "duck", "cat", "moon", "star", "storm", "void",
  "zap", "bean", "toast", "jelly", "boss", "dude", "lord", "king", "queen", "kid",
];
const FIRST = [
  "Alex", "Sam", "Max", "Leo", "Mia", "Zoe", "Kai", "Finn", "Ava", "Eli", "Ivy", "Jay", "Lux",
  "Nico", "Owen", "Ruby", "Theo", "Uma", "Vic", "Wren", "Ash", "Bo", "Cy", "Dex", "Ezra", "Gus",
];

const patterns = [
  () => `${pick(ADJ)}${pick(NOUN)}${chance(0.6) ? randInt(1, 999) : ""}`,
  () => `xX${pick(NOUN)}${pick(["", randInt(1, 99)])}Xx`,
  () => `${pick(WORDS)}_${pick(WORDS)}${chance(0.5) ? randInt(1, 99) : ""}`,
  () => `${pick(FIRST)}${pick(["MC", "Plays", "YT", "_", "Craft", "The", "Gaming", "x"])}${chance(0.7) ? randInt(1, 2025) : ""}`,
  () => `Itz${pick(FIRST)}${chance(0.5) ? randInt(1, 99) : ""}`,
  () => `The${pick(ADJ)}${pick(NOUN)}`,
  () => `${pick(WORDS)}${pick(WORDS)}${randInt(10, 9999)}`,
  () => `${pick(FIRST).toLowerCase()}_${pick(NOUN).toLowerCase()}`,
  () => `${pick(NOUN)}${pick(["Main", "God", "Master", "Lord", "Boi", "Man"])}${chance(0.5) ? randInt(1, 99) : ""}`,
  () => `${pick(FIRST)}${pick(FIRST)}`,
];

export function randomUsername(taken) {
  for (let i = 0; i < 50; i++) {
    let n = pick(patterns)();
    n = n.replace(/[^A-Za-z0-9_]/g, "");
    if (n.length > 16) n = n.slice(0, 16);
    if (n.length < 3) continue;
    if (!taken || !taken.has(n.toLowerCase())) return n;
  }
  return `Bot${randInt(1000, 99999)}`;
}
