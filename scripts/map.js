// A map of the town from above, for planning: the river, roads, fields, houses (and the plots still free),
// the Second Wall with its gates, the buildings standing or going up, and the ones still to come with the
// number of subscribers that brings each. Read only.
// node scripts/map.js [--state-dir state] [--out output/map.png]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { world, CASTLE, RIVER_HALF_WIDTH } from '../src/sim/world.js';
import { obbOverlap } from '../src/sim/geometry.js';
import { wallLayout, wallBlockers } from '../src/sim/wall.js';
import { ensureWall2 } from '../src/sim/simulate.js';
import { migrate, STATE_DIR } from '../src/sim/state.js';
import { BUILDINGS, TIERS } from '../src/sim/tiers.js';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const dir = opt('--state-dir', STATE_DIR);
const out = opt('--out', path.join('output', 'map.png'));
const state = migrate(JSON.parse(fs.readFileSync(path.join(dir, 'kingdom.json'), 'utf8')));
const w = world(state.seed);
ensureWall2(state, w); // the wall as the next day will plan it
const status = new Map(state.buildings.map((b) => [b.id, b.status]));
const tierOf = new Map();
for (const t of TIERS) for (const b of t.buildings) if (!tierOf.has(b)) tierOf.set(b, t);

// the area shown: the wall, the town and every building lot near it
const pts = [...(state.wall2?.pts || []), ...state.plots.map((p) => [p.x, p.z])];
for (const l of Object.values(w.lots)) if (Math.hypot(l.x - 150, l.z) < 520) pts.push([l.x, l.z]);
const x0 = Math.min(...pts.map((p) => p[0])) - 40, x1 = Math.max(...pts.map((p) => p[0])) + 40;
const z0 = Math.min(...pts.map((p) => p[1])) - 40, z1 = Math.max(...pts.map((p) => p[1])) + 60;
const S = 2400 / (x1 - x0), W = 2400, H = Math.round((z1 - z0) * S);
const X = (x) => ((x - x0) * S).toFixed(1), Z = (z) => ((z - z0) * S).toFixed(1);
const line = (p, attrs) => `<polyline points="${p.map(([x, z]) => `${X(x)},${Z(z)}`).join(' ')}" fill="none" ${attrs}/>`;
const box = (b, attrs) => `<rect x="${X(b.x - b.hw)}" y="${Z(b.z - b.hd)}" width="${(b.hw * 2 * S).toFixed(1)}" height="${(b.hd * 2 * S).toFixed(1)}" transform="rotate(${((b.rot || 0) * 180) / Math.PI} ${X(b.x)} ${Z(b.z)})" ${attrs}/>`;
const text = (x, z, s, size, attrs = '') => `<text x="${X(x)}" y="${Z(z)}" font-size="${size}" text-anchor="middle" ${attrs}>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;

const svg = [];
svg.push(`<rect width="${W}" height="${H}" fill="#cfd8b0"/>`);
svg.push(line(w.riverPts, `stroke="#7fa8c9" stroke-width="${RIVER_HALF_WIDTH * 2 * S}" stroke-linecap="round" stroke-linejoin="round"`));
for (const f of w.fields) svg.push(box(f, 'fill="#e2c46a" stroke="#b39440" stroke-width="1"'));
for (const t of w.tracks) svg.push(line(t.pts, `stroke="#b9a37a" stroke-width="${t.width * S}" stroke-linecap="round"`));
for (const r of w.roads) svg.push(line(r.pts, `stroke="#a89a86" stroke-width="${r.width * S}" stroke-linecap="round" stroke-linejoin="round"`));
// plots: built houses dark (taller ones darker), free plots of the plan as faint outlines
const used = new Set(state.plots.map((p) => p.id));
// only the plots new houses can still take: not one passed over already, not one under the Second Wall
const onWall = state.wall2 ? wallBlockers(w, state.wall2.pts) : [];
const open = (p, i) => i >= (state.nextPlot ?? 0) && !onWall.some((b) => obbOverlap(b, p));
for (const [i, p] of w.plots.entries()) if (!used.has(p.id) && open(p, i) && p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) svg.push(box(p, 'fill="none" stroke="#9aa07a" stroke-width="0.8"'));
// the Noble Quarter's wide plots (finer houses), still free
for (const p of w.finePlots) if (!used.has(p.id)) svg.push(box(p, 'fill="#9b6fc4" fill-opacity="0.12" stroke="#7a4fa8" stroke-width="1.2"'));
const floors = new Map(state.houses.map((h) => [h.plot, h.floors || 1]));
for (const p of state.plots) svg.push(box(p, `fill="${p.fine ? '#7a4fa8' : ['#c98b5a', '#a8653a', '#7e4524'][(floors.get(p.id) || 1) - 1]}" stroke="#5a3a20" stroke-width="0.6"`));
// the castle
svg.push(`<circle cx="${X(0)}" cy="${Z(0)}" r="${CASTLE.moatOuter * S}" fill="#7fa8c9"/>`);
svg.push(box({ x: 0, z: 0, hw: CASTLE.half, hd: CASTLE.half }, 'fill="#8d8d8d" stroke="#444" stroke-width="2"'));
svg.push(text(0, 4, 'Castle', 22, 'font-weight="700" fill="#fff"'));
// the Second Wall, its towers and gates
if (state.wall2) {
  const L = wallLayout(w, state.wall2.pts);
  svg.push(line(state.wall2.pts, `stroke="#555" stroke-width="${4 * S}" stroke-dasharray="6 6" opacity="0.5"`));
  for (const pc of L.pieces) svg.push(box(pc, 'fill="#4a4a4a"'));
  for (const [x, z] of L.towers) svg.push(`<circle cx="${X(x)}" cy="${Z(z)}" r="${4 * S}" fill="#333"/>`);
  for (const g of L.gates) svg.push(`<circle cx="${X(g.x)}" cy="${Z(g.z)}" r="${6 * S}" fill="#d64545" stroke="#fff" stroke-width="2"/>`);
}
// buildings: standing (green), going up (orange), still to come (dashed blue, with the subscribers needed)
const labels = [], small = [], far = [];
for (const [id, l] of Object.entries(w.lots)) {
  if (!BUILDINGS[id] || id === 'fields' || id === 'wall2') continue;
  const st = status.get(id);
  if (l.x < x0 || l.x > x1 || l.z < z0 || l.z > z1) { if (!st) far.push(`${BUILDINGS[id].label.replace(/^the /, '')} (${tierOf.get(id)?.at.toLocaleString('en-US') ?? 'commissioned'})`); continue; }
  const hw = Math.max(l.hw || 0, 3), hd = Math.max(l.hd || 0, 3);
  const b = { ...l, hw, hd };
  const name = BUILDINGS[id].label.replace(/^the /, '');
  if (st === 'done') svg.push(box(b, 'fill="#5f9e5a" stroke="#2f5e2a" stroke-width="2" opacity="0.9"'));
  else if (st) svg.push(box(b, 'fill="#e89a3c" stroke="#9a5a12" stroke-width="2" opacity="0.9"'));
  else svg.push(box(b, 'fill="#5b8bd6" fill-opacity="0.18" stroke="#2c5aa8" stroke-width="2" stroke-dasharray="8 5"'));
  const t = tierOf.get(id);
  const s = st ? name : `${name} (${t ? t.at.toLocaleString('en-US') : 'commissioned, next day'})`, color = st === 'done' ? '#1f4a1b' : st ? '#7a4208' : '#1d4387';
  // the small stalls on the squares get a number, listed in the key (their names would overlap)
  if (l.onPlaza || hw * S < 12) { small.push({ s, color }); svg.push(`<circle cx="${X(l.x)}" cy="${Z(l.z)}" r="11" fill="#fff" stroke="${color}" stroke-width="2"/>`); svg.push(text(l.x, l.z + 5 / S, String(small.length), 14, `font-weight="700" fill="${color}"`)); }
  else labels.push({ x: l.x, z: l.z - hd - 3, s, color });
}
for (const lb of labels) svg.push(text(lb.x, lb.z, lb.s, 17, `font-weight="700" fill="${lb.color}" stroke="#fff" stroke-width="4" paint-order="stroke"`));
small.push(...far.map((s) => ({ s: `${s}, further out`, color: '#1d4387', far: true })));
const kx = 40, ky = H - small.length * 28 - 40;
svg.push(`<rect x="${kx - 20}" y="${ky - 40}" width="520" height="${small.length * 28 + 60}" fill="#fff" opacity="0.88" rx="10"/>`);
svg.push(`<text x="${kx}" y="${ky - 10}" font-size="22" font-weight="700">Small buildings</text>`);
small.forEach(({ s, color, far: f }, i) => svg.push(`<text x="${kx}" y="${ky + 22 + i * 28}" font-size="19" fill="${color}">${f ? '-' : `${i + 1}.`} ${s.replace(/&/g, '&amp;')}</text>`));
// legend
const legend = [['#5f9e5a', 'Standing'], ['#e89a3c', 'Going up'], ['#5b8bd6', 'To come (subscribers needed)'], ['#c98b5a', 'House, 1 storey'], ['#7e4524', 'House, 3 storeys'], ['#9b6fc4', 'Noble Quarter plot (finer houses)'], ['#e2c46a', 'Field'], ['#4a4a4a', 'Second Wall'], ['#d64545', 'Gate']];
svg.push(`<rect x="20" y="20" width="420" height="${legend.length * 34 + 60}" fill="#fff" opacity="0.88" rx="10"/>`);
svg.push(`<text x="40" y="58" font-size="26" font-weight="700">Subscriber Kingdom, day ${state.day} (${state.subscriberCount} villagers)</text>`);
legend.forEach(([c, s], i) => svg.push(`<rect x="40" y="${78 + i * 34}" width="28" height="22" fill="${c}"/><text x="80" y="${96 + i * 34}" font-size="20">${s}</text>`));

const html = `<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif">${svg.join('')}</svg></body></html>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out.replace(/\.png$/, '.svg'), html.replace(/^<html><body style="margin:0">|<\/body><\/html>$/g, ''));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
