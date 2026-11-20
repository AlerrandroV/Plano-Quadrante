// Interface do Poker (Texas Hold'em), na mesma "mesa" dos outros jogos.
// Cada um vê só as próprias cartas; no showdown, as de quem chegou até o fim.
import { h } from '../../ui/dom.js';
import { hiCanvas, PAL, pixelCanvas, drawText, textWidth } from '../../ui/pixel.js';
import { tableLayout, fitTable, setTurnColor, playerPanel, spectatorPanel, btn, logBar } from '../../ui/table.js';
import { sfx } from '../../ui/sound.js';
import { drawCard52, drawSlot, felt, CW, CH, RANK_LABEL } from '../../ui/cards52.js';
import * as R from './rules.js';

const SIZE = 200;
const DEBUG = new URLSearchParams(location.search).has('debug');
const ui = { board: null, last: null, snd: null, raising: false, raiseTo: 0, key: '' };

export const RULES = {
  title: 'Poker (Texas Hold\'em)',
  items: [
    'Cada um recebe 2 cartas fechadas; 5 cartas abertas vão para a mesa (flop: 3, turn: 1, river: 1). Vale a melhor mão de 5 entre as 7.',
    'O botão (D) gira a cada mão; os dois seguintes põem o small e o big blind. No mano a mano, o botão é o small blind.',
    'Na vez: Desistir, Passar (se ninguém apostou), Pagar, Apostar/Aumentar (no mínimo o último aumento) ou All-in.',
    'Mãos, da maior para a menor: Royal flush, Straight flush, Quadra, Full house, Flush, Sequência, Trinca, Dois pares, Par, Carta alta.',
    'All-in com menos fichas: você só disputa o que conseguiu cobrir (pote paralelo). Empate divide o pote.',
    'Quem fica sem fichas sai. Vence quem ficar com todas (ou quem tiver mais depois de 20 mãos, se escolhido).',
  ],
};

/** Tempo para os robôs: dá para ver o showdown antes da próxima mão. */
export function pace(state) {
  if (state.phase === 'showdown') return state.results?.uncontested != null ? 2600 : 4800;
  if (state.last?.kind === 'street') return 1100;
  return 900;
}

// ================================================================ render
export function render(root, state, ctx) {
  ui.last = { root, state, ctx };
  if (DEBUG) window.__pq = { state, ctx };
  const meIdx = state.players.findIndex((p) => p.id === ctx.me);
  const me = meIdx >= 0 ? state.players[meIdx] : null;
  const myTurn = state.phase === 'bet' && state.turn === meIdx;
  const key = `${state.hand}:${state.street}:${state.turn}:${state.seq}`;
  if (key !== ui.key) { ui.key = key; ui.raising = false; }

  if (!ui.board) ui.board = new Board();
  ui.board.update(state);
  playSounds(state, meIdx);

  setTurnColor(state.players[state.phase === 'bet' ? state.turn : Math.max(0, state.dealer)].color);
  const n = state.players.length;
  const start = meIdx >= 0 ? meIdx : 0;
  const others = state.players.map((_, i) => i).filter((i) => i !== meIdx)
    .sort((a, b) => ((a - start + n) % n) - ((b - start + n) % n));
  const sideA = others.map((i) => panel(state, i, { rested: others.length > 3 }));
  const controls = controlsPanel(state, ctx, meIdx, myTurn);
  const sideB = [me ? panel(state, meIdx, { controls, me: true }) : spectatorPanel(controls)];
  const lay = tableLayout({ shared: false, sideA, sideB, center: ui.board.canvas, log: logBar(state.log, RULES) });
  root.replaceChildren(lay);
  fitTable(lay, ui.board.canvas, SIZE, ui.board);
}

function rerender() {
  if (ui.last?.root.isConnected) render(ui.last.root, ui.last.state, ui.last.ctx);
}

