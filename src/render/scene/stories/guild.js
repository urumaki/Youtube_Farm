// The guild contest (owner 2026-11-23, src/sim/stories.js `guild`), the contest day: the whole video, one shot after another
// (timeline.js, GUILD_SHOTS), then the usual wide shot, goal and call to action. In the Guild Hall (a hall of its own deep
// under the castle mound like the throne room, so any weather), four craftsmen of four trades at their benches, each at
// their own work (work.js, the same scene as in town), the crowd behind a rope, the King on a dais: the hall and the task,
// the work, the King walks along the benches and two go on to the final (the other two bow out with a shrug), the final at
// double speed, and the King pins the guild's rosette on the winner (owner 2026-11-25, the medal before). Names on all four (story.crafters).
// Owner 2026-11-23: not always the same prize-giving (awardOf, common.js): (0) the rosette, the winner holds up the work; (1) the
// rosette, then the King raises the winner's arm under a shower of petals; (2) the rosette and the guild's banner, which the
// winner waves while the other three lift their work.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { CASTLE } from '../../../sim/world.js';
import { Builder, boxGeo, cylGeo } from '../kit.js';
import { legIK, nod } from '../work.js';
import { contestBench, rosette, reach } from './masterpiece.js';
import { king } from './royal.js';
import { person, stride, castTag, flameMaterial, flicker, ease, clamp01, petals, awardOf } from './common.js';

export const GUILD_SHOTS = [['hall', 0, 4], ['work', 4, 9], ['judge', 9, 13.5], ['final', 13.5, 18.5], ['medal', 18.5, 23.5]];
const HX = 9, HZ = 8, H = 7; // the hall's inner half width and depth, its height
const BX = [-5.4, -1.8, 1.8, 5.4], BZ = -1.5; // the four benches (x), their line (z); the craftsmen face the camera (+z)
const DAIS = new THREE.Vector3(0, 0.5, -6.2); // the King's place
const lerp = THREE.MathUtils.lerp;
const span = (u, a, b) => clamp01((u - a) / (b - a));
const FOLK = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#7b6a43'];

function hall(M) {
  const group = new THREE.Group();
  group.position.set(0, CASTLE.ground - 120, 0); // under the castle, below the throne room
  group.visible = false;
  const b = new Builder();
  b.add('wood', boxGeo(2 * HX, 0.3, 2 * HZ), 0, -0.15, 0);
  for (const s of [-1, 1]) b.add('stone', boxGeo(0.4, H, 2 * HZ), s * (HX + 0.2), H / 2, 0);
  b.add('stone', boxGeo(2 * HX, H, 0.4), 0, H / 2, -HZ - 0.2);
  b.add('woodDark', boxGeo(2 * HX + 0.8, 0.3, 2 * HZ + 0.8), 0, H + 0.15, 0);
  for (let x = -8; x <= 8; x += 2.6) b.add('woodDark', boxGeo(0.35, 0.4, 2 * HZ), x, H - 0.25, 0); // beams
  // the dais at the back, a chair of state, the guild's banners
  b.add('stone', boxGeo(4.4, 0.5, 2.4), DAIS.x, 0.25, DAIS.z - 0.3);
  b.add('clothRed', boxGeo(3.6, 0.03, 2.0), DAIS.x, 0.515, DAIS.z - 0.3);
  b.add('gold', boxGeo(1.1, 0.5, 0.8), 0, 0.75, DAIS.z - 1.1);
  b.add('gold', boxGeo(1.2, 2.0, 0.2), 0, 1.5, DAIS.z - 1.5);
  // the ropes in front of the crowd along both side walls (posts and a red rope)
  for (const s of [-1, 1]) {
    for (let z = -4.5; z <= 4.5; z += 3) b.add('gold', cylGeo(0.05, 0.07, 1.0, 8), s * 7.4, 0.5, z);
    b.add('clothRed', cylGeo(0.035, 0.035, 9, 6).rotateX(Math.PI / 2), s * 7.4, 0.85, 0);
  }
  group.add(b.build(M));
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; group.add(m); return m; };
  add(new THREE.PlaneGeometry(2.4, 2.4), M.arms, 0, 4.4, -HZ + 0.02);
  for (const x of [-6, -3, 3, 6]) add(new THREE.PlaneGeometry(1.3, 3.0), M.cloth, x, 4.2, -HZ + 0.03);
  // torches and a warm fill, only while the camera is here
  const flames = [], lights = [];
  for (const x of [-7.5, -2.5, 2.5, 7.5]) {
    flames.push(add(new THREE.ConeGeometry(0.12, 0.38, 8).translate(0, 0.19, 0), flameMaterial('#ffb347'), x, 3.3, -HZ + 0.35));
    add(cylGeo(0.05, 0.04, 0.5, 6), M.iron, x, 3.05, -HZ + 0.35);
    const l = new THREE.PointLight('#ffb066', 0, 16, 1.5);
    l.position.set(x, 3.6, -HZ + 1.2);
    group.add(l);
    lights.push(l);
  }
  for (const [x, z] of [[0, 1.5], [-5, 0], [5, 0]]) {
    const l = new THREE.PointLight('#ffe2b8', 0, 16, 1.3);
    l.position.set(x, 5.2, z);
    group.add(l);
    lights.push(l);
  }
  const lamps = (t, on) => {
    for (const l of lights) { l.visible = on; l.intensity = on ? 11 * (1 + 0.07 * Math.sin(t * 11 + l.position.x)) : 0; }
    flames.forEach((f, k) => flicker(f, t, k * 2));
  };
  return { group, lamps, toWorld: (x, y, z) => new THREE.Vector3(x, y, z).add(group.position) };
}

