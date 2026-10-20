// Guards in training, so a guard is not always shown the same way: two guards sparring with sword and
// shield in the castle courtyard, or one guard cutting at a straw dummy in their croft. Same interfaces
// as the story scenes ({ group, labels, labelPos, cam, update }) and the work scenes (strikeTimes, sound).
import * as THREE from 'three';
import { CASTLE } from '../../sim/world.js';
import { JOBS } from '../../sim/tiers.js';
import { rand01 } from '../../sim/prng.js';
import { ROYAL } from './textures.js';
import { cylGeo, boxGeo } from './kit.js';
import { particles } from './work.js';
import { person, stride, castTag, ease, clamp01 } from './stories/common.js';

const lerp = THREE.MathUtils.lerp;

/** A sword held point first: the blade continues the line of the arm (hand frame, arm along -y). */
export function sword(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); };
  add(cylGeo(0.022, 0.022, 0.18, 6), M.woodDark); // grip
  add(new THREE.SphereGeometry(0.035, 8, 6).translate(0, 0.1, 0), M.gold); // pommel
  add(boxGeo(0.24, 0.04, 0.05).translate(0, -0.1, 0), M.gold); // cross guard
  add(boxGeo(0.06, 0.86, 0.016).translate(0, -0.55, 0), M.iron);
  add(new THREE.ConeGeometry(0.03, 0.1, 4).rotateX(Math.PI).translate(0, -1.03, 0), M.iron); // point
  return g;
}

/** A round wooden shield with an iron rim and boss, its face along the arm (held forward). */
function shield(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); };
  add(cylGeo(0.3, 0.3, 0.05, 16).translate(0, -0.06, 0), M.wood);
  add(new THREE.TorusGeometry(0.3, 0.02, 4, 18).rotateX(Math.PI / 2).translate(0, -0.06, 0), M.iron);
  add(new THREE.SphereGeometry(0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI).translate(0, -0.085, 0), M.iron);
  return g;
}

function fighter(M, color, { withShield = true } = {}) {
  const P = person(M, color);
  P.r.hand.add(sword(M));
  if (withShield) P.l.hand.add(shield(M));
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.18, 0), M.iron);
  helm.castShadow = true;
  P.body.add(helm);
  return P;
}

// one exchange: the attacker winds up, cuts down at the hit, and recovers; the defender raises sword and
// shield to meet it
const PERIOD = 1.05, HIT = 0.55;
function attackArm(u) {
  if (u < 0.4) return lerp(-1.1, -2.9, ease(u / 0.4));
  if (u < HIT) return lerp(-2.9, -1.8, ((u - 0.4) / (HIT - 0.4)) ** 2);
  return lerp(-1.8, -1.1, ease((u - HIT) / (1 - HIT)));
}

