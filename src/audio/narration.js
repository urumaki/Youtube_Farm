// Narration script from the day's diff: template-based with seeded variation, ~60-75 words for 30 s.
import { rng } from '../sim/prng.js';
import { JOBS, BUILDINGS, tavernScene } from '../sim/tiers.js';
import { FROM_IT, GOODS_IT } from '../sim/stories.js';

const T = {
  en: {
    open: [
      (d) => `Day ${d.day} in Subscriber Kingdom.`,
      (d) => `Welcome back to Subscriber Kingdom, day ${d.day}.`,
      (d) => `Subscriber Kingdom, day ${d.day}.`,
    ],
    up1: ['One new villager arrived today!', 'A single brave soul joined the kingdom today!'],
    up: [(n) => `${n} new villagers arrived today!`, (n) => `${n} new faces walked through the gate today!`, (n) => `The kingdom grew by ${n} villagers today!`],
    down1: ['One villager packed their things and left.'],
    down: [(n) => `${n} villagers packed their things and left.`, (n) => `Sad news: ${n} villagers left the kingdom.`],
    same: ['No new faces today, but life goes on.', 'The gate stayed quiet today, yet the kingdom kept busy.'],
    // names are never read aloud (many YouTube names are unreadable); they appear on screen instead
    welcome: [(v) => `Welcome our new ${v.job}!`, (v) => `Please welcome our new ${v.job}!`, (v) => `Say hello to our new ${v.job}!`],
    person: [(v) => `A new ${v.job} settles in.`, (v) => `A new ${v.job} moves in by the road.`],
    comment: ['Comment below, and a villager takes your name.', 'Leave a comment to name a villager.'],
    granted: [(n, j) => (n === 1 ? `A wish was granted: we have a new ${j}!` : `The Lord granted ${n} job requests today!`)],
    apprentice: [(n) => `${n === 1 ? 'One apprentice waits' : `${n} apprentices wait`} for their trade to arrive.`],
    promoted: [(j) => `An apprentice finally becomes a ${j}!`],
    caravan: [(n) => (n === 1 ? 'A traveler arrives with a cart full of belongings!' : `A caravan of ${n} newcomers rolls into town!`)],
    // story events (src/sim/stories.js): named villagers are heroes or comic characters, nobody gets hurt
    story: {
      quarrel: [(e) => `Two villagers are quarrelling in the square over ${OVER_EN[e.over]}!`, (e) => `Trouble in the square: a loud quarrel over ${OVER_EN[e.over]}!`],
      merchants: [(e) => `Merchants from ${e.from} pass through with ${e.goods}.`, (e) => `A merchant caravan from ${e.from} rolls in, selling ${e.goods}.`],
      bandits: [(e) => (e.cast.length ? 'Bandits crept up at dusk, but our heroes chased them away!' : 'Bandits crept up at dusk, but the guards chased them away!'), () => 'Bandits attacked the fields, and ran off empty-handed!'],
      halloween: ['Happy Halloween! The villagers dance in costume around the bonfire.', 'Happy Halloween! Pumpkins glow all around the square tonight.'],
      fire: [(e) => (e.cast.length ? 'Fire! A house is burning, but our heroes lead the buckets and save it!' : 'Fire! A house is burning, but the neighbours put it out with buckets!'), () => 'A roof caught fire today, and the whole street formed a bucket chain!'],
      rebuild: ['The carpenters are already rebuilding the burnt house.', 'Hammers ring on the street: the burnt house is being rebuilt.'],
      wolves: ['Wolves crept out of the forest tonight, but torches sent them running!', 'A pack of wolves howled at the edge of town, then fled from the torches!'],
      storm: ['A storm breaks over the kingdom, and everyone runs for cover!', 'Thunder rolls over the square as the rain pours down!'],
    },
    // everyday shots (src/render/scene/ambient.js)
    ambient: {
      patrol: ['Up on the walls, the guards keep watch.', 'The castle guards walk their rounds.'],
      fields: ['Out in the fields, the farmers work the soil.', 'In the fields, the hoes never rest.'],
    },
    tavern: ['Meanwhile, the tavern is full tonight!', 'Over at the tavern, the mugs are full!', 'At the tavern, the cider is flowing!'],
    houses1: ['A new house rises along the road.', 'Builders finished a fresh new home.'],
    houses: [(n) => `${n} new houses rise along the roads.`, (n) => `Builders raised ${n} new homes.`],
    rebuilt: [(n) => `${n === 1 ? 'An old ruin was' : `${n} old ruins were`} rebuilt.`],
    abandoned: [(n) => `${n === 1 ? 'One house stands' : `${n} houses stand`} empty now.`],
    ruined: [(n) => `${n === 1 ? 'An abandoned house has' : `${n} abandoned houses have`} fallen into ruin.`],
    unlocked: [(b) => `The kingdom has grown enough for ${b}!`, (b) => `Hear ye! Work begins on ${b}!`],
    completed: [(b) => `${cap(b)} is finally complete!`, (b) => `${cap(b)} opens its doors today!`],
    progress: [(b, p) => `${cap(b)} is ${p} percent built.`],
    milestone: [(m) => `We passed ${m} villagers!`],
    goal: [(n, g) => `${n} more villagers until ${g}.`, (n, g) => `Just ${n} more villagers and ${g}.`],
    cta: ['Subscribe to become a villager.', 'Subscribe, and you move in tomorrow.', 'Subscribe to claim your house in the kingdom.'],
    weather: { clear: 'The sun shines over the walls.', cloudy: 'Grey clouds drift over the towers.', fog: 'A thick fog rolls over the moat.', rain: 'Rain drums on every rooftop.', snow: 'Snow settles softly on the roofs.' },
    events: {
      spotlight: (e) => `Meanwhile, our ${JOBS[e.job].label.toLowerCase()} ${e.activity}.`,
      festival: (e) => `Tonight the villagers celebrate ${e.name}!`,
      harvest: () => 'The farmers bring in a golden harvest.',
      fieldwork: () => 'Out in the fields, the farmers are hard at work.',
      market_day: () => 'It is market day, and the square is buzzing.',
      trade: (e) => `Traders arrived from ${e.from} with ${e.goods}.`,
      weather_story: (e) => ({ rain: 'Everyone hurries home through the rain.', snow: 'Children build a snowman by the well.', fog: 'Lanterns glow through the fog.' })[e.weather] || '',
      empty: () => 'The castle waits for its very first villager.',
    },
  },
};

