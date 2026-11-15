import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../web/js/games/damas/rules.js';
import * as G from '../web/js/games/plano-quadrante/rules.js';
import * as bd from '../web/js/bots/damas.js';
import * as bp from '../web/js/bots/plano-quadrante.js';

const P = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

function damas(levelA, levelB, swap, opts = {}) {
  let s = D.setup(swap ? [P[1], P[0]] : P);
  const lvl = { a: levelA, b: levelB };
  for (let n = 0; n < 300 && s.phase === 'play'; n++) {
    const id = D.activePlayers(s)[0];
    const a = bd.decide(s, id, lvl[id], opts);
    const next = D.act(s, id, a);
    assert.ok(next, `robô de damas fez lance ilegal: ${JSON.stringify(a)}`);
    s = next;
  }
  return s.phase === 'over' && s.winner != null ? s.players[s.winner].id : 'empate';
}

function pq(levelA, levelB, swap) {
  let s = G.setup(swap ? [P[1], P[0]] : P);
  const lvl = { a: levelA, b: levelB };
  for (let n = 0; n < 5000 && s.phase !== 'over'; n++) {
    const id = s.players[s.current].id;
    const a = bp.decide(s, id, lvl[id]);
    const next = G.act(s, id, a);
    assert.ok(next, `robô do Plano Quadrante fez jogada ilegal na fase ${s.phase}: ${JSON.stringify(a)}`);
    s = next;
  }
  assert.equal(s.phase, 'over');
  return s.players[s.winner].id;
}

test('damas: robô não joga fora da vez e responde a proposta de empate', () => {
  const s = D.setup(P);
  assert.equal(bd.decide(s, 'b', 'medio'), null);
  const offer = D.act(s, 'a', { type: 'offer-draw' });
  const ans = bd.decide(offer, 'b', 'medio');
  assert.equal(ans.type, 'answer-draw');
  assert.equal(ans.accept, false); // posição igual: não aceita
});

test('damas: robô encontra a captura dupla (lei da maioria) e a vitória', () => {
  const s = D.setup(P);
  s.board = Array(64).fill(null);
  const at = (t) => D.sq(Number(t[1]) - 1, 'abcdefgh'.indexOf(t[0]));
  s.board[at('d4')] = { s: 'w', k: false };
  s.board[at('e5')] = { s: 'b', k: false };
  s.board[at('g7')] = { s: 'b', k: false };
  const a = bd.decide(s, 'a', 'dificil', { timeMs: 50 });
  assert.deepEqual(a.path.map(D.name), ['f6', 'h8']);
});

test('damas: Médio vence o Fácil e o Difícil vence o Médio (maioria)', () => {
  let m = 0;
  for (let i = 0; i < 10; i++) if (damas('medio', 'facil', i % 2) === 'a') m++;
  assert.ok(m >= 6, `médio venceu só ${m}/10 do fácil`);
  let d = 0;
  let lost = 0;
  for (let i = 0; i < 4; i++) {
    const r = damas('dificil', 'medio', i % 2, { timeMs: 60 });
    if (r === 'a') d++;
    if (r === 'b') lost++;
  }
  assert.ok(d > lost, `difícil ${d} x ${lost} médio`);
});

test('Plano Quadrante: robôs só fazem jogadas válidas e os níveis se ordenam', () => {
  let m = 0;
  for (let i = 0; i < 60; i++) if (pq('medio', 'facil', i % 2) === 'a') m++;
  assert.ok(m >= 39, `médio venceu só ${m}/60 do fácil`);
  let d = 0;
  for (let i = 0; i < 60; i++) if (pq('dificil', 'medio', i % 2) === 'a') d++;
  assert.ok(d >= 31, `difícil venceu só ${d}/60 do médio`);
});

test('Plano Quadrante com 4: robôs de todos os níveis terminam a partida', () => {
  const four = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id }));
  const lvl = { a: 'facil', b: 'medio', c: 'dificil', d: 'medio' };
  let s = G.setup(four);
  for (let n = 0; n < 8000 && s.phase !== 'over'; n++) {
    const id = s.players[s.current].id;
    const next = G.act(s, id, bp.decide(s, id, lvl[id]));
    assert.ok(next);
    s = next;
  }
  assert.equal(s.phase, 'over');
});
