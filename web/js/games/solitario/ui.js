// Interface do Solitário (Klondike) em pixel art. Toque numa carta: ela vai
// sozinha para onde dá (fundação primeiro); se houver mais de um lugar, ela
// fica marcada e você toca no destino.
import { h } from '../../ui/dom.js';
import { hiCanvas, PAL, pixelCanvas, drawText, textWidth } from '../../ui/pixel.js';
import { tableLayout, fitTable, setTurnColor, playerPanel, btn, logBar } from '../../ui/table.js';
import { sfx } from '../../ui/sound.js';
import { ask } from '../../ui/modal.js';
import { drawCard52, drawSlot, drawSuit4, felt, CW, CH } from '../../ui/cards52.js';
import * as R from './rules.js';

const SIZE = 252;
const HGT = 315; // mesa mais alta que larga: as colunas cabem com folga
const STEP = 36;
const X0 = Math.round((SIZE - (7 * CW + 6 * (STEP - CW))) / 2);
const TOP = 4;
const TAB_Y = TOP + CH + 8;
const DEBUG = new URLSearchParams(location.search).has('debug');
const ui = { board: null, last: null, sel: null, snd: null };

export const RULES = {
  title: 'Solitário (Paciência)',
  items: [
    'Leve as 52 cartas para as 4 fundações (em cima, à direita), cada uma de um naipe, do Ás ao Rei.',
    'Nas 7 colunas, ponha uma carta sobre outra de cor diferente e valor 1 acima (ex.: 6 vermelho sobre 7 preto). Dá para mover uma sequência aberta inteira. Coluna vazia só recebe Rei.',
    'Toque no monte para tirar cartas: 1 no Fácil, 2 no Médio, 3 no Difícil. Só a de cima do descarte pode ser jogada. Acabou o monte: toque de novo e o descarte volta.',
    'Toque numa carta e ela vai sozinha para onde couber (fundação primeiro). Se couber em mais de um lugar, toque no destino.',
    '"Desfazer" volta a última jogada; "Recolher" leva para as fundações tudo o que já pode ir.',
  ],
};

const colX = (i) => X0 + i * STEP;

/** Onde cada carta aparece: [{ x, y, code, up, ref }] na ordem de desenho. */
function layout(s) {
  const items = [];
  const stockN = s.stockCount ?? s.stock.length;
  if (stockN) items.push({ x: colX(0), y: TOP, code: -1, up: false, ref: { t: 'stock' } });
  const shown = s.waste.slice(-s.drawN);
  shown.forEach((c, k) => items.push({ x: colX(1) + k * 9, y: TOP, code: c, up: true, ref: k === shown.length - 1 ? { t: 'waste' } : null }));
  s.found.forEach((f, i) => {
    if (f.length > 1) items.push({ x: colX(3 + i), y: TOP, code: f[f.length - 2], up: true, ref: null });
    if (f.length) items.push({ x: colX(3 + i), y: TOP, code: f[f.length - 1], up: true, ref: { t: 'found', i } });
  });
  s.tab.forEach((col, i) => {
    const downs = col.filter((x) => !x.up).length;
    const ups = col.length - downs;
    const need = downs * 6 + Math.max(0, ups - 1) * 16;
    const avail = HGT - 3 - TAB_Y - CH;
    const f = need > avail ? avail / need : 1;
    let y = TAB_Y;
    col.forEach((x, k) => {
      items.push({ x: colX(i), y: Math.round(y), code: x.up ? x.c : -1, up: x.up, ref: x.up ? { t: 'tab', i, k } : null });
      y += (x.up ? 16 : 6) * f;
    });
  });
  return items;
}

