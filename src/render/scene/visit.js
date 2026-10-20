// Two named villagers in one shot (src/sim/featured.js): the guest walks into the host's croft while the
// host works. The host stops, turns and hands something over (a sword, a bow, a mended tool, a loaf...),
// or the guest puts down what they brought (flour, wheat, fish, logs); then the host goes back to work and
// the guest waves or shows off what they got.
import * as THREE from 'three';
import { JOBS } from '../../sim/tiers.js';
import { visitItem } from '../../sim/featured.js';
import { toolGeo } from './work.js';
import { sword } from './drills.js';
import { person, stride, ease, clamp01 } from './stories/common.js';

const lerp = THREE.MathUtils.lerp;
// the guest receives it from the host / the guest brings it and puts it down
const GIVEN = { sword: 'sword', arrows: 'bow' };
const BROUGHT = { flour: 'sack', grain: 'sheaf', fish: 'basket', logs: 'logs' };
const DROP_Y = { sack: 0.36, sheaf: 0.12, basket: 0.17, logs: 0.06 }; // lifts that put each one on the ground
const TOOL_FOR = { farmer: 'hoe', peasant: 'spade', woodcutter: 'axe', stonemason: 'mallet', carpenter: 'hammer', fisherman: 'rod' };

function item(kind, M) {
  return kind === 'sword' ? sword(M) : toolGeo(kind, M);
}

// the parts of the shot, as fractions of its length
const ARRIVE = 0.33, GIVE = 0.42, PASS = 0.54, BACK = 0.68;

/**
 * @param host   the host's work scene (work.js), already in the scene
 * @param away   the direction the camera looks from (radians, world, as in the croft shots)
 * @param yFn    ground height
 */
