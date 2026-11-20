// Interface do Domínio da Teia (visual retrô pixelado): aranhas numa teia.
//
// render(root, state, ctx) é chamado a cada mudança de estado.
//   ctx.me     -> id de quem usa ESTA tela (na mesma tela: quem está na vez)
//   ctx.send() -> envia uma jogada
//   ctx.shared -> true = todos na mesma tela (layout de mesa, painéis girados)
import { h } from '../../ui/dom.js';
import * as G from './rules.js';
import { PAL, TEAM, drawSpider, drawDie, drawText, textWidth, pixelCanvas, DIE_SIZE, SPIDER_SIZE } from '../../ui/pixel.js';
import { sfx } from '../../ui/sound.js';
import {
  tableLayout, fitTable, setTurnColor, playerPanel as panel, spectatorPanel, btn, logBar,
} from '../../ui/table.js';

// ------------------------------------------------------------ geometria
const STEP = 32;   // 2x: mais espaço para detalhe
const MARGIN = 22;
const BW = (G.MAX - G.MIN) * STEP + 2 * MARGIN;
const px = (x) => MARGIN + (x - G.MIN) * STEP;
const py = (y) => MARGIN + (G.MAX - y) * STEP;

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
    sfx('dice');
  }
  playSounds(state, ctx);
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

  setTurnColor(current.color);

  const controls = controlsPanel(state, ctx, { myTurn, rolling });

  // Mesma tela: quem senta do lado de cima tem o painel girado.
  const sideA = [];
  const sideB = [];
  if (ctx.shared) {
    state.players.forEach((p, i) => {
      const el = playerPanel(state, i, { controls: i === state.current ? controls : null, flipped: p.side === 'top' });
      (p.side === 'top' ? sideA : sideB).push(el);
    });
  } else {
    state.players.forEach((_, i) => { if (i !== meIdx) sideA.push(playerPanel(state, i)); });
    sideB.push(meIdx >= 0 ? playerPanel(state, meIdx, { controls, me: true }) : spectatorPanel(controls));
  }

  const layout = tableLayout({ shared: ctx.shared, sideA, sideB, center: board.canvas, log: logBar(state.log, RULES) });
  root.replaceChildren(layout);
  fitTable(layout, board.canvas, BW, board);
}

// Efeitos sonoros: tocam quando algo NOVO acontece no estado.
function playSounds(state, ctx) {
  const snd = ui.snd || (ui.snd = { anim: state.animSeq, phase: state.phase, ready: false });
  if (!snd.ready || state.animSeq < snd.anim) { Object.assign(snd, { anim: state.animSeq, phase: state.phase, ready: true }); return; }
  if (state.animSeq > snd.anim) {
    const a = state.anim;
    const delay = ui.rollUntil > performance.now() ? ui.rollUntil - performance.now() : 0;
    setTimeout(() => sfx(a?.captured ? 'capture' : a?.kind === 'place' ? 'place' : 'move'), delay + 250);
    if (a?.captured) setTimeout(() => sfx('levelup'), delay + 520);
    snd.anim = state.animSeq;
  }
  if (state.phase !== snd.phase) {
    if (state.phase === 'card') setTimeout(() => sfx('card'), 800);
    if (state.phase === 'over') {
      const won = state.winner != null && (ctx.shared || state.players[state.winner].id === ctx.me);
      setTimeout(() => sfx(won ? 'win' : 'lose'), 500);
    }
    snd.phase = state.phase;
  }
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
function playerPanel(state, i, { controls = null, flipped = false, me = false } = {}) {
  const p = state.players[i];
  const tags = [];
  if (p.eliminated) tags.push({ text: 'FORA', kind: 'out' });
  else if (p.skip > 0) tags.push({ text: 'BLOQ.' });
  if (state.winner === i) tags.push({ text: 'VENCEU', kind: 'win' });
  return panel({
    color: p.color, name: p.name, me, flipped, controls, tags,
    turn: i === state.current && state.phase !== 'over',
    out: p.eliminated,
    icon: spiderIcon(p.color),
    stats: [
      { icon: 'reserva', label: 'Aranhas na reserva', value: p.reserve },
      { icon: 'board', label: 'Aranhas na teia', value: state.pieces.filter((q) => q.owner === i).length },
      { icon: 'cativeiro', label: 'Inimigos capturados (meta)', value: `${p.captives.length}/${G.captiveTarget(state)}` },
    ],
  });
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
        body = 'Toque nos dados.';
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
          title = mustCapture ? 'Captura obrigatória!' : 'Sua jogada';
          const canPlace = legal.some((a) => a.type === 'place');
          const canMove = legal.some((a) => a.type === 'move');
          body = canPlace && canMove ? 'Ponha uma aranha num ponto marcado ou mova uma com seta.'
            : canPlace ? 'Ponha uma aranha num ponto marcado.' : 'Mova uma aranha com seta.';
        }
        break;
      }
      case 'bonus': {
        const piece = state.pieces.find((p) => p.id === state.bonus.pieceId);
        title = `Bônus nível ${piece?.level ?? ''}`;
        body = `Até ${piece?.level} casa(s) a mais, em linha reta.`;
        buttons.push(btn('Pular bônus', () => send({ type: 'bonus', skip: true })));
        break;
      }
      default:
    }
  }

  return h('div', { class: 'pq-controls' }, h('div', { class: 'pq-ctl-inner' },
    dice,
    h('div', { class: 'pq-message' },
      title ? h('strong', { class: 'pq-title' }, title) : null,
      body == null ? null : typeof body === 'string' ? h('p', {}, body) : body,
      buttons.length ? h('div', { class: 'pq-buttons' }, buttons) : null)));
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

