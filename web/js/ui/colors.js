// Cores que os jogadores podem escolher para as suas peças (vale para
// todos os jogos da plataforma). Duas pessoas não podem ter a mesma cor.
export const COLOR_ORDER = ['azul', 'vermelho', 'verde', 'laranja', 'roxo', 'rosa', 'amarelo', 'ciano', 'branco', 'preto'];

export const COLOR_LABEL = {
  azul: 'Azul', vermelho: 'Vermelho', verde: 'Verde', laranja: 'Laranja', roxo: 'Roxo',
  rosa: 'Rosa', amarelo: 'Amarelo', ciano: 'Ciano', branco: 'Branco', preto: 'Preto',
};

export function isColor(c) {
  return COLOR_ORDER.includes(c);
}

/** Primeira cor livre, tentando antes as preferidas (na ordem). */
export function firstFree(taken, preferred = []) {
  const used = new Set(taken);
  for (const c of [...preferred, ...COLOR_ORDER]) if (isColor(c) && !used.has(c)) return c;
  return COLOR_ORDER[0];
}

/**
 * Garante cores únicas: quem pediu uma cor já usada recebe a próxima livre
 * (da lista `defaults` do jogo, depois da paleta).
 */
export function assignColors(players, defaults = []) {
  const taken = [];
  return players.map((p, i) => {
    const want = isColor(p.color) && !taken.includes(p.color) ? p.color : null;
    const color = want || firstFree(taken, [defaults[i], ...defaults]);
    taken.push(color);
    return { ...p, color };
  });
}
