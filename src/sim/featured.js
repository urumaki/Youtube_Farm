// Which named villagers the video shows at work. Owner (2026-10-21): whoever commented that they could not
// find themselves in the last video comes first. Owner (2026-10-20): the villagers named today come
// next (the narrator welcomes them, so they must be on screen), then granted job requests, then the ones
// never shown yet and those not shown for the longest time (`state.lastShown`), so everybody gets a turn
// in the following videos. A job shown yesterday is not shown again today, one villager per job.
// To fit more people in 30 seconds, a shot can show two villagers together: one visits the other at work
// (the blacksmith hands a sword to the guard, the miller brings flour to the baker...).
import { hash } from './prng.js';
import { tavernScene, churchScene } from './tiers.js';

// Owner 2026-11-11: every 30th day (30, 60, 90...) the video is the time-lapse of the last 30 days (src/render/timelapse.js)
// in place of the daily one. The day is simulated and saved as always, but it shows no story, no villager at work and no
// building begun: they wait for the next day.
export const TIMELAPSE_EVERY = 30;
export const timelapseDay = (day) => day > 0 && day % TIMELAPSE_EVERY === 0;

// jobs with the most to see when two candidates are otherwise equal
const INTEREST = ['blacksmith', 'toolsmith', 'woodcutter', 'baker', 'stonemason', 'fisherman', 'carpenter', 'fletcher', 'miller', 'farmer', 'peasant', 'guard', 'knight'];
const FIGHTERS = ['guard', 'knight', 'warrior', 'cavalier'];

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
// owner 2026-11-13: most other jobs too, now that every job gets its turn (seen in test frames with a visitor, output/gallery/);
// not the hunter (out at a field's edge), the miner, the rat catcher, the beggar, the apprentice, the new jobs by request
export const VISIT_HOSTS = ['farmer', 'peasant', 'blacksmith', 'toolsmith', 'woodcutter', 'stonemason', 'carpenter', 'baker', 'miller', 'fletcher', 'innkeeper', 'brewer', 'crier', 'executioner',
  'merchant', 'taxcollector', 'physician', 'jester', 'scholar', 'priest', 'bishop', 'engineer', 'cook', 'butcher', 'beekeeper', 'tailor', 'shepherd', 'stablehand',
  'teacher', 'potter', 'philosopher', 'barber', 'tanner', 'cobbler', 'astronomer', 'adviser'];

// what a visitor gets from the host when they just drop by (null: they only chat)
const VISIT_ITEMS = { baker: 'loaf', innkeeper: 'tankard', brewer: 'tankard', fisherman: 'fish', farmer: 'sheaf', peasant: 'cabbage', miller: 'sack' };
export const visitItem = (hostJob) => VISIT_ITEMS[hostJob] || null;

// a PAIRS shot with `host` at work and `guest` visiting, or null
function hostPair(host, guest) {
  const p = PAIRS.find((q) => q.host.includes(host.job) && q.guest.includes(guest.job));
  return p ? { id: p.id, host, guest } : null;
}

/**
 * The shots of villagers at work, best first: [{ id, name, job, today, with, pair }]. `with` is the
 * visiting villager ({ id, name, job, today }) or null; `pair` the PAIRS id, 'visit' or null.
 * `slots`: how many shots (two when the tavern or the church closes the video, three otherwise). `tavern`: whether the
 * tavern closes the video today, `church` which church (src/sim/scenes.js). `stale(job)`: true when every scene of that job was
 * shown in the last days, so somebody else is shown if possible. `intro(job)`: true when a villager of that job introduced
 * today has an everyday scene of their own (src/sim/scenes.js INTRO): they get no visitor and visit nobody.
 * `lastJob(job)`: the last day a scene of that job was shown (undefined: never). `novel(job)`: 0, or 1 when the job has a
 * scene never shown yet, 2 when every such scene has no room for a visitor (src/sim/scenes.js novelJob).
 */
