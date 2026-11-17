// A brawl in the tavern (owner 2026-11-17, src/sim/stories.js `brawl`): one shot of 11 s told in four parts, with hard cuts
// inside it. The spark: two named villagers argue in the aisle and one shoves the other. The fight, in slow motion: a wild
// swing that misses (the other ducks, only their hat flies off), a tankard thrown by a named drinker spinning between their
// heads and spilling ale, a counter-swing that misses again, a stool hurled from the top of a table smashing on the bar; back
// to full speed, the one who dodged staggers back into a small table and sits down hard as it tips over. The guards: the door
// bursts open (slow motion again), everyone freezes, two named guards stride in and point. The bill: the two mend the table and
// sweep up the stool while the innkeeper stomps and waves their arms, red in the face, steam over their head; the guards look
// on. Comic: every swing misses, nobody gets hurt. Inside the tavern (tavern.js, its own lamps). story: fighters, keeper,
// guards, throwers (src/sim/stories.js).
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { toolGeo, particles } from '../work.js';
import { buildTavernInterior } from '../tavern.js';
import { person, stride, castTag, ease, clamp01 } from './common.js';

const F = 0.3, HZ = 4.3; // the tavern's floor above its lot, the room's inner half depth (tavern.js)
export const BRAWL_SECONDS = 11; // the shot's length (timeline.js); the times below are seconds of it
const CUT = [2.4, 6.2, 8.2]; // the hard cuts: the spark | the fight | the guards | the bill
// the slow motion: [from, to, speed] in seconds of the shot (the fight, then the door bursting open)
const SLOWS = [[2.4, 5.4, 0.25], [6.3, 6.9, 0.3]];
/** Seconds of the shot to action time (the action runs slower through SLOWS). */
export function act(s) {
  let a = 0, prev = 0;
  for (const [x0, x1, v] of SLOWS) {
    if (s <= x0) return a + s - prev;
    a += x0 - prev;
    if (s <= x1) return a + (s - x0) * v;
    a += (x1 - x0) * v;
    prev = x1;
  }
  return a + s - prev;
}
/** Action time back to seconds of the shot (for the synced sounds). */
export function real(y) {
  let a = 0, prev = 0;
  for (const [x0, x1, v] of SLOWS) {
    const a0 = a + x0 - prev;
    if (y <= a0) return prev + y - a;
    const a1 = a0 + (x1 - x0) * v;
    if (y <= a1) return x0 + (y - a0) / v;
    a = a1;
    prev = x1;
  }
  return prev + y - a;
}
// what happens when, in action time
const SHOVE = 1.4, SWING_B = 2.5, HAT = 2.63, TANK = [2.48, 3.02], REAR = 2.3, STOOL = [2.5, 3.1], SWING_A = 2.84;
const STAGGER = 3.15, SIT = 3.6, SAT = 3.75, DOOR = act(6.35), BILL = act(CUT[2]);
// the fight: in the open strip along the front wall, between the fireplace end and the door (tavern.js: the tables start
// 2 m in from that wall), the two facing each other across it
const A0 = new THREE.Vector3(-1.0, F, -2.45), B0 = new THREE.Vector3(-1.0, F, -3.45);
const C = A0.clone().lerp(B0, 0.5);
const TBL = new THREE.Vector3(0.5, F, -3.55); // the small table by the wall that tips over
// the shots inside the shot: the spark | over the thrower's shoulder | side on | the stool coming | the table | the door | the bill
const SUB = [2.4, 3.28, 4.32, 5.4, 6.2, 8.2];
const G = -9.8;
const ramp = (a, a0, a1) => ease(clamp01((a - a0) / (a1 - a0)));
const lerp = THREE.MathUtils.lerp;
const bez = (p, s, q, e) => new THREE.Vector3().copy(s).multiplyScalar((1 - p) ** 2).addScaledVector(q, 2 * p * (1 - p)).addScaledVector(e, p * p);

function stoolParts(M) {
  const seat = new THREE.Mesh(cylGeo(0.2, 0.2, 0.06, 12), M.wood);
  const legs = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2;
    const m = new THREE.Mesh(cylGeo(0.025, 0.03, 0.45, 6), M.woodDark);
    m.userData.at = new THREE.Vector3(Math.cos(a) * 0.13, -0.24, Math.sin(a) * 0.13);
    return m;
  });
  return [seat, ...legs];
}

function smallTable(M) {
  // its pivot is the bottom of the side it tips over to (+x): the table sits at x -0.4 from it
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x - 0.4, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(boxGeo(0.8, 0.06, 0.6), M.wood, 0, 0.75, 0);
  for (const [x, z] of [[-0.33, -0.24], [0.33, -0.24], [-0.33, 0.24], [0.33, 0.24]]) add(boxGeo(0.06, 0.72, 0.06), M.woodDark, x, 0.36, z);
  return { g };
}

