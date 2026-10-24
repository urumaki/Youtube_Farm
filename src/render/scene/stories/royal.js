// The King rides through town (owner 2026-10-20: the King is the channel's owner). An open royal
// carriage, blue and gold, drawn by two white horses with plumes, guards with banners behind;
// the townsfolk line the main street, cheer, jump and throw petals. Named villagers stand in the front row
// with their name tags. The King sits on the back seat, crowned, waving. A story over three quiet days
// (src/sim/stories.js): he rides in (this scene), holds a feast in the square (feast.js), then rides out
// again the other way (step 'leave', this scene) while the crowd waves goodbye.
import * as THREE from 'three';
import { polyline } from '../../../sim/world.js';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { rig, particles } from '../work.js';
import { ROYAL } from '../textures.js';
import { person, stride, castTag, clamp01 } from './common.js';

const SPEED = 2.1; // m/s, a stately trot
const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#4a6a64', '#9a8a6a', '#56606e', '#b5476b'];
const LATERAL = 4.7; // the crowd stands on the verges of the 8 m main street

function mat(M, color, opts = {}) {
  const m = M.people.clone();
  m.color.set(color);
  Object.assign(m, opts);
  return m;
}

/** A white horse with a blue saddle cloth and a red plume, facing +z; legs trot with `gait(ph)`. */
function horse(M) {
  const g = new THREE.Group();
  const coat = mat(M, '#eeeae2');
  const add = (geo, m, parent = g) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); return o; };
  add(boxGeo(0.55, 0.62, 1.55).translate(0, 1.3, 0), coat);
  add(boxGeo(0.3, 0.7, 0.36).rotateX(-0.55).translate(0, 1.78, 0.78), coat);
  add(boxGeo(0.24, 0.26, 0.58).rotateX(0.35).translate(0, 2.08, 1.07), coat);
  add(boxGeo(0.06, 0.55, 0.3).rotateX(-0.55).translate(0, 1.95, 0.66), M.gear); // mane
  add(boxGeo(0.1, 0.6, 0.1).rotateX(0.5).translate(0, 1.25, -0.9), M.gear); // tail
  add(boxGeo(0.6, 0.5, 0.9).translate(0, 1.42, -0.05), mat(M, ROYAL.blue));
  add(boxGeo(0.62, 0.06, 0.92).translate(0, 1.18, -0.05), M.gold);
  add(new THREE.ConeGeometry(0.08, 0.35, 8).translate(0, 2.42, 0.95), M.clothRed); // plume
  const legs = [];
  for (const [x, z] of [[-0.18, -0.58], [0.18, -0.58], [-0.18, 0.58], [0.18, 0.58]]) {
    const l = new THREE.Group();
    l.position.set(x, 1.0, z);
    add(boxGeo(0.13, 1.0, 0.14).translate(0, -0.5, 0), coat, l);
    add(boxGeo(0.15, 0.1, 0.17).translate(0, -0.97, 0.01), M.gear, l);
    g.add(l);
    legs.push(l);
  }
  return { g, legs };
}

