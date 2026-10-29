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
  [/\bbeggar|\bdrunk|\bdrink|sit all day|mendicant|ubriac|homeless|senza\s*tetto|vagabond|\btramp\b/, 'beggar'],
  [/weirdo|\bweird\b|\bfool\b|crazy|lunatic|\bscemo|\bmatto|\bidiot|nitwit/, 'jester'],
  [/jester|\bclown|juggl|giullare|buffone/, 'jester'],
  [/fletcher|\barrow|\bbowyer|\barcher|\bbow\b|frecce|arciere/, 'fletcher'],
  // owner 2026-10-28: a Knight, a Cavalier and the Captain of the Guard are only won at the tournaments, so asking makes a guard
  // (2026-10-29: "teutonic Kinght", paladin, "chief of war")
  [/\bknight|\bkinght|\bknigth|\bknigt\b|\bpaladin|chief of war|war\s*chief|\bsir\b|cavaliere|commander|general|\barmy|captain|\bofficer|\bufficiale|lieutenant|\bcavalry|\bcalvary|crusader|crociat|\bjoust|giostr|hus+[sz]+ar|huzz?air|ussar/, 'guard'],
  [/\bguard|watchman|soldier|\bsol+[ie]+d[ie]*e?r|soilder|\bsolder\b|guardia|soldato|\bg+a+u+r+d|\bgard\b|mercenar|\bscout|police|polizi|sergea?nt|sarg[ea]nt|militia|\bsentry|sentinel/, 'guard'],
  [/chapel|church|cathedral|cappella|chiesa/, 'stonemason'],
  [/stone\s*mason|\bmason|\bstone|scalpellin|muratore|architect|architett|city\s*planner/, 'stonemason'],
  [/carpenter|\bbuilder|falegname|carpentiere|craftsman|craftsmen|artisan|artigian/, 'carpenter'],
  [/\bbishop|vescovo/, 'bishop'],
  [/\bpriest|\bmonk|\bfriar|prete|frate|monaco/, 'priest'],
  [/\bbaker|\bbread|\bbake|fornaio|\bpane\b/, 'baker'],
  [/\bmill(er)?\b|mugnaio|mulino/, 'miller'],
  [/fisher|\bfish|pescator|\bpesca|harbou?r|\bdocks?\b|\bporto\b/, 'fisherman'],
  [/wood\s*cutter|lumber|\baxe\b|\bwood\b|taglialegna|boscaiolo/, 'woodcutter'],
  [/\bfarm(?!ing tools?)|\bcrops?\b|contadin|agricolt/, 'farmer'],
  [/\bpeasant|bracciant|\bcitizen|cittadin|commoner|gardener|grounds?\s*keeper|groudnskeeper|giardinier/, 'peasant'],
  // the banker is a money changer until the Bank (2026-10-29)
  [/merchant|\bbanker|banchier|money\s*(changer|lender)|\btrader|\bshop|mercante|negozi|head of trade|\btrade\b|(?<!news\s?paper\s)\bseller|\bvendor|venditor|grocer|store\s*man+a?ger|shop\s*keeper/, 'merchant'],
  [/\bsailor|\bpirate|marinaio|pirata/, 'fisherman'],
  [/\bbard\b|\bsing|\bmusic|\blute|bardo|cantante/, 'bard'],
  [/scholar|\bscribe|librar|studioso|scientist|physicist|scienziat|inventor|professor|professore/, 'scholar'],
  [/doctor|healer|physician|medico|guaritore/, 'physician'],
  [/apothecar|\bapo\w*th\w*ry|alchemist|alchimista|\bchemist|\bchimico|speziale|farmacist|\bremed|rimedi|herbalist|erborist/, 'apothecary'], // medieval only: no wizards (owner)
  // running the town was the reeve's job (the council, politics, the law); owner 2026-10-23: the tax collector's now
  [/\breeve\b|\bcouncil\b|administrat|politic|\bofficial\b|steward|\bclerk|lawyer|attorney|\bjudge|magistrat|avvocat|giudice/, 'taxcollector'],
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
  // no noble titles as jobs (owner): a lord or a landlord collects the taxes. "My lord", "my noble lord" and "signore" alone
  // are how people speak to the king, not a request (2026-10-29: "Hello my Lord, may I be a guard" made a tax collector)
  [/tax\s*collector|\btax(man|es)?\b|esattore|gabellier|\btasse\b|\b(a|an|be|become)\s+(lord|noble(man|woman)?)\b|\bnoble(man|woman)\b|landlord|\bduke|\bbaron|\b(un|essere|diventare)\s+(nobile|signore)\b/, 'taxcollector'],
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
  [/town\s*crier|\bcrier\b|\bherald|banditore|araldo|messaggero|messenger|courier|doomsayer|announcer|annunciator|news\s*(paper|boy|seller)|giornal/, 'crier'],
  // new jobs asked for in the comments up to 2026-10-25 (owner 2026-10-25, by request only)
  [/teacher|\btutor|school\s*master|insegnant|\bmaestr[oa]\b/, 'teacher'],
  [/philosoph|\bthinker|filosof/, 'philosopher'],
  // the medieval surgeon was the barber (2026-10-29: "sawbone", "a surgeon")
  [/\bbarber|barbiere|hair\s*(cutter|dresser)|saw\s*bones?\b|surgeon|chirurg/, 'barber'],
  [/astronom|astrolog|stargaz|star\s*gaz/, 'astronomer'],
  [/stable\s*(hand|boy|keeper|master|man)|\bstables\b|ostler|stallier|\bscuderi|horse\s*(keeper|tender|groom)|carriage|coach\s*(man|driver)|wagon\s*(driver|master)|\bwagoner|cocchier|carrettier/, 'stablehand'],
  [/advis[eo]r|counsell?or|consiglier/, 'adviser'],
  // owner 2026-10-29, from "a minor in the cave" and "I be mining" ("mine" alone is the word for mine, not a request)
  [/\bminers?\b|\bmining\b|\bminor in the (cave|mine)|\bquarry\s*man|\bpick\s*axe|minatore|miniera|cavatore/, 'miner'],
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

