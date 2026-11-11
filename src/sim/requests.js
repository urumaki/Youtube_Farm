// Job requests from comments ("can I work at the tavern?"). The comment text is read once for these
// keywords and then discarded; only the resulting job ids are kept. A job the kingdom has not unlocked
// yet makes the villager an apprentice, promoted when the tier is reached.
import { TIERS, JOBS, MERGED, tiersReached, mergedJob } from './tiers.js';
import { RIDDLES } from './riddles.js';

// [regex, job] — matched anywhere in the comment (English and Italian); order of appearance in the
// comment decides preference, so "commander, or else a fletcher" tries the commander first
// (more words added 2026-10-23 from the comments of 2026-10-22: typos, weaponsmith, pub, harbour, herbalist...)
const KEYWORDS = [
  [/tool\s*smith|\btools?\b|attrezz|utensil/, 'blacksmith'], // jobs folded together: MERGED in tiers.js
  [/black\s*smith|\bsmith\b|\bforge\b|\banvil|fabbro|weapon\s*(smith|maker)|armou?r(er|smith)|armaiol|(metal|gold|silver|steel|copper|lock)\s*smith|\bsmithy|\bsmithing/, 'blacksmith'],
  [/\bbrew|\bmead\b|\bale\b|(?<!free\s)\bbeer|\bbirr|idromele|winery|wine\s*maker|vintner|moonshine/, 'brewer'],
  [/tavern|\binn\b|innkeeper|bar\s*keep|bartender|taverna|\boste\b|\bpub\b/, 'innkeeper'],
  [/warrior|\bfighter|\bsword|\bwarlord|guerrier|combattent|spadaccin/, 'guard'],
  [/\bbeggar|\bbegger|\bdrunk|\bdrink|sit all day|mendicant|ubriac|homeless|senza\s*tetto|vagabond|\btramp\b|\bhobo/, 'beggar'],
  [/weirdo|\bweird\b|\bfool\b|\bdumb\s+(person|guy|man|one|villager)\b|crazy(?!\s+(begg|drunk|hobo|tramp))|lunatic|\bscemo|\bmatto|\bidiot|nitwit/, 'jester'],
  [/jester|\bclown|juggl|giullare|buffone/, 'jester'],
  [/fletcher|\barrow|\bbowyer|\barcher|\bbow\b(?!\s+(to|before|down|my|our|your)\b)|crossbow|long\s*bow|frecce|arciere/, 'fletcher'],
  // owner 2026-10-28: a Knight, a Cavalier and the Captain of the Guard are only won at the tournaments, so asking makes a guard
  // (2026-10-29: "teutonic Kinght", "kight", "the king's night", paladin, "chief of war", men-at-arms, a defender of the city;
  // "sir" alone is how people speak to the king, "an army engineer" asks for the engineer)
  [/\bknight|\bkinght|\bknigth|\bknigt\b|\bkight\b|king'?s\s+night|\bbe a night\b|\bpaladin|chief of war|war\s*chief|\b(a|be|become)\s+sir\b|men[\s-]+at[\s-]+arms|man[\s-]+at[\s-]+arms|\bmilitary(?!\s*engineer)|\bdefender|protect the (kingdom|city|town|realm)|\bretinue|cavaliere|commander|(?<!\bin\s)\bgeneral\b(?!\s+(store|idea|rule|public))|\barmy(?!\s*engineer)|(?<!(boat|ship|sea)\s?)captain(?!\s+of\s+(a|the)\s+(\w+\s+)?(ship|boat|vessel))|\bofficer|\bufficiale|lieutenant|\bcavalry|\bcalvary|crusa+i?der|crociat|\bjoust|giostr|hus+[sz]+ar|huzz?air|ussar/, 'guard'],
  // (2026-11-04: the jailer keeps the Dungeon, he is a guard)
  // (2026-11-07: "I wish to fight, instead of begging for booze")
  [/\b(want|wish|like|ready|here|eager)\s+to\s+fight\b(?!\s+(the|a|an|that|this|him|her|them|with|against|some|every|his|my|your)\b)/, 'guard'],
  [/\bguard|towns?guard|\bjail[eo]r|\bgaoler|turnkey|dungeon\s*(keeper|master|guard)|carcerier|secondin|\b(flag|standard|banner)\s*bearer|watchman|soldier|\bsol+[ie]+d[ie]*e?r|soilder|\bsolder\b|guardia|soldato|\bg+a+u+r+d|\bgard\b|mercenar|\bscout|police|polizi|sergea?nt|sarg[ea]nt|militia|\bsentry|sentinel/, 'guard'],
  // owner 2026-11-04: a church named as a place ("nailing a paper on the church doors") asks for nothing
  [/(?<!\b(on|at|to|into|near|outside|inside|of|for)\s+(the\s+|a\s+|our\s+|my\s+|your\s+)?)(chapel|church|cathedral|cappella|chiesa)/, 'stonemason'],
  [/stone\s*mason|\bmason|\bstone|scalpellin|muratore|architect|architett|city\s*planner/, 'stonemason'],
  [/carpenter|\bbuilder|falegname|carpentiere|craftsman|craftsmen|craftm[ae]n|artisan|artigian|wood\s*worker|\bcarvers?\b|shipwright|ship\s*builder|furniture\s*maker|\bjoiner|cabinet\s*maker/, 'carpenter'],
  [/\b(arch)?bishop|vescovo/, 'bishop'],
  [/\bpriest|\bpreist|\bmonk|\bfriar|monaster|monastic|\bdeacon|\bnun\b|religious figure|prete|frate|monaco/, 'priest'],
  [/\bbaker|\bbakler|\bbread|\bbake|fornaio|\bpane\b/, 'baker'],
  [/\bmill(er)?\b|mugnaio|mulino/, 'miller'],
  [/fisher|\bfish|pescator|\bpesca|harbou?r|\bdocks?\b|\bporto\b/, 'fisherman'],
  [/wood\s*cutt?er|lumber|\baxe\b|\bwood\b|taglialegna|boscaiolo/, 'woodcutter'],
  // (owner 2026-11-09: "the bandits destroyed my farm, I join the militia" kept a farmer farming: one's own farm is no request)
  [/(?<!\b(my|our|his|their)\s)\bfarm(?!ing tools?)|\bcrops?\b|contadin|agricolt/, 'farmer'],
  [/\bpeasant|bracciant|\bcitizen|cittadin|commoner|gardener|grounds?\s*keeper|groudnskeeper|giardinier|labou?rer/, 'peasant'],
  // the banker is a money changer until the Bank (2026-10-29)
  [/merchant|\bbanker|banchier|money\s*(changer|lender)|\btrader|\bshop|mercante|negozi|head of trade|(?<!ministry of )\btrade\b(?!\s+(and|deals?|relations?|routes?|agreements?|alliances?|partners?))|(?<!news\s?paper\s)\bseller|\bvendor|venditor|grocer|store\s*man+a?ger|shop\s*keeper/, 'merchant'],
  // owner 2026-11-01: the sailor is a job of its own (before, a fisherman)
  [/\bsailor|\bseaman|\bseamen|\bdeck\s*hand|\bpirate|captain of (a|the) (\w+ )?(ship|boat|vessel)|\b(sea|boat|ship)\s*captain|ship'?s captain|marinaio|pirata/, 'sailor'],
  [/\bbard\b|\bsing(s|er|ers|ing)?\b|\bmusic|\blute|bardo|cantante/, 'bard'],
  [/scholar|\bscribe|studioso|scientist|physicist|academic|scienziat|inventor|professor|professore/, 'scholar'],
  // owner 2026-10-30: the librarian is a job of its own (before, a scholar)
  [/librar|bibliotecari|keeper of (the )?books/, 'librarian'],
  [/doctor|healer|physician|medico|guaritore|\bmedic\b|pediatric|clinic/, 'physician'],
  [/apothecar|\bapo\w*th\w*ry|alchemist|alchimista|\bchemist|\bchimico|speziale|farmacist|\bremed|rimedi|herbalist|erborist/, 'apothecary'], // medieval only: no wizards (owner)
  // running the town was the reeve's job (the council, politics, the law); owner 2026-10-23: the tax collector's now
  [/\breeve\b|\bcouncil\b|administrat|(?<!\bno\s)politic|\bofficial\b|steward|\bclerk|lawyer|attorney|\bjudge|magistrat|avvocat|giudice|justiciar|prosecutor|\blawman|\bbailiff/, 'taxcollector'],
  // jobs folded into another (owner 2026-10-23): the weaver into the tailor, the chronicler into the scholar, the admiral into the sailor
  [/\bweaver|\bweav(e|ing)\b|\bloom\b|tessitor|telaio/, 'tailor'],
  [/chronicler|historian|(?<!\b(in|into|of|make|made|makes)\s)\bhistory\b|cronista|\bstorico/, 'scholar'],
  [/\badmiral|ammiraglio/, 'sailor'],
  // new jobs asked for in the comments of 2026-10-22 (owner 2026-10-23, by request only)
  [/hunter|\bhunt(ing)?\b|\bga[mn]e\s*(warden|keeper)|cacciator|\bcaccia\b/, 'hunter'],
  [/butcher|slaughter|macellai|\bmeat\b/, 'butcher'],
  [/engineer|egineer|enginn?e+r|mechanic|ingegner|\bsiege|trebuchet|catapult/, 'engineer'],
  [/shep+h?[ae]rd|\bsheep|\bherd(ing)?\s+(the\s+)?(pigs?|swine|ducks?|geese|goats?|cows?|cattle)|swine\s*herd|goat\s*herd|cow\s*herd|rancher|(?<!\bthe\s)\bgoats?\b|\bbarn\b|livestock|raise animals|\bpastore|pecor|allevator/, 'shepherd'],
  [/\btanner|leather\s*worker|tannery|concia|cuoio/, 'tanner'],
  // no noble titles as jobs (owner): a lord or a landlord collects the taxes. "My lord", "my noble lord" and "signore" alone
  // are how people speak to the king, not a request (2026-10-29: "Hello my Lord, may I be a guard" made a tax collector)
  [/tax\s*collector|\btax(man|es)?\b|esattore|gabellier|\btasse\b|\b(a|an|be|become)\s+(lord|noble(man|woman)?)\b|\bnoble(man|woman)\b|landlord|\bduke|\bbaron|\b(un|essere|diventare)\s+(nobile|signore)\b/, 'taxcollector'],
  [/tailor|seamstress|dressmaker|\bsew|sarto|sarta|\bcucir/, 'tailor'],
  [/\bpotter|pottery|\bclay\b|vasaio|ceramic|argilla/, 'potter'],
  [/cobbler|shoe\s*maker|\bshoes?\b|calzolai|scarpe/, 'cobbler'],
  [/\bcooper\b|barrel\s*maker|bottaio/, 'cooper'],
  [/bee\s*keeper|\bbees?\b|(?<!\bof\s)\bhoney\b|apicolt|\bmiele\b/, 'beekeeper'],
  [/bell\s*(founder|maker)|fonditore|campanar/, 'bellfounder'],
  [/clock\s*maker|\bclocks?\b|watch\s*maker|orologi/, 'clockmaker'],
  [/rat\s*catcher|\brats?\b|acchiappatopi|\btopi\b|\bratti\b/, 'ratcatcher'],
  [/chimney\s*sweep|(?<!(street|road)\s)\bsweep|spazzacamin/, 'chimneysweep'],
  [/falcon|\bhawk|falconier|\bfalco\b/, 'falconer'],
  [/\bcook(?!ed\b)|\bchef\b|\bcuoc[oa]|\bkitchen|\bcucina\b/, 'cook'],
  [/\bmayor|sindaco/, 'taxcollector'],
  [/executioner|headsman|\bboia\b|carnefice|giustiziere/, 'executioner'],
  [/town\s*crier|\bcrier\b|town\s*speaker|\bherald|banditore|araldo|messaggero|messenger|messa?n?ger\b|courier|doomsayer|announcer|annunciator|news\s*(paper|boy|seller)|giornal/, 'crier'],
  // new jobs asked for in the comments up to 2026-10-25 (owner 2026-10-25, by request only)
  [/teacher|\btutor|school\s*master|insegnant|\bmaestr[oa]\b/, 'teacher'],
  [/philosoph|\bthinker|filosof/, 'philosopher'],
  // the medieval surgeon was the barber (2026-10-29: "sawbone", "a surgeon")
  [/\bbarber|barbiere|hair\s*(cutter|dresser)|saw\s*bone|surgeon|chirurg/, 'barber'],
  [/astronom|astrolog|stargaz|star\s*gaz/, 'astronomer'],
  [/stable\s*(hand|boy|keeper|master|man|worker)|\bstables\b|ostler|stallier|\bscuderi|horse\s*(keeper|tender|groom)|carriage|coach\s*(man|driver)|wagon\s*(driver|master)|\bwagoner|cocchier|carrettier/, 'stablehand'],
  [/advis[eo]r|counsell?or|council+or|consiglier/, 'adviser'],
  // owner 2026-10-29, from "a minor in the cave" and "I be mining" ("mine" alone is the word for mine, not a request;
  // 2026-11-04: "the mine worker", "a mine builder")
  // owner 2026-11-04: a thief, a bandit, a usurper... asks for a cell in the Dungeon (from 3250; before, an apprentice)
  [/\bthie(f|ves)|\brobbers?\b|\brob\b|\bbandits?\b|brigand|criminal|\boutlaws?\b|\bcrooks?\b|pickpocket|burglar|smuggler|highwayman|\bpoacher|usurper|traitor|dissident|assassin|\bsteal(ing)?\b|\bprisoner|\bconvict\b|\bjail\b|\bgaol\b|\bdungeon\b|\bladr[oi]\b|brigant|\bbandit[oi]\b|criminal[ei]|fuorilegge|usurpator|traditor|prigionier|galeott|carcerat/, 'prisoner'],
  [/\bminers?\b|\bmining\b|\bmine\s*(worker|builder|digger|hand|labou?rer|man|men|owner)s?\b|\bowner of the mines?\b|\bminor in the (cave|mine)|\b(work|working|job|employment)\s+(in|at|down)\s+(the\s+|a\s+|your\s+)?mines?\b|\bquarry\s*man|\bpick\s*axe|minatore|miniera|cavatore/, 'miner'],
];

// "maybe later, when there are proper guards" is a wish for the kingdom, not a job request
const WISH = /\b(when|once|until|till|if|after)\s+(there|we|they|you|the kingdom|it)\b[^.!?,]*$|\bquando\s+ci\s+sar[àa]nno?\b[^.!?,]*$/;
// "I'm the town crier but can I be a teacher": the job they have, said before asking for another, is not the request
// (2026-11-04: "Im already a baker but... can I also be a blacksmith?")
const NOW_BEFORE = /\b(i'?m|im|i am)\s+(already\s+|still\s+)?(the\s+|a\s+|an\s+)?(town\s+|local\s+)?$/, NOW_AFTER = /^[\w\s'-]{0,25}\bbut\b/;
// owner 2026-11-04, from the comments of 2026-11-03: something on its way to the kingdom is no request ("i sure hope the bee
// hives get here", said by a merchant)
const ARRIVES = /^[\w-]*\s+(\w+\s+)?((get|gets|got|come|comes|is|are)\s+(here|built|finished|ready|done)|arrives?|opens?)\b/;
// owner 2026-11-01, from the comments of 2026-10-31: buying from someone is no request ("can I buy armor from the
// blacksmith", "get a crossbow from the craft smith": a guard was made a blacksmith), nor a question about others ("why is
// a bishop drinking", "where are the stonemasons", "are there ranks for the guards": a guard was made a bishop)
const NOT_ASKED = new RegExp([
  /\bfrom\s+(the\s+|a\s+|an\s+|my\s+|our\s+|your\s+|this\s+|that\s+)?(\w+\s+)?$/.source,
  /\b(buy|purchase|order|borrow|get|have)\s+(a|an|some|the|my|new|me|more)?\s*((?!job|role|position|work|career|chance|spot|place|apprentic)\w+\s+){0,3}$/.source,
  /\b(why|where|when|how|who|what)\s+(is|are|was|were|does|do|did)\s+(a|an|the|my|our|all|those|these|that|this)?\s*(\w+\s+)?$/.source,
  /\b(is|are)\s+there\b[^.!?]*$/.source,
  // owner 2026-11-04, from the comments of 2026-11-03: visiting or robbing someone is no request ("i shall visit the
  // blacksmith for new tools" made a carpenter a blacksmith, "rob a fisherman" made a jester a fisherman), nor a curse at
  // the start of a comment ("BLOODY TAX COLLECTOR" made a rat catcher a tax collector)
  /\b(visit|visits|visited|visiting|rob|robs|robbed|robbing|steal\s+from|raid)\s+(the|a|an|my|our|your|some|all)?\s*(\w+\s+)?$/.source,
  /\bfor\s+(new|more|some|better)\s+(\w+\s+)?$/.source,
  // owner 2026-11-05, from the comments of 2026-11-04: nor is fighting someone ("I wish to fight the knight at the tavern when
  // he's drunk. Or just beg near the other beggars" made a beggar a guard), the rest of that sentence included
  /\b(fight|fighting|beat|punch|duel|challenge)\s+(the|a|an|that|this|some|his|her|every)\b[^.!?]*$/.source,
  /(^|[.!?]\s*)(bloody|damn|damned|stupid|filthy|greedy|cursed|dirty)\s+$/.source,
  // owner 2026-11-07, from the comments of 2026-11-06/07: serving someone ("since I'm serving a Swordmaster" made a guard who
  // asked to be an archer a guard again), sending someone ("send in the knights"), "this bow", "those filthy bandits", and
  // "if any farmers are having problems with rats" (a rat catcher made a farmer) are no requests
  /\b(serve|serves|serving|served|work for|working for|follow|following)\s+(the|a|an|my|our|your)?\s*(\w+\s+)?$/.source,
  /\b(send|sends|sent|sending|summon)\s+(in\s+|out\s+)?(the|a|an|our|my|more|some|your)?\s*(\w+\s+)?$/.source,
  /\b(this|that|these|those)\s+(\w+\s+)?$/.source, /\bany\s+(\w+\s+)?$/.source,
  // owner 2026-11-09, from the comments of 2026-11-07/09: "an investigation into the guard team", "increase the numbers of
  // guards" are no requests (nor is one's own farm: the farmer's keyword above)
  /\b(investigation|investigate|inquiry|enquiry|look|looking)\s+(into|at)\s+(the\s+|our\s+)?(\w+\s+)?$/.source,
  /\b(numbers?|ranks|size)\s+of\s+(our\s+|the\s+)?(\w+\s+)?$/.source,
  // owner 2026-11-11, from the comments on the day 26 video: the job one leaves is no request ("I would like to quit my job as
  // guard and become a landlord" kept a guard a guard), nor is asking how ("How can I be a Noble?" made a tax collector)
  /\b(quit|quitting|leave|leaving|resign|retire|stop being|no longer)\s+(my\s+|the\s+)?((job|work|post|role|position)\s+)?((as|of|at)\s+)?(a\s+|an\s+|the\s+)?$/.source,
  /\bhow\s+(can|could|do|would|does)\s+(i|we|one|you|someone)\s+(be|become|get|get to be)\s+(a\s+|an\s+|the\s+)?$/.source,
].join('|'));
// a job named as someone else's ("I'll be the executioner's friend"), or as taken ("blacksmith was taken so I want priest"), is
// no request for it (owner 2026-11-07)
const NOT_MINE = /^[\w-]*('s|s')\s/, TAKEN = /^[\w-]*\s+(was|is|were|are)\s+(already\s+)?(taken|full|gone)\b/;
// a thief, a bandit... asks for a cell; the bandits, those thieves (the night raid's, 2026-11-07) are others
const OTHERS = /^(\w+s|ladri|banditi|briganti|criminali|prigionieri|usurpatori|traditori|carcerati|galeotti)\b/;
// ...unless the commenter is one of them ('a band of brigands', 'can i become robbers', 'join the bandits')
const ONE_OF = /\b(band|gang|group|crew|one|leader|member|chief|head|captain|king)\s+of\s+(the\s+|those\s+)?$|\b(be|become|join|joining|am|i'?m|we'?re|we are)\s+(the\s+|a\s+|one\s+of\s+the\s+)?$/;
// ...unless a word like "job" follows the job: "can I get a blacksmith job" asks for the blacksmith
const ADVICE = /\bi\s+(also\s+|would\s+|strongly\s+)?(advise|recommend|suggest)\b|\bmy\s+advice\b|\bin\s+my\s+opinion\b/;
const ASKS = /\b(make\s+me|can\s+i|could\s+i|may\s+i|let\s+me\s+be|i\s+(want|wish|would\s+like|'d\s+like)\s+to\s+(be|become)|i\s+request)\b/;
// Owner 2026-11-10: a comment that only talks about the video ("the tavern looks great", "send him to jail", "this channel
// is the goat") changed the job of the commenter's villager. A commenter who already has a villager changes job only when
// the comment asks (simulate.js: `asks`): a word of asking, or nothing but the job ("blacksmith", "guard now"). A first
// comment still takes the job it names, whatever the wording. A cell in the Dungeon is by request only (owner 2026-11-04):
// the place named alone ("the new dungeon looks amazing") asks for nothing, even in a first comment.
const INTENT = new RegExp([
  /\b(can|could|may|might|shall|should)\s+(i|l|we|u|you)\b/.source, // (\"Can l be a doctor\", a small L)
  /\b(make|made|let|turn|put|throw|lock|send|sign|hire|give|grant|assign|promote|appoint|call|name|count|permit|allow)\s+(me|my)\b/.source,
  /\bi\s*('d|'ll|'m|\s+am|\s+will|\s+would|\s+shall|\s+wanna|\s+want|\s+wish|\s+choose|\s+pick|\s+request|\s+ask|\s+hope|\s+need|\s+take|\s+claim|\s+apply|\s+volunteer|\s+become|\s+be|\s+gotta|\s+must|\s+should)\b/.source,
  /\b(im|id|ill)\s+(a|an|the|be|like|love|now|gonna|going)\b/.source,
  /\b(wanna|want(ing|ed)?\s+to|wish(ing|ed)?\s+to|like\s+to|love\s+to|going\s+to|gonna)\s+(be|become|work|join|change|switch|try)\b/.source,
  /(?<!\b(good|nice|great|amazing|awesome|fine|cool|best)\s)\bjob\b|\b(role|position|profession|occupation|career|apprentice\w*|employment|hired?|request(ing)?|ask(ing|ed)?)\b|\bto\s+(be|become)\s+(a|an|the)\b/.source,
  /\b(pls+|plz+|please|pleas)\b|\b(change|switch|swap|instead|from now on|rather be|me as)\b/.source,
  /\b(voglio|vorrei|posso|fammi|fatemi|rendimi|diventare|lavoro|lavorare|per\s+favore)\b|\b(fare|essere)\s+(il|la|lo|un|una)\b/.source,
].join('|'));
const CELL = /^(jail|gaol|dungeon)$/;
/** True when the comment asks for something (a word of asking), or is too short to be about anything else. */
export function asksFromText(text) {
  const t = plainText(text).toLowerCase().replace(/[’‘]/g, "'");
  return INTENT.test(t) || t.split(/[^\p{L}\p{N}']+/u).filter(Boolean).length <= 2;
}
const JOB_AFTER = /^[\w-]*\s+(job|role|position|apprenticeship|work)\b/;
// "Ordinary citizen, will take a job of hunter": the job named after "a job of", "work as"... is the request, whatever came first
// (2026-11-05: "as the first priest i request to be archbishop": the job after "want / request to be" comes first)
const JOB_OF = /\b(job|work|career|role|position|post)\s+(of|as)\s+(a\s+|an\s+|the\s+)?$|\b(want|wish|request|ask|like|love|hope)\s+to\s+(be|become)\s+(a\s+|an\s+|the\s+)?$|\b(i|we)\s+(now\s+)?(want|choose|pick|take)\s+(a\s+|an\s+|the\s+)?$/;

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
  const t = plainText(text).toLowerCase().replace(/[’‘]/g, "'");
  if (ADVICE.test(t) && !ASKS.test(t)) return [];
  // the name asked for is not a job: "call me Hunter, I want to bake" asks for the baker
  const n = NAME_RE.exec(t);
  const nameAt = n ? [n.index + n[0].length - n[1].length, n.index + n[0].length] : [-1, -1];
  const hits = [], asks = INTENT.test(t);
  for (const [re, job] of KEYWORDS) {
    const g = new RegExp(re.source, 'g');
    for (let m = g.exec(t); m; m = g.exec(t)) {
      if (m.index >= nameAt[0] && m.index < nameAt[1]) continue;
      if (job === 'prisoner' && CELL.test(m[0]) && !asks) continue;
      if (WISH.test(t.slice(Math.max(0, m.index - 60), m.index)) || ARRIVES.test(t.slice(m.index))) continue;
      if (NOW_BEFORE.test(t.slice(Math.max(0, m.index - 20), m.index)) && NOW_AFTER.test(t.slice(m.index))) continue;
      if (NOT_ASKED.test(t.slice(Math.max(0, m.index - 50), m.index)) && !JOB_AFTER.test(t.slice(m.index))) continue;
      if (NOT_MINE.test(t.slice(m.index + m[0].length)) || TAKEN.test(t.slice(m.index + m[0].length)) || (job === 'prisoner' && OTHERS.test(t.slice(m.index)) && !ONE_OF.test(t.slice(Math.max(0, m.index - 30), m.index)))) continue;
      hits.push([JOB_OF.test(t.slice(Math.max(0, m.index - 25), m.index)) ? -1 : m.index, job, m.index]);
      break;
    }
  }
  return [...new Set(hits.sort((a, b) => a[0] - b[0] || a[2] - b[2]).map((h) => h[1]))];
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
// (2026-11-04: "Day 5 Ov asking", "part nine of asking", "still haven't seen my guard self", "I havent seen my name", "Can I be
// in the next one", "have i become a butcher yet", "unsure if I have found employment at the mines")
const COMPLAINT_RE = new RegExp([
  String.raw`\b(day|part)\W{0,3}${NUM}(\s+or\s+${NUM})?\W{0,3}((of|for|ov|off)\s+)?(asking|begging|requesting|waiting|trying|wanting|commenting)\b`, String.raw`\bday\W{0,3}${NUM}\W{0,3}for\b[^.!?]*\?`, String.raw`\b(giorno|day)\s*${NUM}\s+(che|di|in cui)\s+(chiedo|aspetto)\b`,
  /\bam i (a|an|the|still a|still an|in|on|here|there|real|alive|named|shown|even)\b/.source, /\bdo i (exist|have a (job|house|name|villager))\b/.source,
  /\b(what|which)('?s| is| was)? my (job|villager|house|name|role)\b/.source, /\b(what|which) (job|role|work) (do|did|have|am) i\b/.source,
  /\b(no idea|don'?t know|do not know|not sure) (what|which) (job|role|villager)\b/.source,
  /\b(haven'?t|have not|hasn'?t|has not|wasn'?t|was not|weren'?t|were not|not) been (heard|seen|noticed|read|answered|picked|chosen|granted)\b/.source, /\bnever (got |been )?(picked|chosen|granted|answered|noticed)\b/.source, /\bnotice me\b/.source,
  /\b(che|quale) lavoro (ho|faccio|mi)\b/.source, /\bsono (un|una|uno|ancora)\b[^.!?]*\?/.source,
  /\b(can'?t|cannot|can not|couldn'?t|could not|didn'?t|did not|don'?t|do not|never)\s+(see|find|spot)\s+(me|myself|my\b)/,
  /\b(haven'?t|havent|have not|never)\s+(yet\s+)?(seen|found|spotted)\s+(me|myself|my\b)/, /\b(be|appear|put me|show me)\s+in\s+(the\s+)?next\s+(one|video|short|episode|day)\b/,
  // (2026-11-05: "Day 8 or 9 of asking", "Waht abot meee", "I never got my job", "I still wait for an employment in the mines")
  // (2026-11-11: "13. Day of asking for a job", "yo how do I see who I am")
  String.raw`\b${NUM}\W{0,3}(st|nd|rd|th)?\W{0,2}day\s+(of|for)\s+(asking|begging|requesting|waiting|trying|wanting|commenting)\b`,
  /\bhow\s+(do|can|could|would)\s+i\s+(see|find|know|tell|check)\s+(who|where|which|what|if)\b/, /\bwho\s+am\s+i\b/, /\bwhich\s+(one|villager)\s+(am\s+i|is\s+(me|mine))\b/,
  /\bw[ha]{1,3}t\s+ab[ou]{1,2}t\s+me+\b/, /\bnever (got|had|received) (my|a) (job|villager|name|role)\b/, /\bstill wait(ing)? for (an? |my )?(employment|job|work|position|role|villager)\b/,
  /\bhave i (become|been made|been given|got|gotten)\b/, /\b(unsure|not sure|wondering)\s+(if|whether)\s+i\s+(have|am|got|was|'?m)\b/,
  /\bwhere\s+(am i|is my|'?s my|are my)\b/, /\bwhere'?s my\b/, /\bwhere('?s| is| was) (me|i)\b/,
  /\bi'?m not (in|there|on)\b/, /\bi (wasn'?t|was not|am not) (in|there|shown|on)\b/, /\bnot (in )?(the|this) (video|short)\b/,
  /\b(no|not|without|missing)\s+my\s+(name|villager)\b/, /\bmy (name|villager)\s+(isn'?t|wasn'?t|is not|was not|never|didn'?t|did not)\b/,
  /\bforgot (about )?me\b/, /\bstill not (in|on|part of) (the|this|your|ur) (village|kingdom|town|video)\b/, /\bstill (looking|searching) for (myself|me|my villager)\b/, /\bwhere did my\b/,
  /\bnon mi (vedo|trovo|avete|hai|si vede)\b/, /\bnon (c'?è|c'?era|vedo|trovo|si vede) (il )?mio\b/, /\bdove sono( io)?\b/, /\bio non (ci )?sono\b/, /\bmi (avete|hai) dimenticat/,
].map((r) => (typeof r === 'string' ? r : r.source)).join('|'), 'i');

/** True when the comment says the commenter could not find themselves in the video, or asks to be seen. */
export function complainsFromText(text) {
  return COMPLAINT_RE.test(plainText(text).replace(/[’‘]/g, "'"));
}

// "overthrow the king", "kill the king", "down with the king", "revolution!", "abbasso il re": a would-be rebel. Owner
// (2026-10-27): at most once every 7 days the newest one spends a day in the pillory, pelted with tomatoes (stories.js).
const KING = String.raw`(the |our |this |that |your |his |my |da |le )?(king|kingdom|crown|throne|monarchy|majesty|ruler)`;
const UPRISING = String.raw`(revolution|revolt|rebellion|rebel|rebels|uprising|insurrection|mutiny|treason|coup|anarchy|regicide|usurper|traitor)\b`;
const REBEL_RE = new RegExp([
  String.raw`(?<!\b(never|not|n't|dont|wont)\s+(ever\s+)?)\b(overthrow|over throw|overthrown|overthrowing|kill|killing|murder|assassinate|dethrone|depose|behead|usurp|topple|betray|defeat|destroy|stab|poison|take down|takedown|eradicate|conquer|burn down)\s+(the entire |the whole |this whole )?${KING}\b`,
  String.raw`\bdown with ${KING}\b`, String.raw`\b(steal|take|seize|claim)\s+(the |your |the king'?s |his )?(crown|throne)\b`, String.raw`\bi('?ll| will| shall)\s+be (the )?(new )?king\b`,
  // (owner 2026-11-10: the words alone only in a comment of a few words, "revolution!"; in a longer one the commenter says
  // it of themselves, "we start a revolution", not of the video, "the rebels got tomatoes", "this is treason lol")
  String.raw`^\W*(\w+\W+){0,1}${UPRISING}\W*(\w+\W*)?$`,
  String.raw`\b(i|we|let'?s|me)\b[^.!?]{0,40}\b${UPRISING}`,
  String.raw`\b(start|starting|join|joining|begin|lead|leading|plan|planning|plot|plotting|time for|viva la|long live the|call for|need|want)\s+(a |an |the )?${UPRISING}`,
  /\b(uccidere|uccido|ammazzare|ammazzo|rovesciare|rovescio|detronizzare|spodestare|tradire)\s+(il |del )?re\b/.source,
  /\babbasso (il )?re\b/.source, /\b(rivoluzione|ribellione|rivolta|ribelle|ribelli|colpo di stato|tradimento|traditore)\b/.source,
].join('|'), 'i');

// owner 2026-10-29: only "!join", anywhere in the comment ("count me in !join"), enters the commenter's villager, if a guard,
// for the games at the Tournament Ground (simulate.js, stories.js); a plain "join" ("can I join the army") does not
const JOIN_RE = /!join\b/i;

// owner 2026-11-10: "!vote A" or "!vote B" ("!vote 1", "!vote 2") is a vote in the kingdom's vote (stories.js `vote`), one for
// each commenter; only the letter is kept
const VOTE_RE = /!\s*vote\b[:\s-]*(?:for\s+)?(?:option\s+)?([ab12])\b/i;

/** 'a' or 'b' when the comment votes, else null. */
export function voteFromText(text) {
  const m = VOTE_RE.exec(plainText(text));
  return m ? { a: 'a', 1: 'a', b: 'b', 2: 'b' }[m[1].toLowerCase()] : null;
}

/** True when the comment asks to enter the games. */
export function joinFromText(text) {
  return JOIN_RE.test(plainText(text));
}

// owner 2026-11-07: a scholar answers the King's riddle with "!answer" and the answer after it, to the end of the line or
// the next "!" ("!answer the jester!"). Only the riddles' fixed regexes read it (riddles.js), and the answer is taken out
// of the comment before the job and name requests are read, so "!answer the jester" never asks to be a jester
const ANSWER_RE = /!\s*answer\b[:\s-]*([^!\n]{0,80})/gi;

/** The comment without its "!answer ..." parts, and the ids of the riddles those parts answer right. */
export function answerFromText(text) {
  const t = plainText(text);
  const answers = new Set();
  for (const m of t.matchAll(ANSWER_RE)) {
    const said = m[1].toLowerCase();
    for (const q of RIDDLES) if (q.re.test(said)) answers.add(q.id);
  }
  return { rest: t.replace(ANSWER_RE, ' '), answers: [...answers] };
}

/** True when the comment talks of overthrowing the king (a rebel for the pillory). */
export function rebelFromText(text) {
  return REBEL_RE.test(plainText(text).replace(/[’‘]/g, "'"));
}

// "call me Violet", "a carpenter named henry", "can I be a villager called sopita?", "chiamami Pino".
// Only the chosen name is kept (cleaned and checked like any display name in simulate.js).
const NAME_RE = /\b(?:(?:call me|(?<!\bso[\s-])called|named)(?: as)?(?: (?:sir|ser|lady|mr|mrs|miss|dr)\b\.?)?|my name is sir|name me(?: as)?|name (?:one|it|him|her|mine|my villager|a villager)(?: after)?|i(?:'m| am) sir|chiamami|chiamato|chiamata|mi chiamo)\s+["“'‘]?([\p{L}][\p{L}\p{N}_-]{1,20})/iu;
const NOT_NAMES = new Set(['a', 'an', 'the', 'me', 'it', 'one', 'him', 'her', 'please', 'pls', 'plz', 'villager', 'something', 'anything',
  'by', 'like', 'as', 'too', 'now', 'here', 'my', 'mine', 'that', 'this', 'what', 'whatever', 'un', 'una', 'come', 'per', 'favore',
  // named villagers are never villains (owner; 2026-11-04: "a villager named thief")
  // (2026-11-10: "call me maybe", "called out", "named after")
  'maybe', 'out', 'back', 'upon', 'when', 'if', 'so', 'for', 'to', 'in', 'on', 'and', 'or', 'but', 'not', 'your', 'his', 'their', 'our', 'after', 'because',
  'thief', 'robber', 'bandit', 'brigand', 'criminal', 'murderer', 'killer', 'villain', 'crook', 'outlaw', 'assassin', 'ladro', 'brigante']);

/** A name the commenter asked for, or null. */
export function nameFromText(text) {
  const m = NAME_RE.exec(plainText(text));
  if (!m || NOT_NAMES.has(m[1].toLowerCase())) return null;
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
}
