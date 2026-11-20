// MODO MESMA TELA (GitHub Pages, ou "Mesma tela" no menu do app).
// Catálogo -> preparação (nomes e cores) -> partida, todos no mesmo
// aparelho. O placar da sessão soma as vitórias por nome.
import { h, mount, randomId, store } from '../ui/dom.js';
import { apkDownloadUrl } from '../env.js';
import { leaveFocus, menuButton } from '../ui/fullscreen.js';
import { ask } from '../ui/modal.js';
import { capacityText, GAMES, defaultOptions } from '../games/index.js';
import { catalog, colorButton, gameArt, scoreboard, openScoreboard, recordResult, optionsPicker } from '../ui/platform.js';
import { COLOR_LABEL, firstFree } from '../ui/colors.js';
import { BOT_LEVELS, levelLabel, hasBot } from '../bots/index.js';
import { botDriver } from '../bots/driver.js';

// Quem senta em cada lugar: pessoa ou robô (com nível).
const CONTROLLERS = [null, ...BOT_LEVELS.map((l) => l.id)];

const SCORE_KEY = 'pq-local-scores';
const SETUP_KEY = 'pq-local-setup';

export function startLocal(root, { inApp = false, onExit = null } = {}) {
  const scores = loadScores();
  const prefs = loadJSON(SETUP_KEY, {}); // { [gameId]: { count, seats: [{ name, color }] } }

  function catalogScreen() {
    leaveFocus();
    const rows = [...scores.values()];
    mount(root,
      onExit ? h('div', { class: 'toolbar' }, h('button', { class: 'px-btn small', onclick: onExit }, '< Menu')) : null,
      h('section', { class: 'card' },
        h('h2', {}, 'Escolha o jogo'),
        catalog({
          onPick: (g) => setupScreen(g),
          // Jogos de mão escondida: aqui, só você contra robôs.
          notes: Object.fromEntries(GAMES.filter((g) => g.noSharedScreen).map((g) => [g.id, 'Você x robôs'])),
        })),
      rows.length ? h('div', { class: 'score-wrap' },
        scoreboard(rows, { title: 'Placar desta mesa' }),
        h('button', { class: 'px-btn small', onclick: async () => { if (await ask('Zerar o placar desta mesa?')) { scores.clear(); saveScores(scores); catalogScreen(); } } }, 'Zerar placar')) : null,
      inApp ? null : apkBanner());
  }

  function setupScreen(game) {
    leaveFocus();
    const { minPlayers: min, maxPlayers: max } = game.meta;
    const pref = prefs[game.id] || {};
    let count = Math.min(max, Math.max(min, pref.count || min));
    let opts = { ...defaultOptions(game), ...(pref.opts || {}) };
    // Sem mesma tela (mão escondida): lugar 1 é você; os outros, robôs.
    const solo = !!game.noSharedScreen;
    const seats = [];
    const fill = () => {
      const defaults = game.defaultColors(count);
      for (let i = 0; i < count; i++) {
        seats[i] ||= { name: pref.seats?.[i]?.name || '', color: pref.seats?.[i]?.color || null, bot: pref.seats?.[i]?.bot || null };
        if (!hasBot(game.id)) seats[i].bot = null;
        if (solo) seats[i].bot = i === 0 ? null : (seats[i].bot || 'medio');
      }
      seats.length = count;
      // Cores únicas: quem não tem cor (ou repetiu) pega a padrão do assento.
      const taken = [];
      seats.forEach((s, i) => {
        if (!s.color || taken.includes(s.color)) s.color = firstFree(taken, [defaults[i], ...defaults]);
        taken.push(s.color);
      });
    };
    const save = () => {
      prefs[game.id] = { count, opts, seats: seats.map((s) => ({ name: s.name, color: s.color, bot: s.bot })) };
      store.set(SETUP_KEY, JSON.stringify(prefs));
    };

    function draw() {
      fill();
      const seatRows = seats.map((s, i) => {
        const others = seats.filter((_, j) => j !== i).map((o) => o.color);
        if (solo && i > 0) {
          // Você x robôs: cada robô ocupa pouco (cor + nível), lado a lado.
          return h('div', { class: `seat compact team-${s.color}` },
            h('div', { class: 'row' },
              colorButton({ value: s.color, taken: others, onPick: (c) => { s.color = c; save(); draw(); } }),
              h('button', {
                class: 'px-btn small who bot',
                'aria-label': `Jogador ${i + 1}: robô ${levelLabel(s.bot)}. Tocar para trocar.`,
                onclick: () => { const cycle = CONTROLLERS.slice(1); s.bot = cycle[(cycle.indexOf(s.bot) + 1) % cycle.length]; save(); draw(); },
              }, levelLabel(s.bot))));
        }
        return h('div', { class: `seat team-${s.color}` },
          h('span', { class: 'seat-color' }, [`Jogador ${i + 1}`, game.seatHint(count, i)].filter(Boolean).join(' · ')),
          h('div', { class: 'row' },
            colorButton({ value: s.color, taken: others, onPick: (c) => { s.color = c; save(); draw(); } }),
            s.bot
              ? h('span', { class: 'bot-name' }, 'Robô')
              : h('input', {
                type: 'text', maxLength: 16, value: s.name, placeholder: COLOR_LABEL[s.color],
                'aria-label': `Nome do jogador ${i + 1}`,
                oninput: (e) => { s.name = e.target.value; save(); },
              }),
            solo && i === 0 ? h('span', { class: 'px-btn small who human' }, 'Você')
              : hasBot(game.id) ? h('button', {
                class: 'px-btn small who ' + (s.bot ? 'bot' : 'human'),
                'aria-label': `Jogador ${i + 1}: ${s.bot ? `robô ${levelLabel(s.bot)}` : 'pessoa'}. Tocar para trocar.`,
                onclick: () => {
                  // Sem mesma tela, os outros lugares só alternam o nível do robô.
                  const cycle = solo ? CONTROLLERS.slice(1) : CONTROLLERS;
                  s.bot = cycle[(cycle.indexOf(s.bot) + 1) % cycle.length];
                  save(); draw();
                },
              }, s.bot ? levelLabel(s.bot) : 'Pessoa') : null));
      });
      mount(root,
        h('div', { class: 'toolbar' }, h('button', { class: 'px-btn small', onclick: catalogScreen }, '< Jogos')),
        h('section', { class: 'card setup-card' },
          h('div', { class: 'setup-head' }, gameArt(game, 'game-art small'),
            h('div', {}, h('h2', {}, game.name), h('p', { class: 'muted' }, capacityText(game)))),
          min !== max ? h('div', { class: 'seg' + (max - min > 2 ? ' many' : ''), role: 'group', 'aria-label': 'Número de jogadores' },
            h('span', { class: 'seg-label', 'aria-hidden': 'true' }, 'Jogadores'),
            Array.from({ length: max - min + 1 }, (_, k) => min + k).map((n) => h('button', {
              class: 'px-btn' + (n === count ? ' primary' : ''), 'aria-pressed': String(n === count),
              'aria-label': `${n} jogadores`,
              onclick: () => { count = n; save(); draw(); },
            }, String(n)))) : null,
          optionsPicker(game, opts, (v) => { opts = v; save(); draw(); }),
          solo ? h('p', { class: 'muted hint' }, 'Você x robôs. Com amigos: sala Wi-Fi.')
            : hasBot(game.id) ? h('p', { class: 'muted hint' }, 'Toque em "Pessoa" para trocar por um robô (Fácil, Médio ou Difícil).') : null,
          h('div', { class: 'seats' + (solo ? ' bots' : '') }, seatRows),
          h('button', { class: 'px-btn primary wide', onclick: () => { save(); play(game, count, seats, opts); } }, 'Começar')));
    }
    draw();
  }

  function play(game, count, seats, opts = {}) {
    const bots = new Map(); // id do jogador -> nível
    const sameLevel = {};
    const list = seats.slice(0, count).map((s) => {
      const id = randomId();
      if (!s.bot) return { id, name: s.name.trim().slice(0, 16) || COLOR_LABEL[s.color], color: s.color };
      bots.set(id, s.bot);
      sameLevel[s.bot] = (sameLevel[s.bot] || 0) + 1;
      return { id, name: `Robô ${levelLabel(s.bot)}`, color: s.color };
    });
    // Robôs do mesmo nível ganham número (Robô Médio 2).
    const seen = {};
    for (const p of list) {
      const lvl = bots.get(p.id);
      if (lvl && sameLevel[lvl] > 1) p.name += ` ${(seen[lvl] = (seen[lvl] || 0) + 1)}`;
    }
    const humans = list.filter((p) => !bots.has(p.id));
    // Uma pessoa só (contra robôs): tela "pessoal", com o seu lado embaixo.
    const solo = humans.length === 1;
    let state = game.setup(list, opts);
    let recorded = false;
    const area = h('section', { class: 'game' });
    const driver = botDriver({
      gameId: game.id, bots,
      getState: () => state,
      apply: (id, action) => {
        const next = game.act(state, id, action);
        if (next) { state = next; draw(); }
      },
    });

    function draw() {
      const result = game.outcome(state);
      if (result && !recorded) {
        // Na mesma tela não há conta: o placar é por NOME (ids mudam a cada partida).
        const key = (p) => ({ ...p, id: `n:${p.name.toLowerCase()}` });
        const winners = state.players.filter((p) => result.winners.includes(p.id)).map((p) => key(p).id);
        recordResult(scores, state.players.map(key), winners);
        saveScores(scores);
        recorded = true;
      } else if (!result) recorded = false;
      // Quem usa a tela agora: a pessoa (se for só uma) ou quem está na vez.
      // Na vez de um robô ninguém toca no tabuleiro ('robo').
      const active = game.activePlayers(state)[0];
      const me = solo ? humans[0].id
        : active && !bots.has(active) ? active
          : active ? 'robo' : (humans[0]?.id ?? 'robo');
      game.render(area, game.view(state, solo ? me : active || me), {
        me, shared: !solo, bots: new Set(bots.keys()),
        // `as`: na mesma tela, algumas respostas são de quem NÃO está na vez
        // (ex.: aceitar empate nas damas).
        send(action, as) {
          const next = game.act(state, as || me, action);
          if (next) { state = next; draw(); }
        },
      });
      driver.kick();
    }

    mount(root,
      h('div', { class: 'toolbar' },
        h('button', { class: 'px-btn small', onclick: async () => { if (await ask('Sair da partida?')) { driver.stop(); setupScreen(game); } } }, '< Sair'),
        menuButton([{ label: 'Placar desta mesa', onClick: () => openScoreboard([...scores.values()], { title: 'Placar desta mesa' }) }])),
      area);
    draw();
  }

  catalogScreen();
}

function loadJSON(key, fallback) {
  try { return JSON.parse(store.get(key, '')) ?? fallback; } catch { return fallback; }
}

function loadScores() {
  const list = loadJSON(SCORE_KEY, []);
  return new Map(Array.isArray(list) ? list.map((r) => [r.id, r]) : []);
}

function saveScores(scores) {
  store.set(SCORE_KEY, JSON.stringify([...scores.values()]));
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
