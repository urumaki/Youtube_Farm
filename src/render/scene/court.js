// The courtroom of the Hall of Justice (owner 2026-11-14): a stone hall with the Judge's high bench on a dais at the back, the
// kingdom's arms and two banners behind it, the clerk's table with scrolls and a quill, the witness stand, the dock for the
// accused in the middle, benches for the public in rows toward the door, tall windows with daylight and candles on the
// bench. A closed room of its own deep under the castle mound (like the throne room), seen only in its shots and lit by its
// own lights while the camera is in (interior). Used by:
// - the Judge at work (`judge:hearing`: he hears a case and stamps the record with his seal; `judge:verdict`: he rises and
//   raises his hand), the public on the benches and a nameless accused in the dock;
// - the trial (stories.js `trial`): day 1 the named accused in the dock, the named accuser pointing from the witness stand, the
//   named public; day 2 the verdict (the likes on the two's comments): the accused cheers, or is led out by the Bailiff to the
//   sentence; neither came: the dock and the stand stay empty and the Judge dismisses the case;
// - the quarrel made up in court (stories.js `quarrel`, step 'peace' with `court`): the two before the Judge, the cabbage cut
//   in two (or the chicken, the goat shared), a handshake.
// Room frame: x across, y up from the floor, z from the bench (-z) toward the door (+z). Nobody gets hurt.
import * as THREE from 'three';
import { JOBS } from '../../sim/tiers.js';
import { CASTLE } from '../../sim/world.js';
import { TRIAL_SENTENCES } from '../../sim/stories.js';
import { Builder, boxGeo, cylGeo } from './kit.js';
import { rig, nod, toolGeo, buildWorkScene } from './work.js';
import { person, stride, castTag, flameMaterial, flicker, ease, clamp01 } from './stories/common.js';
import { chicken, goat } from './stories/quarrel.js';

export const COURT_AT = new THREE.Vector3(0, CASTLE.ground - 100, 0); // under the castle, below the throne room
const HX = 5, Z0 = -5, Z1 = 7, H = 6.2;
const JUDGE = [0, 0.5, -3.7]; // the Judge on the dais behind the bench, facing the room (+z)
const DOCK = [0, 0.1, 0.65]; // the accused, facing the bench (-z)
const WITNESS = [3.0, 0.3, -1.5];
const CLERK = [-3.0, 0, -2.25];
const BAILIFF = [-1.35, 0, 0.95];
const FOLK = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#7b6a43', '#5a6f6a', '#8e6a5a'];
// the seats on the public benches, front rows first, nearest the aisle first (x, z)
const SEATS = [];
for (const z of [2.6, 3.8, 5.0]) for (const dx of [0.95, 1.85, 2.75]) for (const s of [-1, 1]) SEATS.push([s * dx, z]);
const span = (u, a, b) => clamp01((u - a) / (b - a));
const lerp = THREE.MathUtils.lerp;

