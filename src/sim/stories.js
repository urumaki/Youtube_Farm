// Story events: at most one visible scene a day (bandits at the gate, a quarrel in the square, a
// merchant caravan, Halloween...). Deterministic: depends on the seed, the date and the state.
// Tone (owner's rule): named villagers are heroes or comic characters, never villains or victims, and
// nobody gets hurt. Calendar events always happen on their date; otherwise a story happens on about
// half the days, each kind with its own cooldown so the same scene does not repeat too often.
// Owner (2026-10-21): a story can go on for a few days, one step a day: the merchants arrive, dance round
// the fire at night, then leave (`steps`). (The rule of no story on days with 15 or more new commenters was
// dropped by the owner on 2026-10-22.)
import { rng } from './prng.js';
import { TIERS } from './tiers.js';

export const PLACES = ['Ashford', 'the Northern Marches', 'Kingsbridge', 'the Salt Coast', 'Ravenscar', 'the Amber Vale', 'Dunmoor', 'the Eastern Isles'];
export const GOODS = ['spices', 'wool', 'salt', 'silk', 'amber', 'wine', 'iron tools', 'honey', 'dyed cloth'];
const HEROES = ['knight', 'cavalier', 'warrior', 'guard', 'fletcher'];
// the guards' tournament: the chance that the guard named first (the older name) wins a bout
export const TOURNEY_ODDS = 0.85;
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
  // the guards' tournament (owner 2026-10-25): a knockout over three days among eight named guards, the winner becomes
  // Captain of the Guard (state.guardCaptain)
  tourney: { minPop: 60, cooldown: 30, weight: 2, needs: (s) => namedVillagers(s).filter((n) => n.job === 'guard').length >= 8 && !['rain', 'snow'].includes(s.weather), steps: ['round1', 'semis', 'final'] },
  // owner 2026-10-25: St Martin's Day, the new wine opened in the square; Christmas Eve round the Yule fire in the snow (the
  // day turns to snow, simulate.js)
  martinmas: { date: '11-11', minPop: 1 },
  christmas: { date: '12-24', minPop: 1 },
  // on the day the kingdom reaches a new goal the crier reads the proclamation to the square (before any other story)
  proclaim: { onUnlock: true, minPop: 1 },
  // the fisherman's huge catch carried into the square on a pole, roasted for everyone the next quiet day
  bigfish: { minPop: 10, cooldown: 14, weight: 2, steps: ['catch', 'roast'] },
  // a hen loose in the tavern, the drinkers chasing it between the tables until it flies out of the window
  chicken: { minPop: 50, cooldown: 10, weight: 2, needs: (s) => built(s, 'tavern') },
  // a gale spins the windmill's sails far too fast; the miller and two helpers haul on the brake rope
  windmill: { minPop: 100, cooldown: 14, weight: 2, needs: (s) => built(s, 'windmill') },
  // guards against farmers at the rope over a mud puddle; the losers slide into the mud
  tugofwar: { minPop: 50, cooldown: 12, weight: 2, needs: (s) => teamOf(s, GUARDS).length >= 2 && teamOf(s, LAND).length >= 2 && !['rain', 'snow'].includes(s.weather) },
  // a hay cart stuck in the mud of a gate of the Second Wall, pushed out by named villagers (the hay comes down on them)
  haycart: { minPop: 250, cooldown: 12, weight: 2, needs: (s) => built(s, 'wall2') && s.weather !== 'snow' },
  // a snowball fight in the square, two teams of named villagers; only on snowy days
  snowballs: { minPop: 20, cooldown: 5, weight: 3, needs: (s) => s.weather === 'snow' },
  // owner 2026-10-27: a commenter who talks of overthrowing the king ("kill the king", "revolution!") spends a day in the
  // pillory while named villagers pelt them with tomatoes and the executioner chops a cabbage on the block as a warning.
  // Comic, nobody hurt; never drawn otherwise, at most once every 7 days, the newest rebel of the last 7 days (rebelDay).
  rebel: { onComment: true, minPop: 1, cooldown: 7, needs: (s) => built(s, 'pillory') },
  // owner 2026-10-28: the games at the Tournament Ground are two events of two days each, the chariot race and the joust.
  // Day 1 ('announce'): the town crier reads the proclamation in the square and every guard may enter by commenting "join"
  // (names[id].joinDay, simulate.js). Day 2 ('results'): the entrants are drawn among the guards who joined (the others
  // fill the places left), the longer a guard has had their name the better their chance (`drawGuards`); the race or the
  // joust, then the King names the winner in the throne room: a Cavalier for the race, a Knight for the joust. Only named
  // guards ride, never the Captain of the Guard
  race: { minPop: 100, cooldown: 14, weight: 3, needs: (s) => built(s, 'tournament') && jousters(s).length >= 4 && !['rain', 'snow'].includes(s.weather), steps: ['announce', 'results'] },
  joust: { minPop: 100, cooldown: 14, weight: 3, needs: (s) => built(s, 'tournament') && jousters(s).length >= 2 && !['rain', 'snow'].includes(s.weather), steps: ['announce', 'results'] },
  // owner 2026-10-27 (stories with a beginning and an end keep viewers watching): six more.
  // A merchant ship sails into the harbor with named villagers waving on the quay, the next day named porters unload it,
  // then it sails away
  ship: { minPop: 500, cooldown: 14, weight: 3, needs: (s) => built(s, 'harbor') && !['rain', 'snow'].includes(s.weather), steps: ['arrive', 'unload', 'leave'] },
  // a new bell for the church: the bronze poured into the mould at the Bell Foundry, the mould broken open and the bell
  // rung for the first time, then hauled up into the bell tower by named villagers on the rope
  bell: { minPop: 4000, cooldown: 40, weight: 3, needs: (s) => built(s, 'bell_foundry') && (built(s, 'cathedral') || built(s, 'chapel')), steps: ['pour', 'cool', 'raise'] },
  // only on foggy days: a fisherman lost in the fog on the river; named villagers light a beacon fire at the end of the
  // pier and ring a hand bell until the boat comes home
  fogboat: { minPop: 10, cooldown: 10, weight: 4, needs: (s) => s.weather === 'fog' && built(s, 'dock') },
  // the census at the Counting House: named villagers queue at the clerk's table, and the count reaches the kingdom's
  // number (1 subscriber = 1 villager)
  census: { minPop: 250, cooldown: 21, weight: 2, needs: (s) => built(s, 'counting_house') },
  // a pie eating contest in the tavern: three named villagers, stacks of pies, one winner
  pies: { minPop: 50, cooldown: 12, weight: 2, needs: (s) => built(s, 'tavern') },
  // a rowing race on the river past the dock, three boats with named rowers, the crowd on the pier
  regatta: { minPop: 30, cooldown: 14, weight: 2, needs: (s) => built(s, 'dock') && !['rain', 'snow', 'fog'].includes(s.weather) },
  // owner 2026-10-28: the crier proclaims once that guards become Knights and Cavaliers only by winning at the Tournament
  // Ground (asking makes a guard), on the first day it can be once the Tournament Ground stands
  decree: { minPop: 100, once: true, needs: (s) => built(s, 'tournament') },
};
const GUARDS = ['guard', 'knight'], LAND = ['farmer', 'peasant', 'shepherd'];
const teamOf = (s, jobs) => namedVillagers(s).filter((n) => jobs.includes(n.job));
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

