// ROBÔ DO PLANO QUADRANTE
//
// O jogo é novo: não há teoria. O robô decide olhando cada jogada possível,
// aplicando-a e avaliando o resultado. O que muda entre os níveis é o que
// ele PERCEBE, seguindo onde está a dificuldade para uma pessoa:
//
//  - Colocar uma peça nova ou mover uma que já está no tabuleiro?
//  - Peças evoluídas (nível) andam casas extras depois de mover; isso
//    passa despercebido com facilidade, para o ataque e para a defesa.
//
//   Fácil   -> jogador distraído: em 1/4 das jogadas nem pensa no
//              perigo de ser capturado; julga com "ruído" e esquece o
//              bônus na metade das vezes.
//   Médio   -> avalia cada jogada pelo PERIGO direto (dados e colocação
//              dos adversários), mas não percebe a ameaça dos bônus de
//              nível dos outros; usa o próprio bônus só para capturar.
//   Difícil -> perigo completo: as 64 combinações de dados de cada
//              adversário, incluindo os movimentos extras das peças
//              evoluídas. Usa o bônus para se posicionar e escolhe o
//              melhor alvo para cada carta.
import * as G from '../games/plano-quadrante/rules.js';

export const LEVELS = {
  facil: { danger: true, bonusSight: false, noise: 10, forgetBonus: 0.5, distracted: 0.25 },
  medio: { danger: true, bonusSight: false, noise: 6, forgetBonus: 0 },
  dificil: { danger: true, bonusSight: true, noise: 0, forgetBonus: 0 },
};

const DICE = [-4, -3, -2, -1, 1, 2, 3, 4];

export function decide(state, botId, level = 'medio') {
  if (state.phase === 'over') return null;
  const me = G.playerIndexById(state, botId);
  if (me < 0 || state.current !== me) return null;
  const cfg = LEVELS[level] || LEVELS.medio;

  switch (state.phase) {
    case 'roll':
      return { type: 'roll' };
    case 'card':
      return decideCard(state, me, cfg, level);
    case 'card-target':
      return decideCardTarget(state, me, cfg, level);
    case 'act': {
      const legal = G.legalActions(state);
      if (!legal.length) return { type: 'pass' };
      return pickBest(state, me, cfg, legal.map(stripCapture), level);
    }
    case 'bonus':
      return decideBonus(state, me, cfg, level);
    default:
      return null;
  }
}

function stripCapture(a) {
  const { capture, ...rest } = a; // eslint-disable-line no-unused-vars
  return rest;
}

// ---------------------------------------------------- escolha de jogada
function pickBest(state, me, cfg, actions, level) {
  // Fácil: "distraído" — em 1/4 das decisões nem pensa no perigo; e
  // julga com bastante ruído. Médio e difícil: avaliação com perigo.
  if (cfg.distracted && Math.random() < cfg.distracted) cfg = { ...cfg, danger: false };
  let best = null;
  for (const a of actions) {
    const after = G.act(state, state.players[me].id, a);
    if (!after) continue;
    const final = after.phase === 'bonus' ? bestBonusState(after, me, cfg) : after;
    const score = evaluate(final, me, cfg) + noise(cfg);
    if (!best || score > best.score) best = { a, score };
  }
  return best ? best.a : actions[0];
}

function decideBonus(state, me, cfg, level) {
  const targets = G.bonusTargets(state);
  const skip = { type: 'bonus', skip: true };
  if (!targets.length) return skip;
  const captures = targets.filter((t) => t.capture);
  if (level === 'facil') {
    if (Math.random() < cfg.forgetBonus) return skip; // "esqueceu" o bônus
    const t = captures[0] || rand(targets);
    return { type: 'bonus', x: t.x, y: t.y };
  }
  if (level === 'medio') {
    // Usa o bônus só quando vê uma captura óbvia.
    return captures.length ? { type: 'bonus', x: captures[0].x, y: captures[0].y } : skip;
  }
  // Difícil: compara pular com cada casa possível.
  let best = { a: skip, score: evaluate(G.act(state, state.players[me].id, skip), me, cfg) };
  for (const t of targets) {
    const a = { type: 'bonus', x: t.x, y: t.y };
    const s = G.act(state, state.players[me].id, a);
    if (!s) continue;
    const score = evaluate(s, me, cfg);
    if (score > best.score) best = { a, score };
  }
  return best.a;
}

/** Estado depois do melhor uso do bônus (para avaliar o movimento). */
function bestBonusState(state, me, cfg) {
  const id = state.players[me].id;
  if (!cfg.bonusSight) {
    // Sem enxergar o bônus: só pega capturas óbvias, senão pula.
    const cap = G.bonusTargets(state).find((t) => t.capture);
    return G.act(state, id, cap ? { type: 'bonus', x: cap.x, y: cap.y } : { type: 'bonus', skip: true });
  }
  let best = G.act(state, id, { type: 'bonus', skip: true });
  let bestScore = evaluate(best, me, cfg);
  for (const t of G.bonusTargets(state)) {
    const s = G.act(state, id, { type: 'bonus', x: t.x, y: t.y });
    if (!s) continue;
    const sc = evaluate(s, me, cfg);
    if (sc > bestScore) { best = s; bestScore = sc; }
  }
  return best;
}

