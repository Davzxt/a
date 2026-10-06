// Áudio 100% procedural (Web Audio): ambiências, trilhas generativas por capítulo e efeitos.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.85, music: 0.7 };
    try { const v = JSON.parse(localStorage.getItem('cdm-vol') || 'null'); if (v) this.vol = v; } catch (e) { /* sem storage */ }
    this.preset = null; this.amb = {}; this.ksCache = {}; this.state = { river: 99, fire: 99, guide: null };
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.musicPan = c.createStereoPanner(); this.musicPan.connect(this.musicBus);
    this.musicIn = c.createGain(); this.musicIn.connect(this.musicPan);
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.9; this.ambBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.rev = c.createConvolver();
    this.rev.buffer = this.impulse(3.2);
    const rg = c.createGain(); rg.gain.value = 0.42;
    this.rev.connect(rg).connect(this.master);
    this.musicSend = c.createGain(); this.musicSend.gain.value = 0.55; this.musicIn.connect(this.musicSend).connect(this.rev);
    this.sfxSend = c.createGain(); this.sfxSend.gain.value = 0.25; this.sfxBus.connect(this.sfxSend).connect(this.rev);
    this.noise = this.makeNoise(2.5, false); this.pink = this.makeNoise(4, true);
    this.amb.wind = this.loop(this.pink, 'bandpass', 380, 0.6);
    this.amb.river = this.loop(this.noise, 'bandpass', 950, 0.35);
    this.amb.night = this.loop(this.noise, 'bandpass', 5600, 7);
    this.amb.town = this.loop(this.pink, 'bandpass', 260, 1.2);
    this.setVolume();
    this.nextBeat = c.currentTime + 0.1; this.beat = 0;
    setInterval(() => this.tick(), 40);
    if (this.pending) { this.setScene(this.pending); this.pending = null; }
  }

  setVolume(v) {
    if (v) Object.assign(this.vol, v);
    try { localStorage.setItem('cdm-vol', JSON.stringify(this.vol)); } catch (e) { /* ok */ }
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.vol.master, this.ctx.currentTime, 0.1);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.6, this.ctx.currentTime, 0.1);
  }
  duck(on) { if (this.ctx) this.master.gain.setTargetAtTime(on ? this.vol.master * 0.35 : this.vol.master, this.ctx.currentTime, 0.3); }
  now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; }

  makeNoise(sec, pink) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (!pink) { d[i] = w; continue; }
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return b;
  }
  impulse(sec) {
    const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  loop(buf, type, f, q) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
    s.connect(fl).connect(g).connect(this.ambBus); s.start();
    return { g, fl };
  }

  // Cena sonora: ambiência + trilha
  setScene(name) {
    if (!this.ctx) { this.pending = name; return; }
    this.sceneName = name;
    const S = SCENES[name] || SCENES.title;
    this.amb_cfg = S;
    const t = this.ctx.currentTime;
    for (const k of ['wind', 'night', 'town']) this.amb[k].g.gain.setTargetAtTime((S[k] || 0) * 0.5, t, 1.2);
    this.preset = S.music ? MUSIC[S.music] : null;
    this.musicPan.pan.setTargetAtTime(0, t, 0.3);
    this.musicIn.gain.setTargetAtTime(S.musicGain ?? 1, t, 0.8);
    this.beat = 0; this.nextBeat = Math.max(this.nextBeat, t + 0.15);
    this.mem = {};
  }
  update(st) { Object.assign(this.state, st); }

  tick() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const t = c.currentTime, S = this.amb_cfg || {}, st = this.state;
    // rio e fogueira dependem da distância
    this.amb.river.g.gain.setTargetAtTime(Math.max(0, 1 - st.river / 38) * 0.55 * (S.river ?? 1), t, 0.3);
    if (st.fire < 9 && Math.random() < 0.5 * (1 - st.fire / 9)) this.crackle(t + rnd(0, 0.05), 1 - st.fire / 9);
    if (S.birds && Math.random() < S.birds * 0.035) this.bird(t + rnd(0.05, 0.3));
    if (S.crickets && Math.random() < S.crickets * 0.05) this.cricket(t + rnd(0.05, 0.3));
    if (S.frogs && Math.random() < S.frogs * 0.02) this.frog(t + 0.1);
    // trilha guia (tambor distante): pan e volume pela direção
    if (st.guide) { this.musicPan.pan.setTargetAtTime(st.guide.pan, t, 0.2); this.musicIn.gain.setTargetAtTime(st.guide.gain, t, 0.3); }
    const P = this.preset;
    if (!P) return;
    const spb = 60 / P.bpm / (P.sub || 2);
    while (this.nextBeat < t + 0.3) { P.play(this, this.beat, this.nextBeat, spb); this.nextBeat += spb; this.beat++; }
  }

  // ---------- instrumentos ----------
  osc(type, f, t, dur, vol, { a = 0.01, r = 0.2, dest = this.musicIn, cut = 0, detune = 0, vib = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    let node = o;
    if (cut) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut; o.connect(fl); node = fl; }
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.2; lg.gain.value = f * vib; l.connect(lg).connect(o.frequency); l.start(t + 0.15); l.stop(t + dur + r + 0.1); }
    node.connect(g).connect(dest);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, dur) + r);
    o.start(t); o.stop(t + dur + r + 0.05);
  }
  burst(t, dur, vol, type, f, q = 1, dest = this.sfxBus, f2) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    s.connect(fl).connect(g).connect(dest);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.02);
  }
  pad(notes, t, dur, vol = 0.05) {
    for (const n of notes) for (const d of [-7, 7]) this.osc('sawtooth', mtof(n), t, dur, vol, { a: dur * 0.35, r: dur * 0.5, cut: 900, detune: d });
  }
  flute(n, t, dur, vol = 0.07) {
    this.osc('sine', mtof(n), t, dur, vol, { a: 0.08, r: 0.25, vib: 0.006 });
    this.osc('triangle', mtof(n) * 2, t, dur, vol * 0.12, { a: 0.1, r: 0.2 });
    this.burst(t, dur * 0.6, vol * 0.25, 'bandpass', mtof(n) * 2, 3, this.musicIn);
  }
  ks(f) {
    const key = Math.round(f);
    if (this.ksCache[key]) return this.ksCache[key];
    const c = this.ctx, sr = c.sampleRate, len = Math.floor(sr * 2), b = c.createBuffer(1, len, sr), d = b.getChannelData(0), N = Math.max(2, Math.round(sr / f));
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (let i = 1; i < N; i++) d[i] = (d[i] + d[i - 1]) * 0.5;
    for (let i = N; i < len; i++) d[i] = 0.4985 * (d[i - N] + d[Math.max(0, i - N - 1)]);
    return (this.ksCache[key] = b);
  }
  pluck(n, t, vol = 0.18, dest = this.musicIn) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter();
    s.buffer = this.ks(mtof(n)); fl.type = 'lowpass'; fl.frequency.value = 2600; g.gain.value = vol;
    s.connect(fl).connect(g).connect(dest); s.start(t); s.stop(t + 2);
  }
  accordion(n, t, dur, vol = 0.045) {
    for (const d of [-9, 9]) this.osc('sawtooth', mtof(n), t, dur, vol, { a: 0.04, r: 0.12, cut: 2400, detune: d });
    this.osc('square', mtof(n - 12), t, dur, vol * 0.35, { a: 0.04, r: 0.1, cut: 1400 });
  }
  drum(kind, t, vol = 0.5, dest = this.musicIn) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    const P = { tambu: [95, 52, 0.45, 900], cand: [230, 160, 0.16, 2600], doum: [110, 62, 0.35, 700], tek: [620, 480, 0.06, 5000], boom: [70, 30, 1.2, 400] }[kind];
    o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2] * 0.6);
    o.connect(g).connect(dest);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[2]);
    o.start(t); o.stop(t + P[2] + 0.05);
    this.burst(t, kind === 'tek' ? 0.05 : 0.03, vol * (kind === 'tek' ? 0.7 : 0.35), kind === 'tek' ? 'highpass' : 'bandpass', P[3], 1, dest);
  }

  // ---------- ambiência ----------
  bird(t) {
    const pan = this.ctx.createStereoPanner(), g = this.ctx.createGain();
    pan.pan.value = rnd(-0.9, 0.9); g.gain.value = rnd(0.25, 0.7);
    g.connect(pan).connect(this.ambBus);
    const kind = Math.floor(Math.random() * 3), base = rnd(2200, 3600);
    if (kind === 0) for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) this.chirp(t + i * rnd(0.12, 0.2), base * rnd(0.9, 1.2), base * rnd(1.2, 1.6), 0.08, g);
    else if (kind === 1) [1, 0.75, 1.1].forEach((k, i) => this.chirp(t + i * 0.28, base * k, base * k * 1.05, 0.22, g));
    else this.chirp(t, base * 0.7, base * 1.3, 0.35, g);
  }
  chirp(t, f0, f1, dur, dest) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(g).connect(dest);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  cricket(t) {
    const f = rnd(4200, 5200), pan = this.ctx.createStereoPanner();
    pan.pan.value = rnd(-1, 1); pan.connect(this.ambBus);
    for (let i = 0; i < 3; i++) this.osc('sine', f, t + i * 0.06, 0.03, 0.025, { a: 0.005, r: 0.02, dest: pan });
  }
  frog(t) { this.osc('square', rnd(180, 260), t, 0.08, 0.02, { a: 0.01, r: 0.05, cut: 700, dest: this.ambBus }); this.osc('square', rnd(180, 260), t + 0.15, 0.08, 0.02, { a: 0.01, r: 0.05, cut: 700, dest: this.ambBus }); }
  crackle(t, k) { this.burst(t, rnd(0.01, 0.04), rnd(0.05, 0.25) * k, 'highpass', rnd(1500, 4000), 1, this.ambBus); }

  // ---------- efeitos ----------
  sfx(name) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + 0.01, S = this.sfxBus;
    switch (name) {
      case 'ui': this.osc('sine', 880, t, 0.03, 0.06, { a: 0.005, r: 0.08, dest: S }); break;
      case 'objective': [76, 83, 88].forEach((n, i) => this.osc('sine', mtof(n), t + i * 0.09, 0.2, 0.06, { a: 0.01, r: 0.9, dest: S })); break;
      case 'collect': [72, 79, 84, 91].forEach((n, i) => this.pluck(n, t + i * 0.07, 0.16, S)); break;
      case 'card': this.burst(t, 0.35, 0.08, 'bandpass', 2400, 1, S, 900); [64, 71].forEach((n, i) => this.osc('sine', mtof(n), t + 0.15 + i * 0.12, 0.3, 0.05, { a: 0.01, r: 1.4, dest: S })); break;
      case 'chapter': this.drum('boom', t, 0.6, S); [50, 57, 62, 66].forEach((n, i) => this.osc('triangle', mtof(n + 12), t + 0.2 + i * 0.05, 1.2, 0.025, { a: 0.4, r: 2, dest: S })); break;
      case 'drumLow': this.drum('tambu', t, 0.75, S); break;
      case 'drumHigh': this.drum('cand', t, 0.5, S); break;
      case 'whistle': [69, 73, 76].forEach((n) => this.osc('sawtooth', mtof(n), t, 1.3, 0.035, { a: 0.08, r: 0.35, cut: 1800, dest: S })); this.burst(t, 1.4, 0.1, 'bandpass', 1800, 2, S); break;
      case 'chuff': this.burst(t, 0.25, 0.25, 'lowpass', 700, 1, S); break;
      case 'axe': this.burst(t, 0.08, 0.4, 'bandpass', 1400, 2, S); this.drum('doum', t, 0.25, S); break;
      case 'caught': [61, 62, 66].forEach((n) => this.osc('sawtooth', mtof(n - 12), t, 0.6, 0.04, { a: 0.02, r: 0.6, cut: 1200, dest: S })); break;
      case 'bell': [1, 2.4, 4.1, 5.9].forEach((k, i) => this.osc('sine', 392 * k, t, 0.02, 0.06 / (i + 1), { a: 0.005, r: 2.5, dest: S })); break;
      case 'build': for (let i = 0; i < 3; i++) { this.drum('doum', t + i * 0.22, 0.3, S); this.burst(t + i * 0.22, 0.05, 0.2, 'bandpass', 900, 2, S); } break;
      case 'plant': this.burst(t, 0.3, 0.25, 'lowpass', 500, 1, S); break;
      case 'fire': this.burst(t, 1.2, 0.25, 'bandpass', 600, 0.5, S, 2400); break;
      case 'splash': this.burst(t, 0.4, 0.2, 'bandpass', 1800, 1, S, 600); break;
      case 'door': this.drum('doum', t, 0.35, S); this.burst(t, 0.5, 0.06, 'bandpass', 300, 4, S); break;
      default: break;
    }
  }
  step(water, run) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (water) this.burst(t, 0.18, 0.12, 'bandpass', rnd(1400, 2200), 1.5, this.sfxBus, 600);
    else this.burst(t, 0.07, run ? 0.16 : 0.1, 'lowpass', rnd(500, 900), 1, this.sfxBus);
  }
}

