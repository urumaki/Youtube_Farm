// The clip check (owner 2026-11-25: no tool, hand or body through anything in a work scene).
import test from 'node:test';
import assert from 'node:assert/strict';
import { clipCheck, allScenes } from '../src/render/scene/clipcheck.js';
import { checkScene } from './helpers/scene.js';

test("the check finds the baker's peel in the oven", async () => {
  const { ws, env } = await checkScene('baker', 'oven');
  assert.ok(clipCheck(ws, { env }).some((h) => h.part === 'tool'));
});

test('the check passes a clean scene', async () => {
  const { ws, env } = await checkScene('blacksmith');
  assert.deepEqual(clipCheck(ws, { env }), []);
});

test('every scene builds under Node', () => {
  assert.ok(allScenes().length >= 100, `${allScenes().length} scenes`);
});
