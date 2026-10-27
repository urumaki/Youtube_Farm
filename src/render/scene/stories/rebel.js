// The would-be rebel in the pillory (owner 2026-10-27, story `rebel` in src/sim/stories.js): a commenter who talked of
// overthrowing the king stands bent in the pillory on the market square, head and hands through the board. Named
// villagers in front pelt them with tomatoes that burst and stick; the hooded executioner raises the axe and brings it
// down on the cabbage on the chopping block beside them as a warning (one heavy blow, the leaves fly), and the rebel
// flinches. Comic, nobody hurt. Everything is placed in the pillory lot's frame (buildings.js `pillory`: platform top at
// 1.07, the board at z -0.6 with the holes at y 2.3, the block at x 1.0 z -0.3); the market square is on the lot's -z side.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { toolGeo } from '../work.js';
import { person, castTag, ease, clamp01 } from './common.js';

const PL = 1.07; // the platform's top
const BEND = 0.94; // the rebel bent forward at the hips, so the head is at the board's height
const BOARD = { y: 2.3, z: -0.6, front: -0.71 };
const HOLES = [-1.95, -1.05]; // the hand holes; the head's is at x -1.5
const BLOCK = { x: 1.0, z: -0.3, top: 1.65 };
const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d'];
const HIT = 0.6; // the share of the shot when the axe falls
const PERIOD = 1.5, FLIGHT = 0.5; // seconds between one villager's throws, a tomato's time in the air

