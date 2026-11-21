// The hook at the start of the daily video (owner 2026-11-21, after a short where 43% swiped away): the line
// "1 SUBSCRIBER = 1 VILLAGER" at the top of the frame for the whole first scene, and "IS THIS YOU?" over the name of
// a villager in the opening shot for the first 2.2 s (src/render/scene/overlay.js).
// It starts with the video of 2026-11-23, so the week without hashtags (2026-11-16..22) is compared on its own.
// HOOK=1 or HOOK=0 in the environment turns it on or off for a test render.
export const HOOK_FROM = '2026-11-23';

export function hookOn(date, env = process.env.HOOK) {
  if (env === '1') return true;
  if (env === '0') return false;
  return String(date) >= HOOK_FROM;
}
