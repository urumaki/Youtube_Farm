// The baker works indoors (owner 2026-10-20: a baker at work in the open makes no sense). A small
// bakehouse stands in the baker's croft: a brick oven against the side wall, shelves of loaves, flour
// sacks and firewood, warm light from the oven mouth and a lamp. The baker loads loaves with the peel
// ('oven') or kneads dough at the table with the oven beside them and the peel leaning on it ('knead').
// The shot cuts inside and back out like the tavern, with its own camera; a visiting villager (visit.js)
// walks in through the side door. Everything is a pure function of t.
import * as THREE from 'three';
import { Builder, boxGeo, cylGeo, gableGeo } from './kit.js';
import { buildWorkScene, toolGeo } from './work.js';

export const BAKEHOUSE_VARIANTS = new Set(['oven', 'knead']);

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// Room frame: origin at the baker's spot on the floor, +z away from the house (toward the camera), +x
// toward the oven. The visit's guest stands at x -1.35 (visit.js puts them 1.35 m to the camera's left)
// and walks in from x -4.55 through the door in the -x wall.
const X0 = -2.5, X1 = 3.1, Z0 = -1.4, Z1 = 3.8, CEIL = 2.9, WALL = 0.2;
const OVEN = { x0: 1.85, x1: 3.05, z: 0, hd: 0.85, hearth: 0.95 }; // the mouth faces -x at x0
const DOOR = { z0: 0.05, z1: 1.45, h: 2.1 };
export const FOV = 70; // a wider lens than outside: the room is small

/**
 * @param anchor  ground point behind the house where the baker works (as for the other croft scenes)
 * @param away    direction from the house into the croft (radians, world: cos/sin on x/z)
 * @param heightAt ground height (x, z)
 */
