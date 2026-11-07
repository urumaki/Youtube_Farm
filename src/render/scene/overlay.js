// DOM overlay (counter, labels, captions, goal, CTA). Everything stays inside the platform safe zone:
// no key text in the top 220 px, the bottom 380 px or the right 160 px of the 1080x1920 frame.
import * as THREE from 'three';
import { JOBS } from '../../sim/tiers.js';
import { UPDATE_END, WIDE_END } from './timeline.js';

export const SAFE = { top: 220, bottom: 380, right: 160, left: 60 };
const W = 1080, H = 1920;

const CSS = `
#ov{position:absolute;inset:0;pointer-events:none;font-family:'Inter',sans-serif;color:#fff;overflow:hidden}
#ov .safe{position:absolute;left:${SAFE.left}px;top:${SAFE.top}px;width:${W - SAFE.left - SAFE.right}px;height:${H - SAFE.top - SAFE.bottom}px}
#ov .counter{position:absolute;left:0;right:0;top:40px;text-align:center;transition:none}
#ov .crown{font-family:'Cinzel',serif;font-weight:700;font-size:40px;letter-spacing:6px;color:#e3b23c;text-shadow:0 3px 10px rgba(0,0,0,.8)}
#ov .num{font-family:'Cinzel',serif;font-weight:700;font-size:150px;line-height:1;color:#fff4d6;text-shadow:0 6px 0 #6b4a12,0 10px 30px rgba(0,0,0,.75)}
#ov .unit{font-family:'Cinzel',serif;font-weight:700;font-size:46px;letter-spacing:4px;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.85)}
#ov .delta{display:inline-block;margin-top:18px;padding:10px 30px;border-radius:40px;font-weight:800;font-size:56px;background:rgba(18,29,71,.82);border:3px solid #e3b23c;box-shadow:0 8px 24px rgba(0,0,0,.4)}
#ov .delta.down{background:rgba(90,18,30,.85)}
#ov .label{position:absolute;transform:translate(-50%,-100%);padding:12px 22px 14px;border-radius:18px;background:rgba(18,29,71,.86);border:3px solid #e3b23c;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.45);text-align:center}
#ov .label .t{font-family:'Cinzel',serif;font-weight:700;font-size:36px;color:#fff4d6}
#ov .label .s{font-weight:700;font-size:28px;color:#e3b23c;letter-spacing:1px;text-transform:uppercase}
#ov .label.loss{background:rgba(70,18,26,.88);border-color:#c9a0a0}
#ov .label .more{font-weight:700;font-size:24px;color:#cfd8ff}
#ov .label .prog{position:relative;margin:10px auto 2px;width:320px;height:34px;border-radius:17px;background:rgba(0,0,0,.5);border:2px solid #e3b23c;overflow:hidden}
#ov .label .prog i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#b8862a,#ffe08a)}
#ov .label .prog b{position:relative;display:block;font-weight:800;font-size:24px;line-height:34px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.95)}
#ov .tag{position:absolute;transform:translate(-50%,-100%);padding:4px 10px 5px;border-radius:12px;background:rgba(18,29,71,.82);border:2px solid #e3b23c;white-space:nowrap;text-align:center;line-height:1.05}
#ov .tag .t{font-family:'Cinzel',serif;font-weight:700;font-size:22px;color:#fff4d6}
#ov .tag .s{font-weight:700;font-size:14px;color:#e3b23c;letter-spacing:1px;text-transform:uppercase}
#ov .tag.small{padding:3px 7px 4px;border-radius:10px}#ov .tag.small .t{font-size:18px}#ov .tag.small .s{font-size:11px}
#ov .banner{position:absolute;left:0;right:0;top:46px;text-align:center;font-family:'Cinzel',serif;font-weight:700;font-size:48px;color:#fff4d6;text-shadow:0 4px 0 #6b4a12,0 6px 20px rgba(0,0,0,.8)}
#ov .pin{position:absolute;width:4px;background:#e3b23c;transform:translateX(-50%)}
#ov .goal{position:absolute;left:20px;right:20px;top:330px;text-align:center;font-weight:800;font-size:48px;line-height:1.2;text-shadow:0 3px 14px rgba(0,0,0,.9)}
#ov .goal b{color:#e3b23c}
#ov .bar{margin:22px auto 0;width:640px;height:22px;border-radius:12px;background:rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.6);overflow:hidden}
#ov .bar i{display:block;height:100%;background:linear-gradient(90deg,#b8862a,#ffe08a)}
#ov .cta{position:absolute;left:0;right:0;top:380px;text-align:center}
#ov .cta .big{font-family:'Cinzel',serif;font-weight:700;font-size:74px;line-height:1.1;color:#fff4d6;text-shadow:0 5px 0 #6b4a12,0 8px 26px rgba(0,0,0,.8)}
#ov .cta .cmt{margin-top:26px;font-weight:800;font-size:40px;color:#fff4d6;text-shadow:0 3px 12px rgba(0,0,0,.9)}
#ov .cta .btn{display:inline-block;margin-top:34px;padding:22px 54px;border-radius:60px;background:#c4302b;font-weight:800;font-size:52px;letter-spacing:2px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
#ov .credits{position:absolute;left:0;right:0;top:640px;height:460px;overflow:hidden;-webkit-mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent)}
#ov .credits .roll{position:absolute;left:0;right:0;top:0;display:grid;grid-template-columns:repeat(var(--cols),1fr);row-gap:8px;text-align:center}
#ov .credits .h.more{padding:14px 0 0;font-size:24px;letter-spacing:1px;text-transform:none}
#ov .credits .h{grid-column:1/-1;padding:28px 0 8px;font-weight:800;font-size:26px;letter-spacing:3px;color:#e3b23c;text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,.9)}
#ov .credits .n{font-family:'Cinzel',serif;font-weight:700;font-size:var(--fs);line-height:1.05;color:#fff4d6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px;text-shadow:0 2px 0 #3a2a0a,0 3px 10px rgba(0,0,0,.9)}
#ov .credits .n i{display:block;font-family:'Inter',sans-serif;font-style:normal;font-weight:700;font-size:calc(var(--fs) * .55);letter-spacing:1px;color:#e3b23c;text-transform:uppercase}
#ov .day{position:absolute;left:0;top:0;font-weight:700;font-size:30px;color:#fff;opacity:.92;text-shadow:0 2px 8px rgba(0,0,0,.9)}
#ov .cap{position:absolute;left:0;right:0;bottom:30px;text-align:center}
#ov .bracket{position:absolute;left:0;top:120px;width:860px;height:520px}
#ov .bracket .bx{position:absolute;width:200px;height:46px;background:#e4e4e4;color:#1a1a1a;font-weight:800;font-size:22px;line-height:46px;padding:0 6px 0 17px;box-sizing:border-box;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;box-shadow:0 3px 10px rgba(0,0,0,.35)}
#ov .bracket .bx::before{content:'';position:absolute;left:0;top:0;bottom:0;width:11px;background:#1c1c1c}
#ov .bracket .bx.up::before{background:#22c02c}
#ov .bracket .bx.now{outline:4px solid #e3b23c}
#ov .bracket .bx.out{opacity:.55}
#ov .bracket .ttl{position:absolute;right:0;top:-6px;font-family:'Cinzel',serif;font-weight:700;font-size:44px;line-height:1;color:#fff4d6;text-align:right;text-shadow:0 3px 0 #6b4a12,0 5px 16px rgba(0,0,0,.85);padding-right:22px;border-right:10px solid #22c02c}
#ov .foot{position:absolute;left:0;right:0;bottom:230px;padding:0 70px;line-height:1.25;text-align:center;font-weight:800;font-size:34px;letter-spacing:1px;color:#fff4d6;text-shadow:0 2px 0 #000,0 3px 12px rgba(0,0,0,.95)}
#ov .cap span{display:inline-block;margin:0 8px;font-weight:900;font-size:64px;line-height:1.15;color:#fff;text-shadow:0 0 6px #000,0 4px 0 #000,0 6px 18px rgba(0,0,0,.9);-webkit-text-stroke:2px #000}
#ov .cap span.on{color:#ffd35a}
`;

