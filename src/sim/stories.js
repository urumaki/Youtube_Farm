// Story events: at most one visible scene a day (bandits at the gate, a quarrel in the square, a
// merchant caravan, Halloween...). Deterministic: depends on the seed, the date and the state.
// Tone (owner's rule): named villagers are heroes or comic characters, never villains or victims, and
// nobody gets hurt. Calendar events always happen on their date; otherwise a story happens on about
// two days in three (65%), each kind with its own cooldown so the same scene does not repeat too often.
// Owner (2026-10-21): a story can go on for a few days, one step a day: the merchants arrive, dance round
// the fire at night, then leave (`steps`). (The rule of no story on days with 15 or more new commenters was
// dropped by the owner on 2026-10-22.)
import { rng } from './prng.js';
import { TIERS, JOBS } from './tiers.js';
import { world, heightAt, MANORS } from './world.js';
import { wallLayout, insideWall2 } from './wall.js';
import { RIDDLES, RIDDLE } from './riddles.js';
import { VOTES, VOTE, voteWinner } from './votes.js';
import { timelapseDay } from './featured.js';

export const PLACES = ['Ashford', 'the Northern Marches', 'Kingsbridge', 'the Salt Coast', 'Ravenscar', 'the Amber Vale', 'Dunmoor', 'the Eastern Isles'];
export const GOODS = ['spices', 'wool', 'salt', 'silk', 'amber', 'wine', 'iron tools', 'honey', 'dyed cloth'];
const HEROES = ['knight', 'cavalier', 'warrior', 'guard', 'fletcher'];
// the guards' tournament: the chance that the guard named first (the older name) wins a bout
export const TOURNEY_ODDS = 0.85;
const BUILDERS = ['carpenter', 'stonemason'];
const COSTUMES = ['ghost', 'scarecrow', 'pumpkin']; // folk costumes only, nothing magic (owner)
// owner 2026-11-14: the trial at the Hall of Justice, comic charges and sentences only (nobody is hurt, nobody a villain).
// Owner 2026-11-14 (later): one villager accuses another, and the charge fits the accused's job: "accused by the Farmer of
// buying their potatoes for far too little" ("their", "them": the accuser). Each job: [the charge, the accusers' jobs that
// fit it best (any other villager may accuse when none of them is there)]. The rebel: talking of overthrowing the King.
export const TRIAL_CHARGES = {
  peasant: [['letting a goat eat their washing', []]], farmer: [['selling them a cart of turnips that was mostly mud', ['merchant', 'cook', 'baker']]],
  woodcutter: [['felling a tree right onto their fence', ['farmer', 'shepherd']]], fisherman: [['selling them an old boot as the catch of the day', ['cook', 'innkeeper', 'merchant']]],
  blacksmith: [['hammering so loud they could not sleep for a week', []]], baker: [['selling them a loaf that was mostly air', ['merchant', 'cook', 'innkeeper']]],
  guard: [['falling asleep at the gate and letting their pigs out of town', ['farmer', 'shepherd', 'butcher']]], stonemason: [['building their chimney upside down', []]],
  merchant: [['buying their potatoes for far too little', ['farmer']], ['selling them a cabbage painted gold as a golden apple', []]],
  innkeeper: [['watering down their ale', ['brewer']]], priest: [['preaching so long that they missed the market', ['merchant', 'farmer']]],
  miller: [['keeping a sack of their flour', ['farmer', 'baker']]], carpenter: [['making them a chair with three legs', []]],
  reeve: [['counting their sheep twice for the tax', ['shepherd', 'farmer']]], sailor: [['using their washing line as a sail', []]],
  knight: [['riding a horse through their cabbage patch', ['farmer']]], cavalier: [['leaving a horse to graze in their garden', ['farmer']]],
  bishop: [['eating their share of the feast', ['cook']]], scholar: [['borrowing their book and writing all over it', ['librarian', 'teacher', 'philosopher']]],
  mayor: [['promising them a new well and forgetting all about it', []]], weaver: [['weaving their cloak two sizes too small', ['tailor']]],
  physician: [['telling them to cure the hiccups by standing on one leg for a day', []]], apothecary: [['selling them a hair tonic that turned their hair green', ['barber']]],
  bard: [['singing a song about their snoring in the tavern', []]], taxcollector: [['taxing their chickens twice', ['farmer', 'peasant']]],
  tailor: [['sewing their sleeves shut', ['weaver']]], potter: [['selling them a jug with a hole in the bottom', ['innkeeper', 'brewer']]],
  cobbler: [['making them two left boots', []]], cooper: [['selling them a barrel that let all the ale run out', ['brewer', 'innkeeper']]],
  beekeeper: [['letting the bees move into their chimney', ['chimneysweep']]], bellfounder: [['ringing the new bell under their window at dawn', ['priest']]],
  clockmaker: [['setting their clock an hour late on market day', ['merchant']]], chronicler: [['writing in the chronicle that they are afraid of chickens', []]],
  admiral: [['sailing the whole fleet through their fishing nets', ['fisherman']]], crier: [['shouting their secrets in the market square', []]],
  executioner: [['cracking walnuts on the chopping block under their window all night', []]], fletcher: [['plucking their goose for arrow feathers', ['farmer']]],
  weirdo: [['talking to their scarecrow for three hours', ['farmer']]], beggar: [['selling them their own lost hat', []]],
  jester: [['spilling wine on their best tunic', []]], warrior: [['practising with the sword on their haystack', ['farmer', 'stablehand']]],
  toolsmith: [['selling them a hammer with no handle', ['carpenter', 'stonemason']]], brewer: [['brewing an ale so strong they sang until morning', ['innkeeper']]],
  apprentice: [['breaking their best jug while trying to help', []]], ratcatcher: [['letting the rats loose in their cellar', ['baker', 'miller', 'cook']]],
  chimneysweep: [['leaving sooty footprints all over their floor', []]], falconer: [['letting a falcon snatch their lunch', []]],
  cook: [['putting far too much salt in their stew', ['innkeeper']]], hunter: [['chasing a hare through their washing', []]],
  butcher: [['selling them sausages that were mostly bread', ['cook', 'innkeeper']]], engineer: [['testing a catapult that threw cabbages into their garden', ['farmer']]],
  shepherd: [['letting the sheep eat their flowers', ['farmer', 'beekeeper']]], tanner: [['drying smelly hides on their fence', []]],
  teacher: [['giving them a hundred lines for sneezing', ['scholar', 'apprentice']]], philosopher: [['asking them "why?" until their bread burnt', ['baker']]],
  barber: [['cutting off half of their beard', []]], astronomer: [['waking them at midnight to look at a star', []]],
  stablehand: [['lending them the slowest horse in the stables', ['messenger', 'cavalier']]], adviser: [['advising them to plant turnips in the river', ['farmer']]],
  miner: [['digging a tunnel under their cellar', []]], librarian: [['shushing them at their own wedding', []]],
  prisoner: [['slipping out of the dungeon to eat their dinner, then slipping back in', ['guard']]], spy: [['listening at their window all evening', []]],
  messenger: [['delivering their love letter to the wrong house', []]], sweeper: [['sweeping all the dust into their doorway', []]],
  diplomat: [['promising their cow to a foreign envoy', ['farmer']]], bailiff: [['locking them out of the Hall of Justice by mistake', []]],
  judge: [['falling asleep during their case', []]],
  rebel: [['talking of overthrowing the King', ['guard', 'knight', 'cavalier', 'bailiff']]],
};
const CHARGE_ANY = [['letting a goat eat their washing', []]];
/** "The Merchant stands accused by the Farmer of buying their potatoes for far too little" (job labels, never names). */
export function trialCharge(e) {
  const a = JOBS[e.accused?.job]?.label || 'Villager', b = JOBS[e.accuser?.job]?.label || 'Villager';
  return `The ${a} stands accused by ${a === b ? `a fellow ${b}` : `the ${b}`} of ${e.charge}`;
}
export const TRIAL_SENTENCES = {
  pillory: 'a day in the pillory', tankards: 'washing every tankard in the tavern', sweep: 'sweeping the market square for a week',
  water: 'carrying water for the whole town', song: 'singing an apology in the square', pies: 'baking a pie for every guard',
};

/**
 * Catalog. date: 'MM-DD' calendar event; minPop: population needed; cooldown: days before it can come
 * back; weight: how likely among the stories possible today; needs(state): extra condition; steps: the
 * story goes on over several days, one step each (story.step).
 */
