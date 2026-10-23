// Job requests from comments ("can I work at the tavern?"). The comment text is read once for these
// keywords and then discarded; only the resulting job ids are kept. A job the kingdom has not unlocked
// yet makes the villager an apprentice, promoted when the tier is reached.
import { TIERS, JOBS, MERGED, tiersReached, mergedJob } from './tiers.js';

// [regex, job] — matched anywhere in the comment (English and Italian); order of appearance in the
// comment decides preference, so "commander, or else a fletcher" tries the commander first
// (more words added 2026-10-23 from the comments of 2026-10-22: typos, weaponsmith, pub, harbour, herbalist...)
const KEYWORDS = [
  [/tool\s*smith|\btools?\b|attrezz|utensil/, 'blacksmith'], // jobs folded together: MERGED in tiers.js
  [/black\s*smith|\bsmith\b|\bforge\b|\banvil|fabbro|weapon\s*(smith|maker)|armou?r(er|smith)|armaiol/, 'blacksmith'],
  [/\bbrew|\bmead\b|\bale\b|\bbeer|\bbirr|idromele/, 'brewer'],
  [/tavern|\binn\b|innkeeper|bar\s*keep|bartender|taverna|\boste\b|\bpub\b/, 'innkeeper'],
  [/warrior|\bfighter|\bsword|\bwarlord|guerrier|combattent|spadaccin/, 'guard'],
  [/\bbeggar|\bdrunk|\bdrink|sit all day|mendicant|ubriac/, 'beggar'],
  [/weirdo|\bweird\b|\bfool\b|crazy|lunatic|\bscemo|\bmatto|\bidiot/, 'jester'],
  [/jester|\bclown|juggl|giullare|buffone/, 'jester'],
  [/fletcher|\barrow|\bbowyer|\barcher|\bbow\b|frecce|arciere/, 'fletcher'],
  [/\bknight|\bsir\b|cavaliere|commander|general|\barmy|captain|\bofficer|\bufficiale|lieutenant|\bcavalry/, 'knight'],
  [/\bguard|watchman|soldier|guardia|soldato|\bg+a+u+r+d|\bgard\b|mercenar|\bscout|police|polizi|sergea?nt|sarg[ea]nt|militia|\bsentry|sentinel/, 'guard'],
  [/chapel|church|cathedral|cappella|chiesa/, 'stonemason'],
  [/stone\s*mason|\bmason|\bstone|scalpellin|muratore|architect|architett|city\s*planner/, 'stonemason'],
  [/carpenter|\bbuilder|falegname|carpentiere/, 'carpenter'],
  [/\bbishop|vescovo/, 'bishop'],
  [/\bpriest|\bmonk|\bfriar|prete|frate|monaco/, 'priest'],
  [/\bbaker|\bbread|\bbake|fornaio|\bpane\b/, 'baker'],
  [/\bmill(er)?\b|mugnaio|mulino/, 'miller'],
  [/fisher|\bfish|pescator|\bpesca|harbou?r|\bdocks?\b|\bporto\b/, 'fisherman'],
  [/wood\s*cutter|lumber|\baxe\b|\bwood\b|taglialegna|boscaiolo/, 'woodcutter'],
  [/\bfarm(?!ing tools?)|\bcrops?\b|contadin|agricolt/, 'farmer'],
  [/\bpeasant|bracciant|gardener|grounds?\s*keeper|groudnskeeper|giardinier/, 'peasant'],
  [/merchant|\btrader|\bshop|mercante|negozi|head of trade|\btrade\b/, 'merchant'],
  [/\bsailor|\bpirate|marinaio|pirata/, 'fisherman'],
  [/\bbard\b|\bsing|\bmusic|\blute|bardo|cantante/, 'bard'],
  [/scholar|\bscribe|librar|studioso|scientist|scienziat|inventor/, 'scholar'],
  [/doctor|healer|physician|medico|guaritore/, 'physician'],
  [/apothecar|alchemist|alchimista|speziale|farmacist|\bremed|rimedi|herbalist|erborist/, 'apothecary'], // medieval only: no wizards (owner)
  // running the town was the reeve's job (the council, politics, the law); owner 2026-10-23: the tax collector's now
  [/\breeve\b|council|administrat|politic|\bofficial\b|steward|\bclerk|lawyer|attorney|\bjudge|magistrat|avvocat|giudice|consiglier/, 'taxcollector'],
  // jobs folded into another (owner 2026-10-23): the weaver into the tailor, the chronicler into the scholar, the admiral into the sailor
  [/\bweaver|\bweav(e|ing)\b|\bloom\b|tessitor|telaio/, 'tailor'],
  [/chronicler|historian|\bhistory\b|cronista|\bstorico/, 'scholar'],
  [/\badmiral|ammiraglio/, 'fisherman'],
  // new jobs asked for in the comments of 2026-10-22 (owner 2026-10-23, by request only)
  [/hunter|\bhunt(ing)?\b|cacciator|\bcaccia\b/, 'hunter'],
  [/butcher|macellai|\bmeat\b/, 'butcher'],
  [/engineer|egineer|ingegner|\bsiege|trebuchet|catapult/, 'engineer'],
  [/shep+h?[ae]rd|\bsheep|rancher|\bgoats?\b|\bbarn\b|livestock|raise animals|\bpastore|pecor|allevator/, 'shepherd'],
  [/\btanner|leather\s*worker|tannery|concia|cuoio/, 'tanner'],
  // no noble titles as jobs (owner): a lord or a landlord collects the taxes
  [/tax\s*collector|\btax(man|es)?\b|esattore|gabellier|\btasse\b|\blord\b|landlord|\bnoble|\bduke|\bbaron|nobile|signore/, 'taxcollector'],
  [/tailor|seamstress|dressmaker|\bsew|sarto|sarta|\bcucir/, 'tailor'],
  [/\bpotter|pottery|\bclay\b|vasaio|ceramic|argilla/, 'potter'],
  [/cobbler|shoe\s*maker|\bshoes?\b|calzolai|scarpe/, 'cobbler'],
  [/\bcooper\b|barrel\s*maker|bottaio/, 'cooper'],
  [/bee\s*keeper|\bbees?\b|\bhoney\b|apicolt|\bmiele\b/, 'beekeeper'],
  [/bell\s*(founder|maker)|fonditore|campanar/, 'bellfounder'],
  [/clock\s*maker|\bclocks?\b|watch\s*maker|orologi/, 'clockmaker'],
  [/rat\s*catcher|\brats?\b|acchiappatopi|\btopi\b|\bratti\b/, 'ratcatcher'],
  [/chimney\s*sweep|\bsweep|spazzacamin/, 'chimneysweep'],
  [/falcon|\bhawk|falconier|\bfalco\b/, 'falconer'],
  [/\bcook|\bchef\b|\bcuoc[oa]|\bkitchen|\bcucina\b/, 'cook'],
  [/\bmayor|sindaco/, 'taxcollector'],
  [/executioner|headsman|\bboia\b|carnefice|giustiziere/, 'executioner'],
  [/town\s*crier|\bcrier\b|\bherald|banditore|araldo|messaggero|messenger|courier|doomsayer/, 'crier'],
];

