// Halloween (31 October): at dusk the villagers dance in costume around a bonfire in the square,
// ringed by glowing jack-o'-lanterns. Named villagers wear the costumes and keep their name tags.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { person, stage, bonfire } from './common.js';

const COSTUME = { ghost: ['Ghost', 'Fantasma'], scarecrow: ['Scarecrow', 'Spaventapasseri'], pumpkin: ['Pumpkin', 'Zucca'] };
const EXTRAS = ['ghost', 'scarecrow', 'pumpkin', 'scarecrow', 'ghost', 'pumpkin'];

function pumpkinMat(glow) {
  return new THREE.MeshStandardMaterial({ color: '#d9701c', roughness: 0.6, emissive: '#ff7a10', emissiveIntensity: glow });
}

function dress(P, kind, M) {
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; P.body.add(m); return m; };
  if (kind === 'ghost') {
    // a white sheet over everything, with two dark eyes
    const sheet = M.clothIvory.clone();
    sheet.color.set('#f4f1ea');
    P.tunic.color.set('#f4f1ea');
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.75, 14, 1, true).translate(0, 0.27, 0), sheet);
    m.castShadow = true;
    P.body.add(m);
    add(new THREE.SphereGeometry(0.26, 12, 10).translate(0, 1.12, 0), sheet);
    for (const x of [-0.08, 0.08]) add(new THREE.SphereGeometry(0.04, 6, 5).translate(x, 1.16, 0.23), M.iron);
  } else if (kind === 'scarecrow') {
    // straw-coloured smock with a patch, a wide straw hat and straw sticking out at the neck
    P.tunic.color.set('#b59a5a');
    add(new THREE.CylinderGeometry(0.42, 0.44, 0.04, 16).translate(0, 1.24, 0), M.hay);
    add(new THREE.CylinderGeometry(0.15, 0.2, 0.22, 12).translate(0, 1.36, 0), M.hay);
    add(new THREE.CylinderGeometry(0.26, 0.2, 0.12, 10, 1, true).translate(0, 0.84, 0), M.hay);
    add(new THREE.BoxGeometry(0.16, 0.16, 0.02).translate(0.08, 0.5, 0.27), M.clothRed);
  } else {
    P.tunic.color.set('#3f6b2a');
    add(new THREE.SphereGeometry(0.29, 14, 10).scale(1.15, 0.9, 1.15).translate(0, 1.08, 0), pumpkinMat(0.9));
    add(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6).translate(0, 1.38, 0), M.greens);
  }
}

export function buildHalloween({ story, M, buildings, seed, lang }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(2, 0, 2) : new THREE.Vector3(0, 0, 5);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(C.x + x, y, C.z + z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  const fire = bonfire(group, M, C);
  // jack-o'-lanterns in a ring
  const lantern = pumpkinMat(1.3);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13, r = 5.4 + rand01(seed, 'pump', i) * 0.5;
    const p = add(new THREE.SphereGeometry(0.3, 12, 9).scale(1.2, 0.85, 1.2), lantern, Math.cos(a) * r, 0.26, Math.sin(a) * r);
    p.rotation.y = -a;
    add(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), M.greens, Math.cos(a) * r, 0.56, Math.sin(a) * r);
  }
  // the dancers: named villagers first, then a few more in costume
  const cast = [...(story.cast || [])];
  for (let i = 0; cast.length < 7 && i < EXTRAS.length; i++) cast.push({ name: null, job: 'peasant', costume: EXTRAS[i] });
  const dancers = cast.map((c, i) => {
    const P = person(M, JOBS[c.job]?.color || '#7a6a55');
    dress(P, c.costume, M);
    group.add(P.root);
    return { P, c, a0: (i / cast.length) * Math.PI * 2 };
  });
  const it = lang === 'it' ? 1 : 0;
  const labels = dancers.filter((d) => d.c.name).map((d) => ({ d, pos: new THREE.Vector3(), title: d.c.name, sub: COSTUME[d.c.costume][it] }));
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Buon Halloween!' : 'Happy Halloween!',
    phase: 1,
    focus: st.toWorld(C.x, 1.2, C.z),
    cam(u) {
      const a = -Math.PI / 2 + 0.7 - 1.0 * u;
      return { pos: st.toWorld(C.x + Math.cos(a) * 9.5, 3.4, C.z + Math.sin(a) * 9.5), look: st.toWorld(C.x, 1.0, C.z) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      fire.update(t, group.visible);
      if (!group.visible) return;
      dancers.forEach(({ P, a0 }, i) => {
        const a = a0 + (t - t0) * 0.55, r = 3.0;
        P.root.position.set(C.x + Math.cos(a) * r, 0, C.z + Math.sin(a) * r);
        P.root.rotation.y = -a; // facing along the circle
        const hop = (t * 2.2 + i * 0.37) % 1;
        P.root.position.y = 0.22 * Math.sin(Math.PI * hop);
        P.legs[0].rotation.x = 0.5 * Math.sin(hop * Math.PI * 2);
        P.legs[1].rotation.x = -0.5 * Math.sin(hop * Math.PI * 2);
        P.r.g.rotation.set(-2.4 + 0.5 * Math.sin(t * 5 + i), 0, -0.3);
        P.l.g.rotation.set(-2.4 + 0.5 * Math.sin(t * 5 + i + Math.PI), 0, 0.3);
      });
      for (const lb of labels) lb.pos.copy(tmp.copy(lb.d.P.root.position).setY(2.4)).applyMatrix4(group.matrix);
    },
  };
}
