// ===================================================================
//  SOLITÁRIO (Paciência / Klondike) — 1 jogador
//
//  - 7 colunas com 1 a 7 cartas (só a de cima aberta); o resto é o monte.
//  - Objetivo: levar as 52 cartas para as 4 fundações, uma por naipe, do Ás
//    ao Rei.
//  - Nas colunas: carta sobre outra de cor diferente e valor 1 acima
//    (ex.: 6 vermelho sobre 7 preto). Pode mover uma sequência aberta
//    inteira. Coluna vazia só recebe Rei.
//  - Monte: tira 1 (fácil), 2 (médio) ou 3 (difícil) cartas por vez; só a
//    de cima do descarte pode ser jogada. Acabou o monte: o descarte vira
//    monte de novo (sem limite de voltas).
//  - Desfazer volta a última jogada; "Recolher" leva para as fundações tudo
//    o que já pode ir.
// ===================================================================
import { rankOf, suitOf, isRed } from '../../ui/cards52.js';

export const meta = { id: 'solitario', name: 'Solitário', minPlayers: 1, maxPlayers: 1 };
export const DRAW = { facil: 1, medio: 2, dificil: 3 };
const HIST = 60;

export const OPTIONS = [
  {
    id: 'nivel', label: 'Nível',
    choices: [
      { id: 'facil', label: 'Fácil', hint: 'Tira 1 carta do monte por vez.' },
      { id: 'medio', label: 'Médio', hint: 'Tira 2 cartas por vez (só a de cima vale).' },
      { id: 'dificil', label: 'Difícil', hint: 'Tira 3 cartas por vez (só a de cima vale).' },
    ],
    default: 'facil',
  },
];

const clone = (s) => JSON.parse(JSON.stringify(s));
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function defaultColors() { return ['azul']; }

export function setup(list, opts = {}) {
  const nivel = DRAW[opts.nivel] ? opts.nivel : 'facil';
  const p = list[0];
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i));
  const tab = [];
  for (let i = 0; i < 7; i++) {
    tab.push(deck.splice(0, i + 1).map((c, k) => ({ c, up: k === i })));
  }
  return {
    opts: { nivel },
    players: [{ id: p.id, name: p.name, color: p.color || 'azul' }],
    drawN: DRAW[nivel],
    tab, stock: deck, waste: [], found: [[], [], [], []],
    moves: 0, passes: 0, hist: [],
    phase: 'play', won: false, seq: 0, last: { seq: 0, kind: 'deal' },
  };
}

export function activePlayers(state) {
  return state.phase === 'play' ? [state.players[0].id] : [];
}

/** Cartas fechadas ficam escondidas (até para quem joga). */
export function view(state) {
  const v = clone(state);
  v.stockCount = state.stock.length;
  v.stock = [];
  v.histCount = state.hist.length;
  v.hist = [];
  v.tab = v.tab.map((col) => col.map((x) => (x.up ? x : { c: -1, up: false })));
  return v;
}

export function outcome(state) {
  if (state.phase !== 'over') return null;
  return { winners: state.won ? [state.players[0].id] : [] };
}

// ------------------------------------------------------------- regras

/** Cartas que sairiam de `from` (waste | found i | tab i a partir de k). */
export function pick(state, from) {
  if (!from) return null;
  if (from.t === 'waste') return state.waste.length ? [state.waste[state.waste.length - 1]] : null;
  if (from.t === 'found') { const f = state.found[from.i]; return f?.length ? [f[f.length - 1]] : null; }
  if (from.t === 'tab') {
    const col = state.tab[from.i];
    if (!col || from.k == null || from.k < 0 || from.k >= col.length || !col[from.k].up) return null;
    return col.slice(from.k).map((x) => x.c);
  }
  return null;
}

/** Pode colocar `cards` em `to`? */
export function fits(state, cards, to, from = null) {
  if (!cards?.length || !to) return false;
  const first = cards[0];
  if (to.t === 'found') {
    if (cards.length !== 1 || (from && from.t === 'found')) return false;
    const f = state.found[suitOf(first)];
    return f.length === rankOf(first) - 1;
  }
  if (to.t === 'tab') {
    if (from && from.t === 'tab' && from.i === to.i) return false;
    const col = state.tab[to.i];
    if (!col) return false;
    if (!col.length) return rankOf(first) === 13;
    const top = col[col.length - 1];
    return top.up && isRed(top.c) !== isRed(first) && rankOf(top.c) === rankOf(first) + 1;
  }
  return false;
}

