// The Dungeon escape (owner 2026-11-05, src/sim/stories.js `escape`): the whole video, one shot after another (timeline.js,
// ESCAPE_SHOTS), then the usual wide shot, goal and call to action. At night in a cell under the castle a named prisoner
// pulls the loose stone out of the back wall and crawls into the tunnel behind it, another after him; in the morning a
// paving slab of the market square lifts and the prisoners climb out one by one and tiptoe off; a named guard runs up out
// of the Dungeon's stairs blowing his horn, the others after him; the chase between the stalls (a prisoner leaps a barrel,
// a guard slips on the cabbages and sits down); the prisoners caught at the bread cart with their mouths full, hands up,
// and marched back, chewing and waving. Comic: nobody gets hurt. "Subscribe to join the kingdom" at the bottom of every shot.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { nod } from '../work.js';
import { person, stride, stage, castTag, flameMaterial, flicker, ease, clamp01 } from './common.js';

export const ESCAPE_SHOTS = [['dig', 0, 4.5], ['popup', 4.5, 9], ['alarm', 9, 12.5], ['chase', 12.5, 17.5], ['caught', 17.5, 23.5]];
const FOOTER = 'Subscribe to join the kingdom';
const PRISONER = JOBS.prisoner?.color || '#6b6250', GUARD = JOBS.guard.color, BAKER = JOBS.baker.color;
const FOLK = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e', '#b5476b'];
const NIGHT = 1, MORNING = 0.1;
const lerp = THREE.MathUtils.lerp;
const span = (u, a, b) => clamp01((u - a) / (b - a));

/** A group in the frame of a building (x across its front, z out of its front, y up from its ground). */
function frameOf(buildings, id) {
  const it = buildings.items[id];
  if (!it) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(it.group.matrix);
  group.matrixWorld.copy(group.matrix);
  group.visible = false;
  return { group, toWorld: (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix) };
}

const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};
/** Someone at (x, z) of the frame facing (dx, dz). */
function put(P, x, z, dx = 0, dz = 1, y = 0) {
  P.root.position.set(x, y, z);
  P.root.rotation.y = Math.atan2(dx, dz);
}
function still(P) {
  P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
  P.r.g.rotation.set(0, 0, 0); P.l.g.rotation.set(0, 0, 0);
  P.body.rotation.set(0, 0, 0);
  for (const m of [P.head, P.hat]) m.rotation.y = 0;
}
function look(P, a) { for (const m of [P.head, P.hat]) m.rotation.y = a; }
function loafGeo() { return new THREE.SphereGeometry(0.1, 10, 7).scale(1.9, 0.9, 1); }
function breadMat(M) { const m = M.people.clone(); m.color.set('#c98a44'); return m; }
/** A name tag over each named member of the cast, following them. */
function tags(list, sub) {
  return list.filter((x) => x.c).map((x) => ({ x, ...castTag(x.c, sub?.(x)) }));
}
function placeTags(labels, group, y = 2.35) {
  for (const l of labels) l.pos.copy(l.x.P.root.position).setY(l.x.P.root.position.y + y).applyMatrix4(group.matrix);
}

