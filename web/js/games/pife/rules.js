// ===================================================================
//  PIFE (2 a 6 jogadores, dois baralhos)
//
//  - Cada jogador recebe 9 cartas. Na vez: compra 1 (do monte ou a de
//    cima do descarte) e descarta 1.
//  - BATER: ter as 9 cartas em 3 jogos de 3 e descartar a 10ª.
//      Trinca: 3 cartas do mesmo valor, de naipes diferentes.
//      Sequência: 3 cartas seguidas do mesmo naipe (A-2-3 e Q-K-A valem;
//      K-A-2 não).
//  - Quem pegou a carta do descarte não pode descartá-la de volta.
//  - Monte acabou: o descarte (menos a de cima) é embaralhado e vira monte.
//
//  REGRAS DA CASA (as que "todo mundo concorda", como opções):
//  - mele: entram os 4 curingas (melé). O melé vale qualquer carta, um
//    por jogo.
//  - naipe: bater com as 9 cartas do mesmo naipe (o melé vale qualquer
//    naipe).
//  - semPar: bater de cara se as 9 cartas recebidas não formam nem um
//    par: nenhum valor repetido e nenhuma dupla do mesmo naipe que possa
//    virar sequência (seguidas ou com um buraco, ex.: 5 e 7).
//  - choque: quem anuncia que bateu sem ter batido "deu choque": a partir
//    daí só pode bater com carta comprada do MONTE (não do descarte).
//
//  As cartas da mão são guardadas em ids (0..103 = dois baralhos de 52;
//  104..107 = melés). code(id) dá a carta (0..51, ou 52 = melé).
// ===================================================================
import { assignColors } from '../../ui/colors.js';
import { JOKER, rankOf, suitOf, cardLabel } from '../../ui/cards52.js';

export const meta = { id: 'pife', name: 'Pife', minPlayers: 2, maxPlayers: 6 };
export const HAND = 9;
export const HOUSE = ['mele', 'naipe', 'semPar', 'choque'];

export const code = (id) => (id >= 104 ? JOKER : id % 52);
export const isJoker = (id) => id >= 104;
export const name = (id) => cardLabel(code(id));

export const OPTIONS = [
  {
    id: 'regras', label: 'Regras',
    choices: [
      { id: 'tradicional', label: 'Tradicional', hint: 'Dois baralhos, sem melé: 3 jogos de 3.' },
      { id: 'casa', label: 'Da casa', hint: '' },
    ],
    default: 'casa',
  },
  {
    id: 'casa', label: 'Da casa', type: 'flags', showIf: { regras: 'casa' },
    choices: [
      { id: 'mele', label: 'Com melé', hint: 'Entram 4 curingas (melé): vale qualquer carta, um por jogo.' },
      { id: 'naipe', label: 'Bater de naipe', hint: 'As 9 cartas do mesmo naipe batem (o melé vale qualquer naipe).' },
      { id: 'semPar', label: 'Mão sem par', hint: 'Recebeu 9 cartas sem nenhum par? Bate de cara.' },
      { id: 'choque', label: 'Choque', hint: 'Anunciou que bateu sem ter batido? Só bate com carta do monte.' },
    ],
    default: ['mele', 'naipe', 'semPar', 'choque'],
  },
];

export function houseRules(opts = {}) {
  if (opts.regras === 'tradicional') return {};
  const list = Array.isArray(opts.casa) ? opts.casa : OPTIONS[1].default;
  return Object.fromEntries(HOUSE.map((h) => [h, list.includes(h)]));
}

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
  return ['azul', 'vermelho', 'verde', 'laranja', 'roxo', 'amarelo'];
}

// ------------------------------------------------------------ jogos

/** 3 cartas formam um jogo? (trinca ou sequência; no máximo 1 melé). */
export function isMeld(ids) {
  if (ids.length !== 3) return false;
  const jokers = ids.filter(isJoker).length;
  if (jokers > 1) return false;
  const cs = ids.filter((id) => !isJoker(id)).map(code);
  // Trinca: mesmo valor, naipes diferentes.
  const r0 = rankOf(cs[0]);
  if (cs.every((c) => rankOf(c) === r0) && new Set(cs.map(suitOf)).size === cs.length) return true;
  // Sequência: mesmo naipe, valores seguidos (Ás embaixo ou em cima).
  const s0 = suitOf(cs[0]);
  if (!cs.every((c) => suitOf(c) === s0)) return false;
  for (const ace of [1, 14]) {
    const vals = cs.map((c) => (rankOf(c) === 1 ? ace : rankOf(c))).sort((a, b) => a - b);
    if (new Set(vals).size !== vals.length) continue;
    const span = vals[vals.length - 1] - vals[0];
    if (span <= 2) return true; // com melé, ele cobre o buraco ou a ponta
  }
  return false;
}