// ================================================================ render
export function render(root, state, ctx) {
  ui.last = { root, state, ctx };
  if (DEBUG) window.__pq = { state, ctx, layout: () => layout(state), SIZE, HGT };
  if (!ui.board) ui.board = new Board();
  const mine = state.players[0].id === ctx.me; // quem assiste não mexe
  if (!mine || (ui.sel && !R.pick(state, ui.sel))) ui.sel = null;
  ui.board.update(state, ui.sel ? R.destinations(state, ui.sel) : [], mine ? (hit) => onTap(state, ctx, hit) : null);
  playSounds(state);
  const p = state.players[0];
  setTurnColor(p.color);
  const n = state.found.reduce((t, f) => t + f.length, 0);
  const controls = mine ? controlsPanel(state, ctx) : watchPanel(state);
  const panel = playerPanel({
    color: p.color, name: p.name, me: mine, controls,
    turn: state.phase === 'play',
    tags: state.phase === 'over' && state.won ? [{ text: 'VENCEU', kind: 'win' }] : [],
    stats: [{ icon: 'trofeu', label: 'Cartas nas fundações', value: `${n}/52` }, { icon: 'board', label: 'Jogadas', value: state.moves }],
  });
  const lay = tableLayout({ shared: false, sideA: [], sideB: [panel], center: ui.board.canvas, log: logBar([`${{ facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' }[state.opts.nivel]}: tira ${state.drawN} por vez.`], RULES) });
  lay.classList.add('one-side');
  root.replaceChildren(lay);
  fitTable(lay, ui.board.canvas, SIZE, ui.board, { sides: 1, aspect: HGT / SIZE, mine: 120, mineW: 220 });
}

function rerender() {
  if (ui.last?.root.isConnected) render(ui.last.root, ui.last.state, ui.last.ctx);
}

function move(ctx, from, to) {
  ui.sel = null;
  ctx.send({ type: 'move', from, to });
}

function onTap(state, ctx, hit) {
  if (state.phase !== 'play') return;
  if (hit?.t === 'stock') { ui.sel = null; ctx.send({ type: 'draw' }); return; }
  // Com uma carta marcada: tocou num destino possível?
  if (ui.sel && hit) {
    const dests = R.destinations(state, ui.sel);
    const want = hit.t === 'tab' || hit.t === 'col' ? { t: 'tab', i: hit.i } : hit.t === 'found' || hit.t === 'foundSlot' ? { t: 'found' } : null;
    const ok = want && dests.find((d) => d.t === want.t && (d.t === 'found' || d.i === want.i));
    if (ok) { move(ctx, ui.sel, ok); return; }
  }
  if (!hit || hit.t === 'col' || hit.t === 'foundSlot') { ui.sel = null; rerender(); return; }
  const from = hit;
  const dests = R.destinations(state, from);
  if (!dests.length) { ui.sel = null; sfx('error'); ui.board.shake(from); rerender(); return; }
  const found = dests.find((d) => d.t === 'found');
  if (found) return move(ctx, from, found);
  if (dests.length === 1) return move(ctx, from, dests[0]);
  // Mais de um lugar: marca e espera o destino.
  ui.sel = from;
  sfx('select');
  rerender();
}

function playSounds(state) {
  const snd = ui.snd || (ui.snd = { seq: state.seq, ready: false });
  if (!snd.ready || state.seq < snd.seq) { Object.assign(snd, { seq: state.seq, ready: true }); return; }
  if (state.seq > snd.seq && state.last) {
    const k = state.last.kind;
    if (k === 'draw' || k === 'recycle') sfx('draw');
    else if (k === 'move') sfx(state.last.to === 'found' ? 'place' : 'card');
    else if (k === 'collect') sfx('points');
    else if (k === 'undo') sfx('pass');
    else if (k === 'win') setTimeout(() => sfx('win'), 200);
  }
  snd.seq = state.seq;
}

/** Quem assiste: só acompanha. */
function watchPanel(state) {
  const p = state.players[0];
  const title = state.phase === 'over' ? (state.won ? `${p.name} venceu!` : `${p.name} desistiu.`) : `${p.name} está jogando`;
  return h('div', { class: 'pq-controls' }, h('div', { class: 'pq-ctl-inner so-ctl' },
    h('div', { class: 'pq-message' }, h('strong', { class: 'pq-title' }, title), h('p', {}, 'Você está assistindo.'))));
}

