// Job requests from comments ("can I work at the tavern?"). The comment text is read once for these
// keywords and then discarded; only the resulting job ids are kept. A job the kingdom has not unlocked
// yet makes the villager an apprentice, promoted when the tier is reached.
import { TIERS, JOBS, tiersReached } from './tiers.js';

// [regex, job] — matched anywhere in the comment (English and Italian); order of appearance in the
// comment decides preference, so "commander, or else a fletcher" tries the commander first
const KEYWORDS = [
  [/tool\s*smith|\btools?\b|attrezz|utensil/, 'toolsmith'],
  [/black\s*smith|\bsmith\b|\bforge\b|\banvil|fabbro/, 'blacksmith'],
  [/\bbrew|\bmead\b|\bale\b|\bbeer|\bbirr|idromele/, 'brewer'],
  [/tavern|\binn\b|innkeeper|bar\s*keep|bartender|taverna|\boste\b/, 'innkeeper'],
  [/warrior|\bfighter|\bsword|\bwarlord|guerrier|combattent|spadaccin/, 'warrior'],
  [/\bbeggar|\bdrunk|\bdrink|sit all day|mendicant|ubriac/, 'beggar'],
  [/weirdo|\bweird\b|\bfool\b|crazy|lunatic|\bscemo|\bmatto/, 'weirdo'],
  [/jester|\bclown|juggl|giullare|buffone/, 'jester'],
  [/fletcher|\barrow|\bbowyer|\barcher|\bbow\b|frecce|arciere/, 'fletcher'],
  [/\bknight|\bsir\b|cavaliere|commander|general|\barmy|captain/, 'knight'],
  [/\bguard|watchman|soldier|guardia|soldato/, 'guard'],
  [/chapel|church|cathedral|cappella|chiesa/, 'stonemason'],
  [/stone\s*mason|\bmason|\bstone|scalpellin|muratore/, 'stonemason'],
  [/carpenter|\bbuilder|falegname|carpentiere/, 'carpenter'],
  [/\bpriest|\bmonk|\bfriar|prete|frate|monaco/, 'priest'],
  [/\bbaker|\bbread|\bbake|fornaio|\bpane\b/, 'baker'],
  [/\bmill(er)?\b|mugnaio|mulino/, 'miller'],
  [/fisher|\bfish|pescator|\bpesca/, 'fisherman'],
  [/wood\s*cutter|lumber|\baxe\b|\bwood\b|taglialegna|boscaiolo/, 'woodcutter'],
  [/\bfarm(?!ing tools?)|\bcrops?\b|contadin|agricolt/, 'farmer'],
  [/merchant|\btrader|\bshop|mercante|negozi/, 'merchant'],
  [/\bsailor|\bpirate|marinaio|pirata/, 'sailor'],
  [/\bbard\b|\bsing|\bmusic|\blute|bardo|cantante/, 'bard'],
  [/scholar|\bscribe|librar|studioso/, 'scholar'],
  [/doctor|healer|physician|medico|guaritore/, 'physician'],
  [/alchemist|wizard|\bmage\b|sorcer|alchimista|mago/, 'alchemist'],
  [/\blord\b|landlord|\bnoble|\bduke|\bbaron|nobile|signore/, 'noble'],
  [/\bmayor|sindaco/, 'mayor'],
  [/executioner|headsman|\bboia\b|carnefice|giustiziere/, 'executioner'],
  [/town\s*crier|\bcrier\b|\bherald|banditore|araldo|messaggero/, 'crier'],
];

// "maybe later, when there are proper guards" is a wish for the kingdom, not a job request
const WISH = /\b(when|once|until|till|if|after)\s+(there|we|they|you|the kingdom|it)\b[^.!?,]*$|\bquando\s+ci\s+sar[àa]nno?\b[^.!?,]*$/;

/** Requested jobs in the order they appear in the comment (no duplicates). */
export function wantsFromText(text) {
  const t = String(text || '').toLowerCase();
  const hits = [];
  for (const [re, job] of KEYWORDS) {
    const g = new RegExp(re.source, 'g');
    for (let m = g.exec(t); m; m = g.exec(t)) {
      if (WISH.test(t.slice(Math.max(0, m.index - 60), m.index))) continue;
      hits.push([m.index, job]);
      break;
    }
  }
  return [...new Set(hits.sort((a, b) => a[0] - b[0]).map((h) => h[1]))];
}

/** Jobs a villager can take today: everything unlocked by the reached tiers, plus the request-only ones. */
export function availableJobs(population) {
  const out = new Set(Object.entries(JOBS).filter(([id, j]) => j.requestOnly && id !== 'apprentice').map(([id]) => id));
  for (const t of tiersReached(Math.max(1, population))) {
    t.unique.forEach((j) => out.add(j));
    Object.keys(t.pool).forEach((j) => out.add(j));
  }
  return out;
}

/** The tier that unlocks a job (for "apprentice until ..."). */
export function tierOfJob(job) {
  return TIERS.find((t) => t.unique.includes(job) || job in t.pool) || null;
}

// "call me Violet", "a carpenter named henry", "can I be a villager called sopita?", "chiamami Pino".
// Only the chosen name is kept (cleaned and checked like any display name in simulate.js).
const NAME_RE = /\b(?:call me|called|named|name me|name (?:one|it|him|her|mine|my villager|a villager)(?: after)?|i(?:'m| am) sir|chiamami|chiamato|chiamata|mi chiamo)\s+["“'‘]?([\p{L}][\p{L}\p{N}_-]{1,20})/iu;
const NOT_NAMES = new Set(['a', 'an', 'the', 'me', 'it', 'one', 'him', 'her', 'please', 'pls', 'plz', 'villager', 'something', 'anything',
  'by', 'like', 'as', 'too', 'now', 'here', 'my', 'mine', 'that', 'this', 'what', 'whatever', 'un', 'una', 'come', 'per', 'favore']);

/** A name the commenter asked for, or null. */
export function nameFromText(text) {
  const m = NAME_RE.exec(String(text || ''));
  if (!m || NOT_NAMES.has(m[1].toLowerCase())) return null;
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
}