/**
 * Named villagers of these jobs for the other people in a role (owner 2026-10-25: the guards beside the heroes, the escort,
 * the folk with torches...): up to n, not already in the cast, picked among the newest; fewer when there are not enough.
 */
function roleCast(state, r, jobs, n, exclude = []) {
  const pool = namedVillagers(state).filter((v) => jobs.includes(v.job) && !exclude.some((e) => e.id === v.id)).slice(0, 12), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
  return out;
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
    const guards = r.int(2, 3);
    return { cast: heroes, bandits: r.int(5, 7), guards, guardCast: roleCast(state, r, ['guard', 'knight'], guards, heroes) };
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
    // the neighbours passing the buckets along the chain, named too (owner 2026-10-25)
    const chain = named.filter((n) => !heroes.includes(n)).slice(0, 12), passers = [];
    while (passers.length < 4 && chain.length) passers.push(chain.splice(r.int(0, chain.length - 1), 1)[0]);
    return { cast: heroes, chain: passers, house: r.pick(houses.slice(0, 200)).id };
  },
  rebuild(state, r, arc) {
    const house = arc?.house ?? BUILD.fire(state, r)?.house;
    if (house === undefined) return null;
    const named = namedVillagers(state);
    const crew = named.filter((n) => BUILDERS.includes(n.job)).slice(0, 3);
    if (!crew.length && named.length) crew.push(r.pick(named.slice(0, 12)));
    return { cast: crew, house };
  },
  wolves(state, r) {
    const named = namedVillagers(state);
    const heroes = named.filter((n) => HEROES.includes(n.job) || n.job === 'farmer' || n.job === 'peasant').slice(0, 2);
    if (!heroes.length && named.length) heroes.push(r.pick(named.slice(0, 12)));
    // the folk with torches behind them: farmers, peasants, shepherds, woodcutters
    return { cast: heroes, wolves: r.int(4, 6), folk: roleCast(state, r, ['farmer', 'peasant', 'shepherd', 'woodcutter'], Math.max(2, 4 - heroes.length), heroes) };
  },
  newyear(state) {
    return { cast: namedVillagers(state).slice(0, 8) };
  },
  flood(state, r) {
    const pool = namedVillagers(state).slice(0, 12), cast = [];
    while (cast.length < 5 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
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
    // the King's two banner guards, named guards or knights
    return { cast, escort: roleCast(state, r, ['guard', 'knight'], 2, cast) };
  },
  tourney(state, r, arc) {
    if (arc?.data) {
      // the same bracket; the round of the day (its fighters are the cast); the champion is made captain on the last day
      const round = arc.step === 'final' ? 2 : arc.step === 'semis' ? 1 : 0;
      if (arc.step === 'final') state.guardCaptain = arc.data.champion;
      return { ...arc.data, cast: arc.data.rounds[round].flatMap((b) => [b.a, b.b]) };
    }
    // eight named guards drawn at random; in each bout the one named first (the older name) wins 85 times in 100, the
    // newer 15, two named the same day 50/50 (owner 2026-10-25). All three rounds are decided now, so the days agree.
    const pool = namedVillagers(state).filter((n) => n.job === 'guard'), entrants = [];
    while (entrants.length < 8 && pool.length) entrants.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    if (entrants.length < 8) return null;
    const odds = (a, b) => (a.day < b.day ? TOURNEY_ODDS : a.day > b.day ? 1 - TOURNEY_ODDS : 0.5);
    const rounds = [];
    let field = entrants.map(({ id, name, job, day }) => ({ id, name, job, day }));
    while (field.length > 1) {
      const bouts = [];
      for (let i = 0; i < field.length; i += 2) {
        const a = field[i], b = field[i + 1];
        bouts.push({ a, b, winner: (r.chance(odds(a, b)) ? a : b).id });
      }
      rounds.push(bouts);
      field = bouts.map((bt) => (bt.winner === bt.a.id ? bt.a : bt.b));
    }
    return { rounds, champion: field[0].id, cast: rounds[0].flatMap((b) => [b.a, b.b]) };
  },
  storm(state, r) {
    const pool = namedVillagers(state).slice(0, 12), cast = [];
    while (cast.length < 4 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return { cast };
  },
  martinmas(state, r) {
    // a named innkeeper or brewer opens the barrel; the newest named villagers raise their cups
    const keeper = roleCast(state, r, ['innkeeper', 'brewer'], 1)[0] || castMember(state, r, namedVillagers(state));
    if (!keeper) return null;
    return { cast: [keeper, ...namedVillagers(state).filter((n) => n.id !== keeper.id).slice(0, 6)] };
  },
  christmas(state, r) {
    // a named priest or bishop blesses the crowd (when the kingdom has one), the newest named villagers sing round the fire
    const priest = roleCast(state, r, ['priest', 'bishop'], 1)[0] || null;
    return { priest, cast: [...(priest ? [priest] : []), ...namedVillagers(state).filter((n) => n.id !== priest?.id).slice(0, 8)] };
  },
  proclaim(state, r, arc, tier) {
    const t = TIERS.find((x) => x.id === tier);
    if (!t) return null;
    // the crier reads it out (a named one when there is one), five named villagers cheer in front
    const crier = roleCast(state, r, ['crier'], 1)[0] || null;
    const crowd = roleCast(state, r, Object.keys(JOB_COUNT(state)), 5, crier ? [crier] : []);
    return { tier: t.id, title: t.title, crier, cast: [...(crier ? [crier] : []), ...crowd] };
  },
  decree(state, r) {
    // the crier reads it out (a named one when there is one), five named guards in front
    const crier = roleCast(state, r, ['crier'], 1)[0] || null;
    const guards = roleCast(state, r, ['guard'], 5, crier ? [crier] : []);
    return { crier, cast: [...(crier ? [crier] : []), ...guards] };
  },
  bigfish(state, r, arc) {
    // the next day the same fisherman roasts it for the newest named villagers
    if (arc?.data) return { ...arc.data, cast: [arc.data.cast[0], ...namedVillagers(state).filter((n) => n.id !== arc.data.cast[0].id).slice(0, 5)] };
    const named = namedVillagers(state);
    const fisher = roleCast(state, r, ['fisherman'], 1)[0] || castMember(state, r, named);
    if (!fisher) return null;
    return { cast: [fisher, ...roleCast(state, r, named.map((n) => n.job), 2, [fisher])] };
  },
  chicken(state, r) {
    const named = namedVillagers(state), cast = [];
    const pool = named.slice(0, 12);
    while (cast.length < 3 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return cast.length ? { cast } : null;
  },
  windmill(state, r) {
    const named = namedVillagers(state);
    const miller = roleCast(state, r, ['miller'], 1)[0] || castMember(state, r, named);
    if (!miller) return null;
    return { cast: [miller, ...roleCast(state, r, named.map((n) => n.job), 2, [miller])] };
  },
  tugofwar(state, r) {
    // up to four on each side; the side that wins is drawn now
    const guards = roleCast(state, r, GUARDS, 4), farmers = roleCast(state, r, LAND, 4, guards);
    if (guards.length < 2 || farmers.length < 2) return null;
    return { guards, farmers, winner: r.chance(0.5) ? 'guards' : 'farmers', cast: [...guards, ...farmers] };
  },
  haycart(state, r) {
    const named = namedVillagers(state);
    const carter = roleCast(state, r, LAND, 1)[0] || castMember(state, r, named);
    if (!carter) return null;
    return { cast: [carter, ...roleCast(state, r, named.map((n) => n.job), 4, [carter])] };
  },
  rebel(state, r) {
    // the newest rebel not yet pilloried (test renders with none: the newest named villager), the executioner (a named one when
    // there is one) and up to four named villagers throwing tomatoes
    const named = namedVillagers(state);
    const rebel = rebelsWaiting(state)[0] || named[0];
    if (!rebel) return null;
    const executioner = roleCast(state, r, ['executioner'], 1, [rebel])[0] || null;
    const throwers = roleCast(state, r, Object.keys(JOB_COUNT(state)), 4, [rebel, ...(executioner ? [executioner] : [])]);
    return { rebel, executioner, throwers, cast: [rebel, ...(executioner ? [executioner] : []), ...throwers] };
  },
  snowballs(state, r) {
    const pool = namedVillagers(state).slice(0, 16), cast = [];
    while (cast.length < 8 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return cast.length >= 2 ? { cast } : null;
  },
  race(state, r, arc) {
    return game(state, r, arc, 'race');
  },
  joust(state, r, arc) {
    return game(state, r, arc, 'joust');
  },
  ship(state, r, arc) {
    // a new crowd every day: waving on the quay as it comes and goes, carrying crates and sacks when it is unloaded
    const unload = arc?.step === 'unload';
    const cast = unload ? roleCast(state, r, ['sailor', 'merchant', 'peasant', 'farmer', 'carpenter', 'cooper', 'woodcutter', 'fisherman'], 4) : [];
    const pool = namedVillagers(state).filter((n) => !cast.some((c) => c.id === n.id)).slice(0, 16);
    while (cast.length < (unload ? 4 : 6) && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    if (arc?.data) return { ...arc.data, cast };
    return { from: r.pick(PLACES), goods: r.pick(GOODS), name: r.pick(SHIPS), cast };
  },
  bell(state, r, arc) {
    // the bellfounder (a named one when there is one) leads all three days; named helpers, new ones every day
    const founder = arc?.data?.founder ?? (roleCast(state, r, ['bellfounder'], 1)[0] || castMember(state, r, namedVillagers(state)));
    if (!founder) return null;
    const helpers = roleCast(state, r, Object.keys(JOB_COUNT(state)), arc?.step === 'raise' ? 5 : 3, [founder]);
    return { founder, cast: [founder, ...helpers] };
  },
  fogboat(state, r) {
    // the fisherman out on the water (a named one when there is one); named villagers on the pier: one rings the bell,
    // the others hold torches by the beacon fire
    const named = namedVillagers(state);
    const fisher = roleCast(state, r, ['fisherman'], 1)[0] || castMember(state, r, named);
    if (!fisher) return null;
    const pier = roleCast(state, r, Object.keys(JOB_COUNT(state)), 4, [fisher]);
    return { fisher, cast: [fisher, ...pier] };
  },
  census(state, r) {
    // the clerk at the table (a named reeve, tax collector or teacher when there is one), five named villagers in the queue;
    // the count: the kingdom's number on the day
    const clerk = roleCast(state, r, ['taxcollector', 'reeve', 'teacher', 'philosopher'], 1)[0] || null;
    const queue = roleCast(state, r, Object.keys(JOB_COUNT(state)), 5, clerk ? [clerk] : []);
    return { clerk, count: state.subscriberCount, cast: [...(clerk ? [clerk] : []), ...queue] };
  },
  pies(state, r) {
    // three named villagers at the table; the winner drawn now
    const pool = namedVillagers(state).slice(0, 14), cast = [];
    while (cast.length < 3 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    if (cast.length < 2) return null;
    return { cast, winner: r.pick(cast).id };
  },
  regatta(state, r) {
    // three boats, a named rower in each (fishermen and sailors first), four named villagers cheering on the pier
    const named = namedVillagers(state);
    const rowers = roleCast(state, r, ['fisherman', 'sailor'], 3);
    rowers.push(...roleCast(state, r, Object.keys(JOB_COUNT(state)), 3 - rowers.length, rowers));
    if (rowers.length < 2) return null;
    const crowd = roleCast(state, r, named.map((n) => n.job), 4, rowers);
    return { rowers, crowd, winner: r.pick(rowers).id, cast: [...rowers, ...crowd] };
  },
};
const SHIPS = ['the Sea Swallow', 'the Golden Gull', 'the Saint Brendan', 'the Merry Otter', 'the Northern Star', 'the Fair Wind'];

// the riders of the games at the Tournament Ground: named guards only (owner 2026-10-28), not the Captain of the Guard
function jousters(state) {
  return namedVillagers(state).filter((n) => n.job === 'guard' && n.id !== state.guardCaptain);
}

// how many ride in each game, and what the winner is made
export const GAMES = { race: { riders: 4, title: 'cavalier' }, joust: { riders: 2, title: 'knight' } };

/**
 * The entrants of a game (owner 2026-10-28): n named guards drawn without replacement, first among those who commented
 * "join" after the announcement (joinDay > since), then among the other guards for the places left. Each draw is weighted
 * by seniority among the guards still in that pool: the one named longest ago weighs 1.9, the newest 1.0, the others in
 * between in proportion to their place in the line (ties: the lower id is the older).
 */
export function drawGuards(state, r, n, since) {
  const guards = jousters(state).map(({ id, name, job, day }) => ({ id, name, job, day }));
  const joined = guards.filter((g) => (state.names[g.id].joinDay ?? -1) > since);
  const rest = guards.filter((g) => !joined.includes(g));
  const out = [];
  for (const pool of [joined, rest]) {
    const line = [...pool].sort((a, b) => a.day - b.day || a.id - b.id); // the oldest first
    const w = new Map(line.map((g, i) => [g.id, 1 + 0.9 * (line.length > 1 ? (line.length - 1 - i) / (line.length - 1) : 1)]));
    const left = [...line];
    while (out.length < n && left.length) {
      const g = r.weighted(left, (x) => w.get(x.id));
      out.push({ ...g, joined: pool === joined });
      left.splice(left.indexOf(g), 1);
    }
  }
  return out;
}

/** The chariot race or the joust: the announcement, then the results (and the title) the next day. */
function game(state, r, arc, id) {
  if (arc?.step !== 'results') {
    // the town crier (a named one when there is one) reads it; named guards in front of the dais, hoping to ride
    const crier = roleCast(state, r, ['crier'], 1)[0] || null;
    const guards = roleCast(state, r, ['guard'], 5, crier ? [crier] : []);
    return { game: id, day: state.day, crier, cast: [...(crier ? [crier] : []), ...guards] };
  }
  const since = arc.data?.day ?? state.day - 1;
  const riders = drawGuards(state, r, GAMES[id].riders, since);
  if (riders.length < 2) return null;
  const winner = r.pick(riders).id;
  promote(state, winner, GAMES[id].title);
  // seven named villagers in the stands (with the riders, few enough tags that all show at once)
  const pool = namedVillagers(state).filter((n) => !riders.some((x) => x.id === n.id)).slice(0, 30), crowd = [];
  while (crowd.length < 7 && pool.length) crowd.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
  return { game: id, day: since, riders, crowd, winner, joined: riders.filter((x) => x.joined).length, cast: [...riders, ...crowd] };
}

/** The champion of the games becomes a Knight (owner 2026-10-27), the winner of the chariot race a Cavalier (2026-10-28). */
function promote(state, id, job) {
  const n = state.names?.[id];
  if (!n) return;
  n.job = job;
  n[job + 'Day'] = state.day;
  if (state.villagers[id]) state.villagers[id].job = job;
}
/** Named villagers who talked of overthrowing the king in the last 7 days and were not pilloried since, newest first. */
function rebelsWaiting(state) {
  return namedVillagers(state).filter((n) => {
    const x = state.names[n.id];
    return x.rebelDay !== undefined && x.rebelDay >= state.day - 7 && !(x.pilloryDay >= x.rebelDay);
  }).sort((a, b) => state.names[b.id].rebelDay - state.names[a.id].rebelDay || b.day - a.day);
}

// every job some named villager has (anyone may cheer)
const JOB_COUNT = (state) => Object.fromEntries(namedVillagers(state).map((n) => [n.job, 1]));

/**
 * Today's story, or null. Records it in state.storyLog (id -> last day) for the cooldowns.
 * Call after the population and names of the day are settled.
 */
export function pickStory(state, { unlocked = [] } = {}) {
  state.storyLog ??= {};
  const r = rng(state.seed, 'story', state.date);
  const pop = state.subscriberCount;
  const mmdd = state.date.slice(5);
  const possible = (id, s) => pop >= (s.minPop ?? 1) && (!s.needs || s.needs(state));
  let id = Object.keys(STORIES).find((k) => STORIES[k].date === mmdd && possible(k, STORIES[k]));
  // a new goal reached today: the proclamation (the highest tier when several came at once)
  if (!id && unlocked.length) {
    const story = BUILD.proclaim(state, r, null, unlocked[unlocked.length - 1]);
    if (story) { state.storyLog.proclaim = state.day; return { id: 'proclaim', ...story }; }
  }
  // then a story that continues from an earlier day (the next step, or the house rebuilt after a fire)
  const arc = state.storyArc;
  if (!id && arc && arc.day <= state.day) {
    state.storyArc = null;
    if (arc.step !== undefined && !STORIES[arc.id]?.steps?.includes(arc.step)) return null; // a step that no longer exists
    const story = BUILD[arc.id](state, r, arc);
    if (story) {
      state.storyLog[arc.id] = state.day;
      if (arc.step === undefined) return { id: arc.id, ...story };
      const steps = STORIES[arc.id].steps, k = steps.indexOf(arc.step);
      if (k + 1 < steps.length) state.storyArc = { id: arc.id, step: steps[k + 1], day: state.day + 1, data: arc.data };
      return { id: arc.id, step: arc.step, ...story };
    }
  }
  // a decree read once, on the first day it can be (after the stories of several days, which it never breaks)
  for (const [k, s] of Object.entries(STORIES)) {
    if (id || !s.once || state.storyLog[k] !== undefined || !possible(k, s)) continue;
    const story = BUILD[k](state, r);
    if (story) { state.storyLog[k] = state.day; return { id: k, ...story }; }
  }
  // a rebel waiting for the pillory (no more than once every 7 days)
  if (!id && rebelsWaiting(state).length && possible('rebel', STORIES.rebel)
    && (state.storyLog.rebel === undefined || state.day - state.storyLog.rebel >= STORIES.rebel.cooldown)) {
    const story = BUILD.rebel(state, r);
    if (story) {
      state.storyLog.rebel = state.day;
      state.names[story.rebel.id].pilloryDay = state.day;
      return { id: 'rebel', ...story };
    }
  }
  if (!id) {
    if (!r.chance(STORY_CHANCE)) return null;
    const options = Object.entries(STORIES).filter(([k, s]) => !s.date && !s.arc && !s.onUnlock && !s.onComment && !s.once && possible(k, s)
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
  let story = BUILD[name](state, r, null, name === 'proclaim' ? state.unlockedTiers[state.unlockedTiers.length - 1] : undefined);
  if (story && step && step !== steps[0]) story = BUILD[name](state, r, { id: name, step, data: story });
  return story && { id: name, ...(steps ? { step: step || steps[0] } : {}), ...story };
}

/** The sound and narration key of a story's scene: 'merchants', or 'merchants_camp' for a later step. */
export function storyCue(story) {
  return story.step && story.step !== STORIES[story.id]?.steps?.[0] ? `${story.id}_${story.step}` : story.id;
}
