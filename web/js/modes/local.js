// MODO MESMA TELA (GitHub Pages, ou "Mesma tela" no menu do app).
// Catálogo -> preparação (nomes e cores) -> partida, todos no mesmo
// aparelho. O placar da sessão soma as vitórias por nome.
import { h, mount, randomId, store } from '../ui/dom.js';
import { apkDownloadUrl } from '../env.js';
import { fullscreenButton, leaveFocus } from '../ui/fullscreen.js';
import { capacityText } from '../games/index.js';
import { catalog, colorButton, gameArt, scoreboard, openScoreboard, recordResult } from '../ui/platform.js';
import { COLOR_LABEL, firstFree } from '../ui/colors.js';

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
        catalog({ onPick: (g) => setupScreen(g) })),
      rows.length ? h('div', { class: 'score-wrap' },
        scoreboard(rows, { title: 'Placar desta mesa' }),
        h('button', { class: 'px-btn small', onclick: () => { if (confirm('Zerar o placar?')) { scores.clear(); saveScores(scores); catalogScreen(); } } }, 'Zerar placar')) : null,
      inApp ? null : apkBanner());
  }

  function setupScreen(game) {
    leaveFocus();
    const { minPlayers: min, maxPlayers: max } = game.meta;
    const pref = prefs[game.id] || {};
    let count = Math.min(max, Math.max(min, pref.count || min));
    const seats = [];
    const fill = () => {
      const defaults = game.defaultColors(count);
      for (let i = 0; i < count; i++) {
        seats[i] ||= { name: pref.seats?.[i]?.name || '', color: pref.seats?.[i]?.color || null };
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
      prefs[game.id] = { count, seats: seats.map((s) => ({ name: s.name, color: s.color })) };
      store.set(SETUP_KEY, JSON.stringify(prefs));
    };

    function draw() {
      fill();
      const seatRows = seats.map((s, i) => {
        const others = seats.filter((_, j) => j !== i).map((o) => o.color);
        return h('div', { class: `seat team-${s.color}` },
          h('span', { class: 'seat-color' }, `Jogador ${i + 1} · ${game.seatHint(count, i)}`),
          h('div', { class: 'row' },
            colorButton({ value: s.color, taken: others, onPick: (c) => { s.color = c; save(); draw(); } }),
            h('input', {
              type: 'text', maxLength: 16, value: s.name, placeholder: COLOR_LABEL[s.color],
              'aria-label': `Nome do jogador ${i + 1}`,
              oninput: (e) => { s.name = e.target.value; save(); },
            })));
      });
      mount(root,
        h('div', { class: 'toolbar' }, h('button', { class: 'px-btn small', onclick: catalogScreen }, '< Jogos')),
        h('section', { class: 'card setup-card' },
          h('div', { class: 'setup-head' }, gameArt(game, 'game-art small'),
            h('div', {}, h('h2', {}, game.name), h('p', { class: 'muted' }, capacityText(game)))),
          min !== max ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Número de jogadores' },
            h('span', { class: 'seg-label', 'aria-hidden': 'true' }, 'Jogadores'),
            Array.from({ length: max - min + 1 }, (_, k) => min + k).map((n) => h('button', {
              class: 'px-btn' + (n === count ? ' primary' : ''), 'aria-pressed': String(n === count),
              'aria-label': `${n} jogadores`,
              onclick: () => { count = n; save(); draw(); },
            }, String(n)))) : null,
          h('div', { class: 'seats' }, seatRows),
          h('button', { class: 'px-btn primary wide', onclick: () => { save(); play(game, count, seats); } }, 'Começar')));
    }
    draw();
  }

  function play(game, count, seats) {
    let state = game.setup(seats.slice(0, count).map((s) => ({
      id: randomId(), name: s.name.trim().slice(0, 16) || COLOR_LABEL[s.color], color: s.color,
    })));
    let recorded = false;
    const area = h('section', { class: 'game' });

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
      const me = game.activePlayers(state)[0] ?? state.players[0].id;
      game.render(area, game.view(state, me), {
        me, shared: true,
        // `as`: na mesma tela, algumas respostas são de quem NÃO está na vez
        // (ex.: aceitar empate nas damas).
        send(action, as) {
          const next = game.act(state, as || me, action);
          if (next) { state = next; draw(); }
        },
      });
    }

    mount(root,
      h('div', { class: 'toolbar' },
        h('button', { class: 'px-btn small', onclick: () => { if (confirm('Sair da partida?')) setupScreen(game); } }, '< Sair'),
        h('span', { class: 'tools' },
          h('button', { class: 'px-btn small', onclick: () => openScoreboard([...scores.values()], { title: 'Placar desta mesa' }) }, 'Placar'),
          fullscreenButton())),
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