/** A person's pose to zero (the limbs set every frame from here). */
function rest(P) {
  P.body.rotation.set(0, 0, 0);
  P.body.position.y = 0.62;
  P.r.g.rotation.set(0, 0, 0);
  P.l.g.rotation.set(0, 0, 0);
  if (P.legs) for (const l of P.legs) l.rotation.set(0, 0, 0);
}


export function buildBrawl({ story, M, buildings, seed }) {
  const item = buildings.items.tavern;
  if (!item) return null;
  const keeperCast = story.keeper || null;
  const tav = buildTavernInterior({ item, M, seed, keepers: keeperCast ? [keeperCast] : [] });
  const room = tav.group, group = new THREE.Group();
  const toWorld = (v) => v.clone().applyMatrix4(item.group.matrix);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const colorOf = (c, dflt = '#7a6a55') => (c ? JOBS[c.job]?.color || dflt : dflt);
  const [ca, cb] = story.fighters || story.cast;
  const A = person(M, colorOf(ca)), B = person(M, colorOf(cb));
  room.add(A.root, B.root);
  const hammer = toolGeo('hammer', M), broom = toolGeo('broom', M);
  A.r.hand.add(hammer); B.r.hand.add(broom);
  // the drinkers who throw: a tankard from against the wall at the fireplace end, a stool from the top of the bar
  const [ct1, ct2] = story.throwers || [];
  const T1 = person(M, colorOf(ct1, '#5d6b35')), T2 = person(M, colorOf(ct2, '#6a4a6e'));
  room.add(T1.root, T2.root);
  T1.root.position.set(-3.0, F, -3.95); T1.root.rotation.y = Math.PI / 2;
  T2.root.position.set(3.5, F + 1.13, -2.4); T2.root.rotation.y = -Math.PI / 2; // standing on the counter (tavern.js BAR_X)
  const heldTank = toolGeo('tankard', M);
  T1.r.hand.add(heldTank);
  const tank = new THREE.Group();
  tank.add(toolGeo('tankard', M).translateZ(-0.12));
  room.add(tank);
  // the guards (named ones when there are), spears in hand
  const gc = story.guards || [];
  const guards = [0, 1].map((i) => {
    const P = person(M, colorOf(gc[i], JOBS.guard.color));
    P.r.hand.add(toolGeo('spear', M));
    room.add(P.root);
    return P;
  });
  // the innkeeper: the barkeeper pouring at the bar (tavern.js), red in the face at the end
  const K = tav.people.find((p) => p.kind === 'pour')?.P;
  const skin = K?.head.material, red = skin?.clone();
  if (red) red.color.set('#e2452f');
  const drinkers = tav.people.filter((p) => p.kind === 'drinker');
  // the drinkers on the benches along the strip got out of the way (they stood in front of the cameras)
  for (const { P } of drinkers) if (P.root.position.z < -1.5) P.root.visible = false;

  // the stool, whole while it flies, then in pieces
  const stool = new THREE.Group();
  stoolParts(M).forEach((m) => { if (m.userData.at) m.position.copy(m.userData.at); m.castShadow = true; stool.add(m); });
  room.add(stool);
  const pieces = stoolParts(M).map((m, i) => {
    m.castShadow = true;
    room.add(m);
    const v = V(0.2 + 1.6 * rand01(seed, 'brawl-px', i), 0.5 + 1.3 * rand01(seed, 'brawl-py', i), (rand01(seed, 'brawl-pz', i) - 0.5) * 1.8);
    const w = V(rand01(seed, 'brawl-w1', i) * 14 - 7, rand01(seed, 'brawl-w2', i) * 14 - 7, rand01(seed, 'brawl-w3', i) * 14 - 7);
    return { m, v, w };
  });
  // the small table, and what was on it
  const tbl = smallTable(M);
  tbl.g.position.set(TBL.x + 0.4, F, TBL.z);
  room.add(tbl.g);
  const onTable = [toolGeo('tankard', M), new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6).scale(1.5, 0.75, 1), M.hay)].map((m, i) => {
    const g = new THREE.Group();
    g.add(m);
    room.add(g);
    return { g, at: V(TBL.x - 0.15 + i * 0.3, F + 0.8 + (i ? 0.05 : 0), TBL.z + (i ? 0.1 : -0.12)), v: V(1.5 + i * 0.4, 0.9, i ? 0.4 : -0.3) };
  });
  // the hat knocked off by the swing that missed
  const hatFly = new THREE.Group(), hatCopy = A.hat.clone();
  hatCopy.position.set(0, -1.22, 0);
  hatFly.add(hatCopy);
  room.add(hatFly);
  // the door bursting open: a leaf swinging in on its right-hand hinge, the daylight in the doorway, a cold light, the dust
  const leaf = new THREE.Group();
  leaf.position.set(2.25, F, -HZ + 0.16);
  const leafMesh = new THREE.Mesh(boxGeo(1.5, 2.5, 0.08), M.woodDark);
  leafMesh.position.set(-0.75, 1.25, 0);
  leafMesh.castShadow = true;
  leaf.add(leafMesh);
  for (const y of [0.5, 2.0]) { const band = new THREE.Mesh(boxGeo(1.4, 0.08, 0.1), M.iron); band.position.set(-0.75, y, 0); leaf.add(band); }
  room.add(leaf);
  const doorway = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 2.42), new THREE.MeshBasicMaterial({ color: '#c9d3dc' }));
  doorway.position.set(1.5, F + 1.21, -HZ + 0.13);
  room.add(doorway);
  const dayLight = new THREE.PointLight('#dfe8ff', 0, 10, 1.4);
  dayLight.position.set(1.5, F + 1.7, -HZ + 0.9);
  room.add(dayLight);
  const N_ALE = 36, ale = particles(N_ALE, '#e0a53a', 0.07, false);
  const N_DUST = 40, dust = particles(N_DUST, '#bfae8c', 0.11, false);
  const N_STEAM = 14, steam = particles(N_STEAM, '#f4f4f4', 0.15, false);
  room.add(ale, dust, steam);
  // a warm lamp over the strip by the front wall (the room's own lights are over the tables)
  const lamp = new THREE.PointLight('#ffb866', 0, 7, 1.6);
  lamp.position.set(-0.6, F + 2.7, -3.0);
  room.add(lamp);

  // the name tags: the ones in each part (at most four: big tags)
  const tag = (c, P, sub, fallback) => (c ? { ...castTag(c), ...(sub ? { sub } : {}), P } : fallback ? { pos: V(0, 0, 0), title: fallback, sub: sub || '', P } : null);
  const tA = tag(ca, A), tB = tag(cb, B), tT1 = tag(ct1, T1), tT2 = tag(ct2, T2);
  const tG = guards.map((P, i) => tag(gc[i], P));
  const tK = K ? tag(keeperCast, K, 'Furious!', 'The innkeeper') : null;
  const fixA = tA && { ...tA, sub: 'Fixing the table' }, fixB = tB && { ...tB, sub: 'Sweeping up' };
  const PARTS = [[tA, tB], [tA, tB, tT1, tT2], [tG[0], tG[1]], [fixA, fixB, tK, tG[0]]].map((l) => l.filter(Boolean));
  const labels = [...PARTS[0]];
  const partOf = (s) => (s < CUT[0] ? 0 : s < CUT[1] ? 1 : s < CUT[2] ? 2 : 3);
  const BANNERS = ['A brawl in the tavern!', 'A brawl in the tavern!', 'The guards!', 'Fix what you broke!'];

  // the paths of the thrown things (in the room's frame)
  const fwd = (P) => V(Math.sin(P.root.rotation.y), 0, Math.cos(P.root.rotation.y));
  const head = (P, a = 0) => { // the top of the head of a standing person leaning forward by a
    const hip = V(P.root.position.x, P.root.position.y + P.body.position.y, P.root.position.z);
    return hip.addScaledVector(fwd(P), Math.sin(a) * 1.22).add(V(0, Math.cos(a) * 1.22, 0));
  };
  const tankFrom = V(-2.8, F + 1.75, -3.85), tankTo = V(1.2, F + 0.06, -2.2);
  const tankMid = V(C.x, F + 1.62, C.z); // between the two heads
  const tankQ = tankMid.clone().multiplyScalar(2).addScaledVector(tankFrom.clone().add(tankTo), -0.5);
  const stoolChest = V(3.05, F + 1.13 + 1.37, -2.4), stoolRear = V(3.65, F + 1.13 + 1.62, -2.4);
  const stoolFrom = V(3.1, F + 2.4, -2.4), stoolTo = V(-0.15, F + 0.12, -2.4), stoolQ = V(1.6, F + 2.75, -2.4);
  const tankAt = (a) => bez(clamp01((a - TANK[0]) / (TANK[1] - TANK[0])), tankFrom, tankQ, tankTo);
  const stoolAt = (a) => bez(clamp01((a - STOOL[0]) / (STOOL[1] - STOOL[0])), stoolFrom, stoolQ, stoolTo);
  /** A thing thrown from p0 at v, dt action seconds later: where it is, lying where it lands on the floor. */
  const ballistic = (out, p0, v, dt, floor = F + 0.03) => {
    const vy = v.y, y0 = Math.max(0, p0.y - floor);
    const land = (vy + Math.sqrt(vy * vy - 2 * G * y0)) / -G;
    const d = Math.min(dt, land);
    out.set(p0.x + v.x * d, p0.y + vy * d + 0.5 * G * d * d, p0.z + v.z * d);
    return d;
  };
  const tmp = V(0, 0, 0);

  // ---------------------------------------------------------------- the people, pose by pose
  function argue(P, k, a) {
    const turn = Math.floor(a / 0.7) % 2, talking = k === turn, ph = a * 7.5 + k;
    P.body.rotation.x = talking ? 0.2 + 0.05 * Math.sin(ph) : -0.06;
    P.r.g.rotation.set(talking ? -1.3 - 0.7 * Math.sin(ph) : -2.5 + 0.25 * Math.sin(a * 11), 0, talking ? -0.2 : 0);
    P.l.g.rotation.set(talking ? -0.9 - 0.6 * Math.sin(ph + 1.4) : -0.2, 0, talking ? 0.3 : 0.5);
  }
  const fists = (P, a, k = 0) => {
    P.r.g.rotation.set(-1.95 + 0.1 * Math.sin(a * 8 + k), 0, 0.35);
    P.l.g.rotation.set(-1.75 + 0.1 * Math.cos(a * 8 + k), 0, -0.35);
    P.body.rotation.x = 0.12;
  };
  function fighterA(a) { // faces -z, toward the wall and the other
    const P = A;
    rest(P);
    P.root.position.copy(A0);
    P.root.rotation.y = Math.PI;
    if (a < SHOVE) return argue(P, 0, a);
    if (a < SHOVE + 0.35) { // the shove: both hands into the other's chest
      const k = Math.sin((Math.PI * (a - SHOVE)) / 0.35);
      P.body.rotation.x = 0.35 * k;
      P.r.g.rotation.set(-1.5, 0, 0.12); P.l.g.rotation.set(-1.5, 0, -0.12);
      P.root.position.z -= 0.18 * k;
      return;
    }
    if (a < 3.05) {
      fists(P, a);
      P.root.position.y = F + 0.03 * Math.abs(Math.sin(a * 9));
      // ducking under the swing
      const duck = ramp(a, 2.43, 2.56) * (1 - ramp(a, 2.78, 2.9));
      P.body.rotation.x += 0.85 * duck;
      P.body.position.y = 0.62 - 0.12 * duck;
      if (duck > 0.3) P.r.g.rotation.x = P.l.g.rotation.x = -2.7; // hands over the head
      // the uppercut, missing as the other leans back
      if (a >= SWING_A) {
        const k = ramp(a, SWING_A, SWING_A + 0.15);
        P.r.g.rotation.set(-0.5 - 2.3 * k, 0, 0.1);
        P.body.rotation.x = 0.2 - 0.35 * k;
        P.body.rotation.y = -0.35 * k;
      }
      return;
    }
    if (a < 3.7) { fists(P, a); P.body.rotation.y = -0.5 * ramp(a, 3.2, 3.5); return; } // watching the other stagger off
    // both fists up: the winner, they think
    P.r.g.rotation.set(-2.9 + 0.2 * Math.sin(a * 10), 0, -0.35); P.l.g.rotation.set(-2.9 + 0.2 * Math.cos(a * 10), 0, 0.35);
    P.body.rotation.set(-0.12, -0.5, 0);
    P.root.position.y = F + 0.06 * Math.abs(Math.sin(a * 8));
  }
  function fighterB(a) { // faces +z
    const P = B;
    rest(P);
    P.root.position.copy(B0);
    P.root.rotation.y = 0;
    if (a < SHOVE) return argue(P, 1, a);
    if (a < 2.35) { // pushed back to the wall, then back in, fists up
      const back = a < 2.0 ? ramp(a, SHOVE + 0.1, 1.85) : 1 - ramp(a, 2.0, 2.33);
      P.root.position.z = B0.z - 0.4 * back;
      P.body.rotation.x = a < 1.85 ? -0.35 * (1 - ramp(a, 1.6, 1.85)) * ramp(a, SHOVE + 0.1, 1.6) : 0.1;
      P.r.g.rotation.set(-1.0, 0, -0.6); P.l.g.rotation.set(-1.0, 0, 0.6);
      if (a > 1.85) fists(P, a, 1);
      stride(P, a * 14, a > 1.5 && a < 2.33 ? 0.35 : 0, { arms: false });
      return;
    }
    if (a < 2.85) { // the haymaker: wound up, swung round over the ducking head, a stumble after it
      const wind = ramp(a, 2.35, SWING_B), swing = ramp(a, SWING_B, 2.7);
      P.body.rotation.y = 0.6 * wind - 1.3 * swing;
      P.r.g.rotation.set(-1.55, 0, 1.0 * wind - 1.5 * swing);
      P.l.g.rotation.set(-1.6, 0, -0.35);
      P.body.rotation.x = 0.1 + 0.3 * swing;
      return;
    }
    if (a < STAGGER) { // leaning right back from the uppercut, arms flailing
      const k = ramp(a, 2.85, 3.0);
      P.body.rotation.x = -0.6 * k;
      P.r.g.rotation.set(-2.3 + 0.5 * Math.sin(a * 30), 0, 0.9); P.l.g.rotation.set(-2.5 + 0.5 * Math.cos(a * 30), 0, -0.9);
      return;
    }
    if (a < SIT) { // staggering sideways along the wall to the small table
      const k = ramp(a, STAGGER, SIT);
      P.root.position.set(lerp(B0.x, TBL.x - 0.55, k), F, lerp(B0.z, TBL.z + 0.05, k));
      P.body.rotation.set(-0.4, 0, -0.25);
      P.r.g.rotation.set(-2.0 + 0.6 * Math.sin(a * 25), 0, 1.0); P.l.g.rotation.set(-2.2 + 0.6 * Math.cos(a * 25), 0, -1.0);
      stride(P, a * 18, 0.5, { arms: false });
      return;
    }
    // down hard on the floor against the table, legs out, dazed
    const k = ramp(a, SIT, SAT);
    P.root.position.set(TBL.x - 0.55, F - 0.5 * k, TBL.z + 0.05);
    for (const l of P.legs) l.rotation.x = -1.45 * k;
    P.body.rotation.x = -0.2 * k;
    P.body.rotation.z = 0.12 * Math.sin(a * 6) * k;
    P.r.g.rotation.set(0.5 * k, 0, 0.4); P.l.g.rotation.set(0.5 * k, 0, -0.4);
  }
  function throwers(a) {
    rest(T1); rest(T2);
    heldTank.visible = a < TANK[0];
    // the tankard: cheering with it, wound back over the shoulder, thrown; then hands to the cheeks
    if (a < 2.2) { T1.r.g.rotation.set(-2.4 + 0.3 * Math.sin(a * 9), 0, 0); T1.l.g.rotation.set(-0.4, 0, 0.2); }
    else if (a < TANK[0]) { T1.r.g.rotation.set(lerp(-2.4, -3.1, ramp(a, 2.2, TANK[0])), 0, 0); T1.body.rotation.x = -0.2; T1.l.g.rotation.set(-1.2, 0, 0.3); }
    else if (a < TANK[0] + 0.2) { T1.r.g.rotation.set(lerp(-3.1, -1.0, ramp(a, TANK[0], TANK[0] + 0.15)), 0, 0); T1.body.rotation.x = 0.3; }
    else { T1.r.g.rotation.set(-2.5, 0, -0.55); T1.l.g.rotation.set(-2.5, 0, 0.55); T1.body.rotation.x = -0.1; }
    // the stool: held at the chest up on the counter, swung back, hurled down the room
    if (a < REAR) { T2.r.g.rotation.set(-1.35, 0, -0.25); T2.l.g.rotation.set(-1.35, 0, 0.25); T2.body.rotation.x = 0.05 * Math.sin(a * 6); }
    else if (a < STOOL[0]) { const k = ramp(a, REAR, STOOL[0]); T2.r.g.rotation.set(lerp(-1.35, -2.6, k), 0, -0.2); T2.l.g.rotation.set(lerp(-1.35, -2.6, k), 0, 0.2); T2.body.rotation.x = -0.3 * k; }
    else if (a < STOOL[0] + 0.2) { const k = ramp(a, STOOL[0], STOOL[0] + 0.12); T2.r.g.rotation.set(lerp(-2.6, -1.2, k), 0, -0.1); T2.l.g.rotation.set(lerp(-2.6, -1.2, k), 0, 0.1); T2.body.rotation.x = lerp(-0.3, 0.4, k); }
    else { T2.r.g.rotation.set(-1.6, 0, 1.0); T2.l.g.rotation.set(-1.6, 0, -1.0); T2.body.rotation.x = 0.1; } // whoops
  }
  let hatStart = V(0, 0, 0);
  function objects(a) {
    // the tankard spinning between the heads, ale flying from it in drops
    tank.visible = a >= TANK[0];
    if (tank.visible) {
      tank.position.copy(tankAt(a));
      const fly = a < TANK[1];
      tank.rotation.set(fly ? (a - TANK[0]) * 11 : Math.PI / 2, fly ? (a - TANK[0]) * 4 : 0.6, 0);
    }
    const arr = ale.geometry.attributes.position.array;
    for (let i = 0; i < N_ALE; i++) {
      const p = (i / N_ALE) * 0.85, a0 = lerp(TANK[0], TANK[1], p);
      if (a < a0) { arr[i * 3 + 1] = -1e4; continue; }
      const v = V((rand01(seed, 'ale-x', i) - 0.5) * 0.9, 0.3 + rand01(seed, 'ale-y', i) * 0.6, (rand01(seed, 'ale-z', i) - 0.5) * 0.9);
      ballistic(tmp, tankAt(a0), v, a - a0, F + 0.01);
      arr.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    ale.geometry.attributes.position.needsUpdate = true;
    // the stool: at the chest, swung back, flying, in pieces on the floor behind the two
    const broken = a >= STOOL[1];
    stool.visible = !broken;
    if (a < REAR) { stool.position.copy(stoolChest); stool.rotation.set(0, 0, Math.PI / 2); }
    else if (a < STOOL[0]) { stool.position.copy(stoolChest).lerp(stoolRear, ramp(a, REAR, STOOL[0])); stool.rotation.set(0, 0, Math.PI / 2 + ramp(a, REAR, STOOL[0])); }
    else if (!broken) { stool.position.copy(stoolAt(a)); stool.rotation.set((a - STOOL[0]) * 7, (a - STOOL[0]) * 5, Math.PI / 2 + 1); }
    for (const p of pieces) {
      p.m.visible = broken;
      if (!broken) continue;
      const d = ballistic(p.m.position, stoolTo, p.v, a - STOOL[1]);
      p.m.rotation.set(p.w.x * d, p.w.y * d, p.w.z * d);
    }
    // the hat knocked off by the swing
    hatFly.visible = a >= HAT && a < BILL;
    A.hat.visible = !hatFly.visible; // back on for the bill
    if (hatFly.visible) {
      const d = ballistic(hatFly.position, hatStart, V(-1.0, 2.0, 0.3), a - HAT, F + 0.08);
      hatFly.rotation.set(d * 6, d * 9, d * 3);
    }
    // the small table tipping over (away from the one who sits down against it), what was on it flying off
    const tip = a < BILL ? (Math.PI / 2) * clamp01((a - SIT - 0.02) / 0.22) ** 2 : 0;
    tbl.g.rotation.z = a < BILL ? -tip : -0.06;
    for (const o of onTable) {
      o.g.visible = a < BILL;
      if (a < SIT + 0.03 || a >= BILL) { o.g.position.copy(o.at); o.g.rotation.set(0, 0, 0); continue; }
      const d = ballistic(o.g.position, o.at, o.v, a - SIT - 0.03);
      o.g.rotation.set(0, 0, -d * 8);
    }
    // the door
    const open = ramp(a, DOOR, DOOR + 0.09);
    leaf.rotation.y = 1.95 * open - (open >= 1 ? 0.12 * Math.exp(-6 * (a - DOOR - 0.09)) * Math.sin((a - DOOR) * 30) : 0);
    leaf.visible = a >= DOOR - 0.3;
    doorway.visible = a >= DOOR;
    dayLight.intensity = a >= DOOR ? 5 * (1 + 0.6 * Math.exp(-4 * (a - DOOR))) : 0;
    const darr = dust.geometry.attributes.position.array;
    for (let i = 0; i < N_DUST; i++) {
      const dt = a - DOOR;
      if (dt < 0 || dt > 1.6) { darr[i * 3 + 1] = -1e4; continue; }
      const r1 = rand01(seed, 'dust1', i), r2 = rand01(seed, 'dust2', i), r3 = rand01(seed, 'dust3', i);
      const spread = 1 - Math.exp(-2.5 * dt);
      darr.set([1.5 + (r1 - 0.5) * 1.4 + (r1 - 0.5) * 2.2 * spread, F + 0.2 + r2 * 2.2 + 0.25 * spread, -HZ + 0.25 + r3 * 2.0 * spread], i * 3);
    }
    dust.geometry.attributes.position.needsUpdate = true;
  }
  function guardsDo(a, t) {
    guards.forEach((P, i) => {
      rest(P);
      P.root.visible = a >= DOOR + 0.04;
      P.r.g.rotation.set(-0.3, 0, 0.05); // the spear upright
      if (a < BILL) {
        const from = V(1.3 + 0.5 * i, F, -HZ - 0.4 - 0.3 * i), to = V(1.2 + 0.8 * i, F, -2.95 + 0.45 * i);
        const k = clamp01((a - DOOR - 0.06 - 0.08 * i) / 0.75);
        P.root.position.copy(from).lerp(to, k);
        P.root.rotation.y = k < 1 ? -0.1 : Math.atan2(C.x - to.x, C.z - to.z);
        if (k < 1 && k > 0) stride(P, a * 13 + i, 0.45, { arms: false });
        if (i === 0 && k >= 1) { const p = ramp(a, DOOR + 0.85, DOOR + 1.0); P.l.g.rotation.set(-1.55 * p, 0, 0); P.body.rotation.x = 0.1 * p; }
        else P.l.g.rotation.set(k < 1 ? 0.5 * Math.sin(a * 13 + i) : -0.1, 0, 0.1);
      } else {
        // the bill: watching them work, a fist on the hip
        const at = [V(2.4, F, -2.65), V(2.6, F, -1.75)][i];
        P.root.position.copy(at);
        P.root.rotation.y = Math.atan2(-1.0 - at.x, -2.9 - at.z);
        P.l.g.rotation.set(-0.35, 0, -0.75);
        P.body.rotation.z = 0.03 * Math.sin(t * 1.3 + i);
      }
    });
  }
  function keeper(a, t) {
    if (!K) return;
    rest(K);
    if (a < BILL) {
      // behind the bar, hands on the head
      K.root.position.set(3.5 + 0.75, F, -1.5);
      K.root.rotation.y = -Math.PI / 2;
      K.r.g.rotation.set(-2.6, 0, -0.75); K.l.g.rotation.set(-2.6, 0, 0.75);
      K.body.rotation.x = -0.12;
      K.head.material = skin;
      return;
    }
    // furious: stomping, both arms waving, red in the face
    K.root.position.set(0.25, F + 0.06 * Math.abs(Math.sin(t * 9)), -2.15);
    K.root.rotation.y = -1.45; // the red face to the camera, half turned to the two // facing the two (and the camera)
    K.r.g.rotation.set(-2.5 + 0.5 * Math.sin(t * 8), 0, 0.8); K.l.g.rotation.set(-2.5 - 0.5 * Math.sin(t * 8), 0, -0.8); // arms up in a V, the red face between them
    K.body.rotation.set(0.15, 0.25 * Math.sin(t * 5), 0);
    K.head.material = red;
  }
  function drinkersDo(a) {
    if (a >= BILL) return; // back to their drinks (tavern.js)
    drinkers.forEach(({ P }, i) => {
      const cheer = i % 2 === 0 || a > SHOVE;
      P.r.g.rotation.set(cheer ? -1.85 + 0.25 * Math.sin(a * 9 + i) : -0.95, 0, 0);
      P.l.g.rotation.set(cheer && i % 3 === 0 ? -1.6 + 0.25 * Math.cos(a * 9 + i) : -0.4, 0, 0.1);
      P.body.rotation.set(-0.1, 0, 0.04 * Math.sin(a * 5 + i));
    });
  }
  function bill(s, t) {
    // the two put things right: one hammering the table's leg back on, the other sweeping up the stool
    rest(A); rest(B);
    A.root.position.set(TBL.x, F, TBL.z + 0.62);
    A.root.rotation.y = Math.PI;
    A.body.rotation.x = 0.55;
    const ph = ((s - CUT[2]) / 0.55) % 1;
    A.r.g.rotation.set(ph < 0.65 ? lerp(-1.0, -2.3, ease(ph / 0.65)) : lerp(-2.3, -1.0, ((ph - 0.65) / 0.35) ** 2), 0, 0.1);
    A.l.g.rotation.set(-1.1, 0, -0.2);
    B.root.position.set(-0.35 + 0.1 * Math.sin(t * 3.2), F, -3.55);
    B.root.rotation.y = -Math.PI / 2;
    B.body.rotation.set(0.3, 0.35 * Math.sin(t * 3.2), 0);
    B.r.g.rotation.set(-0.75, 0, -0.25); B.l.g.rotation.set(-0.95, 0, 0.35);
  }

  const hammerTimes = [];
  for (let s = CUT[2] + 0.55; s < BRAWL_SECONDS - 0.2; s += 0.55) hammerTimes.push(s);
  const SOUNDS = [[real(SHOVE + 0.15), 'hoe'], [real(TANK[1]), 'clang'], [real(STOOL[1]), 'lance'], [real(SIT + 0.2), 'crash'], [real(SAT), 'hoe'],
    [real(DOOR), 'ram'], [real(DOOR + 0.1), 'hoe'], [real(DOOR + 0.95), 'hoe'], ...hammerTimes.map((s) => [s, 'chop'])];
  const IMPACTS = [[STOOL[1], 0.03], [SIT + 0.2, 0.05], [DOOR, 0.07]];
  // the camera of each shot inside the shot (seconds of the shot): [from, to, pos0, pos1, look0, look1, fov]
  const SHOTS = [
    [0, SUB[0], V(-5.6, F + 2.55, -3.9), V(-4.9, F + 2.4, -3.55), V(C.x, F + 1.0, C.z), V(C.x, F + 1.0, C.z), 58], // the spark, from the fireplace end
    [SUB[0], SUB[1], V(-4.25, F + 2.0, -4.0), V(-4.05, F + 1.95, -3.95), V(-1.1, F + 1.4, -3.0), V(-1.0, F + 1.4, -2.95), 54], // over the thrower's shoulder
    [SUB[1], SUB[2], V(-4.3, F + 1.55, -2.95), V(-4.1, F + 1.6, -3.1), V(C.x, F + 1.35, C.z), V(C.x, F + 1.35, C.z), 50], // side on, the tankard between the heads
    [SUB[2], SUB[3], V(-4.2, F + 1.3, -2.3), V(-4.0, F + 1.35, -2.4), V(1.2, F + 1.6, -2.9), V(0.8, F + 1.4, -2.8), 56], // the stool coming down the room
    [SUB[3], SUB[4], V(-3.8, F + 2.4, -1.9), V(-3.6, F + 2.3, -2.0), V(0.0, F + 0.6, -3.4), V(0.2, F + 0.5, -3.45), 58], // into the table
    [SUB[4], SUB[5], V(-3.3, F + 2.4, -2.1), V(-3.0, F + 2.35, -2.25), V(1.5, F + 1.1, -3.9), V(1.4, F + 1.1, -3.8), 58], // the door
    [SUB[5], BRAWL_SECONDS, V(-3.7, F + 2.15, -3.2), V(-3.3, F + 2.05, -3.15), V(0.7, F + 1.25, -2.95), V(0.7, F + 1.25, -2.95), 60], // the bill
  ];

  let T0 = 0, T1w = 1;
  const sOf = (t) => ((t - T0) / (T1w - T0)) * BRAWL_SECONDS;
  return {
    group,
    labels,
    interior: true,
    banner: BANNERS[0],
    bannerAt: (t) => BANNERS[partOf(sOf(t))],
    focus: toWorld(V(C.x, 1.1, C.z)),
    work: { strikeTimes: () => [], sound: null, hits: (t0, t1) => SOUNDS.map(([s, k]) => [t0 + (s / BRAWL_SECONDS) * (t1 - t0), k]) },
    setWindow(t0, t1) { T0 = t0; T1w = t1; },
    cam(u) {
      const s = u * BRAWL_SECONDS, a = act(s);
      const [s0, s1, p0, p1, l0, l1, fov] = SHOTS.find((x) => s < x[1]) || SHOTS.at(-1);
      const k = ease(clamp01((s - s0) / (s1 - s0)));
      const pos = p0.clone().lerp(p1, k), look = l0.clone().lerp(l1, k);
      for (const [ai, amp] of IMPACTS) {
        const d = a - ai;
        if (d > 0 && d < 1) { const e = amp * Math.exp(-6 * d); pos.x += e * Math.sin(d * 60); pos.y += e * Math.sin(d * 75 + 1); }
      }
      return { pos: toWorld(pos), look: toWorld(look), fov };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      tav.update(t, on);
      dayLight.visible = lamp.visible = on;
      if (!on) return;
      lamp.intensity = 9 * (0.92 + 0.08 * Math.sin(t * 9.3));
      const s = clamp01((t - t0) / (t1 - t0)) * BRAWL_SECONDS, a = act(s), part = partOf(s);
      const af = Math.min(a, DOOR + 0.02); // frozen once the door bursts open
      if (part < 3) {
        fighterA(HAT); // where the head is when the hat flies off
        hatStart = head(A, A.body.rotation.x);
        hatStart.y -= 0.05;
        fighterA(af);
        fighterB(af);
        hammer.visible = broom.visible = false;
      } else {
        bill(s, t);
        hammer.visible = broom.visible = true;
      }
      T1.root.visible = T2.root.visible = part < 3;
      throwers(af);
      objects(a);
      guardsDo(a, t);
      keeper(a, t);
      drinkersDo(af);
      // steam over the innkeeper's head at the bill
      const sarr = steam.geometry.attributes.position.array;
      for (let i = 0; i < N_STEAM; i++) {
        if (part < 3 || !K) { sarr[i * 3 + 1] = -1e4; continue; }
        const f = (t * 0.9 + i / N_STEAM) % 1, side = i % 2 ? 1 : -1;
        sarr.set([K.root.position.x + side * (0.12 + 0.25 * f), F + 1.95 + 0.7 * f, K.root.position.z + (rand01(seed, 'steam', i) - 0.5) * 0.3], i * 3);
      }
      steam.geometry.attributes.position.needsUpdate = true;
      // the tags of this part, over the heads
      labels.splice(0, labels.length, ...PARTS[part]);
      for (const l of labels) {
        const P = l.P;
        l.pos.copy(toWorld(head(P, P.body.rotation.x).add(V(0, 0.32, 0)))); // over the head, wherever it leans
      }
    },
  };
}
