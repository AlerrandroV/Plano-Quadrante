// Interface do Dominó (pixel art), na mesma "mesa" dos outros jogos.
// Sem modo de mesma tela: cada um vê só a própria mão.
import { h } from '../../ui/dom.js';
import { PAL, pixelCanvas, drawTile, TILE_W, TILE_L } from '../../ui/pixel.js';
import {
  tableLayout, fitTable, setTurnColor, playerPanel, spectatorPanel, btn, logBar,
} from '../../ui/table.js';
import { sfx } from '../../ui/sound.js';
import * as R from './rules.js';

const CELL = 12;
const M = 6;
const FELT = '#1d4a3a';
const FELT_D = '#163a2d';
const DEBUG = new URLSearchParams(location.search).has('debug');

const ui = { board: null, sel: null, key: '', last: null, snd: null };

export const RULES = {
  title: 'Dominó',
  items: [
    'Dominó duplo-seis (28 peças). Cada jogador recebe 7. Com 2 ou 3 jogadores, o resto fica no monte.',
    'Na primeira rodada começa quem tem a maior carroça (peça dobrada), jogando ela.',
    'Na sua vez, encaixe uma peça numa das pontas: o número tem que ser igual. Sem peça que encaixe, compre do monte; sem monte, passe.',
    'Batida: vence quem descartar todas as peças primeiro.',
    'Pontos: se as pontas somarem múltiplo de 5 depois da sua jogada, você marca essa soma (carroça na ponta conta dobrado). Quem bate ganha os pontos das mãos dos outros. Vence quem chegar a 100.',
    'Trancou (ninguém consegue jogar)? Vence quem tiver menos pontos na mão.',
  ],
};

// --------------------------------------------- trilho da fila de peças
// A primeira peça fica no centro; a fila cresce para a direita (descendo)
// e para a esquerda (subindo), virando nas bordas. Cada peça usa 2 casas.
// Mesa de 14x14 casas (peças maiores); se um lado passar de 24 peças, a
// mesa vira 18x18 (cabe qualquer partida).
function buildTracks(G) {
  const cr = G / 2;
  const center = [[G / 2 - 1, cr], [G / 2, cr]];
  const right = [];
  const left = [];
  const row = (list, r, from, to) => { const st = from <= to ? 1 : -1; for (let c = from; c !== to + st; c += st) list.push([c, r]); };
  // Direita: desce em zigue-zague.
  row(right, cr, G / 2 + 1, G - 1);
  for (let r = cr, toLeft = true; r + 2 <= G - 1; r += 2, toLeft = !toLeft) {
    const edge = toLeft ? G - 1 : 1;
    right.push([edge, r + 1], [edge, r + 2]);
    if (toLeft) row(right, r + 2, G - 2, 1); else row(right, r + 2, 2, G - 1);
  }
  // Esquerda: sobe em zigue-zague.
  row(left, cr, G / 2 - 2, 0);
  for (let r = cr, toRight = true; r - 2 >= 0; r -= 2, toRight = !toRight) {
    const edge = toRight ? 0 : G - 2;
    left.push([edge, r - 1], [edge, r - 2]);
    if (toRight) row(left, r - 2, 1, G - 2); else row(left, r - 2, G - 3, 0);
  }
  return { G, center, right, left, size: G * CELL + 2 * M };
}
const SMALL = buildTracks(14);
const LARGE = buildTracks(18);

function tracksFor(state) {
  const origin = state.left || 0;
  const rightN = state.line.length - origin - 1;
  const fits = (T) => (rightN + 1) * 2 <= T.right.length && (origin + 1) * 2 <= T.left.length;
  return fits(SMALL) ? SMALL : LARGE;
}

/** Casas de cada peça da fila: [{ t, cells: [[c,r] perto, [c,r] longe] }]. */
function layout(state, T) {
  const out = [];
  const origin = state.left || 0;
  state.line.forEach((t, i) => {
    if (i === origin) out.push({ t, cells: T.center, first: 'l' });
    else if (i > origin) {
      const k = i - origin - 1;
      out.push({ t, cells: [T.right[2 * k], T.right[2 * k + 1]], first: 'l' });
    } else {
      const k = origin - i - 1;
      out.push({ t, cells: [T.left[2 * k], T.left[2 * k + 1]], first: 'r' });
    }
  });
  return out;
}