// --- at night in a cell: the loose stone out of the back wall, the tunnel behind, two prisoners crawl in ---
function digShot({ story, M, buildings, seed }) {
  const F = frameOf(buildings, 'dungeon');
  if (!F) return null;
  const { group } = F;
  const room = new THREE.Group();
  room.position.y = -40; // a set under the stair head, seen only during its shot
  group.add(room);
  // the cell: x -2..2, the back wall at z -2 with the tunnel's mouth (x -0.95..-0.05, y 0..0.9), the bars at z 2, the
  // corridor in front where the camera stands
  mesh(boxGeo(6, 0.2, 8, 3), M.stoneDark, room, 0, -0.1, 1);
  mesh(boxGeo(6, 0.2, 8), M.stoneDark, room, 0, 2.9, 1);
  mesh(boxGeo(1.05, 2.8, 0.4), M.stone, room, -1.475, 1.4, -2.2);
  mesh(boxGeo(2.05, 2.8, 0.4), M.stone, room, 0.975, 1.4, -2.2);
  mesh(boxGeo(0.9, 1.9, 0.4), M.stone, room, -0.5, 1.85, -2.2);
  for (const s of [-1, 1]) mesh(boxGeo(0.4, 2.8, 8), M.stone, room, s * 2.2, 1.4, 1);
  mesh(boxGeo(6, 2.8, 0.3), M.stone, room, 0, 1.4, 5);
  const dark = new THREE.MeshBasicMaterial({ color: '#050404', side: THREE.BackSide });
  mesh(boxGeo(0.9, 0.9, 2.4), dark, room, -0.5, 0.45, -3.6).castShadow = false; // the tunnel
  for (let x = -1.9; x <= 1.9; x += 0.18) mesh(cylGeo(0.022, 0.022, 2.8, 6), M.iron, room, x, 1.4, 2);
  for (const y of [0.15, 1.2, 2.6]) mesh(boxGeo(4, 0.07, 0.05), M.iron, room, 0, y, 2);
  mesh(boxGeo(1.6, 0.08, 1.2).rotateY(0.3), M.hay, room, 1.1, 0.04, 0.5);
  // a small barred window high up, moonlight through it
  mesh(boxGeo(0.6, 0.35, 0.05), new THREE.MeshBasicMaterial({ color: '#9fb4d8' }), room, 1.0, 2.35, -1.98).castShadow = false;
  for (const x of [0.85, 1.0, 1.15]) mesh(boxGeo(0.03, 0.36, 0.04), M.iron, room, x, 2.35, -1.96);
  const moonLight = new THREE.PointLight('#8fa6d6', 2.2, 7, 1.5);
  moonLight.position.set(0.9, 2.1, -1.4);
  room.add(moonLight);
  // the candle in a dish by the hole, its warm light
  mesh(cylGeo(0.09, 0.09, 0.03, 10), M.iron, room, 0.95, 0.015, -1.0);
  mesh(cylGeo(0.03, 0.03, 0.16, 8), M.clothIvory, room, 0.95, 0.11, -1.0);
  const flame = mesh(new THREE.ConeGeometry(0.03, 0.09, 6), flameMaterial('#ffc266'), room, 0.95, 0.23, -1.0);
  flame.castShadow = false;
  const candle = new THREE.PointLight('#ffb366', 5, 6, 1.4);
  candle.position.set(0.8, 0.6, -0.9);
  room.add(candle);
  // the loose stone that hid the tunnel
  const plug = mesh(boxGeo(0.88, 0.88, 0.36), M.stone, room, -0.5, 0.45, -2.2);
  // the two prisoners: the digger kneels at the wall with his spoon, the other keeps watch at the bars
  const cast = (story.prisoners || []).slice(0, 2);
  const A = { P: person(M, PRISONER), c: cast[0] }, B = { P: person(M, PRISONER), c: cast[1] };
  for (const x of [A, B]) room.add(x.P.root);
  const spoon = mesh(boxGeo(0.03, 0.26, 0.03).translate(0, -0.12, 0.03), M.iron, A.P.r.hand);
  spoon.castShadow = false;
  const labels = tags([A, B]);
  return {
    group, labels, banner: 'Meanwhile, in the Dungeon...', footer: FOOTER, phase: NIGHT, interior: true,
    focus: F.toWorld(0, -39, 0),
    cam(u) { return { pos: F.toWorld(1.75 - 0.25 * u, -37.75, 1.75 - 0.3 * u), look: F.toWorld(-0.6, -39.45, -1.6), fov: 60 }; },
    update(t, t0, t1) {
      group.visible = t >= t0 && t < t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      flicker(flame, t, 1);
      candle.intensity = 5 * (1 + 0.1 * Math.sin(t * 19));
      // the stone: wriggled loose (to 0.22), pulled out into the room and tipped over on the floor (to 0.36)
      const pull = ease(span(u, 0.06, 0.22)), tip = ease(span(u, 0.22, 0.34));
      plug.position.set(-0.5 + 0.55 * tip, 0.45 - 0.27 * tip + 0.02 * Math.sin(t * 40) * (u < 0.2 ? 1 : 0), -2.2 + 0.55 * pull + 0.35 * tip);
      plug.rotation.x = -1.5 * tip;
      // the digger: kneeling at the wall, then crawling head first into the tunnel and out of sight
      const P = A.P;
      still(P);
      const crawl = span(u, 0.4, 0.66);
      if (crawl <= 0) {
        put(P, -0.5, -1.45, 0, -1, -0.28);
        P.legs[0].rotation.x = -0.9; P.legs[1].rotation.x = -0.75;
        P.body.rotation.x = 0.35;
        const pulling = u < 0.22;
        P.r.g.rotation.set(pulling ? -1.2 + 0.15 * Math.sin(t * 30) : -0.6, 0, -0.15);
        P.l.g.rotation.set(pulling ? -1.2 - 0.15 * Math.sin(t * 30) : -0.4, 0, 0.15);
        look(P, u > 0.25 ? 0.6 * Math.sin((u - 0.25) * 18) : 0); // a look back over his shoulder
      } else {
        // flat on his belly, sliding into the tunnel
        put(P, -0.5, -1.4 - 1.9 * crawl, 0, -1, 0.05);
        P.body.rotation.x = 1.45;
        P.body.position.y = 0.3;
        P.legs[0].rotation.x = 1.45 + 0.25 * Math.sin(t * 16); P.legs[1].rotation.x = 1.45 - 0.25 * Math.sin(t * 16);
        P.r.g.rotation.set(-2.9, 0, 0); P.l.g.rotation.set(-2.9, 0, 0);
      }
      if (crawl <= 0) P.body.position.y = 0.62;
      P.root.visible = crawl < 1;
      // the lookout: at the bars, looking up and down the corridor; then on his knees and in after him
      const Q = B.P;
      still(Q);
      const go = span(u, 0.7, 0.98);
      if (u < 0.62) {
        // by the side wall, listening for the guard down the corridor, a finger to his lips
        put(Q, -1.55, 0.5, 0.5, 1);
        look(Q, 0.8 * Math.sin(t * 2.6));
        Q.r.g.rotation.set(-2.5, 0, 0.45);
        Q.body.position.y = 0.62;
      } else if (go <= 0) {
        // hurrying across to the hole
        const k = ease(span(u, 0.62, 0.7));
        put(Q, lerp(-1.55, -0.5, k), lerp(0.5, -1.2, k), 0.6, -1);
        stride(Q, t * 14, 0.6);
        Q.body.position.y = 0.62;
      } else {
        put(Q, -0.5, -1.3 - 1.9 * go, 0, -1, 0.05);
        Q.body.rotation.x = 1.45;
        Q.body.position.y = 0.3;
        Q.legs[0].rotation.x = 1.45 + 0.25 * Math.sin(t * 16); Q.legs[1].rotation.x = 1.45 - 0.25 * Math.sin(t * 16);
        Q.r.g.rotation.set(-2.9, 0, 0); Q.l.g.rotation.set(-2.9, 0, 0);
      }
      for (const l of labels) {
        l.pos.copy(l.x.P.root.position).add(room.position).setY(room.position.y + (l.x.P.body.rotation.x > 1 ? 0.9 : 2.25)).applyMatrix4(group.matrix);
        l.hidden = !l.x.P.root.visible;
      }
    },
  };
}