/** As 9 cartas cabem em 3 jogos? Devolve os 3 jogos ou null. */
export function meldsOf(nine) {
  if (nine.length !== 9) return null;
  const rest = nine.slice();
  const out = [];
  const go = () => {
    if (!rest.length) return true;
    const a = rest.shift();
    for (let i = 0; i < rest.length; i++) {
      for (let j = i + 1; j < rest.length; j++) {
        const trio = [a, rest[i], rest[j]];
        if (!isMeld(trio)) continue;
        const b = rest[i];
        const c = rest[j];
        rest.splice(j, 1); rest.splice(i, 1);
        out.push(trio);
        if (go()) return true;
        out.pop();
        rest.splice(i, 0, b); rest.splice(j, 0, c);
      }
    }
    rest.unshift(a);
    return false;
  };
  return go() ? out.map((m) => m.slice()) : null;
}

/** Bater de naipe: as 9 do mesmo naipe (melé vale qualquer um). */
export function sameSuit(nine) {
  const suits = new Set(nine.filter((id) => !isJoker(id)).map((id) => suitOf(code(id))));
  return nine.length === 9 && suits.size <= 1;
}

/** Mão sem nenhum par (nem valor repetido, nem dupla de sequência). */
export function noPair(hand) {
  if (hand.some(isJoker)) return false;
  const cs = hand.map(code);
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i];
      const b = cs[j];
      if (rankOf(a) === rankOf(b)) return false;
      if (suitOf(a) !== suitOf(b)) continue;
      const d = Math.abs(rankOf(a) - rankOf(b));
      const dAce = Math.min(d, Math.abs((rankOf(a) === 1 ? 14 : rankOf(a)) - (rankOf(b) === 1 ? 14 : rankOf(b))));
      if (dAce <= 2) return false;
    }
  }
  return true;
}

/** Com 10 cartas: existe batida? Devolve { groups, discard, kind } ou null. */
export function findWin(hand10, house = {}, { exclude = null } = {}) {
  for (const d of hand10) {
    if (d === exclude) continue;
    const nine = hand10.filter((x) => x !== d);
    const groups = meldsOf(nine);
    if (groups) return { groups, discard: d, kind: 'jogos' };
    if (house.naipe && sameSuit(nine)) return { groups: [nine.slice(0, 3), nine.slice(3, 6), nine.slice(6)], discard: d, kind: 'naipe' };
  }
  return null;
}

// --------------------------------------------------------------- setup

export function setup(list, opts = {}) {
  const players = assignColors(list.slice(0, meta.maxPlayers), defaultColors())
    .map((p) => ({ id: p.id, name: p.name, color: p.color, hand: [], choque: false, moved: false, picked: [] }));
  const s = {
    opts: { regras: opts.regras === 'tradicional' ? 'tradicional' : 'casa', casa: Array.isArray(opts.casa) ? opts.casa : OPTIONS[1].default },
    house: houseRules(opts),
    players, deck: [], discard: [], turn: 0, phase: 'draw', drewFrom: null, took: null,
    dealer: Math.floor(Math.random() * players.length),
    seq: 0, last: null, result: null, winner: null, log: [],
  };
  const ids = Array.from({ length: s.house.mele ? 108 : 104 }, (_, i) => i);
  s.deck = shuffle(ids);
  s.players.forEach((p) => { p.hand = s.deck.splice(0, HAND); });
  s.turn = (s.dealer + 1) % players.length;
  s.last = { seq: ++s.seq, kind: 'start' };
  log(s, `${s.players[s.turn].name} começa.`);
  return s;
}

export function activePlayers(state) {
  return state.phase === 'over' ? [] : [state.players[state.turn].id];
}

