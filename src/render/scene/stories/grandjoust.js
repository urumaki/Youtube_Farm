// The Grand Joust (owner 2026-11-01, src/sim/stories.js `joust`, results day): eight guards in a knockout that takes the
// whole video (timeline.js, JOUST_SHOTS), one shot after another like the night raid. The riders lined up before the far
// stand, then the champion's three bouts (quarter-final, semi-final, final): a charge at full gallop, the last strides and
// the blow in slow motion, the loser knocked out of the saddle onto the sand (comic: he sits up, dazed, and waves; nobody
// gets hurt), the winner riding on with the lance up; the King knights the champion in the throne room (throne.js); the
// champion rides along the lists to the cheers. The bracket of the eight names is drawn over it (overlay.js).
// Everything in the Tournament Ground's lot frame (joust.js: the tilt along x at z 0, the far stand at z -24..-29).
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { rig, particles } from '../work.js';
import { castTag, ease, clamp01 } from './common.js';
import { mount, gallop, stands, COLORS, COATS } from './joust.js';
import { plateArmor } from '../outfits.js';

export const JOUST_SHOTS = [['intro', 0, 3.5], ['quarter', 3.5, 9], ['semi', 9, 14.5], ['final', 14.5, 21.5], ['crown', 21.5, 25.5], ['outro', 25.5, 30]];
const ROUND = { quarter: 0, semi: 1, final: 2 };
const lerp = THREE.MathUtils.lerp;
const SPEED = 6; // m/s at full gallop
const SLOW = 0.22; // the speed of the slow motion

/** The rider's colours by place in the draw. */
const colorOf = (story, id) => COLORS[Math.max(0, story.riders.findIndex((r) => r.id === id)) % COLORS.length];
const coatOf = (story, id) => COATS[Math.max(0, story.riders.findIndex((r) => r.id === id)) % COATS.length];

/**
 * Real time in the shot to action time (seconds): full speed, then from `n1` the slow motion for `slow` real seconds,
 * then full speed again. Returns { act(s), real(a) }.
 */
function warp(n1, slow) {
  const act = (s) => (s < n1 ? s : s < n1 + slow ? n1 + (s - n1) * SLOW : n1 + slow * SLOW + (s - n1 - slow));
  const real = (a) => (a < n1 ? a : a < n1 + slow * SLOW ? n1 + (a - n1) / SLOW : a - slow * SLOW + slow);
  return { act, real };
}

/**
 * Petals and ribbons thrown from the stands over the lists for the champion (owner 2026-11-01, second look: more show):
 * red, gold and white, falling and swaying, again and again. Returns update(t, k), k 0..1 how many are in the air.
 */
function petals(group, seed, box = [-10, 10, -9, 8]) {
  const N = 60, sets = ['#d8343a', '#f2d04b', '#f4f0e6'].map((c) => { const p = particles(N, c, 0.17, false); group.add(p); return p; });
  return (t, k) => sets.forEach((p, j) => {
    const arr = p.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const r1 = rand01(seed, 'pet1', j, i), r2 = rand01(seed, 'pet2', j, i), r3 = rand01(seed, 'pet3', j, i);
      if (r3 > k) { arr[i * 3 + 1] = -1e4; continue; }
      const f = (t * (0.28 + 0.12 * r2) + r3) % 1; // its fall, from high over the lists to the sand
      arr[i * 3] = lerp(box[0], box[1], r1) + 0.5 * Math.sin(t * 2.3 + i);
      arr[i * 3 + 1] = 8.5 - 8.3 * f;
      arr[i * 3 + 2] = lerp(box[2], box[3], r2) + 0.4 * Math.cos(t * 1.9 + i * 1.7);
    }
    p.geometry.attributes.position.needsUpdate = true;
  });
}

function lot(buildings) {
  const it = buildings.items.tournament;
  if (!it) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(it.group.matrix);
  group.visible = false;
  return { group, toWorld: (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix) };
}

