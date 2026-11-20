// Interface do Pife (pixel art). Cada um vê só a própria mão, organizada
// numa caixa de 9 lugares e 3 caixas de 3 lugares (os jogos). O jogador
// arruma as cartas como quiser: toque numa carta e depois noutro lugar.
import { h } from '../../ui/dom.js';
import { hiCanvas, PAL, pixelCanvas, drawText, textWidth } from '../../ui/pixel.js';
import { tableLayout, fitTable, setTurnColor, playerPanel, spectatorPanel, btn, logBar } from '../../ui/table.js';
import { sfx } from '../../ui/sound.js';
import { drawCard52, drawSlot, felt, CW, CH, rankOf, suitOf } from '../../ui/cards52.js';
import * as R from './rules.js';

const SIZE = 200;
const DEBUG = new URLSearchParams(location.search).has('debug');
const MAIN = 9; // lugares da caixa de cima
const SLOTS = 18; // 9 + 3 caixas de 3

const ui = { board: null, last: null, snd: null, slots: null, key: null, sel: null };

export const RULES = {
  title: 'Pife',
  items: [
    'Dois baralhos (104 cartas). Cada jogador recebe 9.',
    'A VIRA: antes de distribuir, uma carta fica virada ao lado do monte. Ela define os MELÉS (curingas): o clone da vira e as cartas do valor seguinte da mesma cor. Ex.: vira 4 de Ouros -> melés: 4 de Ouros, 5 de Ouros e 5 de Copas (5 melés). Depois do Rei vem o Ás. Os melés aparecem com uma estrela.',
    'Na sua vez, compre 1 carta (do monte ou a de cima do descarte) e descarte 1. Quem pegou do descarte não pode descartar a mesma carta. Melé do descarte só pode ser pego se for a última carta que falta para bater.',
    'Bate quem formar 3 jogos de 3 cartas com as 9 e descartar a 10ª. Trinca: 3 do mesmo valor, de naipes diferentes. Sequência: 3 seguidas do mesmo naipe (A-2-3 e Q-K-A valem). O melé vale qualquer carta (um por jogo).',
    'Arrume as cartas: toque numa carta e depois noutro lugar (troca ou move). Monte os 3 jogos nas caixas de baixo e toque em "Bater".',
    'ARMADO (só falta uma carta)? Se a carta de cima do descarte fecha o seu jogo, toque em "Bater com..." na hora, mesmo fora da vez. Se outra carta já cobriu, é choque.',
    'Regras da casa (se ligadas): bater de naipe (as 9 do mesmo naipe, o melé vale qualquer naipe); mão sem par (bate de cara); choque (anunciou que bateu sem ter batido ou chegou atrasado: só bate com carta do monte); com coringa (os 4 coringas do baralho também valem qualquer carta).',
  ],
};

/** Ordem inicial: A, 2-10, J, Q, K; Ouros, Paus, Copas, Espadas (melé no fim). */
function order(id) {
  if (R.isJoker(id)) return 999;
  const c = R.code(id);
  return rankOf(c) * 10 + suitOf(c);
}

/** Mantém a arrumação do jogador em dia com a mão do estado. */
function syncSlots(state, hand) {
  const key = `${state.dealer}:${state.players.map((p) => p.id).join(',')}`;
  const fresh = !ui.slots || ui.key !== key || state.seq < (ui.seq ?? 0);
  ui.seq = state.seq;
  if (fresh) {
    ui.key = key;
    ui.sel = null;
    ui.slots = Array(SLOTS).fill(null);
    hand.slice().sort((a, b) => order(a) - order(b)).forEach((id, i) => { ui.slots[i] = id; });
  }
  const inHand = new Set(hand);
  ui.slots = ui.slots.map((id) => (id != null && inHand.has(id) ? id : null));
  const placed = new Set(ui.slots.filter((x) => x != null));
  for (const id of hand) {
    if (placed.has(id)) continue;
    // Carta nova: primeiro lugar livre da caixa de cima (senão, nas de baixo).
    let free = ui.slots.findIndex((x, i) => x == null && i < MAIN);
    if (free < 0) free = ui.slots.findIndex((x) => x == null);
    ui.slots[free] = id;
    ui.fresh = id;
  }
  if (ui.sel != null && ui.slots[ui.sel] == null) ui.sel = null;
}

