// The guild contest's benches (owner 2026-11-25: "animazioni diverse rispetto alle solite"): not the trade's everyday work
// (work.js) but its masterpiece for the King, made on a contest bench from the first shot to the final. The piece grows on the
// bench as the contest goes (`stage`, 0 at the start of the work to 1 at the end of the final): the blacksmith's sword (hot,
// then quenched, then the guard and grip), the carpenter's casket (walls, lid, gold corners), the fletcher's bow (bent,
// strung, arrows), the baker's crown loaf (dough, braided ring, baked golden); any other trade's piece (guild.js `piece`)
// grows from small to full. Each craftsman works with the new rig (elbows, planted feet): the hands reach for points on
// the work (`reach`, a two-bone arm), and every few seconds the work stops and they look the piece over in their hands (the
// fletcher draws the bow to test it, the blacksmith sights along the blade).
// Frame: the craftsman at (0, 0, 0) facing +z, the bench in front at z 0.55, its top at y 0.88.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { rig, legIK, nod } from '../work.js';
import { ease, clamp01 } from './common.js';

const TOP = 0.88, BENCH_Z = 0.55;
const A = 0.32, B = 0.34; // upper arm, forearm to the hand
const START = 4, END = 18.5; // the contest's work, from the first work shot to the end of the final (guild.js GUILD_SHOTS)
const CYCLE = 4.6, LOOK = 1.3; // a cycle of work, the last LOOK seconds of it the piece looked over
const lerp = THREE.MathUtils.lerp;
const span = (u, a, b) => clamp01((u - a) / (b - a));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Puts the hand of arm `side` ('r' | 'l') of rig P at `target` (root frame): the arm swings out to the side as much as the
 * target is off the shoulder's line, then the upper arm and forearm bend in the arm's plane (the elbow down and back, as a
 * real arm). Call after the body is posed (it reads the body's matrices).
 */
export function reach(P, side, target) {
  const S = P[side], sx = side === 'r' ? 1 : -1;
  P.root.updateWorldMatrix(true, true);
  const t = P.body.worldToLocal(P.root.localToWorld(target.clone()));
  const d = t.sub(v3(sx * 0.3, 0.8, 0));
  const L = Math.min(d.length(), A + B - 1e-3);
  const out = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(d.x / Math.max(L, 1e-6), -1, 1)), -0.9, 0.9);
  const dy = d.y, dz = d.z;
  const r = Math.hypot(dy, dz);
  const th = Math.atan2(dz, -dy); // the target's angle forward from straight down, in the arm's plane
  const Lp = Math.min(Math.max(r, 0.05), A + B - 1e-3);
  const al = Math.acos(THREE.MathUtils.clamp((A * A + Lp * Lp - B * B) / (2 * A * Lp), -1, 1));
  const ph1 = th - al; // the upper arm, the elbow below the line to the hand
  const ez = A * Math.sin(ph1), ey = -A * Math.cos(ph1);
  const ph2 = Math.atan2(Lp * Math.sin(th) - ez, -(-Lp * Math.cos(th) - ey));
  S.g.rotation.set(-ph1, 0, out, 'XYZ');
  S.elbow.rotation.x = -Math.max(0, ph2 - ph1);
  void L;
}

/** All joints straight, standing up, feet planted. */
export function restPose(P) {
  for (const S of [P.r, P.l]) { S.g.rotation.set(0, 0, 0); S.elbow.rotation.set(0, 0, 0); S.hand.rotation.set(0, 0, 0); }
  P.body.rotation.set(0, 0, 0);
  P.body.position.set(0, 0.62, 0);
  nod(P, 0);
  if (P.legs2) legIK(P, FEET);
}
const FEET = [[-0.11, 0.0], [0.12, -0.08]];

function lean(P, a, sway = 0) {
  P.body.rotation.set(a, 0, sway * 0.05);
  P.body.position.set(sway * 0.02, 0.62 - 0.05 * a, -0.02 * a);
  if (P.legs2) legIK(P, FEET);
}

// --- the pieces ---------------------------------------------------------------------------------------------------------

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const mesh = (geo, m, parent) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); return o; };

