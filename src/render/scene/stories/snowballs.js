// A snowball fight in the market square (owner 2026-10-25), only on snowy days: two teams of named villagers behind low
// walls of snow, scooping and throwing in turn; the snowballs fly in arcs and burst in a puff, now and then on a head.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo } from '../kit.js';
import { person, stage, castTag, clamp01 } from './common.js';

const PERIOD = 1.7, FLIGHT = 0.55; // seconds between one villager's throws, seconds in the air

export function buildSnowballs({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(3, 0, 2) : new THREE.Vector3(0, 0, 4.5);
  const snow = new THREE.MeshStandardMaterial({ color: '#f3f5fa', roughness: 0.95 });
  // snow lying on the paving round them (the terrain is white on snowy days, the square's stones are not)
  const cover = new THREE.Mesh(new THREE.CircleGeometry(7.5, 40).rotateX(-Math.PI / 2), snow);
  cover.position.set(C.x, 0.08, C.z);
  cover.receiveShadow = true;
  group.add(cover);
  // the two snow walls, waist high: one team near the camera, the other across from it
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(boxGeo(3.6, 0.55, 0.6, 2), snow);
    wall.position.set(C.x, 0.27, C.z + s * 1.4);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
  }
  const cast = story.cast.slice(0, 8);
  const half = Math.ceil(cast.length / 2);
  const team = cast.map((c, i) => {
    const s = i < half ? -1 : 1, k = s < 0 ? i : i - half, n = s < 0 ? half : cast.length - half;
    const P = person(M, JOBS[c.job]?.color || '#7a6a55');
    P.root.position.set(C.x + (k - (n - 1) / 2) * 1.0, 0.05, C.z + s * (2.2 + (k % 2) * 0.4));
    P.root.rotation.y = s < 0 ? 0 : Math.PI; // facing each other across the walls
    group.add(P.root);
    return { P, c, s, off: rand01(seed, 'snow', i) * PERIOD };
  });
  // one ball and one puff per thrower
  const balls = team.map(() => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), snow);
    b.castShadow = true;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }));
    group.add(b, puff);
    return { b, puff };
  });
  const labels = team.map((m) => ({ ...castTag(m.c), P: m.P }));
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: 'Snowball fight!',
    focus: st.toWorld(C.x, 1.0, C.z),
    cam(u) {
      // behind the near team, a little high, the far team facing the camera
      return { pos: st.toWorld(C.x + 1.0 - 1.4 * u, 3.3, C.z - 6.6 + 0.6 * u), look: st.toWorld(C.x, 1.0, C.z + 1.0) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const others = (s) => team.filter((m) => m.s !== s);
      team.forEach((m, i) => {
        const { P, s, off } = m;
        const c = (t - t0 + off) / PERIOD, k = Math.floor(c), v = c - k;
        // scoop (bent down), wind up, throw: the ball leaves the hand at v 0.55
        const scoop = v < 0.3 ? Math.sin((Math.PI * v) / 0.3) : 0;
        P.body.rotation.x = 0.6 * scoop;
        const wind = v >= 0.3 && v < 0.55 ? (v - 0.3) / 0.25 : 0;
        P.r.g.rotation.set(v < 0.3 ? -0.4 - 0.6 * scoop : v < 0.55 ? -0.6 + 2.8 * wind : -1.5 + 0.6 * clamp01((v - 0.55) / 0.3), 0, -0.15);
        P.l.g.rotation.set(-0.5 - 0.5 * scoop, 0, 0.2);
        // the ball: from the hand in an arc to an opponent's head or chest
        const { b, puff } = balls[i];
        const opp = others(s);
        const target = opp.length ? opp[Math.floor(rand01(seed, 'snowt', i, k) * opp.length)].P.root.position : null;
        const tf = (v - 0.55) * PERIOD;
        if (target && tf >= 0 && tf < FLIGHT) {
          const q = tf / FLIGHT, high = rand01(seed, 'snowh', i, k) < 0.4;
          const from = tmp.copy(P.root.position).setY(1.9);
          b.visible = true;
          b.position.lerpVectors(from, target, q);
          b.position.y = from.y + ((high ? 1.55 : 1.2) - from.y) * q + Math.sin(Math.PI * q) * 1.0;
          puff.visible = false;
        } else if (target && tf >= FLIGHT && tf < FLIGHT + 0.3) {
          b.visible = false;
          const q = (tf - FLIGHT) / 0.3;
          puff.visible = true;
          puff.position.copy(target).setY(rand01(seed, 'snowh', i, k) < 0.4 ? 1.55 : 1.2);
          puff.scale.setScalar(0.4 + 1.6 * q);
          puff.material.opacity = 0.85 * (1 - q);
        } else { b.visible = false; puff.visible = false; }
      });
      for (const l of labels) l.pos.copy(l.P.root.position).setY(2.3).applyMatrix4(group.matrix);
    },
  };
}
