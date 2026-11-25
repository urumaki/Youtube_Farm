// The villagers' rig at work (owner 2026-11-25): elbows, knees with the feet planted, breathing, strokes that vary, pauses.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rig } from '../src/render/scene/work.js';
import { fakeMaterials, workScene } from './helpers/scene.js';

const wp = (o) => { o.updateWorldMatrix(true, false); return o.getWorldPosition(new THREE.Vector3()); };

test('rest pose matches the old rig', () => {
  const P = rig(fakeMaterials(), '#7a6a55');
  P.root.updateMatrixWorld(true);
  for (const [s, x] of [[P.r, 0.3], [P.l, -0.3]]) {
    const h = wp(s.hand);
    assert.ok(h.distanceTo(new THREE.Vector3(x, 0.62 + 0.8 - 0.66, 0)) < 1e-6, `hand at ${h.toArray()}`);
  }
  assert.equal(P.legs2.length, 2);
  for (const L of P.legs2) {
    const f = wp(L.foot);
    assert.ok(f.distanceTo(new THREE.Vector3(L.x, 0.06, 0)) < 1e-6, `ankle at ${f.toArray()}`);
  }
});

test('feet stay planted', () => {
  for (const [job, v] of [['baker', 'oven'], ['blacksmith', null], ['farmer', null]]) {
    const ws = workScene(job, v);
    let first = null;
    for (let t = 0; t <= 12; t += 0.05) {
      ws.update(t);
      ws.group.updateMatrixWorld(true);
      const feet = ws.rig.legs2.map((L) => wp(L.foot));
      first ??= feet.map((f) => f.clone());
      feet.forEach((f, i) => {
        assert.ok(f.distanceTo(first[i]) < 0.005, `${job}: foot ${i} slid to ${f.toArray()} at t=${t.toFixed(2)}`);
        assert.ok(Math.abs(f.y - 0.06) < 0.01, `${job}: ankle at y ${f.y} at t=${t.toFixed(2)}`);
      });
    }
  }
});

test('no sound or blow in a pause', () => {
  const ws = workScene('blacksmith');
  const hits = ws.strikeTimes(0, 30);
  assert.ok(hits.length > 10);
  for (const t of hits) assert.equal(ws.clock(t).restS, -1, `a blow at ${t} in a pause`);
  let paused = false;
  for (let t = 0; t < 30; t += 0.05) if (ws.clock(t).restS >= 0) paused = true;
  assert.ok(paused, 'no pause in 30 s');
});

test('pause shows no particles', () => {
  const ws = workScene('blacksmith');
  const hits = ws.strikeTimes(0, 30);
  let at = null;
  for (let t = 0; t < 30 && at === null; t += 0.01) {
    const c = ws.clock(t);
    const last = hits.filter((h) => h <= t).at(-1);
    if (c.restS >= 0.5 && last !== undefined && t - last > 1) at = t;
  }
  assert.ok(at !== null, 'no pause long enough after a blow');
  ws.update(at);
  const pts = ws.group.children.find((o) => o.isPoints);
  const arr = pts.geometry.attributes.position.array;
  for (let i = 0; i < arr.length; i += 3) assert.ok(arr[i] >= 1e4, `a particle in the air during the pause at ${at}`);
});

test('strokes vary', () => {
  const ws = workScene('blacksmith');
  const hits = ws.strikeTimes(0, 30);
  const gaps = new Set();
  for (let i = 1; i < hits.length; i++) {
    const g = hits[i] - hits[i - 1];
    if (g < 1.3) gaps.add(g.toFixed(2)); // a pause is over 1.4 s
  }
  assert.ok(gaps.size >= 3, `gaps ${[...gaps]}`);
});
