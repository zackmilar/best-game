// audio.js — all sound is WebAudio synthesis, no files, no <audio>.
// A lazy AudioContext (created on the first user gesture, so browsers
// allow it), a master gain with an M mute toggle, one-shot SFX helpers,
// and a quiet 8-bar bass + sparkle loop at 100 BPM in A minor.

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    musicGain: null,
    muted: false,
    musicTimer: null,
    musicStep: 0,
  };

  audio.ensure = () => {
    if (audio.context) {
      if (audio.context.state === 'suspended') audio.context.resume();
      return true;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    audio.context = new Context();
    audio.master = audio.context.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.context.destination);
    audio.musicGain = audio.context.createGain();
    audio.musicGain.gain.value = 0.12;
    audio.musicGain.connect(audio.master);
    return true;
  };

  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  function tone({ type = 'triangle', from = 440, to = null, seconds = 0.12, gain = 0.25, when = 0 }) {
    if (!audio.context || audio.muted) return;
    const start = audio.context.currentTime + when;
    const oscillator = audio.context.createOscillator();
    const envelope = audio.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(envelope);
    envelope.connect(audio.master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  // Deterministic noise: a tiny LCG stepped per burst, so a burst
  // never depends on Math.random() (which the game never calls).
  let noiseSeed = 0x12345678;
  function noiseBurst({ seconds = 0.2, gain = 0.2, filterFreq = 1200 }) {
    if (!audio.context || audio.muted) return;
    const start = audio.context.currentTime;
    const length = Math.floor(audio.context.sampleRate * seconds);
    const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
      data[i] = (noiseSeed / 4294967296 * 2 - 1) * (1 - i / length);
    }
    const source = audio.context.createBufferSource();
    source.buffer = buffer;
    const filter = audio.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const envelope = audio.context.createGain();
    envelope.gain.value = gain;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(audio.master);
    source.start(start);
  }

  // Pop pitch climbs with the combo multiplier: 440 Hz at x1 to 880 at x5.
  audio.playPop = (multiplier) => {
    const pitch = 440 * (1 + (Math.min(multiplier, 5) - 1) * 0.25);
    tone({ type: 'triangle', from: pitch, to: pitch * 1.6, seconds: 0.1, gain: 0.22 });
  };
  audio.playGoldenPop = () => {
    tone({ type: 'sine', from: 880, to: 1320, seconds: 0.18, gain: 0.25 });
    tone({ type: 'sine', from: 1320, to: 1760, seconds: 0.18, gain: 0.18, when: 0.06 });
  };
  audio.playShoot = () => tone({ type: 'square', from: 920, to: 620, seconds: 0.05, gain: 0.05 });
  audio.playHurt = () => {
    tone({ type: 'square', from: 140, to: 60, seconds: 0.25, gain: 0.3 });
    noiseBurst({ seconds: 0.15, gain: 0.15, filterFreq: 500 });
  };
  audio.playDash = () => noiseBurst({ seconds: 0.22, gain: 0.2, filterFreq: 2400 });
  audio.playDraft = () => {
    tone({ type: 'sine', from: 523, seconds: 0.22, gain: 0.22 });
    tone({ type: 'sine', from: 659, seconds: 0.22, gain: 0.22, when: 0.09 });
    tone({ type: 'sine', from: 784, seconds: 0.3, gain: 0.22, when: 0.18 });
  };
  audio.playWaveHorn = () => {
    tone({ type: 'sawtooth', from: 220, to: 233, seconds: 0.4, gain: 0.1 });
    tone({ type: 'sawtooth', from: 277, to: 294, seconds: 0.4, gain: 0.1 });
  };
  audio.playBossRoar = () => {
    tone({ type: 'sawtooth', from: 90, to: 55, seconds: 0.7, gain: 0.28 });
    tone({ type: 'sawtooth', from: 95, to: 58, seconds: 0.7, gain: 0.22 });
  };
  audio.playBossTick = () => tone({ type: 'square', from: 1100, seconds: 0.05, gain: 0.08 });
  audio.playVictory = () => {
    [523, 659, 784, 1047].forEach((freq, i) => tone({ type: 'sine', from: freq, seconds: 0.35, gain: 0.22, when: i * 0.12 }));
  };
  audio.playDefeat = () => {
    [392, 330, 262, 196].forEach((freq, i) => tone({ type: 'triangle', from: freq, seconds: 0.35, gain: 0.2, when: i * 0.14 }));
  };

  // 8-bar loop, A minor: roots A2 F2 C3 G2, one bar each, twice through,
  // plus a sparse sparkle arp on the off-beats. Scheduled a bar ahead.
  const BASS_ROOTS = [110, 87.31, 130.81, 98];
  const SPARKLE = [440, 523.25, 659.25, 880];
  audio.startMusic = () => {
    if (!audio.context || audio.musicTimer) return;
    const barSeconds = (60 / 100) * 4;
    audio.musicTimer = window.setInterval(() => {
      if (audio.muted || !audio.context) return;
      const bar = audio.musicStep % 8;
      const root = BASS_ROOTS[Math.floor(bar / 2) % 4];
      const start = audio.context.currentTime + 0.05;
      const osc = audio.context.createOscillator();
      const env = audio.context.createGain();
      osc.type = 'sine';
      osc.frequency.value = root;
      env.gain.setValueAtTime(0.5, start);
      env.gain.exponentialRampToValueAtTime(0.001, start + barSeconds);
      osc.connect(env);
      env.connect(audio.musicGain);
      osc.start(start);
      osc.stop(start + barSeconds);
      if (bar % 2 === 1) {
        const note = SPARKLE[audio.musicStep % SPARKLE.length];
        const spark = audio.context.createOscillator();
        const sparkEnv = audio.context.createGain();
        spark.type = 'sine';
        spark.frequency.value = note;
        sparkEnv.gain.setValueAtTime(0.35, start + barSeconds / 2);
        sparkEnv.gain.exponentialRampToValueAtTime(0.001, start + barSeconds / 2 + 0.3);
        spark.connect(sparkEnv);
        sparkEnv.connect(audio.musicGain);
        spark.start(start + barSeconds / 2);
        spark.stop(start + barSeconds / 2 + 0.35);
      }
      audio.musicStep += 1;
    }, barSeconds * 1000);
  };

  return audio;
}
