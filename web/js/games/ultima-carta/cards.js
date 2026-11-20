// Cartas da Última Carta em pixel art (2x): 32x46 cada, naipes próprios
// (chama, gota, folha, sol), feitas em código e guardadas em cache.
import { PAL, drawSprite, drawText, textWidth, mix } from '../../ui/pixel.js';
import { CARDS } from './rules.js';

export const CARD_W = 32;
export const CARD_H = 46;

// Cores de cada naipe: claro, base, escuro.
export const SUIT_RAMP = {
  chama: ['#ff9a8a', '#e0403a', '#7a1c22'],
  gota: ['#8cc8ff', '#3b74d9', '#1e3478'],
  folha: ['#b4ef7a', '#3aa95a', '#185a3c'],
  sol: ['#ffe27a', '#f29a26', '#8a4a12'],
};
const WILD = ['#4a4e6a', '#25283a', '#121320'];

// Naipes 9x9: X = cor, L = claro, D = escuro.
export const SUIT_SPRITES = {
  chama: [
    '....X....',
    '...XX....',
    '...XXX.X.',
    '..XXXX.X.',
    '.XXXLXXX.',
    '.XXLLLXX.',
    'XXLLWLLXX',
    'XXLLWLLXX',
    '.XXLLLXX.',
  ],
  gota: [
    '....X....',
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '..XWXXX..',
    '.XWLXXXX.',
    '.XLXXXXX.',
    '.XXXXXDX.',
    '..XXXDX..',
  ],
  folha: [
    '.....XXXX',
    '...XXXXXX',
    '..XXXXXLX',
    '.XXXXXLXX',
    '.XXXXLXXX',
    '.XXXLXXX.',
    '.XXLXXX..',
    '..LXXX...',
    '.L.......',
  ],
  sol: [
    'X...X...X',
    '.X..X..X.',
    '...XXX...',
    '..XWLXX..',
    'XXXLXXXXX',
    '..XXXXX..',
    '...XXX...',
    '.X..X..X.',
    'X...X...X',
  ],
};

// Símbolos 11x11 do Pula e do Volta.
export const PULA = [
  '...XXXXX...',
  '..XX...XX..',
  '.XX.....XX.',
  'XX.....XXX.',
  'X.....XX..X',
  'X....XX...X',
  'X...XX....X',
  '.XXXX....XX',
  '.XX.....XX.',
  '..XX...XX..',
  '...XXXXX...',
];
export const VOLTA = [
  '......X....',
  '......XX...',
  '.XXXXXXXX..',
  'XX....XX...',
  'X.....X....',
  'X.........X',
  '....X.....X',
  '...XX....XX',
  '..XXXXXXXX.',
  '...XX......',
  '....X......',
];

const cache = new Map();
function cached(key, paint) {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = CARD_W;
    c.height = CARD_H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    paint(g);
    cache.set(key, c);
  }
  return c;
}

export function drawSuit(g, x, y, suit, color = null) {
  const [L, X, D] = SUIT_RAMP[suit];
  drawSprite(g, SUIT_SPRITES[suit], x, y, { X: color || X, L: color ? color : L, D: color || D, W: color || '#ffffff' });
}

/** Corpo da carta (contorno arredondado, borda branca, miolo colorido). */
function frame(g, [L, B, D], back = false) {
  g.fillStyle = PAL.ink;
  g.fillRect(2, 0, CARD_W - 4, CARD_H); g.fillRect(0, 2, CARD_W, CARD_H - 4); g.fillRect(1, 1, CARD_W - 2, CARD_H - 2);
  g.fillStyle = back ? '#d7d0e8' : PAL.white;
  g.fillRect(2, 1, CARD_W - 4, CARD_H - 2); g.fillRect(1, 2, CARD_W - 2, CARD_H - 4);
  g.fillStyle = B;
  g.fillRect(3, 3, CARD_W - 6, CARD_H - 6);
  g.fillStyle = L; g.fillRect(3, 3, CARD_W - 6, 1); g.fillRect(3, 3, 1, CARD_H - 6);
  g.fillStyle = D; g.fillRect(3, CARD_H - 4, CARD_W - 6, 1); g.fillRect(CARD_W - 4, 3, 1, CARD_H - 6);
}

/** Oval branco no meio (inclinado em "degraus", como nas cartas clássicas de bar). */
function oval(g, fill) {
  const cx = CARD_W / 2;
  const cy = CARD_H / 2;
  for (let y = 6; y < CARD_H - 6; y++) {
    for (let x = 5; x < CARD_W - 5; x++) {
      const dx = (x + 0.5 - cx);
      const dy = (y + 0.5 - cy);
      // Elipse inclinada.
      const u = (dx * 0.94 + dy * 0.34) / 10.5;
      const v = (-dx * 0.34 + dy * 0.94) / 16;
      if (u * u + v * v <= 1) { g.fillStyle = typeof fill === 'function' ? fill(x, y) : fill; g.fillRect(x, y, 1, 1); }
    }
  }
}