function playSounds(state, meIdx) {
  const snd = ui.snd || (ui.snd = { seq: state.seq, ready: false });
  if (!snd.ready || state.seq < snd.seq) { Object.assign(snd, { seq: state.seq, ready: true, turn: state.turn, phase: state.phase }); return; }
  if (state.seq > snd.seq && state.last) {
    const k = state.last.kind;
    if (k === 'deal') sfx('card');
    else if (k === 'fold') sfx('pass');
    else if (k === 'check') sfx('click');
    else if (k === 'call') sfx('place');
    else if (k === 'raise') sfx('points');
    else if (k === 'street') sfx('card');
    else if (k === 'showdown' || k === 'win') {
      const won = state.results?.pots.some((p) => p.winners.includes(meIdx));
      setTimeout(() => sfx(won ? 'win' : 'lose'), 300);
    }
  }
  if (state.phase === 'bet' && state.turn === meIdx && (snd.turn !== state.turn || snd.phase !== 'bet' || state.last?.kind === 'street')) setTimeout(() => sfx('turn'), 250);
  Object.assign(snd, { seq: state.seq, turn: state.turn, phase: state.phase });
}

// ================================================================ painéis
function miniCards(state, i) {
  const p = state.players[i];
  if (!p.hole.length || p.out) return null;
  const wrap = h('span', { class: 'pk-hole' + (p.folded ? ' folded' : '') });
  for (const c of p.hole) {
    const cv = hiCanvas(CW, CH, 'pk-mini');
    drawCard52(cv.getContext('2d'), 0, 0, c, { back: c < 0 });
    wrap.append(cv);
  }
  return wrap;
}

function panel(state, i, { controls = null, me = false, rested = false } = {}) {
  const p = state.players[i];
  const tags = [];
  if (i === state.dealer && !p.out) tags.push({ text: 'D', kind: 'win' });
  if (p.out) tags.push({ text: 'FORA', kind: 'out' });
  else if (p.folded && state.phase !== 'over') tags.push({ text: 'DESISTIU', kind: 'out' });
  else if (p.allin) tags.push({ text: 'ALL-IN', kind: 'alert' });
  if (state.phase === 'showdown') {
    const won = state.results.pots.filter((pt) => pt.winners.includes(i)).reduce((t, pt) => t + Math.floor(pt.amount / pt.winners.length), 0);
    if (won) tags.push({ text: `+${won}`, kind: 'win' });
  }
  if (state.phase === 'over' && state.winner === i) tags.push({ text: 'VENCEU', kind: 'win' });
  const stats = [{ icon: 'fichas', label: 'Fichas', value: p.chips }];
  if (p.bet > 0) stats.push({ icon: 'aposta', label: 'Aposta nesta rodada', value: p.bet });
  const el = playerPanel({
    color: p.color, name: p.name, me, controls, tags, stats, out: p.out || (p.folded && state.phase === 'bet'),
    turn: state.phase === 'bet' && state.turn === i,
  });
  if (!me) {
    const cards = miniCards(state, i);
    if (cards) el.querySelector('.pq-panel-head').append(cards);
    const hand = state.phase === 'showdown' && state.results.hands?.[i];
    if (hand) el.querySelector('.pq-panel-head').append(h('span', { class: 'pk-handname' }, hand.name));
  }
  if (rested && !controls && !(state.phase === 'bet' && state.turn === i)) el.classList.add('rested');
  return el;
}

function myHandName(state, p) {
  if (!p.hole.length || p.hole[0] < 0) return '';
  if (state.board.length >= 3) return R.bestHand([...p.hole, ...state.board]).name;
  const [a, b] = p.hole.map((c) => (c % 13) + 1);
  if (a === b) return `Par de ${RANK_LABEL[a]}`;
  const suited = Math.floor(p.hole[0] / 13) === Math.floor(p.hole[1] / 13);
  return `${RANK_LABEL[a]} e ${RANK_LABEL[b]}${suited ? ', mesmo naipe' : ''}`;
}