function sword(M) {
  const g = new THREE.Group();
  const steel = mat('#b8bec6', { metalness: 0.7, roughness: 0.3, emissive: '#000000' });
  const blade = mesh(boxGeo(0.8, 0.018, 0.07).translate(0.4, 0, 0), steel, g);
  const guard = mesh(boxGeo(0.04, 0.03, 0.26), M.gold, g);
  const grip = mesh(cylGeo(0.022, 0.022, 0.18, 8).rotateZ(Math.PI / 2).translate(-0.1, 0, 0), M.woodDark, g);
  const pommel = mesh(new THREE.SphereGeometry(0.035, 8, 6).translate(-0.2, 0, 0), M.gold, g);
  const hot = new THREE.Color('#ff6a1a'), cold = new THREE.Color('#000000');
  return {
    group: g, holdAt: v3(0.25, 0, 0),
    stage(s) {
      blade.scale.x = lerp(0.45, 1, span(s, 0, 0.55));
      const glow = s < 0.78 ? 0.9 * (1 - span(s, 0.62, 0.78)) + 0.1 : 0;
      steel.emissive.copy(cold).lerp(hot, glow);
      steel.color.set(glow > 0.3 ? '#8a5a44' : '#b8bec6');
      guard.visible = s > 0.62; grip.visible = s > 0.7; pommel.visible = s > 0.86;
    },
  };
}

function casket(M) {
  const g = new THREE.Group();
  const wood = mat('#9a6a3e');
  mesh(boxGeo(0.5, 0.04, 0.32).translate(0, 0.02, 0), wood, g);
  const walls = new THREE.Group();
  g.add(walls);
  for (const [w, d, x, z] of [[0.5, 0.03, 0, 0.145], [0.5, 0.03, 0, -0.145], [0.03, 0.29, 0.235, 0], [0.03, 0.29, -0.235, 0]]) mesh(boxGeo(w, 0.2, d).translate(x, 0.1, z), wood, walls);
  walls.position.y = 0.04;
  const lid = new THREE.Group();
  g.add(lid);
  mesh(boxGeo(0.53, 0.05, 0.34), mat('#7d5230'), lid);
  mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.53, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.4, 1).translate(0, 0.02, 0), mat('#7d5230'), lid);
  lid.position.y = 0.27;
  const gold = new THREE.Group();
  g.add(gold);
  for (const x of [-0.25, 0.25]) for (const z of [-0.16, 0.16]) mesh(boxGeo(0.04, 0.24, 0.04).translate(x, 0.14, z), M.gold, gold);
  mesh(boxGeo(0.06, 0.07, 0.02).translate(0, 0.22, 0.17), M.gold, gold);
  return {
    group: g, holdAt: v3(0, 0.12, 0),
    stage(s) {
      const w = span(s, 0.08, 0.6);
      walls.visible = w > 0.02; walls.scale.y = Math.max(0.02, w);
      lid.visible = s > 0.7; gold.visible = s > 0.88;
    },
  };
}

