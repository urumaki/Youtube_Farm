// The kingdom's time-lapse (owner 2026-11-11: every 30 days, the month against the one before): the town growing day by
// day, never a collage of the daily videos. Three parts, 31 s in all (owner 2026-11-11: as long as a daily video):
//   1. the opening (2.5 s): the camera comes down over the first day's land, "N days in 30 seconds";
//   2. the growth: one frame of the whole town for each saved day, always from the same place in the sky (slowly
//      turning), in clear daylight whatever the day's weather was, the day and the number of villagers over it; the
//      frames fade into one another;
//   3. the ending (9.5 s): the camera flies down and round the last day's town, the month's numbers come up one by one
//      (villagers, names, houses, buildings), then "Subscribe to move in".
// A Short of its own (1080x1920). Read only: nothing saved, nothing published.
//   node scripts/timelapse.js [--from 2026-10-16] [--to 2026-11-14] [--days 30] [--seconds 31] [--out output/timelapse.mp4]
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
// the flights are rendered at MOVE frames a second and blended up to FPS (a frame of the whole town takes seconds to draw)
const FPS = 30, MOVE = 12, SECONDS = Number(opt('--seconds', 31)), INTRO = 2.5, OUTRO = 9.5;
const GROWTH = SECONDS - INTRO - OUTRO, HOLD = GROWTH / (dates.length - 1); // each day's share of the growth
if (GROWTH < 4) throw new Error('--seconds is too short for the opening and the ending');
const out = opt('--out', path.join('output', `timelapse_${dates[0]}_${dates.at(-1)}.mp4`));
const dir = path.join('output', 'timelapse');
fs.rmSync(dir, { recursive: true, force: true });
for (const d of ['days', 'intro', 'outro']) fs.mkdirSync(path.join(dir, d), { recursive: true });

// the camera: over the last day's town (the biggest), so every day is seen from the same place
const first = savedDay(dates[0]).state, last = savedDay(dates.at(-1)).state;
const xs = [-60, 80, ...last.plots.map((p) => p.x)], zs = [-60, 60, ...last.plots.map((p) => p.z)];
const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
const e = Math.max(260, Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const mix = (a, b, k) => a + (b - a) * k;
// a: the angle round the town, r: how far out, h: how high (in shares of the town's width)
const orbit = (a, r, h, lookX = -0.12) => ({ pos: [cx + Math.cos(a) * e * r, e * h + 40, cz + Math.sin(a) * e * r], look: [cx + e * lookX, 0, cz] });
// (a wider turn loses the castle on the first days, when it is all there is)
const pose = (k) => orbit(0.58 - 0.18 * k, 0.8, 0.5); // k 0..1 through the days: a slow turn round the town
const introPose = (k) => orbit(0.72 - 0.14 * ease(k), mix(1.05, 0.8, ease(k)), mix(0.72, 0.5, ease(k))); // down to the first day's place
const outroPose = (k) => orbit(0.4 - 0.75 * ease(k), mix(0.8, 0.5, ease(k)), mix(0.5, 0.2, ease(k)), mix(-0.12, -0.04, ease(k))); // down and round the town

const n = (x) => x.toLocaleString('en-US');
const done = (s) => s.buildings.filter((b) => b.status === 'done').length;
const stats = [
  [`${n(last.subscriberCount)}`, 'villagers'],
  [`${n(Object.keys(last.names || {}).length)}`, 'named by you'],
  [`${n(last.houses.filter((h) => h.status === 'occupied').length)}`, 'houses'],
  [`${n(done(last))}`, 'buildings'],
];
const grew = last.subscriberCount - first.subscriberCount;

/** One frame: the scene from `p`, every house in full detail, the words over it. */
async function frame(page, p, t, html, file) {
  await page.evaluate(({ p, t, html }) => {
    // every house in full detail: from this high the far ones would be plain blocks
    const H = window.__ctx.houses;
    if (!H.fullDetail) { const lod = H.updateLod.bind(H); H.updateLod = (camera) => lod(camera, 1e5); H.fullDetail = true; }
    window.SK.shot(p.pos, p.look, t, 0.12);
    let el = document.getElementById('tl');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tl';
      el.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;text-align:center;font-family:Cinzel,serif;font-weight:700;color:#fff4d6;pointer-events:none';
      document.body.appendChild(el);
    }
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  }, { p, t, html });
  fs.writeFileSync(file, await page.screenshot({ type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1080, height: 1920 } }));
}
const SHADOW = 'text-shadow:0 6px 0 #6b4a12,0 10px 30px rgba(0,0,0,.75)', SOFT = 'text-shadow:0 3px 14px rgba(0,0,0,.9)';
const crown = `<div style="font-size:40px;letter-spacing:6px;color:#e3b23c;text-shadow:0 3px 10px rgba(0,0,0,.8)">SUBSCRIBER KINGDOM</div>`;
const dayLabel = (s, o = 1) => `<div style="position:absolute;left:0;right:0;top:250px;opacity:${o.toFixed(2)}">${crown}<div style="font-size:130px;line-height:1.05;${SHADOW}">DAY ${s.day}</div>`
  + `<div style="font-family:Inter,sans-serif;font-weight:800;font-size:58px;${SOFT}">${n(s.subscriberCount)} villagers</div></div>`;
