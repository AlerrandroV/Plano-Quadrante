// MODO MESMA TELA (GitHub Pages / site estático).
// Todos jogam no mesmo aparelho, passando a vez. Oferece o APK para
// quem quiser jogar cada um no seu celular.
import { game } from '../game/index.js';
import { h, mount, randomId, store } from '../ui/dom.js';
import { apkDownloadUrl } from '../env.js';

export function startLocal(root) {
  let names = loadNames();

  function setupScreen() {
    const list = h('ol', { class: 'name-list' });
    const input = h('input', {
      type: 'text', maxLength: 20, placeholder: 'Nome do jogador', autocomplete: 'off',
      'aria-label': 'Nome do jogador',
    });
    const startBtn = h('button', { class: 'btn wide', onclick: start }, 'Começar');

    function redraw() {
      mount(list, names.map((n, i) => h('li', {},
        h('span', {}, n),
        h('button', { class: 'icon-btn', 'aria-label': `Remover ${n}`, onclick: () => { names.splice(i, 1); save(); redraw(); } }, '✕'))));
      startBtn.disabled = names.length < Math.max(1, game.meta.minPlayers);
      input.disabled = names.length >= game.meta.maxPlayers;
    }
    function add(e) {
      e.preventDefault();
      const n = input.value.trim().slice(0, 20);
      if (!n || names.length >= game.meta.maxPlayers) return;
      names.push(n); input.value = ''; save(); redraw(); input.focus();
    }
    function save() { store.set('pq-local-names', JSON.stringify(names)); }

    redraw();
    mount(root,
      h('section', { class: 'card' },
        h('h2', {}, 'Jogar na mesma tela'),
        h('p', { class: 'muted' }, 'Adicione os jogadores. Vocês passam o aparelho a cada vez.'),
        h('form', { class: 'row', onsubmit: add }, input, h('button', { class: 'btn', type: 'submit' }, 'Adicionar')),
        list,
        startBtn),
      apkBanner());
  }

  function start() {
    let state = game.setup(names.map((name) => ({ id: randomId(), name })));
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
        h('button', { class: 'btn ghost', onclick: () => { if (confirm('Sair da partida?')) setupScreen(); } }, '← Sair')),
      area);
    draw();
  }

  setupScreen();
}

function loadNames() {
  try {
    const v = JSON.parse(store.get('pq-local-names', '[]'));
    if (Array.isArray(v) && v.length) return v.filter((n) => typeof n === 'string').slice(0, 12);
  } catch { /* ignora */ }
  return ['Jogador 1', 'Jogador 2'];
}

function apkBanner() {
  const { apk, releases } = apkDownloadUrl();
  return h('aside', { class: 'card apk-banner' },
    h('h2', {}, '📱 Cada um no seu celular?'),
    h('p', {},
      'Baixe o app Android. Quem cria a sala precisa do app; os amigos ',
      h('strong', {}, 'só abrem o navegador'),
      ' (Android ou iPhone) na mesma rede Wi-Fi, ou no hotspot do criador, e leem o QR code.'),
    h('a', { class: 'btn wide', href: apk, download: '' }, 'Baixar o app (APK)'),
    h('p', { class: 'small muted' },
      'Ao instalar, o Android pode pedir para permitir "fontes desconhecidas". ',
      h('a', { href: releases, target: '_blank', rel: 'noopener' }, 'Ver versões'),
      '.'));
}
