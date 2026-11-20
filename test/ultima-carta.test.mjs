import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as u from '../web/js/games/ultima-carta/rules.js';
import * as bot from '../web/js/bots/ultima-carta.js';

const P = (n) => ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, n).map((id) => ({ id, name: id.toUpperCase() }));
const C = (c, k, v) => u.CARDS.findIndex((x) => x.c === c && x.k === k && (v == null || x.v === v));
// Segunda cópia da mesma carta (para o corte).
const C2 = (c, k, v) => u.CARDS.findIndex((x, i) => i !== C(c, k, v) && x.c === c && x.k === k && (v == null || x.v === v));
const total = (s) => s.deck.length + s.discard.length + s.players.reduce((t, p) => t + p.hand.length, 0);

/** Estado controlado: mãos, carta da mesa e vez definidas à mão. */
function at({ n = 2, hands, top, color, turn = 0, opts = {} }) {
  const s = u.setup(P(n), opts);
  const used = new Set([...hands.flat(), top]);
  s.players.forEach((p, i) => { p.hand = hands[i] || []; p.called = false; });
  s.discard = [top];
  s.deck = u.CARDS.map((_, i) => i).filter((i) => !used.has(i));
  s.color = color || u.CARDS[top].c;
  s.turn = turn; s.dir = 1; s.phase = 'play'; s.pending = 0; s.drawn = null; s.vulnerable = null; s.wild = null;
  return s;
}

test('baralho de 108 cartas e 7 para cada', () => {
  assert.equal(u.CARDS.length, 108);
  assert.equal(u.CARDS.filter((c) => c.k === 'mais4').length, 4);
  assert.equal(u.CARDS.filter((c) => c.c === 'chama' && c.k === 'n' && c.v === 0).length, 1);
  for (let k = 0; k < 30; k++) {
    const s = u.setup(P(4));
    assert.ok(s.players.every((p) => p.hand.length === 7 || p.hand.length === 9)); // +2 virado
    assert.equal(total(s), 108);
    assert.notEqual(u.CARDS[u.topCard(s)].k, 'mais4'); // +4 nunca é a carta inicial
  }
});

test('combina pela cor ou pelo número/símbolo; Coringa sempre', () => {
  const s = at({ hands: [[C('gota', 'n', 5), C('chama', 'n', 3), C('folha', 'pula'), C(null, 'coringa')], []], top: C('chama', 'n', 5) });
  const ok = u.playable(s, s.players[0].hand);
  assert.deepEqual(ok.sort(), [C('gota', 'n', 5), C('chama', 'n', 3), C(null, 'coringa')].sort());
  assert.equal(u.act(s, 'a', { type: 'play', id: C('folha', 'pula') }), null);
  assert.equal(u.act(s, 'b', { type: 'play', id: C('gota', 'n', 5) }), null); // fora da vez
});

test('Pula, Volta (vale Pula com 2) e +2', () => {
  let s = at({ n: 3, hands: [[C('sol', 'pula'), 1], [2], [3]], top: C('sol', 'n', 1) });
  s = u.act(s, 'a', { type: 'play', id: C('sol', 'pula') });
  assert.equal(s.turn, 2);
  s = at({ n: 3, hands: [[C('sol', 'volta'), 1], [2], [3]], top: C('sol', 'n', 1) });
  s = u.act(s, 'a', { type: 'play', id: C('sol', 'volta') });
  assert.equal(s.dir, -1); assert.equal(s.turn, 2);
  s = at({ n: 2, hands: [[C('sol', 'volta'), 1], [2]], top: C('sol', 'n', 1) });
  s = u.act(s, 'a', { type: 'play', id: C('sol', 'volta') });
  assert.equal(s.turn, 0); // com 2 jogadores, joga de novo
  s = at({ n: 3, hands: [[C('sol', 'mais2'), 1], [2], [3]], top: C('sol', 'n', 1) });
  s = u.act(s, 'a', { type: 'play', id: C('sol', 'mais2') });
  assert.equal(s.players[1].hand.length, 3); assert.equal(s.turn, 2);
});