export function view(state, playerId) {
  const v = clone(state);
  const reveal = state.phase === 'over';
  v.deckCount = state.deck.length;
  v.deck = [];
  v.discardCount = state.discard.length;
  v.discard = state.discard.slice(-8);
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

/** Pode bater de cara com a mão sem par? (só antes da primeira jogada). */
export function canNoPair(state, idx) {
  const p = state.players[idx];
  return !!state.house.semPar && !p.moved && state.phase === 'draw' && state.turn === idx && p.hand.length === HAND && noPair(p.hand);
}

// ---------------------------------------------------------------- act

export function act(prev, playerId, action) {
  if (!action || typeof action !== 'object') return null;
  const idx = prev.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return null;
  if (action.type === 'restart') {
    if (prev.phase !== 'over') return null;
    return setup(prev.players.map(({ id, name: n, color }) => ({ id, name: n, color })), prev.opts);
  }
  if (prev.phase === 'over' || idx !== prev.turn) return null;
  const s = clone(prev);
  const me = s.players[idx];
  const n = s.players.length;

  switch (action.type) {
    case 'draw': {
      if (s.phase !== 'draw') return null;
      if (action.from === 'discard') {
        if (!s.discard.length) return null;
        const id = s.discard.pop();
        me.hand.push(id);
        s.drewFrom = 'discard';
        s.took = id;
        me.picked = [...me.picked.slice(-5), id]; // todos viram o que ele pegou
        s.last = { seq: ++s.seq, kind: 'draw', pid: idx, from: 'discard', id };
        log(s, `${me.name} pegou ${name(id)} do descarte.`);
      } else {
        if (!s.deck.length) {
          if (s.discard.length < 2) return null;
          const top = s.discard.pop();
          s.deck = shuffle(s.discard);
          s.discard = [top];
          log(s, 'O descarte foi embaralhado e virou monte.');
        }
        me.hand.push(s.deck.pop());
        s.drewFrom = 'deck';
        s.took = null;
        s.last = { seq: ++s.seq, kind: 'draw', pid: idx, from: 'deck' };
        log(s, `${me.name} comprou do monte.`);
      }
      me.moved = true;
      s.phase = 'discard';
      return s;
    }
    case 'discard': {
      if (s.phase !== 'discard' || !me.hand.includes(action.id) || action.id === s.took) return null;
      me.hand = me.hand.filter((x) => x !== action.id);
      s.discard.push(action.id);
      s.last = { seq: ++s.seq, kind: 'discard', pid: idx, id: action.id };
      log(s, `${me.name} descartou ${name(action.id)}.`);
      s.phase = 'draw';
      s.drewFrom = null;
      s.took = null;
      s.turn = (s.turn + 1) % n;
      return s;
    }
    case 'nopair': {
      // Mão sem par: bate de cara (antes de comprar).
      if (s.phase !== 'draw' || me.moved) return null;
      if (!canNoPair(s, idx)) return falseCall(s, idx);
      return win(s, idx, { kind: 'semPar', groups: [me.hand.slice(0, 3), me.hand.slice(3, 6), me.hand.slice(6)] });
    }
    case 'bater': {
      // groups: os 3 jogos que o jogador mostrou; discard: a 10ª carta.
      if (s.phase !== 'discard') return null;
      const groups = action.groups;
      const d = action.discard;
      const valid = Array.isArray(groups) && groups.length === 3 && groups.every((g) => Array.isArray(g) && g.length === 3);
      const all = valid ? [...groups.flat(), d] : [];
      const same = valid && all.length === 10 && new Set(all).size === 10 && all.every((x) => me.hand.includes(x));
      if (!same) return null; // pedido malformado: ignora
      const nine = groups.flat();
      let kind = null;
      if (groups.every(isMeld)) kind = 'jogos';
      else if (s.house.naipe && sameSuit(nine)) kind = 'naipe';
      if (!kind || d === s.took) return falseCall(s, idx);
      if (me.choque && s.drewFrom === 'discard') {
        // Deu choque antes: só bate com carta do monte.
        log(s, `${me.name} deu choque antes: só bate com carta do monte.`);
        s.last = { seq: ++s.seq, kind: 'blocked', pid: idx };
        return s;
      }
      me.hand = me.hand.filter((x) => x !== d);
      s.discard.push(d);
      return win(s, idx, { kind, groups });
    }
    default:
      return null;
  }
}

/** Anunciou que bateu sem ter batido. */
function falseCall(s, idx) {
  const me = s.players[idx];
  if (s.house.choque) {
    me.choque = true;
    log(s, `${me.name} deu CHOQUE! Agora só bate com carta do monte.`);
    s.last = { seq: ++s.seq, kind: 'choque', pid: idx };
  } else {
    log(s, `${me.name} não bateu: os jogos não fecham.`);
    s.last = { seq: ++s.seq, kind: 'nope', pid: idx };
  }
  return s;
}

function win(s, idx, { kind, groups }) {
  s.phase = 'over';
  s.winner = idx;
  s.result = { kind, groups };
  s.last = { seq: ++s.seq, kind: 'win', pid: idx };
  const how = { jogos: 'com 3 jogos', naipe: 'de naipe', semPar: 'com a mão sem par' }[kind];
  log(s, `${s.players[idx].name} bateu ${how}!`);
  return s;
}