export const STORIES = {
  halloween: { date: '10-31', minPop: 1 },
  newyear: { date: '12-31', minPop: 1 }, // the countdown round the bonfire
  bandits: { minPop: 25, cooldown: 10, weight: 2 }, // the guard tier: someone to chase them off
  // in the square; the next quiet day they make up and share it
  quarrel: { minPop: 50, cooldown: 6, weight: 3, needs: (s) => built(s, 'market'), steps: ['quarrel', 'peace'] },
  // they arrive, dance with the villagers round a fire at night, then leave
  merchants: { minPop: 50, cooldown: 8, weight: 3, needs: (s) => built(s, 'market'), steps: ['arrive', 'camp', 'leave'] },
  // a fire in a house (nobody hurt: the neighbours put it out with buckets), rebuilt the next day
  fire: { minPop: 25, cooldown: 20, weight: 1, needs: (s) => !['rain', 'snow'].includes(s.weather), next: (story, state) => ({ id: 'rebuild', day: state.day + 1, house: story.house }) },
  rebuild: { arc: true }, // only as the day after a fire
  wolves: { minPop: 10, cooldown: 12, weight: 2 },
  // only on grey days; the day turns to rain (src/sim/simulate.js)
  storm: { minPop: 1, cooldown: 14, weight: 2, needs: (s) => ['rain', 'cloudy'].includes(s.weather) },
  // the King (the channel's owner) rides through town in his carriage; named villagers cheer in the front row
  // he rides in, holds a feast in the square, then rides out again
  royal: { minPop: 30, cooldown: 12, weight: 2, needs: (s) => !['rain', 'snow', 'storm'].includes(s.weather), steps: ['arrive', 'feast', 'leave'] },
  pig: { minPop: 20, cooldown: 8, weight: 2 }, // a pig loose in the square, the farmer gives chase
  // sandbags on the bank; the next quiet day the water goes down and the wall has held
  flood: { minPop: 30, cooldown: 25, weight: 2, needs: (s) => s.weather === 'rain', steps: ['rise', 'recede'] },
  // the heats, then the final with the winner's rosette
  archery: { minPop: 40, cooldown: 12, weight: 2, needs: (s) => !['rain', 'snow'].includes(s.weather), steps: ['heats', 'final'] },
  // the guards' tournament (owner 2026-10-25): a knockout over three days among eight named guards, the winner becomes
  // Captain of the Guard (state.guardCaptain)
  tourney: { minPop: 60, cooldown: 30, weight: 2, needs: (s) => namedVillagers(s).filter((n) => n.job === 'guard').length >= 8 && !['rain', 'snow'].includes(s.weather), steps: ['round1', 'semis', 'final'] },
  // owner 2026-10-25: St Martin's Day, the new wine opened in the square; Christmas Eve round the Yule fire in the snow (the
  // day turns to snow, simulate.js)
  martinmas: { date: '11-11', minPop: 1 },
  christmas: { date: '12-24', minPop: 1 },
  // on the day the kingdom reaches a new goal the crier reads the proclamation to the square (before any other story)
  proclaim: { onUnlock: true, minPop: 1 },
  // the fisherman's huge catch carried into the square on a pole, roasted for everyone the next quiet day
  bigfish: { minPop: 10, cooldown: 14, weight: 2, steps: ['catch', 'roast'] },
  // a hen loose in the tavern, the drinkers chasing it between the tables until it flies out of the window
  chicken: { minPop: 50, cooldown: 10, weight: 2, needs: (s) => built(s, 'tavern') },
  // a gale spins the windmill's sails far too fast; the miller and two helpers haul on the brake rope
  windmill: { minPop: 100, cooldown: 14, weight: 2, needs: (s) => built(s, 'windmill') },
  // guards against farmers at the rope over a mud puddle; the losers slide into the mud
  tugofwar: { minPop: 50, cooldown: 12, weight: 2, needs: (s) => teamOf(s, GUARDS).length >= 2 && teamOf(s, LAND).length >= 2 && !['rain', 'snow'].includes(s.weather) },
  // a hay cart stuck in the mud of a gate of the Second Wall, pushed out by named villagers (the hay comes down on them)
  haycart: { minPop: 250, cooldown: 12, weight: 2, needs: (s) => built(s, 'wall2') && s.weather !== 'snow' },
  // a snowball fight in the square, two teams of named villagers; only on snowy days
  snowballs: { minPop: 20, cooldown: 5, weight: 3, needs: (s) => s.weather === 'snow' },
  // owner 2026-10-27: a commenter who talks of overthrowing the king ("kill the king", "revolution!") spends a day in the
  // pillory while named villagers pelt them with tomatoes and the executioner chops a cabbage on the block as a warning.
  // Comic, nobody hurt; never drawn otherwise, at most once every 7 days, the newest rebel of the last 7 days (rebelDay).
  rebel: { onComment: true, minPop: 1, cooldown: 7, needs: (s) => built(s, 'pillory') },
  // owner 2026-10-28: the games at the Tournament Ground are two events of two days each, the chariot race and the joust.
  // Day 1 ('announce'): the town crier reads the proclamation in the square and every guard may enter by commenting "!join"
  // (owner 2026-10-29: `state.gamesEntrants`, guards only, simulate.js; emptied when a game is run). Day 2 ('results'): the
  // entrants are drawn among the guards who joined (the others
  // fill the places left), the longer a guard has had their name the better their chance (`drawGuards`); the race or the
  // joust, then the King names the winner in the throne room: a Cavalier for the race, a Knight for the joust. Only named
  // guards ride, never the Captain of the Guard
  race: { minPop: 100, cooldown: 14, weight: 3, needs: (s) => built(s, 'tournament') && jousters(s).length >= 4 && !['rain', 'snow'].includes(s.weather), steps: ['announce', 'results'] },
  // owner 2026-11-01: the joust's results day is the Grand Joust, a knockout of eight guards that takes the whole video
  // (`takeover` on that step, timeline.js; raid.js style), at least 14 days apart
  joust: { minPop: 100, cooldown: 14, weight: 3, takeover: ['results'], needs: (s) => built(s, 'tournament') && jousters(s).length >= 8 && !['rain', 'snow'].includes(s.weather), steps: ['announce', 'results'] },
  // owner 2026-10-27 (stories with a beginning and an end keep viewers watching): six more.
  // A merchant ship sails into the harbor with named villagers waving on the quay, the next day named porters unload it,
  // then it sails away
  ship: { minPop: 500, cooldown: 14, weight: 3, needs: (s) => built(s, 'harbor') && !['rain', 'snow'].includes(s.weather), steps: ['arrive', 'unload', 'leave'] },
  // a new bell for the church: the bronze poured into the mould at the Bell Foundry, the mould broken open and the bell
  // rung for the first time, then hauled up into the bell tower by named villagers on the rope
  bell: { minPop: 4000, cooldown: 40, weight: 3, needs: (s) => built(s, 'bell_foundry') && (built(s, 'cathedral') || built(s, 'chapel')), steps: ['pour', 'cool', 'raise'] },
  // only on foggy days: a fisherman lost in the fog on the river; named villagers light a beacon fire at the end of the
  // pier and ring a hand bell until the boat comes home
  fogboat: { minPop: 10, cooldown: 10, weight: 4, needs: (s) => s.weather === 'fog' && built(s, 'dock') },
  // the census at the Counting House: named villagers queue at the clerk's table, and the count reaches the kingdom's
  // number (1 subscriber = 1 villager)
  census: { minPop: 250, cooldown: 21, weight: 2, needs: (s) => built(s, 'counting_house') },
  // a pie eating contest in the tavern: three named villagers, stacks of pies, one winner
  pies: { minPop: 50, cooldown: 12, weight: 2, needs: (s) => built(s, 'tavern') },
  // a rowing race on the river past the dock, three boats with named rowers, the crowd on the pier
  regatta: { minPop: 30, cooldown: 14, weight: 2, needs: (s) => built(s, 'dock') && !['rain', 'snow', 'fog'].includes(s.weather) },
  // owner 2026-10-28: the crier proclaims once that guards become Knights and Cavaliers only by winning at the Tournament
  // Ground (asking makes a guard), on the first day it can be once the Tournament Ground stands
  decree: { minPop: 100, once: true, needs: (s) => built(s, 'tournament') },
  // owner 2026-10-30 (the views were dropping: an event that breaks the format): the night raid, over two days that take
  // the whole video (`takeover`, timeline.js). Day 1 (`attack`): bandits out of the northern woods set roofs on fire with
  // burning arrows, the named guards run to the Second Wall, the gate gives way, a named villager's house burns, three
  // houses are lost and a named villager is missing. Day 2 (`rescue`, the very next day: `urgent` comes before the
  // calendar and a proclamation): the burnt houses are repaired, five named guards chase the bandits off and free the
  // missing villager, the town cheers them home through the gate, the crier proclaims the bandits gone. Nobody gets hurt.
  // At least 30 days apart; never on a day the video must show a building, nor the day before a calendar event.
  raid: { minPop: 500, cooldown: 30, weight: 3, urgent: true, takeover: true, steps: ['attack', 'rescue'],
    needs: (s, o = {}) => built(s, 'wall2') && teamOf(s, GUARDS).length >= 5 && !['rain', 'snow'].includes(s.weather) && !o.buildingShots
      && !Object.values(STORIES).some((x) => x.date === tomorrow(s)) },
  // owner 2026-11-01: a day in the life of one named villager takes the whole video, keeping the counter and the day line at
  // the start (src/render/scene/stories/dayinlife.js): the camera drops from the sun into their head, then their day, and
  // the night's moon turns back into the sun so the video loops. So far the scholar: the lane with an open book, the
  // University's great doors, its corridor full of talk, a lecture, reading by candlelight. Never on a day the video must
  // show a building
  dayinlife: { minPop: 1000, cooldown: 14, weight: 3, takeover: true,
    needs: (s, o = {}) => built(s, 'university') && namedVillagers(s).some((n) => n.job === 'scholar') && !['rain', 'snow', 'fog'].includes(s.weather) && !o.buildingShots },
  // owner 2026-11-05: two more stories that take the whole video (src/render/scene/stories/escape.js, eclipse.js), each
  // with "Subscribe to join the kingdom" at the bottom of their last shot. They keep the counter and the day line at the start and
  // end with the usual wide shot, goal and call to action. Never on a day the video must show a building.
  // The Dungeon escape: the named prisoners dig out of their cell with a spoon at night, come up through the paving of the
  // market square in the morning, the named guards give chase between the stalls, and they are caught at the bread cart
  // with their mouths full and marched back down, waving. Comic: nobody gets hurt
  escape: { minPop: 3250, cooldown: 30, weight: 3, takeover: true,
    needs: (s, o = {}) => built(s, 'dungeon') && built(s, 'market') && namedVillagers(s).filter((n) => n.job === 'prisoner').length >= 2
      && teamOf(s, GUARDS).length >= 2 && !['rain', 'snow'].includes(s.weather) && !o.buildingShots },
  // A solar eclipse at noon: the moon slides over the sun, the light fails, the square stops and stares, comic panic (a
  // bucket on a head, someone under a cart, the bell rung), the dark with the sun's ring and the stars, a scholar (or a
  // priest) explaining with a book that it is only the moon, then the light comes back and the town cheers. Nothing magic:
  // the narrator says what it is. Only on a clear day
  // owner 2026-11-07: a villager the owner makes a Noble (scripts/ennoble.js, `state.ennoble`), only by hand, never by chance
  // nor from a comment: the King gives the title in the throne room, then the Noble's new manor with its sign "Noble" and
  // the name under it (stories/manor.js). An honour, not a job: the villager keeps their job
  noble: { manual: true, minPop: 1 },
  // owner 2026-11-07: the Crusade, over two days, guards only. Day 1 ('announce'): the town crier calls for Crusaders to
  // win back the lost relic; guards enter by commenting "!join" (as for the games: `state.gamesEntrants`, simulate.js).
  // Day 2 ('quest') takes the whole video (stories/crusade.js): the guards who joined (up to six; the places left drawn
  // among the other named guards, the longest named first, as for the games) ride out as Crusaders in white and red over
  // their plate, a named Knight at their head, to an abandoned mausoleum; four bandits inside are knocked out cold and the
  // Golden Apple is brought home. Crusader is for that day only (`crusaderDay`): their job stays. Needs the Second Wall's
  // gate (the raid's), a named Knight and four named guards; never on a day the video must show a building
  crusade: { minPop: 1000, cooldown: 21, weight: 3, steps: ['announce', 'quest'], takeover: ['quest'],
    needs: (s, o = {}) => built(s, 'wall2') && namedVillagers(s).some((n) => n.job === 'knight') && jousters(s).length >= 4
      && !['rain', 'snow'].includes(s.weather) && !o.buildingShots },
  // owner 2026-11-07: the King's riddle, over two days. Day 1 ('announce'): the town crier reads a riddle (riddles.js) from
  // the dais in the market square: the King has a doubt, and whoever solves it is rewarded; scholars only, by commenting
  // "!answer" and the answer. Day 2 ('answer'): the first two named scholars who answered right on that video
  // (`state.riddleSolvers`, simulate.js) are made Engineers, and the crier reads the answer. Once the Engineers are in the
  // kingdom (2,500), with at least two named scholars; never on a day the video must show a building
  riddle: { minPop: 2500, cooldown: 14, weight: 3, steps: ['announce', 'answer'],
    needs: (s, o = {}) => built(s, 'market') && namedVillagers(s).filter((n) => n.job === 'scholar').length >= 2 && !o.buildingShots },
  // owner 2026-11-10 (the comments decide what happens): the kingdom's vote, over two days. Day 1 ('announce'): the town crier
  // asks the people to choose between two events (votes.js); every commenter votes once with "!vote A" or "!vote B". Day 2
  // ('result'): the crier reads the count (`state.voteTally`, simulate.js), and the event that won is the next day's story
  // (`state.storyArc`, whatever its cooldown). Never on a day the video must show a building
  vote: { minPop: 1000, cooldown: 7, weight: 4, steps: ['announce', 'result'],
    needs: (s, o = {}) => built(s, 'market') && !o.buildingShots && openVotes(s).length > 0 },
  // owner 2026-11-13: the ambush in the forest, over two days that take the whole video (stories/ambush.js). Day 1 ('ambush'):
  // the kingdom's cart on a path through the forest, two named merchants on the box, two named guards in front and four
  // behind; bandits leap out of the trees, the guards stand and fight, the merchants whip the horses and the cart gets away
  // to fetch help; it ends on the fight, a cliffhanger. Day 2 ('rescue', the very next day: `urgent`): the six guards, worn
  // out, a few bandits out cold round them, are slowly surrounded by more bandits, until the cavalry of the town (named
  // Cavaliers and Knights first, the cart behind them) charges in and the bandits run. Nobody gets hurt. At least 30 days
  // apart; never on a day the video must show a building, nor the day before a calendar event or a time-lapse
  ambush: { minPop: 500, cooldown: 30, weight: 3, urgent: true, takeover: true, steps: ['ambush', 'rescue'],
    needs: (s, o = {}) => teamOf(s, ['guard']).length >= 4 && !['rain', 'snow'].includes(s.weather) && !o.buildingShots
      && !Object.values(STORIES).some((x) => x.date === tomorrow(s)) && !timelapseDay(s.day + 1) },
  // owner 2026-11-14: the trial at the Hall of Justice, over two days. Day 1 ('trial'): a named villager accuses another of a
  // comic charge that fits the accused's job (TRIAL_CHARGES), both picked first among the villagers whose commenters wrote
  // since the day before (`names[id].seenDay`), so they are likely still around. Day 2 ('verdict'): the comments the two wrote
  // since are read (simulate.js `state.trialLikes`): the one whose comment has the most likes wins (a tie: the accused); the
  // only one who commented wins; neither: the court dismisses the case. The accuser wins: guilty, a comic sentence. A villager
  // who talked of overthrowing the King stands trial first once the court stands (pickStory: the rebel, accused by a guard),
  // and goes to the pillory the next day only if found guilty
  trial: { minPop: 1000, cooldown: 10, weight: 3, steps: ['trial', 'verdict'], needs: (s) => built(s, 'court') && namedVillagers(s).length >= 6 },
  eclipse: { minPop: 500, cooldown: 45, weight: 2, takeover: true,
    needs: (s, o = {}) => built(s, 'market') && s.weather === 'clear' && namedVillagers(s).length >= 4 && !o.buildingShots },
};
// the votes whose two events the kingdom can hold (their buildings, their people; the weather is the day's own)
const holds = (s, id) => s.subscriberCount >= (STORIES[id].minPop ?? 1) && (!STORIES[id].needs || STORIES[id].needs({ ...s, weather: 'clear' }));
const openVotes = (s) => VOTES.filter((v) => holds(s, v.a.story) && holds(s, v.b.story));
const tomorrow = (s) => new Date(Date.parse(s.date) + 86400000).toISOString().slice(5, 10);

