// ===================================================================
//  DAMAS — regras brasileiras (damas olímpicas, tabuleiro 8x8)
//
//  - 12 pedras para cada lado, nas casas escuras; a casa a1 é escura.
//  - As BRANCAS começam.
//  - Pedra anda 1 casa na diagonal para frente; captura para frente e
//    para trás.
//  - Dama anda e captura em qualquer distância na diagonal ("voadora"),
//    podendo parar em qualquer casa livre depois da peça capturada.
//  - Captura é obrigatória e vale a LEI DA MAIORIA: é obrigatório o lance
//    que captura mais peças (pedra e dama valem o mesmo).
//  - Num lance com várias capturas, as peças só saem do tabuleiro no fim,
//    e nenhuma peça pode ser saltada duas vezes.
//  - A pedra só vira dama se TERMINAR o lance na última fileira; se passar
//    por ela no meio de uma captura, continua pedra.
//  - Perde quem fica sem peças ou sem lances. Empate: 20 lances seguidos
//    de cada lado só com damas, sem captura (regra da CBD), ou acordo.
//
//  Casas: índice r*8 + c, com r = 0 a fileira das brancas e c = 0 a coluna "a".
// ===================================================================
import { assignColors } from '../../ui/colors.js';

export const meta = { id: 'damas', name: 'Damas', minPlayers: 2, maxPlayers: 2 };

export const N = 8;
const DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const DRAW_PLIES = 40; // 20 lances de cada lado

export const sq = (r, c) => r * N + c;
export const rowOf = (i) => Math.floor(i / N);
export const colOf = (i) => i % N;
export const isDark = (i) => (rowOf(i) + colOf(i)) % 2 === 0;
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
export const name = (i) => 'abcdefgh'[colOf(i)] + (rowOf(i) + 1);

const clone = (s) => JSON.parse(JSON.stringify(s));
function log(s, text) { s.log = [...s.log.slice(-5), text]; }

// --------------------------------------------------------------- setup

export function defaultColors() {
  return ['branco', 'preto'];
}

/** players[0] joga com as brancas (começa); players[1] com as pretas. */
export function setup(list) {
  const players = assignColors(list.slice(0, 2), defaultColors())
    .map((p, i) => ({ id: p.id, name: p.name, color: p.color, side: i === 0 ? 'w' : 'b' }));
  const board = Array(N * N).fill(null);
  for (let i = 0; i < N * N; i++) {
    if (!isDark(i)) continue;
    if (rowOf(i) <= 2) board[i] = { s: 'w', k: false };
    else if (rowOf(i) >= 5) board[i] = { s: 'b', k: false };
  }
  const s = {
    players,
    board,
    turn: 'w',
    phase: 'play',     // play | over
    winner: null,      // índice em players, ou null (empate)
    endReason: '',
    quiet: 0,          // meios-lances seguidos só de damas, sem captura
    drawOffer: null,   // índice de quem propôs empate
    last: null,        // { from, path, captures } (para destacar e animar)
    moveSeq: 0,
    log: [],
  };
  log(s, `${players[0].name} começa com as brancas.`);
  return s;
}

export function sideIndex(state, side) {
  return state.players.findIndex((p) => p.side === side);
}

export function activePlayers(state) {
  return state.phase === 'over' ? [] : [state.players[sideIndex(state, state.turn)].id];
}

/** Quem precisa agir agora (inclui quem deve responder a uma proposta de empate). */
export function pendingPlayers(state) {
  if (state.phase === 'over') return [];
  if (state.drawOffer != null) return [state.players[1 - state.drawOffer].id];
  return activePlayers(state);
}

export function view(state) {
  return state; // nada é secreto
}

export function outcome(state) {
  if (state.phase !== 'over') return null;
  return { winners: state.winner != null ? [state.players[state.winner].id] : [] };
}

// --------------------------------------------------- lances possíveis

/**
 * Todos os lances legais do lado da vez:
 *   { from, path: [casas onde a peça para], captures: [casas capturadas] }
 * Se houver captura, só valem os lances com o MAIOR número de capturas.
 */
export function legalMoves(state, side = state.turn) {
  const { board } = state;
  let captures = [];
  for (let i = 0; i < N * N; i++) {
    const p = board[i];
    if (p && p.s === side) captures.push(...captureSequences(board, i, p));
  }
  if (captures.length) {
    const max = Math.max(...captures.map((m) => m.captures.length));
    return captures.filter((m) => m.captures.length === max);
  }
  const moves = [];
  for (let i = 0; i < N * N; i++) {
    const p = board[i];
    if (!p || p.s !== side) continue;
    const r = rowOf(i);
    const c = colOf(i);
    for (const [dr, dc] of DIRS) {
      if (!p.k) {
        const fwd = p.s === 'w' ? 1 : -1;
        if (dr !== fwd) continue;
        if (inside(r + dr, c + dc) && !board[sq(r + dr, c + dc)]) moves.push({ from: i, path: [sq(r + dr, c + dc)], captures: [] });
      } else {
        let rr = r + dr;
        let cc = c + dc;
        while (inside(rr, cc) && !board[sq(rr, cc)]) {
          moves.push({ from: i, path: [sq(rr, cc)], captures: [] });
          rr += dr; cc += dc;
        }
      }
    }
  }
  return moves;
}

