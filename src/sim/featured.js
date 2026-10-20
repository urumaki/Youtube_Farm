// Which named villagers the video shows at work today. Owner (2026-10-20): the villagers named today come
// first (the narrator welcomes them, so they must be on screen), then granted job requests, and a job shown
// yesterday is not shown again today, so consecutive videos do not repeat themselves. One villager per job.
import { hash } from './prng.js';

// jobs with the most to see when two candidates are otherwise equal
const INTEREST = ['blacksmith', 'toolsmith', 'woodcutter', 'baker', 'stonemason', 'fisherman', 'carpenter', 'fletcher', 'miller', 'farmer', 'peasant', 'guard', 'knight'];

/** Up to `max` named villagers, best first: [{ id, name, job, today }]. */
export function pickFeatured(state, { avoidJobs = [], max = 4 } = {}) {
  const day = state.day;
  const avoid = new Set(avoidJobs);
  const people = Object.entries(state.names || {})
    .map(([id, n]) => ({ id: Number(id), name: n.name, job: state.villagers?.[Number(id)]?.job ?? n.job, today: n.day === day, asked: n.requestDay === day }))
    .filter((n) => n.id < state.subscriberCount && n.job);
  const score = (n) => (n.today ? 8 : 0) + (n.asked ? 3 : 0) + (avoid.has(n.job) ? -6 : 0);
  people.sort((a, b) => score(b) - score(a)
    || (INTEREST.indexOf(a.job) + 1 || 50) - (INTEREST.indexOf(b.job) + 1 || 50)
    || hash(state.seed, 'feat', day, a.id) - hash(state.seed, 'feat', day, b.id)); // a different face each day
  const out = [];
  for (const n of people) {
    if (out.length >= max) break;
    if (!out.some((o) => o.job === n.job)) out.push({ id: n.id, name: n.name, job: n.job, today: n.today });
  }
  return out;
}

/** Jobs the previous video showed at work (its first two featured villagers). */
export function shownJobs(prev) {
  return prev.featured ? prev.featured.slice(0, 2).map((f) => f.job) : legacyShown(prev);
}

// Saves from before 2026-10-20 have no `featured`: the videos then picked the villagers who asked for a job
// that day first, then the newest names, one per job, two when the tavern was shown (three otherwise),
// innkeepers and brewers going to the tavern.
const LEGACY_INTEREST = ['blacksmith', 'toolsmith', 'woodcutter', 'baker', 'stonemason', 'fisherman', 'carpenter', 'miller', 'guard', 'knight', 'farmer', 'peasant'];
function legacyShown(state) {
  const tavern = state.buildings.some((b) => b.id === 'tavern' && b.status === 'done');
  const named = Object.entries(state.names || {}).map(([id, n]) => ({ id: Number(id), ...n, job: state.villagers?.[Number(id)]?.job ?? n.job }))
    .filter((n) => n.id < state.subscriberCount)
    .sort((a, b) => (b.requestDay === state.day) - (a.requestDay === state.day) || (b.day ?? 0) - (a.day ?? 0)
      || (LEGACY_INTEREST.indexOf(a.job) + 1 || 99) - (LEGACY_INTEREST.indexOf(b.job) + 1 || 99) || a.id - b.id);
  const jobs = [];
  for (const n of named) if (!(tavern && (n.job === 'innkeeper' || n.job === 'brewer')) && !jobs.includes(n.job)) jobs.push(n.job);
  return jobs.slice(0, tavern ? 2 : 3);
}
