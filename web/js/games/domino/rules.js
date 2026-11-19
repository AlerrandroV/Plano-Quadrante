// ===================================================================
//  DOMINÓ (duplo-seis, 28 peças, 2 a 4 jogadores)
//
//  - Cada jogador recebe 7 peças; com 2 ou 3 jogadores sobra o "monte"
//    (quem não tem peça que encaixe compra até poder jogar; com o monte
//    vazio, passa a vez).
//  - Primeira rodada: começa quem tem a maior carroça (peça dobrada),
//    jogando essa peça; se ninguém tiver carroça, a peça mais alta.
//  - Rodadas seguintes (modo Pontos): começa quem venceu a anterior.
//  - Jogo TRANCADO (ninguém consegue jogar): vence quem tem menos pontos
//    na mão; empate na soma = rodada empatada.
//
//  Variações de vitória (opção "mode"):
//   - "batida": vence quem descartar todas as peças da mão primeiro
//     (ou, se trancar, quem tiver menos pontos na mão). Uma rodada só.
//   - "pontos": a cada jogada, se a soma das pontas for múltiplo de 5, o
//     jogador marca essa soma (carroça na ponta conta dobrado). Quem bate
//     ganha também os pontos das mãos dos outros, arredondados para o
//     múltiplo de 5 mais próximo. Rodadas até alguém chegar a 100.
//
//  Informação escondida: view() só mostra a mão de quem está olhando.
// ===================================================================
import { assignColors } from '../../ui/colors.js';

export const meta = { id: 'domino', name: 'Dominó', minPlayers: 2, maxPlayers: 4 };
export const HAND = 7;
export const TARGET = 100;

// As 28 peças: id -> { a, b } com a <= b.
export const TILES = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) TILES.push({ a, b });
export const isDouble = (id) => TILES[id].a === TILES[id].b;
export const pips = (id) => TILES[id].a + TILES[id].b;
export const tileName = (id) => `${TILES[id].a}:${TILES[id].b}`;

export const OPTIONS = [
  {
    id: 'mode', label: 'Vitória',
    choices: [
      { id: 'batida', label: 'Batida', hint: 'Vence quem descartar todas as peças primeiro.' },
      { id: 'pontos', label: 'Pontos', hint: `Pontas somando múltiplo de 5 marcam pontos; vence quem chegar a ${TARGET}.` },
    ],
    default: 'batida',
  },
];

const clone = (s) => JSON.parse(JSON.stringify(s));
function log(s, text) { s.log = [...s.log.slice(-5), text]; }
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function defaultColors() {
  return ['azul', 'vermelho', 'verde', 'laranja'];
}

// --------------------------------------------------------------- setup

export function setup(list, opts = {}) {
  const mode = opts.mode === 'pontos' ? 'pontos' : 'batida';
  const players = assignColors(list.slice(0, 4), defaultColors())
    .map((p) => ({ id: p.id, name: p.name, color: p.color, hand: [], score: 0, lacks: [] }));
  const s = {
    mode, target: TARGET, players,
    stock: [], line: [], turn: 0, phase: 'play', round: 0,
    mustPlay: null, passes: 0, seq: 0, last: null,
    roundResult: null, winner: null, log: [],
  };
  deal(s, null);
  return s;
}

/** Distribui uma rodada. starter: índice de quem começa (null = maior carroça). */
function deal(s, starter) {
  const deck = shuffle(TILES.map((_, i) => i));
  s.round += 1;
  s.players.forEach((p) => { p.hand = deck.splice(0, HAND); p.lacks = []; });
  s.stock = deck;
  s.line = [];
  s.left = 0; // quantas peças entraram pela esquerda (a 1ª peça fica em line[left])
  s.passes = 0;
  s.roundResult = null;
  s.last = null;
  s.phase = 'play';
  if (starter == null) {
    // Maior carroça; se ninguém tiver, a peça mais alta.
    let best = null;
    s.players.forEach((p, i) => p.hand.forEach((id) => {
      const key = (isDouble(id) ? 100 : 0) + pips(id) * 2 + TILES[id].b / 10;
      if (!best || key > best.key) best = { i, id, key };
    }));
    s.turn = best.i;
    s.mustPlay = best.id;
    log(s, `Rodada ${s.round}: ${s.players[best.i].name} começa com ${tileName(best.id)}.`);
  } else {
    s.turn = starter;
    s.mustPlay = null;
    log(s, `Rodada ${s.round}: ${s.players[starter].name} começa.`);
  }
}

