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
 * value: { [optionId]: choiceId | [ids] (type 'flags') }  onChange(novoValor)
 * showIf: { outraOpção: valor } mostra a opção só nesse caso.
 */
export function optionsPicker(game, value = {}, onChange = null) {
  if (!game.options?.length) return null;
  const val = (o) => value[o.id] ?? o.default;
  const shown = (o) => !o.showIf || Object.entries(o.showIf).every(([k, v]) => val(game.options.find((x) => x.id === k) || { id: k }) === v);
  const rows = [];
  for (const o of game.options.filter(shown)) {
    if (o.type === 'flags') {
      // Liga/desliga (várias ao mesmo tempo), ex.: regras de rua. Abre numa
      // janelinha e fica na mesma linha da opção de que depende, para a
      // tela de preparação continuar cabendo.
      const on = val(o);
      const names = o.choices.filter((c) => on.includes(c.id)).map((c) => c.label);
      const edit = () => openFlags(o, on, onChange ? (list) => onChange({ ...value, [o.id]: list }) : null);
      const hint = h('p', { class: 'muted option-hint' }, names.length ? names.join(' · ') : 'Nenhuma: igual às oficiais.');
      const parent = rows.find((r) => o.showIf && r.id in o.showIf);
      if (parent) {
        // O próprio botão da escolha (ex.: "De rua") mostra quantas valem e
        // abre a janelinha ao ser tocado de novo.
        const b = parent.buttons[o.showIf[parent.id]];
        b.textContent = `${b.textContent} (${on.length})`;
        b.setAttribute('aria-label', `${o.label}: ${on.length} de ${o.choices.length} regras. Tocar para escolher.`);
        b.onclick = edit;
        b.disabled = false;
        parent.hint?.remove();
        parent.el.append(hint);
      } else {
        const open = h('button', { class: 'px-btn flags-open', type: 'button', onclick: edit }, `${on.length}/${o.choices.length} >`);
        rows.push({ id: o.id, el: h('div', { class: 'game-option' }, h('div', { class: 'seg', role: 'group', 'aria-label': o.label }, h('span', { class: 'seg-label' }, o.label), open), hint) });
      }
      continue;
    }
    const cur = val(o);
    const choice = o.choices.find((c) => c.id === cur);
    const buttons = {};
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': o.label },
      h('span', { class: 'seg-label' }, o.label),
      o.choices.map((c) => (buttons[c.id] = h('button', {
        class: 'px-btn' + (c.id === cur ? ' primary' : ''), 'aria-pressed': String(c.id === cur),
        disabled: !onChange,
        onclick: () => {
          onChange?.({ ...value, [o.id]: c.id });
          // Escolheu algo que tem opções liga/desliga: já abre a janelinha.
          const sub = game.options.find((x) => x.type === 'flags' && x.showIf?.[o.id] === c.id);
          if (sub && onChange) openFlags(sub, value[sub.id] ?? sub.default, (list) => onChange({ ...value, [o.id]: c.id, [sub.id]: list }));
        },
      }, c.label))));
    const hint = choice?.hint ? h('p', { class: 'muted option-hint' }, choice.hint) : null;
    rows.push({ id: o.id, seg, hint, buttons, el: h('div', { class: 'game-option' }, seg, hint) });
  }
  return h('div', { class: 'game-options' }, rows.map((r) => r.el));
}

/** Janela de opções liga/desliga. onDone(lista) ou null (só leitura). */
function openFlags(o, value, onDone) {
  const on = new Set(value);
  const list = h('div', { class: 'flag-list' });
  const draw = () => list.replaceChildren(...o.choices.map((c) => h('button', {
    class: 'px-btn flag' + (on.has(c.id) ? ' primary' : ''), type: 'button', 'aria-pressed': String(on.has(c.id)),
    disabled: !onDone,
    onclick: () => { if (on.has(c.id)) on.delete(c.id); else on.add(c.id); draw(); },
  }, h('span', { class: 'flag-box' }, on.has(c.id) ? 'X' : ''), h('span', { class: 'flag-text' }, h('b', {}, c.label), c.hint ? h('small', {}, c.hint) : null))));
  draw();
  showModal({
    title: o.label,
    content: [list],
    actions: onDone ? [{ label: 'Pronto', primary: true, onClick: () => onDone(o.choices.map((c) => c.id).filter((id) => on.has(id))) }] : [],
  });
}
