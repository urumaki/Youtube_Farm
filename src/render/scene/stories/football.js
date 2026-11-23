// Mob football (owner 2026-11-23, src/sim/stories.js `football`), the match day: the whole video, one shot after another
// (timeline.js, FOOTBALL_SHOTS), then the usual wide shot, goal and call to action. Reds against Blues, ten a side, on the
// near half of the Tournament Ground (the tilt behind them, the far stand full): the line-up and the ball thrown in, the
// scrum (a heap of players round the ball, the ball squirting out), the slide (a runner and his chasers go down in a row,
// in the mud on a wet day), the winning goal between two posts into the hay, and the winners carrying the scorer on their
// shoulders. Comic: everybody falls, nobody gets hurt. Owner 2026-11-23: nobody passes through anybody (apart, common.js,
// after each frame's placing). Names on the players near the ball (story.reds, story.blues).
// Everything in the Tournament Ground's lot frame (joust.js: the tilt along x at z 0, the far stand at z -24..-29); the field
// is z 3..17 on the near side, the goals at x = +-GX; the camera stays on the near side looking toward -z.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { boxGeo, cylGeo } from '../kit.js';
import { particles } from '../work.js';
import { person, stride, castTag, ease, clamp01, apart } from './common.js';
import { stands } from './joust.js';

export const FOOTBALL_SHOTS = [['lineup', 0, 4], ['scrum', 4, 8.5], ['slide', 8.5, 12.5], ['goal', 12.5, 18], ['carry', 18, 23.5]];
const RED = '#b3202a', BLUE = '#2a4fb3';
const GX = 15, ZM = 10; // the goals' x, the field's middle (z)
const lerp = THREE.MathUtils.lerp;
const span = (u, a, b) => clamp01((u - a) / (b - a));

function lot(buildings) {
  const it = buildings.items.tournament;
  if (!it) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(it.group.matrix);
  group.visible = false;
  return { group, toWorld: (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix) };
}

/** The ball: a stitched leather ball (a pig's bladder in leather). */
function ball(M) {
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.7 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), leather);
  m.castShadow = true;
  g.add(m);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 4, 20), M.woodDark);
  g.add(seam);
  return g;
}

/** A goal: two posts with a bar, hay bales behind it (the ball ends in the hay). */
function goal(M, x) {
  const g = new THREE.Group();
  const add = (geo, mat, px, py, pz) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  for (const z of [-2.2, 2.2]) add(cylGeo(0.09, 0.11, 2.6, 8), M.wood, 0, 1.3, z);
  add(cylGeo(0.07, 0.07, 4.6, 8).rotateX(Math.PI / 2), M.wood, 0, 2.55, 0);
  const hay = new THREE.MeshStandardMaterial({ color: '#d8b75a', roughness: 1 });
  const side = Math.sign(x);
  for (let i = 0; i < 4; i++) add(boxGeo(0.9, 0.7, 1.2), hay, side * 0.9, 0.35, -1.8 + i * 1.2);
  for (let i = 0; i < 3; i++) add(boxGeo(0.9, 0.7, 1.2), hay, side * 1.0, 1.05, -1.2 + i * 1.2);
  g.position.set(x, 0, ZM);
  return g;
}

/** The two sides as rigs in their colours, with what each one is in the story (null: a player with no name). */
function teams(M, story) {
  const side = (list, color, team) => {
    const out = (list || []).slice(0, 10);
    while (out.length < 10) out.push(null);
    return out.map((c, i) => {
      const P = person(M, color);
      P.c = c; P.team = team; P.i = i;
      return P;
    });
  };
  return { reds: side(story.reds, RED, 'red'), blues: side(story.blues, BLUE, 'blue') };
}