// Italian templates (kept separate for readability)
T.it = {
  open: [(d) => `Giorno ${d.day} a Subscriber Kingdom.`, (d) => `Bentornati a Subscriber Kingdom, giorno ${d.day}.`],
  up1: ['Oggi è arrivato un nuovo abitante!'],
  up: [(n) => `Oggi sono arrivati ${n} nuovi abitanti!`, (n) => `Il regno è cresciuto di ${n} abitanti!`],
  down1: ['Un abitante ha fatto le valigie ed è partito.'],
  down: [(n) => `${n} abitanti hanno lasciato il regno.`],
  same: ['Nessun volto nuovo oggi, ma la vita continua.'],
  welcome: [(v) => `Diamo il benvenuto al nuovo ${v.job}!`, (v) => `Benvenuto al nostro nuovo ${v.job}!`],
  person: [(v) => `Arriva un nuovo ${v.job}.`],
  comment: ['Commenta e un abitante prenderà il tuo nome.'],
  granted: [(n, j) => (n === 1 ? `Desiderio esaudito: abbiamo un nuovo ${j}!` : `Il Signore ha esaudito ${n} richieste oggi!`)],
  apprentice: [(n) => `${n === 1 ? 'Un apprendista aspetta' : `${n} apprendisti aspettano`} il suo mestiere.`],
  promoted: [(j) => `Un apprendista diventa finalmente ${j}!`],
  caravan: [(n) => (n === 1 ? 'Arriva un viandante con il suo carro!' : `Arriva una carovana con ${n} nuovi abitanti!`)],
  story: {
    quarrel: [(e) => `Due abitanti litigano in piazza per ${OVER_IT[e.over]}!`, (e) => `Guai in piazza: una lite furiosa per ${OVER_IT[e.over]}!`],
    merchants: [(e) => `Passano mercanti ${FROM_IT[e.from] || 'da terre lontane'} con ${GOODS_IT[e.goods] || 'merci rare'}.`],
    bandits: [(e) => (e.cast.length ? 'Al tramonto arrivano i banditi, ma i nostri eroi li mettono in fuga!' : 'Al tramonto arrivano i banditi, ma le guardie li mettono in fuga!')],
    halloween: ['Buon Halloween! Gli abitanti ballano in maschera intorno al falò.'],
    fire: [(e) => (e.cast.length ? 'Al fuoco! Una casa brucia, ma i nostri eroi guidano i secchi e la salvano!' : 'Al fuoco! Una casa brucia, ma i vicini la spengono con i secchi!')],
    rebuild: ['I carpentieri ricostruiscono già la casa bruciata.'],
    wolves: ['Stanotte i lupi sono usciti dal bosco, ma le torce li hanno messi in fuga!'],
    storm: ['Una tempesta si abbatte sul regno e tutti corrono al riparo!'],
  },
  ambient: {
    patrol: ['Sulle mura, le guardie fanno la ronda.'],
    fields: ['Nei campi, i contadini lavorano la terra.'],
  },
  tavern: ['Intanto la taverna è piena!', 'In taverna i boccali sono pieni!'],
  houses1: ['Una nuova casa sorge lungo la strada.'],
  houses: [(n) => `${n} nuove case sorgono lungo le strade.`],
  rebuilt: [(n) => `${n === 1 ? 'Una rovina è stata ricostruita' : `${n} rovine sono state ricostruite`}.`],
  abandoned: [(n) => `${n === 1 ? 'Una casa ora è vuota' : `${n} case ora sono vuote`}.`],
  ruined: [(n) => `${n === 1 ? 'Una casa abbandonata è crollata' : `${n} case abbandonate sono crollate`}.`],
  unlocked: [(b) => `Il regno è abbastanza grande per ${b}!`],
  completed: [(b) => `Lavori finiti: ecco ${b}!`],
  progress: [(b, p) => `Lavori per ${b} al ${p} per cento.`],
  milestone: [(m) => `Abbiamo superato ${m} abitanti!`],
  goal: [(n, g) => `Ancora ${n} abitanti e ${g}.`],
  cta: ['Iscriviti per diventare un abitante.', 'Iscriviti e domani avrai la tua casa nel regno.'],
  weather: { clear: 'Il sole splende sulle mura.', cloudy: 'Nuvole grigie passano sulle torri.', fog: 'Una fitta nebbia avvolge il fossato.', rain: 'La pioggia batte sui tetti.', snow: 'La neve si posa sui tetti.' },
  events: {
    spotlight: (e) => `Intanto il nostro ${JOB_IT[e.job]} è al lavoro.`,
    festival: (e) => `Stasera si festeggia ${e.name}!`,
    harvest: () => 'I contadini portano a casa un raccolto dorato.',
    fieldwork: () => 'Nei campi, i contadini lavorano sodo.',
    market_day: () => 'È giorno di mercato e la piazza è piena di gente.',
    trade: () => 'Sono arrivati mercanti da terre lontane.',
    weather_story: () => 'Le lanterne brillano nel grigio.',
    empty: () => 'Il castello aspetta il suo primo abitante.',
  },
};

