// Narration script from the day's diff: template-based with seeded variation, ~60-75 words for 30 s.
import { rng } from '../sim/prng.js';
import { JOBS, BUILDINGS, tavernScene } from '../sim/tiers.js';
import { FROM_IT, GOODS_IT, storyCue } from '../sim/stories.js';
import { featuredPeople, visitItem } from '../sim/featured.js';

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
    caravan: [(n) => (n === 1 ? 'A traveler arrives with a cart full of belongings!' : `A caravan of ${n} newcomers rolls into town!`),
      (n) => (n === 1 ? 'A traveler rolls in!' : `${n} newcomers roll in!`)],
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
      royal: ['Make way! The King rides through town, and the people cheer!', 'Long live the King! The royal carriage rolls down the main street!'],
      pig: ['A pig got loose in the square, and the farmer gives chase!', 'Catch that pig! It runs circles around the whole square!'],
      flood: ['The river is rising! Everyone grabs a sandbag to save the houses.', 'After the rain the river floods, and the villagers build a wall of sandbags!'],
      newyear: ['Three, two, one... Happy New Year from the whole kingdom!', 'The villagers gather round the bonfire to count down to the New Year!'],
      archery: ['An archery contest in the square! The best shot wins a golden rosette.', 'Bows drawn! Three archers compete for the golden rosette.'],
      // the next steps of the stories told over several days
      merchants_camp: ['Tonight the merchants dance round the fire with the villagers!', 'A night of music and dancing with the merchants!'],
      merchants_leave: ['The merchants move on, and the villagers wave goodbye.', 'Farewell, merchants! The wagons roll out of town.'],
      royal_feast: ['The King holds a feast in the square, and everyone raises a toast!', 'A royal feast! Long tables, roast and ale for all.'],
      royal_leave: ['The King rides home, and the town waves him goodbye.', 'Farewell, Your Majesty! The royal carriage leaves town.'],
      archery_final: ['The archery final! Who will win the golden rosette?', 'The final round: three archers, one golden rosette.'],
      tourney: ['The guards’ tournament begins: eight guards, one champion!', 'Swords up! Eight guards fight for the title of Captain.'],
      tourney_semis: ['The semi-finals of the guards’ tournament!', 'Four guards left in the tournament.'],
      tourney_final: ['The final! The winner becomes Captain of the Guard.', 'One last bout, and a new Captain of the Guard!'],
      flood_recede: ['The water goes down: the sandbag wall held!', 'The river falls back, and the wall of sandbags held.'],
      quarrel_peace: ['Yesterday they quarrelled, today they shake hands. Friends again!', 'Peace in the square: the two make up!'],
    },
    // everyday shots (src/render/scene/ambient.js)
    ambient: {
      patrol: ['Up on the walls, the guards keep watch.', 'The castle guards walk their rounds.'],
      sparring: ['In the castle yard, the guards train with sword and shield.', 'Clang! The guards practise in the courtyard.'],
      change: ['On the walls, the changing of the guard.', 'A new guard takes the post up on the walls.'],
      fields: ['Out in the fields, the farmers work the soil.', 'In the fields, the hoes never rest.'],
      wheat: ['The whole village is out in the wheat fields.', 'Many hands make light work in the wheat.'],
      pasture: ['Out on the meadow, the shepherd watches over the flock.', 'The sheep graze in peace beyond the fields.'],
      laundry: ['It is washing day down by the river.', 'Down at the river, the linen is scrubbed and hung to dry.'],
    },
    // two villagers in one shot (src/sim/featured.js): h = the host's job, g = the guest's
    pair: {
      sword: (h, g) => `The ${h} hands a brand new sword to the ${g}.`,
      arrows: (h, g) => `The ${g} collects a fine new bow from the ${h}.`,
      tools: (h, g) => `The ${h} mended a tool for the ${g}.`,
      flour: (h, g) => `The ${g} brings fresh flour to the ${h}.`,
      grain: (h, g) => `The ${g} brings a sheaf of wheat to the ${h}.`,
      fish: (h, g) => `The ${g} brings the catch of the day to the ${h}.`,
      logs: (h, g) => `The ${g} brings a load of logs to the ${h}.`,
      loaf: (h, g) => `The ${g} stops by the ${h} for fresh bread.`,
      tankard: (h, g) => `The ${g} drops by the ${h} for a drink.`,
      fishbuy: (h, g) => `The ${g} buys a fresh fish from the ${h}.`,
      cabbage: (h, g) => `The ${g} picks up a cabbage from the ${h}.`,
      sheaf: (h, g) => `The ${g} picks up a sheaf of wheat from the ${h}.`,
      sack: (h, g) => `The ${g} collects a sack of flour from the ${h}.`,
      chat: (h, g) => `The ${g} drops by for a chat with the ${h}.`,
    },
    tavern: ['Meanwhile, the tavern is full tonight!', 'Over at the tavern, the mugs are full!', 'At the tavern, the cider is flowing!'],
    church: { chapel: ['In the chapel, the villagers pray for the kingdom.', 'The chapel pews are full today!'], cathedral: ['Under the great vaults, the cathedral is full!', 'The bishop blesses a full cathedral.'] },
    // owner 2026-10-23: more lines about building, the narrator repeated himself too often
    houses1: ['A new house rises along the road.', 'Builders finished a fresh new home.', 'One more family gets a roof over their heads.', 'Another home joins the street.'],
    houses: [(n) => `${n} new houses rise along the roads.`, (n) => `Builders raised ${n} new homes.`, (n) => `${n} more families move into new homes.`, (n) => `The streets fill up with ${n} new houses.`],
    rebuilt: [(n) => `${n === 1 ? 'An old ruin was' : `${n} old ruins were`} rebuilt.`],
    raised: [(n) => `Inside the walls, ${n === 1 ? 'a house grows' : `${n} houses grow`} a new storey.`, () => 'No room left? The town builds upward!',
      (n) => `Up go the roofs: ${n === 1 ? 'a house gains' : `${n} houses gain`} another floor.`, () => 'Short of land, the town grows taller.', () => 'The houses grow taller!'],
    abandoned: [(n) => `${n === 1 ? 'One house stands' : `${n} houses stand`} empty now.`],
    ruined: [(n) => `${n === 1 ? 'An abandoned house has' : `${n} abandoned houses have`} fallen into ruin.`],
    unlocked: [(b) => `The kingdom has grown enough for ${b}!`, (b) => `Hear ye! Work begins on ${b}!`, (b) => `The builders break ground for ${b}.`,
      (b) => `Stone and timber arrive: ${b} is on its way!`, (b) => `Today the first stone is laid for ${b}.`, (b) => `Scaffolding goes up for ${b}.`,
      (b) => `The masons start work on ${b}.`, (b) => `By royal decree, ${b} will be built!`, (b) => `Work begins on ${b}!`, (b) => `Up goes ${b}!`],
    completed: [(b) => `${cap(b)} is finally complete!`, (b) => `${cap(b)} opens its doors today!`, (b) => `The last stone is set: ${b} is done!`,
      (b) => `The scaffolding comes down from ${b}.`, (b) => `${cap(b)} stands finished at last.`, (b) => `The builders put down their tools: ${b} is ready!`, (b) => `${cap(b)} is done!`],
    progress: [(b, p) => `${cap(b)} is ${p} percent built.`, (b, p) => `Work on ${b} goes on: ${p} percent done.`, (b, p) => `${cap(b)} is rising, ${p} percent so far.`],
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
  caravan: [(n) => (n === 1 ? 'Arriva un viandante con il suo carro!' : `Arriva una carovana con ${n} nuovi abitanti!`), (n) => (n === 1 ? 'Arriva un viandante!' : `Arrivano ${n} nuovi abitanti!`)],
  story: {
    quarrel: [(e) => `Due abitanti litigano in piazza per ${OVER_IT[e.over]}!`, (e) => `Guai in piazza: una lite furiosa per ${OVER_IT[e.over]}!`],
    merchants: [(e) => `Passano mercanti ${FROM_IT[e.from] || 'da terre lontane'} con ${GOODS_IT[e.goods] || 'merci rare'}.`],
    bandits: [(e) => (e.cast.length ? 'Al tramonto arrivano i banditi, ma i nostri eroi li mettono in fuga!' : 'Al tramonto arrivano i banditi, ma le guardie li mettono in fuga!')],
    halloween: ['Buon Halloween! Gli abitanti ballano in maschera intorno al falò.'],
    fire: [(e) => (e.cast.length ? 'Al fuoco! Una casa brucia, ma i nostri eroi guidano i secchi e la salvano!' : 'Al fuoco! Una casa brucia, ma i vicini la spengono con i secchi!')],
    rebuild: ['I carpentieri ricostruiscono già la casa bruciata.'],
    wolves: ['Stanotte i lupi sono usciti dal bosco, ma le torce li hanno messi in fuga!'],
    storm: ['Una tempesta si abbatte sul regno e tutti corrono al riparo!'],
    royal: ['Fate largo! Il Re attraversa la città tra gli applausi!', 'Viva il Re! La carrozza reale percorre la via principale!'],
    pig: ['Un maiale è scappato in piazza e il contadino lo insegue!', 'Prendete quel maiale! Fa il giro di tutta la piazza!'],
    flood: ['Il fiume si alza! Tutti prendono un sacco di sabbia per salvare le case.'],
    newyear: ['Tre, due, uno... Buon anno da tutto il regno!', 'Gli abitanti si radunano intorno al falò per il conto alla rovescia!'],
    archery: ['Gara di tiro con l’arco in piazza: il miglior arciere vince la coccarda d’oro!'],
    merchants_camp: ['Stanotte i mercanti ballano intorno al fuoco con gli abitanti!'],
    merchants_leave: ['I mercanti ripartono e gli abitanti li salutano.'],
    royal_feast: ['Il Re offre un banchetto in piazza: tutti brindano!'],
    royal_leave: ['Il Re riparte e la città lo saluta.'],
    archery_final: ['La finale con l’arco! Chi vincerà la coccarda d’oro?'],
    tourney: ['Inizia il torneo delle guardie: otto guardie, un solo campione!'],
    tourney_semis: ['Le semifinali del torneo delle guardie!'],
    tourney_final: ['La finale! Il vincitore diventa capitano delle guardie.'],
    flood_recede: ['L’acqua scende: l’argine di sacchi ha tenuto!'],
    quarrel_peace: ['Ieri litigavano, oggi si stringono la mano. Di nuovo amici!'],
  },
  ambient: {
    patrol: ['Sulle mura, le guardie fanno la ronda.'],
    sparring: ['Nel cortile del castello, le guardie si allenano con spada e scudo.'],
    change: ['Sulle mura, il cambio della guardia.'],
    fields: ['Nei campi, i contadini lavorano la terra.'],
    wheat: ['Tutto il villaggio lavora nei campi di grano.'],
    pasture: ['Sul prato, il pastore veglia sul gregge.'],
    laundry: ['Giorno di bucato giù al fiume.'],
  },
  pair: {
    sword: (h, g) => `${cap(the(h))} consegna una spada nuova ${to(g)}.`,
    arrows: (h, g) => `${cap(the(g))} ritira un arco nuovo ${from(h)}.`,
    tools: (h, g) => `${cap(the(h))} ha riparato un attrezzo per ${the(g)}.`,
    flour: (h, g) => `${cap(the(g))} porta farina fresca ${to(h)}.`,
    grain: (h, g) => `${cap(the(g))} porta un covone di grano ${to(h)}.`,
    fish: (h, g) => `${cap(the(g))} porta il pescato del giorno ${to(h)}.`,
    logs: (h, g) => `${cap(the(g))} porta un carico di legna ${to(h)}.`,
    loaf: (h, g) => `${cap(the(g))} passa ${from(h)} per il pane fresco.`,
    tankard: (h, g) => `${cap(the(g))} passa a bere qualcosa.`,
    fishbuy: (h, g) => `${cap(the(g))} compra un pesce fresco ${from(h)}.`,
    cabbage: (h, g) => `${cap(the(g))} prende un cavolo ${from(h)}.`,
    sheaf: (h, g) => `${cap(the(g))} prende un covone di grano ${from(h)}.`,
    sack: (h, g) => `${cap(the(g))} ritira un sacco di farina ${from(h)}.`,
    chat: (h, g) => `${cap(the(g))} passa a fare due chiacchiere con ${the(h)}.`,
  },
  tavern: ['Intanto la taverna è piena!', 'In taverna i boccali sono pieni!'],
  church: { chapel: ['Nella cappella, gli abitanti pregano per il regno.', 'Oggi i banchi della cappella sono pieni!'], cathedral: ['Sotto le grandi volte, la cattedrale è piena!', 'Il vescovo benedice la cattedrale gremita.'] },
  houses1: ['Una nuova casa sorge lungo la strada.', 'Un’altra famiglia ha un tetto sopra la testa.', 'Un’altra casa si aggiunge alla via.'],
  houses: [(n) => `${n} nuove case sorgono lungo le strade.`, (n) => `${n} famiglie entrano nelle loro case nuove.`, (n) => `Le vie si riempiono di ${n} case nuove.`],
  rebuilt: [(n) => `${n === 1 ? 'Una rovina è stata ricostruita' : `${n} rovine sono state ricostruite`}.`],
  raised: [(n) => `Dentro le mura, ${n === 1 ? 'una casa si alza' : `${n} case si alzano`} di un piano.`, () => 'Poco spazio? La città cresce in altezza!',
    (n) => `Su i tetti: ${n === 1 ? 'una casa guadagna' : `${n} case guadagnano`} un piano.`, () => 'Le case crescono!'],
  abandoned: [(n) => `${n === 1 ? 'Una casa ora è vuota' : `${n} case ora sono vuote`}.`],
  ruined: [(n) => `${n === 1 ? 'Una casa abbandonata è crollata' : `${n} case abbandonate sono crollate`}.`],
  unlocked: [(b) => `Il regno è abbastanza grande per ${b}!`, (b) => `Udite udite! Iniziano i lavori per ${b}!`, (b) => `I costruttori aprono il cantiere per ${b}.`,
    (b) => `Arrivano pietre e travi: presto avremo ${b}!`, (b) => `Oggi si posa la prima pietra per ${b}.`, (b) => `Si alzano le impalcature per ${b}.`, (b) => `Al via ${b}!`],
  completed: [(b) => `Lavori finiti: ecco ${b}!`, (b) => `Posata l’ultima pietra: ecco ${b}!`, (b) => `Oggi apre le porte ${b}!`, (b) => `Gli operai hanno finito: ecco ${b}!`, (b) => `Ecco ${b}!`],
  progress: [(b, p) => `Lavori per ${b} al ${p} per cento.`, (b, p) => `Il cantiere per ${b} avanza: siamo al ${p} per cento.`],
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
  lighthouse: 'il Faro', colossus: 'il Colosso degli Iscritti', crier_stand: 'il Palco del Banditore', pillory: 'la Gogna', tailor_stall: 'la Bottega del Sarto', physician_booth: 'il Banco del Medico',
  potter_stall: 'la Bottega del Vasaio', cobbler_stall: 'il Banco del Calzolaio', cooperage: 'la Bottega del Bottaio', apiary: 'le Arnie',
  bell_foundry: 'la Fonderia di Campane', clock_tower: "la Torre dell'Orologio", stone_bridge: 'il Grande Ponte',
  fletcher_workshop: "la Bottega dell'Arcaio", counting_house: 'la Casa delle Tasse', apothecary_shop: 'la Bottega dello Speziale',
};

