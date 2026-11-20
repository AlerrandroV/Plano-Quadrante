// Baralho francês em pixel art, usado pelo Pife, Poker e Solitário.
// Carta "code": 0..51 = naipe * 13 + (valor - 1); 52 = curinga.
// Naipes na ordem da plataforma: Ouros, Paus, Copas, Espadas.
//
// Cada carta é desenhada em 64x92 pixels (o dobro do tamanho em que ela
// aparece na mesa, 32x46): continua pixelada, mas com espaço para naipes
// bem diferentes (paus com três folhas redondas, espadas pontuda), os
// "pips" de verdade nas cartas de número e figuras no Valete, Dama e Rei.
// As mesas usam canvas em 2x (hiCanvas) para aproveitar esse detalhe.
import { PAL, drawText, textWidth } from './pixel.js';

export const CW = 32; // tamanho na mesa (unidades de arte)
export const CH = 46;
const W = 64; // resolução real de cada carta
const H = 92;
export const JOKER = 52;
export const SUITS4 = ['ouros', 'paus', 'copas', 'espadas'];
export const SUIT_NAME = ['Ouros', 'Paus', 'Copas', 'Espadas'];
export const RANK_LABEL = [null, 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RANK_NAME = [null, 'Ás', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valete', 'Dama', 'Rei'];

export const rankOf = (code) => (code === JOKER ? 0 : (code % 13) + 1);
export const suitOf = (code) => (code === JOKER ? -1 : Math.floor(code / 13));
export const isRed = (code) => suitOf(code) === 0 || suitOf(code) === 2;
export const codeOf = (suit, rank) => suit * 13 + rank - 1;
export function cardLabel(code) {
  if (code === JOKER) return 'Coringa';
  return `${RANK_NAME[rankOf(code)]} de ${SUIT_NAME[suitOf(code)]}`;
}

const RED = ['#ff9a9a', '#d8344f', '#8a1c2c'];
const BLACK = ['#7a8099', '#22253a', '#0e0f18'];
const ramp = (suit) => (suit === 0 || suit === 2 ? RED : BLACK);

// ---------------------------------------------------------- naipes
// Formas em coordenadas 0..1 (u para a direita, v para baixo).
const circ = (u, v, cx, cy, r) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
const stem = (u, v) => v >= 0.6 && v <= 0.97 && Math.abs(u - 0.5) <= 0.05 + Math.max(0, v - 0.78) * 0.95;
const SHAPES = [
  // Ouros: losango.
  (u, v) => Math.abs(u - 0.5) / 0.4 + Math.abs(v - 0.5) / 0.5 <= 1,
  // Paus: três folhas redondas + cabo.
  (u, v) => circ(u, v, 0.5, 0.27, 0.215) || circ(u, v, 0.265, 0.58, 0.215) || circ(u, v, 0.735, 0.58, 0.215)
    || circ(u, v, 0.5, 0.52, 0.14) || stem(u, v),
  // Copas: coração.
  (u, v) => circ(u, v, 0.29, 0.33, 0.235) || circ(u, v, 0.71, 0.33, 0.235)
    || (v >= 0.33 && v <= 0.96 && Math.abs(u - 0.5) <= (0.47 * (0.96 - v)) / 0.63),
  // Espadas: ponta em cima, dois lóbulos embaixo + cabo.
  (u, v) => circ(u, v, 0.29, 0.6, 0.215) || circ(u, v, 0.71, 0.6, 0.215)
    || (v >= 0.03 && v <= 0.62 && Math.abs(u - 0.5) <= (0.49 * (v - 0.03)) / 0.59) || stem(u, v),
];

const suitCache = new Map();
/** Sprite do naipe com N pixels (com brilho no alto à esquerda). */
function suitSprite(suit, N, color = null, flip = false) {
  const key = `${suit}:${N}:${color}:${flip}`;
  let c = suitCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = N; c.height = N;
  const g = c.getContext('2d');
  const R = color ? [color, color, color] : ramp(suit);
  const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N && SHAPES[suit]((x + 0.5) / N, ((flip ? N - 1 - y : y) + 0.5) / N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!inside(x, y)) continue;
      let col = R[1];
      if (N >= 11 && !color) {
        if (!inside(x - 1, y) || !inside(x, flip ? y + 1 : y - 1)) col = R[0]; // borda iluminada
        else if (!inside(x + 1, y) || !inside(x, flip ? y - 1 : y + 1)) col = R[2]; // borda na sombra
      }
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  suitCache.set(key, c);
  return c;
}

/**
 * Naipe na mesa: 7*scale unidades de arte de lado. Em canvas 2x, sai com o
 * dobro de pixels (mais definido).
 */
export function drawSuit4(g, x, y, suit, color = null, scale = 1) {
  const size = 7 * scale;
  const k = g.getTransform ? g.getTransform().a || 1 : 1;
  g.drawImage(suitSprite(suit, Math.round(size * k), color), x, y, size, size);
}

// ----------------------------------------------------------- cartas
const cardCache = new Map();
function cached(key, paint) {
  let c = cardCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    paint(g);
    cardCache.set(key, c);
  }
  return c;
}

/** Corpo: cantos arredondados, contorno, sombra embaixo e à direita. */
function body(g, fill, edge, shade) {
  const r = 4;
  const inRound = (x, y, w, h, rr) => {
    const cx = Math.min(Math.max(x, rr), w - 1 - rr);
    const cy = Math.min(Math.max(y, rr), h - 1 - rr);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr + 0.5;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inRound(x, y, W, H, r)) continue;
      const border = !inRound(x - 1, y, W, H, r) || !inRound(x + 1, y, W, H, r) || !inRound(x, y - 1, W, H, r) || !inRound(x, y + 1, W, H, r);
      g.fillStyle = border ? PAL.ink : (x >= W - 3 || y >= H - 3) ? shade : fill;
      if (!border && (x === 1 || y === 1)) g.fillStyle = edge;
      g.fillRect(x, y, 1, 1);
    }
  }
}

