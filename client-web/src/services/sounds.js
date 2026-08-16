/**
 * Web Audio API Sound Synthesizer
 * Generates realistic telephony and app feedback tones with zero external audio assets.
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

let activeRingtoneInterval = null;
let activeDialtoneOscs = [];

export const SoundEngine = {
  /**
   * Play outgoing ringback tone (Standard 440Hz + 480Hz dual frequency)
   */
  startOutgoingRingback() {
    this.stopRingtone();
    const ctx = getAudioContext();
    if (!ctx) return;

    const playBurst = () => {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.setValueAtTime(0.08, now + 1.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.0);
      osc2.stop(now + 2.0);
    };

    playBurst();
    activeRingtoneInterval = setInterval(playBurst, 4000);
  },

  /**
   * Play incoming melodic ringtone
   */
  startIncomingRingtone() {
    this.stopRingtone();
    const ctx = getAudioContext();
    if (!ctx) return;

    const playPattern = () => {
      const now = ctx.currentTime;
      const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteTime = now + idx * 0.16;

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.0001, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.12, noteTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.32);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.35);
      });
    };

    playPattern();
    activeRingtoneInterval = setInterval(playPattern, 2600);
  },

  stopRingtone() {
    if (activeRingtoneInterval) {
      clearInterval(activeRingtoneInterval);
      activeRingtoneInterval = null;
    }
  },

  /**
   * Play call connected chime
   */
  playConnected() {
    this.stopRingtone();
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.1;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.14, noteTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  },

  /**
   * Play call ended / hangup tone
   */
  playHangup() {
    this.stopRingtone();
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [659.25, 493.88, 329.63].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.12;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.1, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.2);
    });
  },

  /**
   * Subtle chat message pop
   */
  playMessagePop() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }
};
