import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignColors, firstFree, COLOR_ORDER } from '../web/js/ui/colors.js';

test('firstFree respeita as preferidas e pula as ocupadas', () => {
  assert.equal(firstFree(['azul'], ['azul', 'verde']), 'verde');
  assert.equal(firstFree([], []), COLOR_ORDER[0]);
});

test('assignColors: cores únicas, mantendo o pedido de quem chegou primeiro', () => {
  const out = assignColors([{ color: 'preto' }, { color: 'preto' }, { color: 'xyz' }], ['branco', 'preto']);
  assert.equal(out[0].color, 'preto');
  assert.equal(new Set(out.map((p) => p.color)).size, 3);
  assert.equal(out[1].color, 'branco');
});
