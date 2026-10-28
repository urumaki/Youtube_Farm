// A new bell for the church (owner 2026-10-27), three days. 'pour': in front of the Bell Foundry the bellfounder knocks out
// the furnace's tap and the glowing bronze runs down a clay channel into the mould, the helpers shielding their faces.
// 'cool': the mould broken open, the new bell hangs in a timber frame; the founder strikes it three times and the helpers
// cheer. 'raise': at the foot of the bell tower (the Cathedral's south-west tower, else the Chapel's) named villagers haul
// on the rope, walking backward, and the bell rises up the tower's face to the belfry.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { toolGeo } from '../work.js';
import { person, stride, castTag, flameMaterial, flicker, ease, clamp01 } from './common.js';

const STRIKES = [0.3, 0.55, 0.8]; // the founder's mallet on the bell ('cool')

/** The bell, its lip at y = 0 (hang it by its crown at y = 1.9). */
function newBell(bronze, iron) {
  const g = new THREE.Group();
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; g.add(o); return o; };
  add(cylGeo(0.62, 1.05, 1.35, 22).translate(0, 0.72, 0), bronze);
  add(new THREE.SphereGeometry(0.62, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.38, 0), bronze);
  add(new THREE.TorusGeometry(1.03, 0.07, 6, 24).rotateX(Math.PI / 2).translate(0, 0.08, 0), bronze); // the lip
  add(boxGeo(0.12, 0.36, 0.36).translate(0, 2.08, 0), iron); // the crown's loop
  return g;
}