function bow(M) {
  const g = new THREE.Group();
  const wood = mat('#8a5a2b');
  const segs = [];
  const N = 8, LEN = 1.2;
  for (let i = 0; i < N; i++) {
    const p = new THREE.Group();
    g.add(p);
    mesh(cylGeo(0.022, 0.022, LEN / N + 0.004, 6).rotateZ(Math.PI / 2).translate(LEN / N / 2, 0, 0), wood, p);
    segs.push(p);
  }
  // the string in two halves, from each tip to the nock (pulled back when the bow is drawn)
  const strMat = mat('#e8e0c8');
  const halves = [0, 1].map(() => mesh(cylGeo(0.004, 0.004, 1, 4).rotateZ(Math.PI / 2), strMat, g));
  const arrows = new THREE.Group();
  g.add(arrows);
  for (let k = 0; k < 3; k++) {
    const a = new THREE.Group();
    mesh(cylGeo(0.008, 0.008, 0.7, 5).rotateZ(Math.PI / 2), M.wood, a);
    mesh(new THREE.ConeGeometry(0.018, 0.06, 5).rotateZ(-Math.PI / 2).translate(0.38, 0, 0), M.iron, a);
    mesh(boxGeo(0.1, 0.004, 0.035).translate(-0.3, 0, 0), M.clothRed, a);
    a.position.set(0.05, 0, 0.18 + k * 0.05);
    arrows.add(a);
  }
  const span2 = (o, p, q) => { // a unit cylinder along x stretched from p to q, in the bow's plane (y = 0)
    o.position.copy(p).add(q).multiplyScalar(0.5);
    o.rotation.set(0, -Math.atan2(q.z - p.z, q.x - p.x), 0);
    o.scale.set(Math.max(1e-3, p.distanceTo(q)), 1, 1);
  };
  let s0 = 0, pull = 0;
  const api = {
    group: g, holdAt: v3(0, 0, 0), nock: 0, sag: 0, strung: false,
    setPull(p) { pull = p; api.stage(s0); },
    stage(s) {
      s0 = s;
      // the stave as a chain of segments bent evenly, its middle toward -z, the tips at z = 0
      const bend = lerp(0, 0.75, span(s, 0.1, 0.6)) + 0.4 * pull;
      let x = 0, z = 0, a = -bend / 2;
      const pts = [];
      for (let i = 0; i < N; i++) { pts.push([x, z, a]); x += Math.cos(a) * LEN / N; z += Math.sin(a) * LEN / N; a += bend / (N - 1); }
      const cx = x / 2, cz = z / 2;
      let sag = 0;
      pts.forEach(([px, pz, pa], i) => { segs[i].position.set(px - cx, 0, pz - cz); segs[i].rotation.set(0, -pa, 0); sag = Math.min(sag, pz - cz); });
      const e0 = v3(-cx, 0, -cz), e1 = v3(x - cx, 0, z - cz);
      api.sag = sag;
      api.strung = s > 0.6;
      api.nock = e0.z + 0.45 * pull;
      const nk = v3(0, 0, api.nock);
      span2(halves[0], e0, nk); span2(halves[1], nk, e1);
      for (const h of halves) h.visible = api.strung;
      arrows.visible = s > 0.82;
    },
  };
  return api;
}

function crownLoaf() {
  const g = new THREE.Group();
  const dough = mat('#ead9b4', { roughness: 0.85 });
  const ball = mesh(new THREE.SphereGeometry(0.15, 14, 10).scale(1, 0.6, 1).translate(0, 0.07, 0), dough, g);
  const ring = new THREE.Group();
  g.add(ring);
  mesh(new THREE.TorusGeometry(0.2, 0.07, 10, 24).rotateX(Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.05, 0), dough, ring);
  const knots = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    knots.push(mesh(new THREE.SphereGeometry(0.06, 10, 8).scale(1, 0.7, 1).translate(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2), dough, ring));
  }
  const raw = new THREE.Color('#ead9b4'), baked = new THREE.Color('#c4802f');
  return {
    group: g, holdAt: v3(0, 0.05, 0),
    stage(s) {
      ball.visible = s < 0.2; ring.visible = s >= 0.2;
      knots.forEach((kn, k) => { kn.visible = s > 0.3 + k * 0.035; });
      dough.color.copy(raw).lerp(baked, span(s, 0.62, 0.8));
      dough.roughness = s > 0.8 ? 0.45 : 0.85; // glazed
    },
  };
}

function anyPiece(M, job, make) {
  const g = new THREE.Group();
  const p = make(M, job);
  g.add(p);
  return { group: g, holdAt: v3(0, 0.12, 0), stage(s) { const k = lerp(0.3, 0.75, span(s, 0, 0.8)); p.scale.setScalar(k); } };
}

// --- the benches ----------------------------------------------------------------------------------------------------------

function bench(M, group) {
  const add = (geo, m, x, y, z) => { const o = mesh(geo, m, group); o.position.set(x, y, z); o.receiveShadow = true; return o; };
  add(boxGeo(1.5, 0.07, 0.62), M.wood, 0, TOP - 0.035, BENCH_Z);
  for (const x of [-0.68, 0.68]) for (const z of [BENCH_Z - 0.25, BENCH_Z + 0.25]) add(boxGeo(0.07, TOP - 0.07, 0.07), M.woodDark, x, (TOP - 0.07) / 2, z);
}