const JOB_IT = {
  peasant: 'contadino', farmer: 'agricoltore', woodcutter: 'taglialegna', fisherman: 'pescatore', blacksmith: 'fabbro', baker: 'fornaio',
  guard: 'guardia', stonemason: 'scalpellino', merchant: 'mercante', innkeeper: 'oste', priest: 'prete', miller: 'mugnaio',
  carpenter: 'carpentiere', reeve: 'balivo', sailor: 'marinaio', knight: 'cavaliere', bishop: 'vescovo', scholar: 'studioso',
  mayor: 'sindaco', weaver: 'tessitore', physician: 'medico', apothecary: 'speziale', bard: 'bardo', taxcollector: 'esattore delle tasse', tailor: 'sarto',
  potter: 'vasaio', cobbler: 'calzolaio', cooper: 'bottaio', beekeeper: 'apicoltore', bellfounder: 'fonditore di campane', clockmaker: 'orologiaio',
  ratcatcher: 'acchiappatopi', chimneysweep: 'spazzacamino', falconer: 'falconiere', cook: 'cuoco',
  hunter: 'cacciatore', butcher: 'macellaio', engineer: 'ingegnere', shepherd: 'pastore', tanner: 'conciatore',
  teacher: 'maestro', philosopher: 'filosofo', barber: 'barbiere', astronomer: 'astronomo', stablehand: 'stalliere', adviser: 'consigliere del re',
  chronicler: 'cronista', admiral: 'ammiraglio', fletcher: 'arcaio', weirdo: 'stravagante del paese', beggar: 'mendicante',
  jester: 'giullare', warrior: 'guerriero', toolsmith: 'fabbro di attrezzi', brewer: 'birraio', apprentice: 'apprendista',
  crier: 'banditore', executioner: 'boia',
};

