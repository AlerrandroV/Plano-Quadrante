// Interface do Plano Quadrante (visual retrô pixelado).
//
// render(root, state, ctx) é chamado a cada mudança de estado.
//   ctx.me     -> id de quem usa ESTA tela (na mesma tela: quem está na vez)
//   ctx.send() -> envia uma jogada
//   ctx.shared -> true = todos na mesma tela (layout de mesa, painéis girados)
import { h } from '../ui/dom.js';
import * as G from './plano.js';
import {
  PAL, TEAM, drawPawn, drawDie, drawSprite, drawText, pixelCanvas,
  PAWN_W, PAWN_H, DIE_SIZE,
} from './pixel.js';

// ------------------------------------------------------------ geometria
const STEP = 16;
const MARGIN = 11;
const BW = (G.MAX - G.MIN) * STEP + 2 * MARGIN;
const px = (x) => MARGIN + (x - G.MIN) * STEP;
const py = (y) => MARGIN + (G.MAX - y) * STEP;

const COLOR_LABEL = { azul: 'Azul', vermelho: 'Vermelho', verde: 'Verde', laranja: 'Laranja' };
// Mesma tela: azul e vermelho sentam do lado de cima (painel girado).
const TOP_SEATS = ['azul', 'vermelho'];
const BOTTOM_SEATS = ['verde', 'laranja'];

const ROLL_MS = 750;
const DEBUG = new URLSearchParams(location.search).has('debug'); // usado pelos testes automáticos
const HOP_MS = 430;

// Estado só da interface (não vai pela rede).
const ui = {
  board: null,
  selected: null,
  key: '',
  started: false,
  rollSeen: 0,
  rollUntil: 0,
  last: null,       // { root, state, ctx } para redesenhar após animações
  timer: null,
};

// ================================================================ render
export function render(root, state, ctx) {
  ui.last = { root, state, ctx };
  if (DEBUG) window.__pq = { state, ctx, px, py };
  const key = `${state.rollSeq}:${state.animSeq}:${state.phase}:${state.current}`;
  if (key !== ui.key) { ui.key = key; ui.selected = null; }

  const now = performance.now();
  // Partida nova (contadores voltaram a zero) ou primeira vez nesta página:
  // não anima o que já aconteceu.
  if (!ui.started || state.rollSeq < ui.rollSeen) {
    ui.started = true;
    ui.rollSeen = state.rollSeq;
    ui.rollUntil = 0;
  }
  if (state.dice && state.dice.seq > ui.rollSeen) {
    ui.rollUntil = now + ROLL_MS;
    ui.rollSeen = state.dice.seq;
  }
  const rolling = now < ui.rollUntil;
  clearTimeout(ui.timer);
  if (rolling) ui.timer = setTimeout(() => rerender(), ui.rollUntil - now + 10);

  const current = state.players[state.current];
  const myTurn = state.phase !== 'over' && current.id === ctx.me;
  const meIdx = G.playerIndexById(state, ctx.me);

  // Tabuleiro (o canvas é reaproveitado entre renders para manter animações).
  if (!ui.board) ui.board = new Board();
  const board = ui.board;
  board.update(state, myTurn && !rolling ? marksFor(state) : [], (x, y) => onBoardTap(state, ctx, x, y, myTurn));
  if (state.anim) board.animate(state.anim);

  document.documentElement.style.setProperty('--turn-bg', TEAM[current.color].dark);
  document.documentElement.style.setProperty('--turn', TEAM[current.color].base);

  const controls = controlsPanel(state, ctx, { myTurn, rolling });
  const boardWrap = h('div', { class: 'pq-board-wrap' }, board.canvas);
  board.observe(boardWrap, ctx.shared);

  let layout;
  if (ctx.shared) {
    const seat = (colors) => colors
      .map((c) => state.players.findIndex((p) => p.color === c))
      .filter((i) => i >= 0)
      .map((i) => playerPanel(state, i, { controls: i === state.current ? controls : null, shared: true }));
    layout = h('div', { class: 'pq shared' },
      h('div', { class: 'pq-row top' }, seat(TOP_SEATS)),
      boardWrap,
      h('div', { class: 'pq-row bottom' }, seat(BOTTOM_SEATS)),
      logBar(state));
  } else {
    layout = h('div', { class: 'pq personal' },
      h('div', { class: 'pq-row players' }, state.players.map((_, i) => playerPanel(state, i, { me: i === meIdx }))),
      boardWrap,
      h('section', { class: `pq-panel controls-only team-${(meIdx >= 0 ? state.players[meIdx] : current).color}` }, controls),
      logBar(state));
  }
  root.replaceChildren(layout);
}