/** One of the champion's bouts: the charge, the blow in slow motion, the loser out of the saddle. */
function bout({ story, M, buildings, seed }, round, T) {
  const L0 = lot(buildings);
  if (!L0) return null;
  const { group, toWorld } = L0;
  const bt = story.rounds?.[round]?.find((b) => b.a === story.winner || b.b === story.winner);
  if (!bt) return null;
  const who = (id) => story.riders.find((r) => r.id === id);
  const a = who(bt.a), b = who(bt.b);
  const labels = [];
  const { cheer } = stands({ group, M, story, seed, toWorld, labels });
  // A rides toward +x on the far side of the tilt, B toward -x on the near side
  const A = mount(M, colorOf(story, a.id), coatOf(story, a.id)), B = mount(M, colorOf(story, b.id), coatOf(story, b.id));
  for (const m of [A, B]) group.add(m.h.g);
  A.lance.rotation.y = B.lance.rotation.y = -0.42;
  const W = bt.winner === a.id ? A : B, Lz = W === A ? B : A;
  const won = who(bt.winner);
  const final = round === 2;
  const riderTags = [[a, A], [b, B]].map(([c, m]) => ({ ...castTag(c), P: m.R, c, sub0: castTag(c).sub, pos: new THREE.Vector3() }));
  labels.unshift(...riderTags);
  const splinters = particles(60, '#d8c7a0', 0.13, false);
  group.add(splinters);
  const dust = particles(40, '#c9b48a', 0.22, false);
  group.add(dust);
  // the timing: full gallop for N1 real seconds, then SLOWS real seconds of slow motion round the blow
  const N1 = 0.3 * T, SLOWS = 0.36 * T;
  const { act, real } = warp(N1, SLOWS);
  const MEET = N1 + SLOWS * SLOW * 0.62; // action time of the blow, inside the slow motion
  const D0 = MEET * SPEED;
  const STOP = 5;
  const run = (s) => (s <= MEET ? s * SPEED : MEET * SPEED + STOP * (1 - Math.exp(-2.2 * (s - MEET) * SPEED / STOP)));
  const FALL = 0.7; // action seconds from the blow to the ground
  const tmp = new THREE.Vector3();
  const saddle = new THREE.Vector3(0, 1.2, -0.12);
  const shower = final ? petals(group, seed) : null;
  // each round seen another way (owner's second look): side on from the near stands, low along the tilt, a crane coming down
  const wide = [
    (u) => ({ pos: toWorld(-0.8 + 1.6 * u, 6, 17), look: toWorld(0, 2.4, -1.5) }),
    (u) => ({ pos: toWorld(-12 + 4 * u, 3.0, 8.5), look: toWorld(0.5, 1.8, 0) }),
    (u) => ({ pos: toWorld(-3 + 5 * u, 9 - 3.5 * u, 15 - 2 * u), look: toWorld(0, 1.8, 0) }),
  ][round];
  return {
    group,
    labels,
    banner: { 0: 'Quarter-final', 1: 'Semi-final', 2: 'The final!' }[round],
    focus: toWorld(0, 1.6, -4),
    work: { strikeTimes: () => [], sound: null, hits: (t0) => [[t0 + real(MEET), 'lance'], [t0 + real(MEET + FALL), 'hoe']] },
    cam(u) {
      // wide from the near side; through the slow motion close in on the meeting point, then back out
      const s = u * T;
      const k = clamp01((s - N1 + 0.35) / 0.5) * clamp01((N1 + SLOWS + 0.5 - s) / 0.6);
      const e = ease(k);
      const w = wide(u);
      const close = { pos: toWorld(3.2, 2.5, 7.2), look: toWorld(0.2, 2.1, 0) };
      const pos = w.pos.lerp(close.pos, e);
      // the camera shaken by the blow (in action time, so slowly through the slow motion)
      const d = act(s) - MEET;
      if (d > 0) { const a = 0.12 * Math.exp(-5 * d); pos.x += a * Math.sin(d * 55); pos.y += a * Math.sin(d * 70 + 1); }
      return { pos, look: w.look.lerp(close.look, e) };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      group.visible = on;
      if (!on) return;
      const s = act(Math.max(0, t - t0)), after = s > MEET, since = s - MEET;
      const dA = run(s);
      A.h.g.position.set(-D0 + dA, 0, -0.85); A.h.g.rotation.y = Math.PI / 2;
      B.h.g.position.set(D0 - dA, 0, 0.85); B.h.g.rotation.y = -Math.PI / 2;
      const pace = after ? Math.exp(-2.2 * since) : 1;
      gallop(A.h, dA * 1.6, 0.6 * pace); gallop(B.h, dA * 1.6 + 1, 0.6 * pace);
      W.tip.visible = !after;
      // the loser leaves the saddle: thrown back off the horse's quarters onto the sand, where he lands sitting up
      if (after) {
        const k = clamp01(since / FALL);
        // in the horse's frame: stay where the blow came (the horse runs on from under him), arc up and down to the ground
        const back = run(s) - run(MEET);
        // (sitting on the sand: the seated rig's hips just above the ground)
        Lz.R.root.position.set(0.25 * k, lerp(saddle.y, -0.38, ease(k)) + 0.9 * Math.sin(Math.PI * k), saddle.z - back - 0.6 * k);
        Lz.R.root.rotation.x = k < 1 ? -1.6 * Math.sin(Math.PI * k) : -0.15;
        const sat = since - FALL;
        // dazed, then a wave to the stands
        Lz.R.body.rotation.z = sat > 0 ? 0.12 * Math.sin(sat * 5) * Math.exp(-sat) : 0;
        Lz.R.r.g.rotation.set(sat > 1.2 ? -2.7 + 0.25 * Math.sin(t * 8) : -0.4, 0, 0.15);
        Lz.lance.visible = k < 0.2;
      } else {
        Lz.R.root.position.copy(saddle);
        Lz.R.root.rotation.x = 0;
        Lz.lance.visible = true;
      }
      for (const m of [A, B]) if (m === W || !after) {
        m.lance.rotation.x = after ? -0.9 * ease(since / 0.6) : 0;
        m.R.r.g.rotation.set(after ? lerp(-1.25, -2.6, ease((since - 0.3) / 0.6)) : -1.25, 0, 0.15);
      }
      // splinters from the shield, dust where he lands
      const arr = splinters.geometry.attributes.position.array, dArr = dust.geometry.attributes.position.array;
      for (let i = 0; i < 60; i++) {
        if (!after || since > 1.2) { arr[i * 3 + 1] = -1e4; continue; }
        const r1 = rand01(seed, 'gspl', i), r2 = rand01(seed, 'gspl2', i), r3 = rand01(seed, 'gspl3', i);
        arr[i * 3] = (r1 - 0.5) * 6 * since;
        arr[i * 3 + 1] = 2.3 + (1.5 + r2 * 2) * since - 4.9 * since * since;
        arr[i * 3 + 2] = (r3 - 0.5) * 3 * since;
      }
      splinters.geometry.attributes.position.needsUpdate = true;
      group.updateMatrixWorld(true);
      const land = Lz.R.root.getWorldPosition(tmp).clone().applyMatrix4(group.matrix.clone().invert());
      for (let i = 0; i < 40; i++) {
        const age = since - FALL;
        if (age < 0 || age > 1.0) { dArr[i * 3 + 1] = -1e4; continue; }
        const r1 = rand01(seed, 'gdust', i), r2 = rand01(seed, 'gdust2', i);
        dArr[i * 3] = land.x + Math.cos(r1 * 6.28) * (0.3 + 1.6 * age);
        dArr[i * 3 + 1] = 0.15 + r2 * 0.8 * age;
        dArr[i * 3 + 2] = land.z + Math.sin(r1 * 6.28) * (0.3 + 1.6 * age);
      }
      dust.geometry.attributes.position.needsUpdate = true;
      cheer(t, after ? 1 : 0.35);
      shower?.(t, after ? clamp01((since - FALL) / 0.6) : 0);
      for (const l of riderTags) {
        l.pos.copy(l.P.root.getWorldPosition(tmp)).setY(tmp.y + 1.55);
        l.sub = after && since > FALL ? (l.c.id === won.id ? (final ? 'Wins the joust!' : 'Rides on!') : 'Out!') : l.sub0;
      }
    },
  };
}

