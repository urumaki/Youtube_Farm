// The games at the Tournament Ground (owner 2026-10-27; two events since 2026-10-28, src/sim/stories.js `race` and
// `joust`): on the results day of the race, four guards drive chariots down the far straight; on the results day of the
// joust, two guards charge each other over the tilt. Every rider has a name tag, and named villagers sit in the front rows
// of the far stand with theirs. Nobody gets hurt: in the joust the winner's lance breaks on the loser's shield and the
// loser rocks in the saddle. The King gives the winner their title in the throne room right after (throne.js).
// Everything is in the Tournament Ground's lot frame (buildings.js `tournament`: the tilt along x at z = 0, the stands
// at z = +-24..29, four rows of benches, the oval rail rx 40, rz 21); the camera always looks across toward -z, so the
// far stand is behind the action.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { rig, particles } from '../work.js';
import { horse } from './royal.js';
import { castTag, ease, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e', '#c2a15a', '#4a6a64', '#b5476b'];
const COLORS = ['#9b1b30', '#1d2f6f', '#2f6b3a', '#c27a1d']; // each rider's colours (cloth, shield, chariot)
const COATS = ['#6b4226', '#2a2522', '#9a9590', '#a0582c']; // bay, black, grey, chestnut
const WIN = { race: 0.8, joust: 0.74 }; // the share of the shot when the winner is known
const lerp = THREE.MathUtils.lerp;

function mat(M, color) {
  const m = M.people.clone();
  m.color.set(color);
  return m;
}
const gallop = (h, ph, amp = 0.6) => {
  h.legs.forEach((l, j) => { l.rotation.x = amp * Math.sin(ph + (j < 2 ? 0 : Math.PI * 0.8) + (j % 2) * 0.5); });
  h.g.position.y = amp * 0.12 * Math.abs(Math.sin(ph)); // every horse stands at y = 0 in its parent
};

/** A rider on a horse (faces +z): helmet, shield on the left arm, a lance couched under the right arm. */
function mount(M, color, coat) {
  const h = horse(M, { coat, cloth: color });
  const R = rig(M, color, { seated: true });
  R.root.position.set(0, 1.2, -0.12); // hips on the saddle
  h.g.add(R.root);
  R.hat.visible = false;
  const add = (geo, m, parent) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); return o; };
  add(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1).translate(0, 1.13, 0), M.iron, R.body);
  add(boxGeo(0.12, 0.05, 0.3).translate(0, 1.45, -0.02), mat(M, color), R.body); // crest
  add(boxGeo(0.07, 0.72, 0.56).translate(-0.37, 0.55, 0.16), mat(M, color), R.body); // shield
  add(boxGeo(0.08, 0.16, 0.16).translate(-0.4, 0.62, 0.16), M.gold, R.body);
  const lance = new THREE.Group();
  lance.position.set(0.27, 0.6, 0.1);
  R.body.add(lance);
  add(cylGeo(0.05, 0.065, 1.5, 8).rotateX(Math.PI / 2).translate(0, 0, 0.45), mat(M, color), lance);
  add(new THREE.ConeGeometry(0.17, 0.4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.4), M.iron, lance); // vamplate
  const tip = add(cylGeo(0.03, 0.05, 2.1, 8).rotateX(Math.PI / 2).translate(0, 0, 2.25), M.clothIvory, lance);
  R.r.g.rotation.set(-1.25, 0, 0.15); // couched
  R.l.g.rotation.set(-0.9, 0, 0.35); // shield and reins
  return { h, R, lance, tip };
}

/** A two-wheeled racing chariot with its driver standing in it, drawn by one horse (faces +z). */
function chariot(M, color, coat) {
  const g = new THREE.Group();
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; g.add(o); return o; };
  const h = horse(M, { coat, cloth: color });
  h.g.position.z = 2.0;
  g.add(h.g);
  const paint = mat(M, color);
  add(boxGeo(1.1, 0.1, 0.9).translate(0, 0.72, 0), M.woodDark);
  add(boxGeo(1.1, 0.6, 0.08).translate(0, 1.05, 0.42), paint);
  for (const s of [-1, 1]) add(boxGeo(0.06, 0.4, 0.82).translate(s * 0.53, 0.95, 0.02), paint);
  for (const s of [-1, 1]) add(boxGeo(0.05, 0.05, 1.7).translate(s * 0.28, 1.05, 1.25), M.woodDark); // shafts
  const wheels = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(s * 0.66, 0.6, 0);
    const o = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 18).rotateY(Math.PI / 2), M.woodDark);
    w.add(o);
    for (let k = 0; k < 4; k++) w.add(new THREE.Mesh(boxGeo(0.04, 1.1, 0.05).rotateX((k * Math.PI) / 4), M.woodDark));
    g.add(w);
    return w;
  });
  const D = rig(M, color, { walk: true });
  D.root.position.set(0, 0.77, -0.05);
  g.add(D.root);
  D.r.g.rotation.set(-1.1, 0, -0.1); D.l.g.rotation.set(-1.1, 0, 0.1); // the reins
  D.body.rotation.x = 0.18;
  return { g, h, wheels, D };
}

