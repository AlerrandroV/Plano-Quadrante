import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pf from '../web/js/games/pife/rules.js';
import { codeOf } from '../web/js/ui/cards52.js';

const P = (n) => ['a', 'b', 'c'].slice(0, n).map((id) => ({ id, name: id.toUpperCase() }));
// Naipes: 0 ouros, 1 paus, 2 copas, 3 espadas. deck = 0 (primeiro baralho) ou 1.
const K = (suit, rank, deck = 0) => deck * 52 + codeOf(suit, rank);
const MELE = 104; // coringa (regra da casa)

// Sem melé por padrão nestes testes (as regras do melé têm testes próprios).
function at({ hands, discard = [], turn = 0, phase = 'draw', opts = { mele: 'sem' }, vira = null, discardBy = null }) {
  const s = pf.setup(P(hands.length), opts);
  const used = new Set([...hands.flat(), ...discard, ...(vira != null ? [vira] : [])]);
  s.players.forEach((p, i) => { p.hand = hands[i]; p.moved = false; p.choque = false; });
  s.discard = discard;
  s.vira = vira;
  s.deck = Array.from({ length: s.house.coringa ? 108 : 104 }, (_, i) => i).filter((i) => !used.has(i));
  s.turn = turn; s.phase = phase; s.drewFrom = null; s.took = null; s.discardBy = discardBy;
  return s;
}

test('dois baralhos (104), a vira fica exposta; coringas só como regra da casa', () => {
  const c = pf.setup(P(3), {});
  assert.ok(c.vira != null);
  assert.equal(c.deck.length + 27 + 1, 104);
  assert.ok(c.players.every((p) => p.hand.length === 9));
  const sem = pf.setup(P(3), { mele: 'sem' });
  assert.equal(sem.vira, null); assert.equal(sem.deck.length + 27, 104);
  const cor = pf.setup(P(3), { casa: ['coringa'] });
  assert.equal(cor.deck.length + 27 + 1, 108);
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
  let o = at({ hands: [[...nine.slice(0, 8), K(2, 2)], [1, 2]], opts: { mele: 'sem', casa: [] } });
  o = pf.act(o, 'a', { type: 'draw', from: 'deck' });
  o = pf.act(o, 'a', { type: 'bater', groups: wrong, discard: o.players[0].hand[9] });
  assert.equal(o.players[0].choque, false);
});

test('bater de naipe (melé vale qualquer naipe) e mão sem par', () => {
  const ouros = [1, 2, 4, 6, 8, 9, 11, 13].map((r) => K(0, r));
  let s = at({ hands: [[...ouros, MELE], [1, 2]], opts: { mele: 'sem', casa: ['naipe', 'coringa'] } });
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

// ------------------------------------------------------ vira e melés

test('a vira define 5 melés: o clone e o valor seguinte da mesma cor', () => {
  const vira = K(0, 4); // 4 de Ouros
  assert.deepEqual([...pf.meleCodes(vira)].sort((a, b) => a - b), [codeOf(0, 4), codeOf(0, 5), codeOf(2, 5)].sort((a, b) => a - b));
  // Depois do Rei vem o Ás; preta (Espadas) -> Paus e Espadas.
  assert.deepEqual([...pf.meleCodes(K(3, 13))].sort((a, b) => a - b), [codeOf(1, 1), codeOf(3, 1), codeOf(3, 13)].sort((a, b) => a - b));
  const s = at({ hands: [[1], [2]], opts: {}, vira });
  const W = pf.wildFn(s);
  const meles = Array.from({ length: 104 }, (_, i) => i).filter((i) => i !== vira && W(i));
  assert.equal(meles.length, 5); // o 4♦ da vira está fora: sobra o clone + dois 5♦ + dois 5♥
});

test('melé vale qualquer carta (um por jogo) ou ele mesmo', () => {
  const s = at({ hands: [[1], [2]], opts: {}, vira: K(0, 4) });
  const W = pf.wildFn(s);
  const m5 = K(2, 5); // 5 de Copas: melé
  assert.ok(pf.isMeld([K(1, 9), K(3, 9), m5], W)); // trinca de 9 com melé
  assert.ok(pf.isMeld([K(2, 4), m5, K(2, 6)], W)); // vale ele mesmo
  assert.ok(pf.isMeld([K(1, 2), m5, K(1, 4)], W)); // vale o 3 de Paus
  assert.ok(!pf.isMeld([K(1, 2), m5, K(0, 5, 1)], W)); // dois melés como curinga: não
});

test('melé do descarte só se for a última carta que falta para bater', () => {
  const vira = K(0, 4);
  const armed = [K(0, 7), K(1, 7), K(2, 7), K(3, 4), K(3, 5), K(3, 6), K(1, 10), K(1, 11), K(2, 2)];
  // Não fecha com o melé: não pode pegar.
  let s = at({ hands: [[K(0, 1), K(1, 3), K(2, 9), K(3, 12), K(0, 9), K(1, 6), K(2, 13), K(3, 2), K(0, 11)], [1, 2]], discard: [K(2, 5)], opts: {}, vira, discardBy: 1 });
  assert.equal(pf.act(s, 'a', { type: 'draw', from: 'discard' }), null);
  // Fecha (o melé vira o Q de Paus): pode.
  s = at({ hands: [armed, [1, 2]], discard: [K(2, 5)], opts: {}, vira, discardBy: 1 });
  s = pf.act(s, 'a', { type: 'draw', from: 'discard' });
  assert.ok(s && s.phase === 'discard');
});

test('armado bate com o descarte fora da vez; atrasado é choque', () => {
  const armed = [K(0, 7), K(1, 7), K(2, 7), K(3, 4), K(3, 5), K(3, 6), K(1, 10), K(1, 11), K(2, 2)];
  // A descartou o Q de Paus; é a vez de B, mas C está armado.
  let s = at({ hands: [[5, 6], [8, 9], armed], discard: [K(1, 12)], turn: 1, discardBy: 0 });
  assert.deepEqual(pf.pendingPlayers(s), ['c', 'b']); // C pode agir antes de B
  assert.equal(pf.claimable(s, 2), K(1, 12));
  const won = pf.act(s, 'c', { type: 'claim', card: K(1, 12) });
  assert.equal(won.phase, 'over'); assert.equal(won.winner, 2);
  assert.ok(won.discard.includes(K(2, 2))); // descartou a que sobrou
  // Quem descartou não pode pegar a própria carta.
  assert.equal(pf.act(s, 'a', { type: 'claim', card: K(1, 12) }), null);
  // Atrasado: B já descartou outra por cima.
  let t = pf.act(s, 'b', { type: 'draw', from: 'deck' });
  t = pf.act(t, 'b', { type: 'discard', id: t.players[1].hand[0] });
  t = pf.act(t, 'c', { type: 'claim', card: K(1, 12) });
  assert.equal(t.phase, 'draw'); assert.equal(t.players[2].choque, true);
  // Com choque, não bate com o descarte nem fora da vez.
  t.discard.push(K(1, 12)); t.discardBy = 0;
  const u = pf.act(t, 'c', { type: 'claim', card: K(1, 12) });
  assert.equal(u.phase, 'draw');
});