test('Coringa: escolhe a cor e passa a vez', () => {
  let s = at({ hands: [[C(null, 'coringa'), 1], [2]], top: C('sol', 'n', 1) });
  s = u.act(s, 'a', { type: 'play', id: C(null, 'coringa') });
  assert.equal(s.phase, 'color');
  assert.equal(u.act(s, 'b', { type: 'color', color: 'gota' }), null);
  s = u.act(s, 'a', { type: 'color', color: 'gota' });
  assert.equal(s.color, 'gota'); assert.equal(s.turn, 1); assert.equal(s.phase, 'play');
});

test('+4: aceitar, desafiar certo (tinha a cor) e errado (blefe não houve)', () => {
  const plus4 = C(null, 'mais4');
  const base = (mine) => {
    let s = at({ hands: [[plus4, ...mine], [C('folha', 'n', 9), C('folha', 'n', 8)]], top: C('sol', 'n', 1) });
    s = u.act(s, 'a', { type: 'play', id: plus4 });
    s = u.act(s, 'a', { type: 'color', color: 'gota' });
    assert.equal(s.phase, 'challenge'); assert.equal(s.turn, 1);
    assert.equal(u.view(s, 'b').wild.hadColor, undefined); // ninguém vê se foi blefe
    return s;
  };
  let s = u.act(base([C('gota', 'n', 2)]), 'b', { type: 'accept' });
  assert.equal(s.players[1].hand.length, 6); assert.equal(s.turn, 0);
  // Tinha carta de sol (a cor da mesa): desafio certo, quem compra 4 é ele.
  s = u.act(base([C('sol', 'n', 2)]), 'b', { type: 'challenge' });
  assert.equal(s.players[0].hand.length, 5); assert.equal(s.players[1].hand.length, 2); assert.equal(s.turn, 1);
  // Não tinha: desafiante compra 6 e perde a vez.
  s = u.act(base([C('gota', 'n', 2)]), 'b', { type: 'challenge' });
  assert.equal(s.players[1].hand.length, 8); assert.equal(s.turn, 0);
});

test('sem jogada: compra 1; se servir, pode jogar ou passar', () => {
  let s = at({ hands: [[C('gota', 'n', 2)], [3]], top: C('sol', 'n', 1) });
  s.deck.push(C('sol', 'n', 7));
  s = u.act(s, 'a', { type: 'draw' });
  assert.equal(s.drawn, C('sol', 'n', 7)); assert.equal(s.turn, 0);
  assert.equal(u.act(s, 'a', { type: 'play', id: C('gota', 'n', 2) }), null); // só a comprada
  const passed = u.act(s, 'a', { type: 'pass' });
  assert.equal(passed.turn, 1);
  s = at({ hands: [[C('gota', 'n', 2)], [3]], top: C('sol', 'n', 1) });
  s.deck.push(C('folha', 'n', 7));
  s = u.act(s, 'a', { type: 'draw' });
  assert.equal(s.turn, 1); // não serviu: passa direto
});

test('"Última!": quem esquece e é pego compra 2; gritando, ninguém pega', () => {
  let s = at({ n: 3, hands: [[C('sol', 'n', 2), C('gota', 'n', 9)], [3, 4], [5, 6]], top: C('sol', 'n', 1) });
  let t = u.act(s, 'a', { type: 'play', id: C('sol', 'n', 2) });
  assert.equal(t.vulnerable, 0);
  assert.deepEqual(u.pendingPlayers(t).sort(), ['a', 'b', 'c']);
  t = u.act(t, 'c', { type: 'catch', target: 0 });
  assert.equal(t.players[0].hand.length, 3);
  // Gritou antes de jogar.
  t = u.act(s, 'a', { type: 'call' });
  t = u.act(t, 'a', { type: 'play', id: C('sol', 'n', 2) });
  assert.equal(t.vulnerable, null);
  assert.equal(u.act(t, 'c', { type: 'catch', target: 0 }), null);
  // Esqueceu, mas o próximo jogou antes de alguém pegar: escapou.
  t = u.act(s, 'a', { type: 'play', id: C('sol', 'n', 2) });
  t.players[1].hand = [C('sol', 'n', 4), 7];
  t = u.act(t, 'b', { type: 'play', id: C('sol', 'n', 4) });
  assert.equal(u.act(t, 'c', { type: 'catch', target: 0 }), null);
});

