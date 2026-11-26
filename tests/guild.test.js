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

test('owner 2026-11-26: one hall at a time at each cut, the finalists stay behind their bench, the sword in the fist', () => {
  // each shot's hall is shown only in its own time: at the cut the old one is gone
  for (const [name, , t1] of GUILD_SHOTS) {
    const { sc, t0 } = shot(name);
    sc.update(t0 + 0.1, t0, t1); assert.ok(sc.group.visible, `${name} shown in its time`);
    sc.update(t1, t0, t1); assert.ok(!sc.group.visible, `${name} still shown at the cut ${t1}`);
    sc.update(t0 - 0.1, t0, t1); assert.ok(!sc.group.visible, `${name} shown before its time`);
  }
  // the judging: who goes on raises an arm, nobody walks through the bench in front of them
  const { sc, t0, t1 } = shot('judge');
  // the craftsmen's rigs: in a bench's group, with a body group 0.62 m up
  const rigs = [];
  sc.group.traverse((o) => { if (o.isGroup && o.parent?.parent === sc.group && o.children.some((c) => c.isGroup && Math.abs(c.position.y - 0.62) < 0.1 && c.children.length > 5)) rigs.push(o); });
  assert.equal(rigs.length, 4);
  for (let t = t0; t < t1; t += 0.1) {
    sc.update(t, t0, t1);
    for (const r of rigs) assert.ok(Math.abs(r.position.z) < 0.01, `a craftsman moved toward the bench at ${t.toFixed(1)}`);
  }
  // the prize: the blacksmith's sword is held by its grip in a fist
  const cr = crafters.map((c) => (c.id === 3 ? { ...c, job: 'blacksmith' } : c.job === 'blacksmith' ? { ...c, job: 'potter' } : c));
  const m = shot('medal', 0, cr);
  for (const u of [0.3, 0.9]) {
    m.sc.update(m.t0 + u * (m.t1 - m.t0), m.t0, m.t1);
    m.sc.group.updateMatrixWorld(true);
    let blade = null;
    m.sc.group.traverse((o) => { if (!blade && o.isMesh && o.geometry.type === 'BoxGeometry' && o.geometry.parameters?.width === 0.8) blade = o; });
    assert.ok(blade, 'a sword');
    const g = blade.parent, hand = g.parent;
    const grip = g.localToWorld(new THREE.Vector3(-0.1, 0, 0)), fist = hand.getWorldPosition(new THREE.Vector3());
    assert.ok(grip.distanceTo(fist) < 0.02, `u ${u}: the grip ${grip.distanceTo(fist).toFixed(2)} m from the fist`);
  }
});

test('owner 2026-11-26: the hammer face lands on the work at each blow', async () => {
  const { contestBench } = await import('../src/render/scene/stories/masterpiece.js');
  for (const job of ['blacksmith', 'potter']) {
    const b = contestBench({ job, M: fakeMaterials(), x: 0, z: 0, i: 0, makePiece: () => new THREE.Group() });
    const head = b.tool.r.children[1];
    let low = Infinity;
    for (let t = 5; t < 5.6; t += 0.01) {
      b.update(t);
      b.group.updateMatrixWorld(true);
      const p = head.localToWorld(new THREE.Vector3(0, -0.08, 0.29)); // the face: the head's geometry sits 0.29 m out
      if (p.y < low) low = p.y;
    }
    assert.ok(Math.abs(low - 1.0) < 0.06, `${job}: the hammer face at its lowest ${low.toFixed(2)} m (the work at ~1.0 m)`);
  }
});
