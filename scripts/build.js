// Bundles the browser scene with esbuild and writes self-contained HTML pages:
//   dist/render.html  — used by the frame-capture renderer (data injected at run time)
//   dist/viewer.html  — standalone interactive viewer with the state embedded (opens with a double click)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

function fontFaces() {
  const f = (pkg, file) => fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64');
  return [
    ['Cinzel', 700, f('cinzel', 'cinzel-latin-700-normal.woff2')],
    ['Inter', 700, f('inter', 'inter-latin-700-normal.woff2')],
    ['Inter', 800, f('inter', 'inter-latin-800-normal.woff2')],
    ['Inter', 900, f('inter', 'inter-latin-900-normal.woff2')],
  ].map(([fam, wt, b64]) => `@font-face{font-family:'${fam}';font-weight:${wt};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2')}`).join('\n');
}

export async function bundle() {
  const out = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/render/scene/main.js')],
    bundle: true, format: 'iife', minify: true, write: false, target: 'chrome110', legalComments: 'none',
  });
  return out.outputFiles[0].text;
}

const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

export async function buildRenderPage() {
  const js = await bundle();
  fs.mkdirSync(DIST, { recursive: true });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Subscriber Kingdom render</title>
<style>${fontFaces()}
html,body{margin:0;background:#000;overflow:hidden}#stage{position:relative;width:1080px;height:1920px;overflow:hidden}canvas{display:block}</style></head>
<body><div id="stage"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const file = path.join(DIST, 'render.html');
  fs.writeFileSync(file, html);
  return file;
}

/** Strip what the viewer does not need so the file stays small at large populations. */
function viewerState(state) {
  return { ...state, villagers: state.villagers.map((v) => ({ id: v.id, job: v.job, house: v.house, name: '' })) };
}

export async function buildViewer(state, diff, { out = path.join(DIST, 'viewer.html') } = {}) {
  const js = await bundle();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const data = { mode: 'viewer', state: viewerState(state), diff };
  const pop = state.subscriberCount.toLocaleString('en-US');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Subscriber Kingdom — Day ${state.day}</title>
<style>${fontFaces()}
html,body{margin:0;height:100%;background:#0b0f1a;overflow:hidden;font-family:Inter,sans-serif;color:#fff}
#stage{position:fixed;inset:0}canvas{display:block;width:100%!important;height:100%!important}
#hud{position:fixed;left:16px;top:16px;padding:14px 18px;border-radius:14px;background:rgba(18,29,71,.82);border:2px solid #e3b23c;max-width:min(360px,calc(100vw - 64px))}
#hud h1{margin:0;font:700 22px Cinzel,serif;color:#e3b23c;letter-spacing:2px}
#hud .n{font:700 34px Cinzel,serif;color:#fff4d6}#hud p{margin:6px 0 0;font-size:13px;opacity:.85}
#hud label{display:block;margin-top:10px;font-size:13px}#hud input{width:100%}
#loading{position:fixed;inset:0;display:grid;place-items:center;font:700 22px Cinzel,serif;color:#e3b23c}</style></head>
<body><div id="stage"></div><div id="loading">Raising the kingdom…</div>
<div id="hud"><h1>SUBSCRIBER KINGDOM</h1><div class="n">${pop} villagers</div>
<p>Day ${state.day} · ${state.date} · ${state.houses.length.toLocaleString('en-US')} houses · ${state.buildings.length} buildings</p>
<label>Time of day <input id="time" type="range" min="0" max="100" value="25"></label>
<p>Drag to orbit · scroll to zoom · right-drag to pan</p></div>
<script>window.__KINGDOM__=${safeJson(data)};</script>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
<script>(function w(){if(window.__ready||window.__error){document.getElementById('loading').remove();return}setTimeout(w,100)})()</script>
</body></html>`;
  fs.writeFileSync(out, html);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = await buildRenderPage();
  console.log('wrote', f, (fs.statSync(f).size / 1e6).toFixed(2), 'MB');
}
