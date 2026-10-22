// Which scenes the day's video uses, picked by the simulation and saved (diff.scenes), so that the next days
// know what was shown. Owner (2026-10-21): the same scene does not come back within SCENE_GAP days: the
// tavern interior, a guard on the walls, the carpenter at the saw, washing day at the river...
// `state.sceneLog` maps a scene key ('tavern', 'carpenter:saw', 'ambient:pasture') to the last day shown.
import { rand01 } from './prng.js';
import { tavernScene } from './tiers.js';
import { featuredPeople } from './featured.js';

export const SCENE_GAP = 3;

// Owner (2026-10-20): a job is not always shown the same way. Each job has a few scenes, one picked per
// villager and day (the first is the job's usual scene; the others are 'job:variant' in work.js): guards
// on the castle walls, sparring in the courtyard or at the straw dummy; farmers hoeing, sowing or reaping...
// The woodcutter's handcart scene is no longer picked (owner 2026-10-21: only the arm with the axe moves).
// Guards up on the walls (owner 2026-10-21, src/render/scene/wallwatch.js): the day watch, the night watch
// and the changing of the guard, on the castle walls ('walls', 'wallnight', 'change') or on the Second Wall
// once it is finished ('wall2', 'wall2night', 'wall2change').
const FIGHTER_SCENES = ['walls', 'sparring', 'dummy'];
export const VARIANTS = {
  guard: [...FIGHTER_SCENES, 'night', 'wallnight', 'change', 'wall2', 'wall2night', 'wall2change'], knight: ['sparring', 'dummy', 'walls'], warrior: ['sparring', 'dummy', 'walls'],
  farmer: ['hoe', 'sow', 'scythe'], peasant: ['spade', 'sow'], woodcutter: ['chop', 'fell'], stonemason: ['block', 'stack'],
  blacksmith: ['anvil', 'quench', 'bellows'], toolsmith: ['anvil', 'quench', 'bellows'], carpenter: ['bench', 'saw'],
  baker: ['oven', 'knead'], fisherman: ['rod', 'net', 'boat'], miller: ['sacks', 'quern'], fletcher: ['fletch', 'shoot'],
  innkeeper: ['tavern', 'barrel'], brewer: ['tavern', 'stir'], beggar: ['wall', 'collapsed', 'hat'],
};
// scenes away from the croft (at the castle, on the river, in the street at dusk): own camera, a hard cut in and out
// the fisherman always fishes on the river (owner 2026-10-22): from a jetty with a rod or a net, or in a boat
export const AWAY_VARIANTS = new Set(['walls', 'sparring', 'boat', 'rod', 'net', 'night', 'wallnight', 'change', 'wall2', 'wall2night', 'wall2change']);
// scenes at dusk (the light changes for the shot)
export const NIGHT_VARIANTS = new Set(['night', 'wallnight', 'wall2night']);
// scenes that need a building finished
const NEEDS = { wall2: 'wall2', wall2night: 'wall2', wall2change: 'wall2' };
/** False for a scene whose place is not built yet (the Second Wall's wall walk). */
export const sceneReady = (state, variant) => !NEEDS[variant] || !!state?.buildings?.some((b) => b.id === NEEDS[variant] && b.status === 'done');
// the guards' everyday shots are the same scenes as a guard's own walls and sparring shots
const AMBIENT_KEY = { patrol: 'guard:walls', sparring: 'guard:sparring', change: 'guard:change' };
const FIGHTERS = ['guard', 'knight', 'warrior'];

export const sceneKey = (job, variant) => (variant ? `${job}:${variant}` : job);
export const ambientKey = (id) => AMBIENT_KEY[id] || `ambient:${id}`;

/** True when the scene was shown in the last SCENE_GAP days (today's own entries do not count). */
export function recentScene(state, key) {
  const d = state.sceneLog?.[key];
  return d !== undefined && d < state.day && state.day - d < SCENE_GAP;
}

/** True when every scene of the job was shown in the last days. */
export function staleJob(state, job) {
  const opts = VARIANTS[job];
  return opts ? opts.every((v) => recentScene(state, sceneKey(job, v))) : recentScene(state, job);
}

