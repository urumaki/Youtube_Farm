// Deterministic frame capture: headless Chromium renders frame f (t = f/30) on demand, we screenshot it
// and pipe the JPEG frames into ffmpeg. Nothing is recorded in real time.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { buildRenderPage } from '../../scripts/build.js';

export const FPS = 30;
export const DURATION = 30;
export const WIDTH = 1080, HEIGHT = 1920;

const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--force-color-profile=srgb'];

export async function openPage({ log = console } = {}) {
  const page_file = await buildRenderPage();
  const launch = { args: GL_ARGS };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + page_file);
  return { browser, page, errors, log };
}

export async function setupScene(page, data) {
  page.setDefaultTimeout(0);
  return page.evaluate((d) => window.SK.setup(d), data);
}

export async function captureFrame(page, f, type = 'jpeg') {
  await page.evaluate((n) => window.SK.frame(n), f);
  return page.screenshot({ type, quality: type === 'jpeg' ? 93 : undefined, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
}

/** Render stills at the given times (seconds) to PNG files. */
export async function renderStills(data, times, outDir, { log = console } = {}) {
  const { browser, page, errors } = await openPage({ log });
  try {
    const stats = await setupScene(page, data);
    fs.mkdirSync(outDir, { recursive: true });
    const files = [];
    for (const t of times) {
      const f = Math.round(t * FPS);
      const buf = await captureFrame(page, f, 'png');
      const file = path.join(outDir, `t${String(t).replace('.', '_')}.png`);
      fs.writeFileSync(file, buf);
      files.push(file);
    }
    return { stats, files, errors };
  } finally {
    await browser.close();
  }
}

/** Debug views: [{name, pos:[x,y,z], look:[x,y,z], t, phase}] -> PNG files. */
export async function renderShots(data, shots, outDir) {
  const { browser, page, errors } = await openPage();
  try {
    const stats = await setupScene(page, data);
    fs.mkdirSync(outDir, { recursive: true });
    for (const s of shots) {
      await page.evaluate((a) => window.SK.shot(a.pos, a.look, a.t ?? 10, a.phase), s);
      fs.writeFileSync(path.join(outDir, s.name + '.png'), await page.screenshot({ type: 'png' }));
    }
    return { stats, errors };
  } finally {
    await browser.close();
  }
}

/** Render the full video. audioFile (optional) is muxed; output is exactly 30.0 s, 30 fps, H.264 + AAC.
 * Frames are split across `workers` browser processes (each with its own software-GL process), written
 * as numbered JPEGs, then encoded in order. Every frame depends only on its time, so splitting is exact. */
export async function renderVideo(data, outFile, { audioFile, log = console, frames = FPS * DURATION, workers = defaultWorkers() } = {}) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(path.dirname(outFile), '.frames-'));
  const t0 = Date.now();
  let stats = null;
  const errors = [];
  let done = 0;
  try {
    const n = Math.max(1, Math.min(workers, 8));
    const chunk = Math.ceil(frames / n);
    await Promise.all(Array.from({ length: n }, async (_, w) => {
      const { browser, page, errors: errs } = await openPage({ log });
      try {
        const st = await setupScene(page, data);
        if (w === 0) { stats = st; log.log?.(`[render] scene ready in ${st.setupMs} ms: ${JSON.stringify(st)}`); }
        for (let f = w * chunk; f < Math.min(frames, (w + 1) * chunk); f++) {
          fs.writeFileSync(path.join(tmp, `f${String(f).padStart(5, '0')}.jpg`), await captureFrame(page, f, 'jpeg'));
          if (++done % 60 === 0) log.log?.(`[render] ${done}/${frames} frames (${((Date.now() - t0) / 1000).toFixed(0)} s, ${n} workers)`);
        }
      } finally {
        errors.push(...errs);
        await browser.close();
      }
    }));
    const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%05d.jpg')];
    if (audioFile) args.push('-i', audioFile);
    else args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
    args.push(
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', process.env.X264_PRESET || 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-profile:v', 'high', '-level', '4.2', '-g', String(FPS * 2),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-t', String(DURATION), '-movflags', '+faststart', outFile,
    );
    await new Promise((res, rej) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
    return { stats, errors, seconds: (Date.now() - t0) / 1000 };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function defaultWorkers() {
  // Software GL (SwiftShader) already uses every core, so extra browsers do not help on CPU-only
  // machines (measured: 2 workers ~ same throughput as 1 on 4 cores). Raise it on GPU machines.
  if (process.env.RENDER_WORKERS) return Number(process.env.RENDER_WORKERS);
  return Math.max(1, Math.floor(os.cpus().length / 8));
}
