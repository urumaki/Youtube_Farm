// Job requests from comments ("can I work at the tavern?"). The comment text is read once for these
// keywords and then discarded; only the resulting job ids are kept. A job the kingdom has not unlocked
// yet makes the villager an apprentice, promoted when the tier is reached.
import { TIERS, JOBS, tiersReached } from './tiers.js';

// [regex, job] — matched anywhere in the comment (English and Italian); order of appearance in the
// comment decides preference, so "commander, or else a fletcher" tries the commander first
const KEYWORDS = [
  [/black\s*smith|\bsmith\b|\bforge\b|\banvil|fabbro/, 'blacksmith'],
  [/tavern|\binn\b|innkeeper|bar\s*keep|bartender|brew|taverna|\boste\b/, 'innkeeper'],
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
  [/\bfarm|\bcrops?\b|contadin|agricolt/, 'farmer'],
  [/merchant|\btrader|\bshop|mercante|negozi/, 'merchant'],
  [/\bsailor|\bpirate|marinaio|pirata/, 'sailor'],
  [/\bbard\b|\bsing|\bmusic|\blute|bardo|cantante/, 'bard'],
  [/scholar|\bscribe|librar|studioso/, 'scholar'],
  [/doctor|healer|physician|medico|guaritore/, 'physician'],
  [/alchemist|wizard|\bmage\b|sorcer|alchimista|mago/, 'alchemist'],
  [/\blord\b|landlord|\bnoble|\bduke|\bbaron|nobile|signore/, 'noble'],
  [/\bmayor|sindaco/, 'mayor'],
];

/** Requested jobs in the order they appear in the comment (no duplicates). */
export function wantsFromText(text) {
  const t = String(text || '').toLowerCase();
  const hits = [];
  for (const [re, job] of KEYWORDS) {
    const m = re.exec(t);
    if (m) hits.push([m.index, job]);
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