/** Running: legs and arms swing, the body leans into it. */
function run(P, ph, amp = 0.7, lean = 0.18) {
  stride(P, ph, amp);
  P.body.rotation.x = lean;
}
function stand(P) {
  P.body.rotation.set(0, 0, 0);
  for (const l of P.legs || []) l.rotation.set(0, 0, 0);
  P.r.g.rotation.set(0, 0, 0);
  P.l.g.rotation.set(0, 0, 0);
}
/** Lying flat after a fall (k 0..1): pitched forward onto the ground, arms out. */
function fallen(P, k, dir = 1) {
  P.body.rotation.x = 1.45 * ease(k) * dir;
  P.root.position.y = -0.55 * ease(k);
  P.r.g.rotation.set(-2.6 * ease(k), 0, -0.4);
  P.l.g.rotation.set(-2.6 * ease(k), 0, 0.4);
  for (const l of P.legs || []) l.rotation.x = -0.5 * ease(k);
}
const face = (P, dx, dz) => { P.root.rotation.y = Math.atan2(dx, dz); };

/** Everything every shot shares: the frame, the stands, the goals, the players, the ball, mud and splashes. */
function pitch(args, crowdLoud = 0.6) {
  const { story, M, buildings, seed, state } = args;
  const L = lot(buildings);
  if (!L) return null;
  const { group, toWorld } = L;
  const labels = [];
  const st = stands({ group, M, story, seed, toWorld, labels });
  for (const x of [-GX, GX]) group.add(goal(M, x));
  const wet = ['rain', 'storm', 'snow'].includes(state.weather);
  // the field: trampled ground, darker and shiny on a wet day
  const field = new THREE.Mesh(new THREE.PlaneGeometry(GX * 2 + 6, 15).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: wet ? '#4a3a26' : '#7d6a45', roughness: wet ? 0.35 : 0.95 }));
  field.position.set(0, 0.02, ZM);
  field.receiveShadow = true;
  group.add(field);
  const T = teams(M, story);
  const all = [...T.reds, ...T.blues];
  for (const P of all) group.add(P.root);
  const B = ball(M);
  group.add(B);
  const splash = particles(70, wet ? '#5a4630' : '#c9b48a', 0.16, false);
  group.add(splash);
  const tmp = new THREE.Vector3();
  const tag = (P, sub) => ({ P, ...castTag(P.c, sub ?? (P.team === 'red' ? 'Reds' : 'Blues')), pos: new THREE.Vector3() });
  const place = (ls, d = 0.6) => { apart(all, d); group.updateMatrixWorld(true); for (const l of ls) if (l.P) l.pos.copy(l.P.root.getWorldPosition(tmp)).setY(tmp.y + 2.35); };
  /** A burst of mud or dust at (x, z), `age` seconds after it began (k: how many). */
  const burst = (x, z, age, n = 70) => {
    const arr = splash.geometry.attributes.position.array;
    for (let i = 0; i < 70; i++) {
      if (i >= n || age < 0 || age > 0.9) { arr[i * 3 + 1] = -1e4; continue; }
      const a = rand01(seed, 'fbspl', i) * 6.28, v = 1 + rand01(seed, 'fbspl2', i) * 2.2;
      arr[i * 3] = x + Math.cos(a) * v * age;
      arr[i * 3 + 1] = 0.1 + (1.5 + rand01(seed, 'fbspl3', i) * 2) * age - 4.9 * age * age;
      arr[i * 3 + 2] = z + Math.sin(a) * v * age;
    }
    splash.geometry.attributes.position.needsUpdate = true;
  };
  burst(0, 0, -1);
  return { ...L, labels, T, all, B, wet, tag, place, burst, cheer: (t, k) => st.cheer(t, k ?? crowdLoud) };
}

/** The named players first (the ones the story names), up to n, for the tags. */
const named = (list, n) => list.filter((P) => P.c?.name).slice(0, n);

