// Deterministic daily simulation step: (previous state, subscriber count, date) -> (new state, diff).
import { hash, rng } from './prng.js';
import { cleanName, isOffensive, looksLikeCode } from './names.js';
import { availableJobs } from './requests.js';
import { TIERS, BUILDINGS, JOBS, COMMISSIONS, jobFor, houseCapacity, tiersReached, mergedJob } from './tiers.js';
import { world } from './world.js';
import { dailyEvents } from './events.js';
import { pickStory } from './stories.js';
import { pickFeatured, shownJobs, markShown } from './featured.js';
import { planScenes, tavernToday, staleJob } from './scenes.js';
import { planWall2, wallBlockers, insideWall2, crossesFields } from './wall.js';
import { obbOverlap } from './geometry.js';

export const SCHEMA_VERSION = 1;
export const ABANDON_DAYS = 7;
export const DEFAULT_SEED = hash('Subscriber Kingdom');

export function genesis({ seed = DEFAULT_SEED, date = '1970-01-01' } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    day: 0,
    date,
    subscriberCount: 0,
    peakPopulation: 0,
    countSource: 'genesis',
    villagers: [],
    houses: [],
    plots: [],
    buildings: [],
    unlockedTiers: [],
    pendingConstruction: [],
    weather: 'clear',
    events: [],
    names: {},        // villager id -> { name, author }: given by commenters, see assignNames()
    nameQueue: [],    // commenters waiting for an unnamed villager
    namedAuthors: [], // every commenter who ever received a name (one villager per person)
    commentsSeen: null, // publishedAt of the newest comment already processed
    storyLog: {},     // story event id -> last day it happened (cooldowns)
    story: null,      // today's story event
    storyArc: null,   // a story to continue on a later day: { id, day, step?, data? }
    sceneLog: {},     // scene key -> last day shown (src/sim/scenes.js)
    wall2: null,      // the Second Wall's route, planned when it begins (src/sim/wall.js)
  };
}

/** Older saves have no name fields. */
export function withNameFields(s) {
  s.names ??= {};
  s.nameQueue ??= [];
  s.namedAuthors ??= [];
  if (!('commentsSeen' in s)) s.commentsSeen = null;
  for (const n of [...Object.values(s.names), ...s.nameQueue]) n.name = cleanName(n.name) || n.name; // re-clean old saves
  if (Array.isArray(s.villagers)) for (const v of s.villagers) if (v && s.names[v.id]) v.name = s.names[v.id].name;
  return s;
}

/** A villager is nameless (null) until a commenter's name is assigned to them. */
export function villagerFor(seed, id, house, names = {}) {
  return { id, name: names[id]?.name ?? null, job: mergedJob(names[id]?.job ?? jobFor(seed, id)), house };
}

/** Rebuild the villager list from house occupancy (used for compact history snapshots). */
export function deriveVillagers(state) {
  const v = new Array(state.subscriberCount);
  for (const h of state.houses) for (const id of h.occupants) v[id] = villagerFor(state.seed, id, h.id, state.names);
  return v;
}

export function houseStyle(seed, plotId) {
  const h = hash(seed, 'house', plotId);
  return {
    roof: h % 6,              // palette index
    wall: (h >>> 3) % 5,
    chimney: ((h >>> 6) & 3) !== 0,
    garden: ((h >>> 8) & 3) === 0,
    fence: ((h >>> 10) & 1) === 1,
    timber: ((h >>> 11) % 3) !== 0,
    scale: 0.86 + ((h >>> 13) % 15) / 100,
  };
}

/**
 * How many storeys a house has: what it was built with (by its size, as it always looked), or more once
 * floors were added (`floors`, raiseHouse).
 */
export function houseFloors(seed, house) {
  if (house.floors) return house.floors;
  const cap = house.cap0 ?? house.capacity, h = hash(seed, 'arch', house.plot);
  return cap >= 8 ? 3 : cap >= 4 ? 2 : cap === 2 ? (h % 3 === 0 ? 1 : 2) : (h >>> 4) % 3 === 0 ? 2 : 1;
}

/**
 * Advance one day. Never mutates `prev`.
 * @param {object} prev  previous state
 * @param {{subscribers:number, date:string, source?:string}} input
 */
