// The villager's own eyes (owner 2026-10-29): the camera comes in from behind, goes into the head and the rest of the shot
// is what the villager sees, at work (the hands and the tool on the work) or walking down a street. The scene still plays
// as usual; only the camera, the near plane and the name label change (main.js, timeline.js, src/sim/scenes.js).
import * as THREE from 'three';

const EYE = new THREE.Vector3(0, 1.07, 0.08); // body space: inside the head (a sphere of 0.17 at y 1.04), toward the face
const IN = 0.28; // the part of the shot spent coming in from behind
const FOV = 74; // the eyes see wider than the usual lens (52): the hands, the tool and the work in one view
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * rig: the person (work.js rig). look(eye, fwd, out): where the eyes look, world space.
 * Returns { cam(u), labelPos, eye(out), hide(on) }: `labelPos` follows the camera, so the name stays on screen; `hide`
 * takes the head and what is on it out of the picture while the camera is inside.
 */
export function povCamera(rig, look) {
  const eye = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), q = new THREE.Quaternion();
  const from = new THREE.Vector3(), at = new THREE.Vector3(), seen = new THREE.Vector3();
  const labelPos = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const place = () => {
    rig.root.updateMatrixWorld(true);
    rig.body.localToWorld(eye.copy(EYE));
    fwd.set(0, 0, 1).applyQuaternion(rig.root.getWorldQuaternion(q)).setY(0).normalize();
    side.crossVectors(up, fwd);
  };
  // the head, the head piece and whatever the outfit put on the head and face (outfits.js: hoods, veils, spectacles)
  let parts = null;
  const headParts = () => {
    const out = [rig.head, rig.hat];
    for (const m of rig.body.children) {
      if (!m.isMesh || out.includes(m)) continue;
      m.geometry.computeBoundingBox();
      if (m.geometry.boundingBox.min.y + m.position.y >= 0.9) out.push(m);
    }
    return out;
  };
  return {
    labelPos,
    eye(out) { place(); return out.copy(eye); },
    hide(on) {
      parts ??= headParts();
      for (const p of parts) p.visible = !on;
    },
    cam(u) {
      place();
      look(eye, fwd, seen);
      // not the work alone: the eyes rest a little above it, the hands and the tool low in the frame, the place around
      seen.lerp(eye.clone().addScaledVector(fwd, 4).addScaledVector(up, -0.7), 0.35);
      const e = ease(u / IN);
      // from behind and above the shoulder, looking past the head at what they look at, then in through the back of the head
      from.copy(eye).addScaledVector(fwd, -2.3).addScaledVector(up, 0.6).addScaledVector(side, 0.45);
      const pos = from.clone().lerp(eye, e);
      at.copy(eye).addScaledVector(fwd, 1.2).lerp(seen, e);
      // the name above the head while it is in the frame, then ahead and up in the view
      const dir = at.clone().sub(pos).normalize();
      labelPos.copy(eye).addScaledVector(up, 0.75).lerp(pos.clone().addScaledVector(dir, 3).addScaledVector(up, 1.25), e);
      return { pos, look: at.clone(), fov: 52 + (FOV - 52) * e };
    },
  };
}
