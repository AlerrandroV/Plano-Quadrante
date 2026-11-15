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

// Cada cor de jogador tem 3 tons (claro, base, escuro) para dar volume.
export const TEAM = {
  azul: { light: '#73b7ff', base: '#3b6fd9', dark: '#22357a' },
  vermelho: { light: '#ff8293', base: '#d8344f', dark: '#6e1a2c' },
  verde: { light: '#a7f070', base: '#38b764', dark: '#1d6b4d' },
  laranja: { light: '#ffd27a', base: '#f0882e', dark: '#9a4a17' },
};

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
  drawSprite(ctx, PAWN, x, y, { K: PAL.ink, L: t.light, C: t.base, D: t.dark });
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
