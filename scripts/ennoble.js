// Owner 2026-11-07: make a villager a Noble, by hand only (never by chance, never from a comment).
//   node scripts/ennoble.js "<name>" [--day N] [--list]
// Queues the villager in `state.ennoble` (kingdom.json and the latest history file, which the next run starts from): on day
// N (default: the next run's day), or the first day after it that no owner story, urgent step, calendar event or new goal
// takes, the video shows the King giving the title in the throne room and the Noble's new manor with its sign "Noble" and
// the name under it (src/sim/stories.js `noble`). Commit and push state/ afterwards. --list shows the Nobles and the queue.
import fs from 'node:fs';
import path from 'node:path';

const STATE = 'state';
const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const day = flag('--day');
const list = args.includes('--list');
const name = args.filter((a) => a !== '--list').join(' ').trim();

const read = (f) => { const raw = fs.readFileSync(f, 'utf8'); return { raw, json: JSON.parse(raw) }; };
// keep each file's own layout: kingdom.json indented by one space, the history files on one line
const write = (f, raw, json) => fs.writeFileSync(f, JSON.stringify(json, null, raw.startsWith('{\n') ? 1 : 0) + (raw.endsWith('\n') ? '\n' : ''));

const kFile = path.join(STATE, 'kingdom.json');
const k = read(kFile);
const s = k.json;
const hFile = path.join(STATE, 'history', `${s.date}.json`);
const h = fs.existsSync(hFile) ? read(hFile) : null;
if (h && h.json.state.day !== s.day) throw new Error(`${hFile} is day ${h.json.state.day}, kingdom.json day ${s.day}`);

if (list) {
  const nobles = Object.entries(s.names || {}).filter(([, n]) => n.noble !== undefined).map(([id, n]) => `#${id} ${n.name} (since day ${n.noble})`);
  console.log('Nobles:', nobles.length ? nobles.join(', ') : 'none');
  console.log('Queued:', (s.ennoble || []).map((e) => `#${e.id} ${s.names[e.id]?.name} (day ${e.day})`).join(', ') || 'none');
  process.exit(0);
}
if (!name) { console.error('usage: node scripts/ennoble.js "<name>" [--day N] [--list]'); process.exit(1); }

const matches = Object.entries(s.names || {}).filter(([, n]) => n.name?.toLowerCase() === name.toLowerCase());
if (matches.length !== 1) {
  const near = Object.values(s.names || {}).map((n) => n.name).filter((n) => n && n.toLowerCase().includes(name.toLowerCase())).slice(0, 10);
  console.error(matches.length ? `"${name}" names ${matches.length} villagers` : `no villager named "${name}"${near.length ? ` (did you mean: ${near.join(', ')})` : ''}`);
  process.exit(1);
}
const [idStr, n] = matches[0];
const id = Number(idStr);
if (n.noble !== undefined) { console.error(`${n.name} is a Noble already (since day ${n.noble})`); process.exit(1); }
if ((s.ennoble || []).some((e) => e.id === id)) { console.error(`${n.name} is queued already`); process.exit(1); }
const entry = { id, day: day !== undefined ? Number(day) : s.day + 1 };
if (!Number.isInteger(entry.day) || entry.day <= s.day) { console.error(`--day must be after the last saved day (${s.day})`); process.exit(1); }

for (const [file, f, st] of [[kFile, k, s], ...(h ? [[hFile, h, h.json.state]] : [])]) {
  st.ennoble = [...(st.ennoble || []), entry];
  write(file, f.raw, f.json);
}
const busy = s.storyArc && (s.storyArc.owner || s.storyArc.id === 'raid') ? ` (a story is set for day ${s.storyArc.day}: the title comes on the first day after it that is free)` : '';
console.log(`#${id} ${n.name} (${n.job || 'villager'}) will be made a Noble on day ${entry.day}${busy}. Commit and push state/.`);