/** The made thing each trade holds up at the end (a simple shape in the trade's colours). */
function piece(M, job) {
  const g = new THREE.Group();
  const add = (geo, mat) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; g.add(o); return o; };
  const base = JOBS[job] ? JOBS[job] : null;
  if (['blacksmith', 'toolsmith', 'fletcher'].includes(job)) { add(boxGeo(0.06, 0.9, 0.02), M.iron).position.y = 0.45; add(boxGeo(0.28, 0.05, 0.06), M.gold).position.y = 0.05; }
  else if (['baker'].includes(job)) add(new THREE.SphereGeometry(0.22, 12, 8).scale(1.4, 0.7, 1), new THREE.MeshStandardMaterial({ color: '#c98b3e' }));
  else if (['potter'].includes(job)) add(new THREE.LatheGeometry([[0.05, 0], [0.2, 0.1], [0.22, 0.25], [0.12, 0.4], [0.1, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 14), M.clay);
  else if (['cooper', 'brewer'].includes(job)) add(cylGeo(0.18, 0.2, 0.42, 12), M.wood);
  else if (['tailor', 'weaver', 'tanner'].includes(job)) add(boxGeo(0.5, 0.7, 0.04), new THREE.MeshStandardMaterial({ color: base?.color || '#8e3b5e', side: THREE.DoubleSide }));
  else if (['cobbler'].includes(job)) add(boxGeo(0.14, 0.24, 0.32), M.gear);
  else if (['clockmaker', 'bellfounder'].includes(job)) add(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), M.gold);
  else add(boxGeo(0.4, 0.35, 0.3), M.wood); // a carpenter's box, or any trade's
  return g;
}

/** The guild's banner on a pole: a red cloth with a gold band (award 2). */
function banner(M) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(cylGeo(0.03, 0.03, 2.4, 6), M.woodDark, 0, 0.9, 0);
  add(new THREE.SphereGeometry(0.06, 8, 6), M.gold, 0, 2.12, 0);
  add(boxGeo(0.75, 0.9, 0.03), M.clothRed, 0.4, 1.55, 0);
  add(boxGeo(0.75, 0.1, 0.035), M.gold, 0.4, 1.25, 0);
  return g;
}

