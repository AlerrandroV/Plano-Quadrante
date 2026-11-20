// ROBÔ DO PIFE
// Usa só a "view" do robô: a mão dele e o descarte (cartas à vista).
//
//   Fácil   -> guarda os jogos prontos, mas descarta meio ao acaso e quase
//              nunca pega do descarte.
//   Médio   -> conta jogos prontos e "pares" (duplas que viram jogo com
//              mais uma carta) e descarta o que menos ajuda.
//   Difícil -> isso e mais: pesa cada par pelas cartas que ainda podem sair
//              (as que estão no descarte já eram) e prefere pares com mais
//              chances.
// Todos guardam os melés (curingas) e, armados, batem com o descarte fora
// da vez: o Fácil às vezes demora, o Difícil nunca perde a chance.
import * as P from '../games/pife/rules.js';
import { rankOf, suitOf } from '../ui/cards52.js';

const CLAIM = { facil: 0.35, medio: 0.75, dificil: 1 };
let W = P.isJoker; // "é curinga?" da partida em que o robô está pensando

export function decide(state, botId, level = 'medio') {
  if (state.phase === 'over') return null;
  const me = state.players.findIndex((p) => p.id === botId);
  if (me < 0) return null;
  W = P.wildFn(state);
  // Fora da vez (ou antes de comprar): bate com a carta do descarte?
  const claim = P.claimable(state, me);
  if (claim != null && Math.random() < CLAIM[level]) return { type: 'claim', card: claim };
  if (state.turn !== me) return null;
  const p = state.players[me];
  const hand = p.hand;
  const dead = deadCards(state, hand);

  if (state.phase === 'draw') {
    if (P.canNoPair(state, me)) return { type: 'nopair' };
    const top = state.discard[state.discard.length - 1];
    if (top == null) return { type: 'draw', from: 'deck' };
    // Melé no descarte: só serve para bater (já tratado acima).
    if (W(top)) return { type: 'draw', from: 'deck' };
    if (level === 'facil') return { type: 'draw', from: Math.random() < 0.15 && helps(hand, top, dead, level) ? 'discard' : 'deck' };
    return { type: 'draw', from: helps(hand, top, dead, level) ? 'discard' : 'deck' };
  }

  // Descarte (ou batida).
  const blocked = p.choque && state.drewFrom === 'discard';
  const w = !blocked && P.findWin(hand, state.house, { exclude: state.took, W });
  if (w) return { type: 'bater', groups: w.groups, discard: w.discard };
  const options = hand.filter((id) => id !== state.took && !W(id)); // melé não se joga fora
  const pool = options.length ? options : hand.filter((id) => id !== state.took);
  if (level === 'facil' && Math.random() < 0.5) {
    // Joga fora qualquer carta que não esteja num jogo pronto.
    const keep = new Set(bestMelds(hand).flat());
    const loose = pool.filter((id) => !keep.has(id));
    const list = loose.length ? loose : pool;
    return { type: 'discard', id: list[Math.floor(Math.random() * list.length)] };
  }
  // Difícil: não alimenta o próximo (cartas que combinam com o que ele já
  // pegou do descarte).
  const nxt = state.players[(me + 1) % state.players.length];
  const feeds = (id) => (nxt.picked || []).some((t) => !W(t) && pairWorth(P.code(t), P.code(id), dead, 'medio') > 0);
  let best = null;
  for (const id of pool) {
    let v = value(hand.filter((x) => x !== id), dead, level) + Math.random() * 0.3;
    if (level === 'dificil' && feeds(id)) v -= 4;
    if (!best || v > best.v) best = { id, v };
  }
  return { type: 'discard', id: best.id };
}

/** A carta do descarte melhora a mão (depois do melhor descarte)? */
function helps(hand, top, dead, level) {
  const now = Math.max(...hand.map((d) => value(hand.filter((x) => x !== d), dead, level)));
  const withTop = [...hand, top];
  const after = Math.max(...hand.map((d) => value(withTop.filter((x) => x !== d), dead, level)));
  return after > now + (level === 'dificil' ? 2 : 5);
}

