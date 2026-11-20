// Pixel art feita em código, em 2x (o dobro de pixels por peça).
// Continua pixelada (ampliada com `image-rendering: pixelated`), mas com
// espaço para detalhe: sombreado em 5 tons, contornos, brilho, espessura.
//
// As peças são geradas por forma + luz (de cima, à esquerda) e guardadas
// em cache (cada combinação é desenhada uma vez só).

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

// Cada cor de jogador: claro, base, escuro e contorno (`edge`). As peças
// pretas ganham contorno claro para aparecer sobre casas escuras.
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

// ------------------------------------------------------------- cores
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
/** Rampa de 5 tons + contorno para uma cor de jogador. */
export function ramp(color) {
  const t = TEAM[color] || TEAM.branco;
  return [mix(t.light, '#ffffff', 0.45), t.light, t.base, mix(t.base, t.dark, 0.55), t.dark, t.edge];
}
const GOLD = ['#fff6c8', '#ffe08a', '#f2b84b', '#c98b3a', '#7a4e1c', '#1a1c2c'];

// ------------------------------------------------------------- cache
const cache = new Map();
function sprite(key, w, h, paint) {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    paint(g);
    cache.set(key, c);
  }
  return c;
}
function blit(ctx, img, x, y, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, Math.round(x), Math.round(y));
  ctx.globalAlpha = 1;
}

/**
 * Pinta uma forma pixel a pixel: inside(x,y) diz se o pixel faz parte;
 * shade(x,y,u) devolve o índice do tom (u = posição 0..1 na linha, para
 * dar volume de cilindro). Borda vira contorno.
 */
function shape(g, w, h, inside, shade, colors) {
  const m = [];
  for (let y = 0; y < h; y++) { m.push([]); for (let x = 0; x < w; x++) m[y].push(!!inside(x + 0.5, y + 0.5)); }
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y][x];
  for (let y = 0; y < h; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++) if (m[y][x]) { if (l < 0) l = x; r = x; }
    for (let x = 0; x < w; x++) {
      if (!m[y][x]) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      const u = r > l ? (x - l) / (r - l) : 0.5;
      g.fillStyle = edge ? colors[5] : colors[shade(x, y, u)];
      g.fillRect(x, y, 1, 1);
    }
  }
}
const cyl = (u) => (u < 0.16 ? 0 : u < 0.36 ? 1 : u < 0.64 ? 2 : u < 0.84 ? 3 : 4);

// ---------------------------------------------------------- bitmaps
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

// Fonte 5x7 para números (dados, níveis, coordenadas).
const FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
};
export const GLYPH_W = 5;
export const GLYPH_H = 7;

/** Texto em fonte 5x7; scale = tamanho do "pixel" da letra. */
export function drawText(ctx, text, x, y, color, shadow, scale = 1) {
  let cx = x;
  for (const ch of String(text)) {
    const glyph = FONT[ch];
    if (glyph) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          if (glyph[r][c] !== '1') continue;
          if (shadow) { ctx.fillStyle = shadow; ctx.fillRect(cx + c * scale + scale, y + r * scale + scale, scale, scale); }
        }
      }
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          if (glyph[r][c] !== '1') continue;
          ctx.fillStyle = color;
          ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
        }
      }
    }
    cx += 6 * scale;
  }
}
export function textWidth(text, scale = 1) {
  return (String(text).length * 6 - 1) * scale;
}

// ---------------------------------------------------------------- peão
// 24x24: cabeça, colarinho, corpo e base, sombreado como um cilindro.
export const PAWN_W = 24;
export const PAWN_H = 24;

function paintPawn(g, color) {
  const C = ramp(color);
  const head = (x, y) => (x - 12) ** 2 + (y - 6.5) ** 2 <= 4.6 ** 2;
  const collar = (x, y) => ((x - 12) / 4.6) ** 2 + ((y - 11.6) / 1.7) ** 2 <= 1;
  const body = (x, y) => { if (y < 11.5 || y > 19.5) return false; const t = (y - 11.5) / 8; return Math.abs(x - 12) <= 2.6 + t ** 1.6 * 4.2; };
  const base = (x, y) => ((x - 12) / 9.4) ** 2 + ((y - 20.4) / 3.1) ** 2 <= 1;
  const inside = (x, y) => head(x, y) || collar(x, y) || body(x, y) || base(x, y);
  shape(g, 24, 24, inside, (x, y, u) => {
    let s = cyl(u);
    if (head(x + 0.5, y + 0.5) && y < 6) s = Math.max(0, s - 1); // brilho no alto da cabeça
    return s;
  }, C);
  // Linhas de separação (colarinho e base) e brilho.
  g.fillStyle = C[3];
  for (let x = 8; x <= 15; x++) if (inside(x + 0.5, 13.5)) g.fillRect(x, 13, 1, 1);
  for (let x = 5; x <= 18; x++) if (inside(x + 0.5, 18.5) && inside(x + 0.5, 17.5)) g.fillRect(x, 18, 1, 1);
  g.fillStyle = C[0];
  g.fillRect(10, 4, 2, 2);
  g.fillRect(9, 6, 1, 1);
}

