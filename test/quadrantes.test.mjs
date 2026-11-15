import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../web/js/game/quadrantes.js';

const players = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Beto' }];

test('quadrantOf', () => {
  assert.equal(g.quadrantOf({ x: 2, y: 3 }), 1);
  assert.equal(g.quadrantOf({ x: -2, y: 3 }), 2);
  assert.equal(g.quadrantOf({ x: -2, y: -3 }), 3);
  assert.equal(g.quadrantOf({ x: 2, y: -3 }), 4);
  assert.equal(g.quadrantOf({ x: 0, y: -3 }), 0);
});

test('só o jogador da vez joga e acerto soma ponto', () => {
  let s = g.setup(players);
  assert.equal(g.act(s, 'b', { type: 'answer', quadrant: 1 }), null);
  const right = g.quadrantOf(s.point);
  s = g.act(s, 'a', { type: 'answer', quadrant: right });
  assert.equal(s.players[0].score, 1);
  assert.deepEqual(g.activePlayers(s), ['b']);
});

test('jogadas inválidas são recusadas', () => {
  const s = g.setup(players);
  assert.equal(g.act(s, 'a', { type: 'answer', quadrant: 7 }), null);
  assert.equal(g.act(s, 'a', null), null);
  assert.equal(g.act(s, 'a', { type: 'restart' }), null);
});

test('partida termina após todas as rodadas e pode reiniciar', () => {
  let s = g.setup(players);
  for (let i = 0; i < s.rounds * players.length; i++) {
    s = g.act(s, g.activePlayers(s)[0], { type: 'answer', quadrant: 1 });
  }
  assert.equal(s.over, true);
  assert.deepEqual(g.activePlayers(s), []);
  s = g.act(s, 'a', { type: 'restart' });
  assert.equal(s.over, false);
  assert.equal(s.players.every((p) => p.score === 0), true);
});