const OVER_EN = { chicken: 'a runaway chicken', goat: 'a stubborn goat', cabbage: 'the last cabbage' };
const OVER_IT = { chicken: 'una gallina scappata', goat: 'una capra testarda', cabbage: "l'ultimo cavolo" };
function plural(j) { return j.endsWith('man') ? j.slice(0, -3) + 'men' : j + 's'; }
// Italian articles for job names: la guardia, l'oste, lo scalpellino, il fabbro; al/alla/all'/allo, dal...
function the(w) { return (w === 'guardia' ? 'la ' : /^[aeiou]/.test(w) ? "l'" : /^(s[^aeiou]|z|gn|ps)/.test(w) ? 'lo ' : 'il ') + w; }
function to(w) { const a = the(w); return a.startsWith('il ') ? 'al ' + w : 'al' + a; }
function from(w) { return 'd' + to(w).slice(1); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
const words = (s) => s.split(/\s+/).filter(Boolean).length;

/**
 * @returns {{ sentences: {text:string, role:string}[], text: string, words: number }}
 */
export function buildScript(state, diff, { lang = 'en', seed = state.seed, shots = [] } = {}) {
  const L = T[lang] || T.en;
  const r = rng(seed, 'narration', diff.date, lang);
  const pick = (a) => r.pick(a);
  // never the same line twice in one video (two buildings begun the same day)
  const said = new Set();
  const fresh = (a) => { const free = a.filter((f) => !said.has(f)), x = r.pick(free.length ? free : a); said.add(x); return x; };
  const bname = (id) => (lang === 'it' ? BUILDING_IT[id] : BUILDINGS[id].label);
  const job = (j) => (lang === 'it' ? JOB_IT[j] : JOBS[j].label.toLowerCase());
  const S = []; // {text, role, priority} lower priority dropped first when too long
  // about: the job it names; building: the building it names (it waits for that building's shot)
  // alts: the other lines that say the same; a shorter one is taken when the line would not fit its shot (fitShots)
  const add = (text, role, priority, about = null, building = null, alts = null) => text && S.push({ text, role, priority, job: about, building, alts });
  const line = (f, args) => (typeof f === 'function' ? f(...args) : f);
  // a line picked from a list of templates, with the others as alts
  const addT = (list, args, role, priority, about = null, building = null, choose = pick) => add(line(choose(list), args), role, priority, about, building, list.map((f) => line(f, args)));

  addT(L.open, [diff], 'open', 9);
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
  if ((diff.named || []).length) addT(L.caravan, [diff.named.length], 'caravan', 9);
  const granted = (diff.requests || []).filter((q) => q.granted), waiting = (diff.requests || []).filter((q) => !q.granted);
  // the villagers the video shows at work (src/sim/featured.js): the narrator only names jobs on screen
  // (hosts and the guests who visit them)
  const featured = diff.featured ? featuredPeople(diff.featured) : null;
  const onScreen = new Set((featured || []).map((f) => f.job));
  const g0 = granted.find((q) => onScreen.has(q.job)) || granted[0];
  if (granted.length) add(pick(L.granted)(granted.length, job(g0.job)), 'requests', 9, g0.job);
  if (waiting.length) add(pick(L.apprentice)(waiting.length), 'requests', 6);
  if ((diff.promoted || []).length) add(pick(L.promoted)(job(diff.promoted[0].job)), 'requests', 8, diff.promoted[0].job);
  const welcomed = featured ? (diff.named || []).filter((v) => featured.some((f) => f.today && f.job === v.job)) : (diff.named || []).slice(0, 3);
  // one welcome per shot: the host named today, else the guest (two welcomes over one shot ran into the next shots)
  const byJob = featured ? (diff.featured || []).map((f) => (f.today ? f.job : f.with?.today ? f.with.job : null)).filter(Boolean).slice(0, 2)
    : [...new Set(welcomed.map((v) => v.job))].slice(0, 2);
  byJob.forEach((j, i) => {
    const n = welcomed.filter((v) => v.job === j).length;
    const text = n > 1 && lang === 'en' ? `Welcome our ${n === 2 ? 'two' : 'three'} new ${plural(job(j))}!` : pick(L.welcome)({ job: job(j) });
    add(text, 'person', 9 - i, j);
  });
  // two villagers together: what happens between them (the shot is the host's)
  for (const f of (diff.featured || []).filter((x) => x.pair).slice(0, 2)) {
    const key = f.pair === 'visit' ? ({ fish: 'fishbuy' })[visitItem(f.job)] || visitItem(f.job) || 'chat' : f.pair;
    if (L.pair[key]) add(L.pair[key](job(f.job), job(f.with.job)), 'pair', 7, f.job);
  }
  if (!(diff.named || []).length) {
    const special = diff.added.filter((v) => !['farmer', 'peasant'].includes(v.job));
    const shown = [...special, ...diff.added.filter((v) => !special.includes(v))].slice(0, special.length ? 2 : 1);
    shown.forEach((v, i) => add(pick(L.person)({ job: job(v.job) }), 'person', 6 - i, v.job));
  }
  const storyLines = diff.story && (L.story[storyCue(diff.story)] || L.story[diff.story.id]);
  if (storyLines) { const f = pick(storyLines); add(typeof f === 'function' ? f(diff.story) : f, 'story', 9); }
  // the tavern interior is shown on these days (see makePlan in src/render/scene/timeline.js)
  // shots: the renderer's shot plan, when known (an everyday shot gets a short line)
  const amb = shots.find((c) => c.kind === 'ambient');
  if (amb && L.ambient[amb.id]) add(pick(L.ambient[amb.id]), 'ambient', 4);
  if (diff.scenes ? diff.scenes.tavern : tavernScene(state)) add(pick(L.tavern), 'tavern', 6);
  if (diff.scenes?.church) add(pick(L.church[diff.scenes.church]), 'church', 6);
  const nb = diff.housesBuilt.length;
  if (nb === 1) addT(L.houses1, [], 'houses', 5);
  else if (nb > 1) addT(L.houses, [nb.toLocaleString('en-US')], 'houses', 5);
  if (diff.housesRebuilt.length) add(pick(L.rebuilt)(diff.housesRebuilt.length), 'rebuilt', 5);
  // the raised house has its own shot: its sentence is kept, or the narrator is silent over it
  if (diff.housesRaised?.length) addT(L.raised, [diff.housesRaised.length], 'raised', shots.some((c) => c.raised) ? 8 : 7);
  for (const b of diff.buildingsStarted.slice(0, 2)) addT(L.unlocked, [bname(b)], 'unlocked', 8, null, b, fresh);
  for (const b of diff.buildingsCompleted.slice(0, 2)) {
    if (BUILDINGS[b].plural) add(lang === 'it' ? 'I campi sono pronti per la semina!' : 'The fields are ready to sow!', 'completed', 8, null, b);
    else addT(L.completed, [bname(b)], 'completed', 8, null, b, fresh);
  }
  if (diff.housesAbandoned.length) add(pick(L.abandoned)(diff.housesAbandoned.length), 'abandoned', 7);
  if (diff.housesRuined.length) add(pick(L.ruined)(diff.housesRuined.length), 'ruined', 7);
  const milestone = diff.events.filter((e) => e.type === 'milestone').at(-1); // the biggest one passed today
  if (milestone) add(pick(L.milestone)(milestone.value.toLocaleString('en-US')), 'milestone', 7);
  const story = !diff.story && diff.events.find((e) => L.events[e.type]); // a story event replaces the flavor line
  if (story) add(L.events[story.type](story), 'event', 4);
  const prog = diff.events.find((e) => e.type === 'construction' && !diff.buildingsStarted.includes(e.building));
  if (prog) addT(L.progress, [bname(prog.building), Math.round(prog.progress * 100)], 'progress', 3);
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
  const order = ['open', 'delta', 'caravan', 'story', 'completed', 'unlocked', 'raised', 'requests', 'count', 'person', 'pair', 'ambient', 'tavern', 'church', 'comment', 'houses', 'rebuilt', 'abandoned', 'ruined', 'milestone', 'event', 'progress', 'weather', 'goal', 'cta'];
  S.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  // between equals, a sentence about a shot of its own stays (it fills that shot)
  const own = new Set(shots.length ? S.filter((s, i) => sentenceAnchors(S, shots)[i] !== null && !(s.role in FIXED_AT)) : []);
  // with the shot plan known, the sentences follow the shots they wait for: a sentence about a later shot
  // spoken first leaves the narrator silent until that shot (day 2026-10-22: "64 job requests" waited for
  // the third villager over the raised house). A sentence with no shot stays after the one before it.
  if (shots.length) {
    const at = sentenceAnchors(S, shots);
    let key = 0;
    const keyed = S.map((s, i) => ({ s, i, k: (key = at[i] ?? key) }));
    keyed.sort((a, b) => a.k - b.k || a.i - b.i);
    S.splice(0, S.length, ...keyed.map((x) => x.s));
    fitShots(S, shots, r);
  }
  while (S.reduce((n, s) => n + words(s.text), 0) > 68) {
    const victim = [...S].sort((a, b) => a.priority - b.priority || own.has(a) - own.has(b))[0];
    if (victim.priority >= 9) break;
    S.splice(S.indexOf(victim), 1);
  }
  const text = S.map((s) => s.text).join(' ');
  return { sentences: S.map(({ text, role, job: about, building }) => ({ text, role, ...(about ? { job: about } : {}), ...(building ? { building } : {}) })), text, words: words(text) };
}

// About how long a line takes to say (the voice of 2026-10-23: ~18 letters a second, numbers and pauses slower)
export const spokenLength = (t) => 0.055 * (t.match(/\p{L}/gu) || []).length + 0.4 * (t.match(/\d/g) || []).length + 0.3 * (t.match(/[,:;?]/g) || []).length;
const GAP = 0.28, FIRST = 0.38; // the pause between sentences and the first word (src/audio/tts/index.js)
// never dropped for time: the opening, the story event, the goal and the call to action
const MUST = new Set(['open', 'delta', 'caravan', 'story', 'goal', 'cta']);

/**
 * Owner 2026-10-23: the voice ran late over the shots (a building shot lasts 2.3 s; a long line about it ran into the next
 * shot and pushed everything after it). With the shot plan known, each sentence must end by the end of its shot and
 * before the next sentence that waits for a shot: when it would not, it takes one of its alts that fits (the shortest
 * when none does); a sentence that would still run past its shot into the next (or, with no shot of its own, into the
 * next sentence's shot) is dropped, unless it is a must (MUST), and so is a line about a villager or a building that got no
 * shot (another line took it). Runs before the word budget, on all the sentences.
 */
function fitShots(S, shots, r) {
  const cues = sentenceCues(S, shots);
  const out = [];
  let t = FIRST;
  S.forEach((s, i) => {
    const c = cues[i], start = Math.max(t, c?.at ?? t);
    const next = cues.slice(i + 1).find(Boolean);
    const end = Math.min(c?.end ?? Infinity, next?.at ?? Infinity);
    if (s.alts && spokenLength(s.text) > end - start) {
      const fit = s.alts.filter((a) => spokenLength(a) <= end - start && !out.some((o) => o.text === a));
      s.text = fit.length ? r.pick(fit) : s.alts.reduce((a, b) => (spokenLength(b) < spokenLength(a) ? b : a));
    }
    // past its own shot, or (with no shot of its own) into the time of the next sentence that waits for a shot
    const over = c ? (c.end ?? Infinity) + 0.6 : (next?.at ?? Infinity) + 0.3;
    if (start + spokenLength(s.text) > over && !MUST.has(s.role)) return;
    // a line about a villager or a building whose shot another line took would be heard over some other shot
    if (!c && (s.job || s.building) && !MUST.has(s.role)) return;
    out.push(s);
    t = start + spokenLength(s.text) + GAP;
  });
  S.splice(0, S.length, ...out);
}

// Which shot each kind of sentence talks about (see makePlan in src/render/scene/timeline.js).
const SHOT_OF = {
  story: (c) => c.kind === 'event', completed: (c) => c.kind === 'building', unlocked: (c) => c.kind === 'building',
  requests: (c) => c.kind === 'villager', person: (c) => c.kind === 'villager', pair: (c) => c.kind === 'villager', tavern: (c) => c.kind === 'tavern', church: (c) => c.kind === 'church', comment: (c) => c.kind === 'tavern', ambient: (c) => c.kind === 'ambient',
  houses: (c) => c.kind === 'house' && !c.raised, rebuilt: (c) => c.kind === 'house' && !c.raised, raised: (c) => c.kind === 'house' && c.raised, abandoned: (c) => c.kind === 'loss', ruined: (c) => c.kind === 'loss',
};
// fixed parts of the video: the wide shot with the goal (23.5 s) and the call to action (27 s)
const FIXED_AT = { goal: 23.7, cta: 27.1 };

/**
 * Video time at which each sentence should start, so the narrator talks about what is on screen:
 * the first sentence about a shot waits for that shot. null = right after the previous sentence.
 * cues: the shots from the renderer ([{kind, t0, t1}]).
 */
export function sentenceAnchors(sentences, cues = []) {
  return sentenceCues(sentences, cues).map((c) => (c ? c.at : null));
}

/** For each sentence, when it should start and when its shot ends ({ at, end }; no end for the fixed parts), or null. */
function sentenceCues(sentences, cues = []) {
  const used = new Set();
  // the sentences naming a job or a building take their shots first, then the others take the shots left
  // (2026-10-23: "16 apprentices wait..." took the carpenter's shot and the carpenters' welcome lost it)
  const named = (s) => !!(s.building || s.job);
  const out = new Array(sentences.length).fill(null);
  for (const pass of [true, false]) sentences.forEach((s, i) => { if (named(s) === pass) out[i] = cueOf(s); });
  return out;
  function cueOf(s) {
    if (FIXED_AT[s.role] !== undefined) return { at: FIXED_AT[s.role] };
    const match = SHOT_OF[s.role];
    // a sentence naming a job waits for that villager's shot (and for no other; a visiting villager is in
    // the host's shot); otherwise the next shot of its kind
    // a sentence naming a building waits for that building's shot, or for none
    const cue = match && (s.building ? cues.find((c) => match(c) && c.id === s.building && !used.has(c))
      : s.job && (s.role === 'person' || s.role === 'requests' || s.role === 'pair')
        ? cues.find((c) => match(c) && (c.job === s.job || c.job2 === s.job) && !used.has(c))
        : cues.find((c) => match(c) && !used.has(c)));
    if (!cue) return null;
    used.add(cue);
    return { at: cue.t0 + 0.25, end: cue.t1 };
  }
}

function goalIt(next) {
  const b = { woodfolk: 'arriva il Taglialegna', crafts: 'arriva il Fabbro', guard: 'la Guardia sale sulle mura', market: 'apre il Mercato', crier: 'il Banditore suona la campana', justice: 'il Boia prende la scure', cloth: 'il Sarto apre bottega', healers: 'arriva il Medico', pottery: 'il Vasaio monta il tornio', shoes: 'il Calzolaio apre bottega', barrels: 'apre la Bottega del Bottaio', honey: 'arrivano le prime arnie', bells: 'la Fonderia fonde la prima campana', clock: "la Torre dell'Orologio batte l'ora", bridge: 'il Grande Ponte attraversa il fiume', faith: 'suona la campana della Cappella', walled: 'sorge la Seconda cinta', harbor: 'apre il Porto', charter: "apre l'Università", north: 'nasce il Quartiere Nord', learned: 'nasce il Quartiere Sud', royal: 'si costruisce il Palazzo Reale', maritime: 'si accende il Faro', legend: 'si innalza il Colosso' };
  return b[next.tier] || next.goal;
}
