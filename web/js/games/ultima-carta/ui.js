// Interface da Última Carta (pixel art), na mesma "mesa" dos outros jogos.
// Sem modo de mesma tela: cada um vê só a própria mão.
import { h } from '../../ui/dom.js';
import { PAL, pixelCanvas, drawText, textWidth } from '../../ui/pixel.js';
import {
  tableLayout, fitTable, setTurnColor, playerPanel, spectatorPanel, btn, logBar,
} from '../../ui/table.js';
import { sfx } from '../../ui/sound.js';
import * as R from './rules.js';
import { drawCard, drawSuit, CARD_W, CARD_H, SUIT_RAMP } from './cards.js';

const SIZE = 200; // mesa 200x200 (2x): cartas grandes na tela
const DEBUG = new URLSearchParams(location.search).has('debug');
const FELT = '#2a2350';
const FELT_D = '#221c42';

const ui = { board: null, last: null, snd: null };

export const RULES = {
  title: 'Última Carta',
  items: [
    '108 cartas em 4 naipes (Chama, Gota, Folha e Sol): números 0 a 9, Pula, Volta e +2; mais 4 Coringas e 4 Coringas +4. Cada um recebe 7.',
    'Na sua vez, jogue uma carta da mesma COR ou do mesmo NÚMERO/SÍMBOLO da carta da mesa, ou um Coringa. Sem jogar, compre 1: se ela servir, pode jogá-la na hora.',
    'Pula: o próximo perde a vez. Volta: inverte o sentido (com 2, vale como Pula). +2: o próximo compra 2 e perde a vez. Coringa: você escolhe a cor.',
    '+4: escolhe a cor e o próximo compra 4 e perde a vez. Só vale se você não tinha carta da cor da mesa. O próximo pode DESAFIAR: se você tinha, você compra 4; se não tinha, ele compra 6.',
    'Ao ficar com 1 carta, aperte "Última!". Se alguém apertar "Pegar" antes do próximo jogar, você compra 2.',
    'A carta virada no começo também vale: Pula, Volta, +2 e Coringa afetam o primeiro jogador.',
    'Vence quem ficar sem cartas. No modo pontos, quem bate ganha os pontos das mãos dos outros (número = valor; Pula, Volta e +2 = 20; Coringas = 50) e vence quem chegar a 500.',
    'Regras de rua (se ligadas): empilhar +2/+4; corte (carta idêntica joga fora da vez); 7 troca a mão e 0 gira as mãos; comprar até poder jogar; só bater com número; +4 sem desafio.',
  ],
};

// ================================================================ render
export function render(root, state, ctx) {
  ui.last = { root, state, ctx };
  if (DEBUG) window.__pq = { state, ctx };

  const meIdx = state.players.findIndex((p) => p.id === ctx.me);
  const me = meIdx >= 0 ? state.players[meIdx] : null;
  const myTurn = meIdx === state.turn && !['round', 'over'].includes(state.phase);
  const myHand = me ? me.hand : [];
  const plays = myTurn ? R.playable(state, myHand) : [];
  const jumps = me && !myTurn ? myHand.filter((id) => R.canJump(state, id)) : [];
  const canDraw = myTurn && state.phase === 'play' && state.drawn == null;

  if (!ui.board) ui.board = new Board();
  const board = ui.board;
  board.update(state, meIdx, canDraw ? () => ctx.send({ type: 'draw' }) : null);
  playSounds(state, meIdx);

  setTurnColor(state.players[state.turn].color);
  const sideA = [];
  const sideB = [];
  const others = state.players.map((_, i) => i).filter((i) => i !== meIdx);
  // A partir do jogador seguinte (na ordem do jogo), para a mesa fazer sentido.
  const start = meIdx >= 0 ? meIdx : 0;
  others.sort((a, b) => ((a - start + state.players.length) % state.players.length) - ((b - start + state.players.length) % state.players.length));
  for (const i of others) sideA.push(cardPanel(state, i, ctx, meIdx, { rested: others.length > 3 }));
  const controls = controlsPanel(state, ctx, { meIdx, myTurn, plays, jumps, myHand });
  sideB.push(me ? cardPanel(state, meIdx, ctx, meIdx, { controls, me: true }) : spectatorPanel(controls));

  const lay = tableLayout({ shared: false, sideA, sideB, center: board.canvas, log: logBar(state.log, RULES) });
  root.replaceChildren(lay);
  fitTable(lay, board.canvas, SIZE, board);
  requestAnimationFrame(() => fitHand(lay));
}

