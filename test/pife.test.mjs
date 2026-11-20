import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pf from '../web/js/games/pife/rules.js';
import { codeOf } from '../web/js/ui/cards52.js';

const P = (n) => ['a', 'b', 'c'].slice(0, n).map((id) => ({ id, name: id.toUpperCase() }));
// Naipes: 0 ouros, 1 paus, 2 copas, 3 espadas. deck = 0 (primeiro baralho) ou 1.
const K = (suit, rank, deck = 0) => deck * 52 + codeOf(suit, rank);
const MELE = 104;

function at({ hands, discard = [], turn = 0, phase = 'draw', opts = {} }) {
  const s = pf.setup(P(hands.length), opts);
  const used = new Set([...hands.flat(), ...discard]);
  s.players.forEach((p, i) => { p.hand = hands[i]; p.moved = false; p.choque = false; });
  s.discard = discard;
  s.deck = Array.from({ length: s.house.mele ? 108 : 104 }, (_, i) => i).filter((i) => !used.has(i));
  s.turn = turn; s.phase = phase; s.drewFrom = null; s.took = null;
  return s;
}

test('dois baralhos (104) + 4 melés só com a regra; 9 cartas cada', () => {
  const t = pf.setup(P(3), { regras: 'tradicional' });
  assert.equal(t.deck.length + 27, 104);
  const c = pf.setup(P(3), {});
  assert.equal(c.deck.length + 27, 108);
  assert.ok(c.players.every((p) => p.hand.length === 9));
});

test('jogos: trinca de naipes diferentes, sequência do mesmo naipe, melé', () => {
  assert.ok(pf.isMeld([K(0, 7), K(1, 7), K(2, 7)]));
  assert.ok(!pf.isMeld([K(0, 7), K(0, 7, 1), K(2, 7)])); // naipe repetido
  assert.ok(pf.isMeld([K(3, 4), K(3, 5), K(3, 6)]));
  assert.ok(pf.isMeld([K(3, 1), K(3, 2), K(3, 3)])); // A-2-3
  assert.ok(pf.isMeld([K(3, 12), K(3, 13), K(3, 1)])); // Q-K-A
  assert.ok(!pf.isMeld([K(3, 13), K(3, 1), K(3, 2)])); // K-A-2 não
  assert.ok(!pf.isMeld([K(3, 4), K(2, 5), K(3, 6)]));
  assert.ok(pf.isMeld([K(3, 4), MELE, K(3, 6)]));
  assert.ok(pf.isMeld([K(1, 9), K(2, 9), MELE]));
  assert.ok(!pf.isMeld([K(1, 9), MELE, MELE + 1])); // um melé por jogo
});

test('bater com 3 jogos; descartar a 10ª', () => {
  const nine = [K(0, 7), K(1, 7), K(2, 7), K(3, 4), K(3, 5), K(3, 6), K(1, 10), K(1, 11), K(1, 12)];
  let s = at({ hands: [[...nine.slice(0, 8), K(2, 2)], [1, 2]], discard: [nine[8]] });
  s = pf.act(s, 'a', { type: 'draw', from: 'discard' });
  assert.equal(s.phase, 'discard');
  const groups = [nine.slice(0, 3), nine.slice(3, 6), nine.slice(6)];
  s = pf.act(s, 'a', { type: 'bater', groups, discard: K(2, 2) });
  assert.equal(s.phase, 'over'); assert.equal(s.winner, 0);
  assert.deepEqual(pf.outcome(s), { winners: ['a'] });
  assert.ok(pf.findWin([...nine, K(2, 2)], {}));
});

test('não pode descartar a carta que acabou de pegar do descarte', () => {
  let s = at({ hands: [[K(0, 1), K(0, 3)], [5]], discard: [K(2, 9)] });
  s = pf.act(s, 'a', { type: 'draw', from: 'discard' });
  assert.equal(pf.act(s, 'a', { type: 'discard', id: K(2, 9) }), null);
  assert.ok(pf.act(s, 'a', { type: 'discard', id: K(0, 1) }));
});

test('choque: anunciou errado, só bate com carta do monte', () => {
  const nine = [K(0, 7), K(1, 7), K(2, 7), K(3, 4), K(3, 5), K(3, 6), K(1, 10), K(1, 11), K(1, 12)];
  let s = at({ hands: [[...nine.slice(0, 8), K(2, 2)], [1, 2]], discard: [nine[8]] });
  s = pf.act(s, 'a', { type: 'draw', from: 'deck' });
  const wrong = [nine.slice(0, 3), nine.slice(3, 6), [nine[6], nine[7], K(2, 2)]];
  s = pf.act(s, 'a', { type: 'bater', groups: wrong, discard: s.players[0].hand[9] });
  assert.equal(s.players[0].choque, true); assert.equal(s.phase, 'discard');
  s = pf.act(s, 'a', { type: 'discard', id: s.players[0].hand[9] });
  s = pf.act(s, 'b', { type: 'draw', from: 'deck' });
  s = pf.act(s, 'b', { type: 'discard', id: s.players[1].hand[0] });
  s.discard.push(nine[8]);
  s = pf.act(s, 'a', { type: 'draw', from: 'discard' });
  const groups = [nine.slice(0, 3), nine.slice(3, 6), nine.slice(6)];
  const t = pf.act(s, 'a', { type: 'bater', groups, discard: K(2, 2) });
  assert.equal(t.phase, 'discard'); // bloqueado: veio do descarte
  // Sem a regra do choque, anunciar errado só é recusado.
  let o = at({ hands: [[...nine.slice(0, 8), K(2, 2)], [1, 2]], opts: { regras: 'tradicional' } });
  o = pf.act(o, 'a', { type: 'draw', from: 'deck' });
  o = pf.act(o, 'a', { type: 'bater', groups: wrong, discard: o.players[0].hand[9] });
  assert.equal(o.players[0].choque, false);
});

test('bater de naipe (melé vale qualquer naipe) e mão sem par', () => {
  const ouros = [1, 2, 4, 6, 8, 9, 11, 13].map((r) => K(0, r));
  let s = at({ hands: [[...ouros, MELE], [1, 2]] });
  s = pf.act(s, 'a', { type: 'draw', from: 'deck' });
  const d = s.players[0].hand[9];
  s = pf.act(s, 'a', { type: 'bater', groups: [ouros.slice(0, 3), ouros.slice(3, 6), [...ouros.slice(6), MELE]], discard: d });
  assert.equal(s.phase, 'over'); assert.equal(s.result.kind, 'naipe');

  const semPar = [K(0, 1), K(0, 5), K(0, 9), K(1, 2), K(1, 6), K(1, 13), K(2, 3), K(2, 11), K(3, 7)];
  assert.ok(pf.noPair(semPar));
  assert.ok(!pf.noPair([...semPar.slice(0, 8), K(3, 5)])); // dois 5
  assert.ok(!pf.noPair([...semPar.slice(0, 8), K(2, 5)])); // 3 e 5 de copas: dupla furada
  s = at({ hands: [semPar, [1, 2]] });
  assert.ok(pf.canNoPair(s, 0));
  s = pf.act(s, 'a', { type: 'nopair' });
  assert.equal(s.phase, 'over'); assert.equal(s.result.kind, 'semPar');
});
