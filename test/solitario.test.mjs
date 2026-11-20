import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as so from '../web/js/games/solitario/rules.js';
import { codeOf } from '../web/js/ui/cards52.js';

const P = [{ id: 'a', name: 'Ana' }];
const C = (s, r) => codeOf(s, r); // 0 ouros, 1 paus, 2 copas, 3 espadas
const up = (c) => ({ c, up: true });
const down = (c) => ({ c, up: false });

test('distribuição: 7 colunas (1 a 7), só a de cima aberta; 24 no monte', () => {
  const s = so.setup(P, {});
  assert.deepEqual(s.tab.map((c) => c.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(s.tab.every((c) => c.every((x, k) => x.up === (k === c.length - 1))));
  assert.equal(s.stock.length, 24);
  assert.ok(so.view(s).tab[6].slice(0, 6).every((x) => x.c === -1)); // fechadas escondidas
});

test('compra 1, 2 ou 3 conforme o nível; monte acabou: o descarte volta', () => {
  for (const [nivel, n] of [['facil', 1], ['medio', 2], ['dificil', 3]]) {
    let s = so.setup(P, { nivel });
    s = so.act(s, 'a', { type: 'draw' });
    assert.equal(s.waste.length, n);
  }
  let s = so.setup(P, { nivel: 'dificil' });
  for (let i = 0; i < 8; i++) s = so.act(s, 'a', { type: 'draw' });
  assert.equal(s.stock.length, 0);
  const top = s.waste[s.waste.length - 1];
  s = so.act(s, 'a', { type: 'draw' });
  assert.equal(s.waste.length, 0); assert.equal(s.stock.length, 24); assert.equal(s.passes, 1);
  s = so.act(s, 'a', { type: 'draw' });
  assert.notEqual(s.waste[s.waste.length - 1], top);
});

function at(tab, { waste = [], found = [[], [], [], []], stock = [] } = {}) {
  const s = so.setup(P, {});
  s.tab = tab; s.waste = waste; s.found = found; s.stock = stock; s.hist = [];
  return s;
}

test('colunas: cor alternada e um a menos; coluna vazia só Rei; vira a de baixo', () => {
  let s = at([[down(C(0, 2)), up(C(3, 7))], [up(C(2, 6))], [up(C(1, 6))], [], [up(C(0, 13))], [], []]);
  assert.deepEqual(so.destinations(s, { t: 'tab', i: 1, k: 0 }), [{ t: 'tab', i: 0 }]); // 6 copas no 7 espadas
  assert.deepEqual(so.destinations(s, { t: 'tab', i: 2, k: 0 }), []); // 6 paus no 7 espadas: mesma cor
  assert.deepEqual(so.destinations(s, { t: 'tab', i: 4, k: 0 }), [{ t: 'tab', i: 3 }, { t: 'tab', i: 5 }, { t: 'tab', i: 6 }]);
  s = so.act(s, 'a', { type: 'move', from: { t: 'tab', i: 1, k: 0 }, to: { t: 'tab', i: 0 } });
  assert.deepEqual(s.tab[0].map((x) => x.c), [C(0, 2), C(3, 7), C(2, 6)]);
  // Move a sequência 7-6 para outra coluna? Não há 8 vermelho: nada.
  assert.equal(so.act(s, 'a', { type: 'move', from: { t: 'tab', i: 0, k: 1 }, to: { t: 'tab', i: 2 } }), null);
  // Move a sequência inteira para coluna vazia? Só se começar com Rei: não.
  assert.equal(so.act(s, 'a', { type: 'move', from: { t: 'tab', i: 0, k: 1 }, to: { t: 'tab', i: 3 } }), null);
});

test('fundações do Ás ao Rei; desfazer; recolher', () => {
  let s = at([[down(C(1, 9)), up(C(2, 1))], [up(C(2, 2))], [], [], [], [], []], { waste: [C(2, 3)] });
  s = so.act(s, 'a', { type: 'move', from: { t: 'tab', i: 0, k: 1 }, to: { t: 'found' } });
  assert.deepEqual(s.found[2], [C(2, 1)]);
  assert.equal(s.tab[0][0].up, true); // virou
  s = so.act(s, 'a', { type: 'undo' });
  assert.deepEqual(s.found[2], []); assert.equal(s.tab[0][1].c, C(2, 1)); assert.equal(s.tab[0][0].up, false);
  assert.ok(so.canCollect(s));
  s = so.act(s, 'a', { type: 'collect' });
  assert.deepEqual(s.found[2], [C(2, 1), C(2, 2), C(2, 3)]);
});

test('vitória quando as 52 estão nas fundações', () => {
  const found = [0, 1, 2, 3].map((st) => Array.from({ length: 13 }, (_, r) => C(st, r + 1)));
  const k = found[3].pop();
  let s = at([[up(k)], [], [], [], [], [], []], { found });
  s = so.act(s, 'a', { type: 'collect' });
  assert.equal(s.phase, 'over'); assert.deepEqual(so.outcome(s), { winners: ['a'] });
  let g = so.setup(P, {});
  g = so.act(g, 'a', { type: 'giveup' });
  assert.deepEqual(so.outcome(g), { winners: [] });
});
