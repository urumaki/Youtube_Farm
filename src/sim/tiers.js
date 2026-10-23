// Population thresholds that unlock jobs and buildings.
// `unique` jobs go to the villagers who arrive exactly at the threshold (in order);
// `pool` jobs can be drawn by any later villager, weighted.
import { hash } from './prng.js';

// Jobs folded into another (owner 2026-10-22: the same work under two names). The tiers keep their old
// weights, so every other villager keeps their job; jobFor, the saves (migrate) and the comments map these.
export const MERGED = { warrior: 'guard', sailor: 'fisherman', toolsmith: 'blacksmith', weirdo: 'jester' };
export const mergedJob = (job) => MERGED[job] || job;

export const JOBS = {
  peasant: { label: 'Peasant', color: '#8a7a5c' },
  farmer: { label: 'Farmer', color: '#6f8f3a' },
  woodcutter: { label: 'Woodcutter', color: '#7a4f2a' },
  fisherman: { label: 'Fisherman', color: '#3f6f8f' },
  blacksmith: { label: 'Blacksmith', color: '#3b3b3f' },
  baker: { label: 'Baker', color: '#d9b77a' },
  guard: { label: 'Guard', color: '#7a1f2b' },
  stonemason: { label: 'Stonemason', color: '#9a9488' },
  merchant: { label: 'Merchant', color: '#2f5aa0' },
  innkeeper: { label: 'Innkeeper', color: '#a0522d' },
  priest: { label: 'Priest', color: '#e8e2d0' },
  miller: { label: 'Miller', color: '#c9c1a8' },
  carpenter: { label: 'Carpenter', color: '#9c6b3c' },
  reeve: { label: 'Reeve', color: '#4b3a6b' },
  sailor: { label: 'Sailor', color: '#1f4e79' },
  knight: { label: 'Knight', color: '#b0b7c0' },
  bishop: { label: 'Bishop', color: '#f2e9c9' },
  scholar: { label: 'Scholar', color: '#3a5a40' },
  mayor: { label: 'Mayor', color: '#c9a227' },
  weaver: { label: 'Weaver', color: '#b5476b' },
  physician: { label: 'Physician', color: '#4f7c82' },
  apothecary: { label: 'Apothecary', color: '#6b3fa0' },
  bard: { label: 'Bard', color: '#d1603d' },
  taxcollector: { label: 'Tax Collector', color: '#5b2a86' }, // owner 2026-10-22: no noble titles as jobs
  tailor: { label: 'Tailor', color: '#8e3b5e' },
  potter: { label: 'Potter', color: '#a8643c' },
  cobbler: { label: 'Cobbler', color: '#6a4a33' },
  cooper: { label: 'Cooper', color: '#7d5a2f' },
  beekeeper: { label: 'Beekeeper', color: '#d8b13a' },
  bellfounder: { label: 'Bell Founder', color: '#8a6a2a' },
  clockmaker: { label: 'Clockmaker', color: '#2f4f6f' },
  chronicler: { label: 'Chronicler', color: '#55443a' },
  admiral: { label: 'Admiral', color: '#0f3057' },
  crier: { label: 'Town Crier', color: '#c23b22' },
  executioner: { label: 'Executioner', color: '#2a2326' },
  // jobs that only exist because someone asked for them in a comment (see requests.js)
  fletcher: { label: 'Fletcher', color: '#5e7d3a', requestOnly: true },
  weirdo: { label: 'Town Weirdo', color: '#c04fb4', requestOnly: true },
  beggar: { label: 'Beggar', color: '#6d6152', requestOnly: true },
  jester: { label: 'Jester', color: '#e0a21b', requestOnly: true },
  warrior: { label: 'Warrior', color: '#8e2f2a', requestOnly: true },
  toolsmith: { label: 'Toolsmith', color: '#5b5f66', requestOnly: true },
  brewer: { label: 'Brewer', color: '#b07a2a', requestOnly: true },
  apprentice: { label: 'Apprentice', color: '#8c8c6a', requestOnly: true },
  ratcatcher: { label: 'Rat Catcher', color: '#5a5a48', requestOnly: true },
  chimneysweep: { label: 'Chimney Sweep', color: '#2b2b2e', requestOnly: true },
  falconer: { label: 'Falconer', color: '#6b5a2a', requestOnly: true },
  cook: { label: 'Cook', color: '#e6e0d0', requestOnly: true },
  // asked for in the comments of 2026-10-22 (owner 2026-10-23), by request only
  hunter: { label: 'Hunter', color: '#4f5e2e', requestOnly: true },
  butcher: { label: 'Butcher', color: '#8e2f2a', requestOnly: true },
  engineer: { label: 'Engineer', color: '#6d5a3a', requestOnly: true },
  shepherd: { label: 'Shepherd', color: '#8a7b54', requestOnly: true },
  tanner: { label: 'Tanner', color: '#7a4f2c', requestOnly: true },
};

