// ===================================================================
//  POKER — Texas Hold'em sem limite (2 a 8 jogadores)
//
//  - Cada um começa com as mesmas fichas. A cada mão, o botão (D) gira;
//    os dois seguintes põem o small e o big blind (no mano a mano, o
//    botão é o small blind e fala primeiro antes do flop).
//  - Cada jogador recebe 2 cartas fechadas. Rodadas de aposta: antes do
//    flop, no flop (3 cartas na mesa), no turn (4ª) e no river (5ª).
//  - Na vez: desistir, passar (se ninguém apostou), pagar, apostar/aumentar
//    (aumento mínimo = o último aumento, ou o big blind) ou ir de all-in.
//  - Showdown: vence a melhor mão de 5 cartas entre as 2 da mão e as 5 da
//    mesa. All-in com menos fichas cria potes paralelos (side pots): cada
//    um só disputa o que pôde cobrir. Empate divide o pote.
//  - Quem fica sem fichas sai. Fim: quando sobra um (ou, na opção de 20
//    mãos, vence quem tiver mais fichas depois da 20ª mão).
// ===================================================================
import { assignColors } from '../../ui/colors.js';
import { RANK_NAME } from '../../ui/cards52.js';

export const meta = { id: 'poker', name: 'Poker', minPlayers: 2, maxPlayers: 8 };
export const BLINDS = [[5, 10], [10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000], [1000, 2000], [2000, 4000]];
const EVERY = { lento: 10, rapido: 5, fixo: 0 };
export const HANDS_LIMIT = 20;

export const OPTIONS = [
  {
    id: 'fichas', label: 'Fichas',
    choices: [
      { id: '500', label: '500', hint: 'Partida curta (blinds 5/10).' },
      { id: '1000', label: '1000', hint: 'Blinds começam em 10/20.' },
      { id: '2000', label: '2000', hint: 'Partida longa (blinds 10/20).' },
    ],
    default: '1000',
  },
  {
    id: 'blinds', label: 'Blinds',
    choices: [
      { id: 'lento', label: '10 mãos', hint: 'Os blinds sobem a cada 10 mãos.' },
      { id: 'rapido', label: '5 mãos', hint: 'Os blinds sobem a cada 5 mãos.' },
      { id: 'fixo', label: 'Fixos', hint: 'Os blinds nunca sobem.' },
    ],
    default: 'lento',
  },
  {
    id: 'fim', label: 'Fim',
    choices: [
      { id: 'ultimo', label: 'Sobra 1', hint: 'Até alguém ficar com todas as fichas.' },
      { id: 'maos', label: `${HANDS_LIMIT} mãos`, hint: `Depois de ${HANDS_LIMIT} mãos, vence quem tiver mais fichas.` },
    ],
    default: 'ultimo',
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
  return ['azul', 'vermelho', 'verde', 'laranja', 'roxo', 'amarelo', 'rosa', 'ciano'];
}

// ------------------------------------------------- avaliação de mãos

const val = (code) => { const r = (code % 13) + 1; return r === 1 ? 14 : r; };
const suit = (code) => Math.floor(code / 13);
const B = 15;
const CAT = ['Carta alta', 'Par', 'Dois pares', 'Trinca', 'Sequência', 'Flush', 'Full house', 'Quadra', 'Straight flush', 'Royal flush'];
const PLURAL = { 14: 'Ases', 13: 'Reis', 12: 'Damas', 11: 'Valetes' };
const word = (v) => PLURAL[v] || String(v);
const one = (v) => (v === 14 ? 'Ás' : RANK_NAME[v] || String(v));

/** Avalia exatamente 5 cartas: { score, cat, keys }. */
export function eval5(cards) {
  const vs = cards.map(val).sort((a, b) => b - a);
  const flush = cards.every((c) => suit(c) === suit(cards[0]));
  const uniq = [...new Set(vs)];
  let straight = 0;
  if (uniq.length === 5) {
    if (vs[0] - vs[4] === 4) straight = vs[0];
    else if (vs[0] === 14 && vs[1] === 5) straight = 5; // A-2-3-4-5
  }
  const count = new Map();
  for (const v of vs) count.set(v, (count.get(v) || 0) + 1);
  const groups = [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const keys = groups.map((g) => g[0]);
  let cat;
  if (straight && flush) cat = 8;
  else if (groups[0][1] === 4) cat = 7;
  else if (groups[0][1] === 3 && groups[1][1] === 2) cat = 6;
  else if (flush) cat = 5;
  else if (straight) cat = 4;
  else if (groups[0][1] === 3) cat = 3;
  else if (groups[0][1] === 2 && groups[1][1] === 2) cat = 2;
  else if (groups[0][1] === 2) cat = 1;
  else cat = 0;
  const tie = straight && (cat === 8 || cat === 4) ? [straight] : keys;
  let score = cat;
  for (let i = 0; i < 5; i++) score = score * B + (tie[i] || 0);
  return { score, cat, keys: tie };
}

/** Melhor mão de 5 entre 5 a 7 cartas: { score, cat, best, name }. */
export function bestHand(cards) {
  let best = null;
  const n = cards.length;
  const pick = [];
  const go = (start) => {
    if (pick.length === 5) {
      const five = pick.map((i) => cards[i]);
      const e = eval5(five);
      if (!best || e.score > best.score) best = { ...e, best: five };
      return;
    }
    for (let i = start; i <= n - (5 - pick.length); i++) { pick.push(i); go(i + 1); pick.pop(); }
  };
  go(0);
  best.name = handName(best);
  return best;
}

export function handName({ cat, keys }) {
  switch (cat) {
    case 8: return keys[0] === 14 ? CAT[9] : `${CAT[8]} até ${one(keys[0])}`;
    case 7: return `Quadra de ${word(keys[0])}`;
    case 6: return `Full house: ${word(keys[0])} e ${word(keys[1])}`;
    case 5: return `Flush, ${one(keys[0])} alto`;
    case 4: return `Sequência até ${one(keys[0])}`;
    case 3: return `Trinca de ${word(keys[0])}`;
    case 2: return `Dois pares: ${word(keys[0])} e ${word(keys[1])}`;
    case 1: return `Par de ${word(keys[0])}`;
    default: return `Carta alta: ${one(keys[0])}`;
  }
}

// --------------------------------------------------------------- setup

export function setup(list, opts = {}) {
  const chips = Number(opts.fichas) || 1000;
  const o = {
    fichas: String(chips),
    blinds: EVERY[opts.blinds] != null ? opts.blinds : 'lento',
    fim: opts.fim === 'maos' ? 'maos' : 'ultimo',
  };
  const players = assignColors(list.slice(0, meta.maxPlayers), defaultColors())
    .map((p) => ({ id: p.id, name: p.name, color: p.color, chips, hole: [], bet: 0, total: 0, folded: false, allin: false, out: false, acted: false }));
  const s = {
    opts: o, players, deck: [], board: [], street: 'preflop', phase: 'bet',
    dealer: Math.floor(Math.random() * players.length) - 1, hand: 0, level: chips <= 500 ? 0 : 1,
    turn: 0, curBet: 0, minRaise: 0, sb: -1, bb: -1,
    results: null, winner: null, seq: 0, last: null, log: [],
  };
  newHand(s);
  return s;
}

const blinds = (s) => BLINDS[Math.min(s.level, BLINDS.length - 1)];
const alive = (s) => s.players.map((_, i) => i).filter((i) => !s.players[i].out);
const canAct = (p) => !p.out && !p.folded && !p.allin;
function nextFrom(s, i, ok) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (ok(s.players[j], j)) return j; }
  return -1;
}