/** 0-3.5 s: the eight riders lined up before the far stand, lances up, the crowd on its feet. */
function intro({ story, M, buildings, seed }) {
  const L0 = lot(buildings);
  if (!L0) return null;
  const { group, toWorld } = L0;
  const labels = [];
  const { cheer } = stands({ group, M, story, seed, toWorld, labels: [] });
  const line = story.riders.map((c, i) => {
    const m = mount(M, colorOf(story, c.id), coatOf(story, c.id));
    m.h.g.position.set(-11 + i * 3.1, 0, -7.5 + (i % 2) * 1.2);
    m.h.g.rotation.y = 0.75; // turned a little, so the horses show side on
    m.lance.rotation.x = -1.2; // upright
    group.add(m.h.g);
    return { m, ph: rand01(seed, 'gline', i) * 6 };
  });
  return {
    group,
    labels,
    banner: null,
    focus: toWorld(0, 1.6, -7.5),
    cam(u) {
      const e = ease(u);
      return { pos: toWorld(-6 + 8 * e, 5.5 - 1.5 * e, 16 - 3 * e), look: toWorld(1 * e, 2.8, -9) };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      group.visible = on;
      if (!on) return;
      for (const { m, ph } of line) {
        gallop(m.h, t * 2 + ph, 0.06); // restless
        m.h.g.rotation.y = 0.75 + 0.05 * Math.sin(t * 1.3 + ph);
      }
      cheer(t, 0.8);
    },
  };
}

