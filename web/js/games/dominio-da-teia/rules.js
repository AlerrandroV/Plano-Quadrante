// ===================================================================
//  DOMÍNIO DA TEIA — regras (lógica pura, sem tela)
//  (antes chamado "Plano Quadrante", como o app)
//
//  As peças são aranhas numa teia 9x9. Baseado no protótipo original
//  (script.js), no manual e nas Regras Oficiais (PDF). Onde os três
//  discordam, a escolha está marcada com "DECISÃO" e resumida no README.
//
//  A teia NÃO é infinita: um movimento que sairia dela não pode ser feito,
//  e o bônus de nível anda em linha reta só até a borda.
//
//  Coordenadas: x e y de -4 a 4 (81 interseções), centro = (0, 0).
//  Dado quente -> eixo x: vermelho = esquerda (-), laranja = direita (+)
//  Dado frio   -> eixo y: verde = baixo (-),     azul = cima (+)
// ===================================================================

import { assignColors } from '../../ui/colors.js';

export const meta = { id: 'dominio-da-teia', name: 'Domínio da Teia', minPlayers: 2, maxPlayers: 4 };

export const MIN = -4;
export const MAX = 4;
export const PIECES_PER_PLAYER = 8;
export const MAX_LEVEL = 4;

// Assentos conforme o nº de jogadores (igual ao protótipo): com 2, um de
// frente para o outro. As cores do protótipo viram só a cor PADRÃO de cada
// assento; cada jogador pode escolher a sua (muita gente acha que dá sorte).
const SEATS = { 2: ['azul', 'verde'], 3: ['verde', 'azul', 'vermelho'], 4: ['azul', 'vermelho', 'verde', 'laranja'] };
const TOP = ['azul', 'vermelho']; // assentos do lado de cima da mesa
export function defaultColors(n) {
  return SEATS[n] || SEATS[4];
}

export const DIRS8 = [
  [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1],
];

// DECISÃO: as cartas são usadas na hora ou descartadas (protótipo/PDF).
// Por isso "Trocar baralho" e "Contra-ataque", que só fazem sentido com
// cartas guardadas, ficam fora do sorteio por enquanto.
export const CARDS = {
  bloqueio: { name: 'Bloqueio', text: 'Escolha um adversário: ele perde a próxima vez.', target: 'player' },
  reverso: { name: 'Reverso', text: 'Inverte a ordem de jogada.' },
  salvar: { name: 'Salvar', text: 'Resgata uma aranha sua do cativeiro inimigo para a sua reserva.', target: 'captor' },
  mais1: { name: '+1 de nível', text: 'Aumenta em 1 o nível de uma aranha sua.', target: 'own-piece' },
  menos1: { name: '-1 de nível', text: 'Reduz em 1 o nível de uma aranha inimiga.', target: 'enemy-piece' },
  denovo: { name: 'Jogar novamente', text: 'Depois desta ação, você joga de novo.' },
};
const DECK = Object.keys(CARDS);

// ---------------------------------------------------------------- utils

/** Está dentro da teia? */
export function inside(x, y) {
  return x >= MIN && x <= MAX && y >= MIN && y <= MAX;
}

const rand = (n) => Math.floor(Math.random() * n);
const clone = (s) => JSON.parse(JSON.stringify(s));

export function pieceAt(state, x, y) {
  return state.pieces.find((p) => p.x === x && p.y === y) || null;
}

export function playerIndexById(state, id) {
  return state.players.findIndex((p) => p.id === id);
}

function log(s, text) {
  s.log = [...s.log.slice(-5), text];
}

export function captiveTarget(state) {
  // Manual: 6 inimigos em cativeiro com 2 jogadores, 8 com 3 ou 4.
  return state.players.length === 2 ? 6 : 8;
}

// --------------------------------------------------------------- setup

export function setup(list) {
  const seats = SEATS[list.length] || SEATS[4];
  const withColors = assignColors(list.slice(0, 4), seats);
  const players = withColors.map((p, i) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    side: TOP.includes(seats[i]) ? 'top' : 'bottom', // lado da mesa (mesma tela)
    reserve: PIECES_PER_PLAYER,
    captives: [],        // cores das peças inimigas que este jogador capturou
    eliminated: false,
    skip: 0,             // vezes a pular (carta Bloqueio)
  }));
  // Ordem de jogada sorteada.
  const order = players.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const s = {
    players,
    pieces: [],
    nextPieceId: 1,
    order,
    orderPos: 0,
    dir: 1,
    current: order[0],
    phase: 'roll',       // roll | card | card-target | act | bonus | over
    dice: null,          // { x, y, seq } com sinal (direção)
    rollSeq: 0,
    card: null,          // carta pendente (id)
    again: false,        // "Jogar novamente" ativo nesta vez
    captured: false,     // houve captura na ação em andamento
    bonus: null,         // { pieceId }
    anim: null,          // { seq, kind, from, to, color } para a tela animar
    animSeq: 0,
    winner: null,
    log: [],
  };
  log(s, `${players[s.current].name} começa.`);
  return s;
}

