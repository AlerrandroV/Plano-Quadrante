// ===================================================================
//  ÚLTIMA CARTA — jogo de descarte de cartas (2 a 6 jogadores)
//
//  Mecânica clássica da família "Crazy Eights / Mau-Mau": combine a
//  carta de cima pela COR (naipe) ou pelo NÚMERO/SÍMBOLO; quem ficar sem
//  cartas vence. Nome, naipes e visual são próprios da plataforma.
//
//  Baralho (108): 4 naipes (chama, gota, folha, sol) com um 0, dois de
//  cada 1-9, dois Pula, dois Volta e dois +2; mais 4 Coringas e 4
//  Coringas +4.
//
//  REGRAS OFICIAIS (padrão):
//  - 7 cartas para cada; vira-se a primeira carta do monte (um +4 volta
//    para o monte). Se for Pula/Volta/+2/Coringa, o efeito vale para o
//    primeiro jogador.
//  - Na vez: jogue uma carta que combine em cor ou número/símbolo, ou um
//    Coringa. Sem jogar, compra 1; se a comprada servir, pode jogá-la na
//    hora; se não, passa a vez.
//  - Pula: o próximo perde a vez. Volta: inverte o sentido (com 2
//    jogadores, vale como Pula). +2: o próximo compra 2 e perde a vez.
//    Coringa: escolhe a cor. +4: escolhe a cor, o próximo compra 4 e
//    perde a vez — só vale se você NÃO tinha carta da cor da mesa; o
//    próximo pode DESAFIAR: se você tinha, quem compra 4 é você; se não
//    tinha, ele compra 6.
//  - Ao ficar com 1 carta, grite "Última!". Se alguém pegar antes de o
//    próximo jogador agir, você compra 2.
//  - Vence a rodada quem ficar sem cartas. Modo pontos: o vencedor ganha
//    os pontos das mãos dos outros (número = valor, Pula/Volta/+2 = 20,
//    Coringas = 50); vence quem chegar a 500.
//
//  REGRAS DE RUA (opções, as mais citadas em fóruns):
//  - empilhar: +2 em cima de +2 (ou +4 em cima de +2/+4) passa a
//    compra acumulada adiante.
//  - corte: quem tem carta IDÊNTICA à de cima (mesma cor e número)
//    joga fora da vez, e o jogo segue a partir dele.
//  - seteZero: 7 troca a mão com alguém; 0 gira todas as mãos.
//  - compraAte: sem carta para jogar, compra até achar uma que sirva.
//  - bateNumero: não pode bater (última carta) com carta especial.
//  - mais4Livre: +4 a qualquer hora, sem desafio.
// ===================================================================
import { assignColors } from '../../ui/colors.js';

export const meta = { id: 'ultima-carta', name: 'Última Carta', minPlayers: 2, maxPlayers: 6 };
export const HAND = 7;
export const TARGET = 500;

export const SUITS = ['chama', 'gota', 'folha', 'sol'];
export const SUIT_COLOR = { chama: 'vermelho', gota: 'azul', folha: 'verde', sol: 'laranja' };
export const SUIT_LABEL = { chama: 'Chama', gota: 'Gota', folha: 'Folha', sol: 'Sol' };
export const HOUSE = ['empilhar', 'corte', 'seteZero', 'compraAte', 'bateNumero', 'mais4Livre'];

// Cartas: id -> { c: naipe | null, k: 'n'|'pula'|'volta'|'mais2'|'coringa'|'mais4', v: número }
export const CARDS = [];
for (const c of SUITS) {
  CARDS.push({ c, k: 'n', v: 0 });
  for (let v = 1; v <= 9; v++) { CARDS.push({ c, k: 'n', v }); CARDS.push({ c, k: 'n', v }); }
  for (const k of ['pula', 'volta', 'mais2']) { CARDS.push({ c, k }); CARDS.push({ c, k }); }
}
for (let i = 0; i < 4; i++) { CARDS.push({ c: null, k: 'coringa' }); CARDS.push({ c: null, k: 'mais4' }); }

export const isWild = (id) => CARDS[id].c == null;
export const isAction = (id) => CARDS[id].k !== 'n';
export function points(id) {
  const card = CARDS[id];
  if (card.k === 'n') return card.v;
  return isWild(id) ? 50 : 20;
}
export function cardName(id) {
  const card = CARDS[id];
  const name = card.k === 'n' ? String(card.v) : { pula: 'Pula', volta: 'Volta', mais2: '+2', coringa: 'Coringa', mais4: 'Coringa +4' }[card.k];
  return card.c ? `${name} ${SUIT_LABEL[card.c]}` : name;
}