/** Two guards sparring in the castle courtyard, circling each other; the camera circles with them. */
export function buildSparring({ M, seed, hero, lang, tag = true }) {
  const G = CASTLE.ground + 0.15;
  const center = new THREE.Vector3(14, G, 4); // between the well and the barracks, off the courtyard path
  const group = new THREE.Group();
  group.visible = false;
  const pair = new THREE.Group();
  pair.position.copy(center);
  group.add(pair);
  const A = fighter(M, hero ? JOBS[hero.job]?.color || ROYAL.blue : ROYAL.blue);
  const B = fighter(M, ROYAL.blue);
  pair.add(A.root, B.root);
  const sparks = particles(28, '#ffd27a', 0.05, true);
  pair.add(sparks);
  const labels = hero && tag ? [castTag(hero, lang, lang === 'it' ? 'Allenamento' : 'Training')] : [];
  const labelPos = new THREE.Vector3();
  const lead = 0.15 * PERIOD; // the first clash comes early in the shot
  const strikeTimes = (t0, t1) => {
    const out = [];
    for (let k = 0; ; k++) {
      const t = t0 + (k + HIT) * PERIOD - lead;
      if (t > t1) break;
      if (t >= t0) out.push(t);
    }
    return out;
  };
  // the pair turns slowly as they circle; the camera stays side on to them, drifting round
  const spin = (u) => 0.6 + 0.8 * u;
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    labelPos,
    banner: lang === 'it' ? 'Allenamento nel cortile' : 'Training in the yard',
    focus: center.clone().setY(G + 1.2),
    work: { strikeTimes, sound: 'clang' },
    cam(u) {
      const a = spin(u) + 0.45 - 0.7 * u, r = 5.6 - 1.0 * ease(u);
      return { pos: center.clone().add(new THREE.Vector3(Math.sin(a) * r, 1.5, Math.cos(a) * r)), look: center.clone().add(new THREE.Vector3(0, 1.2, 0)) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      pair.rotation.y = spin(clamp01((t - t0) / (t1 - t0)));
      const c = (t - t0 + lead) / PERIOD, k = Math.floor(c), u = c - k;
      const attacker = k % 2 === 0 ? A : B;
      [A, B].forEach((P, i) => {
        const side = i === 0 ? -1 : 1; // A on -x facing +x, B on +x facing -x
        const attacking = P === attacker;
        const lunge = attacking ? 0.34 * Math.sin(Math.PI * clamp01((u - 0.3) / 0.55)) : -0.14 * Math.sin(Math.PI * clamp01((u - 0.35) / 0.5));
        P.root.position.set(side * (0.98 - lunge), 0, 0);
        P.root.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        stride(P, (t - t0) * 5.5 + i * 1.3, 0.16, { arms: false }); // light footwork
        if (attacking) {
          P.r.g.rotation.set(attackArm(u), 0, -0.12);
          P.l.g.rotation.set(-1.15, 0, 0.35);
          P.body.rotation.x = 0.16 * Math.sin(Math.PI * clamp01((u - 0.35) / 0.45));
        } else {
          const q = ease(clamp01(1 - Math.abs(u - HIT) / 0.38));
          P.r.g.rotation.set(lerp(-1.1, -2.3, q), 0, lerp(0, 0.55, q));
          P.l.g.rotation.set(lerp(-1.15, -1.75, q), 0, lerp(0.35, 0.15, q));
          P.body.rotation.x = -0.1 * q;
        }
      });
      // sparks where the blades meet, for a quarter second after each clash
      const arr = sparks.geometry.attributes.position.array;
      const age = (u - HIT) * PERIOD;
      for (let i = 0; i < 28; i++) {
        const j = i * 3;
        if (age < 0 || age > 0.28) { arr[j] = arr[j + 1] = arr[j + 2] = 1e4; continue; }
        const r = (q) => rand01(seed, 'spar', k, i, q);
        const ang = r(0) * Math.PI * 2, sp = 1.5 + 2.5 * r(1);
        arr[j] = (k % 2 ? -0.15 : 0.15) + Math.cos(ang) * sp * age;
        arr[j + 1] = 1.75 + (1 + 2 * r(2)) * age - 4.9 * age * age;
        arr[j + 2] = Math.sin(ang) * sp * age;
      }
      sparks.geometry.attributes.position.needsUpdate = true;
      pair.updateMatrixWorld(true);
      A.root.getWorldPosition(tmp);
      labelPos.copy(tmp).setY(G + 2.45);
      if (labels[0]) labels[0].pos.copy(labelPos);
    },
  };
}

