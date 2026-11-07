// The King's riddles (owner 2026-11-07, story `riddle` in stories.js): the town crier reads one, and the named scholars
// who answer it right in a comment ("!answer the jester") are made Engineers the next day. Asked in this order, each once
// before any comes again. `re` is the fixed regex the answer is checked with (requests.js `answersFromText`); the comment's
// text itself is never kept.
export const RIDDLES = [
  // the owner's own
  { id: 'jester', text: "I'm colorful and I make noise. If I get something wrong, I don't go back home. Who am I?", answer: 'the jester',
    re: /\b(jester|fool|buffoon|joker|giullare|buffone)s?\b/ },
  { id: 'river', text: 'I run through the whole kingdom but I have no legs. I have a bed but I never sleep. What am I?', answer: 'the river',
    re: /\b(river|stream|fiume|torrente)s?\b/ },
  { id: 'hole', text: 'The miners know me well: the more they take from me, the bigger I grow. What am I?', answer: 'a hole',
    re: /\b(hole|pit|shaft|buco|fossa|pozzo)s?\b/ },
  { id: 'key', text: 'I have teeth but I never bite, and every night I keep the castle shut tight. What am I?', answer: 'a key',
    re: /\b(key|keys|chiave|chiavi)\b/ },
  { id: 'bell', text: 'I hang high in the tower with a tongue but no mouth, and when I am struck the whole town hears me. What am I?', answer: 'the bell',
    re: /\b(bell|bells|campana|campane)\b/ },
  { id: 'candle', text: 'I am tall when I am young and short when I am old, and the scholars read by my light. What am I?', answer: 'a candle',
    re: /\b(candle|candles|candela|candele)\b/ },
];
export const RIDDLE = Object.fromEntries(RIDDLES.map((x) => [x.id, x]));
