// The kingdom's vote (owner 2026-11-10, src/sim/stories.js `vote`): on the dais in the market square (proclaim.js) the town
// crier asks the people to choose; the two choices are written at the bottom of the frame and the title says how to vote
// ("Comment !vote A or !vote B"). The next day the crier reads the count, and what won happens the day after.
import { VOTE, voteWinner } from '../../../sim/votes.js';
import { buildProclaim } from './proclaim.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildVote(args) {
  const { story } = args;
  const q = VOTE[story.vote];
  if (!q) return null;
  const st = buildProclaim({ ...args, story: { ...story, title: 'The people decide' } });
  if (!st) return null;
  if (story.step === 'result') {
    const t = story.tally || { a: 0, b: 0 }, w = voteWinner(t), l = w === 'a' ? 'b' : 'a';
    st.banner = t.a + t.b ? 'The people have spoken!' : 'Nobody voted: the King decides!';
    st.footer = t.a + t.b ? `${cap(q[w].label)} wins, ${t[w]} to ${t[l]}! It begins tomorrow` : `${cap(q[w].label)}, tomorrow!`;
  } else {
    st.banner = 'You decide! Comment !vote A or !vote B';
    st.footer = `A: ${cap(q.a.label)} · B: ${cap(q.b.label)}`;
  }
  return st;
}
