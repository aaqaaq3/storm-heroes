'use strict';
/* ============================================================
   أبطال العاصفة — محرك الصوت (توليف كامل بلا ملفات خارجية)
   ============================================================ */

const SFX = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  noiseBuf: null, ready: false, stormNode: null, stormGain: null,
  volMaster: 0.75, volMusic: 0.4, volSfx: 0.9,
  musicTimer: null, musicStep: 0,

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volMaster;
    // ضاغط لمنع التشويه عند تراكم الأصوات
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 8;
    comp.attack.value = 0.004; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.volSfx;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.volMusic;
    this.musicGain.connect(this.master);

    // مخزن ضوضاء بيضاء
    const n = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.ready = true;
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setVolumes(m, mu, sx) {
    this.volMaster = m; this.volMusic = mu; this.volSfx = sx;
    if (!this.ready) return;
    this.master.gain.value = m;
    this.musicGain.gain.value = mu;
    this.sfxGain.gain.value = sx;
  },

  /* --- لبنات أساسية --- */
  noise(dur, filterType, f0, f1, gain, dest) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = filterType || 'bandpass';
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    bp.Q.value = 1.1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(bp); bp.connect(g); g.connect(dest || this.sfxGain);
    s.start(t); s.stop(t + dur + 0.02);
  },

  tone(type, f0, f1, dur, gain, delay, dest) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },

  /* --- أصوات اللعبة --- */
  shoot(kind, vol) {
    if (!this.ready) return;
    const v = (vol === undefined ? 1 : vol);
    switch (kind) {
      case 'smg':
        this.tone('square', 620, 180, 0.09, 0.16 * v);
        this.noise(0.08, 'bandpass', 2600, 700, 0.20 * v);
        break;
      case 'ar':
        this.tone('sawtooth', 460, 110, 0.13, 0.20 * v);
        this.noise(0.12, 'bandpass', 2200, 500, 0.26 * v);
        break;
      case 'pistol':
        this.tone('square', 780, 220, 0.11, 0.17 * v);
        this.noise(0.09, 'bandpass', 3000, 900, 0.20 * v);
        break;
      case 'shotgun':
        this.tone('sawtooth', 260, 60, 0.30, 0.26 * v);
        this.noise(0.28, 'lowpass', 1800, 200, 0.36 * v);
        break;
      case 'sniper':
        this.tone('sawtooth', 340, 55, 0.42, 0.28 * v);
        this.tone('sine', 1400, 300, 0.18, 0.14 * v);
        this.noise(0.40, 'lowpass', 2600, 180, 0.32 * v);
        break;
      case 'rocket':
        this.tone('sawtooth', 190, 70, 0.5, 0.24 * v);
        this.noise(0.55, 'lowpass', 900, 160, 0.30 * v);
        break;
    }
  },

  explosion(v) {
    if (!this.ready) return;
    this.noise(0.75, 'lowpass', 1400, 70, 0.55 * (v || 1));
    this.tone('sine', 130, 32, 0.65, 0.42 * (v || 1));
    this.tone('sawtooth', 260, 50, 0.35, 0.18 * (v || 1));
  },

  hitMarker() { this.tone('square', 1500, 1900, 0.055, 0.16); this.tone('sine', 2400, 2400, 0.04, 0.08, 0.02); },
  headshot() { this.tone('square', 1900, 2500, 0.07, 0.2); this.tone('sine', 3000, 3400, 0.06, 0.12, 0.03); },
  hurt() { this.tone('sawtooth', 200, 110, 0.18, 0.16); this.noise(0.16, 'lowpass', 700, 200, 0.13); },
  elim() { [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.16, 0.16, i * 0.065)); },
  build() { this.tone('square', 300, 170, 0.09, 0.13); this.noise(0.10, 'bandpass', 900, 300, 0.13); },
  pickup() { [660, 880, 1180].forEach((f, i) => this.tone('sine', f, f, 0.1, 0.14, i * 0.05)); },
  chest() { [392, 523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.13, i * 0.07)); },
  reload() { this.tone('square', 220, 150, 0.07, 0.1); this.tone('square', 300, 400, 0.07, 0.09, 0.16); this.noise(0.06, 'bandpass', 1400, 700, 0.1, this.sfxGain); },
  jump() { this.tone('sine', 320, 520, 0.11, 0.09); },
  land(v) { this.noise(0.14, 'lowpass', 500, 120, 0.16 * (v || 1)); },
  step(v) { this.noise(0.06, 'bandpass', 900 + Math.random() * 300, 380, 0.055 * (v || 1)); },
  swing() { this.noise(0.16, 'bandpass', 1400, 320, 0.11); },
  chop() { this.noise(0.10, 'lowpass', 900, 250, 0.2); this.tone('square', 180, 120, 0.08, 0.1); },
  glider() { this.noise(0.6, 'lowpass', 500, 900, 0.14); this.tone('sine', 180, 300, 0.5, 0.08); },
  countdown(last) { this.tone('sine', last ? 900 : 600, last ? 1200 : 600, last ? 0.4 : 0.14, 0.2); },
  ui(kind) {
    if (kind === 'hover') this.tone('sine', 900, 900, 0.045, 0.05);
    else if (kind === 'back') this.tone('sine', 500, 340, 0.1, 0.1);
    else { this.tone('sine', 700, 1050, 0.09, 0.12); this.tone('sine', 1400, 1700, 0.07, 0.06, 0.04); }
  },

  victory() {
    if (!this.ready) return;
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((f, i) => {
      this.tone('triangle', f, f, 0.45, 0.19, i * 0.16);
      this.tone('sine', f * 2, f * 2, 0.3, 0.07, i * 0.16);
    });
    this.tone('sine', 130, 130, 2.2, 0.13, 0);
  },

  defeat() {
    if (!this.ready) return;
    [440, 392, 330, 262].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.15, i * 0.22));
  },

  /* --- أزيز العاصفة المستمر --- */
  stormLoop(on) {
    if (!this.ready) return;
    if (on && !this.stormNode) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuf; s.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.7;
      const g = this.ctx.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.sfxGain);
      s.start();
      this.stormNode = s; this.stormGain = g;
    } else if (!on && this.stormNode) {
      try { this.stormNode.stop(); } catch (e) { }
      this.stormNode = null; this.stormGain = null;
    }
  },

  stormLevel(v) {
    if (this.stormGain) this.stormGain.gain.value = clamp(v, 0, 1) * 0.30;
  },

  /* --- موسيقى الردهة --- */
  music(on) {
    if (!this.ready) return;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (!on) return;
    this.musicStep = 0;
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    const bass = [65.41, 65.41, 87.31, 98.00];
    const self = this;
    this.musicTimer = setInterval(function () {
      const st = self.musicStep++;
      const bar = Math.floor(st / 8) % 4;
      if (st % 8 === 0) self.tone('triangle', bass[bar], bass[bar], 0.85, 0.16, 0, self.musicGain);
      const pat = [0, 2, 4, 5, 4, 2, 3, 1];
      const n = scale[(pat[st % 8] + bar) % 8];
      self.tone('sine', n, n, 0.30, 0.075, 0, self.musicGain);
      if (st % 4 === 0) self.tone('sine', n * 2, n * 2, 0.18, 0.032, 0.06, self.musicGain);
      if (st % 2 === 1) self.noise(0.05, 'highpass', 5200, 5200, 0.026, self.musicGain);
    }, 230);
  }
};
