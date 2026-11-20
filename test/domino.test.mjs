import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../web/js/games/domino/rules.js';

const P2 = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Beto' }];
const P4 = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() }));
const T = (a, b) => d.TILES.findIndex((t) => t.a === Math.min(a, b) && t.b === Math.max(a, b));

test('28 peças; 7 para cada; monte com o resto', () => {
  assert.equal(d.TILES.length, 28);
  const s2 = d.setup(P2);
  assert.ok(s2.players.every((p) => p.hand.length === 7));
  assert.equal(s2.stock.length, 14);
  const s4 = d.setup(P4);
  assert.equal(s4.stock.length, 0);
  const all = [...s4.players.flatMap((p) => p.hand)];
  assert.equal(new Set(all).size, 28);
});

test('primeira rodada: começa quem tem a maior carroça, jogando ela', () => {
  for (let k = 0; k < 20; k++) {
    const s = d.setup(P4); // com 4, todas as peças estão nas mãos: a 6:6 está com alguém
    assert.equal(s.mustPlay, T(6, 6));
    assert.ok(s.players[s.turn].hand.includes(T(6, 6)));
    assert.deepEqual(d.legalPlays(s), [{ id: T(6, 6), end: 'R' }]);
  }
});

/** Estado controlado: mãos, linha e vez definidas à mão. */
function at({ mode = 'batida', hands, line = [], stock = [], turn = 0 }) {
  const s = d.setup(hands.length === 2 ? P2 : P4, { mode });
  s.players.forEach((p, i) => { p.hand = hands[i]; p.score = 0; });
  s.line = line;
  s.stock = stock;
  s.turn = turn;
  s.mustPlay = null;
  return s;
}

test('encaixe nas duas pontas e orientação da peça', () => {
  let s = at({ hands: [[T(3, 5), T(1, 1)], [T(2, 2)]], line: [{ id: T(3, 4), l: 3, r: 4 }] });
  assert.deepEqual(d.legalPlays(s), [{ id: T(3, 5), end: 'L' }]);
  s = d.act(s, 'a', { type: 'play', id: T(3, 5), end: 'L' });
  assert.deepEqual(s.line.map((t) => [t.l, t.r]), [[5, 3], [3, 4]]);
});

test('não pode jogar peça que não encaixa nem fora da vez', () => {
  const s = at({ hands: [[T(1, 1)], [T(4, 6)]], line: [{ id: T(3, 4), l: 3, r: 4 }], stock: [T(0, 0)] });
  assert.equal(d.act(s, 'a', { type: 'play', id: T(1, 1), end: 'R' }), null);
  assert.equal(d.act(s, 'b', { type: 'play', id: T(4, 6), end: 'R' }), null);
});

test('sem peça que encaixe: compra do monte (e só então); monte vazio: passa', () => {
  let s = at({ hands: [[T(1, 1)], [T(4, 6)]], line: [{ id: T(3, 4), l: 3, r: 4 }], stock: [T(0, 0), T(2, 4)] });
  assert.equal(d.act(s, 'a', { type: 'pass' }), null); // ainda tem monte
  s = d.act(s, 'a', { type: 'draw' });
  assert.equal(s.players[0].hand.length, 2);
  assert.deepEqual(s.players[0].lacks.sort(), [3, 4]); // todos sabem que faltava 3 e 4
  assert.equal(d.act(s, 'a', { type: 'draw' }), null); // a 2:4 encaixa: tem que jogar
  s = d.act(s, 'a', { type: 'play', id: T(2, 4), end: 'R' });
  assert.equal(s.turn, 1);
});