/** Peão com o canto superior esquerdo em (x, y). */
export function drawPawn(ctx, x, y, color, { level = 0, ghost = false } = {}) {
  blit(ctx, sprite(`pawn:${color}`, 24, 24, (g) => paintPawn(g, color)), x, y, ghost ? 0.45 : 1);
  if (level > 0) {
    // Selo dourado com o nível, no canto inferior direito.
    const bx = x + 15;
    const by = y + 12;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(bx - 1, by - 1, 10, 12);
    ctx.fillStyle = GOLD[2];
    ctx.fillRect(bx, by, 8, 10);
    ctx.fillStyle = GOLD[0];
    ctx.fillRect(bx, by, 8, 1);
    ctx.fillRect(bx, by, 1, 10);
    ctx.fillStyle = GOLD[3];
    ctx.fillRect(bx, by + 9, 8, 1);
    ctx.fillRect(bx + 7, by, 1, 10);
    drawText(ctx, level, bx + 2, by + 2, PAL.ink);
  }
}

// ------------------------------------------------------- pedra de damas
// 28x28: face de cima (elipse) com sulco em anel, espessura embaixo.
export const DISC_SIZE = 28;

function paintDisc(g, color) {
  const C = ramp(color);
  const top = (x, y) => ((x - 14) / 13) ** 2 + ((y - 12) / 10.2) ** 2 <= 1;
  const side = (x, y) => ((x - 14) / 13) ** 2 + ((y - 15.5) / 10.2) ** 2 <= 1;
  shape(g, 28, 28, (x, y) => top(x, y) || side(x, y), (x, y, u) => {
    if (!top(x + 0.5, y + 0.5)) return u < 0.25 ? 3 : 4; // lateral (espessura)
    const d = Math.hypot((x + 0.5 - 9) / 13, (y + 0.5 - 7) / 10.2); // brilho no alto à esquerda
    return d < 0.22 ? 0 : d < 0.5 ? 1 : d < 0.95 ? 2 : 3;
  }, C);
  // Sulco em anel na face de cima.
  for (let a = 0; a < 360; a += 3) {
    const r = (a * Math.PI) / 180;
    const x = Math.round(14 + Math.cos(r) * 8.6 - 0.5);
    const y = Math.round(12 + Math.sin(r) * 6.6 - 0.5);
    g.fillStyle = Math.sin(r) < -0.2 && Math.cos(r) < 0.3 ? C[3] : C[0];
    g.fillRect(x, y, 1, 1);
  }
}

const CROWN = [
  '..K....K....K..',
  '.KGK..KGK..KGK.',
  '.KGGKKGRGKKGGK.',
  'KGHGGGGGGGGGHGK',
  'KGGHGGGGGGGHGGK',
  'KDGGGGGGGGGGGDK',
  'KDDDDDDDDDDDDDK',
  '.KKKKKKKKKKKKK.',
];

/** Pedra de damas com o canto superior esquerdo em (x, y). */
export function drawDisc(ctx, x, y, color, { king = false, ghost = false } = {}) {
  const key = `disc:${color}:${king ? 'k' : ''}`;
  blit(ctx, sprite(key, 28, 28, (g) => {
    paintDisc(g, color);
    if (king) drawSprite(g, CROWN, 6, 6, { K: PAL.ink, G: GOLD[2], H: GOLD[0], D: GOLD[3], R: PAL.danger });
  }), x, y, ghost ? 0.4 : 1);
}

// -------------------------------------------------------------- dado d8
// Octaedro visto de frente (42x42): 4 faces com luz diferente.
export const DIE_SIZE = 42;

