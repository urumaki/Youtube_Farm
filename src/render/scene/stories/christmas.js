// Christmas Eve (owner 2026-10-25, 24 December): night in the snowy market square. A great Yule log burns on a stone ring,
// an evergreen tree stands decked with red ribbons and candles, the newest named villagers sing round the fire with a
// candle each, swaying; the priest (a named one when there is one) blesses them with raised arms. The day turns to snow
// (src/sim/simulate.js).
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { cylGeo } from '../kit.js';
import { person, stage, castTag, bonfire, flameMaterial, flicker, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e', '#b5476b'];

/** A candle held in the hand (the hand frame has the arm along -y), with its flame. */
function candle(M, hand) {
  const wax = new THREE.Mesh(cylGeo(0.035, 0.035, 0.2, 8).translate(0, 0.02, 0.09), M.clothIvory);
  hand.add(wax);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 8).translate(0, 0.055, 0), flameMaterial('#ffd27a'));
  flame.position.set(0, 0.13, 0.09);
  hand.add(flame);
  return flame;
}

export function buildChristmas({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(3, 0, 2.5) : new THREE.Vector3(0, 0, 5);
  const fire = bonfire(group, M, C, 40);
  // snow lying on the square's paving round the ring (the terrain is white on snowy days, the stones are not)
  const cover = new THREE.Mesh(new THREE.CircleGeometry(8, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b9c0cc', roughness: 1 }));
  cover.position.set(C.x - 0.8, 0.08, C.z + 0.8);
  cover.receiveShadow = true;
  group.add(cover);
  // the evergreen tree beside the fire: three green tiers, red ribbons, candles at the tips
  const T = C.clone().add(new THREE.Vector3(-2.2, 0, 3.4)); // behind the ring, seen past the fire
  const green = new THREE.MeshStandardMaterial({ color: '#24502f', roughness: 0.9 });
  const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; group.add(m); return m; };
  add(cylGeo(0.14, 0.18, 0.8, 8), M.woodDark, T.x, 0.4, T.z);
  const flames = [];
  [[1.3, 1.5, 1.2], [1.0, 1.3, 2.1], [0.65, 1.1, 2.9]].forEach(([r, h, y], k) => {
    add(new THREE.ConeGeometry(r, h, 12).translate(0, h / 2, 0), green, T.x, y - 0.55, T.z);
    add(new THREE.TorusGeometry(r * 0.72, 0.03, 5, 20).rotateX(Math.PI / 2), M.clothRed, T.x, y - 0.25, T.z, false);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + k;
      flames.push(add(new THREE.ConeGeometry(0.035, 0.1, 6).translate(0, 0.05, 0), flameMaterial('#ffd27a'), T.x + Math.cos(a) * r * 0.82, y - 0.5, T.z + Math.sin(a) * r * 0.82, false));
    }
  });
  add(new THREE.OctahedronGeometry(0.16), M.gold, T.x, 3.15, T.z); // the star
  // the priest by the tree, facing the ring
  const priest = story.priest;
  const cast = story.cast.filter((c) => c.id !== priest?.id);
  const Pr = person(M, JOBS[priest?.job]?.color || JOBS.priest.color);
  Pr.root.position.set(T.x + 1.5, 0, T.z - 0.2);
  Pr.root.rotation.y = Math.atan2(C.x - Pr.root.position.x, C.z - Pr.root.position.z);
  group.add(Pr.root);
  // the singers round the fire: the named ones on the far side (seen past the flames), villagers in between
  const n = Math.max(8, cast.length + 3);
  const ring = Array.from({ length: n }, (_, i) => {
    const c = cast[i] || null;
    const a = Math.PI * 0.5 + ((i - (cast.length - 1) / 2) / n) * Math.PI * 2;
    const P = person(M, c ? JOBS[c.job]?.color || CROWD[i % 8] : CROWD[i % 8]);
    P.root.position.set(C.x + Math.cos(a) * 2.6, 0, C.z + Math.sin(a) * 2.6);
    P.root.rotation.y = Math.atan2(C.x - P.root.position.x, C.z - P.root.position.z);
    group.add(P.root);
    return { P, c, flame: candle(M, P.r.hand), ph: rand01(seed, 'xmas', i) * 6 };
  });
  const labels = [...(priest ? [{ ...castTag(priest), P: Pr }] : []), ...ring.filter((g) => g.c).map((g) => ({ ...castTag(g.c), P: g.P }))];
  return {
    group,
    labels,
    banner: 'Christmas Eve',
    focus: st.toWorld(C.x, 1.2, C.z),
    phase: 1,
    cam(u) {
      // from the near side, slowly round the ring toward the tree
      const a = -Math.PI / 2 + 0.3 - 0.55 * u;
      return { pos: st.toWorld(C.x - 0.8 + Math.cos(a) * 8.2, 2.5, C.z + Math.sin(a) * 8.2), look: st.toWorld(C.x - 0.9, 1.3, C.z + 0.5) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      fire.update(t, group.visible);
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      flames.forEach((f, k) => flicker(f, t, k));
      // the priest's arms go up in the blessing, slowly
      const bless = Math.min(1, u * 2.2);
      Pr.r.g.rotation.set(-0.3 - 2.3 * bless, 0, -0.35 * bless);
      Pr.l.g.rotation.set(-0.3 - 2.3 * bless, 0, 0.35 * bless);
      // the singers sway side to side with the song, the candle held up in front
      ring.forEach(({ P, flame, ph }, i) => {
        P.body.rotation.z = 0.08 * Math.sin(t * 2.2 + (i % 2) * 0.4);
        P.r.g.rotation.set(-1.25, 0, -0.1);
        P.l.g.rotation.set(-0.9, 0, 0.25);
        flicker(flame, t, ph);
      });
      for (const l of labels) l.pos.copy(l.P.root.position).setY(2.3).applyMatrix4(group.matrix);
    },
  };
}
