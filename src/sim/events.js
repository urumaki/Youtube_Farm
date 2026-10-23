// Weather and daily-life events. Every day produces at least one event so videos are never empty.
import { rng } from './prng.js';
import { BUILDINGS } from './tiers.js';

const PLACES = ['Ashford', 'the Northern Marches', 'Kingsbridge', 'the Salt Coast', 'Ravenscar', 'the Amber Vale', 'Dunmoor', 'the Eastern Isles'];
const GOODS = ['spices', 'wool', 'salt', 'silk', 'amber', 'wine', 'iron tools', 'honey', 'dyed cloth'];
const FESTIVALS = ['the Feast of Banners', 'Lantern Night', "the Founders' Fair", 'the Harvest Moon Dance', 'the Day of a Thousand Bells'];
const ACTIVITIES = {
  farmer: 'brings in a cart of golden wheat', peasant: 'mends the old fence by the road', woodcutter: 'fells a mighty oak',
  fisherman: 'lands the biggest pike of the season', blacksmith: 'forges a new set of horseshoes', baker: 'bakes honey bread for the whole street',
  guard: 'spots a fox on the walls and sounds a tiny alarm', stonemason: 'carves a new step for the gate', merchant: 'haggles over a crate of spices',
  innkeeper: 'opens a fresh barrel of cider', priest: 'rings the bell at dawn', miller: 'grinds the first flour of the week',
  carpenter: 'raises a new roof beam', reeve: 'counts the tax sheaves twice', sailor: 'ties knots faster than anyone in port',
  knight: 'polishes armor for the tournament', bishop: 'blesses the new bells', scholar: 'copies an ancient map',
  mayor: 'reads the town charter aloud', weaver: 'finishes a banner in the royal colors', physician: 'brews a remedy of sage and mint',
  apothecary: 'grinds sage and mint into a cough remedy', bard: 'writes a song about the newest villagers', taxcollector: 'counts the coins in the tax chest twice', tailor: 'sews a new cloak for the night watch',
  potter: 'throws a jug on the wheel, and it only wobbles a little', cobbler: 'mends the boots of the whole watch', cooper: 'hammers the last hoop onto a new barrel',
  beekeeper: 'brings in the first jar of honey', bellfounder: 'casts a bell that rings a little off-key', clockmaker: 'sets the town clock five minutes fast',
  ratcatcher: 'chases a rat around the square, and the rat wins', chimneysweep: 'comes down from a roof covered in soot', falconer: 'calls the falcon back to the glove', cook: 'stirs a stew that the whole street can smell',
  hunter: 'practises on the straw deer and hits it twice', butcher: 'hangs a fresh string of sausages over the door', engineer: 'tests a little trebuchet that throws a turnip',
  shepherd: 'counts the sheep and gets a different number each time', tanner: 'hangs a new hide to dry in the sun',
  chronicler: 'records today in the kingdom chronicle', admiral: 'charts a route to distant lands',
  fletcher: 'fletches a bundle of arrows', weirdo: 'dances alone in the square for no reason', beggar: 'raises a mug to every passer-by',
  jester: 'juggles for a crowd of children', warrior: 'trains with the sword until sunset', toolsmith: 'forges new hoes and sickles for the farmers',
  brewer: 'taps a barrel of honey mead', apprentice: 'sweeps the workshop and dreams of the future',
};

function season(date) {
  const m = Number(date.slice(5, 7));
  return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
}

export function weatherFor(seed, date) {
  const r = rng(seed, 'weather', date);
  const table = {
    winter: [['clear', 3], ['cloudy', 3], ['fog', 2], ['snow', 3], ['rain', 1]],
    spring: [['clear', 4], ['cloudy', 2], ['rain', 3], ['fog', 1]],
    summer: [['clear', 7], ['cloudy', 2], ['rain', 1]],
    autumn: [['clear', 3], ['cloudy', 3], ['fog', 3], ['rain', 2]],
  }[season(date)];
  return r.weighted(table, (x) => x[1])[0];
}

export function dailyEvents(state, diff) {
  const { seed, date } = state;
  const r = rng(seed, 'events', date);
  const weather = weatherFor(seed, date);
  const events = [{ type: 'weather', weather, season: season(date) }];
  const built = new Set(state.buildings.filter((b) => b.status === 'done').map((b) => b.id));
  const pop = state.subscriberCount;

  for (const p of state.pendingConstruction) {
    events.push({ type: 'construction', building: p.building, label: BUILDINGS[p.building].label, progress: 1 - p.daysLeft / p.daysTotal });
  }
  for (const m of [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 1000000]) {
    if (diff.from < m && pop >= m) events.push({ type: 'milestone', value: m });
  }

  // One flavor event chosen from what makes sense today.
  const options = [];
  if (pop === 0) options.push({ type: 'empty', w: 1 });
  if (pop > 0) {
    // a named villager when there is one, so commenters see themselves in the story
    const named = Object.keys(state.names || {}).map(Number).filter((i) => i < pop);
    const id = named.length && r.chance(0.7) ? r.pick(named) : r.int(0, pop - 1);
    const v = state.villagers[id];
    options.push({ type: 'spotlight', villager: id, name: v.name, job: v.job, activity: ACTIVITIES[v.job] || 'goes about the day', w: 3 });
  }
  if (pop >= 5) options.push({ type: 'festival', name: r.pick(FESTIVALS), w: state.day % 30 === 0 ? 50 : 1 });
  if (pop > 0 && season(date) === 'autumn') options.push({ type: 'harvest', w: 3 });
  if (pop > 0 && season(date) !== 'autumn' && weather !== 'snow') options.push({ type: 'fieldwork', w: 1 });
  if (built.has('market')) options.push({ type: 'market_day', w: 2 });
  if (built.has('dock') || built.has('market')) options.push({ type: 'trade', from: r.pick(PLACES), goods: r.pick(GOODS), w: 2 });
  if (weather === 'snow' || weather === 'rain' || weather === 'fog') options.push({ type: 'weather_story', weather, w: 2 });
  const pick = r.weighted(options, (o) => o.w);
  const { w: _w, ...ev } = pick;
  events.push(ev);
  return { weather, events };
}
