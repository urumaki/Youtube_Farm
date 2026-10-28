// The video's thumbnail (owner 2026-10-26): the latest saved day of the real kingdom, a villager waving in the foreground,
// the name tag above them blurred, a short title on top. Read only: writes output/thumbnail_<date>.png (1080x1920).
//   node scripts/thumbnail.js [--job guard] [--title "IS THIS YOU?"] [--sub "1 subscriber = 1 villager"] [--phase 0.25] [--weather clear]
import fs from 'node:fs';
import path from 'node:path';
import { loadState, STATE_DIR } from '../src/sim/state.js';
import { openPage, setupScene, WIDTH, HEIGHT } from '../src/render/capture.js';

const opt = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const state = loadState(path.join(STATE_DIR, 'kingdom.json'));
const hist = path.join(STATE_DIR, 'history', `${state.date}.json`);
const diff = fs.existsSync(hist) ? JSON.parse(fs.readFileSync(hist, 'utf8')).diff : { weather: state.weather, events: state.events, delta: 0 };
const { browser, page, errors } = await openPage();
try {
  // a clear sky whatever the day's weather (a thumbnail is seen small, grey reads as dull)
  await setupScene(page, { mode: 'video', state, diff: { ...diff, weather: opt('--weather', 'clear') } });
  await page.evaluate((o) => window.SK.thumb(o), {
    job: opt('--job', 'guard'), title: opt('--title', 'IS THIS YOU?'), sub: opt('--sub', '1 subscriber = 1 villager'), phase: Number(opt('--phase', 0.25)),
  });
  fs.mkdirSync('output', { recursive: true });
  const out = path.join('output', `thumbnail_${state.date}.png`);
  fs.writeFileSync(out, await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } }));
  if (errors.length) console.error('[thumbnail] browser errors: ' + errors.join(' | '));
  console.log(out);
} finally {
  await browser.close();
}
