// Procedural canvas textures and the Subscriber Kingdom heraldry. Deterministic (seeded), no image files.
import * as THREE from 'three';
import { rng } from '../../sim/prng.js';

export const ROYAL = {
  blue: '#1d2f6f',
  blueDark: '#121d47',
  gold: '#e3b23c',
  goldDeep: '#b8862a',
  crimson: '#9b1b30',
  ivory: '#f3ead2',
};

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = 1, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function speckle(ctx, w, h, r, n, alpha, light = false) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${r.float(0, alpha)})`;
    ctx.fillRect(r.float(0, w), r.float(0, h), r.float(1, 3), r.float(1, 3));
  }
}

/** Ashlar stonework: color map + bump map. Blocks ~0.5 x 0.3 of the tile. */
export function stoneTextures(seed, base = [150, 144, 132], { rows = 8, bw0 = 48, bw1 = 96, mortar = 'rgb(92,88,80)' } = {}) {
  const r = rng(seed, 'stone');
  const S = 512;
  const [c, ctx] = canvas(S);
  const [b, bctx] = canvas(S);
  ctx.fillStyle = mortar; ctx.fillRect(0, 0, S, S);
  bctx.fillStyle = '#000'; bctx.fillRect(0, 0, S, S);
  const rh = S / rows;
  for (let y = 0; y < rows; y++) {
    let x = y % 2 ? -r.float(bw0 * 0.4, bw0 * 1.2) : 0;
    while (x < S) {
      const bw = r.float(bw0, bw1);
      const k = r.float(-22, 18);
      const warm = r.float(-8, 8);
      ctx.fillStyle = `rgb(${base[0] + k + warm},${base[1] + k},${base[2] + k - warm})`;
      ctx.fillRect(x + 2, y * rh + 2, bw - 4, rh - 4);
      const g = bctx.createLinearGradient(0, y * rh, 0, y * rh + rh);
      const hi = 170 + r.float(-30, 40);
      g.addColorStop(0, `rgb(${hi},${hi},${hi})`); g.addColorStop(1, `rgb(${hi - 50},${hi - 50},${hi - 50})`);
      bctx.fillStyle = g;
      bctx.fillRect(x + 3, y * rh + 3, bw - 6, rh - 6);
      // wrap horizontally
      if (x + bw > S) { ctx.fillRect(x + 2 - S, y * rh + 2, bw - 4, rh - 4); bctx.fillRect(x + 3 - S, y * rh + 3, bw - 6, rh - 6); }
      x += bw;
    }
  }
  speckle(ctx, S, S, r, 9000, 0.18);
  speckle(ctx, S, S, r, 4000, 0.12, true);
  // moss and weathering streaks
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(70,90,40,${r.float(0.04, 0.12)})`;
    ctx.beginPath(); ctx.ellipse(r.float(0, S), r.float(S * 0.6, S), r.float(10, 50), r.float(4, 14), 0, 0, 7); ctx.fill();
  }
  return { map: tex(c), bump: tex(b, { srgb: false }) };
}

/** Clay / slate roof tiles in grayscale so instance colors can tint them. */
export function roofTexture(seed) {
  const r = rng(seed, 'roof');
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, S, S);
  const rows = 12, rh = S / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = (y % 2) * 10; x < S + 20; x += 20) {
      const v = 190 + r.float(-35, 35);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.roundRect(x - 9, y * rh, 18, rh + 2, [0, 0, 7, 7]);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - 9, y * rh + rh - 2, 18, 2);
    }
  }
  speckle(ctx, S, S, r, 2500, 0.15);
  return tex(c);
}

/** Thatch straw (grayscale-ish, warm). */
export function thatchTexture(seed) {
  const r = rng(seed, 'thatch');
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#b8a070'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 3500; i++) {
    const v = r.float(120, 220);
    ctx.strokeStyle = `rgba(${v},${v * 0.86},${v * 0.6},0.6)`;
    const x = r.float(0, S), y = r.float(0, S);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r.float(-2, 2), y + r.float(8, 22)); ctx.stroke();
  }
  return tex(c);
}

