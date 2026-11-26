// Keyboard and mouse, both: the stick answers either hand.
// Keys: W/S or Up/Down pitch, A/D or Left/Right bank, Shift/Ctrl or +/- throttle,
// Space air brake, M map, P pause, R restart, Enter confirm.
// Mouse: move to steer (bank toward the pointer, pitch from its height),
// wheel for throttle, click to confirm. Touch drag steers the same way.
import { STEP } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MAP = 8;

const THROTTLE_KEYS_PER_SECOND = 0.55;

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    bank: 0, // -1 (left) .. 1 (right), from keys or the mouse
    pitch: 0, // -1 (down) .. 1 (up)
    throttle: 0,
    brake: false,
    mouseSteer: false,
    mouseX: 0,
    mouseY: 0,
    actions: 0,
  };

  function keyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') state.actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP') state.actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') state.actions |= ACTION_RESTART;
    if (event.code === 'KeyM') state.actions |= ACTION_MAP;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function keyUp(event) {
    keys.delete(event.code);
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = (event.clientX - rect.left) / rect.width;
    state.mouseY = (event.clientY - rect.top) / rect.height;
    state.mouseSteer = true;
  }

  function pointerDown(event) {
    pointerMove(event);
    state.actions |= ACTION_CONFIRM;
    event.preventDefault();
  }

  function wheel(event) {
    // One notch is a small, predictable step: six notches either way is a full tank of throttle.
    state.throttle = Math.max(0, Math.min(1, state.throttle + (event.deltaY < 0 ? 0.05 : -0.05)));
    event.preventDefault();
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('wheel', wheel, { passive: false });

  /** Read the stick once per frame; call consumeActions() to take the queued presses. */
  function read(dt) {
    let bank = 0;
    let pitch = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) bank -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) bank += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) pitch += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) pitch -= 1;

    if (bank === 0 && pitch === 0 && state.mouseSteer) {
      // The mouse steers by where it sits: off-centre left banks left,
      // high on the screen pulls the nose up, low pushes it down.
      bank = Math.max(-1, Math.min(1, (state.mouseX - 0.5) * 2.4));
      pitch = Math.max(-1, Math.min(1, (0.5 - state.mouseY) * 2.2));
      if (Math.abs(bank) < 0.08) bank = 0;
      if (Math.abs(pitch) < 0.08) pitch = 0;
    }

    if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Equal')) {
      state.throttle = Math.min(1, state.throttle + THROTTLE_KEYS_PER_SECOND * dt);
    }
    if (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('Minus')) {
      state.throttle = Math.max(0, state.throttle - THROTTLE_KEYS_PER_SECOND * dt);
    }
    if (keys.has('Digit0')) state.throttle = 0;

    state.bank = bank;
    state.pitch = pitch;
    state.brake = keys.has('Space') || keys.has('KeyB');
    return state;
  }

  function consumeActions() {
    const actions = state.actions;
    state.actions = 0;
    return actions;
  }

  function setThrottle(value) {
    state.throttle = Math.max(0, Math.min(1, value));
  }

  return { state, read, consumeActions, setThrottle };
}