/** The room, its lights and its people's places. `toWorld(x, y, z)`: a room point in the world. */
function courtroom(M) {
  const group = new THREE.Group();
  group.position.copy(COURT_AT);
  group.visible = false;
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).add(COURT_AT);
  const b = new Builder();
  const W = 2 * HX, D = Z1 - Z0, cz = (Z0 + Z1) / 2;
  b.add('stoneDark', boxGeo(W, 0.3, D, 2), 0, -0.15, cz);
  b.add('clothRed', boxGeo(1.4, 0.03, Z1 - 1.4), 0, 0.015, (1.4 + Z1) / 2); // the aisle's carpet, from the dock to the door
  for (const s of [-1, 1]) b.add('stone', boxGeo(0.4, H, D + 0.8), s * (HX + 0.2), H / 2, cz);
  b.add('stone', boxGeo(W + 0.8, H, 0.4), 0, H / 2, Z0 - 0.2);
  b.add('stone', boxGeo(W + 0.8, H, 0.4), 0, H / 2, Z1 + 0.2);
  b.add('woodDark', boxGeo(W + 0.8, 0.3, D + 0.8), 0, H + 0.15, cz);
  for (let z = Z0 + 1; z < Z1; z += 2) b.add('woodDark', boxGeo(W, 0.3, 0.3), 0, H - 0.15, z); // the beams
  b.add('woodDark', boxGeo(2.2, 3.4, 0.2), 0, 1.7, Z1 - 0.05); // the door
  // the dais and the Judge's high bench: its front panel hides him to the chest, a tall chair back behind him
  b.add('stone', boxGeo(5.4, 0.5, 2.3), 0, 0.25, -3.85);
  b.add('woodDark', boxGeo(4.4, 1.41, 0.3), 0, 0.705, -2.85); // (owner 2026-11-14: lower, so the Judge shows to the chest)
  b.add('wood', boxGeo(4.6, 0.09, 0.85), 0, 1.45, -3.1);
  b.add('clothRed', boxGeo(1.6, 0.8, 0.02), 0, 0.9, -2.69); // a red cloth hanging down the bench's front
  b.add('woodDark', boxGeo(1.0, 2.7, 0.14), 0, 1.85, -4.45);
  b.add('clothRed', boxGeo(0.8, 1.2, 0.03), 0, 2.4, -4.37);
  // on the bench: a book, two candles, an inkpot
  b.add('clothIvory', boxGeo(0.55, 0.04, 0.38), -0.75, 1.515, -3.1);
  for (const x of [-1.9, 1.9]) { b.add('clothIvory', cylGeo(0.04, 0.04, 0.22, 8), x, 1.61, -3.2); b.add('lamp', new THREE.SphereGeometry(0.03, 6, 4).scale(1, 1.6, 1), x, 1.76, -3.2); }
  b.add('iron', cylGeo(0.05, 0.06, 0.09, 10), 0.9, 1.54, -3.0);
  // the clerk's table, a stool, scrolls
  b.add('wood', boxGeo(1.4, 0.07, 0.65), CLERK[0], 0.77, CLERK[2] + 0.65);
  for (const [dx, dz] of [[-0.6, 0.38], [0.6, 0.38], [-0.6, 0.92], [0.6, 0.92]]) b.add('woodDark', boxGeo(0.07, 0.76, 0.07), CLERK[0] + dx, 0.38, CLERK[2] + dz);
  b.add('woodDark', boxGeo(0.45, 0.45, 0.4), CLERK[0], 0.22, CLERK[2] - 0.1);
  for (let i = 0; i < 3; i++) b.add('clothIvory', cylGeo(0.04, 0.04, 0.4, 8).rotateZ(Math.PI / 2), CLERK[0] + 0.35, 0.84 + i * 0.075, CLERK[2] + 0.75 - i * 0.04);
  b.add('clothIvory', boxGeo(0.45, 0.02, 0.32), CLERK[0] - 0.2, 0.82, CLERK[2] + 0.6);
  // the witness stand: a low platform with a rail on three sides
  b.add('woodDark', boxGeo(1.2, 0.3, 1.2), WITNESS[0], 0.15, WITNESS[2]);
  b.add('wood', boxGeo(1.2, 0.08, 0.08), WITNESS[0], 1.35, WITNESS[2] + 0.56);
  b.add('woodDark', boxGeo(1.2, 1.05, 0.05), WITNESS[0], 0.82, WITNESS[2] + 0.58);
  for (const s of [-1, 1]) b.add('woodDark', boxGeo(0.05, 1.05, 1.2), WITNESS[0] + s * 0.58, 0.82, WITNESS[2]);
  // the dock: a wooden pen open at the back
  b.add('wood', boxGeo(1.5, 0.1, 1.1), DOCK[0], 0.05, DOCK[2]);
  b.add('woodDark', boxGeo(1.5, 1.0, 0.07), DOCK[0], 0.6, DOCK[2] - 0.55);
  b.add('wood', boxGeo(1.6, 0.08, 0.12), DOCK[0], 1.12, DOCK[2] - 0.55);
  for (const s of [-1, 1]) { b.add('woodDark', boxGeo(0.07, 1.0, 1.1), DOCK[0] + s * 0.75, 0.6, DOCK[2]); b.add('wood', boxGeo(0.12, 0.08, 1.15), DOCK[0] + s * 0.75, 1.12, DOCK[2]); }
  // the public benches, a seat and a back each
  for (const z of [2.6, 3.8, 5.0]) for (const s of [-1, 1]) {
    b.add('wood', boxGeo(3.0, 0.07, 0.42), s * 1.85, 0.44, z);
    b.add('woodDark', boxGeo(3.0, 0.55, 0.06), s * 1.85, 0.75, z + 0.24);
    for (const dx of [-1.35, 1.35]) b.add('woodDark', boxGeo(0.08, 0.42, 0.38), s * 1.85 + dx, 0.21, z);
  }
  group.add(b.build(M));
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; group.add(m); return m; };
  // the kingdom's arms over the bench, a banner each side, the gold scales of justice above
  add(new THREE.PlaneGeometry(1.8, 1.8), M.arms, 0, 4.25, Z0 + 0.02);
  for (const s of [-1, 1]) add(new THREE.PlaneGeometry(1.0, 2.6), M.cloth, s * 2.3, 3.6, Z0 + 0.03);
  add(boxGeo(0.08, 0.7, 0.06), M.gold, 0, 5.55, Z0 + 0.05);
  add(boxGeo(1.4, 0.07, 0.06), M.gold, 0, 5.85, Z0 + 0.05);
  for (const s of [-1, 1]) { add(boxGeo(0.03, 0.4, 0.03), M.gold, s * 0.65, 5.65, Z0 + 0.06); add(cylGeo(0.2, 0.12, 0.06, 12), M.gold, s * 0.65, 5.45, Z0 + 0.12); }
  // tall windows with daylight down both side walls
  const daylight = new THREE.MeshBasicMaterial({ color: '#dfe8ef' });
  for (const s of [-1, 1]) for (const z of [-1.5, 2.0, 5.2]) add(new THREE.PlaneGeometry(1.0, 2.6), daylight, s * (HX - 0.01), 3.6, z, -s * Math.PI / 2);
  // the lights: daylight from the windows, a warm fill over the bench, the candles
  const lights = [];
  const light = (color, i, d, x, y, z) => { const l = new THREE.PointLight(color, 0, d, 1.4); l.position.set(x, y, z); l.visible = false; l.userData.i = i; group.add(l); lights.push(l); return l; };
  light('#dfe6ee', 11, 13, -3.6, 3.6, 0.5); light('#dfe6ee', 11, 13, 3.6, 3.6, 0.5); light('#dfe6ee', 8, 12, 0, 3.8, 4.5);
  light('#ffd9a8', 7, 11, 0, 5.4, 0.8); // (owner 2026-11-14: nearer the bench it burnt the Judge's face white)
  const flames = [-1.9, 1.9].map((x) => add(new THREE.ConeGeometry(0.035, 0.1, 6).translate(0, 0.05, 0), flameMaterial('#ffb347'), x, 1.76, -3.2));
  return {
    group, toWorld,
    setOn(on, t) {
      group.visible = on;
      for (const l of lights) { l.visible = on; l.intensity = on ? l.userData.i * (1 + 0.04 * Math.sin(t * 9 + l.position.x)) : 0; }
      if (on) flames.forEach((f, k) => flicker(f, t, k));
    },
  };
}