// --- in the morning: a slab of the market square lifts, the prisoners climb out and tiptoe off ---
const HOLE = new THREE.Vector3(4, 0, 2.5);
function popupShot({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const holeMat = new THREE.MeshBasicMaterial({ color: '#070505' });
  const hole = mesh(new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2), holeMat, group, HOLE.x, 0.07, HOLE.z);
  hole.castShadow = false;
  const slab = mesh(boxGeo(1.0, 0.12, 1.0), M.stone, group, HOLE.x, 0.06, HOLE.z);
  const crew = (story.prisoners || []).slice(0, 4).map((c, i) => ({ P: person(M, PRISONER), c, i }));
  while (crew.length < 3) crew.push({ P: person(M, PRISONER), c: null, i: crew.length });
  for (const x of crew) group.add(x.P.root);
  // a woman drops her basket, a man at the stall stares
  const folk = FOLK.slice(0, 4).map((col, i) => { const P = person(M, col); group.add(P.root); return P; });
  const basket = mesh(cylGeo(0.22, 0.16, 0.22, 10), M.wood, group, 0, 0, 0);
  const apples = [0, 1, 2, 3].map((k) => mesh(new THREE.SphereGeometry(0.07, 8, 6), M.clothRed, group));
  const labels = tags(crew);
  // when each one comes up (share of the shot) and which way he tiptoes off
  const UP = [0.18, 0.42, 0.62, 0.78], AWAY = [[0.85, 0.5], [-0.85, -0.5], [0.5, -0.85], [0.95, -0.2]];
  return {
    group, labels, banner: 'A hole in the market square!', footer: FOOTER, phase: MORNING, quietTown: true, low: true,
    focus: st.toWorld(HOLE.x, 0.8, HOLE.z),
    cam(u) { return { pos: st.toWorld(HOLE.x - 3.3 + 0.5 * u, 2.6, HOLE.z + 5.2 - 0.4 * u), look: st.toWorld(HOLE.x + 0.4, 0.95, HOLE.z - 0.6) }; },
    update(t, t0, t1) {
      group.visible = t >= t0 && t < t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0), T = t - t0;
      // the slab: pushed up from below, slid aside
      const lift = ease(span(u, 0.04, 0.12)), slide = ease(span(u, 0.12, 0.2));
      slab.position.set(HOLE.x + 1.05 * slide, 0.06 + 0.25 * lift * (1 - slide) + 0.02 * slide, HOLE.z + 0.2 * slide);
      slab.rotation.z = -0.4 * lift * (1 - slide);
      crew.forEach((x, i) => {
        const P = x.P;
        still(P);
        const up = ease(span(u, UP[i], UP[i] + 0.12)), off = span(u, UP[i] + 0.2, 1);
        P.root.visible = u > UP[i] - 0.02;
        if (off <= 0) {
          // rising out of the hole, looking left and right, then climbing out on to the paving
          put(P, HOLE.x + (i % 2 ? 0.1 : -0.1), HOLE.z, -1, 0.4, lerp(-1.9, 0, up));
          look(P, up >= 1 ? 1.1 * Math.sin((u - UP[i] - 0.12) * 28) : 0);
          P.r.g.rotation.set(-0.5 - 1.6 * (1 - up), 0, -0.3); P.l.g.rotation.set(-0.5 - 1.6 * (1 - up), 0, 0.3);
        } else {
          // tiptoeing off, knees high, arms bent, looking round
          const [dx, dz] = AWAY[i], d = off * 4.2;
          put(P, HOLE.x + dx * d, HOLE.z + dz * d, dx, dz);
          stride(P, d * 5, 0.55, { arms: false });
          P.r.g.rotation.set(-1.1, 0, -0.5); P.l.g.rotation.set(-1.1, 0, 0.5);
          P.body.rotation.x = 0.25;
          look(P, 0.7 * Math.sin(t * 5 + i));
        }
      });
      // the woman with the basket: walking past, then a start, the basket drops and the apples roll
      const W = folk[0], seen = u > 0.24;
      still(W);
      const wx = HOLE.x + 2.6 - (seen ? 0.6 : 0.6 * (u / 0.24)), wz = HOLE.z - 1.8;
      put(W, wx, wz, -1, 0.2);
      if (!seen) stride(W, u * 14, 0.4);
      W.r.g.rotation.set(seen ? -2.6 : -0.3, 0, seen ? -0.3 : 0); W.l.g.rotation.set(seen ? -2.5 : -0.3, 0, seen ? 0.3 : 0);
      W.body.rotation.x = seen ? -0.15 : 0;
      const fall = ease(span(u, 0.24, 0.32));
      basket.position.set(wx - 0.35, lerp(0.75, 0.11, fall), wz + 0.25);
      basket.rotation.z = 1.4 * fall;
      apples.forEach((a, k) => {
        const roll = span(u, 0.3, 0.75);
        a.position.set(wx - 0.35 - roll * (0.5 + 0.35 * k), 0.07 + (1 - fall) * 0.8, wz + 0.25 + roll * (k - 1.5) * 0.4);
      });
      // three more at the stalls, staring
      folk.slice(1).forEach((P, k) => {
        still(P);
        put(P, HOLE.x - 3 + k * 1.6, HOLE.z - 4.5 - (k % 2) * 0.6, 0.3 * (k - 1), 1);
        if (u > 0.3 + k * 0.08) { P.r.g.rotation.set(-1.5, 0, 0); P.body.rotation.x = -0.1; } // pointing
      });
      placeTags(labels, group);
    },
  };
}

