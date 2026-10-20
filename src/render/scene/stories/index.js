// Story event scenes (see src/sim/stories.js). Each builder returns
// { group, labels, banner, cam(u), update(t, t0, t1), phase?, setWindow?(t0, t1) } or null.
import { buildQuarrel } from './quarrel.js';
import { buildMerchants } from './merchants.js';
import { buildBandits } from './bandits.js';
import { buildHalloween } from './halloween.js';

const BUILDERS = { quarrel: buildQuarrel, merchants: buildMerchants, bandits: buildBandits, halloween: buildHalloween };

export function buildStory(args) {
  const fn = BUILDERS[args.story?.id];
  return fn ? fn(args) : null;
}

/** Scenes that play at dusk: the shot cuts in and out instead of flying (the light changes). */
export const NIGHT_STORIES = new Set(['bandits', 'halloween']);
