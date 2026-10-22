// Story events: at most one visible scene a day (bandits at the gate, a quarrel in the square, a
// merchant caravan, Halloween...). Deterministic: depends on the seed, the date and the state.
// Tone (owner's rule): named villagers are heroes or comic characters, never villains or victims, and
// nobody gets hurt. Calendar events always happen on their date; otherwise a story happens on about
// half the days, each kind with its own cooldown so the same scene does not repeat too often.
// Owner (2026-10-21): a story can go on for a few days, one step a day: the merchants arrive, dance round
// the fire at night, then leave (`steps`). (The rule of no story on days with 15 or more new commenters was
// dropped by the owner on 2026-10-22.)
import { rng } from './prng.js';

export const PLACES = ['Ashford', 'the Northern Marches', 'Kingsbridge', 'the Salt Coast', 'Ravenscar', 'the Amber Vale', 'Dunmoor', 'the Eastern Isles'];
export const GOODS = ['spices', 'wool', 'salt', 'silk', 'amber', 'wine', 'iron tools', 'honey', 'dyed cloth'];
// Italian wording shared by the narration and the on-screen tags
export const FROM_IT = {
  'Ashford': 'da Ashford', 'the Northern Marches': 'dalle Marche del Nord', 'Kingsbridge': 'da Kingsbridge', 'the Salt Coast': 'dalla Costa del Sale',
  'Ravenscar': 'da Ravenscar', 'the Amber Vale': "dalla Valle d'Ambra", 'Dunmoor': 'da Dunmoor', 'the Eastern Isles': "dalle Isole d'Oriente",
};
export const GOODS_IT = { spices: 'spezie', wool: 'lana', salt: 'sale', silk: 'seta', amber: 'ambra', wine: 'vino', 'iron tools': 'attrezzi di ferro', honey: 'miele', 'dyed cloth': 'stoffe colorate' };
const HEROES = ['knight', 'warrior', 'guard', 'fletcher'];
const BUILDERS = ['carpenter', 'stonemason'];
const COSTUMES = ['ghost', 'scarecrow', 'pumpkin']; // folk costumes only, nothing magic (owner)

/**
 * Catalog. date: 'MM-DD' calendar event; minPop: population needed; cooldown: days before it can come
 * back; weight: how likely among the stories possible today; needs(state): extra condition; steps: the
 * story goes on over several days, one step each (story.step).
 */
export const STORIES = {
  halloween: { date: '10-31', minPop: 1 },
  newyear: { date: '12-31', minPop: 1 }, // the countdown round the bonfire
  bandits: { minPop: 25, cooldown: 10, weight: 2 }, // the guard tier: someone to chase them off
  // in the square; the next quiet day they make up and share it
  quarrel: { minPop: 50, cooldown: 6, weight: 3, needs: (s) => built(s, 'market'), steps: ['quarrel', 'peace'] },
  // they arrive, dance with the villagers round a fire at night, then leave
  merchants: { minPop: 50, cooldown: 8, weight: 3, needs: (s) => built(s, 'market'), steps: ['arrive', 'camp', 'leave'] },
  // a fire in a house (nobody hurt: the neighbours put it out with buckets), rebuilt the next day
  fire: { minPop: 25, cooldown: 20, weight: 1, needs: (s) => !['rain', 'snow'].includes(s.weather), next: (story, state) => ({ id: 'rebuild', day: state.day + 1, house: story.house }) },
  rebuild: { arc: true }, // only as the day after a fire
  wolves: { minPop: 10, cooldown: 12, weight: 2 },
  // only on grey days; the day turns to rain (src/sim/simulate.js)
  storm: { minPop: 1, cooldown: 14, weight: 2, needs: (s) => ['rain', 'cloudy'].includes(s.weather) },
  // the King (the channel's owner) rides through town in his carriage; named villagers cheer in the front row
  // he rides in, holds a feast in the square, then rides out again
  royal: { minPop: 30, cooldown: 12, weight: 2, needs: (s) => !['rain', 'snow', 'storm'].includes(s.weather), steps: ['arrive', 'feast', 'leave'] },
  pig: { minPop: 20, cooldown: 8, weight: 2 }, // a pig loose in the square, the farmer gives chase
  // sandbags on the bank; the next quiet day the water goes down and the wall has held
  flood: { minPop: 30, cooldown: 25, weight: 2, needs: (s) => s.weather === 'rain', steps: ['rise', 'recede'] },
  // the heats, then the final with the winner's rosette
  archery: { minPop: 40, cooldown: 12, weight: 2, needs: (s) => !['rain', 'snow'].includes(s.weather), steps: ['heats', 'final'] },
};
const STORY_CHANCE = 0.5;