/** Destinos possíveis para o que sai de `from` (fundação primeiro). */
export function destinations(state, from) {
  const cards = pick(state, from);
  if (!cards) return [];
  const out = [];
  if (cards.length === 1 && from.t !== 'found' && fits(state, cards, { t: 'found' }, from)) out.push({ t: 'found', i: suitOf(cards[0]) });
  for (let i = 0; i < 7; i++) if (fits(state, cards, { t: 'tab', i }, from)) out.push({ t: 'tab', i });
  return out;
}

const snapshot = (s) => JSON.stringify({ tab: s.tab, stock: s.stock, waste: s.waste, found: s.found, moves: s.moves, passes: s.passes });
function remember(s) { s.hist = [...s.hist.slice(-(HIST - 1)), snapshot(s)]; }

function doMove(s, from, to) {
  const cards = pick(s, from);
  if (!cards || !fits(s, cards, to, from)) return false;
  if (from.t === 'waste') s.waste.pop();
  else if (from.t === 'found') s.found[from.i].pop();
  else {
    s.tab[from.i].splice(from.k);
    const col = s.tab[from.i];
    if (col.length && !col[col.length - 1].up) col[col.length - 1].up = true; // vira a de baixo
  }
  if (to.t === 'found') s.found[suitOf(cards[0])].push(cards[0]);
  else s.tab[to.i].push(...cards.map((c) => ({ c, up: true })));
  s.moves += 1;
  return true;
}

/** Algo pode ir para as fundações agora? */
export function canCollect(state) {
  if (state.waste.length && fits(state, [state.waste[state.waste.length - 1]], { t: 'found' })) return true;
  return state.tab.some((col) => col.length && col[col.length - 1].up && fits(state, [col[col.length - 1].c], { t: 'found' }));
}

/** Tudo aberto e monte vazio: dá para terminar sozinho. */
export function solvable(state) {
  return !(state.stockCount ?? state.stock.length) && !state.waste.length && state.tab.every((col) => col.every((x) => x.up));
}

function checkWin(s) {
  if (s.found.every((f) => f.length === 13)) { s.phase = 'over'; s.won = true; s.last = { seq: ++s.seq, kind: 'win' }; }
  return s;
}

export function act(prev, playerId, action) {
  if (!action || typeof action !== 'object' || prev.players[0].id !== playerId) return null;
  if (action.type === 'restart') return setup(prev.players, prev.opts);
  if (prev.phase !== 'play') return null;
  const s = clone(prev);
  switch (action.type) {
    case 'draw': {
      if (!s.stock.length && !s.waste.length) return null;
      remember(s);
      if (s.stock.length) {
        const n = Math.min(s.drawN, s.stock.length);
        for (let i = 0; i < n; i++) s.waste.push(s.stock.pop());
        s.last = { seq: ++s.seq, kind: 'draw', n };
      } else {
        s.stock = s.waste.reverse();
        s.waste = [];
        s.passes += 1;
        s.last = { seq: ++s.seq, kind: 'recycle' };
      }
      s.moves += 1;
      return s;
    }
    case 'move': {
      const before = snapshot(s);
      if (!doMove(s, action.from, action.to)) return null;
      s.hist = [...s.hist.slice(-(HIST - 1)), before];
      s.last = { seq: ++s.seq, kind: 'move', to: action.to.t };
      return checkWin(s);
    }
    case 'collect': {
      const before = snapshot(s);
      let n = 0;
      for (let guard = 0; guard < 60; guard++) {
        let moved = false;
        if (s.waste.length && doMove(s, { t: 'waste' }, { t: 'found' })) moved = true;
        for (let i = 0; i < 7 && !moved; i++) {
          const col = s.tab[i];
          if (col.length && doMove(s, { t: 'tab', i, k: col.length - 1 }, { t: 'found' })) moved = true;
        }
        if (!moved) break;
        n++;
      }
      if (!n) return null;
      s.hist = [...s.hist.slice(-(HIST - 1)), before];
      s.last = { seq: ++s.seq, kind: 'collect', n };
      return checkWin(s);
    }
    case 'undo': {
      if (!s.hist.length) return null;
      Object.assign(s, JSON.parse(s.hist.pop()));
      s.last = { seq: ++s.seq, kind: 'undo' };
      return s;
    }
    case 'giveup':
      s.phase = 'over';
      s.won = false;
      s.last = { seq: ++s.seq, kind: 'giveup' };
      return s;
    default:
      return null;
  }
}
