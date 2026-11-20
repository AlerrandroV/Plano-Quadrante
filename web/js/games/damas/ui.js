// Interface de Damas: tabuleiro preto e branco em pixel art, mesma
// "mesa" dos outros jogos (ui/table.js).
import { h } from '../../ui/dom.js';
import { PAL, drawDisc, pixelCanvas, DISC_SIZE } from '../../ui/pixel.js';
import {
  tableLayout, fitTable, setTurnColor, playerPanel, spectatorPanel, btn, logBar,
} from '../../ui/table.js';
import * as D from './rules.js';
import { ask } from '../../ui/modal.js';
import { sfx } from '../../ui/sound.js';

const CELL = 36; // 2x: pedra de 28 px com 4 px de casa escura em volta
const M = 14; // tabuleiro de 316 px: 100% num celular comum
const BW = D.N * CELL + 2 * M;
const LIGHT = '#e8e8ee';
const DARK = '#25262f';
const SEG_MS = 190;
const DEBUG = new URLSearchParams(location.search).has('debug');

const ui = { board: null, sel: null, key: '', last: null };

export const RULES = {
  title: 'Damas (regras brasileiras)',
  items: [
    'Tabuleiro 8x8; joga-se só nas casas escuras. As brancas começam.',
    'A pedra anda uma casa na diagonal, para frente. Para capturar, salta por cima da peça adversária, para frente ou para trás.',
    'Captura é obrigatória. Se houver mais de um jeito, é obrigatório o que captura MAIS peças (lei da maioria).',
    'Numa captura em sequência, toque em cada casa onde a peça vai pousando.',
    'A pedra que TERMINA o lance na última fileira vira dama. A dama anda e captura em qualquer distância na diagonal.',
    'Perde quem fica sem peças ou sem lances. 20 lances seguidos de cada lado só com damas, sem captura, é empate.',
  ],
};

// ================================================================ render
export function render(root, state, ctx) {
  ui.last = { root, state, ctx };
  if (DEBUG) window.__pq = { state, ctx, cellCenter };
  const key = `${state.moveSeq}:${state.turn}:${state.phase}`;
  if (key !== ui.key) { ui.key = key; ui.sel = null; }

  const meIdx = state.players.findIndex((p) => p.id === ctx.me);
  const current = state.players[D.sideIndex(state, state.turn)];
  const myTurn = state.phase === 'play' && current.id === ctx.me;
  // Quem joga de pretas vê o tabuleiro girado (as próprias peças embaixo).
  const flip = !ctx.shared && meIdx >= 0 && state.players[meIdx].side === 'b';

  if (!ui.board) ui.board = new Board();
  const board = ui.board;
  const legal = myTurn ? D.legalMoves(state) : [];
  autoSelect(legal);
  board.update(state, flip, myTurn ? marksFor(state, legal) : [], (i) => onTap(state, ctx, legal, i));
  if (state.last) board.animate(state.last);
  playSounds(state, ctx);

  setTurnColor(current.color);
  const controls = controlsPanel(state, ctx, { myTurn, legal, meIdx });
  const panelOf = (i, extra = {}) => damasPanel(state, i, extra);
  const white = D.sideIndex(state, 'w');
  const black = D.sideIndex(state, 'b');

  let sideA;
  let sideB;
  if (ctx.shared) {
    // Os controles ficam no painel de quem está na vez; uma proposta de
    // empate aparece no painel de quem precisa responder.
    const cur = state.drawOffer != null ? 1 - state.drawOffer : D.sideIndex(state, state.turn);
    sideA = [panelOf(black, { flipped: true, controls: cur === black ? controls : null })];
    sideB = [panelOf(white, { controls: cur === white ? controls : null })];
  } else if (meIdx >= 0) {
    sideA = [panelOf(1 - meIdx)];
    sideB = [panelOf(meIdx, { controls, me: true })];
  } else {
    sideA = [panelOf(flip ? white : black)];
    sideB = [panelOf(flip ? black : white), spectatorPanel(controls)];
  }

  const layout = tableLayout({ shared: ctx.shared, sideA, sideB, center: board.canvas, log: logBar(state.log, RULES) });
  root.replaceChildren(layout);
  fitTable(layout, board.canvas, BW, board);
}

