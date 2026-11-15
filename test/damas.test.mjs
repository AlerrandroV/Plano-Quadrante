import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../web/js/games/damas/rules.js';

const P = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Beto' }];
const at = (txt) => { // 'c3' -> índice
  const c = 'abcdefgh'.indexOf(txt[0]);
  return d.sq(Number(txt.slice(1)) - 1, c);
};
/** Tabuleiro vazio com as peças dadas: { c3: 'w', d4: 'b', e5: 'W' (dama) } */
function pos(pieces, turn = 'w') {
  const s = d.setup(P);
  s.board = Array(64).fill(null);
  for (const [k, v] of Object.entries(pieces)) s.board[at(k)] = { s: v.toLowerCase(), k: v === v.toUpperCase() };
  s.turn = turn;
  return s;
}
const fmt = (m) => [m.from, ...m.path].map(d.name).join(m.captures.length ? 'x' : '-');

test('posição inicial: 12 pedras de cada lado em casas escuras, a1 escura', () => {
  const s = d.setup(P);
  assert.ok(d.isDark(at('a1')));
  assert.equal(d.count(s, 'w').total, 12);
  assert.equal(d.count(s, 'b').total, 12);
  assert.ok(s.board.every((p, i) => !p || d.isDark(i)));
  assert.equal(s.turn, 'w');
  assert.equal(d.legalMoves(s).length, 7);
});

test('cores padrão: branco e preto; cada um pode escolher outra', () => {
  assert.deepEqual(d.setup(P).players.map((p) => p.color), ['branco', 'preto']);
  const s = d.setup([{ ...P[0], color: 'rosa' }, { ...P[1], color: 'rosa' }]);
  assert.equal(s.players[0].color, 'rosa');
  assert.notEqual(s.players[1].color, 'rosa');
});

test('pedra anda só para frente', () => {
  const s = pos({ d4: 'w' });
  assert.deepEqual(d.legalMoves(s).map(fmt).sort(), ['d4-c5', 'd4-e5']);
});

test('pedra captura para trás', () => {
  const s = pos({ d4: 'w', c3: 'b' });
  assert.deepEqual(d.legalMoves(s).map(fmt), ['d4xb2']);
});

test('captura é obrigatória', () => {
  const s = pos({ d4: 'w', h2: 'w', e5: 'b' });
  assert.deepEqual(d.legalMoves(s).map(fmt), ['d4xf6']);
});

test('lei da maioria: obrigatório capturar mais peças', () => {
  // d4 pode pegar 1 (c5) ou 2 (e5 e depois g7); g3 pode pegar 1.
  const s = pos({ d4: 'w', g3: 'w', c5: 'b', e5: 'b', g7: 'b', h4: 'b' });
  const moves = d.legalMoves(s);
  assert.ok(moves.every((m) => m.captures.length === 2), moves.map(fmt).join(' '));
  assert.deepEqual(moves.map(fmt), ['d4xf6xh8']);
});

test('dama voadora anda longe e captura à distância, parando em qualquer casa livre', () => {
  const s = pos({ a1: 'W', d4: 'b' });
  const moves = d.legalMoves(s).map(fmt).sort();
  assert.deepEqual(moves, ['a1xe5', 'a1xf6', 'a1xg7', 'a1xh8']);
});

test('dama: depois da captura só valem pousos que continuam capturando (maioria)', () => {
  const s = pos({ a1: 'W', c3: 'b', f4: 'b' });
  // a1 x c3 -> pousa em d4 ou e5...; de e5 pega f4 (vai a g3/h2). Total 2.
  const moves = d.legalMoves(s);
  assert.ok(moves.every((m) => m.captures.length === 2));
  assert.ok(moves.every((m) => d.name(m.path[0]) === 'e5'), moves.map(fmt).join(' '));
});

test('peça capturada não sai até o fim do lance e não pode ser saltada duas vezes', () => {
  // Dama em a1 com pretas em b2... posição em que voltar exigiria saltar a mesma peça.
  const s = pos({ c1: 'W', d2: 'b', f4: 'b', f2: 'b' });
  const moves = d.legalMoves(s);
  for (const m of moves) assert.equal(new Set(m.captures).size, m.captures.length);
  const after = d.act(s, 'a', { type: 'move', from: moves[0].from, path: moves[0].path });
  for (const c of moves[0].captures) assert.equal(after.board[c], null);
});