export function advance(prev, { subscribers, date, source = 'api', commenters = [], blocked = {} }) {
  const s = withNameFields(structuredClone(prev));
  const seed = s.seed;
  const w = world(seed);
  const target = Math.max(0, Math.floor(subscribers));
  s.day += 1;
  s.date = date;
  s.countSource = source;
  const day = s.day;
  const diff = {
    date, day, from: prev.subscriberCount, to: target, delta: target - prev.subscriberCount,
    added: [], removed: [], housesBuilt: [], housesRebuilt: [], housesReoccupied: [],
    housesAbandoned: [], housesRuined: [], housesMoved: [], housesRaised: [], unlocked: [], buildingsStarted: [], buildingsCompleted: [],
    events: [], weather: null, named: [],
  };

  // 1. Time passes: abandoned houses decay, construction progresses.
  for (const h of s.houses) {
    if (h.status === 'abandoned' && day - h.abandonedDay >= ABANDON_DAYS) {
      h.status = 'ruin';
      h.ruinDay = day;
      diff.housesRuined.push(h.id);
    }
  }
  for (const p of s.pendingConstruction) p.daysLeft -= 1;
  for (const p of s.pendingConstruction.filter((p) => p.daysLeft <= 0)) {
    const b = s.buildings.find((b) => b.id === p.building);
    b.status = 'done';
    b.doneDay = day;
    diff.buildingsCompleted.push(b.id);
  }
  s.pendingConstruction = s.pendingConstruction.filter((p) => p.daysLeft > 0);

  // 2. Population change. Villager ids are always 0..count-1: leavers are the most recent.
  const byId = new Map(s.houses.map((h) => [h.id, h]));
  while (s.villagers.length > target) {
    const v = s.villagers.pop();
    const h = byId.get(v.house);
    h.occupants = h.occupants.filter((id) => id !== v.id);
    diff.removed.push({ id: v.id, name: v.name, job: v.job, house: h.id });
    // the commenter keeps their right to a villager: back to the front of the queue
    if (s.names[v.id]) { s.nameQueue.unshift(s.names[v.id]); delete s.names[v.id]; }
    if (h.occupants.length === 0) {
      h.status = 'abandoned';
      h.abandonedDay = day;
      diff.housesAbandoned.push(h.id);
    }
  }
  let scan = 0;
  while (s.villagers.length < target) {
    const id = s.villagers.length;
    const house = findHome(s, w, id, day, diff, () => scan, (v) => { scan = v; }, byId);
    const v = villagerFor(seed, id, house.id, s.names);
    house.occupants.push(id);
    s.villagers.push(v);
    diff.added.push({ id, name: v.name, job: v.job, house: house.id });
  }
  s.subscriberCount = target;
  s.peakPopulation = Math.max(s.peakPopulation, target);
  assignNames(s, commenters, blocked, diff);

  // 3. Unlocks (tiers never re-lock; history is never deleted).
  const begin = (b, tier) => {
    const days = BUILDINGS[b].days;
    s.buildings.push({ id: b, tier, status: days > 0 ? 'construction' : 'done', startedDay: day, doneDay: days > 0 ? null : day, daysTotal: days });
    if (days > 0) { s.pendingConstruction.push({ building: b, daysLeft: days, daysTotal: days }); diff.buildingsStarted.push(b); }
    else diff.buildingsCompleted.push(b);
  };
  for (const t of tiersReached(target)) {
    if (s.unlockedTiers.includes(t.id)) continue;
    s.unlockedTiers.push(t.id);
    diff.unlocked.push(t.id);
    for (const b of t.buildings) begin(b, t.id);
  }
  // buildings the owner commissions with no goal (COMMISSIONS in tiers.js)
  for (const b of COMMISSIONS) if (!s.buildings.some((x) => x.id === b)) begin(b, 'commission');

  // The Second Wall's route is planned round the houses standing when it begins (src/sim/wall.js)
  ensureWall2(s, w, diff);

  // 4. Daily life: weather + at least one event, always.
  const { weather, events } = dailyEvents(s, diff);
  s.weather = weather;
  diff.weather = weather;
  diff.events = events;
  s.events = events;
  // 5-6. The day's story, the villagers shown at work and the scenes
  planDay(s, prev, diff);
  diff.population = target;
  diff.next = nextGoal(target, s.unlockedTiers);
  return { state: s, diff };
}

/**
 * The parts of the video the simulation picks (and remembers for the next days): at most one story event
 * with its own scene, the named villagers shown at work (not yesterday's jobs again;
 * those never shown first) and the scenes (none shown again within three days). Also used to plan a saved
 * day again (scripts/replan-day.js): `s` must then hold yesterday's storyLog, storyArc, lastShown and sceneLog.
 */
