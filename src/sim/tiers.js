// Population thresholds that unlock jobs and buildings.
// `unique` jobs go to the villagers who arrive exactly at the threshold (in order);
// `pool` jobs can be drawn by any later villager, weighted.
import { hash } from './prng.js';

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
  alchemist: { label: 'Alchemist', color: '#6b3fa0' },
  bard: { label: 'Bard', color: '#d1603d' },
  noble: { label: 'Noble', color: '#5b2a86' },
  chronicler: { label: 'Chronicler', color: '#55443a' },
  admiral: { label: 'Admiral', color: '#0f3057' },
};

export const BUILDINGS = {
  well: { label: 'the Well', days: 0 },
  fields: { label: 'the Fields', days: 0 },
  sawmill: { label: 'the Sawmill', days: 1 },
  dock: { label: 'the Fishing Dock', days: 1 },
  forge: { label: 'the Forge', days: 1 },
  bakery: { label: 'the Bakery', days: 1 },
  guardposts: { label: 'the Wall Guard', days: 0 },
  quarry: { label: 'the Quarry', days: 1 },
  market: { label: 'the Market Square', days: 2 },
  tavern: { label: 'the Tavern', days: 2 },
  chapel: { label: 'the Chapel', days: 3 },
  windmill: { label: 'the Windmill', days: 2 },
  wall2: { label: 'the Second Wall', days: 7 },
  townhall: { label: 'the Town Hall', days: 5 },
  harbor: { label: 'the Harbor', days: 7 },
  cathedral: { label: 'the Cathedral', days: 21 },
  tournament: { label: 'the Tournament Ground', days: 5 },
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
  { id: 'walled', at: 250, title: 'Walled Town', unique: ['reeve', 'carpenter'], pool: { carpenter: 1.2, guard: 1 }, buildings: ['wall2', 'townhall'], goal: 'the Second Wall rises' },
  { id: 'harbor', at: 500, title: 'Harbor Town', unique: ['bishop', 'knight', 'sailor'], pool: { sailor: 1.5, knight: 0.5 }, buildings: ['harbor', 'cathedral', 'tournament'], goal: 'the Harbor opens' },
  { id: 'charter', at: 1000, title: 'Chartered City', unique: ['mayor', 'scholar'], pool: { scholar: 0.6, weaver: 1.2 }, buildings: ['charter_stone', 'district_east'], goal: 'the Town Charter is signed' },
  { id: 'north', at: 2500, title: 'Growing City', unique: ['physician', 'weaver'], pool: { physician: 0.5 }, buildings: ['district_north'], goal: 'the North Ward is founded' },
  { id: 'learned', at: 5000, title: 'City of Learning', unique: ['alchemist', 'bard'], pool: { alchemist: 0.3, bard: 0.6 }, buildings: ['university', 'district_south'], goal: 'the University opens' },
  { id: 'royal', at: 10000, title: 'Royal City', unique: ['noble', 'chronicler'], pool: { noble: 0.3, chronicler: 0.2 }, buildings: ['palace', 'district_far'], goal: 'the Royal Palace is commissioned' },
  { id: 'maritime', at: 100000, title: 'Maritime Realm', unique: ['admiral'], pool: { admiral: 0.05 }, buildings: ['lighthouse'], goal: 'the Lighthouse is lit' },
  { id: 'legend', at: 1000000, title: 'Legendary Kingdom', unique: [], pool: {}, buildings: ['colossus'], goal: 'the Colossus is raised' },
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
  if (UNIQUE.has(index)) return UNIQUE.get(index);
  const pool = new Map();
  for (const t of tiersReached(index + 1)) {
    for (const [job, w] of Object.entries(t.pool)) pool.set(job, (pool.get(job) || 0) + w);
  }
  let total = 0;
  for (const w of pool.values()) total += w;
  let r = (hash(seed, 'job', index) / 4294967296) * total;
  for (const [job, w] of pool) {
    r -= w;
    if (r < 0) return job;
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