const STR = { villagers: 'VILLAGERS', villager: 'VILLAGER', day: 'Day', more: (n) => `+${n} more homes`, until: (n, g) => `<b>${n}</b> more villager${n === 1 ? '' : 's'} until <b>${g}</b>`, cta1: 'Subscribe to', cta2: 'become a villager', btn: 'SUBSCRIBE', cmt: 'Comment to name a villager', credits: 'The villagers', others: (n) => `and ${n} more villager${n === 1 ? '' : 's'}`, realm: 'SUBSCRIBER KINGDOM', weather: { clear: 'Clear skies', cloudy: 'Cloudy', fog: 'Fog', rain: 'Rain', snow: 'Snow' }, none: 'No change today' };

export function createOverlay(root, data) {
  const s = STR;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ov = document.createElement('div');
  ov.id = 'ov';
  ov.innerHTML = `<div class="safe">
    <div class="day"></div>
    <div class="counter"><div class="crown">${s.realm}</div><div class="num">0</div><div class="unit"></div><div class="delta"></div></div>
    <div class="goal"></div>
    <div class="banner"></div>
    <div class="credits"><div class="roll"></div></div>
    <div class="cta"><div class="big">${s.cta1}<br>${s.cta2}</div><div class="btn">${s.btn}</div><div class="cmt">${s.cmt}</div></div>
    <div class="bracket"></div>
    <div class="foot"></div>
    <div class="cap"></div>
  </div>`;
  root.appendChild(ov);
  const $ = (q) => ov.querySelector(q);
  const banner = $('.banner'), foot = $('.foot'), bracket = $('.bracket');
  let bracketKey = null;
  const tagEls = [];
  const counter = $('.counter'), num = $('.num'), unit = $('.unit'), delta = $('.delta'), goal = $('.goal'), cta = $('.cta'), cap = $('.cap'), day = $('.day');
  const diff = data.diff;
  const pop = data.state.subscriberCount;
  day.textContent = `${s.day} ${data.state.day} · ${s.weather[diff.weather] || ''}`;
  unit.textContent = pop === 1 ? s.villager : s.villagers;
  const d = diff.delta;
  delta.textContent = d > 0 ? `+${d.toLocaleString('en-US')} ${d === 1 ? 'villager!' : 'villagers!'}` : d < 0 ? `${d.toLocaleString('en-US')} villagers` : s.none;
  if (d < 0) delta.classList.add('down');
  if (diff.next) {
    const frac = Math.max(0.03, Math.min(1, pop / diff.next.at));
    goal.innerHTML = `${s.until(diff.next.remaining.toLocaleString('en-US'), data.goalText || diff.next.goal)}<div class="bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>`;
  }
  // end credits: a short, still card during the wide shot. Only the newest named villagers fit (today's
  // first); the others are counted in one line, so the card stays readable however many names there are.
  const credits = $('.credits'), roll = $('.roll');
  const job = (n, id) => {
    const j = data.state.villagers?.[id]?.job ?? n.job;
    return j === 'apprentice' && n.wants ? `Apprentice ${JOBS[n.wants]?.label || n.wants}` : JOBS[j]?.label || j || '';
  };
  const people = Object.entries(data.state.names || {}).map(([id, n]) => ({ id: Number(id), n }))
    .filter((p) => !data.state.villagers || p.id < data.state.villagers.length)
    .sort((a, b) => (b.n.day ?? 0) - (a.n.day ?? 0) || a.id - b.id);
  const MAX_CREDITS = 10;
  const shownPeople = people.slice(0, MAX_CREDITS), others = people.length - shownPeople.length;
  const cols = shownPeople.length > 5 ? 2 : 1;
  roll.style.setProperty('--cols', cols);
  roll.style.setProperty('--fs', `${[0, 34, 30][cols]}px`);
  roll.innerHTML = people.length ? `<div class="h">${s.credits}</div>` + shownPeople.map(({ id, n }) => `<div class="n">${esc(n.name)}<i>${esc(job(n, id))}</i></div>`).join('')
    + (others > 0 ? `<div class="h more">${s.others(others.toLocaleString('en-US'))}</div>` : '') : '';
  const labelEls = new Map();
  // how far a building is: yesterday's share and today's (owner 2026-10-29: a percentage bar over the building going up)
  const buildSpan = (id) => {
    const bd = data.state.buildings?.find((b) => b.id === id);
    if (!bd) return null;
    const total = bd.daysTotal || 0;
    const left = bd.status === 'done' ? 0 : data.state.pendingConstruction?.find((p) => p.building === id)?.daysLeft ?? 0;
    const to = total ? Math.min(1, Math.max(0, 1 - left / total)) : 1;
    return { from: Math.max(0, to - (total ? 1 / total : 0)), to };
  };
  const v = new THREE.Vector3();

  return {
    update(t, ev, camera) {
      // the raid's own shots (ev.takeover) open without the counter; a villager's day keeps it (ev.stats)
      const hook = t < 2.2 && (!ev.takeover || ev.stats), wide = ev.section === 'wide', ctaOn = ev.section === 'cta';
      counter.style.opacity = hook || wide ? 1 : 0;
      day.style.opacity = ev.takeover && !ev.stats ? 0 : '';
      counter.style.transform = `scale(${hook ? 0.92 + 0.08 * Math.min(1, t / 0.4) : 0.8}) translateY(${wide ? -10 : 0}px)`;
      counter.style.transformOrigin = '50% 0';
      const shown = hook ? Math.round(diff.from + (pop - diff.from) * Math.min(1, t / 1.2)) : pop;
      num.textContent = shown.toLocaleString('en-US');
      delta.style.display = hook ? 'inline-block' : 'none';
      goal.style.opacity = wide && diff.next ? Math.min(1, (t - UPDATE_END - 0.4) * 3) : 0;
      goal.style.top = '420px';
      credits.style.opacity = wide && people.length ? Math.min(1, (t - UPDATE_END - 0.5) * 3, (WIDE_END - 0.1 - t) * 4) : 0;
      cta.style.opacity = ctaOn ? Math.min(1, (t - WIDE_END) * 4) : 0;
      // labels for the active target, projected and clamped to the safe zone
      for (const [, el] of labelEls) el.style.display = 'none';
      const tg = ev.active;
      // after a flight the villager is tiny until the camera has landed in front of them
      const u0 = tg?.labelFrom ?? (tg?.kind === 'villager' && !tg.cut && !tg.cutIn ? 0.4 : 0.12);
      // a shot of two villagers has a second label, for the guest, once they have walked in
      // a building going up keeps its big label over the builders' name tags (owner 2026-10-24)
      const site = tg?.kind === 'building';
      // (the Dungeon's shot, owner 2026-11-04: the villager's big label and the other prisoners' tags)
      const bigLabels = tg && (!tg.labels || site || tg.keepLabel) ? [[tg, tg.label, tg.labelPos, u0], [tg.label2, tg.label2, tg.labelPos2, Math.max(u0, 0.22)]].filter((l) => l[1]) : [];
      let first = null;
      for (const [key, label, pos, from] of bigLabels) {
        if (!(ev.activeU > from && ev.activeU < 0.97)) continue;
        let el = labelEls.get(key);
        if (!el) {
          el = document.createElement('div');
          el.className = 'label' + (tg.kind === 'loss' ? ' loss' : '');
          el.innerHTML = `<div class="t">${esc(label.title)}</div>${label.sub ? `<div class="s">${esc(label.sub)}</div>` : ''}${key === tg && tg.extra ? `<div class="more">${s.more(tg.extra)}</div>` : ''}`;
          if (key === tg && site && (el.span = buildSpan(tg.id))) el.insertAdjacentHTML('beforeend', '<div class="prog"><i></i><b></b></div>');
          ov.querySelector('.safe').appendChild(el);
          labelEls.set(key, el);
        }
        (pos ? v.copy(pos) : v.copy(tg.pos).add(new THREE.Vector3(0, 3, 0))).project(camera);
        const x = (v.x * 0.5 + 0.5) * W - SAFE.left, y = (-v.y * 0.5 + 0.5) * H - SAFE.top;
        el.style.display = 'block';
        if (el.span) {
          // the bar fills from yesterday's share to today's while the building goes up in the shot
          const p = el.span.from + (el.span.to - el.span.from) * (ev.progress.get('b' + tg.id) ?? 1);
          el.querySelector('.prog i').style.width = `${(p * 100).toFixed(1)}%`;
          el.querySelector('.prog b').textContent = `${Math.round(p * 100)}%`;
        }
        const wEl = el.offsetWidth, hEl = el.offsetHeight;
        const sw = W - SAFE.left - SAFE.right, sh = H - SAFE.top - SAFE.bottom;
        const cx = Math.min(sw - wEl / 2, Math.max(wEl / 2, x));
        let cy = Math.min(sh - 260, Math.max(hEl + 10, y - 30));
        // the two labels never cover each other: the second one moves below the first
        if (first && Math.abs(first.x - cx) < (first.w + wEl) / 2 && Math.abs(first.y - cy) < hEl + 6) cy = first.y + hEl + 8;
        first ??= { x: cx, y: cy, w: wEl, h: hEl };
        el.style.left = `${cx}px`; el.style.top = `${cy}px`;
        el.style.opacity = Math.min(1, (ev.activeU - from) * 8, (0.97 - ev.activeU) * 12);
        // the name label pops in with a small overshoot
        const k = Math.min(1, (ev.activeU - from) * 6);
        const pop = k >= 1 ? 1 : 0.55 + 0.45 * (1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2);
        el.style.transformOrigin = '50% 100%';
        el.style.transform = `translate(-50%,-100%) scale(${pop.toFixed(3)})`;
      }
      // many small name tags (the caravan): nearest first, hidden when they would overlap
      for (const el of tagEls) el.style.display = 'none';
      banner.style.opacity = 0;
      // the Grand Joust's bracket (owner 2026-11-01): over the riders lined up and at the end; in a bout, as it begins (the
      // pair about to ride outlined) and again once the loser is down (the round decided, the champion's new place
      // outlined), so it stays up across the cut from one round to the next and can be read (owner's second look)
      const bk0 = tg?.bracket, u = ev.activeU;
      const late = !!bk0?.end && u >= bk0.end.from;
      const bk = bk0 && (late ? { ...bk0, ...bk0.end } : bk0);
      const key = bk ? JSON.stringify([bk.decided, bk.current, bk.champion, bk.mode]) : null;
      if (key !== bracketKey) { bracketKey = key; bracket.innerHTML = bk ? bracketHTML(bk) : ''; }
      bracket.style.opacity = !bk ? 0 : bk.mode === 'big' ? Math.max(0, Math.min(1, (u - 0.05) * 8, (0.97 - u) * 12))
        : late ? Math.max(0, Math.min(1, (u - bk.from) * 10, (0.995 - u) * 40)) : Math.max(0, Math.min(1, u * 40, (0.3 - u) * 10));
      foot.textContent = tg?.footer || '';
      foot.style.opacity = tg?.footer ? Math.max(0, Math.min(1, (ev.activeU - 0.05) * 6, (0.97 - ev.activeU) * 12)) : 0;
      // the builders' tags wait for the flight into the shot to end
      const tagFrom = site ? 0.3 : 0.08;
      if (tg && tg.labels && ev.activeU > tagFrom && ev.activeU < 0.97) {
        banner.textContent = tg.banner || '';
        // when the caravan opens the video, the banner waits for the counter to leave the top of the frame
        banner.style.opacity = hook ? 0 : Math.max(0, Math.min(1, (ev.activeU - 0.08) * 6, (t - 2.2) * 6, (0.97 - ev.activeU) * 12));
        const sw = W - SAFE.left - SAFE.right, sh = H - SAFE.top - SAFE.bottom;
        const placed = [];
        // the caravan (owner 2026-10-23: more names): smaller tags, and the ones that would overlap take turns, so
        // that every newcomer's tag shows for a while; the turn changes a few times in the shot
        // the church (owner 2026-10-23) too: many names in the pews
        // and the tavern (owner 2026-10-23: more names at the tables)
        // and story events with many named people (owner 2026-10-25: the guards, the escort, the bucket chain are named too)
        const caravan = tg.kind === 'caravan' || tg.kind === 'church' || tg.kind === 'tavern' || (tg.kind === 'event' && tg.labels.length > 4);
        const n = tg.labels.length, turns = caravan ? Math.min(6, Math.max(1, Math.ceil(n / 11))) : 1;
        const turn = Math.min(turns - 1, Math.floor(((ev.activeU - 0.08) / 0.89) * turns));
        const lead = Math.round((turn * n) / turns); // the first newcomer whose tag comes first this turn
        const items = tg.labels.map((lb, i) => {
          v.copy(lb.pos).project(camera);
          return { lb, x: (v.x * 0.5 + 0.5) * W - SAFE.left, y: (-v.y * 0.5 + 0.5) * H - SAFE.top, z: v.z, rank: (i - lead + n) % n };
        }).filter((it) => !it.lb.hidden && it.z < 1 && it.x > -40 && it.x < sw + 40 && it.y > 130 && it.y < sh - 200).sort((a, b) => (caravan ? a.rank - b.rank : 0) || a.z - b.z);
        items.forEach((it, i) => {
          let el = tagEls[i];
          if (!el) { el = document.createElement('div'); ov.querySelector('.safe').appendChild(el); tagEls[i] = el; }
          el.className = caravan ? 'tag small' : 'tag';
          el.innerHTML = `<div class="t">${esc(it.lb.title)}</div><div class="s">${esc(it.lb.sub || '')}</div>`;
          el.style.display = 'block';
          const wEl = el.offsetWidth, hEl = el.offsetHeight;
          const cx = Math.min(sw - wEl / 2, Math.max(wEl / 2, it.x));
          if (placed.some((p) => Math.abs(p.x - cx) < (p.w + wEl) / 2 - 6 && Math.abs(p.y - it.y) < hEl - 4)) { el.style.display = 'none'; return; }
          if (first && Math.abs(first.x - cx) < (first.w + wEl) / 2 && it.y > first.y - first.h - 4 && it.y - hEl < first.y + 4) { el.style.display = 'none'; return; }
          placed.push({ x: cx, y: it.y, w: wEl });
          el.style.left = `${cx}px`; el.style.top = `${it.y}px`;
          el.style.opacity = Math.min(1, (ev.activeU - tagFrom) * 6, (0.97 - ev.activeU) * 12);
        });
      }
      // captions: the current phrase, the spoken word highlighted
      const c = (data.captions || []).find((p) => t >= p.start && t < p.end + 0.15);
      if (c !== cap._cur) {
        cap._cur = c;
        cap.innerHTML = c ? c.words.map((w) => `<span>${esc(w.w)}</span>`).join('') : '';
      }
      if (c) [...cap.children].forEach((sp, i) => sp.classList.toggle('on', t >= c.words[i].s && t < c.words[i].e + 0.05));
    },
  };
}

