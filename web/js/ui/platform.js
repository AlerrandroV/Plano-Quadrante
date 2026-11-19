// Peças da PLATAFORMA (iguais em todas as telas): catálogo de jogos,
// seletor de cor das peças e placar da sala.
import { h } from './dom.js';
import { pixelCanvas, drawPawn, PAWN_W, PAWN_H } from './pixel.js';
import { COLOR_ORDER, COLOR_LABEL } from './colors.js';
import { GAMES, ART_W, ART_H, capacityText } from '../games/index.js';
import { statIcon } from './table.js';
import { showModal } from './modal.js';

export function gameArt(game, cls = 'game-art') {
  const c = pixelCanvas(ART_W, ART_H, cls);
  game.art(c.getContext('2d'));
  return c;
}

/** Cartão de um jogo (ilustração, nome, capacidade). */
export function gameCard(game, { selected = false, onPick = null, note = '' } = {}) {
  const tag = onPick ? 'button' : 'div';
  return h(tag, {
    class: 'game-card' + (selected ? ' selected' : ''),
    onclick: onPick ? () => onPick(game) : null,
    'aria-pressed': onPick ? String(selected) : null,
    'aria-label': onPick ? `${game.name}, ${capacityText(game)}` : null,
  },
  gameArt(game),
  h('span', { class: 'game-name' }, game.name),
  h('span', { class: 'game-cap' }, capacityText(game)),
  note ? h('span', { class: 'game-note' }, note) : null);
}

/** Grade com todos os jogos do catálogo. */
export function catalog({ selectedId = null, onPick, notes = {} }) {
  return h('div', { class: 'catalog' },
    GAMES.map((g) => gameCard(g, { selected: g.id === selectedId, onPick, note: notes[g.id] || '' })));
}

/** Botões de cor; cores de outros jogadores ficam bloqueadas. */
export function colorPicker({ value, taken = [], onPick, label = 'Cor das peças' }) {
  return h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': label },
    COLOR_ORDER.map((c) => {
      const busy = taken.includes(c) && c !== value;
      const icon = pixelCanvas(PAWN_W, PAWN_H, 'swatch-pawn');
      drawPawn(icon.getContext('2d'), 0, 0, c, { ghost: busy });
      return h('button', {
        class: `swatch team-${c}` + (c === value ? ' on' : ''),
        role: 'radio', 'aria-checked': String(c === value),
        'aria-label': COLOR_LABEL[c] + (busy ? ' (já escolhida)' : ''),
        disabled: busy,
        onclick: () => { onPick(c); },
      }, icon);
    }));
}

/** Botão compacto com o peão na cor atual; abre a paleta numa janelinha. */
export function colorButton({ value, taken = [], onPick, label = 'Cor das peças' }) {
  const open = () => {
    const m = showModal({
      title: label,
      content: [colorPicker({ value, taken, label, onPick: (c) => { m.close(); onPick(c); } })],
    });
  };
  return h('button', {
    class: `color-btn team-${value}`, onclick: open, type: 'button',
    'aria-label': `${label}: ${COLOR_LABEL[value]}. Tocar para trocar.`,
  }, pawnBadge(value));
}

export function pawnBadge(color) {
  const c = pixelCanvas(PAWN_W, PAWN_H, 'pq-pawn-icon');
  drawPawn(c.getContext('2d'), 0, 0, color);
  return c;
}

/**
 * Placar: quem ganhou mais partidas.
 * scores: [{ id, name, color, wins, games }]
 */
export function scoreboard(scores, { title = 'Placar da sala', empty = 'Ninguém venceu ainda.' } = {}) {
  const rows = [...scores].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  const best = rows[0]?.wins || 0;
  return h('section', { class: 'card scoreboard' },
    h('h2', {}, title),
    rows.length
      ? h('ol', { class: 'score-list' }, rows.map((r) => h('li', { class: r.wins === best && best > 0 ? 'lead' : '' },
        pawnBadge(r.color),
        h('span', { class: 'score-name' }, r.name),
        h('span', { class: 'score-wins', 'aria-label': `${r.wins} vitórias` }, statIcon('trofeu'), String(r.wins)))))
      : h('p', { class: 'muted' }, empty));
}

/** Abre o placar numa janelinha (durante a partida). */
export function openScoreboard(scores, opts) {
  showModal({ content: [scoreboard(scores, opts)], actions: [{ label: 'Fechar', primary: true }] });
}

/** Soma uma partida no placar (Map id -> {name,color,wins,games}). */
export function recordResult(scores, players, winners) {
  for (const p of players) {
    const row = scores.get(p.id) || { id: p.id, name: p.name, color: p.color, wins: 0, games: 0 };
    row.name = p.name;
    row.color = p.color;
    row.games += 1;
    if (winners.includes(p.id)) row.wins += 1;
    scores.set(p.id, row);
  }
}

/**
 * Opções de um jogo (ex.: dominó "Batida" ou "Pontos"), em botões.
 * value: { [optionId]: choiceId }  onChange(novoValor)
 */
export function optionsPicker(game, value = {}, onChange = null) {
  if (!game.options?.length) return null;
  return h('div', { class: 'game-options' }, game.options.map((o) => {
    const cur = value[o.id] ?? o.default;
    const choice = o.choices.find((c) => c.id === cur);
    return h('div', { class: 'game-option' },
      h('div', { class: 'seg', role: 'group', 'aria-label': o.label },
        h('span', { class: 'seg-label' }, o.label),
        o.choices.map((c) => h('button', {
          class: 'px-btn' + (c.id === cur ? ' primary' : ''), 'aria-pressed': String(c.id === cur),
          disabled: !onChange,
          onclick: () => onChange?.({ ...value, [o.id]: c.id }),
        }, c.label))),
      choice?.hint ? h('p', { class: 'muted option-hint' }, choice.hint) : null);
  }));
}