/** Jobs a villager can take today: everything unlocked by the reached tiers, plus the request-only ones; never an earned one. */
export function availableJobs(population) {
  const out = new Set(Object.entries(JOBS).filter(([id, j]) => j.requestOnly && id !== 'apprentice' && !MERGED[id]).map(([id]) => id));
  for (const t of tiersReached(Math.max(1, population))) {
    t.unique.forEach((j) => out.add(mergedJob(j)));
    Object.keys(t.pool).forEach((j) => out.add(mergedJob(j)));
  }
  for (const j of out) if (JOBS[j].earned) out.delete(j);
  return out;
}

/** The tier that unlocks a job (for "apprentice until ..."). */
export function tierOfJob(job) {
  return TIERS.find((t) => [...t.unique, ...Object.keys(t.pool)].some((j) => mergedJob(j) === job)) || null;
}

// "I can't see myself", "my name wasn't there", "dove sono?": the commenter did not find their villager in
// the last short. Owner (2026-10-21): they come first in the next one (src/sim/featured.js).
// Owner (2026-10-27): so do those asking to be seen, "Day 3 of asking to be a baker", "am I a guard?", "what job do I have",
// "my comments haven't been heard".
const NUM = String.raw`(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)`;
const COMPLAINT_RE = new RegExp([
  String.raw`\bday\W{0,3}${NUM}\W{0,3}((of|for)\s+)?(asking|begging|requesting|waiting|trying|wanting|commenting)\b`, String.raw`\bday\W{0,3}${NUM}\W{0,3}for\b[^.!?]*\?`, String.raw`\b(giorno|day)\s*${NUM}\s+(che|di|in cui)\s+(chiedo|aspetto)\b`,
  /\bam i (a|an|the|still a|still an|in|on|here|there|real|alive|named|shown|even)\b/.source, /\bdo i (exist|have a (job|house|name|villager))\b/.source,
  /\b(what|which)('?s| is| was)? my (job|villager|house|name|role)\b/.source, /\b(what|which) (job|role|work) (do|did|have|am) i\b/.source,
  /\b(no idea|don'?t know|do not know|not sure) (what|which) (job|role|villager)\b/.source,
  /\b(haven'?t|have not|hasn'?t|has not|wasn'?t|was not|weren'?t|were not|not) been (heard|seen|noticed|read|answered|picked|chosen|granted)\b/.source, /\bnever (got |been )?(picked|chosen|granted|answered|noticed)\b/.source, /\bnotice me\b/.source,
  /\b(che|quale) lavoro (ho|faccio|mi)\b/.source, /\bsono (un|una|uno|ancora)\b[^.!?]*\?/.source,
  /\b(can'?t|cannot|can not|couldn'?t|could not|didn'?t|did not|don'?t|do not|never)\s+(see|find|spot)\s+(me|myself|my\b)/,
  /\bwhere\s+(am i|is my|'?s my|are my)\b/, /\bwhere'?s my\b/, /\bwhere('?s| is| was) (me|i)\b/,
  /\bi'?m not (in|there|on)\b/, /\bi (wasn'?t|was not|am not) (in|there|shown|on)\b/, /\bnot (in )?(the|this) (video|short)\b/,
  /\b(no|not|without|missing)\s+my\s+(name|villager)\b/, /\bmy (name|villager)\s+(isn'?t|wasn'?t|is not|was not|never|didn'?t|did not)\b/,
  /\bforgot (about )?me\b/, /\bwhere did my\b/,
  /\bnon mi (vedo|trovo|avete|hai|si vede)\b/, /\bnon (c'?è|c'?era|vedo|trovo|si vede) (il )?mio\b/, /\bdove sono( io)?\b/, /\bio non (ci )?sono\b/, /\bmi (avete|hai) dimenticat/,
].map((r) => (typeof r === 'string' ? r : r.source)).join('|'), 'i');

/** True when the comment says the commenter could not find themselves in the video, or asks to be seen. */
export function complainsFromText(text) {
  return COMPLAINT_RE.test(plainText(text).replace(/[’‘]/g, "'"));
}

// "overthrow the king", "kill the king", "down with the king", "revolution!", "abbasso il re": a would-be rebel. Owner
// (2026-10-27): at most once every 7 days the newest one spends a day in the pillory, pelted with tomatoes (stories.js).
const KING = String.raw`(the |our |this |that |your |his |my |da |le )?(king|kingdom|crown|throne|monarchy|majesty|ruler)`;
const REBEL_RE = new RegExp([
  String.raw`\b(overthrow|over throw|overthrown|overthrowing|kill|killing|murder|assassinate|dethrone|depose|behead|usurp|topple|betray|defeat|destroy|stab|poison|take down|takedown)\s+${KING}\b`,
  String.raw`\bdown with ${KING}\b`, String.raw`\b(steal|take|seize|claim)\s+(the |your |the king'?s |his )?(crown|throne)\b`, String.raw`\bi('?ll| will| shall)\s+be (the )?(new )?king\b`,
  /\b(revolution|revolt|rebellion|rebel|rebels|uprising|insurrection|mutiny|treason|coup|anarchy|regicide|usurper|traitor)\b/.source,
  /\b(uccidere|uccido|ammazzare|ammazzo|rovesciare|rovescio|detronizzare|spodestare|tradire)\s+(il |del )?re\b/.source,
  /\babbasso (il )?re\b/.source, /\b(rivoluzione|ribellione|rivolta|ribelle|ribelli|colpo di stato|tradimento|traditore)\b/.source,
].join('|'), 'i');

// "join", "I join!", "partecipo": the commenter's villager, if a guard, enters the games announced at the Tournament Ground
// (owner 2026-10-28, stories.js). Joining the kingdom, the army or the guard is not entering the games (2026-10-29: "Can I join
// the army" entered them)
const JOIN_RE = /\b(join|joining|partecipo|iscrivimi)\b(?!\s+(as\b|((the|your|this|thy|ur|ya)\s+)?(army|kingdom|village|town|city|realm|guards?|militia|crew|channel|community|people|club|you|ya|u)\b))/i;

/** True when the comment asks to enter the games. */
export function joinFromText(text) {
  return JOIN_RE.test(plainText(text));
}

/** True when the comment talks of overthrowing the king (a rebel for the pillory). */
export function rebelFromText(text) {
  return REBEL_RE.test(plainText(text).replace(/[’‘]/g, "'"));
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