/** Onde a próxima peça entraria em cada ponta. */
function nextCells(state, T) {
  const origin = state.left || 0;
  const rightN = state.line.length - origin - 1;
  return {
    R: [T.right[2 * rightN], T.right[2 * rightN + 1]],
    L: [T.left[2 * origin], T.left[2 * origin + 1]],
  };
}

// ================================================================ render
export function render(root, state, ctx) {
  ui.last = { root, state, ctx };
  if (DEBUG) window.__pq = { state, ctx, cellPx };
  const key = `${state.seq}:${state.turn}:${state.phase}:${state.round}`;
  if (key !== ui.key) { ui.key = key; ui.sel = null; }

  const meIdx = state.players.findIndex((p) => p.id === ctx.me);
  const current = state.players[state.turn];
  const myTurn = state.phase === 'play' && meIdx === state.turn;
  const myHand = meIdx >= 0 ? state.players[meIdx].hand : [];
  const plays = myTurn ? R.playsFor(state, myHand) : [];

  if (!ui.board) ui.board = new Board();
  const board = ui.board;
  const options = ui.sel != null ? plays.filter((p) => p.id === ui.sel) : [];
  board.update(state, options.length > 1 || (options.length === 1 && state.line.length) ? options.map((o) => o.end) : [],
    (end) => { if (ui.sel != null) play(ctx, ui.sel, end); });
  playSounds(state, ctx, meIdx);

  setTurnColor(current.color);
  const sideA = [];
  const sideB = [];
  state.players.forEach((p, i) => { if (i !== meIdx) sideA.push(dominoPanel(state, i)); });
  const controls = controlsPanel(state, ctx, { meIdx, myTurn, plays, myHand });
  sideB.push(meIdx >= 0 ? dominoPanel(state, meIdx, { controls, me: true }) : spectatorPanel(controls));

  const lay = tableLayout({ shared: false, sideA, sideB, center: board.canvas, log: logBar(state.log, RULES) });
  root.replaceChildren(lay);
  fitTable(lay, board.canvas, board.T.size, board);
}

function rerender() {
  if (ui.last?.root.isConnected) render(ui.last.root, ui.last.state, ui.last.ctx);
}

function play(ctx, id, end) {
  ui.sel = null;
  ctx.send({ type: 'play', id, end });
}

function onTileTap(ctx, state, plays, id) {
  const opts = plays.filter((p) => p.id === id);
  if (!opts.length) { sfx('error'); return; }
  // Encaixa num lado só (ou é a primeira peça): joga direto.
  if (opts.length === 1) return play(ctx, id, opts[0].end);
  ui.sel = ui.sel === id ? null : id;
  rerender();
}

// Efeitos sonoros quando algo NOVO acontece.
function playSounds(state, ctx, meIdx) {
  const snd = ui.snd || (ui.snd = { seq: state.seq, phase: state.phase, turn: state.turn, round: state.round, ready: false });
  if (!snd.ready || state.seq < snd.seq || state.round < snd.round) {
    Object.assign(snd, { seq: state.seq, phase: state.phase, turn: state.turn, round: state.round, ready: true });
    return;
  }
  if (state.seq > snd.seq && state.last) {
    const l = state.last;
    if (l.kind === 'play') { sfx('tile'); if (l.points) setTimeout(() => sfx('points'), 180); }
    else if (l.kind === 'draw') sfx('draw');
    else if (l.kind === 'pass') sfx('pass');
  }
  if (state.phase === 'play' && state.turn === meIdx && (snd.turn !== state.turn || snd.phase !== 'play')) {
    setTimeout(() => sfx('turn'), 250);
  }
  if (state.phase !== snd.phase && (state.phase === 'over' || state.phase === 'round')) {
    const w = state.phase === 'over' ? state.winner : state.roundResult?.winner;
    setTimeout(() => sfx(w != null && w === meIdx ? 'win' : w == null ? 'pass' : 'lose'), 450);
  }
  Object.assign(snd, { seq: state.seq, phase: state.phase, turn: state.turn, round: state.round });
}

// ================================================================ painéis
function dominoPanel(state, i, { controls = null, me = false } = {}) {
  const p = state.players[i];
  const tags = [];
  if (state.phase === 'over' && state.winner === i) tags.push({ text: 'VENCEU', kind: 'win' });
  else if (state.phase === 'round' && state.roundResult?.winner === i) tags.push({ text: 'BATEU', kind: 'win' });
  const stats = [{ icon: 'domino', label: 'Peças na mão', value: p.handCount ?? p.hand.length }];
  if (state.mode === 'pontos') stats.push({ icon: 'trofeu', label: `Pontos (meta ${state.target})`, value: p.score });
  return playerPanel({
    color: p.color, name: p.name, me, controls, tags, stats,
    turn: state.phase === 'play' && state.turn === i,
  });
}

