// Deterministic daily simulation step: (previous state, subscriber count, date) -> (new state, diff).
import { hash, rng } from './prng.js';
import { nameFor } from './names.js';
import { TIERS, BUILDINGS, JOBS, jobFor, houseCapacity, tiersReached } from './tiers.js';
import { world } from './world.js';
import { dailyEvents } from './events.js';

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
  };
}

export function villagerFor(seed, id, house) {
  return { id, name: nameFor(seed, id), job: jobFor(seed, id), house };
}

/** Rebuild the villager list from house occupancy (used for compact history snapshots). */
export function deriveVillagers(state) {
  const v = new Array(state.subscriberCount);
  for (const h of state.houses) for (const id of h.occupants) v[id] = villagerFor(state.seed, id, h.id);
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
 * Advance one day. Never mutates `prev`.
 * @param {object} prev  previous state
 * @param {{subscribers:number, date:string, source?:string}} input
 */
export function advance(prev, { subscribers, date, source = 'api' }) {
  const s = structuredClone(prev);
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
    housesAbandoned: [], housesRuined: [], unlocked: [], buildingsStarted: [], buildingsCompleted: [],
    events: [], weather: null,
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
    const v = villagerFor(seed, id, house.id);
    house.occupants.push(id);
    s.villagers.push(v);
    diff.added.push({ id, name: v.name, job: v.job, house: house.id });
  }
  s.subscriberCount = target;
  s.peakPopulation = Math.max(s.peakPopulation, target);

  // 3. Unlocks (tiers never re-lock; history is never deleted).
  for (const t of tiersReached(target)) {
    if (s.unlockedTiers.includes(t.id)) continue;
    s.unlockedTiers.push(t.id);
    diff.unlocked.push(t.id);
    for (const b of t.buildings) {
      const days = BUILDINGS[b].days;
      s.buildings.push({ id: b, tier: t.id, status: days > 0 ? 'construction' : 'done', startedDay: day, doneDay: days > 0 ? null : day, daysTotal: days });
      if (days > 0) { s.pendingConstruction.push({ building: b, daysLeft: days, daysTotal: days }); diff.buildingsStarted.push(b); }
      else diff.buildingsCompleted.push(b);
    }
  }

  // 4. Daily life: weather + at least one event, always.
  const { weather, events } = dailyEvents(s, diff);
  s.weather = weather;
  diff.weather = weather;
  diff.events = events;
  s.events = events;
  diff.population = target;
  diff.next = nextGoal(target, s.unlockedTiers);
  return { state: s, diff };
}

function findHome(s, w, id, day, diff, getScan, setScan, byId) {
  // a) a lived-in house with a free bed
  for (let i = getScan(); i < s.houses.length; i++) {
    const h = s.houses[i];
    if (h.status === 'occupied' && h.occupants.length < h.capacity) { setScan(i); return h; }
  }
  setScan(s.houses.length);
  // b) an abandoned house is re-occupied, c) then ruins are rebuilt, before any new plot.
  for (const status of ['abandoned', 'ruin']) {
    const h = s.houses.find((h) => h.status === status);
    if (h) {
      if (status === 'ruin') {
        h.capacity = Math.max(h.capacity, houseCapacity(id + 1));
        h.rebuiltDay = day;
        diff.housesRebuilt.push(h.id);
      } else diff.housesReoccupied.push(h.id);
      h.status = 'occupied';
      delete h.abandonedDay;
      delete h.ruinDay;
      setScan(Math.min(getScan(), s.houses.indexOf(h)));
      return h;
    }
  }
  // d) a new house on the next free plot
  const plot = w.plots[s.plots.length];
  if (!plot) {
    // Every plot is used: squeeze into the least crowded house (never crash the daily run).
    return s.houses.reduce((a, b) => (b.occupants.length / b.capacity < a.occupants.length / a.capacity ? b : a));
  }
  const { x, z, y, yMin, hw, hd, rot, facing, road } = plot;
  s.plots.push({ id: plot.id, x, z, y, yMin, hw, hd, rot, facing, road });
  const h = { id: s.houses.length, plot: plot.id, capacity: houseCapacity(id + 1), status: 'occupied', builtDay: day, occupants: [] };
  s.houses.push(h);
  byId.set(h.id, h);
  diff.housesBuilt.push(h.id);
  return h;
}

export function nextGoal(population, unlocked = []) {
  const t = TIERS.find((t) => population < t.at && !unlocked.includes(t.id));
  if (!t) return null;
  const goal = t.goal || `the ${JOBS[t.unique[0]].label} arrives`;
  return { tier: t.id, at: t.at, remaining: t.at - population, goal, title: t.title };
}

export { TIERS, BUILDINGS, JOBS };