function controlsPanel(state, ctx) {
  const send = (a) => { ui.sel = null; ctx.send(a); };
  let title = '';
  let body = '';
  const buttons = [];
  if (state.phase === 'over') {
    title = state.won ? 'Você venceu!' : 'Fim de jogo';
    body = state.won ? `Em ${state.moves} jogadas.` : 'Desistiu desta partida.';
    buttons.push(btn('Jogar de novo', () => send({ type: 'restart' }), 'primary'));
  } else {
    const done = R.solvable(state);
    title = done ? 'Tudo aberto!' : ui.sel ? 'Para onde?' : 'Sua vez';
    body = done ? 'Toque em "Recolher" para terminar.' : ui.sel ? 'Toque na coluna de destino.' : 'Toque numa carta para movê-la, ou no monte.';
    const hist = state.histCount ?? state.hist.length;
    buttons.push(btn('Desfazer', () => send({ type: 'undo' }), '', !hist));
    if (R.canCollect(state)) buttons.push(btn('Recolher', () => send({ type: 'collect' }), done ? 'gold blink' : 'primary'));
    buttons.push(btn('Novo jogo', async () => {
      if (state.moves === 0 || await ask('Começar outra partida? Esta será perdida.', { yes: 'Novo jogo', no: 'Continuar' })) send({ type: 'restart' });
    }));
  }
  return h('div', { class: 'pq-controls' }, h('div', { class: 'pq-ctl-inner so-ctl' },
    h('div', { class: 'pq-message' },
      h('strong', { class: 'pq-title' }, title),
      body ? h('p', {}, body) : null,
      h('div', { class: 'pq-buttons' }, buttons))));
}

// ============================================================ mesa
class Board {
  constructor() {
    this.canvas = hiCanvas(SIZE, HGT, 'pq-board');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Mesa do solitário');
    this.g = this.canvas.getContext('2d');
    this.state = null;
    this.items = [];
    this.pos = new Map(); // carta -> última posição (para animar)
    this.anim = new Map();
    this.targets = [];
    this.onTap = null;
    this.running = false;
    this.shaking = null;
    this.canvas.addEventListener('pointerup', (e) => this.tap(e));
  }

  update(state, targets, onTap) {
    const now = performance.now();
    const fresh = !this.state || state.seq < this.state.seq;
    this.items = layout(state);
    for (const it of this.items) {
      if (it.code < 0) continue;
      const old = this.pos.get(it.code);
      if (!fresh && old && (old.x !== it.x || old.y !== it.y)) this.anim.set(it.code, { x: old.x, y: old.y, start: now });
      this.pos.set(it.code, { x: it.x, y: it.y });
    }
    if (state.phase === 'over' && state.won && (!this.state || this.state.phase !== 'over')) this.confetti = { start: now, bits: makeConfetti() };
    if (state.phase !== 'over') this.confetti = null;
    this.state = state;
    this.targets = targets;
    this.onTap = onTap;
    this.loop();
  }

  shake(ref) { this.shaking = { ref, start: performance.now() }; }

  tap(e) {
    if (!this.onTap) return;
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SIZE;
    const y = ((e.clientY - r.top) / r.height) * HGT;
    // Carta de cima primeiro (ordem inversa de desenho).
    for (let k = this.items.length - 1; k >= 0; k--) {
      const it = this.items[k];
      if (x >= it.x && x < it.x + CW && y >= it.y && y < it.y + CH) {
        if (it.ref) return this.onTap(it.ref);
        // Carta fechada ou "decorativa": conta como a coluna/fundação.
        break;
      }
    }
    if (y >= TAB_Y - 4) {
      const i = Math.floor((x - X0 + (STEP - CW) / 2) / STEP);
      if (i >= 0 && i < 7) return this.onTap({ t: 'col', i });
    } else if (y >= TOP && y < TOP + CH) {
      const i = Math.floor((x - X0 + (STEP - CW) / 2) / STEP);
      if (i === 0) return this.onTap({ t: 'stock' });
      if (i >= 3 && i <= 6) return this.onTap({ t: 'foundSlot', i: i - 3 });
    }
    return this.onTap(null);
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
    // Lugares vazios: monte (com o símbolo de voltar), fundações (naipe) e colunas.
    drawSlot(g, colX(0), TOP);
    if (!(s.stockCount ?? s.stock.length) && s.waste.length) recycleMark(g, colX(0) + CW / 2, TOP + CH / 2);
    for (let i = 0; i < 4; i++) { drawSlot(g, colX(3 + i), TOP); drawSuit4(g, colX(3 + i) + 12, TOP + 19, i, 'rgba(255,255,255,.22)'); }
    for (let i = 0; i < 7; i++) drawSlot(g, colX(i), TAB_Y, 'rgba(255,255,255,.18)');
    const blink = Math.floor(t / 300) % 2 === 0;
    const sel = ui.sel;
    const isSel = (ref) => sel && ref && ref.t === sel.t && ref.i === sel.i && (sel.t !== 'tab' || ref.k >= sel.k);
    // Destinos possíveis piscam.
    const targetCols = new Set(this.targets.filter((d) => d.t === 'tab').map((d) => d.i));
    const late = [];
    for (const it of this.items) {
      const a = it.code >= 0 && this.anim.get(it.code);
      if (a) { late.push(it); continue; }
      this.card(g, it, t, isSel(it.ref), false);
    }
    for (const it of late) this.card(g, it, t, isSel(it.ref), true);
    if (blink) {
      for (const i of targetCols) {
        const col = s.tab[i];
        const last = this.items.filter((it) => it.ref?.t === 'tab' && it.ref.i === i).pop();
        const y = col.length ? (last ? last.y : TAB_Y) : TAB_Y;
        outline(g, colX(i), y, PAL.gold);
      }
      if (this.targets.some((d) => d.t === 'found')) {
        const c = R.pick(s, sel)?.[0];
        if (c != null) outline(g, colX(3 + Math.floor(c / 13)), TOP, PAL.gold);
      }
    }
    if (this.confetti) drawConfetti(g, this.confetti, t);
    // Contador do monte.
    const n = s.stockCount ?? s.stock.length;
    if (n) { const txt = String(n); drawText(g, txt, colX(0) + CW - textWidth(txt) - 2, TOP + CH - 9, PAL.white, PAL.ink); }
  }