test('carta inicial: Pula, Volta e +2 valem para o primeiro', () => {
  for (let k = 0; k < 300; k++) {
    const s = u.setup(P(4));
    const first = (s.dealer + 1) % 4;
    const kind = u.CARDS[s.discard[0]].k;
    if (kind === 'pula') assert.equal(s.turn, (first + 1) % 4);
    if (kind === 'volta') { assert.equal(s.dir, -1); assert.equal(s.turn, s.dealer); }
    if (kind === 'mais2') { assert.equal(s.players[first].hand.length, 9); assert.equal(s.turn, (first + 1) % 4); }
    if (kind === 'coringa') { assert.equal(s.phase, 'color'); assert.equal(s.turn, first); }
  }
});

test('pontos: quem bate ganha as mãos dos outros', () => {
  let s = at({ n: 3, hands: [[C('sol', 'n', 2)], [C(null, 'coringa'), C('gota', 'n', 7)], [C('folha', 'pula')]], top: C('sol', 'n', 1), opts: { vitoria: 'pontos' } });
  s.players[0].called = true;
  s = u.act(s, 'a', { type: 'play', id: C('sol', 'n', 2) });
  assert.equal(s.phase, 'round');
  assert.equal(s.players[0].score, 50 + 7 + 20);
  s = u.act(s, 'b', { type: 'next-round' });
  assert.equal(s.phase === 'play' || s.phase === 'color', true);
  assert.ok(s.players.every((p) => p.hand.length >= 7));
  assert.equal(s.players[0].score, 77);
});

// ------------------------------------------------------ regras de rua

const RUA = (...list) => ({ regras: 'rua', rua: list });

test('oficial não tem regras de rua; "de rua" liga só as escolhidas', () => {
  assert.deepEqual(u.houseRules({}), {});
  assert.equal(u.houseRules(RUA('corte')).corte, true);
  assert.equal(u.houseRules(RUA('corte')).empilhar, false);
});

test('empilhar: +2 sobre +2 acumula; quem não empilha compra tudo', () => {
  let s = at({ n: 3, hands: [[C('sol', 'mais2'), 1], [C('gota', 'mais2'), 2], [3, 4]], top: C('sol', 'n', 1), opts: RUA('empilhar') });
  s = u.act(s, 'a', { type: 'play', id: C('sol', 'mais2') });
  assert.equal(s.pending, 2); assert.equal(s.turn, 1);
  assert.equal(u.act(s, 'b', { type: 'play', id: 2 }), null); // só +2 ou +4
  s = u.act(s, 'b', { type: 'play', id: C('gota', 'mais2') });
  assert.equal(s.pending, 4);
  s = u.act(s, 'c', { type: 'draw' });
  assert.equal(s.players[2].hand.length, 6); assert.equal(s.pending, 0); assert.equal(s.turn, 0);
});

test('empilhar: +4 sobre +4 acumula 8', () => {
  let s = at({ n: 3, hands: [[C(null, 'mais4'), 1], [C2(null, 'mais4'), 2], [3, 4]], top: C('sol', 'n', 1), opts: RUA('empilhar') });
  s = u.act(s, 'a', { type: 'play', id: C(null, 'mais4') });
  s = u.act(s, 'a', { type: 'color', color: 'gota' });
  s = u.act(s, 'b', { type: 'play', id: C2(null, 'mais4') });
  s = u.act(s, 'b', { type: 'color', color: 'folha' });
  assert.equal(s.phase, 'challenge'); assert.equal(s.turn, 2);
  s = u.act(s, 'c', { type: 'accept' });
  assert.equal(s.players[2].hand.length, 10); assert.equal(s.turn, 0);
});

test('corte: carta idêntica joga fora da vez', () => {
  const s = at({ n: 3, hands: [[1, 2], [3, 4], [C2('sol', 'n', 5), 6]], top: C('sol', 'n', 5), opts: RUA('corte') });
  assert.deepEqual(u.pendingPlayers(s), ['a', 'b', 'c']);
  assert.equal(u.act(s, 'b', { type: 'jump', id: 3 }), null);
  const t = u.act(s, 'c', { type: 'jump', id: C2('sol', 'n', 5) });
  assert.equal(t.players[2].hand.length, 1); assert.equal(t.turn, 0); // segue a partir de quem cortou
  // Sem a regra, não pode.
  const o = at({ n: 3, hands: [[1, 2], [3, 4], [C2('sol', 'n', 5), 6]], top: C('sol', 'n', 5) });
  assert.equal(u.act(o, 'c', { type: 'jump', id: C2('sol', 'n', 5) }), null);
});