/** The King, seated: a red cloak with an ermine collar, a gold crown (a seated rig, see work.js). */
export function king(M) {
  const K = rig(M, '#9b1b30', { seated: true });
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; K.body.add(o); return o; };
  add(cylGeo(0.26, 0.42, 0.95, 14, 4, true).translate(0, 0.42, -0.05), mat(M, '#7d1426', { side: THREE.DoubleSide }));
  add(new THREE.TorusGeometry(0.22, 0.07, 8, 16).rotateX(Math.PI / 2).translate(0, 0.86, 0), M.clothIvory);
  add(cylGeo(0.21, 0.2, 0.17, 16, 4, true).translate(0, 1.3, 0), mat(M, ROYAL.gold, { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(new THREE.ConeGeometry(0.035, 0.12, 5).translate(Math.cos(a) * 0.2, 1.44, Math.sin(a) * 0.2), M.gold);
  }
  add(new THREE.SphereGeometry(0.035, 8, 6).translate(0, 1.32, 0.21), M.clothRed); // a ruby
  return K;
}

/** The open carriage (a landau), facing +z, with the King on the back seat and a coachman up front. */
function carriage(M) {
  const g = new THREE.Group();
  const blue = mat(M, ROYAL.blue, { roughness: 0.4, metalness: 0.1 });
  const red = M.clothRed;
  const add = (geo, m, parent = g) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  add(boxGeo(1.3, 0.14, 3.2).translate(0, 0.85, 0.1), M.woodDark); // chassis
  // the tub: floor, two sides, a curved back, a low front; gold rails on top
  add(boxGeo(1.5, 0.08, 2.2).translate(0, 1.0, -0.2), M.woodDark);
  for (const s of [-1, 1]) {
    add(boxGeo(0.08, 0.7, 2.2).translate(s * 0.75, 1.38, -0.2), blue);
    add(boxGeo(0.11, 0.07, 2.25).translate(s * 0.75, 1.75, -0.2), M.gold);
    const arms = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.62).rotateY(s * Math.PI / 2).translate(s * 0.8, 1.38, -0.25), M.arms);
    g.add(arms);
  }
  add(boxGeo(1.5, 1.1, 0.1).translate(0, 1.55, -1.3), blue);
  add(boxGeo(1.55, 0.08, 0.14).translate(0, 2.12, -1.3), M.gold);
  add(boxGeo(1.5, 0.55, 0.08).translate(0, 1.3, 0.9), blue);
  add(boxGeo(1.55, 0.07, 0.12).translate(0, 1.6, 0.9), M.gold);
  // the King's seat, red velvet
  add(boxGeo(1.3, 0.4, 0.55).translate(0, 1.2, -0.95), red);
  add(boxGeo(1.3, 0.8, 0.12).translate(0, 1.7, -1.22), red);
  // coachman's box up front
  add(boxGeo(1.1, 0.5, 0.5).translate(0, 1.45, 1.3), blue);
  add(boxGeo(1.2, 0.08, 0.6).translate(0, 1.74, 1.3), M.woodDark);
  add(boxGeo(1.0, 0.06, 0.4).translate(0, 1.15, 1.75), M.woodDark); // footboard
  add(boxGeo(0.12, 0.12, 2.4).translate(0, 0.85, 2.9), M.woodDark); // pole to the horses
  // wheels: big at the back, small in front, gold hubs; they turn with the distance
  const wheels = [];
  for (const [x, z, r] of [[-0.85, -0.85, 0.72], [0.85, -0.85, 0.72], [-0.85, 1.25, 0.52], [0.85, 1.25, 0.52]]) {
    const w = new THREE.Group();
    w.position.set(x, r, z);
    add(new THREE.TorusGeometry(r - 0.04, 0.05, 6, 20).rotateY(Math.PI / 2), M.woodDark, w);
    add(cylGeo(0.12, 0.12, 0.22, 10).rotateZ(Math.PI / 2), M.gold, w);
    for (let s = 0; s < 6; s++) add(boxGeo(0.04, 2 * r - 0.1, 0.05).rotateX((s * Math.PI) / 6), M.gold, w);
    g.add(w);
    wheels.push({ w, r });
  }
  // the King on the back seat
  const K = king(M);
  K.root.position.set(0, 0.93, -0.85); // hips on the seat (top at 1.4)
  g.add(K.root);
  // the coachman in royal blue
  const C = rig(M, ROYAL.blue, { seated: true });
  C.root.position.set(0, 1.78 - 0.47, 1.25);
  g.add(C.root);
  return { g, wheels, king: K, coachman: C };
}

/** A guard with a banner on a pole (royal blue and gold). */
export function bannerGuard(M) {
  const P = person(M, ROYAL.blue);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.18, 0), M.iron);
  helm.castShadow = true;
  P.body.add(helm);
  const pole = new THREE.Mesh(cylGeo(0.025, 0.025, 2.6, 6).translate(0, 0.75, 0.06), M.woodDark);
  P.r.hand.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9).translate(0.32, 1.6, 0.06), M.cloth);
  P.r.hand.add(flag);
  return { P, flag };
}