export function planDay(s, prev, diff) {
  diff.story = pickStory(s);
  s.story = diff.story;
  if (diff.story?.id === 'storm') { // the storm brings the rain to the whole video
    s.weather = diff.weather = 'rain';
    diff.events[0].weather = 'rain';
  }
  diff.avoidJobs = prev.day > 0 ? shownJobs(prev) : [];
  const tavern = tavernToday(s);
  diff.featured = pickFeatured(s, { avoidJobs: diff.avoidJobs, tavern, stale: (job) => staleJob(s, job) });
  s.featured = diff.featured;
  markShown(s, diff.featured);
  const shownBuildings = new Set([...diff.buildingsStarted, ...diff.buildingsCompleted]).size;
  diff.scenes = planScenes(s, { featured: diff.featured, tavern, avoidJobs: diff.avoidJobs, buildingShots: Math.min(2, shownBuildings) });
  s.scenes = diff.scenes;
}

/**
 * Commenters name villagers: each new commenter (oldest comment first, one villager per person)
 * joins the queue; queued names go to the unnamed villagers with the lowest ids.
 * commenters: [{ author, name, at, wants?, call? }] (call: a name asked for in the comment); blocked: { authors?: [], names?: [] }.
 */
function assignNames(s, commenters, blocked, diff) {
  const blockedAuthors = new Set(blocked.authors || []);
  const blockedNames = new Set((blocked.names || []).map((n) => String(n).toLowerCase().replace(/^@/, '')));
  const known = new Set(s.namedAuthors);
  diff.requests = [];
  diff.promoted = [];
  diff.renamed = [];
  diff.complaints = [];
  diff.newCommenters = 0; // people commenting for the first time (no story on busy days, stories.js)
  // names are untrusted: cleaned to letters, digits and . _ -, never one that reads like code or an instruction
  const valid = (raw) => { const n = cleanName(raw); return n && !isOffensive(n) && !looksLikeCode(raw) && !looksLikeCode(n) && !blockedNames.has(n.toLowerCase()) ? n : null; };
  const avail = availableJobs(s.subscriberCount);
  const villagerOf = (author) => Object.keys(s.names).find((id) => s.names[id].author === author);
  // a request sets the job if the kingdom has it, otherwise the villager is an apprentice until it does
  const applyRequest = (id, wants) => {
    const n = s.names[id];
    const pick = wants.find((j) => avail.has(j));
    n.job = pick || 'apprentice';
    if (pick) delete n.wants; else n.wants = wants[0];
    n.requestDay = s.day;
    if (s.villagers[id]) s.villagers[id].job = n.job;
    diff.requests.push({ id: Number(id), name: n.name, job: n.job, wanted: wants[0], granted: !!pick });
  };
  for (const c of [...commenters].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    if (c.at && (!s.commentsSeen || c.at > s.commentsSeen)) s.commentsSeen = c.at;
    if (!c.author || blockedAuthors.has(c.author)) continue;
    const wants = (Array.isArray(c.wants) ? c.wants : []).filter((j) => typeof j === 'string' && Object.hasOwn(JOBS, j));
    const call = c.call ? valid(c.call) : null; // "call me Violet"
    if (known.has(c.author)) {
      // someone who already has a villager asks for a (new) job or a new name
      const id = villagerOf(c.author);
      const q = id === undefined ? s.nameQueue.find((n) => n.author === c.author) : null;
      if (call && id !== undefined && s.names[id].name !== call) {
        diff.renamed.push({ id: Number(id), from: s.names[id].name, name: call });
        s.names[id].name = call;
        if (s.villagers[id]) s.villagers[id].name = call;
      } else if (call && q) q.name = call;
      // "I can't see myself": first in line for the next video (featured.js)
      if (c.complains && id !== undefined) { s.names[id].complainDay = s.day; diff.complaints.push({ id: Number(id), name: s.names[id].name }); }
      if (id !== undefined && wants.length) applyRequest(id, wants);
      else if (wants.length && q) q.wants = wants;
      continue;
    }
    const name = call || valid(c.name);
    if (!name) continue;
    known.add(c.author);
    s.namedAuthors.push(c.author);
    diff.newCommenters += 1;
    s.nameQueue.push({ name, author: c.author, ...(wants.length ? { wants } : {}) });
  }
  // names blocked after they were given are taken back
  for (const [id, n] of Object.entries(s.names)) {
    if (blockedAuthors.has(n.author) || blockedNames.has(n.name.toLowerCase())) {
      delete s.names[id];
      if (s.villagers[id]) { s.villagers[id].name = null; s.villagers[id].job = jobFor(s.seed, Number(id)); }
    }
  }
  s.nameQueue = s.nameQueue.filter((n) => !blockedAuthors.has(n.author) && !blockedNames.has(n.name.toLowerCase()));
  for (const v of s.villagers) {
    if (!s.nameQueue.length) break;
    if (s.names[v.id]) continue;
    const { wants, ...n } = s.nameQueue.shift();
    s.names[v.id] = { ...n, day: s.day };
    if (n.job) v.job = n.job; // a named villager who left and came back keeps the job they chose
    if (typeof wants === 'string') s.names[v.id].wants = wants; // still an apprentice
    else if (wants?.length) applyRequest(v.id, wants);
    v.name = n.name;
    diff.named.push({ id: v.id, name: n.name, job: v.job, house: v.house });
    const added = diff.added.find((a) => a.id === v.id);
    if (added) { added.name = n.name; added.job = v.job; }
  }
  // apprentices whose job has just been unlocked are promoted
  for (const [id, n] of Object.entries(s.names)) {
    if (n.job !== 'apprentice' || !n.wants || !avail.has(n.wants)) continue;
    n.job = n.wants;
    delete n.wants;
    if (s.villagers[id]) s.villagers[id].job = n.job;
    diff.promoted.push({ id: Number(id), name: n.name, job: n.job });
  }
}

