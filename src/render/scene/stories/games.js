// The announcement of a game at the Tournament Ground (owner 2026-10-28), the first day of the chariot race or the joust:
// the town crier reads the proclamation from the dais in the market square (proclaim.js), named guards in front of it; the
// title tells the guards how to enter: comment "join" (the narration says it too).
import { buildProclaim } from './proclaim.js';

export function buildGamesAnnounce(args) {
  const { story } = args;
  const name = { race: 'A chariot race', joust: 'A joust', crusade: 'A Crusade', football: 'Mob football', guild: 'The Guild Contest' }[story.id] || 'A joust';
  const st = buildProclaim({ ...args, story: { ...story, title: name } });
  if (!st) return null;
  // owner 2026-11-23: everyone may play the match, every craftsman may enter the contest
  const who = { football: 'Everyone', guild: 'Craftsmen' }[story.id] || 'Guards';
  st.banner = `${name}! ${who}: comment !join`;
  if (story.id === 'football') st.footer = 'Reds against Blues, tomorrow at the Tournament Ground';
  if (story.id === 'guild') st.footer = 'Four craftsmen, one medal from the King';
  if (story.id === 'crusade') st.footer = 'Ride as a Crusader to win back the lost relic'; // owner 2026-11-07
  return st;
}

// The decree of 2026-10-28 (owner), read once: guards become Knights and Cavaliers only by winning at the Tournament Ground
export function buildDecree(args) {
  const st = buildProclaim(args);
  if (!st) return null;
  st.banner = 'Knight or Cavalier? Win the tournament!';
  return st;
}
