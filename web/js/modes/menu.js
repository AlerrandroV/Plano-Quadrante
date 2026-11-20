// MENU DO APP: no aparelho que tem o app, dá para jogar de três jeitos.
//   - Mesma tela: todos no mesmo aparelho (igual ao GitHub Pages).
//   - Criar sala Wi-Fi: este aparelho cria a sala; os amigos entram pelo
//     navegador (QR code) ou pelo app (código de 4 dígitos).
//   - Entrar numa sala: acha as salas abertas na rede (de outros celulares
//     com o app) e entra; ou digita o código de 4 dígitos.
import { h, mount } from '../ui/dom.js';
import { startLocal } from './local.js';
import { startHost } from './host.js';
import { appBridge } from '../env.js';
import { sfx } from '../ui/sound.js';

export function startAppMenu(root, env, setBadge) {
  const bridge = appBridge();
  const canScan = !!bridge && typeof bridge.startScan === 'function';

  function menu() {
    setBadge('Menu');
    mount(root, h('section', { class: 'card menu' },
      h('h2', {}, 'Como vão jogar?'),
      choice('Mesma tela', 'Todos no mesmo aparelho, passando a vez.', () => {
        setBadge('Mesma tela');
        startLocal(root, { inApp: true, onExit: menu });
      }),
      choice('Criar sala Wi-Fi', 'Cada um no seu celular. Os amigos entram pelo navegador ou pelo app.', () => {
        setBadge('Sala');
        startHost(root, env, { onExit: menu });
      }),
      canScan ? choice('Entrar numa sala', 'Alguém já criou a sala? Ache ela aqui ou digite o código de 4 dígitos.', () => {
        setBadge('Entrar');
        joinScreen(root, bridge, menu);
      }) : null));
  }
  menu();
}

function choice(title, text, onclick) {
  return h('button', { class: 'menu-choice', onclick },
    h('span', { class: 'menu-title' }, title),
    h('span', { class: 'menu-text' }, text));
}

/** Procura salas na rede (anúncios dos outros apps) e entra pelo código. */
function joinScreen(root, bridge, back) {
  bridge.startScan();
  const started = Date.now();
  let joined = false;
  const list = h('ul', { class: 'room-list' });
  const status = h('p', { class: 'muted scan-status' }, 'Procurando salas na rede…');
  const code = h('input', {
    type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxLength: 4, autocomplete: 'off',
    class: 'code-input', placeholder: '0000', 'aria-label': 'Código da sala (4 dígitos)',
    oninput: () => { code.value = code.value.replace(/\D/g, '').slice(0, 4); tick(); },
  });

  const leave = () => { clearInterval(timer); bridge.stopScan(); back(); };
  const enter = (room) => {
    if (joined) return;
    joined = true;
    clearInterval(timer);
    sfx('select');
    bridge.join(room.url);
  };

  function tick() {
    if (!list.isConnected) { clearInterval(timer); return; }
    let rooms = [];
    try { rooms = JSON.parse(bridge.rooms()); } catch { /* ignora */ }
    const typed = code.value;
    if (typed.length === 4) {
      const match = rooms.find((r) => r.code === typed);
      if (match) return enter(match);
      status.textContent = `Procurando a sala ${typed}…`;
    } else {
      status.textContent = rooms.length ? 'Toque numa sala para entrar:' : 'Procurando salas na rede…';
    }
    if (!rooms.length && Date.now() - started > 8000) {
      status.textContent = 'Nenhuma sala encontrada. Confira se vocês estão no mesmo Wi-Fi (ou no hotspot de quem criou a sala).';
    }
    mount(list, rooms.map((r) => h('li', {},
      h('button', { class: 'room-item', onclick: () => enter(r) },
        h('span', { class: 'room-code' }, r.code),
        h('span', { class: 'room-info' },
          h('strong', {}, r.info?.name || 'Sala'),
          h('span', {}, [r.info?.game, r.info?.count ? `${r.info.count} na sala` : null].filter(Boolean).join(' · '))),
        h('span', { class: 'px-btn small primary' }, 'Entrar')))));
  }

  mount(root,
    h('div', { class: 'toolbar' }, h('button', { class: 'px-btn small', onclick: leave }, '< Menu')),
    h('section', { class: 'card join-card' },
      h('h2', {}, 'Entrar numa sala'),
      h('label', { class: 'field' }, h('span', {}, 'Código da sala'), code),
      status,
      list));
  const timer = setInterval(tick, 1000);
  tick();
}