function centerText(g, text, y, color, shadow, scale) {
  drawText(g, text, Math.round((CARD_W - textWidth(text, scale)) / 2), y, color, shadow, scale);
}

function paintFace(g, id) {
  const card = CARDS[id];
  if (card.c == null) return paintWild(g, card.k === 'mais4');
  const R = SUIT_RAMP[card.c];
  frame(g, R);
  // Naipe nos cantos (o oval passa por cima do que encostar nele).
  drawSuit(g, 4, 4, card.c, R[0]);
  drawSuit(g, CARD_W - 13, CARD_H - 13, card.c, R[0]);
  oval(g, PAL.white);
  if (card.k === 'n') {
    drawSuit(g, 12, 8, card.c);
    centerText(g, card.v, 19, R[1], R[2], 2);
  } else if (card.k === 'mais2') {
    drawSuit(g, 12, 8, card.c);
    drawText(g, '+', 7, 23, R[1], R[2], 1);
    drawText(g, '2', 14, 19, R[1], R[2], 2);
  } else {
    drawSprite(g, card.k === 'pula' ? PULA : VOLTA, 11, 18, { X: R[1] });
    drawSprite(g, card.k === 'pula' ? PULA : VOLTA, 10, 17, { X: R[2] });
  }
}

function paintWild(g, plus4) {
  frame(g, WILD);
  const keys = Object.keys(SUIT_RAMP);
  const cx = CARD_W / 2;
  const cy = CARD_H / 2;
  // Oval dividido nas quatro cores.
  oval(g, (x, y) => SUIT_RAMP[keys[(x < cx ? 0 : 1) + (y < cy ? 0 : 2)]][1]);
  if (plus4) {
    drawText(g, '+4', 5, 16, PAL.white, PAL.ink, 2);
    drawText(g, '+4', 4, 4, PAL.white, null, 1);
  } else {
    // Quatro mini naipes no oval.
    drawSuit(g, 6, 13, 'chama', PAL.white);
    drawSuit(g, 17, 13, 'gota', PAL.white);
    drawSuit(g, 6, 24, 'sol', PAL.white);
    drawSuit(g, 17, 24, 'folha', PAL.white);
  }
  // Canto: quadradinho de 4 cores.
  const sq = (x, y) => keys.forEach((k, i) => { g.fillStyle = SUIT_RAMP[k][1]; g.fillRect(x + (i % 2) * 3, y + Math.floor(i / 2) * 3, 3, 3); });
  if (!plus4) sq(4, 4);
  sq(CARD_W - 10, CARD_H - 10);
}

function paintBack(g) {
  frame(g, ['#6a4ab8', '#3d2a7a', '#1f1545'], true);
  // Trama em losangos.
  g.fillStyle = '#4f3696';
  for (let y = 4; y < CARD_H - 4; y++) for (let x = 4; x < CARD_W - 4; x++) if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) g.fillRect(x, y, 1, 1);
  // Selo central: as quatro cores em losango.
  const keys = Object.keys(SUIT_RAMP);
  const cx = CARD_W / 2;
  const cy = CARD_H / 2;
  for (let y = -9; y < 9; y++) {
    for (let x = -9; x < 9; x++) {
      const d = Math.abs(x + 0.5) + Math.abs(y + 0.5);
      if (d > 9) continue;
      g.fillStyle = d > 7.5 ? PAL.gold : SUIT_RAMP[keys[(x < 0 ? 0 : 1) + (y < 0 ? 0 : 2)]][1];
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  g.fillStyle = PAL.white;
  g.fillRect(cx - 1, cy - 1, 2, 2);
}

/** Desenha a carta `id` (ou o verso, com back) com o canto em (x, y). */
export function drawCard(ctx, x, y, id, { back = false, glow = null, dim = false } = {}) {
  const img = back ? cached('back', paintBack) : cached(`c${id}`, (g) => paintFace(g, id));
  if (glow) {
    ctx.fillStyle = glow;
    ctx.fillRect(x - 1, y + 1, 1, CARD_H - 2); ctx.fillRect(x + CARD_W, y + 1, 1, CARD_H - 2);
    ctx.fillRect(x + 1, y - 1, CARD_W - 2, 1); ctx.fillRect(x + 1, y + CARD_H, CARD_W - 2, 1);
    ctx.fillRect(x - 2, y + 2, 1, CARD_H - 4); ctx.fillRect(x + CARD_W + 1, y + 2, 1, CARD_H - 4);
    ctx.fillRect(x + 2, y - 2, CARD_W - 4, 1); ctx.fillRect(x + 2, y + CARD_H + 1, CARD_W - 4, 1);
  }
  if (dim) { ctx.save(); ctx.globalAlpha = 0.5; }
  ctx.drawImage(img, x, y);
  if (dim) ctx.restore();
}

export const darken = (hex) => mix(hex, PAL.ink, 0.5);
