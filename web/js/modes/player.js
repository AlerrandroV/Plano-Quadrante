// MODO JOGADOR: navegador de um amigo que abriu o endereço da sala.
// Não precisa instalar nada. Só mostra o que o host manda e envia jogadas.
import { game } from '../game/index.js';
import { connectRelay } from '../net/relay-client.js';
import { h, mount, randomId, store } from '../ui/dom.js';
import { fullscreenButton } from '../ui/fullscreen.js';

export function startPlayer(root) {
  // O id fica salvo: se a tela apagar ou a página recarregar,
  // o jogador volta para o mesmo lugar na partida.
  let id = store.get('pq-id');
  if (!id) { id = randomId(); store.set('pq-id', id); }

  const saved = store.get('pq-name');
  if (saved) join(saved);
  else askName();

  function askName() {
    const input = h('input', { type: 'text', maxLength: 20, placeholder: 'Seu nome', autocomplete: 'nickname', 'aria-label': 'Seu nome', required: true });
    mount(root, h('section', { class: 'card' },
      h('h2', {}, 'Entrar na sala'),
      h('form', {
        class: 'row',
        onsubmit: (e) => {
          e.preventDefault();
          const n = input.value.replace(/\s+/g, ' ').trim().slice(0, 20);
          if (!n) return;
          store.set('pq-name', n);
          join(n);
        },
      }, input, h('button', { class: 'btn', type: 'submit' }, 'Entrar'))));
    input.focus();
  }

  function join(name) {
    const statusEl = h('span', { class: 'status connecting' }, '● Conectando…');
    const area = h('div', { class: 'stage' });
    let last = null;

    const relay = connectRelay({
      role: 'player', id, name,
      onStatus(s) {
        statusEl.className = 'status ' + s;
        statusEl.textContent = s === 'open' ? '● Conectado' : s === 'reconnecting' ? '● Reconectando…' : '● Conectando…';
      },
      onMessage(msg) {
        if (msg.type === '_host-offline') {
          mount(area, h('section', { class: 'card center' },
            h('h2', {}, 'O criador da sala saiu'),
            h('p', { class: 'muted' }, 'Aguardando ele voltar… Se não voltar, peça um novo QR code.')));
          return;
        }
        if (msg.type === '_full') {
          mount(area, h('section', { class: 'card center' }, h('h2', {}, 'Sala cheia')));
          return;
        }
        last = msg;
        draw();
      },
    });

    function draw() {
      if (!last) return;
      if (last.type === 'lobby') {
        mount(area, h('section', { class: 'card' },
          h('h2', {}, 'Na sala!'),
          h('p', { class: 'muted' }, 'Esperando o criador da sala começar a partida…'),
          h('ul', { class: 'player-list' }, last.players.map((p) =>
            h('li', {}, p.name, p.id === id ? h('span', { class: 'tag' }, 'você') : null, p.host ? h('span', { class: 'tag' }, 'sala') : null)))));
      } else if (last.type === 'state') {
        const g = h('section', { class: 'game' });
        mount(area, g);
        game.render(g, last.view, {
          me: last.you, shared: false,
          send: (action) => relay.send({ type: 'action', action }),
        });
      }
    }

    mount(root,
      h('div', { class: 'toolbar' },
        h('button', {
          class: 'btn ghost',
          onclick: () => {
            const n = prompt('Seu nome:', store.get('pq-name', ''));
            const clean = n?.replace(/\s+/g, ' ').trim().slice(0, 20);
            if (clean) { store.set('pq-name', clean); relay.send({ type: 'hello', name: clean }); }
          },
        }, 'Nome'),
        h('span', { class: 'tools' }, statusEl, fullscreenButton())),
      area);
  }
}