/** A small hand tool held in a hand group, along the hand's forward (+z) axis once the wrist turns it. */
function handTool(kind, M) {
  const g = new THREE.Group();
  if (kind === 'hammer') {
    mesh(cylGeo(0.018, 0.02, 0.34, 6).translate(0, -0.02, 0).rotateX(Math.PI / 2).translate(0, 0, 0.12), M.woodDark, g);
    mesh(boxGeo(0.07, 0.07, 0.15).rotateY(Math.PI / 2).translate(0, 0, 0.28), M.iron, g);
  } else if (kind === 'plane') {
    mesh(boxGeo(0.09, 0.07, 0.24).translate(0, -0.05, 0.02), M.wood, g);
    mesh(boxGeo(0.03, 0.06, 0.05).translate(0, 0.0, 0.0), M.woodDark, g);
  } else if (kind === 'knife') {
    mesh(cylGeo(0.016, 0.016, 0.1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.03), M.woodDark, g);
    mesh(boxGeo(0.012, 0.03, 0.12).translate(0, 0, 0.13), M.iron, g);
  } else if (kind === 'tongs') {
    for (const s of [-1, 1]) mesh(boxGeo(0.012, 0.012, 0.42).rotateY(s * 0.05).translate(s * 0.012, 0, 0.2), M.iron, g);
  }
  return g;
}

