// CATÁLOGO DA PLATAFORMA
// Para adicionar um jogo: crie games/<id>/rules.js (regras puras) e
// games/<id>/ui.js (render + RULES), e registre aqui com a ilustração.
//
// Contrato de cada jogo (rules.js):
//   meta                      { id, name, minPlayers, maxPlayers }
//   defaultColors(n)          cores padrão por assento
//   setup(players)            players = [{ id, name, color }] -> estado
//   act(state, playerId, a)   -> novo estado | null (jogada inválida)
//   view(state, playerId)     -> o que esse jogador vê (playerId null = espectador)
//   activePlayers(state)      -> ids de quem joga agora
//   outcome(state)            -> null | { winners: [ids] } (vazio = empate)
//   pendingPlayers(state)     -> (opcional) quem precisa agir agora
//
// No registro: options (variações escolhidas antes da partida) e
// noSharedScreen (jogos com mão escondida: nada de várias pessoas na
// mesma tela; no modo local, só uma pessoa contra robôs).
import * as pqRules from './dominio-da-teia/rules.js';
import * as pqUi from './dominio-da-teia/ui.js';
import * as damasRules from './damas/rules.js';
import * as damasUi from './damas/ui.js';
import * as dominoRules from './domino/rules.js';
import * as dominoUi from './domino/ui.js';
import { PAL, TEAM, drawSpider, drawDie, drawDisc, drawTile } from '../ui/pixel.js';

export const ART_W = 128; // 2x
export const ART_H = 80;

export const GAMES = [
  {
    ...pqRules,
    render: pqUi.render,
    help: pqUi.RULES,
    id: 'dominio-da-teia',
    name: 'Domínio da Teia',
    kind: 'Teia · dados',
    spectators: true,
    seatHint: (n, i) => (['azul', 'vermelho'].includes(pqRules.defaultColors(n)[i]) ? 'em cima' : 'embaixo'),
    art: artTeia,
  },
  {
    ...damasRules,
    render: damasUi.render,
    help: damasUi.RULES,
    id: 'damas',
    name: 'Damas',
    kind: 'Tabuleiro · regras brasileiras',
    spectators: true,
    seatHint: (n, i) => (i === 0 ? 'brancas, começa' : 'pretas'),
    art: artDamas,
  },
  {
    ...dominoRules,
    render: dominoUi.render,
    help: dominoUi.RULES,
    id: 'domino',
    name: 'Dominó',
    kind: 'Peças · batida ou pontos',
    spectators: true,
    noSharedScreen: true,
    options: dominoRules.OPTIONS,
    seatHint: () => '',
    art: artDomino,
  },
];

/** Valores padrão das opções de um jogo. */
export function defaultOptions(game) {
  return Object.fromEntries((game.options || []).map((o) => [o.id, o.default]));
}

/** Texto curto das opções escolhidas (ex.: "Pontos"). */
export function optionsText(game, opts = {}) {
  return (game.options || []).map((o) => o.choices.find((c) => c.id === (opts[o.id] ?? o.default))?.label).filter(Boolean).join(' · ');
}

// Ids antigos (salas e preferências salvas antes de o jogo mudar de nome).
const OLD_IDS = { 'plano-quadrante': 'dominio-da-teia' };

export function getGame(id) {
  const real = OLD_IDS[id] || id;
  return GAMES.find((g) => g.id === real) || null;
}

export function capacityText(game) {
  const { minPlayers: a, maxPlayers: b } = game.meta;
  return a === b ? `${a} jogadores` : `${a} a ${b} jogadores`;
}

// ------------------------------------------------------- ilustrações
// 128x80, desenhadas com as mesmas peças dos jogos.
function artTeia(g) {
  g.fillStyle = PAL.ink; g.fillRect(0, 0, ART_W, ART_H);
  // Teia: fios curvos para os eixos, eixos retos, miolo dourado.
  const cx = 40; const cy = 40; const st = 9;
  const dot = (x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const thread = (ax, ay, bx, by, kx, ky, c) => {
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      dot((1 - t) ** 2 * ax + 2 * (1 - t) * t * kx + t * t * bx, (1 - t) ** 2 * ay + 2 * (1 - t) * t * ky + t * t * by, c);
    }
  };
  for (let j = -4; j <= 4; j++) {
    for (let i = -4; i < 4; i++) {
      if (j !== 0) { const y = cy - j * st; const tw = j > 0 ? 3 : -3; thread(cx + i * st, y, cx + (i + 1) * st, y, cx + (i + 0.5) * st, y + tw, j === 4 ? TEAM.azul.light : j === -4 ? TEAM.verde.light : '#9aa6c4'); }
      if (j !== 0) { const x = cx + j * st; const tw = j > 0 ? -3 : 3; thread(x, cy - i * st, x, cy - (i + 1) * st, x + tw, cy - (i + 0.5) * st, j === 4 ? TEAM.laranja.light : j === -4 ? TEAM.vermelho.light : '#9aa6c4'); }
    }
  }
  g.fillStyle = '#dfe6f5'; g.fillRect(cx, cy - 36, 1, 72); g.fillRect(cx - 36, cy, 72, 1);
  g.fillStyle = PAL.gold; g.fillRect(cx - 2, cy - 2, 5, 5);
  drawSpider(g, cx - 2 * st - 12, cy - 2 * st - 11, 'azul');
  drawSpider(g, cx + st - 12, cy + st - 11, 'laranja', { level: 2 });
  drawSpider(g, cx + 3 * st - 12, cy - 3 * st - 11, 'verde');
  drawDie(g, 84, 2, 3, 'vermelho');
  drawDie(g, 84, 38, 2, 'azul');
}

function artDamas(g) {
  // Recorte do tabuleiro com pedras de verdade (casas de 32 px).
  const cell = 32;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const dark = (r + c) % 2 === 1;
      const x = c * cell;
      const y = r * cell - 8;
      g.fillStyle = dark ? '#25262f' : '#e8e8ee';
      g.fillRect(x, y, cell, cell);
      g.fillStyle = dark ? '#33343f' : '#f6f6fa'; g.fillRect(x, y, cell, 1);
      if (!dark) continue;
      if (r === 0) drawDisc(g, x + 2, y + 2, 'preto');
      else if (r === 1 && c === 2) drawDisc(g, x + 2, y + 2, 'branco', { king: true });
      else if (r === 1) drawDisc(g, x + 2, y + 2, 'preto');
      else drawDisc(g, x + 2, y + 2, 'branco');
    }
  }
}

function artDomino(g) {
  g.fillStyle = '#1d4a3a'; g.fillRect(0, 0, ART_W, ART_H);
  g.fillStyle = '#163a2d';
  for (let y = 0; y < ART_H; y += 3) for (let x = (y / 3) % 2; x < ART_W; x += 3) g.fillRect(x, y, 1, 1);
  // Uma fila de peças e duas peças "na mão", viradas.
  drawTile(g, 2, 26, false, 6, 6);
  drawTile(g, 50, 26, false, 6, 3);
  drawTile(g, 100, 10, true, 3, 5);
  drawTile(g, 14, 54, false, 1, 4, { back: true });
  drawTile(g, 64, 54, false, 2, 2, { back: true });
}