const groupsOf = () => [0, 1, 2].map((b) => ui.slots.slice(MAIN + b * 3, MAIN + b * 3 + 3));

// ================================================================ render
export function render(root, state, ctx) {
  ui.last = { root, state, ctx };
  if (DEBUG) window.__pq = { state, ctx, slots: () => ui.slots };
  const meIdx = state.players.findIndex((p) => p.id === ctx.me);
  const me = meIdx >= 0 ? state.players[meIdx] : null;
  if (me) syncSlots(state, me.hand);
  const myTurn = meIdx === state.turn && state.phase !== 'over';

  if (!ui.board) ui.board = new Board();
  ui.board.update(state, meIdx, myTurn ? (where) => onBoardTap(state, ctx, where) : null);
  playSounds(state, meIdx);

  setTurnColor(state.players[state.turn].color);
  const n = state.players.length;
  const start = meIdx >= 0 ? meIdx : 0;
  const others = state.players.map((_, i) => i).filter((i) => i !== meIdx)
    .sort((a, b) => ((a - start + n) % n) - ((b - start + n) % n));
  const sideA = others.map((i) => panel(state, i, { rested: others.length > 3 }));
  const controls = controlsPanel(state, ctx, meIdx, myTurn);
  const sideB = [me ? panel(state, meIdx, { controls, me: true }) : spectatorPanel(controls)];
  const lay = tableLayout({ shared: false, sideA, sideB, center: ui.board.canvas, log: logBar(state.log, RULES) });
  root.replaceChildren(lay);
  // A mão (caixas) é o principal: a mesa fica pequena.
  fitTable(lay, ui.board.canvas, SIZE, ui.board, { mine: 330, mineW: 360 });
  requestAnimationFrame(() => fitBoxes(lay));
  // Refaz as caixas quando o painel muda de tamanho (girar o celular etc.).
  ui.ro?.disconnect();
  const inner = lay.querySelector('.pf-ctl');
  if (inner && window.ResizeObserver) { ui.ro = new ResizeObserver(() => fitBoxes(lay)); ui.ro.observe(inner); }
}

function rerender() {
  if (ui.last?.root.isConnected) render(ui.last.root, ui.last.state, ui.last.ctx);
}

function onBoardTap(state, ctx, where) {
  if (state.phase === 'draw') {
    if (where === 'deck') ctx.send({ type: 'draw', from: 'deck' });
    else if (where === 'discard' && state.discard.length) ctx.send({ type: 'draw', from: 'discard' });
  } else if (state.phase === 'discard' && where === 'discard' && ui.sel != null) {
    discardSelected(state, ctx);
  }
}

function discardSelected(state, ctx) {
  const id = ui.slots[ui.sel];
  if (id == null) return;
  if (id === state.took) { sfx('error'); return; }
  ui.sel = null;
  ctx.send({ type: 'discard', id });
}

function playSounds(state, meIdx) {
  const snd = ui.snd || (ui.snd = { seq: state.seq, ready: false });
  if (!snd.ready || state.seq < snd.seq) { Object.assign(snd, { seq: state.seq, ready: true, turn: state.turn }); return; }
  if (state.seq > snd.seq && state.last) {
    const k = state.last.kind;
    if (k === 'draw') sfx('draw');
    else if (k === 'discard') sfx('card');
    else if (k === 'choque' || k === 'nope' || k === 'blocked') sfx('error');
    else if (k === 'win') setTimeout(() => sfx(state.winner === meIdx ? 'win' : 'lose'), 300);
  }
  if (state.turn === meIdx && state.phase === 'draw' && snd.turn !== state.turn) setTimeout(() => sfx('turn'), 250);
  Object.assign(snd, { seq: state.seq, turn: state.turn });
}