/** The hall with its people for one shot: the four benches (work.js scenes), the King, the crowd. */
function setUp(args) {
  const { story, M, seed } = args;
  const Hl = hall(M);
  const { group } = Hl;
  const cr = (story.crafters || []).slice(0, 4);
  const benches = cr.map((c, i) => {
    // owner 2026-11-25: each makes a masterpiece for the King at a contest bench, not the everyday work (masterpiece.js)
    const ws = contestBench({ job: c.job, M, x: BX[i], z: BZ, i, makePiece: piece });
    group.add(ws.group);
    return { c, ws, i };
  });
  const K = king(M, { seated: false });
  K.root.position.copy(DAIS);
  group.add(K.root);
  const crowd = Array.from({ length: 12 }, (_, i) => {
    const c = story.crowd?.[i] || null;
    const P = person(M, c ? JOBS[c.job]?.color || FOLK[i % 6] : FOLK[i % 6]);
    P.c = c;
    const s = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    P.root.position.set(s * (8.1 + (k % 2) * 0.5), 0, -4.2 + k * 1.6);
    P.root.rotation.y = -s * Math.PI / 2; // facing the benches
    group.add(P.root);
    return P;
  });
  const tmp = new THREE.Vector3();
  const tags = benches.map((b) => ({ b, ...castTag(b.c), pos: new THREE.Vector3() }));
  const placeTags = (ls) => {
    group.updateMatrixWorld(true);
    for (const l of ls) {
      if (l.b) l.pos.copy(l.b.ws.rig.root.getWorldPosition(tmp)).setY(tmp.y + 2.25);
      else if (l.P) l.pos.copy(l.P.root.getWorldPosition(tmp)).setY(tmp.y + 2.3);
    }
  };
  const cheer = (t, k) => crowd.forEach((P, i) => {
    const up = k * (0.6 + 0.4 * Math.sin(t * 8 + i));
    P.r.g.rotation.set(lerp(-0.15, -2.7, up), 0, -0.2);
    P.l.g.rotation.set(i % 2 ? lerp(-0.15, -2.5, up) : -0.15, 0, 0.2);
  });
  return { ...Hl, benches, K, crowd, tags, placeTags, cheer, story };
}

/** The common part of every shot's update: lights, the work at the benches (fast = the final's double speed). */
function tick(S, t, t0, t1, { working = () => true, speed = 1 } = {}) {
  // exactly its own time: every shot builds its hall in the same place, and the old margin of 0.2 s round each shot
  // showed two halls (and two sets of craftsmen) one inside the other at each cut (owner 2026-11-26)
  const on = t >= t0 && t < t1;
  S.group.visible = on;
  S.lamps(t, on);
  if (!on) return false;
  for (const b of S.benches) {
    if (working(b)) b.ws.update(t0 + (t - t0) * speed);
    b.ws.group.visible = true;
  }
  return true;
}

// --- 0-4 s: the hall, the four at their benches, the King on the dais, the crowd ---
function hallShot(args) {
  const S = setUp(args);
  return {
    group: S.group, labels: S.tags, interior: true, banner: 'The Guild Contest!',
    footer: `The task: ${args.story.task || 'something useful for the kingdom'}`,
    focus: S.toWorld(0, 1.4, BZ),
    cam(u) { const e = ease(u); return { pos: S.toWorld(-1.5 + 3 * e, 3.4 - 0.6 * e, 7.5 - 1.5 * e), look: S.toWorld(0, 1.3, BZ - 1.5), fov: 66 }; },
    update(t, t0, t1) {
      if (!tick(S, t, t0, t1)) return;
      S.K.r.g.rotation.set(-1.6 + 0.2 * Math.sin(t * 2), 0, -0.2); // the King opens the contest
      S.cheer(t, 0.5);
      S.placeTags(S.tags);
    },
  };
}

// --- 4-9 s: along the benches, each at their own work, close ---
function workShot(args) {
  const S = setUp(args);
  return {
    group: S.group, labels: S.tags, interior: true, banner: 'Hammers, needles, ovens: go!', low: true,
    focus: S.toWorld(0, 1.2, BZ),
    // a bench at a time (a cut from one to the next), from the front and a little to the side
    cam(u) { const k = Math.min(3, Math.floor(u * 4)), p = u * 4 - k, x = BX[k]; return { pos: S.toWorld(x + 1.3 - 0.5 * p, 1.8, BZ + 3.6), look: S.toWorld(x, 1.1, BZ), fov: 56 }; },
    update(t, t0, t1) {
      if (!tick(S, t, t0, t1)) return;
      S.cheer(t, 0.25);
      S.placeTags(S.tags);
    },
  };
}

