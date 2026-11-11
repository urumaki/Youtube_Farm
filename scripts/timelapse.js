// The kingdom's time-lapse (owner 2026-11-11: every 30 days, the month against the one before): one frame of the whole
// town for each saved day, always from the same place in the sky (slowly turning), in clear daylight whatever the day's
// weather was, with the day and the number of villagers over it; the frames fade into one another, the last one is held.
// A Short of its own (1080x1920). Read only: nothing saved, nothing published.
//   node scripts/timelapse.js [--from 2026-10-16] [--to 2026-11-14] [--days 30] [--hold 0.55] [--out output/timelapse.mp4]
//   --days N: the last N saved days up to --to (default 30); --frames-only: no MP4, the frames stay in output/timelapse/
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { savedDay } from '../src/pipeline.js';
import { openPage, setupScene } from '../src/render/capture.js';
import { makeMusic } from '../src/audio/music.js';
import { writeWav } from '../src/audio/wav.js';
import { STATE_DIR } from '../src/sim/state.js';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const all = fs.readdirSync(path.join(STATE_DIR, 'history')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort();
const to = opt('--to', all.at(-1)), from = opt('--from', null);
let dates = all.filter((d) => d <= to && (!from || d >= from));
if (!from) dates = dates.slice(-Number(opt('--days', 30)));
if (dates.length < 2) throw new Error('a time-lapse needs at least two saved days');
const HOLD = Number(opt('--hold', 0.55)), LAST = 2.5, FPS = 30;
const out = opt('--out', path.join('output', `timelapse_${dates[0]}_${dates.at(-1)}.mp4`));
const dir = path.join('output', 'timelapse');
fs.mkdirSync(dir, { recursive: true });

// the camera: over the last day's town (the biggest), so every day is seen from the same place
const last = savedDay(dates.at(-1)).state;
const xs = [-60, 80, ...last.plots.map((p) => p.x)], zs = [-60, 60, ...last.plots.map((p) => p.z)];
const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
const e = Math.max(260, Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
const pose = (k) => { // k 0..1 through the days: a slow turn round the town
  const a = 0.58 - 0.18 * k; // (a wider turn loses the castle on the first days, when it is all there is)
  return { pos: [cx + Math.cos(a) * e * 0.8, e * 0.5 + 40, cz + Math.sin(a) * e * 0.8], look: [cx - e * 0.12, 0, cz] };
};

const { browser, page, errors } = await openPage();
const files = [];
try {
  for (const [i, date] of dates.entries()) {
    const file = path.join(dir, `${String(i).padStart(3, '0')}.png`);
    files.push(file);
    const { state, diff } = savedDay(date);
    const t0 = Date.now();
    if (i) await page.reload();
    // clear daylight every day: fog, rain and snow would hide the town in some frames
    await setupScene(page, { mode: 'video', state: { ...state, weather: 'clear' }, diff: { ...diff, weather: 'clear', story: null } });
    const { pos, look } = pose(i / (dates.length - 1));
    await page.evaluate(({ pos, look, day, pop }) => {
      window.SK.shot(pos, look, 12, 0.12);
      // every house in full detail: from this high the far ones would be plain blocks
      window.__ctx.houses.updateLod(window.__ctx.camera, 1e5);
      window.__ctx.env.composer.render();
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;right:0;top:250px;text-align:center;font-family:Cinzel,serif;font-weight:700;color:#fff4d6;text-shadow:0 6px 0 #6b4a12,0 10px 30px rgba(0,0,0,.75);pointer-events:none';
      el.innerHTML = `<div style="font-size:40px;letter-spacing:6px;color:#e3b23c;text-shadow:0 3px 10px rgba(0,0,0,.8)">SUBSCRIBER KINGDOM</div><div style="font-size:130px;line-height:1.05">DAY ${day}</div>`
        + `<div style="font-family:Inter,sans-serif;font-weight:800;font-size:58px;text-shadow:0 3px 14px rgba(0,0,0,.9)">${pop.toLocaleString('en-US')} villagers</div>`;
      document.body.appendChild(el);
    }, { pos, look, day: state.day, pop: state.subscriberCount });
    fs.writeFileSync(file, await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } }));
    console.log(`[timelapse] ${date} day ${state.day}, ${state.subscriberCount} villagers (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
} finally {
  await browser.close();
}
if (errors.length) console.log(`[timelapse] page errors: ${errors.slice(0, 3).join(' | ')}`);
if (args.includes('--frames-only')) { console.log(dir); process.exit(0); }

// the frames one after the other, each fading into the next, the last one held; the kingdom's own music under them
const seconds = (dates.length - 1) * HOLD + LAST;
const list = path.join(dir, 'frames.txt');
fs.writeFileSync(list, files.map((f, i) => `file '${path.resolve(f).replace(/\\/g, '/')}'\nduration ${i === files.length - 1 ? LAST : HOLD}`).join('\n') + `\nfile '${path.resolve(files.at(-1)).replace(/\\/g, '/')}'\n`);
const wav = path.join(dir, 'music.wav');
writeWav(wav, makeMusic(last.seed, `timelapse-${dates.at(-1)}`, seconds + 0.5), 48000);
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav,
  '-vf', `fps=${Math.round(2 / HOLD * 10) / 10},framerate=fps=${FPS}:interp_start=0:interp_end=255:scene=100,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', '-af', `afade=t=out:st=${(seconds - 1.2).toFixed(2)}:d=1.2`,
  '-t', seconds.toFixed(2), '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) throw new Error(`ffmpeg exited ${r.status}`);
console.log(out);
