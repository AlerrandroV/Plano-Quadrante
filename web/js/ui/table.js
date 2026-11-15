// "Mesa" comum a todos os jogos da plataforma: mesma identidade visual,
// mesma organização de tela.
//
//   ┌ lado A ┐   em pé: lado A / tabuleiro / lado B (faixas iguais)
//   │ tabul. │   deitado: as faixas viram colunas
//   └ lado B ┘   + uma linha de registro embaixo
//
// Cada jogo monta os painéis dos jogadores e o "centro" (normalmente o
// canvas do tabuleiro) e chama tableLayout() + fitTable().
import { h } from './dom.js';
import { PAL, TEAM, drawPawn, drawSprite, pixelCanvas, PAWN_W, PAWN_H } from './pixel.js';

/** Monta a grade da partida. sideA/sideB: listas de painéis. */
export function tableLayout({ shared, sideA, sideB, center, log }) {
  // Quem divide o lado com o painel da vez fica "recolhido" (só ícone e números).
  for (const side of [sideA, sideB]) {
    if (side.length > 1 && side.some((el) => el.classList.contains('has-controls'))) {
      for (const el of side) if (!el.classList.contains('has-controls')) el.classList.add('rested');
    }
  }
  return h('div', { class: `pq ${shared ? 'shared' : 'personal'}` },
    h('div', { class: 'pq-side a' }, sideA),
    h('div', { class: 'pq-board-wrap' }, center),
    h('div', { class: 'pq-side b' }, sideB),
    log);
}

/**
 * Ajusta o tamanho do tabuleiro para a partida caber inteira na tela.
 * `native` = tamanho do canvas em pixels de arte; `holder` guarda o observer.
 */
export function fitTable(pq, canvas, native, holder) {
  const run = () => {
    if (!pq.isConnected) return;
    const W = pq.clientWidth;
    const H = pq.clientHeight;
    const log = pq.querySelector('.pq-log');
    const gap = 8;
    const logH = log ? log.offsetHeight + gap : 0;
    const landscape = W > H * 1.15;
    pq.classList.toggle('landscape', landscape);
    const sideMin = landscape
      ? Math.max(170, Math.min(240, W * 0.22))
      : Math.max(150, Math.min(180, H * 0.24));
    let S = landscape
      ? Math.min(H - logH, W - 2 * (sideMin + gap))
      : Math.min(W, H - logH - 2 * (sideMin + gap));
    S = Math.max(110, S);
    let k = S / native;
    // Escala inteira/meia mantém os pixels nítidos; em telas pequenas,
    // vale mais o tabuleiro grande do que a escala exata.
    k = k >= 3 ? Math.floor(k * 2) / 2 : k >= 1 ? Math.floor(k * 4) / 4 : k;
    const size = Math.floor(native * k);
    pq.style.setProperty('--board', `${size}px`);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
  };
  run();
  holder.ro?.disconnect();
  holder.ro = new ResizeObserver(run);
  holder.ro.observe(pq);
}

/** Cor do fundo (mesma tela) acompanha quem está na vez. */
export function setTurnColor(color) {
  const t = TEAM[color] || TEAM.azul;
  document.documentElement.style.setProperty('--turn-bg', t.dark);
  document.documentElement.style.setProperty('--turn', t.base);
}

/**
 * Painel de um jogador.
 *   stats: [{ icon, label, value }]  tags: [{ text, kind }]
 */
export function playerPanel({ color, name, turn = false, me = false, out = false, tags = [], stats = [], controls = null, flipped = false, icon = null }) {
  return h('section', {
    class: ['pq-panel', `team-${color}`, turn ? 'is-turn' : '', out ? 'is-out' : '',
      controls ? 'has-controls' : '', flipped ? 'flipped' : ''].join(' '),
  },
  h('header', { class: 'pq-panel-head' },
    h('span', { class: 'pq-who' },
      turn ? h('span', { class: 'pq-arrow', 'aria-hidden': 'true' }, '▶') : null,
      icon || pawnIcon(color),
      h('span', { class: 'pq-name' }, name),
      me ? h('span', { class: 'pq-tag me' }, 'VOCÊ') : null,
      tags.map((t) => h('span', { class: `pq-tag ${t.kind || ''}` }, t.text))),
    h('span', { class: 'pq-stats' }, stats.map((s) => stat(s.icon, s.label, s.value)))),
  controls);
}