function rerender() {
  if (ui.last?.root.isConnected) render(ui.last.root, ui.last.state, ui.last.ctx);
}

/**
 * Mão: quebra em mais linhas se houver altura; se não houver, as cartas se
 * sobrepõem numa linha só (como um leque na mão).
 */
function fitHand(lay) {
  const hand = lay.querySelector('.uc-hand');
  if (!hand) return;
  const cards = hand.querySelectorAll('.uc-card-btn');
  hand.classList.remove('tight');
  hand.style.setProperty('--ov', '0px');
  if (cards.length < 2) return;
  const inner = hand.closest('.pq-ctl-inner');
  const msg = inner?.querySelector('.pq-message');
  const W = hand.clientWidth;
  const w = cards[0].offsetWidth;
  const ch = cards[0].offsetHeight;
  const perRow = Math.max(1, Math.floor((W + 2) / (w + 2)));
  const rows = Math.ceil(cards.length / perRow);
  // Altura do texto e dos botões (a mensagem estica para ocupar o resto).
  const msgH = msg ? [...msg.children].reduce((t, el) => t + el.offsetHeight + 4, 0) : 0;
  const room = inner ? inner.clientHeight - msgH - 12 : ch;
  if (rows === 1 || rows * (ch + 2) <= room) return; // cabe quebrando linhas
  const ov = Math.min(w * 0.7, (cards.length * (w + 2) - W) / (cards.length - 1) + 2);
  hand.style.setProperty('--ov', `${Math.ceil(ov)}px`);
  hand.classList.add('tight');
}

// Efeitos sonoros quando algo NOVO acontece.
function playSounds(state, meIdx) {
  const snd = ui.snd || (ui.snd = { seq: state.seq, phase: state.phase, turn: state.turn, round: state.round, ready: false });
  if (!snd.ready || state.seq < snd.seq || state.round < snd.round) {
    Object.assign(snd, { seq: state.seq, phase: state.phase, turn: state.turn, round: state.round, ready: true });
    return;
  }
  if (state.seq > snd.seq && state.last) {
    const l = state.last;
    if (l.kind === 'play') sfx(l.jumped ? 'capture' : R.isAction(l.id) ? 'king' : 'card');
    else if (l.kind === 'draw') sfx('draw');
    else if (l.kind === 'pass') sfx('pass');
    else if (l.kind === 'call') sfx('levelup');
    else if (l.kind === 'catch') sfx('capture');
    else if (l.kind === 'color' || l.kind === 'swap') sfx('select');
    else if (l.kind === 'challenge') sfx(l.ok ? 'points' : 'error');
  }
  if (state.turn === meIdx && ['play', 'challenge'].includes(state.phase) && (snd.turn !== state.turn || !['play', 'challenge'].includes(snd.phase))) {
    setTimeout(() => sfx('turn'), 250);
  }
  if (state.phase !== snd.phase && (state.phase === 'over' || state.phase === 'round')) {
    const w = state.phase === 'over' ? state.winner : state.roundResult?.winner;
    setTimeout(() => sfx(w === meIdx ? 'win' : 'lose'), 450);
  }
  Object.assign(snd, { seq: state.seq, phase: state.phase, turn: state.turn, round: state.round });
}

// ================================================================ painéis
function cardPanel(state, i, ctx, meIdx, { controls = null, me = false, rested = false } = {}) {
  const p = state.players[i];
  const count = p.handCount ?? p.hand.length;
  const tags = [];
  if (state.phase === 'over' && state.winner === i) tags.push({ text: 'VENCEU', kind: 'win' });
  else if (state.phase === 'round' && state.roundResult?.winner === i) tags.push({ text: 'BATEU', kind: 'win' });
  else if (count === 1 && p.called) tags.push({ text: 'ÚLTIMA!', kind: 'win' });
  else if (state.vulnerable === i) tags.push({ text: 'NÃO GRITOU', kind: 'alert' });
  const stats = [{ icon: 'carta', label: 'Cartas na mão', value: count }];
  if (state.opts.vitoria === 'pontos') stats.push({ icon: 'trofeu', label: `Pontos (meta ${R.TARGET})`, value: p.score });
  const panel = playerPanel({
    color: p.color, name: p.name, me, controls, tags, stats,
    turn: !['round', 'over'].includes(state.phase) && state.turn === i,
  });
  if (rested && !controls && state.turn !== i) panel.classList.add('rested');
  return panel;
}