/** Somebody at a room spot, turned `ry` (0: facing +z, toward the door). */
function at(P, [x, y, z], ry) {
  P.root.position.set(x, y, z);
  P.root.rotation.set(0, ry, 0);
}
/** The public on the benches: the named first (tags), then nameless villagers; `n` people in all. */
function benches(R, M, named = [], n = 10) {
  return Array.from({ length: Math.max(n, named.length) }, (_, i) => {
    const c = named[i] || null;
    const P = rig(M, c ? JOBS[c.job]?.color || FOLK[i % FOLK.length] : FOLK[i % FOLK.length], { seated: true });
    const [x, z] = SEATS[i % SEATS.length];
    at(P, [x, 0, z], Math.PI);
    P.c = c; P.i = i;
    R.group.add(P.root);
    return P;
  });
}
/** The public: heads turning to whisper, now and then a hand to the mouth; `cheer` 0..1 arms up, `gasp` 0..1 hands to the head. */
function murmur(people, t, { cheer = 0, gasp = 0 } = {}) {
  for (const P of people) {
    const ph = t * 1.3 + P.i * 1.7;
    P.head.rotation.y = P.hat.rotation.y = 0.35 * Math.sin(ph) * (1 - cheer);
    const whisper = Math.max(0, Math.sin(ph * 0.7)) ** 8;
    if (cheer > 0 && P.i % 3 !== 2) { P.r.g.rotation.set(-2.7 * cheer + 0.25 * Math.sin(t * 9 + P.i), 0, -0.2); P.l.g.rotation.set(-2.6 * cheer, 0, 0.2); }
    else if (gasp > 0) { P.r.g.rotation.set(-2.6 * gasp, 0, -0.5 * gasp); P.l.g.rotation.set(-2.6 * gasp, 0, 0.5 * gasp); }
    else { P.r.g.rotation.set(-0.5 - 0.9 * whisper, 0, -0.1); P.l.g.rotation.set(-0.5, 0, 0.1); }
  }
}
/** A standing person of the room (walking legs), dressed for their job. */
function standing(R, M, c, color, spot, ry) {
  const P = person(M, color);
  P.c = c;
  at(P, spot, ry);
  R.group.add(P.root);
  return P;
}
const tagFor = (c, fallback, sub) => (c ? castTag(c, sub) : { pos: new THREE.Vector3(), title: fallback, sub: sub ?? '' });
function placeTags(R, labels, tmp = new THREE.Vector3()) {
  for (const l of labels) l.pos.copy(R.toWorld(0, 0, 0)).add(tmp.copy(l.P.root.position).setY(l.P.root.position.y + (l.h ?? 2.4)));
}

