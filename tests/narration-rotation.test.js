// Owner 2026-11-25 (docs/superpowers/specs/2026-11-25-narration-rotation-design.md): from 2026-11-26 the routine lines of
// the narration take turns, and the words freed go to what is on screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScript } from '../src/audio/narration.js';
import { migrate } from '../src/sim/state.js';

const saved = (date) => JSON.parse(fs.readFileSync(new URL(`../state/history/${date}.json`, import.meta.url)));

test('old days read the same (owner 2026-11-25: the change starts 2026-11-26)', () => {
  const before = JSON.parse(fs.readFileSync(new URL('./fixtures/narration-before.json', import.meta.url)));
  for (const [date, text] of Object.entries(before)) {
    const { state, diff } = saved(date);
    assert.equal(buildScript(migrate(state), diff, { shots: [] }).text, text, date);
  }
});

test('routine lines take turns by day', async () => {
  const { routineRoles, turn, NARRATION_FROM } = await import('../src/audio/rotation.js');
  assert.equal(NARRATION_FROM, '2026-11-26');
  const roles = (d) => [...routineRoles(d)].sort();
  const next = { remaining: 90 };
  assert.deepEqual(roles({ day: 40, next }), ['newcomers', 'open']);
  assert.deepEqual(roles({ day: 41, next }), ['comment', 'newcomers']);
  assert.deepEqual(roles({ day: 42, next }), ['comment', 'goal']);
  assert.deepEqual(roles({ day: 43, next }), ['goal', 'open']);
  assert.deepEqual(roles({ day: 42, next: null }), ['comment', 'open']); // no goal left: the next two
  assert.deepEqual(roles({ day: 40, next: { remaining: 20 } }), ['goal', 'newcomers', 'open']); // about to be reached: news
  assert.equal(turn(['a', 'b', 'c'], 7), 'b');
  for (let d = 0; d < 6; d++) assert.notEqual(turn(['a', 'b', 'c'], d), turn(['a', 'b', 'c'], d + 1));
});

test('the new lines cover every job and story, and fit their shots', async () => {
  const { MORE, CARAVAN_QUIET, WISH, WORK, PAYOFF } = await import('../src/audio/lines.js');
  const { STORY_CUES, BASE_POOLS, spokenLength } = await import('../src/audio/narration.js');
  const { JOBS } = await import('../src/sim/tiers.js');
  for (const j of Object.keys(JOBS)) assert.ok(WORK[j]?.length >= 2, `WORK.${j}`);
  for (const c of STORY_CUES) assert.ok(PAYOFF[c]?.length >= 1, `PAYOFF.${c}`);
  const all = [];
  for (const [k, lines] of Object.entries(WORK)) for (const l of lines) { all.push(l); assert.ok(spokenLength(l) <= 2.2, `WORK.${k}: ${l} (${spokenLength(l).toFixed(2)})`); }
  for (const [k, lines] of Object.entries(PAYOFF)) for (const l of lines) { all.push(l); assert.ok(spokenLength(l) <= 3.2, `PAYOFF.${k}: ${l}`); }
  for (const l of CARAVAN_QUIET) { all.push(l); assert.ok(spokenLength(l) <= 4.0, l); }
  for (const w of WISH) { all.push(w('blacksmith')); assert.ok(spokenLength(w('blacksmith')) <= 2.4, w('blacksmith')); }
  const size = (k) => BASE_POOLS[k].length + MORE[k].length;
  assert.ok(size('cta') >= 6 && size('comment') >= 6 && size('goal') >= 4 && size('open') >= 4 && size('tavern') >= 4, 'pool sizes');
  for (const k of ['chapel', 'cathedral']) assert.ok(BASE_POOLS.church[k].length + MORE.church[k].length >= 4, k);
  for (const k of Object.keys(BASE_POOLS.weather)) assert.ok(1 + MORE.weather[k].length >= 4, k);
  assert.ok(CARAVAN_QUIET.length >= 8 && WISH.length >= 3);
  all.push(...MORE.comment, ...MORE.cta, ...MORE.tavern, ...MORE.open.map((f) => f({ day: 42 })), ...MORE.goal.map((f) => f(90, 'the Dungeon opens')));
  for (const l of all) assert.doesNotMatch(l, /wizard|witch|spell|magic|\$\{|undefined/i, l);
});
