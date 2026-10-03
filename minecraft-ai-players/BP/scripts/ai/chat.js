// What AI players say in chat.
import { pick } from "../util.js";

export const LINES = {
  join: ["hi", "hello everyone", "yo", "hey guys", "o/", "sup", "hiii", "back again", "what's up"],
  leave: ["gtg, bye", "cya", "bye guys", "brb dinner", "gotta go"],
  greet_player: ["hey {p}!", "hi {p}", "yo {p}", "welcome {p}", "{p}!! hi", "sup {p}"],
  player_died: ["rip {p}", "F", "oof {p}", "nooo {p}", "rip lol", "unlucky {p}"],
  bot_died: ["rip {p}", "F for {p}", "{p} noooo", "rip bozo jk"],
  died: ["noooo", "bruh", "lag", "that was lag i swear", "ugh", "i had so much stuff :(", "ok that was dumb", "rip me"],
  respawn: ["ok im back", "round 2", "time to get my stuff back", "never again"],
  kill: ["ez", "get rekt", "gg", "lol", "that's what you get"],
  low_health: ["im low", "help im dying", "need food", "ouch"],
  flee: ["NOPE", "running", "too many mobs", "bye bye", "nope nope nope"],
  diamonds: ["DIAMONDS!", "found diamonds :D", "diamonds!!!", "yesss diamonds"],
  iron: ["got iron", "iron time", "finally iron"],
  nether: ["going to the nether", "nether time", "its so hot here", "wish me luck"],
  fortress: ["found a fortress!", "fortress spotted", "blazes here i come"],
  stronghold: ["found the stronghold!!", "end portal found", "lets gooo stronghold"],
  assist_portal: ["ok found it (kinda)", "portal time", "there we go"],
  end: ["im in the end", "dragon time", "ok this is scary"],
  dragon: ["lets kill this dragon", "come here dragon", "crystals first"],
  victory: ["GG!!!", "I BEAT THE GAME", "dragon down lets gooo", "gg ez dragon", "WE DID IT"],
  build_start: ["building a base", "time to build", "gonna build something", "construction time"],
  build_done: ["done building :)", "how does it look?", "base complete", "finished!"],
  night: ["its getting dark", "night time, careful", "monsters out", "should probably hide"],
  morning: ["morning!", "finally day", "good morning"],
  bored: ["what should i do", "im bored", "anyone wanna team?", "lag?", "this server is cool", "i love minecraft", "how do i get to the nether again", "nice weather", "anyone got food", "what's everyone doing"],
  crafted: ["crafted a {p}", "new {p}", "got a {p}"],
  hungry: ["so hungry", "need food", "starving"],
  follow_ok: ["ok im following you", "sure, lead the way", "coming!", "ok"],
  stay_ok: ["ok ill wait here", "staying", "ok"],
  free_ok: ["ok ill do my own thing", "back to work", "cya"],
  home_ok: ["heading home", "ok going home"],
  build_ok: ["ok building here", "sure ill build here"],
  hurt_by_player: ["hey!", "why", "stop hitting me", "bro what", "ok you asked for it"],
  thanks: ["thanks!", "ty", "thx :)"],
};

export function line(kind, p) {
  const arr = LINES[kind];
  if (!arr) return undefined;
  return pick(arr).replace("{p}", p ?? "");
}