/** Plaster wall with a timber frame overlay (light, tinted per instance). */
export function plasterTexture(seed, timber) {
  const r = rng(seed, 'plaster', timber ? 1 : 0);
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#e9e2d0'; ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, r, 5000, 0.08);
  for (let i = 0; i < 25; i++) {
    ctx.fillStyle = `rgba(120,100,70,${r.float(0.02, 0.07)})`;
    ctx.beginPath(); ctx.ellipse(r.float(0, S), r.float(0, S), r.float(8, 40), r.float(6, 30), 0, 0, 7); ctx.fill();
  }
  if (timber) {
    ctx.fillStyle = '#4a3322';
    const beam = 12;
    ctx.fillRect(0, 0, S, beam); ctx.fillRect(0, S / 2 - beam / 2, S, beam); ctx.fillRect(0, S - beam, S, beam);
    for (const x of [0, S / 2 - beam / 2, S - beam]) ctx.fillRect(x, 0, beam, S);
    ctx.lineWidth = beam * 0.8; ctx.strokeStyle = '#4a3322';
    ctx.beginPath(); ctx.moveTo(beam, S / 2); ctx.lineTo(S / 2 - beam, beam); ctx.moveTo(S / 2 + beam, S / 2); ctx.lineTo(S - beam, S - beam); ctx.stroke();
  }
  return tex(c);
}

export function woodTexture(seed) {
  const r = rng(seed, 'wood');
  const S = 256;
  const [c, ctx] = canvas(S);
  for (let y = 0; y < S; y += 32) {
    const v = r.float(-18, 18);
    ctx.fillStyle = `rgb(${120 + v},${84 + v},${52 + v})`;
    ctx.fillRect(0, y, S, 31);
    ctx.fillStyle = 'rgba(30,18,8,0.8)'; ctx.fillRect(0, y + 31, S, 1);
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = `rgba(50,30,15,${r.float(0.1, 0.3)})`;
      const yy = y + r.float(2, 29);
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(S / 3, yy + r.float(-3, 3), (2 * S) / 3, yy + r.float(-3, 3), S, yy); ctx.stroke();
    }
  }
  return tex(c);
}

export function cobbleTexture(seed) {
  const r = rng(seed, 'cobble');
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#5d564c'; ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 16) {
    for (let x = (y / 16) % 2 ? 8 : 0; x < S + 16; x += 16) {
      const v = 125 + r.float(-25, 25);
      ctx.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
      ctx.beginPath(); ctx.roundRect(x - 7 + r.float(-1, 1), y + 1, 14, 14, 4); ctx.fill();
    }
  }
  speckle(ctx, S, S, r, 2000, 0.15);
  return tex(c);
}

/** Small tileable grayscale noise for terrain detail. */
export function detailTexture(seed) {
  const r = rng(seed, 'detail');
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    const v = r.float(70, 190);
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    const x = r.float(0, S), y = r.float(0, S);
    ctx.fillRect(x, y, r.float(1, 2.5), r.float(2, 5));
  }
  return tex(c, { srgb: false });
}

/** Crop rows for fields (tinted per field: green, golden, brown). */
export function cropTexture(seed) {
  const r = rng(seed, 'crop');
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#7d6a48'; ctx.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 16) {
    ctx.fillStyle = '#d8d0b0';
    ctx.fillRect(x + 3, 0, 10, S);
    for (let i = 0; i < 80; i++) {
      const v = r.float(150, 255);
      ctx.fillStyle = `rgba(${v},${v},${v * 0.85},0.7)`;
      ctx.fillRect(x + r.float(2, 13), r.float(0, S), 2, r.float(3, 8));
    }
  }
  return tex(c);
}

