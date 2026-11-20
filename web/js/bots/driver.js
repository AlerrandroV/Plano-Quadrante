// Faz os robôs jogarem numa partida (mesma tela ou sala).
// Depois de cada mudança de estado, chame driver.kick(): se for a vez de um
// robô, ele espera as animações, pensa (num Web Worker) e joga.
import { decide } from './index.js';
import { getGame } from '../games/index.js';

let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const done = pending.get(e.data.id);
      pending.delete(e.data.id);
      done?.(e.data.action);
    };
    worker.onerror = () => { worker = false; for (const [, done] of pending) done(undefined); pending.clear(); };
  } catch {
    worker = false; // sem Worker: pensa na própria página
  }
  return worker;
}

/** Pede uma decisão ao robô (no Worker, se possível). */
export function think(gameId, state, botId, level) {
  const w = getWorker();
  if (!w) return Promise.resolve(decide(gameId, state, botId, level));
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, (action) => resolve(action === undefined ? decide(gameId, state, botId, level) : action));
    w.postMessage({ id, gameId, state, botId, level });
  });
}

/**
 * bots: Map(id -> nível). getState(): estado atual. apply(id, ação).
 */
export function botDriver({ gameId, bots, getState, apply }) {
  let version = 0;
  let timer = null;
  let stopped = false;

  function kick() {
    version += 1;
    clearTimeout(timer);
    if (stopped || !bots.size) return;
    const state = getState();
    if (!state) return;
    const game = getGame(gameId);
    const ids = game.pendingPlayers ? game.pendingPlayers(state) : game.activePlayers(state);
    const botIds = ids.filter((id) => bots.has(id));
    if (!botIds.length) return;
    const v = version;
    timer = setTimeout(async () => {
      // Pergunta a cada robô que pode agir (na ordem); o primeiro que tiver
      // algo a fazer joga. Ex.: na Última Carta, qualquer um pode "pegar"
      // quem não gritou ou cortar fora da vez.
      for (const botId of botIds) {
        // O robô vê só o que um jogador veria (importante em jogos com cartas escondidas).
        const action = await think(gameId, game.view(state, botId), botId, bots.get(botId));
        if (stopped || v !== version) return;
        if (action) { apply(botId, action); return; }
      }
    }, waitFor(gameId, state));
  }

  return {
    kick,
    stop() { stopped = true; clearTimeout(timer); },
  };
}

// Tempo para a pessoa acompanhar: animação dos dados, salto da peça etc.
function waitFor(gameId, state) {
  if (gameId === 'dominio-da-teia') {
    if (state.phase === 'roll') return 650;
    if (state.phase === 'bonus') return 800;
    return 1050; // depois da rolagem: dados girando (750 ms)
  }
  if (gameId === 'domino') {
    if (state.phase === 'round') return 4000; // tempo para ver o resultado da rodada
    return 900;
  }
  if (gameId === 'ultima-carta') {
    if (state.phase === 'round') return 4000;
    if (state.vulnerable != null) return 1300; // dá tempo de a pessoa gritar ou pegar
    if (state.phase === 'color' || state.phase === 'challenge') return 900;
    return 800;
  }
  if (gameId === 'damas') {
    const segs = state.last ? state.last.path.length : 0;
    return 550 + segs * 190;
  }
  return 700;
}
