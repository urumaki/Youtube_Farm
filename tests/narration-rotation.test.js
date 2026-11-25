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