// "maybe later, when there are proper guards" is a wish for the kingdom, not a job request
const WISH = /\b(when|once|until|till|if|after)\s+(there|we|they|you|the kingdom|it)\b[^.!?,]*$|\bquando\s+ci\s+sar[àa]nno?\b[^.!?,]*$/;

// Comment text is untrusted input. It is never run, never passed to a shell, a template or a language model:
// only the fixed regexes in this file read it, and then it is dropped. plainText() makes it safe to scan: a
// bounded length (no slow regex on a 10,000-character comment) and no control or format characters (zero-width
// spaces, bidi overrides) that could hide a word from the keywords or flip how a name is shown.
const MAX_TEXT = 2000;
export function plainText(raw) {
  return String(raw ?? '').slice(0, MAX_TEXT * 2).normalize('NFKC').replace(/[\p{Cf}\p{Co}\p{Cs}]+/gu, '').replace(/\p{Cc}+/gu, ' ').slice(0, MAX_TEXT);
}

/** Requested jobs in the order they appear in the comment (no duplicates). */
export function wantsFromText(text) {
  const t = plainText(text).toLowerCase();
  // the name asked for is not a job: "call me Hunter, I want to bake" asks for the baker
  const n = NAME_RE.exec(t);
  const nameAt = n ? [n.index + n[0].length - n[1].length, n.index + n[0].length] : [-1, -1];
  const hits = [];
  for (const [re, job] of KEYWORDS) {
    const g = new RegExp(re.source, 'g');
    for (let m = g.exec(t); m; m = g.exec(t)) {
      if (m.index >= nameAt[0] && m.index < nameAt[1]) continue;
      if (WISH.test(t.slice(Math.max(0, m.index - 60), m.index))) continue;
      hits.push([m.index, job]);
      break;
    }
  }
  return [...new Set(hits.sort((a, b) => a[0] - b[0]).map((h) => h[1]))];
}