function put(s, i, amount) {
  const p = s.players[i];
  const x = Math.max(0, Math.min(amount, p.chips));
  p.chips -= x;
  p.bet += x;
  p.total += x;
  if (p.chips === 0) p.allin = true;
  return x;
}

function newHand(s) {
  for (const p of s.players) if (p.chips <= 0) p.out = true;
  const live = alive(s);
  if (live.length < 2 || (s.opts.fim === 'maos' && s.hand >= HANDS_LIMIT)) return gameOver(s);
  s.hand += 1;
  const every = EVERY[s.opts.blinds];
  if (every && s.hand > 1 && (s.hand - 1) % every === 0 && s.level < BLINDS.length - 1) {
    s.level += 1;
    log(s, `Blinds sobem: ${blinds(s)[0]}/${blinds(s)[1]}.`);
  }
  for (const p of s.players) Object.assign(p, { hole: [], bet: 0, total: 0, folded: p.out, allin: false, acted: false });
  s.deck = shuffle(Array.from({ length: 52 }, (_, i) => i));
  s.board = [];
  s.street = 'preflop';
  s.phase = 'bet';
  s.results = null;
  s.dealer = nextFrom(s, Math.max(-1, s.dealer), (p) => !p.out);
  const [small, big] = blinds(s);
  if (live.length === 2) { s.sb = s.dealer; s.bb = nextFrom(s, s.dealer, (p) => !p.out); }
  else { s.sb = nextFrom(s, s.dealer, (p) => !p.out); s.bb = nextFrom(s, s.sb, (p) => !p.out); }
  put(s, s.sb, small);
  put(s, s.bb, big);
  s.curBet = Math.max(s.players[s.sb].bet, s.players[s.bb].bet);
  s.minRaise = big;
  for (const i of live) s.players[i].hole = [s.deck.pop(), s.deck.pop()];
  s.last = { seq: ++s.seq, kind: 'deal', hand: s.hand };
  log(s, `Mão ${s.hand}: ${s.players[s.dealer].name} dá as cartas.`);
  s.turn = nextFrom(s, s.bb, canAct);
  if (s.turn < 0 || !needsAction(s)) return finishStreet(s);
  return s;
}

