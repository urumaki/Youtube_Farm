// The Dungeon under the castle (owner 2026-11-04): a vaulted corridor at the foot of the stairs that come down from the
// castle courtyard, barred cells on both sides. A guard comes down the last steps with a torch held high and walks along
// the corridor toward the camera; his torch is the only warm light, so the cells light up as he passes. The prisoners (the
// commenters who asked to be a thief, a bandit, a usurper...) are comic, never hurt: one leans on the bars with his arms
// through them, one sleeps slumped against the back wall, one sits with his head in his hands, one runs a tin cup along the
// bars, one waves at the guard. 'dungeon': the guard is the named villager; 'cell': the named prisoner in the cell the
// camera looks into, the guard nameless. Like the library (room.js): the room stands under the stair head (buildings.js
// dungeon) and is only seen during the shot (own camera, a hard cut in and out). A pure function of t.
import * as THREE from 'three';
import { Builder, boxGeo, cylGeo } from './kit.js';
import { rig, nod } from './work.js';
import { person, stride, flameMaterial, flicker } from './stories/common.js';
import { JOBS } from '../../sim/tiers.js';
import { rand01 } from '../../sim/prng.js';

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// Room frame: +z toward the camera, the stairs at the back (-z). The corridor is CW either side of x 0; the cells run from
// CW out to CELL_X, four on each side, CELL long each, from z 0
const CW = 1.2, CELL_X = 3.7, CELL = 2.4, CEIL = 2.9, STAIR = { foot: -0.6, rise: 0.2, run: 0.3, steps: 16, hw: 0.9 };
const CELLS = [0, 1, 2, 3].flatMap((k) => [1, -1].map((side) => ({ side, k, z: k * CELL + CELL / 2 })));
const Z1 = 4 * CELL + 1.2;
export const FOV = 60;
// the first three cells the camera sees (the left-hand ones from the stairs) get these, the others one of POSES
const FIRST = ['bars', 'slump', 'cup'], POSES = ['wave', 'slump', 'bench', 'bars', 'cup'];

/** The height of the stairs' tread at z (0 on the corridor floor). */
const stairY = (z) => (z >= STAIR.foot ? 0 : Math.min(STAIR.steps, Math.ceil((STAIR.foot - z) / STAIR.run)) * STAIR.rise);