export function buildJoust({ story, M, buildings, seed }) {
  const it0 = buildings.items.tournament;
  if (!it0) return null;
  const kind = story.id === 'race' ? 'race' : 'joust';
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(it0.group.matrix);
  group.visible = false;
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix);
  const tmp = new THREE.Vector3();
  const labels = [];
  const tagOf = (c, P, k) => labels.push({ ...castTag(c), P, c, sub0: castTag(c).sub, h: k, pos: new THREE.Vector3() });

  // ------------------------------------------------------------------ the far stand: named villagers in the front rows
  const spectators = [];
  const named = story.crowd || [];
  let next = 0;
  for (let k = 0; k < 4; k++) {
    const n = 15 - k;
    for (let i = 0; i < n; i++) {
      const slot = k * 20 + i;
      if (rand01(seed, 'joust-seat', slot) < 0.22 && k > 0) continue; // a few empty seats
      const c = k < 2 && i % 2 === 0 && next < named.length ? named[next++] : null;
      const color = c ? JOBS[c.job]?.color || '#7a6a55' : CROWD[Math.floor(rand01(seed, 'joust-c', slot) * CROWD.length)];
      const P = rig(M, color, { seated: true });
      const x = -12 + (24 * (i + 0.5)) / n + (rand01(seed, 'joust-x', slot) - 0.5) * 0.5;
      P.root.position.set(x, 1.2 + 0.9 * k - 0.47, -(24 + 1.6 * k) + 0.45);
      group.add(P.root);
      spectators.push({ P, ph: rand01(seed, 'joust-ph', slot) * 6, k });
      if (c) labels.push({ ...castTag(c), pos: toWorld(x, 1.2 + 0.9 * k + 1.1, -(24 + 1.6 * k) + 0.45), crowd: true });
    }
  }
  const cheer = (t, loud) => {
    for (const s of spectators) {
      const ph = t * 7 + s.ph, up = loud * (0.6 + 0.4 * Math.sin(ph * 0.7));
      s.P.r.g.rotation.set(lerp(-0.5, -2.8, up) + 0.2 * Math.sin(ph), 0, -0.1);
      s.P.l.g.rotation.set(s.ph > 3 ? lerp(-0.5, -2.6, up) : -0.4, 0, 0.1);
      s.P.root.position.y = 1.2 + 0.9 * s.k - 0.47 + (loud > 0.5 ? 0.08 * Math.abs(Math.sin(ph)) : 0);
    }
  };
  const riders = story.riders || [];
  if (!riders.length) return null;

  const scene = kind === 'race' ? race() : joust();
  const { cam, play, banner } = scene;
  const focus = toWorld(0, 1.6, -10);
  return {
    group,
    labels: labels.sort((a, b) => (a.crowd ? 1 : 0) - (b.crowd ? 1 : 0)), // the riders' tags first
    banner,
    focus,
    cam,
    // the lances striking: synced sounds (makeSfxTrack)
    work: { strikeTimes: () => [], sound: null, hits: (t0, t1) => scene.hits(t0, t1) },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      group.visible = on;
      if (!on) return;
      const v = clamp01((t - t0) / (t1 - t0));
      const won = v > WIN[kind];
      play(t, v, t0, t1);
      group.updateMatrixWorld(true);
      for (const l of labels) {
        if (l.crowd) continue;
        l.pos.copy(l.P.root.getWorldPosition(tmp)).setY(tmp.y + l.h);
        l.sub = won && l.c.id === scene.winner ? scene.winSub : l.sub0;
      }
    },
  };

  // ------------------------------------------------------------------ the chariot race (toward -x on the far straight)
  function race() {
    const winner = story.winner;
    // finishing order: the winner first, the others in the order drawn
    const order = [...riders].sort((a, b) => (b.id === winner) - (a.id === winner));
    const cars = riders.map((c, k) => {
      const ch = chariot(M, COLORS[k], COATS[k]);
      ch.g.rotation.y = -Math.PI / 2; // facing -x
      group.add(ch.g);
      tagOf(c, ch.D, 2.6);
      return { ch, c, z: -(9.6 + k * 1.55), gap: [0, 2.6, 4.3, 6.4][order.indexOf(c)], ph: rand01(seed, 'race', k) * 6 };
    });
    // the finishing post with its flag
    const post = new THREE.Mesh(cylGeo(0.07, 0.08, 4, 6).translate(0, 2, 0), M.woodDark);
    post.position.set(-8, 0, -8.6);
    group.add(post);
    const flag = new THREE.Mesh(boxGeo(0.02, 0.6, 0.9).translate(0, 3.6, 0.45), M.clothIvory);
    flag.position.copy(post.position);
    group.add(flag);
    const X0 = 24, X1 = -16; // the leader's run over the shot (the post at -8 at v = 0.8)
    const lead = (v) => lerp(X0, X1, v);
    const mid = (v) => lead(v) + 2.2 * (0.4 + 0.6 * v);
    return {
      winner,
      banner: 'The chariot race!',
      winSub: 'Wins the race!',
      hits: () => [],
      cam: (u) => {
        const x = mid(u);
        return { pos: toWorld(x - 1.2, 6.2, 4.5), look: toWorld(x + 0.3, 3.6, -11.5) }; // the chariots low in the frame, the stand above
      },
      play(t, v) {
        for (const c of cars) {
          const x = lead(v) + c.gap * (0.4 + 0.6 * v);
          c.ch.g.position.set(x, 0.03 * Math.abs(Math.sin(t * 13 + c.ph)), c.z);
          gallop(c.ch.h, t * 13 + c.ph, 0.65);
          for (const w of c.ch.wheels) w.rotation.x = -(X0 - x) / 0.56;
          // the winner's driver raises a fist past the post
          if (c.c.id === winner && v > WIN.race) c.ch.D.r.g.rotation.set(-2.9, 0, -0.2);
        }
        flag.rotation.y = 0.2 * Math.sin(t * 3);
        cheer(t, v > WIN.race ? 1 : 0.35);
      },
    };
  }

  // ------------------------------------------------------------------ the joust over the tilt
  function joust() {
    const winner = story.winner;
    const [a, b] = riders;
    // A rides toward +x on the far side of the tilt, B toward -x on the near side: the tilt on each rider's left
    const A = mount(M, COLORS[0], COATS[1]), B = mount(M, COLORS[1], COATS[0]);
    for (const m of [A, B]) group.add(m.h.g);
    tagOf(a, A.R, 1.55); tagOf(b, B.R, 1.55);
    A.lance.rotation.y = B.lance.rotation.y = -0.42; // across the horse's neck and the tilt, toward the other rider
    const splinters = particles(50, '#d8c7a0', 0.12, false);
    group.add(splinters);
    const MEET = 0.42; // the share of the shot when they meet
    const SPEED = 5.5, STOP = 3.4; // slow enough to be in the narrow frame long, and to stop inside it
    // distance covered from the start: full gallop, then reining in after the pass
    const run = (s, T) => {
      const tm = MEET * T;
      if (s <= tm) return s * SPEED;
      const k = 2.2, d = s - tm; // decelerate to a stop STOP m past the meeting point
      return tm * SPEED + STOP * (1 - Math.exp(-k * d * SPEED / STOP));
    };
    return {
      winner,
      banner: 'The joust!',
      winSub: 'Wins the joust!',
      hits: (t0, t1) => [[t0 + MEET * (t1 - t0), 'lance']],
      cam: (u) => ({ pos: toWorld(-0.8 + 1.6 * u, 6, 17), look: toWorld(0, 2.4, -1.5) }),
      play(t, v, t0, t1) {
        const T = t1 - t0, D0 = MEET * T * SPEED; // D0: how far each starts from the meeting point
        const s = t - t0, d = run(s, T), after = s > MEET * T;
        A.h.g.position.set(-D0 + d, 0, -0.85); A.h.g.rotation.y = Math.PI / 2;
        B.h.g.position.set(D0 - d, 0, 0.85); B.h.g.rotation.y = -Math.PI / 2;
        const pace = after ? Math.exp(-2.2 * (s - MEET * T)) : 1;
        gallop(A.h, d * 1.6, 0.6 * pace); gallop(B.h, d * 1.6 + 1, 0.6 * pace);
        // the blow: the winner's lance breaks on the shield, the loser rocks back in the saddle (nobody falls)
        const W = winner === a.id ? A : B, L = W === A ? B : A;
        const since = s - MEET * T;
        W.tip.visible = !after;
        L.R.body.rotation.x = after ? -0.5 * Math.exp(-(((since - 0.15) / 0.25) ** 2)) : 0;
        // after the pass the lances come up; the winner salutes the stands
        for (const m of [A, B]) {
          m.lance.rotation.x = after ? -0.9 * ease(since / 0.6) : 0;
          m.R.r.g.rotation.set(after ? lerp(-1.25, -1.7, ease(since / 0.6)) : -1.25, 0, 0.15);
        }
        if (v > WIN.joust) W.R.r.g.rotation.set(lerp(-1.7, -2.9, ease((v - WIN.joust) / 0.08)), 0, 0.15);
        // splinters fly from the shield
        const arr = splinters.geometry.attributes.position.array;
        for (let i = 0; i < 50; i++) {
          const age = since;
          if (!after || age > 1.1) { arr[i * 3 + 1] = -1e4; continue; }
          const r1 = rand01(seed, 'spl', i), r2 = rand01(seed, 'spl2', i), r3 = rand01(seed, 'spl3', i);
          arr[i * 3] = (r1 - 0.5) * 6 * age;
          arr[i * 3 + 1] = 2.3 + (1.5 + r2 * 2) * age - 4.9 * age * age;
          arr[i * 3 + 2] = (r3 - 0.5) * 3 * age + (W === A ? 1.2 : -1.2) * 0.2;
        }
        splinters.geometry.attributes.position.needsUpdate = true;
        cheer(t, after ? 1 : 0.3);
      },
    };
  }
}