/** Ainda falta alguém agir nesta rodada de apostas? */
function needsAction(s) {
  return s.players.some((p) => canAct(p) && (!p.acted || p.bet < s.curBet));
}

function inHand(s) {
  return s.players.map((_, i) => i).filter((i) => !s.players[i].out && !s.players[i].folded);
}

function gameOver(s) {
  s.phase = 'over';
  let best = -1;
  s.players.forEach((p, i) => { if (best < 0 || p.chips > s.players[best].chips) best = i; });
  s.winner = best;
  s.last = { seq: ++s.seq, kind: 'over' };
  log(s, `${s.players[best].name} venceu com ${s.players[best].chips} fichas!`);
  return s;
}

export function activePlayers(state) {
  return state.phase === 'bet' ? [state.players[state.turn].id] : [];
}

/** No showdown, qualquer jogador pode pedir a próxima mão. */
export function pendingPlayers(state) {
  if (state.phase === 'showdown') return state.players.filter((p) => !p.out).map((p) => p.id);
  return activePlayers(state);
}

export function view(state, playerId) {
  const v = clone(state);
  v.deck = [];
  const shown = new Set(state.results?.shown || []);
  v.players.forEach((p, i) => {
    if (p.id !== playerId && !shown.has(i)) p.hole = p.hole.map(() => -1);
  });
  return v;
}

export function outcome(state) {
  if (state.phase !== 'over') return null;
  return { winners: state.winner != null ? [state.players[state.winner].id] : [] };
}

export const pot = (state) => state.players.reduce((t, p) => t + p.total, 0);

/** Limites de aposta de quem está na vez. */
export function betLimits(state) {
  const p = state.players[state.turn];
  const toCall = Math.max(0, state.curBet - p.bet);
  const maxTo = p.bet + p.chips;
  const minTo = Math.min(maxTo, state.curBet + state.minRaise);
  return { toCall: Math.min(toCall, p.chips), minTo, maxTo, canCheck: toCall === 0, canRaise: maxTo > state.curBet };
}

// ---------------------------------------------------------------- act

export function act(prev, playerId, action) {
  if (!action || typeof action !== 'object') return null;
  const idx = prev.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return null;
  if (action.type === 'restart') {
    if (prev.phase !== 'over') return null;
    return setup(prev.players.map(({ id, name, color }) => ({ id, name, color })), prev.opts);
  }
  if (action.type === 'next') {
    if (prev.phase !== 'showdown' || prev.players[idx].out) return null;
    const s = clone(prev);
    return newHand(s);
  }
  if (prev.phase !== 'bet' || idx !== prev.turn) return null;
  const s = clone(prev);
  const p = s.players[idx];
  const lim = betLimits(s);
  switch (action.type) {
    case 'fold':
      p.folded = true;
      s.last = { seq: ++s.seq, kind: 'fold', pid: idx };
      log(s, `${p.name} desistiu.`);
      break;
    case 'check':
      if (!lim.canCheck) return null;
      s.last = { seq: ++s.seq, kind: 'check', pid: idx };
      log(s, `${p.name} passou.`);
      break;
    case 'call': {
      if (lim.canCheck) return null;
      // (também é o "all-in" de quem não tem nem o suficiente para pagar)
      const x = put(s, idx, lim.toCall);
      s.last = { seq: ++s.seq, kind: 'call', pid: idx, amount: x };
      log(s, p.allin ? `${p.name} pagou ${x} (all-in).` : `${p.name} pagou ${x}.`);
      break;
    }
    case 'allin':
      if (!lim.canRaise) {
        if (lim.canCheck) return null;
        return act(prev, playerId, { type: 'call' });
      }
      // fallthrough: all-in que aumenta
    case 'raise': {
      const to = action.type === 'allin' ? lim.maxTo : Math.floor(Number(action.to));
      // eslint-disable-next-line no-fallthrough
      if (!lim.canRaise || !(to > s.curBet) || to > lim.maxTo) return null;
      if (to < lim.minTo && to !== lim.maxTo) return null; // aumento menor que o mínimo só se for all-in
      const raise = to - s.curBet;
      const wasBet = s.curBet === 0;
      put(s, idx, to - p.bet);
      if (raise >= s.minRaise) s.minRaise = raise;
      s.curBet = to;
      // Aumentou: todo mundo precisa responder de novo.
      for (const q of s.players) if (q !== p) q.acted = false;
      s.last = { seq: ++s.seq, kind: 'raise', pid: idx, to };
      log(s, p.allin ? `${p.name}: ALL-IN (${to}).` : `${p.name} ${wasBet ? 'apostou' : 'aumentou para'} ${to}.`);
      break;
    }
    default:
      return null;
  }
  p.acted = true;
  return advance(s);
}

