// AI Players Chat: forwards normal chat messages to the AI Players pack, which can't read chat on the
// stable API. Chat events are beta-only, so this pack needs the "Beta APIs" experiment.
import { world } from "@minecraft/server";

world.afterEvents.chatSend.subscribe((ev) => {
  const sender = ev.sender;
  if (!sender || typeof ev.message !== "string") return;
  const payload = JSON.stringify({ p: sender.name, m: ev.message.slice(0, 240) }).replace(/[\n\r]/g, " ");
  try {
    world.getDimension("overworld").runCommand(`scriptevent aip:chat ${payload}`);
  } catch (e) {
    console.warn(`[aip chat] ${e}`);
  }
});
