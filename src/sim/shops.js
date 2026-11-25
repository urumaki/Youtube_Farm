// Shops (owner 2026-11-25): the trades with no workplace of their own work at shop fronts on their houses, several shops for
// a big trade, each with a number of workers that fits it (SHOP_SIZE). A trade's villagers, in index order, make groups of
// SHOP_SIZE; a group's shop is on the house of its first member whose house stands occupied and has no other shop. The first
// tax group works at the Counting House's counter. Worked out from the state when it is needed: nothing is saved, so a new
// shop opens as a trade grows past a multiple of its size. Pure: no three.js (render: shopfronts.js, houses.js, main.js).

export const SHOP_SIZE = { carpenter: 5, taxcollector: 4, cook: 3, barber: 1, brewer: 2, weaver: 2 };
// the scenes done at the shop (null: the job's base scene); a trade not listed does every scene there
export const SHOP_SCENES = { carpenter: [null, 'bench', 'saw'], taxcollector: ['counting'], cook: ['cauldron'], brewer: ['stir'] };
export const COUNTING_HOUSE = 'counting_house';

const cache = new WeakMap();

/** Every shop: [{ job, k (the group's number in its trade), house (a house id, or COUNTING_HOUSE), members: [villager ids] }]. */
export function shopsOf(state) {
  if (cache.has(state)) return cache.get(state);
  const free = new Map((state.houses || []).map((h) => [h.id, h.status === 'occupied']));
  const byJob = {};
  const villagers = (state.villagers || []).slice(0, state.subscriberCount ?? Infinity);
  villagers.forEach((v, id) => { if (v && SHOP_SIZE[v.job]) (byJob[v.job] ??= []).push(id); });
  const taken = new Set(), out = [];
  for (const job of Object.keys(SHOP_SIZE)) {
    const ids = byJob[job] || [];
    for (let k = 0; k * SHOP_SIZE[job] < ids.length; k++) {
      const members = ids.slice(k * SHOP_SIZE[job], (k + 1) * SHOP_SIZE[job]);
      let house = null;
      if (job === 'taxcollector' && k === 0) house = COUNTING_HOUSE;
      else for (const id of members) {
        const h = villagers[id].house;
        if (free.get(h) && !taken.has(h)) { house = h; break; }
      }
      if (house === null) continue;
      if (house !== COUNTING_HOUSE) taken.add(house);
      out.push({ job, k, house, members });
    }
  }
  cache.set(state, out);
  return out;
}

/** The shop villager `id` works at in scene `variant` ({ job, k, house }), or null. */
export function shopOf(state, id, variant = null) {
  const shop = shopsOf(state).find((s) => s.members.includes(id));
  if (!shop) return null;
  const scenes = SHOP_SCENES[shop.job];
  if (scenes && !scenes.includes(variant ?? null)) return null;
  return { job: shop.job, k: shop.k, house: shop.house };
}