export function buildRebel({ story, M, buildings, seed, lang }) {
  const item = buildings.items.pillory;
  if (!item || !story.rebel) return null;
  const group = new THREE.Group();
  group.visible = false;
  group.matrixAutoUpdate = false;
  const o = item.toWorld([0, 0, 0]);
  group.matrix.makeBasis(item.toWorld([1, 0, 0]).sub(o), item.toWorld([0, 1, 0]).sub(o), item.toWorld([0, 0, 1]).sub(o)).setPosition(o);
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix);

  // the rebel: behind the board (on the steps' side), bent over, facing the square, head and hands through the holes
  const R = person(M, JOBS[story.rebel.job]?.color || '#7a6a55');
  R.hat.visible = false;
  const head = new THREE.Vector3(-1.5, BOARD.y, BOARD.front - 0.12);
  R.root.position.set(head.x, PL, head.z + 1.04 * Math.sin(BEND));
  R.root.rotation.y = Math.PI;
  R.body.rotation.x = BEND;
  group.add(R.root);
  R.root.updateMatrix();
  const toRoot = R.root.matrix.clone().invert(), unbend = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -BEND);
  const armRest = [R.r, R.l].map((arm, k) => {
    // each arm from the shoulder straight to its hole, shortened so the hand just shows in front of the board
    const side = k ? -1 : 1;
    const shoulder = new THREE.Vector3(side * 0.3, 0.8, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), BEND).add(new THREE.Vector3(0, 0.62, 0));
    const hole = new THREE.Vector3(HOLES[k] , BOARD.y, BOARD.front - 0.04).applyMatrix4(toRoot);
    const d = hole.sub(shoulder), len = d.length();
    arm.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize().applyQuaternion(unbend));
    arm.g.scale.set(1, len / 0.66, 1);
    return arm.g.quaternion.clone();
  });

  // the executioner, hooded, behind the block facing the square, the axe in both hands
  const E = person(M, JOBS.executioner.color);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.62, 12).translate(0, 1.14, 0), M.people.clone());
  hood.material.color.set('#151214');
  hood.castShadow = true;
  E.body.add(hood);
  const axe = toolGeo('axe', M);
  E.r.hand.add(axe);
  const EBEND = 0.25;
  const pose = (a) => { E.r.g.rotation.set(a, 0, -0.28); E.l.g.rotation.set(a, 0, 0.28); E.body.rotation.x = EBEND; };
  // calibrate the blow: the arm angle where the blade reaches the cabbage on the block, and how far in front of him that is
  const tip = new THREE.Vector3();
  const tipAt = (a) => { pose(a); E.root.updateMatrixWorld(true); return axe.userData.tip.getWorldPosition(tip).clone(); };
  let down = -0.9, reach = tipAt(down);
  for (let a = -2.2; a < 0.6; a += 0.01) {
    const p = tipAt(a);
    if (p.y <= BLOCK.top + 0.12 - PL) { down = a; reach = p; break; }
  }
  E.root.position.set(BLOCK.x + reach.x, PL, BLOCK.z + reach.z);
  E.root.rotation.y = Math.PI;
  group.add(E.root);
  // the cabbage's leaves flying at the blow
  const leafMat = new THREE.MeshStandardMaterial({ color: '#6f9a3a', roughness: 0.8, side: THREE.DoubleSide });
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.1), leafMat);
    const a = (i / 9) * Math.PI * 2 + rand01(seed, 'leaf', i);
    m.userData.v = new THREE.Vector3(Math.cos(a) * 1.4, 2.2 + rand01(seed, 'leafy', i) * 1.4, Math.sin(a) * 1.4);
    m.visible = false;
    group.add(m);
    return m;
  });

  // the crowd on the square in front, throwing tomatoes; the named throwers first
  const throwers = CROWD.map((col, i) => {
    const c = story.throwers?.[i] || null;
    const P = person(M, c ? JOBS[c.job]?.color || col : col);
    P.root.position.set(-3.0 + i * 1.05 + rand01(seed, 'tom', i) * 0.3, 0, -3.4 - (i % 2) * 0.8);
    P.root.rotation.y = Math.atan2(head.x - P.root.position.x, head.z - P.root.position.z);
    group.add(P.root);
    return { P, c, off: 0.25 + rand01(seed, 'tomoff', i) * PERIOD };
  });
  const red = new THREE.MeshStandardMaterial({ color: '#c8281e', roughness: 0.45 });
  const pulp = new THREE.MeshStandardMaterial({ color: '#d8392a', roughness: 0.7 });
  const tomatoes = throwers.map(() => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), red);
    b.castShadow = true;
    const burst = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), pulp);
    group.add(b, burst);
    return { b, burst };
  });
  // where each throw lands: mostly on the face, now and then on the board beside it; the squashed tomato stays there
  const landing = (i, k) => {
    const miss = rand01(seed, 'tommiss', i, k) < 0.3, j = rand01(seed, 'tomx', i, k) - 0.5, h = rand01(seed, 'tomy', i, k) - 0.5;
    return miss ? new THREE.Vector3(head.x + Math.sign(j || 1) * (0.32 + Math.abs(j) * 0.5), BOARD.y + h * 0.25, BOARD.front - 0.02)
      : new THREE.Vector3(head.x + j * 0.2, head.y + h * 0.2, head.z - 0.16);
  };
  const splats = [];
  let T0 = 0, T1 = 1;
  const throwsIn = (t0, t1) => {
    // every throw that lands inside the shot: [time it lands, thrower, throw number]
    const out = [];
    throwers.forEach((m, i) => {
      for (let k = 0; ; k++) {
        const land = t0 + m.off + k * PERIOD + 0.35 * PERIOD + FLIGHT;
        if (land > t1 - 0.1) break;
        out.push([land, i, k]);
      }
    });
    return out.sort((a, b) => a[0] - b[0]);
  };
  const tags = [
    castTag(story.rebel, lang, lang === 'it' ? 'Aspirante ribelle' : 'Would-be rebel'),
    ...(story.executioner ? [castTag(story.executioner, lang)] : []),
  ];
  const labels = [{ ...tags[0], at: () => new THREE.Vector3(head.x, head.y + 0.75, head.z) }, ...(tags[1] ? [{ ...tags[1], at: () => E.root.position.clone().setY(PL + 2.35) }] : []),
    ...throwers.filter((m) => m.c).slice(0, 4 - tags.length).map((m) => ({ ...castTag(m.c, lang), at: () => m.P.root.position.clone().setY(2.3) }))];
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Tradimento! Alla gogna!' : 'Treason! To the pillory!',
    focus: toWorld(-0.3, 1.9, -0.6),
    setWindow(t0, t1) {
      T0 = t0; T1 = t1;
      splats.forEach((s) => group.remove(s.m));
      splats.length = 0;
      for (const [land, i, k] of throwsIn(t0, t1)) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.07 + rand01(seed, 'tomsz', i, k) * 0.03, 8, 6).scale(1, 0.8, 0.35), pulp);
        m.position.copy(landing(i, k));
        m.visible = false;
        group.add(m);
        splats.push({ m, land });
      }
    },
    // the axe on the block and every tomato bursting, for the sound effects (src/audio/sfx.js)
    work: { strikeTimes: () => [], sound: null, hits: (t0, t1) => [[t0 + HIT * (t1 - t0), 'axe'], ...throwsIn(t0, t1).map(([t]) => [t, 'splat'])] },
    cam(u) {
      // from the square, a little to the side and high, the pillory, the block and the crowd's heads below
      return { pos: toWorld(-1.6 + 1.0 * u, 3.7, -8.6 + 0.8 * ease(u)), look: toWorld(-0.3, 1.75, -0.6) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0)), tHit = t0 + HIT * (t1 - t0), since = t - tHit;
      // the executioner: watches the rebel, turns to the block and raises the axe slowly, holds it, brings it down hard
      const lift = ease(clamp01((u - 0.3) / 0.2)), drop = clamp01((u - (HIT - 0.04)) / 0.04);
      const top = -2.8, rest = -0.5;
      const a = u < HIT - 0.04 ? rest + (top - rest) * lift : u < HIT ? top + (down - top) * drop * drop : down;
      pose(a);
      E.root.rotation.y = Math.PI + (u < 0.3 ? 0.5 * (1 - ease(u / 0.3) * 0.3) : u < 0.5 ? 0.35 * (1 - ease((u - 0.3) / 0.2)) : 0);
      // the rebel wriggles in the pillory and jumps at the blow
      const flinch = since > 0 ? Math.exp(-since * 5) : 0;
      R.legs[0].rotation.x = 0.12 * Math.sin(t * 7) - 0.25 * flinch;
      R.legs[1].rotation.x = -0.12 * Math.sin(t * 7) + 0.15 * flinch;
      R.root.position.y = PL + 0.06 * flinch * Math.abs(Math.sin(since * 30));
      R.r.g.quaternion.copy(armRest[0]); R.l.g.quaternion.copy(armRest[1]);
      R.r.hand.rotation.z = 0.5 * Math.sin(t * 9); R.l.hand.rotation.z = -0.5 * Math.sin(t * 9 + 1);
      // the leaves
      leaves.forEach((m, i) => {
        m.visible = since > 0 && since < 1.4;
        if (!m.visible) return;
        const v = m.userData.v, s = since;
        m.position.set(BLOCK.x + v.x * s, Math.max(PL + 0.02, BLOCK.top + 0.2 + v.y * s - 4.9 * s * s), BLOCK.z + v.z * s);
        m.rotation.set(s * 9 + i, s * 7, i);
      });
      // the crowd: wind up, throw; the tomato flies in an arc and bursts where it lands; the others laugh at the blow
      throwers.forEach((m, i) => {
        const { P, off } = m;
        const c = (t - t0 - off) / PERIOD, k = Math.floor(c), v = c - k;
        const wind = v < 0.35 ? v / 0.35 : 0;
        P.r.g.rotation.set(c < 0 ? -0.3 : v < 0.35 ? -0.4 - 2.4 * ease(wind) : -2.8 + 2.0 * clamp01((v - 0.35) / 0.25), 0, -0.15);
        P.l.g.rotation.set(since > 0 && since < 1.2 && i % 2 ? -2.6 : -0.3, 0, 0.2);
        const { b, burst } = tomatoes[i];
        const tf = (v - 0.35) * PERIOD, land = landing(i, k);
        b.visible = burst.visible = false;
        if (c < 0 || t0 + off + k * PERIOD + 0.35 * PERIOD + FLIGHT > t1 - 0.1) return;
        if (tf >= 0 && tf < FLIGHT) {
          const q = tf / FLIGHT, from = tmp.copy(P.root.position).setY(2.0);
          b.visible = true;
          b.position.lerpVectors(from, land, q);
          b.position.y += Math.sin(Math.PI * q) * 1.1;
        } else if (tf >= FLIGHT && tf < FLIGHT + 0.25) {
          const q = (tf - FLIGHT) / 0.25;
          burst.visible = true;
          burst.position.copy(land);
          burst.scale.set(0.5 + 1.3 * q, 0.5 + 0.8 * q, 0.4);
        }
      });
      for (const s of splats) s.m.visible = t >= s.land + 0.1;
      for (const l of labels) l.pos.copy(l.at()).applyMatrix4(group.matrix);
    },
  };
}
