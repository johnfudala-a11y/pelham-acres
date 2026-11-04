// Pelham Acres — all sound is synthesized live with the Web Audio API:
// no audio files, works offline. iPad needs a first tap before sound can start.

let ctx = null, master, sfxBus, musicBus, noiseBuf;
const state = { music: true, sfx: true, started: false };

export function initAudio(settings) {
  state.music = settings.music; state.sfx = settings.sfx;
  const unlock = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = state.sfx ? 0.55 : 0; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = state.music ? 0.32 : 0; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // iOS: play a silent buffer inside the gesture to fully unlock output
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
    }
    if (ctx.state !== 'running') ctx.resume();
    if (!state.started) { state.started = true; startMusic(); }
  };
  for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
}
export const audioStatus = () => ({ ctx: ctx ? ctx.state : 'none', time: ctx ? +ctx.currentTime.toFixed(1) : 0, musicBars: bar, music: state.music, sfx: state.sfx });
export function setMusic(on) { state.music = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.3); }
export function setSfx(on) { state.sfx = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05); }

// ---------- building blocks ----------
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}
function tone(freq, t, { type = 'triangle', dur = 0.3, vol = 0.3, attack = 0.005, bus = sfxBus, slideTo = null, filter = null } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  let node = o;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  node.connect(g); g.connect(bus);
  env(g, t, attack, vol, dur);
  o.start(t); o.stop(t + attack + dur + 0.05);
}
function noise(t, { dur = 0.15, vol = 0.2, type = 'bandpass', freq = 1200, q = 1, freqTo = null } = {}) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = ctx.createGain();
  s.connect(f); f.connect(g); g.connect(sfxBus);
  env(g, t, 0.004, vol, dur);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function pluck(m, t, vol = 0.22, bus = sfxBus, dur = 0.35) {
  tone(mtof(m), t, { type: 'triangle', dur, vol, bus });
  tone(mtof(m + 12), t, { type: 'sine', dur: dur * 0.6, vol: vol * 0.35, bus });
}
const T = () => ctx ? ctx.currentTime + 0.01 : 0;
const ok = () => ctx && state.sfx;

// ---------- sound effects ----------
let lastSfx = {};
function throttle(name, ms) { const n = performance.now(); if (n - (lastSfx[name] || 0) < ms) return true; lastSfx[name] = n; return false; }

