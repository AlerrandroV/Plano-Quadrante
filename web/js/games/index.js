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
import * as pqRules from './plano-quadrante/rules.js';
import * as pqUi from './plano-quadrante/ui.js';
import * as damasRules from './damas/rules.js';
import * as damasUi from './damas/ui.js';
import { PAL, TEAM, drawPawn, drawDie, drawDisc } from '../ui/pixel.js';

export const ART_W = 64;
export const ART_H = 40;

export const GAMES = [
  {
    ...pqRules,
    render: pqUi.render,
    help: pqUi.RULES,
    id: 'plano-quadrante',
    name: 'Plano Quadrante',
    kind: 'Tabuleiro · dados',
    spectators: true,
    seatHint: (n, i) => (['azul', 'vermelho'].includes(pqRules.defaultColors(n)[i]) ? 'em cima' : 'embaixo'),
    art: artPlanoQuadrante,
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
];

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}

export function capacityText(game) {
  const { minPlayers: a, maxPlayers: b } = game.meta;
  return a === b ? `${a} jogadores` : `${a} a ${b} jogadores`;
}

// ------------------------------------------------------- ilustrações
function artPlanoQuadrante(g) {
  g.fillStyle = PAL.ink; g.fillRect(0, 0, ART_W, ART_H);
  g.fillStyle = '#20253d'; g.fillRect(2, 2, 36, 36);
  g.fillStyle = '#2f3656';
  for (let v = 6; v < 38; v += 4) { g.fillRect(v, 3, 1, 34); g.fillRect(3, v, 34, 1); }
  g.fillStyle = PAL.steel; g.fillRect(20, 3, 1, 34); g.fillRect(3, 20, 34, 1);
  g.fillStyle = TEAM.azul.base; g.fillRect(2, 2, 36, 1);
  g.fillStyle = TEAM.verde.base; g.fillRect(2, 37, 36, 1);
  g.fillStyle = TEAM.vermelho.base; g.fillRect(2, 2, 1, 36);
  g.fillStyle = TEAM.laranja.base; g.fillRect(37, 2, 1, 36);
  drawPawn(g, 6, 6, 'azul');
  drawPawn(g, 22, 18, 'laranja');
  drawPawn(g, 10, 22, 'verde');
  drawDie(g, 41, 2, 3, 'vermelho');
  drawDie(g, 41, 18, 2, 'azul');
}

function artDamas(g) {
  // Tabuleiro visto de longe: casas de 8 px e pedras pequenas.
  const cell = 8;
  const piece = (x, y, color, king) => {
    const t = TEAM[color];
    g.fillStyle = t.edge; g.fillRect(x + 2, y + 1, 4, 6); g.fillRect(x + 1, y + 2, 6, 4);
    g.fillStyle = t.base; g.fillRect(x + 2, y + 2, 4, 4);
    g.fillStyle = t.light; g.fillRect(x + 2, y + 2, 2, 1);
    g.fillStyle = t.dark; g.fillRect(x + 3, y + 5, 3, 1);
    if (king) { g.fillStyle = PAL.gold; g.fillRect(x + 3, y + 3, 2, 2); }
  };
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 8; c++) {
      const dark = (r + c) % 2 === 1;
      g.fillStyle = dark ? '#25262f' : '#e8e8ee';
      g.fillRect(c * cell, r * cell, cell, cell);
      if (!dark) continue;
      if (r <= 1) piece(c * cell, r * cell, 'preto');
      else if (r >= 3) piece(c * cell, r * cell, 'branco');
      else if (c === 3) piece(c * cell, r * cell, 'branco', true);
    }
  }
}