/** Jobs a villager can take today: everything unlocked by the reached tiers, plus the request-only ones. */
export function availableJobs(population) {
  const out = new Set(Object.entries(JOBS).filter(([id, j]) => j.requestOnly && id !== 'apprentice' && !MERGED[id]).map(([id]) => id));
  for (const t of tiersReached(Math.max(1, population))) {
    t.unique.forEach((j) => out.add(mergedJob(j)));
    Object.keys(t.pool).forEach((j) => out.add(mergedJob(j)));
  }
  return out;
}

/** The tier that unlocks a job (for "apprentice until ..."). */
export function tierOfJob(job) {
  return TIERS.find((t) => [...t.unique, ...Object.keys(t.pool)].some((j) => mergedJob(j) === job)) || null;
}

// "I can't see myself", "my name wasn't there", "dove sono?": the commenter did not find their villager in
// the last short. Owner (2026-10-21): they come first in the next one (src/sim/featured.js).
const COMPLAINT_RE = new RegExp([
  /\b(can'?t|cannot|can not|couldn'?t|could not|didn'?t|did not|don'?t|do not|never)\s+(see|find|spot)\s+(me|myself|my\b)/,
  /\bwhere\s+(am i|is my|'?s my|are my)\b/, /\bwhere'?s my\b/, /\bwhere('?s| is| was) (me|i)\b/,
  /\bi'?m not (in|there|on)\b/, /\bi (wasn'?t|was not|am not) (in|there|shown|on)\b/, /\bnot (in )?(the|this) (video|short)\b/,
  /\b(no|not|without|missing)\s+my\s+(name|villager)\b/, /\bmy (name|villager)\s+(isn'?t|wasn'?t|is not|was not|never|didn'?t|did not)\b/,
  /\bforgot (about )?me\b/, /\bwhere did my\b/,
  /\bnon mi (vedo|trovo|avete|hai|si vede)\b/, /\bnon (c'?è|c'?era|vedo|trovo|si vede) (il )?mio\b/, /\bdove sono( io)?\b/, /\bio non (ci )?sono\b/, /\bmi (avete|hai) dimenticat/,
].map((r) => r.source).join('|'), 'i');

/** True when the comment says the commenter could not find themselves in the video. */
export function complainsFromText(text) {
  return COMPLAINT_RE.test(plainText(text).replace(/[’‘]/g, "'"));
}

// "call me Violet", "a carpenter named henry", "can I be a villager called sopita?", "chiamami Pino".
// Only the chosen name is kept (cleaned and checked like any display name in simulate.js).
const NAME_RE = /\b(?:call me|called|named|name me|name (?:one|it|him|her|mine|my villager|a villager)(?: after)?|i(?:'m| am) sir|chiamami|chiamato|chiamata|mi chiamo)\s+["“'‘]?([\p{L}][\p{L}\p{N}_-]{1,20})/iu;
const NOT_NAMES = new Set(['a', 'an', 'the', 'me', 'it', 'one', 'him', 'her', 'please', 'pls', 'plz', 'villager', 'something', 'anything',
  'by', 'like', 'as', 'too', 'now', 'here', 'my', 'mine', 'that', 'this', 'what', 'whatever', 'un', 'una', 'come', 'per', 'favore']);

/** A name the commenter asked for, or null. */
export function nameFromText(text) {
  const m = NAME_RE.exec(plainText(text));
  if (!m || NOT_NAMES.has(m[1].toLowerCase())) return null;
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
}
