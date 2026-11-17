// SOLMARA audio: every sound and the music loop are synthesized live with
// the Web Audio API. No audio files, no network.
(function () {
  "use strict";

  const AudioSys = {
    ctx: null,
    master: null,
    musicGain: null,
    enabled: true,
    musicTimer: 0,
    musicStep: 0,
    engineOsc: null,
    engineGain: null,

    init: function () {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.16;
        this.musicGain.connect(this.master);
        // Quiet engine hum, pitch follows the player's speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = "sawtooth";
        this.engineOsc.frequency.value = 50;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filt = this.ctx.createBiquadFilter();
        filt.type = "lowpass";
        filt.frequency.value = 320;
        this.engineOsc.connect(filt);
        filt.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      } catch (e) {
        this.ctx = null;
      }
    },

    resume: function () {
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    },

    setEngine: function (speed01, inCar) {
      if (!this.ctx || !this.engineGain) return;
      const target = inCar ? 0.05 + speed01 * 0.07 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(
        46 + speed01 * 110,
        this.ctx.currentTime,
        0.1
      );
    },

    // Short synthesized blip: a sine/triangle tone sliding in pitch.
    blip: function (freq, dur, type, vol, slideTo) {
      if (!this.ctx || !this.enabled) return;
      try {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || "sine";
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(vol || 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.02);
      } catch (e) {}
    },

    // Burst of filtered noise for gunshots, crashes and explosions.
    noise: function (dur, vol, cutoff) {
      if (!this.ctx || !this.enabled) return;
      try {
        const t = this.ctx.currentTime;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = "lowpass";
        filt.frequency.value = cutoff || 1200;
        const g = this.ctx.createGain();
        g.gain.value = vol || 0.3;
        src.connect(filt);
        filt.connect(g);
        g.connect(this.master);
        src.start(t);
      } catch (e) {}
    },

    shoot: function (smg) {
      this.noise(0.09, smg ? 0.22 : 0.3, smg ? 2600 : 1800);
      this.blip(smg ? 220 : 160, 0.06, "square", 0.08, 60);
    },

    explosion: function () {
      this.noise(0.7, 0.5, 500);
      this.blip(90, 0.5, "sine", 0.3, 30);
    },

    crash: function () {
      this.noise(0.18, 0.3, 700);
    },

    pickup: function () {
      this.blip(660, 0.1, "sine", 0.2, 990);
      setTimeout(() => this.blip(990, 0.14, "sine", 0.18, 1320), 70);
    },

    star: function () {
      this.blip(880, 0.1, "triangle", 0.22, 1108);
      setTimeout(() => this.blip(1318, 0.2, "triangle", 0.2, 1760), 90);
    },

    missionWin: function () {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) =>
        setTimeout(() => this.blip(f, 0.22, "triangle", 0.22), i * 120)
      );
    },

    missionFail: function () {
      const notes = [392, 330, 262, 196];
      notes.forEach((f, i) =>
        setTimeout(() => this.blip(f, 0.25, "sawtooth", 0.12), i * 140)
      );
    },

    siren: function () {
      this.blip(720, 0.45, "sine", 0.05, 980);
    },

    // A slow sun-soaked bassline plus soft pad chords, scheduled in steps.
    updateMusic: function (dt) {
      if (!this.ctx || !this.enabled) return;
      this.musicTimer -= dt;
      if (this.musicTimer > 0) return;
      this.musicTimer = 0.24;
      const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
      const note = bass[this.musicStep % bass.length];
      if (note) this.blip(note, 0.22, "triangle", 0.1);
      if (this.musicStep % 8 === 0) {
        this.blip(220, 1.6, "sine", 0.04);
        this.blip(277, 1.6, "sine", 0.03);
      }
      this.musicStep++;
    },
  };

  window.SOL.AudioSys = AudioSys;
})();