// The Noble Quarter (owner 2026-10-22): once the University is begun, these newcomers live in the finer
// houses on the wide plots below the castle (world.js finePlots), and nobody else does.
const FINE_JOBS = new Set(['merchant', 'knight', 'scholar', 'physician', 'mayor', 'reeve', 'bishop', 'taxcollector', 'chronicler', 'admiral']);
const FINE_CAPACITY = 8; // three storeys

function findHome(s, w, id, day, diff, getScan, setScan, byId) {
  const reopen = (h) => {
    if (h.status === 'ruin') {
      h.capacity = Math.max(h.capacity, h.fine ? FINE_CAPACITY : houseCapacity(id + 1));
      h.rebuiltDay = day;
      diff.housesRebuilt.push(h.id);
    } else diff.housesReoccupied.push(h.id);
    h.status = 'occupied';
    delete h.abandonedDay;
    delete h.ruinDay;
    return h;
  };
  const newHouse = (plot, capacity) => {
    const { x, z, y, yMin, hw, hd, rot, facing, road, fine } = plot;
    s.plots.push({ id: plot.id, x, z, y, yMin, hw, hd, rot, facing, road, ...(fine ? { fine } : {}) });
    const h = { id: s.houses.length, plot: plot.id, capacity, status: 'occupied', builtDay: day, occupants: [], ...(fine ? { fine } : {}) };
    s.houses.push(h);
    byId.set(h.id, h);
    diff.housesBuilt.push(h.id);
    return h;
  };
  if (FINE_JOBS.has(mergedJob(s.names[id]?.job ?? jobFor(s.seed, id))) && s.buildings.some((b) => b.id === 'university')) {
    const h = s.houses.find((h) => h.fine && h.status === 'occupied' && h.occupants.length < h.capacity)
      || s.houses.find((h) => h.fine && h.status !== 'occupied');
    if (h) return h.status === 'occupied' ? h : reopen(h);
    const plot = nextFinePlot(s, w);
    if (plot) return newHouse(plot, FINE_CAPACITY);
  }
  // a) a lived-in house with a free bed
  for (let i = getScan(); i < s.houses.length; i++) {
    const h = s.houses[i];
    if (h.status === 'occupied' && h.occupants.length < h.capacity && !h.fine) { setScan(i); return h; }
  }
  setScan(s.houses.length);
  // b) an abandoned house is re-occupied, c) then ruins are rebuilt, before any new plot.
  for (const status of ['abandoned', 'ruin']) {
    const h = s.houses.find((h) => h.status === status && !h.fine);
    if (h) {
      setScan(Math.min(getScan(), s.houses.indexOf(h)));
      return reopen(h);
    }
  }
  // d) once the Second Wall is begun, a house inside it gets another storey before any new plot is used
  // (owner 2026-10-22: the town grows upward inside the walls before it spreads beyond them)
  const up = raiseHouse(s, day, diff);
  if (up) { setScan(Math.min(getScan(), s.houses.indexOf(up))); return up; }
  // e) a new house on the next free plot
  const plot = nextFreePlot(s, w);
  if (!plot) {
    // Every plot is used: squeeze into the least crowded house (never crash the daily run).
    return s.houses.reduce((a, b) => (b.occupants.length / b.capacity < a.occupants.length / a.capacity ? b : a));
  }
  return newHouse(plot, houseCapacity(id + 1));
}