/** The trades' work at the bench: `work(P, k, tl)` poses the craftsman (k: time in the work, tl: the bench's things). */
const TRADES = {
  blacksmith: {
    make: (M) => sword(M), at: v3(-0.2, TOP + 0.03, BENCH_Z), rot: 0,
    tools: { r: 'hammer', l: 'tongs' }, period: 0.62, sparks: true,
    extras(M, g) {
      // a small anvil on the bench and a brazier glowing at the side
      const a = mesh(boxGeo(0.22, 0.1, 0.16), M.iron, g); a.position.set(0.12, TOP + 0.05, BENCH_Z);
      const br = mesh(cylGeo(0.2, 0.14, 0.5, 10), M.iron, g); br.position.set(-1.05, 0.25, 0.3);
      const coal = mesh(cylGeo(0.17, 0.17, 0.04, 10), new THREE.MeshBasicMaterial({ color: '#ff7a2a' }), g); coal.position.set(-1.05, 0.51, 0.3);
    },
    work(P, k, w) {
      // the hammer up behind the head, then down on the hot steel on the anvil; the tongs hold the blade's tang
      const ph = (k / w.period) % 1, up = ph < 0.62 ? ease(ph / 0.62) : 1 - ease((ph - 0.62) / 0.38);
      const strikeAt = v3(0.12, TOP + 0.2, BENCH_Z), raised = v3(0.22, 1.62, 0.18);
      lean(P, 0.18 + 0.1 * (1 - up), 0.3 * Math.sin(k * 0.7));
      reach(P, 'r', strikeAt.clone().lerp(raised, up));
      P.r.hand.rotation.set(-0.5 + 1.4 * up, 0, 0);
      reach(P, 'l', v3(-0.38, TOP + 0.12, BENCH_Z - 0.06));
      P.l.hand.rotation.set(0.2, 0.9, 0);
      nod(P, 0.35);
      return { strike: ph > 0.98 || ph < 0.02 };
    },
    look(P, k, piece) {
      // sights along the blade, held up in the tongs
      piece.group.position.set(-0.05, 1.45, 0.45);
      piece.group.rotation.set(0, -Math.PI / 2 + 0.25 * Math.sin(k * 2), 0.15);
      reach(P, 'l', v3(-0.1, 1.38, 0.38));
      reach(P, 'r', v3(0.25, 1.0, 0.3));
      nod(P, -0.05);
    },
  },
  carpenter: {
    make: (M) => casket(M), at: v3(-0.38, TOP, BENCH_Z + 0.05), rot: 0.3,
    tools: { r: 'plane' }, period: 1.1,
    extras(M, g) {
      const board = mesh(boxGeo(0.16, 0.03, 0.62), M.wood, g); board.position.set(0.3, TOP + 0.015, BENCH_Z);
      for (let k = 0; k < 3; k++) { const pl = mesh(boxGeo(1.2, 0.03, 0.14), M.wood, g); pl.position.set(0.95, 0.05 + k * 0.035, -0.3); pl.rotation.y = 1.2; }
    },
    work(P, k, w) {
      // the plane pushed down the board with both hands, the weight going into it, then drawn back
      const ph = (k / w.period) % 1, push = ph < 0.6 ? ease(ph / 0.6) : 1 - ease((ph - 0.6) / 0.4);
      const z = lerp(0.3, 0.8, push);
      lean(P, 0.2 + 0.25 * push, 0.4);
      reach(P, 'r', v3(0.3, TOP + 0.1, z - 0.06));
      P.r.hand.rotation.set(-P.r.g.rotation.x - P.r.elbow.rotation.x, 0, 0);
      reach(P, 'l', v3(0.24, TOP + 0.12, z + 0.08));
      nod(P, 0.4);
      w.tool.r.visible = true;
      return {};
    },
    look(P, k, piece) {
      piece.group.position.set(0, 1.22, 0.42);
      piece.group.rotation.set(0.15, 0.6 * Math.sin(k * 1.6), 0);
      reach(P, 'r', v3(0.2, 1.24, 0.42));
      reach(P, 'l', v3(-0.2, 1.24, 0.42));
      nod(P, 0.15);
    },
  },
  fletcher: {
    make: (M) => bow(M), at: v3(0, TOP + 0.03, BENCH_Z), rot: 0,
    tools: { r: 'knife' }, period: 0.55,
    extras(M, g) {
      for (let k = 0; k < 6; k++) { const st = mesh(cylGeo(0.012, 0.012, 1.1, 5), M.wood, g); st.position.set(0.95 + (k % 3) * 0.05, 0.55, -0.1 + Math.floor(k / 3) * 0.05); st.rotation.z = 0.12; }
      for (let k = 0; k < 5; k++) { const f = mesh(boxGeo(0.1, 0.004, 0.035), k % 2 ? M.clothRed : M.clothIvory, g); f.position.set(0.5 + k * 0.03, TOP + 0.005, BENCH_Z + 0.2); f.rotation.y = k * 0.4; }
    },
    work(P, k, w) {
      // shaving the stave with a knife in short strokes, the other hand pinning it to the bench
      const ph = (k / w.period) % 1, cut = ph < 0.45 ? ease(ph / 0.45) : 1 - ease((ph - 0.45) / 0.55);
      lean(P, 0.32, -0.3);
      reach(P, 'r', v3(lerp(0.05, 0.38, cut), TOP + 0.08, BENCH_Z - 0.02));
      P.r.hand.rotation.set(-P.r.g.rotation.x - P.r.elbow.rotation.x, -1.3, 0);
      reach(P, 'l', v3(-0.3, TOP + 0.08, BENCH_Z));
      nod(P, 0.45);
      return {};
    },
    look(P, k, piece, u) {
      // tests the bow: held out upright in the left hand, the string drawn back to the cheek, then let go
      const draw = piece.strung ? Math.sin(Math.PI * clamp01(u * 1.2)) : 0;
      piece.setPull(draw);
      const at = v3(-0.08, 1.4, 0.64);
      piece.group.position.copy(at);
      piece.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3(0, 1, 0), v3(1, 0, 0), v3(0, 0, -1)));
      reach(P, 'l', at.clone().add(v3(0, 0, piece.sag)));
      reach(P, 'r', at.clone().add(v3(0.04, 0.02, -piece.nock)));
      nod(P, -0.05);
    },
  },
  baker: {
    make: () => crownLoaf(), at: v3(0, TOP, BENCH_Z + 0.02), rot: 0,
    tools: {}, period: 0.95, flour: true,
    extras(M, g) {
      const board = mesh(boxGeo(0.7, 0.02, 0.45), mat('#d9c49a'), g); board.position.set(0, TOP + 0.01, BENCH_Z);
      // a little oven on a stand at the side, its mouth glowing
      const ov = mesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#a8643f'), g); ov.position.set(-1.2, 0.6, 0.1);
      const st = mesh(boxGeo(0.9, 0.6, 0.9), M.stone || M.wood, g); st.position.set(-1.2, 0.3, 0.1);
      const mouth = mesh(new THREE.CircleGeometry(0.14, 12, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#ff8a3a' }), g); mouth.position.set(-1.2, 0.6, 0.52);
    },
    work(P, k, w) {
      // kneading and rolling: the heels of both hands push the dough away and draw it back, the shoulders in it
      const ph = (k / w.period) % 1, push = Math.sin(ph * Math.PI * 2) * 0.5 + 0.5;
      lean(P, 0.22 + 0.15 * push, 0.5 * Math.sin(k * 1.3));
      const z = lerp(0.42, 0.66, push);
      reach(P, 'r', v3(0.1, TOP + 0.09 - 0.02 * push, z));
      reach(P, 'l', v3(-0.1, TOP + 0.09 - 0.02 * (1 - push), z - 0.04));
      for (const S of [P.r, P.l]) S.hand.rotation.set(-S.g.rotation.x - S.elbow.rotation.x - 0.6, 0, 0);
      nod(P, 0.45);
      return {};
    },
    look(P, k, piece) {
      piece.group.position.set(0, 1.2, 0.45);
      piece.group.rotation.set(0.35, 0.5 * Math.sin(k * 1.5), 0);
      reach(P, 'r', v3(0.22, 1.18, 0.45));
      reach(P, 'l', v3(-0.22, 1.18, 0.45));
      nod(P, 0.2);
    },
  },
};

const GENERIC = {
  at: v3(0, TOP, BENCH_Z), rot: 0.2, tools: { r: 'hammer' }, period: 0.8,
  extras() {},
  work(P, k, w) {
    const ph = (k / w.period) % 1, up = ph < 0.65 ? ease(ph / 0.65) : 1 - ease((ph - 0.65) / 0.35);
    lean(P, 0.22, 0.3 * Math.sin(k * 0.8));
    reach(P, 'r', v3(0.1, TOP + 0.22, BENCH_Z).lerp(v3(0.2, 1.35, 0.25), up));
    P.r.hand.rotation.set(-0.4 + 1.0 * up, 0, 0);
    reach(P, 'l', v3(-0.2, TOP + 0.1, BENCH_Z));
    nod(P, 0.4);
    return {};
  },
  look: TRADES.carpenter.look,
};

/**
 * A craftsman of `job` at a contest bench, at (x, 0, z) facing the camera, with their masterpiece. Shaped like a work scene
 * for guild.js: { group, rig, update(t), rest(), finish() }. `makePiece(M, job)` makes any other trade's piece.
 */
export function contestBench({ job, M, x, z, i = 0, makePiece }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const T = TRADES[job] || { ...GENERIC, make: (MM) => anyPiece(MM, job, makePiece) };
  bench(M, group);
  T.extras(M, group);
  const P = rig(M, JOBS[job]?.color || '#7a6a55');
  group.add(P.root);
  const tool = {};
  for (const side of ['r', 'l']) if (T.tools[side]) { tool[side] = handTool(T.tools[side], M); P[side].hand.add(tool[side]); }
  const piece = T.make(M, job);
  group.add(piece.group);
  // sparks off the blacksmith's hammer, puffs of flour off the baker's board
  const bits = new THREE.Group();
  group.add(bits);
  const bitMat = T.sparks ? new THREE.MeshBasicMaterial({ color: '#ffb347' }) : new THREE.MeshBasicMaterial({ color: '#f4efe4', transparent: true, opacity: 0.7 });
  const bitList = Array.from({ length: T.sparks ? 10 : (T.flour ? 6 : 0) }, (_, k) => { const b = new THREE.Mesh(new THREE.SphereGeometry(T.sparks ? 0.012 : 0.03, 5, 4), bitMat); bits.add(b); b.userData.d = v3(Math.cos(k * 2.4) * 0.6, 0.9 + (k % 3) * 0.4, Math.sin(k * 2.4) * 0.6); return b; });
  const off = i * 1.17; // the four benches out of step
  const w = { period: T.period, tool };
  const placePiece = () => { piece.group.position.copy(T.at); piece.group.rotation.set(0, T.rot, 0); };
  let last = 0;
  return {
    group, rig: P, piece, tool,
    update(t) {
      last = t;
      const s = clamp01((t - START) / (END - START));
      piece.stage(s);
      if (piece.setPull) piece.setPull(0);
      const c = (t + off) % CYCLE, k = t + off;
      restArms(P);
      for (const side of ['r', 'l']) if (tool[side]) tool[side].visible = true;
      if (c > CYCLE - LOOK && t > START + 0.6) {
        // the piece looked over: lifted from the bench and back (a short ease each way)
        const u = (c - (CYCLE - LOOK)) / LOOK;
        lean(P, 0.06, 0);
        for (const side of ['r', 'l']) if (tool[side] && !(job === 'blacksmith' && side === 'l')) tool[side].visible = false;
        (T.look || GENERIC.look)(P, k, piece, u);
        const back = ease(span(u, 0.82, 1)), lift = ease(span(u, 0, 0.18));
        if (lift < 1 || back > 0) {
          const held = piece.group.position.clone(), hq = piece.group.quaternion.clone();
          const a = Math.min(lift, 1 - back);
          piece.group.position.copy(T.at).lerp(held, a);
          piece.group.quaternion.setFromEuler(new THREE.Euler(0, T.rot, 0)).slerp(hq, a);
        }
        bits.visible = false;
        return;
      }
      placePiece();
      const r = T.work(P, k, w);
      // the bits fly from the work for half a second after each blow (sparks) or each push (flour)
      const age = ((k / T.period) % 1) * T.period;
      bits.visible = bitList.length > 0 && age < 0.45 && t > START;
      if (bits.visible) {
        const from = T.sparks ? v3(0.12, TOP + 0.2, BENCH_Z) : v3(0, TOP + 0.1, BENCH_Z + 0.1);
        bitList.forEach((b) => { const d = b.userData.d; b.position.set(from.x + d.x * age, from.y + d.y * age - 4.9 * age * age * (T.sparks ? 1 : 0.15), from.z + d.z * age); });
      }
      void r;
    },
    /** Hands down, standing straight: when the work stops (the judging, the prize-giving). */
    rest() { restPose(P); piece.stage(clamp01((last - START) / (END - START))); placePiece(); bits.visible = false; },
    /** The finished piece, held in both hands in front of the chest (the winner's). */
    finish() { piece.stage(1); if (piece.setPull) piece.setPull(0); return piece; },
  };
}

function restArms(P) {
  for (const S of [P.r, P.l]) { S.g.rotation.set(0, 0, 0); S.elbow.rotation.set(0, 0, 0); S.hand.rotation.set(0, 0, 0); }
}

/** The rosette the King pins on the winner: a pleated red ring round a gold boss, two ribbon tails. Faces +z. */
export function rosette(M) {
  const g = new THREE.Group();
  g.scale.setScalar(1.35); // big enough to read in the narrow frame
  const red = M.clothRed, gold = M.gold;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const p = new THREE.Mesh(boxGeo(0.045, 0.06, 0.012), k % 2 ? red : mat('#b3202a'));
    p.position.set(Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0);
    p.rotation.z = a + Math.PI / 2;
    g.add(p);
  }
  g.add(new THREE.Mesh(cylGeo(0.05, 0.05, 0.02, 14).rotateX(Math.PI / 2).translate(0, 0, 0.008), gold));
  g.add(new THREE.Mesh(cylGeo(0.028, 0.028, 0.012, 12).rotateX(Math.PI / 2).translate(0, 0, 0.02), red));
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(boxGeo(0.04, 0.16, 0.006), s < 0 ? red : gold);
    tail.position.set(s * 0.03, -0.12, -0.004);
    tail.rotation.z = s * 0.25;
    g.add(tail);
  }
  return g;
}
