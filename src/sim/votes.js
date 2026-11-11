// The kingdom's votes (owner 2026-11-10, story `vote` in stories.js): the town crier asks the people to choose between two
// things, every commenter votes once with "!vote A" or "!vote B" (requests.js `voteFromText`, a fixed regex: the comment's
// text is never kept), and the next day the crier reads the count. What wins happens the day after: `story` is the story
// event it starts (one of a single day). Asked in this order, each once before any comes again.
export const VOTES = [
  { id: 'feast', a: { label: 'a pie eating contest', story: 'pies' }, b: { label: 'a boat race', story: 'regatta' } },
  { id: 'sport', a: { label: 'a tug of war', story: 'tugofwar' }, b: { label: 'a pie eating contest', story: 'pies' } },
  { id: 'games', a: { label: 'a boat race', story: 'regatta' }, b: { label: 'a tug of war', story: 'tugofwar' } },
];
export const VOTE = Object.fromEntries(VOTES.map((v) => [v.id, v]));

/** The side that won: the most votes, A when they are level (or when nobody voted: the King decides). */
export const voteWinner = (tally) => ((tally?.b ?? 0) > (tally?.a ?? 0) ? 'b' : 'a');