// ================================================================ regras
const c = (cls, text) => h('b', { class: cls }, text);
export const RULES = {
  title: 'Domínio da Teia',
  items: [
    'Cada jogador tem 8 aranhas. A teia tem 81 pontos, ligados por fios; o centro é o (0, 0).',
    ['Na sua vez, role os dois dados. O dado ', c('c-laranja', 'quente'), ' anda na horizontal (',
      c('c-vermelho', 'vermelho ←'), ', ', c('c-laranja', 'laranja →'), '). O dado ', c('c-azul', 'frio'),
      ' anda na vertical (', c('c-verde', 'verde ↓'), ', ', c('c-azul', 'azul ↑'), ').'],
    'Use UM dos dados: ponha uma aranha da reserva contando a partir do centro, ou mova uma aranha sua.',
    'A teia acaba na borda: não dá para fazer um movimento que sairia dela.',
    'Cair numa aranha inimiga é captura (obrigatória!). Ela vai para o seu cativeiro, a sua aranha sobe de nível e você joga de novo.',
    'Aranhas com nível podem, depois de mover, andar até esse número de pontos extras em linha reta (até a borda).',
    'Dados com números iguais dão uma carta especial: use na hora ou descarte.',
    'Vence quem capturar 6 aranhas (2 jogadores) ou 8 (3 ou 4), ou quem sobrar com aranhas.',
  ],
};

function spiderIcon(color) {
  const cv = pixelCanvas(SPIDER_SIZE, SPIDER_SIZE, 'pq-pawn-icon');
  drawSpider(cv.getContext('2d'), 0, 0, color);
  return cv;
}