// Efeitos sonoros: tocam quando algo NOVO acontece no estado.
function playSounds(state, ctx) {
  const snd = ui.snd || (ui.snd = { seq: state.moveSeq, phase: state.phase, ready: false });
  if (!snd.ready || state.moveSeq < snd.seq) { Object.assign(snd, { seq: state.moveSeq, phase: state.phase, ready: true }); return; }
  if (state.moveSeq > snd.seq && state.last) {
    const l = state.last;
    const steps = l.path.length;
    // Um "toc" por pouso; captura no último salto; coroa se virou dama.
    for (let i = 0; i < steps; i++) setTimeout(() => sfx(l.captures.length ? 'capture' : 'move'), i * 190 + 120);
    const to = l.path[steps - 1];
    if (!l.king && state.board[to]?.k) setTimeout(() => sfx('king'), steps * 190 + 200);
    snd.seq = state.moveSeq;
  }
  if (state.phase !== snd.phase) {
    if (state.phase === 'over') {
      const me = state.players.findIndex((p) => p.id === ctx.me);
      const won = state.winner != null && (ctx.shared || state.winner === me);
      setTimeout(() => sfx(state.winner == null ? 'pass' : won ? 'win' : 'lose'), 600);
    }
    snd.phase = state.phase;
  }
}

function rerender() {
  if (ui.last?.root.isConnected) render(ui.last.root, ui.last.state, ui.last.ctx);
}

// Se só uma peça pode jogar e é captura, já deixa selecionada.
function autoSelect(legal) {
  if (ui.sel || !legal.length || !legal[0].captures.length) return;
  const froms = new Set(legal.map((m) => m.from));
  if (froms.size === 1) ui.sel = { from: legal[0].from, path: [] };
}

function candidates(legal) {
  if (!ui.sel) return [];
  const { from, path } = ui.sel;
  return legal.filter((m) => m.from === from && path.every((x, i) => m.path[i] === x));
}

function marksFor(state, legal) {
  const marks = [];
  if (ui.sel) {
    const cands = candidates(legal);
    const at = ui.sel.path.length ? ui.sel.path[ui.sel.path.length - 1] : ui.sel.from;
    marks.push({ i: at, kind: 'selected' });
    const next = new Set(cands.map((m) => m.path[ui.sel.path.length]).filter((x) => x != null));
    for (const i of next) marks.push({ i, kind: 'target' });
    // Peças que já serão capturadas no caminho escolhido.
    const n = ui.sel.path.length;
    if (cands[0]) for (const c of cands[0].captures.slice(0, n)) marks.push({ i: c, kind: 'capture' });
  } else {
    for (const f of new Set(legal.map((m) => m.from))) marks.push({ i: f, kind: 'movable' });
  }
  return marks;
}

function onTap(state, ctx, legal, i) {
  if (!legal.length) return;
  if (ui.sel) {
    const cands = candidates(legal);
    const step = ui.sel.path.length;
    if (cands.some((m) => m.path[step] === i)) {
      ui.sel = { from: ui.sel.from, path: [...ui.sel.path, i] };
      const done = candidates(legal).filter((m) => m.path.length === ui.sel.path.length);
      if (done.length) {
        const mv = done[0];
        ui.sel = null;
        return ctx.send({ type: 'move', from: mv.from, path: mv.path });
      }
      return rerender();
    }
  }
  const p = state.board[i];
  if (p && p.s === state.turn && legal.some((m) => m.from === i)) {
    ui.sel = { from: i, path: [] };
  } else {
    ui.sel = null;
  }
  rerender();
}