test('promoção: pedra que termina na última fileira vira dama', () => {
  let s = pos({ c7: 'w', h4: 'b' });
  s = d.act(s, 'a', { type: 'move', from: at('c7'), path: [at('b8')] });
  assert.equal(s.board[at('b8')].k, true);
});

test('promoção: passando pela última fileira no meio da captura, continua pedra', () => {
  // Branca em d6 captura c7 -> b8 e depois volta capturando c7? Monta: d6 x e7 -> f8, f8 x g7 -> h6.
  const s = pos({ d6: 'w', e7: 'b', g7: 'b', a1: 'b' });
  const moves = d.legalMoves(s);
  assert.deepEqual(moves.map(fmt), ['d6xf8xh6']);
  const after = d.act(s, 'a', { type: 'move', from: moves[0].from, path: moves[0].path });
  assert.equal(after.board[at('h6')].k, false);
});

test('só o lado da vez joga; lance ilegal é recusado', () => {
  const s = d.setup(P);
  assert.equal(d.act(s, 'b', { type: 'move', from: at('b6'), path: [at('a5')] }), null);
  assert.equal(d.act(s, 'a', { type: 'move', from: at('c3'), path: [at('c4')] }), null);
  assert.ok(d.act(s, 'a', { type: 'move', from: at('c3'), path: [at('d4')] }));
});

test('perde quem fica sem lances; desistência e empate combinado', () => {
  // Pedra preta em b8 cercada: a7 e c7 brancas, d6 bloqueia o salto.
  let s = pos({ b8: 'b', a7: 'w', c7: 'w', d6: 'w', e3: 'w' }, 'w');
  s = d.act(s, 'a', { type: 'move', from: at('e3'), path: [at('f4')] });
  assert.equal(s.phase, 'over');
  assert.equal(s.endReason, 'sem lances');
  assert.equal(s.winner, 0);
  let r = d.act(d.setup(P), 'b', { type: 'resign' });
  assert.equal(r.phase, 'over'); assert.equal(r.winner, 0);
  r = d.act(d.setup(P), 'a', { type: 'offer-draw' });
  assert.equal(d.act(r, 'a', { type: 'answer-draw', accept: true }), null);
  r = d.act(r, 'b', { type: 'answer-draw', accept: true });
  assert.equal(r.phase, 'over'); assert.equal(r.winner, null);
  assert.deepEqual(d.outcome(r), { winners: [] });
});

test('vitória quando o adversário fica sem peças', () => {
  let s = pos({ d4: 'w', e5: 'b' });
  s = d.act(s, 'a', { type: 'move', from: at('d4'), path: [at('f6')] });
  assert.equal(s.phase, 'over');
  assert.deepEqual(d.outcome(s), { winners: ['a'] });
});

test('regra dos 20 lances só com damas', () => {
  let s = pos({ a1: 'W', h2: 'B' }); // damas que não se alcançam
  const moves = [['a1', 'b2'], ['h2', 'g1'], ['b2', 'a1'], ['g1', 'h2']];
  for (let i = 0; i < 40 && s.phase === 'play'; i++) {
    const [f, t] = moves[i % 4];
    s = d.act(s, i % 2 === 0 ? 'a' : 'b', { type: 'move', from: at(f), path: [at(t)] });
    assert.ok(s, `lance ${f}-${t} recusado`);
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, null);
});

test('reiniciar troca os lados', () => {
  let s = d.act(d.setup(P), 'a', { type: 'resign' });
  s = d.act(s, 'a', { type: 'restart' });
  assert.equal(s.players[0].id, 'b');
  assert.equal(s.players[0].side, 'w');
});

test('partidas aleatórias terminam e a contagem de peças só diminui', () => {
  for (let g = 0; g < 60; g++) {
    let s = d.setup(P);
    let steps = 0;
    while (s.phase === 'play' && steps < 2000) {
      const moves = d.legalMoves(s);
      const m = moves[Math.floor(Math.random() * moves.length)];
      const before = d.count(s, 'w').total + d.count(s, 'b').total;
      const id = d.activePlayers(s)[0];
      s = d.act(s, id, { type: 'move', from: m.from, path: m.path });
      assert.ok(s);
      const after = d.count(s, 'w').total + d.count(s, 'b').total;
      assert.equal(before - after, m.captures.length);
      assert.ok(s.board.every((p, i) => !p || d.isDark(i)));
      steps++;
    }
    assert.equal(s.phase, 'over', 'partida não terminou');
  }
});