test('7 troca a mão; 0 gira todas', () => {
  let s = at({ n: 3, hands: [[C('sol', 'n', 7), 1, 2], [3], [4, 5, 6, 8]], top: C('sol', 'n', 1), opts: RUA('seteZero') });
  s = u.act(s, 'a', { type: 'play', id: C('sol', 'n', 7) });
  assert.equal(s.phase, 'swap');
  s = u.act(s, 'a', { type: 'swap', target: 1 });
  assert.deepEqual(s.players[0].hand, [3]); assert.deepEqual(s.players[1].hand, [1, 2]); assert.equal(s.turn, 1);
  s = at({ n: 3, hands: [[C('sol', 'n', 0), 1, 2], [3], [4, 5, 6]], top: C('sol', 'n', 1), opts: RUA('seteZero') });
  s = u.act(s, 'a', { type: 'play', id: C('sol', 'n', 0) });
  assert.deepEqual(s.players.map((p) => p.hand), [[4, 5, 6], [1, 2], [3]]);
});

test('compra até poder jogar', () => {
  let s = at({ hands: [[C('gota', 'n', 2)], [3]], top: C('sol', 'n', 1), opts: RUA('compraAte') });
  s.deck.push(C('sol', 'n', 7), C('folha', 'n', 8), C('folha', 'n', 9));
  s = u.act(s, 'a', { type: 'draw' });
  assert.equal(s.players[0].hand.length, 4); assert.equal(s.drawn, C('sol', 'n', 7));
});

test('bate só com número; +4 sem desafio', () => {
  const s = at({ hands: [[C('sol', 'pula')], [3]], top: C('sol', 'n', 1), opts: RUA('bateNumero') });
  assert.deepEqual(u.playable(s, s.players[0].hand), []);
  let t = at({ hands: [[C(null, 'mais4'), C('sol', 'n', 3)], [3, 4]], top: C('sol', 'n', 1), opts: RUA('mais4Livre') });
  t = u.act(t, 'a', { type: 'play', id: C(null, 'mais4') });
  t = u.act(t, 'a', { type: 'color', color: 'gota' });
  assert.equal(t.phase, 'play'); assert.equal(t.players[1].hand.length, 6); assert.equal(t.turn, 0);
});

// ------------------------------------------- partidas inteiras de robôs

/** Como o driver: tenta cada robô na ordem de quem pode agir. */
function playOut(n, opts, levels) {
  let s = u.setup(P(n), opts);
  for (let k = 0; k < 6000 && s.phase !== 'over'; k++) {
    let acted = false;
    for (const id of u.pendingPlayers(s)) {
      const a = bot.decide(u.view(s, id), id, levels[id] || 'medio');
      if (!a) continue;
      const nx = u.act(s, id, a);
      assert.ok(nx, `jogada ilegal ${JSON.stringify(a)} na fase ${s.phase}`);
      s = nx; acted = true;
      assert.equal(total(s), 108);
      break;
    }
    assert.ok(acted, `ninguém agiu na fase ${s.phase}`);
  }
  assert.equal(s.phase, 'over');
  return s.players[s.winner].id;
}

test('robôs terminam partidas com qualquer regra (cartas sempre 108)', () => {
  const all = RUA(...u.HOUSE);
  for (let i = 0; i < 40; i++) playOut(2 + (i % 5), i % 2 ? all : {}, {});
  for (let i = 0; i < 6; i++) playOut(4, { ...(i % 2 ? all : {}), vitoria: 'pontos' }, {});
});

test('robô difícil vence o fácil', () => {
  let d = 0;
  for (let i = 0; i < 300; i++) if (playOut(2, {}, i % 2 ? { a: 'dificil', b: 'facil' } : { b: 'dificil', a: 'facil' }) === (i % 2 ? 'a' : 'b')) d++;
  assert.ok(d >= 165, `difícil venceu só ${d}/300`);
});