export function pickFeatured(state, { avoidJobs = [], slots, tavern = tavernScene(state), church = null, stale = () => false, intro = () => false, lastJob = () => undefined, novel = () => 0 } = {}) {
  const day = state.day;
  // the villagers named (or given a job) on a time-lapse day had no video: they count as today's on the day after
  const fresh = (d) => d === day || (d === day - 1 && timelapseDay(d));
  const avoid = new Set(avoidJobs);
  slots ??= tavern || church ? 2 : 3;
  // owner 2026-10-23: priests and bishops are shown in the church (church.js) on the days it closes the video; on the other
  // days they are out at work too (owner 2026-10-25: blessing the fields, preaching in the square, at a wayside cross)
  const clergy = !!church;
  const people = Object.entries(state.names || {})
    .map(([id, n]) => {
      const last = state.lastShown?.[id];
      const job = state.villagers?.[Number(id)]?.job ?? n.job;
      return { id: Number(id), name: n.name, job, scene: job === 'apprentice' && n.wants ? n.wants : job, today: fresh(n.day), last: last < day ? last : undefined, req: n.requestDay,
        // owner 2026-11-13: a granted request keeps its place until they are shown, for up to 5 days (a request granted the
        // day before a time-lapse, or on a day with more requests than shots, was otherwise never seen at work); the older first
        asked: fresh(n.requestDay) || (n.requestDay !== undefined && day - n.requestDay <= 5 && !(last >= n.requestDay && last < day)),
        // a complaint keeps its place until they are shown, for up to 3 days (owner 2026-10-29: when their job is already on
        // screen that day, they come first on the next)
        complained: n.complainDay !== undefined && day - n.complainDay <= 3 && !(last >= n.complainDay && last < day) };
    })
    // innkeepers and brewers serve in the tavern scene when it closes the video
    .filter((n) => n.id < state.subscriberCount && n.job && !(tavern && (n.job === 'innkeeper' || n.job === 'brewer')) && !(clergy && (n.job === 'priest' || n.job === 'bishop')));
  // someone who wrote they could not find themselves in the last video comes before everybody (owner 2026-10-21)
  const score = (n) => (n.complained ? 30 : 0) + (n.today ? 8 : 0) + (n.asked ? 3 + 0.2 * (day - (n.req ?? day)) : 0) + (n.last === undefined ? 4 : Math.min(3, (day - n.last) / 3))
    + (avoid.has(n.job) ? -6 : 0) + (n.last === day - 1 ? -10 : 0) + (stale(n.job) ? -4 : 0) + (novel(n.scene) ? 2 : 0);
  // owner 2026-11-13: most villagers were never shown (score 4 for all of them), and the tie went to INTEREST: the same
  // ten jobs every day. Now the tie goes to the job whose scenes were seen longest ago (never first), then to the rarer job
  // (the one Diplomat lost to one of 23 physicians on a coin toss, and his request ran out), then INTEREST
  const seenJob = (n) => lastJob(n.scene) ?? -1;
  const many = {};
  for (const n of people) many[n.scene] = (many[n.scene] || 0) + 1;
  people.sort((a, b) => score(b) - score(a)
    || seenJob(a) - seenJob(b)
    || many[a.scene] - many[b.scene]
    || (INTEREST.indexOf(a.job) + 1 || 50) - (INTEREST.indexOf(b.job) + 1 || 50)
    || hash(state.seed, 'feat', day, a.id) - hash(state.seed, 'feat', day, b.id)); // a different face each day
  const onScreen = {};
  for (const n of people) if (n.last !== undefined && !(onScreen[n.job] >= n.last)) onScreen[n.job] = n.last;
  const guests = [...people].sort((a, b) => (onScreen[a.job] ?? -1) - (onScreen[b.job] ?? -1));
  const out = [];
  const usedJobs = new Set(), usedIds = new Set();
  // owner 2026-10-29: never the same scene twice in a video: one shot per job, the complaints too
  const free = (n) => !usedIds.has(n.id) && !usedJobs.has(n.job);
  const entry = (n) => ({ id: n.id, name: n.name, job: n.job, today: n.today });
  // owner 2026-11-13: a villager whose new scenes all have no room for a visitor (the spy, the Diplomat...) is shown alone
  const solo = (n) => (n.today && intro(n.job)) || novel(n.scene) === 2;
  for (const n of people) {
    if (out.length >= slots) break;
    if (!free(n)) continue;
    usedIds.add(n.id); usedJobs.add(n.job);
    // a partner: the best free villager who works with them, or one never shown yet dropping by; a villager
    // introduced today in an everyday scene of the job (the changing of the guard...) is shown alone (`intro`)
    // owner 2026-11-13: the villager picked keeps their own scene: they are the host or alone, never a visitor in somebody
    // else's croft (the guard was a visitor 7 times in 16 days, never on the walls); nobody whose job has a scene never
    // shown with no room for a visitor (the Diplomat) or who asked for their job is taken as a visitor either
    let shot = null;
    // a visitor whose job's scenes were all seen first (a guard, a farmer), so the rarer jobs keep their own shot for the next days;
    // among them, the job away from the screen longest (or the woodcutter visited somebody every other day)
    for (const pass of [0, 1]) {
      for (const m of guests) {
        if (solo(n) || shot) break;
        if (!free(m) || m.job === n.job || solo(m) || novel(m.scene) > pass || m.asked) continue;
        shot = hostPair(n, m);
        if (!shot && m.last === undefined && score(m) > 0 && VISIT_HOSTS.includes(n.job)) shot = { id: 'visit', host: n, guest: m };
      }
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