// --- 0-4 s: the sides lined up face to face, the ball thrown up between them, everyone charges ---
function lineupShot(args) {
  const F = pitch(args);
  if (!F) return null;
  const { group, toWorld, T, B } = F;
  const spot = (P) => {
    const k = P.i;
    const x = (P.team === 'red' ? -1 : 1) * (2 + (k % 2) * 1.3 + Math.floor(k / 5) * 0.4);
    const z = ZM - 5.4 + (k % 5) * 2.7 + (Math.floor(k / 2) % 2) * 0.5;
    return [x, z];
  };
  const labels = [...named(T.reds, 3), ...named(T.blues, 3)].map((P) => F.tag(P));
  return {
    group, labels, banner: 'Mob football! Reds against Blues', phase: 0.18,
    focus: toWorld(0, 1.2, ZM),
    cam(u) { const e = ease(u); return { pos: toWorld(-3 + 4 * e, 5.6 - 1.8 * e, ZM + 15 - 4 * e), look: toWorld(0, 1.2, ZM - 1) }; },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const go = span(u, 0.62, 1);
      for (const P of F.all) {
        const [x, z] = spot(P);
        stand(P);
        P.root.position.set(lerp(x, x * 0.25, ease(go)), 0, lerp(z, ZM + (z - ZM) * 0.4, ease(go)));
        face(P, -Math.sign(x), 0);
        if (go > 0) run(P, t * 11 + P.i, 0.75 * Math.min(1, go * 3));
        else { P.r.g.rotation.x = -0.3 + 0.1 * Math.sin(t * 6 + P.i); P.body.rotation.x = 0.15; } // crouched, ready
      }
      // the ball thrown up from the middle (by a hand out of shot) and dropping
      const b = span(u, 0.35, 0.75);
      B.position.set(0, 0.2 + 6 * b * (1 - b) * 1.6 + (b === 0 ? 2.6 : 0), ZM);
      F.cheer(t, 0.5 + 0.5 * go);
      F.place(labels);
    },
  };
}

// --- 4-8.5 s: the scrum, a heap of players round the ball; the ball squirts out at the end ---
function scrumShot(args) {
  const F = pitch(args, 0.8);
  if (!F) return null;
  const { group, toWorld, T, B, seed } = { ...F, seed: args.seed };
  const C = new THREE.Vector3(-1.5, 0, ZM);
  // three rings round the ball (6, 8 and 6 places), evenly spread, the sides mixed
  const RINGS = [[6, 0.75], [8, 1.45], [6, 2.1]];
  const order = F.all.map((P, k) => ({ P, k: rand01(seed, 'fbring', k) })).sort((a, b) => a.k - b.k).map((o) => o.P);
  let n = 0;
  const ring = [];
  RINGS.forEach(([m, r], q) => { for (let j = 0; j < m && n < order.length; j++, n++) {
    const a = (j / m) * Math.PI * 2 + q * 0.4 + rand01(seed, 'fbringa', n) * 0.25;
    ring.push({ P: order[n], a, r, ph: rand01(seed, 'fbringph', n) * 6, low: q === 0 && j % 2 === 0 });
  } });
  const labels = [...named(T.reds, 2), ...named(T.blues, 2)].map((P) => F.tag(P));
  return {
    group, labels, banner: 'Into the scrum!', phase: 0.2, low: true,
    focus: toWorld(C.x, 1.0, C.z),
    cam(u) { return { pos: toWorld(C.x - 4 + 3 * u, 1.6, C.z + 6.5 - 1.2 * u), look: toWorld(C.x, 0.9, C.z) }; },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const out = span(u, 0.72, 1);
      for (const { P, a, r, ph, low } of ring) {
        stand(P);
        const sway = 0.25 * Math.sin(t * 5 + ph);
        P.root.position.set(C.x + Math.cos(a + sway * 0.2) * (r + sway * 0.2), 0, C.z + Math.sin(a + sway * 0.2) * (r + sway * 0.2));
        face(P, -Math.cos(a), -Math.sin(a));
        P.body.rotation.x = low ? 0.9 : 0.45 + 0.1 * Math.sin(t * 7 + ph); // heads down, shoving
        P.r.g.rotation.x = -1.2 + 0.3 * Math.sin(t * 9 + ph);
        P.l.g.rotation.x = -1.1 + 0.3 * Math.cos(t * 8 + ph);
        for (const l of P.legs) l.rotation.x = 0.35 * Math.sin(t * 10 + ph);
        // when the ball squirts out, the heap turns and runs after it
        if (out > 0) { face(P, 1, 0.2); run(P, t * 12 + ph, 0.7 * out); P.root.position.x += 3.5 * out * out; }
      }
      // the ball hidden in the heap, then squirting out toward +x, bouncing
      if (out <= 0) B.position.set(C.x + 0.2 * Math.sin(t * 9), 0.3 + 0.15 * Math.abs(Math.sin(t * 13)), C.z);
      else B.position.set(C.x + 7 * out, 0.2 + 1.2 * Math.abs(Math.sin(out * 7)) * (1 - out), C.z + 0.6 * out);
      F.cheer(t, 0.8);
      F.place(labels);
    },
  };
}

