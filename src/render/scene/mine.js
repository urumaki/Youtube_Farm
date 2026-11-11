// Inside the Mine (owner 2026-11-10): a gallery cut in the rock under the Mine's hill, held up by timber sets, lit by
// lanterns hung from the cap beams. The named miner swings a pick at a seam of gold in the wall nearest the camera; behind
// him another miner pushes a cart of ore along the rails toward the camera, others work the walls further in, and at the
// far end the bucket of the windlass (the one in the Mine's yard) goes up the shaft in a patch of daylight. The other named
// miners wear their names. Like the Dungeon (dungeon.js): the room stands under the building and is only seen during the
// shot (own camera, a hard cut in and out). A pure function of t.
import * as THREE from 'three';
import { Builder, boxGeo, cylGeo } from './kit.js';
import { toolGeo } from './work.js';
import { person, stride } from './stories/common.js';
import { JOBS } from '../../sim/tiers.js';
import { rand01 } from '../../sim/prng.js';

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// Room frame: +z toward the camera, the shaft at the back (-z). The gallery is HW either side of x 0, from Z0 to Z1
const HW = 1.9, CEIL = 2.7, Z0 = -11, Z1 = 6.5, SET = 2.3, RAIL = -0.85;
export const FOV = 60;
const PERIOD = 1.5, HIT = 0.7; // a swing of the pick, and when in it the point strikes
// where the miners stand: the named one first (the right-hand wall, near the camera), then two more at the walls
const SPOTS = [{ x: 0.95, z: 1.2, side: 1 }, { x: 0.95, z: -2.6, side: 1 }, { x: 1.0, z: -6.2, side: 1 }];

/** The arms' angle through one swing: a slow wind-up, a fast blow, a short rest on the rock. */
function swing(p) {
  if (p < 0.5) return THREE.MathUtils.lerp(-0.95, -2.75, ease(p / 0.5));
  if (p < HIT) return THREE.MathUtils.lerp(-2.75, -0.95, ((p - 0.5) / (HIT - 0.5)) ** 2);
  return -0.95;
}

