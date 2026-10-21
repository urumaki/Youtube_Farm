// A merchant caravan from far away comes up the south-east road toward the market: colourful wagons,
// merchants in turbans walking alongside. A story over three quiet days (src/sim/stories.js): they arrive
// (this scene), dance with the villagers round a fire at night (camp.js), then leave down the same road
// (step 'leave', this scene going the other way) while named villagers wave goodbye from the verge.
import * as THREE from 'three';
import { polyline } from '../../../sim/world.js';
import { rand01 } from '../../../sim/prng.js';
import { wagon } from '../caravan.js';
import { FROM_IT, GOODS_IT } from '../../../sim/stories.js';
import { JOBS } from '../../../sim/tiers.js';
import { person, stride, castTag } from './common.js';

const SPEED = 1.5;
const COVERS = ['#b8323a', '#2f5aa0', '#d9a41b', '#3f8a5a'];
const ROBES = ['#7b2f86', '#1f6f8b', '#b5562b', '#2f7a4f', '#a8326e'];
const TURBANS = ['#f1e6c8', '#e3b23c', '#c8414b', '#3b5fa8'];

export const fromIt = (p) => FROM_IT[p] || `da ${p}`;

/** A merchant in a long robe and a turban (i picks the colours). */
export function merchant(M, i) {
  const P = person(M, ROBES[i % ROBES.length]);
  const tb = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8).scale(1, 0.75, 1).translate(0, 1.22, 0), M.people.clone());
  tb.material.color.set(TURBANS[i % TURBANS.length]);
  tb.castShadow = true;
  P.body.add(tb);
  return P;
}
export { COVERS };

export function buildMerchants({ story, w, M, seed, yFn, lang }) {
  const road = w.roads.find((r) => r.id === 'southeast') || w.roads[0];
  const pl = polyline(road.pts);
  const group = new THREE.Group();
  group.visible = false;
  const nW = story.wagons || 2;
  const wagons = Array.from({ length: nW }, (_, k) => { const wg = wagon(M, seed + 7, k, COVERS[k % COVERS.length]); group.add(wg.g); return wg; });
  // two merchants lead, one walks beside each wagon
  const walkers = Array.from({ length: 2 + nW }, (_, i) => {
    const P = merchant(M, i);
    group.add(P.root);
    return P;
  });
  // arriving, the column comes toward s = 0 (the town); leaving, it goes back out the other way
  const leave = story.step === 'leave', back = leave ? -1 : 1;
  const s0 = Math.min(pl.total - 30, 75) - (leave ? 22 : 0);
  const P = new THREE.Vector3();
  const place = (obj, s, lateral) => {
    const [x, z, ang] = pl.at(Math.max(0, Math.min(pl.total, s)));
    P.set(x - Math.sin(ang) * lateral, 0, z + Math.cos(ang) * lateral);
    P.y = yFn(P.x, P.z);
    if (obj) { obj.position.copy(P); obj.rotation.y = -ang - Math.PI / 2 + (leave ? Math.PI : 0); }
    return ang;
  };
  const headS = (t, t0) => s0 - back * (t - t0 + 1) * SPEED;
  const title = lang === 'it' ? `Mercanti ${fromIt(story.from)}` : `Merchants from ${story.from}`;
  const sub = leave ? (lang === 'it' ? 'Arrivederci!' : 'Farewell!') : lang === 'it' ? `Vendono ${GOODS_IT[story.goods] || story.goods}` : `Selling ${story.goods}`;
  const labels = [{ pos: new THREE.Vector3(), title, sub }];
  // leaving: named villagers on the verge wave goodbye as the wagons go by
  const wavers = (leave ? story.cast || [] : []).map((c, i) => {
    const W = person(M, JOBS[c.job]?.color || '#7a6a55');
    group.add(W.root);
    const side = i % 2 ? 1 : -1;
    const ang = place(W.root, s0 + 4 + i * 2.6, side * 4.6);
    W.root.rotation.y = -ang - Math.PI / 2 - side * Math.PI / 2; // facing the road
    const tag = castTag(c, lang);
    tag.pos.copy(P).setY(P.y + 2.2);
    labels.push(tag);
    return W;
  });
  let T0 = 0, T1 = 1;
  return {
    group,
    labels,
    banner: leave ? (lang === 'it' ? 'I mercanti ripartono' : 'The merchants move on') : lang === 'it' ? 'Passano i mercanti!' : 'Merchants pass through!',
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    cam(u) {
      const s = headS(T0 + u * (T1 - T0), T0);
      const ang = place(null, s + 2 * back, 0);
      const head = P.clone();
      // ahead of the column and to one side, looking back down the road at the wagons
      const dir = ang + (leave ? 0 : Math.PI), a = dir + 0.7 - 0.3 * u;
      return {
        pos: new THREE.Vector3(head.x + Math.cos(a) * 11, head.y + 4.2, head.z + Math.sin(a) * 11),
        look: head.clone().add(new THREE.Vector3(-Math.cos(dir) * 6, 1, -Math.sin(dir) * 6)),
      };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.5 && t <= t1 + 0.5;
      if (!group.visible) return;
      const sHead = headS(t, t0);
      const walked = (t - t0 + 1) * SPEED;
      walkers.forEach((W, i) => {
        const lead = i < 2;
        const s = sHead + back * (lead ? rand01(seed, 'mer', i) * 0.6 : 4.5 + (i - 2) * 8.5);
        place(W.root, s, lead ? (i ? 0.7 : -0.7) : 1.6);
        stride(W, walked * 2.4 + i, 0.45);
      });
      wagons.forEach((wg, k) => {
        place(wg.g, sHead + back * (8 + k * 8.5), 0);
        wg.wheels.forEach((wh) => { wh.rotation.x = -(walked / 0.6); });
        wg.legs.forEach((l, j) => { l.rotation.x = 0.35 * Math.sin(t * 5 + (j % 2 ? Math.PI : 0) + (j > 1 ? Math.PI : 0)); });
      });
      labels[0].pos.copy(walkers[0].root.position).add(new THREE.Vector3(0, 2.5, 0));
      wavers.forEach((W, i) => {
        W.r.g.rotation.set(-2.7 + 0.35 * Math.sin(t * 8 + i), 0, -0.3);
        W.l.g.rotation.set(-0.2, 0, 0.1);
        W.legs[0].rotation.x = W.legs[1].rotation.x = 0;
      });
    },
  };
}
