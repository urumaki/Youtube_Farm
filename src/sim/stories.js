// Story events: at most one visible scene a day (bandits at the gate, a quarrel in the square, a
// merchant caravan, Halloween...). Deterministic: depends on the seed, the date and the state.
// Tone (owner's rule): named villagers are heroes or comic characters, never villains or victims, and
// nobody gets hurt. Calendar events always happen on their date; otherwise a story happens on about
// half the days, each kind with its own cooldown so the same scene does not repeat too often.
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
const COSTUMES = ['ghost', 'witch', 'pumpkin'];

/**
 * Catalog. date: 'MM-DD' calendar event; minPop: population needed; cooldown: days before it can come
 * back; weight: how likely among the stories possible today; needs(state): extra condition.
 */
export const STORIES = {
  halloween: { date: '10-31', minPop: 1 },
  bandits: { minPop: 25, cooldown: 10, weight: 2 }, // the guard tier: someone to chase them off
  quarrel: { minPop: 50, cooldown: 4, weight: 3, needs: (s) => built(s, 'market') }, // in the square
  merchants: { minPop: 50, cooldown: 5, weight: 3, needs: (s) => built(s, 'market') },
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
  quarrel(state, r) {
    const named = namedVillagers(state);
    const a = castMember(state, r, named);
    const b = a && castMember(state, r, named, [a]);
    if (!a || !b) return null;
    return { cast: [a, b], over: r.pick(['chicken', 'goat', 'cabbage']) };
  },
  merchants(state, r) {
    return { cast: [], from: r.pick(PLACES), goods: r.pick(GOODS), wagons: r.int(2, 3) };
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
  if (!id) {
    if (!r.chance(STORY_CHANCE)) return null;
    const options = Object.entries(STORIES).filter(([k, s]) => !s.date && possible(k, s)
      && (state.storyLog[k] === undefined || state.day - state.storyLog[k] >= s.cooldown));
    if (!options.length) return null;
    id = r.weighted(options, ([, s]) => s.weight)[0];
  }
  const story = BUILD[id](state, r);
  if (!story) return null;
  state.storyLog[id] = state.day;
  return { id, ...story };
}

/** A given story for today, whatever the calendar and cooldowns say (test renders: --story bandits). */
export function storyFor(state, id) {
  if (!BUILD[id]) throw new Error(`unknown story "${id}" (one of: ${Object.keys(BUILD).join(', ')})`);
  const story = BUILD[id](state, rng(state.seed, 'story', state.date));
  return story && { id, ...story };
}
