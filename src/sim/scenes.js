// Which scenes the day's video uses, picked by the simulation and saved (diff.scenes), so that the next days
// know what was shown. Owner (2026-10-21): the same scene does not come back within SCENE_GAP days: the
// tavern interior, a guard on the walls, the carpenter at the saw, washing day at the river...
// `state.sceneLog` maps a scene key ('tavern', 'carpenter:saw', 'ambient:pasture') to the last day shown.
import { rand01 } from './prng.js';
import { tavernScene, churchScene } from './tiers.js';
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
  guard: [...FIGHTER_SCENES, 'night', 'wallnight', 'change', 'wall2', 'wall2night', 'wall2change'], knight: ['sparring', 'dummy', 'walls'], warrior: ['sparring', 'dummy', 'walls'], cavalier: ['sparring', 'dummy', 'walls'],
  farmer: ['hoe', 'sow', 'scythe', 'fields', 'wheat'], peasant: ['spade', 'sow', 'laundry'], woodcutter: ['chop', 'fell'], stonemason: ['block', 'stack'],
  blacksmith: ['anvil', 'quench', 'bellows'], toolsmith: ['anvil', 'quench', 'bellows'], carpenter: ['bench', 'saw', 'cart'],
  baker: ['oven', 'knead'], fisherman: ['rod', 'net', 'boat'], miller: ['sacks', 'quern'], fletcher: ['fletch', 'shoot'],
  // owner 2026-10-23: innkeepers and brewers serve behind the bar inside the tavern once it stands ('inside')
  innkeeper: ['inside', 'tavern', 'barrel'], brewer: ['inside', 'tavern', 'stir'], beggar: ['wall', 'collapsed', 'hat'],
  // owner 2026-10-23: at their own place once it stands (else their usual scene in the croft), with a queue in front;
  // the crier calls out from the Crier's Stand
  merchant: ['stall', 'cart'], taxcollector: ['counting', 'rounds'], apothecary: ['shop'], crier: ['stand', 'proclaim'],
  // owner 2026-10-25: a second scene for the jobs that had one, the physician at the Physician's Booth, the clergy at work
  physician: ['booth'], executioner: ['chop', 'grind'], priest: ['bless', 'preach', 'shrine'], bishop: ['bless', 'preach', 'shrine'],
  // owner 2026-10-23: the bard plays the flute in the market square or the lute in the tavern, the jester juggles burning
  // torches in the square, the cook and the butcher keep a market stall, the rat catcher works in an alley, the chimney
  // sweep inside a house, the hunter at the edge of a field outside the walls (a boar or a stag), the shepherd at a sheep
  // pen, the engineer in front of a building going up (src/render/scene/work.js, main.js)
  bard: ['square', 'inn'], jester: ['square', 'kids'], cook: ['stall'], butcher: ['stall'], ratcatcher: ['alley'], chimneysweep: ['house'],
  hunter: ['boar', 'stag'], shepherd: ['pen', 'pasture'], engineer: ['site'], falconer: ['meadow'],
  // owner 2026-10-29: a scholar also teaches the other scholars in a classroom of the University once it stands
  scholar: ['desk', 'lecture'],
};
// scenes away from the croft (at the castle, on the river, in the street at dusk): own camera, a hard cut in and out
// the fisherman always fishes on the river (owner 2026-10-22): from a jetty with a rod or a net, or in a boat
export const AWAY_VARIANTS = new Set(['walls', 'sparring', 'boat', 'rod', 'net', 'night', 'wallnight', 'change', 'wall2', 'wall2night', 'wall2change',
  'fields', 'wheat', 'pasture', 'laundry']);
