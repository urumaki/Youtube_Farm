// The clip check (owner 2026-11-25: in a work scene no tool, hand or body may pass through anything). Samples a work scene
// over time and reports every frame where a part of the worker crosses the surface of a prop or of what surrounds the scene
// (the bakehouse room...). The parts are segments: the tool from the hand to its tip, each upper arm and forearm, the spine,
// the head. A crossing near the spot the tool is meant to strike (ws.impact) is allowed, and so are meshes marked
// `userData.touch` (what the hands hold or work: a handle, the dough, a rope) or `userData.floor`.
// Runs under Node (tests/clip.test.js): only three.js geometry, no browser.
import * as THREE from 'three';
import { JOB_SCENES } from './work.js';
import { VARIANTS } from '../../sim/scenes.js';

const ray = new THREE.Raycaster();
const IMPACT_OK = 0.25; // metres round the strike point

const under = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
const wpos = (o, x = 0, y = 0, z = 0) => o.localToWorld(new THREE.Vector3(x, y, z));

/** Where the tool ends: its marked tip, else the corner of its box farthest from the hand. */
function toolEnd(tool) {
  if (tool.userData.tip) return wpos(tool.userData.tip);
  const box = new THREE.Box3();
  tool.traverse((m) => { if (m.isMesh) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix)); } });
  if (box.isEmpty()) return null;
  let far = null, d = -1;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const q = new THREE.Vector3(x, y, z), dq = q.length();
    if (dq > d) { d = dq; far = q; }
  }
  return tool.localToWorld(far);
}

function segments(ws) {
  const P = ws.rig, out = [];
  for (const [name, s] of [['armR', P.r], ['armL', P.l]]) {
    const sh = wpos(s.g), el = s.elbow ? wpos(s.elbow) : null, ha = wpos(s.hand);
    if (el) out.push([name, sh, el], [name === 'armR' ? 'handR' : 'handL', el, ha]);
    else out.push([name === 'armR' ? 'handR' : 'handL', sh, ha]);
  }
  out.push(['body', wpos(P.body, 0, 0.1, 0), wpos(P.body, 0, 0.85, 0)]);
  out.push(['head', wpos(P.body, 0, 0.9, 0), wpos(P.body, 0, 1.2, 0)]);
  if (ws.tool?.visible !== false && ws.tool) {
    const end = toolEnd(ws.tool);
    if (end) out.push(['tool', wpos(P.r.hand), end]);
  }
  return out;
}

/**
 * The crossings in a work scene: [{ part: 'tool'|'handR'|'handL'|'armR'|'armL'|'head'|'body', t, mesh }], one per part and
 * mesh (the first time). `env`: more objects whose meshes count (the room round the scene).
 */
export function clipCheck(ws, { from = 0, to = 8, step = 0.1, env = [] } = {}) {
  const P = ws.rig, targets = [];
  const take = (o) => o?.traverse((m) => { if (m.isMesh && !m.userData.touch && !m.userData.floor && !under(m, P.root)) targets.push(m); });
  take(ws.props);
  env.forEach(take);
  const found = new Map();
  for (let t = from; t <= to + 1e-9; t += step) {
    ws.update(t, true);
    ws.group.updateMatrixWorld(true);
    for (const o of env) o.updateMatrixWorld(true);
    const impact = ws.impact ? ws.group.localToWorld(ws.impact.clone()) : null;
    for (const [part, a, b] of segments(ws)) {
      const len = a.distanceTo(b);
      if (len < 1e-4) continue;
      for (const [p, q] of [[a, b], [b, a]]) {
        ray.set(p, q.clone().sub(p).normalize());
        ray.near = 0; ray.far = len;
        const hit = ray.intersectObjects(targets, false).find((h) => !(impact && h.point.distanceTo(impact) < IMPACT_OK));
        if (!hit) continue;
        const key = `${part}|${hit.object.uuid}`;
        if (!found.has(key)) found.set(key, { part, t: Math.round(t * 100) / 100, mesh: hit.object.name || hit.object.geometry.type });
        break;
      }
    }
  }
  return [...found.values()];
}

/** Every work scene: each job's variants ('job:variant', sim/scenes.js VARIANTS), the jobs with one scene ('job'), and the
 * other configs of JOB_SCENES ('job:variant'). */
export function allScenes() {
  const out = new Set();
  for (const [job, vs] of Object.entries(VARIANTS)) for (const v of vs) out.add(`${job}:${v}`);
  for (const k of Object.keys(JOB_SCENES)) if (!k.includes(':') ? !VARIANTS[k] : true) out.add(k);
  return [...out];
}
