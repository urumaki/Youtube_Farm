// The chimney sweep at work inside a house (owner 2026-10-23): a room with a big open fireplace, the sweep standing
// in it and pushing the brush up the flue, soot falling on him; a table, a stool, a window with daylight, a dust
// sheet on the floor. The room stands at the sweep's croft but is only seen during the shot (the camera is inside,
// like the bakehouse in bakery.js: own camera, wide lens, a hard cut in and out). A pure function of t.
import * as THREE from 'three';
import { Builder, boxGeo, cylGeo } from './kit.js';
import { buildWorkScene } from './work.js';

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// Room frame: origin at the sweep's spot on the floor, +z toward the camera; the fireplace in the back wall (-z)
const X0 = -2.7, X1 = 2.7, Z0 = -0.75, Z1 = 4.0, CEIL = 3.0, WALL = 0.2;
const FIRE = { hw: 1.05, depth: 0.95, h: 2.15 }; // the opening of the fireplace, from the back wall
export const FOV = 70;

export function buildSweepRoom({ variant, anchor, away, M, seed, id, heightAt }) {
  const room = new THREE.Group();
  const yaw = Math.atan2(Math.cos(away), Math.sin(away)); // local +z along `away`
  room.rotation.y = yaw;
  room.position.copy(anchor);
  room.updateMatrixWorld(true);
  let hi = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) {
    room.localToWorld(v.set(X0 + (X1 - X0) * (i / 4), 0, Z0 + (Z1 - Z0) * (k / 4)));
    hi = Math.max(hi, heightAt(v.x, v.z));
  }
  room.position.y = hi + 0.12;
  room.updateMatrixWorld(true);
  const toWorld = (x, y, z) => room.localToWorld(new THREE.Vector3(x, y, z));

  const mats = { ...M, daylight: new THREE.MeshBasicMaterial({ color: '#dfe8ef' }), sooty: new THREE.MeshStandardMaterial({ color: '#1d1a19', roughness: 1 }) };
  const b = new Builder();
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  b.add('woodDark', boxGeo(W, 0.06, D, 2), cx, -0.03, cz);
  for (const x of [X0 - WALL / 2, X1 + WALL / 2]) b.add('plaster', boxGeo(WALL, CEIL, D + 2 * WALL), x, CEIL / 2, cz);
  for (const z of [Z0 - WALL / 2, Z1 + WALL / 2]) b.add('plaster', boxGeo(W, CEIL, WALL), cx, CEIL / 2, z);
  b.add('plaster', boxGeo(W + 2 * WALL, 0.12, D + 2 * WALL), cx, CEIL + 0.06, cz);
  for (let z = Z0 + 0.8; z < Z1; z += 1.3) b.add('woodDark', boxGeo(W, 0.2, 0.22), cx, CEIL - 0.1, z);
  for (const x of [X0 + 0.05, X1 - 0.05]) for (const z of [Z0 + 0.05, Z1 - 0.05]) b.add('woodDark', boxGeo(0.18, CEIL, 0.18), x, CEIL / 2, z);
  // the fireplace: stone jambs, a mantel beam, the chimney breast up to the ceiling, the back black with soot, cold ashes
  for (const s of [-1, 1]) b.add('stone', boxGeo(0.35, FIRE.h, FIRE.depth), s * (FIRE.hw + 0.17), FIRE.h / 2, Z0 + FIRE.depth / 2);
  b.add('woodDark', boxGeo(2 * FIRE.hw + 0.9, 0.24, 0.3), 0, FIRE.h + 0.12, Z0 + FIRE.depth - 0.1);
  b.add('stone', boxGeo(2 * FIRE.hw + 0.7, CEIL - FIRE.h - 0.24, FIRE.depth), 0, (CEIL + FIRE.h + 0.24) / 2, Z0 + FIRE.depth / 2);
  b.add('sooty', boxGeo(2 * FIRE.hw, FIRE.h, 0.04), 0, FIRE.h / 2, Z0 + 0.02);
  b.add('stoneDark', boxGeo(2 * FIRE.hw + 0.7, 0.06, FIRE.depth + 0.35), 0, 0.03, Z0 + (FIRE.depth + 0.35) / 2);
  b.add('stoneDark', new THREE.SphereGeometry(0.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, 0.35, 1), 0.55, 0.06, Z0 + 0.4); // the ashes
  for (const x of [-0.45, 0.15]) b.add('iron', boxGeo(0.06, 0.25, 0.5), x, 0.15, Z0 + 0.45); // the firedogs
  // the dust sheet in front, a table and a stool pushed aside, a window with daylight, a jug on the table
  b.add('gear', boxGeo(2.2, 0.02, 1.1), 0, 0.02, Z0 + FIRE.depth + 0.75);
  b.add('wood', boxGeo(1.3, 0.07, 0.75), X0 + 0.9, 0.76, Z1 - 1.2);
  for (const dx of [-0.55, 0.55]) for (const dz of [-0.3, 0.3]) b.add('woodDark', boxGeo(0.07, 0.74, 0.07), X0 + 0.9 + dx, 0.37, Z1 - 1.2 + dz);
  b.add('clay', cylGeo(0.08, 0.1, 0.24, 10), X0 + 0.7, 0.92, Z1 - 1.25);
  b.add('wood', cylGeo(0.2, 0.2, 0.05, 10), X0 + 1.9, 0.45, Z1 - 0.9);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; b.add('woodDark', cylGeo(0.025, 0.03, 0.44, 5), X0 + 1.9 + Math.cos(a) * 0.13, 0.22, Z1 - 0.9 + Math.sin(a) * 0.13); }
  b.add('daylight', boxGeo(0.04, 1.0, 0.9), X1 - 0.01, 1.7, Z0 + 2.4);
  for (const y of [1.2, 2.2]) b.add('woodDark', boxGeo(0.1, 0.08, 1.1), X1 - 0.05, y, Z0 + 2.4);
  b.add('woodDark', boxGeo(0.1, 1.0, 0.07), X1 - 0.05, 1.7, Z0 + 2.4);
  // the sweep's spare brushes and a soot sack by the fireplace
  b.add('gear', new THREE.SphereGeometry(0.3, 10, 8).scale(1, 1.3, 0.85), -FIRE.hw - 0.75, 0.38, Z0 + FIRE.depth + 0.3);
  b.add('woodDark', cylGeo(0.02, 0.02, 1.9, 5).rotateZ(0.12), -FIRE.hw - 0.4, 0.95, Z0 + FIRE.depth + 0.15);
  b.add('gear', new THREE.SphereGeometry(0.18, 10, 8).scale(1, 0.6, 1), -FIRE.hw - 0.52, 1.88, Z0 + FIRE.depth + 0.15);
  room.add(b.build(mats));

  const lights = [
    { l: new THREE.PointLight('#dfe6ee', 0, 9, 1.4), p: [X1 - 1.0, 1.9, Z0 + 2.4], i: 9 }, // daylight from the window
    { l: new THREE.PointLight('#ffd7a0', 0, 8, 1.6), p: [0.3, CEIL - 0.5, Z1 - 1.2], i: 5 },
  ];
  for (const { l, p } of lights) { l.position.set(...p); l.visible = false; room.add(l); }

  // the sweep, side on in the fireplace, pushing the brush up the flue
  const ws = buildWorkScene({ job: 'chimneysweep', variant, anchor: toWorld(0, 0, Z0 + 0.45), face: yaw + Math.PI / 2, M, seed, id });
  room.attach(ws.group);
  const cam = (u) => {
    const k = ease(u);
    return { pos: toWorld(THREE.MathUtils.lerp(1.3, 0.8, k), THREE.MathUtils.lerp(1.65, 1.5, k), THREE.MathUtils.lerp(Z1 - 0.35, Z1 - 0.9, k)), look: toWorld(0, 1.45, Z0 + 0.4), fov: FOV };
  };
  room.visible = false;
  return {
    ...ws,
    group: new THREE.Group(), // the sweep is part of the room
    room,
    cam,
    floorAt: () => room.position.y,
    focus: toWorld(0, 1.3, Z0 + 0.45),
    labelPos: toWorld(0, 2.5, Z0 + 0.9),
    update(t, inside) {
      room.visible = !!inside;
      ws.update(t);
      for (const { l, i } of lights) {
        l.visible = !!inside;
        l.intensity = inside ? i : 0;
      }
    },
  };
}

