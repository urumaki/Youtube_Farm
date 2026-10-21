#!/usr/bin/env node
// Plan a saved day again with today's rules (story event, villagers shown, scenes), keeping its population,
// names and buildings: node scripts/replan-day.js 2026-10-21 [--save]
// Without --save it only prints the new plan. With --save it rewrites state/history/<day>.json (and
// state/kingdom.json when it is the latest day), so `npm run render -- --day <day>` renders the new plan.
// Replacing the video already published for that day is the owner's call.
import fs from 'node:fs';
import path from 'node:path';
import { migrate, saveDay, writeAtomic, STATE_DIR } from '../src/sim/state.js';
import { planDay } from '../src/sim/simulate.js';
import { tavernScene } from '../src/sim/tiers.js';
import { pickVariant, sceneKey } from '../src/sim/scenes.js';

const date = process.argv[2];
const save = process.argv.includes('--save');
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('usage: node scripts/replan-day.js YYYY-MM-DD [--save]');
const hist = path.join(STATE_DIR, 'history');
const read = (d) => JSON.parse(fs.readFileSync(path.join(hist, `${d}.json`), 'utf8'));
const prevDate = fs.readdirSync(hist).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < date).sort().pop()?.slice(0, 10);
if (!prevDate) throw new Error(`no day saved before ${date}`);
const { state: raw, diff } = read(date);
const prev = migrate(read(prevDate).state);
const s = migrate(raw);

// what the planning knew on the morning of that day
s.storyLog = { ...(prev.storyLog || {}) };
s.storyArc = prev.storyArc ?? null;
s.lastShown = { ...(prev.lastShown || {}) };
s.sceneLog = { ...(prev.sceneLog || {}) };
if (!prev.sceneLog) {
  // saves from before the scene log: what the previous video showed (the old rule, see timeline.js)
  if (tavernScene(prev)) s.sceneLog.tavern = prev.day;
  const used = new Set();
  for (const f of (prev.featured || []).slice(0, tavernScene(prev) ? 2 : 3)) {
    const v = pickVariant(f.job, prev.seed, prev.day, f.id, used, { croft: !!f.with });
    if (v) used.add(v);
    s.sceneLog[sceneKey(f.job, v)] = prev.day;
  }
}
const before = { story: diff.story?.id ?? null, featured: (diff.featured || []).map((f) => f.name + (f.with ? ` + ${f.with.name}` : '')) };
planDay(s, prev, diff);
console.log(`[replan] ${date} (+${diff.delta} subscribers)`);
console.log(`  story:    ${before.story} -> ${diff.story ? diff.story.id + (diff.story.step ? ':' + diff.story.step : '') : null}`);
console.log(`  featured: ${before.featured.join(', ')} -> ${diff.featured.map((f) => f.name + (f.with ? ` + ${f.with.name}` : '')).join(', ')}`);
console.log(`  scenes:   ${JSON.stringify(diff.scenes)}`);
if (save) {
  const latest = JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'kingdom.json'), 'utf8')).date === date;
  if (latest) saveDay(s, diff);
  else writeAtomic(path.join(hist, `${date}.json`), JSON.stringify({ diff, state: (({ villagers, ...rest }) => rest)(s) }));
  console.log(`[replan] saved ${latest ? 'state/kingdom.json and ' : ''}state/history/${date}.json`);
}
