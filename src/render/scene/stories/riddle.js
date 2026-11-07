// The King's riddle (owner 2026-11-07, src/sim/stories.js `riddle`): on the dais in the market square (proclaim.js) the
// town crier reads the riddle, the named scholars in front; the riddle is written at the bottom of the frame and the title
// says how to answer ("Scholars: comment !answer"). The next day the crier reads the answer and the first two scholars who
// solved it stand in front, now Engineers.
import { RIDDLE } from '../../../sim/riddles.js';
import { buildProclaim } from './proclaim.js';

export function buildRiddle(args) {
  const { story } = args;
  const q = RIDDLE[story.riddle];
  if (!q) return null;
  const st = buildProclaim({ ...args, story: { ...story, title: "The King's riddle" } });
  if (!st) return null;
  if (story.step === 'answer') {
    const won = new Set((story.winners || []).map((w) => w.id));
    for (const l of st.labels) if (story.cast.some((c) => won.has(c.id) && c.name === l.title)) l.sub = 'Now an Engineer!';
    st.banner = won.size ? (won.size === 1 ? 'Riddle solved! A new Engineer' : 'Riddle solved! Two new Engineers') : 'Nobody solved the riddle!';
    st.footer = `The answer: ${q.answer}`;
  } else {
    st.banner = "The King's riddle! Scholars: comment !answer";
    st.footer = `"${q.text}"`;
  }
  return st;
}