// --- the Dungeon's stair head: a named guard runs up out of the door blowing his horn, the others after him ---
function alarmShot({ story, M, buildings }) {
  const F = frameOf(buildings, 'dungeon');
  if (!F) return null;
  const { group } = F;
  const cast = (story.guards || []).slice(0, 3);
  const guards = [0, 1, 2].map((i) => ({ P: person(M, cast[i] ? JOBS[cast[i].job]?.color || GUARD : GUARD), c: cast[i] || null, i }));
  for (const x of guards) group.add(x.P.root);
  const horn = mesh(new THREE.ConeGeometry(0.07, 0.4, 10).rotateX(Math.PI).translate(0, -0.2, 0.05), M.gold || M.wood, guards[0].P.r.hand);
  horn.castShadow = false;
  for (const x of guards.slice(1)) mesh(cylGeo(0.02, 0.02, 1.9, 5).translate(0, -0.2, 0.05), M.woodDark, x.P.r.hand); // spears
  const labels = tags(guards);
  return {
    group, labels, banner: 'The cells are empty!', footer: FOOTER, phase: MORNING, quietCastle: true, low: true,
    focus: F.toWorld(0, 1.3, 2),
    cam(u) { return { pos: F.toWorld(3.0 - 0.4 * u, 1.5, 7.8 - 0.4 * u), look: F.toWorld(-0.1, 1.3, 2.0) }; },
    update(t, t0, t1) {
      group.visible = t >= t0 && t < t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      guards.forEach((x, i) => {
        const P = x.P;
        still(P);
        if (i === 0) {
          // out of the door at a run, a stop on the paving and a long blast on the horn
          const run = ease(span(u, 0, 0.35));
          put(P, lerp(0, -0.8, run), lerp(0.4, 3.0, run), 0.25, 1);
          if (run < 1) stride(P, u * 30, 0.7);
          const blow = span(u, 0.38, 0.46);
          P.r.g.rotation.set(lerp(-0.4, -2.2, blow), 0, -0.55 * blow); // the horn to his mouth
          P.body.rotation.x = -0.18 * blow;
          P.l.g.rotation.set(-0.3, 0, 0.2 + 0.4 * blow);
          look(P, 0);
        } else {
          // the others out after him and off at a run, one each way
          const from = 0.26 + i * 0.16, run = span(u, from, from + 0.5);
          const d = run * 9;
          P.root.visible = u > from - 0.02;
          put(P, Math.max(0, d - 2) * 0.95 + (i - 1) * 0.4, 0.4 + Math.min(d, 2) + Math.max(0, d - 2) * 0.3, d > 2 ? 1 : 0.2, d > 2 ? 0.3 : 1);
          stride(P, d * 4, 0.75);
          P.r.g.rotation.set(-0.9, 0, 0);
        }
      });
      placeTags(labels, group);
    },
  };
}

