// Baralho francês em pixel art (2x), usado pelo Pife, Poker e Paciência.
// Carta "code": 0..51 = naipe * 13 + (valor - 1); 52 = curinga (melé).
// Naipes na ordem da plataforma: Ouros, Paus, Copas, Espadas.
import { PAL, drawSprite, drawText, textWidth } from './pixel.js';

export const CW = 32;
export const CH = 46;
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
  if (code === JOKER) return 'Melé (curinga)';
  return `${RANK_NAME[rankOf(code)]} de ${SUIT_NAME[suitOf(code)]}`;
}

const RED = ['#ff8a8a', '#d8344f', '#7a1c22'];
const BLACK = ['#6a7090', '#2a2d40', '#121320'];

// Naipes 7x7.
const SUIT_PX = [
  ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], // ouros
  ['..XXX..', '..XXX..', 'XXXXXXX', 'XXXXXXX', 'XX.X.XX', '...X...', '..XXX..'], // paus
  ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], // copas
  ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', '.X.X.X.', '..XXX..'], // espadas
];
const STAR = ['....X....', '....X....', '...XXX...', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '..XX.XX..', '.XX...XX.', '.X.....X.'];
const CROWN = ['X.X.X.X', 'XXXXXXX', 'XXXXXXX'];

/** Naipe 7x7 (scale 2 = 14x14). */
export function drawSuit4(g, x, y, suit, color = null, scale = 1) {
  const C = color || (suit === 0 || suit === 2 ? RED[1] : BLACK[1]);
  const rows = SUIT_PX[suit];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (rows[r][c] !== 'X') continue;
      g.fillStyle = C;
      g.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  }
}

const cache = new Map();
function cached(key, paint) {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = CW;
    c.height = CH;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    paint(g);
    cache.set(key, c);
  }
  return c;
}

function body(g, fill = PAL.white, edge = '#c9ccd8') {
  g.fillStyle = PAL.ink;
  g.fillRect(2, 0, CW - 4, CH); g.fillRect(0, 2, CW, CH - 4); g.fillRect(1, 1, CW - 2, CH - 2);
  g.fillStyle = fill;
  g.fillRect(2, 1, CW - 4, CH - 2); g.fillRect(1, 2, CW - 2, CH - 4);
  g.fillStyle = edge; // sombra de baixo/direita
  g.fillRect(2, CH - 2, CW - 4, 1); g.fillRect(CW - 2, 2, 1, CH - 4);
}

function paintFace(g, code) {
  body(g);
  if (code === JOKER) {
    // Melé: estrela colorida e cantos com estrelinha.
    const cols = ['#d8344f', '#f2b84b', '#38b764', '#3b6fd9'];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (STAR[r][c] !== 'X') continue;
        g.fillStyle = cols[(r + c) % 4];
        g.fillRect(7 + c * 2, 14 + r * 2, 2, 2);
      }
    }
    drawSprite(g, ['.X.', 'XXX', '.X.'], 3, 3, { X: '#7e4fd6' });
    drawSprite(g, ['.X.', 'XXX', '.X.'], CW - 6, CH - 6, { X: '#7e4fd6' });
    return;
  }
  const r = rankOf(code);
  const s = suitOf(code);
  const C = isRed(code) ? RED : BLACK;
  const label = RANK_LABEL[r];
  // Cantos: valor e naipe (em cima à esquerda, embaixo à direita).
  const lx = label.length > 1 ? 2 : 3;
  drawText(g, label, lx, 3, C[1]);
  drawSuit4(g, 3, 11, s);
  drawText(g, label, CW - 2 - textWidth(label) - (label.length > 1 ? 0 : 1), CH - 10, C[1]);
  drawSuit4(g, CW - 10, CH - 19, s);
  if (r >= 11) {
    // Figuras: moldura dourada, coroa e a letra grande.
    g.fillStyle = '#c98b3a'; g.fillRect(8, 9, 14, 28);
    g.fillStyle = '#fff3d0'; g.fillRect(9, 10, 12, 26);
    drawSprite(g, CROWN, 11, 12, { X: r === 11 ? '#9aa6c4' : '#f2b84b' });
    drawText(g, label, 10, 18, C[1], C[2], 2);
    return;
  }
  // Números e Ás: naipe grande no meio.
  drawSuit4(g, 9, 16, s, null, 2);
  if (r === 1) { g.fillStyle = C[0]; g.fillRect(13, 18, 2, 2); }
}

function paintBack(g) {
  body(g, '#b8314a', '#7a1c2c');
  g.fillStyle = '#d8485e';
  for (let y = 3; y < CH - 3; y++) for (let x = 3; x < CW - 3; x++) if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) g.fillRect(x, y, 1, 1);
  g.fillStyle = PAL.white;
  g.fillRect(3, 3, CW - 6, 1); g.fillRect(3, CH - 4, CW - 6, 1); g.fillRect(3, 3, 1, CH - 6); g.fillRect(CW - 4, 3, 1, CH - 6);
  // Losango central.
  for (let y = -7; y <= 7; y++) {
    const w = 7 - Math.abs(y);
    g.fillStyle = Math.abs(y) === 7 || w === 0 ? PAL.white : '#ffcd75';
    g.fillRect(CW / 2 - w, CH / 2 + y, w * 2 || 1, 1);
  }
}

/** Desenha uma carta (code, ou o verso com back) com o canto em (x, y). */
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
  ctx.drawImage(img, x, y);
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