/** Resultado para o placar da sala: null enquanto a partida não acabou. */
export function outcome(state) {
  if (state.phase !== 'over') return null;
  return { winners: state.winner != null ? [state.players[state.winner].id] : [] };
}

export function activePlayers(state) {
  return state.phase === 'over' ? [] : [state.players[state.current].id];
}

// Neste jogo não há informação secreta (cartas são usadas na hora).
export function view(state) {
  return state;
}

// ---------------------------------------------------- jogadas possíveis

/**
 * Lista as ações válidas na fase "act" para o jogador da vez.
 * Usa só UM dos dados: coloca a peça em (dadoX, 0) ou (0, dadoY), ou move
 * uma peça sua dadoX na horizontal ou dadoY na vertical (protótipo).
 * Captura é obrigatória: se existir alguma, só elas valem.
 */
export function legalActions(state) {
  if (state.phase !== 'act' || !state.dice) return [];
  const me = state.current;
  const { x: dx, y: dy } = state.dice;
  const acts = [];
  const consider = (base, x, y) => {
    if (!inside(x, y)) return; // a teia acaba na borda
    const occ = pieceAt(state, x, y);
    if (occ && occ.owner === me) return; // DECISÃO: não empilha (protótipo)
    acts.push({ ...base, x, y, capture: !!occ });
  };

  if (state.players[me].reserve > 0) {
    consider({ type: 'place' }, dx, 0);
    consider({ type: 'place' }, 0, dy);
  }
  for (const p of state.pieces) {
    if (p.owner !== me) continue;
    consider({ type: 'move', pieceId: p.id }, p.x + dx, p.y);
    consider({ type: 'move', pieceId: p.id }, p.x, p.y + dy);
  }
  // Remove duplicatas (ex.: mesma casa pelos dois dados).
  const seen = new Set();
  const unique = acts.filter((a) => {
    const k = `${a.type}:${a.pieceId ?? ''}:${a.x},${a.y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const captures = unique.filter((a) => a.capture);
  return captures.length ? captures : unique;
}

/** Casas do bônus de nível: até `level` casas em linha reta, 8 direções. */
export function bonusTargets(state) {
  if (state.phase !== 'bonus') return [];
  const piece = state.pieces.find((p) => p.id === state.bonus.pieceId);
  if (!piece) return [];
  const out = [];
  const seen = new Set();
  for (const [ddx, ddy] of DIRS8) {
    let { x, y } = piece;
    for (let i = 1; i <= piece.level; i++) {
      x += ddx;
      y += ddy;
      if (!inside(x, y)) break; // bônus para na borda da teia
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      const occ = pieceAt(state, x, y);
      if (occ && occ.owner === piece.owner) continue; // pula as próprias
      seen.add(k);
      out.push({ x, y, capture: !!occ });
    }
  }
  return out;
}

/** Se a carta pendente pode ser usada agora (tem alvo). */
export function cardUsable(state) {
  const card = CARDS[state.card];
  if (!card) return false;
  return cardTargets(state).length > 0 || !card.target;
}

/** Alvos possíveis da carta pendente. */
export function cardTargets(state) {
  const card = CARDS[state.card];
  if (!card?.target) return [];
  const me = state.current;
  const myColor = state.players[me].color;
  switch (card.target) {
    case 'own-piece': return state.pieces.filter((p) => p.owner === me && p.level < MAX_LEVEL).map((p) => p.id);
    case 'enemy-piece': return state.pieces.filter((p) => p.owner !== me && p.level > 0).map((p) => p.id);
    case 'player': return state.players.map((p, i) => i).filter((i) => i !== me && !state.players[i].eliminated);
    case 'captor': return state.players.map((p, i) => i).filter((i) => i !== me && state.players[i].captives.includes(myColor));
    default: return [];
  }
}

// --------------------------------------------------------------- act

export function act(prev, playerId, action) {
  if (!action || typeof action !== 'object') return null;
  if (action.type === 'restart') return prev.phase === 'over' ? setup(prev.players) : null;
  if (prev.phase === 'over') return null;
  if (prev.players[prev.current].id !== playerId) return null;

  const s = clone(prev);
  const me = s.players[s.current];

  switch (action.type) {
    case 'roll': {
      if (s.phase !== 'roll') return null;
      const hot = (rand(4) + 1) * (rand(2) ? 1 : -1);  // vermelho -, laranja +
      const cold = (rand(4) + 1) * (rand(2) ? 1 : -1); // verde -,    azul +
      s.dice = { x: hot, y: cold, seq: ++s.rollSeq };
      s.captured = false;
      log(s, `${me.name} tirou ${diceText(s.dice)}.`);
      if (Math.abs(hot) === Math.abs(cold)) {
        s.card = DECK[rand(DECK.length)];
        s.phase = 'card';
        log(s, `Números iguais! Carta: ${CARDS[s.card].name}.`);
      } else {
        enterAct(s);
      }
      return s;
    }

    case 'card': {
      if (s.phase !== 'card') return null;
      const card = CARDS[s.card];
      if (!action.use) {
        log(s, `${me.name} descartou ${card.name}.`);
        s.card = null;
        enterAct(s);
        return s;
      }
      if (!cardUsable(s)) return null;
      if (card.target) {
        s.phase = 'card-target';
        return s;
      }
      applyCard(s, null);
      return s;
    }

    case 'card-target': {
      if (s.phase !== 'card-target') return null;
      if (action.cancel) { s.phase = 'card'; return s; }
      if (!cardTargets(s).includes(action.target)) return null;
      applyCard(s, action.target);
      return s;
    }

    case 'place':
    case 'move': {
      const legal = legalActions(s).find((a) => a.type === action.type && a.x === action.x && a.y === action.y
        && (a.type === 'place' || a.pieceId === action.pieceId));
      if (!legal) return null;
      if (legal.type === 'place') {
        const level = legal.capture ? 1 : 0;
        const captured = legal.capture ? capture(s, legal.x, legal.y) : false;
        me.reserve -= 1;
        const piece = { id: s.nextPieceId++, owner: s.current, x: legal.x, y: legal.y, level };
        s.pieces.push(piece);
        setAnim(s, 'place', { x: 0, y: 0 }, legal, me.color, piece.id, captured);
        log(s, `${me.name} colocou uma aranha em (${legal.x}, ${legal.y})${captured ? ' e capturou!' : '.'}`);
        s.captured = captured;
        endAction(s);
      } else {
        const piece = s.pieces.find((p) => p.id === legal.pieceId);
        const from = { x: piece.x, y: piece.y };
        const captured = legal.capture ? capture(s, legal.x, legal.y) : false;
        if (captured) piece.level = Math.min(MAX_LEVEL, piece.level + 1);
        piece.x = legal.x;
        piece.y = legal.y;
        setAnim(s, 'move', from, legal, me.color, piece.id, captured);
        log(s, `${me.name} moveu para (${legal.x}, ${legal.y})${captured ? ' e capturou!' : '.'}`);
        s.captured = captured;
        if (checkEnd(s)) return s;
        if (piece.level > 0) {
          s.bonus = { pieceId: piece.id };
          s.phase = 'bonus';
          if (bonusTargets(s).length) return s;
        }
        endAction(s);
      }
      return s;
    }

    case 'bonus': {
      if (s.phase !== 'bonus') return null;
      if (action.skip) { endAction(s); return s; }
      const t = bonusTargets(s).find((b) => b.x === action.x && b.y === action.y);
      if (!t) return null;
      const piece = s.pieces.find((p) => p.id === s.bonus.pieceId);
      const from = { x: piece.x, y: piece.y };
      const captured = t.capture ? capture(s, t.x, t.y) : false;
      if (captured) piece.level = Math.min(MAX_LEVEL, piece.level + 1);
      piece.x = t.x;
      piece.y = t.y;
      setAnim(s, 'move', from, t, me.color, piece.id, captured);
      log(s, `Bônus: ${me.name} avançou para (${t.x}, ${t.y})${captured ? ' e capturou!' : '.'}`);
      s.captured = s.captured || captured;
      endAction(s);
      return s;
    }

    case 'pass': {
      if (s.phase !== 'act' || legalActions(s).length) return null;
      log(s, `${me.name} não tem jogada e passou a vez.`);
      s.captured = false;
      endAction(s);
      return s;
    }

    default:
      return null;
  }
}

// ------------------------------------------------------------- helpers

function diceText({ x, y }) {
  const hx = x < 0 ? `${-x} vermelho (←)` : `${x} laranja (→)`;
  const hy = y < 0 ? `${-y} verde (↓)` : `${y} azul (↑)`;
  return `${hx} e ${hy}`;
}

function enterAct(s) {
  s.phase = 'act';
  s.bonus = null;
}

function setAnim(s, kind, from, to, color, pieceId, captured) {
  s.anim = { seq: ++s.animSeq, kind, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, color, pieceId, captured };
}

// DECISÃO: a peça capturada vai para o CATIVEIRO de quem capturou (manual),
// e não de volta para a reserva do dono (PDF/protótipo). Assim as peças
// realmente acabam, a partida termina e a carta "Salvar" faz sentido.
function capture(s, x, y) {
  const victim = pieceAt(s, x, y);
  if (!victim) return false;
  s.pieces = s.pieces.filter((p) => p !== victim);
  s.players[s.current].captives.push(s.players[victim.owner].color);
  return true;
}

function applyCard(s, target) {
  const me = s.players[s.current];
  const id = s.card;
  const card = CARDS[id];
  s.card = null;
  switch (id) {
    case 'bloqueio':
      s.players[target].skip += 1;
      log(s, `${me.name} bloqueou ${s.players[target].name}.`);
      break;
    case 'reverso':
      s.dir *= -1;
      log(s, `${me.name} inverteu a ordem de jogada.`);
      break;
    case 'salvar': {
      const captor = s.players[target];
      captor.captives.splice(captor.captives.indexOf(me.color), 1);
      me.reserve += 1; // volta como nível 0, pois entra pela reserva
      log(s, `${me.name} resgatou uma aranha do cativeiro de ${captor.name}.`);
      break;
    }
    case 'mais1': {
      const p = s.pieces.find((q) => q.id === target);
      p.level = Math.min(MAX_LEVEL, p.level + 1);
      log(s, `${me.name} subiu uma aranha para o nível ${p.level}.`);
      break;
    }
    case 'menos1': {
      const p = s.pieces.find((q) => q.id === target);
      p.level = Math.max(0, p.level - 1);
      log(s, `${me.name} baixou uma aranha de ${s.players[p.owner].name}.`);
      break;
    }
    case 'denovo':
      s.again = true;
      log(s, `${me.name} vai jogar de novo depois desta ação.`);
      break;
    default:
      log(s, `${card?.name ?? 'Carta'} sem efeito.`);
  }
  enterAct(s);
}

function endAction(s) {
  s.bonus = null;
  if (checkEnd(s)) return;
  // Captura (ou carta "Jogar novamente") = joga de novo.
  if (s.captured || s.again) {
    if (!s.captured) s.again = false;
    s.captured = false;
    s.phase = 'roll';
    log(s, `${s.players[s.current].name} joga de novo!`);
    return;
  }
  nextTurn(s);
}

function nextTurn(s) {
  s.again = false;
  s.captured = false;
  const n = s.order.length;
  for (let tries = 0; tries < n * 3; tries++) {
    s.orderPos = (s.orderPos + s.dir + n) % n;
    const idx = s.order[s.orderPos];
    const p = s.players[idx];
    if (p.eliminated) continue;
    if (p.skip > 0) {
      p.skip -= 1;
      log(s, `${p.name} está bloqueado e perdeu a vez.`);
      continue;
    }
    s.current = idx;
    s.phase = 'roll';
    s.dice = null;
    return;
  }
}

function piecesLeft(s, idx) {
  return s.players[idx].reserve + s.pieces.filter((p) => p.owner === idx).length;
}

// Fim de jogo (manual): vence quem tiver o nº-alvo de inimigos em cativeiro
// ou for o último com peças. Sem peças (tabuleiro + reserva) = eliminado.
// Com 2 jogadores restantes, quem ficar com 2 ou menos peças no tabuleiro
// e nenhuma na reserva é eliminado (regra especial do PDF).
function checkEnd(s) {
  s.players.forEach((p, i) => {
    if (p.eliminated) return;
    if (piecesLeft(s, i) === 0) {
      p.eliminated = true;
      log(s, `${p.name} foi eliminado!`);
    }
  });
  const alive = () => s.players.map((p, i) => i).filter((i) => !s.players[i].eliminated);
  if (alive().length === 2) {
    for (const i of alive()) {
      const p = s.players[i];
      if (p.reserve === 0 && s.pieces.filter((q) => q.owner === i).length <= 2) {
        p.eliminated = true;
        log(s, `${p.name} ficou com 2 aranhas ou menos e foi eliminado!`);
        break;
      }
    }
  }
  const target = captiveTarget(s);
  const champion = s.players.findIndex((p) => !p.eliminated && p.captives.length >= target);
  const left = alive();
  if (champion >= 0 || left.length <= 1) {
    const w = champion >= 0 ? champion : left[0];
    s.winner = w ?? null;
    s.phase = 'over';
    log(s, w != null ? `${s.players[w].name} venceu!` : 'Fim de jogo.');
    return true;
  }
  return false;
}