export function buildBakehouse({ variant, anchor, away, M, seed, id, heightAt }) {
  const room = new THREE.Group();
  const yaw = Math.atan2(Math.cos(away), Math.sin(away)); // local +z along `away`
  room.rotation.y = yaw;
  room.position.copy(anchor);
  room.updateMatrixWorld(true);
  // a level floor just above the highest ground under the house
  let lo = Infinity, hi = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) {
    room.localToWorld(v.set(X0 + (X1 - X0) * (i / 4), 0, Z0 + (Z1 - Z0) * (k / 4)));
    const h = heightAt(v.x, v.z);
    lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  room.position.y = hi + 0.12;
  room.updateMatrixWorld(true);
  const toWorld = (x, y, z) => room.localToWorld(new THREE.Vector3(x, y, z));
  const floorAt = (x, z) => {
    const p = room.worldToLocal(new THREE.Vector3(x, 0, z));
    const inside = p.x > X0 - WALL - 0.3 && p.x < X1 + WALL && p.z > Z0 - WALL && p.z < Z1 + WALL;
    return inside ? room.position.y : heightAt(x, z) + 0.03;
  };

  const mats = { ...M, daylight: new THREE.MeshBasicMaterial({ color: '#dfe8ef' }), brick: M.stone };
  const b = new Builder();
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  // floor on a stone footing down to the lowest ground, plank floor on top
  const drop = room.position.y - lo + 0.4;
  b.add('stone', boxGeo(W + 2 * WALL, drop, D + 2 * WALL, 3), cx, -drop / 2, cz);
  b.add('woodDark', boxGeo(W, 0.04, D, 2), cx, 0.02, cz);
  // walls (the -x wall has the doorway), ceiling, beams; wainscot inside
  const wallZ = (x) => b.add('plaster', boxGeo(WALL, CEIL, D + 2 * WALL), x, CEIL / 2, cz);
  wallZ(X1 + WALL / 2);
  const side = [[Z0 - WALL, DOOR.z0], [DOOR.z1, Z1 + WALL]];
  for (const [a, c] of side) b.add('plaster', boxGeo(WALL, CEIL, c - a), X0 - WALL / 2, CEIL / 2, (a + c) / 2);
  b.add('plaster', boxGeo(WALL, CEIL - DOOR.h, DOOR.z1 - DOOR.z0), X0 - WALL / 2, (CEIL + DOOR.h) / 2, (DOOR.z0 + DOOR.z1) / 2);
  for (const z of [Z0 - WALL / 2, Z1 + WALL / 2]) b.add('plaster', boxGeo(W, CEIL, WALL), cx, CEIL / 2, z);
  b.add('plaster', boxGeo(W + 2 * WALL, 0.12, D + 2 * WALL), cx, CEIL + 0.06, cz);
  for (let x = X0 + 0.9; x < X1; x += 1.4) b.add('woodDark', boxGeo(0.2, 0.22, D), x, CEIL - 0.11, cz);
  b.add('wood', boxGeo(W, 0.9, 0.05), cx, 0.45, Z0 + 0.03);
  for (const x of [X0 + 0.05, X1 - 0.05]) for (const z of [Z0 + 0.05, Z1 - 0.05]) b.add('woodDark', boxGeo(0.18, CEIL, 0.18), x, CEIL / 2, z);
  // door frame and the door leaf, swung open against the wall
  for (const z of [DOOR.z0, DOOR.z1]) b.add('woodDark', boxGeo(WALL + 0.06, DOOR.h, 0.1), X0 - WALL / 2, DOOR.h / 2, z);
  b.add('woodDark', boxGeo(WALL + 0.06, 0.12, DOOR.z1 - DOOR.z0 + 0.1), X0 - WALL / 2, DOOR.h, (DOOR.z0 + DOOR.z1) / 2);
  b.add('wood', boxGeo(1.3, DOOR.h - 0.1, 0.06), X0 - WALL - 0.65, (DOOR.h - 0.1) / 2, DOOR.z0 - 0.05);
  // outside: timber frame, a gable roof, a window with daylight on the back wall
  for (const x of [X0 - WALL, X1 + WALL]) for (const z of [Z0 - WALL, Z1 + WALL]) b.add('timber', boxGeo(0.24, CEIL, 0.24), x, CEIL / 2, z);
  b.add('roofRed', gableGeo(D + 2 * WALL + 0.9, W + 2 * WALL + 0.7, 1.9), cx, CEIL + 0.1, cz, Math.PI / 2);
  b.add('daylight', boxGeo(0.9, 0.8, 0.04), -0.9, 1.75, Z0 + 0.01);
  for (const y of [1.35, 2.15]) b.add('woodDark', boxGeo(1.1, 0.08, 0.1), -0.9, y, Z0 + 0.05);
  b.add('woodDark', boxGeo(0.06, 0.8, 0.08), -0.9, 1.75, Z0 + 0.05);

  // the oven: a brick hearth with a domed top, the mouth glowing; a chimney through the roof
  const { x0, x1, hd, hearth } = OVEN, ox = (x0 + x1) / 2, ow = x1 - x0;
  b.add('brick', boxGeo(ow, hearth, 2 * hd, 2), ox, hearth / 2, OVEN.z);
  b.add('brick', new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(ow / 2, 0.75, hd), ox, hearth, OVEN.z);
  b.add('stoneDark', boxGeo(0.12, 0.62, 0.9), x0 - 0.02, hearth + 0.31, OVEN.z); // the arch around the mouth
  b.add('ember', boxGeo(0.05, 0.46, 0.6), x0 - 0.03, hearth + 0.23, OVEN.z); // the fire seen through the mouth
  b.add('stoneDark', boxGeo(0.4, 0.08, 1.0), x0 - 0.18, hearth - 0.04, OVEN.z); // the ledge in front of the mouth
  b.add('brick', boxGeo(0.55, CEIL + 2.2 - hearth - 0.6, 0.55), x1 - 0.35, (hearth + 0.6 + CEIL + 2.2) / 2, OVEN.z);
  // firewood under the ledge and stacked by the oven
  for (let i = 0; i < 7; i++) b.add('wood', cylGeo(0.08, 0.08, 0.7, 7).rotateX(Math.PI / 2), x0 + 0.25 + (i % 4) * 0.19, 0.08 + Math.floor(i / 4) * 0.15, OVEN.z + hd + 0.45);
  // shelves of bread on the back wall, flour sacks in the corner, a table of cooling loaves by the door
  for (const y of [1.1, 1.6]) {
    b.add('woodDark', boxGeo(1.9, 0.06, 0.35), 0.45, y, Z0 + 0.2);
    for (let i = 0; i < 6; i++) b.add('hay', new THREE.SphereGeometry(0.12, 10, 8).scale(1.4, 0.7, 1), -0.3 + i * 0.3, y + 0.09, Z0 + 0.2);
  }
  for (const x of [-0.5, 1.4]) b.add('woodDark', boxGeo(0.06, 1.65, 0.3), x, 0.82, Z0 + 0.2);
  for (let i = 0; i < 4; i++) b.add('clothIvory', new THREE.SphereGeometry(0.27, 10, 8).scale(1, 1.25, 0.8), X0 + 0.45 + (i % 2) * 0.5, 0.33 + Math.floor(i / 2) * 0.5, Z0 + 0.45 + (i % 3) * 0.12);
  b.add('wood', boxGeo(1.6, 0.08, 0.7), X0 + 0.5, 0.82, Z1 - 0.9, Math.PI / 2);
  for (const z of [Z1 - 1.55, Z1 - 0.25]) b.add('woodDark', boxGeo(0.6, 0.8, 0.08), X0 + 0.5, 0.4, z);
  for (let i = 0; i < 5; i++) b.add('hay', new THREE.SphereGeometry(0.12, 10, 8).scale(1.4, 0.7, 1), X0 + 0.4 + (i % 2) * 0.2, 0.92, Z1 - 1.5 + i * 0.27);
  // a lamp hanging from the beam
  const LAMP = new THREE.Vector3(0.2, CEIL - 0.7, 0.5);
  b.add('iron', cylGeo(0.012, 0.012, 0.55, 4), LAMP.x, LAMP.y + 0.45, LAMP.z);
  b.add('iron', cylGeo(0.03, 0.08, 0.06, 8), LAMP.x, LAMP.y + 0.16, LAMP.z);
  const built = b.build(mats);
  room.add(built);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.flame);
  lampGlow.position.copy(LAMP).setY(LAMP.y - 0.02);
  room.add(lampGlow);
  // the peel leans against the oven while the baker kneads
  if (variant === 'knead') {
    const peel = toolGeo('peel', M);
    peel.userData.loaf.visible = false;
    peel.position.set(x0 - 0.12, 2.0, OVEN.z - hd + 0.1);
    peel.rotation.set(0, Math.PI / 2, 0.12);
    room.add(peel);
  }

  // warm light, on only while the camera is inside
  const lights = [
    { l: new THREE.PointLight('#ff8a3a', 0, 7, 1.6), p: [x0 - 0.25, hearth + 0.1, OVEN.z], i: 10 },
    { l: new THREE.PointLight('#ffc27a', 0, 9, 1.6), p: [LAMP.x, LAMP.y - 0.1, LAMP.z], i: 6 },
  ];
  for (const { l, p } of lights) { l.position.set(...p); l.visible = false; room.add(l); }

  // the baker: facing the oven mouth with the peel, or facing the camera at the kneading table
  const face = variant === 'oven' ? yaw + Math.PI / 2 : yaw;
  const ws = buildWorkScene({ job: 'baker', variant, anchor: toWorld(0, 0, 0), face, M, seed, id });

  // camera: from the front wall, wide (fov), the baker and the oven side by side, slowly in; with a guest,
  // it turns toward the door as they come in
  const cam = (u, guest) => {
    const k = ease(u);
    const pos = toWorld(THREE.MathUtils.lerp(1.35, 0.85, k), THREE.MathUtils.lerp(1.55, 1.4, k), THREE.MathUtils.lerp(Z1 - 0.3, Z1 - 0.75, k));
    const lx = guest ? THREE.MathUtils.lerp(0.9, -0.3, ease((u - 0.18) / 0.22)) : 0.9;
    return { pos, look: toWorld(lx, 1.15, guest ? 0.2 : 0), fov: FOV };
  };
  return {
    ...ws,
    room,
    cam,
    floorAt,
    labelPos: toWorld(0, 2.45, 0),
    update(t, inside) {
      ws.update(t);
      for (const { l, i } of lights) {
        l.visible = !!inside; // a light count change recompiles shaders once, only on the cut in and out
        l.intensity = inside ? i * (0.88 + 0.08 * Math.sin(t * 8.3) + 0.04 * Math.sin(t * 21.1)) : 0;
      }
    },
  };
}