export const BUILDINGS = {
  well: { label: 'the Well', days: 0 },
  fields: { label: 'the Fields', days: 0, plural: true },
  sawmill: { label: 'the Sawmill', days: 1 },
  dock: { label: 'the Fishing Dock', days: 1 },
  forge: { label: 'the Forge', days: 1 },
  bakery: { label: 'the Bakery', days: 1 },
  guardposts: { label: 'the Wall Guard', days: 0 },
  quarry: { label: 'the Quarry', days: 1 },
  market: { label: 'the Market Square', days: 2 },
  tavern: { label: 'the Tavern', days: 2 },
  crier_stand: { label: "the Crier's Stand", days: 1 },
  chapel: { label: 'the Chapel', days: 3 },
  windmill: { label: 'the Windmill', days: 2 },
  wall2: { label: 'the Second Wall', days: 7 },
  townhall: { label: 'the Town Hall', days: 5 },
  harbor: { label: 'the Harbor', days: 7 },
  cathedral: { label: 'the Cathedral', days: 21 },
  tournament: { label: 'the Tournament Ground', days: 5 },
  pillory: { label: 'the Pillory', days: 1 },
  tailor_stall: { label: "the Tailor's Stall", days: 1 },
  physician_booth: { label: "the Physician's Booth", days: 1 },
  potter_stall: { label: "the Potter's Stall", days: 1 },
  cobbler_stall: { label: "the Cobbler's Stall", days: 1 },
  cooperage: { label: 'the Cooperage', days: 2 },
  apiary: { label: 'the Beehives', days: 1, plural: true },
  bell_foundry: { label: 'the Bell Foundry', days: 3 },
  clock_tower: { label: 'the Clock Tower', days: 10 },
  stone_bridge: { label: 'the Great Bridge', days: 30 },
  fletcher_workshop: { label: "the Fletcher's Workshop", days: 1 },
  district_east: { label: 'the East Ward', days: 3 },
  charter_stone: { label: 'the Charter Stone', days: 1 },
  district_north: { label: 'the North Ward', days: 3 },
  university: { label: 'the University', days: 14 },
  district_south: { label: 'the South Ward', days: 3 },
  palace: { label: 'the Royal Palace', days: 30 },
  district_far: { label: 'the Far Ward', days: 3 },
  lighthouse: { label: 'the Lighthouse', days: 10 },
  colossus: { label: 'the Colossus of Subscribers', days: 60 },
};