function rerender() {
  if (ui.last && ui.last.root.isConnected) render(ui.last.root, ui.last.state, ui.last.ctx);
}

// ====================================================== marcas no tabuleiro
function marksFor(state) {
  const marks = [];
  if (state.phase === 'act') {
    const legal = G.legalActions(state);
    if (ui.selected != null) {
      const piece = state.pieces.find((p) => p.id === ui.selected);
      if (piece) marks.push({ x: piece.x, y: piece.y, kind: 'selected' });
      for (const a of legal) {
        if (a.type === 'move' && a.pieceId === ui.selected) marks.push({ x: a.x, y: a.y, kind: a.capture ? 'capture' : 'target' });
      }
    } else {
      for (const a of legal) {
        if (a.type === 'place') marks.push({ x: a.x, y: a.y, kind: a.capture ? 'capture' : 'target' });
      }
      const movable = new Set(legal.filter((a) => a.type === 'move').map((a) => a.pieceId));
      for (const p of state.pieces) if (movable.has(p.id)) marks.push({ x: p.x, y: p.y, kind: 'movable' });
    }
  } else if (state.phase === 'bonus') {
    const piece = state.pieces.find((p) => p.id === state.bonus.pieceId);
    if (piece) marks.push({ x: piece.x, y: piece.y, kind: 'selected' });
    for (const t of G.bonusTargets(state)) marks.push({ x: t.x, y: t.y, kind: t.capture ? 'capture' : 'target' });
  } else if (state.phase === 'card-target') {
    const kind = G.CARDS[state.card].target;
    if (kind === 'own-piece' || kind === 'enemy-piece') {
      for (const id of G.cardTargets(state)) {
        const p = state.pieces.find((q) => q.id === id);
        if (p) marks.push({ x: p.x, y: p.y, kind: 'card' });
      }
    }
  }
  return marks;
}

function onBoardTap(state, ctx, x, y, myTurn) {
  if (!myTurn) return;
  const piece = G.pieceAt(state, x, y);
  if (state.phase === 'act') {
    const legal = G.legalActions(state);
    if (ui.selected != null) {
      const mv = legal.find((a) => a.type === 'move' && a.pieceId === ui.selected && a.x === x && a.y === y);
      if (mv) return ctx.send({ type: 'move', pieceId: mv.pieceId, x, y });
      ui.selected = null;
    } else {
      const pl = legal.find((a) => a.type === 'place' && a.x === x && a.y === y);
      if (pl) return ctx.send({ type: 'place', x, y });
    }
    if (piece && piece.owner === state.current && legal.some((a) => a.type === 'move' && a.pieceId === piece.id)) {
      ui.selected = piece.id;
    }
    rerender();
  } else if (state.phase === 'bonus') {
    if (G.bonusTargets(state).some((t) => t.x === x && t.y === y)) ctx.send({ type: 'bonus', x, y });
  } else if (state.phase === 'card-target' && piece && G.cardTargets(state).includes(piece.id)) {
    ctx.send({ type: 'card-target', target: piece.id });
  }
}

// ================================================================ painéis
function playerPanel(state, i, { controls = null, shared = false, me = false } = {}) {
  const p = state.players[i];
  const onBoard = state.pieces.filter((q) => q.owner === i).length;
  const isTurn = i === state.current && state.phase !== 'over';
  const tags = [];
  if (p.eliminated) tags.push(h('span', { class: 'pq-tag out' }, 'FORA'));
  else if (p.skip > 0) tags.push(h('span', { class: 'pq-tag' }, 'BLOQUEADO'));
  if (state.winner === i) tags.push(h('span', { class: 'pq-tag win' }, 'VENCEU'));

  return h('section', {
    class: ['pq-panel', `team-${p.color}`, isTurn ? 'is-turn' : '', p.eliminated ? 'is-out' : '',
      controls ? 'has-controls' : '', shared && TOP_SEATS.includes(p.color) ? 'flipped' : ''].join(' '),
  },
  h('header', { class: 'pq-panel-head' },
    isTurn ? h('span', { class: 'pq-arrow', 'aria-hidden': 'true' }, '▶') : null,
    pawnIcon(p.color),
    h('span', { class: 'pq-name' }, p.name),
    me ? h('span', { class: 'pq-tag me' }, 'VOCÊ') : null,
    ...tags),
  h('div', { class: 'pq-stats' },
    stat('reserva', 'Na reserva', p.reserve),
    stat('board', 'No tabuleiro', onBoard),
    stat('cativeiro', 'Inimigos capturados (meta)', `${p.captives.length}/${G.captiveTarget(state)}`)),
  controls);
}

