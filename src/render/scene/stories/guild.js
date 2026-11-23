// The guild contest (owner 2026-11-23, src/sim/stories.js `guild`), the contest day: the whole video, one shot after another
// (timeline.js, GUILD_SHOTS), then the usual wide shot, goal and call to action. In the Guild Hall (a hall of its own deep
// under the castle mound like the throne room, so any weather), four craftsmen of four trades at their benches, each at
// their own work (work.js, the same scene as in town), the crowd behind a rope, the King on a dais: the hall and the task,
// the work, the King walks along the benches and two go on to the final (the other two bow out with a shrug), the final at
// double speed, and the King hangs the medal on the winner. Names on all four (story.crafters).
// Owner 2026-11-23: not always the same prize-giving (awardOf, common.js): (0) the medal, the winner holds up the work; (1) the
// medal, then the King raises the winner's arm under a shower of petals; (2) the medal and the guild's banner, which the
// winner waves while the other three lift their work.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { CASTLE } from '../../../sim/world.js';
import { Builder, boxGeo, cylGeo } from '../kit.js';
import { buildWorkScene, rig } from '../work.js';
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

/** The medal: a gold disc on a red ribbon. */
function medal(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => { const o = new THREE.Mesh(geo, mat); g.add(o); return o; };
  add(new THREE.TorusGeometry(0.22, 0.015, 4, 18, Math.PI).rotateZ(Math.PI), M.clothRed).position.y = 0.0;
  add(cylGeo(0.09, 0.09, 0.025, 14).rotateX(Math.PI / 2), M.gold).position.y = -0.24;
  return g;
}

/** The hall with its people for one shot: the four benches (work.js scenes), the King, the crowd. */
function setUp(args) {
  const { story, M, seed } = args;
  const Hl = hall(M);
  const { group } = Hl;
  const cr = (story.crafters || []).slice(0, 4);
  const benches = cr.map((c, i) => {
    const ws = buildWorkScene({ job: c.job, anchor: new THREE.Vector3(BX[i], 0, BZ), face: 0, M, seed, id: `guild${i}`, t0: i * 0.37 });
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
  const on = t >= t0 - 0.2 && t <= t1 + 0.2;
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
        const k = ease(span(u, 0.7, 0.8));
        if (fin.has(b.c.id)) { P.root.position.z = 0.6 * k; P.r.g.rotation.set(-2.8, 0, 0.2); } // on to the final
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
      for (const b of S.benches) if (!fin.has(b.c.id)) { b.ws.rig.r.g.rotation.set(-0.2, 0, 0); b.ws.rig.l.g.rotation.set(-0.2, 0, 0); }
      S.cheer(t, 0.6);
      S.placeTags(labels);
    },
  };
}