export const sfx = {
  tap()     { if (!ok() || throttle('tap', 40)) return; tone(900, T(), { type: 'sine', dur: 0.05, vol: 0.12, slideTo: 600 }); },
  open()    { if (!ok()) return; const t = T(); tone(520, t, { type: 'sine', dur: 0.08, vol: 0.12 }); tone(780, t + 0.05, { type: 'sine', dur: 0.1, vol: 0.1 }); },
  close()   { if (!ok()) return; const t = T(); tone(700, t, { type: 'sine', dur: 0.08, vol: 0.1 }); tone(470, t + 0.05, { type: 'sine', dur: 0.1, vol: 0.08 }); },
  plant()   { if (!ok() || throttle('plant', 60)) return; const t = T(); noise(t, { dur: 0.08, vol: 0.18, type: 'lowpass', freq: 500 }); tone(220, t, { type: 'sine', dur: 0.1, vol: 0.2, slideTo: 140 }); },
  harvest() { if (!ok() || throttle('harvest', 70)) return; const t = T(), base = 72 + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)]; noise(t, { dur: 0.06, vol: 0.12, freq: 3000, q: 0.7 }); pluck(base, t + 0.01, 0.2); pluck(base + 7, t + 0.07, 0.14); },
  coin()    { if (!ok() || throttle('coin', 60)) return; const t = T(); tone(mtof(88), t, { type: 'square', dur: 0.08, vol: 0.06, filter: 4000 }); tone(mtof(93), t + 0.07, { type: 'square', dur: 0.25, vol: 0.06, filter: 4000 }); },
  collect() { if (!ok() || throttle('collect', 80)) return; const t = T(); [76, 79, 84].forEach((m, i) => pluck(m, t + i * 0.06, 0.16)); },
  make()    { if (!ok()) return; const t = T(); for (let i = 0; i < 3; i++) noise(t + i * 0.07, { dur: 0.05, vol: 0.1, freq: 900 + i * 200, q: 4 }); tone(330, t, { type: 'triangle', dur: 0.2, vol: 0.1, slideTo: 440 }); },
  build()   { if (!ok()) return; const t = T(); [0, 0.12, 0.24].forEach((d, i) => { noise(t + d, { dur: 0.07, vol: 0.25, freq: 700 - i * 80, q: 3 }); tone(180 - i * 15, t + d, { type: 'sine', dur: 0.08, vol: 0.2 }); }); pluck(79, t + 0.36, 0.15); pluck(84, t + 0.44, 0.15); },
  clear()   { if (!ok()) return; const t = T(); noise(t, { dur: 0.25, vol: 0.25, type: 'lowpass', freq: 2000, freqTo: 300 }); noise(t + 0.18, { dur: 0.3, vol: 0.18, type: 'lowpass', freq: 600, freqTo: 150 }); },
  deliver() { if (!ok()) return; const t = T(); [72, 76, 79, 84].forEach((m, i) => pluck(m, t + i * 0.08, 0.17)); this.coin(); },
  levelUp() { if (!ok()) return; const t = T(); [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => pluck(m, t + i * 0.09, 0.18, sfxBus, 0.5)); [72, 76, 79].forEach(m => tone(mtof(m), t + 0.7, { type: 'triangle', dur: 1.2, vol: 0.08, attack: 0.05 })); },
  error()   { if (!ok() || throttle('error', 300)) return; const t = T(); tone(180, t, { type: 'square', dur: 0.12, vol: 0.06, filter: 900 }); tone(150, t + 0.13, { type: 'square', dur: 0.16, vol: 0.06, filter: 900 }); },
  hourglass() { if (!ok()) return; const t = T(); for (let i = 0; i < 8; i++) tone(mtof(84 + i * 2), t + i * 0.035, { type: 'sine', dur: 0.08, vol: 0.08 }); },
  // farm animals
  cluck()   { if (!ok() || throttle('animal', 400)) return; const t = T(); [0, 0.11].forEach(d => tone(600, t + d, { type: 'sawtooth', dur: 0.07, vol: 0.06, slideTo: 380, filter: 1800 })); },
  moo()     { if (!ok() || throttle('animal', 400)) return; tone(140, T(), { type: 'sawtooth', dur: 0.7, vol: 0.09, attack: 0.08, slideTo: 110, filter: 700 }); },
  baa()     { if (!ok() || throttle('animal', 400)) return; const t = T(); const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter();
              o.type = 'sawtooth'; o.frequency.value = 300; lfo.frequency.value = 22; lg.gain.value = 25; lfo.connect(lg); lg.connect(o.frequency); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2;
              o.connect(f); f.connect(g); g.connect(sfxBus); env(g, t, 0.04, 0.18, 0.5); o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6); },
  // the cats
  meow(big) { if (!ok() || throttle('meow', 250)) return; meow(T(), big); },
  purr()    { if (!ok()) return; const t = T(); const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
              const g = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain(); am.frequency.value = 26; ag.gain.value = 0.22; am.connect(ag); ag.connect(g.gain);
              s.connect(f); f.connect(g); g.connect(sfxBus); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
              s.start(t); am.start(t); s.stop(t + 1.7); am.stop(t + 1.7); },
  zoomies() { if (!ok()) return; const t = T(); for (let i = 0; i < 5; i++) tone(500 + i * 120, t + i * 0.06, { type: 'sine', dur: 0.05, vol: 0.08, slideTo: 900 + i * 150 }); meow(t + 0.35, false); },
};
function meow(t, big) {
  // cat-like vowel: sawtooth through two moving formant filters
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  const p0 = big ? 380 : 620, p1 = big ? 520 : 900, len = big ? 0.75 : 0.38;
  o.frequency.setValueAtTime(p0, t); o.frequency.linearRampToValueAtTime(p1, t + len * 0.35); o.frequency.linearRampToValueAtTime(p0 * 0.8, t + len);
  const out = ctx.createGain();
  for (const [a, b, q] of [[700, 1300, 6], [1600, 2600, 8]]) {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(a, t); f.frequency.linearRampToValueAtTime(b, t + len * 0.4); f.frequency.linearRampToValueAtTime(a * 0.9, t + len);
    o.connect(f); f.connect(out);
  }
  const g = ctx.createGain(); out.connect(g); g.connect(sfxBus);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(big ? 0.5 : 0.4, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.start(t); o.stop(t + len + 0.05);
}

// ---------- background music: a gentle, never-repeating country tune ----------
// Chords cycle through a few cozy progressions; a guitar-like pluck picks a melody
// from the major pentatonic, over soft pads and a walking bass.
const PROGS = [
  [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], // C G Am F
  [[53, 57, 60], [60, 64, 67], [55, 59, 62], [60, 64, 67]], // F C G C
  [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], // C Am F G
];
const PENTA = [0, 2, 4, 7, 9];
let nextBar = 0, bar = 0, prog = PROGS[0], timer = null, lastMel = 72;
const BPM = 82, BEAT = 60 / BPM;

function startMusic() {
  if (!ctx || timer) return;
  nextBar = ctx.currentTime + 0.3;
  timer = setInterval(schedule, 250);
}
function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  while (nextBar < ctx.currentTime + 1.2) { playBar(nextBar); nextBar += BEAT * 4; bar++; }
}
function playBar(t) {
  if (bar % 8 === 0) prog = PROGS[Math.floor(Math.random() * PROGS.length)];
  const chord = prog[bar % 4];
  const rest = (bar % 16) >= 12; // breathe now and then
  // soft pad
  for (const m of chord) tone(mtof(m), t, { type: 'sine', dur: BEAT * 4, vol: 0.05, attack: 0.6, bus: musicBus });
  // bass: root on 1, fifth on 3
  pluck(chord[0] - 24, t, 0.2, musicBus, BEAT * 1.6);
  pluck(chord[0] - 17, t + BEAT * 2, 0.15, musicBus, BEAT * 1.4);
  // gentle strum on 2 and 4
  for (const b of [1, 3]) chord.forEach((m, i) => pluck(m, t + BEAT * b + i * 0.025, 0.05, musicBus, 0.6));
  if (rest) return;
  // melody: 8th-note grid, sparse, stepwise motion within C major pentatonic
  for (let s = 0; s < 8; s++) {
    if (Math.random() > (s % 2 ? 0.28 : 0.55)) continue;
    const opts = [];
    for (let oct = 72; oct <= 84; oct += 12) for (const p of PENTA) opts.push(oct + p);
    const near = opts.filter(m => Math.abs(m - lastMel) <= 4 && m !== lastMel);
    const chordTones = near.filter(m => chord.some(c => (m - c) % 12 === 0));
    const pool = s % 2 === 0 && chordTones.length ? chordTones : (near.length ? near : opts);
    lastMel = pool[Math.floor(Math.random() * pool.length)];
    pluck(lastMel, t + s * BEAT / 2, 0.11, musicBus, 0.5);
  }
}