function controlsPanel(state, ctx, { meIdx, myTurn, plays, myHand }) {
  const send = (a) => ctx.send(a);
  const current = state.players[state.turn];
  const stock = state.stockCount ?? state.stock.length;
  let title = '';
  let body = '';
  const buttons = [];

  if (state.phase === 'over') {
    const w = state.winner != null ? state.players[state.winner] : null;
    title = w ? `${w.name} venceu!` : 'Empate!';
    body = state.mode === 'pontos' ? `Placar: ${state.players.map((p) => `${p.name} ${p.score}`).join(' · ')}` : reasonText(state);
    if (meIdx >= 0) buttons.push(btn('Jogar de novo', () => send({ type: 'restart' }), 'primary'));
  } else if (state.phase === 'round') {
    const w = state.roundResult.winner != null ? state.players[state.roundResult.winner] : null;
    title = w ? `${w.name} ${state.roundResult.reason === 'batida' ? 'bateu' : 'venceu (trancou)'}!` : 'Trancou empatado';
    body = w && state.roundResult.bonus ? `+${state.roundResult.bonus} pontos das mãos.` : '';
    if (meIdx >= 0) buttons.push(btn('Próxima rodada', () => send({ type: 'next-round' }), 'primary'));
  } else if (myTurn) {
    if (plays.length) {
      const opts = ui.sel != null ? plays.filter((p) => p.id === ui.sel) : [];
      if (opts.length > 1) {
        title = 'Em qual ponta?';
        buttons.push(btn('< Esquerda', () => play(ctx, ui.sel, 'L'), 'primary'));
        buttons.push(btn('Direita >', () => play(ctx, ui.sel, 'R'), 'primary'));
      } else {
        title = 'Sua vez';
        body = state.mustPlay != null ? `Comece com a carroça ${R.tileName(state.mustPlay)}.` : 'Toque numa peça destacada.';
      }
    } else if (stock > 0) {
      title = 'Nenhuma peça encaixa';
      buttons.push(btn(`Comprar (${stock})`, () => send({ type: 'draw' }), 'primary blink'));
    } else {
      title = 'Nenhuma peça encaixa';
      buttons.push(btn('Passar a vez', () => send({ type: 'pass' }), 'primary'));
    }
  } else {
    title = `Vez de ${current.name}`;
    body = stock ? `Monte: ${stock} peças` : 'Monte vazio';
  }

  const hand = meIdx >= 0 ? handRow(state, ctx, myHand, plays, myTurn) : null;
  return h('div', { class: 'pq-controls' }, h('div', { class: 'pq-ctl-inner dom-ctl' },
    hand,
    h('div', { class: 'pq-message' },
      h('strong', { class: 'pq-title' }, title),
      body ? h('p', {}, body) : null,
      buttons.length ? h('div', { class: 'pq-buttons' }, buttons) : null)));
}

function reasonText(state) {
  const r = state.roundResult;
  if (!r) return '';
  return r.reason === 'batida' ? 'Bateu: descartou todas as peças.' : 'Trancou: menos pontos na mão.';
}

function handRow(state, ctx, hand, plays, myTurn) {
  const playable = new Set(plays.map((p) => p.id));
  return h('div', { class: 'dom-hand', role: 'group', 'aria-label': 'Suas peças' },
    hand.map((id) => {
      const { a, b } = R.TILES[id];
      const c = pixelCanvas(TILE_W + 2, TILE_L + 2, 'dom-tile');
      drawTile(c.getContext('2d'), 1, 1, true, a, b, {
        glow: ui.sel === id ? PAL.cyan : myTurn && playable.has(id) ? PAL.gold : null,
        dim: myTurn && !playable.has(id),
      });
      return h('button', {
        class: 'dom-tile-btn' + (playable.has(id) ? ' can' : '') + (ui.sel === id ? ' sel' : ''),
        'aria-label': `Peça ${a} e ${b}${playable.has(id) ? ', encaixa' : ''}`,
        disabled: !myTurn,
        onclick: () => onTileTap(ctx, state, plays, id),
      }, c);
    }));
}

