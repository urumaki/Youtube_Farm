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
#ov .tag{position:absolute;transform:translate(-50%,-100%);padding:4px 10px 5px;border-radius:12px;background:rgba(18,29,71,.82);border:2px solid #e3b23c;white-space:nowrap;text-align:center;line-height:1.05}
#ov .tag .t{font-family:'Cinzel',serif;font-weight:700;font-size:22px;color:#fff4d6}
#ov .tag .s{font-weight:700;font-size:14px;color:#e3b23c;letter-spacing:1px;text-transform:uppercase}
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
#ov .cap span{display:inline-block;margin:0 8px;font-weight:900;font-size:64px;line-height:1.15;color:#fff;text-shadow:0 0 6px #000,0 4px 0 #000,0 6px 18px rgba(0,0,0,.9);-webkit-text-stroke:2px #000}
#ov .cap span.on{color:#ffd35a}
`;

const STR = {
  en: { villagers: 'VILLAGERS', villager: 'VILLAGER', day: 'Day', more: (n) => `+${n} more homes`, until: (n, g) => `<b>${n}</b> more villager${n === 1 ? '' : 's'} until <b>${g}</b>`, cta1: 'Subscribe to', cta2: 'become a villager', btn: 'SUBSCRIBE', cmt: 'Comment to name a villager', credits: 'The villagers', others: (n) => `and ${n} more villager${n === 1 ? '' : 's'}`, realm: 'SUBSCRIBER KINGDOM', weather: { clear: 'Clear skies', cloudy: 'Cloudy', fog: 'Fog', rain: 'Rain', snow: 'Snow' }, none: 'No change today' },
  it: { villagers: 'ABITANTI', villager: 'ABITANTE', day: 'Giorno', more: (n) => `+${n} altre case`, until: (n, g) => `Ancora <b>${n}</b> abitant${n === 1 ? 'e' : 'i'} e <b>${g}</b>`, cta1: 'Iscriviti per', cta2: 'diventare un abitante', btn: 'ISCRIVITI', cmt: 'Commenta per dare il nome a un abitante', credits: 'Gli abitanti', others: (n) => `e altr${n === 1 ? 'o' : 'i'} ${n} abitant${n === 1 ? 'e' : 'i'}`, realm: 'SUBSCRIBER KINGDOM', weather: { clear: 'Sereno', cloudy: 'Nuvoloso', fog: 'Nebbia', rain: 'Pioggia', snow: 'Neve' }, none: 'Nessun cambiamento oggi' },
};

export function createOverlay(root, data) {
  const s = STR[data.lang] || STR.en;
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
    <div class="cap"></div>
  </div>`;
  root.appendChild(ov);
  const $ = (q) => ov.querySelector(q);
  const banner = $('.banner');
  const tagEls = [];
  const counter = $('.counter'), num = $('.num'), unit = $('.unit'), delta = $('.delta'), goal = $('.goal'), cta = $('.cta'), cap = $('.cap'), day = $('.day');
  const diff = data.diff;
  const pop = data.state.subscriberCount;
  day.textContent = `${s.day} ${data.state.day} · ${s.weather[diff.weather] || ''}`;
  unit.textContent = pop === 1 ? s.villager : s.villagers;
  const d = diff.delta;
  delta.textContent = d > 0 ? `+${d.toLocaleString('en-US')} ${data.lang === 'it' ? (d === 1 ? 'abitante!' : 'abitanti!') : d === 1 ? 'villager!' : 'villagers!'}` : d < 0 ? `${d.toLocaleString('en-US')} ${data.lang === 'it' ? 'abitanti' : 'villagers'}` : s.none;
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
  const v = new THREE.Vector3();

  return {
    update(t, ev, camera) {
      const hook = t < 2.2, wide = ev.section === 'wide', ctaOn = ev.section === 'cta';
      counter.style.opacity = hook || wide ? 1 : 0;
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
      const u0 = tg?.kind === 'villager' && !tg.cut && !tg.cutIn ? 0.4 : 0.12;
      // a shot of two villagers has a second label, for the guest, once they have walked in
      const bigLabels = tg && !tg.labels ? [[tg, tg.label, tg.labelPos, u0], [tg.label2, tg.label2, tg.labelPos2, Math.max(u0, 0.22)]].filter((l) => l[1]) : [];
      let first = null;
      for (const [key, label, pos, from] of bigLabels) {
        if (!(ev.activeU > from && ev.activeU < 0.97)) continue;
        let el = labelEls.get(key);
        if (!el) {
          el = document.createElement('div');
          el.className = 'label' + (tg.kind === 'loss' ? ' loss' : '');
          el.innerHTML = `<div class="t">${esc(label.title)}</div>${label.sub ? `<div class="s">${esc(label.sub)}</div>` : ''}${key === tg && tg.extra ? `<div class="more">${s.more(tg.extra)}</div>` : ''}`;
          ov.querySelector('.safe').appendChild(el);
          labelEls.set(key, el);
        }
        (pos ? v.copy(pos) : v.copy(tg.pos).add(new THREE.Vector3(0, 3, 0))).project(camera);
        const x = (v.x * 0.5 + 0.5) * W - SAFE.left, y = (-v.y * 0.5 + 0.5) * H - SAFE.top;
        el.style.display = 'block';
        const wEl = el.offsetWidth, hEl = el.offsetHeight;
        const sw = W - SAFE.left - SAFE.right, sh = H - SAFE.top - SAFE.bottom;
        const cx = Math.min(sw - wEl / 2, Math.max(wEl / 2, x));
        let cy = Math.min(sh - 260, Math.max(hEl + 10, y - 30));
        // the two labels never cover each other: the second one moves below the first
        if (first && Math.abs(first.x - cx) < (first.w + wEl) / 2 && Math.abs(first.y - cy) < hEl + 6) cy = first.y + hEl + 8;
        first ??= { x: cx, y: cy, w: wEl };
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
      if (tg && tg.labels && ev.activeU > 0.08 && ev.activeU < 0.97) {
        banner.textContent = tg.banner || '';
        // when the caravan opens the video, the banner waits for the counter to leave the top of the frame
        banner.style.opacity = hook ? 0 : Math.max(0, Math.min(1, (ev.activeU - 0.08) * 6, (t - 2.2) * 6, (0.97 - ev.activeU) * 12));
        const sw = W - SAFE.left - SAFE.right, sh = H - SAFE.top - SAFE.bottom;
        const placed = [];
        const items = tg.labels.map((lb) => {
          v.copy(lb.pos).project(camera);
          return { lb, x: (v.x * 0.5 + 0.5) * W - SAFE.left, y: (-v.y * 0.5 + 0.5) * H - SAFE.top, z: v.z };
        }).filter((it) => it.z < 1 && it.x > -40 && it.x < sw + 40 && it.y > 130 && it.y < sh - 200).sort((a, b) => a.z - b.z);
        items.forEach((it, i) => {
          let el = tagEls[i];
          if (!el) { el = document.createElement('div'); el.className = 'tag'; ov.querySelector('.safe').appendChild(el); tagEls[i] = el; }
          el.innerHTML = `<div class="t">${esc(it.lb.title)}</div><div class="s">${esc(it.lb.sub || '')}</div>`;
          el.style.display = 'block';
          const wEl = el.offsetWidth, hEl = el.offsetHeight;
          const cx = Math.min(sw - wEl / 2, Math.max(wEl / 2, it.x));
          if (placed.some((p) => Math.abs(p.x - cx) < (p.w + wEl) / 2 - 6 && Math.abs(p.y - it.y) < hEl - 4)) { el.style.display = 'none'; return; }
          placed.push({ x: cx, y: it.y, w: wEl });
          el.style.left = `${cx}px`; el.style.top = `${it.y}px`;
          el.style.opacity = Math.min(1, (ev.activeU - 0.08) * 6, (0.97 - ev.activeU) * 12);
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

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