// ================================================================ painéis
function panel(state, i, { controls = null, me = false, rested = false } = {}) {
  const p = state.players[i];
  const tags = [];
  if (state.phase === 'over' && state.winner === i) tags.push({ text: 'BATEU', kind: 'win' });
  if (p.choque) tags.push({ text: 'CHOQUE', kind: 'alert' });
  const el = playerPanel({
    color: p.color, name: p.name, me, controls, tags,
    stats: [{ icon: 'carta', label: 'Cartas na mão', value: p.handCount ?? p.hand.length }],
    turn: state.phase !== 'over' && state.turn === i,
  });
  if (rested && !controls && state.turn !== i) el.classList.add('rested');
  return el;
}

function controlsPanel(state, ctx, meIdx, myTurn) {
  const send = (a) => ctx.send(a);
  const me = meIdx >= 0 ? state.players[meIdx] : null;
  const current = state.players[state.turn];
  let title = '';
  let body = '';
  const buttons = [];

  if (state.phase === 'over') {
    const w = state.players[state.winner];
    title = `${w.name} bateu!`;
    body = { jogos: 'Fechou 3 jogos.', naipe: 'Todas do mesmo naipe.', semPar: 'Mão sem nenhum par.' }[state.result?.kind] || '';
    if (me) buttons.push(btn('Jogar de novo', () => send({ type: 'restart' }), 'primary'));
  } else if (myTurn && state.phase === 'draw') {
    title = 'Sua vez: compre';
    body = me.choque ? 'Você deu choque: só bate com carta do monte.' : meleText(state) || 'Toque no monte ou no descarte.';
    buttons.push(btn('Monte', () => send({ type: 'draw', from: 'deck' }), 'primary'));
    const top = state.discard[state.discard.length - 1];
    if (top != null) {
      const meleTop = R.wildFn(state)(top) && R.claimable(state, meIdx) == null;
      buttons.push(btn(meleTop ? 'Descarte (melé: só p/ bater)' : 'Descarte', () => send({ type: 'draw', from: 'discard' }), '', meleTop));
    }
    if (R.canNoPair(state, meIdx)) buttons.push(btn('Mão sem par!', () => send({ type: 'nopair' }), 'gold blink'));
  } else if (myTurn) {
    const groups = groupsOf();
    const full = groups.every((g) => g.every((x) => x != null));
    const sel = ui.sel != null ? ui.slots[ui.sel] : null;
    title = 'Descarte uma carta';
    body = full ? 'Jogos montados: toque em "Bater".' : 'Ou monte os 3 jogos nas caixas de baixo para bater.';
    buttons.push(btn(sel != null ? `Descartar ${shortName(sel)}` : 'Descartar', () => discardSelected(state, ctx), 'primary', sel == null || sel === state.took));
    if (full) {
      const discard = ui.slots.slice(0, MAIN).find((x) => x != null);
      buttons.push(btn('Bater!', () => { ui.sel = null; send({ type: 'bater', groups, discard }); }, 'gold blink'));
    }
  } else {
    title = `Vez de ${current.name}`;
    body = state.phase === 'draw' ? 'Comprando...' : 'Descartando...';
  }
  // Armado: a carta de cima do descarte fecha o jogo (vale fora da vez).
  const claim = me ? R.claimable(state, meIdx) : null;
  if (claim != null) {
    buttons.unshift(btn(`Bater com ${shortName(claim)}!`, () => { ui.sel = null; send({ type: 'claim', card: claim }); }, 'gold blink'));
    if (!myTurn) title = 'Você está armado!';
  }
  if (me && state.phase !== 'over') buttons.push(btn('Ordenar', () => sortMain(), 'small'));

  const boxes = me ? boxesView(state, ctx, myTurn) : null;
  return h('div', { class: 'pq-controls' }, h('div', { class: 'pq-ctl-inner pf-ctl' },
    boxes,
    h('div', { class: 'pq-message' },
      h('strong', { class: 'pq-title' }, title),
      body ? h('p', {}, body) : null,
      buttons.length ? h('div', { class: 'pq-buttons' }, buttons) : null)));
}