// --- 8.5-12.5 s: a runner with the ball and three chasers; they dive, all four slide in a row (mud on a wet day) ---
function slideShot(args) {
  const F = pitch(args, 0.9);
  if (!F) return null;
  const { group, toWorld, T, B } = F;
  const runner = T.blues.find((P) => P.c?.name) || T.blues[0];
  const chasers = T.reds.filter((P) => P.c?.name).slice(0, 3);
  while (chasers.length < 3) chasers.push(T.reds[chasers.length + 4]);
  const crew = [runner, ...chasers];
  const others = F.all.filter((P) => !crew.includes(P));
  const DIVE = 0.55; // the share of the shot at which the first chaser dives
  const labels = crew.filter((P) => P.c?.name).map((P) => F.tag(P));
  return {
    group, labels, banner: F.wet ? 'Into the mud!' : 'Down they go!', phase: 0.22, low: true,
    focus: toWorld(0, 0.8, ZM + 1),
    // (the frame is narrow: from a little ahead and to the side, looking back along the run, so the chasers are in it)
    cam(u) { const x = -6.5 + 7 * u; return { pos: toWorld(x + 4.5, 1.6, ZM + 6.5), look: toWorld(x - 1.2, 0.6, ZM + 0.6) }; },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0)), s = u * (t1 - t0);
      const head = -8 + 3.6 * Math.min(s, DIVE * (t1 - t0)) + 1.2 * Math.max(0, s - DIVE * (t1 - t0)) * Math.exp(-Math.max(0, s - DIVE * (t1 - t0)));
      crew.forEach((P, k) => {
        stand(P);
        const lag = k ? 1.1 + k * 0.9 : 0;
        const dive = span(u, DIVE + k * 0.06, DIVE + k * 0.06 + 0.12);
        const slide = 1.6 * ease(span(u, DIVE + k * 0.06, DIVE + k * 0.06 + 0.25));
        const x = head - lag + slide - (k ? 0 : 0.2);
        P.root.position.set(x, 0, ZM + 1 + [0, 0.8, -0.8, 1.6][k]);
        face(P, 1, 0);
        if (dive > 0) {
          // the runner trips on the first chaser's dive and goes down too: a heap of four sliding in the mud
          fallen(P, dive);
          P.root.position.y += 0.5 * Math.sin(Math.PI * dive) * (1 - dive);
        } else run(P, t * 12 + k, 0.8, 0.25);
      });
      const fell = span(u, DIVE, DIVE + 0.12);
      F.burst(head + 1.2, ZM + 1, s - DIVE * (t1 - t0));
      // the ball runs on alone and rolls away
      B.position.set(head + 0.5 + 2.5 * ease(fell), 0.2 + 0.4 * Math.abs(Math.sin(t * 10)) * (1 - fell), ZM + 1.1);
      for (const P of others) {
        stand(P);
        P.root.position.set(-14 + (P.i % 5) * 1.6 + (P.team === 'red' ? 0 : 0.8) + 3 * u, 0, ZM + 3 + (P.i % 3) * 1.2);
        face(P, 1, 0);
        run(P, t * 10 + P.i, 0.6);
      }
      F.cheer(t, 0.6 + 0.4 * fell);
      F.place(labels);
    },
  };
}