/** 25.5-30 s: the new Knight rides along the lists, lance up, the crowd on its feet. */
function outro({ story, M, buildings, seed }) {
  const L0 = lot(buildings);
  if (!L0) return null;
  const { group, toWorld } = L0;
  const labels = [];
  const { cheer } = stands({ group, M, story, seed, toWorld, labels: [] });
  const champ = story.riders.find((r) => r.id === story.winner);
  if (!champ) return null;
  const m = mount(M, colorOf(story, champ.id), coatOf(story, champ.id));
  group.add(m.h.g);
  m.tip.visible = false; // the lance broken in the final
  plateArmor(m.R, M, { seated: true, helmet: false }); // a Knight now, in his armour (throne.js)
  const tag = { ...castTag(champ, 'A new Knight!'), pos: new THREE.Vector3() };
  const shower = petals(group, seed, [-14, 12, -10, 6]);
  labels.push(tag);
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: 'A new Knight!',
    focus: toWorld(0, 1.6, -4),
    cam(u) {
      const x = -12 + 20 * u;
      return { pos: toWorld(x - 3, 4.2, 12), look: toWorld(x + 1, 2.2, -4) };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      group.visible = on;
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0));
      m.h.g.position.set(-12 + 20 * u + 2.5, 0, -4);
      m.h.g.rotation.y = Math.PI / 2;
      gallop(m.h, t * 7, 0.35); // a proud canter
      m.lance.rotation.x = -1.3;
      m.R.r.g.rotation.set(-2.6 + 0.2 * Math.sin(t * 6), 0, 0.15);
      cheer(t, 1);
      shower(t, 1);
      group.updateMatrixWorld(true);
      tag.pos.copy(m.R.root.getWorldPosition(tmp)).setY(tmp.y + 1.6);
    },
  };
}

/** The scene of one shot of the Grand Joust (story.shot); the crowning is throne.js (step 'crown', timeline.js). */
export function buildGrandJoust(args) {
  const shot = args.story.shot;
  const span = JOUST_SHOTS.find((s) => s[0] === shot);
  if (shot === 'intro') return intro(args);
  if (shot === 'outro') return outro(args);
  if (shot in ROUND && span) return bout(args, ROUND[shot], span[2] - span[1]);
  return null;
}