export function buildBell({ story, M, buildings, yFn }) {
  const step = story.step || 'pour';
  const tower = step === 'raise' ? (buildings.items.cathedral ? 'cathedral' : 'chapel') : 'bell_foundry';
  const item = buildings.items[tower];
  if (!item) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(item.group.matrix);
  group.visible = false;
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix);
  // the ground under a spot of the lot's frame, in the lot's frame
  const gy = (x, z) => { const p = toWorld(x, 0, z); return Math.max(0.05, yFn(p.x, p.z) - item.base); };
  const bronze = new THREE.MeshStandardMaterial({ color: '#b98a43', metalness: 0.65, roughness: 0.32 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  const bell = newBell(bronze, M.iron);
  group.add(bell);
  const [founderC, ...helpersC] = story.cast;
  const labels = [];
  const mk = (c, i, x, z, ry) => {
    const P = person(M, JOBS[c?.job]?.color || ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d'][i % 6]);
    P.root.position.set(x, gy(x, z), z);
    P.root.rotation.y = ry;
    group.add(P.root);
    if (c) labels.push({ ...castTag(c), P });
    return P;
  };
  const founder = mk(founderC, 0, 0, 0, 0);
  let helpers = [], glow = null, light = null, metal = null, flames = [], rope = null, beamEnd = null, B = null, haul = null;
  const MOULD = new THREE.Vector3(1.0, 0, 6.2), FURNACE = new THREE.Vector3(-2.4, 0, 6.0);
  const clay = M.clay || new THREE.MeshStandardMaterial({ color: '#9c6b4a', roughness: 0.95 });
  if (step === 'pour' || step === 'cool') {
    MOULD.y = gy(MOULD.x, MOULD.z); FURNACE.y = gy(FURNACE.x, FURNACE.z);
    if (step === 'pour') {
      // the furnace, its glowing mouth, the clay channel sloping down to the buried mould
      add(boxGeo(1.6, 1.8, 1.6), M.stoneDark, FURNACE.x, FURNACE.y + 0.9, FURNACE.z);
      add(cylGeo(0.35, 0.5, 1.6, 10), M.stoneDark, FURNACE.x, FURNACE.y + 2.6, FURNACE.z);
      glow = add(boxGeo(0.5, 0.4, 0.06), new THREE.MeshBasicMaterial({ color: '#ffb347' }), FURNACE.x + 0.81, FURNACE.y + 0.55, FURNACE.z);
      glow.rotation.y = Math.PI / 2;
      for (let k = 0; k < 3; k++) {
        const f = add(new THREE.ConeGeometry(0.16 - k * 0.03, 0.5, 8).translate(0, 0.25, 0), flameMaterial(['#ff7a1a', '#ffb347', '#ffe08a'][k]), FURNACE.x, FURNACE.y + 3.4, FURNACE.z);
        f.castShadow = false;
        flames.push(f);
      }
      const len = MOULD.x - FURNACE.x - 1.3, mid = (MOULD.x + FURNACE.x + 0.5) / 2;
      const ch = add(boxGeo(len, 0.18, 0.42), clay, mid, FURNACE.y + 0.32, MOULD.z - 0.1);
      ch.rotation.z = -0.12;
      add(cylGeo(1.15, 1.4, 0.55, 18), clay, MOULD.x, MOULD.y + 0.27, MOULD.z); // the top of the mould, its pouring cup
      metal = add(boxGeo(1, 0.08, 0.26), new THREE.MeshBasicMaterial({ color: '#ffa63a' }), mid, FURNACE.y + 0.43, MOULD.z - 0.1);
      metal.rotation.z = -0.12;
      const cup = add(cylGeo(0.32, 0.32, 0.06, 14), new THREE.MeshBasicMaterial({ color: '#ffa63a' }), MOULD.x, MOULD.y + 0.56, MOULD.z);
      metal.userData.cup = cup;
      light = new THREE.PointLight('#ff8a3d', 0, 14, 2);
      light.position.set(MOULD.x - 1.4, MOULD.y + 1.2, MOULD.z + 0.6);
      group.add(light);
      bell.visible = false;
      founder.root.position.set(FURNACE.x + 1.6, FURNACE.y, FURNACE.z + 0.9);
      founder.root.rotation.y = -2.2;
      founder.r.hand.add(Object.assign(new THREE.Mesh(cylGeo(0.03, 0.03, 2.4, 6).translate(0, 1.0, 0.1), M.iron), { castShadow: true }));
    } else {
      // the frame on two posts, the new bell hanging in it, the broken mould round its feet
      for (const x of [-1.5, 1.5]) add(boxGeo(0.25, 3.8, 0.25), M.woodDark, MOULD.x + x, MOULD.y + 1.9, MOULD.z);
      add(boxGeo(3.4, 0.28, 0.3), M.woodDark, MOULD.x, MOULD.y + 3.8, MOULD.z);
      bell.position.set(MOULD.x, MOULD.y + 1.6, MOULD.z);
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9, r = 1.6 + (k % 3) * 0.3;
        const shard = add(boxGeo(0.5 + (k % 2) * 0.3, 0.25, 0.4), clay, MOULD.x + Math.cos(a) * r, MOULD.y + 0.12, MOULD.z + Math.sin(a) * r * 0.7 - 0.6);
        shard.rotation.set(0.3 * (k % 2), a, 0.2);
      }
      founder.root.position.set(MOULD.x + 1.2, MOULD.y, MOULD.z + 1.1);
      founder.root.rotation.y = -2.4;
      founder.r.hand.add(toolGeo('mallet', M));
    }
    // the helpers watch from the near side
    // the helpers watch from round the far side, facing the camera
    helpers = helpersC.slice(0, 3).map((c, i) => {
      const a = [-0.2, 0.6, 1.4][i], x = MOULD.x + Math.sin(a) * 2.6, z = MOULD.z - Math.cos(a) * 2.2;
      return mk(c, i + 1, x, z, Math.atan2(MOULD.x - x, MOULD.z - z));
    });
  } else {
    // the tower's face, where the bell goes up, and the beam out of the belfry with its pulley
    B = tower === 'cathedral' ? { x: 5.5, face: 21.3, top: 26.2, beam: 30 } : { x: 0, face: 12.1, top: 9.4, beam: 12.6 };
    add(boxGeo(0.3, 0.3, 2.4), M.woodDark, B.x, B.beam, B.face + 1.1);
    add(cylGeo(0.22, 0.22, 0.2, 12).rotateZ(Math.PI / 2), M.iron, B.x, B.beam - 0.25, B.face + 2.1);
    beamEnd = new THREE.Vector3(B.x, B.beam - 0.25, B.face + 2.1);
    // the rope: pulley to the bell, and pulley down to the haulers
    // the rope in two runs, pulley to the bell and pulley down to the haulers: thin cylinders stretched between the points
    rope = [0, 1].map(() => { const m = new THREE.Mesh(cylGeo(0.05, 0.05, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#b89a68', roughness: 0.9 })); group.add(m); return m; });
    const z0 = B.face + 6;
    haul = { z0, ground: gy(B.x, z0 + 4) };
    helpers = helpersC.slice(0, 5).map((c, i) => mk(c, i + 1, B.x + (i % 2 ? 0.35 : -0.35), z0 + i * 1.1, Math.PI));
    founder.root.position.set(B.x + 2.6, gy(B.x + 2.6, B.face + 3.5), B.face + 3.5);
    founder.root.rotation.y = Math.PI + 0.9;
  }
  const banner = step === 'cool' ? 'The new bell rings!'
    : step === 'raise' ? 'Up goes the bell!' : 'Casting the bell!';
  const focus = step === 'raise' ? toWorld(B.x, B.top * 0.5, B.face + 2) : toWorld(MOULD.x - 0.6, MOULD.y + 1.2, MOULD.z);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const stretch = (m, a, b) => {
    const d = tmp2.clone().copy(b).sub(a);
    m.position.copy(a);
    m.scale.set(1, d.length(), 1);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
  };
  return {
    group,
    labels,
    banner,
    focus,
    cam(u) {
      if (step === 'raise') {
        // low behind the haulers, looking up the tower as the bell climbs
        // back behind the haulers, the whole rope in view: the men low in the frame, the bell climbing up the tower
        const k = ease(u);
        return { pos: toWorld(B.x + 6 - 2 * k, 5.5 + haul.ground, B.face + 30), look: toWorld(B.x, 7 + B.top * 0.35 * k, B.face + 3) };
      }
      const a = -0.35 + 0.3 * u, c = step === 'pour' ? MOULD.x - 1.6 : MOULD.x;
      return { pos: toWorld(c + Math.sin(a) * 11, MOULD.y + 4.2, MOULD.z + Math.cos(a) * 11), look: toWorld(c, MOULD.y + (step === 'pour' ? 0.8 : 1.6), MOULD.z) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (light) light.visible = group.visible;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      if (step === 'pour') {
        // the tap knocked out at 0.15, the bronze runs down the channel until 0.6, the cup full at 0.7
        const run = ease(clamp01((u - 0.15) / 0.45)), full = clamp01((u - 0.5) / 0.2);
        const len = MOULD.x - FURNACE.x - 1.3;
        metal.visible = run > 0.01;
        metal.scale.x = Math.max(0.01, len * run);
        metal.position.x = FURNACE.x + 0.8 + (len * run) / 2;
        metal.position.y = FURNACE.y + 0.43 - Math.sin(0.12) * (len * run) / 2;
        metal.userData.cup.visible = full > 0;
        metal.userData.cup.scale.setScalar(0.3 + 0.7 * full);
        light.intensity = 30 * (0.3 + run) * (1 + 0.15 * Math.sin(t * 19));
        glow.material.color.setHSL(0.08, 1, 0.55 + 0.1 * Math.sin(t * 13));
        for (const [k, f] of flames.entries()) flicker(f, t, k * 3);
        const knock = u < 0.18 ? Math.sin(clamp01(u / 0.18) * Math.PI) : 0;
        founder.r.g.rotation.set(-1.3 + 0.5 * knock, 0, -0.2); founder.l.g.rotation.set(-1.2 + 0.5 * knock, 0, 0.2);
        founder.body.rotation.x = 0.15 + 0.15 * knock;
        helpers.forEach((P, i) => { // a hand up against the heat once the bronze runs
          const h = run > 0.05 ? 1 : 0;
          P.r.g.rotation.set(-0.3 - 1.9 * h, 0, -0.3 - 0.4 * h); P.l.g.rotation.set(h && i % 2 ? -1.0 : -0.2, 0, 0.2);
          P.body.rotation.x = -0.1 * h;
        });
      } else if (step === 'cool') {
        // three strikes; the bell swings a little after each, the helpers cheer from the first
        let swing = 0, arm = 0;
        for (const s of STRIKES) {
          const d = u - s;
          if (d > 0) swing += 0.06 * Math.exp(-d * 9) * Math.sin(d * 40);
          if (d > -0.06 && d < 0.03) arm = d < 0 ? (d + 0.06) / 0.06 : 1 - d / 0.03;
        }
        bell.rotation.z = swing;
        founder.r.g.rotation.set(-2.4 + 1.3 * arm, 0, -0.2); founder.l.g.rotation.set(-0.3, 0, 0.1);
        const cheer = u > STRIKES[0] + 0.03;
        helpers.forEach((P, i) => {
          const ph = t * 8 + i;
          P.r.g.rotation.set(cheer ? -2.6 - 0.3 * Math.sin(ph) : -0.2, 0, -0.2);
          P.l.g.rotation.set(cheer && i !== 1 ? -2.4 - 0.3 * Math.cos(ph) : -0.2, 0, 0.2);
        });
      } else {
        // the haulers walk backward, hand over hand, the bell climbs from the ground to the belfry
        const k = ease(clamp01((u - 0.05) / 0.85));
        const y = (B.top - 2.2) * k;
        bell.position.set(B.x, Math.max(gy(B.x, B.face + 2.1), 0) + 0.05 + y, B.face + 2.1);
        bell.rotation.z = 0.04 * Math.sin(t * 2.2) * (k > 0 && k < 1 ? 1 : 0);
        const back = 4.5 * k;
        helpers.forEach((P, i) => {
          const z = haul.z0 + i * 1.1 + back;
          P.root.position.set(B.x + (i % 2 ? 0.35 : -0.35), gy(B.x, z), z);
          stride(P, -(t - t0) * 3 + i, k < 1 ? 0.25 : 0, { arms: false });
          const pull = Math.sin(t * 4 + i * 0.7);
          P.r.g.rotation.set(-1.4 + 0.25 * pull, 0, -0.1); P.l.g.rotation.set(-1.2 - 0.25 * pull, 0, 0.1);
          P.body.rotation.x = -0.25;
        });
        founder.r.g.rotation.set(-2.2 + 0.3 * Math.sin(t * 3), 0, -0.3); founder.l.g.rotation.set(-0.4, 0, 0.1);
        const crown = tmp.set(B.x, bell.position.y + 2.25, B.face + 2.1);
        const last = helpers.length ? helpers[0].root.position : new THREE.Vector3(B.x, 1, B.face + 6);
        stretch(rope[0], beamEnd, crown);
        stretch(rope[1], beamEnd, tmp2.set(last.x, last.y + 1.25, last.z - 0.3));
      }
      for (const l of labels) l.pos.copy(l.P.root.position).setY(l.P.root.position.y + 2.3).applyMatrix4(group.matrix);
    },
  };
}
