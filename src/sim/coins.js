// Owner 2026-11-25: gold coins, so commenters come back. Every commenter with a villager starts with 100 gold; each later
// video they comment on gives +1 (once per video, however many comments). Kept by author in `state.coins`:
// { <author channel id>: { gold, videos: [the video ids already counted, the latest KEEP] } }. Only the author id and the
// video id of a comment are used, never its text. Backfilled from day 1 by scripts/backfill-coins.js.

export const START_GOLD = 100;
export const VIDEO_RE = /^[A-Za-z0-9_-]{11}$/;
const KEEP = 40;

/** The gold of a commenter (START_GOLD for one the coins have not met yet). */
export const goldOf = (s, author) => s.coins?.[author]?.gold ?? START_GOLD;

/**
 * A comment by `author` on `video`. `first`: the comment that gave them their name (it counts the video, no coin).
 * Returns true when it paid a coin: a video they had not commented on before.
 */
export function payComment(s, author, video, { first = false } = {}) {
  s.coins ??= {};
  const w = (s.coins[author] ??= { gold: START_GOLD, videos: [] });
  if (typeof video !== 'string' || !VIDEO_RE.test(video) || w.videos.includes(video)) return false;
  w.videos.push(video);
  if (w.videos.length > KEEP) w.videos.splice(0, w.videos.length - KEEP);
  if (first) return false;
  w.gold += 1;
  return true;
}