function advance(s) {
  const left = inHand(s);
  if (left.length === 1) return award(s, left[0]);
  if (needsAction(s)) {
    s.turn = nextFrom(s, s.turn, (q) => canAct(q) && (!q.acted || q.bet < s.curBet));
    return s;
  }
  return finishStreet(s);
}

/** Fecha a rodada de apostas e abre a próxima (ou vai ao showdown). */
function finishStreet(s) {
  for (const p of s.players) { p.bet = 0; p.acted = false; }
  s.curBet = 0;
  s.minRaise = blinds(s)[1];
  const order = ['preflop', 'flop', 'turn', 'river'];
  const deal = { flop: 3, turn: 1, river: 1 };
  // Só um (ou ninguém) ainda pode apostar: abre a mesa toda e mostra.
  const actors = s.players.filter(canAct).length;
  while (true) {
    const i = order.indexOf(s.street);
    if (i === 3) return showdown(s);
    s.street = order[i + 1];
    for (let k = 0; k < deal[s.street]; k++) s.board.push(s.deck.pop());
    log(s, `${{ flop: 'Flop', turn: 'Turn', river: 'River' }[s.street]}.`);
    if (actors >= 2) break;
  }
  s.last = { seq: ++s.seq, kind: 'street', street: s.street };
  s.turn = nextFrom(s, s.dealer, canAct);
  return s;
}

/** Todos desistiram menos um: leva o pote sem mostrar. */
function award(s, i) {
  const total = pot(s);
  s.players[i].chips += total;
  s.results = { uncontested: i, pots: [{ amount: total, winners: [i] }], shown: [], hands: {} };
  for (const p of s.players) p.bet = 0;
  s.phase = 'showdown';
  s.last = { seq: ++s.seq, kind: 'win', pid: i };
  log(s, `${s.players[i].name} leva ${total}.`);
  return s;
}

function showdown(s) {
  const left = inHand(s);
  const hands = {};
  for (const i of left) hands[i] = bestHand([...s.players[i].hole, ...s.board]);
  // Potes paralelos: cada nível de contribuição forma um pote.
  const levels = [...new Set(s.players.map((p) => p.total).filter((t) => t > 0))].sort((a, b) => a - b);
  const pots = [];
  let prevL = 0;
  for (const L of levels) {
    const amount = s.players.reduce((t, p) => t + Math.max(0, Math.min(p.total, L) - prevL), 0);
    let elig = left.filter((i) => s.players[i].total >= L);
    if (!elig.length) elig = [left.reduce((a, b) => (s.players[b].total > s.players[a].total ? b : a))];
    prevL = L;
    if (!amount) continue;
    const top = Math.max(...elig.map((i) => hands[i].score));
    const winners = elig.filter((i) => hands[i].score === top);
    const last = pots[pots.length - 1];
    if (last && last.winners.join() === winners.join() && last.elig.join() === elig.join()) { last.amount += amount; continue; }
    pots.push({ amount, winners, elig });
  }
  for (const pt of pots) {
    const share = Math.floor(pt.amount / pt.winners.length);
    let rest = pt.amount - share * pt.winners.length;
    // Ficha que sobra na divisão: para o primeiro depois do botão.
    const ordered = pt.winners.slice().sort((a, b) => ((a - s.dealer + 99) % s.players.length) - ((b - s.dealer + 99) % s.players.length));
    for (const w of ordered) { s.players[w].chips += share + (rest > 0 ? 1 : 0); rest -= 1; }
  }
  for (const p of s.players) p.bet = 0;
  const handInfo = Object.fromEntries(Object.entries(hands).map(([i, hd]) => [i, { name: hd.name, best: hd.best, cat: hd.cat }]));
  s.results = { pots: pots.map(({ amount, winners }) => ({ amount, winners })), shown: left, hands: handInfo };
  s.phase = 'showdown';
  s.last = { seq: ++s.seq, kind: 'showdown' };
  const main = pots[0];
  if (main) log(s, `${main.winners.map((i) => s.players[i].name).join(' e ')} ${main.winners.length > 1 ? 'dividem' : 'leva'} ${pots.reduce((t, x) => t + x.amount, 0)} com ${hands[main.winners[0]].name}.`);
  return s;
}