// --------------------------------------------------------------- cartas
function decideCard(state, me, cfg, level) {
  const usable = G.cardUsable(state);
  if (!usable) return { type: 'card', use: false };
  const card = state.card;
  if (card === 'reverso') {
    // Inverte se o próximo na ordem atual é mais perigoso que o do outro lado.
    const n = state.order.length;
    const next = (d) => state.order[(state.orderPos + d + n) % n];
    if (n <= 2) return { type: 'card', use: false };
    const dNow = threatFrom(state, next(state.dir), me, cfg);
    const dRev = threatFrom(state, next(-state.dir), me, cfg);
    return { type: 'card', use: dNow > dRev + 0.05 };
  }
  return { type: 'card', use: true };
}

function decideCardTarget(state, me, cfg, level) {
  const targets = G.cardTargets(state);
  if (!targets.length) return { type: 'card-target', cancel: true };
  const id = state.players[me].id;
  let best = null;
  for (const t of targets) {
    const s = G.act(state, id, { type: 'card-target', target: t });
    if (!s) continue;
    let score = evaluate(s, me, cfg);
    if (state.card === 'bloqueio') {
      // Bloqueia quem está mais perto de vencer.
      score += state.players[t].captives.length * 10 + threatFrom(state, t, me, cfg) * 20;
    }
    if (!best || score > best.score) best = { t, score };
  }
  return { type: 'card-target', target: best ? best.t : targets[0] };
}

// ------------------------------------------------------------ avaliação
// Pontos para `me`: cativeiro (meta da vitória), peças vivas, níveis, e
// menos o PERIGO esperado de perder peças na próxima rodada dos outros.
export function evaluate(state, me, cfg) {
  if (state.phase === 'over') return state.winner === me ? 1e6 : -1e6;
  const target = G.captiveTarget(state);
  let score = 0;
  state.players.forEach((p, i) => {
    if (p.eliminated) return;
    const pieces = state.pieces.filter((q) => q.owner === i);
    let v = p.captives.length * 100 * (1 + p.captives.length / target);
    v += p.reserve * 22;
    for (const q of pieces) v += 30 + q.level * 14;
    if (i === me) score += v;
    else score -= v / Math.max(1, state.players.length - 1) * 1.1;
  });
  if (cfg.danger) {
    // Perigo: chance de cada peça minha ser capturada, ponderada pelo valor.
    const danger = dangerMap(state, me, cfg);
    for (const q of state.pieces) {
      if (q.owner !== me) continue;
      const p = danger.get(`${q.x},${q.y}`) || 0;
      score -= p * (130 + q.level * 25);
    }
  }
  // Se acabou de capturar, joga de novo: vale um pouco (mais chances).
  if (state.current === me && state.phase === 'roll') score += 15;
  return score;
}

/**
 * Probabilidade de cada casa ser capturável na próxima vez de algum
 * adversário. Enumera as 64 combinações de dados (dado quente x frio).
 * Com `bonusSight`, considera também os movimentos extras de nível.
 */
function dangerMap(state, me, cfg) {
  const out = new Map();
  state.players.forEach((p, o) => {
    if (o === me || p.eliminated) return;
    const counts = reachCounts(state, o, me, cfg.bonusSight);
    for (const [k, c] of counts) {
      const prob = c / 64;
      out.set(k, 1 - (1 - (out.get(k) || 0)) * (1 - prob));
    }
  });
  return out;
}

function threatFrom(state, o, me, cfg) {
  let sum = 0;
  for (const [, c] of reachCounts(state, o, me, cfg.bonusSight)) sum += c / 64;
  return sum;
}

/** Para o jogador `o`: em quantas das 64 rolagens cada peça de `me` fica ao alcance. */
function reachCounts(state, o, me, bonusSight) {
  const mine = new Map();
  for (const q of state.pieces) if (q.owner === me) mine.set(`${q.x},${q.y}`, q);
  const counts = new Map();
  if (!mine.size) return counts;
  const own = new Set(state.pieces.filter((q) => q.owner === o).map((q) => `${q.x},${q.y}`));
  const theirs = state.pieces.filter((q) => q.owner === o);
  const canPlace = state.players[o].reserve > 0;
  for (const dx of DICE) {
    for (const dy of DICE) {
      const hit = new Set();
      const consider = (x, y) => { const k = `${x},${y}`; if (mine.has(k)) hit.add(k); };
      if (canPlace) { consider(dx, 0); consider(0, dy); }
      for (const q of theirs) {
        for (const [nx, ny] of [[G.wrap(q.x + dx), q.y], [q.x, G.wrap(q.y + dy)]]) {
          const k = `${nx},${ny}`;
          if (own.has(k)) continue;
          consider(nx, ny);
          if (bonusSight && q.level > 0) {
            for (const [ddx, ddy] of G.DIRS8) {
              let x = nx; let y = ny;
              for (let s = 1; s <= q.level; s++) {
                x = G.wrap(x + ddx); y = G.wrap(y + ddy);
                if (own.has(`${x},${y}`)) continue;
                consider(x, y);
              }
            }
          }
        }
      }
      for (const k of hit) counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return counts;
}

// ---------------------------------------------------------------- util
function rand(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function noise(cfg) {
  return (Math.random() - 0.5) * 2 * cfg.noise;
}
