// Ponto único que diz QUAL jogo está ativo. Para trocar pelo jogo real,
// crie os arquivos de lógica e de interface e aponte os imports aqui.
import * as logic from './quadrantes.js';
import { render } from './quadrantes-ui.js';

export const game = { ...logic, render };