const BUILDING_IT = {
  well: 'il Pozzo', fields: 'i Campi', sawmill: 'la Segheria', dock: 'il Molo dei pescatori', forge: 'la Forgia', bakery: 'il Forno',
  guardposts: 'la Guardia delle mura', quarry: 'la Cava', market: 'la Piazza del mercato', tavern: 'la Taverna', chapel: 'la Cappella',
  windmill: 'il Mulino', wall2: 'la Seconda cinta', townhall: 'il Municipio', harbor: 'il Porto', cathedral: 'la Cattedrale',
  tournament: 'il Campo del torneo', district_east: 'il Quartiere Est', charter_stone: 'la Pietra della Carta', district_north: 'il Quartiere Nord',
  university: "l'Università", district_south: 'il Quartiere Sud', palace: 'il Palazzo Reale', district_far: 'il Quartiere Lontano',
  lighthouse: 'il Faro', colossus: 'il Colosso degli Iscritti', crier_stand: 'il Palco del Banditore', pillory: 'la Gogna',
};

const JOB_IT = {
  peasant: 'contadino', farmer: 'agricoltore', woodcutter: 'taglialegna', fisherman: 'pescatore', blacksmith: 'fabbro', baker: 'fornaio',
  guard: 'guardia', stonemason: 'scalpellino', merchant: 'mercante', innkeeper: 'oste', priest: 'prete', miller: 'mugnaio',
  carpenter: 'carpentiere', reeve: 'balivo', sailor: 'marinaio', knight: 'cavaliere', bishop: 'vescovo', scholar: 'studioso',
  mayor: 'sindaco', weaver: 'tessitore', physician: 'medico', apothecary: 'speziale', bard: 'bardo', noble: 'nobile',
  chronicler: 'cronista', admiral: 'ammiraglio', fletcher: 'arcaio', weirdo: 'stravagante del paese', beggar: 'mendicante',
  jester: 'giullare', warrior: 'guerriero', toolsmith: 'fabbro di attrezzi', brewer: 'birraio', apprentice: 'apprendista',
  crier: 'banditore', executioner: 'boia',
};

