// Boot and the one loop: input is read every frame, the flight model advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// run sheet (briefing), play, paused, leg complete and run over.
//
// ?seed=N fixes the world (the layout is hand-placed, so the seed only steadies
// the scatter). ?shot=cover|approach|touchdown|storm stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld } from './world.js';
import { createFlight, EVENT_RING, EVENT_LANDED, EVENT_HARD_LANDING, EVENT_TAKEOFF } from './flight.js';
import { ACTION_CONFIRM, ACTION_MAP, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BRIEFING, SCREEN_LEG, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261126;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const flight = createFlight(world);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best run then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, flight);
  let painted = 0;
  function paint() {
    renderer.draw(scene.screen, flight, scene.best, null, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audioApi = audio;
  let screen = SCREEN_TITLE;
  let best = readBest();
  let showMap = false;
  let accumulator = 0;
  let last = performance.now();
  let alarmAt = 0;

  function setStatus(text) {
    status.textContent = text;
  }

  function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const actions = input.consumeActions();
    const inputState = input.read(dt);

    if (actions & ACTION_RESTART) {
      flight.restart();
      screen = SCREEN_PLAY;
      showMap = false;
      setStatus('The run starts again at Marrow.');
    }
    if (actions & ACTION_MAP && screen === SCREEN_PLAY) showMap = !showMap;
    if (actions & ACTION_PAUSE && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      screen = screen === SCREEN_PAUSED ? SCREEN_PLAY : SCREEN_PAUSED;
      // Drop the caught-up time when unpausing, or she lurches a quarter-second forward.
      if (screen === SCREEN_PLAY) accumulator = 0;
    }

    if (screen === SCREEN_TITLE && actions & ACTION_CONFIRM) {
      audioApi.unlock();
      screen = SCREEN_BRIEFING;
    } else if (screen === SCREEN_BRIEFING && actions & ACTION_CONFIRM) {
      audioApi.unlock();
      screen = SCREEN_PLAY;
      setStatus('Leg 1 of 6: a bundle of letters to Gull Rock.');
    } else if (screen === SCREEN_LEG && actions & ACTION_CONFIRM) {
      flight.nextLeg();
      screen = SCREEN_PLAY;
      setStatus(`Leg ${flight.state.legIndex + 1} of 6.`);
    } else if (screen === SCREEN_OVER && actions & ACTION_CONFIRM) {
      flight.restart();
      screen = SCREEN_PLAY;
      setStatus('Leg 1 of 6: a bundle of letters to Gull Rock.');
    }

    if (screen === SCREEN_PLAY && !showMap) {
      accumulator += dt;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const events = flight.step(inputState, STEP);
        if (events & EVENT_RING) audioApi.chime();
        if (events & (EVENT_LANDED | EVENT_HARD_LANDING)) audioApi.thud();
        if (events & EVENT_TAKEOFF) audioApi.unlock();
        if (flight.state.over) {
          if (flight.state.score > best) {
            best = flight.state.score;
            saveBest(best);
          }
          screen = SCREEN_OVER;
          setStatus(flight.state.overReason);
        } else if (flight.state.legComplete) {
          screen = SCREEN_LEG;
          setStatus(`Delivered at ${flight.currentLeg().to.name}. Press Enter for the next leg.`);
        }
      }
      const plane = flight.state.plane;
      audioApi.update(plane.throttle, plane.speed, plane.airborne);
      if (plane.fuel < 20 && plane.airborne && performance.now() - alarmAt > 2000) {
        alarmAt = performance.now();
        audioApi.alarm();
      }
    }

    renderer.draw(screen, flight, best, inputState, showMap);
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', () => audioApi.unlock(), { once: true });
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
