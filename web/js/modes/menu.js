// MENU DO APP: no aparelho que tem o app, dá para jogar de dois jeitos.
//   - Mesma tela: todos no mesmo aparelho (igual ao GitHub Pages).
//   - Sala Wi-Fi: este aparelho cria a sala e os amigos entram pelo navegador.
import { h, mount } from '../ui/dom.js';
import { startLocal } from './local.js';
import { startHost } from './host.js';

export function startAppMenu(root, env, setBadge) {
  function menu() {
    setBadge('Menu');
    mount(root, h('section', { class: 'card menu' },
      h('h2', {}, 'Como vão jogar?'),
      choice('Mesma tela', 'Todos no mesmo aparelho, passando a vez.', () => {
        setBadge('Mesma tela');
        startLocal(root, { inApp: true, onExit: menu });
      }),
      choice('Sala Wi-Fi', 'Cada um no seu celular. Os amigos entram pelo navegador, sem instalar nada.', () => {
        setBadge('Criador da sala');
        startHost(root, env, { onExit: menu });
      })));
  }
  menu();
}

function choice(title, text, onclick) {
  return h('button', { class: 'menu-choice', onclick },
    h('span', { class: 'menu-title' }, title),
    h('span', { class: 'menu-text' }, text));
}
