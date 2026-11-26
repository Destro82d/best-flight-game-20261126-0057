// The screenshot scenes behind ?shot=cover|approach|touchdown|storm.
// Each one puts the Kestrel in a real, reachable state — parked on a strip or
// on a leg of the run — then flies the real rules forward for a fixed number
// of steps, steered by a simple autopilot (bank toward the next ring or strip,
// pitch to hold the glide, throttle to hold speed). The frame is what a short
// stretch of real play looks like, and the same seed always gives the same frame.
import { STEP } from './config.js';
import { stripElevation } from './world.js';
import { SCREEN_PLAY } from './render.js';

const SAMPLE = STEP;

/** Steer toward (x, z) at `targetAlt`, holding `targetSpeed`. */
function autopilot(flight, targetX, targetZ, targetAlt, targetSpeed) {
  const plane = flight.state.plane;
  const dx = targetX - plane.x;
  const dz = targetZ - plane.z;
  const wantedHeading = Math.atan2(dx, dz);
  let error = wantedHeading - plane.heading;
  while (error > Math.PI) error -= Math.PI * 2;
  while (error < -Math.PI) error += Math.PI * 2;
  const bank = Math.max(-1, Math.min(1, error * 1.4));
  const altError = targetAlt - plane.altitude;
  // Gentle on the stick: a hard pull only ever dives her at the next ring.
  const pitch = Math.max(-0.6, Math.min(0.6, altError * 0.03));
  const throttle = Math.max(0, Math.min(1, 0.35 + (targetSpeed - plane.speed) * 0.03));
  return { bank, pitch, throttle, brake: false };
}

function placePlane(flight, x, z, heading, altitude, speed, throttle) {
  const plane = flight.state.plane;
  plane.x = x;
  plane.z = z;
  plane.heading = heading;
  plane.altitude = altitude;
  plane.speed = speed;
  plane.throttle = throttle;
  plane.bank = 0;
  plane.pitch = 0;
  plane.verticalSpeed = 0;
  plane.airborne = true;
  plane.onGround = false;
  plane.fuel = 62;
}

/** Run the autopilot for `seconds` toward a target that follows the leg. */
function flyFor(flight, seconds, pickTarget) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const target = pickTarget(flight);
    if (target === null) break;
    const events = flight.step(autopilot(flight, target.x, target.z, target.alt, target.speed), SAMPLE);
    if (flight.state.over || flight.state.legComplete) break;
  }
}

/**
 * Set the flight to the named scene and return the screen to draw over it.
 * cover: mid-leg over the middle isles, a ring ahead in golden light.
 * approach: on final to Saltwind, the strip filling the frame.
 * touchdown: flaring over Bramble Holm, instruments lit, wheels almost down.
 * storm: the last leg, the Grey Wall hard on the Kestrel's tail.
 */
export function stageShot(name, flight) {
  const world = flight.state.world;
  if (name === 'approach') {
    flight.startLeg(2);
    const strip = world.islands[3].strip;
    const shelf = stripElevation(world.islands[3]);
    const sin = Math.sin(strip.heading);
    const cos = Math.cos(strip.heading);
    placePlane(
      flight,
      strip.x - sin * 1150, strip.z - cos * 1150,
      strip.heading, shelf + 82, 55, 0.55,
    );
    flyFor(flight, 8, (f) => {
      const to = f.currentLeg().to;
      const dx = to.strip.x - f.state.plane.x;
      const dz = to.strip.z - f.state.plane.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      return { x: to.strip.x, z: to.strip.z, alt: stripElevation(to) + 2 + dist * 0.07, speed: 50 };
    });
  } else if (name === 'touchdown') {
    flight.startLeg(3);
    const strip = world.islands[4].strip;
    const shelf = stripElevation(world.islands[4]);
    const sin = Math.sin(strip.heading);
    const cos = Math.cos(strip.heading);
    placePlane(
      flight,
      strip.x - sin * 620, strip.z - cos * 620,
      strip.heading, shelf + 39, 46, 0.32,
    );
    flyFor(flight, 9, (f) => {
      const to = f.currentLeg().to;
      const dx = to.strip.x - f.state.plane.x;
      const dz = to.strip.z - f.state.plane.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      return { x: to.strip.x, z: to.strip.z, alt: stripElevation(to) + 2 + dist * 0.06, speed: 44 };
    });
  } else if (name === 'storm') {
    flight.startLeg(5);
    flight.state.stormLeft = 75;
    // Start on the ring's own altitude so she flies level into it, 400 m out.
    const ring = flight.currentLeg().rings[0];
    const heading = Math.atan2(ring.x - 6542, ring.z - 3672);
    placePlane(flight, 6542, 3672, heading, ring.alt, 58, 0.68);
    flyFor(flight, 4, (f) => {
      const next = f.currentLeg().rings.find((r) => !r.done);
      if (next) return { x: next.x, z: next.z, alt: next.alt, speed: 58 };
      const to = f.currentLeg().to;
      return { x: to.strip.x, z: to.strip.z, alt: stripElevation(to) + 40, speed: 52 };
    });
  } else {
    // cover: the second leg, a ring ahead over Tern Cay's green water.
    // Start 500 m out so the ring reads at a glance, not swallowed whole.
    flight.startLeg(1);
    const ring = flight.currentLeg().rings[0];
    const heading = Math.atan2(ring.x - 2206, ring.z - 3925);
    placePlane(flight, 2206, 3925, heading, 168, 58, 0.65);
    flyFor(flight, 4, (f) => {
      const next = f.currentLeg().rings.find((r) => !r.done);
      if (next) return { x: next.x, z: next.z, alt: next.alt, speed: 58 };
      const to = f.currentLeg().to;
      return { x: to.strip.x, z: to.strip.z, alt: 60, speed: 52 };
    });
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
