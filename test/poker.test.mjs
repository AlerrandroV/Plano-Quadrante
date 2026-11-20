import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pk from '../web/js/games/poker/rules.js';
import { codeOf } from '../web/js/ui/cards52.js';

// Naipes: 0 ouros, 1 paus, 2 copas, 3 espadas. Valor 1 = Ás.
const C = (s, r) => codeOf(s, r);
const P = (n) => ['a', 'b', 'c', 'd'].slice(0, n).map((id) => ({ id, name: id.toUpperCase() }));

test('avaliador: ordem das categorias e desempates', () => {
  const H = (...cs) => pk.bestHand(cs);
  const royal = H(C(3, 1), C(3, 13), C(3, 12), C(3, 11), C(3, 10), C(0, 2), C(1, 3));
  assert.equal(royal.name, 'Royal flush');
  const quads = H(C(0, 9), C(1, 9), C(2, 9), C(3, 9), C(0, 13), C(1, 2), C(2, 3));
  assert.equal(quads.name, 'Quadra de 9');
  const full = H(C(0, 7), C(1, 7), C(2, 7), C(3, 13), C(0, 13), C(1, 2), C(2, 3));
  assert.equal(full.cat, 6);
  const wheel = H(C(0, 1), C(1, 2), C(2, 3), C(3, 4), C(0, 5), C(1, 9), C(2, 12));
  assert.equal(wheel.name, 'Sequência até 5');
  const flush = H(C(2, 2), C(2, 6), C(2, 9), C(2, 11), C(2, 4), C(0, 13), C(1, 13));
  assert.equal(flush.cat, 5);
  assert.ok(royal.score > quads.score && quads.score > full.score && full.score > flush.score && flush.score > wheel.score);
  // Par de Ases com kicker K vence par de Ases com kicker Q.
  const a = H(C(0, 1), C(1, 1), C(2, 13), C(3, 8), C(0, 6), C(1, 4), C(2, 2));
  const b = H(C(0, 1), C(1, 1), C(2, 12), C(3, 8), C(0, 6), C(1, 4), C(2, 2));
  assert.ok(a.score > b.score);
  assert.equal(a.name, 'Par de Ases');
});

test('blinds, ordem de fala e fichas conservadas', () => {
  const s = pk.setup(P(3), { fichas: '1000' });
  const total = () => s.players.reduce((t, p) => t + p.chips + p.total, 0);
  assert.equal(total(), 3000);
  assert.equal(s.players[s.sb].total, 10);
  assert.equal(s.players[s.bb].total, 20);
  assert.equal(s.turn, (s.bb + 1) % 3); // depois do big blind
  assert.ok(s.players.every((p) => p.hole.length === 2));
  // Mano a mano: o botão é o small blind e fala primeiro.
  const h = pk.setup(P(2), {});
  assert.equal(h.sb, h.dealer);
  assert.equal(h.turn, h.dealer);
});

/** Joga ações na ordem, a partir de quem está na vez. */
function run(s, ...actions) {
  for (const a of actions) {
    const id = s.players[s.turn].id;
    const n = pk.act(s, id, a);
    assert.ok(n, `ação inválida ${JSON.stringify(a)} na vez de ${id}`);
    s = n;
  }
  return s;
}

test('todos pagam e passam até o river: showdown com a melhor mão', () => {
  let s = pk.setup(P(2), {});
  // Mãos e mesa definidas: A tem par de Ases; B, carta alta.
  const a = s.players.findIndex((p) => p.id === 'a');
  s.players[a].hole = [C(0, 1), C(1, 1)];
  s.players[1 - a].hole = [C(2, 2), C(3, 7)];
  s.deck = [C(3, 3), C(2, 12), C(1, 9), C(0, 5), C(2, 4)];
  s = run(s, { type: 'call' }, { type: 'check' }); // pré-flop
  assert.equal(s.street, 'flop'); assert.equal(s.board.length, 3);
  s = run(s, { type: 'check' }, { type: 'check' }, { type: 'check' }, { type: 'check' }, { type: 'check' }, { type: 'check' });
  assert.equal(s.phase, 'showdown');
  assert.deepEqual(s.results.pots[0].winners, [a]);
  assert.equal(s.players[a].chips, 1020);
  assert.deepEqual(pk.view(s, 'b').players[a].hole, [C(0, 1), C(1, 1)]); // mostrou no showdown
});

