// The Marrow Isles: 7 islands, 6 deliveries, 5 named regulars, 3 weather fronts.
// Everything is placed by hand and fixed; the seeded stream only scatters trees,
// clouds and the gusts, so the same seed always builds the same archipelago.
//
// Headings are radians, 0 = north (toward -z), turning clockwise. A strip's heading
// is the direction you land and take off in. Ring altitudes are metres above the sea.
import { WORLD } from './config.js';
import { createRandom, range } from './random.js';

/** The 7 islands, west to east, each with its strip, its village and its height. */
export const ISLANDS = [
  {
    name: 'Marrow', x: 800, z: 4200, radius: 720, height: 90,
    village: 'Marrow Town', strip: { x: 800, z: 4200, heading: 1.35, length: 520, width: 34 },
    note: 'Home strip. The Kestrel winters here.',
  },
  {
    name: 'Gull Rock', x: 2150, z: 3550, radius: 430, height: 130,
    village: 'Gull Rock', strip: { x: 2150, z: 3550, heading: 1.15, length: 420, width: 30 },
    note: 'A lighthouse rock with one short strip.',
  },
  {
    name: 'Tern Cay', x: 3350, z: 4450, radius: 520, height: 70,
    village: 'Tern Cay', strip: { x: 3350, z: 4450, heading: 0.55, length: 460, width: 30 },
    note: 'Low and green, ringed with white sand.',
  },
  {
    name: 'Saltwind', x: 4500, z: 3300, radius: 580, height: 110,
    village: 'Saltwind', strip: { x: 4500, z: 3300, heading: 1.75, length: 480, width: 32 },
    note: 'Salt pans and a ferry pier; the wind never stops.',
  },
  {
    name: 'Bramble Holm', x: 5550, z: 4500, radius: 490, height: 150,
    village: 'Bramble Holm', strip: { x: 5550, z: 4500, heading: 0.95, length: 440, width: 30 },
    note: 'Thick woods over a steep hill; mind the treetops.',
  },
  {
    name: "Widow's Tooth", x: 6500, z: 3350, radius: 390, height: 210,
    village: "Widow's Tooth", strip: { x: 6500, z: 3350, heading: 1.45, length: 400, width: 28 },
    note: 'A sharp peak with a strip cut into its shoulder.',
  },
  {
    name: 'Last Light', x: 7400, z: 4350, radius: 540, height: 120,
    village: 'Last Light', strip: { x: 7400, z: 4350, heading: 1.25, length: 500, width: 32 },
    note: 'The far light. Land here before the Grey Wall does.',
  },
];

/** The 5 named regulars waiting at the strips, one line of story each. */
export const REGULARS = [
  { name: 'Old Fen', island: 'Gull Rock', story: 'keeps the lighthouse lamp and counts every plane that ever landed here: eleven.' },
  { name: 'Sister Avel', island: 'Tern Cay', story: 'runs the island clinic from a whitewashed hut; the medicine is for her smallest patient.' },
  { name: 'Bram', island: 'Saltwind', story: 'ferryman for thirty years, never once flew — until his daughter turns nine today.' },
  { name: 'Nell', island: 'Bramble Holm', story: 'mends nets and engines alike; the magneto in your hold is the only one she trusts.' },
  { name: 'Keeper Ivo', island: "Widow's Tooth", story: 'lights the beacon every dusk alone, and has not missed a night in forty-one years.' },
];

/** The 6 deliveries, one per leg, in the order they fly. */
export const DELIVERIES = [
  { from: 'Marrow', to: 'Gull Rock', cargo: 'a bundle of letters', weight: 'light', goal: 'Land at Gull Rock before the light goes.' },
  { from: 'Gull Rock', to: 'Tern Cay', cargo: 'a cold-box of medicine', weight: 'precious', goal: 'Keep it level — the cold-box hates a hard bank.' },
  { from: 'Tern Cay', to: 'Saltwind', cargo: 'a birthday parcel', weight: 'light', goal: "Bram's daughter turns nine at dusk. Do not be late." },
  { from: 'Saltwind', to: 'Bramble Holm', cargo: 'an engine magneto', weight: 'heavy', goal: 'Heavy load: she climbs slow. Mind the treetops.' },
  { from: 'Bramble Holm', to: "Widow's Tooth", cargo: 'lamp oil for the beacon', weight: 'heavy', goal: 'The Tooth is steep and the strip is short. Come in slow.' },
  { from: "Widow's Tooth", to: 'Last Light', cargo: 'the storm warning', weight: 'light', goal: 'Outrun the Grey Wall. Land at Last Light before it closes.' },
];

/** Rings to thread on each leg: two or three per leg, at real altitudes the plane can hold. */
const RING_TABLE = [
  [{ x: 1450, z: 3900, alt: 170 }, { x: 1900, z: 3700, alt: 150 }],
  [{ x: 2700, z: 4000, alt: 160 }, { x: 3050, z: 4250, alt: 140 }],
  [{ x: 3950, z: 3900, alt: 180 }, { x: 4250, z: 3550, alt: 150 }],
  [{ x: 5000, z: 3900, alt: 170 }, { x: 5300, z: 4250, alt: 150 }],
  [{ x: 6000, z: 3950, alt: 190 }, { x: 6300, z: 3600, alt: 160 }],
  [{ x: 6900, z: 3850, alt: 180 }, { x: 7150, z: 4150, alt: 150 }],
];
export const RING_RADIUS = 42;