export const OPTIONS = [
  {
    id: 'regras', label: 'Regras',
    choices: [
      { id: 'oficial', label: 'Oficial', hint: 'Clássicas: desafio do +4 e grito de "Última!".' },
      { id: 'rua', label: 'De rua', hint: '' },
    ],
    default: 'oficial',
  },
  {
    id: 'rua', label: 'De rua', type: 'flags', showIf: { regras: 'rua' },
    choices: [
      { id: 'empilhar', label: 'Empilhar +2/+4', hint: 'Recebeu +2? Jogue outro +2 (ou um +4) e passe a conta adiante.' },
      { id: 'corte', label: 'Corte', hint: 'Tem a carta idêntica à da mesa? Jogue fora da vez.' },
      { id: 'seteZero', label: '7 troca, 0 gira', hint: '7: troca de mão com alguém. 0: todas as mãos giram.' },
      { id: 'compraAte', label: 'Compra até jogar', hint: 'Sem carta que sirva, compra até achar uma.' },
      { id: 'bateNumero', label: 'Bate com número', hint: 'A última carta não pode ser especial.' },
      { id: 'mais4Livre', label: '+4 sem desafio', hint: '+4 a qualquer hora; ninguém desafia.' },
    ],
    default: ['empilhar', 'compraAte', 'bateNumero'],
  },
  {
    id: 'vitoria', label: 'Vitória',
    choices: [
      { id: 'rodada', label: '1 rodada', hint: 'Vence quem ficar sem cartas.' },
      { id: 'pontos', label: `${TARGET} pts`, hint: 'Quem bate soma as mãos dos outros.' },
    ],
    default: 'rodada',
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
  return ['azul', 'vermelho', 'verde', 'laranja', 'roxo', 'amarelo'];
}

/** Regras de rua valendo nesta partida. */
export function houseRules(opts = {}) {
  if (opts.regras !== 'rua') return {};
  const list = Array.isArray(opts.rua) ? opts.rua : OPTIONS[1].default;
  return Object.fromEntries(HOUSE.map((h) => [h, list.includes(h)]));
}

// --------------------------------------------------------------- setup

export function setup(list, opts = {}) {
  const players = assignColors(list.slice(0, meta.maxPlayers), defaultColors())
    .map((p) => ({ id: p.id, name: p.name, color: p.color, hand: [], score: 0, called: false, lacks: [] }));
  const s = {
    opts: { regras: opts.regras === 'rua' ? 'rua' : 'oficial', rua: Array.isArray(opts.rua) ? opts.rua : OPTIONS[1].default, vitoria: opts.vitoria === 'pontos' ? 'pontos' : 'rodada' },
    house: houseRules(opts),
    players, deck: [], discard: [], color: null, turn: 0, dir: 1,
    phase: 'play', pending: 0, drawn: null, vulnerable: null, wild: null,
    dealer: Math.floor(Math.random() * players.length), round: 0,
    seq: 0, last: null, roundResult: null, winner: null, log: [],
  };
  deal(s);
  return s;
}

function deal(s) {
  s.fx = [];
  s.round += 1;
  s.deck = shuffle(CARDS.map((_, i) => i));
  s.players.forEach((p) => { p.hand = s.deck.splice(0, HAND); p.called = false; p.lacks = []; });
  s.discard = [];
  s.dir = 1;
  s.pending = 0;
  s.drawn = null;
  s.vulnerable = null;
  s.wild = null;
  s.roundResult = null;
  s.phase = 'play';
  // Vira a primeira carta; um +4 volta para o monte.
  let top = s.deck.pop();
  while (CARDS[top].k === 'mais4') { s.deck.unshift(top); shuffle(s.deck); top = s.deck.pop(); }
  s.discard.push(top);
  s.color = CARDS[top].c;
  const n = s.players.length;
  s.turn = (s.dealer + 1) % n;
  s.last = { seq: ++s.seq, kind: 'start', id: top };
  log(s, `Rodada ${s.round}: a carta da mesa é ${cardName(top)}.`);
  // Efeito da carta virada vale para o primeiro jogador.
  const k = CARDS[top].k;
  const c = CARDS[top].c;
  if (k === 'pula') { fx(s, { t: 'skip', target: s.turn, c }); log(s, `${s.players[s.turn].name} perde a vez.`); s.turn = step(s, 1); }
  else if (k === 'volta') { s.dir = -1; s.turn = s.dealer; fx(s, { t: 'reverse', dir: -1, c }); } // quem deu começa, no outro sentido
  else if (k === 'mais2') { fx(s, { t: 'hit', target: s.turn, n: 2, c }); give(s, s.turn, 2, true); log(s, `${s.players[s.turn].name} compra 2.`); s.turn = step(s, 1); }
  else if (k === 'coringa') { s.phase = 'color'; s.wild = { by: s.turn, start: true }; }
}

function step(s, k) {
  const n = s.players.length;
  return (((s.turn + k * s.dir) % n) + n) % n;
}

/**
 * Efeitos visuais da última ação (a tela anima, na ordem):
 *   { t: 'skip', target, c }       símbolo de bloqueio vai até quem perde a vez
 *   { t: 'hit', target, n, c }     "+2"/"+4" vai até quem vai comprar
 *   { t: 'reverse', dir, c }       símbolo de reverso gira no novo sentido
 *   { t: 'draw', pid, n, fast }    cartas saem do monte uma a uma
 */
function fx(s, e) { (s.fx ||= []).push(e); }

/**
 * Compra `count` cartas para o jogador `idx` (embaralha o descarte se o
 * monte acabar). fast = compra de castigo (+2, +4, pego, desafio).
 */
function give(s, idx, count, fast = false) {
  let got = 0;
  for (let i = 0; i < count; i++) {
    if (!s.deck.length) {
      const top = s.discard.pop();
      s.deck = shuffle(s.discard);
      s.discard = [top];
      if (!s.deck.length) break;
    }
    s.players[idx].hand.push(s.deck.pop());
    got++;
  }
  s.players[idx].called = false;
  if (!got) return;
  const prev = s.fx?.[s.fx.length - 1];
  if (prev && prev.t === 'draw' && prev.pid === idx && prev.fast === fast) prev.n += got;
  else fx(s, { t: 'draw', pid: idx, n: got, fast });
}

export function topCard(state) {
  return state.discard[state.discard.length - 1];
}

// ------------------------------------------------------- quem age agora

export function activePlayers(state) {
  return state.phase === 'round' || state.phase === 'over' ? [] : [state.players[state.turn].id];
}

/** Quem pode agir agora: quem está na vez primeiro; com "corte" ou alguém pegável, todos. */
export function pendingPlayers(state) {
  if (state.phase === 'round') return state.players.map((p) => p.id);
  if (state.phase === 'over') return [];
  const cur = state.players[state.turn].id;
  if (state.vulnerable != null || (state.house.corte && state.phase === 'play')) {
    return [cur, ...state.players.map((p) => p.id).filter((id) => id !== cur)];
  }
  return [cur];
}

/** Cada um só vê a própria mão (todas aparecem no fim da rodada). */
export function view(state, playerId) {
  const v = clone(state);
  const reveal = state.phase === 'round' || state.phase === 'over';
  v.deckCount = state.deck.length;
  v.deck = [];
  v.players.forEach((p) => {
    p.handCount = p.hand.length;
    if (!reveal && p.id !== playerId) p.hand = [];
  });
  if (v.wild) delete v.wild.hadColor; // ninguém sabe se o +4 foi blefe
  v.discardCount = state.discard.length;
  v.discard = state.discard.slice(-6);
  return v;
}

export function outcome(state) {
  if (state.phase !== 'over') return null;
  return { winners: state.winner != null ? [state.players[state.winner].id] : [] };
}

// --------------------------------------------------- jogadas possíveis

/** A carta `id` pode ser jogada agora pela mão `hand`? */
export function canPlay(state, hand, id) {
  if (state.phase !== 'play' && state.phase !== 'challenge') return false;
  const card = CARDS[id];
  const top = CARDS[topCard(state)];
  // Bate só com número: a última carta não pode ser especial.
  if (state.house.bateNumero && hand.length === 1 && card.k !== 'n') return false;
  if (state.phase === 'challenge') {
    // Diante de um +4: só empilhar outro +4 (regra de rua).
    return !!state.house.empilhar && card.k === 'mais4';
  }
  if (state.pending > 0) {
    // Compra acumulada (empilhar): só +2 sobre +2, ou +4.
    return card.k === 'mais4' || (card.k === 'mais2' && top.k === 'mais2');
  }
  if (state.drawn != null && id !== state.drawn) return false;
  if (card.c == null) return true;
  if (card.c === state.color) return true;
  if (card.k === 'n') return top.k === 'n' && top.v === card.v;
  return card.k === top.k;
}

export function playable(state, hand) {
  return hand.filter((id) => canPlay(state, hand, id));
}

/** Corte (regra de rua): carta idêntica à de cima, fora da vez. */
export function canJump(state, id) {
  if (!state.house.corte || state.phase !== 'play' || state.pending > 0) return false;
  const card = CARDS[id];
  const top = CARDS[topCard(state)];
  if (card.c == null || card.c !== top.c || card.k !== top.k) return false;
  return card.k !== 'n' || card.v === top.v;
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
  if (action.type === 'next-round') {
    if (prev.phase !== 'round') return null;
    const s = clone(prev);
    s.dealer = (s.dealer + 1) % s.players.length;
    deal(s); // zera os efeitos e anima os da carta virada
    return s;
  }
  if (prev.phase === 'round' || prev.phase === 'over') return null;

  const s = clone(prev);
  s.fx = [];
  const me = s.players[idx];

  // Gritar "Última!" (com 2 cartas, antes de jogar; ou com 1, antes de ser pego).
  if (action.type === 'call') {
    if (me.hand.length > 2 || me.called) return null;
    me.called = true;
    if (s.vulnerable === idx) s.vulnerable = null;
    s.last = { seq: ++s.seq, kind: 'call', pid: idx };
    log(s, `${me.name}: "Última!"`);
    return s;
  }
  // Pegar quem ficou com 1 carta sem gritar: ele compra 2.
  if (action.type === 'catch') {
    const t = action.target;
    if (s.vulnerable == null || s.vulnerable !== t || t === idx) return null;
    give(s, t, 2, true);
    s.vulnerable = null;
    s.last = { seq: ++s.seq, kind: 'catch', pid: idx, target: t };
    log(s, `${me.name} pegou ${s.players[t].name} sem gritar "Última!": compra 2.`);
    return s;
  }
  // Corte: carta idêntica fora da vez.
  if (action.type === 'jump') {
    if (idx === s.turn || !me.hand.includes(action.id) || !canJump(s, action.id)) return null;
    s.turn = idx;
    s.drawn = null;
    if (s.vulnerable !== idx) s.vulnerable = null;
    log(s, `${me.name} cortou!`);
    return playCard(s, idx, action.id, true);
  }

  if (idx !== s.turn) return null;
  // Quem está na vez agiu: acabou a chance de pegar quem não gritou.
  if (s.vulnerable != null && s.vulnerable !== idx) s.vulnerable = null;

  switch (action.type) {
    case 'play': {
      if (!me.hand.includes(action.id) || !canPlay(s, me.hand, action.id)) return null;
      return playCard(s, idx, action.id, false);
    }
    case 'color': {
      if (s.phase !== 'color' || !SUITS.includes(action.color)) return null;
      s.color = action.color;
      s.last = { seq: ++s.seq, kind: 'color', pid: idx, color: action.color };
      log(s, `${me.name} escolheu ${SUIT_LABEL[action.color]}.`);
      const w = s.wild;
      s.phase = 'play';
      if (w.start) { s.wild = null; return s; } // carta virada: o primeiro escolhe a cor e joga
      if (w.kind === 'mais4') {
        s.turn = step(s, 1);
        fx(s, { t: 'hit', target: s.turn, n: 4 + s.pending, c: null });
        if (!s.players[idx].hand.length) {
          // Bateu com +4: o próximo compra e a rodada acaba.
          s.wild = null;
          give(s, s.turn, 4 + s.pending, true);
          s.pending = 0;
          return endRound(s, idx);
        }
        if (s.house.mais4Livre) { s.wild = null; return afterPlus4(s, false); }
        s.phase = 'challenge'; // o próximo decide: aceitar, desafiar (ou empilhar)
        return s;
      }
      s.wild = null;
      if (s.players[idx].hand.length === 0) return endRound(s, idx);
      s.turn = step(s, 1);
      return s;
    }
    case 'accept': {
      if (s.phase !== 'challenge') return null;
      s.wild = null;
      return afterPlus4(s, false);
    }
    case 'challenge': {
      if (s.phase !== 'challenge' || s.house.mais4Livre) return null;
      const w = s.wild;
      s.wild = null;
      s.phase = 'play';
      if (w.hadColor) {
        // Jogou o +4 tendo carta da cor: quem compra é ele.
        fx(s, { t: 'hit', target: w.by, n: 4 + s.pending, c: null });
        give(s, w.by, 4 + s.pending, true);
        log(s, `Desafio certo! ${s.players[w.by].name} tinha ${SUIT_LABEL[w.prevColor]} e compra ${4 + s.pending}.`);
        s.pending = 0;
        s.last = { seq: ++s.seq, kind: 'challenge', pid: idx, ok: true };
        if (s.players[w.by].hand.length && s.vulnerable === w.by) s.vulnerable = null;
        return s; // o desafiante joga normalmente
      }
      give(s, idx, 6 + s.pending, true);
      log(s, `Desafio errado: ${me.name} compra ${6 + s.pending}.`);
      s.pending = 0;
      s.last = { seq: ++s.seq, kind: 'challenge', pid: idx, ok: false };
      s.turn = step(s, 1);
      return s;
    }
    case 'swap': {
      if (s.phase !== 'swap' || action.target === idx || !s.players[action.target]) return null;
      const t = s.players[action.target];
      [me.hand, t.hand] = [t.hand, me.hand];
      [me.lacks, t.lacks] = [t.lacks, me.lacks];
      me.called = false; t.called = false;
      s.last = { seq: ++s.seq, kind: 'swap', pid: idx, target: action.target };
      log(s, `${me.name} trocou de mão com ${t.name}.`);
      s.phase = 'play';
      if (me.hand.length === 0) return endRound(s, idx);
      s.turn = step(s, 1);
      return s;
    }
    case 'draw': {
      if (s.phase !== 'play' || s.drawn != null) return null;
      if (s.pending > 0) {
        // Não empilhou: compra tudo o que acumulou e perde a vez.
        const n = s.pending;
        give(s, idx, n, true);
        s.pending = 0;
        s.last = { seq: ++s.seq, kind: 'draw', pid: idx, count: n };
        log(s, `${me.name} comprou ${n}.`);
        s.turn = step(s, 1);
        return s;
      }
      let count = 0;
      let got = null;
      do {
        const before = me.hand.length;
        give(s, idx, 1);
        if (me.hand.length === before) break; // acabaram as cartas
        count++;
        const id = me.hand[me.hand.length - 1];
        if (canPlay({ ...s, drawn: null }, me.hand, id)) got = id;
      } while (s.house.compraAte && got == null && count < 108);
      s.last = { seq: ++s.seq, kind: 'draw', pid: idx, count };
      log(s, `${me.name} comprou ${count === 1 ? 'uma carta' : `${count} cartas`}.`);
      // Todos viram: faltava a cor da mesa (informação pública, como no dominó).
      if (s.color && !me.lacks.includes(s.color)) me.lacks.push(s.color);
      if (got != null) { s.drawn = got; return s; } // pode jogar a que comprou (ou passar)
      s.turn = step(s, 1);
      return s;
    }
    case 'pass': {
      if (s.phase !== 'play' || s.drawn == null) return null;
      s.drawn = null;
      s.last = { seq: ++s.seq, kind: 'pass', pid: idx };
      log(s, `${me.name} passou.`);
      s.turn = step(s, 1);
      return s;
    }
    default:
      return null;
  }
}

function afterPlus4(s, _) {
  // Quem está na vez (o "alvo" do +4) aceita: compra 4 (+ acumulado) e perde a vez.
  const n = 4 + s.pending;
  give(s, s.turn, n, true);
  log(s, `${s.players[s.turn].name} comprou ${n}.`);
  s.pending = 0;
  s.phase = 'play';
  s.last = { seq: ++s.seq, kind: 'draw', pid: s.turn, count: n };
  s.turn = step(s, 1);
  return s;
}

function playCard(s, idx, id, jumped) {
  const me = s.players[idx];
  const card = CARDS[id];
  const prevColor = s.color;
  const hadColor = me.hand.some((x) => x !== id && CARDS[x].c === prevColor);
  me.hand = me.hand.filter((x) => x !== id);
  if (card.c) me.lacks = me.lacks.filter((c) => c !== card.c);
  s.discard.push(id);
  s.drawn = null;
  if (me.hand.length !== 1) me.called = false;
  if (me.hand.length === 1 && !me.called) s.vulnerable = idx; // esqueceu de gritar?
  s.last = { seq: ++s.seq, kind: 'play', pid: idx, id, jumped };
  log(s, `${me.name} jogou ${cardName(id)}.`);
  const n = s.players.length;

  // Diante de um +4 (fase de desafio): empilhar outro +4.
  if (s.phase === 'challenge') {
    s.pending += 4;
    s.wild = { by: idx, kind: 'mais4', hadColor, prevColor };
    s.phase = 'color';
    return s;
  }
  if (card.c) s.color = card.c;

  switch (card.k) {
    case 'pula':
      fx(s, { t: 'skip', target: step(s, 1), c: card.c });
      if (!me.hand.length) return endRound(s, idx);
      log(s, `${s.players[step(s, 1)].name} perde a vez.`);
      s.turn = step(s, 2);
      return s;
    case 'volta':
      s.dir *= -1;
      fx(s, { t: 'reverse', dir: s.dir, c: card.c });
      if (n === 2) fx(s, { t: 'skip', target: step(s, 1), c: card.c }); // com 2, vale como Pula
      if (!me.hand.length) return endRound(s, idx);
      s.turn = n === 2 ? step(s, 2) : step(s, 1);
      return s;
    case 'mais2':
      if (s.house.empilhar) {
        s.pending += 2;
        fx(s, { t: 'hit', target: step(s, 1), n: s.pending, c: card.c });
        if (!me.hand.length) { give(s, step(s, 1), s.pending, true); s.pending = 0; return endRound(s, idx); }
        s.turn = step(s, 1);
        return s;
      }
      fx(s, { t: 'hit', target: step(s, 1), n: 2, c: card.c });
      give(s, step(s, 1), 2, true);
      log(s, `${s.players[step(s, 1)].name} compra 2 e perde a vez.`);
      if (!me.hand.length) return endRound(s, idx);
      s.turn = step(s, 2);
      return s;
    case 'coringa':
      s.phase = 'color';
      s.wild = { by: idx, kind: 'coringa' };
      return s;
    case 'mais4':
      s.phase = 'color';
      s.wild = { by: idx, kind: 'mais4', hadColor, prevColor };
      return s;
    case 'n':
      if (s.house.seteZero && card.v === 7 && me.hand.length) { s.phase = 'swap'; return s; }
      if (s.house.seteZero && card.v === 0) {
        // Todas as mãos giram no sentido do jogo.
        const hands = s.players.map((p) => p.hand);
        s.players.forEach((p, i) => { p.hand = hands[(((i - s.dir) % n) + n) % n]; p.called = false; p.lacks = []; });
        log(s, 'Zero! Todas as mãos giraram.');
        if (s.players[idx].hand.length === 0) return endRound(s, idx);
        if (s.players.some((p) => p.hand.length === 0)) return endRound(s, s.players.findIndex((p) => p.hand.length === 0));
      }
      if (!me.hand.length) return endRound(s, idx);
      s.turn = step(s, 1);
      return s;
    default:
      return s;
  }
}

function endRound(s, winner) {
  s.vulnerable = null;
  s.drawn = null;
  s.wild = null;
  s.pending = 0;
  const pts = s.players.reduce((t, p, i) => (i === winner ? t : t + p.hand.reduce((a, id) => a + points(id), 0)), 0);
  s.roundResult = { winner, points: pts };
  log(s, `${s.players[winner].name} bateu!`);
  if (s.opts.vitoria !== 'pontos') {
    s.phase = 'over';
    s.winner = winner;
    log(s, `${s.players[winner].name} venceu!`);
    return s;
  }
  s.players[winner].score += pts;
  log(s, `+${pts} pontos para ${s.players[winner].name}.`);
  if (s.players[winner].score >= TARGET) {
    s.phase = 'over';
    s.winner = winner;
    log(s, `${s.players[winner].name} venceu com ${s.players[winner].score} pontos!`);
    return s;
  }
  s.phase = 'round';
  return s;
}