const OVER_EN = { chicken: 'a runaway chicken', goat: 'a stubborn goat', cabbage: 'the last cabbage' };
const OVER_IT = { chicken: 'una gallina scappata', goat: 'una capra testarda', cabbage: "l'ultimo cavolo" };
function plural(j) { return j.endsWith('man') ? j.slice(0, -3) + 'men' : j + 's'; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
const words = (s) => s.split(/\s+/).filter(Boolean).length;

/**
 * @returns {{ sentences: {text:string, role:string}[], text: string, words: number }}
 */
export function buildScript(state, diff, { lang = 'en', seed = state.seed, shots = [] } = {}) {
  const L = T[lang] || T.en;
  const r = rng(seed, 'narration', diff.date, lang);
  const pick = (a) => r.pick(a);
  const bname = (id) => (lang === 'it' ? BUILDING_IT[id] : BUILDINGS[id].label);
  const job = (j) => (lang === 'it' ? JOB_IT[j] : JOBS[j].label.toLowerCase());
  const S = []; // {text, role, priority} lower priority dropped first when too long
  const add = (text, role, priority, about = null) => text && S.push({ text, role, priority, job: about }); // about: the job it names

  add(pick(L.open)(diff), 'open', 9);
  const d = diff.delta;
  // on caravan days the counter already shows "+N villagers" and the caravan sentence says it: the
  // opening stays short enough to end with the caravan shot (4.5 s)
  if ((diff.named || []).length && d >= 0) { /* no delta sentence */ }
  else if (d === 1) add(pick(L.up1), 'delta', 10);
  else if (d > 1) add(pick(L.up)(d.toLocaleString('en-US')), 'delta', 10);
  else if (d === -1) add(pick(L.down1), 'delta', 10);
  else if (d < -1) add(pick(L.down)((-d).toLocaleString('en-US')), 'delta', 10);
  else add(pick(L.same), 'delta', 10);

  // villagers named by commenters today are welcomed by job; otherwise up to two newcomers (special jobs first)
  if ((diff.named || []).length) add(pick(L.caravan)(diff.named.length), 'caravan', 9);
  const granted = (diff.requests || []).filter((q) => q.granted), waiting = (diff.requests || []).filter((q) => !q.granted);
  // the villagers the video shows at work (src/sim/featured.js): the narrator only names jobs on screen
  const featured = diff.featured || null;
  const onScreen = new Set((featured || []).map((f) => f.job));
  const g0 = granted.find((q) => onScreen.has(q.job)) || granted[0];
  if (granted.length) add(pick(L.granted)(granted.length, job(g0.job)), 'requests', 9, g0.job);
  if (waiting.length) add(pick(L.apprentice)(waiting.length), 'requests', 6);
  if ((diff.promoted || []).length) add(pick(L.promoted)(job(diff.promoted[0].job)), 'requests', 8, diff.promoted[0].job);
  const welcomed = featured ? (diff.named || []).filter((v) => featured.some((f) => f.today && f.job === v.job)) : (diff.named || []).slice(0, 3);
  const byJob = featured ? featured.filter((f) => f.today).map((f) => f.job).slice(0, 2) : [...new Set(welcomed.map((v) => v.job))].slice(0, 2);
  byJob.forEach((j, i) => {
    const n = welcomed.filter((v) => v.job === j).length;
    const text = n > 1 && lang === 'en' ? `Welcome our ${n === 2 ? 'two' : 'three'} new ${plural(job(j))}!` : pick(L.welcome)({ job: job(j) });
    add(text, 'person', 9 - i, j);
  });
  if (!(diff.named || []).length) {
    const special = diff.added.filter((v) => !['farmer', 'peasant'].includes(v.job));
    const shown = [...special, ...diff.added.filter((v) => !special.includes(v))].slice(0, special.length ? 2 : 1);
    shown.forEach((v, i) => add(pick(L.person)({ job: job(v.job) }), 'person', 6 - i, v.job));
  }
  if (diff.story && L.story[diff.story.id]) { const f = pick(L.story[diff.story.id]); add(typeof f === 'function' ? f(diff.story) : f, 'story', 9); }
  // the tavern interior is shown on these days (see makePlan in src/render/scene/timeline.js)
  // shots: the renderer's shot plan, when known (an everyday shot gets a short line)
  const amb = shots.find((c) => c.kind === 'ambient');
  if (amb && L.ambient[amb.id]) add(pick(L.ambient[amb.id]), 'ambient', 4);
  if (tavernScene(state)) add(pick(L.tavern), 'tavern', 6);
  const nb = diff.housesBuilt.length;
  if (nb === 1) add(pick(L.houses1), 'houses', 5);
  else if (nb > 1) add(pick(L.houses)(nb.toLocaleString('en-US')), 'houses', 5);
  if (diff.housesRebuilt.length) add(pick(L.rebuilt)(diff.housesRebuilt.length), 'rebuilt', 5);
  for (const b of diff.buildingsStarted.slice(0, 2)) add(pick(L.unlocked)(bname(b)), 'unlocked', 8);
  for (const b of diff.buildingsCompleted.slice(0, 2)) add(BUILDINGS[b].plural ? (lang === 'it' ? 'I campi sono pronti per la semina!' : 'The fields are ready to sow!') : pick(L.completed)(bname(b)), 'completed', 8);
  if (diff.housesAbandoned.length) add(pick(L.abandoned)(diff.housesAbandoned.length), 'abandoned', 7);
  if (diff.housesRuined.length) add(pick(L.ruined)(diff.housesRuined.length), 'ruined', 7);
  const milestone = diff.events.filter((e) => e.type === 'milestone').at(-1); // the biggest one passed today
  if (milestone) add(pick(L.milestone)(milestone.value.toLocaleString('en-US')), 'milestone', 7);
  const story = !diff.story && diff.events.find((e) => L.events[e.type]); // a story event replaces the flavor line
  if (story) add(L.events[story.type](story), 'event', 4);
  const prog = diff.events.find((e) => e.type === 'construction' && !diff.buildingsStarted.includes(e.building));
  if (prog) add(pick(L.progress)(bname(prog.building), Math.round(prog.progress * 100)), 'progress', 3);
  add(L.weather[diff.weather], 'weather', 2);
  if (diff.next) {
    const g = lang === 'it' ? goalIt(diff.next) : diff.next.goal;
    add(pick(L.goal)(diff.next.remaining.toLocaleString('en-US'), g), 'goal', 8);
  }
  add(pick(L.cta), 'cta', 10);
  add(pick(L.comment), 'comment', 7);
  if (S.reduce((n, x) => n + words(x.text), 0) < 60) {
    const pop = state.subscriberCount.toLocaleString('en-US');
    add(lang === 'it' ? `Il regno ora conta ${pop} anime.` : `The kingdom now counts ${pop} souls.`, 'weather', 2);
  }

  // fit to ~60-75 words: drop the lowest-priority sentences until short enough
  // same order as the shots: caravan, new buildings, villagers at work, then the rest
  // the comment invitation comes with the named villagers (tavern), so the goal and the call to action keep the end
  const order = ['open', 'delta', 'caravan', 'story', 'completed', 'unlocked', 'requests', 'count', 'person', 'ambient', 'tavern', 'comment', 'houses', 'rebuilt', 'abandoned', 'ruined', 'milestone', 'event', 'progress', 'weather', 'goal', 'cta'];
  S.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  while (S.reduce((n, s) => n + words(s.text), 0) > 68) {
    const victim = [...S].sort((a, b) => a.priority - b.priority)[0];
    if (victim.priority >= 9) break;
    S.splice(S.indexOf(victim), 1);
  }
  const text = S.map((s) => s.text).join(' ');
  return { sentences: S.map(({ text, role, job: about }) => ({ text, role, ...(about ? { job: about } : {}) })), text, words: words(text) };
}

// Which shot each kind of sentence talks about (see makePlan in src/render/scene/timeline.js).
const SHOT_OF = {
  story: (c) => c.kind === 'event', completed: (c) => c.kind === 'building', unlocked: (c) => c.kind === 'building',
  requests: (c) => c.kind === 'villager', person: (c) => c.kind === 'villager', tavern: (c) => c.kind === 'tavern', comment: (c) => c.kind === 'tavern', ambient: (c) => c.kind === 'ambient',
  houses: (c) => c.kind === 'house', rebuilt: (c) => c.kind === 'house', abandoned: (c) => c.kind === 'loss', ruined: (c) => c.kind === 'loss',
};
// fixed parts of the video: the wide shot with the goal (23.5 s) and the call to action (27 s)
const FIXED_AT = { goal: 23.7, cta: 27.1 };

/**
 * Video time at which each sentence should start, so the narrator talks about what is on screen:
 * the first sentence about a shot waits for that shot. null = right after the previous sentence.
 * cues: the shots from the renderer ([{kind, t0, t1}]).
 */
export function sentenceAnchors(sentences, cues = []) {
  const used = new Set();
  return sentences.map((s) => {
    if (FIXED_AT[s.role] !== undefined) return FIXED_AT[s.role];
    const match = SHOT_OF[s.role];
    // a sentence naming a job waits for that villager's shot; otherwise the next shot of its kind
    // a sentence naming a job waits for that villager's shot (and for no other); otherwise the next shot of its kind
    const cue = match && (s.job && (s.role === 'person' || s.role === 'requests')
      ? cues.find((c) => match(c) && c.job === s.job && !used.has(c))
      : cues.find((c) => match(c) && !used.has(c)));
    if (!cue) return null;
    used.add(cue);
    return cue.t0 + 0.25;
  });
}

function goalIt(next) {
  const b = { woodfolk: 'arriva il Taglialegna', crafts: 'arriva il Fabbro', guard: 'la Guardia sale sulle mura', market: 'apre il Mercato', crier: 'il Banditore suona la campana', justice: 'il Boia prende la scure', faith: 'suona la campana della Cappella', walled: 'sorge la Seconda cinta', harbor: 'apre il Porto', charter: 'si firma la Carta della città', north: 'nasce il Quartiere Nord', learned: "apre l'Università", royal: 'si costruisce il Palazzo Reale', maritime: 'si accende il Faro', legend: 'si innalza il Colosso' };
  return b[next.tier] || next.goal;
}
