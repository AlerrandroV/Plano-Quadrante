// ROBÔ DA ÚLTIMA CARTA
// Usa só a "view" do próprio robô: a mão dele, a carta da mesa e quantas
// cartas cada um tem.
//
//   Fácil   -> joga qualquer carta que sirva; às vezes esquece de gritar
//              "Última!" e raramente pega quem esqueceu.
//   Médio   -> guarda Coringas para o fim, solta cartas que valem mais
//              pontos, escolhe a cor de que tem mais; quase sempre grita.
//   Difícil -> isso e mais: ataca (Pula/+2/+4) quem está perto de bater,
//              desafia +4 quando o histórico sugere blefe, troca de mão
//              com quem tem menos cartas, e nunca esquece de gritar.
import * as R from '../games/ultima-carta/rules.js';

const FORGET = { facil: 0.35, medio: 0.08, dificil: 0 };
const CATCH = { facil: 0.25, medio: 0.6, dificil: 0.95 };
const JUMP = { facil: 0.3, medio: 0.7, dificil: 1 };

export function decide(state, botId, level = 'medio') {
  if (state.phase === 'round') return { type: 'next-round' };
  if (state.phase === 'over') return null;
  const me = state.players.findIndex((p) => p.id === botId);
  if (me < 0) return null;
  const hand = state.players[me].hand;
  const myTurn = state.turn === me;

  // Pegar quem ficou com uma carta sem gritar.
  if (state.vulnerable != null && state.vulnerable !== me && Math.random() < CATCH[level]) {
    return { type: 'catch', target: state.vulnerable };
  }
  // Gritar "Última!" antes de ficar com 1 carta (ou logo depois).
  if (!state.players[me].called && hand.length <= 2 && (myTurn || state.vulnerable === me)
    && (hand.length === 1 || (myTurn && state.phase === 'play' && R.playable(state, hand).length))) {
    if (state.vulnerable === me || Math.random() >= FORGET[level]) return { type: 'call' };
  }
  // Corte: carta idêntica fora da vez.
  if (!myTurn) {
    const j = hand.find((id) => R.canJump(state, id));
    if (j != null && Math.random() < JUMP[level]) return { type: 'jump', id: j };
    return null;
  }

  if (state.phase === 'color') {
    let color = bestColor(hand, level);
    if (level === 'dificil') {
      const nx = state.players[next(state, me)].lacks || [];
      const mine = R.SUITS.filter((c) => nx.includes(c) && hand.some((x) => R.CARDS[x].c === c));
      if (mine.length) color = mine.includes(color) ? color : mine[0];
    }
    return { type: 'color', color };
  }
  if (state.phase === 'swap') return { type: 'swap', target: swapTarget(state, me) };
  if (state.phase === 'challenge') {
    const stack = R.playable(state, hand);
    if (stack.length) return { type: 'play', id: stack[0] };
    if (!state.house.mais4Livre && shouldChallenge(state, me, level)) return { type: 'challenge' };
    return { type: 'accept' };
  }
  if (state.phase !== 'play') return null;

  const plays = R.playable(state, hand);
  if (!plays.length) return state.drawn != null ? { type: 'pass' } : { type: 'draw' };
  if (level === 'facil') return { type: 'play', id: plays[Math.floor(Math.random() * plays.length)] };

  let best = null;
  for (const id of plays) {
    const score = scoreCard(state, me, hand, id, level) + Math.random() * 0.8;
    if (!best || score > best.score) best = { id, score };
  }
  return { type: 'play', id: best.id };
}

/** Cor (naipe) de que tem mais cartas. */
function bestColor(hand, level) {
  if (level === 'facil') return R.SUITS[Math.floor(Math.random() * 4)];
  const count = Object.fromEntries(R.SUITS.map((c) => [c, 0]));
  for (const id of hand) if (R.CARDS[id].c) count[R.CARDS[id].c] += 1 + R.points(id) / 40;
  return R.SUITS.reduce((a, b) => (count[b] > count[a] ? b : a));
}

function swapTarget(state, me) {
  let best = -1;
  state.players.forEach((p, i) => {
    if (i === me) return;
    const n = p.handCount ?? p.hand.length;
    if (best < 0 || n < (state.players[best].handCount ?? state.players[best].hand.length)) best = i;
  });
  return best;
}

function shouldChallenge(state, me, level) {
  if (level === 'facil') return Math.random() < 0.1;
  // Quem jogou o +4 tinha muitas cartas? Mais chance de ter a cor.
  const by = state.wild?.by;
  const n = by != null ? (state.players[by].handCount ?? state.players[by].hand.length) : 0;
  const chance = Math.min(0.75, n * 0.07);
  return level === 'dificil' ? chance > 0.4 && Math.random() < chance : Math.random() < chance * 0.5;
}

function next(state, me, k = 1) {
  const n = state.players.length;
  return (((me + k * state.dir) % n) + n) % n;
}

function scoreCard(state, me, hand, id, level) {
  const card = R.CARDS[id];
  const rest = hand.filter((x) => x !== id);
  if (!rest.length) return 1e6; // bater
  let score = R.points(id) * 0.15;
  // Coringas: guardar, a não ser que seja a única saída.
  if (R.isWild(id)) score -= card.k === 'mais4' ? 9 : 7;
  // Manter cartas da cor que vai ficar na mesa.
  const color = card.c || bestColor(rest, level);
  score += rest.filter((x) => R.CARDS[x].c === color).length * 1.2;
  // Ao mudar a cor: deixar a mesa numa cor que eu tenho.
  if (card.c && card.c !== state.color) score += rest.some((x) => R.CARDS[x].c === card.c) ? 1 : -1;

  if (level !== 'dificil') return score;
  const nx = state.players[next(state, me)];
  const two = state.players.length === 2;
  // Com 2 jogadores, Pula/Volta/+2 dão outra vez: bom se tenho como seguir.
  if (two && ['pula', 'volta', 'mais2'].includes(card.k)) {
    const follow = rest.some((x) => R.isWild(x) || R.CARDS[x].c === card.c || (R.CARDS[x].k === card.k));
    score += follow ? 4 : 1;
  }
  // Deixar a mesa numa cor que o próximo NÃO tem (ele comprou nela).
  const after = card.c || bestColor(rest, level);
  if (nx.lacks?.includes(after)) score += 4;
  // Guardar Coringa e +4 para quando o próximo estiver perto de bater.
  if (R.isWild(id) && (nx.handCount ?? nx.hand.length) > 3 && rest.length > 2) score -= 3;
  const nxCount = nx.handCount ?? nx.hand.length;
  const danger = Math.max(0, 5 - nxCount); // próximo perto de bater
  if (['pula', 'mais2', 'mais4'].includes(card.k)) score += danger * 3 + (card.k === 'mais2' ? 1 : 0);
  if (card.k === 'volta' && state.players.length > 2) {
    const prev = state.players[next(state, me, -1)];
    score += danger * 2 - Math.max(0, 5 - (prev.handCount ?? prev.hand.length)) * 2;
  }
  if (card.k === 'mais4') score += danger * 2;
  // 7 com troca: bom quando alguém tem bem menos cartas.
  if (state.house.seteZero && card.k === 'n' && card.v === 7) {
    const min = Math.min(...state.players.filter((_, i) => i !== me).map((p) => p.handCount ?? p.hand.length));
    score += (rest.length - min) * 1.5;
  }
  return score;
}