function captureSequences(board, from, piece) {
  const out = [];
  // `taken`: peças já capturadas neste lance (continuam no tabuleiro até o fim,
  // bloqueiam a passagem e não podem ser saltadas de novo).
  const walk = (pos, path, taken) => {
    let extended = false;
    const r = rowOf(pos);
    const c = colOf(pos);
    for (const [dr, dc] of DIRS) {
      if (!piece.k) {
        const mr = r + dr; const mc = c + dc;
        const lr = r + 2 * dr; const lc = c + 2 * dc;
        if (!inside(lr, lc)) continue;
        const mid = sq(mr, mc); const land = sq(lr, lc);
        const mp = board[mid];
        if (!mp || mp.s === piece.s || taken.includes(mid)) continue;
        if (board[land] && land !== from) continue;
        extended = true;
        walk(land, [...path, land], [...taken, mid]);
      } else {
        let rr = r + dr; let cc = c + dc;
        while (inside(rr, cc) && (!board[sq(rr, cc)] || sq(rr, cc) === from)) { rr += dr; cc += dc; }
        if (!inside(rr, cc)) continue;
        const mid = sq(rr, cc);
        const mp = board[mid];
        if (mp.s === piece.s || taken.includes(mid)) continue;
        rr += dr; cc += dc;
        while (inside(rr, cc) && (!board[sq(rr, cc)] || sq(rr, cc) === from)) {
          const land = sq(rr, cc);
          extended = true;
          walk(land, [...path, land], [...taken, mid]);
          rr += dr; cc += dc;
        }
      }
    }
    if (!extended && taken.length) out.push({ from, path, captures: taken });
  };
  walk(from, [], []);
  return out;
}

const sameMove = (a, b) => a.from === b.from && a.path.length === b.path.length && a.path.every((x, i) => x === b.path[i]);

// ---------------------------------------------------------------- act

export function act(prev, playerId, action) {
  if (!action || typeof action !== 'object') return null;
  const me = prev.players.findIndex((p) => p.id === playerId);
  if (me < 0) return null;

  if (action.type === 'restart') {
    if (prev.phase !== 'over') return null;
    // Nova partida trocando os lados: quem jogou de pretas agora começa.
    return setup([prev.players[1], prev.players[0]]);
  }
  if (prev.phase === 'over') return null;
  const s = clone(prev);
  const player = s.players[me];
  const other = 1 - me;

  switch (action.type) {
    case 'resign':
      log(s, `${player.name} desistiu.`);
      finish(s, other, 'desistência');
      return s;

    case 'offer-draw':
      if (s.drawOffer != null) return null;
      s.drawOffer = me;
      log(s, `${player.name} propôs empate.`);
      return s;

    case 'answer-draw':
      if (s.drawOffer == null || s.drawOffer === me) return null;
      if (action.accept) {
        log(s, 'Empate combinado.');
        finish(s, null, 'acordo');
      } else {
        log(s, `${player.name} recusou o empate.`);
        s.drawOffer = null;
      }
      return s;

    case 'move': {
      if (player.side !== s.turn) return null;
      const mv = legalMoves(s).find((m) => sameMove(m, { from: action.from, path: action.path || [] }));
      if (!mv) return null;
      const piece = s.board[mv.from];
      const wasKing = piece.k;
      s.board[mv.from] = null;
      for (const cap of mv.captures) s.board[cap] = null;
      const to = mv.path[mv.path.length - 1];
      const lastRow = piece.s === 'w' ? N - 1 : 0;
      const promoted = !piece.k && rowOf(to) === lastRow;
      s.board[to] = { s: piece.s, k: piece.k || promoted };
      s.last = { from: mv.from, path: mv.path, captures: mv.captures, side: piece.s, king: wasKing, seq: ++s.moveSeq };
      s.drawOffer = null;
      s.quiet = wasKing && !mv.captures.length ? s.quiet + 1 : 0;
      const sep = mv.captures.length ? 'x' : '-';
      log(s, `${player.name}: ${[mv.from, ...mv.path].map(name).join(sep)}`
        + (mv.captures.length ? ` (capturou ${mv.captures.length})` : '') + (promoted ? ' e virou dama!' : ''));
      s.turn = s.turn === 'w' ? 'b' : 'w';

      const hasPieces = s.board.some((p) => p && p.s === s.turn);
      if (!hasPieces || !legalMoves(s).length) {
        finish(s, me, hasPieces ? 'sem lances' : 'sem peças');
      } else if (s.quiet >= DRAW_PLIES) {
        log(s, '20 lances só com damas, sem captura.');
        finish(s, null, 'regra dos 20 lances');
      }
      return s;
    }
    default:
      return null;
  }
}

function finish(s, winner, reason) {
  s.phase = 'over';
  s.winner = winner;
  s.endReason = reason;
  s.drawOffer = null;
  log(s, winner != null ? `${s.players[winner].name} venceu!` : 'Empate!');
}

export function count(state, side) {
  let men = 0; let kings = 0;
  for (const p of state.board) if (p && p.s === side) { if (p.k) kings++; else men++; }
  return { men, kings, total: men + kings };
}