export function buildDungeon({ variant, anchor, away, M, seed, id, heightAt, cellmates = [], t0 = 0, t1 = t0 + 3 }) {
  const room = new THREE.Group();
  const yaw = Math.atan2(Math.cos(away), Math.sin(away)); // local +z along `away`, toward the camera
  room.rotation.y = yaw;
  room.position.copy(anchor);
  room.position.y = heightAt(anchor.x, anchor.z) + 0.12;
  room.updateMatrixWorld(true);
  const toWorld = (x, y, z) => room.localToWorld(new THREE.Vector3(x, y, z));
  const r = (k) => rand01(seed, 'dungeon', id, k);

  const mats = { ...M, daylight: new THREE.MeshBasicMaterial({ color: '#c9d6e4' }), damp: new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 1 }) };
  const b = new Builder();
  // the corridor: a flagged floor, stone walls between the cells, a low ceiling on stone ribs, the end wall behind the camera
  b.add('stoneDark', boxGeo(2 * CELL_X + 0.6, 0.1, Z1 - STAIR.foot, 3), 0, -0.05, (Z1 + STAIR.foot) / 2);
  b.add('damp', boxGeo(2 * CELL_X + 0.6, 0.2, Z1 - STAIR.foot + 0.4), 0, CEIL + 0.1, (Z1 + STAIR.foot) / 2);
  for (let k = 0; k <= 4; k++) {
    for (const s of [-1, 1]) b.add('stone', boxGeo(CELL_X - CW, CEIL, 0.3), s * (CW + CELL_X) / 2, CEIL / 2, k * CELL);
    b.add('stoneDark', boxGeo(2 * CW, 0.22, 0.32), 0, CEIL - 0.11, k * CELL); // a rib across the corridor
  }
  for (const s of [-1, 1]) {
    b.add('stone', boxGeo(0.3, CEIL, 4 * CELL + 0.3), s * (CELL_X + 0.15), CEIL / 2, 2 * CELL); // the cells' back walls
    b.add('stone', boxGeo(CW - STAIR.hw, CEIL, 0.3), s * (CW + STAIR.hw) / 2, CEIL / 2, STAIR.foot); // either side of the stairs
    b.add('stone', boxGeo(0.3, CEIL, -STAIR.foot), s * (CW + 0.15), CEIL / 2, STAIR.foot / 2); // the corridor before the cells
    b.add('stone', boxGeo(0.3, CEIL, Z1 - 4 * CELL), s * (CW + 0.15), CEIL / 2, (Z1 + 4 * CELL) / 2); // ... and after them
  }
  b.add('stone', boxGeo(2 * CW, CEIL, 0.3), 0, CEIL / 2, Z1 + 0.15);
  // the stairs up to the courtyard: steps, walls and a sloping ceiling over them, the daylight of the door at the top
  for (let i = 0; i < STAIR.steps; i++) {
    const z = STAIR.foot - (i + 0.5) * STAIR.run, top = (i + 1) * STAIR.rise;
    b.add('stone', boxGeo(2 * STAIR.hw, top, STAIR.run), 0, top / 2, z);
    b.add('damp', boxGeo(2 * STAIR.hw + 0.6, 0.3, STAIR.run + 0.02), 0, top + 2.35, z);
    for (const s of [-1, 1]) b.add('stone', boxGeo(0.3, 2.6, STAIR.run + 0.02), s * (STAIR.hw + 0.15), top + 1.1, z);
  }
  const zTop = STAIR.foot - STAIR.steps * STAIR.run, yTop = STAIR.steps * STAIR.rise;
  b.add('daylight', boxGeo(2 * STAIR.hw, 2.2, 0.05), 0, yTop + 1.1, zTop - 0.05);
  // the bars of each cell: uprights, three rails, a door with its lock; straw, a bucket, a plank bed, rings in the wall
  for (const c of CELLS) {
    const x = c.side * CW, z0 = c.z - CELL / 2 + 0.15, z1 = c.z + CELL / 2 - 0.15;
    for (let z = z0 + 0.08; z < z1; z += 0.17) b.add('iron', cylGeo(0.022, 0.022, CEIL - 0.1, 6), x, (CEIL - 0.1) / 2, z);
    for (const y of [0.12, 1.15, CEIL - 0.25]) b.add('iron', boxGeo(0.05, 0.07, z1 - z0), x, y, c.z);
    b.add('iron', boxGeo(0.12, 0.16, 0.12), x - c.side * 0.04, 1.05, c.z + 0.55); // the lock
    const key = `${c.side}:${c.k}`;
    b.add('hay', boxGeo(1.4, 0.08, 1.1).rotateY(r(`h${key}`) - 0.5), c.side * (CELL_X - 0.9), 0.04, c.z - 0.3 + 0.6 * r(`hz${key}`));
    b.add('wood', cylGeo(0.17, 0.14, 0.32, 10), c.side * (CW + 0.55), 0.16, c.z + (r(`b${key}`) < 0.5 ? -0.75 : 0.8));
    b.add('wood', boxGeo(0.55, 0.08, 1.7), c.side * (CELL_X - 0.33), 0.42, c.z + 0.1);
    for (const dz of [-0.6, 0.6]) b.add('woodDark', boxGeo(0.45, 0.42, 0.08), c.side * (CELL_X - 0.33), 0.21, c.z + 0.1 + dz);
    for (const dz of [-0.45, 0.45]) b.add('iron', new THREE.TorusGeometry(0.08, 0.015, 5, 12).rotateY(Math.PI / 2), c.side * (CELL_X - 0.02), 1.7, c.z + dz);
  }
  // an unlit sconce on the wall at the foot of the stairs, and a dim one on the end wall behind the camera
  for (const [x, z] of [[-CW + 0.04, STAIR.foot + 0.6], [0.6, Z1 - 0.02]]) b.add('iron', boxGeo(0.08, 0.3, 0.08), x, 1.9, z);
  b.add('flame', new THREE.ConeGeometry(0.05, 0.16, 6), 0.6, 2.15, Z1 - 0.1);
  room.add(b.build(mats));

  // the guard, coming down the stairs with the torch held high in his right hand, a ring of keys at his belt
  const G = person(M, JOBS.guard.color);
  room.add(G.root);
  // the torch held up in his fist, its flame above the hand (the arm reaches up: the hand's -y is up)
  G.l.hand.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.6, 6).translate(0, -0.18, 0), M.woodDark));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 8).translate(0, 0.17, 0).rotateX(Math.PI), flameMaterial('#ffb347'));
  flame.position.y = -0.46;
  G.l.hand.add(flame);
  const keys = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 5, 14), M.iron);
  keys.position.set(0.24, 0.42, 0.1);
  keys.rotation.y = Math.PI / 2;
  G.body.add(keys);
  const torchLight = new THREE.PointLight('#ffb05a', 0, 11, 1.2);
  room.add(torchLight);
  const lights = [
    { l: new THREE.PointLight('#c9d6e4', 0, 9, 1.4), p: [0, yTop + 0.6, zTop + 1.2], i: 3 }, // daylight down the stairs
    { l: new THREE.PointLight('#ffb05a', 0, 6, 1.6), p: [0.6, 2.0, Z1 - 0.5], i: 1.2 }, // the far sconce
  ];
  for (const { l, p } of lights) { l.position.set(...p); l.visible = false; room.add(l); }
  // his walk: from two steps up the stairs, along the corridor, at a guard's pace; in a 'cell' shot he stops at the cell
  const START = STAIR.foot - 2.5 * STAIR.run, PACE = 1.35;
  let stop = Infinity;
  const along = (t) => Math.min(stop, START + PACE * Math.max(0, t - t0));

  // the prisoners: the named ones first, in the cells the camera sees best; a few cells stand empty
  const hero = variant === 'cell';
  // the left-hand cells first (the camera looks into them), from the stairs; the named prisoner of a 'cell' shot in the second
  const order = (hero ? [3, 1, 5, 0, 2, 4, 6, 7] : [1, 3, 5, 0, 2, 4, 6, 7]).map((i) => CELLS[i]);
  const empty = new Set([r('e1') < 0.5 ? 6 : 7]);
  const cast = [];
  order.forEach((c, i) => {
    if (empty.has(i) && i >= cellmates.length + (hero ? 1 : 0)) return;
    const named = hero ? (i === 0 ? { name: null, hero: true } : cellmates[i - 1]) : cellmates[i];
    const pose = named?.hero ? 'bars' : FIRST[i - (hero ? 1 : 0)] ?? POSES[(i + Math.floor(r('p') * POSES.length)) % POSES.length];
    const P = rig(M, JOBS.prisoner.color, { seated: pose === 'bench', ground: pose === 'slump' });
    const atBars = pose === 'bars' || pose === 'cup' || pose === 'wave';
    if (pose === 'slump') {
      // sitting on the straw just inside the bars, his back to the wall between two cells, legs out
      P.root.position.set(c.side * (CW + 0.5), 0, c.z - CELL / 2 + 0.42);
      P.root.rotation.y = -c.side * 0.2; // turned a little toward the corridor
    } else {
      P.root.position.set(c.side * (atBars ? CW + 0.42 : CELL_X - 0.35), pose === 'bench' ? -0.03 : 0, c.z + (atBars ? 0.35 * (r(`z${i}`) - 0.5) : 0.1));
      P.root.rotation.y = -c.side * Math.PI / 2 + (atBars ? 0 : 0.25 * (r(`y${i}`) - 0.5));
    }
    if (pose === 'cup') {
      const cup = new THREE.Mesh(cylGeo(0.05, 0.04, 0.1, 8).translate(0, -0.05, 0.02), M.iron);
      P.l.hand.add(cup);
    }
    room.add(P.root);
    cast.push({ P, c, pose, i, name: named?.name ?? null, hero: !!named?.hero, head: new THREE.Vector3() });
  });
  const heroCell = hero ? cast.find((p) => p.hero) : null;
  if (heroCell) stop = heroCell.c.z - 0.9;

  const look = new THREE.Vector3(), headAt = new THREE.Vector3();
  // 'dungeon': a few metres ahead of the guard by the right-hand bars, going back down the corridor as he comes, looking
  // across it at him and into the left-hand cell he is passing, which his torch lights; 'cell': from the right-hand bars
  // across from the named prisoner's cell, the guard coming along to it
  const cam = (u) => {
    const k = ease(u);
    if (heroCell) {
      const c = heroCell.c;
      return { pos: toWorld(0.85, THREE.MathUtils.lerp(1.7, 1.6, k), c.z + THREE.MathUtils.lerp(3.2, 2.7, k)), look: toWorld(c.side * 1.9, 1.2, c.z - 0.3), fov: FOV };
    }
    const z = along(t0 + u * (t1 - t0));
    look.set(-0.55, 1.25, z + 0.4);
    return { pos: toWorld(0.8, 1.6, Math.min(Z1 - 0.4, z + 3.8)), look: room.localToWorld(look.clone()), fov: FOV };
  };
  const labelPos = new THREE.Vector3();
  const labels = [];
  const update = (t, inside) => {
    room.visible = !!inside;
    // the guard
    const z = along(t), dist = z - START, walking = START + PACE * Math.max(0, t - t0) < stop;
    G.root.position.set(-0.1, stairY(z), z);
    G.root.rotation.y = 0;
    stride(G, dist * 3.4, walking ? 0.5 : 0, { arms: false });
    G.r.g.rotation.set(walking ? 0.45 * Math.sin(dist * 3.4) : 0, 0, 0.05);
    G.l.g.rotation.set(-2.75, 0, -0.3); // the torch held up, a little forward and out
    G.body.rotation.y = 0.35 * Math.sin(t * 0.9 + 1); // looking into the cells left and right as he goes
    flicker(flame, t, 1);
    room.updateMatrixWorld(true);
    flame.getWorldPosition(headAt);
    torchLight.position.copy(room.worldToLocal(headAt.clone())).add(new THREE.Vector3(0, 0.25, 0));
    torchLight.intensity = inside ? 14 * (1 + 0.12 * Math.sin(t * 23) + 0.07 * Math.sin(t * 37)) : 0;
    torchLight.visible = !!inside;
    // the prisoners: the torch near makes them look up
    for (const p of cast) {
      const near = Math.max(0, 1 - Math.abs(p.c.z - z) / 3.5);
      const { P } = p;
      if (p.pose === 'bars' || p.pose === 'wave') {
        // arms through the bars, hands hanging over the rail; the named prisoner (and the one who waves) waves at the torch
        const waving = (p.hero || p.pose === 'wave') && near > 0.35;
        P.l.g.rotation.set(-1.3, 0, 0.12);
        P.r.g.rotation.set(waving ? -2.7 : -1.3, 0, waving ? -0.2 - 0.35 * Math.sin(t * 9) : -0.12);
        nod(P, THREE.MathUtils.lerp(0.4, -0.08, near) + 0.03 * Math.sin(t * 0.8 + p.i));
      } else if (p.pose === 'cup') {
        P.l.g.rotation.set(-1.4, 0, 0.3 * Math.sin(t * 5 + p.i)); // the cup along the bars
        P.r.g.rotation.set(-1.4, 0, -0.1);
        nod(P, 0.05);
      } else if (p.pose === 'slump') {
        P.body.rotation.x = -0.3 + 0.015 * Math.sin(t * 1.6 + p.i); // asleep, breathing slowly
        P.l.g.rotation.set(-0.45, 0, 0.2); P.r.g.rotation.set(-0.45, 0, -0.2);
        nod(P, 0.55 - 0.25 * near);
      } else if (p.pose === 'bench') {
        P.body.rotation.x = 0.5; // elbows on the knees, the head in the hands
        P.l.g.rotation.set(-2.3, 0, -0.25); P.r.g.rotation.set(-2.3, 0, 0.25);
        nod(P, 0.25 - 0.3 * near);
      }
      P.body.localToWorld(p.head.set(0, 1.04, 0));
    }
    if (heroCell) labelPos.copy(heroCell.head).add(new THREE.Vector3(0, 0.75, 0));
    else labelPos.copy(G.body.localToWorld(headAt.set(0, 1.04, 0))).add(new THREE.Vector3(0, 0.75, 0));
    labels.length = 0;
    for (const p of cast) if (p.name) labels.push({ pos: p.head.clone().add(new THREE.Vector3(0, 0.55, 0)), title: p.name, sub: JOBS.prisoner.label });
    for (const { l, i } of lights) {
      l.visible = !!inside;
      l.intensity = inside ? i : 0;
    }
  };
  update(t0, false);
  room.visible = false;
  return {
    group: new THREE.Group(), // everyone is part of the room
    room,
    cam,
    floorAt: () => room.position.y,
    focus: heroCell ? heroCell.head.clone() : toWorld(0, 1.4, 1.0),
    labelPos,
    liveLabel: true, // the label follows the guard down the corridor
    labels,
    sound: null,
    strikeTimes: () => [],
    update,
  };
}