/** Cartas que já não podem vir (no descarte e na mão). */
function deadCards(state, hand) {
  const count = new Map();
  for (const id of [...state.discard, ...hand]) {
    const c = P.code(id);
    count.set(c, (count.get(c) || 0) + 1);
  }
  return count;
}

/** Quantas cópias da carta (code) ainda podem sair (dois baralhos). */
function outs(code, dead) {
  return Math.max(0, 2 - (dead.get(code) || 0));
}

/** Melhor conjunto de jogos prontos (disjuntos) da mão. */
export function bestMelds(hand) {
  const trios = [];
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const t = [hand[i], hand[j], hand[k]];
        if (P.isMeld(t, W)) trios.push(t);
      }
    }
  }
  let best = [];
  const pick = (start, used, chosen) => {
    if (chosen.length > best.length) best = chosen.slice();
    if (best.length === 3) return;
    for (let i = start; i < trios.length; i++) {
      if (trios[i].some((x) => used.has(x))) continue;
      trios[i].forEach((x) => used.add(x));
      chosen.push(trios[i]);
      pick(i + 1, used, chosen);
      chosen.pop();
      trios[i].forEach((x) => used.delete(x));
    }
  };
  pick(0, new Set(), []);
  return best;
}

/** Valor de 9 cartas: jogos prontos, pares (com chances) e melés. */
function value(cards, dead, level) {
  const melds = bestMelds(cards);
  const used = new Set(melds.flat());
  const rest = cards.filter((x) => !used.has(x));
  let v = melds.length * 40;
  const jokers = rest.filter(W).length;
  v += jokers * 14;
  const plain = rest.filter((x) => !W(x));
  const usedPair = new Set();
  // Pares: melhores primeiro (cada carta entra em um par só).
  const pairs = [];
  for (let i = 0; i < plain.length; i++) {
    for (let j = i + 1; j < plain.length; j++) {
      const w = pairWorth(P.code(plain[i]), P.code(plain[j]), dead, level);
      if (w > 0) pairs.push({ a: plain[i], b: plain[j], w });
    }
  }
  pairs.sort((x, y) => y.w - x.w);
  for (const pr of pairs) {
    if (usedPair.has(pr.a) || usedPair.has(pr.b)) continue;
    usedPair.add(pr.a); usedPair.add(pr.b);
    v += pr.w;
  }
  // Cartas soltas que ainda conversam com alguma outra valem um pouco.
  for (const x of plain) if (!usedPair.has(x) && plain.some((y) => y !== x && pairWorth(P.code(x), P.code(y), dead, 'medio') > 0)) v += 1;
  return v;
}

/** Quanto vale uma dupla (que vira jogo com mais uma carta). */
function pairWorth(a, b, dead, level) {
  const ra = rankOf(a);
  const rb = rankOf(b);
  const sa = suitOf(a);
  const sb = suitOf(b);
  if (a === b) return 0; // duas iguais (mesmo naipe): não formam trinca
  let need = []; // cartas que completam
  if (ra === rb && sa !== sb) {
    for (let s = 0; s < 4; s++) if (s !== sa && s !== sb) need.push(s * 13 + ra - 1);
  } else if (sa === sb) {
    for (const ace of [1, 14]) {
      const x = ra === 1 ? ace : ra;
      const y = rb === 1 ? ace : rb;
      const lo = Math.min(x, y);
      const hi = Math.max(x, y);
      const cand = hi - lo === 1 ? [lo - 1, hi + 1] : hi - lo === 2 ? [lo + 1] : [];
      for (const r of cand) if (r >= 1 && r <= 14) need.push(sa * 13 + (r === 14 ? 1 : r) - 1);
    }
    need = [...new Set(need)];
  }
  if (!need.length) return 0;
  if (level !== 'dificil') return 10 + need.length;
  const live = need.reduce((t, c) => t + outs(c, dead), 0);
  return live ? 9 + need.length + live * 0.8 : 1; // sem nenhuma carta viva, quase não vale
}
