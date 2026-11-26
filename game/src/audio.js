// Sound, all of it synthesised in the browser: no audio files, no network.
// An engine hum that follows the throttle, wind that rises with speed, a chime
// for a ring, a thud for a touchdown, a low alarm when the fuel runs thin.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let enabled = true;
  let lastChime = 0;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();

      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = context.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(context.destination);
      windSource.start();
      return true;
    } catch {
      return false;
    }
  }

  /** Call from any user gesture: browsers keep audio silent until one. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') void context.resume();
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (!ensure() || !enabled) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function chime() {
    const now = context ? context.currentTime : 0;
    if (now - lastChime < 0.15) return;
    lastChime = now;
    tone(880, 0.35, 'sine', 0.16);
    tone(1318, 0.5, 'sine', 0.12, 0.08);
  }

  function thud() {
    if (!ensure() || !enabled) return;
    const start = context.currentTime;
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, start);
    osc.frequency.exponentialRampToValueAtTime(38, start + 0.25);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.5, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + 0.35);
  }

  function alarm() {
    tone(520, 0.22, 'square', 0.07);
    tone(392, 0.22, 'square', 0.07, 0.24);
  }

  /** Follow the plane: engine pitch with throttle, wind with speed. */
  function update(throttle, speed, airborne) {
    if (!ensure() || !enabled) return;
    // A tab that was hidden suspends the context; wake it when play resumes.
    if (context.state === 'suspended') void context.resume();
    if (context.state !== 'running') return;
    const targetEngine = airborne || throttle > 0.05 ? 0.05 + throttle * 0.075 : 0;
    engineGain.gain.setTargetAtTime(targetEngine, context.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(48 + throttle * 72 + speed * 0.35, context.currentTime, 0.1);
    windGain.gain.setTargetAtTime(airborne ? Math.min(0.12, speed * 0.0016) : 0, context.currentTime, 0.15);
    windFilter.frequency.setTargetAtTime(500 + speed * 9, context.currentTime, 0.15);
  }

  function toggle() {
    enabled = !enabled;
    if (!enabled && context !== null) {
      engineGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      windGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
    }
    return enabled;
  }

  return { unlock, update, chime, thud, alarm, toggle };
}
