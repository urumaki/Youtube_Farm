// Persistence: load/migrate/validate state, atomic writes, daily history snapshots.
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_VERSION, genesis, advance, deriveVillagers, withNameFields, DEFAULT_SEED } from './simulate.js';
import { validate } from './validate.js';
import { mergedJob } from './tiers.js';

export const STATE_DIR = path.resolve('state');
const SCHEMA = JSON.parse(fs.readFileSync(new URL('./kingdom.schema.json', import.meta.url), 'utf8'));

/** Migrations from version N to N+1. Version 0 is a hand-written bootstrap file. */
export const MIGRATIONS = {
  // v0: {"subscribers": 120, "seed"?: 42, "date"?: "2026-01-01"} -> a full v1 state built by simulating one day.
  0: (old) => {
    const base = genesis({ seed: old.seed ?? DEFAULT_SEED, date: old.date ?? '1970-01-01' });
    if (!old.subscribers) return base;
    const { state } = advance(base, { subscribers: old.subscribers, date: old.date ?? '1970-01-01', source: 'bootstrap' });
    return state;
  },
};

export function migrate(raw) {
  let s = raw;
  let v = s.schemaVersion ?? 0;
  if (v > SCHEMA_VERSION) throw new Error(`state schemaVersion ${v} is newer than this code (${SCHEMA_VERSION})`);
  while (v < SCHEMA_VERSION) {
    if (!MIGRATIONS[v]) throw new Error(`no migration from schemaVersion ${v}`);
    s = MIGRATIONS[v](s);
    v = s.schemaVersion;
  }
  withNameFields(s);
  // jobs folded into another (MERGED in tiers.js): named villagers, waiting requests and stored villagers
  for (const n of Object.values(s.names || {})) { n.job &&= mergedJob(n.job); n.wants &&= mergedJob(n.wants); }
  for (const q of s.nameQueue || []) if (Array.isArray(q.wants)) q.wants = [...new Set(q.wants.map(mergedJob))];
  if (!Array.isArray(s.villagers)) s.villagers = deriveVillagers(s); // compact snapshots
  else for (const v of s.villagers) if (v) v.job = mergedJob(v.job);
  const errors = validate(SCHEMA, s);
  if (errors.length) throw new Error('invalid state: ' + errors.slice(0, 5).join('; '));
  return s;
}

export function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

export function loadState(file) {
  return migrate(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function snapshot(state) {
  const { villagers, ...rest } = state; // villagers are derived from houses + seed on load
  return rest;
}

/** Latest saved state strictly before `date` (to re-run a day reproducibly), or genesis. */
export function baseStateFor(date, { dir = STATE_DIR, seed } = {}) {
  const hist = path.join(dir, 'history');
  const days = fs.existsSync(hist) ? fs.readdirSync(hist).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
  const prev = days.filter((f) => f.slice(0, 10) < date).pop();
  if (prev) return migrate(JSON.parse(fs.readFileSync(path.join(hist, prev), 'utf8')).state);
  const cur = path.join(dir, 'kingdom.json');
  if (fs.existsSync(cur)) {
    const s = loadState(cur);
    if (s.date < date) return s;
  }
  return genesis({ seed: seed ?? DEFAULT_SEED, date });
}

export function lastKnownCount({ dir = STATE_DIR } = {}) {
  const cur = path.join(dir, 'kingdom.json');
  return fs.existsSync(cur) ? JSON.parse(fs.readFileSync(cur, 'utf8')).subscriberCount ?? 0 : 0;
}

export function saveDay(state, diff, { dir = STATE_DIR } = {}) {
  writeAtomic(path.join(dir, 'kingdom.json'), JSON.stringify(state, null, 1));
  writeAtomic(path.join(dir, 'history', `${state.date}.json`), JSON.stringify({ diff, state: snapshot(state) }));
}

export { SCHEMA_VERSION };
