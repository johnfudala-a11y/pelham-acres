// Pelham Acres — all sound is synthesized live with the Web Audio API:
// no audio files, works offline. iPad needs a first tap before sound can start.

let ctx = null, master, sfxBus, musicBus, noiseBuf;
const state = { music: true, sfx: true, started: false };

// A looping silent <audio> element switches iPhone/iPad into "media playback" mode,
// so the game is heard even when the phone's ring/silent switch is set to silent.
let keepAlive = null;
function silentWavUrl() {
  const sr = 8000, n = sr / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function startKeepAlive() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback'; // Safari 16.4+
  } catch (e) {}
  if (!keepAlive) {
    keepAlive = document.createElement('audio');
    keepAlive.src = silentWavUrl(); keepAlive.loop = true; keepAlive.setAttribute('playsinline', ''); keepAlive.volume = 0.01;
  }
  const p = keepAlive.play(); if (p && p.catch) p.catch(() => {});
}

export function initAudio(settings) {
  state.music = settings.music; state.sfx = settings.sfx;
  if (settings.vol) for (const k in vol) if (typeof settings.vol[k] === 'number') vol[k] = settings.vol[k];
  const unlock = () => {
    startKeepAlive();
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = state.sfx ? 0.55 * vol.sfx : 0; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = state.music ? MUSIC_VOL() : 0; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // iOS: play a silent buffer inside the gesture to fully unlock output
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
    }
    if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
    if (!state.started) { state.started = true; startMusic(); startAmbience(); }
    else if (recorded && state.music) songTick();   // iOS: resume the song inside a tap after coming back
    blessDecks();
  };
  // Safari only allows audio to start on "activation" events (touchend / click / pointerup), not touchstart.
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); keepAlive && keepAlive.pause(); decks.forEach(d => d.el.pause()); }
    // resuming needs a tap on iOS; the unlock listener handles that on the next touch
    else { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
  });
}
export const audioRunning = () => !!ctx && ctx.state === 'running';
export const audioStatus = () => ({ ctx: ctx ? ctx.state : 'none', time: ctx ? +ctx.currentTime.toFixed(1) : 0, musicBars: bar, song: live >= 0 ? decks[live].el.src.split('/').pop() : null, songAt: live >= 0 ? +decks[live].el.currentTime.toFixed(1) : 0, recorded, music: state.music, sfx: state.sfx });
export function setMusic(on) {
  state.music = on;
  if (musicBus) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL() : 0, ctx.currentTime, 0.3);
  // save battery: pause the recorded track while music is off, pick it back up when it's on
  if (!on) decks.forEach(d => d.el.pause()); else if (ctx) songTick();
}
// the recorded tracks are mastered louder than the old synth tune, so they sit a little lower
const MUSIC_VOL = () => (recorded ? 0.26 : 0.32) * vol.music;
export function setSfx(on) { state.sfx = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.55 * vol.sfx : 0, ctx.currentTime, 0.05); }
// volume sliders (0..1) for music, sound effects and the birdsong/cricket ambience
const vol = { music: 1, sfx: 1, amb: 1 };
export function setVolume(kind, v) {
  vol[kind] = Math.max(0, Math.min(1, v));
  if (!ctx) return;
  if (kind === 'music' && musicBus) musicBus.gain.setTargetAtTime(state.music ? MUSIC_VOL() : 0, ctx.currentTime, 0.1);
  if (kind === 'sfx' && sfxBus) sfxBus.gain.setTargetAtTime(state.sfx ? 0.55 * vol.sfx : 0, ctx.currentTime, 0.05);
  if (kind === 'amb' && ambBus) ambBus.gain.setTargetAtTime(0.35 * vol.amb, ctx.currentTime, 0.1);
}

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
  // a soft wooden click
  tap()     { if (!ok() || throttle('tap', 40)) return; const t = T(); noise(t, { dur: 0.025, vol: 0.16, freq: 1900, q: 6 }); tone(420, t, { type: 'sine', dur: 0.04, vol: 0.1, slideTo: 300 }); },
  // paper rustle plus a little chime (open), and a gentle tok (close)
  open()    { if (!ok()) return; const t = T(); noise(t, { dur: 0.12, vol: 0.07, type: 'highpass', freq: 3500 }); bell(88, t + 0.03, 0.05); },
  close()   { if (!ok()) return; const t = T(); noise(t, { dur: 0.08, vol: 0.06, type: 'highpass', freq: 3000 }); tone(330, t + 0.02, { type: 'sine', dur: 0.06, vol: 0.09, slideTo: 250 }); },
  plant()   { if (!ok() || throttle('plant', 60)) return; const t = T(); noise(t, { dur: 0.08, vol: 0.18, type: 'lowpass', freq: 500 }); tone(220, t, { type: 'sine', dur: 0.1, vol: 0.2, slideTo: 140 }); },
  harvest() { if (!ok() || throttle('harvest', 70)) return; const t = T(), base = 72 + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)]; noise(t, { dur: 0.06, vol: 0.12, freq: 3000, q: 0.7 }); pluck(base, t + 0.01, 0.2); pluck(base + 7, t + 0.07, 0.14); },
  // two bright little bell tones, like coins landing in a jar
  coin()    { if (!ok() || throttle('coin', 60)) return; const t = T(); bell(91, t, 0.07); bell(96, t + 0.07, 0.06); noise(t + 0.07, { dur: 0.04, vol: 0.05, freq: 6000, q: 3 }); },
  collect() { if (!ok() || throttle('collect', 80)) return; const t = T(); [76, 79, 84].forEach((m, i) => pluck(m, t + i * 0.06, 0.16)); },
  make()    { if (!ok()) return; const t = T(); for (let i = 0; i < 3; i++) noise(t + i * 0.07, { dur: 0.05, vol: 0.1, freq: 900 + i * 200, q: 4 }); tone(330, t, { type: 'triangle', dur: 0.2, vol: 0.1, slideTo: 440 }); },
  build()   { if (!ok()) return; const t = T(); [0, 0.12, 0.24].forEach((d, i) => { noise(t + d, { dur: 0.07, vol: 0.25, freq: 700 - i * 80, q: 3 }); tone(180 - i * 15, t + d, { type: 'sine', dur: 0.08, vol: 0.2 }); }); pluck(79, t + 0.36, 0.15); pluck(84, t + 0.44, 0.15); },
  clear()   { if (!ok()) return; const t = T(); noise(t, { dur: 0.25, vol: 0.25, type: 'lowpass', freq: 2000, freqTo: 300 }); noise(t + 0.18, { dur: 0.3, vol: 0.18, type: 'lowpass', freq: 600, freqTo: 150 }); },
  deliver() { if (!ok()) return; const t = T(); [72, 76, 79, 84].forEach((m, i) => pluck(m, t + i * 0.08, 0.17)); this.coin(); },
  levelUp() { if (!ok()) return; const t = T(); [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => pluck(m, t + i * 0.09, 0.18, sfxBus, 0.5)); [72, 76, 79].forEach(m => tone(mtof(m), t + 0.7, { type: 'triangle', dur: 1.2, vol: 0.08, attack: 0.05 })); },
  // a soft, friendly "bonk" rather than a buzzer
  // a building lands: a soft wooden thud, then a little settling knock
  thunk()   { if (!ok()) return; const t = T(); tone(110, t, { type: 'sine', dur: 0.22, vol: 0.32, slideTo: 55 }); noise(t, { dur: 0.12, vol: 0.22, type: 'lowpass', freq: 450 }); noise(t + 0.13, { dur: 0.05, vol: 0.12, freq: 900, q: 4 }); tone(190, t + 0.13, { type: 'sine', dur: 0.06, vol: 0.1 }); },
  // the ghost snaps to a new square while you drag it
  tick()    { if (!ok() || throttle('tick', 45)) return; const t = T(); noise(t, { dur: 0.018, vol: 0.08, freq: 2600, q: 5 }); },
  // a story chapter finished: a warmer, longer flourish than a level-up
  fanfare() { if (!ok()) return; const t = T(); [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79, 84]].forEach((ch, i) => ch.forEach((m, j) => pluck(m, t + i * 0.32 + j * 0.03, 0.15, sfxBus, i === 3 ? 1.6 : 0.5))); [72, 76, 79].forEach(m => tone(mtof(m), t + 0.96, { type: 'triangle', dur: 1.8, vol: 0.07, attack: 0.08 })); bell(96, t + 1.0, 0.05); bell(100, t + 1.15, 0.04); },
  error()   { if (!ok() || throttle('error', 300)) return; const t = T(); tone(240, t, { type: 'sine', dur: 0.14, vol: 0.18, slideTo: 170 }); noise(t, { dur: 0.05, vol: 0.06, type: 'lowpass', freq: 600 }); },
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
// a small bell: a few inharmonic sine partials that ring and fade
function bell(m, t, vol = 0.08, bus = sfxBus) {
  const f = mtof(m);
  [[1, 1, 0.5], [2.76, 0.4, 0.3], [5.4, 0.18, 0.18]].forEach(([r, v, d]) => tone(f * r, t, { type: 'sine', dur: d, vol: vol * v, attack: 0.002, bus }));
}

