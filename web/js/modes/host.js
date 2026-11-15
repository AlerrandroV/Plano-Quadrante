// MODO HOST (app Android, ou servidor de desenvolvimento no PC).
// Este aparelho cria a sala, mostra o QR code e é a "autoridade" do jogo:
// guarda o estado, valida as jogadas e envia a cada jogador o que ele pode ver.
import { game } from '../game/index.js';
import { connectRelay } from '../net/relay-client.js';
import { h, mount, store } from '../ui/dom.js';

const HOST_ID = 'host';
const SAVE_KEY = 'pq-host-save';

export function startHost(root, env) {
  let info = env.server;
  let hostName = store.get('pq-name', 'Anfitrião');
  const clients = new Map(); // id -> { name, online }
  let state = null;          // estado do jogo (null = no lobby)
  const statusEl = h('span', { class: 'status' });

  restore();

  const relay = connectRelay({
    role: 'host',
    onStatus: (s) => setStatus(s),
    onMessage: handleRelay,
  });

  // ---------------- rede ----------------
  function handleRelay(msg) {
    switch (msg.t) {
      case 'clients':
        for (const c of clients.values()) c.online = false;
        for (const c of msg.list) clients.set(c.id, { name: clean(c.name), online: true });
        break;
      case 'join':
        clients.set(msg.id, { name: clean(msg.name) || clients.get(msg.id)?.name || 'Jogador', online: true });
        break;
      case 'leave': {
        const c = clients.get(msg.id);
        if (!c) return;
        if (state && inGame(msg.id)) c.online = false;
        else clients.delete(msg.id);
        break;
      }
      case 'msg':
        handlePlayer(msg.id, msg.data);
        break;
      default:
        return;
    }
    syncAll();
  }

  function handlePlayer(id, data) {
    if (!data || typeof data !== 'object') return;
    const c = clients.get(id);
    if (!c) return;
    if (data.type === 'hello' && typeof data.name === 'string') {
      c.name = clean(data.name) || c.name;
      if (state) state = renameInGame(state, id, c.name);
    } else if (data.type === 'action' && state) {
      applyAction(id, data.action);
    }
  }

  function applyAction(playerId, action) {
    const next = game.act(state, playerId, action);
    if (!next) return;
    state = next;
    persist();
  }

  function syncAll() {
    for (const id of clients.keys()) syncOne(id);
    draw();
  }

  function syncOne(id) {
    if (!clients.get(id)?.online) return;
    if (state) {
      relay.send({ t: 'send', to: id, data: { type: 'state', you: id, view: game.view(state, inGame(id) ? id : null) } });
    } else {
      relay.send({ t: 'send', to: id, data: { type: 'lobby', you: id, players: lobbyPlayers() } });
    }
  }

  // ---------------- lógica da sala ----------------
  function lobbyPlayers() {
    return [{ id: HOST_ID, name: hostName, host: true },
      ...[...clients].filter(([, c]) => c.online).map(([id, c]) => ({ id, name: c.name }))];
  }

  function inGame(id) {
    return !!state?.players?.some((p) => p.id === id);
  }

  function startGame() {
    const players = lobbyPlayers().slice(0, game.meta.maxPlayers);
    state = game.setup(players.map(({ id, name }) => ({ id, name })));
    persist();
    syncAll();
  }

  function backToLobby() {
    if (!confirm('Encerrar a partida e voltar à sala?')) return;
    state = null;
    for (const [id, c] of clients) if (!c.online) clients.delete(id);
    persist();
    syncAll();
  }

  // Se a página do host recarregar (ex.: app voltou do segundo plano),
  // recupera a partida em andamento.
  function persist() {
    store.set(SAVE_KEY, JSON.stringify({ at: Date.now(), state }));
  }
  function restore() {
    try {
      const saved = JSON.parse(store.get(SAVE_KEY, 'null'));
      if (saved && saved.state && Date.now() - saved.at < 30 * 60 * 1000) {
        state = saved.state;
        for (const p of state.players) if (p.id !== HOST_ID) clients.set(p.id, { name: p.name, online: false });
      }
    } catch { /* ignora */ }
  }

  // ---------------- interface ----------------
  function setStatus(s) {
    statusEl.textContent = s === 'open' ? '● Sala aberta' : s === 'reconnecting' ? '● Reconectando…' : '● Abrindo sala…';
    statusEl.className = 'status ' + s;
  }

  function draw() {
    if (state) drawGame();
    else drawLobby();
  }

  function drawLobby() {
    const urls = info?.lanUrls ?? [];
    const nameInput = h('input', {
      type: 'text', maxLength: 20, value: hostName, 'aria-label': 'Seu nome',
      onchange: (e) => { hostName = clean(e.target.value) || 'Anfitrião'; store.set('pq-name', hostName); syncAll(); },
    });
    const players = lobbyPlayers();
    const canStart = players.length >= game.meta.minPlayers;

    mount(root,
      h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Sua sala'), statusEl),
        urls.length
          ? [
            h('p', {}, 'Os amigos devem estar ', h('strong', {}, 'no mesmo Wi-Fi'),
              ' (ou no seu hotspot) e ler o QR code, ou digitar o endereço no navegador:'),
            qr(urls[0]),
            h('p', { class: 'address' }, urls[0]),
            urls.length > 1 ? h('details', {}, h('summary', {}, 'Outros endereços'), h('ul', {}, urls.slice(1).map((u) => h('li', {}, u)))) : null,
          ]
          : h('p', { class: 'warn' }, 'Nenhuma rede encontrada. Conecte-se a um Wi-Fi ou ligue o hotspot do celular e toque em "Atualizar endereço".'),
        h('button', { class: 'btn ghost', onclick: refreshInfo }, 'Atualizar endereço')),
      h('section', { class: 'card' },
        h('label', { class: 'field' }, h('span', {}, 'Seu nome'), nameInput),
        h('h3', {}, `Jogadores (${players.length})`),
        h('ul', { class: 'player-list' }, players.map((p) => h('li', {}, p.name, p.host ? h('span', { class: 'tag' }, 'você') : null))),
        players.length > game.meta.maxPlayers ? h('p', { class: 'warn' }, `Máximo de ${game.meta.maxPlayers} jogadores; os últimos a entrar vão assistir.`) : null,
        !canStart ? h('p', { class: 'muted' }, `Aguardando jogadores (mínimo ${game.meta.minPlayers}).`) : null,
        h('button', { class: 'btn wide', disabled: !canStart, onclick: startGame }, 'Começar partida')));
  }

  function drawGame() {
    const area = h('section', { class: 'game' });
    const offline = state.players.filter((p) => p.id !== HOST_ID && !clients.get(p.id)?.online);
    mount(root,
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn ghost', onclick: backToLobby }, '< Sala'),
        statusEl),
      offline.length ? h('p', { class: 'warn' }, `Desconectado: ${offline.map((p) => p.name).join(', ')}`) : null,
      area);
    game.render(area, game.view(state, HOST_ID), {
      me: HOST_ID, shared: false,
      send(action) { applyAction(HOST_ID, action); syncAll(); },
    });
  }

  async function refreshInfo() {
    try {
      const res = await fetch('pq-info.json', { cache: 'no-store' });
      info = await res.json();
    } catch { /* mantém o anterior */ }
    draw();
  }

  setStatus('connecting');
  draw();
}

function clean(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

function renameInGame(state, id, name) {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, name } : p)) };
}

function qr(text) {
  /* global qrcode */
  if (typeof qrcode !== 'function') return null;
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const wrap = h('div', { class: 'qr' });
  wrap.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  return wrap;
}