export function buildVisit({ host, hostJob, guest, pair, away, M, yFn, t0, t1 }) {
  const group = new THREE.Group();
  group.visible = false;
  const dir = new THREE.Vector3(Math.cos(away), 0, Math.sin(away)); // toward the camera
  const perp = new THREE.Vector3(-Math.sin(away), 0, Math.cos(away));
  const base = host.group.position;
  const stand = base.clone().addScaledVector(perp, 1.35).addScaledVector(dir, 0.55);
  stand.y = yFn(stand.x, stand.z);
  const start = stand.clone().addScaledVector(perp, 3.2).addScaledVector(dir, 0.5);
  start.y = yFn(start.x, start.z);
  const G = person(M, JOBS[guest.job]?.color || '#7a6a55');
  group.add(G.root);
  const givenKind = GIVEN[pair] || (pair === 'tools' ? TOOL_FOR[guest.job] || 'hammer' : pair === 'visit' ? visitItem(hostJob) : null);
  const broughtKind = BROUGHT[pair] || null;
  const given = givenKind ? item(givenKind, M) : null;
  const brought = broughtKind ? item(broughtKind, M) : null;
  if (brought) G.r.hand.add(brought);
  const dropped = brought ? item(broughtKind, M) : null; // the same thing, put down on the ground
  if (dropped) { dropped.visible = false; group.add(dropped); }
  const labelPos2 = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const span = t1 - t0;
  const inHandover = (t) => t > t0 + (GIVE - 0.04) * span && t < t0 + (BACK + 0.04) * span;
  return {
    group,
    stand,
    labelPos2,
    // no work sounds while the host stops to hand things over
    work: host.strikeTimes ? { strikeTimes: (a, b) => host.strikeTimes(a, b).filter((t) => !inHandover(t)), sound: host.sound } : null,
    update(t) {
      group.visible = t >= t0 - 0.1 && t <= t1 + 0.1;
      if (!group.visible) return;
      const u = clamp01((t - t0) / span);
      // the guest walks in, then turns to face the host
      const walk = ease(clamp01(u / ARRIVE));
      G.root.position.copy(start).lerp(stand, walk);
      G.root.position.y = lerp(start.y, stand.y, walk);
      const heading = Math.atan2(stand.x - start.x, stand.z - start.z);
      const toHost = Math.atan2(base.x - stand.x, base.z - stand.z);
      G.root.rotation.y = lerp(heading, toHost + (toHost - heading > Math.PI ? -2 * Math.PI : toHost - heading < -Math.PI ? 2 * Math.PI : 0), clamp01((u - ARRIVE + 0.06) / 0.1));
      G.body.rotation.set(0, 0, 0);
      stride(G, (t - t0) * 9, u < ARRIVE ? 0.5 : 0, { arms: !brought });
      if (brought) {
        // carried in front with both hands, then put down at the host's feet
        const down = clamp01((u - GIVE) / (PASS - GIVE));
        G.r.g.rotation.set(-0.9 + 0.3 * down, 0, -0.28); G.l.g.rotation.set(-0.9 + 0.3 * down, 0, 0.28);
        G.body.rotation.x = 0.45 * Math.sin(Math.PI * down);
        brought.visible = u < PASS;
        dropped.visible = u >= PASS;
        if (u >= PASS && !dropped.userData.placed) {
          // where it lies: in front of the guest, on the ground
          dropped.position.copy(stand).add(tmp.set(Math.sin(toHost), 0, Math.cos(toHost)).multiplyScalar(0.55));
          dropped.position.y = yFn(dropped.position.x, dropped.position.z) + DROP_Y[broughtKind];
          dropped.rotation.set(0, toHost, 0);
          dropped.userData.placed = true;
        }
        if (u > BACK) { G.r.g.rotation.set(-2.7 + 0.35 * Math.sin(t * 8), 0, 0.3); G.l.g.rotation.set(0, 0, 0.1); } // a wave goodbye
      } else if (u >= ARRIVE) {
        // reach out for it, then show it off (or wave, after a chat)
        const reach = clamp01((u - GIVE) / 0.06) * (1 - clamp01((u - PASS - 0.04) / 0.06));
        G.r.g.rotation.set(lerp(0, -1.25, reach), 0, 0);
        G.l.g.rotation.set(0, 0, 0);
        if (u > PASS + 0.08) G.r.g.rotation.set(given ? -2.5 : -2.7 + 0.35 * Math.sin(t * 8), 0, given ? 0 : 0.3);
      } else { G.r.g.rotation.set(0, 0, 0); G.l.g.rotation.set(0, 0, 0); }
      // the host stops work, turns to the guest and hands it over
      const P = host.rig;
      const h = clamp01((u - GIVE + 0.05) / 0.06) * (1 - clamp01((u - BACK) / 0.08));
      if (h > 0) {
        const local = host.group.worldToLocal(tmp.copy(stand));
        const turn = Math.atan2(local.x, local.z);
        P.root.rotation.y = lerp(P.root.rotation.y, turn, h);
        P.root.position.z = lerp(P.root.position.z, 0, h);
        P.body.rotation.x = lerp(P.body.rotation.x, 0, h);
        P.body.rotation.y = lerp(P.body.rotation.y, 0, h);
        P.r.g.position.x = 0.3;
        P.r.g.rotation.set(lerp(P.r.g.rotation.x, given ? -1.25 : pair === 'visit' ? -2.6 + 0.3 * Math.sin(t * 8) : -0.2, h), 0, lerp(P.r.g.rotation.z, given ? 0 : 0.3, h));
        P.l.g.rotation.set(lerp(P.l.g.rotation.x, -0.15, h), 0, lerp(P.l.g.rotation.z, 0.1, h));
      }
      if (host.tool) host.tool.visible = h < 0.5;
      if (given) {
        // in the host's hand from the turn to the pass, then in the guest's hand
        const holder = u < PASS ? (h > 0.5 ? P.r.hand : null) : G.r.hand;
        if (given.parent !== holder) { given.removeFromParent(); if (holder) holder.add(given); }
      }
      G.root.updateMatrixWorld(true);
      labelPos2.copy(G.root.getWorldPosition(tmp)).setY(G.root.position.y + 2.15);
    },
  };
}