function controlsPanel(state, ctx, meIdx, myTurn) {
  const send = (a) => { ui.raising = false; ctx.send(a); };
  const me = meIdx >= 0 ? state.players[meIdx] : null;
  let title = '';
  let body = '';
  const buttons = [];
  const [small, big] = R.BLINDS[Math.min(state.level, R.BLINDS.length - 1)];

  if (state.phase === 'over') {
    const w = state.players[state.winner];
    title = `${w.name} venceu!`;
    body = `Ficou com ${w.chips} fichas.`;
    if (me) buttons.push(btn('Jogar de novo', () => send({ type: 'restart' }), 'primary'));
  } else if (state.phase === 'showdown') {
    const r = state.results;
    const main = r.pots[0];
    const names = main.winners.map((i) => state.players[i].name).join(' e ');
    const total = r.pots.reduce((t, x) => t + x.amount, 0);
    title = r.uncontested != null ? `${names} leva ${total}` : `${names} ${main.winners.length > 1 ? 'dividem' : 'ganha'} ${main.amount}`;
    body = r.uncontested != null ? 'Todos desistiram.' : `${r.hands[main.winners[0]].name}${r.pots.length > 1 ? ` · ${r.pots.length - 1} pote(s) paralelo(s)` : ''}`;
    if (me && !me.out) buttons.push(btn('Próxima mão', () => send({ type: 'next' }), 'primary'));
    else if (me?.out) body += ' · Você está fora.';
  } else if (myTurn) {
    const lim = R.betLimits(state);
    const potNow = R.pot(state);
    if (ui.raising) {
      const clamp = (x) => Math.max(lim.minTo, Math.min(lim.maxTo, Math.round(x)));
      ui.raiseTo = clamp(ui.raiseTo || lim.minTo);
      const set = (x) => { ui.raiseTo = clamp(x); rerender(); };
      const allin = ui.raiseTo >= lim.maxTo;
      title = state.curBet ? `Aumentar para ${ui.raiseTo}` : `Apostar ${ui.raiseTo}`;
      body = `Mínimo ${lim.minTo} · você tem ${me.chips + me.bet}`;
      buttons.push(
        btn('-', () => set(ui.raiseTo - big), 'small'),
        btn('+', () => set(ui.raiseTo + big), 'small'),
        btn('Mín', () => set(lim.minTo), 'small'),
        btn('½ pote', () => set(state.curBet + potNow / 2), 'small'),
        btn('Pote', () => set(state.curBet + potNow), 'small'),
        btn('Tudo', () => set(lim.maxTo), 'small'),
        btn(allin ? `All-in ${ui.raiseTo}` : 'Confirmar', () => send(allin ? { type: 'allin' } : { type: 'raise', to: ui.raiseTo }), 'primary'),
        btn('Voltar', () => { ui.raising = false; rerender(); }),
      );
    } else {
      title = 'Sua vez';
      body = `Pote ${potNow}${lim.toCall ? ` · para pagar: ${lim.toCall}` : ''}`;
      buttons.push(btn('Desistir', () => send({ type: 'fold' })));
      buttons.push(lim.canCheck ? btn('Passar', () => send({ type: 'check' }), 'primary')
        : btn(lim.toCall >= me.chips ? `All-in ${lim.toCall}` : `Pagar ${lim.toCall}`, () => send({ type: 'call' }), 'primary'));
      if (lim.canRaise && lim.maxTo > lim.minTo) {
        buttons.push(btn(state.curBet ? 'Aumentar' : 'Apostar', () => { ui.raising = true; ui.raiseTo = lim.minTo; rerender(); }, 'gold'));
      } else if (lim.canRaise) {
        buttons.push(btn(`All-in ${lim.maxTo}`, () => send({ type: 'allin' }), 'gold'));
      }
    }
  } else {
    const cur = state.players[state.turn];
    title = `Vez de ${cur.name}`;
    body = `Pote ${R.pot(state)} · blinds ${small}/${big}`;
  }

  const hole = me && me.hole.length ? h('div', { class: 'pk-myhand' },
    h('div', { class: 'pk-mycards' }, me.hole.map((c) => {
      const cv = hiCanvas(CW + 4, CH + 4, 'pk-card');
      const best = state.phase === 'showdown' && state.results.hands?.[meIdx]?.best;
      drawCard52(cv.getContext('2d'), 2, 2, c, { back: c < 0, glow: best && best.includes(c) ? PAL.gold : null, dim: me.folded });
      return cv;
    })),
    h('span', { class: 'pk-handname mine' }, me.folded ? 'Desistiu' : myHandName(state, me))) : null;
  return h('div', { class: 'pq-controls' }, h('div', { class: 'pq-ctl-inner pk-ctl' + (ui.raising && myTurn ? ' raising' : '') },
    hole,
    h('div', { class: 'pq-message' },
      h('strong', { class: 'pq-title' }, title),
      body ? h('p', {}, body) : null,
      buttons.length ? h('div', { class: 'pq-buttons' }, buttons) : null)));
}

// ============================================================ mesa
const ROW_Y = SIZE / 2 - CH / 2 + 6;
const ROW_X = Math.round((SIZE - (5 * CW + 4 * 3)) / 2);

