// ROBÔ DO POKER
// Usa só a "view" do robô: as 2 cartas dele, a mesa e as fichas de cada um.
// A força da mão vem de simulações (Monte Carlo): sorteia as cartas que
// faltam muitas vezes e conta quantas vezes a mão dele venceria.
//
//   Fácil   -> poucas simulações e muito "achismo": paga demais, desiste à
//              toa, raramente aumenta.
//   Médio   -> compara a chance de vencer com o preço de pagar (pot odds) e
//              aposta quando está forte, sempre do mesmo jeito.
//   Difícil -> mais simulações; tamanho de aposta conforme a força, blefe e
//              semi-blefe com poucos adversários, slow-play às vezes e all-in
//              quando o pote já vale as fichas.
import * as P from '../games/poker/rules.js';

const ITER = { facil: 60, medio: 160, dificil: 420 };

export function decide(state, botId, level = 'medio') {
  const me = state.players.findIndex((p) => p.id === botId);
  if (me < 0) return null;
  if (state.phase === 'showdown') return state.players[me].out ? null : { type: 'next' };
  if (state.phase !== 'bet' || state.turn !== me) return null;
  const p = state.players[me];
  const lim = P.betLimits(state);
  const potNow = P.pot(state);
  const opps = state.players.filter((q, i) => i !== me && !q.out && !q.folded).length;
  let eq = equity(p.hole, state.board, opps, ITER[level]);
  const odds = lim.toCall / (potNow + lim.toCall || 1);
  const big = P.BLINDS[Math.min(state.level, P.BLINDS.length - 1)][1];
  const raiseTo = (target) => {
    const to = Math.max(lim.minTo, Math.min(lim.maxTo, Math.round(target / 5) * 5));
    if (!lim.canRaise || to <= state.curBet) return lim.canCheck ? { type: 'check' } : { type: 'call' };
    return to >= lim.maxTo ? { type: 'allin' } : { type: 'raise', to };
  };
  const passive = () => (lim.canCheck ? { type: 'check' } : { type: 'call' });
  const fold = () => (lim.canCheck ? { type: 'check' } : { type: 'fold' });

  if (level === 'facil') {
    eq += (Math.random() - 0.5) * 0.3;
    if (lim.canCheck) return eq > 0.68 && Math.random() < 0.5 ? raiseTo(lim.minTo) : { type: 'check' };
    if (eq < 0.22 && Math.random() < 0.6) return fold();
    if (lim.toCall > p.chips * 0.5 && eq < 0.5) return fold();
    if (eq > 0.78 && Math.random() < 0.3) return raiseTo(lim.minTo);
    return { type: 'call' };
  }

  if (level === 'medio') {
    if (lim.canCheck) {
      if (eq > 0.8) return raiseTo(state.curBet + potNow);
      if (eq > 0.6) return raiseTo(state.curBet + potNow * 0.5);
      return { type: 'check' };
    }
    if (eq > odds + 0.08) return eq > 0.72 ? raiseTo(state.curBet + potNow * 0.75) : { type: 'call' };
    return fold();
  }

  // Difícil.
  const preflop = state.street === 'preflop';
  const late = isLate(state, me);
  const spr = p.chips / Math.max(potNow, 1); // fichas em relação ao pote
  const drawy = !preflop && state.street !== 'river' && eq > 0.32 && eq < 0.5; // projeto (semi-blefe)
  // Aposta grande do outro costuma ser mão forte: desconta da chance.
  if (!lim.canCheck) eq -= Math.min(0.16, (lim.toCall / Math.max(potNow - lim.toCall, big)) * 0.12);
  if (lim.canCheck) {
    if (eq > 0.92 && !preflop && Math.random() < 0.2) return { type: 'check' }; // slow-play
    if (eq > 0.8 && spr < 1.2) return { type: 'allin' };
    if (eq > 0.58) return raiseTo(state.curBet + potNow * Math.min(1, 0.5 + (eq - 0.58) * 1.5));
    if (drawy && opps === 1 && Math.random() < 0.2) return raiseTo(state.curBet + Math.max(potNow * 0.5, big * 2));
    if (late && opps === 1 && eq > 0.45 && Math.random() < 0.12) return raiseTo(state.curBet + Math.max(potNow * 0.5, big * 2));
    return { type: 'check' };
  }
  const implied = drawy ? 1.12 : 1;
  if (eq * implied <= odds + 0.04) return fold();
  if (eq > 0.8 && (spr < 1.5 || state.street === 'river')) return { type: 'allin' };
  // Guerra de aumentos só com mão muito forte (quem aumenta de volta costuma ter).
  if (eq > 0.76) return raiseTo(state.curBet + potNow * Math.min(1.1, 0.6 + (eq - 0.76)));
  return passive();
}

/** Botão ou perto dele: fala por último. */
function isLate(state, me) {
  const n = state.players.length;
  const after = (me - state.dealer + n) % n;
  return after === 0 || after >= n - 1;
}

/** Chance de vencer (empate conta parcial) contra `opps` mãos aleatórias. */
export function equity(hole, board, opps, iter) {
  if (opps <= 0) return 1;
  const known = new Set([...hole, ...board]);
  const deck = [];
  for (let c = 0; c < 52; c++) if (!known.has(c)) deck.push(c);
  let score = 0;
  for (let t = 0; t < iter; t++) {
    // Embaralha só o que precisa (sorteio parcial).
    const need = opps * 2 + (5 - board.length);
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const full = [...board, ...deck.slice(opps * 2, need)];
    const mine = P.bestHand([...hole, ...full]).score;
    let best = 0;
    let ties = 0;
    let lost = false;
    for (let o = 0; o < opps; o++) {
      const sc = P.bestHand([deck[o * 2], deck[o * 2 + 1], ...full]).score;
      if (sc > mine) { lost = true; break; }
      if (sc === mine) ties++;
      best = Math.max(best, sc);
    }
    if (!lost) score += 1 / (ties + 1);
  }
  return score / iter;
}