// ---------- ambience: birdsong by day, crickets at night (very quiet, follows the device clock) ----------
let ambBus = null, ambTimer = null;
function ambience() {
  if (!ctx || ctx.state !== 'running' || !state.sfx) return;
  if (!(vol.amb > 0)) return;
  if (!ambBus) { ambBus = ctx.createGain(); ambBus.gain.value = 0.35 * vol.amb; ambBus.connect(master); }
  const h = new Date().getHours() + new Date().getMinutes() / 60, t = ctx.currentTime + 0.05;
  if (h >= 6 && h < 19.5) {
    if (Math.random() < 0.45) {   // a little songbird phrase: 2-5 quick rising/falling chirps
      const base = 2200 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) tone(base * (1 + (Math.random() - 0.5) * 0.25), t + i * 0.11, { type: 'sine', dur: 0.06, vol: 0.05, attack: 0.004, slideTo: base * (Math.random() < 0.5 ? 1.35 : 0.75), bus: ambBus });
    }
  } else if (h >= 20.5 || h < 5) {
    for (let i = 0; i < 3; i++) {   // crickets: short pulsed chirps
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4600; f.Q.value = 18;
      const g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(ambBus);
      const st = t + i * 0.09; env(g, st, 0.005, 0.22, 0.05); s.start(st, Math.random() * 0.5); s.stop(st + 0.08);
    }
  }
}
function startAmbience() { if (!ambTimer) ambTimer = setInterval(ambience, 3200); }

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

