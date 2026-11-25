// The guild contest's second day (owner 2026-11-25): each craftsman makes a masterpiece for the King, not the everyday work,
// and the King pins a rosette on the winner (stories/guild.js, stories/masterpiece.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildGuild, GUILD_SHOTS } from '../src/render/scene/stories/guild.js';
import { fakeMaterials } from './helpers/scene.js';

const crafters = [{ id: 1, name: 'A', job: 'carpenter' }, { id: 2, name: 'B', job: 'fletcher' }, { id: 3, name: 'C', job: 'baker' }, { id: 4, name: 'D', job: 'blacksmith' }];
const shot = (name, award = 0, cr = crafters) => {
  const [, t0, t1] = GUILD_SHOTS.find((s) => s[0] === name);
  const sc = buildGuild({ story: { shot: name, crafters: cr, finalists: [3, 2], winner: 3, task: 'x', award }, M: fakeMaterials(), seed: 7, state: { day: 42 } });
  return { sc, t0, t1 };
};
const finite = (o) => { let ok = true; o.traverse((m) => { for (const v of [m.position, m.rotation, m.scale]) if (![v.x, v.y, v.z].every(Number.isFinite)) ok = false; }); return ok; };

test('the contest benches: a masterpiece that grows, not the everyday work scene', () => {
  for (const job of ['carpenter', 'fletcher', 'baker', 'blacksmith', 'potter']) {
    const cr = crafters.map((c, i) => (i === 0 ? { ...c, job } : c));
    const { sc, t0, t1 } = shot('work', 0, cr);
    for (let t = t0; t <= t1; t += 0.1) { sc.update(t, t0, t1); assert.ok(finite(sc.group), `${job}: a NaN at ${t}`); }
  }
  // the hands move: the work is not a still pose
  const { sc, t0, t1 } = shot('work');
  const at = (t) => { sc.update(t, t0, t1); sc.group.updateMatrixWorld(true); const p = []; sc.group.traverse((o) => { if (o.isMesh && o.parent?.parent?.parent && o.geometry.type === 'SphereGeometry') p.push(o.getWorldPosition(new THREE.Vector3()).toArray().join()); }); return p.join('|'); };
  assert.notEqual(at(5.0), at(5.3));
});

test('the prize-giving: the rosette ends pinned on the winner, every award', () => {
  for (const award of [0, 1, 2]) {
    const { sc, t0, t1 } = shot('medal', award);
    for (let t = t0; t <= t1 + 1e-9; t += 0.05) {
      sc.update(t, t0, t1);
      assert.ok(finite(sc.group), `award ${award}: a NaN at ${t.toFixed(2)}`);
    }
    // the rosette at the end sits on a body, about chest high (~1.25 m), in front of the winner's bench
    sc.group.updateMatrixWorld(true);
    let ros = null;
    sc.group.traverse((o) => { if (!ros && o.isGroup && o.children.length >= 19 && o.children.slice(0, 16).every((c) => c.geometry?.type === 'BoxGeometry')) ros = o; });
    assert.ok(ros, 'a rosette in the hall');
    const p = sc.group.worldToLocal(ros.getWorldPosition(new THREE.Vector3()));
    assert.ok(p.y > 1.1 && p.y < 1.45, `award ${award}: rosette at height ${p.y.toFixed(2)}`);
    assert.ok(Math.abs(p.x - 1.8) < 0.35, `award ${award}: rosette at x ${p.x.toFixed(2)} (winner's bench at 1.8)`);
  }
});