/** The tavern closes the video when it stands, but not again within SCENE_GAP days. */
export function tavernToday(state) {
  return tavernScene(state) && !recentScene(state, 'tavern');
}

/**
 * The scene for a villager of this job today (null: the job's only scene), not one already used today and,
 * when there is a choice, not one shown in the last days (`isRecent(variant)`).
 */
export function pickVariant(job, seed, day, id, used = new Set(), { croft = false, isRecent = () => false, ready = () => true } = {}) {
  const opts = VARIANTS[job]?.filter((v) => !(croft && AWAY_VARIANTS.has(v)) && ready(v));
  if (!opts?.length) return null;
  const k = Math.floor(rand01(seed, 'variant', day, id) * opts.length);
  const order = opts.map((_, i) => opts[(k + i) % opts.length]);
  return order.find((v) => !used.has(v) && !isRecent(v)) || order.find((v) => !used.has(v)) || opts[k];
}

/**
 * The day's scenes: { tavern, variants: { villagerId: variant }, ambient }. Call after the featured
 * villagers are picked (with `tavern` from tavernToday). Records them in state.sceneLog.
 * `buildingShots`: how many new-building shots the video opens with (they leave less room for an everyday shot).
 */
export function planScenes(state, { featured, tavern, avoidJobs = [], buildingShots = 0 }) {
  const day = state.day;
  const named = Object.keys(state.names || {}).length > 0;
  const variants = {};
  const used = new Set();
  const shots = featured.slice(0, tavern ? 2 : 3);
  for (const f of shots) {
    const n = state.names[f.id];
    const job = f.job === 'apprentice' && n?.wants ? n.wants : f.job;
    const v = pickVariant(job, state.seed, day, f.id, used, { croft: !!f.with, isRecent: (x) => recentScene(state, sceneKey(job, x)), ready: (x) => sceneReady(state, x) });
    if (v) used.add(v);
    variants[f.id] = v;
  }
  // an everyday shot when there is room: guards on the walls, sparring or changing the guard (odd days), else farmers in the
  // field, a shepherd with the flock or washing day at the river; never a job already seen yesterday or
  // today, never a scene shown in the last days
  let ambient = null;
  if (named && buildingShots + shots.length <= (tavern ? 3 : 4)) {
    const month = Number(state.date.slice(5, 7)), winter = month === 12 || month <= 2;
    const seen = new Set([...avoidJobs, ...featuredPeople(shots).map((p) => p.job), ...shots.map((f) => state.names[f.id]?.wants).filter(Boolean)]);
    const fresh = (id) => !recentScene(state, ambientKey(id));
    const guardsOk = state.unlockedTiers.includes('guard') && !FIGHTERS.some((j) => seen.has(j));
    const GUARDS = ['patrol', 'sparring', 'change'];
    const k = Math.floor(rand01(state.seed, 'ambient', day) * GUARDS.length);
    const guards = (guardsOk ? GUARDS.map((_, i) => GUARDS[(k + i) % GUARDS.length]) : []).filter(fresh);
    // many farmers together in a wheat field (owner 2026-10-22): the harvest, or hoeing and sowing in spring
    const country = [!winter && !seen.has('farmer') && !seen.has('peasant') && 'fields', !winter && !seen.has('farmer') && !seen.has('peasant') && 'wheat', !winter && !seen.has('peasant') && 'pasture', !seen.has('peasant') && 'laundry']
      .filter((id) => id && fresh(id));
    const life = country[Math.floor(rand01(state.seed, 'country', day) * country.length)];
    ambient = guards.length && (day % 2 === 1 || !life) ? guards[0] : life || null;
  }
  state.sceneLog = { ...(state.sceneLog || {}) };
  if (tavern) state.sceneLog.tavern = day;
  for (const f of shots) {
    const n = state.names[f.id];
    state.sceneLog[sceneKey(f.job === 'apprentice' && n?.wants ? n.wants : f.job, variants[f.id])] = day;
  }
  if (ambient) state.sceneLog[ambientKey(ambient)] = day;
  return { tavern, variants, ambient };
}