// ---------- recorded soundtrack ----------
// Two daytime tracks take turns; a gentle lullaby plays in the evening and at night (device clock).
// Tracks stream through <audio> elements (light on memory) routed into the music volume, and crossfade.
// If they can't load (e.g. offline before they were ever downloaded), the generative tune below plays instead.
const TRACKS = { day: ['music/day1.mp3', 'music/day2.mp3'], night: ['music/night.mp3'] };
const FADE = 3.5;
let decks = [], live = -1, dayIdx = 0, recorded = true, songTimer = null, lastMode = null;
const modeNow = () => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h >= 6 && h < 19.75 ? 'day' : 'night'; };
function makeDeck() {
  const el = new Audio(); el.preload = 'auto'; el.setAttribute('playsinline', ''); el.crossOrigin = 'anonymous';
  const src = ctx.createMediaElementSource(el), g = ctx.createGain(); g.gain.value = 0;
  src.connect(g); g.connect(musicBus);
  el.addEventListener('error', () => {
    if (!recorded) return;
    recorded = false; decks.forEach(d => d.el.pause());
    if (state.music) musicBus.gain.setTargetAtTime(MUSIC_VOL(), ctx.currentTime, 0.3);
    startGenerative();
  });
  return { el, g };
}
// iOS only lets an <audio> element play from a timer once it has played inside a tap,
// so on the first tap, briefly start the spare deck silently too.
let blessed = false;
function blessDecks() {
  if (blessed || !recorded || !decks.length) return;
  blessed = true;
  decks.forEach((d, i) => {
    if (i === live) return;
    if (!d.el.src) d.el.src = TRACKS.day[1];
    const p = d.el.play();
    const stop = () => { if (i !== live) d.el.pause(); };
    if (p && p.then) p.then(stop, () => { blessed = false; }); else stop();
  });
}
function nextSrc(mode) { if (mode === 'night') return TRACKS.night[0]; const s = TRACKS.day[dayIdx % TRACKS.day.length]; dayIdx++; return s; }
// fade the current track out and the next one in
function playSong(mode) {
  if (!ctx || !recorded) return;
  if (!decks.length) decks = [makeDeck(), makeDeck()];
  const t = ctx.currentTime, next = (live + 1) % 2, d = decks[next];
  lastMode = mode;
  d.el.src = nextSrc(mode); d.el.currentTime = 0;
  const p = d.el.play(); if (p && p.catch) p.catch(() => {});
  d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(0.0001, t); d.g.gain.exponentialRampToValueAtTime(1, t + FADE);
  if (live >= 0) {
    const o = decks[live]; o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(Math.max(0.0001, o.g.gain.value), t); o.g.gain.exponentialRampToValueAtTime(0.0001, t + FADE);
    setTimeout(() => { if (decks[live] !== o) o.el.pause(); }, FADE * 1000 + 200);
  }
  live = next;
}
// every couple of seconds: start the next song shortly before this one ends, or switch for day/night
function songTick() {
  if (!ctx || ctx.state !== 'running' || !recorded || !state.music) return;
  const mode = modeNow();
  if (live < 0 || mode !== lastMode) return playSong(mode);
  const el = decks[live].el;
  if (el.duration && el.currentTime > el.duration - FADE - 0.5) playSong(mode);
  else if (el.paused) { const p = el.play(); if (p && p.catch) p.catch(() => {}); }   // resume after a pause/interruption
}
function startMusic() {
  if (!ctx) return;
  if (recorded) { if (!songTimer) songTimer = setInterval(songTick, 2000); songTick(); return; }
  startGenerative();
}
function startGenerative() {
  if (!ctx || timer) return;
  nextBar = ctx.currentTime + 0.3;
  timer = setInterval(schedule, 250);
}
function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.1; // after a pause, don't burst-play missed bars
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
