// ===================================================================
//  JOGO PROVISÓRIO: "Caça ao Quadrante"
//  Serve para testar a estrutura (mesma tela / sala Wi-Fi). Será
//  substituído pelas regras reais do Plano Quadrante.
//
//  Contrato que qualquer jogo precisa seguir (ver js/game/index.js):
//    meta                      -> { id, name, minPlayers, maxPlayers }
//    setup(players)            -> estado inicial   (players: [{id,name}])
//    act(state, playerId, a)   -> novo estado, ou null se a jogada é inválida
//    view(state, playerId)     -> o que esse jogador pode ver (esconda segredos!)
//    activePlayers(state)      -> ids de quem pode jogar agora
//
//  Regras: em cada turno aparece um par ordenado (x, y). O jogador da
//  vez toca no quadrante onde o ponto fica (ou em "Sobre um eixo").
//  Acertou, +1 ponto. Cada um joga ROUNDS vezes; maior pontuação vence.
// ===================================================================

export const meta = { id: 'quadrantes', name: 'Caça ao Quadrante', minPlayers: 1, maxPlayers: 12 };

const ROUNDS = 5;
const RANGE = 9;

function randomPoint() {
  const r = () => Math.floor(Math.random() * (2 * RANGE + 1)) - RANGE;
  // ~1 em 6 cai sobre um eixo, para manter a atenção.
  if (Math.random() < 1 / 6) {
    return Math.random() < 0.5 ? { x: r(), y: 0 } : { x: 0, y: r() };
  }
  const nz = () => { let v = 0; while (v === 0) v = r(); return v; };
  return { x: nz(), y: nz() };
}

export function quadrantOf({ x, y }) {
  if (x === 0 || y === 0) return 0; // sobre um eixo
  if (x > 0) return y > 0 ? 1 : 4;
  return y > 0 ? 2 : 3;
}

export function setup(players) {
  return {
    players: players.map((p) => ({ id: p.id, name: p.name, score: 0 })),
    turn: 0, // índice em players
    round: 1,
    rounds: ROUNDS,
    point: randomPoint(),
    last: null,
    over: false,
  };
}

export function activePlayers(state) {
  return state.over ? [] : [state.players[state.turn].id];
}

export function act(state, playerId, action) {
  if (!action || typeof action !== 'object') return null;

  if (action.type === 'restart') {
    if (!state.over) return null;
    return setup(state.players);
  }

  if (action.type !== 'answer' || state.over) return null;
  if (state.players[state.turn].id !== playerId) return null;
  const answer = Number(action.quadrant);
  if (![0, 1, 2, 3, 4].includes(answer)) return null;

  const correctQ = quadrantOf(state.point);
  const correct = answer === correctQ;
  const players = state.players.map((p) =>
    p.id === playerId && correct ? { ...p, score: p.score + 1 } : p);

  let turn = state.turn + 1;
  let round = state.round;
  if (turn >= players.length) { turn = 0; round += 1; }
  const over = round > state.rounds;

  return {
    ...state,
    players,
    turn: over ? state.turn : turn,
    round: over ? state.rounds : round,
    point: over ? state.point : randomPoint(),
    last: { playerId, point: state.point, answer, correctQ, correct },
    over,
  };
}

// Neste jogo nada é secreto, então todos veem o mesmo estado.
export function view(state /* , playerId */) {
  return state;
}
