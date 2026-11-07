// The solar eclipse (owner 2026-11-05, src/sim/stories.js `eclipse`): the whole video, one shot after another (timeline.js,
// ECLIPSE_SHOTS), then the usual wide shot, goal and call to action. Noon in the market square, the camera tilts up to the
// sun as the moon's edge touches it; the light fails and the named villagers stop, stare and point; comic panic (one runs
// in circles, one hides under the handcart, one puts a bucket on his head, the crier rings his bell); the dark of the
// total eclipse, the sun's ring and the stars, the camera tilting down to a scholar (or a priest) on a barrel, book held up:
// "it's only the moon!"; then the light comes back and the town cheers. The moon and the light are env.js's (`eclipseAt`).
// Nothing magic. "Subscribe to join the kingdom" at the bottom of every shot.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { nod } from '../work.js';
import { person, stride, stage, castTag, torch, flicker, ease, clamp01 } from './common.js';

export const ECLIPSE_SHOTS = [['noon', 0, 4.5], ['bite', 4.5, 9], ['panic', 9, 13.5], ['total', 13.5, 18.5], ['light', 18.5, 23.5]];
const FOOTER = 'Subscribe to join the kingdom';
const FOLK = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e', '#b5476b'];
const lerp = THREE.MathUtils.lerp;
const span = (u, a, b) => clamp01((u - a) / (b - a));
// where the sun stands at phase 0 (env.js): the eclipse is at noon, in the light of the start of the video
const EL = THREE.MathUtils.degToRad(33), AZ = 0.95 + 0.6;
const SUN = new THREE.Vector3(Math.cos(EL) * Math.sin(AZ), Math.sin(EL), Math.cos(EL) * Math.cos(AZ)).normalize();
// how far the moon is over the sun through each shot (0 none, 1 total)
const COVER = {
  noon: (u) => lerp(0.2, 0.42, u),
  bite: (u) => lerp(0.42, 0.74, u),
  panic: (u) => lerp(0.74, 0.86, u),
  total: (u) => Math.min(1, lerp(0.95, 1.1, u)),
  light: (u) => lerp(1, 0.45, ease(Math.min(1, u * 1.4))),
};
// the crowd in the square (stage frame: the stalls in rows at z +-10.5, the market cross at z -15.5), facing the sun (+x)
const SPOTS = [[2, -1.4], [3.3, 0.8], [1.0, 1.9], [4.5, -0.4], [0.3, -0.1], [3.7, 2.7], [5.4, 1.6], [1.6, -2.9]];
const C = new THREE.Vector3(2.6, 0, 0.3); // the middle of the crowd
const CART = new THREE.Vector3(5.8, 0, -2.6), BARREL = new THREE.Vector3(4.6, 0, 2.4);

const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};
function put(P, x, z, dx = 0, dz = 1, y = 0) {
  P.root.position.set(x, y, z);
  P.root.rotation.y = Math.atan2(dx, dz);
}
function still(P) {
  P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
  P.r.g.rotation.set(0, 0, 0); P.l.g.rotation.set(0, 0, 0);
  P.body.rotation.set(0, 0, 0);
  P.body.position.y = 0.62;
  nod(P, 0);
}

/** The square with its crowd, shared by every shot: named villagers first, folk without names after. */
function square({ story, M, buildings, seed }, shot) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const inv = group.matrix.clone().invert();
  const sun = SUN.clone().transformDirection(inv); // the sun's direction in the square's frame
  const named = story.watchers || [];
  const crowd = SPOTS.map(([x, z], i) => {
    const c = named[i] || null;
    const P = person(M, c ? JOBS[c.job]?.color || FOLK[i % FOLK.length] : FOLK[i % FOLK.length]);
    group.add(P.root);
    return { P, c, i, x, z, r: (k) => rand01(seed, 'eclipse', i, k) };
  });
  // the handcart one hides under, the barrel the wise one climbs
  mesh(boxGeo(1.6, 0.12, 1.0), M.wood, group, CART.x, 0.75, CART.z);
  for (const s of [-1, 1]) mesh(boxGeo(1.6, 0.35, 0.06), M.wood, group, CART.x, 0.95, CART.z + s * 0.5);
  for (const s of [-1, 1]) mesh(cylGeo(0.36, 0.36, 0.08, 14).rotateX(Math.PI / 2), M.woodDark, group, CART.x, 0.36, CART.z + s * 0.56);
  for (const s of [-1, 1]) mesh(boxGeo(1.1, 0.07, 0.07), M.woodDark, group, CART.x - 1.3, 0.72, CART.z + s * 0.38); // the two shafts, off its end
  mesh(cylGeo(0.38, 0.34, 0.85, 12), M.wood, group, BARREL.x, 0.425, BARREL.z);
  return { st, group, sun, crowd };
}
const wiseOf = (story) => story.wise || { name: null, job: 'scholar' };