// ===== the Judge at work =====

/** The Judge at the bench: hearing a case (stamping the record) or giving a verdict (rising, the hand up). */
export function buildCourtJob({ variant, M, seed, id }) {
  const R = courtroom(M);
  const ws = buildWorkScene({ job: 'judge', variant, anchor: R.toWorld(...JUDGE), face: 0, M, seed, id });
  R.group.attach(ws.group);
  const clerk = rig(M, '#4e5a6a', { seated: true });
  at(clerk, CLERK, 0);
  R.group.add(clerk.root);
  const accused = standing(R, M, null, FOLK[2], DOCK, Math.PI);
  const bailiff = standing(R, M, null, JOBS.bailiff.color, BAILIFF, Math.PI);
  bailiff.r.hand.add(toolGeo('mace', M));
  const pub = benches(R, M, [], 10);
  const verdict = variant === 'verdict';
  const look = R.toWorld(0, 2.15, JUDGE[2]);
  const cam = (u) => {
    const k = ease(u);
    // from the aisle among the benches, in toward the bench; for the verdict low from beside the dock, looking up at him
    return verdict
      ? { pos: R.toWorld(lerp(1.6, 1.3, k), lerp(1.5, 1.45, k), lerp(1.2, 0.5, k)), look, fov: 60 }
      : { pos: R.toWorld(lerp(1.9, 1.5, k), lerp(2.1, 2.0, k), lerp(4.4, 2.6, k)), look, fov: 58 };
  };
  return {
    ...ws,
    group: new THREE.Group(), // the Judge is part of the room
    room: R.group,
    cam,
    floorAt: () => COURT_AT.y,
    focus: R.toWorld(0, 2.0, JUDGE[2]),
    labelPos: R.toWorld(0, JUDGE[1] + 2.5, JUDGE[2]),
    update(t, inside) {
      R.setOn(!!inside, t);
      ws.update(t);
      clerk.r.g.rotation.set(-0.95 + 0.06 * Math.sin(t * 7), 0, -0.1 * Math.sin(t * 2)); clerk.l.g.rotation.set(-0.9, 0, 0); nod(clerk, 0.4);
      accused.r.g.rotation.set(-0.2, 0, -0.1); accused.l.g.rotation.set(-0.2, 0, 0.1); nod(accused, verdict ? -0.15 : 0.1 * Math.sin(t * 0.8));
      bailiff.r.g.rotation.set(-0.5, 0, 0); bailiff.l.g.rotation.set(-0.3, 0, 0.1);
      murmur(pub, t);
    },
  };
}

// ===== the trial =====

