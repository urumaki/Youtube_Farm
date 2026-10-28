// Story event scenes (see src/sim/stories.js). Each builder returns
// { group, labels, banner, cam(u), update(t, t0, t1), phase?, setWindow?(t0, t1) } or null.
import { buildQuarrel } from './quarrel.js';
import { buildMerchants } from './merchants.js';
import { buildBandits } from './bandits.js';
import { buildHalloween } from './halloween.js';
import { buildFire, buildRebuild } from './house.js';
import { buildWolves } from './wolves.js';
import { buildStorm } from './storm.js';
import { buildRoyal } from './royal.js';
import { buildPig } from './pig.js';
import { buildArchery } from './archery.js';
import { buildFlood } from './flood.js';
import { buildNewYear } from './newyear.js';
import { buildCamp } from './camp.js';
export { storyCue } from '../../../sim/stories.js';
import { buildFeast } from './feast.js';
import { buildTourney } from './tourney.js';
import { buildMartinmas } from './martinmas.js';
import { buildChristmas } from './christmas.js';
import { buildProclaim } from './proclaim.js';
import { buildBigFish } from './bigfish.js';
import { buildChicken } from './chicken.js';
import { buildWindmill } from './windmill.js';
import { buildTugOfWar } from './tugofwar.js';
import { buildHayCart } from './haycart.js';
import { buildSnowballs } from './snowballs.js';
import { buildRebel } from './rebel.js';
import { buildJoust } from './joust.js';
import { buildGamesAnnounce, buildDecree } from './games.js';
import { buildThrone } from './throne.js';
import { buildShip } from './ship.js';
import { buildBell } from './bell.js';
import { buildFogBoat } from './fogboat.js';
import { buildCensus } from './census.js';
import { buildPies } from './pies.js';
import { buildRegatta } from './regatta.js';

const BUILDERS = {
  quarrel: buildQuarrel, merchants: buildMerchants, bandits: buildBandits, halloween: buildHalloween,
  fire: buildFire, rebuild: buildRebuild, wolves: buildWolves, storm: buildStorm, royal: buildRoyal, pig: buildPig, archery: buildArchery, flood: buildFlood, newyear: buildNewYear,
  tourney: buildTourney, martinmas: buildMartinmas, christmas: buildChristmas, proclaim: buildProclaim, bigfish: buildBigFish,
  chicken: buildChicken, windmill: buildWindmill, tugofwar: buildTugOfWar, haycart: buildHayCart, snowballs: buildSnowballs,
  rebel: buildRebel, race: buildJoust, joust: buildJoust, ship: buildShip, bell: buildBell, fogboat: buildFogBoat, census: buildCensus, pies: buildPies, regatta: buildRegatta,
  decree: buildDecree,
};

// later steps of a story told over several days (src/sim/stories.js) with a scene of their own; the other
// steps are told by the story's own scene (story.step)
// (the games at the Tournament Ground: the announcement in the square, the results, then the title in the throne room as a
// second shot of the results day, step 'crown', timeline.js)
const STEP_BUILDERS = {
  'merchants:camp': buildCamp, 'royal:feast': buildFeast,
  'race:announce': buildGamesAnnounce, 'joust:announce': buildGamesAnnounce, 'race:crown': buildThrone, 'joust:crown': buildThrone,
};

export function buildStory(args) {
  const { id, step } = args.story || {};
  const fn = STEP_BUILDERS[`${id}:${step}`] || BUILDERS[id];
  return fn ? fn(args) : null;
}

/** Scenes that play at dusk: the shot cuts in and out instead of flying (the light changes). */
export const NIGHT_STORIES = new Set(['bandits', 'halloween', 'wolves', 'newyear', 'christmas']);
