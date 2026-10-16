import test from 'node:test';
import assert from 'node:assert/strict';
import { world, obstacles, heightAt, CASTLE, RIVER_HALF_WIDTH, WATER_LEVEL } from '../src/sim/world.js';
import { obbOverlap, obbAabb, obbCorners, SpatialHash } from '../src/sim/geometry.js';

const w = world(777);

test('enough plots for a large kingdom', () => {
  assert.ok(w.plots.length >= 4000, `${w.plots.length} plots`);
});

test('no two plots overlap', () => {
  const grid = new SpatialHash(40);
  for (const p of w.plots) {
    for (const q of grid.query(obbAabb(p))) assert.ok(!obbOverlap(p, q), `plot ${p.id} overlaps plot ${q.id}`);
    grid.insert(obbAabb(p), p);
  }
});

test('plots avoid roads, reserved lots, walls, fields, the river and the moat', () => {
  const grid = new SpatialHash(40);
  for (const o of obstacles(w)) grid.insert(obbAabb(o.box), o);
  for (const p of w.plots) {
    for (const o of grid.query(obbAabb(p))) assert.ok(!obbOverlap(p, o.box), `plot ${p.id} overlaps ${o.kind}`);
    for (const [x, z] of obbCorners(p)) {
      assert.ok(w.river.dist(x, z) > RIVER_HALF_WIDTH + 4, `plot ${p.id} in river`);
      assert.ok(Math.hypot(x, z) > CASTLE.moatOuter + 4, `plot ${p.id} in moat`);
      assert.ok(heightAt(w, x, z) > WATER_LEVEL + 0.5, `plot ${p.id} corner under water`);
    }
  }
});

test('plots fill outward from the gate, mostly east of the castle', () => {
  const d = w.plots.map((p) => Math.hypot(p.x - CASTLE.moatOuter, p.z));
  assert.ok(d[0] < d[500] && d[500] < d[2000]);
  const east = w.plots.slice(0, 1000).filter((p) => p.x > 0).length;
  assert.ok(east >= 950, `${east}/1000 east of the castle`);
});

test('world is a pure function of the seed', () => {
  const again = world(777);
  assert.equal(again, w); // memoized
  const other = world(778);
  assert.notDeepEqual(other.plots.slice(0, 50).map((p) => p.x), w.plots.slice(0, 50).map((p) => p.x));
});