/** The trial (stories.js `trial`): the accusation (step 'trial') or the verdict (step 'verdict'), one shot each. */
export function buildTrial({ story, M }) {
  if (!story.accused) return null;
  const R = courtroom(M);
  const verdict = story.step === 'verdict';
  const J = standing(R, M, story.judge, JOBS.judge.color, JUDGE, 0);
  const A = standing(R, M, story.accused, JOBS[story.accused.job]?.color || FOLK[0], DOCK, Math.PI);
  const Wt = story.accuser ? standing(R, M, story.accuser, JOBS[story.accuser.job]?.color || FOLK[1], WITNESS, -0.75) : null;
  const B = standing(R, M, story.bailiff, JOBS.bailiff.color, BAILIFF, Math.PI);
  B.r.hand.add(toolGeo('mace', M));
  const clerk = rig(M, '#4e5a6a', { seated: true });
  at(clerk, CLERK, 0);
  R.group.add(clerk.root);
  const pub = benches(R, M, (story.crowd || []).slice(0, 6), 12);
  // the verdict: the likes under the names; a party who never commented is not in court
  const likes = story.likes || {}, dismissed = story.outcome === 'dismissed';
  const n = (x) => `${x} like${x === 1 ? '' : 's'}`;
  const sub = (role, k) => (verdict && likes[k] !== null && likes[k] !== undefined ? `${role} · ${n(likes[k])}` : role);
  const away = { accused: verdict && (likes.accused ?? null) === null, accuser: verdict && (likes.accuser ?? null) === null };
  if (away.accused) A.root.visible = false;
  if (Wt && away.accuser) Wt.root.visible = false;
  const labels = [
    ...(away.accused ? [] : [{ P: A, ...tagFor(story.accused, 'Accused', sub('Accused', 'accused')) }]),
    { P: J, ...tagFor(story.judge, 'The Judge', story.judge ? 'Judge' : ''), h: 2.5 },
    ...(Wt && !away.accuser ? [{ P: Wt, ...tagFor(story.accuser, 'Accuser', sub('Accuser', 'accuser')), h: 2.3 }] : []),
    ...(story.bailiff ? [{ P: B, ...tagFor(story.bailiff, 'Bailiff', 'Bailiff') }] : []),
    ...pub.filter((P) => P.c).slice(0, 3).map((P) => ({ P, ...castTag(P.c), h: 1.6 })),
  ];
  const guilty = !!story.guilty, REVEAL = 0.42;
  const why = dismissed ? 'Neither of them commented' : away.accused ? 'The accused never commented' : away.accuser ? 'The accuser never commented'
    : guilty ? `Accuser ${n(likes.accuser)} · Accused ${n(likes.accused)}` : `Accused ${n(likes.accused)} · Accuser ${n(likes.accuser)}`;
  return {
    group: R.group, labels, interior: true, low: true,
    banner: verdict ? 'The verdict...' : 'Order in the court!',
    bannerAt: verdict ? (t, t0, t1) => ((t - t0) / (t1 - t0) < REVEAL ? 'The verdict...' : dismissed ? 'CASE DISMISSED!' : guilty ? 'GUILTY!' : 'INNOCENT!') : undefined,
    footer: verdict
      ? `${why}${guilty && story.sentence ? ` · Sentence: ${TRIAL_SENTENCES[story.sentence]}` : ''}`
      : `Accused of ${story.charge}. You two, comment: most likes wins!`,
    focus: R.toWorld(0, 1.6, -1.2),
    cam(u) {
      const k = ease(u);
      // (owner 2026-11-14: the accuser in the frame too) from the back of the room on the clerk's side, across the dock to the
      // witness stand, the Judge behind them; the verdict lower and closer
      return verdict
        ? { pos: R.toWorld(lerp(-2.0, -1.6, k), lerp(3.2, 2.9, k), lerp(5.4, 4.6, k)), look: R.toWorld(1.2, 1.1, -1.2), fov: 60 }
        : { pos: R.toWorld(lerp(-1.6, -1.1, k), lerp(3.6, 3.2, k), lerp(6.2, 5.0, k)), look: R.toWorld(1.5, 1.3, -1.0), fov: 60 };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      R.setOn(on, t);
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0));
      clerk.r.g.rotation.set(-0.95 + 0.06 * Math.sin(t * 7), 0, 0); clerk.l.g.rotation.set(-0.9, 0, 0); nod(clerk, 0.4);
      B.r.g.rotation.set(-0.5, 0, 0); B.l.g.rotation.set(-0.3, 0, 0.1);
      for (const P of [J, A, B, ...(Wt ? [Wt] : [])]) { P.body.rotation.set(0, 0, 0); stride(P, 0, 0); }
      if (!verdict) {
        // the Judge reads the charge, then leans in; the witness points at the accused; the accused shrugs, hands out
        J.r.g.rotation.set(-1.1 + 0.15 * Math.sin(t * 2.2), 0, -0.1); J.l.g.rotation.set(-1.0, 0, 0.1); J.body.rotation.x = 0.1;
        if (Wt) { const p = span(u, 0.2, 0.32); Wt.r.g.rotation.set(-1.5 * p, 0, -0.9 * p); Wt.l.g.rotation.set(-0.2, 0, 0.1); }
        const shrug = span(u, 0.45, 0.55) * (1 - span(u, 0.85, 0.95));
        A.r.g.rotation.set(-0.6 * shrug, 0, -0.9 * shrug); A.l.g.rotation.set(-0.6 * shrug, 0, 0.9 * shrug);
        nod(A, -0.15 * shrug);
        murmur(pub, t);
      } else {
        // the clerk hands up the count, the Judge rises and raises his hand; then the accused cheers, or hangs his head and
        // is led out by the Bailiff to the sentence
        const rise = span(u, 0.15, 0.35);
        J.root.position.y = JUDGE[1] + 0.12 * rise;
        J.r.g.rotation.set(-1.0 - 1.7 * rise, 0, -0.1); J.l.g.rotation.set(-0.4, 0, 0.1);
        const after = span(u, REVEAL, REVEAL + 0.08);
        if (dismissed) {
          // nobody came: the Judge waves the case away, the public shrugs
          J.r.g.rotation.set(-1.0 - 1.7 * rise + 0.9 * after * Math.abs(Math.sin(t * 2.5)), 0, -0.1 - 0.5 * after);
          murmur(pub, t);
        } else if (!guilty) {
          A.root.position.y = DOCK[1] + 0.18 * after * Math.abs(Math.sin(t * 7));
          A.r.g.rotation.set(-2.8 * after, 0, -0.3 * after); A.l.g.rotation.set(-2.7 * after, 0, 0.3 * after);
          nod(A, -0.2 * after);
          murmur(pub, t, { cheer: after });
        } else {
          nod(A, 0.45 * after);
          A.r.g.rotation.set(-0.1, 0, -0.05); A.l.g.rotation.set(-0.1, 0, 0.05);
          // the Bailiff takes the accused's arm and they walk out up the aisle toward the door
          const go = span(u, 0.62, 1);
          if (go > 0) {
            const z = lerp(DOCK[2], DOCK[2] + 5.5, ease(go));
            at(A, [0, 0, z], 0); stride(A, z * 3.2, 0.4);
            at(B, [-0.55, 0, z - 0.1], 0); stride(B, z * 3.2 + 1, 0.4);
            B.l.g.rotation.set(-0.7, 0, -0.5);
          }
          murmur(pub, t, { gasp: after * (1 - span(u, 0.7, 0.85)) });
        }
      }
      placeTags(R, labels);
    },
  };
}