/** The scorer of the winning goal (the last goal), as a rig of the winners. */
function scorerOf(T, story) {
  const last = (story.goals || []).at(-1);
  const side = story.winner === 'blue' ? T.blues : T.reds;
  return side.find((P) => P.c && P.c.id === last?.by) || side.find((P) => P.c?.name) || side[0];
}

// --- 12.5-18 s: the winning goal: the scorer runs in alone, the keeper dives the wrong way, the ball into the hay ---
function goalShot(args) {
  const F = pitch(args, 0.9);
  if (!F) return null;
  const { group, toWorld, T, B } = F;
  const story = args.story;
  const scorer = scorerOf(T, story);
  const dir = story.winner === 'blue' ? -1 : 1; // the winners shoot at the far end of their way
  const losers = story.winner === 'blue' ? T.reds : T.blues;
  const keeper = losers[9];
  const chasers = losers.slice(0, 3);
  const KICK = 0.62;
  const labels = [F.tag(scorer)];
  const goalX = dir * GX;
  return {
    group, labels, phase: 0.24,
    bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > KICK + 0.1 ? 'GOAL!' : null),
    focus: toWorld(goalX - dir * 4, 1, ZM),
    // behind the scorer and a little to the side: the scorer, the keeper and the goal ahead in the frame all the way in;
    // the camera stops at the kick and the ball flies into the hay
    cam(u) {
      const k = ease(span(u, 0, KICK));
      const sx = goalX - dir * lerp(13, 4.2, k);
      return { pos: toWorld(sx - dir * 4.2, 2.2, ZM + 1.6), look: toWorld(goalX - dir * 3, 1.0, ZM + 0.2), fov: 55 };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const k = span(u, 0, KICK), fly = span(u, KICK, KICK + 0.12), joy = span(u, KICK + 0.12, 1);
      // the scorer: the run in, the kick, arms up
      stand(scorer);
      const sx = goalX - dir * lerp(13, 4.2, k);
      scorer.root.position.set(sx, 0, ZM + 0.6);
      face(scorer, dir, 0);
      if (k < 1) run(scorer, t * 12, 0.85, 0.22);
      else {
        scorer.legs[1].rotation.x = -1.2 * Math.sin(Math.PI * Math.min(1, fly * 2)); // the kick
        if (joy > 0) { face(scorer, -dir, 0.3); scorer.r.g.rotation.set(-2.9, 0, 0.2); scorer.l.g.rotation.set(-2.9, 0, -0.2); scorer.root.position.y = 0.25 * Math.abs(Math.sin(t * 9)); } // round to the camera
      }
      // the ball at his feet, then into the goal and the hay
      if (k < 1) B.position.set(sx + dir * 0.45, 0.2 + 0.25 * Math.abs(Math.sin(t * 12)), ZM + 0.6);
      else B.position.set(lerp(sx + dir * 0.45, goalX + dir * 0.8, ease(fly)), 0.2 + 1.3 * Math.sin(Math.PI * fly) + 0.6 * fly, lerp(ZM + 0.6, ZM - 0.6, fly));
      // the keeper dives the wrong way
      stand(keeper);
      keeper.root.position.set(goalX - dir * 0.4, 0, ZM);
      face(keeper, -dir, 0);
      const dv = span(u, KICK - 0.05, KICK + 0.12);
      if (dv > 0) { keeper.root.rotation.z = dir * 1.3 * ease(dv); keeper.root.position.z = ZM + 1.6 * ease(dv); keeper.root.position.y = -0.3 * ease(dv); }
      else keeper.root.rotation.z = 0;
      keeper.r.g.rotation.set(-2.2, 0, 0); keeper.l.g.rotation.set(-2.2, 0, 0);
      // three chasers left behind
      chasers.forEach((P, i) => {
        stand(P);
        P.root.position.set(sx - dir * (2.4 + i * 1.0), 0, ZM - 0.8 - i * 0.9);
        face(P, dir, 0);
        if (fly > 0) { P.r.g.rotation.set(-0.3, 0, 0.6); P.body.rotation.x = 0.3; } else run(P, t * 11 + i, 0.75);
      });
      for (const P of F.all) if (P !== scorer && P !== keeper && !chasers.includes(P)) P.root.position.set(0, -50, 0);
      F.burst(goalX + dir * 0.8, ZM - 0.6, (u - KICK - 0.12) * (t1 - t0));
      F.cheer(t, fly > 0 ? 1 : 0.6);
      F.place(labels);
    },
  };
}