// ---------- cenas sonoras ----------
const SCENES = {
  title: { music: 'title', wind: 0.5, birds: 0.6, river: 0.4 },
  puri: { music: 'puri', wind: 0.35, birds: 1, river: 1 },
  bentoNoite: { music: 'tension', wind: 0.3, night: 0.35, crickets: 1, frogs: 0.6, river: 0.8 },
  bentoMata: { music: 'cax', musicGain: 0.25, wind: 0.25, night: 0.4, crickets: 1, frogs: 0.4 },
  bentoRoda: { music: 'cax', wind: 0.2, night: 0.3, crickets: 0.6 },
  rhythm: { music: null, wind: 0.2, night: 0.3, crickets: 0.5 },
  pietro: { music: 'waltz', wind: 0.4, birds: 0.8, river: 0.7 },
  youssef: { music: 'hijaz', wind: 0.3, birds: 0.5, town: 0.25, river: 0.5 },
  epilogo: { music: 'finale', wind: 0.2, night: 0.15, crickets: 0.4, town: 0.3 },
  silence: { music: null, wind: 0.15 },
};

// ---------- trilhas generativas (cada "play" recebe o passo e o instante) ----------
const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76];
const MUSIC = {
  title: {
    bpm: 66, sub: 2,
    play(A, b, t, spb) {
      const chords = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]];
      const bar = Math.floor(b / 8) % 4, ch = chords[bar];
      if (b % 8 === 0) A.pad(ch, t, spb * 8.5, 0.028);
      if (b % 2 === 0 && Math.random() < 0.7) A.pluck(ch[(b / 2) % 4] + 24, t, 0.09);
      if (b % 16 === 4 && Math.random() < 0.6) { const m = [74, 78, 81, 83, 81, 78, 76, 74]; let tt = t; for (let i = 0; i < 4; i++) { A.flute(m[(Math.floor(b / 16) * 2 + i) % 8], tt, spb * 1.6, 0.045); tt += spb * 2; } }
    },
  },
  puri: {
    bpm: 60, sub: 2,
    play(A, b, t, spb) {
      if (b % 16 === 0) A.pad([45, 52, 57, 64], t, spb * 17, 0.024);
      if (b % 16 === 8 && Math.random() < 0.8) {
        let i = Math.floor(Math.random() * 5) + 2, tt = t;
        const n = 3 + Math.floor(Math.random() * 4);
        for (let k = 0; k < n; k++) { const d = pick([1, 1, 2, 3]) * spb; A.flute(PENTA[i] + 12, tt, d * 0.9, 0.05); tt += d; i = Math.max(0, Math.min(8, i + pick([-2, -1, 1, 1, 2]))); }
      }
      if (b % 4 === 2 && Math.random() < 0.25) A.burst(t, 0.6, 0.04, 'highpass', 6000, 1, A.musicIn);
    },
  },
  tension: {
    bpm: 56, sub: 2,
    play(A, b, t, spb) {
      if (b % 16 === 0) { A.osc('sawtooth', mtof(33), t, spb * 16, 0.05, { a: 3, r: 3, cut: 220 }); A.osc('sawtooth', mtof(40), t, spb * 16, 0.03, { a: 3, r: 3, cut: 260, detune: 8 }); }
      if (b % 4 === 0) { A.drum('tambu', t, 0.14); A.drum('tambu', t + spb * 0.45, 0.08); }
    },
  },
  cax: {
    bpm: 104, sub: 4,
    play(A, b, t) {
      const s = b % 16;
      if ([0, 6, 8, 11, 14].includes(s)) A.drum('tambu', t, s === 0 ? 0.55 : 0.4);
      if ([2, 3, 5, 7, 10, 12, 13, 15].includes(s)) A.drum('cand', t, 0.22 + Math.random() * 0.08);
      if (s % 2 === 0) A.burst(t, 0.06, s % 4 === 0 ? 0.07 : 0.04, 'highpass', 6500, 1, A.musicIn);
      if (s === 4 || s === 12) A.burst(t, 0.05, 0.12, 'bandpass', 1500, 1.5, A.musicIn);
      if (b % 64 === 0) A.pad([45, 52, 57], t, 9, 0.02);
    },
  },
  waltz: {
    bpm: 132, sub: 1,
    play(A, b, t, spb) {
      const MEL = [[71, 1], [74, 1], [79, 1], [78, 1], [76, 1], [74, 1], [72, 1], [74, 1], [69, 1], [66, 2], [69, 1], [72, 1], [71, 1], [69, 1], [74, 1], [72, 1], [69, 1], [71, 1], [67, 1], [71, 1], [74, 3],
        [76, 1], [79, 1], [76, 1], [74, 1], [71, 1], [67, 1], [69, 1], [72, 1], [78, 1], [79, 2], [74, 1], [76, 1], [74, 1], [72, 1], [71, 1], [74, 1], [79, 1], [78, 1], [81, 1], [78, 1], [79, 3]];
      const CH = { G: [43, 55, 59, 62], D: [38, 54, 57, 60], C: [36, 52, 55, 60] }, PROG = 'GGDDDDGGCGDGCGDG';
      const beatInBar = b % 3, bar = Math.floor(b / 3) % 16, ch = CH[PROG[bar]];
      if (beatInBar === 0) A.osc('triangle', mtof(ch[0]), t, spb * 0.8, 0.09, { a: 0.01, r: 0.15 });
      else for (const n of ch.slice(1)) A.accordion(n, t, spb * 0.35, 0.016);
      const m = A.mem;
      if (b === 0 || m.mi === undefined) { m.mi = 0; m.next = 0; }
      if (b % 96 === 0) { m.mi = 0; m.next = b; }
      if (b >= m.next && m.mi < MEL.length) { const [n, d] = MEL[m.mi]; A.accordion(n, t, spb * d * 0.92, 0.03); m.next = b + d; m.mi++; }
    },
  },
  hijaz: {
    bpm: 98, sub: 2,
    play(A, b, t, spb) {
      const SC = [62, 63, 66, 67, 69, 70, 72, 74], s = b % 8;
      const pat = ['D', 'T', '', 'T', 'D', '', 'T', 'k'][s];
      if (pat === 'D') A.drum('doum', t, 0.32); else if (pat === 'T') A.drum('tek', t, 0.16); else if (pat === 'k') A.drum('tek', t, 0.07);
      if (b % 32 === 0) A.osc('sawtooth', mtof(50), t, spb * 32, 0.022, { a: 2, r: 2, cut: 500 });
      const m = A.mem;
      if (m.i === undefined) { m.i = 0; m.rest = 0; }
      if (m.rest > 0) { m.rest--; return; }
      if (Math.random() < 0.82) {
        A.pluck(SC[m.i] + (Math.random() < 0.15 ? 12 : 0), t, 0.15);
        if (Math.random() < 0.18) A.pluck(SC[m.i], t + spb / 2, 0.08);
        m.i = Math.max(0, Math.min(7, m.i + pick([-1, -1, 1, 1, 2, -2, 0])));
        if (b % 16 === 15) { m.i = 0; m.rest = 2 + Math.floor(Math.random() * 4); }
      }
    },
  },
  finale: {
    bpm: 72, sub: 2,
    play(A, b, t, spb) {
      const chords = [[43, 55, 59, 62], [40, 52, 55, 59], [36, 48, 55, 60], [38, 50, 57, 62]];
      const ch = chords[Math.floor(b / 8) % 4];
      if (b % 8 === 0) { A.pad(ch, t, spb * 8.5, 0.026); A.drum('tambu', t, 0.18); }
      if (b % 8 === 4) A.drum('tambu', t, 0.1);
      if (b % 2 === 1 && Math.random() < 0.6) A.pluck(ch[1 + (b % 3)] + 12, t, 0.08);
      if (b % 32 === 8) { const m = [79, 78, 76, 74, 76, 74, 71, 74]; m.forEach((n, i) => A.flute(n, t + i * spb * 1.5, spb * 1.3, 0.04)); }
    },
  },
};