export function buildMine({ anchor, away, M, seed, id, heightAt, mates = [], t0 = 0, t1 = t0 + 3 }) {
  const room = new THREE.Group();
  room.rotation.y = Math.atan2(Math.cos(away), Math.sin(away)); // local +z along `away`, toward the camera
  room.position.copy(anchor);
  room.position.y = heightAt(anchor.x, anchor.z) + 0.12;
  room.updateMatrixWorld(true);
  const toWorld = (x, y, z) => room.localToWorld(new THREE.Vector3(x, y, z));
  const r = (k) => rand01(seed, 'mine', id, k);

  const mats = { ...M,
    daylight: new THREE.MeshBasicMaterial({ color: '#cfdcea' }),
    seam: new THREE.MeshStandardMaterial({ color: '#f2c24a', roughness: 0.25, metalness: 0.9, emissive: '#5a3c00', emissiveIntensity: 0.6, flatShading: true }),
    glass: new THREE.MeshBasicMaterial({ color: '#ffd27a' }),
  };
  const b = new Builder();
  const len = Z1 - Z0, mid = (Z0 + Z1) / 2;
  // the gallery: a trodden floor, rock walls and roof, rough lumps along them so nothing reads as a flat wall
  b.add('dirt', boxGeo(2 * HW + 1.2, 0.1, len, 3), 0, -0.05, mid);
  b.add('crag', boxGeo(2 * HW + 1.2, 0.5, len), 0, CEIL + 0.25, mid);
  for (const s of [-1, 1]) b.add('crag', boxGeo(0.6, CEIL, len), s * (HW + 0.3), CEIL / 2, mid);
  for (const z of [Z1 + 0.3, Z0 - 0.3]) b.add('crag', boxGeo(2 * HW + 1.2, CEIL + 1, 0.6), 0, CEIL / 2, z);
  let n = 0;
  for (let z = Z0 + 0.4; z < Z1; z += 0.62) {
    for (const s of [-1, 1]) {
      for (const y of [0.35, 1.25, 2.15]) {
        const k = n++;
        b.add('crag', new THREE.DodecahedronGeometry(0.42 + 0.22 * r(`s${k}`), 0), s * (HW + 0.12 + 0.12 * r(`x${k}`)), y + 0.3 * (r(`y${k}`) - 0.5), z + 0.3 * (r(`z${k}`) - 0.5), r(`a${k}`) * 6);
      }
    }
    b.add('crag', new THREE.DodecahedronGeometry(0.4 + 0.2 * r(`c${n}`), 0), (r(`cx${n}`) - 0.5) * 2 * HW, CEIL + 0.12, z, r(`ca${n++}`) * 6);
  }
  // timber sets: two posts and a cap beam, a lantern hung from every second one
  const lamps = [];
  for (let z = Z0 + 1.2, k = 0; z < Z1 - 0.5; z += SET, k++) {
    for (const s of [-1, 1]) b.add('woodDark', boxGeo(0.2, CEIL - 0.1, 0.2), s * (HW - 0.22), (CEIL - 0.1) / 2, z, 0, 0, s * 0.03);
    b.add('woodDark', boxGeo(2 * HW - 0.1, 0.22, 0.24), 0, CEIL - 0.2, z);
    for (const s of [-1, 1]) b.add('wood', boxGeo(0.5, 0.1, 0.12), s * (HW - 0.48), CEIL - 0.48, z, 0, 0, -s * 0.75); // a brace
    if (k % 2 === 1) {
      const x = -0.2;
      b.add('iron', cylGeo(0.008, 0.008, 0.16, 4), x, CEIL - 0.39, z);
      b.add('iron', boxGeo(0.13, 0.03, 0.13), x, CEIL - 0.48, z);
      b.add('glass', boxGeo(0.09, 0.13, 0.09), x, CEIL - 0.56, z);
      b.add('iron', boxGeo(0.13, 0.03, 0.13), x, CEIL - 0.64, z);
      lamps.push([x, CEIL - 0.6, z]);
    }
  }
  // the rails and their sleepers, along the left of the gallery
  for (const dx of [-0.28, 0.28]) b.add('iron', boxGeo(0.05, 0.06, len - 1.5), RAIL + dx, 0.07, mid);
  for (let z = Z0 + 0.8; z < Z1 - 0.8; z += 0.7) b.add('woodDark', boxGeo(0.9, 0.05, 0.16), RAIL, 0.025, z);
  // the seam the named miner works: gold in the rock at chest height, and a little more of it down the gallery
  for (const [sp, count] of [[SPOTS[0], 9], [SPOTS[1], 4], [SPOTS[2], 4]]) {
    for (let k = 0; k < count; k++) {
      b.add('seam', new THREE.DodecahedronGeometry(0.07 + 0.06 * r(`g${sp.z}${k}`), 0), sp.side * (HW - 0.28), 0.7 + 1.1 * r(`gy${sp.z}${k}`), sp.z + 1.3 * (r(`gz${sp.z}${k}`) - 0.5), k);
    }
  }
  for (const sp of SPOTS) {
    b.add('crag', new THREE.DodecahedronGeometry(0.52, 0), sp.side * (sp.x + 0.5), 0.75, sp.z + 1.05, sp.z);
    for (let k = 0; k < 4; k++) b.add('seam', new THREE.DodecahedronGeometry(0.08 + 0.04 * r(`n${sp.z}${k}`), 0), sp.side * (sp.x + 0.2 + 0.35 * r(`nx${sp.z}${k}`)), 1.05 + 0.2 * r(`ny${sp.z}${k}`), sp.z + 0.75 + 0.3 * r(`nz${sp.z}${k}`), k);
  }
  // broken rock under each seam, a pile of props, a barrel
  for (const sp of SPOTS) for (let k = 0; k < 5; k++) b.add('crag', new THREE.DodecahedronGeometry(0.1 + 0.07 * r(`l${sp.z}${k}`), 0), sp.side * (HW - 0.5 - 0.3 * r(`lx${sp.z}${k}`)), 0.08, sp.z + 1.2 * (r(`lz${sp.z}${k}`) - 0.5));
  for (let k = 0; k < 4; k++) b.add('wood', cylGeo(0.09, 0.09, 1.9, 8), 1.2 + 0.1 * (k % 2), 0.1 + 0.17 * Math.floor(k / 2), 4.3 + 0.2 * (k % 2), 0.15, Math.PI / 2);
  b.add('wood', cylGeo(0.3, 0.27, 0.75, 12), -1.35, 0.375, 4.6);
  // the shaft at the far end: daylight from above, and the bucket's rope
  b.add('daylight', boxGeo(1.5, 0.05, 1.5), 0.2, CEIL + 0.02, Z0 + 1.1);
  room.add(b.build(mats));

  const add = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
  const bucket = new THREE.Group();
  add(cylGeo(0.26, 0.2, 0.42, 10), M.wood, bucket);
  add(cylGeo(0.012, 0.012, 3, 4).translate(0, 1.7, 0), M.gear, bucket);
  for (const [x, z] of [[-0.08, 0.05], [0.09, -0.04], [0, 0.1]]) add(new THREE.DodecahedronGeometry(0.1, 0).translate(x, 0.24, z), mats.crag, bucket);
  bucket.position.set(0.2, 0, Z0 + 1.1);
  room.add(bucket);
  // the cart of ore on the rails, and the miner who pushes it toward the camera
  const cart = new THREE.Group();
  add(boxGeo(0.72, 0.5, 1.05).translate(0, 0.5, 0), M.wood, cart);
  add(boxGeo(0.78, 0.06, 1.11).translate(0, 0.76, 0), M.woodDark, cart);
  for (const x of [-0.3, 0.3]) for (const z of [-0.33, 0.33]) add(cylGeo(0.15, 0.15, 0.06, 10).rotateZ(Math.PI / 2).translate(x, 0.19, z), M.iron, cart);
  for (let k = 0; k < 9; k++) add(new THREE.DodecahedronGeometry(0.12 + 0.05 * r(`o${k}`), 0).translate(0.45 * (r(`ox${k}`) - 0.5), 0.82 + 0.1 * r(`oy${k}`), 0.8 * (r(`oz${k}`) - 0.5)), k % 3 ? mats.crag : mats.seam, cart);
  room.add(cart);

  // the miners: the named one at the first seam, the others named when the kingdom has more named miners
  const color = JOBS.miner.color;
  const crew = SPOTS.map((sp, i) => {
    const P = person(M, color);
    P.root.position.set(sp.x, 0, sp.z);
    P.root.rotation.y = sp.side * 0.22; // at a boulder of the seam that stands out of the wall, his face toward the camera
    P.r.hand.add(toolGeo('pick', M));
    room.add(P.root);
    return { P, sp, off: i ? r(`w${i}`) * PERIOD : 0, name: i ? mates[i]?.name ?? null : null, head: new THREE.Vector3() };
  });
  const pusher = { P: person(M, color), name: mates[0]?.name ?? null, head: new THREE.Vector3() };
  pusher.P.root.rotation.y = 0; // walking toward the camera
  room.add(pusher.P.root);
  const hero = crew[0];

  // the lanterns' light (the nearest three: a light each costs render time), and a little daylight at the shaft
  const lights = lamps.sort((a, c) => Math.abs(a[2] - 0.5) - Math.abs(c[2] - 0.5)).slice(0, 3).map((p) => ({ l: new THREE.PointLight('#ffb866', 0, 9, 1.3), p, i: 6.5 }));
  lights.push({ l: new THREE.PointLight('#cfdcea', 0, 8, 1.4), p: [0.2, CEIL - 0.4, Z0 + 1.2], i: 5 });
  for (const { l, p } of lights) { l.position.set(...p); l.visible = false; room.add(l); }

  const CART0 = -8.2, CART_PACE = 1.15;
  const cartZ = (t) => Math.min(-0.9, CART0 + CART_PACE * Math.max(0, t - t0));
  // from the gallery's middle, a few steps past the named miner, looking at him and down the gallery behind him
  const cam = (u) => {
    const k = ease(u);
    return { pos: toWorld(THREE.MathUtils.lerp(-0.1, 0.2, k), THREE.MathUtils.lerp(1.65, 1.55, k), hero.sp.z + THREE.MathUtils.lerp(4.4, 3.7, k)), look: toWorld(0.62, 1.1, hero.sp.z - 0.6), fov: FOV };
  };
  const labelPos = new THREE.Vector3(), tmp = new THREE.Vector3();
  const labels = [];
  const update = (t, inside) => {
    room.visible = !!inside;
    for (const m of crew) {
      const p = (((t - t0 + m.off) / PERIOD) % 1 + 1) % 1, a = swing(p), blow = (a + 2.75) / 1.8; // 0 wound up, 1 on the rock
      m.P.r.g.rotation.set(a, 0, -0.18);
      m.P.l.g.rotation.set(a + 0.12, 0, 0.5);
      m.P.body.rotation.x = 0.05 + 0.22 * blow;
      m.P.body.localToWorld(m.head.set(0, 1.04, 0));
    }
    // the cart and its pusher, leaning into it
    const z = cartZ(t), moving = z < -0.9;
    cart.position.set(RAIL, 0, z);
    const Q = pusher.P;
    Q.root.position.set(RAIL, 0, z - 0.95);
    stride(Q, (z - CART0) * 3.6, moving ? 0.45 : 0, { arms: false });
    Q.r.g.rotation.set(-1.25, 0, -0.1); Q.l.g.rotation.set(-1.25, 0, 0.1);
    Q.body.rotation.x = moving ? 0.28 : 0.1;
    Q.body.localToWorld(pusher.head.set(0, 1.04, 0));
    // the bucket of ore going up the shaft, and coming down empty-handed again
    bucket.position.y = 0.25 + 1.6 * ease((((t - t0) / 5) % 1));
    labelPos.copy(hero.head).add(tmp.set(0, 0.75, 0));
    labels.length = 0;
    for (const m of [pusher, ...crew.slice(1)]) if (m.name) labels.push({ pos: m.head.clone().add(new THREE.Vector3(0, 0.55, 0)), title: m.name, sub: JOBS.miner.label });
    for (const { l, i } of lights) {
      l.visible = !!inside;
      l.intensity = inside ? i * (1 + 0.06 * Math.sin(t * 9 + i)) : 0;
    }
  };
  update(t0, false);
  room.visible = false;
  return {
    group: new THREE.Group(), // everyone is part of the room
    room,
    cam,
    floorAt: () => room.position.y,
    focus: toWorld(hero.sp.x, 1.2, hero.sp.z),
    labelPos,
    liveLabel: true,
    labels,
    sound: 'chisel',
    // the named miner's blows, for the sound
    strikeTimes: (a, c) => { const out = []; for (let ts = t0 + HIT * PERIOD; ts < c; ts += PERIOD) if (ts >= a) out.push(ts); return out; },
    update,
  };
}