class Board {
  constructor() {
    this.canvas = hiCanvas(SIZE, SIZE, 'pq-board');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Mesa do poker');
    this.g = this.canvas.getContext('2d');
    this.state = null;
    this.shown = 0;
    this.dealt = [];
    this.running = false;
  }

  update(state) {
    // Cartas novas na mesa entram uma a uma (escorregando do alto).
    if (state.board.length < this.shown) this.shown = 0;
    const now = performance.now();
    for (let i = this.shown; i < state.board.length; i++) this.dealt[i] = now + (i - this.shown) * 140;
    this.shown = state.board.length;
    this.state = state;
    this.loop();
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
    // Pote: pilha de fichas e o valor.
    const total = R.pot(s);
    const label = String(total);
    const w = textWidth(label, 2) + 16;
    const px = Math.round(SIZE / 2 - w / 2);
    chips(g, px, 46, Math.min(7, 3 + Math.floor(total / 300)));
    drawText(g, label, px + 16, 44, PAL.gold, PAL.ink, 2);

    // Mesa: 5 lugares; cartas novas escorregam.
    const best = s.phase === 'showdown' && s.results?.pots?.[0] && s.results.hands?.[s.results.pots[0].winners[0]]?.best;
    for (let i = 0; i < 5; i++) {
      const x = ROW_X + i * (CW + 3);
      if (i >= s.board.length) { drawSlot(g, x, ROW_Y); continue; }
      let dy = 0;
      const k = (t - (this.dealt[i] || 0)) / 260;
      if (k < 0) continue;
      if (k < 1) dy = -Math.round((1 - k) ** 2 * 40);
      drawCard52(g, x, ROW_Y + dy, s.board[i], { glow: best && best.includes(s.board[i]) ? PAL.gold : null });
    }

    // Blinds embaixo: ficha pequena e grande.
    const [small, big] = R.BLINDS[Math.min(s.level, R.BLINDS.length - 1)];
    const txt = `${small}-${big}`;
    drawText(g, txt, Math.round(SIZE / 2 - textWidth(txt) / 2), ROW_Y + CH + 14, PAL.fog, PAL.ink);
  }
}

/** Pilha de fichas (pixel art). */
function chips(g, x, y, n) {
  const cols = [['#d8344f', '#ff8293'], ['#3b6fd9', '#73b7ff'], ['#f2b84b', '#fff3a0'], ['#38b764', '#a7f070'], ['#e4e8ee', '#ffffff'], ['#7e4fd6', '#c79bff']];
  for (let i = 0; i < n; i++) {
    const [b, l] = cols[i % cols.length];
    const yy = y + 8 - i * 2;
    g.fillStyle = PAL.ink; g.fillRect(x, yy - 1, 12, 5);
    g.fillStyle = b; g.fillRect(x + 1, yy, 10, 3);
    g.fillStyle = l; g.fillRect(x + 1, yy, 10, 1);
    g.fillStyle = PAL.white; g.fillRect(x + 3, yy + 1, 2, 1); g.fillRect(x + 7, yy + 1, 2, 1);
  }
}

let bg = null;
function background() {
  if (bg) return bg;
  bg = document.createElement('canvas');
  bg.width = SIZE;
  bg.height = SIZE;
  const g = bg.getContext('2d');
  g.fillStyle = PAL.ink; g.fillRect(0, 0, SIZE, SIZE);
  const tmp = document.createElement('canvas');
  tmp.width = SIZE; tmp.height = SIZE;
  felt(tmp.getContext('2d'), SIZE, SIZE, '#1f5a44', '#194a38');
  const feltG = tmp.getContext('2d');
  const data = feltG.getImageData(0, 0, SIZE, SIZE).data;
  // Mesa oval com borda acolchoada.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x + 0.5 - SIZE / 2) / 96;
      const dy = (y + 0.5 - SIZE / 2) / 80;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      if (d > 0.9) g.fillStyle = d > 0.97 ? '#2a160c' : d > 0.93 ? '#6e3a22' : '#8a4e2e';
      else {
        const k = (y * SIZE + x) * 4;
        g.fillStyle = `rgb(${data[k]},${data[k + 1]},${data[k + 2]})`;
        if (d > 0.87) g.fillStyle = '#163f30';
      }
      g.fillRect(x, y, 1, 1);
    }
  }
  return bg;
}