test('aumento mínimo e desistência leva o pote sem mostrar', () => {
  let s = pk.setup(P(3), {});
  const first = s.turn;
  assert.equal(pk.act(s, s.players[first].id, { type: 'raise', to: 30 }), null); // mínimo é 40
  s = run(s, { type: 'raise', to: 60 });
  assert.equal(s.minRaise, 40);
  s = run(s, { type: 'fold' }, { type: 'fold' });
  assert.equal(s.phase, 'showdown');
  assert.equal(s.results.uncontested, first);
  assert.equal(s.players[first].chips, 1000 + 10 + 20);
  assert.ok(pk.view(s, s.players[(first + 1) % 3].id).players[first].hole.every((c) => c === -1)); // não mostra
  s = pk.act(s, 'a', { type: 'next' });
  assert.equal(s.hand, 2); assert.equal(s.phase, 'bet');
});

test('side pot: all-in curto só disputa o que cobriu', () => {
  let s = pk.setup(P(3), {});
  // A: 100 fichas (all-in); B e C com 1000. A tem a melhor mão; B a segunda.
  const idx = (id) => s.players.findIndex((p) => p.id === id);
  s.players.forEach((p) => { p.chips += p.total; p.total = 0; p.bet = 0; });
  s.players[idx('a')].chips = 100;
  s.dealer = idx('c'); s.sb = idx('a'); s.bb = idx('b');
  // Refaz os blinds à mão: A 10, B 20.
  const put = (i, x) => { const p = s.players[i]; p.chips -= x; p.bet += x; p.total += x; };
  put(idx('a'), 10); put(idx('b'), 20);
  s.curBet = 20; s.minRaise = 20; s.turn = idx('c');
  s.players[idx('a')].hole = [C(0, 1), C(1, 1)];
  s.players[idx('b')].hole = [C(0, 13), C(1, 13)];
  s.players[idx('c')].hole = [C(2, 2), C(3, 7)];
  s.deck = [C(3, 3), C(2, 12), C(1, 9), C(0, 5), C(2, 4)];
  s = run(s, { type: 'raise', to: 300 }); // C
  s = run(s, { type: 'allin' }); // A: 100
  s = run(s, { type: 'call' }); // B paga 300
  s = run(s, { type: 'check' }, { type: 'check' }, { type: 'check' }, { type: 'check' }, { type: 'check' }, { type: 'check' });
  assert.equal(s.phase, 'showdown');
  const [main, side] = s.results.pots;
  assert.equal(main.amount, 300); assert.deepEqual(main.winners, [idx('a')]);
  assert.equal(side.amount, 400); assert.deepEqual(side.winners, [idx('b')]);
  assert.equal(s.players[idx('a')].chips, 300);
  assert.equal(s.players.reduce((t, p) => t + p.chips, 0), 2100);
});

test('quem fica sem fichas sai; sobra um: fim', () => {
  let s = pk.setup(P(2), { fichas: '500' });
  for (let k = 0; k < 400 && s.phase !== 'over'; k++) {
    if (s.phase === 'showdown') { s = pk.act(s, 'a', { type: 'next' }); continue; }
    s = run(s, { type: 'allin' }.type && pk.betLimits(s).canRaise ? { type: 'allin' } : (pk.betLimits(s).canCheck ? { type: 'check' } : { type: 'call' }));
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.players[s.winner].chips, 1000);
  assert.ok(pk.outcome(s).winners.length === 1);
});