/** True when the story ({ id, step }) takes the whole video (the raid; the Grand Joust's results day). */
export function takesOver(story) {
  const t = story && STORIES[story.id]?.takeover;
  return t === true || (Array.isArray(t) && t.includes(story.step));
}
const GUARDS = ['guard', 'knight'], LAND = ['farmer', 'peasant', 'shepherd'];
const teamOf = (s, jobs) => namedVillagers(s).filter((n) => jobs.includes(n.job));
const STORY_CHANCE = 0.65; // owner 2026-11-05: 65% (was 50%)

function built(state, id) {
  return state.buildings.some((b) => b.id === id && b.status === 'done');
}

/** Named villagers living in the kingdom today, newest first. */
function namedVillagers(state) {
  return Object.entries(state.names || {})
    .map(([id, n]) => ({ id: Number(id), name: n.name, job: state.villagers[Number(id)]?.job ?? n.job, day: n.day ?? 0 }))
    .filter((n) => n.id < state.villagers.length)
    .sort((a, b) => b.day - a.day || a.id - b.id);
}

/** A villager for the cast: a named one when possible (commenters like to see themselves). */
function castMember(state, r, pool, exclude = []) {
  const free = pool.filter((n) => !exclude.some((e) => e.id === n.id));
  if (free.length) return r.pick(free.slice(0, 12));
  const ids = state.villagers.map((v) => v.id).filter((id) => !exclude.some((e) => e.id === id));
  if (!ids.length) return null;
  const v = state.villagers[r.pick(ids)];
  return { id: v.id, name: v.name ?? null, job: v.job };
}

/**
 * Named villagers of these jobs for the other people in a role (owner 2026-10-25: the guards beside the heroes, the escort,
 * the folk with torches...): up to n, not already in the cast, picked among the newest; fewer when there are not enough.
 */
function roleCast(state, r, jobs, n, exclude = []) {
  const pool = namedVillagers(state).filter((v) => jobs.includes(v.job) && !exclude.some((e) => e.id === v.id)).slice(0, 12), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
  return out;
}