function built(state, id) {
  return state.buildings.some((b) => b.id === id && b.status === 'done');
}

/** Named villagers living in the kingdom today, newest first. */
function namedVillagers(state) {
  return Object.entries(state.names || {})
    .map(([id, n]) => ({ id: Number(id), name: n.name, job: state.villagers[Number(id)]?.job ?? n.job, day: n.day ?? 0 }))
    .filter((n) => n.id < state.villagers.length)
    .sort((a, b) => b.day - a.day || a.id - b.id);
}

/** A villager for the cast: a named one when possible (commenters like to see themselves). */
function castMember(state, r, pool, exclude = []) {
  const free = pool.filter((n) => !exclude.some((e) => e.id === n.id));
  if (free.length) return r.pick(free.slice(0, 12));
  const ids = state.villagers.map((v) => v.id).filter((id) => !exclude.some((e) => e.id === id));
  if (!ids.length) return null;
  const v = state.villagers[r.pick(ids)];
  return { id: v.id, name: v.name ?? null, job: v.job };
}

const BUILD = {
  halloween(state, r) {
    const named = namedVillagers(state).slice(0, 8);
    return { cast: named.map((n, i) => ({ ...n, costume: COSTUMES[(i + r.int(0, 2)) % COSTUMES.length] })) };
  },
  bandits(state, r) {
    const named = namedVillagers(state);
    const heroes = named.filter((n) => HEROES.includes(n.job)).slice(0, 2);
    if (!heroes.length && named.length) heroes.push(r.pick(named.slice(0, 12))); // a brave villager steps in
    return { cast: heroes, bandits: r.int(5, 7), guards: r.int(2, 3) };
  },
  quarrel(state, r, arc) {
    if (arc?.data) return { cast: arc.data.cast, over: arc.data.over }; // the same two make up
    const named = namedVillagers(state);
    const a = castMember(state, r, named);
    const b = a && castMember(state, r, named, [a]);
    if (!a || !b) return null;
    return { cast: [a, b], over: r.pick(['chicken', 'goat', 'cabbage']) };
  },
  merchants(state, r, arc) {
    // at the camp fire the newest named villagers dance with the merchants; they wave goodbye when they leave
    if (arc?.data) return { ...arc.data, cast: namedVillagers(state).slice(0, arc.step === 'camp' ? 6 : 4) };
    return { cast: [], from: r.pick(PLACES), goods: r.pick(GOODS), wagons: r.int(2, 3) };
  },
  fire(state, r) {
    // a house without named villagers burns (they are never victims); named villagers lead the buckets
    const named = namedVillagers(state);
    const namedIds = new Set(named.map((n) => n.id));
    const houses = state.houses.filter((h) => h.status === 'occupied' && h.occupants.length && !h.occupants.some((id) => namedIds.has(id)));
    if (!houses.length) return null;
    const heroes = named.length ? [r.pick(named.slice(0, 12))] : [];
    const other = named.filter((n) => !heroes.includes(n));
    if (other.length) heroes.push(r.pick(other.slice(0, 12)));
    return { cast: heroes, house: r.pick(houses.slice(0, 200)).id };
  },
  rebuild(state, r, arc) {
    const house = arc?.house ?? BUILD.fire(state, r)?.house;
    if (house === undefined) return null;
    const named = namedVillagers(state);
    const crew = named.filter((n) => BUILDERS.includes(n.job)).slice(0, 2);
    if (!crew.length && named.length) crew.push(r.pick(named.slice(0, 12)));
    return { cast: crew, house };
  },
  wolves(state, r) {
    const named = namedVillagers(state);
    const heroes = named.filter((n) => HEROES.includes(n.job) || n.job === 'farmer' || n.job === 'peasant').slice(0, 2);
    if (!heroes.length && named.length) heroes.push(r.pick(named.slice(0, 12)));
    return { cast: heroes, wolves: r.int(4, 6) };
  },
  newyear(state) {
    return { cast: namedVillagers(state).slice(0, 8) };
  },
  flood(state, r) {
    const pool = namedVillagers(state).slice(0, 12), cast = [];
    while (cast.length < 3 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return { cast };
  },
  pig(state, r) {
    const named = namedVillagers(state);
    const farmers = named.filter((n) => n.job === 'farmer' || n.job === 'peasant');
    const chaser = farmers.length ? r.pick(farmers.slice(0, 8)) : castMember(state, r, named);
    return chaser ? { cast: [chaser] } : null;
  },
  archery(state, r, arc) {
    if (arc?.data) return { cast: arc.data.cast }; // the same three in the final
    // archers and guards first; the winner is the first of the cast
    const named = namedVillagers(state);
    const pool = [...named.filter((n) => n.job === 'fletcher' || HEROES.includes(n.job)), ...named.filter((n) => n.job !== 'fletcher' && !HEROES.includes(n.job))].slice(0, 8);
    const cast = [];
    while (cast.length < 3 && pool.length) cast.push(pool.splice(r.int(0, Math.min(pool.length - 1, 3)), 1)[0]);
    return { cast };
  },
  royal(state, r) {
    // (a new crowd in the front row, or at the feast table, every day)
    const pool = namedVillagers(state).slice(0, 16), cast = [];
    while (cast.length < 6 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return { cast };
  },
  storm(state, r) {
    const pool = namedVillagers(state).slice(0, 12), cast = [];
    while (cast.length < 4 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return { cast };
  },
};

/**
 * Today's story, or null. Records it in state.storyLog (id -> last day) for the cooldowns.
 * Call after the population and names of the day are settled.
 */
export function pickStory(state) {
  state.storyLog ??= {};
  const r = rng(state.seed, 'story', state.date);
  const pop = state.subscriberCount;
  const mmdd = state.date.slice(5);
  const possible = (id, s) => pop >= (s.minPop ?? 1) && (!s.needs || s.needs(state));
  let id = Object.keys(STORIES).find((k) => STORIES[k].date === mmdd && possible(k, STORIES[k]));
  // then a story that continues from an earlier day (the next step, or the house rebuilt after a fire)
  const arc = state.storyArc;
  if (!id && arc && arc.day <= state.day) {
    state.storyArc = null;
    const story = BUILD[arc.id](state, r, arc);
    if (story) {
      state.storyLog[arc.id] = state.day;
      if (arc.step === undefined) return { id: arc.id, ...story };
      const steps = STORIES[arc.id].steps, k = steps.indexOf(arc.step);
      if (k + 1 < steps.length) state.storyArc = { id: arc.id, step: steps[k + 1], day: state.day + 1, data: arc.data };
      return { id: arc.id, step: arc.step, ...story };
    }
  }
  if (!id) {
    if (!r.chance(STORY_CHANCE)) return null;
    const options = Object.entries(STORIES).filter(([k, s]) => !s.date && !s.arc && possible(k, s)
      && (state.storyLog[k] === undefined || state.day - state.storyLog[k] >= s.cooldown));
    if (!options.length) return null;
    id = r.weighted(options, ([, s]) => s.weight)[0];
  }
  const story = BUILD[id](state, r);
  if (!story) return null;
  state.storyLog[id] = state.day;
  if (STORIES[id].next) state.storyArc = STORIES[id].next(story, state);
  const steps = STORIES[id].steps;
  if (steps) {
    state.storyArc = { id, step: steps[1], day: state.day + 1, data: story };
    return { id, step: steps[0], ...story };
  }
  return { id, ...story };
}

/** A given story for today, whatever the calendar and cooldowns say (test renders: --story bandits). */
export function storyFor(state, id) {
  const [name, step] = id.split(':'); // "merchants:camp" for a later step
  if (!BUILD[name]) throw new Error(`unknown story "${name}" (one of: ${Object.keys(BUILD).join(', ')})`);
  const r = rng(state.seed, 'story', state.date);
  const steps = STORIES[name].steps;
  if (step && !steps?.includes(step)) throw new Error(`story "${name}" has no step "${step}" (${(steps || []).join(', ') || 'one step only'})`);
  let story = BUILD[name](state, r);
  if (story && step && step !== steps[0]) story = BUILD[name](state, r, { id: name, step, data: story });
  return story && { id: name, ...(steps ? { step: step || steps[0] } : {}), ...story };
}

/** The sound and narration key of a story's scene: 'merchants', or 'merchants_camp' for a later step. */
export function storyCue(story) {
  return story.step && story.step !== STORIES[story.id]?.steps?.[0] ? `${story.id}_${story.step}` : story.id;
}