/** The next wide plot of the Noble Quarter (s.nextFine), or null once all are used. */
function nextFinePlot(s, w) {
  const i = s.nextFine ?? 0;
  if (!w.finePlots[i]) return null;
  s.nextFine = i + 1;
  return w.finePlots[i];
}

const MAX_FLOORS = 3;
const FLOOR_ROOM = 2; // villagers a new storey makes room for
const INSIDE = new WeakMap(); // per wall route: plot id -> inside the walls

/** The lowest house inside the Second Wall gets one more storey (diff.housesRaised); null when none can. */
function raiseHouse(s, day, diff) {
  if (!s.wall2) return null;
  if (!INSIDE.has(s.wall2)) INSIDE.set(s.wall2, new Map());
  const inside = INSIDE.get(s.wall2);
  const plots = new Map(s.plots.map((p) => [p.id, p]));
  let best = null, bestF = MAX_FLOORS;
  for (const h of s.houses) {
    if (h.status !== 'occupied') continue;
    const f = houseFloors(s.seed, h);
    if (f >= bestF) continue;
    const p = plots.get(h.plot);
    if (!p) continue;
    if (!inside.has(p.id)) inside.set(p.id, insideWall2(s.wall2.pts, p.x, p.z, undefined, world(s.seed)));
    if (!inside.get(p.id)) continue;
    best = h; bestF = f;
  }
  if (!best) return null;
  best.cap0 ??= best.capacity;
  best.floors = bestF + 1;
  best.capacity += FLOOR_ROOM;
  best.raisedDay = day;
  if (!diff.housesRaised.includes(best.id)) diff.housesRaised.push(best.id);
  return best;
}

/**
 * The next plot for a new house in the order the town grows, never one on the Second Wall's route.
 * `s.nextPlot` is where to look next (plots before it are used or lie on the wall).
 */
function nextFreePlot(s, w) {
  let i = s.nextPlot ?? s.plots.length;
  const wall = s.wall2 ? blockersOf(w, s.wall2) : [];
  while (w.plots[i] && wall.some((b) => obbOverlap(b, w.plots[i]))) i++;
  s.nextPlot = i + 1;
  const p = w.plots[i];
  if (!p) return null;
  const { id, x, z, y, yMin, hw, hd, rot, facing, road } = p;
  return { id, x, z, y, yMin, hw, hd, rot, facing, road };
}

const BLOCKERS = new WeakMap();
function blockersOf(w, wall2) {
  if (!BLOCKERS.has(wall2)) BLOCKERS.set(wall2, wallBlockers(w, wall2.pts));
  return BLOCKERS.get(wall2);
}

/**
 * Once the Second Wall is begun: plan its route round today's houses, and move any house still in its way
 * to the next free plot (diff.housesMoved). Also used for saves from before the route was planned, and
 * every day after, so a house the wall's towers or gates come to stand on (a change to wallLayout) moves too.
 */
export function ensureWall2(s, w = world(s.seed), diff = null) {
  if (!s.buildings.some((b) => b.id === 'wall2')) return;
  s.wall2 ??= planWall2(w, s);
  // routes planned before the wall kept off the fields (owner 2026-10-22) are planned again, once
  if (crossesFields(w, s.wall2.pts)) s.wall2 = planWall2(w, s);
  const wall = blockersOf(w, s.wall2);
  for (const [k, p] of s.plots.entries()) {
    if (!wall.some((b) => obbOverlap(b, p))) continue;
    const to = nextFreePlot(s, w);
    if (!to) break;
    s.plots[k] = to;
    for (const h of s.houses) if (h.plot === p.id) { h.plot = to.id; diff?.housesMoved?.push({ house: h.id, from: p.id, to: to.id }); }
  }
}

export function nextGoal(population, unlocked = []) {
  const t = TIERS.find((t) => population < t.at && !unlocked.includes(t.id));
  if (!t) return null;
  const goal = t.goal || `the ${JOBS[t.unique[0]].label} arrives`;
  return { tier: t.id, at: t.at, remaining: t.at - population, goal, title: t.title };
}

export { TIERS, BUILDINGS, JOBS };
