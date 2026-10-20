import test from 'node:test';
import assert from 'node:assert/strict';
import { world, obstacles, heightAt, CASTLE, RIVER_HALF_WIDTH, WATER_LEVEL, MARKET } from '../src/sim/world.js';
import { obbOverlap, obbAabb, obbCorners, SpatialHash } from '../src/sim/geometry.js';

const w = world(777);

test('enough plots for a large kingdom', () => {
  assert.ok(w.plots.length >= 2400, `${w.plots.length} plots`);
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

test('plots fill outward from the market along the streets, mostly east of the castle', () => {
  const avg = (a, b) => w.plots.slice(a, b).reduce((n, p) => n + Math.hypot(p.x - MARKET.x, p.z - MARKET.z), 0) / (b - a);
  assert.ok(avg(0, 50) < avg(400, 450) && avg(400, 450) < avg(1500, 1550));
  const mains = ['approach', 'east', 'northeast', 'southeast', 'north'];
  const onMain = w.plots.slice(0, 60).filter((p) => mains.includes(p.road)).length;
  assert.ok(onMain >= 48, `the first houses line the main streets (${onMain}/60)`);
  const east = w.plots.slice(0, 1000).filter((p) => p.x > 0).length;
  assert.ok(east >= 950, `${east}/1000 east of the castle`);
});

test('world is a pure function of the seed', () => {
  const again = world(777);
  assert.equal(again, w); // memoized
  const other = world(778);
  assert.notDeepEqual(other.plots.slice(0, 50).map((p) => p.x), w.plots.slice(0, 50).map((p) => p.x));
});

test('streets never cross: every street ends free or in a T-junction', () => {
  const segs = [];
  for (const r of w.roads) for (let i = 0; i < r.pts.length - 1; i++) segs.push({ r, i, a: r.pts[i], b: r.pts[i + 1] });
  const cross = (p, q, r2, s2) => {
    const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return d(p, q, r2) * d(p, q, s2) < 0 && d(r2, s2, p) * d(r2, s2, q) < 0;
  };
  let n = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const A = segs[i], B = segs[j];
    if (A.r === B.r) continue;
    // the junction segments themselves: a lane's first segment on its parent, a T-junction's last one
    const junction = (X, Y) => (X.i === 0 && X.r.parent === Y.r.id) || (X.i === X.r.pts.length - 2 && X.r.joined === Y.r.id);
    if (junction(A, B) || junction(B, A)) continue;
    if (Math.abs(A.a[0] - B.a[0]) > 40 || Math.abs(A.a[1] - B.a[1]) > 40) continue;
    if (cross(A.a, A.b, B.a, B.b)) n++;
  }
  assert.equal(n, 0, `${n} street crossings`);
});

test('guard scenes vary by day and two guards never share one', async () => {
  const { pickVariant, VARIANTS } = await import('../src/render/scene/timeline.js');
  assert.equal(pickVariant('jester', 1, 3, 4), null);
  assert.ok(!['walls', 'sparring'].includes(pickVariant('guard', 1, 3, 4, new Set(), { croft: true }))); // a host stays home
  const seen = new Set();
  for (let day = 1; day <= 30; day++) {
    const a = pickVariant('guard', 42, day, 7);
    assert.equal(a, pickVariant('guard', 42, day, 7)); // deterministic
    assert.ok(VARIANTS.guard.includes(a));
    assert.notEqual(pickVariant('knight', 42, day, 9, new Set([a])), a);
    seen.add(a);
  }
  assert.equal(seen.size, VARIANTS.guard.length);
});