export function buildRoyal({ story, w, M, seed, yFn, lang }) {
  const road = w.roads.find((r) => r.id === 'east') || w.roads[0];
  const pl = polyline(road.pts);
  const group = new THREE.Group();
  group.visible = false;
  const coach = carriage(M);
  group.add(coach.g);
  const horses = [-0.45, 0.45].map(() => { const h = horse(M); group.add(h.g); return h; });
  const guards = [0, 1].map(() => { const g = bannerGuard(M); group.add(g.P.root); return g; });
  // the procession moves toward the market (decreasing s); the crowd lines both sides around its path.
  // Leaving, it goes back out (increasing s) past the same crowd: `back` is the side the rest of the
  // procession trails on
  const leave = story.step === 'leave', back = leave ? -1 : 1;
  const S0 = Math.min(pl.total - 40, 64), S_CROWD = [S0 - 16, S0 + 18];
  const P = new THREE.Vector3();
  const place = (obj, s, lateral, turn = leave) => {
    const [x, z, ang] = pl.at(Math.max(0, Math.min(pl.total, s)));
    P.set(x - Math.sin(ang) * lateral, 0, z + Math.cos(ang) * lateral);
    P.y = yFn(P.x, P.z);
    if (obj) { obj.position.copy(P); obj.rotation.y = -ang - Math.PI / 2 + (turn ? Math.PI : 0); }
    return ang;
  };
  const cast = story.cast || [];
  const nCrowd = 22;
  const crowd = Array.from({ length: nCrowd }, (_, i) => {
    const named = i < cast.length ? cast[i] : null;
    const color = named ? JOBS[named.job]?.color || '#7a6a55' : CROWD[Math.floor(rand01(seed, 'royal-c', i) * CROWD.length)];
    const p = person(M, color);
    group.add(p.root);
    // named villagers in the front row near the middle of the route, both sides
    const side = i % 2 ? 1 : -1;
    const s = named ? S0 + 5 - i * 2.4 : S_CROWD[0] + rand01(seed, 'royal-s', i) * (S_CROWD[1] - S_CROWD[0]);
    const lat = side * (named ? LATERAL : LATERAL + 0.7 + rand01(seed, 'royal-l', i) * 1.1);
    const ang = place(p.root, s, lat, false);
    p.root.rotation.y = -ang - Math.PI / 2 - side * Math.PI / 2; // facing the street
    return { p, named, s, phase: rand01(seed, 'royal-ph', i) * 6, pos: P.clone() };
  });
  // petals thrown from the verges over the carriage
  const petalSets = ['#d23a4c', '#f3e6c4', '#e3b23c'].map((c) => { const pts = particles(40, c, 0.13, false); group.add(pts); return pts; });
  const labels = [{ pos: new THREE.Vector3(), title: lang === 'it' ? 'Il Re' : 'The King', sub: leave ? (lang === 'it' ? 'Arrivederci!' : 'Farewell!') : lang === 'it' ? 'Viva il Re!' : 'Long live the King!' }];
  for (const c of crowd) if (c.named) labels.push({ ...castTag(c.named, lang), pos: c.pos.clone().setY(c.pos.y + 2.2) });
  // the banner guards behind the carriage are named guards or knights when there are some (owner 2026-10-25)
  const escortTags = guards.map((g, k) => story.escort?.[k] && { g, tag: castTag(story.escort[k], lang) }).filter(Boolean);
  labels.push(...escortTags.map((x) => x.tag));
  // the lead horses' heads (arriving, the procession goes toward s = 0); leaving, the carriage passes the
  // same stretch of crowd the other way
  const headS = (t, t0) => (leave ? S0 + 1.7 + (t - t0) * SPEED : S0 - (t - t0) * SPEED);
  let T0 = 0, T1 = 1;
  const v = new THREE.Vector3();
  return {
    group,
    labels,
    banner: leave ? (lang === 'it' ? 'Il Re riparte' : 'The King rides home') : lang === 'it' ? 'Passa il Re!' : 'The King rides through town!',
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    focus: (() => { place(null, S0 - 6, 0); return P.clone().setY(P.y + 1.6); })(),
    cam(u) {
      // ahead of the carriage and to one side, low, looking back at it and the cheering crowd
      const head = headS(T0 + u * (T1 - T0), T0);
      const ang = place(null, head + 4.6 * back, 0); // the carriage, just ahead of the King
      const c = P.clone();
      const dir = ang + (leave ? 0 : Math.PI), a = dir + 0.52 - 0.25 * u; // dir: the way the procession goes; inside the crowd line
      return {
        pos: new THREE.Vector3(c.x + Math.cos(a) * 8.2, c.y + 3.5, c.z + Math.sin(a) * 8.2),
        look: c.clone().add(new THREE.Vector3(0, 1.7, 0)),
      };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.5 && t <= t1 + 0.5;
      if (!group.visible) return;
      const head = headS(t, t0), went = (t - t0) * SPEED;
      // horses, then the carriage behind them
      horses.forEach((h, k) => {
        place(h.g, head + 1.2 * back, k ? 0.45 : -0.45);
        h.legs.forEach((l, j) => { l.rotation.x = 0.45 * Math.sin(t * 7.5 + (j === 0 || j === 3 ? 0 : Math.PI)); });
        h.g.position.y += 0.04 * Math.abs(Math.sin(t * 7.5));
      });
      place(coach.g, head + 5.6 * back, 0);
      coach.g.position.y += 0.02 * Math.sin(t * 9);
      coach.wheels.forEach(({ w: wh, r }) => { wh.rotation.x = -went / r; });
      // the King waves to one side, then the other; the coachman holds the reins
      const K = coach.king;
      const wave = Math.sin(t * 1.3);
      K.root.rotation.y = 0.45 * wave;
      K.r.g.rotation.set(-2.6 + 0.25 * Math.sin(t * 8), 0, -0.25);
      K.l.g.rotation.set(-0.6, 0, 0.1);
      coach.coachman.r.g.rotation.set(-1.0, 0, -0.2); coach.coachman.l.g.rotation.set(-1.0, 0, 0.2);
      // two guards follow the carriage, banners up (none ahead: they would stand in front of the camera)
      guards.forEach(({ P: G, flag }, k) => {
        place(G.root, head + 9.4 * back, k % 2 ? 1.1 : -1.1);
        stride(G, went * 2.6 + k, 0.4, { arms: false });
        G.r.g.rotation.set(-0.5, 0, 0);
        G.l.g.rotation.x = 0.3 * Math.sin(went * 2.6 + k);
        flag.rotation.y = 0.15 * Math.sin(t * 3 + k);
      });
      // the crowd cheers louder as the carriage comes near: arms up, hats waved, jumps
      const carS = head + 5.6 * back;
      crowd.forEach((c, i) => {
        const near = clamp01(1 - Math.abs(c.s - carS) / 14);
        const ph = t * 8 + c.phase;
        const up = 0.35 + 0.65 * near;
        c.p.r.g.rotation.set(-0.3 - 2.4 * up + 0.3 * Math.sin(ph), 0, -0.15);
        c.p.l.g.rotation.set(i % 3 === 0 ? -0.3 - 2.2 * up + 0.3 * Math.sin(ph + 1.3) : -0.2, 0, 0.15);
        c.p.root.position.y = c.pos.y + (near > 0.3 ? 0.12 * near * Math.abs(Math.sin(ph * 0.9)) : 0);
        c.p.legs[0].rotation.x = c.p.legs[1].rotation.x = 0;
      });
      // petals: each one thrown from a crowd member near the carriage, arcing over the street
      petalSets.forEach((pts, k) => {
        const arr = pts.geometry.attributes.position.array;
        for (let i = 0; i < 40; i++) {
          const life = 1.6, ph = (t * 0.9 + rand01(seed, 'petal', k, i)) % 1;
          const n = Math.floor(t * 0.9 + rand01(seed, 'petal', k, i));
          const thrower = crowd[(i * 7 + k * 3 + n * 5) % nCrowd];
          const age = ph * life;
          place(null, thrower.s, 0, false);
          const toRoad = v.copy(P).sub(thrower.pos).setY(0).normalize();
          const sx = (rand01(seed, 'pv', k, i, n) - 0.5) * 1.2;
          arr[i * 3] = thrower.pos.x + toRoad.x * 2.4 * age + sx * age;
          arr[i * 3 + 1] = thrower.pos.y + 1.9 + 2.2 * age - 2.0 * age * age;
          arr[i * 3 + 2] = thrower.pos.z + toRoad.z * 2.4 * age + sx * 0.5 * age;
          if (Math.abs(thrower.s - carS) > 16) arr[i * 3 + 1] = -1e4;
        }
        pts.geometry.attributes.position.needsUpdate = true;
      });
      coach.g.updateMatrixWorld(true);
      labels[0].pos.copy(K.root.getWorldPosition(v)).add(new THREE.Vector3(0, 2.3, 0));
      for (const { g, tag } of escortTags) tag.pos.copy(g.P.root.position).add(new THREE.Vector3(0, 2.5, 0));
    },
  };
}