/** "Vira 4♦ · melés: 4♦ 5♦ 5♥" */
function meleText(state) {
  if (state.vira == null) return '';
  const names = [...R.meleCodes(state.vira)].map((c) => shortName(c));
  return `Vira ${shortName(state.vira)} · melés: ${names.join(' ')}`;
}

function shortName(id) {
  if (R.isJoker(id)) return 'coringa';
  const c = R.code(id);
  return `${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rankOf(c)]}${['♦', '♣', '♥', '♠'][suitOf(c)]}`;
}

/** Reorganiza a caixa de cima (A..K; Ouros, Paus, Copas, Espadas). */
function sortMain() {
  const top = ui.slots.slice(0, MAIN).filter((x) => x != null).sort((a, b) => order(a) - order(b));
  for (let i = 0; i < MAIN; i++) ui.slots[i] = top[i] ?? null;
  ui.sel = null;
  rerender();
}

function onSlotTap(i) {
  if (ui.sel == null) {
    if (ui.slots[i] == null) return;
    ui.sel = i;
    sfx('select');
  } else if (ui.sel === i) {
    ui.sel = null;
  } else {
    // Troca (ou move para o lugar vazio).
    [ui.slots[ui.sel], ui.slots[i]] = [ui.slots[i], ui.slots[ui.sel]];
    ui.sel = null;
    sfx('card');
  }
  rerender();
}

function slotButton(state, i, myTurn) {
  const id = ui.slots[i];
  const c = hiCanvas(CW + 4, CH + 4, 'pf-card');
  const g = c.getContext('2d');
  if (id == null) drawSlot(g, 2, 2);
  else {
    const glow = ui.sel === i ? PAL.cyan : id === ui.fresh && myTurn ? PAL.gold : null;
    drawCard52(g, 2, 2, R.code(id), { glow, dim: id === state.took && state.phase === 'discard' && myTurn });
    if (R.wildFn(state)(id)) star(g, CW - 6, CH / 2 - 3); // melé
  }
  return h('button', {
    class: 'pf-slot' + (ui.sel === i ? ' sel' : '') + (id == null ? ' empty' : ''),
    'aria-label': id == null ? 'Lugar vazio' : R.name(id),
    onclick: () => onSlotTap(i),
  }, c);
}

function boxesView(state, ctx, myTurn) {
  const main = h('div', { class: 'pf-box pf-main', role: 'group', 'aria-label': 'Suas cartas' },
    Array.from({ length: MAIN }, (_, i) => slotButton(state, i, myTurn)));
  const games = h('div', { class: 'pf-games' }, [0, 1, 2].map((b) => {
    const ids = ui.slots.slice(MAIN + b * 3, MAIN + b * 3 + 3);
    const full = ids.every((x) => x != null);
    const ok = full && R.isMeld(ids);
    return h('div', { class: 'pf-box pf-game' + (full ? (ok ? ' ok' : ' bad') : ''), role: 'group', 'aria-label': `Jogo ${b + 1}${full ? (ok ? ', fechado' : ', não fecha') : ''}` },
      [0, 1, 2].map((k) => slotButton(state, MAIN + b * 3 + k, myTurn)));
  }));
  return h('div', { class: 'pf-boxes' }, main, games);
}

/**
 * Escolhe o arranjo das caixas e o tamanho das cartas que cabem:
 * texto embaixo ou ao lado, caixas em linha ("largo") ou empilhadas ("alto").
 */