function stat(icon, label, value) {
  return h('span', { class: 'pq-stat', title: label, 'aria-label': `${label}: ${value}` },
    statIcon(icon), h('b', {}, value));
}

const LOCK = [
  '..KKK..',
  '.KFFFK.',
  '.KF.FK.',
  'KKKKKKK',
  'KGGGGGK',
  'KGGKGGK',
  'KGGKGGK',
  'KGGGGGK',
  'KKKKKKK',
];
const GRID = [
  'KKKKKKKKK',
  'KF.F.F.FK',
  'KFFFFFFFK',
  'KF.F.F.FK',
  'KFFFFFFFK',
  'KF.F.F.FK',
  'KFFFFFFFK',
  'KF.F.F.FK',
  'KKKKKKKKK',
];
function statIcon(kind) {
  const c = pixelCanvas(9, 9, 'pq-icon');
  const g = c.getContext('2d');
  if (kind === 'cativeiro') drawSprite(g, LOCK, 1, 0, { K: PAL.ink, F: PAL.fog, G: PAL.gold });
  else if (kind === 'board') drawSprite(g, GRID, 0, 0, { K: PAL.ink, F: PAL.fog });
  else {
    // Bolinhas = peças em reserva.
    g.fillStyle = PAL.ink; g.fillRect(1, 1, 7, 7);
    g.fillStyle = PAL.white; g.fillRect(2, 2, 5, 5);
    g.fillStyle = PAL.fog; g.fillRect(5, 4, 2, 3); g.fillRect(4, 6, 3, 1);
  }
  return c;
}

function pawnIcon(color) {
  const c = pixelCanvas(PAWN_W, PAWN_H, 'pq-pawn-icon');
  drawPawn(c.getContext('2d'), 0, 0, color);
  return c;
}