/** A guard cutting at a straw dummy in their croft; straw flies and the dummy rocks at each cut. */
export function buildDummyDrill({ job, anchor, face, M, seed, id }) {
  const group = new THREE.Group();
  group.position.copy(anchor);
  group.rotation.y = face;
  const P = fighter(M, JOBS[job]?.color || ROYAL.blue, { withShield: false });
  group.add(P.root);
  const add = (parent, geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  // the dummy: a post in the ground with a cross bar for arms, a stuffed sack for a body, a bucket helmet
  const DZ = 1.4, DX = 0.3;
  const dummy = new THREE.Group();
  dummy.position.set(DX, 0, DZ);
  group.add(dummy);
  add(dummy, cylGeo(0.05, 0.06, 1.75, 6).translate(0, 0.87, 0), M.woodDark);
  add(dummy, cylGeo(0.035, 0.035, 0.95, 6).rotateZ(Math.PI / 2).translate(0, 1.42, 0), M.woodDark);
  add(dummy, cylGeo(0.2, 0.24, 0.62, 10).translate(0, 1.12, 0), M.hay);
  add(dummy, new THREE.SphereGeometry(0.15, 10, 8).translate(0, 1.66, 0), M.hay);
  add(dummy, cylGeo(0.13, 0.16, 0.16, 10).translate(0, 1.8, 0), M.iron);
  add(group, cylGeo(0.3, 0.34, 0.06, 10).translate(DX, 0.03, DZ), M.soil);
  // a rack with spare practice swords by the dummy
  for (const x of [-1.2, -0.6]) add(group, boxGeo(0.07, 0.9, 0.07).translate(x, 0.45, -0.6), M.woodDark);
  add(group, boxGeo(0.75, 0.06, 0.07).translate(-0.9, 0.82, -0.6), M.woodDark);
  for (const x of [-1.08, -0.9, -0.72]) add(group, boxGeo(0.05, 0.8, 0.015).translate(x, 0.45, -0.56), M.wood);
  const straw = particles(30, '#d9c27a', 0.07, false);
  group.add(straw);
  const period = 1.25, hit = 0.68;
  const offset = rand01(seed, 'drill', id) * period;
  const cycle = (t) => { const c = (t + offset) / period, k = Math.floor(c); return { c, k, u: c - k }; };
  const impact = new THREE.Vector3(DX, 1.3, DZ - 0.22);
  group.updateMatrixWorld(true);
  return {
    group,
    focus: group.localToWorld(new THREE.Vector3(DX * 0.5, 1.1, DZ * 0.45)), // the guard and the dummy both in frame
    labelPos: anchor.clone().add(new THREE.Vector3(0, 2.45, 0)),
    face,
    sound: 'straw',
    strikeTimes(t0, t1) {
      const out = [];
      for (let k = Math.floor((t0 + offset) / period) - 1; ; k++) {
        const t = (k + hit) * period - offset;
        if (t > t1) break;
        if (t >= t0) out.push(t);
      }
      return out;
    },
    update(t) {
      const { k, u } = cycle(t);
      // a diagonal cut: wind up high on the right, cut across the dummy, follow through low on the left
      let x, z;
      if (u < 0.55) { const q = ease(u / 0.55); x = lerp(-1.0, -2.8, q); z = lerp(0.25, -0.35, q); }
      else if (u < 0.72) { const q = ((u - 0.55) / 0.17) ** 2; x = lerp(-2.8, -0.7, q); z = lerp(-0.35, 0.25, q); }
      else { const q = ease((u - 0.72) / 0.28); x = lerp(-0.7, -1.0, q); z = 0.25; }
      P.r.g.rotation.set(x, 0, z);
      P.l.g.rotation.set(-0.45, 0, 0.25);
      P.body.rotation.x = 0.15 * Math.sin(Math.PI * clamp01((u - 0.5) / 0.4));
      P.body.rotation.y = lerp(0.3, -0.3, clamp01((u - 0.55) / 0.2));
      P.legs[0].rotation.x = 0.3; P.legs[1].rotation.x = -0.25; // fighting stance, one foot forward
      // the dummy rocks back after each cut
      const age = (u - hit) * period + (u < hit ? period : 0);
      dummy.rotation.x = 0.22 * Math.exp(-age * 3.5) * Math.sin(age * 13);
      const arr = straw.geometry.attributes.position.array;
      const sAge = (u - hit) * period;
      for (let i = 0; i < 30; i++) {
        const j = i * 3;
        if (sAge < 0 || sAge > 0.9) { arr[j] = arr[j + 1] = arr[j + 2] = 1e4; continue; }
        const r = (q) => rand01(seed, 'straw', id, k, i, q);
        const ang = -Math.PI * r(0), sp = 0.8 + 1.8 * r(1);
        arr[j] = impact.x + Math.cos(ang) * sp * sAge;
        arr[j + 1] = Math.max(0.03, impact.y + (0.8 + 1.6 * r(2)) * sAge - 4.9 * sAge * sAge);
        arr[j + 2] = impact.z + Math.sin(ang) * sp * 0.6 * sAge - 0.4 * sAge;
      }
      straw.geometry.attributes.position.needsUpdate = true;
    },
  };
}