function fitBoxes(lay) {
  const boxes = lay.querySelector('.pf-boxes');
  if (!boxes) return;
  const inner = boxes.closest('.pq-ctl-inner');
  const msg = inner.querySelector('.pq-message');
  inner.classList.remove('pf-side', 'pf-terse');
  const part = (sel) => { const el = msg.querySelector(sel); return el ? el.offsetHeight + 4 : 0; };
  const titleH = part('.pq-title');
  const textH = part('p');
  const btnH = part('.pq-buttons');
  const W0 = inner.clientWidth - 4;
  const H0 = inner.clientHeight - 6;
  const ratio = (CH + 4) / (CW + 4);
  const gap = 3;
  const pad = 10; // borda + preenchimento de cada caixa
  const sizeFor = (W, H) => {
    const wide = Math.min((W - pad - 8 * gap) / 9, (W - 3 * pad - 12 - 6 * gap) / 9, (H - 2 * pad - 8) / 2 / ratio);
    const tall = Math.min((W - pad - 2 * gap) / 3, (H - 4 * pad - 18 - 3 * gap) / 6 / ratio);
    return tall > wide * 1.15 ? { w: tall, tall: true } : { w: wide, tall: false };
  };
  const options = [
    { cls: '', ...sizeFor(W0, H0 - titleH - textH - btnH - 8) },
    { cls: 'pf-terse', ...sizeFor(W0, H0 - titleH - btnH - 8) },
    { cls: 'pf-side', ...sizeFor(W0 - 190, H0) },
  ];
  // Prefere mostrar o texto; só esconde/move se as cartas ficarem pequenas.
  let best = options[0];
  for (const o of options.slice(1)) if (o.w > best.w * 1.2 && best.w < 40) best = o;
  if (best.cls) inner.classList.add(best.cls);
  const w = Math.max(16, Math.min(54, Math.floor(best.w)));
  boxes.classList.toggle('tall', best.tall);
  boxes.style.setProperty('--cw', `${w}px`);
}

// ============================================================ mesa
const DECK = { x: SIZE / 2 - CW - 6, y: SIZE / 2 - CH / 2 };
const DISC = { x: SIZE / 2 + 22, y: SIZE / 2 - CH / 2 };

class Board {
  constructor() {
    this.canvas = hiCanvas(SIZE, SIZE, 'pq-board');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Mesa: monte e descarte');
    this.g = this.canvas.getContext('2d');
    this.state = null;
    this.onTap = null;
    this.seen = -1;
    this.drop = null;
    this.running = false;
    this.canvas.addEventListener('pointerup', (e) => this.tap(e));
  }

  update(state, meIdx, onTap) {
    if (state.seq < this.seen || this.seen < 0) this.seen = state.seq;
    if (state.seq > this.seen && state.last?.kind === 'discard') this.drop = { start: performance.now(), mine: state.last.pid === meIdx };
    if (state.seq > this.seen && state.last?.kind === 'draw') this.pull = { start: performance.now(), from: state.last.from, mine: state.last.pid === meIdx };
    this.seen = state.seq;
    this.state = state;
    this.onTap = onTap;
    this.loop();
  }