export const TIERS = [
  { id: 'hamlet', at: 1, title: 'Hamlet', unique: ['farmer'], pool: { farmer: 6, peasant: 4 }, buildings: ['well', 'fields'] },
  { id: 'woodfolk', at: 5, title: 'Woodland Village', unique: ['woodcutter', 'fisherman'], pool: { woodcutter: 2, fisherman: 2 }, buildings: ['sawmill', 'dock'] },
  { id: 'crafts', at: 10, title: 'Craft Village', unique: ['blacksmith', 'baker'], pool: { blacksmith: 1, baker: 1.2 }, buildings: ['forge', 'bakery'], goal: 'the Blacksmith arrives' },
  { id: 'guard', at: 25, title: 'Guarded Village', unique: ['guard', 'stonemason'], pool: { guard: 2, stonemason: 1.2 }, buildings: ['guardposts', 'quarry'], goal: 'the Guard takes the walls' },
  { id: 'market', at: 50, title: 'Market Town', unique: ['merchant', 'innkeeper'], pool: { merchant: 1.5 }, buildings: ['market', 'tavern'], goal: 'the Market opens' },
  { id: 'faith', at: 100, title: 'Chapel Town', unique: ['priest', 'miller'], pool: { miller: 0.4 }, buildings: ['chapel', 'windmill'], goal: 'the Chapel bell rings' },
  // small in-between goals (owner, 2026-10-20): a new job and a small structure in the market square,
  // so the wait between two big goals is shorter. Only add tiers above the current population, or
  // existing villagers would change job.
  { id: 'crier', at: 175, title: 'Busy Town', unique: ['crier'], pool: {}, buildings: ['crier_stand'], goal: 'the Town Crier rings the bell' },
  { id: 'walled', at: 250, title: 'Walled Town', unique: ['reeve', 'carpenter'], pool: { carpenter: 1.2, guard: 1 }, buildings: ['wall2', 'townhall'], goal: 'the Second Wall rises' },
  { id: 'harbor', at: 500, title: 'Harbor Town', unique: ['bishop', 'knight', 'fisherman'], pool: { sailor: 1.5, knight: 0.5 }, buildings: ['harbor', 'cathedral', 'tournament'], goal: 'the Harbor opens' },
  { id: 'justice', at: 750, title: 'Town of Law', unique: ['executioner'], pool: {}, buildings: ['pillory'], goal: 'the Executioner takes up the axe' },
  { id: 'pottery', at: 850, title: 'Town of Potters', unique: ['potter'], pool: { potter: 0.4 }, buildings: ['potter_stall'], goal: 'the Potter sets up the wheel' },
  // the University below the castle with its scholars, and the Noble Quarter round it (owner 2026-10-22, moved from 5000)
  { id: 'charter', at: 1000, title: 'University Town', unique: ['mayor', 'scholar'], pool: { scholar: 0.6, weaver: 1.2 }, buildings: ['university', 'charter_stone', 'district_east'], goal: 'the University opens' },
  // more in-between goals (owner 2026-10-22)
  { id: 'cloth', at: 1250, title: 'Town of Fine Cloth', unique: ['tailor'], pool: { tailor: 0.4 }, buildings: ['tailor_stall'], goal: 'the Tailor opens a stall' },
  { id: 'healers', at: 1500, title: 'Town of Healers', unique: ['physician'], pool: { physician: 0.5 }, buildings: ['physician_booth'], goal: 'the Physician arrives' },
  { id: 'shoes', at: 1750, title: 'Well-Shod Town', unique: ['cobbler'], pool: { cobbler: 0.4 }, buildings: ['cobbler_stall'], goal: 'the Cobbler opens a stall' },
  { id: 'barrels', at: 2000, title: 'Town of Barrels', unique: ['cooper'], pool: { cooper: 0.4 }, buildings: ['cooperage'], goal: 'the Cooper opens the cooperage' },
  { id: 'north', at: 2500, title: 'Growing City', unique: ['weaver'], pool: {}, buildings: ['district_north'], goal: 'the North Ward is founded' },
  { id: 'honey', at: 3000, title: 'Town of Honey', unique: ['beekeeper'], pool: { beekeeper: 0.3 }, buildings: ['apiary'], goal: 'the first beehives arrive' },
  { id: 'bells', at: 4000, title: 'Town of Bells', unique: ['bellfounder'], pool: { bellfounder: 0.2 }, buildings: ['bell_foundry'], goal: 'the Bell Foundry casts its first bell' },
  { id: 'learned', at: 5000, title: 'City of Song', unique: ['apothecary', 'bard'], pool: { apothecary: 0.3, bard: 0.6 }, buildings: ['district_south'], goal: 'the South Ward is founded' },
  { id: 'clock', at: 7500, title: 'Town of the Clock', unique: ['clockmaker'], pool: { clockmaker: 0.2 }, buildings: ['clock_tower'], goal: 'the Clock Tower strikes the hour' },
  { id: 'royal', at: 10000, title: 'Royal City', unique: ['taxcollector', 'chronicler'], pool: { taxcollector: 0.3, chronicler: 0.2 }, buildings: ['palace', 'district_far'], goal: 'the Royal Palace is commissioned' },
  { id: 'maritime', at: 100000, title: 'Maritime Realm', unique: ['admiral'], pool: { admiral: 0.05 }, buildings: ['lighthouse'], goal: 'the Lighthouse is lit' },
  { id: 'bridge', at: 250000, title: 'Realm of the Great Bridge', unique: [], pool: {}, buildings: ['stone_bridge'], goal: 'the Great Bridge spans the river' },
  { id: 'legend', at: 1000000, title: 'Legendary Kingdom', unique: [], pool: {}, buildings: ['colossus'], goal: 'the Colossus is raised' },
];

// Buildings the owner commissions with no goal: begun on the next day the kingdom runs, whatever its size
// (saved with tier 'commission'). No tier changes, so no villager changes job.
export const COMMISSIONS = [
  'fletcher_workshop', // owner 2026-10-23: the bows and arrows of the town (the Fletcher's job is still by request only)
];

// villager index -> unique job, built once.
const UNIQUE = new Map();
for (const t of TIERS) t.unique.forEach((job, k) => UNIQUE.set(t.at - 1 + k, job));

export function tiersReached(population) {
  return TIERS.filter((t) => population >= t.at);
}

export function nextTier(population) {
  return TIERS.find((t) => population < t.at) || null;
}

/** Job for villager #index (0-based). Depends only on seed and index. */
export function jobFor(seed, index) {
  if (UNIQUE.has(index)) return mergedJob(UNIQUE.get(index));
  const pool = new Map();
  for (const t of tiersReached(index + 1)) {
    for (const [job, w] of Object.entries(t.pool)) pool.set(job, (pool.get(job) || 0) + w);
  }
  let total = 0;
  for (const w of pool.values()) total += w;
  let r = (hash(seed, 'job', index) / 4294967296) * total;
  for (const [job, w] of pool) {
    r -= w;
    if (r < 0) return mergedJob(job);
  }
  return 'peasant';
}

/** Villagers per newly built house, so the map stays readable at large counts. */
export function houseCapacity(population) {
  if (population < 100) return 1;
  if (population < 500) return 2;
  if (population < 2000) return 4;
  return 8;
}

/** The video shows the tavern interior on days with named villagers once the tavern is built. */
export function tavernScene(state) {
  return Object.keys(state.names || {}).length > 0 && state.buildings.some((b) => b.id === 'tavern' && b.status === 'done');
}