// --- 18-23.5 s: the winners carry the scorer on their shoulders, the losers sit in the mud, the score over it ---
function carryShot(args) {
  const F = pitch(args, 1);
  if (!F) return null;
  const { group, toWorld, T } = F;
  const story = args.story;
  const scorer = scorerOf(T, story);
  const winners = (story.winner === 'blue' ? T.blues : T.reds).filter((P) => P !== scorer);
  const losers = story.winner === 'blue' ? T.reds : T.blues;
  const bearers = winners.slice(0, 4), rest = winners.slice(4);
  const sc = story.score || { red: 0, blue: 0 };
  const line = `REDS ${sc.red} – ${sc.blue} BLUES`;
  const labels = [F.tag(scorer, 'Scored the winner!'), ...named(rest, 3).map((P) => F.tag(P))];
  F.B.position.set(0, -50, 0);
  return {
    group, labels, banner: line, phase: 0.26,
    focus: toWorld(0, 1.5, ZM),
    cam(u) { return { pos: toWorld(-5 + 4 * u, 2.6, ZM + 9 - 1.5 * u), look: toWorld(0.5 * u, 1.9, ZM) }; },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const cx = -3 + 5 * u;
      bearers.forEach((P, i) => {
        stand(P);
        P.root.position.set(cx + (i % 2 ? 0.45 : -0.45), 0, ZM + (i < 2 ? -0.4 : 0.4));
        face(P, 1, 0);
        run(P, t * 8 + i, 0.35, 0.05);
        P.r.g.rotation.set(-2.9, 0, 0); P.l.g.rotation.set(-2.9, 0, 0);
      });
      // the scorer up on their hands, arms high
      stand(scorer);
      scorer.root.position.set(cx, 1.55 + 0.06 * Math.sin(t * 8), ZM);
      face(scorer, 0, 1);
      scorer.r.g.rotation.set(-2.9 + 0.15 * Math.sin(t * 9), 0, 0.3);
      scorer.l.g.rotation.set(-2.9 + 0.15 * Math.cos(t * 9), 0, -0.3);
      rest.forEach((P, i) => {
        stand(P);
        P.root.position.set(cx - 2.5 + (i % 3) * 1.4, 0.15 * Math.abs(Math.sin(t * 8 + i)), ZM + 2 + Math.floor(i / 3) * 1.1);
        face(P, 0, 1);
        P.r.g.rotation.set(-2.8, 0, 0.2); P.l.g.rotation.set(i % 2 ? -2.8 : -0.3, 0, -0.2);
      });
      // the losers sitting in the mud, laughing it off (one gives a thumbs up)
      losers.forEach((P, i) => {
        stand(P);
        P.root.position.set(-9 + i * 1.5, -0.3, ZM - 3.2 + (i % 2) * 0.7);
        face(P, 0.3, 1);
        P.body.rotation.x = -0.25;
        for (const l of P.legs) l.rotation.x = -1.4;
        P.r.g.rotation.set(i % 3 === 0 ? -2.2 : -0.5, 0, 0);
      });
      F.cheer(t, 1);
      F.place(labels);
    },
  };
}

const SHOTS = { lineup: lineupShot, scrum: scrumShot, slide: slideShot, goal: goalShot, carry: carryShot };

/** The scene of one shot of the match (args.story.shot); the announcement is games.js. */
export function buildFootball(args) {
  const f = SHOTS[args.story.shot];
  return f ? f(args) : null;
}
