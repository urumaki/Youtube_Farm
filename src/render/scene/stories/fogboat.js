// Lost in the fog (owner 2026-10-27), only on foggy days: a fisherman (a named one when there is one) rows home up the river
// in a thick fog. On the end of the dock's pier named villagers keep a beacon fire burning, wave torches and ring a hand bell;
// the boat looms out of the fog and comes alongside, and they cheer. The fog is thicker for this shot (`fog`).
import * as THREE from 'three';
import { WATER_LEVEL } from '../../../sim/world.js';
import { JOBS } from '../../../sim/tiers.js';
import { rig } from '../work.js';
import { rowboat } from '../away.js';
import { person, torch, bonfire, flicker, castTag, ease, clamp01 } from './common.js';
import { pierFrame } from './regatta.js';

const HOME = 0.82; // the share of the shot the boat takes to reach the pier

export function buildFogBoat({ story, w, M, buildings, lang }) {
  const d = buildings.items.dock;
  if (!d?.pier) return null;
  // at(a, b): a metres out from the end of the pier, b along the river toward the open water the boat comes from
  const { at, deckY, out } = pierFrame(d, w);
  const group = new THREE.Group();
  group.visible = false;
  // the beacon fire in an iron basket on a post at the end of the pier
  const fireAt = at(-0.2, -1.1);
  const fire = bonfire(group, M, new THREE.Vector3(0, 0, 0), 30);
  const basket = group.children.slice(); // bonfire() adds its pieces at C (0,0,0) round y 0: lift them onto the post
  const beacon = new THREE.Group();
  for (const m of basket) { group.remove(m); beacon.add(m); }
  beacon.scale.setScalar(0.6);
  beacon.position.copy(fireAt).setY(deckY + 1.3);
  group.add(beacon);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.3, 6), M.iron);
  post.position.copy(fireAt).setY(deckY + 0.65);
  group.add(post);
  // the boat and its rower
  const boat = new THREE.Group();
  boat.add(rowboat(M));
  group.add(boat);
  const fisher = story.fisher || story.cast[0];
  const R = rig(M, JOBS[fisher?.job]?.color || JOBS.fisherman.color, { seated: true });
  R.root.position.set(0, -0.04, -0.3);
  R.root.rotation.y = Math.PI; // rowing faces the stern
  boat.add(R.root);
  const labels = [];
  if (fisher) labels.push({ ...castTag(fisher, lang), P: R, dy: 1.7 });
  // the villagers on the pier: one rings the bell, the others hold torches up
  const crew = story.cast.filter((c) => c.id !== fisher?.id).slice(0, 4).map((c, i) => {
    const P = person(M, JOBS[c.job]?.color || ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a'][i]);
    P.root.position.copy(at(-1.2 - (i % 2) * 1.2, i < 2 ? 0.75 : -0.6 + (i - 2) * 1.4));
    P.root.lookAt(at(4, 14, P.root.position.y)); // out toward the river, where the boat comes from
    P.root.rotation.x = P.root.rotation.z = 0;
    group.add(P.root);
    let flame = null;
    if (i === 0) {
      const bell = new THREE.Group();
      bell.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.18, 10).translate(0, -0.2, 0), M.gold));
      bell.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6).translate(0, -0.06, 0), M.woodDark));
      P.r.hand.add(bell);
    } else flame = torch(M, P.r.hand);
    labels.push({ ...castTag(c, lang), P });
    return { P, flame, i };
  });
  // the path: from 38 m up the river, swinging in to lie alongside the end of the pier
  const from = at(5, 38, WATER_LEVEL), to = at(1.6, 1.2, WATER_LEVEL);
  const path = (k) => from.clone().lerp(to, k).addScaledVector(out, 2.2 * Math.sin(Math.PI * k));
  return {
    group,
    labels,
    fog: 0.042,
    banner: lang === 'it' ? 'Persi nella nebbia!' : 'Lost in the fog!',
    focus: at(2, 4, deckY + 1.2),
    cam(u) {
      // over the water beside the pier, behind the villagers, looking up the river the way they look: the boat comes out of
      // the fog straight toward them, over their heads in the frame, and the camera settles on the meeting
      const k = ease(clamp01(u / HOME));
      const look = at(0.2, 14, deckY + 0.6).lerp(at(0, 1.2, deckY + 0.8), k);
      return { pos: at(-0.6, -13 + 2 * k, deckY + 3.6 - 0.6 * k), look };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      fire.update(t, group.visible);
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const k = ease(clamp01(u / HOME)), home = u >= HOME;
      const p = path(k), q = path(Math.min(1, k + 0.01)), p0 = path(Math.max(0, k - 0.01));
      boat.position.copy(p).setY(WATER_LEVEL + 0.04 * Math.sin(t * 1.7));
      boat.rotation.set(0.02 * Math.sin(t * 1.1), Math.atan2(q.x - p0.x, q.z - p0.z), 0.04 * Math.sin(t * 1.3));
      // rowing: both arms pull, the body leans back; shipped oars and a wave once home
      const s = Math.sin((t - t0) * 4.2);
      if (!home) { R.r.g.rotation.set(-1.2 + 0.5 * s, 0, -0.3); R.l.g.rotation.set(-1.2 + 0.5 * s, 0, 0.3); R.body.rotation.x = -0.15 * s; } else { R.r.g.rotation.set(-2.7 + 0.3 * Math.sin(t * 7), 0, -0.4); R.l.g.rotation.set(-0.4, 0, 0.2); R.body.rotation.x = 0; }
      for (const { P, flame, i } of crew) {
        if (flame) flicker(flame, t, i * 2);
        if (i === 0) P.r.g.rotation.set(-1.9 + 0.35 * Math.sin(t * 12), 0, -0.3); // ringing the bell
        else if (home) P.r.g.rotation.set(-2.7 + 0.25 * Math.sin(t * 8 + i), 0, -0.3); // torches up, cheering
        else P.r.g.rotation.set(-2.2 + 0.4 * Math.sin(t * 2.5 + i), 0, -0.2 + 0.25 * Math.sin(t * 2.5 + i)); // waving the torches
        P.l.g.rotation.set(home && i % 2 ? -2.5 : -0.3, 0, 0.2);
      }
      group.updateMatrixWorld(true);
      for (const l of labels) l.pos.copy(l.P.root.getWorldPosition(l.pos)).setY(l.pos.y + (l.dy ?? 2.3));
    },
  };
}
