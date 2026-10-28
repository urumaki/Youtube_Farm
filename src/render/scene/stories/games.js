// The announcement of a game at the Tournament Ground (owner 2026-10-28), the first day of the chariot race or the joust:
// the town crier reads the proclamation from the dais in the market square (proclaim.js), named guards in front of it; the
// title tells the guards how to enter: comment "join" (the narration says it too).
import { buildProclaim } from './proclaim.js';

export function buildGamesAnnounce(args) {
  const { story } = args;
  const name = story.id === 'race' ? 'A chariot race' : 'A joust';
  const st = buildProclaim({ ...args, story: { ...story, title: name } });
  if (!st) return null;
  st.banner = `${name}! Guards: comment JOIN`;
  return st;
}

// The decree of 2026-10-28 (owner), read once: guards become Knights and Cavaliers only by winning at the Tournament Ground
export function buildDecree(args) {
  const st = buildProclaim(args);
  if (!st) return null;
  st.banner = 'Knight or Cavalier? Win the tournament!';
  return st;
}