const BUILD = {
  halloween(state, r) {
    const named = namedVillagers(state).slice(0, 8);
    return { cast: named.map((n, i) => ({ ...n, costume: COSTUMES[(i + r.int(0, 2)) % COSTUMES.length] })) };
  },
  bandits(state, r) {
    const named = namedVillagers(state);
    const heroes = named.filter((n) => HEROES.includes(n.job)).slice(0, 2);
    if (!heroes.length && named.length) heroes.push(r.pick(named.slice(0, 12))); // a brave villager steps in
    const guards = r.int(2, 3);
    return { cast: heroes, bandits: r.int(5, 7), guards, guardCast: roleCast(state, r, ['guard', 'knight'], guards, heroes) };
  },
  quarrel(state, r, arc) {
    if (arc?.data) {
      // the same two make up; owner 2026-11-14: once the Hall of Justice stands, half the time before the Judge
      const court = built(state, 'court') && r.chance(0.5);
      const judge = court ? roleCast(state, r, ['judge'], 1, arc.data.cast)[0] || null : null;
      return { cast: arc.data.cast, over: arc.data.over, ...(court ? { court: true, judge: judge && strip(judge) } : {}) };
    }
    const named = namedVillagers(state);
    const a = castMember(state, r, named);
    const b = a && castMember(state, r, named, [a]);
    if (!a || !b) return null;
    return { cast: [a, b], over: r.pick(['chicken', 'goat', 'cabbage']) };
  },
  merchants(state, r, arc) {
    // at the camp fire the newest named villagers dance with the merchants; they wave goodbye when they leave
    if (arc?.data) return { ...arc.data, cast: namedVillagers(state).slice(0, arc.step === 'camp' ? 6 : 4) };
    return { cast: [], from: r.pick(PLACES), goods: r.pick(GOODS), wagons: r.int(2, 3) };
  },
  fire(state, r) {
    // a house without named villagers burns (they are never victims); named villagers lead the buckets
    const named = namedVillagers(state);
    const namedIds = new Set(named.map((n) => n.id));
    const houses = state.houses.filter((h) => h.status === 'occupied' && h.occupants.length && !h.occupants.some((id) => namedIds.has(id)));
    if (!houses.length) return null;
    const heroes = named.length ? [r.pick(named.slice(0, 12))] : [];
    const other = named.filter((n) => !heroes.includes(n));
    if (other.length) heroes.push(r.pick(other.slice(0, 12)));
    // the neighbours passing the buckets along the chain, named too (owner 2026-10-25)
    const chain = named.filter((n) => !heroes.includes(n)).slice(0, 12), passers = [];
    while (passers.length < 4 && chain.length) passers.push(chain.splice(r.int(0, chain.length - 1), 1)[0]);
    return { cast: heroes, chain: passers, house: r.pick(houses.slice(0, 200)).id };
  },
  rebuild(state, r, arc) {
    const house = arc?.house ?? BUILD.fire(state, r)?.house;
    if (house === undefined) return null;
    const named = namedVillagers(state);
    const crew = named.filter((n) => BUILDERS.includes(n.job)).slice(0, 3);
    if (!crew.length && named.length) crew.push(r.pick(named.slice(0, 12)));
    return { cast: crew, house };
  },
  wolves(state, r) {
    const named = namedVillagers(state);
    const heroes = named.filter((n) => HEROES.includes(n.job) || n.job === 'farmer' || n.job === 'peasant').slice(0, 2);
    if (!heroes.length && named.length) heroes.push(r.pick(named.slice(0, 12)));
    // the folk with torches behind them: farmers, peasants, shepherds, woodcutters
    return { cast: heroes, wolves: r.int(4, 6), folk: roleCast(state, r, ['farmer', 'peasant', 'shepherd', 'woodcutter'], Math.max(2, 4 - heroes.length), heroes) };
  },
  newyear(state) {
    return { cast: namedVillagers(state).slice(0, 8) };
  },
  flood(state, r) {
    const pool = namedVillagers(state).slice(0, 12), cast = [];
    while (cast.length < 5 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return { cast };
  },
  pig(state, r) {
    const named = namedVillagers(state);
    const farmers = named.filter((n) => n.job === 'farmer' || n.job === 'peasant');
    const chaser = farmers.length ? r.pick(farmers.slice(0, 8)) : castMember(state, r, named);
    return chaser ? { cast: [chaser] } : null;
  },
  archery(state, r, arc) {
    if (arc?.data) return { cast: arc.data.cast }; // the same three in the final
    // archers and guards first; the winner is the first of the cast
    const named = namedVillagers(state);
    const pool = [...named.filter((n) => n.job === 'fletcher' || HEROES.includes(n.job)), ...named.filter((n) => n.job !== 'fletcher' && !HEROES.includes(n.job))].slice(0, 8);
    const cast = [];
    while (cast.length < 3 && pool.length) cast.push(pool.splice(r.int(0, Math.min(pool.length - 1, 3)), 1)[0]);
    return { cast };
  },
  royal(state, r) {
    // (a new crowd in the front row, or at the feast table, every day)
    const pool = namedVillagers(state).slice(0, 16), cast = [];
    while (cast.length < 6 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    // the King's two banner guards, named guards or knights
    return { cast, escort: roleCast(state, r, ['guard', 'knight'], 2, cast) };
  },
  tourney(state, r, arc) {
    if (arc?.data) {
      // the same bracket; the round of the day (its fighters are the cast); the champion is made captain on the last day
      const round = arc.step === 'final' ? 2 : arc.step === 'semis' ? 1 : 0;
      if (arc.step === 'final') state.guardCaptain = arc.data.champion;
      return { ...arc.data, cast: arc.data.rounds[round].flatMap((b) => [b.a, b.b]) };
    }
    // eight named guards drawn at random; in each bout the one named first (the older name) wins 85 times in 100, the
    // newer 15, two named the same day 50/50 (owner 2026-10-25). All three rounds are decided now, so the days agree.
    const pool = namedVillagers(state).filter((n) => n.job === 'guard'), entrants = [];
    while (entrants.length < 8 && pool.length) entrants.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    if (entrants.length < 8) return null;
    const odds = (a, b) => (a.day < b.day ? TOURNEY_ODDS : a.day > b.day ? 1 - TOURNEY_ODDS : 0.5);
    const rounds = [];
    let field = entrants.map(({ id, name, job, day }) => ({ id, name, job, day }));
    while (field.length > 1) {
      const bouts = [];
      for (let i = 0; i < field.length; i += 2) {
        const a = field[i], b = field[i + 1];
        bouts.push({ a, b, winner: (r.chance(odds(a, b)) ? a : b).id });
      }
      rounds.push(bouts);
      field = bouts.map((bt) => (bt.winner === bt.a.id ? bt.a : bt.b));
    }
    return { rounds, champion: field[0].id, cast: rounds[0].flatMap((b) => [b.a, b.b]) };
  },
  storm(state, r) {
    const pool = namedVillagers(state).slice(0, 12), cast = [];
    while (cast.length < 4 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return { cast };
  },
  martinmas(state, r) {
    // a named innkeeper or brewer opens the barrel; the newest named villagers raise their cups
    const keeper = roleCast(state, r, ['innkeeper', 'brewer'], 1)[0] || castMember(state, r, namedVillagers(state));
    if (!keeper) return null;
    return { cast: [keeper, ...namedVillagers(state).filter((n) => n.id !== keeper.id).slice(0, 6)] };
  },
  christmas(state, r) {
    // a named priest or bishop blesses the crowd (when the kingdom has one), the newest named villagers sing round the fire
    const priest = roleCast(state, r, ['priest', 'bishop'], 1)[0] || null;
    return { priest, cast: [...(priest ? [priest] : []), ...namedVillagers(state).filter((n) => n.id !== priest?.id).slice(0, 8)] };
  },
  proclaim(state, r, arc, tier) {
    const t = TIERS.find((x) => x.id === tier);
    if (!t) return null;
    // the crier reads it out (a named one when there is one), five named villagers cheer in front
    const crier = roleCast(state, r, ['crier'], 1)[0] || null;
    const crowd = roleCast(state, r, Object.keys(JOB_COUNT(state)), 5, crier ? [crier] : []);
    return { tier: t.id, title: t.title, crier, cast: [...(crier ? [crier] : []), ...crowd] };
  },
  decree(state, r) {
    // the crier reads it out (a named one when there is one), five named guards in front
    const crier = roleCast(state, r, ['crier'], 1)[0] || null;
    const guards = roleCast(state, r, ['guard'], 5, crier ? [crier] : []);
    return { crier, cast: [...(crier ? [crier] : []), ...guards] };
  },
  bigfish(state, r, arc) {
    // the next day the same fisherman roasts it for the newest named villagers
    if (arc?.data) return { ...arc.data, cast: [arc.data.cast[0], ...namedVillagers(state).filter((n) => n.id !== arc.data.cast[0].id).slice(0, 5)] };
    const named = namedVillagers(state);
    const fisher = roleCast(state, r, ['fisherman'], 1)[0] || castMember(state, r, named);
    if (!fisher) return null;
    return { cast: [fisher, ...roleCast(state, r, named.map((n) => n.job), 2, [fisher])] };
  },
  chicken(state, r) {
    const named = namedVillagers(state), cast = [];
    const pool = named.slice(0, 12);
    while (cast.length < 3 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return cast.length ? { cast } : null;
  },
  windmill(state, r) {
    const named = namedVillagers(state);
    const miller = roleCast(state, r, ['miller'], 1)[0] || castMember(state, r, named);
    if (!miller) return null;
    return { cast: [miller, ...roleCast(state, r, named.map((n) => n.job), 2, [miller])] };
  },
  tugofwar(state, r) {
    // up to four on each side; the side that wins is drawn now
    const guards = roleCast(state, r, GUARDS, 4), farmers = roleCast(state, r, LAND, 4, guards);
    if (guards.length < 2 || farmers.length < 2) return null;
    return { guards, farmers, winner: r.chance(0.5) ? 'guards' : 'farmers', cast: [...guards, ...farmers] };
  },
  haycart(state, r) {
    const named = namedVillagers(state);
    const carter = roleCast(state, r, LAND, 1)[0] || castMember(state, r, named);
    if (!carter) return null;
    return { cast: [carter, ...roleCast(state, r, named.map((n) => n.job), 4, [carter])] };
  },
  rebel(state, r, arc) {
    // the newest rebel not yet pilloried (test renders with none: the newest named villager), the executioner (a named one when
    // there is one) and up to four named villagers throwing tomatoes; owner 2026-11-14: the one found guilty at the trial
    // (`arc.rebel`, the day after the verdict)
    const named = namedVillagers(state);
    const rebel = (arc?.rebel !== undefined && named.find((n) => n.id === arc.rebel)) || rebelsWaiting(state)[0] || named[0];
    if (!rebel) return null;
    if (arc?.rebel !== undefined) state.names[rebel.id].pilloryDay = state.day;
    const executioner = roleCast(state, r, ['executioner'], 1, [rebel])[0] || null;
    const throwers = roleCast(state, r, Object.keys(JOB_COUNT(state)), 4, [rebel, ...(executioner ? [executioner] : [])]);
    return { rebel, executioner, throwers, cast: [rebel, ...(executioner ? [executioner] : []), ...throwers] };
  },
  snowballs(state, r) {
    const pool = namedVillagers(state).slice(0, 16), cast = [];
    while (cast.length < 8 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    return cast.length >= 2 ? { cast } : null;
  },
  race(state, r, arc) {
    return game(state, r, arc, 'race');
  },
  joust(state, r, arc) {
    return game(state, r, arc, 'joust');
  },
  ship(state, r, arc) {
    // a new crowd every day: waving on the quay as it comes and goes, carrying crates and sacks when it is unloaded
    const unload = arc?.step === 'unload';
    const cast = unload ? roleCast(state, r, ['sailor', 'merchant', 'peasant', 'farmer', 'carpenter', 'cooper', 'woodcutter', 'fisherman'], 4) : [];
    const pool = namedVillagers(state).filter((n) => !cast.some((c) => c.id === n.id)).slice(0, 16);
    while (cast.length < (unload ? 4 : 6) && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    if (arc?.data) return { ...arc.data, cast };
    return { from: r.pick(PLACES), goods: r.pick(GOODS), name: r.pick(SHIPS), cast };
  },
  bell(state, r, arc) {
    // the bellfounder (a named one when there is one) leads all three days; named helpers, new ones every day
    const founder = arc?.data?.founder ?? (roleCast(state, r, ['bellfounder'], 1)[0] || castMember(state, r, namedVillagers(state)));
    if (!founder) return null;
    const helpers = roleCast(state, r, Object.keys(JOB_COUNT(state)), arc?.step === 'raise' ? 5 : 3, [founder]);
    return { founder, cast: [founder, ...helpers] };
  },
  fogboat(state, r) {
    // the fisherman out on the water (a named one when there is one); named villagers on the pier: one rings the bell,
    // the others hold torches by the beacon fire
    const named = namedVillagers(state);
    const fisher = roleCast(state, r, ['fisherman'], 1)[0] || castMember(state, r, named);
    if (!fisher) return null;
    const pier = roleCast(state, r, Object.keys(JOB_COUNT(state)), 4, [fisher]);
    return { fisher, cast: [fisher, ...pier] };
  },
  census(state, r) {
    // the clerk at the table (a named reeve, tax collector or teacher when there is one), five named villagers in the queue;
    // the count: the kingdom's number on the day
    const clerk = roleCast(state, r, ['taxcollector', 'reeve', 'teacher', 'philosopher'], 1)[0] || null;
    const queue = roleCast(state, r, Object.keys(JOB_COUNT(state)), 5, clerk ? [clerk] : []);
    return { clerk, count: state.subscriberCount, cast: [...(clerk ? [clerk] : []), ...queue] };
  },
  pies(state, r) {
    // three named villagers at the table; the winner drawn now
    const pool = namedVillagers(state).slice(0, 14), cast = [];
    while (cast.length < 3 && pool.length) cast.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
    if (cast.length < 2) return null;
    return { cast, winner: r.pick(cast).id };
  },
  regatta(state, r) {
    // three boats, a named rower in each (fishermen and sailors first), four named villagers cheering on the pier
    const named = namedVillagers(state);
    const rowers = roleCast(state, r, ['fisherman', 'sailor'], 3);
    rowers.push(...roleCast(state, r, Object.keys(JOB_COUNT(state)), 3 - rowers.length, rowers));
    if (rowers.length < 2) return null;
    const crowd = roleCast(state, r, named.map((n) => n.job), 4, rowers);
    return { rowers, crowd, winner: r.pick(rowers).id, cast: [...rowers, ...crowd] };
  },
  dayinlife(state, r) {
    // one of the newest named scholars
    const scholars = namedVillagers(state).filter((n) => n.job === 'scholar').slice(0, 12);
    if (!scholars.length) return null;
    const hero = r.pick(scholars);
    // the other named scholars talking in the corridor wear their names (owner 2026-11-01)
    return { job: 'scholar', hero, cast: [hero], others: roleCast(state, r, ['scholar'], 8, [hero]) };
  },
  crusade(state, r, arc) {
    if (arc?.step !== 'quest') {
      // the crier calls for Crusaders, named guards in front of the dais
      const crier = roleCast(state, r, ['crier'], 1)[0] || null;
      const guards = roleCast(state, r, ['guard'], 5, crier ? [crier] : []);
      return { day: state.day, crier: crier && strip(crier), cast: [...(crier ? [crier] : []), ...guards].map(strip) };
    }
    const w = world(state.seed);
    const gate = raidGate(w, state);
    const knight = roleCast(state, r, ['knight'], 1)[0] || null;
    if (!gate) return null;
    const crusaders = drawGuards(state, r, 6);
    if (crusaders.length < 2) return null;
    state.gamesEntrants = []; // the quest is run: the next games take new entries
    for (const c of crusaders) state.names[c.id].crusaderDay = state.day;
    const taken = [...crusaders, ...(knight ? [knight] : [])];
    const crowd = namedVillagers(state).filter((n) => !taken.some((x) => x.id === n.id)).slice(0, 8);
    return {
      gate: { x: gate.x, z: gate.z, rot: gate.rot, in: gate.in, side: gate.side }, knight: knight && strip(knight),
      crusaders: crusaders.map((c) => ({ ...strip(c), joined: !!c.joined })), joined: crusaders.filter((c) => c.joined).length,
      crowd: crowd.map(strip), cast: [...(knight ? [knight] : []), ...crusaders, ...crowd].map(strip),
    };
  },
  riddle(state, r, arc) {
    const crier = roleCast(state, r, ['crier'], 1)[0] || null;
    if (arc?.step !== 'answer') {
      // the next riddle not asked yet, in order; once all have been asked, they start again
      state.riddlesAsked ??= [];
      if (state.riddlesAsked.length >= RIDDLES.length) state.riddlesAsked = [];
      const q = RIDDLES.find((x) => !state.riddlesAsked.includes(x.id));
      state.riddlesAsked.push(q.id);
      const scholars = roleCast(state, r, ['scholar'], 5, crier ? [crier] : []);
      return { riddle: q.id, day: state.day, crier: crier && strip(crier), cast: [...(crier ? [crier] : []), ...scholars].map(strip) };
    }
    // the first two who answered right and are scholars still: Engineers from today
    const riddle = arc.data?.riddle;
    if (!RIDDLE[riddle]) return null;
    const named = namedVillagers(state);
    const winners = (state.riddleSolvers || []).map((id) => named.find((n) => n.id === id)).filter((n) => n && n.job === 'scholar').slice(0, 2);
    for (const w of winners) promote(state, w.id, 'engineer');
    state.riddleSolvers = [];
    const others = roleCast(state, r, ['scholar'], 4, [...winners, ...(crier ? [crier] : [])]);
    return { riddle, winners: winners.map((w) => strip({ ...w, job: 'engineer' })), crier: crier && strip(crier),
      cast: [...(crier ? [crier] : []), ...winners.map((w) => ({ ...w, job: 'engineer' })), ...others].map(strip) };
  },
  vote(state, r, arc) {
    const crier = roleCast(state, r, ['crier'], 1)[0] || null;
    // the newest named villagers in front of the dais (today's commenters first)
    const crowd = namedVillagers(state).filter((n) => n.id !== crier?.id).slice(0, 5);
    const cast = [...(crier ? [crier] : []), ...crowd].map(strip);
    if (arc?.step !== 'result') {
      // the next vote not asked yet that the kingdom can hold, in order; once all have been asked, they start again
      const open = openVotes(state);
      if (!open.length) return null;
      state.votesAsked ??= [];
      if (open.every((v) => state.votesAsked.includes(v.id))) state.votesAsked = [];
      const q = open.find((v) => !state.votesAsked.includes(v.id));
      state.votesAsked.push(q.id);
      state.voteTally = { a: 0, b: 0 };
      return { vote: q.id, day: state.day, crier: crier && strip(crier), cast };
    }
    const q = VOTE[arc.data?.vote];
    if (!q) return null;
    const tally = { a: state.voteTally?.a ?? 0, b: state.voteTally?.b ?? 0 }, winner = voteWinner(tally);
    state.voteTally = null;
    // what won is tomorrow's story (pickStory hands an arc on only to a next step, so it is set here)
    state.storyArc = { id: q[winner].story, day: state.day + 1, voted: q.id };
    return { vote: q.id, tally, winner, crier: crier && strip(crier), cast };
  },
  noble(state, r, entry) {
    // the villager the owner named (`entry.id`); a test render with no one queued takes the first named villager
    const named = namedVillagers(state);
    const hero = entry ? named.find((n) => n.id === entry.id) : (state.ennoble || []).map((e) => named.find((n) => n.id === e.id)).find(Boolean) || named.at(-1);
    if (!hero) return null;
    state.names[hero.id].noble ??= state.day;
    // the newest named villagers line the carpet (today's commenters first)
    const crowd = named.filter((n) => n.id !== hero.id).slice(0, 6);
    return { hero: strip(hero), crowd: crowd.map(strip), cast: [hero, ...crowd].map(strip) };
  },
  escape(state, r) {
    // up to four named prisoners (the newest first), three named guards, the named baker at the cart when there is one, and
    // the newest named villagers watching from the stalls
    const prisoners = roleCast(state, r, ['prisoner'], 4);
    const guards = roleCast(state, r, GUARDS, 3, prisoners);
    if (prisoners.length < 2 || !guards.length) return null;
    const baker = roleCast(state, r, ['baker'], 1, [...prisoners, ...guards])[0] || null;
    const taken = [...prisoners, ...guards, ...(baker ? [baker] : [])];
    const crowd = namedVillagers(state).filter((n) => !taken.some((x) => x.id === n.id)).slice(0, 5);
    return { prisoners: prisoners.map(strip), guards: guards.map(strip), baker: baker && strip(baker), crowd: crowd.map(strip), cast: [...prisoners, ...guards, ...crowd].map(strip) };
  },
  eclipse(state, r) {
    // the one who explains it: a named scholar, else a named priest or bishop, else a nameless scholar; the crier rings the
    // bell; the newest named villagers (today's commenters first) look up in the square
    const wise = roleCast(state, r, ['scholar'], 1)[0] || roleCast(state, r, ['priest', 'bishop'], 1)[0] || null;
    const crier = roleCast(state, r, ['crier'], 1, wise ? [wise] : [])[0] || null;
    const taken = [wise, crier].filter(Boolean);
    const watchers = namedVillagers(state).filter((n) => !taken.some((x) => x.id === n.id)).slice(0, 6);
    if (watchers.length < 3) return null;
    return { wise: wise && strip(wise), crier: crier && strip(crier), watchers: watchers.map(strip), cast: [...watchers, ...taken].map(strip) };
  },
  ambush(state, r, arc) {
    if (arc?.step === 'rescue') {
      const { id: _id, step: _step, ...d } = arc.data; // (yesterday's story as saved, without its id and step)
      // the same guards and merchants (while they keep their job); the riders: named Cavaliers and Knights first, then guards
      const still = (c, jobs) => c && jobs.includes(state.villagers[c.id]?.job) ? c : null;
      const guards = (d.guards || []).map((c) => still(c, ['guard', 'knight']));
      const merchants = (d.merchants || []).map((c) => still(c, ['merchant']));
      const keep = [...guards, ...merchants].filter(Boolean);
      const riders = roleCast(state, r, ['cavalier', 'knight'], 6, keep);
      riders.push(...roleCast(state, r, ['guard'], 6 - riders.length, [...keep, ...riders]));
      return { ...d, guards, merchants, riders: riders.map(strip), ring: d.bandits + r.int(8, 12), downed: r.int(3, 5),
        cast: [...keep, ...riders].map(strip) };
    }
    const guards = roleCast(state, r, ['guard'], 6);
    if (guards.length < 4) return null;
    while (guards.length < 6) guards.push(null); // nameless guards fill the escort
    const merchants = roleCast(state, r, ['merchant'], 2, guards.filter(Boolean));
    while (merchants.length < 2) merchants.push(null);
    const cargo = r.pick(['the taxes of the eastern villages', 'grain for the winter', 'iron for the forge', 'cloth for the market']);
    return { guards: guards.map((c) => c && strip(c)), merchants: merchants.map((c) => c && strip(c)), bandits: r.int(14, 18), cargo,
      cast: [...merchants, ...guards].filter(Boolean).map(strip) };
  },
  trial(state, r, arc) {
    if (arc?.step === 'verdict') {
      const { id: _id, step: _step, ...d } = arc.data; // (yesterday's story as saved, without its id and step)
      // the most likes on a comment each of the two wrote since the trial (null: no comment; simulate.js)
      const likes = { accused: state.trialLikes?.accused ?? null, accuser: state.trialLikes?.accuser ?? null };
      state.trialLikes = null;
      const outcome = likes.accused === null && likes.accuser === null ? 'dismissed'
        : likes.accused === null ? 'guilty' : likes.accuser === null ? 'innocent'
          : likes.accuser > likes.accused ? 'guilty' : 'innocent'; // a tie: the accused walks free
      const guilty = outcome === 'guilty';
      const sentence = guilty ? (d.rebel ? 'pillory' : r.pick(Object.keys(TRIAL_SENTENCES).filter((k) => k !== 'pillory'))) : null;
      // a rebel found guilty goes to the pillory tomorrow (BUILD.rebel)
      if (guilty && d.rebel && state.villagers[d.accused.id]) state.storyArc = { id: 'rebel', day: state.day + 1, rebel: d.accused.id };
      return { ...d, likes, outcome, guilty, sentence };
    }
    // a named Judge and a named Bailiff when the kingdom has them; the two parties picked first among the villagers whose
    // commenters wrote in today's comments (then in the last three days, then any): the accused (the rebel waiting for the
    // pillory, `arc.rebel`, pickStory), the accuser (a villager whose job fits the charge when there is one); the newest named
    // villagers on the benches
    const named = namedVillagers(state);
    const judge = roleCast(state, r, ['judge'], 1)[0] || null;
    const bailiff = roleCast(state, r, ['bailiff'], 1, judge ? [judge] : [])[0] || null;
    const officers = [judge, bailiff].filter(Boolean);
    const seen = (n) => state.names[n.id]?.seenDay ?? -1;
    const free = (n, taken) => !taken.some((o) => o.id === n.id);
    const tiers = (taken) => [named.filter((n) => free(n, taken) && seen(n) === state.day), named.filter((n) => free(n, taken) && seen(n) >= state.day - 3), named.filter((n) => free(n, taken))];
    const rebel = arc?.rebel !== undefined ? named.find((n) => n.id === arc.rebel) : null;
    const accused = rebel || (() => { const pool = tiers(officers).find((p) => p.length); return pool && r.pick(pool.slice(0, 12)); })();
    if (!accused?.name) return null;
    const [text, fits] = r.pick(TRIAL_CHARGES[rebel ? 'rebel' : accused.job] || CHARGE_ANY);
    let accuser = null;
    for (const pool of tiers([...officers, accused])) {
      if (!pool.length) continue;
      const best = pool.filter((n) => fits.includes(n.job));
      accuser = r.pick((best.length ? best : pool).slice(0, 12));
      break;
    }
    if (!accuser) return null;
    const taken = [...officers, accused, accuser];
    const crowd = named.filter((n) => !taken.some((x) => x.id === n.id)).slice(0, 6);
    state.names[accused.id].trialDay = state.day;
    state.trialLikes = { accused: null, accuser: null };
    return {
      accused: strip(accused), accuser: strip(accuser), charge: text, rebel: !!rebel,
      judge: judge && strip(judge), bailiff: bailiff && strip(bailiff), crowd: crowd.map(strip),
      cast: [accused, accuser, ...officers, ...crowd].map(strip),
    };
  },
  raid(state, r, arc) {
    if (arc?.step === 'rescue') {
      const { id: _id, step: _step, ...d } = arc.data; // (yesterday's story as saved, without its id and step)
      // the guard first to the gate leads four other named guards; named carpenters and masons repair; the newest named
      // villagers (today's commenters first) cheer at the gate; the crier (a named one when there is one) reads the news
      const keep = [d.guard, d.owner, d.missing].filter(Boolean);
      const guards = [...(state.villagers[d.guard.id] && GUARDS.includes(state.villagers[d.guard.id].job) ? [d.guard] : []), ...roleCast(state, r, GUARDS, 5, keep)].slice(0, 5);
      const crew = roleCast(state, r, BUILDERS, 3, [...keep, ...guards]);
      const crier = roleCast(state, r, ['crier'], 1, [...keep, ...guards, ...crew])[0] || null;
      const taken = [...keep, ...guards, ...crew, ...(crier ? [crier] : [])];
      const crowd = namedVillagers(state).filter((n) => !taken.some((x) => x.id === n.id)).slice(0, 8).map(strip);
      return { ...d, guards: guards.map(strip), crew: crew.map(strip), crier: crier && strip(crier), crowd, cast: [...guards, ...(d.missing ? [d.missing] : []), ...crew, ...crowd].map(strip) };
    }
    const w = world(state.seed);
    const gate = raidGate(w, state);
    if (!gate) return null;
    // three houses burn: the house with a named villager inside the wall nearest the gate (the one the video shows) and
    // the two next to it
    const named = namedVillagers(state), namedIds = new Set(named.map((n) => n.id));
    const plots = new Map(state.plots.map((p) => [p.id, p]));
    const near = state.houses.filter((h) => h.status === 'occupied' && h.occupants.length && plots.has(h.plot))
      .map((h) => ({ h, p: plots.get(h.plot) })).filter(({ p }) => insideWall2(state.wall2.pts, p.x, p.z, undefined, w))
      .map((o) => ({ ...o, d: Math.hypot(o.p.x - gate.x, o.p.z - gate.z) })).sort((a, b) => a.d - b.d || a.h.id - b.h.id);
    const shown = near.find((o) => o.h.occupants.some((id) => namedIds.has(id)));
    if (!shown) return null;
    const rest = near.filter((o) => o !== shown).sort((a, b) => Math.hypot(a.p.x - shown.p.x, a.p.z - shown.p.z) - Math.hypot(b.p.x - shown.p.x, b.p.z - shown.p.z) || a.h.id - b.h.id).slice(0, 2);
    const owner = named.find((n) => shown.h.occupants.includes(n.id));
    const guard = roleCast(state, r, GUARDS, 1, [owner])[0];
    if (!guard) return null;
    // the missing villager: a named villager who is no guard (the guards free them the next day)
    const others = named.filter((n) => !GUARDS.includes(n.job) && n.id !== owner.id);
    // (the owner may name them: storyArc.missing, a villager id; owner 2026-11-07: BENDYX20II. The draw is still made, so the
    // rest of the cast stays as it was)
    const drawn = others.length ? r.pick(others.slice(0, 12)) : null;
    const missing = (arc?.missing !== undefined && named.find((n) => n.id === arc.missing && n.id !== owner.id && n.id !== guard.id)) || drawn;
    // four more named guards on the wall and at the gate; the neighbours at the buckets in front of the burning house
    // (today's commenters first)
    const defenders = roleCast(state, r, GUARDS, 4, [owner, guard]);
    const chain = named.filter((n) => ![owner.id, guard.id, missing?.id, ...defenders.map((x) => x.id)].includes(n.id)).slice(0, 3);
    const watch = Math.max(5, Math.round(state.villagers.filter((v) => GUARDS.includes(v.job)).length / 20));
    const bandits = Math.max(30, Math.round((watch * 2 + r.int(-4, 4)) / 10) * 10);
    return {
      gate: { x: gate.x, z: gate.z, rot: gate.rot, in: gate.in, side: gate.side }, houses: [shown.h.id, ...rest.map((o) => o.h.id)],
      owner: strip(owner), guard: strip(guard), defenders: defenders.map(strip), missing: missing && strip(missing), chain: chain.map(strip),
      // the guards on watch that night (one in twenty, at least five; the kingdom has hundreds) and about twice as many bandits
      bandits, guardCount: watch, population: state.subscriberCount,
      cast: [guard, ...defenders, owner, ...chain].map(strip),
    };
  },
};
const strip = ({ id, name, job, day }) => ({ id, name, job, day });

/**
 * The gate of the Second Wall the bandits break (owner 2026-11-07: never a north gate; the one at the top of the hill stood
 * on a slope and the camera saw nothing). The town has grown past the wall, so most gates have houses outside: the gate
 * chosen has the wall straight beside it (the shots film along it), flat ground, at least three occupied houses inside near
 * it, and the widest road out clear of plots (the bandits run down it); ties: the fewest plots outside, then the northernmost. Else the old rule: the gate
 * with the fewest plots outside. side: where it stands seen from the castle (north is -z). `in` ([x, z]): the way into the
 * town, found by the wall itself (toward the castle is wrong where the wall bends); the frame's `x` runs along the wall.
 */
function raidGate(w, state) {
  if (!state.wall2?.pts) return null;
  const sideOf = (g) => ['east', 'north', 'west', 'south'][((Math.round(Math.atan2(-g.z, g.x) / (Math.PI / 2)) % 4) + 4) % 4];
  const gates = wallLayout(w, state.wall2.pts).gates.filter((g) => sideOf(g) !== 'north');
  if (!gates.length) return null;
  const pts = state.wall2.pts, inside = (x, z) => insideWall2(pts, x, z, undefined, w);
  const plots = new Map(state.plots.map((p) => [p.id, p]));
  const homes = state.houses.filter((h) => h.status === 'occupied' && plots.has(h.plot)).map((h) => plots.get(h.plot));
  const rated = gates.map((g) => {
    let ix = -Math.sin(g.rot), iz = Math.cos(g.rot);
    if (!inside(g.x + ix * 14, g.z + iz * 14)) { ix = -ix; iz = -iz; }
    const at = (x, z) => [g.x + iz * x + ix * z, g.z - ix * x + iz * z]; // frame (x along the wall, z in) to world
    const local = (p) => [(p.x - g.x) * iz - (p.z - g.z) * ix, (p.x - g.x) * ix + (p.z - g.z) * iz];
    let bent = 0;
    for (let x = -16; x <= 24; x += 4) if (inside(...at(x, -14)) || !inside(...at(x, 14))) bent++;
    const hs = [-50, -30, -10, 10, 30].map((z) => heightAt(w, ...at(0, z)));
    const slope = Math.max(...hs) - Math.min(...hs);
    const near = state.plots.map((p) => [...local(p), Math.max(p.hw || 5, p.hd || 5) + 2.3]).filter(([, z, r]) => z > -56 - r && z < -14 + r);
    let road = 0;
    for (let x = -24; x <= 24; x += 1.1) if (!near.some(([ox, , r]) => Math.abs(ox - x) < r)) road++;
    const outside = state.plots.filter((p) => { const [x, z] = local(p); return Math.abs(x) < 30 && z < -3 && z > -55; }).length;
    const homesIn = homes.filter((p) => { const [x, z] = local(p); return Math.abs(x) < 45 && z > 3 && z < 90; }).length;
    return { g, in: [ix, iz], bent, slope, road, outside, inside: homesIn };
  });
  const good = rated.filter((x) => !x.bent && x.slope < 3 && x.inside >= 3).sort((a, b) => b.road - a.road || a.outside - b.outside || a.g.z - b.g.z);
  const best = good[0] || [...rated].sort((a, b) => a.outside - b.outside || b.inside - a.inside)[0];
  const { g } = best;
  return { ...g, in: best.in.map((v) => Math.round(v * 1e6) / 1e6), side: sideOf(g) };
}
const SHIPS = ['the Sea Swallow', 'the Golden Gull', 'the Saint Brendan', 'the Merry Otter', 'the Northern Star', 'the Fair Wind'];

// the riders of the games at the Tournament Ground: named guards only (owner 2026-10-28), not the Captain of the Guard
function jousters(state) {
  return namedVillagers(state).filter((n) => n.job === 'guard' && n.id !== state.guardCaptain);
}

// how many ride in each game, and what the winner is made
export const GAMES = { race: { riders: 4, title: 'cavalier' }, joust: { riders: 8, title: 'knight', bracket: true } };

/**
 * The entrants of a game (owner 2026-10-28): n named guards drawn without replacement, first among those who commented
 * "!join" (state.gamesEntrants, still guards today), then among the other guards for the places left. Each draw is weighted
 * by seniority among the guards still in that pool: the one named longest ago weighs 1.9, the newest 1.0, the others in
 * between in proportion to their place in the line (ties: the lower id is the older).
 */
export function drawGuards(state, r, n) {
  const guards = jousters(state).map(({ id, name, job, day }) => ({ id, name, job, day }));
  const entered = new Set(state.gamesEntrants || []);
  const joined = guards.filter((g) => entered.has(g.id));
  const rest = guards.filter((g) => !joined.includes(g));
  const out = [];
  for (const pool of [joined, rest]) {
    const line = [...pool].sort((a, b) => a.day - b.day || a.id - b.id); // the oldest first
    const w = new Map(line.map((g, i) => [g.id, 1 + 0.9 * (line.length > 1 ? (line.length - 1 - i) / (line.length - 1) : 1)]));
    const left = [...line];
    while (out.length < n && left.length) {
      const g = r.weighted(left, (x) => w.get(x.id));
      out.push({ ...g, joined: pool === joined });
      left.splice(left.indexOf(g), 1);
    }
  }
  return out;
}

/** The chariot race or the joust: the announcement, then the results (and the title) the next day. */
function game(state, r, arc, id) {
  if (arc?.step !== 'results') {
    // the town crier (a named one when there is one) reads it; named guards in front of the dais, hoping to ride
    const crier = roleCast(state, r, ['crier'], 1)[0] || null;
    const guards = roleCast(state, r, ['guard'], 5, crier ? [crier] : []);
    return { game: id, day: state.day, crier, cast: [...(crier ? [crier] : []), ...guards] };
  }
  const since = arc.data?.day ?? state.day - 1;
  const riders = drawGuards(state, r, GAMES[id].riders);
  if (riders.length < 2) return null;
  state.gamesEntrants = []; // the game is run: the next games take new entries
  // the Grand Joust (owner 2026-11-01): a knockout in the order drawn, each bout 50/50, the rounds decided now
  const rounds = GAMES[id].bracket ? knockout(riders, r) : null;
  const winner = rounds ? rounds.at(-1)[0].winner : r.pick(riders).id;
  promote(state, winner, GAMES[id].title);
  // seven named villagers in the stands (with the riders, few enough tags that all show at once)
  const pool = namedVillagers(state).filter((n) => !riders.some((x) => x.id === n.id)).slice(0, 30), crowd = [];
  while (crowd.length < 7 && pool.length) crowd.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
  return { game: id, day: since, riders, ...(rounds ? { rounds } : {}), crowd, winner, joined: riders.filter((x) => x.joined).length, cast: [...riders, ...crowd] };
}

/** A knockout over the riders (as many as a power of two allows, in order): rounds of bouts { a, b, winner }. */
function knockout(riders, r) {
  let field = riders.slice(0, 2 ** Math.floor(Math.log2(riders.length))).map((x) => x.id);
  const rounds = [];
  while (field.length > 1) {
    const bouts = [];
    for (let i = 0; i < field.length; i += 2) bouts.push({ a: field[i], b: field[i + 1], winner: r.chance(0.5) ? field[i] : field[i + 1] });
    rounds.push(bouts);
    field = bouts.map((bt) => bt.winner);
  }
  return rounds;
}

/** The champion of the games becomes a Knight (owner 2026-10-27), the winner of the chariot race a Cavalier (2026-10-28). */
function promote(state, id, job) {
  const n = state.names?.[id];
  if (!n) return;
  n.job = job;
  n[job + 'Day'] = state.day;
  if (state.villagers[id]) state.villagers[id].job = job;
}
/** Named villagers who talked of overthrowing the king in the last 7 days and were not pilloried since, newest first. */
function rebelsWaiting(state) {
  return namedVillagers(state).filter((n) => {
    const x = state.names[n.id];
    return x.rebelDay !== undefined && x.rebelDay >= state.day - 7 && !(x.pilloryDay >= x.rebelDay) && !(x.trialDay >= x.rebelDay);
  }).sort((a, b) => state.names[b.id].rebelDay - state.names[a.id].rebelDay || b.day - a.day);
}

// every job some named villager has (anyone may cheer)
const JOB_COUNT = (state) => Object.fromEntries(namedVillagers(state).map((n) => [n.job, 1]));

/**
 * Today's story, or null. Records it in state.storyLog (id -> last day) for the cooldowns.
 * Call after the population and names of the day are settled.
 */
export function pickStory(state, { unlocked = [], buildingShots = 0 } = {}) {
  state.storyLog ??= {};
  const r = rng(state.seed, 'story', state.date);
  const pop = state.subscriberCount;
  const mmdd = state.date.slice(5);
  const possible = (id, s) => pop >= (s.minPop ?? 1) && (!s.needs || s.needs(state, { buildingShots }));
  // a story the owner set for a given day (state.storyArc with owner: true; owner 2026-10-29: the joust) comes before the
  // calendar and the proclamation of a new goal
  // so does the next step of an urgent story (the rescue the day after the raid)
  const ownerDay = !!((state.storyArc?.owner || STORIES[state.storyArc?.id]?.urgent) && state.storyArc.day <= state.day);
  let id = ownerDay ? undefined : Object.keys(STORIES).find((k) => STORIES[k].date === mmdd && possible(k, STORIES[k]));
  // a new goal reached today: the proclamation (the highest tier when several came at once)
  if (!id && unlocked.length && !ownerDay) {
    const story = BUILD.proclaim(state, r, null, unlocked[unlocked.length - 1]);
    if (story) { state.storyLog.proclaim = state.day; return { id: 'proclaim', ...story }; }
  }
  // a villager the owner ennobles (scripts/ennoble.js): on the day the owner set, or the first day after it that no owner
  // story, urgent step, calendar event or new goal takes
  const due = !id && !ownerDay && !unlocked.length && (state.ennoble || []).find((e) => e.day <= state.day);
  if (due) {
    state.ennoble = state.ennoble.filter((e) => e !== due);
    const story = BUILD.noble(state, r, due);
    if (story) { state.storyLog.noble = state.day; return { id: 'noble', ...story }; }
  }
  // then a story that continues from an earlier day (the next step, or the house rebuilt after a fire)
  const arc = state.storyArc;
  if (!id && arc && arc.day <= state.day) {
    state.storyArc = null;
    if (arc.step !== undefined && !STORIES[arc.id]?.steps?.includes(arc.step)) return null; // a step that no longer exists
    const story = BUILD[arc.id](state, r, arc);
    if (story) {
      state.storyLog[arc.id] = state.day;
      if (arc.step === undefined) return { id: arc.id, ...story };
      const steps = STORIES[arc.id].steps, k = steps.indexOf(arc.step);
      // a story the owner starts at its first step (owner 2026-11-07: the raid) hands today's story on to the next step, as
      // one begun by chance does
      if (k + 1 < steps.length) state.storyArc = { id: arc.id, step: steps[k + 1], day: state.day + 1, data: arc.data ?? (k === 0 ? story : undefined) };
      return { id: arc.id, step: arc.step, ...story };
    }
  }
  // a decree read once, on the first day it can be (after the stories of several days, which it never breaks)
  for (const [k, s] of Object.entries(STORIES)) {
    if (id || !s.once || state.storyLog[k] !== undefined || !possible(k, s)) continue;
    const story = BUILD[k](state, r);
    if (story) { state.storyLog[k] = state.day; return { id: k, ...story }; }
  }
  // a rebel waiting for the pillory (no more than once every 7 days)
  if (!id && rebelsWaiting(state).length && possible('rebel', STORIES.rebel)
    && (state.storyLog.rebel === undefined || state.day - state.storyLog.rebel >= STORIES.rebel.cooldown)) {
    // owner 2026-11-14: once the Hall of Justice stands, the rebel stands trial first and the commenters decide (no story is
    // waiting for a later day)
    const trialOk = possible('trial', STORIES.trial) && !state.storyArc && (state.storyLog.trial === undefined || state.day - state.storyLog.trial >= STORIES.trial.cooldown);
    const trial = trialOk ? BUILD.trial(state, r, { rebel: rebelsWaiting(state)[0].id }) : null;
    if (trial) {
      state.storyLog.trial = state.day;
      state.storyLog.rebel = state.day;
      state.storyArc = { id: 'trial', step: 'verdict', day: state.day + 1, data: trial };
      return { id: 'trial', step: 'trial', ...trial };
    }
    const story = BUILD.rebel(state, r);
    if (story) {
      state.storyLog.rebel = state.day;
      state.names[story.rebel.id].pilloryDay = state.day;
      return { id: 'rebel', ...story };
    }
  }
  if (!id) {
    if (!r.chance(STORY_CHANCE)) return null;
    const options = Object.entries(STORIES).filter(([k, s]) => !s.date && !s.arc && !s.onUnlock && !s.onComment && !s.once && !s.manual && possible(k, s)
      && (state.storyLog[k] === undefined || state.day - state.storyLog[k] >= s.cooldown));
    if (!options.length) return null;
    id = r.weighted(options, ([, s]) => s.weight)[0];
  }
  const story = BUILD[id](state, r);
  if (!story) return null;
  state.storyLog[id] = state.day;
  if (STORIES[id].next) state.storyArc = STORIES[id].next(story, state);
  const steps = STORIES[id].steps;
  if (steps) {
    state.storyArc = { id, step: steps[1], day: state.day + 1, data: story };
    return { id, step: steps[0], ...story };
  }
  return { id, ...story };
}

/** A given story for today, whatever the calendar and cooldowns say (test renders: --story bandits). */
export function storyFor(state, id) {
  const [name, step] = id.split(':'); // "merchants:camp" for a later step
  if (!BUILD[name]) throw new Error(`unknown story "${name}" (one of: ${Object.keys(BUILD).join(', ')})`);
  const r = rng(state.seed, 'story', state.date);
  const steps = STORIES[name].steps;
  if (step && !steps?.includes(step)) throw new Error(`story "${name}" has no step "${step}" (${(steps || []).join(', ') || 'one step only'})`);
  let story = BUILD[name](state, r, null, name === 'proclaim' ? state.unlockedTiers[state.unlockedTiers.length - 1] : undefined);
  // (owner 2026-11-14: a test render of the trial's verdict shows a guilty one, the accuser's comment 12 likes to 7, or
  // `trial:verdict` with TRIAL_LIKES="accused,accuser" ("-" for no comment); of the quarrel's peace once the Hall of Justice
  // stands, the one in court)
  if (name === 'trial' && step === 'verdict') {
    const [a, b] = (process.env.TRIAL_LIKES || '7,12').split(',').map((x) => (x === '-' ? null : Number(x)));
    state.trialLikes = { accused: a, accuser: b };
  }
  if (story && step && step !== steps[0]) story = BUILD[name](state, r, { id: name, step, data: story });
  if (story && name === 'quarrel' && step === 'peace' && built(state, 'court') && !story.court) {
    const judge = roleCast(state, r, ['judge'], 1, story.cast)[0] || null;
    story = { ...story, court: true, judge: judge && strip(judge) };
  }
  return story && { id: name, ...(steps ? { step: step || steps[0] } : {}), ...story };
}

/**
 * The Nobles (owner 2026-11-07), in the order they were made (the day, then the villager): each lives in the manor of
 * their place in the order (`manor0`, `manor1`... in world.js; none past the last manor). [{ id, name, day, lot }]
 */
export function nobles(state) {
  return Object.entries(state.names || {}).filter(([id, n]) => n.noble !== undefined && Number(id) < (state.villagers?.length ?? Infinity))
    .map(([id, n]) => ({ id: Number(id), name: n.name, day: n.noble })).sort((a, b) => a.day - b.day || a.id - b.id)
    .slice(0, MANORS).map((n, k) => ({ ...n, lot: `manor${k}` }));
}

/** The sound and narration key of a story's scene: 'merchants', or 'merchants_camp' for a later step. */
export function storyCue(story) {
  return story.step && story.step !== STORIES[story.id]?.steps?.[0] ? `${story.id}_${story.step}` : story.id;
}