export function activePlayers(state) {
  return state.phase === 'play' ? [state.players[state.turn].id] : [];
}

/** Quem precisa agir: na pausa entre rodadas, qualquer um pode seguir. */
export function pendingPlayers(state) {
  if (state.phase === 'round') return state.players.map((p) => p.id);
  return activePlayers(state);
}

/** Cada um só vê a própria mão (e todas ao fim da rodada). */
export function view(state, playerId) {
  const v = clone(state);
  const reveal = state.phase !== 'play';
  v.stockCount = state.stock.length;
  v.stock = [];
  v.players.forEach((p) => {
    p.handCount = p.hand.length;
    if (!reveal && p.id !== playerId) p.hand = [];
  });
  return v;
}

export function outcome(state) {
  if (state.phase !== 'over') return null;
  return { winners: state.winner != null ? [state.players[state.winner].id] : [] };
}

// ------------------------------------------------------ jogadas possíveis

export function ends(state) {
  if (!state.line.length) return null;
  return { L: state.line[0].l, R: state.line[state.line.length - 1].r };
}

/** Jogadas possíveis com a mão `hand`: [{ id, end: 'L'|'R' }]. */
export function playsFor(state, hand) {
  if (!state.line.length) {
    if (state.mustPlay != null) return hand.includes(state.mustPlay) ? [{ id: state.mustPlay, end: 'R' }] : [];
    return hand.map((id) => ({ id, end: 'R' }));
  }
  const { L, R } = ends(state);
  const out = [];
  for (const id of hand) {
    const { a, b } = TILES[id];
    const fitL = a === L || b === L;
    const fitR = a === R || b === R;
    if (fitL) out.push({ id, end: 'L' });
    // Pontas iguais: tanto faz o lado, oferece um só.
    if (fitR && !(fitL && L === R)) out.push({ id, end: 'R' });
  }
  return out;
}

export function legalPlays(state) {
  if (state.phase !== 'play') return [];
  return playsFor(state, state.players[state.turn].hand);
}

/** Soma das pontas (carroça na ponta conta dobrado). */
export function endsSum(line) {
  if (!line.length) return 0;
  if (line.length === 1) {
    const t = line[0];
    return t.l + t.r;
  }
  const first = line[0];
  const last = line[line.length - 1];
  const left = first.l === first.r ? first.l * 2 : first.l;
  const right = last.l === last.r ? last.r * 2 : last.r;
  return left + right;
}

const handPips = (p) => p.hand.reduce((t, id) => t + pips(id), 0);
const round5 = (n) => Math.round(n / 5) * 5;

// ---------------------------------------------------------------- act