// ============================================================ tabuleiro
function cellPx(c, r) {
  return [M + c * CELL + CELL / 2, M + r * CELL + CELL / 2, ui.board?.T.size];
}

class Board {
  constructor() {
    this.T = SMALL;
    this.canvas = pixelCanvas(SMALL.size, SMALL.size, 'pq-board');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Mesa do dominó');
    this.g = this.canvas.getContext('2d');
    this.state = null;
    this.ends = [];
    this.onEnd = null;
    this.drop = null;
    this.seen = -1;
    this.running = false;
    this.canvas.addEventListener('pointerup', (e) => this.tap(e));
  }

  update(state, ends, onEnd) {
    if (state.seq < this.seen || this.seen < 0) this.seen = state.seq;
    if (state.seq > this.seen && state.last?.kind === 'play') this.drop = { id: state.last.id, start: performance.now() };
    this.seen = state.seq;
    this.state = state;
    this.ends = ends;
    this.onEnd = onEnd;
    const T = tracksFor(state);
    if (T !== this.T) {
      this.T = T;
      this.canvas.width = T.size;
      this.canvas.height = T.size;
      this.g.imageSmoothingEnabled = false;
    }
    this.loop();
  }

  tap(e) {
    if (!this.ends.length || !this.onEnd) return;
    const r = this.canvas.getBoundingClientRect();
    const BW = this.T.size;
    const c = Math.floor((((e.clientX - r.left) / r.width) * BW - M) / CELL);
    const row = Math.floor((((e.clientY - r.top) / r.height) * BW - M) / CELL);
    const next = nextCells(this.state, this.T);
    for (const end of this.ends) {
      if (next[end].some((cell) => cell && cell[0] === c && cell[1] === row)) { this.onEnd(end); return; }
    }
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
    const T = this.T;
    const BW = T.size;
    const GRID = T.G;
    // Feltro verde com trama, moldura de madeira escura.
    g.fillStyle = PAL.ink;
    g.fillRect(0, 0, BW, BW);
    g.fillStyle = FELT;
    g.fillRect(M - 2, M - 2, GRID * CELL + 4, GRID * CELL + 4);
    g.fillStyle = FELT_D;
    for (let y = M; y < M + GRID * CELL; y += 4) for (let x = M + ((y / 4) % 2) * 2; x < M + GRID * CELL; x += 4) g.fillRect(x, y, 1, 1);

    if (!s.line.length) {
      g.fillStyle = '#2b6650';
      g.fillRect(M + T.center[0][0] * CELL, M + T.center[0][1] * CELL, CELL * 2, CELL);
    }

    const lastId = s.last?.kind === 'play' ? s.last.id : null;
    for (const item of layout(s, T)) {
      const [c1, c2] = item.cells;
      if (!c1 || !c2) continue;
      const near = item.first === 'l' ? item.t.l : item.t.r;
      const far = item.first === 'l' ? item.t.r : item.t.l;
      const horizontal = c1[1] === c2[1];
      const x = M + Math.min(c1[0], c2[0]) * CELL;
      const y = M + Math.min(c1[1], c2[1]) * CELL;
      // Ordem das faces na tela: a de cima/esquerda primeiro.
      const [a, b] = horizontal ? (c1[0] < c2[0] ? [near, far] : [far, near]) : (c1[1] < c2[1] ? [near, far] : [far, near]);
      let dy = 0;
      if (this.drop && this.drop.id === item.t.id) {
        const k = (t - this.drop.start) / 220;
        if (k >= 1) this.drop = null; else dy = -Math.round((1 - k) * 6);
      }
      drawTile(g, x, y + dy, !horizontal, a, b, { glow: item.t.id === lastId ? '#8c6a3a' : null });
    }

    // Pontas possíveis para a peça selecionada.
    const blink = Math.floor(t / 280) % 2 === 0;
    const next = nextCells(s, T);
    for (const end of this.ends) {
      g.fillStyle = blink ? PAL.gold : '#a0784a';
      for (const cell of next[end]) {
        if (!cell) continue;
        const x = M + cell[0] * CELL;
        const y = M + cell[1] * CELL;
        g.fillRect(x + 2, y + 2, CELL - 4, 1); g.fillRect(x + 2, y + CELL - 3, CELL - 4, 1);
        g.fillRect(x + 2, y + 2, 1, CELL - 4); g.fillRect(x + CELL - 3, y + 2, 1, CELL - 4);
      }
    }
  }
}
