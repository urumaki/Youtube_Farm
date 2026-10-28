// A thunderstorm over the market square: heavy rain, two lightning strikes that light up the town, and
// villagers running for cover with their arms over their heads.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { person, stride, stage, castTag, clamp01 } from './common.js';

const FOLK = ['#5f6f7a', '#8a6d4f', '#6f7d4a', '#7a5b7d', '#9b5a3c'];
export const FLASHES = [0.3, 0.72]; // when the lightning strikes, as a fraction of the shot
const RAIN = 1800;

function bolt(seed, k) {
  // a jagged line of thin boxes from the clouds down to the horizon
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#f4f7ff', fog: false });
  let x = 0, y = 70;
  while (y > 6) {
    const nx = x + (rand01(seed, 'bolt', k, y) - 0.5) * 9, ny = y - 6 - rand01(seed, 'bolty', k, y) * 5;
    const len = Math.hypot(nx - x, ny - y);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.5, len, 0.5), mat);
    seg.position.set((x + nx) / 2, (y + ny) / 2, 0);
    seg.rotation.z = Math.atan2(-(nx - x), ny - y);
    g.add(seg);
    x = nx; y = ny;
  }
  g.visible = false;
  return g;
}

export function buildStorm({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  // rain streaks in a box around the square
  const pos = new Float32Array(RAIN * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#dfe7f1', transparent: true, opacity: 0.8 }));
  rain.frustumCulled = false;
  group.add(rain);
  const bolts = FLASHES.map((_, k) => { const b = bolt(seed, k); b.position.set(-18 + 34 * k, 0, 55 + 10 * k); group.add(b); return b; });
  const flash = new THREE.HemisphereLight('#dfe8ff', '#404650', 0);
  group.add(flash);
  // villagers running across the square for the shelter of the stalls
  const cast = story.cast || [];
  const runners = Array.from({ length: Math.max(5, cast.length + 2) }, (_, i) => {
    const c = cast[i] || null;
    const P = person(M, c ? JOBS[c.job]?.color || FOLK[0] : FOLK[i % FOLK.length]);
    group.add(P.root);
    const dir = i % 2 ? 1 : -1;
    return { P, c, dir, z: -6 + (i * 12) / Math.max(1, cast.length + 1) + rand01(seed, 'rz', i) * 1.5, x0: -14 * dir + rand01(seed, 'rx', i) * 4 * dir, speed: 4 + rand01(seed, 'rs', i) * 1.5 };
  });
  const labels = runners.filter((r) => r.c).map((r) => ({ r, ...castTag(r.c) }));
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: 'Storm over the kingdom!',
    phase: 0.6,
    focus: st.toWorld(0, 1.2, 0),
    cam(u) {
      // inside the square between the two rows of stalls (no lamp posts in front of the lens)
      return { pos: st.toWorld(-3 + 6 * u, 3.0, -8.2), look: st.toWorld(1 + 2 * u, 1.8, 4) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      flash.visible = group.visible;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      for (let i = 0; i < RAIN; i++) {
        const r = (q) => rand01(seed, 'rain', i, q);
        const x = (r(0) - 0.5) * 44, z = (r(1) - 0.5) * 36 - 4, y = 22 - ((r(2) * 22 + t * 19) % 22);
        pos.set([x, y, z, x - 0.35, y + 1.4, z], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      // lightning: a bright flash that fades in a quarter second, the bolt visible for a moment
      let f = 0;
      FLASHES.forEach((at, k) => {
        const dt = (u - at) * (t1 - t0);
        const on = dt >= 0 && dt < 0.25;
        bolts[k].visible = dt >= 0 && dt < 0.12;
        if (on) f = Math.max(f, (1 - dt / 0.25) * (dt < 0.05 || dt > 0.08 ? 1 : 0.5)); // a double flicker
      });
      flash.intensity = 16 * f;
      runners.forEach((R, i) => {
        const x = R.x0 + R.dir * R.speed * (t - t0);
        R.P.root.position.set(x, 0, R.z);
        R.P.root.rotation.y = R.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        stride(R.P, (t - t0) * R.speed * 3 + i, 0.75, { arms: false });
        R.P.r.g.rotation.set(-2.7, 0, -0.5); // arms over the head against the rain
        R.P.l.g.rotation.set(-2.7, 0, 0.5);
        R.P.body.rotation.x = 0.25;
      });
      labels.forEach((lb, k) => lb.pos.copy(tmp.copy(lb.r.P.root.position).setY(2.3 + (k % 2) * 0.45)).applyMatrix4(group.matrix));
    },
  };
}