function drawSprite2(g, rows, x, y, colors, s = 1) {
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const col = colors[ch];
    if (!col) return;
    g.fillStyle = col;
    g.fillRect(x + c * s, y + r * s, s, s);
  }));
}

/** Valor e naipe no canto (o de baixo é o mesmo girado 180°). */
function corner(g, code) {
  const r = rankOf(code);
  const s = suitOf(code);
  const C = ramp(s);
  const label = RANK_LABEL[r];
  if (label === '10') {
    // "10" mais estreito, para caber no canto.
    drawText(g, '1', 1, 5, C[1], null, 2);
    drawText(g, '0', 10, 5, C[1], null, 2);
  } else {
    drawText(g, label, 5, 5, C[1], null, 2);
  }
  g.drawImage(suitSprite(s, 11), 4, 22);
}

// Posição dos pips: colunas (E, C, D) e linhas de 0 (topo) a 1 (base).
const L = 22;
const M = 32;
const Rr = 42;
const PIPS = {
  2: [[M, 0], [M, 1]],
  3: [[M, 0], [M, 0.5], [M, 1]],
  4: [[L, 0], [Rr, 0], [L, 1], [Rr, 1]],
  5: [[L, 0], [Rr, 0], [M, 0.5], [L, 1], [Rr, 1]],
  6: [[L, 0], [Rr, 0], [L, 0.5], [Rr, 0.5], [L, 1], [Rr, 1]],
  7: [[L, 0], [Rr, 0], [M, 0.25], [L, 0.5], [Rr, 0.5], [L, 1], [Rr, 1]],
  8: [[L, 0], [Rr, 0], [M, 0.25], [L, 0.5], [Rr, 0.5], [M, 0.75], [L, 1], [Rr, 1]],
  9: [[L, 0], [Rr, 0], [L, 1 / 3], [Rr, 1 / 3], [M, 0.5], [L, 2 / 3], [Rr, 2 / 3], [L, 1], [Rr, 1]],
  10: [[L, 0], [Rr, 0], [M, 1 / 6], [L, 1 / 3], [Rr, 1 / 3], [L, 2 / 3], [Rr, 2 / 3], [M, 5 / 6], [L, 1], [Rr, 1]],
};
const PIP = 13;
const PIP_TOP = 19; // centro da linha de cima
const PIP_BOT = 73; // centro da linha de baixo

