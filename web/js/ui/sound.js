// Efeitos sonoros "16 bits", sintetizados na hora com Web Audio (sem
// arquivos de áudio: funciona sem internet e não pesa no app).
//
//   sfx('dice')   sfx('place')   sfx('capture') ...
//
// O navegador só libera o som depois do primeiro toque na tela; até lá,
// os sons são ignorados em silêncio.
import { store } from './dom.js';

let ctx = null;
let master = null;
let muted = store.get('pq-mute') === '1';
const listeners = new Set();

function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  // Um "filtro de cartucho": corta o agudo áspero, como nos consoles.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7000;
  master.connect(lp).connect(ctx.destination);
  return ctx;
}

// Destrava o áudio no primeiro toque (regra dos navegadores).
for (const ev of ['pointerdown', 'keydown']) {
  window.addEventListener(ev, () => { const a = audio(); if (a?.state === 'suspended') a.resume(); }, { capture: true });
}

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  store.set('pq-mute', muted ? '1' : '0');
  for (const fn of listeners) fn(muted);
}
export function onMuteChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// ---------------------------------------------------------- síntese
function tone(t, { freq, to = null, dur = 0.1, type = 'square', vol = 0.6, duty = null }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  if (type === 'pulse' && duty) {
    // Onda de pulso estreita (som clássico de console), via PeriodicWave.
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    o.setPeriodicWave(ctx.createPeriodicWave(real, imag));
  } else {
    o.type = type === 'pulse' ? 'square' : type;
  }
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(t, { dur = 0.05, vol = 0.4, hp = 1000 }) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const notes = (t, list, step, opts) => list.forEach((f, i) => tone(t + i * step, { freq: f, dur: step * 1.6, ...opts }));

const SOUNDS = {
  click: (t) => tone(t, { freq: 880, dur: 0.04, type: 'pulse', duty: 0.25, vol: 0.25 }),
  select: (t) => tone(t, { freq: 660, to: 990, dur: 0.07, type: 'pulse', duty: 0.25, vol: 0.35 }),
  error: (t) => { tone(t, { freq: 220, dur: 0.09, vol: 0.35 }); tone(t + 0.1, { freq: 165, dur: 0.12, vol: 0.35 }); },
  // Dados chacoalhando.
  dice: (t) => { for (let i = 0; i < 7; i++) noise(t + i * 0.07, { dur: 0.04, vol: 0.35, hp: 2500 + Math.random() * 2000 }); },
  // Peça pousando.
  place: (t) => { tone(t, { freq: 520, to: 260, dur: 0.08, type: 'triangle', vol: 0.7 }); noise(t, { dur: 0.03, vol: 0.2, hp: 3000 }); },
  move: (t) => { tone(t, { freq: 330, to: 660, dur: 0.07, type: 'pulse', duty: 0.125, vol: 0.4 }); tone(t + 0.08, { freq: 494, dur: 0.06, type: 'triangle', vol: 0.5 }); },
  // Captura: queda + estalo.
  capture: (t) => { tone(t, { freq: 880, to: 110, dur: 0.22, type: 'square', vol: 0.45 }); noise(t + 0.05, { dur: 0.15, vol: 0.4, hp: 800 }); },
  levelup: (t) => notes(t, [523, 659, 784, 1047], 0.06, { type: 'pulse', duty: 0.25, vol: 0.4 }),
  card: (t) => notes(t, [784, 988, 1175], 0.05, { type: 'triangle', vol: 0.5 }),
  king: (t) => notes(t, [523, 784, 1047, 1568], 0.07, { type: 'pulse', duty: 0.5, vol: 0.4 }),
  // Peça de dominó batendo na mesa (clique de madeira).
  tile: (t) => { tone(t, { freq: 1800, to: 900, dur: 0.035, type: 'triangle', vol: 0.6 }); noise(t, { dur: 0.04, vol: 0.45, hp: 2000 }); tone(t + 0.03, { freq: 220, dur: 0.05, type: 'triangle', vol: 0.4 }); },
  draw: (t) => { noise(t, { dur: 0.09, vol: 0.3, hp: 4000 }); tone(t + 0.02, { freq: 600, to: 750, dur: 0.06, type: 'triangle', vol: 0.3 }); },
  pass: (t) => tone(t, { freq: 392, to: 262, dur: 0.15, type: 'triangle', vol: 0.4 }),
  points: (t) => notes(t, [988, 1319], 0.07, { type: 'pulse', duty: 0.25, vol: 0.45 }),
  turn: (t) => tone(t, { freq: 1047, dur: 0.06, type: 'pulse', duty: 0.125, vol: 0.25 }),
  win: (t) => {
    notes(t, [523, 659, 784, 1047, 784, 1047], 0.09, { type: 'pulse', duty: 0.25, vol: 0.4 });
    notes(t, [262, 330, 392, 523], 0.135, { type: 'triangle', vol: 0.5 });
  },
  lose: (t) => notes(t, [494, 466, 440, 349], 0.14, { type: 'triangle', vol: 0.5 }),
};

/** Toca um efeito. Ignora se estiver mudo ou se o áudio ainda não foi liberado. */
export function sfx(name) {
  if (muted) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  const fn = SOUNDS[name];
  if (fn) fn(a.currentTime + 0.01);
}

export const SOUND_NAMES = Object.keys(SOUNDS);