// --- the chase between the stalls: a prisoner leaps a barrel, a guard slips on the cabbages and sits down ---
function chaseShot({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const Z = 3.5, X0 = -9, PACE = 4.6, GAP = 1.0;
  const runners = (story.prisoners || []).slice(0, 3).map((c, i) => ({ P: person(M, PRISONER), c, i }));
  while (runners.length < 2) runners.push({ P: person(M, PRISONER), c: null, i: runners.length });
  const cg = (story.guards || []).slice(0, 3);
  const chasers = [0, 1].map((i) => ({ P: person(M, cg[i] ? JOBS[cg[i].job]?.color || GUARD : GUARD), c: cg[i] || null, i }));
  for (const x of [...runners, ...chasers]) group.add(x.P.root);
  for (const x of chasers) mesh(cylGeo(0.02, 0.02, 1.9, 5).translate(0, -0.2, 0.05), M.woodDark, x.P.r.hand);
  const BARREL = -6, CART = -1;
  mesh(cylGeo(0.36, 0.32, 0.8, 12), M.wood, group, BARREL, 0.4, Z);
  // the cabbage cart, tipped, its cabbages over the paving
  const cart = mesh(boxGeo(1.4, 0.5, 0.9), M.wood, group, CART, 0.55, Z + 1.3);
  cart.rotation.x = -0.3;
  for (const x of [-0.6, 0.6]) mesh(cylGeo(0.3, 0.3, 0.08, 12).rotateZ(Math.PI / 2), M.woodDark, group, CART + x, 0.3, Z + 1.45);
  for (let k = 0; k < 9; k++) mesh(new THREE.SphereGeometry(0.15, 9, 7), M.greens, group, CART - 0.8 + rand01(seed, 'cab', k) * 1.8, 0.14, Z - 0.5 + rand01(seed, 'cab', k, 1) * 1.6);
  // people at the stalls on the far side laughing
  const crowd = FOLK.map((col, i) => { const P = person(M, col); group.add(P.root); put(P, -9 + i * 2.6, Z + 4 + rand01(seed, 'chc', i), 0, -1); return P; });
  const labels = [...tags(runners), ...tags(chasers)];
  const lead = (T) => X0 + PACE * T;
  let T0 = 0, T1 = 1;
  return {
    group, labels, banner: 'After them!', footer: FOOTER, phase: MORNING, quietTown: true,
    focus: st.toWorld(0, 1, Z),
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    cam(u) {
      const x = lead(u * (T1 - T0)) - 2.4;
      return { pos: st.toWorld(x - 1.2, 2.2, Z - 10), look: st.toWorld(x + 0.4, 1.4, Z + 0.5) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t < t1;
      if (!group.visible) return;
      const T = t - t0;
      runners.forEach((x, i) => {
        const P = x.P;
        still(P);
        const px = lead(T) - i * GAP;
        // the leap over the barrel
        const over = clamp01(1 - Math.abs(px - BARREL) / 0.9);
        put(P, px, Z + (i % 2 ? 0.35 : -0.3), 1, 0, 0.75 * Math.sin(over * Math.PI / 2));
        stride(P, px * 2.6, over > 0 ? 0.2 : 0.8);
        P.r.g.rotation.set(over > 0 ? -2.6 : -1.3 + 0.5 * Math.sin(px * 2.6), 0, -0.3); P.l.g.rotation.set(over > 0 ? -2.6 : -1.3 - 0.5 * Math.sin(px * 2.6), 0, 0.3);
        if (over > 0) P.legs[0].rotation.x = P.legs[1].rotation.x = -1.0;
        look(P, i === runners.length - 1 ? -1.6 * clamp01(Math.sin(T * 2.2)) : 0); // the last looks back
      });
      chasers.forEach((x, i) => {
        const P = x.P;
        still(P);
        let px = lead(T) - runners.length * GAP - 1.2 - i * 1.2;
        // the second guard slips on the cabbages and sits down; up again a moment later
        const slip = i === 1 ? CART - 0.6 : Infinity;
        if (px > slip) {
          const k = px - slip, sit = k < 2.6 ? clamp01(k / 0.5) : clamp01(1 - (k - 2.6) / 0.6);
          if (k < 3.2) {
            px = slip + Math.min(k, 0.7) * 0.6;
            put(P, px, Z + 0.3, 1, 0, -0.45 * sit);
            P.legs[0].rotation.x = P.legs[1].rotation.x = -1.4 * sit;
            P.body.rotation.x = -0.3 * sit;
            P.r.g.rotation.set(-1.8 * sit, 0, -0.6 * sit); P.l.g.rotation.set(-1.8 * sit, 0, 0.6 * sit);
          } else {
            put(P, px - 2.7, Z + 0.3, 1, 0);
            stride(P, px * 2.6, 0.8);
            P.r.g.rotation.set(-0.9, 0, 0);
          }
        } else {
          put(P, px, Z - (i ? 0.4 : -0.1), 1, 0);
          stride(P, px * 2.6, 0.8);
          P.r.g.rotation.set(-0.9, 0, 0); P.l.g.rotation.set(-1.4 + 0.4 * Math.sin(px * 2.6), 0, 0.2);
        }
      });
      crowd.forEach((P, i) => {
        const ph = t * 9 + i * 1.3;
        still(P);
        P.body.rotation.x = 0.15 * Math.abs(Math.sin(ph));
        P.r.g.rotation.set(i % 2 ? -1.5 : -2.6 + 0.3 * Math.sin(ph), 0, -0.2);
        P.root.position.y = 0.05 * Math.abs(Math.sin(ph));
      });
      placeTags(labels, group);
    },
  };
}

// --- caught at the bread cart with their mouths full, hands up, and marched back, chewing and waving ---
function caughtShot({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = new THREE.Vector3(-6, 0, -3);
  const bread = breadMat(M);
  mesh(boxGeo(2.4, 0.9, 1.0), M.wood, group, C.x, 0.45, C.z - 0.6);
  for (const x of [-1.1, 1.1]) mesh(boxGeo(0.1, 2.3, 0.1), M.woodDark, group, C.x + x, 1.15, C.z - 1.05);
  mesh(boxGeo(2.6, 0.08, 1.2), M.clothRed, group, C.x, 2.3, C.z - 0.6);
  for (let k = 0; k < 10; k++) {
    const l = mesh(loafGeo(), bread, group, C.x - 1.0 + (k % 5) * 0.5, 0.97 + Math.floor(k / 5) * 0.12, C.z - 0.75 + (k >= 5 ? 0.25 : 0));
    l.rotation.y = rand01(seed, 'loaf', k) - 0.5;
  }
  const B = { P: person(M, story.baker ? JOBS[story.baker.job]?.color || BAKER : BAKER), c: story.baker || null };
  group.add(B.P.root);
  const crew = (story.prisoners || []).slice(0, 4).map((c, i) => ({ P: person(M, PRISONER), c, i }));
  while (crew.length < 3) crew.push({ P: person(M, PRISONER), c: null, i: crew.length });
  const cg = (story.guards || []).slice(0, 3);
  const guards = [0, 1, 2].map((i) => ({ P: person(M, cg[i] ? JOBS[cg[i].job]?.color || GUARD : GUARD), c: cg[i] || null, i }));
  for (const x of [...crew, ...guards]) group.add(x.P.root);
  for (const x of guards) mesh(cylGeo(0.02, 0.02, 1.9, 5).translate(0, -0.2, 0.05), M.woodDark, x.P.r.hand);
  for (const x of crew) mesh(loafGeo().rotateZ(Math.PI / 2), bread, x.P.r.hand, 0, -0.08, 0.05);
  const labels = [...tags(crew), ...tags(guards), ...tags([B], () => 'Baker')];
  const n = crew.length;
  const spot = (i) => C.x - 0.4 * (n - 1) + 0.8 * i;
  return {
    group, labels, banner: 'Caught with their mouths full!', footer: FOOTER, phase: MORNING, quietTown: true, low: true,
    focus: st.toWorld(C.x, 1, C.z + 1),
    cam(u) {
      const k = ease(span(u, 0.55, 1));
      return { pos: st.toWorld(C.x + 0.9 - 3.2 * k, 2.0, C.z + 6.6), look: st.toWorld(C.x + 0.3 - 3.4 * k, 1.1, C.z + 0.3) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t < t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      const caught = span(u, 0.2, 0.32), march = span(u, 0.5, 1);
      // the baker behind the cart, hands on hips, shaking his head
      still(B.P);
      put(B.P, C.x + 0.3, C.z - 1.5, 0, 1);
      B.P.r.g.rotation.set(0, 0, -0.7); B.P.l.g.rotation.set(0, 0, 0.7);
      look(B.P, 0.35 * Math.sin(t * 6));
      crew.forEach((x, i) => {
        const P = x.P;
        still(P);
        if (march <= 0) {
          put(P, spot(i), C.z + 0.35, 0, caught > 0 ? 1 : -1);
          if (caught <= 0) {
            // stuffing bread in, cheeks full
            P.r.g.rotation.set(-1.9 - 0.4 * Math.abs(Math.sin(t * 8 + i)), 0, -0.4);
            P.l.g.rotation.set(-0.8, 0, 0.2);
            P.body.rotation.x = 0.1;
          } else {
            // turned round, hands up, loaf still in one
            P.r.g.rotation.set(-2.9 * ease(caught), 0, -0.2); P.l.g.rotation.set(-2.9 * ease(caught), 0, 0.2);
            nod(P, 0.15 * Math.sin(t * 10 + i)); // still chewing
          }
        } else {
          // marched off to the left, waving at the camera
          const d = march * 3.6;
          put(P, spot(i) - d, C.z + 0.35 + 0.8 * Math.min(1, march * 4), -1, 0.15);
          stride(P, d * 4, 0.45);
          P.r.g.rotation.set(-2.7, 0, -0.5 + 0.35 * Math.sin(t * 9 + i)); // waving
          look(P, 1.1);
        }
      });
      guards.forEach((x, i) => {
        const P = x.P;
        still(P);
        // run in from the right, stop behind the prisoners, then march them off
        const run = ease(span(u, 0.08, 0.3));
        const sx = spot(n - 1) + 1.3 + i * 0.75, sz = C.z + 0.9 + (i % 2) * 0.4;
        if (march <= 0) {
          put(P, lerp(sx + 7, sx, run), sz, run < 1 ? -1 : 0, run < 1 ? 0 : -1);
          if (run < 1) stride(P, u * 40, 0.7);
          P.r.g.rotation.set(-0.5, 0, 0);
        } else {
          const d = march * 3.6;
          put(P, sx - d, sz + 0.3, -1, 0);
          stride(P, d * 4, 0.45);
          P.r.g.rotation.set(-0.4, 0, 0);
        }
      });
      placeTags(labels, group);
    },
  };
}

const SHOTS = { dig: digShot, popup: popupShot, alarm: alarmShot, chase: chaseShot, caught: caughtShot };

/** The scene of one shot of the escape (args.story.shot). */
export function buildEscape(args) {
  const f = SHOTS[args.story.shot];
  return f ? f(args) : null;
}
