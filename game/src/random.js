// A small seeded random number generator (mulberry32): the same seed gives the same
// scatter of trees, clouds and gusts, which is what makes the world and the screenshot
// scenes repeatable. The world layout itself is hand-placed in world.js; this only
// decorates it, so a seed never moves an island, a strip or a ring.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value in [min, max) from the seeded stream. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one entry of `list` from the seeded stream. An empty list picks nothing. */
export function pick(random, list) {
  if (list.length === 0) return undefined;
  return list[Math.floor(random() * list.length)];
}
