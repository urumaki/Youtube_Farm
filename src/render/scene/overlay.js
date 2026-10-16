// DOM overlay (counter, labels, captions, goal, CTA). Everything stays inside the platform safe zone:
// no key text in the top 220 px, the bottom 380 px or the right 160 px of the 1080x1920 frame.
import * as THREE from 'three';

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
#ov .pin{position:absolute;width:4px;background:#e3b23c;transform:translateX(-50%)}
#ov .goal{position:absolute;left:20px;right:20px;top:330px;text-align:center;font-weight:800;font-size:48px;line-height:1.2;text-shadow:0 3px 14px rgba(0,0,0,.9)}
#ov .goal b{color:#e3b23c}
#ov .bar{margin:22px auto 0;width:640px;height:22px;border-radius:12px;background:rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.6);overflow:hidden}
#ov .bar i{display:block;height:100%;background:linear-gradient(90deg,#b8862a,#ffe08a)}
#ov .cta{position:absolute;left:0;right:0;top:380px;text-align:center}
#ov .cta .big{font-family:'Cinzel',serif;font-weight:700;font-size:74px;line-height:1.1;color:#fff4d6;text-shadow:0 5px 0 #6b4a12,0 8px 26px rgba(0,0,0,.8)}
#ov .cta .btn{display:inline-block;margin-top:34px;padding:22px 54px;border-radius:60px;background:#c4302b;font-weight:800;font-size:52px;letter-spacing:2px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
#ov .day{position:absolute;left:0;top:0;font-weight:700;font-size:30px;color:#fff;opacity:.92;text-shadow:0 2px 8px rgba(0,0,0,.9)}
#ov .cap{position:absolute;left:0;right:0;bottom:30px;text-align:center}
#ov .cap span{display:inline-block;margin:0 8px;font-weight:900;font-size:64px;line-height:1.15;color:#fff;text-shadow:0 0 6px #000,0 4px 0 #000,0 6px 18px rgba(0,0,0,.9);-webkit-text-stroke:2px #000}
#ov .cap span.on{color:#ffd35a}
`;

const STR = {
  en: { villagers: 'VILLAGERS', villager: 'VILLAGER', day: 'Day', more: (n) => `+${n} more homes`, until: (n, g) => `<b>${n}</b> more villager${n === 1 ? '' : 's'} until <b>${g}</b>`, cta1: 'Subscribe to', cta2: 'become a villager', btn: 'SUBSCRIBE', realm: 'SUBSCRIBER KINGDOM', weather: { clear: 'Clear skies', cloudy: 'Cloudy', fog: 'Fog', rain: 'Rain', snow: 'Snow' }, none: 'No change today' },
  it: { villagers: 'ABITANTI', villager: 'ABITANTE', day: 'Giorno', more: (n) => `+${n} altre case`, until: (n, g) => `Ancora <b>${n}</b> abitant${n === 1 ? 'e' : 'i'} e <b>${g}</b>`, cta1: 'Iscriviti per', cta2: 'diventare un abitante', btn: 'ISCRIVITI', realm: 'SUBSCRIBER KINGDOM', weather: { clear: 'Sereno', cloudy: 'Nuvoloso', fog: 'Nebbia', rain: 'Pioggia', snow: 'Neve' }, none: 'Nessun cambiamento oggi' },
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
    <div class="cta"><div class="big">${s.cta1}<br>${s.cta2}</div><div class="btn">${s.btn}</div></div>
    <div class="cap"></div>
  </div>`;
  root.appendChild(ov);
  const $ = (q) => ov.querySelector(q);
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
      goal.style.opacity = wide && diff.next ? Math.min(1, (t - 22.4) * 3) : 0;
      goal.style.top = '420px';
      cta.style.opacity = ctaOn ? Math.min(1, (t - 27) * 4) : 0;
      // labels for the active target, projected and clamped to the safe zone
      for (const [, el] of labelEls) el.style.display = 'none';
      const tg = ev.active;
      if (tg && tg.label && ev.activeU > 0.12 && ev.activeU < 0.97) {
        let el = labelEls.get(tg);
        if (!el) {
          el = document.createElement('div');
          el.className = 'label' + (tg.kind === 'loss' ? ' loss' : '');
          el.innerHTML = `<div class="t">${esc(tg.label.title)}</div>${tg.label.sub ? `<div class="s">${esc(tg.label.sub)}</div>` : ''}${tg.extra ? `<div class="more">${s.more(tg.extra)}</div>` : ''}`;
          ov.querySelector('.safe').appendChild(el);
          labelEls.set(tg, el);
        }
        (tg.labelPos ? v.copy(tg.labelPos) : v.copy(tg.pos).add(new THREE.Vector3(0, 3, 0))).project(camera);
        const x = (v.x * 0.5 + 0.5) * W - SAFE.left, y = (-v.y * 0.5 + 0.5) * H - SAFE.top;
        el.style.display = 'block';
        const wEl = el.offsetWidth, hEl = el.offsetHeight;
        const sw = W - SAFE.left - SAFE.right, sh = H - SAFE.top - SAFE.bottom;
        const cx = Math.min(sw - wEl / 2, Math.max(wEl / 2, x));
        const cy = Math.min(sh - 260, Math.max(hEl + 10, y - 30));
        el.style.left = `${cx}px`; el.style.top = `${cy}px`;
        el.style.opacity = Math.min(1, (ev.activeU - 0.12) * 8, (0.97 - ev.activeU) * 12);
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