  tap(e) {
    if (!this.onTap) return;
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SIZE;
    const y = ((e.clientY - r.top) / r.height) * SIZE;
    const hit = (p) => x >= p.x - 6 && x <= p.x + CW + 6 && y >= p.y - 8 && y <= p.y + CH + 8;
    if (hit(DECK)) this.onTap('deck');
    else if (hit(DISC)) this.onTap('discard');
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
    if (s.phase === 'over' && s.result) return this.drawWin(s);
    const blink = Math.floor(t / 400) % 2 === 0;
    const canDraw = this.onTap && s.phase === 'draw';

    // A vira: deitada embaixo do monte, com a estrela dos melés.
    if (s.vira != null) {
      g.save();
      g.translate(DECK.x - 4, DECK.y + CH / 2);
      g.rotate(Math.PI / 2);
      drawCard52(g, -CW / 2, -CH / 2, R.code(s.vira));
      g.restore();
      star(g, DECK.x - 30, DECK.y - 6);
    }
    // Monte.
    const left = s.deckCount ?? s.deck.length;
    const depth = Math.min(5, Math.ceil(left / 20));
    for (let i = depth; i >= 0; i--) drawCard52(g, DECK.x - i, DECK.y + i, 0, { back: true, glow: i === 0 && canDraw && blink ? PAL.gold : null });
    label(g, `MONTE ${left}`, DECK.x + CW / 2, DECK.y + CH + 10);

    // Descarte: algumas cartas por baixo, a de cima por último.
    const pile = s.discard.slice(-4);
    if (!pile.length) drawSlot(g, DISC.x, DISC.y);
    pile.forEach((id, i) => {
      const top = i === pile.length - 1;
      let dx = top ? 0 : ((id * 7) % 5) - 2;
      let dy = top ? 0 : ((id * 11) % 5) - 2;
      if (top && this.drop) {
        const k = (t - this.drop.start) / 240;
        if (k >= 1) this.drop = null;
        else { const e = (1 - k) ** 2; dy += Math.round(e * (this.drop.mine ? 70 : -70)); }
      }
      drawCard52(g, DISC.x + dx, DISC.y + dy, R.code(id), { glow: top && canDraw && blink ? PAL.gold : null });
    });
    label(g, `DESCARTE ${s.discardCount ?? s.discard.length}`, DISC.x + CW / 2, DISC.y + CH + 10);

    // Carta saindo (compra): verso voando para cima ou para baixo.
    if (this.pull) {
      const k = (t - this.pull.start) / 260;
      if (k >= 1) this.pull = null;
      else {
        const from = this.pull.from === 'discard' ? DISC : DECK;
        const dy = Math.round(k * k * (this.pull.mine ? 90 : -90));
        drawCard52(g, from.x, from.y + dy, 0, { back: true });
      }
    }
  }

  /** Fim: os 3 jogos de quem bateu, em 3 linhas. */
  drawWin(s) {
    const g = this.g;
    const groups = s.result.groups;
    const top = (SIZE - 3 * (CH + 4)) / 2;
    groups.forEach((grp, r) => grp.forEach((id, c) => {
      drawCard52(g, SIZE / 2 - (3 * (CW + 4)) / 2 + c * (CW + 4) + 2, top + r * (CH + 4), R.code(id));
    }));
  }
}

/** Estrelinha dourada (marca dos melés). */
function star(g, x, y) {
  g.fillStyle = PAL.ink; g.fillRect(x - 1, y + 1, 9, 5); g.fillRect(x + 2, y - 2, 3, 11);
  g.fillStyle = '#ffcd75'; g.fillRect(x, y + 2, 7, 3); g.fillRect(x + 3, y - 1, 1, 9); g.fillRect(x + 2, y + 1, 3, 5);
  g.fillStyle = '#fff6c8'; g.fillRect(x + 3, y + 2, 1, 1);
}

function label(g, text, cx, y) {
  // Fonte só tem números e A/J/Q/K: escreve o número e um tracinho.
  const num = text.replace(/[^0-9]/g, '');
  drawText(g, num, Math.round(cx - textWidth(num) / 2), y, PAL.white, PAL.ink);
}

let bg = null;
function background() {
  if (bg) return bg;
  bg = document.createElement('canvas');
  bg.width = SIZE;
  bg.height = SIZE;
  const g = bg.getContext('2d');
  g.fillStyle = PAL.ink; g.fillRect(0, 0, SIZE, SIZE);
  const c = SIZE / 2;
  const tmp = document.createElement('canvas');
  tmp.width = SIZE; tmp.height = SIZE;
  felt(tmp.getContext('2d'), SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > 99) continue;
      if (d > 91) { g.fillStyle = d > 97 ? '#3a2414' : d < 93 ? '#8a6040' : ((y % 3) ? '#5a3a22' : '#6e4a2c'); g.fillRect(x, y, 1, 1); }
    }
  }
  g.save();
  g.beginPath(); g.arc(c, c, 91, 0, Math.PI * 2); g.clip();
  g.drawImage(tmp, 0, 0);
  g.restore();
  return bg;
}