function shotScene(args, shot) {
  const sq = square(args, shot);
  if (!sq) return null;
  const { story, M } = args;
  const { st, group, sun, crowd } = sq;
  const at = (x, y, z) => st.toWorld(x, y, z);
  const sky = (from, k) => from.clone().addScaledVector(sun, k); // a point toward the sun from `from` (frame)
  // the wise one (a named scholar, else a priest) and the crier
  const wiseC = wiseOf(story);
  const W = person(M, JOBS[wiseC.job]?.color || JOBS.scholar.color);
  group.add(W.root);
  const book = mesh(boxGeo(0.3, 0.05, 0.38), M.clothRed, W.l.hand, 0, -0.1, 0.12);
  book.rotation.x = Math.PI / 2;
  const crierC = story.crier || null;
  const K = crierC ? person(M, JOBS.crier?.color || '#7b3f8c') : null;
  if (K) {
    group.add(K.root);
    mesh(new THREE.ConeGeometry(0.1, 0.18, 10).rotateX(Math.PI).translate(0, -0.12, 0), M.gold || M.iron, K.r.hand);
  }
  // the bucket for a head, torches for the dark
  const bucket = mesh(cylGeo(0.24, 0.19, 0.34, 12), M.wood, crowd[3].P.body, 0, 1.12, 0);
  bucket.visible = shot === 'panic' || shot === 'total';
  const torches = (shot === 'total' || shot === 'light') ? [crowd[4], crowd[6], crowd[7]].map((x) => torch(M, x.P.l.hand)) : [];
  const glow = torches.length ? new THREE.PointLight('#ffa552', 0, 14, 1.5) : null;
  if (glow) { glow.position.set(C.x, 2.4, C.z); group.add(glow); }
  // who wears a tag in this shot
  const cast = crowd.filter((x) => x.c);
  const sub = (x) => x === 'wise' ? (shot === 'total' ? "It's only the moon!" : undefined) : undefined;
  const labelsOf = {
    noon: cast.slice(0, 3), bite: cast.slice(0, 4), panic: cast.filter((x) => [0, 2, 3].includes(x.i)), total: cast.slice(0, 2), light: cast.slice(0, 4),
  }[shot];
  const labels = labelsOf.map((x) => ({ x, ...castTag(x.c) }));
  if (wiseC.name && (shot === 'total' || shot === 'light')) labels.unshift({ x: { P: W }, ...castTag(wiseC, sub('wise')) });
  if (crierC && shot === 'panic') labels.push({ x: { P: K }, ...castTag(crierC) });
  const banner = { noon: 'Noon in the market', bite: 'The sun is going dark!', panic: null, total: 'A total eclipse', light: 'The sun is back!' }[shot];
  const cover = COVER[shot];

  // the camera of each shot
  const cams = {
    // low behind the crowd, tilting up from the people to the sun as the moon's edge touches it
    noon: (u) => { const p = new THREE.Vector3(-6.5 + 0.8 * u, 1.5, 0.6); const k = ease(span(u, 0.35, 0.95)); return { pos: at(p.x, p.y, p.z), look: at(...new THREE.Vector3(C.x, 1.5, C.z).lerp(sky(p, 12), k).toArray()) }; },
    // in front of them, their faces turned up past the camera
    bite: (u) => ({ pos: at(C.x + 9.6 - 1.0 * u, 1.35, C.z - 0.8 + 0.6 * u), look: at(C.x + 0.3, 1.7, C.z + 0.1) }),
    // round the square in the half dark
    panic: (u) => { const a = -2.2 + 0.7 * u; return { pos: at(C.x + 1.2 + Math.cos(a) * 7.2, 2.1, C.z + Math.sin(a) * 7.2), look: at(C.x + 1.2, 1.0, C.z - 0.6) }; },
    // the black sun with its ring and the stars, then down to the wise one on his barrel
    total: (u) => { const p = new THREE.Vector3(-3.8, 1.3, 1.6); const k = ease(span(u, 0.42, 0.78)); return { pos: at(p.x, p.y, p.z), look: at(...sky(p, 12).lerp(new THREE.Vector3(BARREL.x, 1.9, BARREL.z), k).toArray()) }; },
    // the light back, the camera rising over the cheering square
    light: (u) => { const k = ease(u); return { pos: at(C.x - 4 - 4 * k, 1.7 + 3.5 * k, C.z + 3.5 + 2 * k), look: at(C.x + 0.5, 1.2, C.z - 0.2) }; },
  };

  return {
    group, labels, banner, footer: FOOTER, phase: 0, quietTown: true, low: shot !== 'light',
    focus: at(C.x, 1.2, C.z),
    eclipseAt: cover,
    cam: cams[shot],
    update(t, t0, t1) {
      group.visible = t >= t0 && t < t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0), T = t - t0, e = cover(u);
      const dark = THREE.MathUtils.smoothstep(e, 0.3, 0.97);
      crowd.forEach((x) => {
        const { P, i } = x;
        still(P);
        P.root.visible = true;
        put(P, x.x, x.z, 1, 0.1 * (i % 3 - 1));
        const ph = t * 8 + i * 1.7;
        if (shot === 'noon') {
          // a busy noon: people crossing the square, a chat, a basket; the last ones stop and look up
          if (i % 2 === 0) {
            const d = (T * 1.1 + x.r(0) * 3) % 6 - 3;
            put(P, x.x + d, x.z, 1, 0);
            stride(P, d * 4.5, 0.4);
          }
          if (u > 0.6 + 0.05 * (i % 4)) { nod(P, -0.45); P.r.g.rotation.set(-0.3, 0, 0); }
        } else if (shot === 'bite') {
          // all stopped, heads back, staring; some point, some shade their eyes
          nod(P, -0.55 - 0.1 * x.r(1));
          P.body.rotation.x = -0.1;
          if (i % 3 === 0) P.r.g.rotation.set(-2.6, 0, -0.2);
          else if (i % 3 === 1) P.r.g.rotation.set(-2.3, 0, 0.9); // a hand over the eyes
          if (i === 1 && u > 0.55) { P.r.g.rotation.set(-2.6, 0, -0.3); P.l.g.rotation.set(-2.6, 0, 0.3); } // both arms up
        } else if (shot === 'panic') {
          if (i === 0) {
            // running round in circles, arms in the air
            const a = T * 3.2;
            put(P, x.x + Math.cos(a) * 1.3, x.z + Math.sin(a) * 1.3, -Math.sin(a), Math.cos(a));
            stride(P, a * 4, 0.8, { arms: false });
            P.r.g.rotation.set(-2.8 + 0.3 * Math.sin(ph), 0, -0.3); P.l.g.rotation.set(-2.8 - 0.3 * Math.sin(ph), 0, 0.3);
          } else if (i === 2) {
            // hiding under the handcart, trembling, peeking out
            put(P, CART.x - 0.2, CART.z, -1, 0.3, -0.3);
            P.body.position.y = 0.42;
            P.body.rotation.x = 0.7;
            P.legs[0].rotation.x = -1.6; P.legs[1].rotation.x = -1.5;
            P.r.g.rotation.set(-1.4, 0, -0.4); P.l.g.rotation.set(-1.4, 0, 0.4);
            P.root.position.x += 0.02 * Math.sin(t * 40);
          } else if (i === 3) {
            // the bucket on his head, walking into things
            const d = Math.sin(T * 1.1) * 1.4;
            put(P, x.x + d, x.z, Math.cos(T * 1.1) >= 0 ? 1 : -1, 0);
            stride(P, T * 6, 0.35);
            P.r.g.rotation.set(-1.5, 0, -0.1); P.l.g.rotation.set(-1.5, 0, 0.1); // feeling the way
          } else {
            // the others huddle, looking up and round
            nod(P, -0.4);
            P.r.g.rotation.set(-0.6 - 0.4 * Math.abs(Math.sin(ph)), 0, -0.3);
            P.l.g.rotation.set(-0.6, 0, 0.3);
            put(P, lerp(x.x, C.x, 0.35), lerp(x.z, C.z, 0.35), Math.cos(ph * 0.2), Math.sin(ph * 0.2));
          }
        } else if (shot === 'total') {
          // quiet: everyone looking up at the ring, the torches lit, the bucket still on
          nod(P, -0.6);
          put(P, lerp(x.x, C.x, 0.3), lerp(x.z, C.z, 0.3), 1, 0);
          if (torches.length && [4, 6, 7].includes(i)) P.l.g.rotation.set(-2.3, 0, 0.2);
          if (i === 2) P.root.visible = false; // still under the cart
        } else {
          // the light back: arms up, jumping, a hug
          const jump = Math.abs(Math.sin(ph * 0.9));
          put(P, lerp(x.x, C.x, 0.3), lerp(x.z, C.z, 0.3), 1, 0, 0.25 * jump * (i % 2));
          P.r.g.rotation.set(-2.8 + 0.3 * Math.sin(ph), 0, -0.25); P.l.g.rotation.set(-2.7 + 0.3 * Math.sin(ph + 1), 0, 0.25);
          nod(P, -0.25);
          if ([4, 6, 7].includes(i)) P.l.g.rotation.set(-2.3, 0, 0.2);
        }
      });
      // the bucket rides on its head (no hat under it)
      crowd[3].P.hat.visible = !bucket.visible;
      // the wise one: on the barrel in the dark, book up in one hand, pointing at the sun with the other
      still(W);
      W.root.visible = shot === 'total' || shot === 'light' || (shot === 'panic' && u > 0.6);
      if (shot === 'panic') { put(W, lerp(BARREL.x - 3, BARREL.x - 0.6, span(u, 0.6, 1)), BARREL.z + 0.6, 1, 0); stride(W, T * 9, 0.6); }
      else {
        put(W, BARREL.x, BARREL.z, -1, -0.3, 0.85);
        W.l.g.rotation.set(-2.2, 0, 0.35); // the book held up to them
        W.r.g.rotation.set(-2.7 + 0.15 * Math.sin(t * 3), 0, -0.5); // pointing up
        if (shot === 'light') { W.r.g.rotation.set(-2.9, 0, -0.3); W.l.g.rotation.set(-2.9, 0, 0.3); }
      }
      // the crier ringing his bell as he hurries across
      if (K) {
        still(K);
        K.root.visible = shot === 'panic' || shot === 'bite';
        const d = shot === 'panic' ? lerp(-3, 4, u) : lerp(-6, -3, u);
        put(K, C.x + d, C.z + 3.4, 1, 0);
        stride(K, d * 4, 0.5, { arms: false });
        K.r.g.rotation.set(-2.4 + 0.5 * Math.sin(t * 22), 0, -0.3);
      }
      for (const f of torches) flicker(f, t, 2);
      if (glow) glow.intensity = 30 * Math.max(dark, 0.3) * (1 + 0.1 * Math.sin(t * 17));
      for (const l of labels) {
        l.pos.copy(l.x.P.root.position).setY(l.x.P.root.position.y + 2.35).applyMatrix4(group.matrix);
        l.hidden = !l.x.P.root.visible;
      }
    },
  };
}

/** The scene of one shot of the eclipse (args.story.shot). */
export function buildEclipse(args) {
  return ECLIPSE_SHOTS.some((s) => s[0] === args.story.shot) ? shotScene(args, args.story.shot) : null;
}
