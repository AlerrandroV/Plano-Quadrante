// Efeitos visuais da Última Carta: uma camada por cima da mesa onde os
// símbolos e as cartas voam entre a roda, o monte e os jogadores.
//
//   skip    -> símbolo de bloqueio sai do meio da roda e vai até quem perde a vez
//   hit     -> "+2"/"+4" sai do meio da roda e vai até quem vai comprar
//   reverse -> símbolo de reverso surge no meio, gira no novo sentido e some
//   draw    -> cartas saem do monte, uma a uma, até a mão de quem compra
//
// As regras já entregam o estado final; aqui só se mostra o caminho. Enquanto
// as cartas voam, o contador da mão (e as cartas novas na SUA mão) só
// aparecem quando cada carta chega.
import { PAL, pixelCanvas, drawText, textWidth } from '../../ui/pixel.js';
import { sfx } from '../../ui/sound.js';
import { drawCard, CARD_W, CARD_H, SUIT_RAMP, PULA, VOLTA } from './cards.js';

// Tempos (ms). Também usados para os robôs esperarem a animação acabar.
export const T = {
  start: 260, // depois da carta pousar no descarte
  pop: 220, fly: 460, stamp: 260, // bloqueio e +2/+4
  spin: 760, fade: 260, // reverso
  card: 300, // voo de cada carta
  slow: 330, fast: 130, // intervalo entre as cartas (compra normal / castigo)
};

/** Quanto tempo os efeitos de um estado levam para terminar. */
export function effectsTime(list = []) {
  if (!list?.length) return 0;
  let t = T.start;
  for (const e of list) {
    if (e.t === 'skip' || e.t === 'hit') t += T.pop + T.fly + T.stamp;
    else if (e.t === 'reverse') t += T.pop + T.spin + T.fade;
    else if (e.t === 'draw') t += (e.n - 1) * (e.fast ? T.fast : T.slow) + T.card + 60;
  }
  return t;
}

const FX = {
  queue: [], running: false, layer: null, seq: -1,
  pending: {}, // cartas ainda "no ar" por jogador (o contador desconta)
  hidden: [], // cartas novas da SUA mão que ainda não chegaram
  geo: null, onLand: null,
};

/** Quantas cartas do jogador i ainda estão voando. */
export const inFlight = (i) => FX.pending[i] || 0;
export const totalInFlight = () => Object.values(FX.pending).reduce((a, b) => a + b, 0);
export const isHidden = (id) => FX.hidden.includes(id);
export const arriving = () => FX.hidden.length;

/**
 * Chame a cada render. geo: funções de posição na tela; onLand: redesenha
 * (contadores e mão) quando uma carta chega.
 */
export function feed(state, meIdx, geo, onLand) {
  FX.geo = geo;
  FX.onLand = onLand;
  if (state.seq < FX.seq) { reset(); FX.seq = -1; } // partida nova
  // Anima o que é novo; na primeira tela, só o efeito da carta virada.
  const fresh = state.seq > FX.seq && (FX.seq >= 0 || state.last?.kind === 'start');
  FX.seq = state.seq;
  if (!fresh || !state.fx?.length) return;
  for (const e of state.fx) {
    if (e.t !== 'draw') continue;
    FX.pending[e.pid] = (FX.pending[e.pid] || 0) + e.n;
    if (e.pid === meIdx) {
      // As compradas são as últimas da mão (na ordem em que saíram do monte).
      const hand = state.players[meIdx].hand;
      FX.hidden.push(...hand.slice(-e.n).filter((id) => !FX.hidden.includes(id)));
    }
  }
  FX.queue.push(...state.fx.map((e) => ({ ...e, me: meIdx })));
  run();
}

export function reset() {
  FX.queue = [];
  FX.pending = {};
  FX.hidden = [];
  FX.layer?.replaceChildren();
}

function layer() {
  if (!FX.layer || !FX.layer.isConnected) {
    FX.layer = document.createElement('div');
    FX.layer.className = 'uc-fx-layer';
    FX.layer.setAttribute('aria-hidden', 'true');
    document.body.append(FX.layer);
  }
  return FX.layer;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = () => FX.geo?.alive();

async function run() {
  if (FX.running) return;
  FX.running = true;
  await wait(T.start);
  while (FX.queue.length) {
    if (!alive()) { reset(); break; }
    const e = FX.queue.shift();
    try {
      if (e.t === 'skip' || e.t === 'hit') await fly(e);
      else if (e.t === 'reverse') await reverse(e);
      else if (e.t === 'draw') await draws(e);
    } catch { /* animação interrompida (ex.: saiu da partida) */ }
  }
  FX.running = false;
}

// ------------------------------------------------------------ sprites

/** Canvas pixelado posicionado na camada, centrado em (x, y). */
function place(canvas, scale, x, y) {
  const w = canvas.width * scale;
  const hh = canvas.height * scale;
  Object.assign(canvas.style, { width: `${w}px`, height: `${hh}px`, left: `${x - w / 2}px`, top: `${y - hh / 2}px` });
  layer().append(canvas);
  return canvas;
}

/** Disco de 30x30 na cor do naipe (ou nas 4 cores, para o +4). */
function badge(c, paintInside) {
  const S = 30;
  const cv = pixelCanvas(S, S, 'uc-fx');
  const g = cv.getContext('2d');
  const keys = Object.keys(SUIT_RAMP);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - S / 2;
      const dy = y + 0.5 - S / 2;
      const d = Math.hypot(dx, dy);
      if (d > 14.5) continue;
      const ramp = c ? SUIT_RAMP[c] : SUIT_RAMP[keys[(dx < 0 ? 0 : 1) + (dy < 0 ? 0 : 2)]];
      g.fillStyle = d > 13 ? PAL.ink : d > 11.6 ? PAL.white : (dx + dy < -12 ? ramp[0] : ramp[1]);
      g.fillRect(x, y, 1, 1);
    }
  }
  paintInside(g, S);
  return cv;
}