/**
 * The bracket of the Grand Joust as HTML: the eight riders on the left, each round's winners to the right as far as it is
 * decided, the champion and a cup at the end; lines join each pair to the one who went on. No backdrop (owner 2026-11-01).
 */
function bracketHTML(b) {
  // as wide as the safe area (860), the boxes as tall and the names as big as fit (owner's second look: readable)
  const BW = 200, BH = 46, X = [0, 220, 440, 660], TOP = 60, GAP = 58;
  const ys = [Array.from({ length: 8 }, (_, i) => TOP + i * GAP)];
  for (let k = 1; k <= 3; k++) ys.push(ys[k - 1].filter((_, i) => i % 2 === 0).map((y, i) => (y + ys[k - 1][2 * i + 1]) / 2));
  const cols = [b.rounds[0].flatMap((bt) => [bt.a, bt.b])];
  b.rounds.forEach((r, k) => cols.push(k < b.decided ? r.map((bt) => bt.winner) : r.map(() => null)));
  // who went on from each column (their box gets the green bar), who is out
  const wentOn = (k, id) => k < b.decided && b.rounds[k].some((bt) => bt.winner === id);
  const out = (k, id) => k < b.decided && b.rounds[k].some((bt) => (bt.a === id || bt.b === id) && bt.winner !== id);
  let html = '', lines = '';
  cols.forEach((col, k) => col.forEach((id, i) => {
    const y = ys[k][i];
    const cls = ['bx', id !== null && (wentOn(k, id) || (k === 3 && b.champion)) ? 'up' : '', id !== null && out(k, id) ? 'out' : '', id !== null && b.current?.includes(id) && k === (b.decided) ? 'now' : ''].filter(Boolean).join(' ');
    const name = id === null ? '' : b.names[id] || '';
    html += `<div class="${cls}" style="left:${X[k]}px;top:${y}px;font-size:${name.length > 15 ? 16 : name.length > 12 ? 18 : 21}px">${esc(name)}</div>`;
    if (k < 3 && i % 2 === 0) {
      const y1 = y + BH / 2, y2 = ys[k][i + 1] + BH / 2, xm = X[k] + BW + 16, yn = ys[k + 1][i / 2] + BH / 2;
      lines += `<polyline points="${X[k] + BW},${y1} ${xm},${y1} ${xm},${y2} ${X[k] + BW},${y2}" /><polyline points="${xm},${yn} ${X[k + 1]},${yn}" />`;
    }
  }));
  const cup = b.champion ? `<svg style="position:absolute;left:${X[3] + 55}px;top:${ys[3][0] + 60}px" width="90" height="100" viewBox="0 0 80 90"><path d="M18 6h44v18c0 16-10 28-22 28S18 40 18 24z" fill="#e3b23c" stroke="#6b4a12" stroke-width="3"/><path d="M18 12H6c0 14 6 20 14 20M62 12h12c0 14-6 20-14 20" fill="none" stroke="#e3b23c" stroke-width="5"/><rect x="34" y="52" width="12" height="14" fill="#e3b23c"/><rect x="22" y="66" width="36" height="12" rx="2" fill="#e3b23c" stroke="#6b4a12" stroke-width="3"/></svg>` : '';
  return `<svg style="position:absolute;left:0;top:0" width="860" height="520"><g fill="none" stroke="#f4f0e6" stroke-width="3" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.8))">${lines}</g></svg>`
    + (b.mode === 'big' ? '<div class="ttl">THE GRAND<br>JOUST</div>' : '') + html + cup;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
