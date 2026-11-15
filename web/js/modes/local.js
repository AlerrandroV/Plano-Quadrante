// MODO MESMA TELA (GitHub Pages / site estático, ou pelo menu do app).
// Todos jogam no mesmo aparelho, em volta da mesa. No site, oferece o APK
// para quem quiser jogar cada um no seu celular.
import { game } from '../game/index.js';
import { h, mount, randomId, store } from '../ui/dom.js';
import { apkDownloadUrl } from '../env.js';
import { fullscreenButton, leaveFocus } from '../ui/fullscreen.js';

const COLOR_LABEL = { azul: 'Azul', vermelho: 'Vermelho', verde: 'Verde', laranja: 'Laranja' };
const SEAT_HINT = { azul: 'em cima', vermelho: 'em cima', verde: 'embaixo', laranja: 'embaixo' };

export function startLocal(root, { inApp = false, onExit = null } = {}) {
  let count = Number(store.get('pq-local-count', '2'));
  if (![2, 3, 4].includes(count)) count = 2;
  const names = loadNames();

  function setupScreen() {
    leaveFocus();
    const seats = game.seatsFor(count);
    const inputs = seats.map((color, i) => h('label', { class: `seat team-${color}` },
      h('span', { class: 'seat-color' }, `${COLOR_LABEL[color]} · ${SEAT_HINT[color]}`),
      h('input', {
        type: 'text', maxLength: 16, value: names[color] || '', placeholder: COLOR_LABEL[color],
        'aria-label': `Nome do jogador ${COLOR_LABEL[color]}`,
        oninput: (e) => { names[color] = e.target.value; store.set('pq-local-names2', JSON.stringify(names)); },
      }),
      h('span', { class: 'sr-only' }, `jogador ${i + 1}`)));

    mount(root,
      onExit ? h('div', { class: 'toolbar' }, h('button', { class: 'px-btn small', onclick: onExit }, '< Menu')) : null,
      h('div', { class: 'setup' },
      h('section', { class: 'card' },
        h('h2', {}, 'Mesma tela'),
        h('p', { class: 'muted' }, 'Aparelho no meio da mesa: os painéis de cima ficam virados para quem senta do outro lado.'),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Número de jogadores' },
          h('span', { class: 'seg-label', 'aria-hidden': 'true' }, 'Jogadores'),
          [2, 3, 4].map((n) => h('button', {
            class: 'px-btn' + (n === count ? ' primary' : ''), 'aria-pressed': n === count ? 'true' : 'false',
            onclick: () => { count = n; store.set('pq-local-count', String(n)); setupScreen(); },
            'aria-label': `${n} jogadores`,
          }, String(n)))),
        h('div', { class: 'seats' }, inputs),
        h('button', { class: 'px-btn primary wide', onclick: start }, 'Começar')),
      inApp ? null : apkBanner()));
  }

  function start() {
    const seats = game.seatsFor(count);
    let state = game.setup(seats.map((color) => ({
      id: randomId(), name: (names[color] || '').trim().slice(0, 16) || COLOR_LABEL[color],
    })));
    const area = h('section', { class: 'game' });

    function draw() {
      const me = game.activePlayers(state)[0] ?? state.players[0].id;
      game.render(area, game.view(state, me), {
        me, shared: true,
        send(action) {
          const next = game.act(state, me, action);
          if (next) { state = next; draw(); }
        },
      });
    }

    mount(root,
      h('div', { class: 'toolbar' },
        h('button', { class: 'px-btn small', onclick: () => { if (confirm('Sair da partida?')) setupScreen(); } }, '< Sair'),
        fullscreenButton()),
      area);
    draw();
  }

  setupScreen();
}

function loadNames() {
  try {
    const v = JSON.parse(store.get('pq-local-names2', '{}'));
    if (v && typeof v === 'object') return v;
  } catch { /* ignora */ }
  return {};
}

function apkBanner() {
  const { apk, releases } = apkDownloadUrl();
  return h('aside', { class: 'card apk-banner' },
    h('p', {},
      h('strong', { class: 'gold' }, 'Cada um no seu celular? '),
      'Só quem cria a sala instala o app; os amigos entram pelo navegador, no mesmo Wi-Fi. ',
      h('a', { href: releases, target: '_blank', rel: 'noopener' }, 'Versões')),
    h('a', { class: 'px-btn primary', href: apk, download: '' }, 'Baixar app'));
}