// ================================================================ painéis
function damasPanel(state, i, { controls = null, flipped = false, me = false } = {}) {
  const p = state.players[i];
  const mine = D.count(state, p.side);
  const theirs = D.count(state, p.side === 'w' ? 'b' : 'w');
  const tags = [{ text: p.side === 'w' ? 'BRANCAS' : 'PRETAS', kind: 'side' }];
  if (state.phase === 'over' && state.winner === i) tags.push({ text: 'VENCEU', kind: 'win' });
  return playerPanel({
    color: p.color, name: p.name, me, flipped, controls, tags,
    turn: state.phase === 'play' && state.turn === p.side,
    icon: discIcon(p.color),
    stats: [
      { icon: 'pedra', label: 'Pedras', value: mine.men },
      { icon: 'dama', label: 'Damas', value: mine.kings },
      { icon: 'cativeiro', label: 'Peças capturadas', value: 12 - theirs.total },
    ],
  });
}

function discIcon(color) {
  const c = pixelCanvas(DISC_SIZE, DISC_SIZE, 'pq-disc-icon');
  drawDisc(c.getContext('2d'), 0, 0, color);
  return c;
}

function controlsPanel(state, ctx, { myTurn, legal, meIdx }) {
  const send = (a) => ctx.send(a);
  const current = state.players[D.sideIndex(state, state.turn)];
  let title = '';
  let body = '';
  const buttons = [];
  const playing = meIdx >= 0;

  if (state.phase === 'over') {
    const w = state.winner != null ? state.players[state.winner] : null;
    title = w ? `${w.name} venceu!` : 'Empate!';
    body = `Fim: ${state.endReason}.`;
    if (playing || ctx.shared) buttons.push(btn('Jogar de novo', () => send({ type: 'restart' }), 'primary'));
  } else if (state.drawOffer != null && ctx.bots?.has(state.players[1 - state.drawOffer].id)) {
    title = 'Empate?';
    body = `${state.players[1 - state.drawOffer].name} está pensando…`;
  } else if (state.drawOffer != null && (ctx.shared || (playing && state.drawOffer !== meIdx))) {
    const who = state.players[state.drawOffer];
    // Na mesma tela, quem responde é o outro jogador (não quem está na vez).
    const as = state.players[1 - state.drawOffer].id;
    title = 'Empate?';
    body = `${who.name} propôs empate.`;
    buttons.push(btn('Aceitar', () => ctx.send({ type: 'answer-draw', accept: true }, as), 'primary'));
    buttons.push(btn('Recusar', () => ctx.send({ type: 'answer-draw', accept: false }, as)));
  } else if (myTurn) {
    const caps = legal[0]?.captures.length || 0;
    title = caps ? `Captura obrigatória! (${caps})` : 'Sua vez';
    body = ui.sel ? 'Toque na casa marcada.' : 'Toque numa peça com seta.';
    if (ui.sel && legal.some((m) => m.from !== ui.sel.from || ui.sel.path.length)) {
      buttons.push(btn('Cancelar', () => { ui.sel = null; rerender(); }));
    }
  } else {
    title = `Vez de ${current.name}`;
    body = state.drawOffer === meIdx ? 'Empate proposto. Aguardando resposta…'
      : current.side === 'w' ? 'Brancas jogando…' : 'Pretas jogando…';
  }

  if (state.phase === 'play' && playing && state.drawOffer == null) {
    buttons.push(btn('Empate', async () => { if (await ask('Propor empate?')) send({ type: 'offer-draw' }); }, 'small'));
    buttons.push(btn('Desistir', async () => { if (await ask('Desistir da partida?')) send({ type: 'resign' }); }, 'small'));
  }

  return h('div', { class: 'pq-controls' }, h('div', { class: 'pq-ctl-inner' },
    h('div', { class: 'pq-message' },
      h('strong', { class: 'pq-title' }, title),
      body ? h('p', {}, body) : null,
      buttons.length ? h('div', { class: 'pq-buttons' }, buttons) : null)));
}

// ============================================================ tabuleiro
function cellCenter(i, flip) {
  const { x, y } = cellXY(i, flip);
  return [x + CELL / 2, y + CELL / 2];
}
function cellXY(i, flip) {
  const r = D.rowOf(i);
  const c = D.colOf(i);
  const dr = flip ? r : D.N - 1 - r;
  const dc = flip ? D.N - 1 - c : c;
  return { x: M + dc * CELL, y: M + dr * CELL };
}