function suitButton(suit, onclick) {
  const c = pixelCanvas(9, 9, 'uc-suit');
  drawSuit(c.getContext('2d'), 0, 0, suit);
  return h('button', { class: `px-btn uc-suit-btn suit-${suit}`, onclick, 'aria-label': R.SUIT_LABEL[suit] }, c, R.SUIT_LABEL[suit]);
}

function controlsPanel(state, ctx, { meIdx, myTurn, plays, jumps, myHand }) {
  const send = (a) => ctx.send(a);
  const current = state.players[state.turn];
  const me = meIdx >= 0 ? state.players[meIdx] : null;
  let title = '';
  let body = '';
  const buttons = [];
  const extra = [];

  if (state.phase === 'over') {
    const w = state.winner != null ? state.players[state.winner] : null;
    title = w ? `${w.name} venceu!` : 'Fim de jogo';
    body = state.opts.vitoria === 'pontos' ? `Placar: ${state.players.map((p) => `${p.name} ${p.score}`).join(' · ')}` : 'Ficou sem cartas.';
    if (me) buttons.push(btn('Jogar de novo', () => send({ type: 'restart' }), 'primary'));
  } else if (state.phase === 'round') {
    const w = state.players[state.roundResult.winner];
    title = `${w.name} bateu!`;
    body = `+${state.roundResult.points} pontos das mãos. Meta: ${R.TARGET}.`;
    if (me) buttons.push(btn('Próxima rodada', () => send({ type: 'next-round' }), 'primary'));
  } else if (myTurn && state.phase === 'color') {
    title = 'Escolha a cor';
    for (const s of R.SUITS) buttons.push(suitButton(s, () => send({ type: 'color', color: s })));
  } else if (myTurn && state.phase === 'swap') {
    title = 'Trocar de mão com quem?';
    state.players.forEach((p, i) => {
      if (i !== meIdx) buttons.push(btn(`${p.name} (${p.handCount ?? p.hand.length})`, () => send({ type: 'swap', target: i }), 'primary'));
    });
  } else if (myTurn && state.phase === 'challenge') {
    const by = state.players[state.wild?.by];
    const n = 4 + state.pending;
    title = `+4 em você!`;
    body = state.house.mais4Livre ? '' : `Desafie se achar que ${by?.name || 'ele'} tinha ${R.SUIT_LABEL[state.wild?.prevColor] || 'a cor da mesa'}.`;
    if (plays.length) body = `Empilhe outro +4 ou compre ${n}.`;
    buttons.push(btn(`Comprar ${n}`, () => send({ type: 'accept' }), 'primary'));
    if (!state.house.mais4Livre) buttons.push(btn('Desafiar', () => send({ type: 'challenge' })));
  } else if (myTurn) {
    if (state.pending > 0) {
      title = `Compre ${state.pending}`;
      body = plays.length ? 'Ou empilhe um +2 / +4.' : '';
      buttons.push(btn(`Comprar ${state.pending}`, () => send({ type: 'draw' }), 'primary' + (plays.length ? '' : ' blink')));
    } else if (state.drawn != null) {
      title = 'Jogar a carta comprada?';
      body = 'Toque nela ou passe a vez.';
      buttons.push(btn('Passar a vez', () => send({ type: 'pass' }), 'primary'));
    } else if (plays.length) {
      title = 'Sua vez';
      body = 'Toque numa carta destacada.';
      buttons.push(btn('Comprar', () => send({ type: 'draw' })));
    } else {
      title = 'Nenhuma carta serve';
      buttons.push(btn(state.house.compraAte ? 'Comprar até servir' : 'Comprar', () => send({ type: 'draw' }), 'primary blink'));
    }
  } else {
    title = `Vez de ${current.name}`;
    if (state.phase === 'color') body = 'Escolhendo a cor...';
    else if (state.phase === 'swap') body = 'Escolhendo com quem trocar de mão...';
    else if (state.phase === 'challenge') body = 'Aceita o +4 ou desafia?';
    else if (jumps.length) body = 'Corte! Você tem a carta igual: toque nela.';
  }

  // "Última!" e "Pegar" (qualquer um, a qualquer momento da janela).
  if (me && !['round', 'over'].includes(state.phase)) {
    const n = myHand.length;
    if (!me.called && (state.vulnerable === meIdx || (myTurn && n === 2 && state.phase === 'play'))) {
      extra.push(btn('Última!', () => send({ type: 'call' }), 'gold' + (state.vulnerable === meIdx ? ' blink' : '')));
    }
    if (state.vulnerable != null && state.vulnerable !== meIdx) {
      extra.push(btn(`Pegar ${state.players[state.vulnerable].name}!`, () => send({ type: 'catch', target: state.vulnerable }), 'danger blink'));
    }
  }

  const hand = me ? handRow(state, ctx, myHand, myTurn ? plays : jumps, myTurn) : null;
  const all = [...extra, ...buttons];
  const choices = myTurn && (state.phase === 'color' || state.phase === 'swap');
  return h('div', { class: 'pq-controls' }, h('div', { class: 'pq-ctl-inner uc-ctl' },
    hand,
    h('div', { class: 'pq-message' },
      h('strong', { class: 'pq-title' }, title),
      body ? h('p', {}, body) : null,
      all.length ? h('div', { class: 'pq-buttons' + (choices ? ' uc-choices' : '') }, all) : null)));
}

