// SALA (app Android, ou servidor de desenvolvimento no PC).
// Este aparelho é o MESTRE DA SALA: mostra o QR code, escolhe o jogo,
// decide quem joga e quem assiste, guarda o placar e é a "autoridade" da
// partida (valida as jogadas e envia a cada um o que ele pode ver).
import { connectRelay } from '../net/relay-client.js';
import { h, mount, store } from '../ui/dom.js';
import { fullscreenButton, leaveFocus } from '../ui/fullscreen.js';
import { GAMES, getGame } from '../games/index.js';
import { catalog, colorButton, gameArt, scoreboard, openScoreboard, recordResult, pawnBadge } from '../ui/platform.js';
import { firstFree, isColor } from '../ui/colors.js';
import { BOT_LEVELS, levelLabel, hasBot } from '../bots/index.js';
import { botDriver } from '../bots/driver.js';

const HOST_ID = 'host';
const SAVE_KEY = 'pq-room';

export function startHost(root, env, { onExit = null } = {}) {
  let info = env.server;
  const host = { id: HOST_ID, name: store.get('pq-name', 'Mestre'), color: store.get('pq-color', 'azul'), role: 'play', online: true, host: true };
  const clients = new Map(); // id -> { id, name, color, role, online }
  const robots = new Map();  // id -> { id, name, color, role, online: true, bot: nível }
  let gameId = store.get('pq-room-game', GAMES[0].id);
  let match = null;          // { gameId, state, recorded }
  const scores = new Map();  // id -> { id, name, color, wins, games }
  let tab = 'convidar';
  let exited = false;
  const statusEl = h('span', { class: 'status' });

  restore();

  // Os robôs da sala rodam AQUI, no aparelho do mestre.
  let driver = null;
  function kickBots() {
    if (!match) { driver?.stop(); driver = null; return; }
    if (!driver || driver.gameId !== match.gameId) {
      driver?.stop();
      const bots = new Map([...robots.values()].map((r) => [r.id, r.bot]));
      driver = botDriver({
        gameId: match.gameId, bots,
        getState: () => match?.state,
        apply: (id, action) => { if (match) { applyAction(id, action); syncAll(); } },
      });
      driver.gameId = match.gameId;
    }
    driver.kick();
  }

  function addRobot(level) {
    const n = [...robots.values()].filter((r) => r.bot === level).length + 1;
    const id = `robo-${level}-${Date.now().toString(36)}`;
    const r = { id, name: `Robô ${levelLabel(level)}${n > 1 ? ` ${n}` : ''}`, color: null, role: defaultRole(), online: true, bot: level };
    r.color = firstFree(takenBy(id));
    robots.set(id, r);
  }

  const relay = connectRelay({ role: 'host', onStatus: setStatus, onMessage: handleRelay });

  // ------------------------------------------------------------ membros
  const members = () => [host, ...clients.values(), ...robots.values()];
  const online = () => members().filter((m) => m.online);
  const game = () => getGame(gameId) || GAMES[0];
  const takenBy = (id) => members().filter((m) => m.id !== id && m.online).map((m) => m.color);
  const inMatch = (id) => !!match?.state.players.some((p) => p.id === id);

  function defaultRole() {
    const playing = online().filter((m) => m.role === 'play').length;
    return !match && playing < game().meta.maxPlayers ? 'play' : 'watch';
  }

  // --------------------------------------------------------------- rede
  function handleRelay(msg) {
    switch (msg.t) {
      case 'clients':
        for (const c of clients.values()) c.online = false;
        for (const c of msg.list) join(c.id, c.name);
        break;
      case 'join':
        join(msg.id, msg.name);
        break;
      case 'leave': {
        const c = clients.get(msg.id);
        if (!c) return;
        c.online = false;
        if (!inMatch(msg.id) && !scores.has(msg.id)) clients.delete(msg.id);
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

  function join(id, name) {
    const known = clients.get(id);
    if (known) { known.online = true; known.name = clean(name) || known.name; return; }
    const c = { id, name: clean(name) || 'Jogador', color: null, role: defaultRole(), online: true };
    c.color = firstFree(takenBy(id));
    clients.set(id, c);
  }

  function handlePlayer(id, data) {
    if (!data || typeof data !== 'object') return;
    const c = clients.get(id);
    if (!c) return;
    if (data.type === 'hello') {
      if (typeof data.name === 'string') c.name = clean(data.name) || c.name;
      // Cor das peças: só se ninguém mais estiver com ela.
      if (isColor(data.color) && !takenBy(id).includes(data.color)) c.color = data.color;
      if (match && inMatch(id) && match.state.phase !== 'over') {
        // Durante a partida, o nome muda, mas a cor fica a da partida.
        match.state = { ...match.state, players: match.state.players.map((p) => (p.id === id ? { ...p, name: c.name } : p)) };
      }
    } else if (data.type === 'action' && match) {
      applyAction(id, data.action);
    }
  }

  function applyAction(playerId, action) {
    const g = getGame(match.gameId);
    const next = g.act(match.state, playerId, action);
    if (!next) return;
    match.state = next;
    const result = g.outcome(next);
    if (result && !match.recorded) {
      recordResult(scores, next.players, result.winners);
      match.recorded = true;
    } else if (!result) {
      match.recorded = false; // "jogar de novo" começou outra partida
    }
    persist();
  }

  function scoreList() {
    return [...scores.values()];
  }

  function syncAll() {
    for (const c of clients.values()) syncOne(c.id);
    persist();
    draw();
    kickBots();
  }

  function syncOne(id) {
    if (!clients.get(id)?.online) return;
    if (match) {
      const g = getGame(match.gameId);
      relay.send({ t: 'send', to: id, data: {
        type: 'state', you: id, gameId: match.gameId, playing: inMatch(id),
        view: g.view(match.state, inMatch(id) ? id : null), scores: scoreList(),
      } });
    } else {
      relay.send({ t: 'send', to: id, data: {
        type: 'lobby', you: id, gameId,
        members: online().map(({ id: mid, name, color, role, host: isHost }) => ({ id: mid, name, color, role, host: !!isHost })),
        scores: scoreList(),
      } });
    }
  }

  /** Troca o jogo; quem passar das vagas do novo jogo passa a assistir. */
  function selectGame(id) {
    gameId = id;
    store.set('pq-room-game', gameId);
    let seats = game().meta.maxPlayers;
    for (const m of online()) {
      if (m.role !== 'play') continue;
      if (seats > 0) seats -= 1;
      else m.role = 'watch';
    }
  }

  // ---------------------------------------------------------- partida
  function lineup() {
    return online().filter((m) => m.role === 'play').slice(0, game().meta.maxPlayers);
  }

  function startMatch() {
    const g = game();
    const players = lineup().map(({ id, name, color }) => ({ id, name, color }));
    if (players.length < g.meta.minPlayers) return;
    match = { gameId: g.id, state: g.setup(players), recorded: false };
    driver?.stop(); driver = null; // robôs da partida nova
    syncAll();
  }

  function backToLobby() {
    if (match && match.state.phase !== 'over' && !getGame(match.gameId).outcome(match.state)
      && !confirm('Encerrar a partida e voltar à sala?')) return;
    match = null;
    for (const [id, c] of clients) if (!c.online && !scores.has(id)) clients.delete(id);
    syncAll();
  }

  // Se a página recarregar (ex.: app voltou do segundo plano), recupera tudo.
  function persist() {
    store.set(SAVE_KEY, JSON.stringify({
      at: Date.now(), gameId, match, scores: scoreList(),
      clients: [...clients.values()].map(({ id, name, color, role }) => ({ id, name, color, role })),
      robots: [...robots.values()],
    }));
  }
  function restore() {
    try {
      const saved = JSON.parse(store.get(SAVE_KEY, 'null'));
      if (!saved || Date.now() - saved.at > 6 * 60 * 60 * 1000) return;
      if (getGame(saved.gameId)) gameId = saved.gameId;
      for (const r of saved.scores || []) scores.set(r.id, r);
      for (const c of saved.clients || []) clients.set(c.id, { ...c, online: false });
      for (const r of saved.robots || []) robots.set(r.id, { ...r, online: true });
      if (saved.match && getGame(saved.match.gameId) && Date.now() - saved.at < 30 * 60 * 1000) match = saved.match;
    } catch { /* ignora */ }
  }

  // ------------------------------------------------------- interface
  function setStatus(s) {
    statusEl.textContent = s === 'open' ? '● Sala aberta' : s === 'reconnecting' ? '● Reconectando…' : '● Abrindo sala…';
    statusEl.className = 'status ' + s;
  }

  function draw() {
    if (exited) return;
    if (match) drawGame();
    else drawLobby();
  }

  function drawLobby() {
    leaveFocus();
    const g = game();
    const urls = info?.lanUrls ?? [];
    const playing = lineup();
    const wanting = online().filter((m) => m.role === 'play').length;
    const canStart = playing.length >= g.meta.minPlayers;

    const invite = h('section', { class: 'card', 'data-sec': 'convidar' },
      h('h2', {}, 'Convidar'),
      urls.length
        ? h('div', { class: 'invite' },
          qr(urls[0]),
          h('div', { class: 'invite-text' },
            h('p', {}, 'Amigos no ', h('strong', {}, 'mesmo Wi-Fi'), ' ou no seu hotspot leem o QR ou digitam:'),
            h('p', { class: 'address' }, urls[0]),
            urls.length > 1 ? h('details', {}, h('summary', {}, 'Outros endereços'), h('ul', {}, urls.slice(1).map((u) => h('li', {}, u)))) : null,
            h('button', { class: 'btn ghost', onclick: refreshInfo }, 'Atualizar endereço')))
        : [h('p', { class: 'warn' }, 'Nenhuma rede encontrada. Conecte-se a um Wi-Fi ou ligue o hotspot e toque em "Atualizar".'),
          h('button', { class: 'btn ghost', onclick: refreshInfo }, 'Atualizar endereço')]);

    const people = h('section', { class: 'card', 'data-sec': 'jogadores' },
      h('h2', {}, 'Jogadores'),
      h('div', { class: 'row' },
        colorButton({ value: host.color, taken: takenBy(HOST_ID), onPick: (c) => { host.color = c; store.set('pq-color', c); syncAll(); } }),
        h('input', {
          type: 'text', maxLength: 20, value: host.name, 'aria-label': 'Seu nome',
          onchange: (e) => { host.name = clean(e.target.value) || 'Mestre'; store.set('pq-name', host.name); syncAll(); },
        })),
      h('ul', { class: 'member-list' }, online().map((m) => h('li', { class: `team-${m.color}` },
        pawnBadge(m.color),
        h('span', { class: 'member-name' }, m.name, m.host ? h('span', { class: 'tag' }, 'mestre') : null),
        h('button', {
          class: 'px-btn small role ' + m.role,
          onclick: () => { m.role = m.role === 'play' ? 'watch' : 'play'; syncAll(); },
          'aria-label': `${m.name}: ${m.role === 'play' ? 'joga' : 'assiste'}. Tocar para trocar.`,
        }, m.role === 'play' ? 'Joga' : 'Assiste'),
        m.bot ? h('button', {
          class: 'icon-btn', 'aria-label': `Remover ${m.name}`,
          onclick: () => { robots.delete(m.id); syncAll(); },
        }, 'X') : null))),
      hasBot(g.id) ? h('div', { class: 'seg add-bot', role: 'group', 'aria-label': 'Adicionar robô' },
        h('span', { class: 'seg-label' }, '+ Robô'),
        BOT_LEVELS.map((l) => h('button', { class: 'px-btn small', onclick: () => { addRobot(l.id); syncAll(); } }, l.label))) : null,
      h('p', { class: 'muted hint' }, 'Toque em Joga/Assiste para decidir quem joga. Quem assiste vê a partida ao vivo.'));

    const pick = h('section', { class: 'card', 'data-sec': 'jogo' },
      h('h2', {}, 'Jogo da vez'),
      catalog({ selectedId: g.id, onPick: (x) => { selectGame(x.id); syncAll(); } }));

    const board = h('div', { 'data-sec': 'placar' },
      scoreboard(scoreList(), { title: 'Placar da sala' }));

    const tabs = [['convidar', 'Convidar'], ['jogadores', `Pessoas ${online().length}`], ['jogo', 'Jogo'], ['placar', 'Placar']];
    const status = !canStart
      ? `${g.name}: ${g.meta.minPlayers - playing.length === 1 ? 'falta 1 jogador' : `faltam ${g.meta.minPlayers - playing.length} jogadores`}.`
      : wanting > g.meta.maxPlayers
        ? `${g.name}: só ${g.meta.maxPlayers} jogam; os outros assistem.`
        : `${g.name} · ${playing.map((p) => p.name).join(' x ')}`;

    mount(root,
      h('div', { class: 'toolbar' },
        onExit ? h('button', { class: 'btn ghost', onclick: exitRoom }, '< Menu') : h('span'),
        statusEl),
      h('nav', { class: 'tabs', 'aria-label': 'Seções da sala' }, tabs.map(([id, label]) => h('button', {
        class: 'tab' + (tab === id ? ' on' : ''), 'aria-pressed': String(tab === id),
        onclick: () => { tab = id; drawLobby(); },
      }, label))),
      h('div', { class: 'lobby room', 'data-tab': tab }, invite, people, pick, board),
      h('div', { class: 'room-footer' },
        gameArt(g, 'game-art tiny'),
        h('p', { class: 'room-status' }, status),
        h('button', { class: 'btn', disabled: !canStart, onclick: startMatch }, 'Começar')));
  }

  function exitRoom() {
    if (clients.size && !confirm('Fechar a sala? Os jogadores conectados vão sair.')) return;
    exited = true;
    driver?.stop();
    relay.close();
    onExit();
  }

  function drawGame() {
    const g = getGame(match.gameId);
    const area = h('section', { class: 'game' });
    const offline = match.state.players.filter((p) => p.id !== HOST_ID && !clients.get(p.id)?.online);
    const watching = online().filter((m) => !inMatch(m.id)).length;
    mount(root,
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn ghost', onclick: backToLobby }, '< Sala'),
        h('span', { class: 'tools' },
          watching ? h('span', { class: 'status' }, `Assistindo: ${watching}`) : null,
          h('button', { class: 'px-btn small', onclick: () => openScoreboard(scoreList()) }, 'Placar'),
          fullscreenButton())),
      offline.length ? h('p', { class: 'warn' }, `Desconectado: ${offline.map((p) => p.name).join(', ')}`) : null,
      area);
    const me = inMatch(HOST_ID) ? HOST_ID : null;
    g.render(area, g.view(match.state, me), {
      me, shared: false, bots: new Set(robots.keys()),
      send(action) { if (me) { applyAction(HOST_ID, action); syncAll(); } },
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