// ======================================================== painel de ação
function controlsPanel(state, ctx, { myTurn, rolling }) {
  const current = state.players[state.current];
  const send = (a) => ctx.send(a);
  const dice = diceRow(state, { clickable: myTurn && state.phase === 'roll', onRoll: () => send({ type: 'roll' }) });

  let title = '';
  let body = null;
  const buttons = [];

  if (state.phase === 'over') {
    const w = state.players[state.winner];
    title = w ? `${w.name} venceu!` : 'Fim de jogo';
    body = w ? `${w.name} capturou ${w.captives.length} peças inimigas.` : '';
    buttons.push(btn('Jogar de novo', () => send({ type: 'restart' })));
  } else if (!myTurn) {
    title = `Vez de ${current.name}`;
    body = phaseHint(state, false);
  } else if (rolling) {
    title = 'Rolando…';
  } else {
    switch (state.phase) {
      case 'roll':
        title = 'Sua vez!';
        body = 'Toque nos dados para rolar.';
        buttons.push(btn('Rolar dados', () => send({ type: 'roll' }), 'primary blink'));
        break;
      case 'card': {
        const card = G.CARDS[state.card];
        title = 'Números iguais!';
        body = cardView(card);
        const usable = G.cardUsable(state);
        buttons.push(btn(usable ? 'Usar agora' : 'Sem alvo', () => send({ type: 'card', use: true }), 'primary', !usable));
        buttons.push(btn('Descartar', () => send({ type: 'card', use: false })));
        break;
      }
      case 'card-target': {
        const card = G.CARDS[state.card];
        title = card.name;
        if (card.target === 'player' || card.target === 'captor') {
          body = card.target === 'player' ? 'Quem vai ficar sem jogar?' : 'Resgatar do cativeiro de quem?';
          for (const i of G.cardTargets(state)) {
            const p = state.players[i];
            buttons.push(btn(p.name, () => send({ type: 'card-target', target: i }), `team team-${p.color}`));
          }
        } else {
          body = card.target === 'own-piece' ? 'Toque numa peça SUA marcada.' : 'Toque numa peça INIMIGA marcada.';
        }
        buttons.push(btn('Voltar', () => send({ type: 'card-target', cancel: true })));
        break;
      }
      case 'act': {
        const legal = G.legalActions(state);
        if (!legal.length) {
          title = 'Sem jogada';
          body = 'Nenhuma casa disponível com estes dados.';
          buttons.push(btn('Passar a vez', () => send({ type: 'pass' }), 'primary'));
        } else if (ui.selected != null) {
          title = 'Mover';
          body = 'Toque no destino marcado.';
          buttons.push(btn('Cancelar', () => { ui.selected = null; rerender(); }));
        } else {
          const mustCapture = legal[0].capture;
          title = mustCapture ? 'Captura obrigatória!' : 'Escolha a jogada';
          const canPlace = legal.some((a) => a.type === 'place');
          const canMove = legal.some((a) => a.type === 'move');
          body = [canPlace ? 'Toque numa casa marcada para colocar uma peça' : null,
            canMove ? 'toque numa peça sua para movê-la' : null].filter(Boolean).join(', ou ') + '.';
          body = body[0].toUpperCase() + body.slice(1);
        }
        break;
      }
      case 'bonus': {
        const piece = state.pieces.find((p) => p.id === state.bonus.pieceId);
        title = `Bônus nível ${piece?.level ?? ''}`;
        body = `Avance até ${piece?.level} casa(s) em linha reta, em qualquer direção.`;
        buttons.push(btn('Pular bônus', () => send({ type: 'bonus', skip: true })));
        break;
      }
      default:
    }
  }

  return h('div', { class: 'pq-controls' },
    dice,
    h('div', { class: 'pq-message' },
      title ? h('strong', { class: 'pq-title' }, title) : null,
      body == null ? null : typeof body === 'string' ? h('p', {}, body) : body,
      buttons.length ? h('div', { class: 'pq-buttons' }, buttons) : null));
}

function phaseHint(state) {
  switch (state.phase) {
    case 'roll': return 'Rolando os dados…';
    case 'card': return `Pegou a carta ${G.CARDS[state.card].name}.`;
    case 'card-target': return `Usando ${G.CARDS[state.card].name}…`;
    case 'act': return 'Escolhendo a jogada…';
    case 'bonus': return 'Usando o bônus de nível…';
    default: return '';
  }
}

function btn(label, onclick, cls = '', disabled = false) {
  return h('button', { class: `px-btn ${cls}`, onclick, disabled }, label);
}

function cardView(card) {
  return h('div', { class: 'pq-card' },
    h('span', { class: 'pq-card-name' }, card.name),
    h('span', { class: 'pq-card-text' }, card.text));
}

// ================================================================ dados
const diceCanvases = new Set();

function diceRow(state, { clickable, onRoll }) {
  const d = state.dice;
  const hot = pixelCanvas(DIE_SIZE, DIE_SIZE, 'pq-die');
  const cold = pixelCanvas(DIE_SIZE, DIE_SIZE, 'pq-die');
  hot._die = { type: 'hot', value: d?.x ?? null };
  cold._die = { type: 'cold', value: d?.y ?? null };
  hot._born = cold._born = performance.now();
  diceCanvases.add(hot);
  diceCanvases.add(cold);
  startDiceLoop();

  const label = (v, type) => {
    if (v == null) return type === 'hot' ? 'quente' : 'frio';
    if (type === 'hot') return v < 0 ? `${-v} ←` : `${v} →`;
    return v < 0 ? `${-v} ↓` : `${v} ↑`;
  };
  const colorOf = (v, type) => (v == null ? '' : type === 'hot' ? (v < 0 ? 'vermelho' : 'laranja') : (v < 0 ? 'verde' : 'azul'));
  const die = (canvas, type, v) => h('span', { class: 'pq-die-box' },
    canvas,
    h('small', { class: `pq-die-label c-${colorOf(v, type)}` }, performance.now() < ui.rollUntil ? '…' : label(v, type)));

  const inner = [die(hot, 'hot', d?.x), die(cold, 'cold', d?.y)];
  return clickable
    ? h('button', { class: 'pq-dice clickable', onclick: onRoll, 'aria-label': 'Rolar os dados' }, inner)
    : h('div', { class: 'pq-dice' }, inner);
}

