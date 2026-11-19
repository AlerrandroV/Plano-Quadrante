// ROBÔ DO DOMINÓ
// Usa só a "view" do próprio robô: a mão dele, a mesa, quantas peças os
// outros têm e o que todos viram (quem comprou/passou em quais números).
//
//   Fácil   -> joga qualquer peça que encaixe.
//   Médio   -> no modo pontos, faz os pontos que estiverem à vista; na
//              batida, se livra das peças mais pesadas e das carroças.
//   Difícil -> isso e mais: lembra quais números cada adversário NÃO tem
//              (porque comprou ou passou) e tenta deixar as pontas nesses
//              números para trancá-lo; mantém variedade de números na
//              mão; e evita abrir pontos fáceis para o próximo jogador.
import * as R from '../games/domino/rules.js';

export function decide(state, botId, level = 'medio') {
  if (state.phase === 'round') return { type: 'next-round' };
  if (state.phase !== 'play') return null;
  const me = state.players.findIndex((p) => p.id === botId);
  if (me < 0 || state.turn !== me) return null;

  const hand = state.players[me].hand;
  const plays = R.playsFor(state, hand);
  if (!plays.length) return (state.stockCount ?? state.stock.length) > 0 ? { type: 'draw' } : { type: 'pass' };
  if (plays.length === 1 || level === 'facil') {
    const p = plays[Math.floor(Math.random() * plays.length)];
    return { type: 'play', id: p.id, end: p.end };
  }

  let best = null;
  for (const p of plays) {
    const score = scorePlay(state, me, hand, p, level) + Math.random() * 0.5;
    if (!best || score > best.score) best = { p, score };
  }
  return { type: 'play', id: best.p.id, end: best.p.end };
}

function lineAfter(state, p) {
  const line = state.line.slice();
  const { a, b } = R.TILES[p.id];
  if (!line.length) line.push({ id: p.id, l: a, r: b });
  else if (p.end === 'L') { const L = line[0].l; line.unshift({ id: p.id, l: a === L ? b : a, r: L }); }
  else { const Rr = line[line.length - 1].r; line.push({ id: p.id, l: Rr, r: a === Rr ? b : a }); }
  return line;
}

function scorePlay(state, me, hand, p, level) {
  const line = lineAfter(state, p);
  const sum = R.endsSum(line);
  const points = state.mode === 'pontos' && sum % 5 === 0 ? sum : 0;
  const rest = hand.filter((x) => x !== p.id);
  let score = 0;

  // Bater é sempre o melhor.
  if (!rest.length) return 1e6;

  score += points * (state.mode === 'pontos' ? 4 : 0);
  score += R.pips(p.id) * (state.mode === 'batida' ? 0.3 : 0.6); // se livra do peso
  if (R.isDouble(p.id)) score += 6; // carroças encaixam em um número só: solta cedo

  // Variedade: quantos números diferentes sobram na mão.
  const suits = new Set(rest.flatMap((x) => [R.TILES[x].a, R.TILES[x].b]));
  score += suits.size * 2;

  if (level !== 'dificil') return score;

  // Pontas que EU consigo continuar.
  const L = line[0].l;
  const Rr = line[line.length - 1].r;
  const canFollow = rest.filter((x) => [R.TILES[x].a, R.TILES[x].b].some((v) => v === L || v === Rr)).length;
  score += Math.min(canFollow, 3) * 2.5;

  // Trancar: pontas em números que o PRÓXIMO jogador não tem.
  const n = state.players.length;
  const next = state.players[(me + 1) % n];
  for (const v of [L, Rr]) if (next.lacks?.includes(v)) score += 6;

  // Quantas peças que eu não vejo (na mão dos outros ou no monte) servem
  // nas pontas que vão ficar: quanto menos, mais difícil para o próximo.
  const seen = new Set([...hand, ...state.line.map((t) => t.id)]);
  let fits = 0;
  for (let id = 0; id < R.TILES.length; id++) {
    if (seen.has(id) || id === p.id) continue;
    const { a, b } = R.TILES[id];
    if ([L, Rr].some((v) => (a === v || b === v) && !next.lacks?.includes(v))) fits++;
  }
  score -= fits * 1.2;

  // Não abrir pontos fáceis para o próximo: quantas peças desconhecidas
  // fariam múltiplo de 5 encaixando numa das pontas.
  if (state.mode === 'pontos') {
    const known = new Set([...hand, ...state.line.map((t) => t.id), p.id]);
    let risk = 0;
    for (let id = 0; id < R.TILES.length; id++) {
      if (known.has(id)) continue;
      for (const end of ['L', 'R']) {
        const tip = end === 'L' ? L : Rr;
        const { a, b } = R.TILES[id];
        if (a !== tip && b !== tip) continue;
        if (next.lacks?.includes(tip)) continue;
        const s2 = R.endsSum(lineAfter({ line }, { id, end }));
        if (s2 % 5 === 0) risk += s2;
      }
    }
    score -= risk * 0.15;
  }
  return score;
}