function handRow(state, ctx, hand, ok, myTurn) {
  const can = new Set(ok);
  // Mão em ordem: por naipe e valor (Coringas no fim).
  const order = (id) => {
    const c = R.CARDS[id];
    const suit = c.c ? R.SUITS.indexOf(c.c) : 4;
    const k = { n: c.v, pula: 10, volta: 11, mais2: 12, coringa: 13, mais4: 14 }[c.k];
    return suit * 20 + k;
  };
  const sorted = hand.slice().sort((a, b) => order(a) - order(b));
  return h('div', { class: 'uc-hand', role: 'group', 'aria-label': 'Suas cartas' },
    sorted.map((id) => {
      const c = pixelCanvas(CARD_W + 4, CARD_H + 4, 'uc-card');
      const playable = can.has(id);
      drawCard(c.getContext('2d'), 2, 2, id, {
        glow: playable ? (myTurn ? PAL.gold : PAL.cyan) : null,
        dim: myTurn && !playable && ['play', 'challenge'].includes(state.phase),
      });
      return h('button', {
        class: 'uc-card-btn' + (playable ? ' can' : ''),
        'aria-label': `${R.cardName(id)}${playable ? ', pode jogar' : ''}`,
        disabled: !playable,
        onclick: () => ctx.send(myTurn ? { type: 'play', id } : { type: 'jump', id }),
      }, c);
    }));
}

// ============================================================ mesa
class Board {
  constructor() {
    this.canvas = pixelCanvas(SIZE, SIZE, 'pq-board');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Mesa: monte e carta da vez');
    this.g = this.canvas.getContext('2d');
    this.state = null;
    this.seen = -1;
    this.drop = null;
    this.onDraw = null;
    this.running = false;
    this.canvas.addEventListener('pointerup', (e) => this.tap(e));
  }

  update(state, meIdx, onDraw) {
    if (state.seq < this.seen || this.seen < 0) this.seen = state.seq;
    if (state.seq > this.seen && state.last?.kind === 'play') {
      this.drop = { id: state.last.id, start: performance.now(), mine: state.last.pid === meIdx };
    }
    this.seen = state.seq;
    this.state = state;
    this.meIdx = meIdx;
    this.onDraw = onDraw;
    this.loop();
  }

  tap(e) {
    if (!this.onDraw) return;
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SIZE;
    const y = ((e.clientY - r.top) / r.height) * SIZE;
    if (x >= DECK_X - 6 && x <= DECK_X + CARD_W + 6 && y >= PILE_Y - 8 && y <= PILE_Y + CARD_H + 6) this.onDraw();
  }

