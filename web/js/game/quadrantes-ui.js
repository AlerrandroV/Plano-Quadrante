// Interface do jogo provisório. Recebe a "view" (do game.view) e
// um contexto:
//   ctx.me      -> id do jogador que está usando ESTA tela
//                  (na mesma tela, é sempre quem está na vez)
//   ctx.send(a) -> envia uma jogada
//   ctx.shared  -> true se todos jogam na mesma tela
import { h } from '../ui/dom.js';

const ROMAN = ['eixo', 'I', 'II', 'III', 'IV'];
const SIZE = 9; // metade da grade (combina com RANGE do jogo)

export function render(root, state, ctx) {
  const current = state.players[state.turn];
  const myTurn = !state.over && current.id === ctx.me;

  const children = [];
  children.push(scoreboard(state, ctx));

  if (state.over) {
    children.push(gameOver(state, ctx));
  } else {
    const who = ctx.shared
      ? h('span', {}, 'Vez de ', h('strong', {}, current.name))
      : myTurn
        ? h('strong', {}, 'Sua vez!')
        : h('span', {}, 'Aguardando ', h('strong', {}, current.name), '…');

    children.push(h('div', { class: 'turn-banner' + (myTurn ? ' is-mine' : '') },
      who, h('span', { class: 'muted' }, ` · rodada ${state.round}/${state.rounds}`)));

    children.push(h('p', { class: 'prompt' },
      'Em qual quadrante está o ponto ',
      h('strong', { class: 'coord' }, `(${state.point.x}, ${state.point.y})`), '?'));

    children.push(plane(state, myTurn ? (q) => ctx.send({ type: 'answer', quadrant: q }) : null));
    children.push(h('button', {
      class: 'btn secondary wide', disabled: !myTurn,
      onclick: () => ctx.send({ type: 'answer', quadrant: 0 }),
    }, 'Sobre um eixo'));
  }

  if (state.last) children.push(feedback(state));
  root.replaceChildren(...children);
}

function scoreboard(state, ctx) {
  return h('ul', { class: 'scoreboard' }, state.players.map((p, i) =>
    h('li', { class: [!state.over && i === state.turn ? 'active' : '', p.id === ctx.me && !ctx.shared ? 'me' : ''].join(' ') },
      h('span', {}, p.name), h('b', {}, p.score))));
}

function feedback(state) {
  const { last } = state;
  const who = state.players.find((p) => p.id === last.playerId)?.name ?? '?';
  const where = last.correctQ === 0 ? 'sobre um eixo' : `no quadrante ${ROMAN[last.correctQ]}`;
  return h('p', { class: 'feedback ' + (last.correct ? 'ok' : 'bad') },
    last.correct ? '✔ ' : '✘ ',
    `${who}: (${last.point.x}, ${last.point.y}) fica ${where}.`);
}

function gameOver(state, ctx) {
  const best = Math.max(...state.players.map((p) => p.score));
  const winners = state.players.filter((p) => p.score === best).map((p) => p.name);
  return h('div', { class: 'card center' },
    h('h2', {}, winners.length > 1 ? 'Empate!' : 'Fim de jogo!'),
    h('p', {}, winners.length > 1 ? `Venceram: ${winners.join(', ')}` : `Vencedor: ${winners[0]}`),
    h('button', { class: 'btn', onclick: () => ctx.send({ type: 'restart' }) }, 'Jogar de novo'));
}

function plane(state, onPick) {
  const S = SIZE + 1; // margem
  const svg = h('svg', {
    class: 'plane' + (onPick ? ' clickable' : ''),
    viewBox: `${-S} ${-S} ${2 * S} ${2 * S}`,
    role: 'img', 'aria-label': 'Plano cartesiano',
  });

  // Quadrantes clicáveis (y do SVG cresce para baixo, por isso o sinal invertido)
  const quads = [
    { q: 1, x: 0, y: -S }, { q: 2, x: -S, y: -S },
    { q: 3, x: -S, y: 0 }, { q: 4, x: 0, y: 0 },
  ];
  for (const { q, x, y } of quads) {
    const g = h('g', { class: `quad q${q}` },
      h('rect', { x, y, width: S, height: S }),
      h('text', { x: x + S / 2, y: y + S / 2, class: 'quad-label' }, ROMAN[q]));
    if (onPick) {
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `Quadrante ${ROMAN[q]}`);
      g.addEventListener('click', () => onPick(q));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') onPick(q); });
    }
    svg.append(g);
  }

  for (let i = -SIZE; i <= SIZE; i++) {
    if (i === 0) continue;
    svg.append(h('line', { x1: i, y1: -SIZE, x2: i, y2: SIZE, class: 'grid' }));
    svg.append(h('line', { x1: -SIZE, y1: i, x2: SIZE, y2: i, class: 'grid' }));
  }
  svg.append(h('line', { x1: -S, y1: 0, x2: S, y2: 0, class: 'axis' }));
  svg.append(h('line', { x1: 0, y1: -S, x2: 0, y2: S, class: 'axis' }));
  svg.append(h('text', { x: S - 0.4, y: -0.4, class: 'axis-label' }, 'x'));
  svg.append(h('text', { x: 0.4, y: -S + 0.9, class: 'axis-label' }, 'y'));

  // Mostra onde ficava o ponto da jogada anterior (ajuda a aprender).
  if (state.last) {
    const { x, y } = state.last.point;
    svg.append(h('circle', { cx: x, cy: -y, r: 0.45, class: 'last-point ' + (state.last.correct ? 'ok' : 'bad') }));
  }
  return svg;
}