export function softSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function cloudSprite(seed) {
  const r = rng(seed, 'cloud');
  const [c, ctx] = canvas(256, 128);
  for (let i = 0; i < 26; i++) {
    const x = r.float(50, 206), y = r.float(50, 85), rad = r.float(18, 42);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- heraldry
/**
 * The arms of Subscriber Kingdom: "the Crown of Many".
 * Azure, a crown Or whose five points end in heads (each villager crowns the realm),
 * above a pyramid of ten bezants (the gathering crowd), within a bordure Or.
 * Motto: EX MULTIS UNUM REGNUM — "from many, one kingdom".
 */
export function drawArms(ctx, x, y, w, h) {
  const shield = new Path2D();
  shield.moveTo(x, y);
  shield.lineTo(x + w, y);
  shield.lineTo(x + w, y + h * 0.55);
  shield.quadraticCurveTo(x + w, y + h * 0.85, x + w / 2, y + h);
  shield.quadraticCurveTo(x, y + h * 0.85, x, y + h * 0.55);
  shield.closePath();
  ctx.save();
  ctx.fillStyle = ROYAL.gold; ctx.fill(shield);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(0.88, 0.9); ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.fillStyle = ROYAL.blue; ctx.fill(shield);
  ctx.restore();
  ctx.clip(shield);
  // crown of many
  const cx = x + w / 2, cy = y + h * 0.36, cw = w * 0.56, ch = h * 0.17;
  ctx.fillStyle = ROYAL.gold;
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2, cy + ch / 2);
  const pts = 5;
  for (let i = 0; i <= pts * 2; i++) {
    const px = cx - cw / 2 + (cw * i) / (pts * 2);
    const py = i % 2 === 0 ? cy - ch / 2 : cy + ch * 0.1;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(cx + cw / 2, cy + ch / 2);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(cx - cw / 2, cy + ch * 0.45, cw, ch * 0.32);
  for (let i = 0; i <= pts; i++) {
    ctx.beginPath(); ctx.arc(cx - cw / 2 + (cw * i) / pts, cy - ch / 2 - w * 0.03, w * 0.032, 0, 7); ctx.fill();
  }
  ctx.fillStyle = ROYAL.crimson;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - cw * 0.25 + i * cw * 0.25, cy + ch * 0.61, w * 0.02, 0, 7); ctx.fill(); }
  // the crowd: a pyramid of ten bezants
  ctx.fillStyle = ROYAL.gold;
  const br = w * 0.045, top = y + h * 0.56;
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k <= row; k++) {
      const bx = cx + (k - row / 2) * br * 2.5;
      ctx.beginPath(); ctx.arc(bx, top + row * br * 2.3, br, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
  ctx.lineWidth = Math.max(2, w * 0.02); ctx.strokeStyle = '#2a1a08'; ctx.stroke(shield);
}

export function armsTexture(size = 512) {
  const [c, ctx] = canvas(size, Math.round(size * 1.2));
  drawArms(ctx, size * 0.05, size * 0.05, size * 0.9, size * 1.1);
  return tex(c, { repeat: 1 });
}

/** Banner cloth: royal blue with the arms, crimson swallowtail edge, gold trim. */
export function bannerTexture() {
  const W = 256, H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = ROYAL.blue; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ROYAL.crimson; ctx.fillRect(0, H * 0.82, W, H * 0.18);
  ctx.fillStyle = ROYAL.gold; ctx.fillRect(0, 0, W, 10); ctx.fillRect(0, H * 0.82 - 6, W, 6);
  ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H);
  drawArms(ctx, W * 0.16, H * 0.12, W * 0.68, H * 0.58);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** The gate sign: carved board with gold letters. */
export function signTexture(text = 'SUBSCRIBER KINGDOM') {
  const W = 2048, H = 256;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a2414'); g.addColorStop(1, '#22140a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ROYAL.gold; ctx.lineWidth = 10; ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.font = '700 150px Cinzel, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#120a04'; ctx.fillText(text, W / 2 + 5, H / 2 + 11);
  const tg = ctx.createLinearGradient(0, 40, 0, 210);
  tg.addColorStop(0, '#ffe9a8'); tg.addColorStop(0.5, ROYAL.gold); tg.addColorStop(1, ROYAL.goldDeep);
  ctx.fillStyle = tg; ctx.fillText(text, W / 2, H / 2 + 6);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function awningTexture(colorA, colorB) {
  const [c, ctx] = canvas(64, 64);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? colorA : colorB; ctx.fillRect(i * 8, 0, 8, 64); }
  return tex(c);
}
