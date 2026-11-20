// ROBÔS: um por jogo, todos com a mesma interface:
//   decide(state, botId, level) -> ação a enviar agora, ou null.
// O robô usa só a "view" que um jogador veria (nos jogos com informação
// escondida, ele não trapaceia).
import * as damas from './damas.js';
import * as teia from './dominio-da-teia.js';
import * as domino from './domino.js';
import * as ultima from './ultima-carta.js';

export const BOT_LEVELS = [
  { id: 'facil', label: 'Fácil' },
  { id: 'medio', label: 'Médio' },
  { id: 'dificil', label: 'Difícil' },
];

export function levelLabel(level) {
  return BOT_LEVELS.find((l) => l.id === level)?.label || level;
}

const BOTS = { damas, 'dominio-da-teia': teia, domino, 'ultima-carta': ultima };

export function hasBot(gameId) {
  return !!BOTS[gameId];
}

export function decide(gameId, state, botId, level) {
  return BOTS[gameId]?.decide(state, botId, level) ?? null;
}