// A lecture at the University (owner 2026-10-29): the named scholar teaches from the front of a classroom, before a slate
// with chalk diagrams, pointing and gesturing; six scholars in their caps on two benches listen, write in their books
// and now and then one raises a hand. Tall windows with daylight on one side. Like the sweep's room: it stands at the
// scholar's place and is only seen during the shot (own camera from the back of the room, a hard cut in and out).
const L = { X0: -3.6, X1: 3.6, Z0: -1.4, Z1: 6.0, CEIL: 4.0 };

export function buildLectureRoom({ variant, anchor, away, M, seed, id, heightAt, rig, color }) {
  const { X0, X1, Z0, Z1, CEIL } = L;
  const room = new THREE.Group();
  const yaw = Math.atan2(Math.cos(away), Math.sin(away)); // local +z along `away`, toward the camera
  room.rotation.y = yaw;
  room.position.copy(anchor);
  room.updateMatrixWorld(true);
  let hi = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) {
    room.localToWorld(v.set(X0 + (X1 - X0) * (i / 4), 0, Z0 + (Z1 - Z0) * (k / 4)));
    hi = Math.max(hi, heightAt(v.x, v.z));
  }
  room.position.y = hi + 0.12;
  room.updateMatrixWorld(true);
  const toWorld = (x, y, z) => room.localToWorld(new THREE.Vector3(x, y, z));

  const mats = { ...M, daylight: new THREE.MeshBasicMaterial({ color: '#dfe8ef' }), chalk: new THREE.MeshBasicMaterial({ color: '#e9e6dc' }) };
  const b = new Builder();
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  b.add('woodDark', boxGeo(W, 0.06, D, 2), cx, -0.03, cz);
  for (const x of [X0 - WALL / 2, X1 + WALL / 2]) b.add('stone', boxGeo(WALL, CEIL, D + 2 * WALL), x, CEIL / 2, cz);
  for (const z of [Z0 - WALL / 2, Z1 + WALL / 2]) b.add('stone', boxGeo(W, CEIL, WALL), cx, CEIL / 2, z);
  b.add('plaster', boxGeo(W + 2 * WALL, 0.12, D + 2 * WALL), cx, CEIL + 0.06, cz);
  for (let z = Z0 + 0.9; z < Z1; z += 1.5) b.add('woodDark', boxGeo(W, 0.24, 0.26), cx, CEIL - 0.12, z);
  // the master's dais, the lectern with an open book, the slate on the front wall with chalk circles and lines
  b.add('wood', boxGeo(4.2, 0.18, 1.6), 0, 0.09, Z0 + 0.8);
  b.add('woodDark', boxGeo(0.55, 1.05, 0.45), -1.0, 0.7, -0.15);
  b.add('woodDark', boxGeo(0.7, 0.05, 0.55).rotateX(0.35), -1.0, 1.25, -0.15);
  b.add('clothIvory', boxGeo(0.5, 0.03, 0.38).rotateX(0.35), -1.0, 1.29, -0.15);
  b.add('woodDark', boxGeo(3.4, 1.6, 0.08), 0, 2.15, Z0 + 0.04);
  b.add('stoneDark', boxGeo(3.2, 1.4, 0.04), 0, 2.15, Z0 + 0.09);
  b.add('chalk', new THREE.TorusGeometry(0.42, 0.012, 4, 32), -0.8, 2.2, Z0 + 0.12);
  b.add('chalk', new THREE.TorusGeometry(0.2, 0.012, 4, 24), -0.8, 2.2, Z0 + 0.12);
  b.add('chalk', boxGeo(0.95, 0.02, 0.01).rotateZ(0.5), -0.8, 2.2, Z0 + 0.12);
  for (let i = 0; i < 4; i++) b.add('chalk', boxGeo(0.9 - i * 0.12, 0.02, 0.01), 0.75, 2.55 - i * 0.22, Z0 + 0.12);
  b.add('chalk', boxGeo(0.02, 0.6, 0.01), 0.35, 1.95, Z0 + 0.12);
  // two rows of benches with a writing board in front, books open on them
  const rows = [2.3, 3.9], seats = [-1.7, 0, 1.7];
  for (const z of rows) {
    b.add('wood', boxGeo(5.6, 0.07, 0.4), 0, 0.45, z + 0.1);
    for (const x of [-2.6, 0, 2.6]) b.add('woodDark', boxGeo(0.08, 0.45, 0.35), x, 0.22, z + 0.1);
    b.add('wood', boxGeo(5.6, 0.05, 0.5).rotateX(0.18), 0, 0.78, z - 0.55);
    for (const x of [-2.6, 0, 2.6]) b.add('woodDark', boxGeo(0.08, 0.76, 0.4), x, 0.38, z - 0.55);
    for (const x of seats) b.add('clothIvory', boxGeo(0.42, 0.03, 0.3).rotateX(0.18), x, 0.82, z - 0.55);
  }
  // tall windows with daylight down the right wall, a candle stand by the lectern
  for (const z of [0.8, 3.1, 5.0]) {
    b.add('daylight', boxGeo(0.04, 1.8, 0.8), X1 - 0.01, 2.2, z);
    for (const y of [1.3, 3.1]) b.add('woodDark', boxGeo(0.1, 0.08, 1.0), X1 - 0.05, y, z);
    b.add('woodDark', boxGeo(0.1, 1.8, 0.06), X1 - 0.05, 2.2, z);
  }
  b.add('iron', cylGeo(0.03, 0.03, 1.3, 6), -1.75, 0.65, -0.3);
  b.add('clothIvory', cylGeo(0.04, 0.04, 0.2, 8), -1.75, 1.4, -0.3);
  b.add('flame', new THREE.ConeGeometry(0.03, 0.08, 6), -1.75, 1.54, -0.3);
  room.add(b.build(mats));

  const lights = [
    { l: new THREE.PointLight('#dfe6ee', 0, 12, 1.3), p: [X1 - 1.0, 2.4, 1.6], i: 11 }, // daylight from the windows
    { l: new THREE.PointLight('#dfe6ee', 0, 12, 1.3), p: [X1 - 1.0, 2.4, 4.2], i: 8 },
    { l: new THREE.PointLight('#ffd7a0', 0, 7, 1.6), p: [-1.6, 1.8, 0.1], i: 4 },
  ];
  for (const { l, p } of lights) { l.position.set(...p); l.visible = false; room.add(l); }

  // the students: seated scholars in their caps facing the master, writing; one raises a hand now and then
  const students = [];
  rows.forEach((z, r) => seats.forEach((x, k) => {
    const P = rig(M, color, { seated: true });
    P.root.position.set(x + (r ? 0.12 : -0.1), 0, z + 0.12);
    P.root.rotation.y = Math.PI + (x ? -Math.sign(x) * 0.12 : 0);
    room.add(P.root);
    students.push({ P, i: r * 3 + k });
  }));
  const hand = 1 + (id % 5); // which student asks a question

  // the master, standing at the front facing the class, pointing at the slate and gesturing
  const ws = buildWorkScene({ job: 'scholar', variant, anchor: toWorld(0, 0, 0.25), face: yaw, M, seed, id });
  room.attach(ws.group);
  const cam = (u) => {
    const k = ease(u);
    return { pos: toWorld(THREE.MathUtils.lerp(1.0, 0.55, k), THREE.MathUtils.lerp(2.35, 2.1, k), THREE.MathUtils.lerp(Z1 - 0.6, 3.3, k)), look: toWorld(-0.1, 1.6, 0.25), fov: FOV };
  };
  room.visible = false;
  return {
    ...ws,
    group: new THREE.Group(), // the master is part of the room
    room,
    cam,
    floorAt: () => room.position.y,
    focus: toWorld(0, 1.4, 0.25),
    labelPos: toWorld(0, 2.75, 0.4),
    update(t, inside) {
      room.visible = !!inside;
      ws.update(t);
      for (const { P, i } of students) {
        const up = i === hand && Math.sin(t * 0.7 + 1) > 0.55;
        P.r.g.rotation.set(up ? -2.9 : -1.05 + 0.08 * Math.sin(t * 5 + i), 0, up ? 0.1 : 0.05 * Math.sin(t * 3 + i));
        P.l.g.rotation.set(-0.95, 0, 0);
        P.head.rotation.x = up ? -0.1 : 0.3 + 0.25 * Math.max(0, Math.sin(t * 0.8 + i * 1.7));
      }
      for (const { l, i } of lights) {
        l.visible = !!inside;
        l.intensity = inside ? i : 0;
      }
    },
  };
}
