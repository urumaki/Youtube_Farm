// The windmill runs wild (owner 2026-10-25): a gale spins the sails far too fast; the miller (a named one when there is
// one) and two helpers haul on the brake rope from the hub, leaning back and dragged forward step by step, until the
// sails slow down and they sit down hard on the grass. The sails are life.js's: `extra` adds turns during the shot.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { person, stride, castTag, ease, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a'];
const TURNS = 18; // extra radians the gale gives the sails over the shot
const STOP = 0.82; // the sails are slowed down by then

export function buildWindmill({ story, M, buildings, nature, yFn, lang }) {
  const item = buildings.items.windmill, sail = buildings.sails.find((s) => s.len === 9) || buildings.sails[0];
  if (!item || !sail) return null;
  const group = new THREE.Group();
  group.visible = false;
  const at = (x, z) => { const p = item.toWorld([x, 0, z]); p.y = yFn(p.x, p.z); return p; };
  const hub = item.toWorld([0, 11.5, 3.6]);
  // the camera in front of the sails (they face the mill's +z), at the first angle with no tree in the way
  const trees = nature?.trees || [];
  const clear = (a, d) => {
    const cam = at(Math.sin(a) * d, 3.4 + Math.cos(a) * d);
    cam.y += 2.6;
    for (let k = 0; k <= 12; k++) {
      const q = cam.clone().lerp(hub, k / 12), y = q.y;
      if (trees.some((t) => Math.hypot(t.x - q.x, t.z - q.z) < 3.2 * t.s + 1 && y < t.y + 10 * t.s)) return false;
    }
    return true;
  };
  const tries = [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75].flatMap((a) => [[a, 19], [a, 16]]);
  const [A, D] = tries.find(([a, d]) => clear(a, d)) || tries[0];
  const dx = Math.sin(A), dz = Math.cos(A); // from the mill toward the camera (lot frame)
  // the three on the rope, one behind the other between the mill and the camera, a little to the side, facing it
  const cast = story.cast.slice(0, 3);
  const team = [0, 1, 2].map((i) => {
    const c = cast[i] || null, P = person(M, c ? JOBS[c.job]?.color || CROWD[i % 2] : CROWD[i % 2]);
    group.add(P.root);
    const r = 5.2 + i * 1.1;
    const side = -1.2 + i * 2.0; // staggered to the side, so their name tags do not cover each other
    return { P, c, base: [dx * r + dz * side, 3.4 + dz * r - dx * side] };
  });
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#c8b48a' }));
  rope.frustumCulled = false;
  group.add(rope);
  const labels = team.filter((m) => m.c).map((m) => ({ ...castTag(m.c, lang), P: m.P }));
  let T0 = 0, T1 = 1;
  const gale = (t) => { const u = clamp01((t - T0) / (T1 - T0)); return TURNS * ease(Math.min(1, u / STOP)); };
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Il mulino impazzito!' : 'The windmill runs wild!',
    focus: item.toWorld([0, 6, 4]),
    setWindow(t0, t1) {
      T0 = t0; T1 = t1;
      sail.extra = gale; // life.js turns the sails by this much more
    },
    cam(u) {
      // low and to the side, looking up at the spinning sails with the rope team in the foreground
      const k = ease(u), d = D - 1.5 * k;
      const p = at(dx * d - dz * 0.8 * k, 3.4 + dz * d + dx * 0.8 * k);
      // the rope team in the middle of the frame (name tags are not drawn near the bottom), the sails above
      return { pos: p.setY(p.y + 3.0), look: item.toWorld([dx * 5.5, 1.9, 3.4 + dz * 5.5]) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0)), held = u > STOP;
      // dragged toward the mill in jerks while the sails pull, then a sit-down when they stop
      const drag = 1.2 * ease(Math.min(1, u / STOP)) + 0.12 * Math.sin(t * 9) * (held ? 0 : 1);
      const sit = ease(clamp01((u - STOP) / 0.08));
      team.forEach(({ P, base }, i) => {
        const p = at(base[0] - dx * (drag - 0.5 * sit), base[1] - dz * (drag - 0.5 * sit));
        P.root.position.copy(p);
        P.root.position.y -= 0.42 * sit;
        P.root.rotation.y = Math.atan2(hub.x - p.x, hub.z - p.z);
        P.body.rotation.x = held ? -0.5 * sit - 0.1 : -0.45 + 0.1 * Math.sin(t * 9 + i);
        if (!held) stride(P, (t - t0) * 7 + i, 0.25, { arms: false });
        else { P.legs[0].rotation.x = P.legs[1].rotation.x = -1.4 * sit; }
        P.r.g.rotation.set(-1.6, 0, -0.1); P.l.g.rotation.set(-1.5, 0, 0.1);
      });
      // the rope from the front one's hands up to the hub
      team[0].P.root.updateMatrixWorld(true);
      const hand = team[0].P.r.hand.getWorldPosition(tmp);
      const lp = rope.geometry.attributes.position;
      lp.setXYZ(0, hand.x, hand.y, hand.z); lp.setXYZ(1, hub.x, hub.y, hub.z);
      lp.needsUpdate = true;
      for (const l of labels) l.pos.copy(l.P.root.position).setY(l.P.root.position.y + 2.3);
    },
  };
}