// ============================================================ tabuleiro
class Board {
  constructor() {
    this.canvas = pixelCanvas(BW, BW, 'pq-board');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Teia de 9 por 9 pontos do Domínio da Teia');
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

  /**
   * Fundo: a TEIA (não muda durante a partida, então é desenhada uma vez).
   * Cada ponto se liga aos vizinhos por um fio curvo, que se curva em
   * direção aos eixos (os horizontais para o eixo X0, os verticais para o
   * Y0). Os próprios eixos X0 e Y0 são fios retos. Os fios da borda têm as
   * cores das direções dos dados.
   */
  background() {
    if (this.bg) return this.bg;
    const c = document.createElement('canvas');
    c.width = BW;
    c.height = BW;
    const g = c.getContext('2d');
    const x0 = px(G.MIN);
    const y0 = py(G.MAX);
    const span = (G.MAX - G.MIN) * STEP;
    const SILK = '#9aa6c4';
    const SILK_HI = '#dfe6f5';
    const SAG = 10; // controle da curva (o meio do fio afunda ~5 px)

    // Noite com trama discreta.
    g.fillStyle = PAL.ink;
    g.fillRect(0, 0, BW, BW);
    g.fillStyle = '#1e2238';
    for (let y = 0; y < BW; y += 4) for (let x = ((y / 4) % 2) * 2; x < BW; x += 4) g.fillRect(x, y, 1, 1);

    const dots = new Map(); // pixel -> cor (fios não se apagam uns aos outros)
    const plot = (x, y, col) => { dots.set(`${Math.round(x)},${Math.round(y)}`, col); };
    // Curva de um fio (Bézier quadrática), amostrada até não sobrar buraco.
    const thread = (ax, ay, bx, by, cx, cy, col) => {
      const n = Math.ceil(Math.hypot(bx - ax, by - ay)) * 2;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = (1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t * t * bx;
        const y = (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t * t * by;
        plot(x, y, col);
      }
    };
    const edgeColor = (side) => TEAM[{ top: 'azul', bottom: 'verde', left: 'vermelho', right: 'laranja' }[side]].light;

    // Fios de ancoragem: dos cantos da teia até os cantos da tela.
    for (const [cx, cy, ex, ey] of [[x0, y0, 2, 2], [px(G.MAX), y0, BW - 3, 2], [x0, py(G.MIN), 2, BW - 3], [px(G.MAX), py(G.MIN), BW - 3, BW - 3]]) {
      thread(cx, cy, ex, ey, (cx + ex) / 2, (cy + ey) / 2, '#4a5474');
    }
    // Fios horizontais: curvam para o eixo X0 (y = 0); o próprio eixo é reto.
    for (let y = G.MIN; y <= G.MAX; y++) {
      if (y === 0) continue;
      const toward = Math.sign(0 - y) * -1; // no canvas, y cresce para baixo
      const col = y === G.MAX ? edgeColor('top') : y === G.MIN ? edgeColor('bottom') : SILK;
      for (let x = G.MIN; x < G.MAX; x++) {
        const ax = px(x); const bx = px(x + 1); const ay = py(y);
        thread(ax, ay, bx, ay, (ax + bx) / 2, ay + toward * SAG, col);
      }
    }
    // Fios verticais: curvam para o eixo Y0 (x = 0).
    for (let x = G.MIN; x <= G.MAX; x++) {
      if (x === 0) continue;
      const toward = Math.sign(0 - x);
      const col = x === G.MAX ? edgeColor('right') : x === G.MIN ? edgeColor('left') : SILK;
      for (let y = G.MIN; y < G.MAX; y++) {
        const ay = py(y); const by = py(y + 1); const ax = px(x);
        thread(ax, ay, ax, by, ax + toward * SAG, (ay + by) / 2, col);
      }
    }
    for (const [k, col] of dots) {
      const [x, y] = k.split(',').map(Number);
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
    // Eixos X0 e Y0: fios retos e mais grossos (2 px), com brilho.
    g.fillStyle = SILK;
    g.fillRect(px(0), y0, 2, span);
    g.fillRect(x0, py(0), span, 2);
    g.fillStyle = SILK_HI;
    g.fillRect(px(0), y0, 1, span);
    g.fillRect(x0, py(0), span, 1);
    // Gotinhas de orvalho em alguns fios (sempre nos mesmos lugares).
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 22; i++) {
      const gx = G.MIN + Math.floor(rnd() * 8);
      const gy = G.MIN + 1 + Math.floor(rnd() * 7);
      const x = px(gx) + 8 + Math.floor(rnd() * 16);
      const y = py(gy) + (gy > 0 ? 3 : -3);
      g.fillStyle = '#c8fbff'; g.fillRect(x, y, 1, 1);
      g.fillStyle = '#5b6b8c'; g.fillRect(x, y + 1, 1, 1);
    }
    // Nós de seda em cada ponto; o centro é o "miolo" dourado da teia.
    for (let x = G.MIN; x <= G.MAX; x++) {
      for (let y = G.MIN; y <= G.MAX; y++) {
        const cx = px(x);
        const cy = py(y);
        if (x === 0 && y === 0) {
          g.fillStyle = PAL.ink; g.fillRect(cx - 4, cy - 4, 10, 10);
          g.fillStyle = '#c98b3a'; g.fillRect(cx - 3, cy - 3, 8, 8);
          g.fillStyle = PAL.gold; g.fillRect(cx - 2, cy - 2, 6, 6);
          g.fillStyle = '#fff6c8'; g.fillRect(cx - 1, cy - 1, 2, 2);
          continue;
        }
        g.fillStyle = PAL.ink; g.fillRect(cx - 2, cy - 2, 6, 6);
        g.fillStyle = SILK; g.fillRect(cx - 1, cy - 1, 4, 4);
        g.fillStyle = SILK_HI; g.fillRect(cx - 1, cy - 1, 2, 2);
      }
    }
    // Números das coordenadas nas margens (embaixo: x; à esquerda: y).
    for (let v = G.MIN; v <= G.MAX; v++) {
      const label = String(v);
      const w = textWidth(label);
      drawText(g, label, px(v) - Math.floor(w / 2) + 1, py(G.MIN) + 10, v === 0 ? PAL.gold : PAL.steel);
      drawText(g, label, x0 - 10 - w, py(v) - 3, v === 0 ? PAL.gold : PAL.steel);
    }
    this.bg = c;
    return c;
  }

  draw(t) {
    const g = this.g;
    const s = this.state;
    if (!s) return;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.background(), 0, 0);

    // Animação em andamento?
    let anim = this.anim;
    let animPos = null;
    if (anim) {
      const k = (t - anim.start) / HOP_MS;
      if (k >= 1.6 || (k >= 1 && !anim.captured)) { this.anim = null; anim = null; } else animPos = Math.min(1, k);
    }

    // Peças (pés do peão um pouco abaixo da interseção).
    const blink = Math.floor(t / 280) % 2 === 0;
    for (const p of s.pieces) {
      if (anim && p.id === anim.pieceId && animPos < 1) continue;
      const color = s.players[p.owner].color;
      drawSpider(g, px(p.x) - 12, py(p.y) - 11, color, { level: p.level });
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
    const color = anim.color;
    // Rápido no começo e no fim, lento no meio (como no protótipo).
    const prog = k + Math.sin(2 * Math.PI * k) / (2 * Math.PI);
    const fx = px(anim.from.x);
    const fy = py(anim.from.y);
    const x = fx + (px(anim.to.x) - fx) * prog;
    const y = fy + (py(anim.to.y) - fy) * prog;
    const lift = Math.round(Math.sin(Math.PI * k) * 20);
    // Fio de seda que a aranha solta no salto (só ao mover, não ao chegar da reserva).
    if (anim.kind === 'move') {
      const n = Math.ceil(Math.hypot(x - fx, y - lift - fy) / 3);
      g.fillStyle = 'rgba(223,230,245,0.75)';
      for (let i = 0; i <= n; i++) {
        const t = i / Math.max(1, n);
        g.fillRect(Math.round(fx + (x - fx) * t), Math.round(fy + (y - lift - fy) * t), 1, 1);
      }
    }
    // Sombra no chão (diminui quando a aranha sobe).
    const sw = 16 - Math.round(lift / 4);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(Math.round(x) - sw / 2, Math.round(y) + 6, sw, 3);
    drawSpider(g, Math.round(x) - 12, Math.round(y) - 11 - lift, color);
  }

  drawPoof(anim, k) {
    // Explosãozinha de pixels na captura (estrelas em 8 direções).
    const g = this.g;
    const cx = px(anim.to.x);
    const cy = py(anim.to.y);
    const r = 6 + Math.round(k * 32);
    for (const [dx, dy] of G.DIRS8) {
      const len = dx && dy ? 0.75 : 1;
      const x = Math.round(cx + dx * r * len);
      const y = Math.round(cy + dy * r * len);
      g.fillStyle = k < 0.3 ? PAL.white : PAL.gold;
      g.fillRect(x - 1, y - 3, 2, 6);
      g.fillRect(x - 3, y - 1, 6, 2);
      g.fillStyle = PAL.white;
      g.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  drawMark(m, t, blink) {
    const g = this.g;
    const cx = px(m.x);
    const cy = py(m.y);
    if (m.kind === 'movable') {
      // Setinha balançando em cima das peças que podem andar.
      const bob = Math.floor(t / 200) % 2 ? 2 : 0;
      const top = cy - 22 + bob;
      for (let i = 0; i < 6; i++) {
        g.fillStyle = PAL.ink;
        g.fillRect(cx - 6 + i, top + i, 12 - 2 * i + 1, 1);
      }
      for (let i = 0; i < 5; i++) {
        g.fillStyle = i === 0 ? '#c8fbff' : PAL.cyan;
        g.fillRect(cx - 4 + i, top + i, 9 - 2 * i, 1);
      }
      return;
    }
    const strong = { target: PAL.gold, capture: PAL.danger, selected: PAL.cyan, card: PAL.cyan }[m.kind];
    const soft = { target: '#a0784a', capture: '#8a2236', selected: PAL.cyan, card: '#3d8a90' }[m.kind];
    const color = blink ? strong : soft; // pisca, mas nunca some
    // Cantoneiras de "cursor" retrô (2 px) em volta da casa.
    const r = 14;
    const L = 8;
    const cyc = cy;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x0 = sx < 0 ? cx - r : cx + r - 1;
      const y0 = sy < 0 ? cyc - r : cyc + r - 1;
      g.fillStyle = PAL.ink;
      g.fillRect(sx < 0 ? x0 - 1 : x0 - L + 1, sy < 0 ? y0 - 1 : y0 - 1, L + 1, 4);
      g.fillRect(sx < 0 ? x0 - 1 : x0 - 2, sy < 0 ? y0 - 1 : y0 - L + 1, 4, L + 1);
      g.fillStyle = color;
      g.fillRect(sx < 0 ? x0 : x0 - L + 1, sy < 0 ? y0 : y0 - 1, L, 2);
      g.fillRect(sx < 0 ? x0 : x0 - 1, sy < 0 ? y0 : y0 - L + 1, 2, L);
    }
    if (m.kind === 'target' && !G.pieceAt(this.state, m.x, m.y)) {
      for (let k = -3; k <= 3; k++) g.fillRect(cx - (3 - Math.abs(k)), cyc + k, 2 * (3 - Math.abs(k)) + 1, 1);
    }
  }
}