// ===== the quarrel made up in court =====

/** The two who quarrelled before the Judge (stories.js `quarrel`, step 'peace', `court`): the ruling, then a handshake. */
export function buildCourtQuarrel({ story, M }) {
  const [a, b] = story.cast || [];
  if (!a || !b) return null;
  const R = courtroom(M);
  const J = standing(R, M, story.judge, JOBS.judge.color, JUDGE, 0);
  const B = standing(R, M, null, JOBS.bailiff.color, BAILIFF, Math.PI);
  const cleaver = toolGeo('cleaver', M);
  B.r.hand.add(cleaver);
  const two = [a, b].map((c, i) => standing(R, M, c, JOBS[c.job]?.color || FOLK[i], [i ? 0.8 : -0.8, 0, -1.0], Math.PI));
  const pub = benches(R, M, [], 10);
  // what they quarrelled over, on the floor between them: the cabbage (in two halves that come apart), the chicken, the goat
  const item = new THREE.Group();
  item.position.set(0, 0, -1.0);
  R.group.add(item);
  const halves = [];
  if (story.over === 'chicken' || story.over === 'goat') {
    const animal = story.over === 'chicken' ? chicken(M) : goat(M);
    animal.rotation.y = Math.PI / 2;
    item.add(animal);
  } else {
    const leaf = new THREE.MeshStandardMaterial({ color: '#6f9a3a', roughness: 0.9 });
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, s < 0 ? Math.PI : 0, Math.PI), leaf);
      h.rotation.y = Math.PI / 2;
      h.position.y = 0.2;
      h.castShadow = true;
      item.add(h);
      halves.push({ h, s });
    }
  }
  const labels = [
    ...two.map((P) => ({ P, ...castTag(P.c) })),
    { P: J, ...tagFor(story.judge, 'The Judge', story.judge ? 'Judge' : ''), h: 2.5 },
  ];
  const CUT = 0.5, SHAKE = 0.68;
  return {
    group: R.group, labels, interior: true, low: true,
    banner: 'Order in the court!',
    bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) < CUT ? 'Order in the court!' : 'Case closed!'),
    focus: R.toWorld(0, 1.4, -1.6),
    work: halves.length ? { strikeTimes: () => [], sound: null, hits: (t0, t1) => [[t0 + (t1 - t0) * CUT, 'chop']] } : undefined,
    cam(u) {
      const k = ease(u);
      return { pos: R.toWorld(lerp(2.6, 2.0, k), lerp(2.0, 1.8, k), lerp(2.6, 1.6, k)), look: R.toWorld(-0.3, 1.25, -1.6), fov: 62 };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      R.setOn(on, t);
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0));
      // the Judge speaks, then points down at the thing they quarrel over
      const point = span(u, 0.25, 0.35) * (1 - span(u, 0.6, 0.7));
      J.r.g.rotation.set(-1.0 - 0.2 * Math.sin(t * 3) * (1 - point) - 0.4 * point, 0, -0.1); J.l.g.rotation.set(-0.9, 0, 0.1); J.body.rotation.x = 0.1 + 0.15 * point;
      // the Bailiff steps up and cuts the cabbage in two (the chicken and the goat stay whole: shared)
      const step = halves.length ? span(u, 0.3, 0.42) * (1 - span(u, 0.62, 0.74)) : 0;
      at(B, [lerp(BAILIFF[0], -0.25, step), 0, lerp(BAILIFF[2], -0.45, step)], Math.PI);
      stride(B, t * 6, step > 0 && step < 1 ? 0.35 : 0);
      const chop = span(u, CUT - 0.06, CUT);
      B.r.g.rotation.set(step > 0.9 ? -2.4 + 1.6 * chop : -0.4, 0, 0);
      B.body.rotation.x = step > 0.9 ? 0.35 * chop : 0;
      const apart = ease(span(u, CUT, CUT + 0.12));
      for (const { h, s } of halves) h.position.x = s * (0.02 + 0.35 * apart);
      // the two: arms crossed while they wait, then they turn to each other and shake hands
      const turn = ease(span(u, SHAKE - 0.06, SHAKE));
      two.forEach((P, i) => {
        const s = i ? 1 : -1;
        P.body.rotation.set(0, 0, 0);
        stride(P, 0, 0);
        P.root.rotation.y = Math.PI + s * (Math.PI / 2) * turn;
        P.root.position.x = s * lerp(0.8, 0.45, turn);
        if (turn < 1) { P.r.g.rotation.set(-1.2, 0, 0.6); P.l.g.rotation.set(-1.2, 0, -0.6); }
        else { P.r.g.rotation.set(-1.25 + 0.15 * Math.sin(t * 12), 0, 0.15); P.l.g.rotation.set(-0.2, 0, 0.1); }
      });
      murmur(pub, t, { cheer: span(u, SHAKE + 0.05, SHAKE + 0.15) });
      placeTags(R, labels);
    },
  };
}
