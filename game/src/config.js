// LAST LIGHT — The Marrow Run. Every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

// The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate.
export const STEP = 1 / 60;

// The world is a fixed archipelago, 8000 by 6000 metres, laid out by hand in world.js.
// Nothing about it is rolled at run time: the same seed always builds the same islands.
export const WORLD = { width: 8000, height: 6000, seed: 20261126 };

// The Kestrel, a single-engine bush plane. Speeds in metres per second, altitudes in metres.
export const PLANE = {
  minSpeed: 26, // below this the wing stops flying and she sinks
  cruiseSpeed: 58, // the speed a steady 65% throttle holds
  maxSpeed: 88, // full throttle, level, no wind
  takeoffSpeed: 34, // she lifts off the strip above this
  maxBankDeg: 38, // how far she will roll in a turn
  bankRateDeg: 95, // how fast the roll answers the stick
  pitchUpDeg: 11, // steepest climb the stick asks for
  pitchDownDeg: 13, // steepest descent the stick asks for
  climbRate: 9, // metres per second gained at full climb, at cruise speed
  fuelCapacity: 100, // one tank, filled at every strip
  fuelBurnIdle: 0.22, // units per second at closed throttle
  fuelBurnFull: 1.35, // units per second at full throttle
  damageHardLanding: 26, // a heavy touchdown costs this much of the airframe
  damageBrush: 12, // clipping a treetop or a mast costs this much
};

// The run: 6 deliveries across 7 islands, against a storm that closes the last strip.
// stormSeconds is the whole run's clock: the Grey Wall starts 600 m west of the
// chart and reaches Last Light (x = 7300) exactly as the clock runs out, so the
// wall's speed in world.js is derived from this number, never tuned separately.
export const RUN = {
  legs: 6,
  stormSeconds: 720, // twelve minutes of flying before the Grey Wall shuts Last Light
  ringPoints: 150, // flying clean through a ring
  ringCentreBonus: 50, // threading it dead centre
  deliveryPoints: 500, // a parcel handed over on the strip
  smoothLandingBonus: 120, // touching down gentle as a gull
  fuelBonusPerUnit: 4, // each unit of fuel left when a leg ends
  timeBonusPerSecond: 2, // each second still on the storm clock when the run ends
};

// The three weather fronts, named in the dossier and drawn in the sky.
export const FRONTS = [
  { name: 'The Grey Wall', kind: 'storm', description: 'a storm front closing in from the west' },
  { name: 'Salt Squall', kind: 'gusts', description: 'a gust band boiling over the middle isles' },
  { name: 'Dawn Fog', kind: 'fog', description: 'fog lying in the eastern valleys at first light' },
];

export const PALETTE = {
  skyTop: '#232c52',
  skyMid: '#7a5a7e',
  skyLow: '#f2a54a',
  horizonGlow: '#ffd98a',
  sunCore: '#fff3c4',
  sunGlow: '#ffb347',
  seaDeep: '#17394f',
  seaNear: '#2e6b7a',
  seaGlitter: '#ffd98a',
  sand: '#d9b77c',
  grass: '#4d7a3a',
  grassLight: '#6da24b',
  forest: '#2f5c2a',
  rock: '#6b5d4f',
  runway: '#3c3f45',
  runwayLine: '#f4f1e4',
  ring: '#ffc23d',
  ringGlow: '#ff9d00',
  panel: '#14181f',
  panelEdge: '#2c3442',
  text: '#f4efe2',
  muted: '#a8b0bd',
  good: '#7fd08a',
  warn: '#ffb347',
  bad: '#ff6b5e',
  stormCloud: '#2c2f3d',
  stormEdge: '#4a4e63',
  fog: '#e8e2d2',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best run is kept between visits (this browser only). */
export const BEST_KEY = 'last-light-marrow-run.best';
