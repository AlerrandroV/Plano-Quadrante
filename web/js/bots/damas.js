// ROBÔ DE DAMAS
//
// A dificuldade humana nas damas é enxergar lances à frente; a máquina faz
// isso com facilidade. Então o nível do robô é, principalmente, QUANTOS
// meios-lances ele enxerga (busca minimax com poda alfa-beta):
//
//   Fácil   -> 2 meios-lances (o seu lance e a resposta), julga com "ruído"
//              e às vezes faz um lance qualquer, como um iniciante.
//   Médio   -> 4 meios-lances, com pouco ruído.
//   Difícil -> aprofunda até 12 meios-lances (aprofundamento iterativo,
//              com limite de tempo), sem ruído.
//
// Em todos os níveis, a busca não para no meio de uma sequência de
// capturas obrigatórias (senão o robô "não vê" a peça que vai perder).
import * as D from '../games/damas/rules.js';

export const LEVELS = {
  facil: { depth: 2, noise: 90, blunder: 0.2 },
  medio: { depth: 4, noise: 20, blunder: 0.03 },
  dificil: { depth: 12, noise: 0, blunder: 0, timeMs: 1200 },
};

const WIN = 100000;
const N = D.N;

/** Decide o que o robô `botId` faz agora (ou null se não é com ele). */
export function decide(state, botId, level = 'medio', opts = {}) {
  if (state.phase !== 'play') return null;
  const me = state.players.findIndex((p) => p.id === botId);
  if (me < 0) return null;
  const side = state.players[me].side;
  const cfg = { ...LEVELS[level] || LEVELS.medio, ...opts };

  // Proposta de empate do adversário: aceita só se estiver perdendo.
  if (state.drawOffer != null && state.drawOffer !== me) {
    const score = evaluate(state.board, side);
    return { type: 'answer-draw', accept: score < -150 || state.quiet >= 30 };
  }
  if (state.turn !== side) return null;

  const moves = D.legalMoves(state);
  if (!moves.length) return null;
  if (moves.length === 1) return toAction(moves[0]);
  if (Math.random() < cfg.blunder) return toAction(moves[Math.floor(Math.random() * moves.length)]);

  const best = search(state.board, side, moves, cfg);
  return toAction(best);
}

function toAction(m) {
  return { type: 'move', from: m.from, path: m.path };
}

// ------------------------------------------------------------- busca
function search(board, side, rootMoves, cfg) {
  const deadline = cfg.timeMs ? Date.now() + cfg.timeMs : Infinity;
  const ctx = { deadline, nodes: 0, aborted: false };
  let scored = rootMoves.map((m) => ({ m, score: 0 }));

  const maxDepth = cfg.depth;
  const startDepth = cfg.timeMs ? 1 : maxDepth; // iterativo só no difícil
  for (let depth = startDepth; depth <= maxDepth; depth++) {
    const round = [];
    let alpha = -Infinity;
    // Melhor lance da rodada anterior primeiro: poda muito mais.
    for (const { m } of scored) {
      const child = apply(board, m);
      const score = -negamax(child, other(side), depth - 1, -Infinity, -alpha, ctx, 1);
      if (ctx.aborted) break;
      round.push({ m, score });
      if (score > alpha) alpha = score;
    }
    if (ctx.aborted) break;
    scored = round.sort((a, b) => b.score - a.score);
    if (Math.abs(scored[0].score) >= WIN - 100) break; // já achou vitória/derrota forçada
    if (Date.now() > deadline) break;
  }

  // Ruído: o robô fácil "avalia mal" as posições.
  const noisy = scored.map(({ m, score }) => ({ m, score: score + (Math.random() - 0.5) * 2 * cfg.noise }));
  noisy.sort((a, b) => b.score - a.score);
  return noisy[0].m;
}

function negamax(board, turn, depth, alpha, beta, ctx, ply) {
  if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.aborted = true;
  if (ctx.aborted) return 0;
  const moves = D.legalMoves({ board, turn });
  if (!moves.length) return -(WIN - ply); // sem lances = perdeu
  const forced = moves[0].captures.length > 0;
  // Fim da profundidade: avalia, a não ser que haja captura obrigatória
  // pendente (aí continua até a posição ficar "quieta", com limite).
  if (depth <= 0 && (!forced || depth <= -6)) return evaluate(board, turn);

  if (moves.length > 1) order(moves, board, turn);
  let best = -Infinity;
  for (const m of moves) {
    const score = -negamax(apply(board, m), other(turn), depth - 1, -beta, -alpha, ctx, ply + 1);
    if (ctx.aborted) return 0;
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

// Ordena: promoções e capturas maiores primeiro.
function order(moves, board, turn) {
  const last = turn === 'w' ? N - 1 : 0;
  const key = (m) => {
    const p = board[m.from];
    const to = m.path[m.path.length - 1];
    return m.captures.length * 10 + (!p.k && D.rowOf(to) === last ? 5 : 0);
  };
  moves.sort((a, b) => key(b) - key(a));
}

function other(side) {
  return side === 'w' ? 'b' : 'w';
}

/** Aplica um lance num tabuleiro (cópia), com promoção. */
export function apply(board, m) {
  const b = board.slice();
  const piece = b[m.from];
  b[m.from] = null;
  for (const c of m.captures) b[c] = null;
  const to = m.path[m.path.length - 1];
  const last = piece.s === 'w' ? N - 1 : 0;
  b[to] = { s: piece.s, k: piece.k || D.rowOf(to) === last };
  return b;
}

// ---------------------------------------------------------- avaliação
// Material (dama vale ~3 pedras, porque é voadora), avanço das pedras,
// centro e guarda da última fileira. Positivo = bom para `side`.
export function evaluate(board, side) {
  let score = 0;
  let mine = 0;
  let theirs = 0;
  for (let i = 0; i < N * N; i++) {
    const p = board[i];
    if (!p) continue;
    const r = D.rowOf(i);
    const c = D.colOf(i);
    let v;
    if (p.k) {
      v = 320;
    } else {
      const adv = p.s === 'w' ? r : N - 1 - r; // 0..7
      v = 100 + adv * adv * 1.5;
      if (adv === 0) v += 12; // pedras na casa de origem guardam a promoção do adversário
    }
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 6; // centro
    if (c === 0 || c === N - 1) v -= 4; // borda: menos opções
    if (p.s === side) { score += v; mine++; } else { score -= v; theirs++; }
  }
  // Com vantagem, trocar peças é bom (simplifica para vencer).
  if (mine && theirs && score > 0) score += (24 - mine - theirs) * 3;
  return score;
}