export function act(prev, playerId, action) {
  if (!action || typeof action !== 'object') return null;
  const idx = prev.players.findIndex((p) => p.id === playerId);

  if (action.type === 'restart') {
    if (prev.phase !== 'over' || idx < 0) return null;
    return setup(prev.players.map(({ id, name, color }) => ({ id, name, color })), { mode: prev.mode });
  }
  if (action.type === 'next-round') {
    if (prev.phase !== 'round' || idx < 0) return null;
    const s = clone(prev);
    const starter = s.roundResult.winner != null ? s.roundResult.winner : (s.turn + 1) % s.players.length;
    deal(s, starter);
    return s;
  }
  if (prev.phase !== 'play' || idx !== prev.turn) return null;

  const s = clone(prev);
  const me = s.players[idx];

  switch (action.type) {
    case 'play': {
      // A peça precisa encaixar; se só encaixa de um lado, o lado pedido não importa.
      const options = legalPlays(s).filter((m) => m.id === action.id);
      const ok = options.find((m) => m.end === action.end) || (options.length === 1 ? options[0] : null);
      if (!ok) return null;
      const { a, b } = TILES[ok.id];
      if (!s.line.length) {
        s.line.push({ id: ok.id, l: a, r: b });
      } else if (ok.end === 'L') {
        const L = s.line[0].l;
        s.line.unshift({ id: ok.id, l: a === L ? b : a, r: L });
        s.left += 1;
      } else {
        const R = s.line[s.line.length - 1].r;
        s.line.push({ id: ok.id, l: R, r: a === R ? b : a });
      }
      me.hand = me.hand.filter((x) => x !== ok.id);
      s.mustPlay = null;
      s.passes = 0;
      let points = 0;
      if (s.mode === 'pontos') {
        const sum = endsSum(s.line);
        if (sum > 0 && sum % 5 === 0) { points = sum; me.score += sum; }
      }
      s.last = { seq: ++s.seq, kind: 'play', pid: idx, id: ok.id, end: ok.end, points };
      log(s, `${me.name} jogou ${tileName(ok.id)}${points ? ` e marcou ${points}!` : '.'}`);
      if (!me.hand.length) endRound(s, idx, 'batida');
      else nextTurn(s);
      return s;
    }
    case 'draw': {
      if (legalPlays(s).length || !s.stock.length) return null;
      const id = s.stock.pop();
      me.hand.push(id);
      const e = ends(s);
      if (e) for (const v of [e.L, e.R]) if (!me.lacks.includes(v)) me.lacks.push(v);
      s.last = { seq: ++s.seq, kind: 'draw', pid: idx };
      log(s, `${me.name} comprou do monte.`);
      return s;
    }
    case 'pass': {
      if (legalPlays(s).length || s.stock.length) return null;
      const e = ends(s);
      if (e) for (const v of [e.L, e.R]) if (!me.lacks.includes(v)) me.lacks.push(v);
      s.passes += 1;
      s.last = { seq: ++s.seq, kind: 'pass', pid: idx };
      log(s, `${me.name} passou.`);
      if (s.passes >= s.players.length) {
        // Trancado: menor soma na mão vence (empate na soma = sem vencedor).
        const sums = s.players.map(handPips);
        const min = Math.min(...sums);
        const who = sums.flatMap((v, i) => (v === min ? [i] : []));
        endRound(s, who.length === 1 ? who[0] : null, 'trancado');
      } else {
        nextTurn(s);
      }
      return s;
    }
    default:
      return null;
  }
}

function nextTurn(s) {
  s.turn = (s.turn + 1) % s.players.length;
}

function endRound(s, winner, reason) {
  const hands = s.players.map((p) => ({ pips: handPips(p) }));
  let bonus = 0;
  if (winner != null) {
    const others = s.players.reduce((t, p, i) => (i === winner ? t : t + handPips(p)), 0);
    if (s.mode === 'pontos') {
      bonus = round5(others);
      s.players[winner].score += bonus;
    }
  }
  s.roundResult = { winner, reason, bonus, hands };
  const who = winner != null ? s.players[winner].name : null;
  if (reason === 'batida') log(s, `${who} bateu!${bonus ? ` +${bonus} pontos.` : ''}`);
  else log(s, who ? `Trancou! ${who} tem menos pontos na mão.${bonus ? ` +${bonus}.` : ''}` : 'Trancou empatado.');

  if (s.mode === 'batida') {
    s.phase = 'over';
    s.winner = winner;
    log(s, who ? `${who} venceu!` : 'Empate!');
    return;
  }
  const top = Math.max(...s.players.map((p) => p.score));
  if (top >= s.target) {
    const leaders = s.players.flatMap((p, i) => (p.score === top ? [i] : []));
    s.winner = leaders.length === 1 ? leaders[0] : (leaders.includes(winner) ? winner : leaders[0]);
    s.phase = 'over';
    log(s, `${s.players[s.winner].name} chegou a ${top} e venceu!`);
  } else {
    s.phase = 'round';
  }
}