class Board {
  constructor() {
    this.canvas = pixelCanvas(BW, BW, 'pq-board');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Tabuleiro de damas 8 por 8');
    this.g = this.canvas.getContext('2d');
    this.state = null;
    this.flip = false;
    this.marks = [];
    this.onTap = null;
    this.anim = null;
    this.seen = -1;
    this.running = false;
    this.canvas.addEventListener('pointerup', (e) => this.tap(e));
  }

  update(state, flip, marks, onTap) {
    if (state.moveSeq < this.seen) this.seen = -1; // partida nova
    if (this.seen < 0) this.seen = state.last?.seq ?? 0;
    this.state = state;
    this.flip = flip;
    this.marks = marks;
    this.onTap = onTap;
    this.loop();
  }

  animate(last) {
    if (last.seq <= this.seen) return;
    this.seen = last.seq;
    this.anim = { ...last, start: performance.now() };
  }

  tap(e) {
    if (!this.onTap || this.anim) return;
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * BW;
    const y = ((e.clientY - r.top) / r.height) * BW;
    let dc = Math.floor((x - M) / CELL);
    let dr = Math.floor((y - M) / CELL);
    if (dc < 0 || dc >= D.N || dr < 0 || dr >= D.N) return;
    const row = this.flip ? dr : D.N - 1 - dr;
    const col = this.flip ? D.N - 1 - dc : dc;
    this.onTap(D.sq(row, col));
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

  /** Tabuleiro (casas e moldura) desenhado uma vez para cada orientação. */
  background() {
    const key = this.flip ? 'f' : 'n';
    this.bgs ||= {};
    if (this.bgs[key]) return this.bgs[key];
    const c = document.createElement('canvas');
    c.width = BW;
    c.height = BW;
    const g = c.getContext('2d');
    const span = D.N * CELL;
    g.fillStyle = PAL.ink;
    g.fillRect(0, 0, BW, BW);
    // Moldura com chanfro (luz em cima/esquerda, sombra embaixo/direita).
    g.fillStyle = '#4a5878'; g.fillRect(M - 8, M - 8, span + 16, span + 16);
    g.fillStyle = '#7d8fae'; g.fillRect(M - 8, M - 8, span + 16, 2); g.fillRect(M - 8, M - 8, 2, span + 16);
    g.fillStyle = '#2b3550'; g.fillRect(M - 8, M + span + 6, span + 16, 2); g.fillRect(M + span + 6, M - 8, 2, span + 16);
    g.fillStyle = PAL.ink; g.fillRect(M - 2, M - 2, span + 4, span + 4);
    for (let i = 0; i < D.N * D.N; i++) {
      const { x, y } = cellXY(i, this.flip);
      const dark = D.isDark(i);
      g.fillStyle = dark ? DARK : LIGHT;
      g.fillRect(x, y, CELL, CELL);
      // Textura: grão nas casas claras, trama diagonal nas escuras.
      g.fillStyle = dark ? '#2c2d38' : '#dcdce4';
      for (let yy = 0; yy < CELL; yy += 3) {
        for (let xx = (yy * 2) % 6; xx < CELL; xx += 6) g.fillRect(x + xx, y + yy, 1, 1);
      }
      // Relevo de cada casa.
      g.fillStyle = dark ? '#33343f' : '#f6f6fa';
      g.fillRect(x, y, CELL, 1); g.fillRect(x, y, 1, CELL);
      g.fillStyle = dark ? '#1c1d25' : '#c9c9d3';
      g.fillRect(x, y + CELL - 1, CELL, 1); g.fillRect(x + CELL - 1, y, 1, CELL);
    }
    this.bgs[key] = c;
    return c;
  }

  draw(t) {
    const g = this.g;
    const s = this.state;
    if (!s) return;
    g.drawImage(this.background(), 0, 0);

    const team = (side) => s.players[D.sideIndex(s, side)].color;
    let anim = this.anim;
    let k = 0;
    const steps = anim ? anim.path.length : 0;
    if (anim) {
      k = (t - anim.start) / (SEG_MS * steps);
      if (k >= 1.25) { this.anim = null; anim = null; }
    }

    // Último lance: cantinhos dourados discretos na origem e no destino.
    if (s.last && !anim) {
      for (const i of [s.last.from, s.last.path[s.last.path.length - 1]]) {
        const { x, y } = cellXY(i, this.flip);
        g.fillStyle = '#b08a4a';
        g.fillRect(x + 1, y + 1, 6, 2); g.fillRect(x + 1, y + 1, 2, 6);
        g.fillRect(x + CELL - 7, y + CELL - 3, 6, 2); g.fillRect(x + CELL - 3, y + CELL - 7, 2, 6);
      }
    }

    const dest = anim ? anim.path[anim.path.length - 1] : null;
    for (let i = 0; i < D.N * D.N; i++) {
      const p = s.board[i];
      if (!p || (anim && i === dest && k < 1)) continue;
      const { x, y } = cellXY(i, this.flip);
      drawDisc(g, x + 4, y + 4, team(p.s), { king: p.k });
    }

    if (anim && k < 1) {
      // Peças capturadas somem aos poucos, na ordem dos saltos.
      const victim = team(anim.side === 'w' ? 'b' : 'w');
      anim.captures.forEach((c, n) => {
        if (k * steps < n + 0.6) {
          const { x, y } = cellXY(c, this.flip);
          drawDisc(g, x + 4, y + 4, victim, { ghost: k * steps > n });
        }
      });
      // Peça saltando de casa em casa (sombra encolhe enquanto ela sobe).
      const seg = Math.min(steps - 1, Math.floor(k * steps));
      const f = k * steps - seg;
      const a = cellXY(seg === 0 ? anim.from : anim.path[seg - 1], this.flip);
      const b = cellXY(anim.path[seg], this.flip);
      const x = Math.round(a.x + (b.x - a.x) * f);
      const y = Math.round(a.y + (b.y - a.y) * f);
      const lift = Math.round(Math.sin(Math.PI * f) * 12);
      const sw = 22 - Math.round(lift / 2);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(x + 18 - sw / 2, y + 28, sw, 4);
      drawDisc(g, x + 4, y + 4 - lift, team(anim.side), { king: anim.king });
    }

    if (!anim) {
      const blink = Math.floor(t / 280) % 2 === 0;
      for (const m of this.marks) this.mark(m, t, blink);
    }
  }

  mark(m, t, blink) {
    const g = this.g;
    const { x, y } = cellXY(m.i, this.flip);
    if (m.kind === 'movable') {
      // Setinha balançando em cima das pedras que podem jogar.
      const bob = Math.floor(t / 200) % 2 ? 2 : 0;
      const cx = x + CELL / 2;
      const top = y - 5 + bob;
      for (let i = 0; i < 6; i++) { g.fillStyle = PAL.ink; g.fillRect(cx - 6 + i, top + i, 12 - 2 * i, 1); }
      for (let i = 0; i < 5; i++) { g.fillStyle = i === 0 ? '#c8fbff' : PAL.cyan; g.fillRect(cx - 5 + i, top + i, 10 - 2 * i, 1); }
      return;
    }
    const strong = { target: PAL.gold, capture: PAL.danger, selected: PAL.cyan }[m.kind];
    const soft = { target: '#a0784a', capture: '#8a2236', selected: PAL.cyan }[m.kind];
    const L = 10;
    const e = CELL - 2;
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x0 = x + sx * e;
      const y0 = y + sy * e;
      g.fillStyle = blink ? strong : soft;
      g.fillRect(sx ? x0 - L + 2 : x0, y0, L, 2);
      g.fillRect(x0, sy ? y0 - L + 2 : y0, 2, L);
    }
    if (m.kind === 'target' && !this.state.board[m.i]) {
      g.fillStyle = blink ? strong : soft;
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;
      for (let k = -4; k <= 4; k++) g.fillRect(cx - (4 - Math.abs(k)), cy + k, 2 * (4 - Math.abs(k)) + 1, 1);
    }
  }
}