// the everyday shots (ambient.js, everyday.js) as a villager's own scene, with the name tag (owner 2026-10-23): a villager
// introduced today is shown in one of them when the job has one (a new guard comes on duty at the changing of the guard,
// a new farmer works in the wheat with the others...), so the presentations change from day to day
export const INTRO = { guard: ['wall2change', 'change'], knight: ['sparring'], farmer: ['wheat', 'fields'], peasant: ['laundry'], shepherd: ['pasture'] };
// out on the land: not in winter (as the everyday shots)
const SUMMER = new Set(['fields', 'wheat', 'pasture']);
// scenes at dusk (the light changes for the shot)
export const NIGHT_VARIANTS = new Set(['night', 'wallnight', 'wall2night']);
// scenes that need a building finished
const NEEDS = { wall2: 'wall2', wall2night: 'wall2', wall2change: 'wall2', stall: 'market', counting: 'counting_house', shop: 'apothecary_shop', inside: 'tavern', stand: 'crier_stand',
  square: 'market', inn: 'tavern', proclaim: 'market', preach: 'market', bless: 'fields', booth: 'physician_booth', lecture: 'university' };
// croft scenes no longer used once the building stands (the innkeeper's barrel in the croft, once the tavern is open)
const UNTIL = { tavern: 'tavern', barrel: 'tavern', stir: 'tavern' };
// the same for one job only (owner 2026-10-25): knights train in the lists of the Tournament Ground once it stands, no
// longer on the castle walls
const JOB_UNTIL = { knight: { walls: 'tournament' }, warrior: { walls: 'tournament' }, cavalier: { walls: 'tournament' } };
// scenes with no room for a visitor (on a platform, on the move, inside a house): a host with a guest stays in the croft
// scenes in a place with its own camera (the tavern's bar, the bakehouse): a villager seen through their eyes walks instead
// owner 2026-10-29: the shots through a villager's eyes are off for now (two bodies showed one inside the other); saves that
// planned one render the usual shot (timeline.js), test renders can still ask for one with --pov
export const POV_ON = false;
const POV_AWAY = new Set(['inside', 'inn', 'house', 'lecture']);
const SOLO_VARIANTS = new Set(['stand', 'cart', 'inn', 'house', 'rounds', 'proclaim', 'preach', 'bless', 'lecture']);
// buildings with no shot of their own: no engineer stands in front of them
const NO_SITE = new Set(['wall2', 'fields', 'guardposts', 'charter_stone']);
const built = (state, id) => !!state?.buildings?.some((b) => b.id === id && b.status === 'done');
/** False for a scene whose place is not built yet (the Second Wall's wall walk, the Counting House...) or no longer used. */
export const sceneReady = (state, variant, job = null) => (!NEEDS[variant] || built(state, NEEDS[variant])) && !(UNTIL[variant] && built(state, UNTIL[variant]))
  && !(JOB_UNTIL[job]?.[variant] && built(state, JOB_UNTIL[job][variant]))
  && (variant !== 'site' || !!state?.pendingConstruction?.some((p) => !NO_SITE.has(p.building)))
  && !(SUMMER.has(variant) && winter(state));
const winter = (state) => { const m = Number(state?.date?.slice(5, 7)); return m === 12 || m <= 2; };
// the guards' everyday shots are the same scenes as a guard's own walls and sparring shots
const AMBIENT_KEY = { patrol: 'guard:walls', sparring: 'guard:sparring', change: 'guard:change' };
const FIGHTERS = ['guard', 'knight', 'warrior', 'cavalier'];

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
 * The church interior (owner 2026-10-23: villagers praying in the pews, many names at once) closes the video on a day
 * without the tavern, not again within SCENE_GAP days: 'chapel', 'cathedral' or null.
 */
export function churchToday(state, tavern) {
  const church = churchScene(state);
  return !tavern && church && !recentScene(state, 'church') ? church : null;
}

/** The everyday scene a villager introduced today is shown in (INTRO), or null: ready today, not shown in the last days. */
export function introVariant(state, job, used = new Set()) {
  return INTRO[job]?.find((v) => !used.has(v) && sceneReady(state, v, job) && !recentScene(state, sceneKey(job, v))) ?? null;
}

