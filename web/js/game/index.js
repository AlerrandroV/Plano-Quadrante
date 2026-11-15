// Ponto único que diz QUAL jogo está ativo: lógica (regras) + interface.
import * as logic from './plano.js';
import { render } from './plano-ui.js';

export const game = { ...logic, render };