/** Painel de quem só assiste (sem peças). */
export function spectatorPanel(controls) {
  return h('section', { class: 'pq-panel has-controls spectator' }, controls);
}

export function stat(icon, label, value) {
  return h('span', { class: 'pq-stat', title: label, 'aria-label': `${label}: ${value}` },
    statIcon(icon), h('b', {}, value));
}

const ICONS = {
  cativeiro: [
    '..KKK..',
    '.KFFFK.',
    '.KF.FK.',
    'KKKKKKK',
    'KGGGGGK',
    'KGGKGGK',
    'KGGKGGK',
    'KGGGGGK',
    'KKKKKKK',
  ],
  board: [
    'KKKKKKKKK',
    'KF.F.F.FK',
    'KFFFFFFFK',
    'KF.F.F.FK',
    'KFFFFFFFK',
    'KF.F.F.FK',
    'KFFFFFFFK',
    'KF.F.F.FK',
    'KKKKKKKKK',
  ],
  reserva: [
    '.........',
    '.KKKKKKK.',
    '.KWWWWWK.',
    '.KWWWWWK.',
    '.KWWWFFK.',
    '.KWWWFFK.',
    '.KWWFFFK.',
    '.KKKKKKK.',
    '.........',
  ],
  pedra: [
    '..KKKKK..',
    '.KWWWWWK.',
    'KWWWWWWFK',
    'KWWWWWWFK',
    'KWWWWWFFK',
    'KWWWWFFFK',
    '.KFFFFFK.',
    '..KKKKK..',
    '.........',
  ],
  dama: [
    'G.G.G.G..',
    'GGGGGGG..',
    'KGGGGGK..',
    '..KKKKK..',
    '.KWWWWWK.',
    'KWWWWWWFK',
    'KWWWWWFFK',
    '.KFFFFFK.',
    '..KKKKK..',
  ],
  trofeu: [
    'GGGGGGGGG',
    'GKGGGGGKG',
    'GKGGGGGKG',
    '.GGGGGGG.',
    '..GGGGG..',
    '...GGG...',
    '....G....',
    '..GGGGG..',
    '.KKKKKKK.',
  ],
};

export function statIcon(kind) {
  const c = pixelCanvas(9, 9, 'pq-icon');
  const g = c.getContext('2d');
  const sprite = ICONS[kind] || ICONS.reserva;
  drawSprite(g, sprite, 0, 0, { K: PAL.ink, F: PAL.fog, G: PAL.gold, W: PAL.white });
  return c;
}

export function pawnIcon(color) {
  const c = pixelCanvas(PAWN_W, PAWN_H, 'pq-pawn-icon');
  drawPawn(c.getContext('2d'), 0, 0, color);
  return c;
}

export function btn(label, onclick, cls = '', disabled = false) {
  return h('button', { class: `px-btn ${cls}`, onclick, disabled }, label);
}

/** Linha de registro (última jogada) + botão de ajuda. */
export function logBar(lines, help) {
  const last = lines[lines.length - 1] || '';
  return h('div', { class: 'pq-log' },
    h('p', { class: 'pq-log-line', title: lines.slice(-4).join('\n') }, last),
    h('button', { class: 'px-btn small', onclick: () => openHelp(help), 'aria-label': 'Como jogar' }, '?'));
}

/** Janela "Como jogar". help = { title, items: [texto ou nós] } */
export function openHelp(help) {
  document.getElementById('pq-help')?.remove();
  const dlg = h('dialog', { id: 'pq-help', class: 'pq-dialog' },
    h('h2', {}, help.title || 'Como jogar'),
    h('ul', {}, help.items.map((it) => h('li', {}, it))),
    h('form', { method: 'dialog' }, h('button', { class: 'px-btn primary' }, 'Entendi')));
  document.body.append(dlg);
  dlg.showModal();
}
