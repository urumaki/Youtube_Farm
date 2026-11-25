// node tests/helpers/worklist.js [filter] — every work scene's clip check, one line per scene with crossings (Task 4's worklist)
import { clipCheck, allScenes } from '../../src/render/scene/clipcheck.js';
import { checkScene } from './scene.js';
const only = process.argv[2];
let bad = 0, n = 0;
for (const key of allScenes()) {
  if (only && !key.includes(only)) continue;
  const [job, variant = null] = key.split(':');
  n++;
  try {
    const { ws, env } = await checkScene(job, variant);
    const hits = clipCheck(ws, { env });
    if (hits.length) { bad++; console.log(key.padEnd(24), hits.map((h) => `${h.part}@${h.t}:${h.mesh}[${h.at}]`).join(' ')); }
  } catch (e) { bad++; console.log(key.padEnd(24), 'ERROR', e.message.split('\n')[0]); }
}
console.log(`${bad} of ${n} scenes to fix`);