// --- 9-13.5 s: the King walks along the benches; two go on (they step forward), two bow out with a shrug ---
function judgeShot(args) {
  const S = setUp(args);
  const fin = new Set(args.story.finalists || []);
  return {
    group: S.group, labels: S.tags, interior: true,
    bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > 0.7 ? 'Two go on to the final!' : 'The King inspects the work'),
    focus: S.toWorld(0, 1.4, BZ),
    cam(u) { return { pos: S.toWorld(-1 + 2 * u, 2.6, 6.2 - 0.5 * u), look: S.toWorld(0, 1.2, BZ), fov: 70 }; },
    update(t, t0, t1) {
      const u = clamp01((t - t0) / (t1 - t0));
      const decided = u > 0.7;
      if (!tick(S, t, t0, t1, { working: () => !decided })) return;
      // the King down from the dais and along the benches, stopping at each
      const walk = span(u, 0, 0.66);
      const kx = lerp(-7, 6.5, walk), kz = BZ + 2.4; // in front of the benches and what stands before them
      S.K.root.position.set(kx, 0, kz);
      S.K.root.rotation.y = walk < 1 ? Math.PI / 2 : 0;
      if (walk < 1 && Math.abs(Math.sin(walk * Math.PI * 4)) > 0.3) stride(S.K, t * 6, 0.35);
      S.K.r.g.rotation.set(-0.8, 0, 0); // a finger on the chin
      for (const b of S.benches) {
        const P = b.ws.rig;
        if (!decided) continue;
        b.ws.rest();
        const k = ease(span(u, 0.7, 0.8));
        // on to the final: an arm up and a little hop behind the bench (a step forward went through it, owner 2026-11-26)
        if (fin.has(b.c.id)) { P.root.position.y = 0.07 * k * Math.abs(Math.sin(t * 9)); P.r.g.rotation.set(-2.8, 0, 0.2); }
        else { P.r.g.rotation.set(-0.6, 0, 0.6 * k); P.l.g.rotation.set(-0.6, 0, -0.6 * k); nodBody(P, 0.25 * k); } // a shrug
      }
      S.cheer(t, decided ? 0.8 : 0.2);
      S.placeTags(S.tags);
    },
  };
}
const nodBody = (P, a) => { P.body.rotation.x = a; };

// --- 13.5-18.5 s: the final, the two finalists at double speed, the other two watching ---
function finalShot(args) {
  const S = setUp(args);
  const fin = new Set(args.story.finalists || []);
  const two = S.benches.filter((b) => fin.has(b.c.id));
  // the two finalists' benches brought to the middle of the hall, the other two set aside
  two.forEach((b, k) => { b.ws.group.position.x = k ? 1.3 : -1.3; });
  for (const b of S.benches) if (!fin.has(b.c.id)) b.ws.group.position.x = b.i < 2 ? -6.5 : 6.5;
  const mid = 0;
  const labels = S.tags.filter((l) => fin.has(l.b.c.id));
  return {
    group: S.group, labels, interior: true, banner: 'The final!', low: true,
    focus: S.toWorld(mid, 1.2, BZ),
    // far enough back that both finalists are in the narrow frame
    cam(u) { const a = -0.35 + 0.7 * u, r = 5.2; return { pos: S.toWorld(mid + Math.sin(a) * r, 2.0, BZ + Math.cos(a) * r), look: S.toWorld(mid, 1.1, BZ), fov: 62 }; },
    update(t, t0, t1) {
      if (!tick(S, t, t0, t1, { working: (b) => fin.has(b.c.id), speed: 2 })) return;
      for (const b of S.benches) if (!fin.has(b.c.id)) { b.ws.rest(); b.ws.rig.r.g.rotation.set(-0.2, 0, 0); b.ws.rig.l.g.rotation.set(-0.2, 0, 0); }
      S.cheer(t, 0.6);
      S.placeTags(labels);
    },
  };
}

// --- 18.5-23.5 s: the prize-giving (owner 2026-11-25: not the medal sliding through the air). A page holds a cushion with the
// guild's rosette; the King takes it, steps up to the winner, who bows; he pins it on the winner's chest with both hands and
// pats the shoulder; the winner straightens and (0) lifts the masterpiece over their head, (1) has their arm raised by the
// King under a shower of petals, or (2) waves the guild's banner while the other three lift their own work. The hall cheers.
/** Puts the sword (blade along its +x, the grip 0.1 m behind its middle) in the fist of arm `side`, the blade along `d`. */
function gripSword(g, P, side, d) {
  const hand = P[side].hand;
  if (g.parent !== hand) hand.add(g);
  P.root.updateWorldMatrix(true, true);
  const x = d.clone().normalize();
  const z = new THREE.Vector3().crossVectors(x, new THREE.Vector3(0, 0, 1));
  if (z.lengthSq() < 1e-6) z.set(1, 0, 0);
  z.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const qw = P.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)));
  g.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qw));
  g.position.set(0.1, 0, 0).applyQuaternion(g.quaternion);
}