/** Sprite 11x11 em dobro (22x22) no meio do disco. */
function bigSprite(g, rows, S, color, flip = false) {
  const o = (S - 22) / 2;
  rows.forEach((row, r) => [...row].forEach((ch, col) => {
    if (ch !== 'X') return;
    const cx = flip ? 10 - col : col;
    g.fillStyle = PAL.ink; g.fillRect(o + cx * 2 + 1, o + r * 2 + 1, 2, 2);
  }));
  rows.forEach((row, r) => [...row].forEach((ch, col) => {
    if (ch !== 'X') return;
    const cx = flip ? 10 - col : col;
    g.fillStyle = color; g.fillRect(o + cx * 2, o + r * 2, 2, 2);
  }));
}

function symbol(e) {
  if (e.t === 'skip') return badge(e.c, (g, S) => bigSprite(g, PULA, S, PAL.white));
  if (e.t === 'reverse') return badge(e.c, (g, S) => bigSprite(g, VOLTA, S, PAL.white, e.dir < 0));
  const txt = `+${e.n}`;
  const scale = txt.length > 2 ? 1 : 2;
  return badge(e.c, (g, S) => drawText(g, txt, Math.round((S - textWidth(txt, scale)) / 2), Math.round((S - 7 * scale) / 2), PAL.white, PAL.ink, scale));
}

// ------------------------------------------------------------ efeitos

/** Bloqueio / +2 / +4: do meio da roda até o jogador. */
async function fly(e) {
  const k = FX.geo.scale();
  const from = FX.geo.center();
  const to = FX.geo.seat(e.target, e.me);
  const el = place(symbol(e), k, from.x, from.y);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  sfx(e.t === 'hit' ? 'king' : 'select');
  await el.animate([
    { transform: 'scale(0.1) rotate(-90deg)', opacity: 0 },
    { transform: 'scale(1.7) rotate(0deg)', opacity: 1 },
  ], { duration: T.pop, easing: 'cubic-bezier(.2,1.6,.5,1)', fill: 'forwards' }).finished;
  await el.animate([
    { transform: 'translate(0,0) scale(1.7)' },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(1.4)`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(1.1)` },
  ], { duration: T.fly, easing: 'ease-in-out', fill: 'forwards' }).finished;
  FX.geo.shake(e.target, e.me);
  sfx(e.t === 'hit' ? 'capture' : 'pass');
  await el.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) scale(2.2)`, opacity: 0 },
  ], { duration: T.stamp, easing: 'ease-out', fill: 'forwards' }).finished;
  el.remove();
}

/** Reverso: surge no meio da roda, gira no novo sentido e some. */
async function reverse(e) {
  const k = FX.geo.scale();
  const c = FX.geo.center();
  const el = place(symbol(e), k, c.x, c.y);
  const turn = e.dir > 0 ? 360 : -360; // sentido horário = dir 1 (como as setas da roda)
  sfx('select');
  await el.animate([
    { transform: 'scale(0.1)', opacity: 0 },
    { transform: 'scale(2)', opacity: 1 },
  ], { duration: T.pop, easing: 'cubic-bezier(.2,1.6,.5,1)', fill: 'forwards' }).finished;
  sfx('levelup');
  await el.animate([
    { transform: 'scale(2) rotate(0deg)' },
    { transform: `scale(2.3) rotate(${turn}deg)` },
  ], { duration: T.spin, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' }).finished;
  await el.animate([
    { transform: `scale(2.3) rotate(${turn}deg)`, opacity: 1 },
    { transform: `scale(0.2) rotate(${turn * 1.25}deg)`, opacity: 0 },
  ], { duration: T.fade, easing: 'ease-in', fill: 'forwards' }).finished;
  el.remove();
}

/** Compra: as cartas saem do monte uma a uma. */
async function draws(e) {
  const gap = e.fast ? T.fast : T.slow;
  const flights = [];
  for (let i = 0; i < e.n; i++) {
    if (!alive()) throw new Error('fora da tela');
    flights.push(oneCard(e));
    if (i < e.n - 1) await wait(gap);
  }
  await Promise.all(flights);
}

async function oneCard(e) {
  const k = FX.geo.scale();
  const from = FX.geo.deck();
  const to = FX.geo.seat(e.pid, e.me, true);
  const cv = pixelCanvas(CARD_W, CARD_H, 'uc-fx');
  drawCard(cv.getContext('2d'), 0, 0, 0, { back: true });
  const el = place(cv, k, from.x, from.y);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const tilt = (Math.random() - 0.5) * 30;
  sfx('draw');
  try {
    await el.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)' },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 24}px) scale(1.12) rotate(${tilt}deg)`, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.7) rotate(${tilt * 2}deg)`, opacity: 0.9 },
    ], { duration: T.card, easing: 'ease-in', fill: 'forwards' }).finished;
  } finally {
    el.remove();
    // Chegou: o contador sobe e, se for a sua mão, a carta aparece.
    FX.pending[e.pid] = Math.max(0, (FX.pending[e.pid] || 0) - 1);
    if (!FX.pending[e.pid]) delete FX.pending[e.pid];
    if (e.pid === e.me) FX.hidden.shift();
    FX.onLand?.();
  }
}
