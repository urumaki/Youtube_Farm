// Owner 2026-11-25 (docs/superpowers/specs/2026-11-25-narration-rotation-design.md): the narration said the same
// bookkeeping every day ("The Lord granted N job requests", "Just N more villagers and...", "Day N in Subscriber
// Kingdom"...). From NARRATION_FROM a day says at most 2 of the routine lines, in turn by day number, and each wording comes
// from its pool in turn, so none comes back before the pool is used up. Stateless: a day made again reads the same.

export const NARRATION_FROM = '2026-11-26';
export const ROUTINE = ['open', 'newcomers', 'comment', 'goal'];

/** The routine roles said on this day: the list turned by the day number, the first 2 that apply; the goal when close. */
export function routineRoles(diff) {
  const k = ((diff.day % ROUTINE.length) + ROUTINE.length) % ROUTINE.length;
  const turned = [...ROUTINE.slice(k), ...ROUTINE.slice(0, k)];
  const say = new Set(turned.filter((r) => r !== 'goal' || diff.next).slice(0, 2));
  if (diff.next && diff.next.remaining <= 20) say.add('goal');
  return say;
}

/** The pool's item for this day; `k` shifts each pool so they do not all turn together. */
export function turn(pool, day, k = 0) {
  const n = pool.length;
  return pool[(((day + k) % n) + n) % n];
}