test('modo pontos: pontas múltiplas de 5 marcam (carroça na ponta conta dobrado)', () => {
  // Linha 5:5 (carroça sozinha) -> pontas 10.
  assert.equal(d.endsSum([{ id: T(5, 5), l: 5, r: 5 }]), 10);
  // 2:3 + 3:3 na ponta direita -> 2 + 6 = 8
  assert.equal(d.endsSum([{ id: T(2, 3), l: 2, r: 3 }, { id: T(3, 3), l: 3, r: 3 }]), 8);
  let s = at({ mode: 'pontos', hands: [[T(4, 6), T(0, 0)], [T(1, 2)]], line: [{ id: T(4, 4), l: 4, r: 4 }, { id: T(1, 4), l: 4, r: 1 }] });
  // Jogar 4:6 na esquerda: pontas 6 + 1 = 7 (nada). Jogar... monta outra:
  s = at({ mode: 'pontos', hands: [[T(4, 6), T(0, 0)], [T(1, 2)]], line: [{ id: T(4, 5), l: 4, r: 5 }] });
  s = d.act(s, 'a', { type: 'play', id: T(4, 6), end: 'L' }); // pontas 6 + 5 = 11
  assert.equal(s.players[0].score, 0);
  s = at({ mode: 'pontos', hands: [[T(0, 4), T(2, 2)], [T(1, 2)]], line: [{ id: T(4, 5), l: 4, r: 5 }] });
  s = d.act(s, 'a', { type: 'play', id: T(0, 4), end: 'L' }); // pontas 0 + 5 = 5
  assert.equal(s.players[0].score, 5);
  assert.equal(s.last.points, 5);
});

test('batida: quem descarta a última peça vence (modo batida termina a partida)', () => {
  let s = at({ hands: [[T(4, 6)], [T(1, 2), T(5, 5)]], line: [{ id: T(3, 4), l: 3, r: 4 }] });
  s = d.act(s, 'a', { type: 'play', id: T(4, 6), end: 'R' });
  assert.equal(s.phase, 'over');
  assert.deepEqual(d.outcome(s), { winners: ['a'] });
});

test('pontos: quem bate ganha as mãos dos outros arredondadas para múltiplo de 5', () => {
  let s = at({ mode: 'pontos', hands: [[T(4, 6)], [T(1, 2), T(5, 5)]], line: [{ id: T(3, 4), l: 3, r: 4 }] });
  s = d.act(s, 'a', { type: 'play', id: T(4, 6), end: 'R' }); // pontas 3+6=9: nada
  assert.equal(s.phase, 'round');
  assert.equal(s.roundResult.bonus, 15); // 13 -> 15
  assert.equal(s.players[0].score, 15);
  s = d.act(s, 'b', { type: 'next-round' });
  assert.equal(s.round, 2);
  assert.equal(s.turn, 0); // quem venceu começa
  assert.equal(s.mustPlay, null);
});

test('trancado: menor soma na mão vence', () => {
  let s = at({ hands: [[T(6, 6)], [T(0, 1)]], line: [{ id: T(3, 4), l: 3, r: 4 }] });
  s = d.act(s, 'a', { type: 'pass' });
  s = d.act(s, 'b', { type: 'pass' });
  assert.equal(s.phase, 'over');
  assert.equal(s.roundResult.reason, 'trancado');
  assert.deepEqual(d.outcome(s), { winners: ['b'] });
});

test('view esconde as mãos dos outros e o monte; revela ao fim da rodada', () => {
  const s = d.setup(P2);
  const v = d.view(s, 'a');
  assert.equal(v.players[0].hand.length, 7);
  assert.equal(v.players[1].hand.length, 0);
  assert.equal(v.players[1].handCount, 7);
  assert.equal(v.stock.length, 0);
  assert.equal(v.stockCount, 14);
  const spectator = d.view(s, null);
  assert.ok(spectator.players.every((p) => p.hand.length === 0));
});

test('partidas aleatórias (2, 3 e 4; batida e pontos) terminam sem perder peças', () => {
  for (let g = 0; g < 60; g++) {
    const n = 2 + (g % 3);
    const mode = g % 2 ? 'pontos' : 'batida';
    let s = d.setup(P4.slice(0, n), { mode });
    for (let k = 0; k < 20000 && s.phase !== 'over'; k++) {
      let id; let a;
      if (s.phase === 'round') { id = s.players[0].id; a = { type: 'next-round' }; }
      else {
        id = s.players[s.turn].id;
        const plays = d.legalPlays(s);
        a = plays.length ? { type: 'play', ...plays[Math.floor(Math.random() * plays.length)] }
          : s.stock.length ? { type: 'draw' } : { type: 'pass' };
      }
      const next = d.act(s, id, a);
      assert.ok(next, `ação recusada: ${JSON.stringify(a)}`);
      s = next;
      const total = s.stock.length + s.line.length + s.players.reduce((t, p) => t + p.hand.length, 0);
      assert.equal(total, 28);
    }
    assert.equal(s.phase, 'over');
  }
});