// Figuras (metade de cima; a de baixo é a mesma girada).
const CROWN_K = ['..Y..Y..Y..', '.YYY.Y.YYY.', 'YYYYYYYYYYY', 'YRYYRYYRYYY', 'YYYYYYYYYYY'];
const CROWN_Q = ['....Y.Y....', '...YYYYY...', '..YYRYRYY..', '.YYYYYYYYY.', 'YYYYYYYYYYY'];
const CAP_J = ['...SSSSS...', '..SSSSSSS..', '.SSSSSSSSSF', 'SSSSSSSSSSF', '.....YY....'];

function face(g, code) {
  const r = rankOf(code);
  const s = suitOf(code);
  const C = ramp(s);
  // Moldura.
  const x0 = 13; const y0 = 9; const x1 = 51; const y1 = 83;
  g.fillStyle = C[1]; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = '#fff6dc'; g.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4);
  g.fillStyle = '#f2b84b'; g.fillRect(x0 + 2, (y0 + y1) / 2, x1 - x0 - 4, 1);
  // Metade de cima: chapéu/coroa, rosto, ombros com a cor do naipe.
  const cx = 32;
  const hat = r === 13 ? CROWN_K : r === 12 ? CROWN_Q : CAP_J;
  drawSprite2(g, hat, cx - 11, 14, { Y: '#f2b84b', R: '#d8344f', S: C[1], F: '#f2b84b' }, 2);
  // Rosto.
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    if ((x - 4.5) ** 2 / 25 + (y - 4.5) ** 2 / 25 > 1) continue;
    g.fillStyle = '#f4c9a0'; g.fillRect(cx - 5 + x, 25 + y, 1, 1);
  }
  g.fillStyle = PAL.ink; g.fillRect(cx - 3, 28, 2, 2); g.fillRect(cx + 1, 28, 2, 2);
  g.fillStyle = '#c96a5a'; g.fillRect(cx - 1, 32, 2, 1);
  if (r === 13) { g.fillStyle = '#8a5a2a'; g.fillRect(cx - 4, 33, 8, 3); } // barba do rei
  if (r === 12) { g.fillStyle = '#c98b3a'; g.fillRect(cx - 7, 26, 2, 9); g.fillRect(cx + 5, 26, 2, 9); } // cabelo da dama
  // Roupa: triângulo com a cor do naipe e enfeite dourado.
  for (let y = 0; y < 10; y++) {
    const half = 4 + y;
    g.fillStyle = y === 0 ? '#f2b84b' : C[y < 3 ? 0 : 1];
    g.fillRect(cx - half, 36 + y, half * 2, 1);
  }
  g.drawImage(suitSprite(s, 7, '#f4f4f4'), cx - 3, 39);
  // Metade de baixo: a mesma figura girada.
  g.save();
  g.beginPath(); g.rect(x0 + 2, (y0 + y1) / 2 + 1, x1 - x0 - 4, (y1 - y0) / 2 - 3); g.clip();
  g.translate(W, H); g.rotate(Math.PI);
  g.drawImage(g.canvas, 0, 0, W, H / 2, 0, 0, W, H / 2);
  g.restore();
}

function paintFace(g, code) {
  if (code === JOKER) return paintJoker(g);
  body(g, '#f7f7f2', '#ffffff', '#d4d6e0');
  const r = rankOf(code);
  const s = suitOf(code);
  if (r >= 11) face(g, code);
  else if (r === 1) {
    const big = 30;
    g.drawImage(suitSprite(s, big), (W - big) / 2, (H - big) / 2);
  } else {
    for (const [x, f] of PIPS[r]) {
      const y = PIP_TOP + f * (PIP_BOT - PIP_TOP);
      g.drawImage(suitSprite(s, PIP, null, f > 0.5), Math.round(x - PIP / 2), Math.round(y - PIP / 2));
    }
  }
  corner(g, code);
  g.save(); g.translate(W, H); g.rotate(Math.PI); corner(g, code); g.restore();
}

