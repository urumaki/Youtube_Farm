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
