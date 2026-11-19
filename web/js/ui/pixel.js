// Pixel art feito em código: paleta, sprites e uma fontezinha 3x5.
// Tudo é desenhado em canvas pequenos e ampliado com
// `image-rendering: pixelated`, o que dá o visual retrô.

// Paleta base (inspirada na "Sweetie 16").
export const PAL = {
  ink: '#1a1c2c',
  night: '#29304a',
  slate: '#333c57',
  steel: '#566c86',
  fog: '#94b0c2',
  white: '#f4f4f4',
  gold: '#ffcd75',
  danger: '#ff3b55',
  cyan: '#73eff7',
};

// Cada cor de jogador tem 3 tons (claro, base, escuro) para dar volume,
// e a cor do contorno (`edge`): escuro, menos nas peças pretas, que ganham
// contorno claro para aparecer sobre casas escuras.
export const TEAM = {
  azul: { light: '#73b7ff', base: '#3b6fd9', dark: '#22357a' },
  vermelho: { light: '#ff8293', base: '#d8344f', dark: '#6e1a2c' },
  verde: { light: '#a7f070', base: '#38b764', dark: '#1d6b4d' },
  laranja: { light: '#ffd27a', base: '#f0882e', dark: '#9a4a17' },
  roxo: { light: '#c79bff', base: '#7e4fd6', dark: '#3d2373' },
  rosa: { light: '#ffb3e0', base: '#e85cb0', dark: '#7d2560' },
  amarelo: { light: '#fff3a0', base: '#f2cf2e', dark: '#8f7414' },
  ciano: { light: '#b8fbff', base: '#36c4d6', dark: '#1a6a78' },
  branco: { light: '#ffffff', base: '#e4e8ee', dark: '#9aa6b8' },
  preto: { light: '#7a7f99', base: '#3a3d52', dark: '#1f2130', edge: '#a9b4cc' },
};
for (const t of Object.values(TEAM)) t.edge ??= '#1a1c2c';

// Peão 12x12. K = contorno, L = luz, C = cor, D = sombra.
const PAWN = [
  '....KKKK....',
  '...KLLCCK...',
  '...KLCCDK...',
  '...KCCCDK...',
  '....KCDK....',
  '....KCCK....',
  '...KLCCDK...',
  '..KLCCCCDK..',
  '..KCCCCCDK..',
  '.KKKKKKKKKK.',
  '.KLCCCCCCDK.',
  '.KKKKKKKKKK.',
];
export const PAWN_W = 12;
export const PAWN_H = 12;

// Fonte 3x5 (dígitos e alguns símbolos).
const FONT = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '-': ['000', '000', '111', '000', '000'],
  '+': ['000', '010', '111', '010', '000'],
  '?': ['111', '001', '011', '000', '010'],
};

export function drawSprite(ctx, rows, x, y, colors) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = colors[row[c]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}

export function drawText(ctx, text, x, y, color, shadow) {
  let cx = x;
  for (const ch of String(text)) {
    const glyph = FONT[ch];
    if (glyph) {
      if (shadow) drawSprite(ctx, glyph, cx + 1, y + 1, { 1: shadow });
      drawSprite(ctx, glyph, cx, y, { 1: color });
    }
    cx += 4;
  }
}

export function textWidth(text) {
  return String(text).length * 4 - 1;
}

/** Desenha um peão com o canto superior esquerdo em (x, y). */
export function drawPawn(ctx, x, y, color, { level = 0, ghost = false } = {}) {
  const t = TEAM[color];
  ctx.globalAlpha = ghost ? 0.45 : 1;
  drawSprite(ctx, PAWN, x, y, { K: t.edge, L: t.light, C: t.base, D: t.dark });
  ctx.globalAlpha = 1;
  if (level > 0) {
    // Selo com o nível, no canto inferior direito.
    const bx = x + PAWN_W - 5;
    const by = y + PAWN_H - 8;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(bx - 1, by - 1, 7, 9);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(bx, by, 5, 7);
    drawText(ctx, level, bx + 1, by + 1, PAL.ink);
  }
}

// Dado octaedro visto de frente: um losango 21x21.
const D8 = (() => {
  const rows = [];
  const n = 21;
  const mid = 10;
  for (let r = 0; r < n; r++) {
    let row = '';
    const half = r <= mid ? r : n - 1 - r;
    for (let c = 0; c < n; c++) {
      const d = Math.abs(c - mid);
      if (d > half) row += '.';
      else if (d === half) row += 'K';
      else if (r < mid && c < mid && d >= half - 1) row += 'L'; // brilho na aresta
      else if (r > mid || c > mid + 2) row += 'D';
      else row += 'C';
    }
    rows.push(row);
  }
  // Aresta horizontal do meio (o "equador" do octaedro).
  rows[mid] = rows[mid].replace(/C|D|L/g, 'E');
  return rows;
})();
export const DIE_SIZE = 21;

