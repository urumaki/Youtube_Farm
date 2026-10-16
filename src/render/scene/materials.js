// Shared materials. Glow materials (windows, flames) are driven by a single `night` uniform (0 = day, 1 = night).
import * as THREE from 'three';
import {
  stoneTextures, roofTexture, thatchTexture, plasterTexture, woodTexture, cobbleTexture, cropTexture,
  armsTexture, bannerTexture, signTexture, ROYAL,
} from './textures.js';

export function makeMaterials(seed) {
  const stone = stoneTextures(seed);
  const stoneDark = stoneTextures(seed + 1, [118, 112, 104]);
  const roof = roofTexture(seed);
  const night = { value: 0 };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });

  const glow = (dayColor, nightColor, strength = 1) => {
    const m = new THREE.MeshBasicMaterial({ color: dayColor });
    const day = new THREE.Color(dayColor), nite = new THREE.Color(nightColor).multiplyScalar(strength);
    m.userData.update = (n) => m.color.copy(day).lerp(nite, n);
    return m;
  };

  const M = {
    night,
    stone: std({ map: stone.map, bumpMap: stone.bump, bumpScale: 1.2, color: '#d8d2c4' }),
    stoneDark: std({ map: stoneDark.map, bumpMap: stoneDark.bump, bumpScale: 1.2, color: '#b8b2a6' }),
    slate: std({ map: roof, color: '#5a6170', roughness: 0.7 }),
    roofRed: std({ map: roof, color: '#9c4a32', roughness: 0.8 }),
    roofTile: std({ map: roof, roughness: 0.8 }), // tinted per instance
    thatch: std({ map: thatchTexture(seed), color: '#c9b07a' }),
    plaster: std({ map: plasterTexture(seed, false), color: '#e6dcc8' }),
    timber: std({ map: plasterTexture(seed, true), color: '#efe6d4' }),
    wood: std({ map: woodTexture(seed), color: '#b08a66' }),
    woodDark: std({ map: woodTexture(seed + 2), color: '#6e5440' }),
    iron: std({ color: '#2b2b2e', roughness: 0.45, metalness: 0.8 }),
    gold: std({ color: ROYAL.gold, roughness: 0.3, metalness: 0.9 }),
    cobble: std({ map: cobbleTexture(seed), color: '#cfc6b6' }),
    crop: std({ map: cropTexture(seed), roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    hay: std({ map: thatchTexture(seed + 5), color: '#e0c27a' }),
    cloth: std({ map: bannerTexture(), side: THREE.DoubleSide, roughness: 0.85 }),
    clothRed: std({ color: ROYAL.crimson, side: THREE.DoubleSide }),
    clothBlue: std({ color: ROYAL.blue, side: THREE.DoubleSide }),
    clothIvory: std({ color: ROYAL.ivory, side: THREE.DoubleSide }),
    arms: std({ map: armsTexture(), transparent: true, alphaTest: 0.5, roughness: 0.6, metalness: 0.2 }),
    sign: (() => { const t = signTexture(); return std({ map: t, emissiveMap: t, roughness: 0.55, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.12 }); })(),
    window: glow('#1d2026', '#ffb357', 1.6),
    windowWarm: glow('#262019', '#ff9a3c', 1.8),
    stained: glow('#3a2a4a', '#ffcf7a', 2.0),
    flame: glow('#ffb04a', '#ffc25c', 2.6),
    ember: glow('#7a2a10', '#ff6a1c', 2.2),
    lamp: glow('#c9b48a', '#ffd27a', 2.4),
    foliage: std({ roughness: 0.85, vertexColors: false }),
    trunk: std({ color: '#5a4030' }),
    rock: std({ map: stone.map, color: '#a09a90' }),
    dirt: std({ color: '#7a6448' }),
    rubble: std({ map: stoneDark.map, color: '#8a857c' }),
    people: std({ roughness: 0.8 }),
    skin: std({ color: '#e0b48f', roughness: 0.7 }),
    sail: std({ color: '#efe6cf', side: THREE.DoubleSide }),
  };
  M.glows = [M.window, M.windowWarm, M.stained, M.flame, M.ember, M.lamp];
  M.setNight = (n) => {
    night.value = n;
    for (const g of M.glows) g.userData.update(n);
    M.sign.emissiveIntensity = 0.12 + 0.35 * n;
  };
  for (const g of M.glows) g.userData.noShadow = true;
  return M;
}
