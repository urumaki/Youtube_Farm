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

const BUILDERS = {
  quarrel: buildQuarrel, merchants: buildMerchants, bandits: buildBandits, halloween: buildHalloween,
  fire: buildFire, rebuild: buildRebuild, wolves: buildWolves, storm: buildStorm, royal: buildRoyal, pig: buildPig, archery: buildArchery, flood: buildFlood, newyear: buildNewYear,
};

// later steps of a story told over several days (src/sim/stories.js) with a scene of their own; the other
// steps are told by the story's own scene (story.step)
const STEP_BUILDERS = { 'merchants:camp': buildCamp, 'royal:feast': buildFeast };

export function buildStory(args) {
  const { id, step } = args.story || {};
  const fn = STEP_BUILDERS[`${id}:${step}`] || BUILDERS[id];
  return fn ? fn(args) : null;
}

/** Scenes that play at dusk: the shot cuts in and out instead of flying (the light changes). */
export const NIGHT_STORIES = new Set(['bandits', 'halloween', 'wolves', 'newyear']);
