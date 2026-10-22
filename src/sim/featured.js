// Which named villagers the video shows at work. Owner (2026-10-21): whoever commented that they could not
// find themselves in the last video comes first. Owner (2026-10-20): the villagers named today come
// next (the narrator welcomes them, so they must be on screen), then granted job requests, then the ones
// never shown yet and those not shown for the longest time (`state.lastShown`), so everybody gets a turn
// in the following videos. A job shown yesterday is not shown again today, one villager per job.
// To fit more people in 30 seconds, a shot can show two villagers together: one visits the other at work
// (the blacksmith hands a sword to the guard, the miller brings flour to the baker...).
import { hash } from './prng.js';
import { tavernScene } from './tiers.js';

// jobs with the most to see when two candidates are otherwise equal
const INTEREST = ['blacksmith', 'toolsmith', 'woodcutter', 'baker', 'stonemason', 'fisherman', 'carpenter', 'fletcher', 'miller', 'farmer', 'peasant', 'guard', 'knight'];
const FIGHTERS = ['guard', 'knight', 'warrior'];

// Two villagers in one shot: the guest walks into the host's croft. First match wins.
export const PAIRS = [
  { id: 'sword', host: ['blacksmith', 'toolsmith'], guest: FIGHTERS }, // a new sword for the guard
  { id: 'arrows', host: ['fletcher'], guest: FIGHTERS }, // the guard collects a bow
  { id: 'tools', host: ['blacksmith', 'toolsmith'], guest: ['farmer', 'peasant', 'woodcutter', 'stonemason', 'carpenter', 'fisherman'] }, // a mended tool
  { id: 'flour', host: ['baker'], guest: ['miller'] }, // the miller brings a sack of flour
  { id: 'grain', host: ['miller'], guest: ['farmer', 'peasant'] }, // the farmer brings a sheaf of wheat
  { id: 'fish', host: ['innkeeper', 'brewer', 'baker'], guest: ['fisherman'] }, // the catch of the day
  { id: 'logs', host: ['carpenter', 'baker', 'blacksmith', 'toolsmith'], guest: ['woodcutter'] }, // firewood and timber
];
// any villager may drop by these workers (to buy bread, a drink... or just to chat); not the fisherman, who
// works out on the river (owner 2026-10-22)
export const VISIT_HOSTS = ['farmer', 'peasant', 'blacksmith', 'toolsmith', 'woodcutter', 'stonemason', 'carpenter', 'baker', 'miller', 'fletcher', 'innkeeper', 'brewer', 'crier', 'executioner'];

// what a visitor gets from the host when they just drop by (null: they only chat)
const VISIT_ITEMS = { baker: 'loaf', innkeeper: 'tankard', brewer: 'tankard', fisherman: 'fish', farmer: 'sheaf', peasant: 'cabbage', miller: 'sack' };
export const visitItem = (hostJob) => VISIT_ITEMS[hostJob] || null;

function pairOf(a, b) {
  for (const p of PAIRS) {
    if (p.host.includes(a.job) && p.guest.includes(b.job)) return { id: p.id, host: a, guest: b };
    if (p.host.includes(b.job) && p.guest.includes(a.job)) return { id: p.id, host: b, guest: a };
  }
  return null;
}

/**
 * The shots of villagers at work, best first: [{ id, name, job, today, with, pair }]. `with` is the
 * visiting villager ({ id, name, job, today }) or null; `pair` the PAIRS id, 'visit' or null.
 * `slots`: how many shots (two when the tavern closes the video, three otherwise). `tavern`: whether the
 * tavern closes the video today (src/sim/scenes.js). `stale(job)`: true when every scene of that job was
 * shown in the last days, so somebody else is shown if possible.
 */
export function pickFeatured(state, { avoidJobs = [], slots, tavern = tavernScene(state), stale = () => false } = {}) {
  const day = state.day;
  const avoid = new Set(avoidJobs);
  slots ??= tavern ? 2 : 3;
  const people = Object.entries(state.names || {})
    .map(([id, n]) => {
      const last = state.lastShown?.[id];
      return { id: Number(id), name: n.name, job: state.villagers?.[Number(id)]?.job ?? n.job, today: n.day === day, asked: n.requestDay === day, complained: n.complainDay === day, last: last < day ? last : undefined };
    })
    // innkeepers and brewers serve in the tavern scene when it closes the video
    .filter((n) => n.id < state.subscriberCount && n.job && !(tavern && (n.job === 'innkeeper' || n.job === 'brewer')));
  // someone who wrote they could not find themselves in the last video comes before everybody (owner 2026-10-21)
  const score = (n) => (n.complained ? 30 : 0) + (n.today ? 8 : 0) + (n.asked ? 3 : 0) + (n.last === undefined ? 4 : Math.min(3, (day - n.last) / 3))
    + (avoid.has(n.job) ? -6 : 0) + (n.last === day - 1 ? -10 : 0) + (stale(n.job) ? -4 : 0);
  people.sort((a, b) => score(b) - score(a)
    || (INTEREST.indexOf(a.job) + 1 || 50) - (INTEREST.indexOf(b.job) + 1 || 50)
    || hash(state.seed, 'feat', day, a.id) - hash(state.seed, 'feat', day, b.id)); // a different face each day
  const out = [];
  const usedJobs = new Set(), usedIds = new Set();
  const free = (n) => !usedIds.has(n.id) && (!usedJobs.has(n.job) || n.complained);
  const entry = (n) => ({ id: n.id, name: n.name, job: n.job, today: n.today });
  for (const n of people) {
    if (out.length >= slots) break;
    if (!free(n)) continue;
    usedIds.add(n.id); usedJobs.add(n.job);
    // a partner: the best free villager who works with them, or one never shown yet dropping by
    let shot = null;
    for (const m of people) {
      if (!free(m) || m.job === n.job) continue;
      shot = pairOf(n, m);
      if (!shot && m.last === undefined && score(m) > 0) {
        if (VISIT_HOSTS.includes(n.job)) shot = { id: 'visit', host: n, guest: m };
        else if (VISIT_HOSTS.includes(m.job)) shot = { id: 'visit', host: m, guest: n };
      }
      if (shot) break;
    }
    if (shot) {
      const other = shot.host === n ? shot.guest : shot.host;
      usedIds.add(other.id); usedJobs.add(other.job);
      out.push({ ...entry(shot.host), with: entry(shot.guest), pair: shot.id });
    } else out.push({ ...entry(n), with: null, pair: null });
  }
  return out;
}

/** Everyone the shots show (hosts and guests). */
export const featuredPeople = (featured = []) => featured.flatMap((f) => (f.with ? [f, f.with] : [f]));

/** Remember who was shown today, for the turns of the next days. */
export function markShown(state, featured) {
  state.lastShown = { ...(state.lastShown || {}) };
  for (const p of featuredPeople(featured)) state.lastShown[p.id] = state.day;
}

/** Jobs the previous video showed at work. */
export function shownJobs(prev) {
  if (!prev.featured) return legacyShown(prev);
  // lists saved before the pairs (2026-10-20) held more villagers than the video showed
  if (prev.featured.length && !('with' in prev.featured[0])) return prev.featured.slice(0, 2).map((f) => f.job);
  return featuredPeople(prev.featured).map((f) => f.job);
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