  card(g, it, t, selected, animated) {
    let { x, y } = it;
    if (animated) {
      const a = this.anim.get(it.code);
      const k = Math.min(1, (t - a.start) / 170);
      const e = 1 - (1 - k) ** 3;
      x = Math.round(a.x + (it.x - a.x) * e);
      y = Math.round(a.y + (it.y - a.y) * e);
      if (k >= 1) this.anim.delete(it.code);
    }
    if (this.shaking && it.ref && this.shaking.ref.t === it.ref.t && this.shaking.ref.i === it.ref.i && (it.ref.t !== 'tab' || it.ref.k >= this.shaking.ref.k)) {
      const k = (t - this.shaking.start) / 300;
      if (k >= 1) this.shaking = null; else x += Math.round(Math.sin(k * 25) * 3 * (1 - k));
    }
    drawCard52(g, x, y, it.code, { back: it.code < 0, glow: selected ? PAL.cyan : null });
  }
}

function outline(g, x, y, color) {
  g.fillStyle = color;
  g.fillRect(x - 2, y - 2, CW + 4, 2); g.fillRect(x - 2, y + CH, CW + 4, 2);
  g.fillRect(x - 2, y, 2, CH); g.fillRect(x + CW, y, 2, CH);
}

function recycleMark(g, cx, cy) {
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let a = 0; a < 300; a += 12) {
    const r = (a * Math.PI) / 180;
    g.fillRect(Math.round(cx + Math.cos(r) * 8), Math.round(cy + Math.sin(r) * 8), 2, 2);
  }
  g.fillRect(cx + 6, cy - 6, 4, 2); g.fillRect(cx + 8, cy - 8, 2, 4);
}

function makeConfetti() {
  const cols = ['#d8344f', '#f2b84b', '#38b764', '#3b6fd9', '#e85cb0', '#73eff7'];
  return Array.from({ length: 70 }, () => ({ x: Math.random() * SIZE, y: -Math.random() * SIZE, v: 30 + Math.random() * 50, c: cols[Math.floor(Math.random() * cols.length)], w: Math.random() * 6 }));
}

function drawConfetti(g, cf, t) {
  const sec = (t - cf.start) / 1000;
  for (const b of cf.bits) {
    const y = (b.y + sec * b.v) % (HGT + 20);
    const x = b.x + Math.sin(sec * 3 + b.w) * 6;
    g.fillStyle = b.c;
    g.fillRect(Math.round(x), Math.round(y), 2, 3);
  }
  // Troféu no meio.
  const label = '52';
  g.fillStyle = 'rgba(10,12,22,.7)'; g.fillRect(SIZE / 2 - 30, HGT / 2 - 18, 60, 36);
  drawText(g, label, Math.round(SIZE / 2 - textWidth(label, 3) / 2), HGT / 2 - 10, PAL.gold, PAL.ink, 3);
}

let bg = null;
function background() {
  if (bg) return bg;
  bg = document.createElement('canvas');
  bg.width = SIZE;
  bg.height = HGT;
  felt(bg.getContext('2d'), SIZE, HGT);
  return bg;
}