  loop() {
    if (this.running) return;
    this.running = true;
    const frame = (t) => {
      if (!this.canvas.isConnected && this.attached) { this.running = false; this.attached = false; return; }
      if (this.canvas.isConnected) this.attached = true;
      this.draw(t);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  draw(t) {
    const g = this.g;
    const s = this.state;
    if (!s) return;
    g.drawImage(background(), 0, 0);
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    // Sentido do jogo: setas girando num círculo.
    const ramp = s.color ? SUIT_RAMP[s.color] : ['#c8c8e0', '#8a8aa8', '#4a4a66'];
    const spin = (t / 2600) * s.dir;
    for (let k = 0; k < 6; k++) {
      const a = spin + (k * Math.PI) / 3;
      arrow(g, cx + Math.cos(a) * 84, cy + Math.sin(a) * 84, a + (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2), ramp[0]);
    }

    // Anel da cor da vez em volta do descarte.
    const blink = Math.floor(t / 400) % 2 === 0;
    const rx = DISC_X + CARD_W / 2;
    const ry = PILE_Y + CARD_H / 2;
    for (let y = -35; y <= 35; y++) {
      for (let x = -35; x <= 35; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > 31 && d <= 35) { g.fillStyle = d > 33 ? ramp[2] : ramp[1]; g.fillRect(rx + x, ry + y, 1, 1); }
      }
    }
    if (s.color) {
      // Naipe da vez no alto do anel.
      g.fillStyle = PAL.ink; g.fillRect(rx - 7, ry - 42, 15, 15);
      g.fillStyle = ramp[1]; g.fillRect(rx - 6, ry - 41, 13, 13);
      drawSuit(g, rx - 4, ry - 39, s.color, PAL.white);
    }

    // Monte (verso, com espessura) e quantas cartas restam.
    const left = s.deckCount ?? s.deck.length;
    const depth = Math.min(5, Math.ceil(left / 18));
    for (let i = depth; i >= 0; i--) drawCard(g, DECK_X - i, PILE_Y + i, 0, { back: true, glow: i === 0 && this.onDraw && blink ? PAL.gold : null });
    const label = String(left);
    drawText(g, label, DECK_X + (CARD_W - textWidth(label)) / 2, PILE_Y + CARD_H + 10, PAL.white, PAL.ink);

    // Descarte: as últimas cartas, levemente fora de lugar.
    const pile = s.discard.slice(-4);
    pile.forEach((id, i) => {
      const top = i === pile.length - 1;
      let dx = ((id * 7) % 7) - 3;
      let dy = ((id * 13) % 7) - 3;
      if (top) { dx = 0; dy = 0; }
      if (top && this.drop && this.drop.id === id) {
        const k = (t - this.drop.start) / 240;
        if (k >= 1) this.drop = null;
        else { const e = (1 - k) ** 2; dy = Math.round(e * (this.drop.mine ? 70 : -70)); dx = Math.round(e * -20); }
      }
      drawCard(g, DISC_X + dx, PILE_Y + dy, id);
    });

    // Compra acumulada (empilhar) ou +4 aguardando.
    const owe = s.phase === 'challenge' ? 4 + s.pending : s.pending;
    if (owe > 0) {
      const txt = `+${owe}`;
      const w = textWidth(txt, 2) + 8;
      const bx = cx - w / 2;
      const by = PILE_Y + CARD_H + 18;
      g.fillStyle = PAL.ink; g.fillRect(bx - 1, by - 1, w + 2, 20);
      g.fillStyle = blink ? PAL.danger : '#b3203a'; g.fillRect(bx, by, w, 18);
      drawText(g, txt, bx + 4, by + 2, PAL.white, PAL.ink, 2);
    }
  }
}

const PILE_Y = SIZE / 2 - CARD_H / 2;
const DECK_X = SIZE / 2 - CARD_W - 26;
const DISC_X = SIZE / 2 + 8;

function arrow(g, x, y, ang, color) {
  // Seta pequena (chevron) apontando para `ang`.
  for (let i = -3; i <= 3; i++) {
    for (const back of [0, 1]) {
      const bx = x + Math.cos(ang) * (2 - Math.abs(i) - back) + Math.cos(ang + Math.PI / 2) * i;
      const by = y + Math.sin(ang) * (2 - Math.abs(i) - back) + Math.sin(ang + Math.PI / 2) * i;
      g.fillStyle = back ? PAL.ink : color;
      g.fillRect(Math.round(bx), Math.round(by), 1, 1);
    }
  }
}

let bg = null;
function background() {
  if (bg) return bg;
  bg = document.createElement('canvas');
  bg.width = SIZE;
  bg.height = SIZE;
  const g = bg.getContext('2d');
  g.fillStyle = PAL.ink;
  g.fillRect(0, 0, SIZE, SIZE);
  // Mesa redonda de feltro com borda de madeira.
  const c = SIZE / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > 99) continue;
      if (d > 91) g.fillStyle = d > 97 ? '#3a2414' : d < 93 ? '#8a6040' : ((y % 3) ? '#5a3a22' : '#6e4a2c');
      else g.fillStyle = (x + y) % 3 === 0 && (x * 7 + y) % 5 === 0 ? FELT_D : FELT;
      g.fillRect(x, y, 1, 1);
    }
  }
  return bg;
}