export const STORM = {
  // The Grey Wall marches in from the west: its leading edge starts off the map
  // and reaches Last Light as the storm clock runs out.
  startX: -600,
  endX: 7300,
  speedPerSecond: (7300 - -600) / 720,
};

/** Ground height in metres at (x, z): 0 over the sea, rising to each island's peak. */
export function groundHeightAt(x, z) {
  let height = 0;
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= island.radius) continue;
    const t = 1 - d / island.radius;
    // A smooth hill: flat beach at the rim, a rounded peak in the middle.
    const hill = island.height * (t * t * (3 - 2 * t));
    if (hill > height) height = hill;
  }
  // A strip is cut into a flat shelf, not a peak: within 340 m of a strip's
  // centreline the ground blends down to the strip's own elevation, so the
  // approach is a clear glide and the strip itself is level to land on.
  for (const island of ISLANDS) {
    const strip = island.strip;
    const dx = x - strip.x;
    const dz = z - strip.z;
    const sin = Math.sin(strip.heading);
    const cos = Math.cos(strip.heading);
    const along = dx * sin + dz * cos;
    const across = dx * cos - dz * sin;
    const d = Math.sqrt(Math.max(0, Math.abs(along) - strip.length / 2) ** 2 + across * across);
    if (d >= 340) continue;
    const k = 1 - d / 340;
    const blend = k * k * (3 - 2 * k);
    const shelf = stripElevation(island);
    height = height * (1 - blend) + shelf * blend;
  }
  return height;
}

/** The elevation of an island's strip shelf, in metres above the sea. */
export function stripElevation(island) {
  return island.height * 0.45;
}

/** The island whose land (x, z) stands on, or null over the sea. */
export function islandAt(x, z) {
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    if (Math.sqrt(dx * dx + dz * dz) < island.radius * 0.92) return island;
  }
  return null;
}

/** True when (x, z) is on the strip of `island` (a rectangle along its heading). */
export function onStrip(x, z, island) {
  const strip = island.strip;
  const dx = x - strip.x;
  const dz = z - strip.z;
  const sin = Math.sin(strip.heading);
  const cos = Math.cos(strip.heading);
  const along = dx * sin + dz * cos;
  const across = dx * cos - dz * sin;
  return Math.abs(along) <= strip.length / 2 && Math.abs(across) <= strip.width / 2;
}

/** Distance, in metres, from (x, z) to the strip centreline, along the strip. */
export function stripProgress(x, z, island) {
  const strip = island.strip;
  const dx = x - strip.x;
  const dz = z - strip.z;
  return dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading);
}

/** Build the whole world: islands, rings per leg, trees, clouds, gusts. Deterministic. */
export function createWorld(seed = WORLD.seed) {
  const random = createRandom(seed);
  const legs = DELIVERIES.map((delivery, index) => {
    const from = ISLANDS.find((island) => island.name === delivery.from);
    const to = ISLANDS.find((island) => island.name === delivery.to);
    return {
      index,
      delivery,
      from,
      to,
      rings: RING_TABLE[index].map((ring) => ({ ...ring, done: false, centred: false })),
      regular: REGULARS.find((regular) => regular.island === delivery.to) ?? null,
    };
  });

  // Trees: scattered on each island, kept clear of its strip.
  const trees = [];
  for (const island of ISLANDS) {
    const count = Math.round(island.radius / 22);
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const dist = Math.sqrt(random()) * island.radius * 0.88;
      const x = island.x + Math.cos(angle) * dist;
      const z = island.z + Math.sin(angle) * dist;
      if (onStrip(x, z, island)) continue;
      trees.push({ x, z, size: range(random, 5, 11), shade: random() });
    }
  }

  // Clouds: high golden-hour banks, plus the dark storm wall in the west.
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: range(random, 0, WORLD.width),
      z: range(random, 0, WORLD.height),
      alt: range(random, 320, 520),
      size: range(random, 120, 320),
      shade: random(),
    });
  }
  const stormClouds = [];
  for (let i = 0; i < 14; i += 1) {
    stormClouds.push({
      x: range(random, -500, 700),
      z: range(random, 0, WORLD.height),
      alt: range(random, 180, 420),
      size: range(random, 220, 460),
      shade: random(),
    });
  }

  // Gusts: the Salt Squall boils over the middle isles; strength varies slowly.
  const gusts = [];
  for (let i = 0; i < 40; i += 1) {
    gusts.push({
      x: range(random, 3000, 6000),
      z: range(random, 2800, 5000),
      radius: range(random, 260, 520),
      strength: range(random, 4, 11),
      phase: range(random, 0, Math.PI * 2),
    });
  }

  return { islands: ISLANDS, legs, trees, clouds, stormClouds, gusts, regulars: REGULARS };
}