let diceLoop = false;
function startDiceLoop() {
  if (diceLoop) return;
  diceLoop = true;
  let lastFlip = 0;
  let faces = {};
  const frame = (t) => {
    for (const c of diceCanvases) {
      if (!c.isConnected && (c._seen || t - c._born > 3000)) diceCanvases.delete(c);
    }
    if (!diceCanvases.size) { diceLoop = false; return; }
    const rolling = t < ui.rollUntil;
    if (rolling && t - lastFlip > 70) {
      lastFlip = t;
      faces = { hot: randomFace('hot'), cold: randomFace('cold') };
    }
    for (const c of diceCanvases) {
      if (!c.isConnected) continue;
      c._seen = true;
      const g = c.getContext('2d');
      g.clearRect(0, 0, DIE_SIZE, DIE_SIZE);
      const v = rolling ? faces[c._die.type] : c._die.value;
      if (v == null) {
        drawDie(g, 0, 0, '?', c._die.type === 'hot' ? 'vermelho' : 'azul', { dim: true });
      } else {
        const color = c._die.type === 'hot' ? (v < 0 ? 'vermelho' : 'laranja') : (v < 0 ? 'verde' : 'azul');
        drawDie(g, 0, 0, Math.abs(v), color);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function randomFace() {
  return (Math.floor(Math.random() * 4) + 1) * (Math.random() < 0.5 ? -1 : 1);
}

// =================================================================== log
function logBar(state) {
  return h('div', { class: 'pq-log' },
    h('ul', {}, state.log.slice(-3).map((l, i, arr) => h('li', { class: i === arr.length - 1 ? 'new' : '' }, l))),
    h('button', { class: 'px-btn small', onclick: openRules, 'aria-label': 'Regras do jogo' }, '?'));
}

function openRules() {
  let dlg = document.getElementById('pq-rules');
  if (!dlg) {
    dlg = h('dialog', { id: 'pq-rules', class: 'pq-dialog' },
      h('h2', {}, 'Como jogar'),
      h('ul', {},
        h('li', {}, 'Na sua vez, role os dois dados. O dado ', h('b', { class: 'c-laranja' }, 'quente'),
          ' anda na horizontal (', h('b', { class: 'c-vermelho' }, 'vermelho ←'), ', ', h('b', { class: 'c-laranja' }, 'laranja →'),
          '). O dado ', h('b', { class: 'c-azul' }, 'frio'), ' anda na vertical (', h('b', { class: 'c-verde' }, 'verde ↓'), ', ', h('b', { class: 'c-azul' }, 'azul ↑'), ').'),
        h('li', {}, 'Use UM dos dados: coloque uma peça da reserva contando a partir do centro, ou mova uma peça sua.'),
        h('li', {}, 'O tabuleiro é infinito: quem sai por um lado volta pelo outro.'),
        h('li', {}, 'Cair numa peça inimiga é captura (obrigatória!). Ela vai para o seu cativeiro, sua peça sobe de nível e você joga de novo.'),
        h('li', {}, 'Peças com nível podem, depois de mover, andar até esse número de casas extras em linha reta.'),
        h('li', {}, 'Dados com números iguais dão uma carta especial: use na hora ou descarte.'),
        h('li', {}, 'Vence quem capturar 6 peças (2 jogadores) ou 8 (3 ou 4), ou quem sobrar com peças.')),
      h('form', { method: 'dialog' }, h('button', { class: 'px-btn primary' }, 'Entendi')));
    document.body.append(dlg);
  }
  dlg.showModal();
}

// ============================================================ tabuleiro
class Board {
  constructor() {
    this.canvas = pixelCanvas(BW, BW, 'pq-board');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Tabuleiro 9 por 9 do Plano Quadrante');
    this.g = this.canvas.getContext('2d');
    this.state = null;
    this.marks = [];
    this.onTap = null;
    this.anim = null;     // { ...state.anim, start }
    this.animSeen = -1;
    this.running = false;
    this.canvas.addEventListener('pointerup', (e) => this.tap(e));
  }

  update(state, marks, onTap) {
    if (state.animSeq < this.animSeen) this.animSeen = -1; // partida nova
    this.state = state;
    this.marks = marks;
    this.onTap = onTap;
    if (this.animSeen < 0) this.animSeen = state.anim?.seq ?? 0; // não anima o passado ao abrir
    this.loop();
  }

  animate(anim) {
    if (anim.seq <= this.animSeen) return;
    this.animSeen = anim.seq;
    this.anim = { ...anim, start: performance.now() };
  }

  busy() {
    return !!this.anim;
  }

  observe(wrap, shared) {
    // Escala inteira (ou meia) para os pixels ficarem nítidos.
    const fit = () => {
      if (!wrap.isConnected) return;
      const maxH = window.innerHeight * (shared ? 0.52 : 0.6);
      const avail = Math.min(wrap.clientWidth, maxH);
      let s = avail / BW;
      s = s >= 3 ? Math.floor(s) : Math.max(1, Math.floor(s * 2) / 2);
      this.canvas.style.width = `${BW * s}px`;
      this.canvas.style.height = `${BW * s}px`;
    };
    this.ro?.disconnect();
    this.ro = new ResizeObserver(fit);
    this.ro.observe(wrap);
    // A altura disponível muda ao entrar/sair da tela cheia ou girar o aparelho.
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    this.onResize = fit;
    window.addEventListener('resize', fit);
    requestAnimationFrame(fit);
  }

  tap(e) {
    if (!this.onTap || this.busy()) return;
    const r = this.canvas.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * BW;
    const cy = ((e.clientY - r.top) / r.height) * BW;
    const x = Math.round((cx - MARGIN) / STEP) + G.MIN;
    const y = G.MAX - Math.round((cy - MARGIN) / STEP);
    if (x < G.MIN || x > G.MAX || y < G.MIN || y > G.MAX) return;
    this.onTap(x, y);
  }

  loop() {
    if (this.running) return;
    this.running = true;
    const frame = (t) => {
      if (!this.canvas.isConnected && this._attached) { this.running = false; this._attached = false; return; }
      if (this.canvas.isConnected) this._attached = true;
      this.draw(t);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  draw(t) {
    const g = this.g;
    const s = this.state;
    if (!s) return;
    g.imageSmoothingEnabled = false;

    // Fundo e grade
    g.fillStyle = PAL.ink;
    g.fillRect(0, 0, BW, BW);
    g.fillStyle = '#20253d';
    g.fillRect(px(G.MIN) - 6, py(G.MAX) - 6, (G.MAX - G.MIN) * STEP + 13, (G.MAX - G.MIN) * STEP + 13);
    g.fillStyle = '#2f3656';
    for (let v = G.MIN + 1; v < G.MAX; v++) {
      g.fillRect(px(v), py(G.MAX), 1, (G.MAX - G.MIN) * STEP);
      g.fillRect(px(G.MIN), py(v), (G.MAX - G.MIN) * STEP, 1);
    }
    // Eixos x e y
    g.fillStyle = PAL.steel;
    g.fillRect(px(0), py(G.MAX), 1, (G.MAX - G.MIN) * STEP);
    g.fillRect(px(G.MIN), py(0), (G.MAX - G.MIN) * STEP, 1);
    // Moldura colorida: azul em cima, laranja à direita, verde embaixo, vermelho à esquerda
    const len = (G.MAX - G.MIN) * STEP + 3;
    g.fillStyle = TEAM.azul.base; g.fillRect(px(G.MIN) - 1, py(G.MAX) - 1, len, 3);
    g.fillStyle = TEAM.verde.base; g.fillRect(px(G.MIN) - 1, py(G.MIN) - 1, len, 3);
    g.fillStyle = TEAM.vermelho.base; g.fillRect(px(G.MIN) - 1, py(G.MAX) - 1, 3, len);
    g.fillStyle = TEAM.laranja.base; g.fillRect(px(G.MAX) - 1, py(G.MAX) - 1, 3, len);
    // Interseções
    for (let x = G.MIN; x <= G.MAX; x++) {
      for (let y = G.MIN; y <= G.MAX; y++) {
        g.fillStyle = x === 0 && y === 0 ? PAL.gold : PAL.fog;
        g.fillRect(px(x) - 1, py(y) - 1, 3, 3);
        g.fillStyle = PAL.ink;
        g.fillRect(px(x), py(y), 1, 1);
      }
    }

    // Animação em andamento?
    let anim = this.anim;
    let animPos = null;
    if (anim) {
      const k = (t - anim.start) / HOP_MS;
      if (k >= 1.6 || (k >= 1 && !anim.captured)) { this.anim = null; anim = null; } else animPos = Math.min(1, k);
    }

    // Peças
    const blink = Math.floor(t / 280) % 2 === 0;
    for (const p of s.pieces) {
      if (anim && p.id === anim.pieceId && animPos < 1) continue;
      const color = s.players[p.owner].color;
      drawPawn(g, px(p.x) - 6, py(p.y) - 9, color, { level: p.level });
    }
    if (anim && animPos < 1) this.drawHop(anim, animPos);
    if (anim && anim.captured && animPos >= 1) this.drawPoof(anim, (t - anim.start) / HOP_MS - 1);

    // Marcas (só depois das animações)
    if (!anim) {
      for (const m of this.marks) this.drawMark(m, t, blink);
    }
  }

  drawHop(anim, k) {
    const g = this.g;
    const dxCells = anim.to.x - anim.from.x;
    const dyCells = anim.to.y - anim.from.y;
    const wrapped = Math.abs(dxCells) > 4.5 || Math.abs(dyCells) > 4.5;
    const color = anim.color;
    if (wrapped) {
      // Atravessou a borda: some de um lado e pisca do outro.
      const at = k < 0.5 ? anim.from : anim.to;
      if (Math.floor(k * 10) % 2 === 0) drawPawn(g, px(at.x) - 6, py(at.y) - 9, color);
      return;
    }
    // Rápido no começo e no fim, lento no meio (como no protótipo).
    const prog = k + Math.sin(2 * Math.PI * k) / (2 * Math.PI);
    const x = px(anim.from.x) + (px(anim.to.x) - px(anim.from.x)) * prog;
    const y = py(anim.from.y) + (py(anim.to.y) - py(anim.from.y)) * prog;
    const lift = Math.round(Math.sin(Math.PI * k) * 10);
    // Sombra no chão
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(Math.round(x) - 4, Math.round(y) + 2, 9, 2);
    drawPawn(g, Math.round(x) - 6, Math.round(y) - 9 - lift, color);
  }

  drawPoof(anim, k) {
    // Explosãozinha de pixels na captura.
    const g = this.g;
    const cx = px(anim.to.x);
    const cy = py(anim.to.y) - 3;
    const r = 3 + Math.round(k * 16);
    g.fillStyle = k < 0.3 ? PAL.white : PAL.gold;
    for (const [dx, dy] of G.DIRS8) {
      const len = dx && dy ? 0.75 : 1;
      g.fillRect(Math.round(cx + dx * r * len) - 1, Math.round(cy + dy * r * len) - 1, 2, 2);
    }
  }

  drawMark(m, t, blink) {
    const g = this.g;
    const cx = px(m.x);
    const cy = py(m.y) - 3;
    if (m.kind === 'movable') {
      // Setinha balançando em cima das peças que podem andar.
      const bob = Math.floor(t / 200) % 2;
      g.fillStyle = PAL.ink;
      g.fillRect(cx - 3, cy - 13 + bob, 7, 2);
      g.fillRect(cx - 2, cy - 11 + bob, 5, 1);
      g.fillStyle = PAL.cyan;
      g.fillRect(cx - 2, cy - 13 + bob, 5, 1);
      g.fillRect(cx - 1, cy - 12 + bob, 3, 1);
      g.fillRect(cx, cy - 11 + bob, 1, 1);
      return;
    }
    const strong = { target: PAL.gold, capture: PAL.danger, selected: PAL.cyan, card: PAL.cyan }[m.kind];
    const soft = { target: '#a0784a', capture: '#8a2236', selected: PAL.cyan, card: '#3d8a90' }[m.kind];
    const color = blink ? strong : soft; // pisca, mas nunca some
    // Cantoneiras de "cursor" retrô em volta da casa.
    const r = 7;
    const L = 4;
    g.fillStyle = color;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x0 = cx + sx * r;
      const y0 = cy + sy * r + 3;
      g.fillRect(sx < 0 ? x0 : x0 - L + 1, y0, L, 1);
      g.fillRect(x0, sy < 0 ? y0 : y0 - L + 1, 1, L);
    }
    if (m.kind === 'target' && !G.pieceAt(this.state, m.x, m.y)) {
      g.fillRect(cx - 1, cy + 2, 3, 3);
    }
  }
}
