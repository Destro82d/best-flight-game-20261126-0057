// The Kestrel herself: throttle, bank, pitch, fuel, damage, landings and rings.
// No drawing here and no browser in it — step() advances one fixed step and returns
// what happened as bit flags, so the caller can react without the flight model
// knowing about screens or sound. Angles in radians, speeds in m/s, heights in m.
import { PLANE, RUN, STEP } from './config.js';
import { RING_RADIUS, groundHeightAt, islandAt, onStrip, stripProgress } from './world.js';

export const EVENT_RING = 1;
export const EVENT_RING_CENTRE = 2;
export const EVENT_LANDED = 4;
export const EVENT_HARD_LANDING = 8;
export const EVENT_CRASH = 16;
export const EVENT_DITCHED = 32;
export const EVENT_FUEL_EMPTY = 64;
export const EVENT_TAKEOFF = 128;

const DEG = Math.PI / 180;
const GRAVITY = 9.81;

function clamp(value, min, max) {
  return value < min ? min : value > max ? value : value;
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** A fresh plane, parked on the strip of `island`, nose down the runway. */
export function createPlane(island) {
  return {
    x: island.strip.x - Math.sin(island.strip.heading) * (island.strip.length / 2 - 30),
    z: island.strip.z - Math.cos(island.strip.heading) * (island.strip.length / 2 - 30),
    heading: island.strip.heading,
    altitude: groundHeightAt(island.strip.x, island.strip.z) + 2,
    speed: 0,
    throttle: 0,
    bank: 0,
    pitch: 0,
    verticalSpeed: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    airborne: false,
    onGround: true,
    groundSpeed: 0,
  };
}

export function createFlight(world) {
  const state = {
    world,
    legIndex: 0,
    plane: createPlane(world.islands[0]),
    score: 0,
    feats: [],
    stormLeft: RUN.stormSeconds,
    elapsed: 0,
    delivered: 0,
    ringsHit: 0,
    ringsCentred: 0,
    smoothLandings: 0,
    hardLandings: 0,
    over: false,
    overReason: '',
    legComplete: false,
    legScore: 0,
    message: '',
    messageTime: 0,
  };

  function currentLeg() {
    return state.world.legs[state.legIndex];
  }

  function addFeat(text) {
    if (!state.feats.includes(text)) state.feats.push(text);
  }

  /** Set the plane down on a strip at the start of a leg (after a delivery). */
  function parkAt(island) {
    const plane = createPlane(island);
    plane.fuel = PLANE.fuelCapacity;
    state.plane = plane;
  }

  function startLeg(index) {
    state.legIndex = index;
    state.legComplete = false;
    state.legScore = 0;
    const leg = currentLeg();
    for (const ring of leg.rings) {
      ring.done = false;
      ring.centred = false;
    }
    parkAt(leg.from);
    state.message = `Leg ${index + 1} of 6 — ${leg.delivery.cargo} to ${leg.delivery.to}`;
    state.messageTime = 5;
  }

  /** Wind at (x, z, t): a steady westerly near the storm plus the Salt Squall gusts. */
  function windAt(x, z, t) {
    let wx = 0;
    let wz = 0;
    // The Grey Wall pushes air ahead of itself: a westerly that grows as it nears.
    const wallX = -600 + (RUN.stormSeconds - state.stormLeft) * ((7300 - -600) / RUN.stormSeconds);
    const distToWall = x - wallX;
    if (distToWall > 0 && distToWall < 2600) wx += 3.5 * (1 - distToWall / 2600);
    for (const gust of state.world.gusts) {
      const dx = x - gust.x;
      const dz = z - gust.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d >= gust.radius) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.7 + gust.phase);
      const strength = gust.strength * pulse * (1 - d / gust.radius);
      wx += strength * 0.6;
      wz += strength * 0.8 * Math.sin(gust.phase + t * 0.3);
    }
    return { x: wx, z: wz };
  }

  /**
   * One fixed step. `input` is { bank: -1..1, pitch: -1..1, throttle: 0..1, brake }.
   * Returns bit flags of what happened this step.
   */
  function step(input, dt = STEP) {
    if (state.over || state.legComplete) return 0;
    let events = 0;
    const plane = state.plane;
    const leg = currentLeg();
    state.elapsed += dt;
    state.stormLeft -= dt;
    if (state.messageTime > 0) state.messageTime -= dt;
    if (state.stormLeft <= 0) {
      state.stormLeft = 0;
      state.over = true;
      state.overReason = 'The Grey Wall closed Last Light. The run is over.';
      return EVENT_CRASH;
    }

    // --- Throttle and speed -------------------------------------------------
    // On the ground the throttle is the speed: idle means parked. In the air
    // the wing always wants at least her minimum flying speed, so idle glides.
    plane.throttle = clamp(input.throttle, 0, 1);
    const targetSpeed = plane.onGround
      ? plane.throttle * PLANE.maxSpeed
      : PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    const accel = plane.onGround ? 14 : 9;
    plane.speed += clamp(targetSpeed - plane.speed, -accel * dt, accel * dt);
    // The air brake drags her down hard, on the strip and in the air alike.
    if (input.brake) plane.speed = Math.max(plane.onGround ? 0 : PLANE.minSpeed, plane.speed - 26 * dt);
    if (plane.speed < 0) plane.speed = 0;

    // --- Fuel: every second at throttle is a decision about the next leg ----
    if (plane.speed > 1 || plane.throttle > 0.05) {
      plane.fuel -= (PLANE.fuelBurnIdle + plane.throttle * (PLANE.fuelBurnFull - PLANE.fuelBurnIdle)) * dt;
    }
    if (plane.fuel <= 0) {
      plane.fuel = 0;
      plane.throttle = 0;
      events |= EVENT_FUEL_EMPTY;
      if (!plane.airborne) {
        // Out of fuel on the ground mid-run: the run ends here.
        state.over = true;
        state.overReason = 'Out of fuel on the strip. The run ends here.';
        return events | EVENT_CRASH;
      }
    }

    // --- Bank, heading, pitch ----------------------------------------------
    const targetBank = input.bank * PLANE.maxBankDeg * DEG;
    const bankRate = PLANE.bankRateDeg * DEG;
    plane.bank += clamp(targetBank - plane.bank, -bankRate * dt, bankRate * dt);
    // A banked wing turns: rate grows with the bank and falls with speed.
    const turnRate = (GRAVITY * Math.tan(plane.bank)) / Math.max(plane.speed, 12);
    plane.heading += turnRate * dt;

    const targetPitch = input.pitch * (input.pitch > 0 ? PLANE.pitchUpDeg : PLANE.pitchDownDeg) * DEG;
    plane.pitch += clamp(targetPitch - plane.pitch, -1.6 * dt, 1.6 * dt);

    // --- Wind pushes the airframe sideways ----------------------------------
    const wind = windAt(plane.x, plane.z, state.elapsed);

    // --- Moving --------------------------------------------------------------
    const sin = Math.sin(plane.heading);
    const cos = Math.cos(plane.heading);
    const forward = plane.onGround ? plane.groundSpeed : plane.speed;
    plane.x += (sin * forward + wind.x * 0.35) * dt;
    plane.z += (cos * forward + wind.z * 0.35) * dt;
    // Keep her inside the charted sea.
    plane.x = clamp(plane.x, 60, 7940);
    plane.z = clamp(plane.z, 60, 5940);

    const ground = groundHeightAt(plane.x, plane.z);
    const island = islandAt(plane.x, plane.z);

    if (plane.onGround) {
      // Rolling: speed follows the throttle; lift-off needs speed and a pull.
      plane.groundSpeed = plane.speed;
      plane.altitude = ground + 2;
      plane.verticalSpeed = 0;
      if (plane.speed >= PLANE.takeoffSpeed && plane.pitch > 2 * DEG) {
        plane.onGround = false;
        plane.airborne = true;
        plane.altitude = ground + 3;
        events |= EVENT_TAKEOFF;
        state.message = 'Airborne — gear up, eyes on the rings.';
        state.messageTime = 3;
      }
    } else {
      // Flying: pitch sets the climb, speed sets whether the wing holds.
      let climb = plane.speed * Math.sin(plane.pitch);
      if (plane.speed < PLANE.minSpeed) {
        // Stalled: she sinks, nose down, no matter what the stick says.
        climb -= (PLANE.minSpeed - plane.speed) * 0.55;
        plane.pitch = Math.max(plane.pitch, -6 * DEG);
      }
      // A heavy load climbs slower.
      if (leg.delivery.weight === 'heavy') climb *= 0.82;
      plane.verticalSpeed = climb;
      plane.altitude += climb * dt;

      // --- Rings: thread them to score -------------------------------------
      for (const ring of leg.rings) {
        if (ring.done) continue;
        const dx = plane.x - ring.x;
        const dz = plane.z - ring.z;
        const horizontal = Math.sqrt(dx * dx + dz * dz);
        const vertical = Math.abs(plane.altitude - ring.alt);
        if (horizontal < RING_RADIUS && vertical < 26) {
          ring.done = true;
          state.ringsHit += 1;
          const centred = horizontal < 16 && vertical < 10;
          if (centred) {
            ring.centred = true;
            state.ringsCentred += 1;
            state.score += RUN.ringPoints + RUN.ringCentreBonus;
            events |= EVENT_RING | EVENT_RING_CENTRE;
            addFeat(`Threaded a ring dead centre on leg ${state.legIndex + 1}`);
            state.message = 'Dead centre! +200';
          } else {
            state.score += RUN.ringPoints;
            events |= EVENT_RING;
            state.message = 'Ring! +150';
          }
          state.messageTime = 2.5;
        }
      }

      // --- Coming down: landing, ditching or crashing -----------------------
      if (plane.altitude <= ground + 2) {
        plane.altitude = ground + 2;
        const strip = island !== null && onStrip(plane.x, plane.z, island) ? island.strip : null;
        const aligned = strip === null ? false : Math.abs(angleDifference(plane.heading, strip.heading)) < 26 * DEG;
        const gentle = plane.verticalSpeed > -5;
        if (strip !== null && aligned && plane.speed >= 58 && plane.speed > 12) {
          // Too fast to stay: she floats, bounces and goes around — no damage,
          // but the leg is not landed and the fuel keeps burning.
          plane.altitude = ground + 8;
          plane.verticalSpeed = 1.5;
          state.message = 'Too fast — go around!';
          state.messageTime = 2.5;
        } else if (strip !== null && aligned && plane.speed < 58 && plane.speed > 12) {
          // A landing: on the strip, lined up, slow enough to stay.
          plane.onGround = true;
          plane.airborne = false;
          plane.groundSpeed = plane.speed;
          plane.verticalSpeed = 0;
          if (gentle) {
            state.smoothLandings += 1;
            state.score += RUN.smoothLandingBonus;
            addFeat(`A smooth landing at ${island.name}`);
            state.message = 'Smooth as a gull. +120';
            events |= EVENT_LANDED;
          } else {
            state.hardLandings += 1;
            plane.damage += PLANE.damageHardLanding;
            state.message = `Hard landing — airframe ${Math.round(plane.damage)}% damaged`;
            events |= EVENT_LANDED | EVENT_HARD_LANDING;
            if (plane.damage >= 100) {
              state.over = true;
              state.overReason = 'The hard landings broke her. The Kestrel will fly no more today.';
              return events | EVENT_CRASH;
            }
          }
          state.messageTime = 3;
          completeLeg(island);
        } else if (strip !== null && !aligned && plane.speed < 40) {
          // Came down across the strip: a ground loop, survivable, costly.
          plane.onGround = true;
          plane.airborne = false;
          plane.damage += PLANE.damageBrush;
          state.message = 'Ground loop! She holds together — barely.';
          state.messageTime = 3;
          events |= EVENT_HARD_LANDING;
        } else if (island === null) {
          // The sea takes her.
          state.over = true;
          state.overReason = 'Ditched in the sea. The mail is wet and the run is over.';
          return events | EVENT_DITCHED;
        } else {
          // Terrain: a hill, a treetop, a cliff.
          plane.damage += 55;
          if (plane.damage >= 100 || plane.verticalSpeed < -9) {
            state.over = true;
            state.overReason = `Came down in the hills of ${island.name}. The run is over.`;
            return events | EVENT_CRASH;
          }
          // A brush with the treetops: she bounces back up, hurt.
          plane.altitude = ground + 14;
          plane.verticalSpeed = 2;
          state.message = 'Clipped the treetops!';
          state.messageTime = 2.5;
          events |= EVENT_HARD_LANDING;
        }
      }
    }

    // Rolling to a stop after a landing is handled by the caller slowing her;
    // the leg is already complete by then.
    return events;
  }

  /** A delivery is handed over: score the leg, refuel, and open the next one. */
  function completeLeg(island) {
    const leg = currentLeg();
    const fuelBonus = Math.round(plane.fuel * RUN.fuelBonusPerUnit);
    const legScore = RUN.deliveryPoints + fuelBonus;
    state.legScore = legScore;
    state.score += legScore;
    state.delivered += 1;
    plane.fuel = PLANE.fuelCapacity;
    state.legComplete = true;
    const regular = leg.regular;
    state.message = regular
      ? `${regular.name} takes the ${leg.delivery.cargo}. “${regular.story}”`
      : `The ${leg.delivery.cargo} is safe at ${island.name}.`;
    state.messageTime = 6;
    if (state.legIndex === state.world.legs.length - 1) {
      // The last delivery: the run is won, with time still on the clock.
      const timeBonus = Math.round(state.stormLeft * RUN.timeBonusPerSecond);
      state.score += timeBonus;
      state.over = true;
      state.overReason = `Run complete — all 6 deliveries made with ${Math.floor(state.stormLeft / 60)}:${String(Math.floor(state.stormLeft % 60)).padStart(2, '0')} to spare. Time bonus +${timeBonus}.`;
    }
  }

  /** Open the next leg after a delivery (or restart the run). */
  function nextLeg() {
    if (state.legIndex + 1 < state.world.legs.length) startLeg(state.legIndex + 1);
  }

  function restart() {
    state.legIndex = 0;
    state.score = 0;
    state.feats = [];
    state.stormLeft = RUN.stormSeconds;
    state.elapsed = 0;
    state.delivered = 0;
    state.ringsHit = 0;
    state.ringsCentred = 0;
    state.smoothLandings = 0;
    state.hardLandings = 0;
    state.over = false;
    state.overReason = '';
    startLeg(0);
  }

  startLeg(0);
  return { state, step, startLeg, nextLeg, restart, currentLeg, parkAt, windAt };
}
