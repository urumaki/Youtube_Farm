// Narration script from the day's diff: template-based with seeded variation, ~60-75 words for 30 s.
import { rng } from '../sim/prng.js';
import { JOBS, BUILDINGS } from '../sim/tiers.js';

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
  lighthouse: 'il Faro', colossus: 'il Colosso degli Iscritti',
};

const JOB_IT = {
  peasant: 'contadino', farmer: 'agricoltore', woodcutter: 'taglialegna', fisherman: 'pescatore', blacksmith: 'fabbro', baker: 'fornaio',
  guard: 'guardia', stonemason: 'scalpellino', merchant: 'mercante', innkeeper: 'oste', priest: 'prete', miller: 'mugnaio',
  carpenter: 'carpentiere', reeve: 'balivo', sailor: 'marinaio', knight: 'cavaliere', bishop: 'vescovo', scholar: 'studioso',
  mayor: 'sindaco', weaver: 'tessitore', physician: 'medico', alchemist: 'alchimista', bard: 'bardo', noble: 'nobile',
  chronicler: 'cronista', admiral: 'ammiraglio', fletcher: 'arcaio', weirdo: 'stravagante del paese', beggar: 'mendicante',
  jester: 'giullare', warrior: 'guerriero', toolsmith: 'fabbro di attrezzi', brewer: 'birraio', apprentice: 'apprendista',
};

function plural(j) { return j.endsWith('man') ? j.slice(0, -3) + 'men' : j + 's'; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
const words = (s) => s.split(/\s+/).filter(Boolean).length;

/**
 * @returns {{ sentences: {text:string, role:string}[], text: string, words: number }}
 */
export function buildScript(state, diff, { lang = 'en', seed = state.seed } = {}) {
  const L = T[lang] || T.en;
  const r = rng(seed, 'narration', diff.date, lang);
  const pick = (a) => r.pick(a);
  const bname = (id) => (lang === 'it' ? BUILDING_IT[id] : BUILDINGS[id].label);
  const job = (j) => (lang === 'it' ? JOB_IT[j] : JOBS[j].label.toLowerCase());
  const S = []; // {text, role, priority} lower priority dropped first when too long
  const add = (text, role, priority) => text && S.push({ text, role, priority });

  add(pick(L.open)(diff), 'open', 9);
  const d = diff.delta;
  if (d === 1) add(pick(L.up1), 'delta', 10);
  else if (d > 1) add(pick(L.up)(d.toLocaleString('en-US')), 'delta', 10);
  else if (d === -1) add(pick(L.down1), 'delta', 10);
  else if (d < -1) add(pick(L.down)((-d).toLocaleString('en-US')), 'delta', 10);
  else add(pick(L.same), 'delta', 10);

  // villagers named by commenters today are welcomed by job; otherwise up to two newcomers (special jobs first)
  if ((diff.named || []).length) add(pick(L.caravan)(diff.named.length), 'caravan', 9);
  const granted = (diff.requests || []).filter((q) => q.granted), waiting = (diff.requests || []).filter((q) => !q.granted);
  if (granted.length) add(pick(L.granted)(granted.length, job(granted[0].job)), 'requests', 9);
  if (waiting.length) add(pick(L.apprentice)(waiting.length), 'requests', 6);
  if ((diff.promoted || []).length) add(pick(L.promoted)(job(diff.promoted[0].job)), 'requests', 8);
  const welcomed = (diff.named || []).slice(0, 3);
  const byJob = [...new Set(welcomed.map((v) => v.job))].slice(0, 2);
  byJob.forEach((j, i) => {
    const n = welcomed.filter((v) => v.job === j).length;
    const text = n > 1 && lang === 'en' ? `Welcome our ${n === 2 ? 'two' : 'three'} new ${plural(job(j))}!` : pick(L.welcome)({ job: job(j) });
    add(text, 'person', 9 - i);
  });
  if (!welcomed.length) {
    const special = diff.added.filter((v) => !['farmer', 'peasant'].includes(v.job));
    const shown = [...special, ...diff.added.filter((v) => !special.includes(v))].slice(0, special.length ? 2 : 1);
    shown.forEach((v, i) => add(pick(L.person)({ job: job(v.job) }), 'person', 6 - i));
  }
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
  const story = diff.events.find((e) => L.events[e.type]);
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
  const order = ['open', 'delta', 'caravan', 'requests', 'count', 'person', 'houses', 'rebuilt', 'completed', 'unlocked', 'abandoned', 'ruined', 'milestone', 'event', 'progress', 'weather', 'goal', 'cta', 'comment'];
  S.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  while (S.reduce((n, s) => n + words(s.text), 0) > 68) {
    const victim = [...S].sort((a, b) => a.priority - b.priority)[0];
    if (victim.priority >= 9) break;
    S.splice(S.indexOf(victim), 1);
  }
  const text = S.map((s) => s.text).join(' ');
  return { sentences: S.map(({ text, role }) => ({ text, role })), text, words: words(text) };
}

function goalIt(next) {
  const b = { woodfolk: 'arriva il Taglialegna', crafts: 'arriva il Fabbro', guard: 'la Guardia sale sulle mura', market: 'apre il Mercato', faith: 'suona la campana della Cappella', walled: 'sorge la Seconda cinta', harbor: 'apre il Porto', charter: 'si firma la Carta della città', north: 'nasce il Quartiere Nord', learned: "apre l'Università", royal: 'si costruisce il Palazzo Reale', maritime: 'si accende il Faro', legend: 'si innalza il Colosso' };
  return b[next.tier] || next.goal;
}
