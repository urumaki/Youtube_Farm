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
import { renderTimelapse } from '../src/render/timelapse.js';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
await renderTimelapse({ from: opt('--from', null), to: opt('--to', null), days: Number(opt('--days', 30)), seconds: Number(opt('--seconds', 31)),
  out: opt('--out', null), framesOnly: args.includes('--frames-only') });