/** Desenha um dado com valor (1-4) na cor da direção sorteada. */
export function drawDie(ctx, x, y, value, color, { dim = false } = {}) {
  const t = TEAM[color];
  ctx.globalAlpha = dim ? 0.5 : 1;
  drawSprite(ctx, D8, x, y, { K: PAL.ink, L: t.light, C: t.base, D: t.dark, E: t.dark });
  drawText(ctx, value, x + 9, y + 8, PAL.white, PAL.ink);
  ctx.globalAlpha = 1;
}

// Pedra de damas 14x14 (vista de cima, com espessura) e coroa da dama.
const DISC = [
  '....KKKKKK....',
  '..KKLLLLCCKK..',
  '.KLLLCCCCCCDK.',
  '.KLLCCCCCCCDK.',
  'KLLCCCCCCCCCDK',
  'KLCCCCCCCCCCDK',
  'KLCCCCCCCCCCDK',
  'KCCCCCCCCCCCDK',
  'KCCCCCCCCCCDDK',
  '.KCCCCCCCCDDK.',
  '.KDDCCCCCDDDK.',
  '..KKDDDDDDKK..',
  '..KEEEEEEEEK..',
  '....KKKKKK....',
];
const CROWN = [
  'K.K.K.K',
  'GKGKGKG',
  'GGGGGGG',
  'KGGGGGK',
  '.KKKKK.',
];
export const DISC_SIZE = 14;

/** Pedra de damas com o canto superior esquerdo em (x, y). */
export function drawDisc(ctx, x, y, color, { king = false, ghost = false } = {}) {
  const t = TEAM[color] || TEAM.branco;
  ctx.globalAlpha = ghost ? 0.4 : 1;
  drawSprite(ctx, DISC, x, y, { K: t.edge, L: t.light, C: t.base, D: t.dark, E: t.dark });
  if (king) drawSprite(ctx, CROWN, x + 3, y + 3, { K: PAL.ink, G: PAL.gold });
  ctx.globalAlpha = 1;
}

/** Cria um <canvas> já com a escala pixelada aplicada via CSS. */
export function pixelCanvas(w, h, className = '') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.className = 'pixel ' + className;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
}

// ------------------------------------------------------------- dominó
// Peça de 12x24 (em pé) ou 24x12 (deitada): duas faces 10x10 com pontos 2x2.
const PIP_POS = {
  0: [],
  1: [[4, 4]],
  2: [[1, 1], [7, 7]],
  3: [[1, 1], [4, 4], [7, 7]],
  4: [[1, 1], [7, 1], [1, 7], [7, 7]],
  5: [[1, 1], [7, 1], [4, 4], [1, 7], [7, 7]],
  6: [[1, 1], [7, 1], [1, 4], [7, 4], [1, 7], [7, 7]],
};
export const TILE_W = 12;
export const TILE_L = 24;
const IVORY = '#f1ead6';
const IVORY_D = '#c9bd9c';

function face(ctx, x, y, n, rot) {
  ctx.fillStyle = IVORY;
  ctx.fillRect(x, y, 10, 10);
  ctx.fillStyle = PAL.ink;
  for (const [px, py] of PIP_POS[n] || []) {
    // Faces "deitadas" giram 90° (o 2, o 3 e o 6 mudam de diagonal).
    const [qx, qy] = rot ? [py, 8 - px] : [px, py];
    ctx.fillRect(x + qx, y + qy, 2, 2);
  }
}

/**
 * Desenha uma peça. vertical: a em cima, b embaixo; horizontal: a à
 * esquerda, b à direita. back = peça virada (escondida).
 */
export function drawTile(ctx, x, y, vertical, a, b, { back = false, glow = null, dim = false } = {}) {
  const w = vertical ? TILE_W : TILE_L;
  const hgt = vertical ? TILE_L : TILE_W;
  ctx.globalAlpha = dim ? 0.45 : 1;
  ctx.fillStyle = glow || PAL.ink;
  ctx.fillRect(x, y, w, hgt);
  if (back) {
    ctx.fillStyle = '#3a3150';
    ctx.fillRect(x + 1, y + 1, w - 2, hgt - 2);
    ctx.fillStyle = '#5d4b84';
    for (let i = 2; i < w - 2; i += 3) for (let j = 2; j < hgt - 2; j += 3) ctx.fillRect(x + i, y + j, 1, 1);
    ctx.globalAlpha = 1;
    return;
  }
  // Sombra inferior (dá volume) + faces + divisória.
  ctx.fillStyle = IVORY_D;
  ctx.fillRect(x + 1, y + 1, w - 2, hgt - 2);
  if (vertical) {
    face(ctx, x + 1, y + 1, a, false);
    face(ctx, x + 1, y + 13, b, false);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x + 2, y + 11, 8, 1);
  } else {
    face(ctx, x + 1, y + 1, a, true);
    face(ctx, x + 13, y + 1, b, true);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x + 11, y + 2, 1, 8);
  }
  ctx.globalAlpha = 1;
}