const angTo = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };

function medalShot(args) {
  const S = setUp(args);
  const win = S.benches.find((b) => b.c.id === args.story.winner) || S.benches[0];
  const W = win.ws.rig;
  const work = win.ws.finish();
  for (const tl of Object.values(win.ws.tool || {})) tl.visible = false; // the tools put down for the prize
  const tag = S.tags.find((l) => l.b === win);
  const labels = [tag];
  const award = awardOf(args);
  const flag = banner(args.M);
  flag.visible = false;
  S.group.add(flag);
  const shower = petals(Number(args.seed || 1) + 3);
  S.group.add(shower.group);
  const X = BX[win.i];
  // the rosette, and the page with it on a red cushion
  const ros = rosette(args.M);
  S.group.add(ros);
  const page = person(args.M, '#2f4f8f');
  S.group.add(page.root);
  const cushion = new THREE.Group();
  cushion.add(new THREE.Mesh(boxGeo(0.42, 0.07, 0.32), args.M.clothRed));
  for (const [x, z] of [[-0.21, -0.16], [0.21, -0.16], [-0.21, 0.16], [0.21, 0.16]]) { const tc = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), args.M.gold); tc.position.set(x, -0.04, z); cushion.add(tc); }
  cushion.position.set(0, 1.02, 0.36);
  page.root.add(cushion);
  const PAGE = new THREE.Vector3(X + 1.55, 0, BZ + 0.75), KING = new THREE.Vector3(X + 1.0, 0, BZ + 1.45), CLOSE = new THREE.Vector3(X + 0.62, 0, BZ + 1.3);
  const WIN = new THREE.Vector3(X, 0, BZ + 1.0); // the winner, stepped out in front of the bench
  const faceWin = (p) => Math.atan2(WIN.x - p.x, WIN.z - p.z);
  const facePage = (p) => Math.atan2(PAGE.x - p.x, PAGE.z - p.z);
  const cams = [
    (u) => ({ pos: S.toWorld(X - 1.4 + 0.6 * u, 1.9, BZ + 4.6 - 1.0 * u), look: S.toWorld(X + 0.4, 1.45, BZ + 1.0), fov: 60 }),
    (u) => ({ pos: S.toWorld(X - 2.2 + 0.4 * u, 1.45, BZ + 4.6 - 0.6 * u), look: S.toWorld(X + 0.5, 1.7, BZ + 1.1), fov: 60 }),
    (u) => ({ pos: S.toWorld(X - 1.7 + 0.3 * u, 1.25, BZ + 5.4 - 0.6 * u), look: S.toWorld(X + 0.3, 2.0, BZ + 1.0), fov: 64 }),
  ];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const q = new THREE.Quaternion(), flip = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI);
  const flat = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2);
  const local = (P, worldPt) => P.root.worldToLocal(worldPt.clone()); // a world point in a rig's root frame
  const toGroup = (v) => S.group.worldToLocal(v);
  const CHEST = V(0.1, 0.63, 0.23); // where the rosette is pinned, on the winner's body
  const wide = win.c.job === 'fletcher' ? 0.3 : 0.18;
  return {
    group: S.group, labels, interior: true, banner: 'Master of the Guild!',
    focus: S.toWorld(X, 1.5, BZ + 1),
    cam: (u) => cams[award](u),
    update(t, t0, t1) {
      if (!tick(S, t, t0, t1, { working: () => false })) return;
      const u = clamp01((t - t0) / (t1 - t0));
      for (const b of S.benches) b.ws.rest();
      work.stage(1);
      // where everyone stands: the King turns to the page, steps up to the winner, then back
      const step = ease(span(u, 0.3, 0.4)), away = ease(span(u, 0.64, 0.74));
      const kp = KING.clone().lerp(CLOSE, step * (1 - away));
      S.K.root.position.copy(kp);
      const toPage = ease(span(u, 0.06, 0.14)) * (1 - ease(span(u, 0.24, 0.32)));
      S.K.root.rotation.y = angTo(faceWin(kp), facePage(kp), toPage);
      for (const l of S.K.legs || []) l.rotation.x = 0;
      if ((u > 0.3 && u < 0.4) || (u > 0.64 && u < 0.74)) stride(S.K, t * 7, 0.3, { arms: false });
      page.root.position.copy(PAGE);
      page.root.rotation.y = Math.atan2(X + 0.5 - PAGE.x, BZ + 1.2 - PAGE.z); // turned to the King and the winner
      for (const l of page.legs || []) l.rotation.x = 0;
      nod(page, 0.15);
      W.root.position.set(0, 0, 1.0);
      // the winner bows as the King comes, straightens after the pat
      const bowK = ease(span(u, 0.32, 0.42)) * (1 - ease(span(u, 0.58, 0.66)));
      W.body.rotation.set(0.42 * bowK, 0, 0);
      W.body.position.set(0, 0.62 - 0.04 * bowK, -0.03 * bowK);
      legIK(W, [[-0.11, 0.0], [0.12, -0.08]]);
      nod(W, 0.3 * bowK);
      S.group.updateMatrixWorld(true);
      // the page holds the cushion out in both hands
      reach(page, 'r', V(0.2, 1.0, 0.36));
      reach(page, 'l', V(-0.2, 1.0, 0.36));
      // the winner: the finished work held in front, low while bowing; then the award
      const after = span(u, 0.66, 0.76);
      // until the rosette is on, the work hangs at the winner's left side, out of its way
      const hold = V(-0.36, 0.8, 0.12);
      let wr = null, oneHand = after <= 0;
      if (award === 0 && after > 0) hold.set(0, 2.25 + 0.04 * Math.sin(t * 7), 0.3).lerp(V(-0.36, 0.8, 0.12), 1 - ease(after));
      if (award === 1 && after > 0) { hold.set(-0.22, 1.12, 0.4); wr = V(0.34, lerp(1.2, 2.02, ease(span(u, 0.7, 0.8))), 0.12); }
      if (award === 2 && after > 0) { hold.set(-0.2, 1.1, 0.42); wr = V(0.3, 1.75 + 0.1 * Math.sin(t * 5), 0.2); }
      work.group.position.copy(W.root.position).add(hold);
      work.group.rotation.set(0, award === 0 ? 0.3 * Math.sin(t * 2) * after : 0.2, oneHand && win.c.job === 'fletcher' ? Math.PI / 2 : 0); // a bow carried upright
      // the sword in the fist by its grip (owner 2026-11-26: it floated beside the hand): point down in the left hand at the
      // side, then (award 0) raised high in the right, blade up; with the arm raised by the King or the banner it stays down
      const sword = win.c.job === 'blacksmith', swordUp = sword && award === 0 && after > 0;
      if (swordUp) { reach(W, 'r', V(0.28, lerp(1.0, 1.95, ease(after)), lerp(0.3, 0.18, ease(after)))); W.l.g.rotation.set(0.05, 0, -0.08); }
      else if (sword) { reach(W, 'l', V(-0.3, 0.86, 0.14)); if (wr) reach(W, 'r', wr); else W.r.g.rotation.set(0.05, 0, 0.08); }
      else if (oneHand) { reach(W, 'l', hold.clone().add(V(0.02, 0.1, 0))); W.r.g.rotation.set(0.05, 0, 0.08); }
      else if (wr) { reach(W, 'r', wr); reach(W, 'l', hold.clone().add(V(-0.05, 0, 0))); }
      else { reach(W, 'r', hold.clone().add(V(wide, 0, 0))); reach(W, 'l', hold.clone().add(V(-wide, 0, 0))); }
      if (sword) gripSword(work.group, W, swordUp ? 'r' : 'l', swordUp ? V(0, 1, 0) : V(0, -1, 0.15));
      flag.visible = award === 2 && after > 0;
      if (flag.visible) { if (flag.parent !== W.r.hand) W.r.hand.add(flag); flag.position.set(0, -0.1, 0.05); flag.rotation.set(-W.r.g.rotation.x - W.r.elbow.rotation.x, 0, 0.3 * Math.sin(t * 5)); }
      tag.sub = u > 0.56 ? `Master ${JOBS[win.c.job]?.label || ''}`.trim() : tag.sub;
      S.group.updateMatrixWorld(true);
      // the King's hands: by his sides, to the cushion, carrying the rosette at the chest, to the winner's chest, then a pat
      const chest = W.body.localToWorld(CHEST.clone());
      const cushionW = cushion.localToWorld(V(0, 0.06, 0));
      const side = [V(0.32, 0.8, 0.12), V(-0.32, 0.8, 0.12)];
      let rT, lT;
      if (u < 0.1) [rT, lT] = side;
      else if (u < 0.26) { const c = local(S.K, cushionW), k = ease(span(u, 0.12, 0.2)); rT = side[0].clone().lerp(c.clone().add(V(0.05, 0.02, 0)), k); lT = side[1].clone().lerp(c.clone().add(V(-0.05, 0.02, 0)), k); }
      else if (u < 0.4) { rT = V(0.06, 1.2, 0.38); lT = V(-0.06, 1.2, 0.38); }
      else if (u < 0.56) { const c = local(S.K, chest), k = ease(span(u, 0.4, 0.5)); rT = V(0.06, 1.2, 0.38).lerp(c.clone().add(V(0.05, 0, -0.03)), k); lT = V(-0.06, 1.2, 0.38).lerp(c.clone().add(V(-0.05, 0, -0.03)), k); }
      else if (u < 0.66) {
        // two pats on the winner's shoulder with one hand, the other down
        const sh = local(S.K, W.body.localToWorld(V(0.3, 0.86, 0)));
        const pat = Math.abs(Math.sin(span(u, 0.57, 0.66) * Math.PI * 2)) * 0.06;
        rT = sh.add(V(0, 0.05 + pat, 0)); lT = side[1];
      } else [rT, lT] = side;
      if (award === 1 && u >= 0.7) rT = local(S.K, W.r.hand.getWorldPosition(V(0, 0, 0))).add(V(0, 0.05, 0)); // lifts the winner's arm
      if (award === 2 && u >= 0.74) { rT = V(0.08, 1.25 + 0.06 * Math.sin(t * 10), 0.35); lT = V(-0.08, 1.25 - 0.06 * Math.sin(t * 10), 0.35); } // claps
      reach(S.K, 'r', rT);
      reach(S.K, 'l', lT);
      S.group.updateMatrixWorld(true);
      // the rosette: on the cushion, then in the King's hands, then pinned on the winner's chest
      if (u > 0.53) {
        ros.position.copy(toGroup(W.body.localToWorld(CHEST.clone())));
        ros.quaternion.copy(W.body.getWorldQuaternion(q));
      } else if (u > 0.2) {
        const mid = S.K.r.hand.getWorldPosition(V(0, 0, 0)).add(S.K.l.hand.getWorldPosition(V(0, 0, 0))).multiplyScalar(0.5);
        ros.position.copy(toGroup(mid));
        ros.quaternion.copy(S.K.root.getWorldQuaternion(q)).multiply(flip);
      } else {
        ros.position.copy(toGroup(cushionW.clone()));
        ros.quaternion.copy(page.root.getWorldQuaternion(q)).multiply(flat);
      }
      // the other three clap, or (2) lift their own work
      for (const b of S.benches) if (b !== win) {
        const P = b.ws.rig;
        if (award === 2 && u > 0.74) { b.ws.piece.group.position.set(0, 1.95 + 0.05 * Math.sin(t * 7 + b.i), 0.25); reach(P, 'r', V(0.15, 1.92, 0.25)); reach(P, 'l', V(-0.15, 1.92, 0.25)); continue; }
        const c = 0.07 * Math.sin(t * 11 + b.i * 1.3);
        reach(P, 'r', V(0.06 + c, 1.18, 0.35));
        reach(P, 'l', V(-0.06 - c, 1.18, 0.35));
      }
      shower.at(t, award === 1 ? span(u, 0.72, 0.82) : 0, X + 0.4, 0, BZ + 1.2, 2.2);
      S.cheer(t, u > 0.56 ? 1 : 0.4);
      S.placeTags(labels);
    },
  };
}

const SHOTS = { hall: hallShot, work: workShot, judge: judgeShot, final: finalShot, medal: medalShot };

/** The scene of one shot of the guild contest's day (args.story.shot); the announcement is games.js. */
export function buildGuild(args) {
  const f = SHOTS[args.story.shot];
  return f && (args.story.crafters || []).length ? f(args) : null;
}
