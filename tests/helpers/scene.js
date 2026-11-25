// Work scenes built under Node for the tests (no browser): any material the scene asks for is a plain MeshStandardMaterial.
import * as THREE from 'three';
import { buildWorkScene } from '../../src/render/scene/work.js';

export function fakeMaterials() {
  const cache = new Map();
  return new Proxy({}, {
    get(_, key) {
      if (typeof key !== 'string') return undefined;
      if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color: '#888888' }));
      return cache.get(key);
    },
  });
}

const M = fakeMaterials();

/** A work scene at the origin, facing +z, seed 7, villager id 1 (or `opts.id`); `opts` go to buildWorkScene. */
export function workScene(job, variant = null, opts = {}) {
  return buildWorkScene({ job, variant, anchor: new THREE.Vector3(0, 0, 0), face: 0, M, seed: 7, id: 1, ...opts });
}

/** A work scene with what surrounds it when that is built apart (the bakehouse round the baker): { ws, env: [Object3D] }. */
export async function checkScene(job, variant = null, opts = {}) {
  const { buildBakehouse, BAKEHOUSE_VARIANTS } = await import('../../src/render/scene/bakery.js');
  if (job === 'baker' && BAKEHOUSE_VARIANTS.has(variant)) {
    const bh = buildBakehouse({ variant, anchor: new THREE.Vector3(0, 0, 0), away: Math.PI / 2, M, seed: 7, id: opts.id ?? 1, heightAt: () => 0 });
    return { ws: bh, env: [bh.room] };
  }
  return { ws: workScene(job, variant, opts), env: [] };
}