const introLabel = (k) => dayLabel(first) + `<div style="position:absolute;left:60px;right:60px;top:760px;opacity:${Math.min(1, k * 5).toFixed(2)};font-size:76px;line-height:1.12;${SHADOW}">${dates.length} days<br>in 30 seconds</div>`;
function outroLabel(u) { // u: seconds into the ending
  const fade = (a, b) => Math.max(0, Math.min(1, (u - a) * 3, (b - u) * 3));
  const rows = stats.map(([v, w], i) => {
    const o = Math.max(0, Math.min(1, (u - 1.3 - i * 0.9) * 3));
    return `<div style="opacity:${o.toFixed(2)};transform:scale(${(0.85 + 0.15 * o).toFixed(3)});margin:14px 0"><span style="font-size:96px;${SHADOW}">${v}</span> <span style="font-family:Inter,sans-serif;font-weight:800;font-size:50px;${SOFT}">${w}</span></div>`;
  }).join('');
  const sub = `<div style="position:absolute;left:0;right:0;top:330px;opacity:${fade(6.4, 99).toFixed(2)}">${crown}<div style="font-size:84px;line-height:1.1;margin-top:10px;${SHADOW}">Subscribe to<br>move in</div>`
    + `<div style="display:inline-block;margin-top:34px;padding:22px 54px;border-radius:60px;background:#c4302b;font-family:Inter,sans-serif;font-weight:800;font-size:52px;letter-spacing:2px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.45)">SUBSCRIBE</div>`
    + `<div style="font-family:Inter,sans-serif;font-weight:800;font-size:44px;margin-top:30px;${SOFT}">+${n(grew)} villagers in ${dates.length} days</div></div>`;
  return dayLabel(last, fade(-1, 1.2)) + `<div style="position:absolute;left:0;right:0;top:260px;opacity:${fade(1.2, 6.2).toFixed(2)}">${crown}<div style="font-size:56px;margin:6px 0 20px;${SHADOW}">Day ${last.day}</div>${rows}</div>` + sub;
}

const { browser, page, errors } = await openPage();
const days = [];
const seq = async (name, count, poseAt, label) => {
  for (let f = 0; f < count; f++) await frame(page, poseAt(f / (count - 1)), 12 + f / MOVE, label(f / MOVE, f / (count - 1)), path.join(dir, name, `${String(f).padStart(4, '0')}.jpg`));
};
try {
  for (const [i, date] of dates.entries()) {
    const file = path.join(dir, 'days', `${String(i).padStart(3, '0')}.jpg`);
    days.push(file);
    const { state, diff } = savedDay(date);
    const t0 = Date.now();
    if (i) await page.reload();
    // clear daylight every day: fog, rain and snow would hide the town in some frames
    await setupScene(page, { mode: 'video', state: { ...state, weather: 'clear' }, diff: { ...diff, weather: 'clear', story: null } });
    if (i === 0) await seq('intro', Math.round(INTRO * MOVE) + 1, introPose, (u, k) => introLabel(k));
    await frame(page, pose(i / (dates.length - 1)), 12, i === 0 ? introLabel(1) : dayLabel(state), file);
    if (i === dates.length - 1) await seq('outro', Math.round(OUTRO * MOVE) + 1, outroPose, (u) => outroLabel(u));
    console.log(`[timelapse] ${date} day ${state.day}, ${state.subscriberCount} villagers (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
} finally {
  await browser.close();
}
if (errors.length) console.log(`[timelapse] page errors: ${errors.slice(0, 3).join(' | ')}`);
if (args.includes('--frames-only')) { console.log(dir); process.exit(0); }

// the opening, then the days fading into one another, then the ending; the kingdom's own music under them
const fwd = (f) => path.resolve(f).replace(/\\/g, '/');
const list = path.join(dir, 'days.txt');
fs.writeFileSync(list, days.map((f) => `file '${fwd(f)}'\nduration ${HOLD.toFixed(4)}`).join('\n') + `\nfile '${fwd(days.at(-1))}'\n`);
const wav = path.join(dir, 'music.wav');
writeWav(wav, makeMusic(last.seed, `timelapse-${dates.at(-1)}`, SECONDS + 0.5), 48000);
const blend = `framerate=fps=${FPS}:interp_start=0:interp_end=255:scene=100`;
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error',
  '-framerate', String(MOVE), '-i', path.join(dir, 'intro', '%04d.jpg'),
  '-f', 'concat', '-safe', '0', '-i', list,
  '-framerate', String(MOVE), '-i', path.join(dir, 'outro', '%04d.jpg'),
  '-i', wav,
  '-filter_complex', `[0:v]${blend},trim=duration=${INTRO},setpts=PTS-STARTPTS[a];[2:v]${blend},trim=duration=${OUTRO},setpts=PTS-STARTPTS[c];[1:v]fps=${(2 / HOLD).toFixed(3)},framerate=fps=${FPS}:interp_start=0:interp_end=255:scene=100,trim=duration=${GROWTH.toFixed(3)},setpts=PTS-STARTPTS[g];[a][g][c]concat=n=3:v=1:a=0,format=yuv420p[v]`,
  '-map', '[v]', '-map', '3:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '160k', '-af', `afade=t=out:st=${(SECONDS - 1.2).toFixed(2)}:d=1.2`,
  '-t', SECONDS.toFixed(2), '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) throw new Error(`ffmpeg exited ${r.status}`);
console.log(out);