function paintJoker(g) {
  body(g, '#f7f7f2', '#ffffff', '#d4d6e0');
  const cols = ['#d8344f', '#f2b84b', '#38b764', '#3b6fd9', '#7e4fd6'];
  // Estrela grande colorida.
  const cx = W / 2; const cy = H / 2;
  for (let y = -20; y <= 20; y++) {
    for (let x = -20; x <= 20; x++) {
      const a = Math.atan2(y, x);
      const d = Math.hypot(x, y);
      const rr = 9 + 11 * Math.abs(Math.cos(2.5 * a));
      if (d > rr) continue;
      g.fillStyle = cols[Math.floor((d / 4 + (a + Math.PI) * 2)) % cols.length];
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  const star = (x, y) => { g.fillStyle = '#7e4fd6'; g.fillRect(x + 2, y, 2, 6); g.fillRect(x, y + 2, 6, 2); };
  star(5, 5); star(W - 11, H - 11);
}

function paintBack(g) {
  body(g, '#b8314a', '#d8485e', '#8a2238');
  g.fillStyle = '#d8485e';
  for (let y = 6; y < H - 6; y++) for (let x = 6; x < W - 6; x++) if ((x + y) % 6 === 0 || (x - y + 120) % 6 === 0) g.fillRect(x, y, 1, 1);
  g.fillStyle = PAL.white;
  g.fillRect(5, 5, W - 10, 2); g.fillRect(5, H - 7, W - 10, 2); g.fillRect(5, 5, 2, H - 10); g.fillRect(W - 7, 5, 2, H - 10);
  // Emblema: losango dourado com os 4 naipes.
  for (let y = -15; y <= 15; y++) {
    const w = 15 - Math.abs(y);
    g.fillStyle = Math.abs(y) >= 14 || w < 2 ? PAL.white : '#ffcd75';
    g.fillRect(W / 2 - w, H / 2 + y, w * 2 || 1, 1);
    if (w >= 2 && Math.abs(y) < 14) { g.fillStyle = PAL.white; g.fillRect(W / 2 - w, H / 2 + y, 1, 1); g.fillRect(W / 2 + w - 1, H / 2 + y, 1, 1); }
  }
  for (let s = 0; s < 4; s++) g.drawImage(suitSprite(s, 7), W / 2 - 7 + (s % 2) * 7, H / 2 - 7 + Math.floor(s / 2) * 7);
}

/**
 * Desenha uma carta (code, ou o verso com back) com o canto em (x, y), no
 * tamanho de mesa (32x46). glow: contorno colorido; dim: apagada.
 */
export function drawCard52(ctx, x, y, code, { back = false, glow = null, dim = false } = {}) {
  const img = back ? cached('back', paintBack) : cached(`c${code}`, (g) => paintFace(g, code));
  if (glow) {
    ctx.fillStyle = glow;
    ctx.fillRect(x - 1, y + 1, 1, CH - 2); ctx.fillRect(x + CW, y + 1, 1, CH - 2);
    ctx.fillRect(x + 1, y - 1, CW - 2, 1); ctx.fillRect(x + 1, y + CH, CW - 2, 1);
    ctx.fillRect(x - 2, y + 2, 1, CH - 4); ctx.fillRect(x + CW + 1, y + 2, 1, CH - 4);
    ctx.fillRect(x + 2, y - 2, CW - 4, 1); ctx.fillRect(x + 2, y + CH + 1, CW - 4, 1);
  }
  if (dim) { ctx.save(); ctx.globalAlpha = 0.5; }
  ctx.drawImage(img, x, y, CW, CH);
  if (dim) ctx.restore();
}

/** Lugar vazio (contorno tracejado), para pilhas e caixas. */
export function drawSlot(ctx, x, y, color = 'rgba(255,255,255,.28)') {
  ctx.fillStyle = color;
  for (let i = 2; i < CW - 2; i += 3) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i, y + CH - 1, 2, 1); }
  for (let i = 2; i < CH - 2; i += 3) { ctx.fillRect(x, y + i, 1, 2); ctx.fillRect(x + CW - 1, y + i, 1, 2); }
}

/** Mesa de feltro (fundo dos jogos de cartas). */
export function felt(g, w, h, base = '#1d4a3a', dark = '#163a2d') {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.fillStyle = dark;
  for (let y = 0; y < h; y += 3) for (let x = (y / 3) % 2; x < w; x += 3) g.fillRect(x, y, 1, 1);
}