function paintDie(g, color) {
  const C = ramp(color);
  const c = 20.5;
  const R = 20;
  for (let y = 0; y < 42; y++) {
    for (let x = 0; x < 42; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d > R) continue;
      let col;
      if (d > R - 1.4) col = C[5]; // contorno
      else if (Math.abs(dy) < 0.6 || Math.abs(dx) < 0.6) col = dy < 0 && dx < 0 ? C[0] : C[3]; // arestas
      else if (dy < 0 && dx < 0) col = d > R - 3 ? C[0] : C[1];
      else if (dy < 0) col = C[2];
      else if (dx < 0) col = C[3];
      else col = C[4];
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
}

/** Dado com valor (1-4, ou '?') na cor da direção sorteada. */
export function drawDie(ctx, x, y, value, color, { dim = false } = {}) {
  blit(ctx, sprite(`die:${color}`, 42, 42, (g) => paintDie(g, color)), x, y, dim ? 0.5 : 1);
  // Número grande (fonte 5x7 com "pixel" 2x2), contornado.
  const tx = x + 21 - 5;
  const ty = y + 21 - 7;
  ctx.globalAlpha = dim ? 0.6 : 1;
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [2, 2]]) drawText(ctx, value, tx + ox, ty + oy, PAL.ink, null, 2);
  drawText(ctx, value, tx, ty, PAL.white, null, 2);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------- dominó
// Peça 24x48 (em pé) ou 48x24 (deitada): cantos arredondados, chanfro,
// pino de metal no meio e pontos redondos.
export const TILE_W = 24;
export const TILE_L = 48;
const IVORY = ['#fffaf0', '#f4ecd8', '#e6dbbf', '#c9b994', '#8f7f5c'];
const PIP = ['.XX.', 'XXXX', 'XXXX', '.XX.'];
const PIP_POS = {
  0: [],
  1: [[9, 9]],
  2: [[3, 3], [15, 15]],
  3: [[3, 3], [9, 9], [15, 15]],
  4: [[3, 3], [15, 3], [3, 15], [15, 15]],
  5: [[3, 3], [15, 3], [9, 9], [3, 15], [15, 15]],
  6: [[3, 3], [15, 3], [3, 9], [15, 9], [3, 15], [15, 15]],
};

function paintTile(g, vertical, a, b, back) {
  const w = vertical ? 24 : 48;
  const h = vertical ? 48 : 24;
  const corner = (x, y) => {
    const cx = Math.min(x, w - 1 - x);
    const cy = Math.min(y, h - 1 - y);
    return cx + cy < 2; // cantos cortados = arredondados
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (corner(x, y)) continue;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || corner(x - 1, y) || corner(x + 1, y) || corner(x, y - 1) || corner(x, y + 1);
      let col;
      if (edge) col = PAL.ink;
      else if (back) col = (x + y) % 4 === 0 ? '#6a55a0' : y < 3 || x < 3 ? '#4d3d78' : '#3a2d5c';
      else if (x === 1 || y === 1) col = IVORY[0]; // luz
      else if (x === w - 2 || y === h - 2) col = IVORY[3]; // sombra
      else if (x === w - 3 || y === h - 3) col = IVORY[2];
      else col = IVORY[1];
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  if (back) return;
  // Divisória com pino de metal.
  g.fillStyle = IVORY[4];
  if (vertical) { g.fillRect(3, 23, 18, 2); g.fillStyle = GOLD[2]; g.fillRect(10, 23, 4, 2); g.fillStyle = GOLD[0]; g.fillRect(10, 23, 2, 1); }
  else { g.fillRect(23, 3, 2, 18); g.fillStyle = GOLD[2]; g.fillRect(23, 10, 2, 4); g.fillStyle = GOLD[0]; g.fillRect(23, 10, 1, 2); }
  const face = (ox, oy, n, rot) => {
    for (const [px, py] of PIP_POS[n] || []) {
      // Peça deitada: as faces giram 90° (o 2, o 3 e o 6 mudam de diagonal).
      const [qx, qy] = rot ? [py, 18 - px] : [px, py];
      drawSprite(g, PIP, ox + qx, oy + qy, { X: PAL.ink });
      g.fillStyle = '#4a4e6a';
      g.fillRect(ox + qx + 1, oy + qy + 1, 1, 1); // reflexo no ponto
    }
  };
  if (vertical) { face(1, 1, a, false); face(1, 25, b, false); }
  else { face(1, 1, a, true); face(25, 1, b, true); }
}

/**
 * Desenha uma peça. vertical: a em cima, b embaixo; horizontal: a à
 * esquerda, b à direita. back = peça virada (escondida).
 */
export function drawTile(ctx, x, y, vertical, a, b, { back = false, glow = null, dim = false } = {}) {
  const key = `tile:${vertical ? 'v' : 'h'}:${back ? 'back' : `${a}${b}`}`;
  const img = sprite(key, vertical ? 24 : 48, vertical ? 48 : 24, (g) => paintTile(g, vertical, a, b, back));
  if (glow) {
    ctx.fillStyle = glow;
    ctx.fillRect(x - 2, y - 2, img.width + 4, img.height + 4);
  }
  blit(ctx, img, x, y, dim ? 0.45 : 1);
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
