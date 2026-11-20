// MODO JOGADOR: navegador de um amigo que abriu o endereço da sala.
// Não precisa instalar nada. Mostra o que o mestre da sala manda (sala de
// espera ou partida) e envia jogadas. Quem não está na partida assiste.
import { connectRelay } from '../net/relay-client.js';
import { h, mount, randomId, store } from '../ui/dom.js';
import { menuButton } from '../ui/fullscreen.js';
import { askText } from '../ui/modal.js';
import { getGame, capacityText, optionsText } from '../games/index.js';
import { colorPicker, gameArt, scoreboard, openScoreboard, pawnBadge } from '../ui/platform.js';
import { isColor } from '../ui/colors.js';

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
    let scores = [];
    const wantColor = () => (isColor(store.get('pq-color')) ? store.get('pq-color') : null);
    const hello = () => relay.send({ type: 'hello', name: store.get('pq-name', name), color: wantColor() });

    const relay = connectRelay({
      role: 'player', id, name,
      onStatus(s) {
        statusEl.className = 'status ' + s;
        statusEl.textContent = s === 'open' ? '● Conectado' : s === 'reconnecting' ? '● Reconectando…' : '● Conectando…';
        if (s === 'open') hello(); // reenvia nome e cor a cada (re)conexão
      },
      onMessage(msg) {
        if (msg.type === '_host-offline') {
          mount(area, h('section', { class: 'card center' },
            h('h2', {}, 'O mestre da sala saiu'),
            h('p', { class: 'muted' }, 'Aguardando ele voltar… Se não voltar, peça um novo QR code.')));
          return;
        }
        if (msg.type === '_full') {
          mount(area, h('section', { class: 'card center' }, h('h2', {}, 'Sala cheia')));
          return;
        }
        if (msg.scores) scores = msg.scores;
        last = msg;
        draw();
      },
    });

    function draw() {
      if (!last) return;
      if (last.type === 'lobby') drawLobby(last);
      else if (last.type === 'state') drawGame(last);
    }

    function drawLobby(msg) {
      const game = getGame(msg.gameId);
      const me = msg.members.find((m) => m.id === msg.you);
      const taken = msg.members.filter((m) => m.id !== msg.you).map((m) => m.color);
      // Dois cartões (lado a lado quando couber): o jogo e a sua cor | quem está na sala.
      mount(area, h('div', { class: 'lobby' },
        h('section', { class: 'card' },
          h('h2', {}, 'Na sala!'),
          game ? h('div', { class: 'setup-head' }, gameArt(game, 'game-art small'),
            h('div', {}, h('strong', { class: 'gold' }, game.name),
              h('p', { class: 'muted' }, game.options ? optionsText(game, msg.options) : capacityText(game)))) : null,
          h('p', { class: 'muted' }, me?.role === 'play'
            ? 'Você vai jogar. Esperando o mestre da sala começar…'
            : 'Você vai assistir. O mestre da sala decide quem joga.'),
          h('span', { class: 'seat-color' }, 'Cor das suas peças'),
          colorPicker({
            value: me?.color, taken,
            onPick: (c) => { store.set('pq-color', c); hello(); },
          })),
        h('section', { class: 'card' },
          h('h2', {}, `Na sala (${msg.members.length})`),
          h('ul', { class: 'member-list' }, msg.members.map((m) => h('li', { class: `team-${m.color}` },
            pawnBadge(m.color),
            h('span', { class: 'member-name' }, m.name,
              m.id === msg.you ? h('span', { class: 'tag' }, 'você') : null,
              m.host ? h('span', { class: 'tag' }, 'mestre') : null),
            h('span', { class: 'role-tag ' + m.role }, m.role === 'play' ? 'Joga' : 'Assiste'))))),
        scores.length ? scoreboard(scores) : null));
    }

    function drawGame(msg) {
      const game = getGame(msg.gameId);
      if (!game) return;
      const g = h('section', { class: 'game' });
      mount(area, g);
      game.render(g, msg.view, {
        me: msg.playing ? msg.you : null, shared: false,
        send: (action) => relay.send({ type: 'action', action }),
      });
    }

    const rename = async () => {
      const clean = await askText('Seu nome', store.get('pq-name', ''));
      if (clean) { store.set('pq-name', clean); hello(); }
    };
    mount(root,
      h('div', { class: 'toolbar' },
        statusEl,
        menuButton([
          { label: 'Trocar meu nome', onClick: rename },
          { label: 'Placar da sala', onClick: () => openScoreboard(scores) },
        ])),
      area);
  }
}