/**
 * The scene for a villager of this job today (null: the job's only scene), not one already used today and,
 * when there is a choice, not one shown in the last days (`isRecent(variant)`).
 */
export function pickVariant(job, seed, day, id, used = new Set(), { croft = false, isRecent = () => false, ready = () => true } = {}) {
  const opts = VARIANTS[job]?.filter((v) => !(croft && (AWAY_VARIANTS.has(v) || SOLO_VARIANTS.has(v))) && ready(v));
  if (!opts?.length) return null;
  const k = Math.floor(rand01(seed, 'variant', day, id) * opts.length);
  const order = opts.map((_, i) => opts[(k + i) % opts.length]);
  return order.find((v) => !used.has(v) && !isRecent(v)) || order.find((v) => !used.has(v)) || opts[k];
}

/**
 * The day's scenes: { tavern, church, variants: { villagerId: variant }, ambient }. Call after the featured
 * villagers are picked (with `tavern` from tavernToday, `church` from churchToday). Records them in state.sceneLog.
 * `buildingShots`: how many new-building shots the video opens with (they leave less room for an everyday shot).
 */
export function planScenes(state, { featured, tavern, church = null, avoidJobs = [], buildingShots = 0 }) {
  const inside = tavern || !!church; // an interior closes the video: one villager shot less
  const day = state.day;
  const named = Object.keys(state.names || {}).length > 0;
  const variants = {};
  const used = new Set();
  const shots = featured.slice(0, inside ? 2 : 3);
  for (const f of shots) {
    const n = state.names[f.id];
    const job = f.job === 'apprentice' && n?.wants ? n.wants : f.job;
    // no innkeeper or bard shot inside the tavern on the day the tavern interior closes the video
    const v = (f.today && !f.with && introVariant(state, job, used)) || pickVariant(job, state.seed, day, f.id, used, { croft: !!f.with, isRecent: (x) => recentScene(state, sceneKey(job, x)), ready: (x) => sceneReady(state, x, job) && !(tavern && (x === 'inside' || x === 'inn')) });
    if (v) used.add(v);
    variants[f.id] = v;
  }
  // an everyday shot when there is room: guards on the walls, sparring or changing the guard (odd days), else farmers in the
  // field, a shepherd with the flock or washing day at the river; never a job already seen yesterday or
  // today, never a scene shown in the last days
  let ambient = null;
  if (named && buildingShots + shots.length <= (inside ? 3 : 4)) {
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
  // one villager seen through their own eyes (owner 2026-10-29, pov.js), not again within SCENE_GAP days: at work in their
  // own place ('work', a visitor walking up to them too) or walking down the street near home ('stroll', alone in the shot);
  // never the scenes with a camera of their own (the walls, the boat, the tavern, the bakehouse), which take the walk instead
  let pov = null;
  if (POV_ON && named && !recentScene(state, 'pov')) {
    const own = (f) => {
      const job = state.names[f.id]?.wants && f.job === 'apprentice' ? state.names[f.id].wants : f.job;
      const v = variants[f.id];
      return !AWAY_VARIANTS.has(v) && !POV_AWAY.has(v) && !(job === 'baker' && v) && !(job === 'chimneysweep' && v === 'house');
    };
    const f = shots.find((x) => !x.with || own(x));
    if (f) pov = { id: f.id, mode: f.with || (own(f) && rand01(state.seed, 'pov', day) < 0.5) ? 'work' : 'stroll' };
  }
  state.sceneLog = { ...(state.sceneLog || {}) };
  if (pov) state.sceneLog.pov = day;
  if (tavern) state.sceneLog.tavern = day;
  if (church) state.sceneLog.church = day;
  for (const f of shots) {
    const n = state.names[f.id];
    state.sceneLog[sceneKey(f.job === 'apprentice' && n?.wants ? n.wants : f.job, variants[f.id])] = day;
  }
  if (ambient) state.sceneLog[ambientKey(ambient)] = day;
  return { tavern, church, variants, ambient, pov };
}