// --- 18.5-23.5 s: the King hangs the medal on the winner, who holds up the work; the hall cheers ---
function medalShot(args) {
  const S = setUp(args);
  const win = S.benches.find((b) => b.c.id === args.story.winner) || S.benches[0];
  const W = win.ws.rig;
  const m = medal(args.M);
  const work = piece(args.M, win.c.job);
  args.M && S.group.add(m);
  W.r.hand.add(work);
  work.position.set(0, -0.15, 0.1);
  const tag = S.tags.find((l) => l.b === win);
  const labels = [tag];
  const award = awardOf(args);
  const flag = banner(args.M);
  flag.visible = false;
  S.group.add(flag);
  if (award === 2) { work.visible = false; for (const b of S.benches) if (b !== win) { const pc = piece(args.M, b.c.job); b.ws.rig.r.hand.add(pc); pc.position.set(0, -0.15, 0.1); } }
  const shower = petals(Number(args.seed || 1) + 3);
  S.group.add(shower.group);
  const X = BX[win.i];
  const cams = [
    (u) => ({ pos: S.toWorld(X - 1.4 + 0.6 * u, 1.9, BZ + 4.6 - 1.0 * u), look: S.toWorld(X + 0.3, 1.5, BZ + 0.9), fov: 60 }),
    // (1) from the winner's other side, lower, the two arms up together against the banners of the hall
    (u) => ({ pos: S.toWorld(X - 2.4 + 0.4 * u, 1.4, BZ + 4.6 - 0.6 * u), look: S.toWorld(X + 0.5, 1.8, BZ + 1.1), fov: 60 }),
    // (2) low in front on the winner's side, looking up at the banner waving over the winner
    (u) => ({ pos: S.toWorld(X - 1.7 + 0.3 * u, 1.2, BZ + 5.4 - 0.6 * u), look: S.toWorld(X + 0.3, 2.1, BZ + 1.0), fov: 64 }),
  ];
  return {
    group: S.group, labels, interior: true, banner: 'Master of the Guild!',
    focus: S.toWorld(BX[win.i], 1.5, BZ + 1),
    cam: (u) => cams[award](u),
    update(t, t0, t1) {
      if (!tick(S, t, t0, t1, { working: () => false })) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const hung = u > 0.42;
      W.root.position.set(0, 0, 1.0);
      W.body.rotation.x = 0;
      W.r.g.rotation.set(hung ? -2.8 + 0.15 * Math.sin(t * 7) : -0.4, 0, 0.1);
      W.l.g.rotation.set(hung ? -2.4 : -0.2, 0, -0.1);
      if (award === 1 && hung) { W.r.g.rotation.set(-0.5, 0, 0.1); W.l.g.rotation.set(u > 0.55 ? -2.9 : -0.3, 0, -0.25); } // the King lifts this arm
      if (award === 2) {
        flag.visible = u > 0.5;
        if (flag.visible && flag.parent !== W.r.hand) W.r.hand.add(flag);
        flag.position.set(0, -0.1, 0.05);
        if (hung) W.r.g.rotation.set(u > 0.5 ? -2.6 + 0.35 * Math.sin(t * 5) : -1.2, 0, 0.15); // waving it
        flag.rotation.set(-W.r.g.rotation.x, 0, 0.3 * Math.sin(t * 5)); // the pole upright
      }
      tag.sub = hung ? `Master ${JOBS[win.c.job]?.label || ''}`.trim() : tag.sub;
      // the King beside the winner (so the camera sees both), the medal from his hands to the winner's neck
      S.K.root.position.set(BX[win.i] + 1.0, 0, BZ + 1.4);
      S.K.root.rotation.y = -Math.PI / 2 - 0.4;
      const k = ease(span(u, 0.15, 0.42));
      S.K.r.g.rotation.set(-1.4 - 0.4 * k * (1 - k) * 4, 0, 0);
      S.K.l.g.rotation.set(-1.4 - 0.4 * k * (1 - k) * 4, 0, 0);
      const from = new THREE.Vector3(BX[win.i] + 0.6, 1.5, BZ + 1.3), to = new THREE.Vector3(BX[win.i], 1.52, BZ + 1.27);
      m.position.copy(from.lerp(to, k));
      if (award === 1 && u > 0.5) { // the King steps closer and lifts the winner's arm with his own
        const c = ease(span(u, 0.5, 0.6));
        S.K.root.position.x = X + lerp(1.0, 0.75, c);
        S.K.root.rotation.y = lerp(-Math.PI / 2 - 0.4, 0, c);
        S.K.r.g.rotation.set(lerp(-1.4, -2.9, ease(span(u, 0.55, 0.65))), 0, 0.3);
        S.K.l.g.rotation.set(-0.3, 0, 0);
      }
      if (award === 2 && u > 0.5) { S.K.r.g.rotation.set(-1.7 + 0.25 * Math.sin(t * 10), 0, 0.3); S.K.l.g.rotation.set(-1.7 - 0.25 * Math.sin(t * 10), 0, -0.3); } // the King claps
      for (const b of S.benches) if (b !== win) {
        if (award === 2 && u > 0.5) { b.ws.rig.r.g.rotation.set(-2.6 + 0.2 * Math.sin(t * 7 + b.i), 0, 0); b.ws.rig.l.g.rotation.set(-0.3, 0, 0); continue; } // their work up too
        b.ws.rig.r.g.rotation.set(-1.9 + 0.3 * Math.sin(t * 9 + b.i), 0, 0); b.ws.rig.l.g.rotation.set(-1.9 + 0.3 * Math.cos(t * 9 + b.i), 0, 0); // clapping
      }
      shower.at(t, award === 1 ? span(u, 0.55, 0.65) : 0, X + 0.4, 0, BZ + 1.2, 2.2);
      S.cheer(t, hung ? 1 : 0.4);
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
