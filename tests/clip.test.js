// The clip check (owner 2026-11-25: no tool, hand or body through anything in a work scene).
import test from 'node:test';
import assert from 'node:assert/strict';
import { clipCheck, allScenes } from '../src/render/scene/clipcheck.js';
import * as THREE from 'three';
import { checkScene } from './helpers/scene.js';

test("the baker's peel goes into the oven's mouth", async () => {
  const { ws, env } = await checkScene('baker', 'oven');
  assert.deepEqual(clipCheck(ws, { env }), []);
  // at the farthest reach of a stroke the peel's far edge is inside the mouth's opening
  const mouth = ws.room.userData.mouth;
  assert.ok(mouth, 'the bakehouse marks its oven mouth');
  let best = null;
  for (let t = 0; t < 4; t += 0.05) {
    ws.update(t, true);
    ws.group.updateMatrixWorld(true);
    const end = ws.tool.userData.end.getWorldPosition(new THREE.Vector3());
    if (!best || end.x > best.x) best = end; // the room's +x is toward the oven (away = PI/2 in checkScene)
  }
  assert.ok(mouth.containsPoint(best), `peel's end at ${best.toArray()} not in ${mouth.min.toArray()}..${mouth.max.toArray()}`);
});

test('the check passes a clean scene', async () => {
  const { ws, env } = await checkScene('blacksmith');
  assert.deepEqual(clipCheck(ws, { env }), []);
});

test('every scene builds under Node', () => {
  assert.ok(allScenes().length >= 100, `${allScenes().length} scenes`);
});
