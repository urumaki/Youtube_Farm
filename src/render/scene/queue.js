// People waiting in front of a worker (owner 2026-10-23): taxpayers with a purse each at the Counting House door,
// the sick and the lame at the Apothecary's Shop (one on crutches, one with a bandaged head, one with an arm in a
// sling, one coughing; nobody badly hurt), a customer haggling at a market stall. In the worker's frame: the
// worker at the origin facing +z, the queue from 1.5 m in front of them, facing back. A pure function of t.
import * as THREE from 'three';
import { rand01 } from '../../sim/prng.js';
import { boxGeo, cylGeo } from './kit.js';
import { rig, toolGeo } from './work.js';

const COLORS = ['#7b3b2a', '#3f5a7a', '#5d6b35', '#8a6a3a', '#6a4a6e', '#9a8a6a', '#4a6a64', '#a0522d', '#56606e', '#7a5a4a'];
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const SICK = ['crutches', 'bandage', 'sling', 'cough'];
const TAX = 4.2; // seconds a taxpayer takes at the counter

/**
 * @param kind  'tax' | 'sick' | 'customer'
 * @returns { group, update(t), mid } mid: a point in the middle of the queue (worker frame), for the camera
 */
export function buildQueue(kind, { M, seed, id }) {
  const group = new THREE.Group();
  const n = kind === 'customer' ? 1 : 4;
  const people = [];
  const white = M.clothIvory;
  // the sack the first taxpayer leaves on the counter (worker frame: the counter's ledge, 1 m in front of the collector)
  const counterSack = toolGeo('sack', M);
  counterSack.scale.setScalar(0.55);
  counterSack.position.set(0.12, 1.08, 1.0);
  counterSack.visible = false;
  if (kind === 'tax') group.add(counterSack);
  for (let i = 0; i < n; i++) {
    const r = (k) => rand01(seed, 'queue', id, i, k);
    const P = rig(M, COLORS[Math.floor(r(0) * COLORS.length)]);
    const z = kind === 'customer' ? 2.3 : 1.55 + i * 0.85;
    P.root.position.set(kind === 'customer' ? 0.75 : i % 2 ? 0.14 : -0.1, 0, z);
    P.root.rotation.y = Math.atan2(-P.root.position.x, -z) + (r(1) - 0.5) * 0.3; // facing the worker
    group.add(P.root);
    const p = { P, i, z, off: r(2) * 6, ail: kind === 'sick' ? SICK[i] : null };
    if (kind === 'tax' || kind === 'customer') {
      const purse = toolGeo('sack', M);
      purse.scale.setScalar(kind === 'tax' ? 0.55 : 0.42);
      if (kind === 'tax') purse.name = 'coinSack'; // owner 2026-11-25: a sack of coins for the tax counter
      P.r.hand.add(purse);
      p.purse = purse;
      p.base = P.root.position.clone();
    }
    if (p.ail === 'crutches') {
      // a crutch under each arm down to the ground, a bandaged foot held up
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(cylGeo(0.03, 0.035, 1.32, 6).translate(0, 0.66, 0), M.wood);
        c.position.set(s * 0.42, 0, 0.12);
        c.rotation.z = s * 0.08;
        c.castShadow = true;
        P.root.add(c);
        const pad = new THREE.Mesh(boxGeo(0.22, 0.05, 0.08), M.woodDark);
        pad.position.set(s * 0.37, 1.33, 0.12);
        P.root.add(pad);
      }
      const foot = new THREE.Mesh(boxGeo(0.17, 0.2, 0.3), white);
      foot.position.set(0.09, 0.14, 0.08);
      P.root.add(foot);
      p.foot = foot;
    } else if (p.ail === 'bandage') {
      // a white bandage round the head, tied with a knot
      const band = new THREE.Mesh(cylGeo(0.185, 0.185, 0.1, 14, 4, true), white);
      band.position.y = 1.1;
      P.body.add(band);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), white);
      knot.position.set(0, 1.1, -0.19);
      P.body.add(knot);
    } else if (p.ail === 'sling') {
      const sling = new THREE.Mesh(boxGeo(0.34, 0.26, 0.06).rotateZ(0.5), white);
      sling.position.set(-0.08, 0.62, 0.24);
      P.body.add(sling);
    }
    people.push(p);
  }
  const lerp = THREE.MathUtils.lerp;
  return {
    group,
    people,
    counterSack,
    mid: new THREE.Vector3(0, 1.1, kind === 'customer' ? 1.2 : 1.7),
    update(t) {
      for (const p of people) {
        const { P } = p;
        const sway = Math.sin(t * 1.1 + p.off);
        P.body.rotation.set(0, 0.12 * Math.sin(t * 0.5 + p.off), 0.03 * sway);
        P.l.g.rotation.set(-0.12, 0, -0.08);
        P.r.g.rotation.set(-0.25, 0, 0.08);
        if (kind === 'tax') {
          // owner 2026-11-25: the first in line puts the sack of coins on the counter and walks off along the front; the others
          // step up one place, and a newcomer joins the end (a cycle of TAX seconds; the coats go round with the places)
          const c = t / TAX, k = Math.floor(c), u = c - k;
          const reach = u < 0.2 ? ease(u / 0.2) : u < 0.35 ? 1 : u < 0.45 ? 1 - ease((u - 0.35) / 0.1) : 0;
          const leave = ease((u - 0.45) / 0.35), step = ease((u - 0.7) / 0.3);
          P.tunic.color.set(COLORS[(Math.floor(rand01(seed, 'queue', id, 0, 0) * COLORS.length) + p.i + k) % COLORS.length]);
          if (p.i === 0) {
            P.r.g.rotation.set(lerp(-0.25, -1.35, reach), 0, 0);
            P.body.rotation.x = 0.12 * reach;
            p.purse.visible = u < 0.3;
            P.root.position.set(p.base.x + 2.6 * leave, 0, p.base.z + 0.4 * leave);
            P.root.rotation.y = lerp(Math.atan2(-p.base.x, -p.base.z), Math.PI / 2, ease((u - 0.45) / 0.1));
            P.root.visible = leave < 0.98;
          } else {
            P.r.g.rotation.set(-0.45 - 0.1 * Math.sin(t * 0.7 + p.off), 0, -0.1); // weighing the sack in the hand
            const ahead = people[p.i - 1].base;
            P.root.position.set(lerp(p.base.x, ahead.x, step), 0, lerp(p.base.z, ahead.z, step));
          }
          if (p.i === 0) counterSack.visible = u >= 0.3 && u < 0.92; // taken in by the collector before the next one comes
        } else if (kind === 'customer') {
          // haggling: points at the goods, then throws up the free hand
          const c = (t + p.off) / 2.8, u = c - Math.floor(c);
          P.l.g.rotation.set(u < 0.5 ? -1.2 - 0.25 * Math.sin(u * Math.PI * 4) : -0.3, 0, u < 0.5 ? 0.1 : -0.6 * ease((u - 0.5) * 4) * (1 - ease((u - 0.8) * 5)));
          P.r.g.rotation.set(-0.5, 0, -0.1);
          P.body.rotation.y = 0.15 * Math.sin(t * 0.9 + p.off);
        } else if (p.ail === 'crutches') {
          P.body.rotation.x = 0.12;
          P.l.g.rotation.set(-0.08, 0, -0.2);
          P.r.g.rotation.set(-0.08, 0, 0.2);
          P.root.position.y = 0.02 * Math.abs(Math.sin(t * 1.4 + p.off));
          p.foot.rotation.x = -0.3;
        } else if (p.ail === 'bandage') {
          // a hand to the sore head every few seconds
          const c = (t + p.off) / 4, u = c - Math.floor(c), up = u < 0.2 ? ease(u / 0.2) : u < 0.6 ? 1 : u < 0.8 ? 1 - ease((u - 0.6) / 0.2) : 0;
          P.l.g.rotation.set(lerp(-0.12, -2.6, up), 0, lerp(0.08, 0.55, up));
        } else if (p.ail === 'sling') {
          P.l.g.rotation.set(-0.75, 0, 0.6); // the arm across the chest in the sling
        } else if (p.ail === 'cough') {
          // doubled over by a cough now and then, a hand to the mouth
          const c = (t + p.off) / 3.1, u = c - Math.floor(c), fit = u < 0.35 ? Math.sin((u / 0.35) * Math.PI) : 0;
          P.body.rotation.x = 0.35 * fit + 0.04 * Math.sin(t * 25) * fit;
          P.r.g.rotation.set(lerp(-0.25, -2.3, Math.min(1, fit * 2)), 0, lerp(-0.08, -0.45, Math.min(1, fit * 2)));
        }
      }
    },
  };
}
